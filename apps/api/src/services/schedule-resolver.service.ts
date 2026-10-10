import { prisma } from '../config/prisma';
import { toBusinessDate, businessDateKey } from '../lib/businessDate';

/**
 * THE single authority for "what is this employee scheduled to do on this date".
 *
 * ── Canonical scheduling system ───────────────────────────────────────────────
 * `EmployeeWeeklySchedule` + `EmployeeWeeklyScheduleDay` +
 * `EmployeeWeeklyScheduleShift` + `ShiftDefinition` are authoritative.
 *
 * Two older representations still exist in the schema and still hold data:
 *
 *   1. `Employee.workSchedule`  — a coarse enum (REGULAR_DAY_SHIFT, …). It says
 *      nothing about which days are worked, so it can never answer a per-date
 *      question. It is reported for display only and is NEVER used to decide
 *      whether a given date is a working day.
 *
 *   2. `ScheduleTemplate` + `EmployeeScheduleAssignment` — the legacy template
 *      track that onboarding still writes. At the time of writing it covers far
 *      more employees than the weekly system does, so it cannot simply be
 *      ignored, but it must never COMPETE with a weekly schedule.
 *
 * ── Precedence (deliberately strict) ──────────────────────────────────────────
 *   1. An `EmployeeWeeklySchedule` covering the date  →  authoritative, full stop.
 *   2. Otherwise, a legacy `EmployeeScheduleAssignment` covering the date  →
 *      reported as a LEGACY resolution.
 *   3. Otherwise  →  UNRESOLVED.
 *
 * The two sources are NEVER merged for one employee-day. If a weekly schedule
 * exists for the date, the legacy assignment is not consulted at all — otherwise
 * one day could take its working/rest state from one source and its shift times
 * from another, which is exactly the ambiguity this service exists to remove.
 *
 * Every runtime reader of schedule data should come through here rather than
 * querying the tables directly, so the precedence rule lives in one place.
 */

export type ScheduleSource = 'WEEKLY' | 'LEGACY_TEMPLATE' | 'UNRESOLVED';

/** Three-state day model of the canonical weekly schedule. */
export type ResolvedDayStatus = 'WORKING' | 'DAY_OFF' | 'UNCONFIGURED';

export interface ResolvedShift {
  shiftId: string;
  name: string;
  startTime: string;
  endTime: string;
  sequence: number;
}

export interface ResolvedSchedule {
  employeeId: string;
  /** The business date this resolution answers for, as YYYY-MM-DD. */
  date: string;
  source: ScheduleSource;
  /**
   * UNCONFIGURED when nothing authoritative says whether this is a working day.
   * A legacy resolution can only ever report UNCONFIGURED for the day status,
   * because the legacy template track does not model three-state days.
   */
  status: ResolvedDayStatus;
  shifts: ResolvedShift[];
  /** Id of the weekly schedule that answered, when source is WEEKLY. */
  weeklyScheduleId: string | null;
  /**
   * Human-readable note explaining a LEGACY or UNRESOLVED outcome. Safe to show
   * to HR; never contains anything sensitive.
   */
  note: string | null;
}

const WEEKDAY_BY_INDEX = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export class ScheduleResolverService {
  /**
   * Resolves one employee-day.
   *
   * `date` may be a `Date` or a `YYYY-MM-DD` string; it is normalised to a
   * business date before any comparison, so a caller cannot accidentally shift
   * the calendar day by passing a timestamp.
   */
  static async resolveEmployeeScheduleForDate(
    employeeId: string,
    date: Date | string
  ): Promise<ResolvedSchedule> {
    const target = toBusinessDate(date);
    const dateKey = businessDateKey(target);

    // ── 1. Canonical weekly schedule ────────────────────────────────────────
    const weekly = await prisma.employeeWeeklySchedule.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: target },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: target } }],
      },
      include: {
        days: {
          include: {
            shifts: { include: { shift: true }, orderBy: { sequence: 'asc' } },
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (weekly) {
      // `target` is UTC midnight of the business date, so getUTCDay() is the
      // correct weekday — getDay() would use the server's local offset.
      const weekdayName = WEEKDAY_BY_INDEX[target.getUTCDay()];
      const day = weekly.days.find((d) => d.dayOfWeek === weekdayName);

      if (!day) {
        return {
          employeeId,
          date: dateKey,
          source: 'WEEKLY',
          status: 'UNCONFIGURED',
          shifts: [],
          weeklyScheduleId: weekly.id,
          note: `The weekly schedule has no entry for ${weekdayName.toLowerCase()}.`,
        };
      }

      return {
        employeeId,
        date: dateKey,
        source: 'WEEKLY',
        status: day.status as ResolvedDayStatus,
        shifts: (day.shifts ?? []).map((s) => ({
          shiftId: s.shiftId,
          name: s.shift?.name ?? 'Unknown shift',
          startTime: s.shift?.startTime ?? '',
          endTime: s.shift?.endTime ?? '',
          sequence: s.sequence,
        })),
        weeklyScheduleId: weekly.id,
        note: null,
      };
    }

    // ── 2. Legacy fallback — reported, never merged ─────────────────────────
    const legacy = await prisma.employeeScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: target },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: target } }],
      },
      include: { scheduleTemplate: { select: { id: true, name: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (legacy) {
      return {
        employeeId,
        date: dateKey,
        source: 'LEGACY_TEMPLATE',
        // The legacy track does not model per-day working/rest state in a form
        // this resolver can trust, so it must not claim one.
        status: 'UNCONFIGURED',
        shifts: [],
        weeklyScheduleId: null,
        note: `Covered by the legacy schedule template "${legacy.scheduleTemplate?.name ?? 'unknown'}". Set a weekly schedule for this employee to make their working days explicit.`,
      };
    }

    // ── 3. Nothing authoritative ────────────────────────────────────────────
    return {
      employeeId,
      date: dateKey,
      source: 'UNRESOLVED',
      status: 'UNCONFIGURED',
      shifts: [],
      weeklyScheduleId: null,
      note: 'No weekly schedule has been configured for this employee on this date.',
    };
  }

  /**
   * Batch form of `resolveEmployeeScheduleForDate` for one date across many
   * employees. Issues two queries in total rather than two per employee.
   */
  static async resolveManyForDate(
    employeeIds: string[],
    date: Date | string
  ): Promise<Map<string, ResolvedSchedule>> {
    const result = new Map<string, ResolvedSchedule>();
    if (employeeIds.length === 0) return result;

    const target = toBusinessDate(date);
    const dateKey = businessDateKey(target);
    const weekdayName = WEEKDAY_BY_INDEX[target.getUTCDay()];

    const weeklyRows = await prisma.employeeWeeklySchedule.findMany({
      where: {
        employeeId: { in: employeeIds },
        effectiveFrom: { lte: target },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: target } }],
      },
      include: {
        days: {
          where: { dayOfWeek: weekdayName },
          include: { shifts: { include: { shift: true }, orderBy: { sequence: 'asc' } } },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // findMany may return more than one row per employee only if the timeline is
    // damaged; ordering desc and keeping the first preserves "latest wins".
    const weeklyByEmployee = new Map<string, (typeof weeklyRows)[number]>();
    for (const row of weeklyRows) {
      if (!weeklyByEmployee.has(row.employeeId)) weeklyByEmployee.set(row.employeeId, row);
    }

    const unresolved = employeeIds.filter((id) => !weeklyByEmployee.has(id));

    const legacyRows =
      unresolved.length > 0
        ? await prisma.employeeScheduleAssignment.findMany({
            where: {
              employeeId: { in: unresolved },
              effectiveFrom: { lte: target },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: target } }],
            },
            include: { scheduleTemplate: { select: { name: true } } },
            orderBy: { effectiveFrom: 'desc' },
          })
        : [];

    const legacyByEmployee = new Map<string, (typeof legacyRows)[number]>();
    for (const row of legacyRows) {
      if (!legacyByEmployee.has(row.employeeId)) legacyByEmployee.set(row.employeeId, row);
    }

    for (const employeeId of employeeIds) {
      const weekly = weeklyByEmployee.get(employeeId);
      if (weekly) {
        const day = weekly.days[0];
        result.set(employeeId, {
          employeeId,
          date: dateKey,
          source: 'WEEKLY',
          status: (day?.status as ResolvedDayStatus) ?? 'UNCONFIGURED',
          shifts: (day?.shifts ?? []).map((s) => ({
            shiftId: s.shiftId,
            name: s.shift?.name ?? 'Unknown shift',
            startTime: s.shift?.startTime ?? '',
            endTime: s.shift?.endTime ?? '',
            sequence: s.sequence,
          })),
          weeklyScheduleId: weekly.id,
          note: day ? null : `The weekly schedule has no entry for ${weekdayName.toLowerCase()}.`,
        });
        continue;
      }

      const legacy = legacyByEmployee.get(employeeId);
      result.set(employeeId, {
        employeeId,
        date: dateKey,
        source: legacy ? 'LEGACY_TEMPLATE' : 'UNRESOLVED',
        status: 'UNCONFIGURED',
        shifts: [],
        weeklyScheduleId: null,
        note: legacy
          ? `Covered by the legacy schedule template "${legacy.scheduleTemplate?.name ?? 'unknown'}". Set a weekly schedule for this employee to make their working days explicit.`
          : 'No weekly schedule has been configured for this employee on this date.',
      });
    }

    return result;
  }

  /**
   * Range form of `resolveManyForDate`: every employee, every day from `from` to
   * `to` inclusive, in two queries total. Applies exactly the same rules — the
   * latest weekly schedule in force on the day wins; otherwise a legacy
   * template is reported (never trusted for working/rest days); otherwise the
   * day is UNRESOLVED. Used by analytics that look at months at a time.
   */
  static async resolveManyForRange(
    employeeIds: string[],
    from: Date | string,
    to: Date | string
  ): Promise<Map<string, Map<string, ResolvedSchedule>>> {
    const result = new Map<string, Map<string, ResolvedSchedule>>();
    for (const id of employeeIds) result.set(id, new Map());
    if (employeeIds.length === 0) return result;

    const start = toBusinessDate(from);
    const end = toBusinessDate(to);
    if (start > end) return result;

    const [weeklyRows, legacyRows] = await Promise.all([
      prisma.employeeWeeklySchedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          effectiveFrom: { lte: end },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }],
        },
        include: {
          days: { include: { shifts: { include: { shift: true }, orderBy: { sequence: 'asc' } } } },
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.employeeScheduleAssignment.findMany({
        where: {
          employeeId: { in: employeeIds },
          effectiveFrom: { lte: end },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }],
        },
        include: { scheduleTemplate: { select: { name: true } } },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const weeklyBy = new Map<string, typeof weeklyRows>();
    for (const row of weeklyRows) weeklyBy.set(row.employeeId, [...(weeklyBy.get(row.employeeId) ?? []), row]);
    const legacyBy = new Map<string, typeof legacyRows>();
    for (const row of legacyRows) legacyBy.set(row.employeeId, [...(legacyBy.get(row.employeeId) ?? []), row]);

    const inForce = <T extends { effectiveFrom: Date; effectiveTo: Date | null }>(rows: T[] | undefined, day: Date): T | undefined =>
      // Rows are ordered effectiveFrom desc, so the first match is the latest in force.
      rows?.find((r) => r.effectiveFrom <= day && (r.effectiveTo === null || r.effectiveTo > day));

    for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
      const day = new Date(t);
      const dateKey = businessDateKey(day);
      const weekdayName = WEEKDAY_BY_INDEX[day.getUTCDay()];
      for (const employeeId of employeeIds) {
        const weekly = inForce(weeklyBy.get(employeeId), day);
        if (weekly) {
          const entry = weekly.days.find((d) => d.dayOfWeek === weekdayName);
          result.get(employeeId)!.set(dateKey, {
            employeeId,
            date: dateKey,
            source: 'WEEKLY',
            status: (entry?.status as ResolvedDayStatus) ?? 'UNCONFIGURED',
            shifts: (entry?.shifts ?? []).map((s) => ({
              shiftId: s.shiftId,
              name: s.shift?.name ?? 'Unknown shift',
              startTime: s.shift?.startTime ?? '',
              endTime: s.shift?.endTime ?? '',
              sequence: s.sequence,
            })),
            weeklyScheduleId: weekly.id,
            note: entry ? null : `The weekly schedule has no entry for ${weekdayName.toLowerCase()}.`,
          });
          continue;
        }
        const legacy = inForce(legacyBy.get(employeeId), day);
        result.get(employeeId)!.set(dateKey, {
          employeeId,
          date: dateKey,
          source: legacy ? 'LEGACY_TEMPLATE' : 'UNRESOLVED',
          status: 'UNCONFIGURED',
          shifts: [],
          weeklyScheduleId: null,
          note: legacy
            ? `Covered by the legacy schedule template "${legacy.scheduleTemplate?.name ?? 'unknown'}". Set a weekly schedule for this employee to make their working days explicit.`
            : 'No weekly schedule has been configured for this employee on this date.',
        });
      }
    }
    return result;
  }

  /**
   * Which scheduling system currently answers for an employee, ignoring any
   * particular date. Used by listings that need to show HR where an employee's
   * schedule actually comes from.
   */
  static async describeScheduleCoverage(
    employeeIds: string[]
  ): Promise<Map<string, { source: ScheduleSource; note: string | null }>> {
    const out = new Map<string, { source: ScheduleSource; note: string | null }>();
    if (employeeIds.length === 0) return out;

    const withWeekly = await prisma.employeeWeeklySchedule.findMany({
      where: { employeeId: { in: employeeIds } },
      distinct: ['employeeId'],
      select: { employeeId: true },
    });
    const weeklySet = new Set(withWeekly.map((w) => w.employeeId));

    const remaining = employeeIds.filter((id) => !weeklySet.has(id));
    const withLegacy =
      remaining.length > 0
        ? await prisma.employeeScheduleAssignment.findMany({
            where: { employeeId: { in: remaining } },
            distinct: ['employeeId'],
            select: { employeeId: true },
          })
        : [];
    const legacySet = new Set(withLegacy.map((l) => l.employeeId));

    for (const id of employeeIds) {
      if (weeklySet.has(id)) {
        out.set(id, { source: 'WEEKLY', note: null });
      } else if (legacySet.has(id)) {
        out.set(id, {
          source: 'LEGACY_TEMPLATE',
          note: 'Using a legacy schedule template. Set a weekly schedule to make working days explicit.',
        });
      } else {
        out.set(id, { source: 'UNRESOLVED', note: 'No weekly schedule configured.' });
      }
    }
    return out;
  }
}
