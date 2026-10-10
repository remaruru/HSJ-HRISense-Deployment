import { PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { businessDateKey, toBusinessDate } from '../../../lib/businessDate';
import { canAccessEmployee, isHr } from '../actor/ai-actor';
import { AiToolError, ToolContext } from './tool-types';
import { ratio } from '../../../lib/percent';

/**
 * Which employee a person-level tool reads, and whether the asker may.
 *
 *   SCOPED      HR anyone · Supervisor self + direct reports · Employee self
 *   SELF_OR_HR  HR anyone · everyone else self only
 *   SELF        only the asker
 *
 * A denial never says whether the employee exists, so the assistant cannot be
 * used to probe for other people's records.
 */
export type TargetRule = 'SCOPED' | 'SELF_OR_HR' | 'SELF';

export const NOT_AUTHORIZED_MESSAGE =
  "That person's records are outside what this user may see in HRISense. Tell the user plainly that you cannot access them, without guessing or describing them.";

export async function resolveTarget(ctx: ToolContext, employeeId: string | undefined, rule: TargetRule): Promise<string> {
  const { actor } = ctx;
  const target = employeeId ?? actor.employeeId;
  const self = target === actor.employeeId;

  if (!self) {
    const allowed =
      rule === 'SCOPED' ? canAccessEmployee(actor, target) : rule === 'SELF_OR_HR' ? isHr(actor) : false;
    if (!allowed) throw new AiToolError('NOT_AUTHORIZED', NOT_AUTHORIZED_MESSAGE);

    // HR may read anyone, but only someone who exists.
    const exists = await prisma.employee.findUnique({ where: { id: target }, select: { id: true } });
    if (!exists) throw new AiToolError('NOT_FOUND', 'No employee has that id. Use search_employees to find the right person.');
  }
  return target;
}

/** The asker's team: direct reports only. Empty for employees. */
export function teamIds(ctx: ToolContext): string[] {
  return ctx.actor.tier === PermissionTier.STANDARD ? [] : ctx.actor.directReportIds;
}

export interface DateRange {
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
  days: number;
}

const MS_DAY = 86_400_000;

/** Adds whole days to a business date key. */
export function addDaysKey(key: string, days: number): string {
  return businessDateKey(new Date(toBusinessDate(key).getTime() + days * MS_DAY));
}

/**
 * Parses an optional from/to pair into an inclusive business-date range.
 * Defaults are expressed relative to today; `maxDays` caps the span so a tool
 * can never be asked for an unbounded scan.
 */
export function parseRange(
  ctx: ToolContext,
  from: string | undefined,
  to: string | undefined,
  defaults: { fromOffset: number; toOffset: number },
  maxDays: number
): DateRange {
  const span = Math.max(0, defaults.toOffset - defaults.fromOffset);
  let fromDate: Date;
  let toDate: Date;
  try {
    const fromKey = from ?? (to ? addDaysKey(to, -span) : addDaysKey(ctx.today, defaults.fromOffset));
    const toKey = to ?? (from ? addDaysKey(from, span) : addDaysKey(ctx.today, defaults.toOffset));
    fromDate = toBusinessDate(fromKey);
    toDate = toBusinessDate(toKey);
    // `2026-02-31` would otherwise roll over silently into March.
    if (businessDateKey(fromDate) !== fromKey || businessDateKey(toDate) !== toKey) throw new Error('not a real date');
  } catch {
    throw new AiToolError('INVALID_ARGS', 'Dates must be real calendar dates in YYYY-MM-DD form.');
  }
  if (fromDate > toDate) throw new AiToolError('INVALID_ARGS', '"from" must be on or before "to".');
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / MS_DAY) + 1;
  if (days > maxDays) throw new AiToolError('INVALID_ARGS', `That range is ${days} days; this lookup covers at most ${maxDays} days at a time.`);
  return { from: fromDate, to: toDate, fromKey: businessDateKey(fromDate), toKey: businessDateKey(toDate), days };
}

/** Every business date key in a range, inclusive. */
export function eachDayKey(range: DateRange): string[] {
  const out: string[] = [];
  for (let i = 0; i < range.days; i++) out.push(addDaysKey(range.fromKey, i));
  return out;
}

export const dateKey = (d: Date | null | undefined): string | null => (d ? businessDateKey(d) : null);

/** A time-of-day in Manila for a real timestamp, HH:MM. */
export function manilaTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

export const fullName = (e: { firstName: string; lastName: string } | null | undefined): string | null =>
  e ? `${e.firstName} ${e.lastName}`.trim() : null;

/** The shared percentage rule (lib/percent): one decimal, null without a denominator. */
export function pct(part: number, whole: number): number | null {
  return ratio(part, whole, 1);
}

export const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export function weekdayOf(key: string): string {
  return WEEKDAYS[toBusinessDate(key).getUTCDay()];
}

/** Human label for an enum value: FOR_REVIEW → "For review". */
export function humanise(value: string | null | undefined): string {
  if (!value) return '';
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function truncate(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Counts values by key, in first-seen order. */
export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
