import { ratio } from './percent';

/**
 * THE attendance calculation — used by the assistant, the HR dashboard trend,
 * the workforce fact sheet and reports. One definition,
 * written once, tested once.
 *
 * ── Inputs: what HRISense knows about one employee-day ──────────────────────
 *   schedule    WORKING | DAY_OFF | UNCONFIGURED  (ScheduleResolverService)
 *   holiday     an APPROVED organisation-calendar entry that day (any type —
 *               the same rule the attendance import uses)
 *   onLeave     an APPROVED leave request covers the day (Leave module)
 *   record      the imported / manual attendance record's status, or none
 *
 * ── The rules ─────────────────────────────────────────────────────────────────
 *   PRESENT, LATE, HALF_DAY records   → presence days (each also counted on its own)
 *   ABSENT record                      → recorded absence (ONLY an explicit record)
 *   ON_LEAVE, HOLIDAY, REST_DAY,
 *   SUSPENDED records                  → "other recorded status"; neither presence
 *                                        nor absence
 *   no record                          → NO IMPORTED RECORD. Never an absence, never
 *                                        in the attendance-rate denominator.
 *
 *   A SCHEDULED WORKDAY is a day whose schedule is WORKING and that is neither an
 *   approved-leave day nor an organisation holiday. DAY_OFF, UNCONFIGURED, leave
 *   and holiday days are not scheduled workdays.
 *
 * ── The two rates ─────────────────────────────────────────────────────────────
 *   attendanceRate = presenceDays ÷ (presenceDays + recordedAbsentDays)
 *     "Of the days with an imported present/late/half-day/absent record, the
 *      share showing presence." Days with no record are EXCLUDED, never counted
 *      as absent. Because imports record presence and HRISense never creates an
 *      absence, this is near 100% whenever data exists — read it WITH coverage.
 *
 *   recordCoverage = scheduledWorkdaysWithRecord ÷ scheduledWorkdays
 *     "Of the scheduled workdays, the share that has any imported record."
 *     A data-completeness measure. Null when no day in the period is a
 *     scheduled workday (e.g. no weekly schedule is configured).
 *
 *   noImportedRecordDays = calendar days with no record — the same definition
 *   as the Attendance Tally (calendar days − distinct days with a record).
 *
 * Previously the tools reported "coverage" as days-with-record ÷ calendar days
 * (days off, holidays and leave counted against it), and the HR fact sheet's
 * "present rate" excluded half days from presence while counting leave and
 * holiday records against it. Both were replaced by the rules above.
 */

export type ScheduleStatus = 'WORKING' | 'DAY_OFF' | 'UNCONFIGURED';

export interface AttendanceDayFact {
  date: string; // YYYY-MM-DD
  schedule: ScheduleStatus;
  holiday: boolean;
  onLeave: boolean;
  recordStatus: string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
}

export interface AttendanceMetrics {
  calendarDays: number;
  daysWithRecord: number;
  noImportedRecordDays: number;
  scheduledWorkdays: number;
  scheduledWorkdaysWithRecord: number;
  scheduledWorkdaysWithoutRecord: number;
  presenceDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  recordedAbsentDays: number;
  otherRecordedStatusDays: number;
  approvedLeaveDays: number;
  holidayDays: number;
  dayOffDays: number;
  unconfiguredScheduleDays: number;
  recordsOnNonScheduledDays: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  averageHoursPerRecordedDay: number | null;
  /** % — presence ÷ (presence + recorded absence); null when neither exists. */
  attendanceRate: number | null;
  /** % — scheduled workdays with a record ÷ scheduled workdays; null when none are scheduled. */
  recordCoverage: number | null;
}

const PRESENCE = new Set(['PRESENT', 'LATE', 'HALF_DAY']);

const pct1 = (part: number, whole: number): number | null => ratio(part, whole, 1);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The attendance rate from record counts alone — the same rule as
 * `computeAttendanceMetrics`, for screens that have counts but not day facts
 * (dashboard trend, workforce fact sheet, reports):
 *   (Present + Late + Half day) ÷ (Present + Late + Half day + Absent) × 100.
 * Other recorded statuses (on leave, holiday, rest day, suspended) and days with
 * no record are outside the denominator.
 */
export function attendanceRateFromCounts(counts: Partial<Record<string, number>>): {
  presence: number;
  recordedAbsent: number;
  otherRecorded: number;
  attendanceRate: number | null;
} {
  const n = (k: string) => Number(counts[k] ?? 0);
  const presence = n('PRESENT') + n('LATE') + n('HALF_DAY');
  const recordedAbsent = n('ABSENT');
  const otherRecorded = Object.entries(counts)
    .filter(([k]) => !['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'].includes(k))
    .reduce((sum, [, v]) => sum + Number(v ?? 0), 0);
  return { presence, recordedAbsent, otherRecorded, attendanceRate: pct1(presence, presence + recordedAbsent) };
}

export function isScheduledWorkday(d: AttendanceDayFact): boolean {
  return d.schedule === 'WORKING' && !d.onLeave && !d.holiday;
}

export function computeAttendanceMetrics(days: AttendanceDayFact[]): AttendanceMetrics {
  const m: AttendanceMetrics = {
    calendarDays: days.length,
    daysWithRecord: 0,
    noImportedRecordDays: 0,
    scheduledWorkdays: 0,
    scheduledWorkdaysWithRecord: 0,
    scheduledWorkdaysWithoutRecord: 0,
    presenceDays: 0,
    presentDays: 0,
    lateDays: 0,
    halfDays: 0,
    recordedAbsentDays: 0,
    otherRecordedStatusDays: 0,
    approvedLeaveDays: 0,
    holidayDays: 0,
    dayOffDays: 0,
    unconfiguredScheduleDays: 0,
    recordsOnNonScheduledDays: 0,
    totalHoursWorked: 0,
    totalOvertimeHours: 0,
    averageHoursPerRecordedDay: null,
    attendanceRate: null,
    recordCoverage: null,
  };

  for (const d of days) {
    const scheduled = isScheduledWorkday(d);
    if (d.onLeave) m.approvedLeaveDays++;
    if (d.holiday) m.holidayDays++;
    if (d.schedule === 'DAY_OFF') m.dayOffDays++;
    if (d.schedule === 'UNCONFIGURED') m.unconfiguredScheduleDays++;
    if (scheduled) m.scheduledWorkdays++;

    if (!d.recordStatus) {
      m.noImportedRecordDays++;
      if (scheduled) m.scheduledWorkdaysWithoutRecord++;
      continue;
    }

    m.daysWithRecord++;
    if (scheduled) m.scheduledWorkdaysWithRecord++;
    else m.recordsOnNonScheduledDays++;
    m.totalHoursWorked += d.hoursWorked ?? 0;
    m.totalOvertimeHours += d.overtimeHours ?? 0;

    if (PRESENCE.has(d.recordStatus)) {
      m.presenceDays++;
      if (d.recordStatus === 'PRESENT') m.presentDays++;
      if (d.recordStatus === 'LATE') m.lateDays++;
      if (d.recordStatus === 'HALF_DAY') m.halfDays++;
    } else if (d.recordStatus === 'ABSENT') {
      m.recordedAbsentDays++;
    } else {
      m.otherRecordedStatusDays++;
    }
  }

  m.totalHoursWorked = round2(m.totalHoursWorked);
  m.totalOvertimeHours = round2(m.totalOvertimeHours);
  m.averageHoursPerRecordedDay = m.daysWithRecord ? round2(m.totalHoursWorked / m.daysWithRecord) : null;
  m.attendanceRate = pct1(m.presenceDays, m.presenceDays + m.recordedAbsentDays);
  m.recordCoverage = pct1(m.scheduledWorkdaysWithRecord, m.scheduledWorkdays);
  return m;
}

/** Adds metrics computed per employee into one total (rates recomputed from the sums). */
export function sumMetrics(parts: AttendanceMetrics[]): AttendanceMetrics {
  const total = computeAttendanceMetrics([]);
  const keys = Object.keys(total) as Array<keyof AttendanceMetrics>;
  for (const p of parts) {
    for (const k of keys) {
      if (k === 'attendanceRate' || k === 'recordCoverage' || k === 'averageHoursPerRecordedDay') continue;
      (total[k] as number) += p[k] as number;
    }
  }
  total.totalHoursWorked = round2(total.totalHoursWorked);
  total.totalOvertimeHours = round2(total.totalOvertimeHours);
  total.averageHoursPerRecordedDay = total.daysWithRecord ? round2(total.totalHoursWorked / total.daysWithRecord) : null;
  total.attendanceRate = pct1(total.presenceDays, total.presenceDays + total.recordedAbsentDays);
  total.recordCoverage = pct1(total.scheduledWorkdaysWithRecord, total.scheduledWorkdays);
  return total;
}

export type PeriodGrouping = 'day' | 'week' | 'month';

/** The period a date belongs to: YYYY-MM-DD, the Monday of its ISO week, or YYYY-MM. */
export function periodKey(date: string, grouping: PeriodGrouping): string {
  if (grouping === 'day') return date;
  if (grouping === 'month') return date.slice(0, 7);
  const d = new Date(`${date}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // days since Monday
  return new Date(d.getTime() - shift * 86_400_000).toISOString().slice(0, 10);
}

/** Groups day facts by period, keeping periods in date order. */
export function groupByPeriod(days: AttendanceDayFact[], grouping: PeriodGrouping): Array<{ period: string; days: AttendanceDayFact[] }> {
  const map = new Map<string, AttendanceDayFact[]>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = periodKey(d.date, grouping);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()].map(([period, list]) => ({ period, days: list }));
}

/** The plain-language rules, sent with every attendance result so the model explains them correctly. */
export const ATTENDANCE_RULES = [
  'NO IMPORTED RECORD is not an absence. Days without a record are excluded from the attendance rate and never counted as absent.',
  'attendanceRate = presence days (Present + Late + Half day records) ÷ (presence days + days with an explicit Absent record). Half days count as presence and are also listed separately.',
  'recordCoverage = scheduled workdays that have any record ÷ scheduled workdays. A scheduled workday is WORKING in the schedule and not approved leave or an organisation holiday. Low coverage means attendance was not imported, not that people were absent.',
  'Imports record presence only and HRISense never creates an Absent record by itself, so attendanceRate is usually 100% whenever data exists — always report it together with recordCoverage and the day counts.',
  'Day off, approved leave and holidays are never counted as absence. If the schedule is not configured, scheduled workdays and recordCoverage cannot be calculated — say so rather than estimating.',
  'HRISense computes no lateness itself: LATE appears only where a record carries that status. Hours come from the device export and are not recalculated.',
];
