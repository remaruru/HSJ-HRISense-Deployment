import { z } from 'zod';
import { PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ComplianceService } from '../../compliance.service';
import { describeDataset } from '../charts/chart-schema';
import { ATTENDANCE_NOTES, monthStartKey, periodRows, RATE_DETAILS, rateDetailValues, registerPeriodDatasets } from './person.tools';
import { attendanceDataSpan, loadAttendanceFacts } from '../analytics/attendance-data';
import { ATTENDANCE_RULES, computeAttendanceMetrics, PeriodGrouping, sumMetrics } from '../analytics/attendance-metrics';
import { describeSchedule, leaveOn, loadApprovedLeave, loadHolidays, loadSchedules } from './day-context';
import { describeHolidays } from './day-context';
import { dateKey, eachDayKey, fullName, humanise, manilaTime, parseRange, pct, teamIds, weekdayOf } from './tool-helpers';
import { ALL_TIERS, AiTool, AiToolError, dateArg, defineTool, TEAM_TIERS, ToolContext } from './tool-types';

/**
 * Team tools. "Team" is ALWAYS the asker's direct reports — employees whose
 * `immediateSupervisorId` is the asker — read from the database for this
 * request. Colleagues in the same unit are not a team. There is no argument to
 * widen it.
 */

const HEALTH = new Set(['MEDICAL', 'PSYCHOLOGICAL']);

async function loadTeam(ctx: ToolContext) {
  const ids = teamIds(ctx);
  if (!ids.length) return [];
  return prisma.employee.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      employmentState: true,
      jobRole: { select: { title: true } },
      unit: { select: { name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

const EMPTY_TEAM = {
  data: {
    teamSize: 0,
    message: 'No employees currently report directly to this person in HRISense (nobody has them as immediate supervisor).',
  },
  rows: 0,
};

const teamOverviewTool = defineTool({
  name: 'get_team_overview',
  description:
    "The asker's direct reports and how each stands on one day (default today): schedule, imported attendance record, approved leave, pending leave requests and compliance items needing attention, with team totals and a chart dataset. Use for 'who is working / in today', 'my team today'.",
  tiers: TEAM_TIERS,
  args: z.object({ date: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { date?: string }) {
    const team = await loadTeam(ctx);
    if (!team.length) return EMPTY_TEAM;
    const ids = team.map((t) => t.id);
    const range = parseRange(ctx, args.date ?? ctx.today, args.date ?? ctx.today, { fromOffset: 0, toOffset: 0 }, 1);
    const day = range.fromKey;
    const hideHealth = ctx.actor.tier === PermissionTier.SUPERVISOR;

    const [schedules, holidays, leave, records, pending, compliance] = await Promise.all([
      loadSchedules(ids, range),
      loadHolidays(range),
      loadApprovedLeave(ids, range),
      prisma.attendanceRecord.findMany({
        where: { employeeId: { in: ids }, date: range.from },
        select: { employeeId: true, status: true, timeIn: true, timeOut: true },
      }),
      prisma.leaveRequest.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: ids }, deletedAt: null, status: { in: ['PENDING', 'FOR_REVIEW'] } },
        _count: { _all: true },
      }),
      Promise.all(ids.map((id) => ComplianceService.getEmployeeComplianceSummary(id))),
    ]);
    const recordBy = new Map(records.map((r) => [r.employeeId, r]));
    const pendingBy = new Map(pending.map((p) => [p.employeeId, p._count._all]));
    const holiday = describeHolidays(holidays.get(day));

    const totals = { scheduledWorking: 0, withRecord: 0, onApprovedLeave: 0, dayOff: 0, scheduleNotConfigured: 0, scheduledButNoRecord: 0 };
    const members = team.map((m, i) => {
      const sched = describeSchedule(schedules.get(m.id)?.get(day));
      const rec = recordBy.get(m.id);
      const lv = leaveOn(leave, m.id, day);
      if (sched.status === 'WORKING') totals.scheduledWorking++;
      if (sched.status === 'DAY_OFF') totals.dayOff++;
      if (sched.status === 'UNCONFIGURED') totals.scheduleNotConfigured++;
      if (rec) totals.withRecord++;
      if (lv) totals.onApprovedLeave++;
      if (!rec && !lv && sched.status === 'WORKING' && !holiday) totals.scheduledButNoRecord++;
      const items = (compliance[i] as any[]).filter((c) => c.status !== 'VALID' && !(hideHealth && HEALTH.has(c.requirement.category)));
      return {
        id: m.id,
        name: fullName(m),
        employeeNumber: m.employeeNumber,
        jobRole: m.jobRole?.title ?? null,
        employmentState: humanise(m.employmentState),
        schedule: sched.status,
        shifts: sched.shifts,
        approvedLeave: lv ? humanise(lv.leaveType) : null,
        record: rec ? { status: rec.status, timeIn: manilaTime(rec.timeIn), timeOut: manilaTime(rec.timeOut) } : null,
        pendingLeaveRequests: pendingBy.get(m.id) ?? 0,
        complianceNeedingAttention: items.length,
      };
    });

    const dataset = ctx.datasets.add({
      title: `Team on ${day}`,
      xKey: 'category',
      xLabel: 'Status',
      xType: 'category',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: [
        { category: 'Has a record', employees: totals.withRecord },
        { category: 'On approved leave', employees: totals.onApprovedLeave },
        { category: 'Day off', employees: totals.dayOff },
        { category: 'Scheduled, no record yet', employees: totals.scheduledButNoRecord },
        { category: 'Schedule not configured', employees: totals.scheduleNotConfigured },
      ].filter((r) => r.employees > 0),
    });

    return {
      data: {
        date: day,
        weekday: weekdayOf(day),
        holiday,
        teamSize: team.length,
        totals,
        members,
        chart: describeDataset(ctx.datasets, dataset),
        notes: [
          '"Scheduled, no record yet" means no attendance has been imported for that person and day. It is NOT an absence.',
          ...(hideHealth ? ['Medical and psychological requirements are not counted for supervisors.'] : []),
        ],
      },
      rows: members.length,
    };
  },
});

const teamAttendanceTool = defineTool({
  name: 'get_team_attendance',
  description:
    "Attendance analytics for the asker's direct reports over a period (default: this month to date; at most 366 days). groupBy 'member' (default) compares each direct report — attendance rate, record coverage, presence / recorded-absent / no-record / leave days, hours; groupBy 'month', 'week' or 'day' gives the team trend over time. Chart datasets included. Only direct reports are ever included.",
  tiers: TEAM_TIERS,
  args: z
    .object({
      from: dateArg.optional(),
      to: dateArg.optional(),
      groupBy: z.enum(['member', 'month', 'week', 'day']).optional().describe('Default member.'),
    })
    .strict(),
  async run(ctx: ToolContext, args: { from?: string; to?: string; groupBy?: 'member' | PeriodGrouping }) {
    const team = await loadTeam(ctx);
    if (!team.length) return EMPTY_TEAM;
    const grouping = args.groupBy ?? 'member';
    const range = args.from || args.to
      ? parseRange(ctx, args.from, args.to, { fromOffset: -29, toOffset: 0 }, 366)
      : parseRange(ctx, monthStartKey(ctx.today, 0), ctx.today, { fromOffset: 0, toOffset: 0 }, 366);
    if (grouping === 'day' && range.days > 62) {
      throw new AiToolError('INVALID_ARGS', 'Daily grouping covers at most 62 days; use week or month for longer periods.');
    }
    const loaded = await loadAttendanceFacts(team.map((t) => t.id), range);
    const perMember = team.map((m) => ({ id: m.id, name: fullName(m) ?? '—', metrics: computeAttendanceMetrics(loaded.facts.get(m.id)!) }));
    const totals = sumMetrics(perMember.map((p) => p.metrics));
    const label = `your direct reports, ${range.fromKey} to ${range.toKey}`;

    if (grouping === 'member') {
      const rates = ctx.datasets.add({
        title: `Attendance rate and record coverage by team member (${range.fromKey} to ${range.toKey})`,
        xKey: 'name',
        xLabel: 'Team member',
        xType: 'category',
        unit: '%',
        series: [
          { key: 'attendanceRate', label: 'Attendance rate (recorded days)' },
          { key: 'recordCoverage', label: 'Record coverage (scheduled workdays)' },
        ],
        details: RATE_DETAILS,
        rows: perMember.map((p) => ({ name: p.name, attendanceRate: p.metrics.attendanceRate, recordCoverage: p.metrics.recordCoverage, ...rateDetailValues(p.metrics) })),
      });
      const days = ctx.datasets.add({
        title: `Attendance days by team member (${range.fromKey} to ${range.toKey})`,
        xKey: 'name',
        xLabel: 'Team member',
        xType: 'category',
        unit: 'days',
        series: [
          { key: 'presenceDays', label: 'Presence days' },
          { key: 'recordedAbsentDays', label: 'Recorded absent' },
          { key: 'noImportedRecordDays', label: 'No imported record' },
          { key: 'approvedLeaveDays', label: 'Approved leave' },
        ],
        rows: perMember.map((p) => ({
          name: p.name,
          presenceDays: p.metrics.presenceDays,
          recordedAbsentDays: p.metrics.recordedAbsentDays,
          noImportedRecordDays: p.metrics.noImportedRecordDays,
          approvedLeaveDays: p.metrics.approvedLeaveDays,
        })),
      });
      return {
        data: {
          period: { from: range.fromKey, to: range.toKey, days: range.days },
          teamSize: team.length,
          totals,
          members: perMember,
          charts: [describeDataset(ctx.datasets, rates), describeDataset(ctx.datasets, days)].filter(Boolean),
          notes: ATTENDANCE_RULES,
        },
        rows: perMember.length,
      };
    }

    // Team trend: every member's days, grouped by period.
    const allFacts = team.flatMap((m) => loaded.facts.get(m.id)!);
    const rows = periodRows(allFacts, grouping);
    return {
      data: {
        period: { from: range.fromKey, to: range.toKey, days: range.days, groupedBy: grouping },
        teamSize: team.length,
        totals,
        periods: rows.map((r) => ({ period: r.period, noDataImported: r.noDataImported, ...r.metrics })),
        periodsWithNoImportedData: rows.filter((r) => r.noDataImported).map((r) => r.period),
        attendanceDataAvailable: await attendanceDataSpan(team.map((t) => t.id)),
        charts: registerPeriodDatasets(ctx, label, rows, grouping),
        notes: ATTENDANCE_RULES,
      },
      rows: rows.length,
    };
  },
});

const teamLeaveTool = defineTool({
  name: 'get_team_leave',
  description:
    "Leave requests of the asker's direct reports (up to 40): by default those still waiting (PENDING = awaiting the supervisor's endorsement, FOR_REVIEW = awaiting HR) and approved leave from 30 days ago onward. Reasons are not included; open Leave Requests to read them.",
  tiers: TEAM_TIERS,
  args: z
    .object({
      status: z.enum(['PENDING', 'FOR_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
      from: dateArg.optional(),
      to: dateArg.optional(),
    })
    .strict(),
  async run(ctx: ToolContext, args: { status?: string; from?: string; to?: string }) {
    const ids = teamIds(ctx);
    if (!ids.length) return EMPTY_TEAM;
    const where: any = { employeeId: { in: ids }, deletedAt: null };
    if (args.status) where.status = args.status;
    if (args.from || args.to) {
      const range = parseRange(ctx, args.from, args.to, { fromOffset: -30, toOffset: 60 }, 366);
      where.startDate = { lte: range.to };
      where.endDate = { gte: range.from };
    } else if (!args.status) {
      const range = parseRange(ctx, undefined, undefined, { fromOffset: -30, toOffset: 0 }, 366);
      where.OR = [{ status: { in: ['PENDING', 'FOR_REVIEW'] } }, { status: 'APPROVED', endDate: { gte: range.from } }];
    }
    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy: [{ startDate: 'asc' }],
      take: 40,
      select: {
        leaveType: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        status: true,
        createdAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const byStatus = ctx.datasets.add({
      title: "Your team's leave requests by status",
      xKey: 'status',
      xLabel: 'Status',
      xType: 'category',
      unit: 'requests',
      series: [{ key: 'requests', label: 'Requests' }],
      rows: Object.entries(counts).map(([status, requests]) => ({ status: humanise(status), requests })),
    });
    const daysByType: Record<string, number> = {};
    for (const r of rows) daysByType[humanise(r.leaveType)] = (daysByType[humanise(r.leaveType)] ?? 0) + r.totalDays;
    const byType = ctx.datasets.add({
      title: "Your team's leave days by type (requests listed)",
      xKey: 'type',
      xLabel: 'Leave type',
      xType: 'category',
      unit: 'days',
      series: [{ key: 'days', label: 'Days' }],
      rows: Object.entries(daysByType).map(([type, days]) => ({ type, days })),
    });
    return {
      data: {
        teamSize: ids.length,
        countsByStatus: counts,
        charts: [describeDataset(ctx.datasets, byStatus), describeDataset(ctx.datasets, byType)].filter(Boolean),
        awaitingYourEndorsement: rows.filter((r) => r.status === 'PENDING').length,
        requests: rows.map((r) => ({
          employee: fullName(r.employee),
          employeeId: r.employee.id,
          type: humanise(r.leaveType),
          from: dateKey(r.startDate),
          to: dateKey(r.endDate),
          days: r.totalDays,
          status: r.status,
          filedOn: dateKey(r.createdAt),
        })),
        notes: ['A supervisor endorses (recommends) a PENDING request to HR; only HR approves or rejects. The assistant cannot endorse, approve or reject anything.'],
      },
      rows: rows.length,
    };
  },
});

const teamSchedulesTool = defineTool({
  name: 'get_team_schedules',
  description:
    "Work schedules of the asker's direct reports, day by day (default: today and the next 6 days; at most 14): working with shift times, day off, or not configured, plus holidays and approved leave.",
  tiers: TEAM_TIERS,
  args: z.object({ from: dateArg.optional(), to: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { from?: string; to?: string }) {
    const team = await loadTeam(ctx);
    if (!team.length) return EMPTY_TEAM;
    const ids = team.map((t) => t.id);
    const range = parseRange(ctx, args.from, args.to, { fromOffset: 0, toOffset: 6 }, 14);
    const [schedules, holidays, leave] = await Promise.all([loadSchedules(ids, range), loadHolidays(range), loadApprovedLeave(ids, range)]);
    const days = eachDayKey(range);
    let unconfigured = 0;
    const members = team.map((m) => ({
      name: fullName(m),
      days: days.map((day) => {
        const s = describeSchedule(schedules.get(m.id)?.get(day));
        if (s.status === 'UNCONFIGURED') unconfigured++;
        const lv = leaveOn(leave, m.id, day);
        return { date: day, status: s.status, shifts: s.shifts, approvedLeave: lv ? humanise(lv.leaveType) : null };
      }),
    }));
    const perDay = ctx.datasets.add({
      title: `Team schedule by day (${range.fromKey} to ${range.toKey})`,
      xKey: 'date',
      xLabel: 'Date',
      xType: 'date',
      unit: 'employees',
      series: [
        { key: 'working', label: 'Working' },
        { key: 'dayOff', label: 'Day off' },
        { key: 'onLeave', label: 'On approved leave' },
        { key: 'notConfigured', label: 'Not configured' },
      ],
      rows: days.map((day, i) => ({
        date: day,
        working: members.filter((m) => m.days[i].status === 'WORKING' && !m.days[i].approvedLeave).length,
        dayOff: members.filter((m) => m.days[i].status === 'DAY_OFF').length,
        onLeave: members.filter((m) => m.days[i].approvedLeave).length,
        notConfigured: members.filter((m) => m.days[i].status === 'UNCONFIGURED').length,
      })),
    });
    return {
      data: {
        period: { from: range.fromKey, to: range.toKey },
        holidays: days.filter((d) => holidays.has(d)).map((d) => ({ date: d, name: describeHolidays(holidays.get(d)) })),
        teamSize: team.length,
        unconfiguredEmployeeDays: unconfigured,
        chart: describeDataset(ctx.datasets, perDay),
        members,
        notes: [
          'UNCONFIGURED means no weekly schedule covers that day.',
          "A supervisor can set a direct report’s weekly schedule on their profile (Schedule tab), but not their own; HR can set anyone’s.",
        ],
      },
      rows: members.length,
    };
  },
});

const teamComplianceTool = defineTool({
  name: 'get_team_compliance',
  description:
    "Compliance standing of the asker's direct reports: per person counts by status and the items that are missing, need review, are expiring soon or expired. For supervisors, medical and psychological requirements are excluded.",
  tiers: TEAM_TIERS,
  args: z.object({}).strict(),
  async run(ctx: ToolContext) {
    const team = await loadTeam(ctx);
    if (!team.length) return EMPTY_TEAM;
    const hideHealth = ctx.actor.tier === PermissionTier.SUPERVISOR;
    const summaries = await Promise.all(team.map((m) => ComplianceService.getEmployeeComplianceSummary(m.id)));
    const totals: Record<string, number> = { VALID: 0, MISSING: 0, NEEDS_REVIEW: 0, EXPIRING_SOON: 0, EXPIRED: 0 };
    const members = team.map((m, i) => {
      const items = (summaries[i] as any[]).filter((c) => !(hideHealth && HEALTH.has(c.requirement.category)));
      const counts: Record<string, number> = {};
      for (const c of items) {
        counts[c.status] = (counts[c.status] ?? 0) + 1;
        totals[c.status] = (totals[c.status] ?? 0) + 1;
      }
      return {
        name: fullName(m),
        employeeId: m.id,
        counts,
        needingAttention: items
          .filter((c) => c.status !== 'VALID')
          .map((c) => ({ requirement: c.requirement.title, status: c.status, expiresOn: dateKey(c.expiresAt) })),
      };
    });
    const dataset = ctx.datasets.add({
      title: 'Team compliance by status',
      xKey: 'status',
      xLabel: 'Status',
      xType: 'category',
      unit: 'requirements',
      series: [{ key: 'count', label: 'Requirement checks' }],
      rows: Object.entries(totals).filter(([, n]) => n > 0).map(([status, count]) => ({ status: humanise(status), count })),
    });
    return {
      data: {
        teamSize: team.length,
        totals,
        members,
        chart: describeDataset(ctx.datasets, dataset),
        notes: hideHealth ? ['Medical and psychological requirements are confidential to the employee and HR and are not included.'] : [],
      },
      rows: members.length,
    };
  },
});

const teamTrainingTool = defineTool({
  name: 'get_team_training',
  description: "Training participation of the asker's direct reports: per person counts of assigned, completed, did-not-attend and excused, with completion rate.",
  tiers: TEAM_TIERS,
  args: z.object({}).strict(),
  async run(ctx: ToolContext) {
    const team = await loadTeam(ctx);
    if (!team.length) return EMPTY_TEAM;
    const groups = await prisma.trainingParticipant.groupBy({
      by: ['employeeId', 'participationStatus'],
      where: { employeeId: { in: team.map((t) => t.id) }, trainingActivity: { deletedAt: null } },
      _count: { _all: true },
    });
    const members = team.map((m) => {
      const mine = groups.filter((g) => g.employeeId === m.id);
      const c = (s: string) => mine.find((g) => g.participationStatus === s)?._count._all ?? 0;
      const total = mine.reduce((n, g) => n + g._count._all, 0);
      return {
        name: fullName(m),
        assigned: c('ASSIGNED'),
        completed: c('COMPLETED'),
        didNotAttend: c('DID_NOT_ATTEND'),
        excused: c('EXCUSED'),
        total,
        completionRate: pct(c('COMPLETED'), total - c('CANCELLED')),
      };
    });
    const dataset = ctx.datasets.add({
      title: 'Team training participation',
      xKey: 'name',
      xLabel: 'Team member',
      xType: 'category',
      unit: 'activities',
      series: [
        { key: 'completed', label: 'Completed' },
        { key: 'assigned', label: 'Assigned (upcoming/open)' },
        { key: 'didNotAttend', label: 'Did not attend' },
      ],
      rows: members.map((m) => ({ name: m.name ?? '—', completed: m.completed, assigned: m.assigned, didNotAttend: m.didNotAttend })),
    });
    return { data: { teamSize: team.length, members, chart: describeDataset(ctx.datasets, dataset) }, rows: members.length };
  },
});

// ── Directory search (scoped) ─────────────────────────────────────────────────

const searchEmployeesTool = defineTool({
  name: 'search_employees',
  description:
    'Find employees by name or employee number, within what the asker may see (HR: everyone; supervisor: themselves and direct reports; employee: themselves). Returns ids to pass to other tools. Returns nothing for people outside that scope.',
  tiers: ALL_TIERS,
  args: z
    .object({
      query: z.string().min(1).max(80).describe('A name, part of a name, or an employee number.'),
      includeArchived: z.boolean().optional().describe('HR only: include archived employees.'),
    })
    .strict(),
  async run(ctx: ToolContext, args: { query: string; includeArchived?: boolean }) {
    const hr = ctx.actor.tier === PermissionTier.FULL;
    const tokens = args.query
      .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4);
    if (!tokens.length) return { data: { matches: [] }, rows: 0 };

    const scope: any = hr ? {} : { id: { in: [ctx.actor.employeeId, ...teamIds(ctx)] } };
    const rows = await prisma.employee.findMany({
      where: {
        ...scope,
        ...(hr && args.includeArchived ? {} : { deletedAt: null }),
        AND: tokens.map((t) => ({
          OR: [{ firstName: { contains: t } }, { lastName: { contains: t } }, { middleName: { contains: t } }, { employeeNumber: { contains: t } }],
        })),
      },
      take: 15,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        employmentState: true,
        deletedAt: true,
        jobRole: { select: { title: true } },
        unit: { select: { name: true } },
        immediateSupervisorId: true,
      },
    });
    return {
      data: {
        scope: hr ? 'Everyone' : ctx.actor.tier === PermissionTier.SUPERVISOR ? 'You and your direct reports' : 'Only you',
        matches: rows.map((r) => ({
          id: r.id,
          name: fullName(r),
          employeeNumber: r.employeeNumber,
          jobRole: r.jobRole?.title ?? null,
          unit: r.unit?.name ?? null,
          employmentState: humanise(r.employmentState),
          archived: Boolean(r.deletedAt) || undefined,
          relation: r.id === ctx.actor.employeeId ? 'you' : r.immediateSupervisorId === ctx.actor.employeeId ? 'your direct report' : undefined,
        })),
        note: rows.length ? undefined : 'Nobody matched within the people this user may see. Do not speculate about whether such a person exists.',
      },
      rows: rows.length,
    };
  },
});

export const TEAM_TOOLS: AiTool[] = [
  searchEmployeesTool,
  teamOverviewTool,
  teamAttendanceTool,
  teamLeaveTool,
  teamSchedulesTool,
  teamComplianceTool,
  teamTrainingTool,
];
