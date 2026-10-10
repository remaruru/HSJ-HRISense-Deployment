import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../middleware/errorHandler';
import type { AiActor } from '../actor/ai-actor';
import { chartPayloadSchema } from '../charts/chart-schema';
import type { ChatMessage } from '../provider/provider.types';

/**
 * Conversations with the assistant (`ai_conversations`).
 *
 * • Owned by exactly one user. Every read and write is filtered by the
 *   authenticated user's id; another user's conversation is indistinguishable
 *   from one that does not exist (404), so ids cannot be probed.
 * • Stored: the user's text and the assistant's FINAL answer (with any charts
 *   and links it showed). Never tool payloads — the raw data a tool returned
 *   is not kept.
 * • Follow-ups re-run tools under the asker's CURRENT access; earlier answers
 *   are context only.
 */

export const MESSAGE_STATUSES = [
  'ANSWERED',
  'NO_DATA',
  'NOT_AUTHORIZED',
  'OUT_OF_SCOPE',
  'REFUSED',
  'AI_UNAVAILABLE',
  'ERROR',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const storedMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  charts: z.array(chartPayloadSchema).optional(),
  links: z.array(z.object({ path: z.string(), label: z.string() })).optional(),
  followUps: z.array(z.string()).optional(),
  notices: z.array(z.string()).optional(),
  createdAt: z.string(),
});
export type StoredMessage = z.infer<typeof storedMessageSchema>;

/** Keep at most this many messages per conversation (oldest dropped). */
const MAX_STORED_MESSAGES = 100;

export function newMessageId(): string {
  return crypto.randomUUID();
}

function readMessages(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredMessage[] = [];
  for (const item of raw) {
    const parsed = storedMessageSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export class ConversationService {
  static async list(actor: AiActor, limit = 30): Promise<ConversationSummary[]> {
    const rows = await prisma.aIConversation.findMany({
      where: { userId: actor.userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, title: true, updatedAt: true, messages: true },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? 'Conversation',
      updatedAt: r.updatedAt.toISOString(),
      messageCount: readMessages(r.messages).length,
    }));
  }

  /** The conversation, only if this user owns it and it is not archived. */
  static async getOwned(actor: AiActor, id: string): Promise<{ id: string; title: string; messages: StoredMessage[] }> {
    const row = await prisma.aIConversation.findFirst({
      where: { id, userId: actor.userId, isArchived: false },
      select: { id: true, title: true, messages: true },
    });
    if (!row) throw new AppError('Conversation not found.', 404);
    return { id: row.id, title: row.title ?? 'Conversation', messages: readMessages(row.messages) };
  }

  static async archive(actor: AiActor, id: string): Promise<void> {
    const result = await prisma.aIConversation.updateMany({
      where: { id, userId: actor.userId, isArchived: false },
      data: { isArchived: true },
    });
    if (result.count === 0) throw new AppError('Conversation not found.', 404);
  }

  /** Appends one question/answer pair, creating the conversation if needed. */
  static async appendTurn(
    actor: AiActor,
    conversationId: string | null,
    user: StoredMessage,
    assistant: StoredMessage,
    model: string
  ): Promise<string> {
    if (conversationId) {
      const current = await ConversationService.getOwned(actor, conversationId);
      const messages = [...current.messages, user, assistant].slice(-MAX_STORED_MESSAGES);
      await prisma.aIConversation.updateMany({
        where: { id: conversationId, userId: actor.userId },
        data: { messages: messages as any, model },
      });
      return conversationId;
    }
    const title = user.content.replace(/\s+/g, ' ').slice(0, 80) || 'Conversation';
    const created = await prisma.aIConversation.create({
      data: { userId: actor.userId, title, messages: [user, assistant] as any, model },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Earlier turns as model context: text only, most recent `limit` messages.
   * A chart the user was already shown is summarised as text (up to 25 points)
   * so a follow-up such as "which one has the most?" can be answered from what
   * they saw. Anything NEW is fetched again through the tools, under the
   * asker's current access.
   */
  static toHistory(messages: StoredMessage[], limit: number): ChatMessage[] {
    if (limit <= 0) return [];
    return messages.slice(-limit).map((m) =>
      m.role === 'user'
        ? { role: 'user' as const, content: m.content }
        : { role: 'assistant' as const, content: `${m.content}${(m.charts ?? []).map(chartAsText).join('')}` }
    );
  }
}

function chartAsText(chart: NonNullable<StoredMessage['charts']>[number]): string {
  const points = chart.data.slice(0, 25).map((row) => {
    const values = chart.series.map((s) => `${s.label} ${row[s.key] ?? '—'}`).join(', ');
    return `${row[chart.xKey]}: ${values}`;
  });
  const more = chart.data.length > 25 ? `; …${chart.data.length - 25} more` : '';
  return `\n[Chart shown — ${chart.title}${chart.unit ? ` (${chart.unit})` : ''}: ${points.join('; ')}${more}]`;
}
