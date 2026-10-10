import { z } from 'zod';
import { leaveBalanceFigures } from '../../../lib/leave-balance';
import { PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { businessDateKey } from '../../../lib/businessDate';
import { ComplianceService } from '../../compliance.service';
import { EVALUATION_MODE_LABEL, finalResultOf } from '../../evaluation-workflow';
import { isHr, TIER_LABEL } from '../actor/ai-actor';
import { describeDataset } from '../charts/chart-schema';
import { describeSchedule, leaveOn, loadApprovedLeave, loadHolidays, loadSchedules } from './day-context';
import { describeHolidays } from './day-context';
import { attendanceDataSpan, loadAttendanceFacts, recordKey } from '../analytics/attendance-data';
import {
  ATTENDANCE_RULES,
  AttendanceDayFact,
  AttendanceMetrics,
  computeAttendanceMetrics,
  groupByPeriod,
  PeriodGrouping,
} from '../analytics/attendance-metrics';
import {
  DateRange,
  dateKey,
  eachDayKey,
  fullName,
  humanise,
  manilaTime,
  parseRange,
  pct,
  resolveTarget,
  truncate,
  weekdayOf,
} from './tool-helpers';
import { ALL_TIERS, AiTool, AiToolError, dateArg, defineTool, employeeIdArg, ToolContext } from './tool-types';
import { profileLinkFor } from '../links/app-links';

/**
 * Person-level tools. Each takes an optional `employeeId`; omitted means the
 * person asking. Every handler resolves the target through `resolveTarget`,
 * which applies the assistant's access rule before any record is read.
 *
 * Data minimisation — never returned by any tool here: date of birth, sex,
 * civil status, religion, addresses, phone numbers, personal e-mail,
 * emergency contacts, government ID numbers, licence numbers, photos, medical
 * HR notes, psychological confidential notes, document contents, and
 * free-text notes written about another person.
 */

// ── Attendance (shared with the team and HR tools) ───────────────────────────

export interface AttendanceDay {
  date: string;
  weekday: string;
  schedule: string;
  shifts: string | null;
  holiday: string | null;
  approvedLeave: string | null;
  record: null | {
    status: string;
    timeIn: string | null;
    timeOut: string | null;
    hoursWorked: number | null;
    overtimeHours: number | null;
    sessions: number | null;
    flags: string[];
    source: string;
    correctedByHr: boolean;
  };
}

/**
 * Day-by-day detail plus the deterministic metrics for each employee. All
 * figures come from `computeAttendanceMetrics` — see analytics/attendance-metrics.ts.
 */
export async function buildAttendance(employeeIds: string[], range: DateRange) {
  const loaded = await loadAttendanceFacts(employeeIds, range);
  const out = new Map<string, { days: AttendanceDay[]; summary: AttendanceMetrics }>();
  for (const employeeId of employeeIds) {
    const facts = loaded.facts.get(employeeId)!;
    const days: AttendanceDay[] = facts.map((f) => {
      const sched = describeSchedule(loaded.schedules.get(employeeId)?.get(f.date));
      const lv = leaveOn(loaded.leave, employeeId, f.date);
      const rec = loaded.records.get(recordKey(employeeId, f.date));
      return {
        date: f.date,
        weekday: weekdayOf(f.date),
        schedule: sched.status,
        shifts: sched.shifts,
        holiday: describeHolidays(loaded.holidays.get(f.date)),
        approvedLeave: lv ? humanise(lv.leaveType) : null,
        record: rec
          ? {
              status: rec.status,
              timeIn: manilaTime(rec.timeIn),
              timeOut: manilaTime(rec.timeOut),
              hoursWorked: rec.hoursWorked,
              overtimeHours: rec.overtimeHours,
              sessions: Array.isArray(rec.sessions) ? rec.sessions.length : null,
              flags: Array.isArray(rec.reviewFlags) ? (rec.reviewFlags as unknown[]).map(String).slice(0, 8) : [],
              source: rec.sourceType,
              correctedByHr: Boolean(rec.manuallyModifiedAt),
            }
          : null,
      };
    });
    out.set(employeeId, { days, summary: computeAttendanceMetrics(facts) });
  }
  return out;
}

export const ATTENDANCE_NOTES = ATTENDANCE_RULES;

/** The counts behind the two attendance percentages, for "View data". */
export const RATE_DETAILS = [
  { key: 'presenceDays', label: 'Presence days (rate numerator)' },
  { key: 'rateDenominator', label: 'Presence + recorded absent (rate total)' },
  { key: 'scheduledWorkdaysWithRecord', label: 'Scheduled workdays with a record (coverage numerator)' },
  { key: 'scheduledWorkdays', label: 'Scheduled workdays (coverage total)' },
];
export function rateDetailValues(m: AttendanceMetrics) {
  return {
    presenceDays: m.presenceDays,
    rateDenominator: m.presenceDays + m.recordedAbsentDays,
    scheduledWorkdaysWithRecord: m.scheduledWorkdaysWithRecord,
    scheduledWorkdays: m.scheduledWorkdays,
  };
}

/** Rows for a per-period dataset (rates as %, days as counts). */
export function periodRows(facts: AttendanceDayFact[], grouping: PeriodGrouping) {
  return groupByPeriod(facts, grouping).map(({ period, days }) => {
    const m = computeAttendanceMetrics(days);
    return {
      period,
      metrics: m,
      noDataImported: m.daysWithRecord === 0,
    };
  });
}

/** Registers the two standard per-period datasets: rates (line) and day counts (bar). */
export function registerPeriodDatasets(ctx: ToolContext, label: string, rows: ReturnType<typeof periodRows>, grouping: PeriodGrouping) {
  // Nothing imported in any period: a chart of empty values would only mislead.
  if (rows.every((r) => r.noDataImported)) return [];
  const unit = grouping === 'month' ? 'Month' : grouping === 'week' ? 'Week of' : 'Date';
  const rates = ctx.datasets.add({
    title: `Attendance rate and record coverage — ${label}`,
    xKey: 'period',
    xLabel: unit,
    xType: 'date',
    unit: '%',
    series: [
      { key: 'attendanceRate', label: 'Attendance rate (recorded days)' },
      { key: 'recordCoverage', label: 'Record coverage (scheduled workdays)' },
    ],
    details: RATE_DETAILS,
    rows: rows.map((r) => ({ period: r.period, attendanceRate: r.metrics.attendanceRate, recordCoverage: r.metrics.recordCoverage, ...rateDetailValues(r.metrics) })),
  });
  const counts = ctx.datasets.add({
    title: `Attendance days — ${label}`,
    xKey: 'period',
    xLabel: unit,
    xType: 'date',
    unit: 'days',
    series: [
      { key: 'presenceDays', label: 'Presence days' },
      { key: 'recordedAbsentDays', label: 'Recorded absent' },
      { key: 'scheduledWorkdaysWithoutRecord', label: 'Scheduled, no imported record' },
      { key: 'approvedLeaveDays', label: 'Approved leave' },
    ],
    rows: rows.map((r) => ({
      period: r.period,
      presenceDays: r.metrics.presenceDays,
      recordedAbsentDays: r.metrics.recordedAbsentDays,
      scheduledWorkdaysWithoutRecord: r.metrics.scheduledWorkdaysWithoutRecord,
      approvedLeaveDays: r.metrics.approvedLeaveDays,
    })),
  });
  return [describeDataset(ctx.datasets, rates), describeDataset(ctx.datasets, counts)].filter(Boolean);
}

const attendanceTool = defineTool({
  name: 'get_attendance',
  description:
    'Day-by-day attendance for one employee over a date range (default: the last 14 days up to today; at most 62 days): schedule, holiday, approved leave and the imported record (status, time in/out, hours, flags) for each day, plus the deterministic metrics (attendance rate, record coverage, day counts). Omit employeeId for the person asking. For months or trends use get_attendance_summary.',
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional(), from: dateArg.optional(), to: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string; from?: string; to?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const range = parseRange(ctx, args.from, args.to, { fromOffset: -13, toOffset: 0 }, 62);
    const person = await prisma.employee.findUnique({ where: { id: target }, select: { firstName: true, lastName: true } });
    const { days, summary } = (await buildAttendance([target], range)).get(target)!;

    const recorded = days.filter((d) => d.record);
    const hoursDataset = recorded.length
      ? ctx.datasets.add({
          title: `Daily hours — ${fullName(person)} (${range.fromKey} to ${range.toKey})`,
          xKey: 'date',
          xLabel: 'Date',
          xType: 'date',
          unit: 'hours',
          series: [
            { key: 'hoursWorked', label: 'Hours worked' },
            { key: 'overtimeHours', label: 'Overtime hours' },
          ],
          rows: recorded.map((d) => ({ date: d.date, hoursWorked: d.record!.hoursWorked, overtimeHours: d.record!.overtimeHours })),
        })
      : null;
    const statusDataset = summary.daysWithRecord === 0 ? null : ctx.datasets.add({
      title: `How the days break down — ${fullName(person)} (${range.fromKey} to ${range.toKey})`,
      xKey: 'category',
      xLabel: 'Days',
      xType: 'category',
      unit: 'days',
      series: [{ key: 'days', label: 'Days' }],
      rows: [
        { category: 'Present', days: summary.presentDays },
        { category: 'Late', days: summary.lateDays },
        { category: 'Half day', days: summary.halfDays },
        { category: 'Recorded absent', days: summary.recordedAbsentDays },
        { category: 'Other recorded status', days: summary.otherRecordedStatusDays },
        { category: 'No imported record', days: summary.noImportedRecordDays },
      ].filter((r) => r.days > 0),
    });

    return {
      data: {
        employee: { id: target, name: fullName(person), isSelf: target === ctx.actor.employeeId },
        period: { from: range.fromKey, to: range.toKey, days: range.days },
        metrics: summary,
        days,
        charts: [describeDataset(ctx.datasets, hoursDataset), describeDataset(ctx.datasets, statusDataset)].filter(Boolean),
        notes: ATTENDANCE_RULES,
      },
      rows: recorded.length,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

const attendanceSummaryTool = defineTool({
  name: 'get_attendance_summary',
  description:
    "One employee's attendance metrics per month, week or day over a period (default: the last 6 months, grouped by month; at most 366 days): attendance rate, record coverage, presence / late / half-day / recorded-absent / no-record / leave / holiday / day-off counts and hours, plus totals, and which months have no imported data at all. Use it for trends, 'last N months', 'rate', and comparisons such as August vs September. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z
    .object({
      employeeId: employeeIdArg.optional(),
      from: dateArg.optional(),
      to: dateArg.optional(),
      groupBy: z.enum(['month', 'week', 'day']).optional().describe('Default month.'),
    })
    .strict(),
  async run(ctx: ToolContext, args: { employeeId?: string; from?: string; to?: string; groupBy?: PeriodGrouping }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const grouping = args.groupBy ?? 'month';
    const range = args.from || args.to
      ? parseRange(ctx, args.from, args.to, { fromOffset: -182, toOffset: 0 }, 366)
      : parseRange(ctx, monthStartKey(ctx.today, -5), ctx.today, { fromOffset: 0, toOffset: 0 }, 366);
    if (grouping === 'day' && range.days > 62) {
      throw new AiToolError('INVALID_ARGS', 'Daily grouping covers at most 62 days; use week or month for longer periods.');
    }
    const [person, loaded, span] = await Promise.all([
      prisma.employee.findUnique({ where: { id: target }, select: { firstName: true, lastName: true } }),
      loadAttendanceFacts([target], range),
      attendanceDataSpan([target]),
    ]);
    const facts = loaded.facts.get(target)!;
    const rows = periodRows(facts, grouping);
    const label = `${fullName(person)}, ${range.fromKey} to ${range.toKey}`;

    return {
      data: {
        employee: { id: target, name: fullName(person), isSelf: target === ctx.actor.employeeId },
        period: { from: range.fromKey, to: range.toKey, days: range.days, groupedBy: grouping },
        totals: computeAttendanceMetrics(facts),
        periods: rows.map((r) => ({ period: r.period, noDataImported: r.noDataImported, ...r.metrics })),
        periodsWithNoImportedData: rows.filter((r) => r.noDataImported).map((r) => r.period),
        attendanceDataAvailable: span,
        charts: registerPeriodDatasets(ctx, label, rows, grouping),
        notes: [
          ...ATTENDANCE_RULES,
          'A period listed in periodsWithNoImportedData has no attendance records at all: show it as "no data", never as 0% attendance.',
        ],
      },
      rows: rows.length,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

/** First day of the month `offset` months from the month of `dayKey`. */
export function monthStartKey(dayKey: string, offset: number): string {
  const [y, m] = dayKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
}

// ── Profile ───────────────────────────────────────────────────────────────────

const profileTool = defineTool({
  name: 'get_employee_profile',
  description:
    "Work profile of one employee: name, employee number, job role, unit, employment status and state, hire / probation / regularization dates, immediate supervisor and reporting-line status. Never includes personal details (birth date, addresses, contacts, government IDs). Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const e = await prisma.employee.findUnique({
      where: { id: target },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        employmentState: true,
        workSchedule: true,
        hireDate: true,
        probationDate: true,
        regularizationDate: true,
        separationDate: true,
        professionalRole: true,
        biometricCode: true,
        deletedAt: true,
        supervisorAssignmentStatus: true,
        supervisorAssignmentSource: true,
        supervisorPendingReason: true,
        jobRole: { select: { title: true, permissionTier: true } },
        unit: { select: { name: true } },
        department: { select: { name: true } },
        immediateSupervisor: { select: { firstName: true, lastName: true, jobRole: { select: { title: true } } } },
        _count: { select: { directReports: { where: { deletedAt: null } } } },
      },
    });
    if (!e) return { data: { found: false } };
    const hr = isHr(ctx.actor);
    return {
      data: {
        id: e.id,
        name: fullName(e),
        employeeNumber: e.employeeNumber,
        jobRole: e.jobRole?.title ?? null,
        accessLevel: e.jobRole ? TIER_LABEL[e.jobRole.permissionTier] : null,
        unit: e.unit?.name ?? null,
        department: e.department?.name ?? null,
        professionalRole: e.professionalRole,
        employmentStatus: humanise(e.employmentStatus),
        employmentState: humanise(e.employmentState),
        archived: Boolean(e.deletedAt),
        workScheduleLabel: humanise(e.workSchedule),
        hireDate: dateKey(e.hireDate),
        probationDate: dateKey(e.probationDate),
        regularizationDate: dateKey(e.regularizationDate),
        separationDate: hr ? dateKey(e.separationDate) : undefined,
        immediateSupervisor: e.immediateSupervisor
          ? { name: fullName(e.immediateSupervisor), jobRole: e.immediateSupervisor.jobRole?.title ?? null }
          : null,
        supervisorAssignment: {
          status: e.supervisorAssignmentStatus,
          source: e.supervisorAssignmentSource,
          pendingReason: e.supervisorPendingReason,
        },
        directReportCount: e._count.directReports,
        // The timekeeping code matters only for HR's attendance import work.
        timekeepingCode: hr ? e.biometricCode : undefined,
        profileLink: profileLinkFor(ctx.actor, e.id),
      },
      rows: 1,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

// ── Schedule ──────────────────────────────────────────────────────────────────

const scheduleTool = defineTool({
  name: 'get_schedule',
  description:
    'Resolved work schedule for one employee, day by day (default: today and the next 6 days; at most 31): working / day off / not configured, the shift times, holidays and approved leave. Omit employeeId for the person asking.',
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional(), from: dateArg.optional(), to: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string; from?: string; to?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const range = parseRange(ctx, args.from, args.to, { fromOffset: 0, toOffset: 6 }, 31);
    const [schedules, holidays, leave] = await Promise.all([
      loadSchedules([target], range),
      loadHolidays(range),
      loadApprovedLeave([target], range),
    ]);
    const days = eachDayKey(range).map((day) => {
      const resolved = schedules.get(target)?.get(day);
      const sched = describeSchedule(resolved);
      const lv = leaveOn(leave, target, day);
      return {
        date: day,
        weekday: weekdayOf(day),
        status: sched.status,
        shifts: sched.shifts,
        source: resolved?.source ?? 'UNRESOLVED',
        note: resolved?.note ?? null,
        holiday: describeHolidays(holidays.get(day), true),
        approvedLeave: lv ? humanise(lv.leaveType) : null,
      };
    });
    return {
      data: {
        employeeId: target,
        isSelf: target === ctx.actor.employeeId,
        period: { from: range.fromKey, to: range.toKey },
        days,
        notes: [
          'UNCONFIGURED means no weekly schedule says whether that is a working day. It is neither a day off nor a working day.',
          'Weekly schedules are set on the employee profile (Schedule tab): HR for anyone, a supervisor for their direct reports (not their own). Employees cannot edit schedules.',
        ],
      },
      rows: days.length,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

// ── Leave ─────────────────────────────────────────────────────────────────────

const LEAVE_STATUS_MEANING: Record<string, string> = {
  PENDING: 'Filed; waiting for the supervisor to endorse it (or for HR when the employee has no supervisor)',
  FOR_REVIEW: 'Endorsed by the supervisor; waiting for HR to approve or reject',
  APPROVED: 'Approved by HR',
  REJECTED: 'Rejected by HR',
  CANCELLED: 'Cancelled by the employee',
};

const leaveRequestsTool = defineTool({
  name: 'get_leave_requests',
  description:
    "Leave requests of one employee (newest first, up to 30), with status meaning and counts. The reason is included only for the asker's own requests. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z
    .object({
      employeeId: employeeIdArg.optional(),
      status: z.enum(['PENDING', 'FOR_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
    })
    .strict(),
  async run(ctx: ToolContext, args: { employeeId?: string; status?: string; year?: number }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const self = target === ctx.actor.employeeId;
    const where: any = { employeeId: target, deletedAt: null };
    if (args.status) where.status = args.status;
    if (args.year) where.startDate = { gte: new Date(Date.UTC(args.year, 0, 1)), lte: new Date(Date.UTC(args.year, 11, 31)) };

    const [rows, grouped] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          leaveType: true,
          startDate: true,
          endDate: true,
          totalDays: true,
          status: true,
          reason: true,
          rejectionReason: true,
          createdAt: true,
          approvedAt: true,
        },
      }),
      prisma.leaveRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);

    return {
      data: {
        employeeId: target,
        isSelf: self,
        countsByStatus: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
        chart: describeDataset(
          ctx.datasets,
          ctx.datasets.add({
            title: `Leave requests by status${args.year ? ` (${args.year})` : ''}`,
            xKey: 'status',
            xLabel: 'Status',
            xType: 'category',
            unit: 'requests',
            series: [{ key: 'requests', label: 'Requests' }],
            rows: grouped.map((g) => ({ status: humanise(g.status), requests: g._count._all })),
          })
        ),
        statusMeaning: LEAVE_STATUS_MEANING,
        requests: rows.map((r) => ({
          type: humanise(r.leaveType),
          from: dateKey(r.startDate),
          to: dateKey(r.endDate),
          days: r.totalDays,
          status: r.status,
          filedOn: dateKey(r.createdAt),
          decidedOn: dateKey(r.approvedAt),
          reason: self ? truncate(r.reason, 200) : undefined,
          rejectionReason: self || isHr(ctx.actor) ? truncate(r.rejectionReason, 200) : undefined,
        })),
        notes: ['Leave days are counted as calendar days from start to end, weekends and holidays included, because the chargeable-day policy has not been confirmed.'],
      },
      rows: rows.length,
      targetEmployeeId: self ? undefined : target,
    };
  },
});

const leaveBalancesTool = defineTool({
  name: 'get_leave_balances',
  description:
    "Leave balances for one employee for a year (default: this year): allotted, used, pending, forfeited and available per leave type, computed deterministically. Only the employee themselves or HR may see balances. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional(), year: z.number().int().min(2000).max(2100).optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string; year?: number }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SELF_OR_HR');
    const year = args.year ?? Number(ctx.today.slice(0, 4));
    const rows = await prisma.leaveBalance.findMany({
      where: { employeeId: target, year },
      orderBy: { leaveType: 'asc' },
      select: { leaveType: true, totalAllotted: true, used: true, pending: true, forfeited: true },
    });
    const balances = rows.map((b) => ({
      leaveType: humanise(b.leaveType),
      allotted: b.totalAllotted,
      used: b.used,
      pending: b.pending,
      forfeited: b.forfeited,
      available: leaveBalanceFigures(b).available,
    }));
    const dataset = ctx.datasets.add({
      title: `Leave balances ${year}`,
      xKey: 'leaveType',
      xLabel: 'Leave type',
      xType: 'category',
      unit: 'days',
      series: [
        { key: 'used', label: 'Used' },
        { key: 'pending', label: 'Pending' },
        { key: 'available', label: 'Available' },
      ],
      rows: balances.map((b) => ({ leaveType: b.leaveType, used: b.used, pending: b.pending, available: b.available })),
    });
    return {
      data: {
        employeeId: target,
        isSelf: target === ctx.actor.employeeId,
        year,
        balances,
        hasBalances: balances.length > 0,
        chart: describeDataset(ctx.datasets, dataset),
        notes: [
          'available = allotted − used − pending − forfeited (the Leave Balance panel). Days in pending requests are reserved until HR decides.',
          'If there are no balances for the year, HR has not set them up yet — do not assume a number.',
        ],
      },
      rows: balances.length,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

// ── Training ──────────────────────────────────────────────────────────────────

const trainingTool = defineTool({
  name: 'get_training_history',
  description:
    "Training and seminars one employee was assigned to: title, type, dates, hours, activity status and their participation status (assigned / completed / did not attend / excused / cancelled), with counts. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const self = target === ctx.actor.employeeId;
    const rows = await prisma.trainingParticipant.findMany({
      where: { employeeId: target, trainingActivity: { deletedAt: null } },
      orderBy: { trainingActivity: { startDate: 'desc' } },
      take: 40,
      select: {
        participationStatus: true,
        completedAt: true,
        validUntil: true,
        notes: true,
        certificateStoredFilename: true,
        trainingActivity: {
          select: {
            title: true,
            type: true,
            provider: true,
            startDate: true,
            endDate: true,
            hoursCredit: true,
            status: true,
            complianceRequirement: { select: { title: true } },
          },
        },
      },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.participationStatus] = (counts[r.participationStatus] ?? 0) + 1;
    const completedHours = rows
      .filter((r) => r.participationStatus === 'COMPLETED')
      .reduce((n, r) => n + (r.trainingActivity.hoursCredit ?? 0), 0);

    return {
      data: {
        employeeId: target,
        isSelf: self,
        countsByParticipation: counts,
        chart: describeDataset(
          ctx.datasets,
          ctx.datasets.add({
            title: 'Training by participation status',
            xKey: 'status',
            xLabel: 'Participation',
            xType: 'category',
            unit: 'activities',
            series: [{ key: 'activities', label: 'Activities' }],
            rows: Object.entries(counts).map(([status, activities]) => ({ status: humanise(status), activities })),
          })
        ),
        completedHours,
        activities: rows.map((r) => ({
          title: r.trainingActivity.title,
          type: humanise(r.trainingActivity.type),
          provider: r.trainingActivity.provider,
          from: dateKey(r.trainingActivity.startDate),
          to: dateKey(r.trainingActivity.endDate),
          hours: r.trainingActivity.hoursCredit,
          activityStatus: r.trainingActivity.status,
          participation: r.participationStatus,
          completedOn: dateKey(r.completedAt),
          validUntil: dateKey(r.validUntil),
          hasCertificate: Boolean(r.certificateStoredFilename),
          satisfiesRequirement: r.trainingActivity.complianceRequirement?.title ?? null,
          notes: self ? truncate(r.notes, 200) : undefined,
        })),
      },
      rows: rows.length,
      targetEmployeeId: self ? undefined : target,
    };
  },
});

// ── Evaluations ───────────────────────────────────────────────────────────────

const evaluationsTool = defineTool({
  name: 'get_evaluations',
  description:
    "Performance evaluations. For the person asking: evaluations of them that HR has finalized and made visible, plus evaluations they must complete as an evaluator (with status and due date). HR may pass employeeId to see another employee's evaluation statuses and finalized results. `finalResult` is the employee's FINAL result: for a Standard Evaluation the head's overall score; for a Weighted Multi-Rater Evaluation the 20/20/60 weighted result (self 20% + peer 20% + head 60%) — report that figure, never the head's own score. Evaluator comments are never returned.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SELF_OR_HR');
    const self = target === ctx.actor.employeeId;
    const hr = isHr(ctx.actor);

    // As the subject: the same visibility rule as the Evaluations page.
    // The employee's evaluation of record is the head / supervisor / coordinator
    // evaluation (self and peer ratings are separate components, HR-only).
    const subjectWhere: any = { employeeId: target, deletedAt: null, raterType: 'HEAD' };
    if (!hr) {
      subjectWhere.status = 'FINALIZED';
      subjectWhere.isEmployeeVisible = true;
    }
    const [asSubject, asEvaluator] = await Promise.all([
      prisma.evaluationAssignment.findMany({
        where: subjectWhere,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          status: true,
          dueDate: true,
          finalizedAt: true,
          overallRating: true,
          overallScore: true,
          combinedScore: true,
          combinedBreakdown: true,
          templateSnapshot: true,
          isEmployeeVisible: true,
          cycle: { select: { name: true, status: true, evaluationMode: true } },
          evaluator: { select: { firstName: true, lastName: true } },
        },
      }),
      self
        ? prisma.evaluationAssignment.findMany({
            where: { evaluatorId: target, deletedAt: null, cycle: { deletedAt: null } },
            orderBy: { dueDate: 'asc' },
            take: 40,
            select: {
              status: true,
              dueDate: true,
              raterType: true,
              cycle: { select: { name: true, status: true } },
              employee: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const todayMs = new Date(`${ctx.today}T00:00:00Z`).getTime();
    return {
      data: {
        employeeId: target,
        isSelf: self,
        evaluationsOfThisEmployee: asSubject.map((a) => ({
          cycle: a.cycle.name,
          cycleStatus: a.cycle.status,
          evaluationType: EVALUATION_MODE_LABEL[a.cycle.evaluationMode],
          status: a.status,
          dueDate: dateKey(a.dueDate),
          finalizedOn: dateKey(a.finalizedAt),
          overallRating: a.status === 'FINALIZED' ? a.overallRating : null,
          // The final result (Standard: head score; Weighted: 20/20/60) — never the head's score alone.
          finalResult: finalResultOf(a, a.cycle.evaluationMode),
          visibleToEmployee: hr ? a.isEmployeeVisible : undefined,
          evaluator: hr ? fullName(a.evaluator as any) : undefined,
        })),
        evaluationsToCompleteByStatus: describeDataset(
          ctx.datasets,
          ctx.datasets.add({
            title: 'Evaluations assigned to you, by status',
            xKey: 'status',
            xLabel: 'Status',
            xType: 'category',
            unit: 'evaluations',
            series: [{ key: 'evaluations', label: 'Evaluations' }],
            rows: Object.entries(
              (asEvaluator as any[]).reduce<Record<string, number>>((acc, a) => ((acc[humanise(a.status)] = (acc[humanise(a.status)] ?? 0) + 1), acc), {})
            ).map(([status, evaluations]) => ({ status, evaluations })),
          })
        ),
        evaluationsToComplete: asEvaluator.map((a: any) => ({
          subject: fullName(a.employee),
          kind: a.raterType === 'SELF' ? 'Self rating' : a.raterType === 'PEER' ? 'Peer evaluation' : 'Head / supervisor / coordinator evaluation',
          cycle: a.cycle.name,
          status: a.status,
          dueDate: dateKey(a.dueDate),
          overdue: ['NOT_STARTED', 'IN_PROGRESS'].includes(a.status) && a.dueDate.getTime() < todayMs,
        })),
        notes: hr
          ? []
          : ['An employee sees their own evaluation only after HR finalizes it AND makes it visible. An empty list does not mean no evaluation exists.'],
      },
      rows: asSubject.length + asEvaluator.length,
      targetEmployeeId: self ? undefined : target,
    };
  },
});

// ── Compliance ────────────────────────────────────────────────────────────────

const HEALTH_CATEGORIES = new Set(['MEDICAL', 'PSYCHOLOGICAL']);

const complianceTool = defineTool({
  name: 'get_compliance_status',
  description:
    "Compliance requirements that apply to one employee and the derived status of each (VALID, MISSING, NEEDS_REVIEW, EXPIRING_SOON, EXPIRED), with expiry dates and days until expiry. Supervisors viewing a team member do not see medical or psychological requirements. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SCOPED');
    const self = target === ctx.actor.employeeId;
    const hideHealth = !self && ctx.actor.tier === PermissionTier.SUPERVISOR;
    const all = await ComplianceService.getEmployeeComplianceSummary(target);
    const items = all.filter((i: any) => !(hideHealth && HEALTH_CATEGORIES.has(i.requirement.category)));
    const todayMs = new Date(`${ctx.today}T00:00:00Z`).getTime();

    const results = items.map((i: any) => ({
      requirement: i.requirement.title,
      category: humanise(i.requirement.category),
      status: i.status,
      tracksExpiry: i.requirement.tracksExpiry,
      lastRecordDate: dateKey(i.latestRecordDate),
      expiresOn: dateKey(i.expiresAt),
      daysUntilExpiry: i.expiresAt ? Math.round((new Date(i.expiresAt).getTime() - todayMs) / 86_400_000) : null,
    }));
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;

    return {
      data: {
        employeeId: target,
        isSelf: self,
        countsByStatus: counts,
        chart: describeDataset(
          ctx.datasets,
          ctx.datasets.add({
            title: 'Compliance requirements by status',
            xKey: 'status',
            xLabel: 'Status',
            xType: 'category',
            unit: 'requirements',
            series: [{ key: 'requirements', label: 'Requirements' }],
            rows: Object.entries(counts).map(([status, requirements]) => ({ status: humanise(status), requirements })),
          })
        ),
        requirements: results,
        hiddenHealthRequirements: hideHealth ? all.length - items.length : undefined,
        statusMeaning: {
          VALID: 'An accepted record is on file and not expired',
          MISSING: 'No record has been submitted for this requirement',
          NEEDS_REVIEW: 'A record exists but HR has not accepted it yet, or HR asked for a correction',
          EXPIRING_SOON: "The record expires within the requirement's reminder window",
          EXPIRED: 'The latest record has passed its expiry date',
        },
      },
      rows: results.length,
      targetEmployeeId: self ? undefined : target,
    };
  },
});

// ── Medical and psychological (strictly limited) ─────────────────────────────

const medicalTool = defineTool({
  name: 'get_medical_records',
  description:
    "Medical exam records of one employee — exam type, exam date, expiry and review status only. HR notes and documents are never included. Only the employee themselves or HR. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SELF_OR_HR');
    const rows = await prisma.medicalRecord.findMany({
      where: { employeeId: target, deletedAt: null },
      orderBy: { examDate: 'desc' },
      take: 20,
      select: { examType: true, examDate: true, expiresAt: true, reviewStatus: true, requirement: { select: { title: true } } },
    });
    return {
      data: {
        employeeId: target,
        isSelf: target === ctx.actor.employeeId,
        records: rows.map((r) => ({
          examType: humanise(r.examType),
          examDate: dateKey(r.examDate),
          expiresOn: dateKey(r.expiresAt),
          reviewStatus: r.reviewStatus,
          forRequirement: r.requirement?.title ?? null,
        })),
        notes: ['Medical HR notes and documents are confidential and are never given to the AI assistant. Open the record in HRISense to see documents you are allowed to view.'],
      },
      rows: rows.length,
      targetEmployeeId: target === ctx.actor.employeeId ? undefined : target,
    };
  },
});

const psychologicalTool = defineTool({
  name: 'get_psychological_records',
  description:
    "Psychological assessment records of one employee — type, date, expiry and review status. The employee themselves also gets the summary HR marked as visible to them. Confidential HR notes are never included. Only the employee themselves or HR. Omit employeeId for the person asking.",
  tiers: ALL_TIERS,
  args: z.object({ employeeId: employeeIdArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { employeeId?: string }) {
    const target = await resolveTarget(ctx, args.employeeId, 'SELF_OR_HR');
    const self = target === ctx.actor.employeeId;
    const rows = await prisma.psychologicalRecord.findMany({
      where: { employeeId: target, deletedAt: null },
      orderBy: { assessmentDate: 'desc' },
      take: 20,
      select: {
        assessmentType: true,
        assessmentDate: true,
        expiresAt: true,
        reviewStatus: true,
        // Selected ONLY for the employee's own view; see below.
        employeeVisibleSummary: self,
        requirement: { select: { title: true } },
      },
    });
    return {
      data: {
        employeeId: target,
        isSelf: self,
        records: rows.map((r: any) => ({
          assessmentType: humanise(r.assessmentType),
          assessmentDate: dateKey(r.assessmentDate),
          expiresOn: dateKey(r.expiresAt),
          reviewStatus: r.reviewStatus,
          forRequirement: r.requirement?.title ?? null,
          summaryForEmployee: self ? truncate(r.employeeVisibleSummary, 600) : undefined,
        })),
        notes: self
          ? ['Only the summary HR made visible to the employee is shown. Confidential HR notes are never available to the assistant.']
          : ['For privacy, assessment summaries and confidential notes are not given to the AI assistant. Open the record in HRISense (Psychological) to review it.'],
      },
      rows: rows.length,
      targetEmployeeId: self ? undefined : target,
    };
  },
});

export const PERSON_TOOLS: AiTool[] = [
  profileTool,
  attendanceTool,
  attendanceSummaryTool,
  scheduleTool,
  leaveRequestsTool,
  leaveBalancesTool,
  trainingTool,
  evaluationsTool,
  complianceTool,
  medicalTool,
  psychologicalTool,
];
