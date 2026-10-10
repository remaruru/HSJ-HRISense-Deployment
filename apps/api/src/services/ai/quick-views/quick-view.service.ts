import { AppError } from '../../../middleware/errorHandler';
import { businessDateKey, instantToBusinessDate } from '../../../lib/businessDate';
import { resolveAiActor } from '../actor/ai-actor';
import { AiAuditService } from '../audit/ai-audit.service';
import { buildChart, ChartPayload, DatasetStore } from '../charts/chart-schema';
import { ConversationService, MessageStatus, newMessageId, StoredMessage } from '../conversation/conversation.service';
import { SafeLink, validateLink } from '../links/app-links';
import { executeTool } from '../tools/registry';
import type { ToolContext } from '../tools/tool-types';
import { getQuickView } from './quick-views';

/**
 * Runs one Quick analytics view: no AI provider involved.
 *
 *   view id → actor from the database → the view must be allowed for this tier
 *   → executeTool (same tier + scope + argument checks as the assistant)
 *   → charts built from the tool's server-side datasets → templated summary
 *   → stored in the user's conversation → audited (channel QUICK_VIEW).
 */
export class QuickViewService {
  static async run(input: { userId: string; viewId: string; conversationId?: string }) {
    const started = Date.now();
    const now = new Date();
    const actor = await resolveAiActor(input.userId);
    // Unknown and not-allowed ids are indistinguishable.
    const view = getQuickView(input.viewId, actor.tier);
    if (!view) throw new AppError('That quick view is not available.', 404);
    const conversation = input.conversationId ? await ConversationService.getOwned(actor, input.conversationId) : null;

    const today = businessDateKey(instantToBusinessDate(now));
    const ctx: ToolContext = { actor, datasets: new DatasetStore(), now, today };
    const logId = await AiAuditService.start({
      userId: actor.userId,
      tier: actor.tier,
      question: `QUICK VIEW: ${view.id}`,
      conversationId: conversation?.id ?? null,
      provider: null,
      model: 'none',
      channel: 'QUICK_VIEW',
    });

    const run = await executeTool(ctx, view.tool, JSON.stringify(view.args(today)));
    const parsed = JSON.parse(run.content);

    let status: MessageStatus = 'ANSWERED';
    let content: string;
    const charts: ChartPayload[] = [];
    const notices: string[] = [];
    if (!run.ok) {
      status = run.code === 'NOT_AUTHORIZED' ? 'NOT_AUTHORIZED' : 'ERROR';
      content = parsed.message ?? 'This view could not be produced.';
    } else {
      content = view.summarize(parsed.data);
      for (const spec of view.charts) {
        const datasetId = spec.pick(parsed.data);
        if (!datasetId) continue; // the tool had nothing to chart (e.g. no records)
        const built = buildChart(ctx.datasets, { datasetId, type: spec.type, ...(spec.seriesKeys ? { seriesKeys: spec.seriesKeys } : {}), ...(spec.title ? { title: spec.title } : {}) });
        if (built.ok) charts.push(built.chart);
        else notices.push(`A chart was left out: ${built.reason}`);
      }
      if (parsed.truncated) notices.push('Some lists were shortened to fit.');
    }
    const links = (view.links ?? []).map((l) => validateLink(actor, l)).filter(Boolean) as SafeLink[];

    const userMessage: StoredMessage = { id: newMessageId(), role: 'user', content: view.label, createdAt: now.toISOString() };
    const assistantMessage: StoredMessage = {
      id: newMessageId(),
      role: 'assistant',
      content,
      status,
      ...(charts.length ? { charts } : {}),
      ...(links.length ? { links } : {}),
      ...(notices.length ? { notices } : {}),
      createdAt: new Date().toISOString(),
    };
    const conversationId = await ConversationService.appendTurn(actor, conversation?.id ?? null, userMessage, assistantMessage, 'none');

    await AiAuditService.finish(logId, actor.userId, started, {
      outcome: status,
      answer: content,
      conversationId,
      inputTokens: null,
      outputTokens: null,
      toolCalls: [{ name: run.name, ok: run.ok, code: run.code, targetEmployeeId: run.targetEmployeeId, rows: run.rows, ms: run.ms, round: 1 }],
      rounds: 0,
      failed: status === 'ERROR',
    });

    return { conversationId, userMessage, message: assistantMessage };
  }
}
