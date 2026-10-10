import { PermissionTier } from '@prisma/client';
import { z } from 'zod';
import type { AiActor } from '../actor/ai-actor';
import type { DatasetStore } from '../charts/chart-schema';

/**
 * A data tool the assistant may call.
 *
 * Every tool is NARROW (one question-shaped lookup, never a generic query) and
 * enforces its OWN authorization inside `run`. Being offered to the model is
 * not the authorization: the executor re-checks the tier, and each handler
 * re-checks which employee it is reading.
 */
export interface AiTool<A = any> {
  name: string;
  /** Written for the model: what it returns and when to use it. */
  description: string;
  /** Tiers the tool is offered to and may run for. */
  tiers: readonly PermissionTier[];
  /** Strict argument schema — unknown fields are rejected, not ignored. */
  args: z.ZodType<A>;
  run(ctx: ToolContext, args: A): Promise<ToolOutput>;
}

export interface ToolContext {
  actor: AiActor;
  datasets: DatasetStore;
  /** The request's clock, so every tool in one answer uses the same "today". */
  now: Date;
  /** Today's business date in Asia/Manila, YYYY-MM-DD. */
  today: string;
}

export interface ToolOutput {
  /** What the model sees. Minimised: no government IDs, contacts, notes or secrets. */
  data: unknown;
  /** Rows returned, for the audit trail. */
  rows?: number;
  /** Set when the tool read one specific other employee, for the audit trail. */
  targetEmployeeId?: string;
}

export type ToolErrorCode = 'NOT_AUTHORIZED' | 'NOT_FOUND' | 'INVALID_ARGS' | 'UNKNOWN_TOOL' | 'NO_EMPLOYEE_RECORD' | 'TOOL_ERROR';

/** A refusal or failure a handler raises on purpose. Its message goes to the model. */
export class AiToolError extends Error {
  constructor(public readonly code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'AiToolError';
  }
}

export const ALL_TIERS = [PermissionTier.FULL, PermissionTier.SUPERVISOR, PermissionTier.STANDARD] as const;
export const TEAM_TIERS = [PermissionTier.FULL, PermissionTier.SUPERVISOR] as const;
export const HR_ONLY = [PermissionTier.FULL] as const;

/** Shared argument pieces. */
export const employeeIdArg = z
  .string()
  .uuid()
  .describe('The employee id (from search_employees). Omit to mean the person asking.');
export const dateArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('A date as YYYY-MM-DD (Asia/Manila).');

export function defineTool<A>(tool: AiTool<A>): AiTool<A> {
  return tool;
}
