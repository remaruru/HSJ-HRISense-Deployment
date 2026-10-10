/**
 * Date-only ("business date") handling for HRISense.
 *
 * ── The problem this solves ───────────────────────────────────────────────────
 * Several columns are `@db.Date` — attendance dates, schedule effective dates,
 * leave dates, hire dates. A calendar date has no time and no timezone: an
 * attendance record for 5 September is for 5 September everywhere.
 *
 * JavaScript has no date-only type, so Prisma materialises these columns as
 * `Date` objects set to **UTC midnight** of that calendar day. On a server in
 * Philippine time (UTC+8) such a value prints as `08:00 local`, which looks
 * alarming but is correct.
 *
 * That means:
 *
 *   ✔ `value.toISOString().slice(0, 10)`   → correct calendar date, any server TZ
 *   ✘ `value.getFullYear()/getMonth()/getDate()` → correct ONLY when the server
 *                                                  offset is >= 0; on a negative
 *                                                  offset it returns the PREVIOUS day
 *
 * Verified on this deployment (2026-09-07, server offset −480 = UTC+8):
 * a stored `2026-07-12` reads back as `2026-07-12T00:00:00.000Z`, and both
 * extraction methods agreed. The UTC method is the one that stays correct if the
 * server ever moves, so it is the method used here and everywhere else.
 *
 * ── Why not just keep calling toISOString().slice(0,10) inline ───────────────
 * Because the failure is silent and the correct choice is non-obvious. Attendance
 * import will make the date half of a deduplication key: a one-day drift creates
 * a duplicate row that the `@@unique([employeeId, date])` constraint cannot
 * catch, because the two dates genuinely differ. Centralising it means the rule
 * is stated once, with the reasoning attached.
 *
 * ── Business timezone ─────────────────────────────────────────────────────────
 * `Asia/Manila` (UTC+8, no DST) is the business timezone. It matters only when
 * converting a real timestamp to "which business day was that", never when
 * handling a value that is already date-only.
 */

/** The hospital's operating timezone. Philippines does not observe DST. */
export const BUSINESS_TIMEZONE = 'Asia/Manila';
const BUSINESS_UTC_OFFSET_MINUTES = 8 * 60;

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Normalises any accepted date input to the canonical date-only representation:
 * a `Date` at **UTC midnight** of that calendar day. This is exactly what Prisma
 * writes to and reads from a `@db.Date` column, so values produced here compare
 * and persist without drift.
 *
 * Accepts:
 *  • `YYYY-MM-DD`            → taken literally. No timezone maths at all; a bare
 *                              calendar date already IS the answer.
 *  • any other date input    → treated as an **instant** and resolved to the
 *                              business day it falls on in `Asia/Manila`.
 *
 * The instant rule handles both shapes that reach this function in practice, and
 * they do not conflict:
 *
 *   • a Prisma `@db.Date` value is UTC midnight — 08:00 Manila the same day, so
 *     it resolves back to itself;
 *   • `new Date('2026-09-05T00:00:00')` on this server is local midnight, i.e.
 *     `2026-09-04T16:00Z` — which is 5 September in Manila, the day the caller
 *     plainly meant.
 *
 * Reading the UTC components directly would have returned 4 September for that
 * second case. That silent off-by-one is the exact failure this module exists to
 * prevent, so the instant interpretation is used uniformly.
 *
 * @throws when the input cannot be interpreted as a date.
 */
export function toBusinessDate(input: Date | string): Date {
  if (typeof input === 'string') {
    const match = YMD_PATTERN.exec(input.trim());
    if (match) {
      // A bare calendar date. Build it directly — never parse through a local
      // timezone, which is what shifts the day.
      const [, y, m, d] = match;
      const result = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      if (Number.isNaN(result.getTime())) {
        throw new Error(`Invalid business date: "${input}"`);
      }
      return result;
    }

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid business date: "${input}"`);
    }
    return instantToBusinessDate(parsed);
  }

  if (!(input instanceof Date) || Number.isNaN(input.getTime())) {
    throw new Error('Invalid business date: not a valid Date');
  }
  return instantToBusinessDate(input);
}

/** Same as `toBusinessDate`, but returns null instead of throwing. */
export function toBusinessDateOrNull(input: Date | string | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  try {
    return toBusinessDate(input);
  } catch {
    return null;
  }
}

/**
 * The canonical `YYYY-MM-DD` key for a date-only value. Use this for map keys,
 * `Set` membership, comparisons and anything that must group by calendar day.
 */
export function businessDateKey(input: Date | string): string {
  return toBusinessDate(input).toISOString().slice(0, 10);
}

/** `businessDateKey` that tolerates null/invalid input, returning null. */
export function businessDateKeyOrNull(input: Date | string | null | undefined): string | null {
  const value = toBusinessDateOrNull(input);
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Which business day a real timestamp falls on.
 *
 * This is the ONE place a timezone genuinely matters: a punch at 23:30 on
 * 5 September Manila time is 15:30 UTC on 5 September, but a punch at 00:30 on
 * 6 September Manila is 16:30 UTC on 5 September — and belongs to 6 September.
 *
 * Only use this when converting an actual instant. Never use it on a value that
 * is already date-only; that is what `toBusinessDate` is for.
 */
export function instantToBusinessDate(instant: Date): Date {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new Error('Invalid instant');
  }
  const shifted = new Date(instant.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000);
  return truncateToUtcMidnight(shifted);
}

/** Inclusive count of calendar days between two business dates. */
export function businessDaysBetweenInclusive(from: Date | string, to: Date | string): number {
  const start = toBusinessDate(from).getTime();
  const end = toBusinessDate(to).getTime();
  if (end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** True when both inputs denote the same calendar day. */
export function isSameBusinessDate(a: Date | string, b: Date | string): boolean {
  return toBusinessDate(a).getTime() === toBusinessDate(b).getTime();
}

/** Human-facing format, e.g. `5 September 2026`. Never used as a key. */
export function formatBusinessDate(input: Date | string): string {
  const value = toBusinessDate(input);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function truncateToUtcMidnight(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}
