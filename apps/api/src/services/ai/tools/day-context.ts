import { prisma } from '../../../config/prisma';
import { businessDateKey } from '../../../lib/businessDate';
import { ResolvedSchedule, ScheduleResolverService } from '../../schedule-resolver.service';
import { DateRange } from './tool-helpers';

/**
 * What HRISense itself knows about an employee-day, gathered in batches:
 * the resolved work schedule, approved leave and the organisation calendar.
 *
 * These are the same sources the attendance import uses to decide whether a
 * day is a working day — the assistant must not infer a working day, an
 * absence or a day off from anything else.
 */

export interface HolidayInfo {
  name: string;
  type: string;
  /** Units HR marked as working on the day; everyone else observes it. */
  workingUnitIds: string[];
  workingUnits: string[];
}

/** The entries that apply to someone in `unitId` (all of them when unknown). */
export function holidaysForUnit(list: HolidayInfo[] | undefined, unitId: string | null | undefined): HolidayInfo[] {
  return (list ?? []).filter((h) => !unitId || !h.workingUnitIds.includes(unitId));
}

/** "Name" — or "Name (Unit A works)" when some units work through it. */
export function describeHolidays(list: HolidayInfo[] | undefined, withType = false): string | null {
  if (!list?.length) return null;
  return list
    .map((h) => `${h.name}${withType ? ` (${h.type.replace(/_/g, ' ').toLowerCase()})` : ''}${h.workingUnits.length ? ` — ${h.workingUnits.join(', ')} work${h.workingUnits.length === 1 ? 's' : ''} this day` : ''}`)
    .join(', ');
}

export interface LeaveSpan {
  employeeId: string;
  leaveType: string;
  startKey: string;
  endKey: string;
  totalDays: number;
}

/**
 * Resolved schedules per employee per day, from the schedule resolver's range
 * query (two queries in total, whatever the range or team size).
 */
export async function loadSchedules(employeeIds: string[], range: DateRange): Promise<Map<string, Map<string, ResolvedSchedule>>> {
  return ScheduleResolverService.resolveManyForRange(employeeIds, range.from, range.to);
}

/** Approved organisation-calendar entries (holidays, suspensions, non-working days). */
export async function loadHolidays(range: DateRange): Promise<Map<string, HolidayInfo[]>> {
  const entries = await prisma.organizationCalendarEntry.findMany({
    where: { date: { gte: range.from, lte: range.to }, status: 'APPROVED' },
    select: { date: true, name: true, type: true, workingUnits: { select: { unitId: true, unit: { select: { name: true } } } } },
    orderBy: { date: 'asc' },
  });
  const map = new Map<string, HolidayInfo[]>();
  for (const e of entries) {
    const key = businessDateKey(e.date);
    map.set(key, [
      ...(map.get(key) ?? []),
      {
        name: e.name,
        type: String(e.type),
        workingUnitIds: e.workingUnits.map((w) => w.unitId),
        workingUnits: e.workingUnits.map((w) => w.unit.name),
      },
    ]);
  }
  return map;
}

/** APPROVED leave overlapping the range. Pending leave is not leave yet. */
export async function loadApprovedLeave(employeeIds: string[], range: DateRange): Promise<LeaveSpan[]> {
  if (!employeeIds.length) return [];
  const rows = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: 'APPROVED',
      deletedAt: null,
      startDate: { lte: range.to },
      endDate: { gte: range.from },
    },
    select: { employeeId: true, leaveType: true, startDate: true, endDate: true, totalDays: true },
  });
  return rows.map((r) => ({
    employeeId: r.employeeId,
    leaveType: String(r.leaveType),
    startKey: businessDateKey(r.startDate),
    endKey: businessDateKey(r.endDate),
    totalDays: r.totalDays,
  }));
}

export function leaveOn(spans: LeaveSpan[], employeeId: string, dayKey: string): LeaveSpan | undefined {
  return spans.find((s) => s.employeeId === employeeId && s.startKey <= dayKey && dayKey <= s.endKey);
}

/** "Working 08:00–17:00", "Day off", "Not configured". */
export function describeSchedule(s: ResolvedSchedule | undefined): { status: string; shifts: string | null } {
  if (!s) return { status: 'UNCONFIGURED', shifts: null };
  const shifts = s.shifts.length
    ? s.shifts.map((sh) => `${sh.name} ${sh.startTime.slice(0, 5)}–${sh.endTime.slice(0, 5)}`).join(', ')
    : null;
  return { status: s.status, shifts };
}
