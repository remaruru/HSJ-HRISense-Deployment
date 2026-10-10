/**
 * Which review flags must stop a row from being written without a human looking
 * at it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Classification answers "how does this row compare with what we already hold".
 * It does NOT answer "is this row trustworthy". A day with an unclosed punch, or
 * punches running backwards, or work recorded on a holiday, is perfectly NEW —
 * HRISense holds nothing for that employee-day — and NEW used to apply on its
 * own. That meant the most suspicious rows in a file were exactly the ones that
 * went in unread.
 *
 * A holding flag does not reject anything. It downgrades the row's default
 * decision to PENDING and blocks the batch from being confirmed until HR has
 * decided. HR can still choose USE_UPLOADED; they just cannot do it by accident.
 *
 * ── Holding vs informational ─────────────────────────────────────────────────
 * A flag holds when acting on the row without checking could write something
 * FALSE (a half-day that never ended, hours nobody worked, a name that belongs
 * to somebody else) or something with a PAY consequence (holiday, day off,
 * leave). A flag is informational when it describes the day accurately and the
 * only question is what HR wants to do about it later.
 *
 * Deliberately informational, with reasons:
 *   MULTIPLE_SESSIONS      split shifts and lunch punch-outs are ordinary
 *   SCHEDULE_NOT_CONFIGURED most employees have no schedule assigned yet, so
 *                          holding on this would hold essentially every row -
 *                          revisit once schedules are assigned org-wide
 *   *_NO_PUNCH             no punch means nothing is written anyway
 */

/** Flags that force a row to wait for a human. */
export const HOLDING_FLAGS: ReadonlySet<string> = new Set([
  // ── the row contradicts itself ──
  'INCOMPLETE_PUNCH',
  'OUT_WITHOUT_IN',
  'NON_SEQUENTIAL_PUNCHES',
  'HOURS_WITHOUT_PUNCHES',
  'PUNCHES_WITHOUT_HOURS',
  'HOURS_DISAGREE_WITH_PUNCHES',
  'FUTURE_DATE',
  'IMPLAUSIBLE_DURATION',
  // ── the row may belong to the wrong person ──
  'IDENTITY_NAME_MISMATCH',
  'IDENTITY_UNVERIFIED',
  'ARCHIVED_EMPLOYEE',
  // ── applying it has a pay consequence ──
  'WORKED_ON_SCHEDULED_DAY_OFF',
  'ATTENDANCE_DURING_APPROVED_LEAVE',
  'WORKED_ON_HOLIDAY',
  // ── the day does not resemble the shift it was meant to be ──
  //
  // This one carries its own tolerance: the day-context service only raises it
  // when the first punch sits more than two hours outside every scheduled shift.
  // Staying late or arriving a little early never reaches here, so anything that
  // does is worth a question.
  'PUNCH_OUTSIDE_SCHEDULE',
]);

/** Flags that are worth showing but must not stop an import. */
export const INFORMATIONAL_FLAGS: ReadonlySet<string> = new Set([
  'MULTIPLE_SESSIONS',
  'NO_PUNCHES',
  'SCHEDULE_NOT_CONFIGURED',
  'ON_LEAVE_NO_PUNCH',
  'HOLIDAY_NO_PUNCH',
  'DAY_OFF_NO_PUNCH',
]);

/** Plain-language reason shown to HR beside a held row. */
export const FLAG_REASONS: Record<string, string> = {
  INCOMPLETE_PUNCH: 'Someone clocked in but never clocked out. Importing this would record a day that never ended.',
  OUT_WITHOUT_IN: 'There is a clock-out with no matching clock-in.',
  NON_SEQUENTIAL_PUNCHES: 'The clock-out is earlier than the clock-in, so the punches cannot both be right.',
  HOURS_WITHOUT_PUNCHES: 'The file reports hours worked but carries no punches to support them.',
  PUNCHES_WITHOUT_HOURS: 'There are punches but the file reports zero hours worked.',
  HOURS_DISAGREE_WITH_PUNCHES: 'The hours in the file do not match the time between the punches.',
  FUTURE_DATE: 'This date has not happened yet.',
  IMPLAUSIBLE_DURATION: 'This day records more hours than a person could have worked, which usually means a clock-out was missed.',
  IDENTITY_NAME_MISMATCH: 'The name beside this device number in the file does not match the employee it is mapped to. The device number may have been reassigned to someone else.',
  IDENTITY_UNVERIFIED: 'The name beside this device number could not be checked against the employee it is mapped to.',
  ARCHIVED_EMPLOYEE: 'This employee is archived, so new attendance for them is unexpected.',
  WORKED_ON_SCHEDULED_DAY_OFF: 'This falls on the employee’s scheduled day off.',
  ATTENDANCE_DURING_APPROVED_LEAVE: 'This employee has approved leave covering this date.',
  WORKED_ON_HOLIDAY: 'This falls on a holiday, which usually changes how the day is paid.',
  MULTIPLE_SESSIONS: 'More than one clock-in/clock-out pair on this day.',
  NO_PUNCHES: 'The file lists this date but recorded no punches.',
  SCHEDULE_NOT_CONFIGURED: 'No schedule is assigned to this employee for this date.',
  PUNCH_OUTSIDE_SCHEDULE: 'The punches sit more than two hours outside every shift this employee was scheduled for.',
  ON_LEAVE_NO_PUNCH: 'The employee was on approved leave and did not punch.',
  HOLIDAY_NO_PUNCH: 'A holiday with no punches.',
  DAY_OFF_NO_PUNCH: 'A scheduled day off with no punches.',
};

/** The holding flags present, in the order they were raised. */
export function holdingFlagsIn(flags: readonly string[] | null | undefined): string[] {
  return (flags ?? []).filter((f) => HOLDING_FLAGS.has(f));
}

/** True when at least one flag requires a human before this row may be written. */
export function isHeld(flags: readonly string[] | null | undefined): boolean {
  return holdingFlagsIn(flags).length > 0;
}

/** One sentence naming why a row is being held, for the review screen. */
export function heldReason(flags: readonly string[] | null | undefined): string | null {
  const held = holdingFlagsIn(flags);
  if (!held.length) return null;
  return held.map((f) => FLAG_REASONS[f] ?? f).join(' ');
}
