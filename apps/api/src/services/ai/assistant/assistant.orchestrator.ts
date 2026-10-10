import { businessDateKey, instantToBusinessDate } from '../../../lib/businessDate';
import { AiActor, resolveAiActor } from '../actor/ai-actor';
import { AiAuditService, ToolAuditEntry } from '../audit/ai-audit.service';
import { buildChart, ChartPayload, DatasetStore } from '../charts/chart-schema';
import { getAiAvailability, getAiConfig } from '../config/ai-config';
import { ConversationService, MessageStatus, newMessageId, StoredMessage } from '../conversation/conversation.service';
import { classifyInput, GuardResult, normaliseMessage } from '../guard/input-guard';
import { cleanAnswer, cleanFollowUps } from '../guard/output-guard';
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

function finalFromSubmit(raw: unknown, actor: AiActor, datasets: DatasetStore): Outcome {
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

  return {
    status: answer.status,
    content: cleaned.text,
    charts: charts.length ? charts : undefined,
    links: links.length ? links : undefined,
    followUps: cleanFollowUps(answer.followUps),
    notices: notices.length ? notices : undefined,
  };
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
  const ctx: ToolContext = { actor, datasets, now, today };
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
      if (result.text) return finalFromSubmit({ answer: result.text, status: 'ANSWERED' }, actor, datasets);
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
        args = {};
      }
      return finalFromSubmit(args, actor, datasets);
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
