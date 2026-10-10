import { PermissionTier } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../../../middleware/errorHandler';
import type { ToolSpec } from '../provider/provider.types';
import { HR_TOOLS } from './hr.tools';
import { zodToJsonSchema } from './json-schema';
import { KNOWLEDGE_TOOLS } from './knowledge.tools';
import { PERSON_TOOLS } from './person.tools';
import { SELF_TOOLS } from './self.tools';
import { TEAM_TOOLS } from './team.tools';
import { AiTool, AiToolError, ToolContext, ToolErrorCode } from './tool-types';

/**
 * The complete, closed list of tools. There is no generic query tool, no SQL,
 * no table access by name, no write tool and no code execution: if a question
 * cannot be answered by one of these, the assistant says so.
 */
export const AI_TOOLS: AiTool[] = [...KNOWLEDGE_TOOLS, ...SELF_TOOLS, ...PERSON_TOOLS, ...TEAM_TOOLS, ...HR_TOOLS];

const BY_NAME = new Map<string, AiTool>();
for (const tool of AI_TOOLS) {
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(tool.name)) throw new Error(`Invalid AI tool name: ${tool.name}`);
  if (BY_NAME.has(tool.name)) throw new Error(`Duplicate AI tool name: ${tool.name}`);
  BY_NAME.set(tool.name, tool);
}

/** Built once: the JSON Schema of every tool's arguments. */
const SPECS = new Map<string, ToolSpec>(
  AI_TOOLS.map((t) => [t.name, { name: t.name, description: t.description, parameters: zodToJsonSchema(t.args as any) }])
);

/** Tools offered to this tier. Others are not even described to the model. */
export function toolsForTier(tier: PermissionTier): AiTool[] {
  return AI_TOOLS.filter((t) => t.tiers.includes(tier));
}

export function toolSpecsForTier(tier: PermissionTier): ToolSpec[] {
  return toolsForTier(tier).map((t) => SPECS.get(t.name)!);
}

export interface ToolExecution {
  name: string;
  ok: boolean;
  code?: ToolErrorCode;
  /** What goes back to the model (JSON text). */
  content: string;
  rows?: number;
  targetEmployeeId?: string;
  ms: number;
}

/** Hard ceiling on what one tool result may put into the model's context. */
export const MAX_TOOL_RESULT_CHARS = 24_000;

function fail(name: string, code: ToolErrorCode, message: string, started: number): ToolExecution {
  return { name, ok: false, code, content: JSON.stringify({ ok: false, error: code, message }), ms: Date.now() - started };
}

/** Shortens the longest arrays until the JSON fits, and says that it did. */
export function fitToBudget(data: unknown, budget = MAX_TOOL_RESULT_CHARS): string {
  let json = JSON.stringify({ ok: true, data });
  if (json.length <= budget) return json;
  const clone = JSON.parse(JSON.stringify(data));
  for (let pass = 0; pass < 8 && json.length > budget; pass++) {
    const arrays: unknown[][] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) {
        arrays.push(v);
        v.forEach(walk);
      } else if (v && typeof v === 'object') Object.values(v as object).forEach(walk);
    };
    walk(clone);
    const longest = arrays.sort((a, b) => b.length - a.length)[0];
    if (!longest || longest.length <= 1) break;
    longest.splice(Math.ceil(longest.length / 2));
    json = JSON.stringify({ ok: true, truncated: true, note: 'Some lists were shortened to fit. Say so if it matters, and suggest a narrower question or the relevant page.', data: clone });
  }
  return json.length <= budget ? json : JSON.stringify({ ok: false, error: 'RESULT_TOO_LARGE', message: 'The result was too large. Ask a narrower question (shorter date range or one unit).' });
}

/**
 * Runs one tool call from the model. Order of checks:
 *   1. the tool exists;
 *   2. the asker's tier may use it (again — being offered is not enough);
 *   3. the arguments are valid JSON matching the tool's STRICT schema;
 *   4. the handler, which applies its own record-level scope.
 * Any failure becomes a structured error the model must relay, never data.
 */
export async function executeTool(ctx: ToolContext, name: string, rawArguments: string): Promise<ToolExecution> {
  const started = Date.now();
  const tool = BY_NAME.get(name);
  if (!tool) return fail(name, 'UNKNOWN_TOOL', 'There is no such tool. Use only the tools you were given.', started);
  if (!tool.tiers.includes(ctx.actor.tier)) {
    return fail(name, 'NOT_AUTHORIZED', 'This user is not allowed to use that lookup. Tell them it is outside their access.', started);
  }

  let parsedJson: unknown;
  try {
    parsedJson = rawArguments && rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return fail(name, 'INVALID_ARGS', 'The arguments were not valid JSON.', started);
  }
  const parsed = tool.args.safeParse(parsedJson);
  if (!parsed.success) {
    const issues = (parsed.error as ZodError).issues.slice(0, 5).map((i) => `${i.path.join('.') || '(arguments)'}: ${i.message}`);
    return fail(name, 'INVALID_ARGS', `Invalid arguments — ${issues.join('; ')}`, started);
  }

  try {
    const output = await tool.run(ctx, parsed.data);
    return {
      name,
      ok: true,
      content: fitToBudget(output.data),
      rows: output.rows,
      targetEmployeeId: output.targetEmployeeId,
      ms: Date.now() - started,
    };
  } catch (err: any) {
    if (err instanceof AiToolError) return fail(name, err.code, err.message, started);
    if (err instanceof AppError && (err.statusCode === 403 || err.statusCode === 401)) {
      return fail(name, 'NOT_AUTHORIZED', 'This user is not allowed to see that information.', started);
    }
    if (err instanceof AppError && err.statusCode === 404) return fail(name, 'NOT_FOUND', err.message, started);
    if (err instanceof AppError && err.statusCode === 400) return fail(name, 'INVALID_ARGS', err.message, started);
    console.error(`[AI tool ${name}] failed:`, err?.message ?? err);
    return fail(name, 'TOOL_ERROR', 'The lookup failed on the server. Tell the user this information could not be retrieved right now.', started);
  }
}
