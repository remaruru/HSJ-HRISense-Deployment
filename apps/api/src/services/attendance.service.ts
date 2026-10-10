import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier, AttendanceStatus, AttendanceRecordSource } from '@prisma/client';
import { OrgHierarchyService } from './org-hierarchy.service';
import { ACTIVE_WORKFORCE_WHERE } from '../lib/workforceScope';
import { businessDateKeyOrNull } from '../lib/businessDate';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * The subset of an attendance record that is safe and useful to record in the
 * audit trail. Deliberately excludes ids and timestamps that add noise without
 * telling a reviewer what actually changed.
 */
export interface AttendanceRecordSnapshot {
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  status: string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
  remarks: string | null;
}

function snapshotAttendance(record: {
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
  status: string;
  hoursWorked: number | null;
  overtimeHours: number | null;
  remarks: string | null;
}): AttendanceRecordSnapshot {
  return {
    date: businessDateKeyOrNull(record.date),
    timeIn: record.timeIn ? record.timeIn.toISOString() : null,
    timeOut: record.timeOut ? record.timeOut.toISOString() : null,
    status: String(record.status),
    hoursWorked: record.hoursWorked ?? null,
    overtimeHours: record.overtimeHours ?? null,
    remarks: record.remarks ?? null,
  };
}

export class AttendanceService {
  /**
   * Resolve effective data scope from permission tier and requested scope.
   *
   * STANDARD: own only. Explicit scope=team or scope=all -> 403.
   * SUPERVISOR: own (default) or team. Explicit scope=all -> 403.
   * FULL: own (default), team, or all.
   */
  private static resolveScope(
    permissionTier: PermissionTier,
    requestedScope?: string
  ): 'own' | 'team' | 'all' {
    if (!requestedScope) {
      return 'own';
    }

    if (permissionTier === PermissionTier.STANDARD) {
      if (requestedScope === 'self') return 'own';
      throw new AppError(
        `Permission denied: scope '${requestedScope}' requires a higher access tier.`,
        403
      );
    }

    if (permissionTier === PermissionTier.SUPERVISOR) {
      if (requestedScope === 'self') return 'own';
      if (requestedScope === 'team') return 'team';
      throw new AppError(
        `Permission denied: scope '${requestedScope}' requires FULL access tier.`,
        403
      );
    }

    if (requestedScope === 'all') return 'all';
    if (requestedScope === 'team') return 'team';
    return 'own';
  }

  /**
   * Get attendance calendar events (aggregates)
   */
  static async getCalendar(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      start: string;
      end: string;
      scope?: string;
      unitId?: string;
      departmentId?: string;
      employeeId?: string;
      status?: string;
    }
  ) {
    const { start, end, scope, unitId, departmentId, employeeId, status } = params;

    if (!start || !end) throw new AppError('start and end dates are required', 400);

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }
    if (startDate > endDate) throw new AppError('start must be before end', 400);

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 186) throw new AppError('Calendar range cannot exceed 6 months', 400);

    const effectiveScope = AttendanceService.resolveScope(permissionTier, scope);

    const where: any = {
      date: { gte: startDate, lte: endDate },
    };

    if (status) {
      where.status = status;
    }

    if (effectiveScope === 'own') {
      where.employeeId = requestingEmployeeId;
    } else if (effectiveScope === 'team') {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      where.employeeId = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else {
      if (employeeId) where.employeeId = employeeId;
      if (unitId || departmentId) {
        where.employee = {};
        if (unitId) where.employee.unitId = unitId;
        if (departmentId) where.employee.departmentId = departmentId;
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      select: {
        date: true,
        status: true,
      },
    });

    const aggregates: Record<string, any> = {};

    for (const record of records) {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!aggregates[dateStr]) {
        aggregates[dateStr] = {
          date: dateStr,
          PRESENT: 0,
          LATE: 0,
          ABSENT: 0,
          ON_LEAVE: 0,
          HALF_DAY: 0,
          HOLIDAY: 0,
          SUSPENDED: 0,
          REST_DAY: 0,
        };
      }
      if (aggregates[dateStr][record.status] !== undefined) {
        aggregates[dateStr][record.status]++;
      }
    }

    // Fetch OrganizationCalendarEntry for the range
    const holidays = await prisma.organizationCalendarEntry.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        status: 'APPROVED'
      }
    });

    for (const hol of holidays) {
      const dateStr = hol.date.toISOString().split('T')[0];
      if (!aggregates[dateStr]) {
        aggregates[dateStr] = {
          date: dateStr,
          PRESENT: 0,
          LATE: 0,
          ABSENT: 0,
          ON_LEAVE: 0,
          HALF_DAY: 0,
          HOLIDAY: 0,
          SUSPENDED: 0,
          REST_DAY: 0,
        };
      }
      
      // Inject organization context into the aggregate
      if (!aggregates[dateStr].organizationEvents) {
        aggregates[dateStr].organizationEvents = [];
      }
      aggregates[dateStr].organizationEvents.push({
        type: hol.type,
        name: hol.name
      });
      
      if (hol.type === 'HOLIDAY' || hol.type === 'SPECIAL_NON_WORKING' || hol.type === 'ORGANIZATION_NON_WORKING') {
        aggregates[dateStr].HOLIDAY = (aggregates[dateStr].HOLIDAY || 0) + 1;
      } else if (hol.type === 'SUSPENSION') {
        aggregates[dateStr].SUSPENDED = (aggregates[dateStr].SUSPENDED || 0) + 1;
      }
    }

    return Object.values(aggregates).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }

  /**
   * List attendance records with composite schedule and holiday context.
   * Paginated by Employee (since dates are virtualized for missing records).
   */
  static async list(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      unitId?: string;
      departmentId?: string;
      scheduleTemplateId?: string;
      recordAvailability?: string; // 'with_record' | 'no_record'
    } = {}
  ) {
    const { page = 1, limit = 30, employeeId, startDate, endDate, status, unitId, departmentId, scheduleTemplateId, recordAvailability } = params;
    const skip = (page - 1) * limit;

    // Shared definition — see lib/workforceScope.ts. Keeps Tally, Reports and
    // the AI fact sheet describing the same population.
    const empWhere: any = { ...ACTIVE_WORKFORCE_WHERE };

    if (permissionTier === PermissionTier.FULL) {
      if (employeeId) empWhere.id = employeeId;
      if (unitId) empWhere.unitId = unitId;
      if (departmentId) empWhere.departmentId = departmentId;
    } else if (permissionTier === PermissionTier.SUPERVISOR) {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      empWhere.id = employeeId && allowedIds.includes(employeeId) ? employeeId : { in: allowedIds };
    } else {
      empWhere.id = requestingEmployeeId;
    }

    const [employees, totalEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: empWhere,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          unit: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }),
      prisma.employee.count({ where: empWhere })
    ]);

    const sDate = startDate ? new Date(startDate) : new Date();
    const eDate = endDate ? new Date(endDate) : new Date();
    
    // Safety limit to 31 days max range for list view
    if (eDate.getTime() - sDate.getTime() > 31 * 24 * 60 * 60 * 1000) {
      throw new AppError('Date range for list cannot exceed 31 days.', 400);
    }

    const dates: Date[] = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    const empIds = employees.map(e => e.id);
    
    // Batch fetch attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: empIds },
        date: { gte: sDate, lte: eDate }
      },
      include: { logs: true }
    });

    let results: any[] = [];
    const { ScheduleService } = require('./schedule.service'); // Lazy import to avoid circular dependency if any

    for (const emp of employees) {
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        
        // Find attendance record for this exact day
        const record = attendanceRecords.find(r => r.employeeId === emp.id && r.date.toISOString().split('T')[0] === dateStr);
        
        // Resolve composite schedule context
        const scheduleContext = await ScheduleService.resolveScheduleForDate(emp.id, date);

        results.push({
          id: record ? record.id : `VIRTUAL-${emp.id}-${dateStr}`,
          date: date,
          employee: emp,
          
          attendanceFact: record ? {
            status: record.status,
            timeIn: record.timeIn,
            timeOut: record.timeOut,
            overtimeHours: record.overtimeHours,
            remarks: record.remarks,
            logs: record.logs,
            // Imported source facts. `timeIn`/`timeOut` are only the first and
            // last punch of the day; a day with several sessions, or a pair the
            // device never closed, is only visible through these.
            sessions: record.sessions ?? null,
            sourceHours: record.sourceHours ?? null,
            reviewFlags: record.reviewFlags ?? null,
            sourceType: record.sourceType,
            manuallyModifiedAt: record.manuallyModifiedAt,
          } : {
            status: 'NO_RECORD',
            timeIn: null,
            timeOut: null,
            sessions: null,
            sourceHours: null,
            reviewFlags: null,
            sourceType: null,
            manuallyModifiedAt: null,
            overtimeHours: null,
            remarks: null,
            logs: []
          },
          
          organizationContext: scheduleContext.organizationContext,
          scheduleAssignment: scheduleContext.scheduleAssignment,
          templateDay: scheduleContext.templateDay,
          effectiveEmployeeSchedule: scheduleContext.effectiveEmployeeSchedule
        });
      }
    }

    // In-memory filters for status, schedule context, and availability
    if (status || scheduleTemplateId || recordAvailability) {
      results = results.filter(r => {
        let pass = true;
        
        if (status) {
          if (status === 'HOLIDAY') {
            // A holiday the employee's unit works through is not a holiday for them.
            pass = pass && r.organizationContext?.appliesToEmployee !== false && !!(r.organizationContext?.type === 'HOLIDAY' || r.organizationContext?.type === 'SPECIAL_NON_WORKING' || r.organizationContext?.type === 'ORGANIZATION_NON_WORKING');
          } else if (status === 'SUSPENDED') {
            pass = pass && r.organizationContext?.appliesToEmployee !== false && (r.organizationContext?.type === 'SUSPENSION');
          } else if (status === 'REST_DAY') {
            pass = pass && (r.effectiveEmployeeSchedule?.isWorkingDay === false && r.effectiveEmployeeSchedule?.type !== 'UNCONFIGURED');
          } else {
            pass = pass && (r.attendanceFact.status === status);
          }
        }
        
        if (scheduleTemplateId) {
          pass = pass && (r.scheduleAssignment?.templateId === scheduleTemplateId);
        }
        
        if (recordAvailability === 'with_record') {
          pass = pass && (r.attendanceFact.status !== 'NO_RECORD');
        } else if (recordAvailability === 'no_record') {
          pass = pass && (r.attendanceFact.status === 'NO_RECORD');
        }
        
        return pass;
      });
    }

    // Sort by date desc, then by employee last name
    results.sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.employee.lastName.localeCompare(b.employee.lastName);
    });

    return { data: results, total: totalEmployees, page, limit, datesCount: dates.length };
  }

  /**
   * Get attendance logs (late/tardiness).
   * HR: all | Supervisor: own + subordinates
   */
  static async getLogs(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      logType?: string;
    } = {}
  ) {
    const { page = 1, limit = 30, employeeId, startDate, endDate, logType } = params;
    const skip = (page - 1) * limit;

    if (permissionTier === PermissionTier.STANDARD) {
      throw new AppError("You don't have permission to view attendance logs.", 403);
    }

    const where: any = {};

    if (permissionTier === PermissionTier.SUPERVISOR) {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);

      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      where.employeeId = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate) where.logDate = { ...where.logDate, gte: new Date(startDate) };
    if (endDate) where.logDate = { ...where.logDate, lte: new Date(endDate) };
    if (logType) where.logType = logType;

    const [data, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              unit: { select: { name: true } },
            },
          },
        },
        orderBy: { logDate: 'desc' },
      }),
      prisma.attendanceLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get work schedules from Employee.workSchedule field.
   * This is the assigned schedule template — NOT a date-specific schedule table.
   * Date-specific work schedule management is NOT implemented in this phase.
   *
   * HR: all | Supervisor: own + subordinates | Standard: own only
   */
  static async getSchedules(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      employeeId?: string;
      unitId?: string;
      departmentId?: string;
      search?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, employeeId, unitId, departmentId, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { ...ACTIVE_WORKFORCE_WHERE };

    if (permissionTier === PermissionTier.FULL) {
      if (employeeId) where.id = employeeId;
      if (unitId) where.unitId = unitId;
      if (departmentId) where.departmentId = departmentId;
    } else if (permissionTier === PermissionTier.SUPERVISOR) {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      where.id = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else {
      where.id = requestingEmployeeId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeNumber: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          workSchedule: true,
          unit: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          jobRole: { select: { title: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.employee.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get today's summary — HR only for dashboard.
   */
  static async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [present, absent, onLeave, late] = await Promise.all([
      prisma.attendanceRecord.count({ where: { date: today, status: 'PRESENT' } }),
      prisma.attendanceRecord.count({ where: { date: today, status: 'ABSENT' } }),
      prisma.attendanceRecord.count({ where: { date: today, status: 'ON_LEAVE' } }),
      prisma.attendanceRecord.count({ where: { date: today, status: 'LATE' } }),
    ]);

    const totalEmployees = await prisma.employee.count({
      where: { ...ACTIVE_WORKFORCE_WHERE },
    });

    return { totalEmployees, present, absent, onLeave, late, date: today };
  }

  /**
   * Attendance Tally — summarise attendance facts per employee for a date range.
   *
   * Uses a batch approach:
   *  1. Resolve authorized employee set (scope / search / unit / dept).
   *  2. Fetch ALL AttendanceRecord rows for those employees in the range in ONE query.
   *  3. Group records in-memory by employeeId.
   *  4. Count status totals AND count DISTINCT attendance dates (Set<string>).
   *  5. noImportedRecord = totalCalendarDaysInRange - DISTINCT date count.
   *     This is honest — it uses distinct dates so duplicate import rows cannot
   *     artificially shrink the noImportedRecord count.
   *  6. NO automatic Absent inference. noImportedRecord ≠ Absent.
   *
   * Date range cap: 186 days (same as calendar endpoint).
   */
  static async getTally(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      startDate: string;
      endDate: string;
      employeeId?: string;
      unitId?: string;
      departmentId?: string;
      search?: string;
    }
  ) {
    const { page = 1, limit = 50, startDate, endDate, employeeId, unitId, departmentId, search } = params;
    const skip = (page - 1) * limit;

    if (!startDate || !endDate) throw new AppError('startDate and endDate are required', 400);

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }
    if (sDate > eDate) throw new AppError('startDate must be on or before endDate', 400);

    const diffDays = (eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 186) throw new AppError('Date range cannot exceed 6 months', 400);

    // Total calendar days in range (inclusive)
    const totalCalendarDays = Math.round(diffDays) + 1;

    // ── Step 1: Resolve authorized employee set ─────────────────────────────
    const empWhere: any = { ...ACTIVE_WORKFORCE_WHERE };

    if (permissionTier === PermissionTier.FULL) {
      if (employeeId) empWhere.id = employeeId;
      if (unitId) empWhere.unitId = unitId;
      if (departmentId) empWhere.departmentId = departmentId;
    } else if (permissionTier === PermissionTier.SUPERVISOR) {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      empWhere.id = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else {
      empWhere.id = requestingEmployeeId;
    }

    if (search) {
      empWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeNumber: { contains: search } },
      ];
    }

    const [employees, totalEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: empWhere,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          unit: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          jobRole: { select: { title: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.employee.count({ where: empWhere }),
    ]);

    if (employees.length === 0) {
      return { data: [], total: totalEmployees, page, limit, totalCalendarDays };
    }

    const empIds = employees.map((e) => e.id);

    // ── Step 2: Batch-fetch all AttendanceRecord rows for this employee set ─
    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: empIds },
        date: { gte: sDate, lte: eDate },
      },
      select: {
        employeeId: true,
        date: true,
        status: true,
      },
    });

    // ── Step 3: Group in-memory by employeeId ───────────────────────────────
    type EmpStats = {
      present: number;
      late: number;
      absent: number;
      onLeave: number;
      halfDay: number;
      importedRecords: number;
      distinctDates: Set<string>;
    };

    const statsMap = new Map<string, EmpStats>();

    for (const empId of empIds) {
      statsMap.set(empId, {
        present: 0, late: 0, absent: 0, onLeave: 0, halfDay: 0,
        importedRecords: 0,
        distinctDates: new Set<string>(),
      });
    }

    for (const rec of records) {
      const stats = statsMap.get(rec.employeeId);
      if (!stats) continue;

      stats.importedRecords++;

      const dateStr = rec.date instanceof Date
        ? rec.date.toISOString().split('T')[0]
        : String(rec.date).split('T')[0];
      stats.distinctDates.add(dateStr);

      switch (rec.status) {
        case 'PRESENT': stats.present++; break;
        case 'LATE': stats.late++; break;
        case 'ABSENT': stats.absent++; break;
        case 'ON_LEAVE': stats.onLeave++; break;
        case 'HALF_DAY': stats.halfDay++; break;
      }
    }

    // ── Step 4: Build result array ──────────────────────────────────────────
    const data = employees.map((emp) => {
      const s = statsMap.get(emp.id)!;
      // noImportedRecord = total calendar days - distinct days that have at
      // least one AttendanceRecord. Using distinct dates prevents duplicate
      // import rows from reducing the no-record count incorrectly.
      const noImportedRecord = totalCalendarDays - s.distinctDates.size;

      return {
        employee: emp,
        present: s.present,
        late: s.late,
        absent: s.absent,
        onLeave: s.onLeave,
        halfDay: s.halfDay,
        importedRecords: s.importedRecords,
        distinctImportedDays: s.distinctDates.size,
        noImportedRecord,
        totalCalendarDays,
      };
    });

    return { data, total: totalEmployees, page, limit, totalCalendarDays };
  }

  /**
   * HR can update an attendance record.
   */
  /**
   * HR manual correction of one attendance record.
   *
   * Returns `{ before, after }` so the caller can write BOTH sides to the audit
   * trail. The previous implementation returned only the updated row, so the
   * controller could log `newValue` but never `oldValue` — corrections were
   * unreconstructable even though `AuditLog.oldValue` existed and was unused.
   *
   * It also stamps manual provenance. Without it, a future attendance import has
   * no way to tell an HR correction from an imported value, and would silently
   * overwrite hand-checked data.
   */
  static async update(
    id: string,
    data: {
      timeIn?: string | null;
      timeOut?: string | null;
      status?: AttendanceStatus;
      hoursWorked?: number | null;
      overtimeHours?: number | null;
      remarks?: string | null;
    },
    actorUserId?: string
  ): Promise<{ before: AttendanceRecordSnapshot; after: AttendanceRecordSnapshot; record: any }> {
    const record = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) throw new AppError('Attendance record not found', 404);

    const before = snapshotAttendance(record);

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        // `undefined` leaves a field untouched; an explicit null clears it.
        timeIn: data.timeIn === undefined ? undefined : data.timeIn === null ? null : new Date(data.timeIn),
        timeOut: data.timeOut === undefined ? undefined : data.timeOut === null ? null : new Date(data.timeOut),
        status: data.status,
        hoursWorked: data.hoursWorked === undefined ? undefined : data.hoursWorked,
        overtimeHours: data.overtimeHours === undefined ? undefined : data.overtimeHours,
        remarks: data.remarks === undefined ? undefined : data.remarks,
        // Manual provenance — see lib/attendanceProvenance rationale in the
        // import design review. A later import must ASK before replacing this.
        sourceType: AttendanceRecordSource.MANUAL,
        manuallyModifiedAt: new Date(),
        manuallyModifiedById: actorUserId ?? null,
        recordVersion: { increment: 1 },
      },
    });

    return { before, after: snapshotAttendance(updated), record: updated };
  }

  static async exportExcel(requestingEmployeeId: string, permissionTier: PermissionTier, params: any): Promise<Buffer> {
    const listResult = await this.list(requestingEmployeeId, permissionTier, {
      ...params,
      limit: 5000,
      page: 1,
    });
    const tallyResult = await this.getTally(requestingEmployeeId, permissionTier, {
      ...params,
      limit: 5000,
      page: 1,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HRISense';
    
    const isSingleDate = params.startDate === params.endDate;
    const reportPeriodText = isSingleDate ? params.startDate : `${params.startDate} – ${params.endDate}`;
    const reportPeriodLabel = isSingleDate ? 'Report Date' : 'Report Period';
    const generatedAtText = new Date().toLocaleString('en-PH');

    // ==========================================
    // Summary Sheet
    // ==========================================
    const summarySheet = workbook.addWorksheet('Attendance Summary');
    
    summarySheet.addRow(['HRISense Attendance Summary']);
    summarySheet.getCell('A1').font = { bold: true, size: 14 };
    summarySheet.addRow([reportPeriodLabel, reportPeriodText]);
    summarySheet.getCell('A2').font = { bold: true };
    summarySheet.addRow(['Generated At', generatedAtText]);
    summarySheet.getCell('A3').font = { bold: true };
    summarySheet.addRow([]);

    const summaryHeaders = ['Emp No', 'Name', 'Unit', 'Job Role', 'Period Start', 'Period End', 'Present', 'Late', 'Absent', 'On Leave', 'Half Day', 'Imported', 'No Record'];
    const sHeaderRow = summarySheet.addRow(summaryHeaders);
    sHeaderRow.font = { bold: true };

    const sWidths = [15, 25, 20, 25, 15, 15, 10, 10, 10, 10, 10, 12, 12];
    sWidths.forEach((w, i) => { summarySheet.getColumn(i + 1).width = w; });

    tallyResult.data.forEach((r: any) => {
      summarySheet.addRow([
        r.employee.employeeNumber,
        `${r.employee.lastName}, ${r.employee.firstName}`,
        r.employee.unit?.name || '—',
        r.employee.jobRole?.title || '—',
        params.startDate,
        params.endDate,
        r.present,
        r.late,
        r.absent,
        r.onLeave,
        r.halfDay,
        r.importedRecords,
        r.noImportedRecord
      ]);
    });

    // ==========================================
    // Details Sheet
    // ==========================================
    const detailSheet = workbook.addWorksheet('Detailed Attendance');
    
    detailSheet.addRow(['HRISense Detailed Attendance']);
    detailSheet.getCell('A1').font = { bold: true, size: 14 };
    detailSheet.addRow([reportPeriodLabel, reportPeriodText]);
    detailSheet.getCell('A2').font = { bold: true };
    detailSheet.addRow(['Generated At', generatedAtText]);
    detailSheet.getCell('A3').font = { bold: true };
    detailSheet.addRow([]);

    const detailHeaders = ['Date', 'Emp No', 'Name', 'Schedule', 'Status', 'Time In', 'Time Out', 'Remarks'];
    const dHeaderRow = detailSheet.addRow(detailHeaders);
    dHeaderRow.font = { bold: true };

    const dWidths = [15, 15, 25, 25, 15, 15, 15, 30];
    dWidths.forEach((w, i) => { detailSheet.getColumn(i + 1).width = w; });

    listResult.data.forEach((r: any) => {
      const isDayOff = !r.effectiveEmployeeSchedule?.isWorkingDay;
      const schedStr = isDayOff ? 'Day Off' : (r.effectiveEmployeeSchedule?.startTime ? `${r.effectiveEmployeeSchedule.startTime}-${r.effectiveEmployeeSchedule.endTime}` : '—');
      detailSheet.addRow([
        r.date,
        r.employee.employeeNumber,
        `${r.employee.lastName}, ${r.employee.firstName}`,
        schedStr,
        r.attendanceFact?.status || 'No Imported Record',
        r.attendanceFact?.timeIn ? new Date(r.attendanceFact.timeIn).toLocaleTimeString() : '—',
        r.attendanceFact?.timeOut ? new Date(r.attendanceFact.timeOut).toLocaleTimeString() : '—',
        [r.attendanceFact?.remarks, r.organizationContext?.name].filter(Boolean).join(' | ') || '—'
      ]);
    });

    return await workbook.xlsx.writeBuffer() as unknown as Buffer;
  }

  static async exportPDF(requestingEmployeeId: string, permissionTier: PermissionTier, params: any): Promise<Buffer> {
    const tallyResult = await this.getTally(requestingEmployeeId, permissionTier, {
      ...params,
      limit: 5000,
      page: 1,
    });
    
    const isSingleDate = params.startDate === params.endDate;
    const reportPeriodText = isSingleDate ? params.startDate : `${params.startDate} – ${params.endDate}`;
    const reportPeriodLabel = isSingleDate ? 'Report Date' : 'Report Period';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      doc.fontSize(16).fillColor('#148281').text('HRISense Attendance Report', { align: 'center' });
      doc.fontSize(12).fillColor('#333333').text('Attendance Tally Summary', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#444444').text(`${reportPeriodLabel}: ${reportPeriodText}`, { align: 'center' });
      doc.fontSize(9).fillColor('#666666').text(`Generated At: ${new Date().toLocaleString('en-PH')} | Total Records: ${tallyResult.data.length}`, { align: 'center' });
      doc.moveDown(1.5);

      const startY = doc.y;
      const colX = [30, 90, 200, 300, 420, 470, 520, 570, 620, 680, 740];
      const headers = ['Emp No', 'Name', 'Unit', 'Job Role', 'Pres', 'Late', 'Abs', 'Leave', 'Half', 'Import', 'No Rec'];

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i], startY, { width: colX[i+1] ? colX[i+1]-colX[i]-5 : 80 }));
      
      let currentY = startY + 15;
      doc.moveTo(30, currentY).lineTo(810, currentY).stroke('#cccccc');
      currentY += 5;

      doc.font('Helvetica');
      tallyResult.data.forEach((r: any) => {
        if (currentY > 550) {
          doc.addPage();
          currentY = 30;
        }
        doc.fontSize(8).fillColor('#333333');
        doc.text(r.employee.employeeNumber || '—', colX[0], currentY, { width: colX[1]-colX[0]-5 });
        doc.text(`${r.employee.lastName}, ${r.employee.firstName}`, colX[1], currentY, { width: colX[2]-colX[1]-5 });
        doc.text(r.employee.unit?.name || '—', colX[2], currentY, { width: colX[3]-colX[2]-5 });
        doc.text(r.employee.jobRole?.title || '—', colX[3], currentY, { width: colX[4]-colX[3]-5 });
        doc.text(String(r.present), colX[4], currentY);
        doc.text(String(r.late), colX[5], currentY);
        doc.text(String(r.absent), colX[6], currentY);
        doc.text(String(r.onLeave), colX[7], currentY);
        doc.text(String(r.halfDay), colX[8], currentY);
        doc.text(String(r.importedRecords), colX[9], currentY);
        doc.text(String(r.noImportedRecord), colX[10], currentY);
        currentY += 15;
      });

      doc.end();
    });
  }
}
