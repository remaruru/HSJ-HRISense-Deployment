import { calendarEntryAppliesToUnit } from '../../lib/calendar-scope';
import { prisma } from '../../config/prisma';

/**
 * What HRISense already believes about an employee's day, compared against what
 * the import says happened.
 *
 * ── The principle this encodes ───────────────────────────────────────────────
 * A day is not one label. "Scheduled day off" and "the device recorded punches"
 * are BOTH true at once, and resolving that by deleting one of them destroys
 * information HR needs. So nothing here overwrites anything: it reads the
 * schedule, the approved leave and the holiday calendar, and returns flags
 * describing what it found. The flags are facts about a collision, not verdicts
 * about who is right — Hospicio has not defined who wins, and inventing that
 * rule is not this code's job.
 */

export const DAY_FLAGS = {
  WORKED_ON_SCHEDULED_DAY_OFF: 'WORKED_ON_SCHEDULED_DAY_OFF',
  ATTENDANCE_DURING_APPROVED_LEAVE: 'ATTENDANCE_DURING_APPROVED_LEAVE',
  WORKED_ON_HOLIDAY: 'WORKED_ON_HOLIDAY',
  SCHEDULE_NOT_CONFIGURED: 'SCHEDULE_NOT_CONFIGURED',
  PUNCH_OUTSIDE_SCHEDULE: 'PUNCH_OUTSIDE_SCHEDULE',
  ON_LEAVE_NO_PUNCH: 'ON_LEAVE_NO_PUNCH',
  HOLIDAY_NO_PUNCH: 'HOLIDAY_NO_PUNCH',
  DAY_OFF_NO_PUNCH: 'DAY_OFF_NO_PUNCH',
} as const;

export interface DayContext {
  /** WORKING | DAY_OFF | UNCONFIGURED | null when nothing could be resolved. */
  scheduleStatus: string | null;
  /** Shift windows for the day, `HH:MM`, when the schedule defines any. */
  shifts: Array<{ startTime: string; endTime: string }>;
  /** Approved leave covering the date, if any. */
  leave: { id: string; leaveType: string } | null;
  /**
   * Approved organisation calendar entry (holiday/suspension) for the date.
   * `appliesToEmployee` is false when HR marked the employee's unit as working
   * that day — then the holiday raises no review flag for them.
   */
  holiday: { id: string; title: string; type: string; appliesToEmployee?: boolean } | null;
}

/** How far outside a shift window a punch may sit before it is worth flagging. */
const OUTSIDE_SCHEDULE_TOLERANCE_MINUTES = 120;

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(minutes) ? minutes : null;
};

export class AttendanceDayContextService {
  /**
   * Loads the schedule, leave and holiday facts for a set of employee-days in
   * bulk. An import covers thousands of days, so this must not be a per-row
   * query.
   */
  static async loadMany(
    keys: Array<{ employeeId: string; date: string }>
  ): Promise<Map<string, DayContext>> {
    const out = new Map<string, DayContext>();
    if (!keys.length) return out;

    const employeeIds = [...new Set(keys.map((k) => k.employeeId))];
    const dates = [...new Set(keys.map((k) => k.date))].sort();
    const start = new Date(`${dates[0]}T00:00:00.000Z`);
    const end = new Date(`${dates[dates.length - 1]}T23:59:59.999Z`);

    const [holidays, leaves, units] = await Promise.all([
      prisma.organizationCalendarEntry.findMany({
        where: { status: 'APPROVED', date: { gte: start, lte: end } },
        select: { id: true, name: true, type: true, date: true, workingUnits: { select: { unitId: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { id: true, employeeId: true, leaveType: true, startDate: true, endDate: true },
      }),
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, unitId: true } }),
    ]);
    const unitOf = new Map(units.map((u) => [u.id, u.unitId]));

    const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
    const holidayByDate = new Map(holidays.map((h) => [dayOf(h.date), h]));

    // Schedules resolve per employee-day through the existing service, which owns
    // the weekly-schedule / assignment / override precedence. Reusing it is what
    // keeps the importer from becoming a second, disagreeing schedule engine.
    const { ScheduleService } = require('../schedule.service') as typeof import('../schedule.service');

    for (const key of keys) {
      const mapKey = `${key.employeeId}|${key.date}`;
      if (out.has(mapKey)) continue;

      let scheduleStatus: string | null = null;
      let shifts: DayContext['shifts'] = [];
      try {
        const resolved = await ScheduleService.resolveScheduleForDate(
          key.employeeId,
          new Date(`${key.date}T00:00:00.000Z`)
        );
        const eff = (resolved as { effectiveEmployeeSchedule?: { status?: string; shifts?: Array<{ startTime: string; endTime: string }> } })
          .effectiveEmployeeSchedule;
        scheduleStatus = eff?.status ?? null;
        shifts = (eff?.shifts ?? []).map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
      } catch {
        // A schedule that cannot be resolved is reported as not configured, which
        // is the honest answer; it must never become an assumed working day.
        scheduleStatus = null;
      }

      const leave = leaves.find(
        (l) =>
          l.employeeId === key.employeeId &&
          dayOf(l.startDate) <= key.date &&
          dayOf(l.endDate) >= key.date
      );

      out.set(mapKey, {
        scheduleStatus,
        shifts,
        leave: leave ? { id: leave.id, leaveType: String(leave.leaveType) } : null,
        holiday: holidayByDate.get(key.date)
          ? {
              id: holidayByDate.get(key.date)!.id,
              title: holidayByDate.get(key.date)!.name,
              type: String(holidayByDate.get(key.date)!.type),
              appliesToEmployee: calendarEntryAppliesToUnit(holidayByDate.get(key.date)!, unitOf.get(key.employeeId)),
            }
          : null,
      });
    }

    return out;
  }

  /**
   * The flags raised by combining what the file says with what HRISense holds.
   *
   * `hasPunches` is the only thing taken from the import: whether the device
   * recorded anything that day. No status is produced and nothing is decided.
   */
  static flagsFor(context: DayContext | undefined, hasPunches: boolean): string[] {
    if (!context) return [];
    const flags: string[] = [];

    if (hasPunches) {
      if (context.scheduleStatus === 'DAY_OFF') flags.push(DAY_FLAGS.WORKED_ON_SCHEDULED_DAY_OFF);
      if (context.leave) flags.push(DAY_FLAGS.ATTENDANCE_DURING_APPROVED_LEAVE);
      // Only for someone whose unit observes the holiday; a unit HR marked as
      // working that day is simply on its normal schedule.
      if (context.holiday && context.holiday.appliesToEmployee !== false) flags.push(DAY_FLAGS.WORKED_ON_HOLIDAY);
      // Without a schedule there is nothing to be late against, so the import is
      // kept and the missing schedule is stated rather than assumed.
      if (context.scheduleStatus === null || context.scheduleStatus === 'UNCONFIGURED') {
        flags.push(DAY_FLAGS.SCHEDULE_NOT_CONFIGURED);
      }
    } else {
      // No punches is NOT an absence. It is only ever reported as the fact that
      // the day was scheduled off, covered by leave, or a holiday.
      if (context.leave) flags.push(DAY_FLAGS.ON_LEAVE_NO_PUNCH);
      else if (context.holiday && context.holiday.appliesToEmployee !== false) flags.push(DAY_FLAGS.HOLIDAY_NO_PUNCH);
      else if (context.scheduleStatus === 'DAY_OFF') flags.push(DAY_FLAGS.DAY_OFF_NO_PUNCH);
    }

    return flags;
  }

  /**
   * Whether the day's punches sit outside every scheduled shift by more than the
   * tolerance. Separate from `flagsFor` because it needs the punch times, and
   * because "outside the schedule" is an observation, not a disciplinary finding.
   */
  static punchOutsideSchedule(
    context: DayContext | undefined,
    sessions: Array<{ in: string | null; out: string | null }> | null
  ): boolean {
    if (!context || !context.shifts.length || !sessions?.length) return false;

    const windows = context.shifts
      .map((s) => ({ start: toMinutes(s.startTime), end: toMinutes(s.endTime) }))
      .filter((w): w is { start: number; end: number } => w.start !== null && w.end !== null);
    if (!windows.length) return false;

    const firstIn = sessions.map((s) => s.in).filter(Boolean).map((v) => toMinutes(v as string))
      .filter((v): v is number => v !== null).sort((a, b) => a - b)[0];
    if (firstIn === undefined) return false;

    // A shift whose end is before its start crosses midnight; its window is left
    // open-ended rather than guessed at.
    return windows.every((w) => {
      if (w.end < w.start) return false;
      return firstIn < w.start - OUTSIDE_SCHEDULE_TOLERANCE_MINUTES ||
             firstIn > w.end + OUTSIDE_SCHEDULE_TOLERANCE_MINUTES;
    });
  }
}
