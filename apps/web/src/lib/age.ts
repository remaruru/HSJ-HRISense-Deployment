/**
 * Age from a date of birth — computed, never stored, so it is never out of date.
 *
 * Calendar-correct: a person turns a year older ON their birthday, not after a
 * count of days (no "days ÷ 365"). Born October 10, 2000 → 25 on October 9,
 * 2026, 26 on October 10, 2026.
 *
 * Leap-day birthdays (February 29): in a year without February 29 the birthday
 * is counted as March 1 — on February 28 the person has not turned yet.
 *
 * The date of birth is a date-only value (`@db.Date`, sent as
 * "YYYY-MM-DDT00:00:00.000Z"). Its calendar date is read from the string itself,
 * so a time zone can never move it to the previous day. "Today" is the viewer's
 * local calendar date.
 */

type DateInput = string | Date | null | undefined;

interface CalendarDate {
  y: number;
  m: number; // 1–12
  d: number;
}

function calendarDateOf(value: DateInput): CalendarDate | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) return null;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    // Reject impossible dates such as 2021-02-30.
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    return { y, m, d };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  return null;
}

/** Whole years of age on `today`, or null when the date of birth is missing, unreadable or in the future. */
export function ageInYears(dateOfBirth: DateInput, today: Date = new Date()): number | null {
  const birth = calendarDateOf(dateOfBirth);
  if (!birth) return null;
  const now = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };

  let age = now.y - birth.y;
  const hadBirthdayThisYear = now.m > birth.m || (now.m === birth.m && now.d >= birth.d);
  if (!hadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

/** "31 years old" / "1 year old" — or null, so the caller shows its own empty state. */
export function formatAge(dateOfBirth: DateInput, today: Date = new Date()): string | null {
  const age = ageInYears(dateOfBirth, today);
  if (age === null) return null;
  return `${age} ${age === 1 ? 'year' : 'years'} old`;
}
