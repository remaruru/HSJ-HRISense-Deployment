import { AIRequestStatus, PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { createAuditLog } from '../../../lib/audit';
import { redactSecrets } from '../guard/output-guard';

/**
 * Audit trail for AI Assistance.
 *
 * `ai_request_logs` — one row per question: who asked (server-resolved), their
 * tier, the question (secret-like strings redacted), the final answer
 * (truncated), provider, model, tokens, duration, outcome, and WHICH tools ran
 * with which target employee and how many rows — never the data returned.
 *
 * `audit_logs` — an `AI_ASSISTANT_DATA_ACCESS` entry whenever an answer read
 * another specific employee's records, so HR's Audit Log shows who looked up
 * whom through the assistant.
 *
 * Auditing never blocks an answer: a logging failure is reported to the server
 * console and the user still gets their reply.
 */

export interface ToolAuditEntry {
  name: string;
  ok: boolean;
  code?: string;
  targetEmployeeId?: string;
  rows?: number;
  ms: number;
  round: number;
}

export interface AuditStart {
  userId: string;
  tier: PermissionTier;
  question: string;
  conversationId: string | null;
  provider: string | null;
  model: string;
  /** ASSISTANT (AI-orchestrated) or QUICK_VIEW (deterministic, no AI). */
  channel?: 'ASSISTANT' | 'QUICK_VIEW';
}

export interface AuditFinish {
  outcome: string;
  answer: string;
  conversationId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  toolCalls: ToolAuditEntry[];
  rounds: number;
  error?: string;
  failed?: boolean;
  guardRule?: string;
}

export class AiAuditService {
  static async start(entry: AuditStart): Promise<string | null> {
    try {
      const row = await prisma.aIRequestLog.create({
        data: {
          requestedById: entry.userId,
          actorTier: entry.tier,
          channel: entry.channel ?? 'ASSISTANT',
          conversationId: entry.conversationId,
          prompt: redactSecrets(entry.question).text.slice(0, 2000),
          model: entry.model,
          provider: entry.provider,
          status: AIRequestStatus.PROCESSING,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err: any) {
      console.error('[AI audit] could not start log:', err?.message);
      return null;
    }
  }

  static async finish(logId: string | null, userId: string, started: number, result: AuditFinish): Promise<void> {
    const totalTokens =
      result.inputTokens !== null || result.outputTokens !== null ? (result.inputTokens ?? 0) + (result.outputTokens ?? 0) : null;
    if (logId) {
      try {
        await prisma.aIRequestLog.update({
          where: { id: logId },
          data: {
            status: result.failed ? AIRequestStatus.FAILED : AIRequestStatus.COMPLETED,
            outcome: result.outcome,
            conversationId: result.conversationId,
            response: redactSecrets(result.answer).text.slice(0, 4000),
            promptTokens: result.inputTokens,
            completionTokens: result.outputTokens,
            tokensUsed: totalTokens,
            durationMs: Date.now() - started,
            toolCalls: result.toolCalls.length ? (result.toolCalls as any) : undefined,
            toolRounds: result.rounds,
            error: result.error ? result.error.slice(0, 1000) : result.guardRule ? `guard:${result.guardRule}` : null,
          },
        });
      } catch (err: any) {
        console.error('[AI audit] could not finish log:', err?.message);
      }
    }

    const targets = [...new Set(result.toolCalls.filter((t) => t.ok && t.targetEmployeeId).map((t) => t.targetEmployeeId!))];
    if (targets.length) {
      await createAuditLog({
        actorUserId: userId,
        action: 'AI_ASSISTANT_DATA_ACCESS',
        entityType: 'AI_REQUEST',
        entityId: logId ?? undefined,
        targetEmployeeId: targets.length === 1 ? targets[0] : undefined,
        metadata: {
          tools: [...new Set(result.toolCalls.filter((t) => t.targetEmployeeId).map((t) => t.name))],
          targetEmployeeIds: targets.slice(0, 20),
          outcome: result.outcome,
        },
      });
    }
  }
}
