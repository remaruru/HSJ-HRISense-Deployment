import { z } from 'zod';
import { api } from './api';
import { chartSchema, type AssistantChartData } from './ai-chart.schema';

/**
 * Client for the role-aware AI assistant (`/api/v1/ai/assistant/*`).
 *
 * The browser sends ONLY the question text and, for a follow-up, the
 * conversation id. It never sends a role, tier or employee id: the server
 * works those out from the signed-in account, and rejects a request that tries.
 *
 * Every response is validated here before anything is rendered, so a chart or
 * link that does not match the expected shape is dropped rather than drawn.
 */

export { chartSchema, type AssistantChartData };

export const MESSAGE_STATUSES = ['ANSWERED', 'NO_DATA', 'NOT_AUTHORIZED', 'OUT_OF_SCOPE', 'REFUSED', 'AI_UNAVAILABLE', 'ERROR'] as const;
export type AssistantStatus = (typeof MESSAGE_STATUSES)[number];

// A path inside HRISense, optionally with a query the server allowed (e.g. ?tab=compliance).
const linkSchema = z.object({ path: z.string().regex(/^\/[a-z0-9\-/]*(\?[a-zA-Z0-9=&\-_.%]*)?$/i), label: z.string().max(60) });

/** A job opening the assistant prepared for HR (shown as a card with a Publish button). */
const jobOpeningActionSchema = z.object({
  kind: z.literal('JOB_OPENING'),
  state: z.enum(['DRAFT', 'SAVED', 'PUBLISHED']),
  draft: z.object({
    title: z.string(),
    jobRoleId: z.string(),
    jobRoleTitle: z.string(),
    unitId: z.string(),
    unitName: z.string(),
    departmentId: z.string().nullable(),
    departmentName: z.string().nullable(),
    employmentType: z.string(),
    vacancies: z.number(),
    description: z.string(),
    responsibilities: z.string(),
    qualifications: z.string(),
    requiredDocuments: z.string().nullable(),
    openingDate: z.string(),
    closingDate: z.string(),
  }),
  published: z.object({ openingId: z.string(), referenceNumber: z.string(), slug: z.string(), publishedAt: z.string() }).optional(),
});
export type JobOpeningAction = z.infer<typeof jobOpeningActionSchema>;

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  charts: z.array(z.unknown()).optional(),
  links: z.array(z.unknown()).optional(),
  followUps: z.array(z.string()).optional(),
  notices: z.array(z.string()).optional(),
  action: z.unknown().optional(),
  createdAt: z.string(),
});

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: AssistantStatus;
  charts: AssistantChartData[];
  links: Array<{ path: string; label: string }>;
  followUps: string[];
  notices: string[];
  /** A job opening prepared for HR, when the answer has one. */
  action?: JobOpeningAction;
  createdAt: string;
  /** Client-only: the request failed before the server answered. */
  failed?: boolean;
}

/** Validates one message; charts and links that fail validation are dropped individually. */
function toMessage(raw: unknown): AssistantMessage | null {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    charts: (m.charts ?? []).flatMap((c) => {
      const r = chartSchema.safeParse(c);
      return r.success ? [r.data] : [];
    }),
    links: (m.links ?? []).flatMap((l) => {
      const r = linkSchema.safeParse(l);
      return r.success ? [r.data] : [];
    }),
    followUps: (m.followUps ?? []).slice(0, 3),
    notices: m.notices ?? [],
    action: (() => {
      const r = jobOpeningActionSchema.safeParse(m.action);
      return r.success ? r.data : undefined;
    })(),
    createdAt: m.createdAt,
  };
}

export interface AssistantAvailability {
  available: boolean;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED';
  reason?: string;
  provider?: string;
  model?: string;
}

export interface QuickViewOption {
  id: string;
  label: string;
  group: 'You' | 'Your team' | 'Organisation';
}

export interface AssistantContext {
  availability: AssistantAvailability;
  accessLevel: 'FULL' | 'SUPERVISOR' | 'STANDARD';
  accessLabel: string;
  firstName: string;
  directReports: number;
  suggestions: string[];
  /** Deterministic analytics the server offers this user — no AI needed. */
  quickViews: QuickViewOption[];
  maxMessageLength: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export const AssistantService = {
  async getContext(): Promise<AssistantContext> {
    const res = await api.get('/ai/assistant/context');
    return res.data.data as AssistantContext;
  },

  async send(message: string, conversationId?: string | null) {
    const res = await api.post('/ai/assistant/messages', {
      message,
      ...(conversationId ? { conversationId } : {}),
    });
    const data = res.data?.data ?? {};
    return {
      conversationId: String(data.conversationId ?? ''),
      aiAvailable: Boolean(data.aiAvailable),
      userMessage: toMessage(data.userMessage),
      message: toMessage(data.message),
    };
  },

  /** Runs a server-defined Quick analytics view. Only the view id is sent. */
  async runQuickView(viewId: string, conversationId?: string | null) {
    const res = await api.post(`/ai/assistant/quick-views/${encodeURIComponent(viewId)}`, conversationId ? { conversationId } : {});
    const data = res.data?.data ?? {};
    return {
      conversationId: String(data.conversationId ?? ''),
      userMessage: toMessage(data.userMessage),
      message: toMessage(data.message),
    };
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await api.get('/ai/assistant/conversations');
    return (res.data?.data ?? []) as ConversationSummary[];
  },

  async getConversation(id: string): Promise<{ id: string; title: string; messages: AssistantMessage[] }> {
    const res = await api.get(`/ai/assistant/conversations/${encodeURIComponent(id)}`);
    const data = res.data?.data ?? {};
    return {
      id: String(data.id),
      title: String(data.title ?? 'Conversation'),
      messages: (Array.isArray(data.messages) ? data.messages : []).map(toMessage).filter(Boolean) as AssistantMessage[],
    };
  },

  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/ai/assistant/conversations/${encodeURIComponent(id)}`);
  },

  /**
   * HR's Publish click on a job opening card. Only the ids are sent: the server
   * publishes the draft it stored on that message, never anything from here.
   */
  async publishJobOpening(conversationId: string, messageId: string): Promise<JobOpeningAction> {
    const res = await api.post(
      `/ai/assistant/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/publish-job-opening`,
      {}
    );
    return jobOpeningActionSchema.parse(res.data?.data?.action);
  },

  /** One of your answers as a PDF or Excel file (the server builds it from the stored answer). */
  exportMessagePath(conversationId: string, messageId: string, format: 'pdf' | 'excel'): string {
    return `/ai/assistant/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/export?format=${format}`;
  },
};
