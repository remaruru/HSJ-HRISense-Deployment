import { prisma } from '../../../config/prisma';
import { businessDateKey } from '../../../lib/businessDate';
import type { ResolvedSchedule } from '../../schedule-resolver.service';
import { HolidayInfo, LeaveSpan, holidaysForUnit, leaveOn, loadApprovedLeave, loadHolidays, loadSchedules } from '../tools/day-context';
import { DateRange, eachDayKey } from '../tools/tool-helpers';
import type { AttendanceDayFact } from './attendance-metrics';

/**
 * Loads everything the attendance calculation needs for a set of employees
 * and a date range, in a fixed number of queries:
 *   attendance records · resolved schedules (range query) · approved leave ·
 *   approved organisation-calendar entries.
 *
 * The caller has ALREADY decided these employees are within the asker's
 * access; this module only reads.
 */

export interface AttendanceRecordLite {
  employeeId: string;
  date: Date;
  status: string;
  timeIn: Date | null;
  timeOut: Date | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
  sessions: unknown;
  reviewFlags: unknown;
  sourceType: string;
  manuallyModifiedAt: Date | null;
}

export interface LoadedAttendance {
  facts: Map<string, AttendanceDayFact[]>;
  schedules: Map<string, Map<string, ResolvedSchedule>>;
  holidays: Map<string, HolidayInfo[]>;
  leave: LeaveSpan[];
  records: Map<string, AttendanceRecordLite>;
}

export const recordKey = (employeeId: string, day: string) => `${employeeId}|${day}`;

export async function loadAttendanceFacts(employeeIds: string[], range: DateRange): Promise<LoadedAttendance> {
  const [rows, schedules, holidays, leave, units] = await Promise.all([
    employeeIds.length
      ? prisma.attendanceRecord.findMany({
          where: { employeeId: { in: employeeIds }, date: { gte: range.from, lte: range.to } },
          select: {
            employeeId: true,
            date: true,
            status: true,
            timeIn: true,
            timeOut: true,
            hoursWorked: true,
            overtimeHours: true,
            sessions: true,
            reviewFlags: true,
            sourceType: true,
            manuallyModifiedAt: true,
          },
        })
      : Promise.resolve([]),
    loadSchedules(employeeIds, range),
    loadHolidays(range),
    loadApprovedLeave(employeeIds, range),
    employeeIds.length
      ? prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, unitId: true } })
      : Promise.resolve([]),
  ]);
  const unitOf = new Map(units.map((u) => [u.id, u.unitId]));

  const records = new Map<string, AttendanceRecordLite>();
  for (const r of rows) records.set(recordKey(r.employeeId, businessDateKey(r.date)), { ...r, status: String(r.status), sourceType: String(r.sourceType) });

  const days = eachDayKey(range);
  const facts = new Map<string, AttendanceDayFact[]>();
  for (const employeeId of employeeIds) {
    facts.set(
      employeeId,
      days.map((day) => {
        const rec = records.get(recordKey(employeeId, day));
        return {
          date: day,
          schedule: (schedules.get(employeeId)?.get(day)?.status ?? 'UNCONFIGURED') as AttendanceDayFact['schedule'],
          // A holiday the employee's unit works through is not a holiday for them.
          holiday: holidaysForUnit(holidays.get(day), unitOf.get(employeeId)).length > 0,
          onLeave: Boolean(leaveOn(leave, employeeId, day)),
          recordStatus: rec?.status ?? null,
          hoursWorked: rec?.hoursWorked ?? null,
          overtimeHours: rec?.overtimeHours ?? null,
        };
      })
    );
  }
  return { facts, schedules, holidays, leave, records };
}

/** First and last date that has any attendance record for these employees (all time). */
export async function attendanceDataSpan(employeeIds: string[]): Promise<{ first: string | null; last: string | null }> {
  if (!employeeIds.length) return { first: null, last: null };
  const agg = await prisma.attendanceRecord.aggregate({
    where: { employeeId: { in: employeeIds } },
    _min: { date: true },
    _max: { date: true },
  });
  return {
    first: agg._min.date ? businessDateKey(agg._min.date) : null,
    last: agg._max.date ? businessDateKey(agg._max.date) : null,
  };
}
