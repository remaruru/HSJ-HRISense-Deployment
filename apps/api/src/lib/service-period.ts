import { businessDateKey } from './businessDate';

/**
 * Length of service on calendar dates — never total days ÷ 365.
 *
 * Whole months are counted first (each month as itself, long or short), then the
 * leftover days. The same rule as the web app's `employmentDuration`, so the
 * profile and the leave entitlement can never disagree about a person's years.
 *
 * Anniversaries: a person completes a year on the same month and day of a later
 * year. A start on 29 February reaches its anniversary on 28 February in a year
 * without a 29th — the month is counted as complete on its last day, exactly as
 * the profile's length of service counts it.
 */

export interface ServicePeriod {
  years: number;
  months: number;
  days: number;
}

const parts = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
};

const daysInMonth = (year: number, month1to12: number) => new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

/** Same day-of-month `count` months on, clamped to that month's length. */
function addMonthsKey(start: { y: number; m: number; d: number }, count: number): string {
  const total = start.y * 12 + (start.m - 1) + count;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(start.d, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Years, months and days from `start` to `end` (both calendar dates, Manila).
 * Null when either date is missing or `end` is before `start`.
 */
export function servicePeriod(start: Date | string | null | undefined, end: Date | string | null | undefined): ServicePeriod | null {
  if (!start || !end) return null;
  const fromKey = businessDateKey(start);
  const toKey = businessDateKey(end);
  if (toKey < fromKey) return null;
  const from = parts(fromKey);
  const to = parts(toKey);

  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (addMonthsKey(from, months) > toKey) months -= 1;
  const anchor = addMonthsKey(from, months);
  const days = Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

/** Completed anniversary years of service on `asOf` (0 before the first). */
export function completedYearsOfService(start: Date | string | null | undefined, asOf: Date | string): number | null {
  if (!start) return null;
  return servicePeriod(start, asOf)?.years ?? 0;
}

/** The calendar date on which `years` completed years are reached. */
export function anniversaryDate(start: Date | string, years: number): string {
  return addMonthsKey(parts(businessDateKey(start)), years * 12);
}
