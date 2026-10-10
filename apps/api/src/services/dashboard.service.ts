import { LeaveEntitlementService } from './leave-entitlement.service';
import { prisma } from '../config/prisma';
import { withLeaveBalanceFigures } from '../lib/leave-balance';
import { ACTIVE_WORKFORCE_EMPLOYEE_RELATION } from '../lib/workforceScope';
import { attendanceRateFromCounts } from '../lib/attendance-metrics';
import { businessDateKey } from '../lib/businessDate';
import { PermissionTier } from '@prisma/client';
import { OrgHierarchyService } from './org-hierarchy.service';

export class DashboardService {
  /**
   * HR Dashboard stats — all employees overview
   */
  static async getHRStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalEmployees,
      presentToday,
      onLeaveToday,
      newThisMonth,
      pendingLeaves,
      upcomingTrainings,
      recentAnnouncements,
      aiInsights,
      recentActivity,
    ] = await Promise.all([
      // Total active employees
      prisma.employee.count({ where: { deletedAt: null, employmentState: 'ACTIVE' } }),

      // Present today — a stored attendance fact, never inferred.
      prisma.attendanceRecord.count({ where: { date: today, status: 'PRESENT' } }),

      // On leave today
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),

      // New employees this month
      prisma.employee.count({
        where: { deletedAt: null, hireDate: { gte: thisMonth } },
      }),

      // Leave requests awaiting an HR decision — both those filed with no
      // supervisor in the chain (PENDING) and those a supervisor has endorsed
      // (FOR_REVIEW).
      prisma.leaveRequest.findMany({
        where: { status: { in: ['PENDING', 'FOR_REVIEW'] }, deletedAt: null },
        take: 10,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              unit: { select: { name: true } },
              jobRole: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Upcoming trainings — from the CURRENT TrainingActivity model.
      // This previously read the legacy `Training` table, so nothing created in
      // the live Training module ever appeared here.
      prisma.trainingActivity.findMany({
        where: { status: 'SCHEDULED', startDate: { gte: today }, deletedAt: null },
        take: 5,
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true, startDate: true, endDate: true, venue: true, type: true },
      }),

      // Recent announcements (published only)
      prisma.announcement.findMany({
        where: { state: 'ACTIVE', publishAt: { not: null, lte: new Date() } },
        take: 5,
        orderBy: { publishAt: 'desc' },
        select: {
          id: true, title: true, priority: true, publishAt: true, isPinned: true,
        },
      }),

      // AI Insights — only genuinely generated, unexpired insights.
      prisma.aIInsight.findMany({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        take: 3,
        orderBy: { generatedAt: 'desc' },
      }).catch(() => []),

      // Recent Activity (Audit logs)
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { 
          actorUser: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
        }
      }).catch(() => []),
    ]);

    // Attendance rate (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Same population as Attendance Tally, Reports and AI Assistance (active
    // workforce) and the same rule (lib/attendance-metrics): presence (Present +
    // Late + Half day) ÷ (presence + explicit Absent). Previously this counted
    // every record including archived staff, left half days out of presence
    // and counted leave/holiday records against the rate.
    const attendanceRecords = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { date: { gte: thirtyDaysAgo, lte: today }, employee: ACTIVE_WORKFORCE_EMPLOYEE_RELATION },
      _count: { status: true },
    });

    const attendanceMap = Object.fromEntries(
      attendanceRecords.map((r) => [r.status, r._count.status])
    );
    // null (not 0) when there is nothing to measure — an empty attendance table
    // must not be reported as a 0% attendance rate.
    const attendanceRate = attendanceRateFromCounts(attendanceMap).attendanceRate;

    // Today's real figures.
    const [absentToday, recordedTodayCount] = await Promise.all([
      prisma.attendanceRecord.count({ where: { date: today, status: 'ABSENT' } }),
      prisma.attendanceRecord.count({ where: { date: today } }),
    ]);

    // Unit headcount
    const unitHeadcount = await prisma.employee.groupBy({
      by: ['unitId'],
      where: { deletedAt: null, employmentState: 'ACTIVE' },
      _count: { id: true },
    });

    const units = await prisma.unit.findMany({ select: { id: true, name: true, code: true } });
    const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));

    const unitStats = unitHeadcount.map((h) => ({
      unit: h.unitId ? unitMap[h.unitId] : { name: 'Unassigned', code: 'N/A' },
      count: h._count.id,
    }));

    // Leave distribution this month
    const leaveDist = await prisma.leaveRequest.groupBy({
      by: ['leaveType'],
      where: {
        startDate: { gte: thisMonth },
        status: { in: ['APPROVED', 'PENDING'] }
      },
      _count: { leaveType: true }
    });
    const leaveTypeData = leaveDist.map(l => ({ name: l.leaveType, value: l._count.leaveType }));

    // ── 6-month attendance trend ─────────────────────────────────────────────
    // Each month is computed from that month's OWN attendance facts. The previous
    // implementation assigned the same single 30-day rate to all six months.
    // Months with no imported records report rate: null and are shown as "no data"
    // rather than as 100%.
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const trendRecords = await prisma.attendanceRecord.findMany({
      where: { date: { gte: trendStart, lte: today }, employee: ACTIVE_WORKFORCE_EMPLOYEE_RELATION },
      select: { date: true, status: true },
    });

    // Counts per calendar month (business dates), then the shared rule.
    const monthlyCounts = new Map<string, Record<string, number>>();
    for (const record of trendRecords) {
      const key = businessDateKey(record.date).slice(0, 7);
      const counts = monthlyCounts.get(key) ?? {};
      counts[String(record.status)] = (counts[String(record.status)] ?? 0) + 1;
      monthlyCounts.set(key, counts);
    }

    const attendanceTrend = Array.from({ length: 6 }).map((_, i) => {
      const m = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const counts = monthlyCounts.get(key) ?? {};
      const r = attendanceRateFromCounts(counts);
      return {
        month: months[m.getMonth()],
        year: m.getFullYear(),
        rate: r.attendanceRate,
        recordCount: Object.values(counts).reduce((a, b) => a + b, 0),
        // The numbers behind the rate, for the chart's breakdown.
        presentCount: counts.PRESENT ?? 0,
        lateCount: counts.LATE ?? 0,
        halfDayCount: counts.HALF_DAY ?? 0,
        absentCount: counts.ABSENT ?? 0,
        otherRecordedCount: r.otherRecorded,
      };
    });

    return {
      totalEmployees,
      presentToday,
      onLeaveToday,
      // Absent counts ONLY employees with a stored ABSENT record for today.
      // It is NEVER derived from "everyone without a PRESENT record" — a missing
      // record means the attendance data has not been imported, not that the
      // employee was absent (see AttendanceService.getTally).
      absentToday,
      // Employees with no attendance record at all for today. Reported separately
      // and deliberately never folded into `absentToday`.
      noRecordToday: Math.max(0, totalEmployees - recordedTodayCount),
      newThisMonth,
      attendanceRate,
      pendingLeaves,
      upcomingTrainings,
      recentAnnouncements,
      unitStats,
      leaveTypeData,
      attendanceTrend,
      aiInsights,
      recentActivity,
    };
  }

  /**
   * Employee/Supervisor self-dashboard stats
   */
  static async getEmployeeStats(employeeId: string, permissionTier: PermissionTier) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const monthStart = new Date(year, today.getMonth(), 1);
    const now = new Date();

    // Automatic (completed-years) balances are brought up to date first.
    await LeaveEntitlementService.syncEmployee(employeeId);

    const [
      myAttendanceThisMonth,
      myLeaveBalances,
      myUpcomingTrainings,
      myAnnouncements,
    ] = await Promise.all([
      // Attendance facts this month
      prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { employeeId, date: { gte: monthStart, lte: today } },
        _count: { status: true },
      }),

      // Leave balances this year (automatic entitlement or HR's manual allotment)
      prisma.leaveBalance
        .findMany({ where: { employeeId, year }, orderBy: { leaveType: 'asc' } })
        .then((rows) => rows.map(withLeaveBalanceFigures)),

      // Upcoming trainings this employee is enrolled in — CURRENT model.
      // This previously read the legacy TrainingAttendee table, so nothing
      // created in the live Training module ever appeared here.
      prisma.trainingParticipant.findMany({
        where: {
          employeeId,
          trainingActivity: {
            status: 'SCHEDULED',
            startDate: { gte: today },
            deletedAt: null,
          },
        },
        take: 3,
        include: {
          trainingActivity: {
            select: { id: true, title: true, startDate: true, endDate: true, venue: true, type: true },
          },
        },
        orderBy: { trainingActivity: { startDate: 'asc' } },
      }),

      // Announcements actually addressed to THIS employee (recipient snapshot),
      // not every published announcement in the organisation.
      prisma.announcementRecipient.findMany({
        where: {
          employeeId,
          announcement: {
            state: 'ACTIVE',
            publishAt: { not: null, lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        take: 5,
        orderBy: [
          { announcement: { isPinned: 'desc' } },
          { announcement: { publishAt: 'desc' } },
        ],
        select: {
          readAt: true,
          announcement: {
            select: {
              id: true,
              title: true,
              priority: true,
              publishAt: true,
              isPinned: true,
              body: true,
            },
          },
        },
      }),
    ]);

    const attendanceMap = Object.fromEntries(
      myAttendanceThisMonth.map((r) => [r.status, r._count.status])
    );

    // ── Supervisor team panels ────────────────────────────────────────────────
    // Team membership resolves through the canonical hierarchy
    // (OrgHierarchyService → Employee.immediateSupervisorId).
    let teamSummary = null;
    let teamStatus: any[] = [];
    let teamLogs: any[] = [];

    if (permissionTier === PermissionTier.SUPERVISOR) {
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(employeeId);

      if (subordinateIds.length > 0) {
        const [teamPresent, teamAbsent, teamLate, teamRecorded] = await Promise.all([
          prisma.attendanceRecord.count({
            where: { employeeId: { in: subordinateIds }, date: today, status: 'PRESENT' },
          }),
          prisma.attendanceRecord.count({
            where: { employeeId: { in: subordinateIds }, date: today, status: 'ABSENT' },
          }),
          prisma.attendanceRecord.count({
            where: { employeeId: { in: subordinateIds }, date: today, status: 'LATE' },
          }),
          prisma.attendanceRecord.count({
            where: { employeeId: { in: subordinateIds }, date: today },
          }),
        ]);

        teamSummary = {
          totalSubordinates: subordinateIds.length,
          presentToday: teamPresent,
          // Only real ABSENT records. Employees with no imported record are
          // reported separately and never counted as absent.
          absentToday: teamAbsent,
          lateToday: teamLate,
          noRecordToday: Math.max(0, subordinateIds.length - teamRecorded),
        };

        teamStatus = await prisma.employee.findMany({
          where: { id: { in: subordinateIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobRole: { select: { title: true } },
            attendanceRecords: {
              where: { date: today },
              select: { status: true, timeIn: true },
            },
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });

        teamLogs = await prisma.attendanceLog.findMany({
          where: { employeeId: { in: subordinateIds }, acknowledgedAt: null },
          include: {
            employee: {
              select: { firstName: true, lastName: true, jobRole: { select: { title: true } } },
            },
          },
          orderBy: { logDate: 'desc' },
          take: 20,
        });
      }
    }

    // Only genuinely generated, unexpired AI insights.
    const aiInsights = await prisma.aIInsight
      .findMany({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [{ OR: [{ targetEmployeeId: employeeId }, { targetEmployeeId: null }] }],
        },
        take: 2,
        orderBy: { generatedAt: 'desc' },
      })
      .catch(() => []);

    // ── This employee's current weekly schedule ───────────────────────────────
    // Previously hardcoded to [] with a "until model exists" comment; the weekly
    // schedule model has existed since the dynamic-schedule work.
    let schedule: any[] = [];
    try {
      const activeSchedule = await prisma.employeeWeeklySchedule.findFirst({
        where: {
          employeeId,
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: {
          days: {
            include: { shifts: { include: { shift: true }, orderBy: { sequence: 'asc' } } },
          },
        },
      });

      schedule =
        activeSchedule?.days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          status: day.status,
          shifts: day.shifts.map((s) => ({
            id: s.shift.id,
            name: s.shift.name,
            startTime: s.shift.startTime,
            endTime: s.shift.endTime,
          })),
        })) ?? [];
    } catch (err) {
      console.error('[Dashboard] Failed to load weekly schedule:', err);
      schedule = [];
    }

    return {
      attendanceSummary: attendanceMap,
      leaveBalances: myLeaveBalances,
      upcomingTrainings: myUpcomingTrainings.map((p) => p.trainingActivity),
      announcements: myAnnouncements.map((r) => ({ ...r.announcement, readAt: r.readAt })),
      teamSummary, // null for standard employees
      aiInsights,
      teamStatus,
      teamLogs,
      schedule,
    };
  }
}
