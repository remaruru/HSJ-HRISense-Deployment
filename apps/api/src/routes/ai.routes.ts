import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { AiService } from '../services/ai/ai.service';
import { AssistantOrchestrator, MAX_MESSAGE_CHARS } from '../services/ai/assistant/assistant.orchestrator';
import { resolveAiActor, TIER_LABEL } from '../services/ai/actor/ai-actor';
import { ConversationService } from '../services/ai/conversation/conversation.service';
import { getAiAvailability, getAiConfig } from '../services/ai/config/ai-config';
import { SUGGESTIONS } from '../services/ai/policy/ai-policy';
import { quickViewsForTier } from '../services/ai/quick-views/quick-views';
import { QuickViewService } from '../services/ai/quick-views/quick-view.service';
import { prisma } from '../config/prisma';
import { JobOpeningService } from '../services/job-opening.service';
import { RecruitmentPolicy, RecruitmentPolicyContext } from '../policies/recruitment.policy';
import { MessageAction, jobOpeningDraftSchema } from '../services/ai/actions/job-opening-draft';
import { answerToBlocks, ExportDocument, exportToExcel, exportToPdf } from '../services/ai/export/ai-export';
import { chartPayloadSchema } from '../services/ai/charts/chart-schema';
import { phDateTime } from '../lib/pdf-brand';
import { JobOpeningStatus } from '@prisma/client';

const router = Router();

/**
 * AI Assistance.
 *
 *   /ai/status, /ai/assistant/*   every signed-in user (HR, supervisors, employees)
 *   /ai/facts, /ai/analyze, /ai/ask   HR only — organisation-wide fact sheet
 *
 * Who the user is, their tier, employee record and team are resolved on the
 * server for every request (see services/ai/actor). No request body, query
 * string or header can change them: the chat endpoint accepts exactly
 * `{ message, conversationId? }` and rejects anything else.
 */
router.use(authenticate);

const uuid = z.string().uuid();

/** Per-user limit for assistant questions (a provider call can be costly). */
const assistantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => getAiConfig().rateLimitPerHour,
  keyGenerator: (req) => `ai:${req.user?.userId ?? 'anonymous'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'You have asked AI Assistance a lot of questions in the last hour. Please try again a little later.' },
});

/** GET /ai/status — whether AI answers are configured. Never includes key material. */
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: AiService.availability() });
  })
);

/** GET /ai/assistant/context — who the assistant thinks you are, and suggested questions. */
router.get(
  '/assistant/context',
  asyncHandler(async (req, res) => {
    const actor = await resolveAiActor(req.user!.userId);
    const availability = getAiAvailability();
    res.json({
      success: true,
      data: {
        availability,
        accessLevel: actor.tier,
        accessLabel: TIER_LABEL[actor.tier],
        firstName: actor.firstName,
        directReports: actor.tier === 'STANDARD' ? 0 : actor.directReportIds.length,
        suggestions: SUGGESTIONS[actor.tier],
        // Deterministic analytics that work with or without an AI provider.
        quickViews: quickViewsForTier(actor.tier),
        maxMessageLength: MAX_MESSAGE_CHARS,
      },
    });
  })
);

const messageBody = z
  .object({
    message: z.string().trim().min(1, 'Please type a question.').max(MAX_MESSAGE_CHARS, `Please keep your question under ${MAX_MESSAGE_CHARS} characters.`),
    conversationId: uuid.optional(),
  })
  .strict();

/** POST /ai/assistant/messages — ask a question. */
router.post(
  '/assistant/messages',
  assistantLimiter,
  asyncHandler(async (req, res) => {
    const parsed = messageBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message =
        issue?.code === 'unrecognized_keys'
          ? 'This request contains fields the assistant does not accept. Your access level is determined by HRISense, not by the request.'
          : issue?.message ?? 'Invalid request.';
      throw new AppError(message, 400);
    }
    const reply = await AssistantOrchestrator.handle({
      userId: req.user!.userId,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    });
    res.json({ success: true, data: reply });
  })
);

const quickViewBody = z.object({ conversationId: uuid.optional() }).strict();

/**
 * POST /ai/assistant/quick-views/:viewId — run a Quick analytics view.
 * The body may only carry a conversation id; the view's arguments are fixed on
 * the server, so a view cannot be pointed at another person or widened.
 */
router.post(
  '/assistant/quick-views/:viewId',
  assistantLimiter,
  asyncHandler(async (req, res) => {
    const parsed = quickViewBody.safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError('This request contains fields a quick view does not accept.', 400);
    if (!/^[a-z0-9-]{3,60}$/.test(req.params.viewId)) throw new AppError('That quick view is not available.', 404);
    const reply = await QuickViewService.run({ userId: req.user!.userId, viewId: req.params.viewId, conversationId: parsed.data.conversationId });
    res.json({ success: true, data: { ...reply, aiAvailable: getAiAvailability().available } });
  })
);

/** GET /ai/assistant/conversations — your own conversations. */
router.get(
  '/assistant/conversations',
  asyncHandler(async (req, res) => {
    const actor = await resolveAiActor(req.user!.userId);
    res.json({ success: true, data: await ConversationService.list(actor) });
  })
);

/** GET /ai/assistant/conversations/:id — one of your conversations (404 for anyone else's). */
router.get(
  '/assistant/conversations/:id',
  asyncHandler(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) throw new AppError('Conversation not found.', 404);
    const actor = await resolveAiActor(req.user!.userId);
    res.json({ success: true, data: await ConversationService.getOwned(actor, req.params.id) });
  })
);

/** DELETE /ai/assistant/conversations/:id — hide one of your conversations. */
router.delete(
  '/assistant/conversations/:id',
  asyncHandler(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) throw new AppError('Conversation not found.', 404);
    const actor = await resolveAiActor(req.user!.userId);
    await ConversationService.archive(actor, req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  })
);

// ── Job openings prepared by AI Assistance ───────────────────────────────────

async function recruitmentContext(userId: string, employeeId: string | null | undefined, tier: any): Promise<RecruitmentPolicyContext> {
  const emp = employeeId
    ? await prisma.employee.findUnique({ where: { id: employeeId }, include: { jobRole: true, unit: true, department: true } })
    : null;
  return {
    userId,
    permissionTier: tier,
    employee: emp ? { id: emp.id, unit: emp.unit, department: emp.department, jobRole: emp.jobRole } : null,
  };
}

/** One publish at a time per message, so a double click cannot create two openings. */
const publishing = new Set<string>();

/**
 * POST /ai/assistant/conversations/:id/messages/:messageId/publish-job-opening
 *
 * HR's click on Publish. The opening is created from the draft STORED on that
 * message (validated when the assistant prepared it) — the request body is
 * ignored — through the same service and permissions as the Job Openings form:
 * anyone who manages job openings can save it; only an HR Officer or Sister
 * publishes it to the Careers page, otherwise it is saved as a draft for them.
 */
router.post(
  '/assistant/conversations/:id/messages/:messageId/publish-job-opening',
  asyncHandler(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success || !uuid.safeParse(req.params.messageId).success) throw new AppError('Message not found.', 404);
    const actor = await resolveAiActor(req.user!.userId);
    const context = await recruitmentContext(actor.userId, actor.employeeId, actor.tier);
    if (!RecruitmentPolicy.canManageJobOpenings(context)) throw new AppError('Only HR can create job openings.', 403);

    const key = `${req.params.id}:${req.params.messageId}`;
    if (publishing.has(key)) throw new AppError('This job opening is already being published.', 409);
    publishing.add(key);
    try {
      const conversation = await ConversationService.getOwned(actor, req.params.id);
      const message = conversation.messages.find((m) => m.id === req.params.messageId && m.role === 'assistant');
      if (!message?.action || message.action.kind !== 'JOB_OPENING') throw new AppError('There is no job opening on that message.', 404);
      if (message.action.state !== 'DRAFT') {
        res.json({ success: true, data: { action: message.action, alreadyDone: true } });
        return;
      }
      const draft = jobOpeningDraftSchema.parse(message.action.draft);
      const opening = await JobOpeningService.createJobOpening(
        {
          title: draft.title,
          unitId: draft.unitId,
          departmentId: draft.departmentId ?? undefined,
          jobRoleId: draft.jobRoleId,
          employmentType: draft.employmentType,
          vacancies: draft.vacancies,
          description: draft.description,
          responsibilities: draft.responsibilities,
          qualifications: draft.qualifications,
          requiredDocuments: draft.requiredDocuments ?? undefined,
          openingDate: new Date(`${draft.openingDate}T00:00:00+08:00`),
          closingDate: new Date(`${draft.closingDate}T00:00:00+08:00`),
        },
        actor.userId
      );
      const canPublish = RecruitmentPolicy.canPublishJobOpening(context);
      const live = canPublish ? await JobOpeningService.changeStatus(opening.id, JobOpeningStatus.OPEN, actor.userId) : opening;
      const action: MessageAction = {
        ...message.action,
        state: canPublish ? 'PUBLISHED' : 'SAVED',
        published: {
          openingId: opening.id,
          referenceNumber: opening.referenceNumber,
          slug: opening.slug,
          publishedAt: (live.publishedAt ?? new Date()).toISOString(),
        },
      };
      await ConversationService.setMessageAction(actor, conversation.id, message.id, action);
      res.json({ success: true, data: { action } });
    } finally {
      publishing.delete(key);
    }
  })
);

// ── Exports: an answer, a quick view or the workforce summary → PDF / Excel ──

const exportFormat = (raw: unknown): 'pdf' | 'excel' => {
  const f = String(raw ?? 'pdf').toLowerCase();
  if (f === 'pdf') return 'pdf';
  if (f === 'excel' || f === 'xlsx') return 'excel';
  throw new AppError('Unsupported export format. Use pdf or excel.', 400);
};

async function sendExport(res: any, spec: ExportDocument, format: 'pdf' | 'excel', base: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `HRISense_${base.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'AI_answer'}_${stamp}`;
  if (format === 'pdf') {
    const buffer = await exportToPdf(spec);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
    res.send(buffer);
    return;
  }
  const buffer = await exportToExcel(spec);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  res.send(buffer);
}

/**
 * GET /ai/assistant/conversations/:id/messages/:messageId/export?format=pdf|excel
 * One of YOUR answers exactly as stored — its text, charts (with their data)
 * and links — as a PDF to read or an Excel workbook to work with.
 */
router.get(
  '/assistant/conversations/:id/messages/:messageId/export',
  asyncHandler(async (req, res) => {
    if (!uuid.safeParse(req.params.id).success || !uuid.safeParse(req.params.messageId).success) throw new AppError('Message not found.', 404);
    const format = exportFormat(req.query.format);
    const actor = await resolveAiActor(req.user!.userId);
    const conversation = await ConversationService.getOwned(actor, req.params.id);
    const index = conversation.messages.findIndex((m) => m.id === req.params.messageId && m.role === 'assistant');
    if (index < 0) throw new AppError('Message not found.', 404);
    const message = conversation.messages[index];
    const question = [...conversation.messages.slice(0, index)].reverse().find((m) => m.role === 'user')?.content ?? conversation.title;

    const blocks = answerToBlocks(message.content);
    const sections: ExportDocument['sections'] = [{ heading: 'Answer', blocks, charts: message.charts ?? [] }];
    if (message.action?.kind === 'JOB_OPENING') {
      const d = message.action.draft;
      const lines = (t: string | null) => (t ?? '').split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
      sections.push({
        heading: `Job opening — ${d.title} (${message.action.state === 'PUBLISHED' ? `published as ${message.action.published?.referenceNumber}` : message.action.state === 'SAVED' ? 'saved as a draft' : 'not yet published'})`,
        blocks: [
          { kind: 'table', header: ['Field', 'Value'], rows: [
            ['Role', d.jobRoleTitle], ['Unit', d.unitName], ['Employment type', d.employmentType.replace(/_/g, ' ').toLowerCase()],
            ['Vacancies', String(d.vacancies)], ['Opens', d.openingDate], ['Closes', d.closingDate],
          ] },
          { kind: 'heading', text: 'Description' }, { kind: 'paragraph', text: d.description },
          { kind: 'heading', text: 'Responsibilities' }, { kind: 'bullets', items: lines(d.responsibilities) },
          { kind: 'heading', text: 'Qualifications' }, { kind: 'bullets', items: lines(d.qualifications) },
          ...(d.requiredDocuments ? [{ kind: 'heading', text: 'Required documents' } as const, { kind: 'bullets', items: lines(d.requiredDocuments) } as const] : []),
        ],
      });
    }
    await sendExport(
      res,
      {
        title: question,
        label: 'AI Assistance',
        meta: [
          `Asked by ${actor.displayName} (${TIER_LABEL[actor.tier]}) on ${phDateTime(new Date(message.createdAt))}`,
          `Exported ${phDateTime()} · answers use the asker's own HRISense access`,
        ],
        sections,
        links: message.links,
        notes: message.notices,
      },
      format,
      question
    );
  })
);

const sourceSchema = z.object({ key: z.string().max(60), label: z.string().max(120), path: z.string().max(200), chart: chartPayloadSchema.nullable() }).strict();
const itemSchema = z.object({ title: z.string().max(300), detail: z.string().max(3000), basis: z.string().max(1500), sources: z.array(sourceSchema).max(5) }).strict();
const summaryExportBody = z
  .object({
    format: z.enum(['pdf', 'excel']),
    periodDays: z.number().int().min(7).max(180),
    analysis: z
      .object({
        summary: z.string().max(6000),
        observations: z.array(itemSchema).max(20),
        areasForReview: z.array(itemSchema).max(20),
        dataGaps: z.array(z.string().max(600)).max(20),
      })
      .strict(),
  })
  .strict();

/**
 * POST /ai/summary/export — HR's workforce summary as shown on screen. The
 * written analysis is the one HR is looking at; every chart in it was built by
 * the server from the fact sheet and is validated again here.
 */
router.post(
  '/summary/export',
  authorize(['FULL']),
  asyncHandler(async (req, res) => {
    const parsed = summaryExportBody.safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError('This workforce summary could not be exported. Generate it again and retry.', 400);
    const { format, periodDays, analysis } = parsed.data;
    const actor = await resolveAiActor(req.user!.userId);
    const itemSection = (heading: string, items: typeof analysis.observations): ExportDocument['sections'][number] => ({
      heading,
      blocks: items.flatMap((it) => [
        { kind: 'heading', text: it.title } as const,
        { kind: 'paragraph', text: it.detail } as const,
        ...(it.basis ? [{ kind: 'paragraph', text: `Based on: ${it.basis}` } as const] : []),
      ]),
      charts: items.flatMap((it) => it.sources.filter((s) => s.chart).map((s) => ({ ...(s.chart as any), caption: `${it.title} — ${s.label}` }))),
    });
    await sendExport(
      res,
      {
        title: `Workforce summary — last ${periodDays} days`,
        label: 'AI Workforce Summary',
        meta: [`Generated for ${actor.displayName} (${TIER_LABEL[actor.tier]})`, `Exported ${phDateTime()}`],
        sections: [
          { heading: 'Summary', blocks: answerToBlocks(analysis.summary) },
          ...(analysis.observations.length ? [itemSection('Observations', analysis.observations)] : []),
          ...(analysis.areasForReview.length ? [itemSection('Areas for review', analysis.areasForReview)] : []),
          ...(analysis.dataGaps.length ? [{ heading: 'Data gaps', blocks: [{ kind: 'bullets' as const, items: analysis.dataGaps }] }] : []),
        ],
      },
      format,
      `Workforce_summary_${periodDays}_days`
    );
  })
);

// ── HR only: the organisation-wide workforce fact sheet ──────────────────────

/**
 * GET /ai/facts — the deterministic workforce fact sheet.
 * Always available, with or without an AI provider, because it is plain SQL.
 */
router.get(
  '/facts',
  authorize(['FULL']),
  asyncHandler(async (req, res) => {
    const periodDays = Math.min(Math.max(Number(req.query.periodDays) || 30, 7), 180);
    const facts = await AiService.getFacts(periodDays);
    res.json({ success: true, data: facts });
  })
);

/**
 * POST /ai/analyze — grounded, advisory analysis of the fact sheet.
 * Read-only: this endpoint performs no HR decisions and mutates no HR records.
 */
router.post(
  '/analyze',
  authorize(['FULL']),
  assistantLimiter,
  asyncHandler(async (req, res) => {
    const periodDays = Math.min(Math.max(Number(req.body?.periodDays) || 30, 7), 180);
    const facts = await AiService.getFacts(periodDays);

    const analysis = await AiService.analyse(facts, req.user!.userId);
    await AiService.persistInsights(analysis);

    res.json({ success: true, data: { facts, analysis } });
  })
);

/**
 * POST /ai/ask — a plain-English question answered strictly from the fact sheet.
 * Read-only analysis; the model cannot perform any mutation. The role-aware
 * assistant (/ai/assistant/messages) is the general-purpose replacement.
 */
router.post(
  '/ask',
  authorize(['FULL']),
  assistantLimiter,
  asyncHandler(async (req, res) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) throw new AppError('Please enter a question.', 400);
    if (question.length > 500) throw new AppError('Please keep your question under 500 characters.', 400);

    const periodDays = Math.min(Math.max(Number(req.body?.periodDays) || 30, 7), 180);
    const facts = await AiService.getFacts(periodDays);

    const analysis = await AiService.analyse(facts, req.user!.userId, question);

    res.json({ success: true, data: { analysis } });
  })
);

export default router;
