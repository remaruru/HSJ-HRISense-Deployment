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
