import { PermissionTier } from '@prisma/client';
import { businessDateKey, instantToBusinessDate } from '../../../lib/businessDate';
import { AiActor, resolveAiActor } from '../actor/ai-actor';
import { AiAuditService, ToolAuditEntry } from '../audit/ai-audit.service';
import { buildChart, ChartPayload, DatasetStore } from '../charts/chart-schema';
import { getAiAvailability, getAiConfig } from '../config/ai-config';
import { ConversationService, MessageStatus, newMessageId, StoredMessage } from '../conversation/conversation.service';
import { classifyInput, GuardResult, normaliseMessage } from '../guard/input-guard';
import { cleanAnswer, cleanFollowUps, stripIdentifiers } from '../guard/output-guard';
import { searchKnowledge } from '../knowledge/knowledge.service';
import { validateLink, SafeLink } from '../links/app-links';
import {
  buildSystemPolicy,
  OUT_OF_SCOPE_MESSAGE,
  REFUSAL_MESSAGES,
  SUBMIT_ANSWER_TOOL,
  submitAnswerSchema,
  submitAnswerSpec,
  SUGGESTIONS,
  SubmitAnswer,
} from '../policy/ai-policy';
import { AiProvider, AiProviderError, ChatMessage, getAiProvider, hasTestProvider, ToolCall } from '../provider';
import { executeTool, toolSpecsForTier } from '../tools/registry';
import { weekdayOf } from '../tools/tool-helpers';
import type { ToolContext } from '../tools/tool-types';
import { DraftStore, MessageAction } from '../actions/job-opening-draft';

/**
 * The assistant's request pipeline.
 *
 *   1. Resolve WHO is asking from the database (never from the request body).
 *   2. Load the conversation only if this user owns it.
 *   3. Deterministic guard: refuse secrets / SQL / injection / payroll /
 *      clearly-off-topic without calling a model.
 *   4. If no provider is configured, say so — and still offer the Help Center
 *      guides that match, found deterministically.
 *   5. Tool loop: the model may call only the tools offered to this tier; every
 *      call is re-authorized and validated by the registry.
 *   6. The model must finish with `submit_answer`; its answer is validated,
 *      cleaned, its charts built from server-side datasets, its links checked.
 *   7. Persist the turn (text + final answer only), write the audit trail.
 */

export const MAX_MESSAGE_CHARS = 2000;
const MAX_CALLS_PER_ROUND = 6;
const MAX_TOTAL_CALLS = 18;

export interface AssistantReply {
  conversationId: string;
  aiAvailable: boolean;
  userMessage: StoredMessage;
  message: StoredMessage;
}

interface Outcome {
  status: MessageStatus;
  content: string;
  charts?: ChartPayload[];
  links?: SafeLink[];
  followUps?: string[];
  notices?: string[];
  action?: MessageAction;
}

interface RunState {
  toolAudit: ToolAuditEntry[];
  rounds: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error?: string;
}

function businessToday(now: Date): string {
  return businessDateKey(instantToBusinessDate(now));
}

function addTokens(current: number | null, add: number | null): number | null {
  if (add === null) return current;
  return (current ?? 0) + add;
}

function guardOutcome(guard: GuardResult, actor: AiActor): Outcome {
  switch (guard.verdict) {
    case 'SECRETS':
      return {
        status: 'REFUSED',
        content: REFUSAL_MESSAGES.SECRETS,
        links: [validateLink(actor, { path: '/help-center/forgot-password', label: 'Forgot password guide' })].filter(Boolean) as SafeLink[],
      };
    case 'SQL':
      return { status: 'REFUSED', content: REFUSAL_MESSAGES.SQL, followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
    case 'INJECTION':
      return { status: 'REFUSED', content: REFUSAL_MESSAGES.injection(actor.tier), followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
    case 'PAYROLL':
      return { status: 'OUT_OF_SCOPE', content: REFUSAL_MESSAGES.PAYROLL, followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
    default:
      return { status: 'OUT_OF_SCOPE', content: OUT_OF_SCOPE_MESSAGE, followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
  }
}

/** Without a provider: say so plainly, and still point at the right guides. */
function unavailableOutcome(question: string, actor: AiActor, reason: string): Outcome {
  const hits = searchKnowledge(question, actor.tier, 6).filter((h) => h.entry.kind === 'guide').slice(0, 3);
  const links = hits
    .map((h) => validateLink(actor, { path: h.entry.link, label: h.entry.title.slice(0, 60) }))
    .filter(Boolean) as SafeLink[];
  return {
    status: 'AI_UNAVAILABLE',
    content: links.length
      ? `${reason}\n\nThese Help Center guides may answer your question in the meantime:`
      : reason,
    links,
  };
}

function finalFromSubmit(raw: unknown, actor: AiActor, datasets: DatasetStore, drafts?: DraftStore, toolAudit: ToolAuditEntry[] = []): Outcome {
  const parsed = submitAnswerSchema.safeParse(raw);
  let answer: SubmitAnswer;
  const notices: string[] = [];
  if (parsed.success) {
    answer = parsed.data;
  } else {
    // Salvage the text; drop anything else that did not validate.
    const text = typeof (raw as any)?.answer === 'string' ? (raw as any).answer : '';
    answer = { answer: text, status: 'ANSWERED' };
    if (!text) return { status: 'ERROR', content: 'AI Assistance produced an answer that could not be read. Please try asking again.' };
  }

  if (answer.status === 'OUT_OF_SCOPE') {
    return { status: 'OUT_OF_SCOPE', content: OUT_OF_SCOPE_MESSAGE, followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
  }

  const cleaned = cleanAnswer(answer.answer);
  cleaned.text = stripIdentifiers(cleaned.text, { hideEmployeeNumbers: actor.tier === PermissionTier.SUPERVISOR }).text.trim();
  if (!cleaned.text) {
    return { status: 'OUT_OF_SCOPE', content: OUT_OF_SCOPE_MESSAGE, followUps: SUGGESTIONS[actor.tier].slice(0, 3) };
  }

  const charts: ChartPayload[] = [];
  for (const request of answer.charts ?? []) {
    const built = buildChart(datasets, request);
    if (built.ok) charts.push(built.chart);
    else notices.push(`A chart was left out: ${built.reason}`);
  }

  const links: SafeLink[] = [];
  for (const link of answer.links ?? []) {
    const safe = validateLink(actor, link);
    if (safe && !links.some((l) => l.path === safe.path)) links.push(safe);
  }

  // A job opening HR asked for: only a draft the tool validated in THIS request.
  let action: MessageAction | undefined;
  if (answer.jobOpeningDraftId && actor.tier === PermissionTier.FULL) {
    const draft = drafts?.get(answer.jobOpeningDraftId);
    if (draft) action = { kind: 'JOB_OPENING', state: 'DRAFT', draft };
    else notices.push('The job opening could not be attached — ask again to prepare it.');
  }

  // "Outside your access" only when a lookup really refused; otherwise the
  // label would blame the user's access for something the assistant could not do.
  let status = answer.status;
  if (status === 'NOT_AUTHORIZED' && !toolAudit.some((t) => t.code === 'NOT_AUTHORIZED')) status = 'ANSWERED';

  return {
    status,
    content: action ? trimJobOpeningRepeat(cleaned.text, action.draft) : cleaned.text,
    charts: charts.length ? charts : undefined,
    links: links.length ? links : undefined,
    followUps: cleanFollowUps(answer.followUps).map((f) => stripIdentifiers(f, { hideEmployeeNumbers: actor.tier === PermissionTier.SUPERVISOR }).text.trim()),
    notices: notices.length ? notices : undefined,
    action,
  };
}

const JOB_FIELDS = /^(?:title|job title|position|role|job role|unit|department|employment(?: type)?|type|vacanc(?:y|ies)|slots?|opening date|opens|closing date|closes|dates?|description|responsibilities|duties|qualifications|requirements|required documents|documents)\b/i;

/**
 * The job opening card already shows every field, so a field-by-field repeat in
 * the answer text is removed (field lines, and the bullet lists under a field
 * heading), as is any mention of the internal draft id. What is left is the
 * model's own explanation; if nothing is left, a one-line summary.
 */
export function trimJobOpeningRepeat(text: string, draft: { title: string; vacancies: number; closingDate: string }): string {
  const out: string[] = [];
  // After a field heading ("### Responsibilities", "**Description:**"), the block
  // under it is skipped up to the next blank line.
  let skipping = false;
  let skippedSomething = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bare = line.replace(/^#{1,3}\s+/, '').replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim();
    if (skipping) {
      if (!line && skippedSomething) skipping = false;
      else if (line) skippedSomething = true;
      continue;
    }
    if (/draft\s*id/i.test(line)) continue;
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) continue;
    if (/details\s*[:.]?$/i.test(bare) && bare.length <= 60) continue;
    if (JOB_FIELDS.test(bare) && bare.length <= 200) {
      // A field with its value on the same line is dropped; a bare heading also drops the block under it.
      if (!/:\s*\S/.test(bare) || /^#{1,3}\s/.test(line) || bare.length <= 40) {
        skipping = true;
        skippedSomething = false;
      }
      continue;
    }
    out.push(raw);
  }
  const trimmed = out
    .join('\n')
    // "Here are the details:" / "Please see the full breakdown below:" point at text that is gone.
    .replace(/\s*(?:here are|below are|please see|see)\s+the\s+(?:full\s+)?(?:details|breakdown)[^.:\n]*[:.]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/:\s*$/, '.')
    .trim();
  return trimmed.length >= 20
    ? trimmed
    : `I've prepared a job opening for **${draft.title}** (${draft.vacancies} ${draft.vacancies === 1 ? 'vacancy' : 'vacancies'}, closing ${draft.closingDate}). Review it on the card below, then press **Publish job opening** — or **Edit in the form first**.`;
}

/**
 * When the model's answer runs past the output limit, its submit_answer JSON is
 * cut off and cannot be parsed. Keep the answer text that did arrive (and say it
 * was cut short) rather than failing the whole question.
 */
export function salvageCutOffAnswer(raw: string): unknown {
  const m = /"answer"\s*:\s*"((?:[^"\\]|\\.)*)/s.exec(raw);
  if (!m || !m[1].trim()) return {};
  let text = m[1];
  try {
    text = JSON.parse(`"${text.replace(/\\$/, '')}"`);
  } catch {
    text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return { answer: `${text.trimEnd()}\n\n(This answer was cut short. Ask for fewer people or one unit at a time.)`, status: 'ANSWERED' };
}

async function runModel(
  provider: AiProvider,
  actor: AiActor,
  question: string,
  history: ChatMessage[],
  now: Date,
  state: RunState
): Promise<Outcome> {
  const config = getAiConfig();
  const today = businessToday(now);
  const datasets = new DatasetStore();
  const drafts = new DraftStore();
  const ctx: ToolContext = { actor, datasets, drafts, now, today };
  const system = buildSystemPolicy(actor, today, weekdayOf(today));
  const tools = [...toolSpecsForTier(actor.tier), submitAnswerSpec];
  const messages: ChatMessage[] = [...history, { role: 'user', content: question }];
  let totalCalls = 0;

  for (let round = 0; round < config.maxToolRounds; round++) {
    const last = round === config.maxToolRounds - 1 || totalCalls >= MAX_TOTAL_CALLS;
    const result = await provider.complete({
      system,
      messages,
      tools: last ? [submitAnswerSpec] : tools,
      toolChoice: last ? { name: SUBMIT_ANSWER_TOOL } : 'required',
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });
    state.rounds = round + 1;
    state.inputTokens = addTokens(state.inputTokens, result.usage.inputTokens);
    state.outputTokens = addTokens(state.outputTokens, result.usage.outputTokens);

    if (!result.toolCalls.length) {
      // A model that ignores tool_choice and answers in text: accept it as an
      // answer, through the same cleaning as submit_answer.
      if (result.text) return finalFromSubmit({ answer: result.text, status: 'ANSWERED' }, actor, datasets, drafts, state.toolAudit);
      // Nothing at all — typically a reasoning model that spent its whole output
      // budget thinking. Stop instead of retrying: each retry costs a request
      // against the provider's daily limit.
      state.error = `EMPTY_RESPONSE: finish_reason=${result.finishReason ?? 'unknown'}`;
      return {
        status: 'ERROR',
        content:
          result.finishReason === 'length'
            ? 'The AI model ran out of room before it could answer. Please ask a narrower question (for example a shorter period or one unit).'
            : 'The AI model returned no answer. Please try asking again.',
      };
    }

    const submit = result.toolCalls.find((c) => c.name === SUBMIT_ANSWER_TOOL);
    const dataCalls = result.toolCalls.filter((c) => c.name !== SUBMIT_ANSWER_TOOL);

    // Data calls in the same turn run first, so a chart in the same submit can use them.
    const executed: Array<{ call: ToolCall; content: string }> = [];
    for (const [i, call] of dataCalls.entries()) {
      if (i >= MAX_CALLS_PER_ROUND || totalCalls >= MAX_TOTAL_CALLS) {
        executed.push({ call, content: JSON.stringify({ ok: false, error: 'TOO_MANY_CALLS', message: 'Too many lookups in one answer. Answer with what you have.' }) });
        continue;
      }
      totalCalls++;
      const run = await executeTool(ctx, call.name, call.arguments);
      state.toolAudit.push({ name: run.name, ok: run.ok, code: run.code, targetEmployeeId: run.targetEmployeeId, rows: run.rows, ms: run.ms, round: round + 1 });
      executed.push({ call, content: run.content });
    }

    if (submit) {
      let args: unknown = {};
      try {
        args = JSON.parse(submit.arguments || '{}');
      } catch {
        args = salvageCutOffAnswer(submit.arguments || '');
      }
      return finalFromSubmit(args, actor, datasets, drafts, state.toolAudit);
    }

    messages.push({ role: 'assistant', content: result.text, toolCalls: dataCalls });
    for (const { call, content } of executed) messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content });
  }

  return { status: 'ERROR', content: 'AI Assistance could not finish this answer. Please try a more specific question.' };
}

export class AssistantOrchestrator {
  static async handle(input: { userId: string; message: string; conversationId?: string }): Promise<AssistantReply> {
    const started = Date.now();
    const now = new Date();
    const actor = await resolveAiActor(input.userId);
    const question = normaliseMessage(input.message).slice(0, MAX_MESSAGE_CHARS);

    // Ownership is checked before anything else happens with the conversation.
    const conversation = input.conversationId ? await ConversationService.getOwned(actor, input.conversationId) : null;

    const config = getAiConfig();
    const availability = getAiAvailability(config);
    const provider = hasTestProvider() || availability.available ? getAiProvider() : null;

    const logId = await AiAuditService.start({
      userId: actor.userId,
      tier: actor.tier,
      question,
      conversationId: conversation?.id ?? null,
      provider: provider?.name ?? null,
      model: provider?.model ?? 'none',
    });

    const state: RunState = { toolAudit: [], rounds: 0, inputTokens: null, outputTokens: null };
    const guard = classifyInput(question, actor.tier);
    let outcome: Outcome;

    if (guard.verdict !== 'ALLOW') {
      outcome = guardOutcome(guard, actor);
    } else if (!provider) {
      outcome = unavailableOutcome(question, actor, availability.reason ?? 'AI Assistance is not configured on this server.');
    } else {
      try {
        const history = ConversationService.toHistory(conversation?.messages ?? [], config.historyMessages);
        outcome = await runModel(provider, actor, question, history, now, state);
      } catch (err: any) {
        const kind = err instanceof AiProviderError ? err.kind : 'UNEXPECTED';
        state.error = `${kind}: ${String(err?.message ?? err).slice(0, 500)}`;
        if (!(err instanceof AiProviderError)) console.error('[AI assistant] unexpected failure:', err);
        outcome = {
          status: 'ERROR',
          content:
            kind === 'AUTH'
              ? 'AI Assistance is configured, but the AI provider rejected its key. Please tell your HRISense administrator.'
              : kind === 'QUOTA'
                ? "AI Assistance is configured, but the AI provider account has run out of credit, so typed questions can't be answered right now. Please tell your HRISense administrator. Quick analytics (the chart button) still work."
                : kind === 'RATE_LIMIT'
                ? 'The AI provider is busy right now. Please try again in a minute.'
                : kind === 'TIMEOUT'
                  ? 'The AI provider took too long to answer. Please try again, or ask a narrower question.'
                  : 'AI Assistance could not answer right now. Your HRISense data is unaffected — please try again shortly.',
        };
      }
    }

    const userMessage: StoredMessage = { id: newMessageId(), role: 'user', content: question, createdAt: now.toISOString() };
    const assistantMessage: StoredMessage = {
      id: newMessageId(),
      role: 'assistant',
      content: outcome.content,
      status: outcome.status,
      ...(outcome.charts ? { charts: outcome.charts } : {}),
      ...(outcome.links?.length ? { links: outcome.links } : {}),
      ...(outcome.followUps?.length ? { followUps: outcome.followUps } : {}),
      ...(outcome.notices ? { notices: outcome.notices } : {}),
      ...(outcome.action ? { action: outcome.action } : {}),
      createdAt: new Date().toISOString(),
    };

    const conversationId = await ConversationService.appendTurn(
      actor,
      conversation?.id ?? null,
      userMessage,
      assistantMessage,
      provider?.model ?? 'none'
    );

    await AiAuditService.finish(logId, actor.userId, started, {
      outcome: outcome.status,
      answer: outcome.content,
      conversationId,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      toolCalls: state.toolAudit,
      rounds: state.rounds,
      error: state.error,
      failed: outcome.status === 'ERROR',
      guardRule: guard.rule,
    });

    return { conversationId, aiAvailable: Boolean(provider), userMessage, message: assistantMessage };
  }
}
