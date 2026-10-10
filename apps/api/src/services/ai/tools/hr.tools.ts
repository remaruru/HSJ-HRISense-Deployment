import { cycleMetrics, cycleProgress, EVALUATION_MODE_LABEL } from '../../evaluation-workflow';
import { z } from 'zod';
import { prisma } from '../../../config/prisma';
import { businessDateKey } from '../../../lib/businessDate';
import { ACTIVE_WORKFORCE_EMPLOYEE_RELATION, ACTIVE_WORKFORCE_WHERE } from '../../../lib/workforceScope';
import { ComplianceService } from '../../compliance.service';
import { ReportKey, ReportService } from '../../report.service';
import { ScheduleResolverService } from '../../schedule-resolver.service';
import { WorkforceFactsService } from '../workforce-facts.service';
import { describeDataset } from '../charts/chart-schema';
import { leaveOn, loadApprovedLeave, loadHolidays } from './day-context';
import { describeHolidays } from './day-context';
import { AiToolError } from './tool-types';
import { monthStartKey, periodRows, RATE_DETAILS, rateDetailValues, registerPeriodDatasets } from './person.tools';
import { attendanceDataSpan, loadAttendanceFacts } from '../analytics/attendance-data';
import { ATTENDANCE_RULES, AttendanceMetrics, computeAttendanceMetrics, PeriodGrouping, sumMetrics } from '../analytics/attendance-metrics';
import { addDaysKey, countBy, dateKey, eachDayKey, fullName, humanise, parseRange, pct, weekdayOf } from './tool-helpers';
import { AiTool, dateArg, defineTool, HR_ONLY, ToolContext } from './tool-types';

/**
 * HR (FULL tier) organisation-wide decision support.
 *
 * Every figure is computed here, deterministically, from the same definitions
 * the rest of HRISense uses (`lib/workforceScope`, `ComplianceService`,
 * `ReportService`, the schedule resolver). The model only explains them.
 *
 * None of these tools changes anything. HRISense's AI cannot approve, reject,
 * hire, finalize or edit a record.
 */

const unitArg = z.string().min(1).max(80).describe('Unit name (or part of it), e.g. "Nursing". Omit for the whole organisation.');

async function resolveUnit(name: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!name) return null;
  const units = await prisma.unit.findMany({ select: { id: true, name: true, code: true } });
  const needle = name.trim().toLowerCase();
  const match =
    units.find((u) => u.name.toLowerCase() === needle || u.code.toLowerCase() === needle) ??
    units.find((u) => u.name.toLowerCase().includes(needle));
  if (!match) {
    throw new AiToolError('INVALID_ARGS', `No unit matches "${name}". Units: ${units.map((u) => u.name).join(', ')}.`);
  }
  return { id: match.id, name: match.name };
}

async function activeEmployees(unitId?: string) {
  return prisma.employee.findMany({
    where: { ...ACTIVE_WORKFORCE_WHERE, ...(unitId ? { unitId } : {}) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      unit: { select: { name: true } },
      jobRole: { select: { title: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

// ── Reports (reuses the Reports & Analytics page) ────────────────────────────

const reportTool = defineTool({
  name: 'get_hr_report',
  description:
    'Runs one of HRISense\'s Reports & Analytics reports and returns its headline totals, generated summary sentences, chart breakdowns and caveats (not the per-employee rows). Reports: headcount, attendance, leave, compliance, training, evaluations, recruitment. The attendance report needs a period (default: the last 30 days). Figures match the Reports page exactly.',
  tiers: HR_ONLY,
  args: z
    .object({
      report: z.enum(['headcount', 'attendance', 'leave', 'compliance', 'training', 'evaluations', 'recruitment']),
      from: dateArg.optional(),
      to: dateArg.optional(),
      unit: unitArg.optional(),
    })
    .strict(),
  async run(ctx: ToolContext, args: { report: ReportKey; from?: string; to?: string; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    let from = args.from;
    let to = args.to;
    if (args.report === 'attendance' || from || to) {
      const range = parseRange(ctx, from, to, { fromOffset: -29, toOffset: 0 }, 366);
      from = range.fromKey;
      to = range.toKey;
    }
    const report = await ReportService.generate(args.report, { dateFrom: from, dateTo: to, unitId: unit?.id });
    const charts = report.charts
      .filter((c) => c.slices.length)
      .map((c) =>
        describeDataset(
          ctx.datasets,
          ctx.datasets.add({
            title: c.title,
            xKey: 'label',
            xLabel: c.subtitle ?? 'Category',
            xType: 'category',
            series: [{ key: 'value', label: 'Count' }],
            rows: c.slices.map((s) => ({ label: s.label, value: s.value })),
          })
        )
      )
      .filter(Boolean);
    return {
      data: {
        report: report.title,
        description: report.description,
        unit: unit?.name ?? 'All units',
        period: report.period,
        totals: report.totals,
        summary: report.summary,
        charts,
        notes: report.notes,
        rowCount: report.rows.length,
        reportsPage: '/reports',
      },
      rows: report.rows.length,
    };
  },
});

// ── Headcount ────────────────────────────────────────────────────────────────

const headcountTool = defineTool({
  name: 'get_headcount',
  description:
    'Active workforce headcount grouped by unit, job role, employment status or work-schedule type (active = not archived and employment state ACTIVE), or all employees grouped by employment state. Returns a chart dataset.',
  tiers: HR_ONLY,
  args: z
    .object({
      groupBy: z.enum(['unit', 'jobRole', 'employmentStatus', 'employmentState', 'workSchedule']),
      unit: unitArg.optional(),
    })
    .strict(),
  async run(ctx: ToolContext, args: { groupBy: string; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    const byState = args.groupBy === 'employmentState';
    const rows = await prisma.employee.findMany({
      where: byState ? { deletedAt: null, ...(unit ? { unitId: unit.id } : {}) } : { ...ACTIVE_WORKFORCE_WHERE, ...(unit ? { unitId: unit.id } : {}) },
      select: {
        employmentStatus: true,
        employmentState: true,
        workSchedule: true,
        unit: { select: { name: true } },
        jobRole: { select: { title: true } },
      },
    });
    const keyOf = (r: (typeof rows)[number]): string => {
      switch (args.groupBy) {
        case 'unit': return r.unit?.name ?? 'Unassigned';
        case 'jobRole': return r.jobRole?.title ?? 'Unassigned';
        case 'employmentStatus': return humanise(r.employmentStatus);
        case 'employmentState': return humanise(r.employmentState);
        default: return humanise(r.workSchedule);
      }
    };
    const counts = Object.entries(countBy(rows, keyOf)).sort((a, b) => b[1] - a[1]);
    const dataset = ctx.datasets.add({
      title: `Headcount by ${humanise(args.groupBy).toLowerCase()}${unit ? ` — ${unit.name}` : ''}`,
      xKey: 'group',
      xLabel: humanise(args.groupBy),
      xType: 'category',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: counts.slice(0, 40).map(([group, employees]) => ({ group, employees })),
    });
    return {
      data: {
        population: byState ? 'All non-archived employees' : 'Active workforce',
        unit: unit?.name ?? 'All units',
        total: rows.length,
        groups: counts.map(([group, employees]) => ({ group, employees, share: pct(employees, rows.length) })),
        chart: describeDataset(ctx.datasets, dataset),
      },
      rows: counts.length,
    };
  },
});

// ── Attendance coverage on one day ───────────────────────────────────────────

const coverageTool = defineTool({
  name: 'get_attendance_coverage',
  description:
    "Organisation-wide attendance coverage for one day (default today): who is scheduled to work, who has an imported record, who is on approved leave, day off, schedule not configured, and who is scheduled but has NO IMPORTED RECORD (listed by name, up to 60). Per-unit breakdown as a chart dataset, and the latest attendance import.",
  tiers: HR_ONLY,
  args: z.object({ date: dateArg.optional(), unit: unitArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { date?: string; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    const range = parseRange(ctx, args.date ?? ctx.today, args.date ?? ctx.today, { fromOffset: 0, toOffset: 0 }, 1);
    const day = range.fromKey;
    const employees = await activeEmployees(unit?.id);
    const ids = employees.map((e) => e.id);
    const [schedules, records, leave, holidays, lastImport] = await Promise.all([
      ScheduleResolverService.resolveManyForDate(ids, day),
      prisma.attendanceRecord.findMany({ where: { employeeId: { in: ids }, date: range.from }, select: { employeeId: true, status: true } }),
      loadApprovedLeave(ids, range),
      loadHolidays(range),
      prisma.attendanceImportBatch.findFirst({
        where: { status: { in: ['COMPLETED', 'PARTIALLY_APPLIED'] } },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, detectedPeriodStart: true, detectedPeriodEnd: true, countApplied: true },
      }),
    ]);
    const recordBy = new Map(records.map((r) => [r.employeeId, r.status]));
    const holiday = describeHolidays(holidays.get(day));

    const totals = { activeEmployees: employees.length, scheduledWorking: 0, scheduledWorkdays: 0, scheduledWorkdaysWithRecord: 0, withRecord: records.length, onApprovedLeave: 0, dayOff: 0, scheduleNotConfigured: 0, scheduledButNoRecord: 0 };
    const unitRows = new Map<string, { unit: string; scheduledWorking: number; withRecord: number; scheduledButNoRecord: number; onApprovedLeave: number }>();
    const noRecord: Array<{ name: string | null; employeeNumber: string; unit: string | null; jobRole: string | null; shifts: string | null }> = [];

    for (const e of employees) {
      const s = schedules.get(e.id);
      const status = s?.status ?? 'UNCONFIGURED';
      const lv = leaveOn(leave, e.id, day);
      const has = recordBy.has(e.id);
      const u = e.unit?.name ?? 'Unassigned';
      const row = unitRows.get(u) ?? { unit: u, scheduledWorking: 0, withRecord: 0, scheduledButNoRecord: 0, onApprovedLeave: 0 };
      if (status === 'WORKING') { totals.scheduledWorking++; row.scheduledWorking++; }
      if (status === 'DAY_OFF') totals.dayOff++;
      if (status === 'UNCONFIGURED') totals.scheduleNotConfigured++;
      if (has) row.withRecord++;
      if (lv) { totals.onApprovedLeave++; row.onApprovedLeave++; }
      // Same rule as attendance-metrics: WORKING and not leave or holiday.
      if (status === 'WORKING' && !lv && !holiday) {
        totals.scheduledWorkdays++;
        if (has) totals.scheduledWorkdaysWithRecord++;
      }
      if (status === 'WORKING' && !has && !lv && !holiday) {
        totals.scheduledButNoRecord++;
        row.scheduledButNoRecord++;
        if (noRecord.length < 60) {
          noRecord.push({
            name: fullName(e),
            employeeNumber: e.employeeNumber,
            unit: e.unit?.name ?? null,
            jobRole: e.jobRole?.title ?? null,
            shifts: s?.shifts.map((sh) => `${sh.startTime.slice(0, 5)}–${sh.endTime.slice(0, 5)}`).join(', ') || null,
          });
        }
      }
      unitRows.set(u, row);
    }

    const dataset = ctx.datasets.add({
      title: `Attendance coverage by unit on ${day}`,
      xKey: 'unit',
      xLabel: 'Unit',
      xType: 'category',
      unit: 'employees',
      series: [
        { key: 'withRecord', label: 'Has a record' },
        { key: 'scheduledButNoRecord', label: 'Scheduled, no imported record' },
        { key: 'onApprovedLeave', label: 'On approved leave' },
      ],
      rows: [...unitRows.values()].sort((a, b) => a.unit.localeCompare(b.unit)),
    });

    return {
      data: {
        date: day,
        weekday: weekdayOf(day),
        holiday,
        unit: unit?.name ?? 'All units',
        totals,
        recordCoverage: pct(totals.scheduledWorkdaysWithRecord, totals.scheduledWorkdays),
        scheduledButNoImportedRecord: noRecord,
        byUnit: [...unitRows.values()],
        latestImport: lastImport
          ? { completedOn: dateKey(lastImport.completedAt), periodFrom: dateKey(lastImport.detectedPeriodStart), periodTo: dateKey(lastImport.detectedPeriodEnd), recordsApplied: lastImport.countApplied }
          : null,
        chart: describeDataset(ctx.datasets, dataset),
        notes: [
          'NO IMPORTED RECORD does NOT mean ABSENT. Records exist only after HR imports the biometric export; a day after the latest import period will always show no record.',
          'Employees whose schedule is not configured cannot be counted as expected to work.',
        ],
      },
      rows: employees.length,
    };
  },
});

// ── Attendance trends ─────────────────────────────────────────────────────────

const trendTool = defineTool({
  name: 'get_attendance_trends',
  description:
    "Attendance analytics for the active workforce over a period (default: this month to date; at most 366 days). groupBy 'unit' or 'jobRole' compares groups; 'employee' ranks individual employees (sortBy noImportedRecordDays, attendanceRate or recordCoverage; top `limit`, default 15); 'month', 'week' or 'day' gives the organisation trend. Every group carries attendance rate, record coverage and day counts from one deterministic rule. Chart datasets included.",
  tiers: HR_ONLY,
  args: z
    .object({
      groupBy: z.enum(['unit', 'jobRole', 'employee', 'month', 'week', 'day']),
      from: dateArg.optional(),
      to: dateArg.optional(),
      unit: unitArg.optional(),
      sortBy: z.enum(['noImportedRecordDays', 'attendanceRate', 'recordCoverage', 'recordedAbsentDays']).optional(),
      limit: z.number().int().min(1).max(60).optional(),
    })
    .strict(),
  async run(
    ctx: ToolContext,
    args: { groupBy: 'unit' | 'jobRole' | 'employee' | PeriodGrouping; from?: string; to?: string; unit?: string; sortBy?: string; limit?: number }
  ) {
    const unit = await resolveUnit(args.unit);
    const range = args.from || args.to
      ? parseRange(ctx, args.from, args.to, { fromOffset: -29, toOffset: 0 }, 366)
      : parseRange(ctx, monthStartKey(ctx.today, 0), ctx.today, { fromOffset: 0, toOffset: 0 }, 366);
    if (args.groupBy === 'day' && range.days > 62) {
      throw new AiToolError('INVALID_ARGS', 'Daily grouping covers at most 62 days; use week or month for longer periods.');
    }
    const employees = await activeEmployees(unit?.id);
    const loaded = await loadAttendanceFacts(employees.map((e) => e.id), range);
    const perEmployee = employees.map((e) => ({
      id: e.id,
      name: fullName(e) ?? '—',
      employeeNumber: e.employeeNumber,
      unit: e.unit?.name ?? 'Unassigned',
      jobRole: e.jobRole?.title ?? 'Unassigned',
      metrics: computeAttendanceMetrics(loaded.facts.get(e.id)!),
    }));
    const totals = sumMetrics(perEmployee.map((p) => p.metrics));
    const base = {
      period: { from: range.fromKey, to: range.toKey, days: range.days, groupedBy: args.groupBy },
      unit: unit?.name ?? 'All units',
      activeEmployees: employees.length,
      totals,
      attendanceDataAvailable: await attendanceDataSpan(employees.map((e) => e.id)),
      notes: [
        ...ATTENDANCE_RULES,
        'Employees with no configured weekly schedule have no scheduled workdays, so their record coverage cannot be calculated.',
      ],
    };

    if (args.groupBy === 'month' || args.groupBy === 'week' || args.groupBy === 'day') {
      const rows = periodRows(perEmployee.flatMap((p) => loaded.facts.get(p.id)!), args.groupBy);
      return {
        data: {
          ...base,
          periods: rows.map((r) => ({ period: r.period, noDataImported: r.noDataImported, ...r.metrics })),
          periodsWithNoImportedData: rows.filter((r) => r.noDataImported).map((r) => r.period),
          charts: registerPeriodDatasets(ctx, `${unit?.name ?? 'all units'}, ${range.fromKey} to ${range.toKey}`, rows, args.groupBy),
        },
        rows: rows.length,
      };
    }

    if (args.groupBy === 'employee') {
      const sortBy = (args.sortBy ?? 'noImportedRecordDays') as keyof AttendanceMetrics;
      const ascending = sortBy === 'attendanceRate' || sortBy === 'recordCoverage';
      const ranked = [...perEmployee]
        .filter((p) => (ascending ? p.metrics[sortBy] !== null : true))
        .sort((a, b) => {
          const av = (a.metrics[sortBy] as number) ?? 0;
          const bv = (b.metrics[sortBy] as number) ?? 0;
          return ascending ? av - bv : bv - av;
        })
        .slice(0, args.limit ?? 15);
      const dataset = ctx.datasets.add({
        title: `Employees by ${humanise(String(sortBy)).toLowerCase()} (${range.fromKey} to ${range.toKey})`,
        xKey: 'name',
        xLabel: 'Employee',
        xType: 'category',
        unit: ascending ? '%' : 'days',
        series: [{ key: 'value', label: humanise(String(sortBy)) }],
        ...(ascending ? { details: RATE_DETAILS } : {}),
        rows: ranked.map((p) => ({ name: p.name, value: p.metrics[sortBy] as number | null, ...(ascending ? rateDetailValues(p.metrics) : {}) })),
      });
      return {
        data: {
          ...base,
          sortedBy: sortBy,
          employees: ranked.map((p) => ({ name: p.name, employeeNumber: p.employeeNumber, unit: p.unit, jobRole: p.jobRole, ...p.metrics })),
          employeesWithoutAnyRate: ascending ? perEmployee.filter((p) => p.metrics[sortBy] === null).length : undefined,
          chart: describeDataset(ctx.datasets, dataset),
        },
        rows: ranked.length,
      };
    }

    // unit / jobRole
    const groups = new Map<string, typeof perEmployee>();
    for (const p of perEmployee) {
      const key = args.groupBy === 'unit' ? p.unit : p.jobRole;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const groupRows = [...groups.entries()]
      .map(([group, members]) => ({ group, activeEmployees: members.length, ...sumMetrics(members.map((m) => m.metrics)) }))
      .sort((a, b) => a.group.localeCompare(b.group));
    const rates = ctx.datasets.add({
      title: `Attendance rate and record coverage by ${args.groupBy === 'unit' ? 'unit' : 'job role'} (${range.fromKey} to ${range.toKey})`,
      xKey: 'group',
      xLabel: args.groupBy === 'unit' ? 'Unit' : 'Job role',
      xType: 'category',
      unit: '%',
      series: [
        { key: 'attendanceRate', label: 'Attendance rate (recorded days)' },
        { key: 'recordCoverage', label: 'Record coverage (scheduled workdays)' },
      ],
      details: RATE_DETAILS,
      rows: groupRows.map((g) => ({ group: g.group, attendanceRate: g.attendanceRate, recordCoverage: g.recordCoverage, ...rateDetailValues(g) })),
    });
    const days = ctx.datasets.add({
      title: `Attendance days by ${args.groupBy === 'unit' ? 'unit' : 'job role'} (${range.fromKey} to ${range.toKey})`,
      xKey: 'group',
      xLabel: args.groupBy === 'unit' ? 'Unit' : 'Job role',
      xType: 'category',
      unit: 'days',
      series: [
        { key: 'presenceDays', label: 'Presence days' },
        { key: 'recordedAbsentDays', label: 'Recorded absent' },
        { key: 'noImportedRecordDays', label: 'No imported record' },
      ],
      rows: groupRows.map((g) => ({ group: g.group, presenceDays: g.presenceDays, recordedAbsentDays: g.recordedAbsentDays, noImportedRecordDays: g.noImportedRecordDays })),
    });
    return {
      data: {
        ...base,
        groups: groupRows,
        charts: [describeDataset(ctx.datasets, rates), describeDataset(ctx.datasets, days)].filter(Boolean),
      },
      rows: groupRows.length,
    };
  },
});

// ── Leave ─────────────────────────────────────────────────────────────────────

const leaveOverviewTool = defineTool({
  name: 'get_leave_overview',
  description:
    'Organisation leave picture: requests awaiting HR (FOR_REVIEW, listed), requests still awaiting a supervisor (PENDING), who is on approved leave today, approved leave in the next 14 days, and requests filed in a period (default: last 30 days) by type and status. Reasons are not included.',
  tiers: HR_ONLY,
  args: z.object({ from: dateArg.optional(), to: dateArg.optional(), unit: unitArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { from?: string; to?: string; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    const range = parseRange(ctx, args.from, args.to, { fromOffset: -29, toOffset: 0 }, 366);
    const empFilter = unit ? { employee: { unitId: unit.id } } : {};
    const soon = parseRange(ctx, ctx.today, addDaysKey(ctx.today, 14), { fromOffset: 0, toOffset: 14 }, 15);
    const select = {
      leaveType: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      createdAt: true,
      employee: { select: { firstName: true, lastName: true, unit: { select: { name: true } } } },
    } as const;

    const [awaitingHr, awaitingSupervisor, ongoing, upcoming, filed] = await Promise.all([
      prisma.leaveRequest.findMany({ where: { deletedAt: null, status: 'FOR_REVIEW', ...empFilter }, orderBy: { startDate: 'asc' }, take: 40, select }),
      prisma.leaveRequest.findMany({ where: { deletedAt: null, status: 'PENDING', ...empFilter }, orderBy: { startDate: 'asc' }, take: 40, select }),
      prisma.leaveRequest.findMany({ where: { deletedAt: null, status: 'APPROVED', startDate: { lte: soon.from }, endDate: { gte: soon.from }, ...empFilter }, take: 60, select }),
      prisma.leaveRequest.findMany({ where: { deletedAt: null, status: 'APPROVED', startDate: { gt: soon.from, lte: soon.to }, ...empFilter }, orderBy: { startDate: 'asc' }, take: 60, select }),
      prisma.leaveRequest.findMany({
        where: { deletedAt: null, createdAt: { gte: range.from, lt: new Date(range.to.getTime() + 86_400_000) }, ...empFilter },
        select: { leaveType: true, status: true, totalDays: true },
      }),
    ]);
    const present = (r: any) => ({
      employee: fullName(r.employee),
      unit: r.employee.unit?.name ?? null,
      type: humanise(r.leaveType),
      from: dateKey(r.startDate),
      to: dateKey(r.endDate),
      days: r.totalDays,
      filedOn: dateKey(r.createdAt),
    });
    const byType = Object.entries(countBy(filed, (r) => humanise(r.leaveType))).sort((a, b) => b[1] - a[1]);
    const approvedDaysByType: Record<string, number> = {};
    for (const r of filed.filter((f) => f.status === 'APPROVED')) {
      approvedDaysByType[humanise(r.leaveType)] = (approvedDaysByType[humanise(r.leaveType)] ?? 0) + r.totalDays;
    }
    const statusDataset = ctx.datasets.add({
      title: `Leave requests filed by status (${range.fromKey} to ${range.toKey})`,
      xKey: 'status',
      xLabel: 'Status',
      xType: 'category',
      unit: 'requests',
      series: [{ key: 'requests', label: 'Requests' }],
      rows: Object.entries(countBy(filed, (r) => r.status)).map(([status, requests]) => ({ status: humanise(status), requests })),
    });
    const usageDataset = ctx.datasets.add({
      title: `Approved leave days by type (requests filed ${range.fromKey} to ${range.toKey})`,
      xKey: 'type',
      xLabel: 'Leave type',
      xType: 'category',
      unit: 'days',
      series: [{ key: 'days', label: 'Approved days' }],
      rows: Object.entries(approvedDaysByType).sort((a, b) => b[1] - a[1]).map(([type, days]) => ({ type, days })),
    });
    const dataset = ctx.datasets.add({
      title: `Leave requests filed by type (${range.fromKey} to ${range.toKey})`,
      xKey: 'type',
      xLabel: 'Leave type',
      xType: 'category',
      unit: 'requests',
      series: [{ key: 'requests', label: 'Requests' }],
      rows: byType.map(([type, requests]) => ({ type, requests })),
    });
    return {
      data: {
        unit: unit?.name ?? 'All units',
        awaitingHrDecision: { count: awaitingHr.length, requests: awaitingHr.map(present) },
        awaitingSupervisorEndorsement: { count: awaitingSupervisor.length, requests: awaitingSupervisor.map(present) },
        onApprovedLeaveToday: ongoing.map(present),
        approvedLeaveNext14Days: upcoming.map(present),
        filedInPeriod: {
          period: { from: range.fromKey, to: range.toKey },
          total: filed.length,
          byStatus: countBy(filed, (r) => r.status),
          byType: Object.fromEntries(byType),
          totalDaysRequested: filed.reduce((n, r) => n + r.totalDays, 0),
          approvedDaysByType,
        },
        charts: [describeDataset(ctx.datasets, statusDataset), describeDataset(ctx.datasets, dataset), describeDataset(ctx.datasets, usageDataset)].filter(Boolean),
        notes: [
          'FOR_REVIEW = endorsed by the supervisor and waiting for HR. PENDING = waiting for the supervisor (or for HR when the employee has no supervisor).',
          'Only HR decides leave, in Leave Requests. The assistant cannot approve or reject.',
          'Leave days are calendar days (weekends and holidays included); approved days by type are grouped by the date the request was filed.',
        ],
      },
      rows: awaitingHr.length + awaitingSupervisor.length + ongoing.length + upcoming.length,
    };
  },
});

// ── Compliance ────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { EXPIRED: 1, MISSING: 2, EXPIRING_SOON: 3, NEEDS_REVIEW: 4, VALID: 5 };

const complianceOverviewTool = defineTool({
  name: 'get_compliance_overview',
  description:
    'Organisation compliance standing for the active workforce, using the Compliance page rules: counts by status, by requirement and by unit, the items needing attention (expired, missing, expiring soon, needs review — listed with names, up to 50), and every requirement expiring within N days (default 30) whatever its reminder setting.',
  tiers: HR_ONLY,
  args: z.object({ withinDays: z.number().int().min(1).max(365).optional(), unit: unitArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { withinDays?: number; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    const within = args.withinDays ?? 30;
    const employees = await activeEmployees(unit?.id);

    // Reuses the per-employee derivation the Compliance page and profile use,
    // so every status here is the status HR sees on screen.
    const summaries: any[][] = [];
    for (let i = 0; i < employees.length; i += 10) {
      summaries.push(...(await Promise.all(employees.slice(i, i + 10).map((e) => ComplianceService.getEmployeeComplianceSummary(e.id)))));
    }

    const todayMs = new Date(`${ctx.today}T00:00:00Z`).getTime();
    const byStatus: Record<string, number> = { VALID: 0, MISSING: 0, NEEDS_REVIEW: 0, EXPIRING_SOON: 0, EXPIRED: 0 };
    const byRequirement = new Map<string, Record<string, number>>();
    const byUnit = new Map<string, { unit: string; needsAttention: number; valid: number }>();
    const attention: any[] = [];
    const expiringWithin: any[] = [];

    employees.forEach((e, i) => {
      const u = e.unit?.name ?? 'Unassigned';
      const unitRow = byUnit.get(u) ?? { unit: u, needsAttention: 0, valid: 0 };
      for (const item of summaries[i]) {
        byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
        const reqCounts = byRequirement.get(item.requirement.title) ?? {};
        reqCounts[item.status] = (reqCounts[item.status] ?? 0) + 1;
        byRequirement.set(item.requirement.title, reqCounts);
        if (item.status === 'VALID') unitRow.valid++;
        else unitRow.needsAttention++;

        const days = item.expiresAt ? Math.round((new Date(item.expiresAt).getTime() - todayMs) / 86_400_000) : null;
        const row = { employee: fullName(e), employeeNumber: e.employeeNumber, unit: e.unit?.name ?? null, requirement: item.requirement.title, category: humanise(item.requirement.category), status: item.status, expiresOn: dateKey(item.expiresAt), daysUntilExpiry: days };
        if (item.status !== 'VALID') attention.push(row);
        if (days !== null && days >= 0 && days <= within) expiringWithin.push(row);
      }
      byUnit.set(u, unitRow);
    });

    attention.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || String(a.employee).localeCompare(String(b.employee)));
    expiringWithin.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    const statusDataset = ctx.datasets.add({
      title: 'Compliance checks by status',
      xKey: 'status',
      xLabel: 'Status',
      xType: 'category',
      unit: 'checks',
      series: [{ key: 'checks', label: 'Requirement checks' }],
      rows: Object.entries(byStatus).filter(([, n]) => n > 0).map(([status, checks]) => ({ status: humanise(status), checks })),
    });
    const unitDataset = ctx.datasets.add({
      title: 'Compliance needing attention by unit',
      xKey: 'unit',
      xLabel: 'Unit',
      xType: 'category',
      unit: 'checks',
      series: [
        { key: 'needsAttention', label: 'Needs attention' },
        { key: 'valid', label: 'Valid' },
      ],
      rows: [...byUnit.values()].sort((a, b) => b.needsAttention - a.needsAttention),
    });

    return {
      data: {
        unit: unit?.name ?? 'All units',
        activeEmployees: employees.length,
        totalChecks: Object.values(byStatus).reduce((n, v) => n + v, 0),
        byStatus,
        byRequirement: [...byRequirement.entries()].map(([requirement, counts]) => ({ requirement, ...counts })),
        needingAttention: { total: attention.length, items: attention.slice(0, 50) },
        expiringWithinDays: { days: within, count: expiringWithin.length, items: expiringWithin.slice(0, 50) },
        charts: [describeDataset(ctx.datasets, statusDataset), describeDataset(ctx.datasets, unitDataset)].filter(Boolean),
        notes: [
          'EXPIRING_SOON uses each requirement\'s own reminder window; "expiring within N days" is a plain date check and is listed separately.',
          'Records submitted through Record Compliance Fulfillment start as Pending review and count as NEEDS_REVIEW until HR accepts them.',
        ],
      },
      rows: attention.length,
    };
  },
});

// ── Training ──────────────────────────────────────────────────────────────────

const trainingOverviewTool = defineTool({
  name: 'get_training_overview',
  description:
    'Training completion across the organisation for activities starting in a period (default: the last 90 days; at most 366): per activity and per unit — assigned, completed, did not attend, excused — and completion rates. Chart dataset by unit.',
  tiers: HR_ONLY,
  args: z.object({ from: dateArg.optional(), to: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { from?: string; to?: string }) {
    const range = parseRange(ctx, args.from, args.to, { fromOffset: -89, toOffset: 0 }, 366);
    const activities = await prisma.trainingActivity.findMany({
      where: { deletedAt: null, startDate: { gte: range.from, lte: range.to } },
      orderBy: { startDate: 'desc' },
      take: 60,
      select: {
        title: true,
        type: true,
        status: true,
        startDate: true,
        participants: { select: { participationStatus: true, employee: { select: { unit: { select: { name: true } } } } } },
      },
    });
    const unitAgg = new Map<string, { unit: string; assigned: number; completed: number; didNotAttend: number; excused: number }>();
    const perActivity = activities.map((a) => {
      const c = countBy(a.participants, (p) => p.participationStatus);
      for (const p of a.participants) {
        const u = p.employee.unit?.name ?? 'Unassigned';
        const row = unitAgg.get(u) ?? { unit: u, assigned: 0, completed: 0, didNotAttend: 0, excused: 0 };
        if (p.participationStatus !== 'CANCELLED') row.assigned++;
        if (p.participationStatus === 'COMPLETED') row.completed++;
        if (p.participationStatus === 'DID_NOT_ATTEND') row.didNotAttend++;
        if (p.participationStatus === 'EXCUSED') row.excused++;
        unitAgg.set(u, row);
      }
      const counted = a.participants.length - (c.CANCELLED ?? 0);
      return { title: a.title, type: humanise(a.type), status: a.status, startDate: dateKey(a.startDate), participants: a.participants.length, ...c, completionRate: pct(c.COMPLETED ?? 0, counted) };
    });
    const units = [...unitAgg.values()].map((u) => ({ ...u, completionRate: pct(u.completed, u.assigned) }));
    const dataset = ctx.datasets.add({
      title: `Training completion rate by unit (${range.fromKey} to ${range.toKey})`,
      xKey: 'unit',
      xLabel: 'Unit',
      xType: 'category',
      unit: '%',
      series: [{ key: 'completionRate', label: 'Completion %' }],
      details: [
        { key: 'completed', label: 'Completed (numerator)' },
        { key: 'assigned', label: 'Participants not cancelled (total)' },
      ],
      rows: units.sort((a, b) => a.unit.localeCompare(b.unit)).map((u) => ({ unit: u.unit, completionRate: u.completionRate, completed: u.completed, assigned: u.assigned })),
    });
    return {
      data: {
        period: { from: range.fromKey, to: range.toKey },
        activities: perActivity,
        byUnit: units,
        chart: describeDataset(ctx.datasets, dataset),
        notes: ['Completion rate = completed ÷ participants who were not cancelled. Activities still SCHEDULED naturally show a low rate.'],
      },
      rows: perActivity.length,
    };
  },
});

// ── Evaluations ───────────────────────────────────────────────────────────────

const evaluationOverviewTool = defineTool({
  name: 'get_evaluation_overview',
  description:
    'Progress of evaluation cycles (active by default), per employee evaluated: the evaluation type (Standard: head / supervisor / coordinator only; Weighted Multi-Rater: self 20% + peer 20% + head 60%), self ratings and peer evaluations (x of y, weighted cycles only), head / supervisor / coordinator evaluations, discussions with the employee and HR finalisation; overdue ratings; evaluators with the most unfinished ratings. Individual ratings are not included.',
  tiers: HR_ONLY,
  args: z.object({ includeClosed: z.boolean().optional() }).strict(),
  async run(ctx: ToolContext, args: { includeClosed?: boolean }) {
    const cycles = await prisma.evaluationCycle.findMany({
      where: { deletedAt: null, ...(args.includeClosed ? {} : { status: 'ACTIVE' }) },
      orderBy: { dueDate: 'asc' },
      take: 20,
      select: {
        name: true,
        status: true,
        startDate: true,
        dueDate: true,
        evaluatorAssignmentMethod: true,
        evaluationMode: true,
        peerWeight: true,
        assignments: {
          where: { deletedAt: null },
          select: {
            id: true, employeeId: true, raterType: true, status: true, dueDate: true, discussionCompletedAt: true,
            evaluator: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    const todayMs = new Date(`${ctx.today}T00:00:00Z`).getTime();
    const pendingByEvaluator = new Map<string, number>();
    const rows = cycles.map((c) => {
      // Counted per employee evaluated (lib: evaluation-workflow), not per rater row.
      const weighted = c.evaluationMode === 'WEIGHTED_MULTI_RATER';
      const m = cycleMetrics(cycleProgress(c.assignments as any, { mode: c.evaluationMode, requirePeer: weighted && (c.peerWeight ?? 0) > 0 }));
      const overdue = c.assignments.filter((a) => ['NOT_STARTED', 'IN_PROGRESS'].includes(a.status) && a.dueDate.getTime() < todayMs).length;
      for (const a of c.assignments) {
        if (['NOT_STARTED', 'IN_PROGRESS'].includes(a.status)) {
          const n = fullName(a.evaluator) ?? 'Unknown';
          pendingByEvaluator.set(n, (pendingByEvaluator.get(n) ?? 0) + 1);
        }
      }
      return {
        cycle: c.name,
        evaluationType: EVALUATION_MODE_LABEL[c.evaluationMode],
        status: c.status,
        from: dateKey(c.startDate),
        due: dateKey(c.dueDate),
        employeesEvaluated: m.total,
        notStarted: m.notStarted,
        inProgress: m.inProgress,
        discussionPending: m.discussionPending,
        readyToFinalize: m.readyToFinalize,
        submitted: m.submitted,
        finalized: m.finalized,
        selfRatings: weighted ? `${m.selfSubmitted} of ${m.selfTotal} submitted` : 'Not part of a Standard Evaluation',
        peerEvaluations: weighted ? `${m.peerSubmitted} of ${m.peerTotal} submitted` : 'Not part of a Standard Evaluation',
        headEvaluatorNotAssigned: m.headUnassigned,
        overdueRatings: overdue,
        finalizedRate: pct(m.finalized, m.total),
        noAssignments: c.assignments.length === 0 || undefined,
      };
    });
    const dataset = ctx.datasets.add({
      title: 'Evaluation progress by cycle',
      xKey: 'cycle',
      xLabel: 'Cycle',
      xType: 'category',
      unit: 'employees',
      series: [
        { key: 'notStarted', label: 'Not started' },
        { key: 'inProgress', label: 'In progress' },
        { key: 'submitted', label: 'Head evaluation submitted' },
        { key: 'finalized', label: 'Finalized' },
      ],
      rows: rows.map((r) => ({ cycle: r.cycle, notStarted: r.notStarted, inProgress: r.inProgress, submitted: r.submitted, finalized: r.finalized })),
    });
    return {
      data: {
        cycles: rows,
        evaluatorsWithMostUnfinished: [...pendingByEvaluator.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([evaluator, unfinished]) => ({ evaluator, unfinished })),
        chart: describeDataset(ctx.datasets, dataset),
        notes: [
          'Each employee has a self rating, any peer evaluators HR selected, and a head / supervisor / coordinator evaluation; HR assigns heads and peers per employee on the Evaluations page.',
          'HR can finalise only after every component is submitted and the head has recorded the discussion with the employee; employees see the result only after it is finalized AND made visible.',
        ],
      },
      rows: rows.length,
    };
  },
});

// ── Recruitment ───────────────────────────────────────────────────────────────

const recruitmentOverviewTool = defineTool({
  name: 'get_recruitment_overview',
  description:
    'Recruitment pipeline: job openings by status, and for each open opening the number of applications at each stage (submitted → hired/rejected/withdrawn), plus applications received in the last N days (default 30). Applicant personal details are not included.',
  tiers: HR_ONLY,
  args: z.object({ days: z.number().int().min(1).max(365).optional() }).strict(),
  async run(ctx: ToolContext, args: { days?: number }) {
    const days = args.days ?? 30;
    const since = new Date(new Date(`${ctx.today}T00:00:00Z`).getTime() - (days - 1) * 86_400_000);
    const [openings, recent] = await Promise.all([
      prisma.jobOpening.findMany({
        orderBy: { openingDate: 'desc' },
        take: 60,
        select: { title: true, status: true, openingDate: true, closingDate: true, vacancies: true, unit: { select: { name: true } }, applications: { select: { status: true } } },
      }),
      prisma.jobApplication.findMany({ where: { applicationDate: { gte: since } }, select: { status: true } }),
    ]);
    const openingsByStatus = countBy(openings, (o) => o.status);
    const open = openings.filter((o) => o.status === 'OPEN').map((o) => ({
      title: o.title,
      unit: o.unit?.name ?? null,
      vacancies: o.vacancies,
      closingDate: dateKey(o.closingDate),
      applications: o.applications.length,
      byStage: countBy(o.applications, (a) => a.status),
    }));
    const pipeline = countBy(openings.flatMap((o) => o.applications), (a) => a.status);
    const sixMonthsAgo = new Date(`${monthStartKey(ctx.today, -5)}T00:00:00Z`);
    const monthly = await prisma.jobApplication.findMany({ where: { applicationDate: { gte: sixMonthsAgo } }, select: { applicationDate: true } });
    const perMonth: Record<string, number> = {};
    for (let i = -5; i <= 0; i++) perMonth[monthStartKey(ctx.today, i).slice(0, 7)] = 0;
    for (const a of monthly) {
      const k = businessDateKey(a.applicationDate).slice(0, 7);
      if (k in perMonth) perMonth[k]++;
    }
    const overTime = ctx.datasets.add({
      title: 'Applications received per month (last 6 months)',
      xKey: 'month',
      xLabel: 'Month',
      xType: 'date',
      unit: 'applications',
      series: [{ key: 'applications', label: 'Applications' }],
      rows: Object.entries(perMonth).map(([month, applications]) => ({ month, applications })),
    });
    const STAGES = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEWED', 'FOR_REQUIREMENTS', 'HIRED', 'REJECTED', 'WITHDRAWN'];
    const dataset = ctx.datasets.add({
      title: 'Applications by stage (all openings)',
      xKey: 'stage',
      xLabel: 'Stage',
      xType: 'category',
      unit: 'applications',
      series: [{ key: 'applications', label: 'Applications' }],
      rows: STAGES.filter((s) => pipeline[s]).map((s) => ({ stage: humanise(s), applications: pipeline[s] })),
    });
    return {
      data: {
        openingsByStatus,
        openOpenings: open,
        pipelineAllOpenings: pipeline,
        receivedInLastDays: { days, total: recent.length, byStatus: countBy(recent, (r) => r.status) },
        applicationsPerMonth: perMonth,
        charts: [describeDataset(ctx.datasets, dataset), describeDataset(ctx.datasets, overTime)].filter(Boolean),
        notes: ['Hiring decisions are made by HR in Recruitment → Applicants. The assistant cannot change an application.'],
      },
      rows: openings.length,
    };
  },
});

// ── Announcements ─────────────────────────────────────────────────────────────

const announcementRatesTool = defineTool({
  name: 'get_announcement_read_rates',
  description: 'Read rates of published announcements (active by default, newest first, up to 20): recipients, read, unread and read %. Chart dataset included.',
  tiers: HR_ONLY,
  args: z.object({ includeArchived: z.boolean().optional() }).strict(),
  async run(ctx: ToolContext, args: { includeArchived?: boolean }) {
    const announcements = await prisma.announcement.findMany({
      where: { publishAt: { not: null }, state: args.includeArchived ? { in: ['ACTIVE', 'ARCHIVED'] } : 'ACTIVE' },
      orderBy: { publishAt: 'desc' },
      take: 20,
      select: { id: true, title: true, priority: true, publishAt: true, expiresAt: true, state: true },
    });
    const ids = announcements.map((a) => a.id);
    const [totals, reads] = await Promise.all([
      prisma.announcementRecipient.groupBy({ by: ['announcementId'], where: { announcementId: { in: ids } }, _count: { _all: true } }),
      prisma.announcementRecipient.groupBy({ by: ['announcementId'], where: { announcementId: { in: ids }, readAt: { not: null } }, _count: { _all: true } }),
    ]);
    const t = new Map(totals.map((x) => [x.announcementId, x._count._all]));
    const r = new Map(reads.map((x) => [x.announcementId, x._count._all]));
    const rows = announcements.map((a) => {
      const recipients = t.get(a.id) ?? 0;
      const read = r.get(a.id) ?? 0;
      return { title: a.title, priority: a.priority, state: a.state, publishedOn: dateKey(a.publishAt), expiresOn: dateKey(a.expiresAt), recipients, read, unread: recipients - read, readRate: pct(read, recipients) };
    });
    const dataset = ctx.datasets.add({
      title: 'Announcement read rate',
      xKey: 'title',
      xLabel: 'Announcement',
      xType: 'category',
      unit: '%',
      series: [{ key: 'readRate', label: 'Read %' }],
      details: [
        { key: 'read', label: 'Read (numerator)' },
        { key: 'recipients', label: 'Recipients (total)' },
      ],
      rows: rows.map((x) => ({ title: x.title.slice(0, 60), readRate: x.readRate, read: x.read, recipients: x.recipients })),
    });
    return { data: { announcements: rows, chart: describeDataset(ctx.datasets, dataset) }, rows: rows.length };
  },
});

// ── Schedules and reporting lines ────────────────────────────────────────────

const scheduleGapsTool = defineTool({
  name: 'get_schedule_gaps',
  description:
    'Active employees whose work schedule is NOT configured on a given day (default today) — no weekly schedule, only a legacy template, or the weekday left unconfigured — grouped by unit, listed by name (up to 80).',
  tiers: HR_ONLY,
  args: z.object({ date: dateArg.optional(), unit: unitArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { date?: string; unit?: string }) {
    const unit = await resolveUnit(args.unit);
    const range = parseRange(ctx, args.date ?? ctx.today, args.date ?? ctx.today, { fromOffset: 0, toOffset: 0 }, 1);
    const employees = await activeEmployees(unit?.id);
    const resolved = await ScheduleResolverService.resolveManyForDate(employees.map((e) => e.id), range.fromKey);
    const gaps = employees
      .map((e) => ({ e, s: resolved.get(e.id) }))
      .filter(({ s }) => !s || s.status === 'UNCONFIGURED')
      .map(({ e, s }) => ({
        name: fullName(e),
        employeeNumber: e.employeeNumber,
        unit: e.unit?.name ?? null,
        jobRole: e.jobRole?.title ?? null,
        reason: !s || s.source === 'UNRESOLVED' ? 'No weekly schedule' : s.source === 'LEGACY_TEMPLATE' ? 'Only a legacy template' : 'Weekday not configured',
      }));
    const byUnit = countBy(gaps, (g) => g.unit ?? 'Unassigned');
    const dataset = ctx.datasets.add({
      title: `Employees without a configured schedule on ${range.fromKey}`,
      xKey: 'unit',
      xLabel: 'Unit',
      xType: 'category',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: Object.entries(byUnit).map(([u, employees]) => ({ unit: u, employees })),
    });
    return {
      data: {
        date: range.fromKey,
        activeEmployees: employees.length,
        unconfigured: gaps.length,
        byReason: countBy(gaps, (g) => g.reason),
        byUnit,
        employees: gaps.slice(0, 80),
        chart: describeDataset(ctx.datasets, dataset),
        notes: ['Schedules are set by HR on the employee profile (Schedule tab). Without one, the attendance import cannot tell a working day from a day off.'],
      },
      rows: gaps.length,
    };
  },
});

const supervisorIssuesTool = defineTool({
  name: 'get_supervisor_assignment_issues',
  description: 'Active employees whose reporting line needs HR attention: supervisor assignment PENDING (with the reason) or no immediate supervisor at all. Listed by name (up to 80) with counts by reason.',
  tiers: HR_ONLY,
  args: z.object({}).strict(),
  async run() {
    const rows = await prisma.employee.findMany({
      where: { ...ACTIVE_WORKFORCE_WHERE, OR: [{ supervisorAssignmentStatus: 'PENDING' }, { immediateSupervisorId: null }] },
      select: {
        firstName: true,
        lastName: true,
        employeeNumber: true,
        supervisorAssignmentStatus: true,
        supervisorPendingReason: true,
        unit: { select: { name: true } },
        jobRole: { select: { title: true, isHead: true } },
      },
      orderBy: [{ lastName: 'asc' }],
    });
    const items = rows.map((r) => ({
      name: fullName(r),
      employeeNumber: r.employeeNumber,
      unit: r.unit?.name ?? null,
      jobRole: r.jobRole?.title ?? null,
      isHeadRole: r.jobRole?.isHead ?? false,
      status: r.supervisorAssignmentStatus ?? 'NONE',
      reason: r.supervisorPendingReason ? humanise(r.supervisorPendingReason) : r.supervisorAssignmentStatus === 'PENDING' ? 'Unspecified' : 'No supervisor set',
    }));
    return {
      data: {
        total: items.length,
        byReason: countBy(items, (i) => i.reason),
        employees: items.slice(0, 80),
        notes: [
          'Heads of the institution may legitimately have no supervisor.',
          'HR fixes reporting lines on the employee profile (Supervisor override). Leave requests from someone without a supervisor go straight to HR.',
        ],
      },
      rows: items.length,
    };
  },
});

// ── Imports, audit, fact sheet ───────────────────────────────────────────────

const importsTool = defineTool({
  name: 'get_attendance_imports',
  description: 'The most recent attendance import batches (up to 10): status, when uploaded / completed, the period the file covered, and the counts of new, conflicting, unknown-code, applied and skipped rows.',
  tiers: HR_ONLY,
  args: z.object({}).strict(),
  async run() {
    const batches = await prisma.attendanceImportBatch.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 10,
      select: {
        status: true, uploadedAt: true, completedAt: true, detectedPeriodStart: true, detectedPeriodEnd: true,
        totalSourceRows: true, countNew: true, countConflict: true, countConflictManual: true, countUnknownEmployee: true,
        countInvalid: true, countIdentityFlagged: true, countApplied: true, countSkipped: true, countFailed: true,
      },
    });
    return {
      data: {
        batches: batches.map((b) => ({
          status: b.status,
          uploadedOn: dateKey(b.uploadedAt),
          completedOn: dateKey(b.completedAt),
          periodFrom: dateKey(b.detectedPeriodStart),
          periodTo: dateKey(b.detectedPeriodEnd),
          rows: b.totalSourceRows,
          new: b.countNew,
          conflicts: b.countConflict + b.countConflictManual,
          unknownCodes: b.countUnknownEmployee,
          invalid: b.countInvalid,
          identityFlagged: b.countIdentityFlagged,
          applied: b.countApplied,
          skipped: b.countSkipped,
          failed: b.countFailed,
        })),
        importPage: '/attendance/daily',
      },
      rows: batches.length,
    };
  },
});

const auditTool = defineTool({
  name: 'get_audit_activity',
  description: 'How many audit-log events of each kind were recorded in the last N days (default 7; at most 90) — counts only, no event details. For details, HR opens Audit Logs.',
  tiers: HR_ONLY,
  args: z.object({ days: z.number().int().min(1).max(90).optional() }).strict(),
  async run(ctx: ToolContext, args: { days?: number }) {
    const days = args.days ?? 7;
    const since = new Date(new Date(`${ctx.today}T00:00:00Z`).getTime() - (days - 1) * 86_400_000 - 8 * 3_600_000);
    const groups = await prisma.auditLog.groupBy({ by: ['action'], where: { createdAt: { gte: since } }, _count: { _all: true } });
    const sorted = groups.map((g) => ({ action: g.action, events: g._count._all })).sort((a, b) => b.events - a.events);
    return { data: { days, total: sorted.reduce((n, g) => n + g.events, 0), byAction: sorted.slice(0, 30), auditPage: '/audit' }, rows: sorted.length };
  },
});

const factsTool = defineTool({
  name: 'get_workforce_fact_sheet',
  description: "The deterministic workforce fact sheet shown on HR's AI Assistance page for the last N days (default 30): headcount, attendance, leave, compliance, training, evaluations, recruitment — aggregate counts only.",
  tiers: HR_ONLY,
  args: z.object({ periodDays: z.number().int().min(7).max(180).optional() }).strict(),
  async run(_ctx: ToolContext, args: { periodDays?: number }) {
    const facts = await WorkforceFactsService.build(args.periodDays ?? 30);
    return { data: facts, rows: 1 };
  },
});

export const HR_TOOLS: AiTool[] = [
  reportTool,
  headcountTool,
  coverageTool,
  trendTool,
  leaveOverviewTool,
  complianceOverviewTool,
  trainingOverviewTool,
  evaluationOverviewTool,
  recruitmentOverviewTool,
  announcementRatesTool,
  scheduleGapsTool,
  supervisorIssuesTool,
  importsTool,
  auditTool,
  factsTool,
];
