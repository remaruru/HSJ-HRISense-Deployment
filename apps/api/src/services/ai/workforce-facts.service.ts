import { prisma } from '../../config/prisma';
import { ratio } from '../../lib/percent';
import { attendanceRateFromCounts } from '../../lib/attendance-metrics';
import {
  ACTIVE_WORKFORCE_WHERE,
  ACTIVE_WORKFORCE_EMPLOYEE_RELATION,
} from '../../lib/workforceScope';

/**
 * Deterministic workforce facts.
 *
 * These are computed entirely server-side by ordinary database queries — no model
 * is involved. AI Assistance receives ONLY this aggregated summary, never raw
 * employee records.
 *
 * ── What is deliberately NOT included ────────────────────────────────────────
 * government IDs, addresses, birth dates, contact details, passwords or any
 * credential material, session/JWT data, medical `hrNotes`, psychological
 * `hrConfidentialNotes`, uploaded document contents, individual evaluation
 * scores, or any free-text an employee or HR wrote about a person.
 *
 * Everything here is a count, a rate, or a non-identifying label.
 */

export interface WorkforceFacts {
  generatedAt: string;
  periodDays: number;
  headcount: {
    totalActive: number;
    byUnit: Array<{ unit: string; count: number }>;
    byEmploymentStatus: Array<{ status: string; count: number }>;
    newHiresInPeriod: number;
    separationsInPeriod: number;
    pendingSupervisorAssignment: number;
  };
  attendance: {
    hasData: boolean;
    recordCount: number;
    byStatus: Array<{ status: string; count: number }>;
    /**
     * % of imported Present/Late/Half-day/Absent records that show presence.
     * Days with no record are excluded — they are not absences.
     */
    presentRate: number | null;
    /** Present + Late + Half-day records — the rate's numerator. */
    presenceRecords: number;
    /** Explicit Absent records — with presenceRecords, the rate's denominator. */
    recordedAbsentRecords: number;
    lateCount: number;
    /** Employee-days in range with no imported record. NOT absences. */
    daysWithNoImportedRecord: number;
  };
  leave: {
    totalRequestsInPeriod: number;
    byStatus: Array<{ status: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
    awaitingDecision: number;
  };
  compliance: {
    activeRequirements: number;
    byStatus: Array<{ status: string; count: number }>;
    expiringSoon: number;
    expired: number;
    missing: number;
    needsReview: number;
  };
  training: {
    activitiesInPeriod: number;
    participantsAssigned: number;
    participantsCompleted: number;
    participantsDidNotAttend: number;
    completionRate: number | null;
  };
  evaluations: {
    activeCycles: number;
    assignmentsTotal: number;
    byStatus: Array<{ status: string; count: number }>;
    overdue: number;
  };
  recruitment: {
    openOpenings: number;
    applicationsInPeriod: number;
    byStatus: Array<{ status: string; count: number }>;
  };
}

function toPairs<T extends string>(
  rows: Array<{ _count: { _all: number } } & Record<string, any>>,
  key: string
): Array<{ status: T; count: number }> {
  return rows.map((r) => ({ status: r[key], count: r._count._all }));
}

export class WorkforceFactsService {
  /**
   * Builds the deterministic fact sheet for the last `periodDays` days.
   */
  static async build(periodDays = 30): Promise<WorkforceFacts> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() - periodDays);
    periodStart.setHours(0, 0, 0, 0);

    const [
      totalActive,
      unitGroups,
      units,
      employmentStatusGroups,
      newHires,
      separations,
      pendingSupervisor,
    ] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null, employmentState: 'ACTIVE' } }),
      prisma.employee.groupBy({
        by: ['unitId'],
        where: { deletedAt: null, employmentState: 'ACTIVE' },
        _count: { _all: true },
      }),
      prisma.unit.findMany({ select: { id: true, name: true } }),
      prisma.employee.groupBy({
        by: ['employmentStatus'],
        where: { deletedAt: null, employmentState: 'ACTIVE' },
        _count: { _all: true },
      }),
      prisma.employee.count({ where: { ...ACTIVE_WORKFORCE_WHERE, hireDate: { gte: periodStart } } }),
      prisma.employee.count({
        where: { separationDate: { gte: periodStart, lte: now } },
      }),
      prisma.employee.count({
        where: { deletedAt: null, supervisorAssignmentStatus: 'PENDING' },
      }),
    ]);

    const unitNameById = new Map(units.map((u) => [u.id, u.name]));

    // ── Attendance ────────────────────────────────────────────────────────────
    // SCOPE: identical to Attendance Tally and the Attendance report. Without
    // the employee relation filter these three queries counted attendance rows
    // belonging to archived and separated staff, so AI Assistance and Reports
    // disagreed about the same period.
    const attendancePeriodWhere = {
      date: { gte: periodStart, lte: now },
      employee: ACTIVE_WORKFORCE_EMPLOYEE_RELATION,
    };

    const [attendanceGroups, attendanceRecordCount, distinctAttendanceDays] = await Promise.all([
      prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: attendancePeriodWhere,
        _count: { _all: true },
      }),
      prisma.attendanceRecord.count({ where: attendancePeriodWhere }),
      prisma.attendanceRecord.findMany({
        where: attendancePeriodWhere,
        distinct: ['employeeId', 'date'],
        select: { employeeId: true },
      }),
    ]);

    const attendanceByStatus = attendanceGroups.map((g) => ({
      status: String(g.status),
      count: g._count._all,
    }));
    // Same rule as the assistant (services/ai/analytics/attendance-metrics.ts):
    // presence = Present + Late + Half day; only an explicit Absent record is an
    // absence; leave / holiday / rest-day records are neither. Previously half
    // days were left out of presence and leave or holiday records counted
    // against the rate.
    const statusCounts = Object.fromEntries(attendanceByStatus.map((s) => [s.status, s.count]));
    const attendanceRule = attendanceRateFromCounts(statusCounts);
    const lateCount = attendanceByStatus.find((s) => s.status === 'LATE')?.count ?? 0;

    // Employee-days in the window that have no imported record. This is an
    // ingestion gap, never an absence.
    //
    // Both terms now describe the SAME population (the active workforce), so the
    // subtraction is meaningful. Previously the minuend counted active employees
    // while the subtrahend counted every employee including archived ones, which
    // understated the gap and could clamp a real one to zero.
    const expectedEmployeeDays = totalActive * periodDays;
    const daysWithNoImportedRecord = Math.max(
      0,
      expectedEmployeeDays - distinctAttendanceDays.length
    );

    // ── Leave ─────────────────────────────────────────────────────────────────
    const [leaveStatusGroups, leaveTypeGroups, leaveTotal, leaveAwaiting] = await Promise.all([
      prisma.leaveRequest.groupBy({
        by: ['status'],
        where: { createdAt: { gte: periodStart }, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.leaveRequest.groupBy({
        by: ['leaveType'],
        where: { createdAt: { gte: periodStart }, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.leaveRequest.count({ where: { createdAt: { gte: periodStart }, deletedAt: null } }),
      prisma.leaveRequest.count({
        where: { status: { in: ['PENDING', 'FOR_REVIEW'] }, deletedAt: null },
      }),
    ]);

    // ── Compliance (reuses the same derivation the Compliance page shows) ─────
    const compliance = await WorkforceFactsService.summariseCompliance();

    // ── Training ──────────────────────────────────────────────────────────────
    const [activitiesInPeriod, participantGroups] = await Promise.all([
      prisma.trainingActivity.count({
        where: { startDate: { gte: periodStart }, deletedAt: null },
      }),
      prisma.trainingParticipant.groupBy({
        by: ['participationStatus'],
        where: { trainingActivity: { startDate: { gte: periodStart }, deletedAt: null } },
        _count: { _all: true },
      }),
    ]);

    const participantCounts = Object.fromEntries(
      participantGroups.map((g) => [String(g.participationStatus), g._count._all])
    );
    const assigned = participantGroups.reduce((sum, g) => sum + g._count._all, 0);
    const completed = participantCounts['COMPLETED'] ?? 0;
    const didNotAttend = participantCounts['DID_NOT_ATTEND'] ?? 0;

    // ── Evaluations ───────────────────────────────────────────────────────────
    const [activeCycles, assignmentGroups, overdueAssignments] = await Promise.all([
      prisma.evaluationCycle.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      // One head evaluation per employee evaluated — self and peer rows would
      // otherwise count the same employee several times.
      prisma.evaluationAssignment.groupBy({
        by: ['status'],
        where: { deletedAt: null, raterType: 'HEAD', cycle: { status: 'ACTIVE' } },
        _count: { _all: true },
      }),
      prisma.evaluationAssignment.count({
        where: {
          deletedAt: null,
          raterType: 'HEAD',
          cycle: { status: 'ACTIVE' },
          dueDate: { lt: now },
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        },
      }),
    ]);

    // ── Recruitment ───────────────────────────────────────────────────────────
    const [openOpenings, applicationsInPeriod, applicationGroups] = await Promise.all([
      prisma.jobOpening.count({ where: { status: 'OPEN' } }),
      prisma.jobApplication.count({ where: { applicationDate: { gte: periodStart } } }),
      prisma.jobApplication.groupBy({
        by: ['status'],
        where: { applicationDate: { gte: periodStart } },
        _count: { _all: true },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      periodDays,
      headcount: {
        totalActive,
        byUnit: unitGroups
          .map((g) => ({
            unit: g.unitId ? unitNameById.get(g.unitId) ?? 'Unassigned' : 'Unassigned',
            count: g._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        byEmploymentStatus: employmentStatusGroups.map((g) => ({
          status: String(g.employmentStatus),
          count: g._count._all,
        })),
        newHiresInPeriod: newHires,
        separationsInPeriod: separations,
        pendingSupervisorAssignment: pendingSupervisor,
      },
      attendance: {
        hasData: attendanceRecordCount > 0,
        recordCount: attendanceRecordCount,
        byStatus: attendanceByStatus,
        presentRate: attendanceRule.attendanceRate,
        presenceRecords: attendanceRule.presence,
        recordedAbsentRecords: attendanceRule.recordedAbsent,
        lateCount,
        daysWithNoImportedRecord,
      },
      leave: {
        totalRequestsInPeriod: leaveTotal,
        byStatus: toPairs(leaveStatusGroups as any, 'status'),
        byType: leaveTypeGroups.map((g) => ({
          type: String(g.leaveType),
          count: g._count._all,
        })),
        awaitingDecision: leaveAwaiting,
      },
      compliance,
      training: {
        activitiesInPeriod,
        participantsAssigned: assigned,
        participantsCompleted: completed,
        participantsDidNotAttend: didNotAttend,
        completionRate: ratio(completed, assigned),
      },
      evaluations: {
        activeCycles,
        assignmentsTotal: assignmentGroups.reduce((sum, g) => sum + g._count._all, 0),
        byStatus: toPairs(assignmentGroups as any, 'status'),
        overdue: overdueAssignments,
      },
      recruitment: {
        openOpenings,
        applicationsInPeriod,
        byStatus: toPairs(applicationGroups as any, 'status'),
      },
    };
  }

  /**
   * Aggregates the derived compliance status across all active employees, using
   * the same rules as `ComplianceService.getEmployeeComplianceSummary` — no
   * expiry period is invented; `EXPIRING_SOON` only applies where HR configured
   * `reminderDays`.
   */
  private static async summariseCompliance(): Promise<WorkforceFacts['compliance']> {
    const now = new Date();

    const [employees, requirements] = await Promise.all([
      prisma.employee.findMany({
        where: { deletedAt: null, employmentState: 'ACTIVE' },
        select: { id: true, unitId: true, departmentId: true, jobRoleId: true },
      }),
      prisma.complianceRequirement.findMany({
        where: { lifecycle: 'ACTIVE', deletedAt: null },
        include: {
          scopes: true,
          complianceRecords: { where: { deletedAt: null }, orderBy: { completedAt: 'desc' } },
          medicalRecords: { where: { deletedAt: null }, orderBy: { examDate: 'desc' } },
          psychRecords: { where: { deletedAt: null }, orderBy: { assessmentDate: 'desc' } },
        },
      }),
    ]);

    const counts = { VALID: 0, MISSING: 0, NEEDS_REVIEW: 0, EXPIRING_SOON: 0, EXPIRED: 0 };

    const applies = (scopes: any[], emp: { unitId: string; departmentId: string | null; jobRoleId: string }) =>
      scopes.some((s) => {
        switch (s.scopeType) {
          case 'ALL': return true;
          case 'UNIT': return s.targetUnitId === emp.unitId;
          case 'DEPARTMENT': return s.targetDepartmentId === emp.departmentId;
          case 'JOB_ROLE': return s.targetJobRoleId === emp.jobRoleId;
          case 'EMPLOYEE': return false; // handled per-employee below
          default: return false;
        }
      });

    for (const req of requirements) {
      for (const emp of employees) {
        const employeeScoped = req.scopes.some(
          (s) => s.scopeType === 'EMPLOYEE' && s.targetEmployeeId === emp.id
        );
        if (!employeeScoped && !applies(req.scopes, emp)) continue;

        let latest: { reviewStatus: string; expiresAt: Date | null } | null = null;

        if (req.category === 'MEDICAL') {
          latest = req.medicalRecords.find((r) => r.employeeId === emp.id) ?? null;
        } else if (req.category === 'PSYCHOLOGICAL') {
          latest = req.psychRecords.find((r) => r.employeeId === emp.id) ?? null;
        } else {
          latest = req.complianceRecords.find((r) => r.employeeId === emp.id) ?? null;
        }

        if (!latest) {
          counts.MISSING++;
        } else if (
          latest.reviewStatus === 'PENDING_REVIEW' ||
          latest.reviewStatus === 'NEEDS_CORRECTION'
        ) {
          counts.NEEDS_REVIEW++;
        } else if (latest.expiresAt && latest.expiresAt < now) {
          counts.EXPIRED++;
        } else if (latest.expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          if (latest.expiresAt <= threshold) counts.EXPIRING_SOON++;
          else counts.VALID++;
        } else {
          counts.VALID++;
        }
      }
    }

    return {
      activeRequirements: requirements.length,
      byStatus: Object.entries(counts).map(([status, count]) => ({ status, count })),
      expiringSoon: counts.EXPIRING_SOON,
      expired: counts.EXPIRED,
      missing: counts.MISSING,
      needsReview: counts.NEEDS_REVIEW,
    };
  }
}
