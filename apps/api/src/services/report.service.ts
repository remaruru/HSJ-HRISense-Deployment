import { Prisma } from '@prisma/client';
import { formatPercent, ratio, share as sharedShare } from '../lib/percent';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { activeWorkforceWhere } from '../lib/workforceScope';
import { businessDateKey, businessDayStartInstant, toBusinessDate } from '../lib/businessDate';
import { reportToCsv, reportToExcel, reportToPdf } from './report-export';

/**
 * Reports — built strictly from data HRISense actually holds.
 *
 * Deliberately NOT included:
 *  • Salary, payroll, payslips, compensation — permanently out of scope.
 *  • Turnover rate — a turnover formula depends on an averaging convention and a
 *    reporting period Hospicio de San Jose has not confirmed. Separations are
 *    reported as a plain count instead of an invented rate.
 *  • Any figure derived from "no attendance record" being treated as an absence.
 */

export type ReportKey =
  | 'headcount'
  | 'attendance'
  | 'leave'
  | 'compliance'
  | 'training'
  | 'evaluations'
  | 'recruitment';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  unitId?: string;
  departmentId?: string;
  jobRoleId?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
}

/**
 * How a slice should be coloured. `tone` is a MEANING, never a palette index —
 * the client owns the actual hex, and a light/dark pair is chosen there.
 *
 * `neutral` is deliberately available and deliberately not "bad": a day with no
 * imported attendance, or a cancelled activity, is not a failure and must not be
 * painted like one.
 */
export type ReportTone = 'good' | 'warning' | 'critical' | 'review' | 'neutral';

/**
 * Tone of a status figure, matching how the rest of HRISense colours the same
 * status (pending = warning, approved / submitted / finalized = good, and so
 * on). Anything not listed is a plain count and stays neutral.
 */
const STATUS_TONE: Record<string, ReportTone> = {
  PENDING: 'warning',
  APPROVED: 'good',
  FOR_REVIEW: 'review',
  REJECTED: 'critical',
  CANCELLED: 'neutral',
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'good',
  FINALIZED: 'good',
  HIRED: 'good',
};
const statusTone = (status: string): ReportTone => STATUS_TONE[status] ?? 'neutral';

export interface ReportChartSlice {
  label: string;
  value: number;
  tone?: ReportTone;
}

export interface ReportChart {
  id: string;
  title: string;
  /** One line saying what the reader is looking at. */
  subtitle?: string;
  /**
   * `status`  — the slices are states; the client uses the reserved status scale.
   * `ordinal` — the slices have an inherent order (a funnel, a progression);
   *             the client uses one hue, light → dark.
   * `nominal` — the slices are just names; one hue for all of them, because the
   *             bar length already carries the value.
   */
  encoding: 'status' | 'ordinal' | 'nominal';
  /** `bar` is horizontal (long category names); `share` is a part-to-whole split. */
  kind: 'bar' | 'share';
  slices: ReportChartSlice[];
  /** Denominator for percentages, when a share is meaningful. */
  total?: number;
  /** Shown when there is genuinely nothing to plot. */
  emptyMessage?: string;
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  description: string;
  /** Period actually applied, echoed back so exports can state it. */
  period: { from: string | null; to: string | null };
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  /** Headline figures for the page, all derived from `rows` or direct counts. */
  totals: Array<{ label: string; value: string | number; tone?: ReportTone }>;
  /**
   * What THIS run found, in plain sentences — the summarised "about this report".
   * Every sentence is generated from the numbers above, never a stored blurb, so
   * it cannot describe a state the data does not show.
   */
  summary: string[];
  /** Visual breakdowns, all derived from the same rows the table shows. */
  charts: ReportChart[];
  /** Standing caveats about how the figures are built. */
  notes: string[];
}

/** Counts by a key, in descending order, with a cap and an "Other" fold. */
export function tally(
  values: Array<string | null | undefined>,
  options: { limit?: number; otherLabel?: string } = {}
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = (v ?? '').trim() || '—';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const limit = options.limit ?? 0;
  if (!limit || sorted.length <= limit) {
    return sorted.map(([label, value]) => ({ label, value }));
  }
  // Never invent a ninth colour: the tail folds into one honest bucket.
  const head = sorted.slice(0, limit - 1);
  const tail = sorted.slice(limit - 1);
  return [
    ...head.map(([label, value]) => ({ label, value })),
    { label: options.otherLabel ?? `Other (${tail.length})`, value: tail.reduce((n, [, v]) => n + v, 0) },
  ];
}

/** `12 of 49 (24.5%)`, or a plain count when a share would be meaningless. */
export function share(part: number, whole: number): string {
  return sharedShare(part, whole);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "Cruz, Juan" — or just the part that exists, never ", Juan". */
const personName = (p: { lastName?: string | null; firstName?: string | null }) =>
  [p.lastName?.trim(), p.firstName?.trim()].filter(Boolean).join(', ');
/** Subject-verb agreement, so a count of 1 does not read "1 requirement need". */
const verb = (n: number, singular: string, pluralForm: string) => (n === 1 ? singular : pluralForm);

export const REPORT_CATALOG: Array<{ key: ReportKey; title: string; description: string }> = [
  { key: 'headcount', title: 'Headcount', description: 'Active employees by unit, department and employment status.' },
  { key: 'attendance', title: 'Attendance', description: 'Attendance facts per employee for the selected period.' },
  { key: 'leave', title: 'Leave Requests', description: 'Leave requests filed in the period, by status and type.' },
  { key: 'compliance', title: 'Compliance Standing', description: 'Per-employee compliance status across active requirements.' },
  { key: 'training', title: 'Training & Seminars', description: 'Training activities and participation outcomes.' },
  { key: 'evaluations', title: 'Evaluations', description: 'Evaluation assignment progress for active cycles.' },
  { key: 'recruitment', title: 'Recruitment Pipeline', description: 'Job openings and applications by stage.' },
];

function parseRange(filters: ReportFilters): { from: Date | null; to: Date | null } {
  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;
  if (from && isNaN(from.getTime())) throw new AppError('Invalid start date.', 400);
  if (to && isNaN(to.getTime())) throw new AppError('Invalid end date.', 400);
  if (to) to.setHours(23, 59, 59, 999);
  if (from && to && from > to) throw new AppError('Start date must be on or before the end date.', 400);
  return { from, to };
}

function employeeWhere(filters: ReportFilters): Prisma.EmployeeWhereInput {
  // Delegates to the shared definition so Reports, Attendance Tally and the AI
  // fact sheet cannot silently diverge on what "the workforce" means.
  return activeWorkforceWhere({
    unitId: filters.unitId,
    departmentId: filters.departmentId,
    jobRoleId: filters.jobRoleId,
  });
}

export class ReportService {
  static async generate(key: ReportKey, filters: ReportFilters): Promise<ReportResult> {
    switch (key) {
      case 'headcount': return ReportService.headcount(filters);
      case 'attendance': return ReportService.attendance(filters);
      case 'leave': return ReportService.leave(filters);
      case 'compliance': return ReportService.compliance(filters);
      case 'training': return ReportService.training(filters);
      case 'evaluations': return ReportService.evaluations(filters);
      case 'recruitment': return ReportService.recruitment(filters);
      default:
        throw new AppError('Unknown report.', 400);
    }
  }

  // ── Headcount ──────────────────────────────────────────────────────────────
  private static async headcount(filters: ReportFilters): Promise<ReportResult> {
    const { from, to } = parseRange(filters);
    const where = employeeWhere(filters);

    const employees = await prisma.employee.findMany({
      where,
      select: {
        employeeNumber: true,
        firstName: true,
        lastName: true,
        employmentStatus: true,
        hireDate: true,
        unit: { select: { name: true } },
        department: { select: { name: true } },
        jobRole: { select: { title: true } },
      },
      orderBy: [{ unit: { name: 'asc' } }, { lastName: 'asc' }],
    });

    const newHires = from
      ? await prisma.employee.count({ where: { ...where, hireDate: { gte: from, ...(to ? { lte: to } : {}) } } })
      : 0;
    const separations = from
      ? await prisma.employee.count({
          where: {
            ...(filters.unitId ? { unitId: filters.unitId } : {}),
            separationDate: { gte: from, ...(to ? { lte: to } : {}) },
          },
        })
      : 0;

    return {
      key: 'headcount',
      title: 'Headcount',
      description: 'Active employees by unit, department and employment status.',
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      columns: [
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'name', label: 'Name' },
        { key: 'unit', label: 'Unit' },
        { key: 'department', label: 'Department' },
        { key: 'jobRole', label: 'Job Role' },
        { key: 'employmentStatus', label: 'Employment Status' },
        { key: 'hireDate', label: 'Hire Date' },
      ],
      rows: employees.map((e) => ({
        employeeNumber: e.employeeNumber,
        name: personName(e),
        unit: e.unit?.name ?? '—',
        department: e.department?.name ?? '—',
        jobRole: e.jobRole?.title ?? '—',
        employmentStatus: String(e.employmentStatus),
        hireDate: e.hireDate.toISOString().split('T')[0],
      })),
      totals: [
        { label: 'Active employees', value: employees.length },
        ...(from ? [{ label: 'Hired in period', value: newHires }] : []),
        ...(from ? [{ label: 'Separations in period', value: separations }] : []),
      ],
      summary: (() => {
        const units = tally(employees.map((e) => e.unit?.name));
        const biggest = units[0];
        const lines = [
          `${plural(employees.length, 'active employee')} across ${plural(units.length, 'unit')}.`,
        ];
        if (biggest) {
          lines.push(`The largest is ${biggest.label}, holding ${share(biggest.value, employees.length)} of the workforce.`);
        }
        const statuses = tally(employees.map((e) => String(e.employmentStatus)));
        const top = statuses[0];
        if (top) lines.push(`Most staff are ${top.label.replace(/_/g, ' ').toLowerCase()} — ${share(top.value, employees.length)}.`);
        if (from) {
          lines.push(
            newHires === 0 && separations === 0
              ? 'Nobody was hired or left during the selected period.'
              : `${plural(newHires, 'person', 'people')} joined and ${plural(separations, 'person', 'people')} left during the period.`
          );
        }
        return lines;
      })(),
      charts: [
        {
          id: 'headcount-by-unit',
          title: 'Where people work',
          subtitle: 'Active employees per unit',
          encoding: 'nominal',
          kind: 'bar',
          slices: tally(employees.map((e) => e.unit?.name), { limit: 8 }),
          total: employees.length,
          emptyMessage: 'No employees match these filters.',
        },
        {
          id: 'headcount-by-status',
          title: 'Employment status',
          subtitle: 'Share of the workforce',
          encoding: 'nominal',
          kind: 'share',
          slices: tally(employees.map((e) => String(e.employmentStatus).replace(/_/g, ' '))),
          total: employees.length,
        },
      ],
      notes: [
        'Counts active, non-archived employees only.',
        'Turnover rate is not reported — the formula and reporting period have not been confirmed by Hospicio de San Jose.',
      ],
    };
  }

  // ── Attendance ─────────────────────────────────────────────────────────────
  private static async attendance(filters: ReportFilters): Promise<ReportResult> {
    const { from, to } = parseRange(filters);
    if (!from || !to) {
      throw new AppError('Please choose a start and end date for the attendance report.', 400);
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere(filters),
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        unit: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }],
    });

    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: from, lte: to } },
      select: { employeeId: true, status: true, date: true },
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const calendarDays = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;

    const byEmployee = new Map<string, { counts: Record<string, number>; days: Set<string> }>();
    for (const emp of employees) byEmployee.set(emp.id, { counts: {}, days: new Set() });
    for (const rec of records) {
      const bucket = byEmployee.get(rec.employeeId);
      if (!bucket) continue;
      const status = String(rec.status);
      bucket.counts[status] = (bucket.counts[status] ?? 0) + 1;
      bucket.days.add(rec.date.toISOString().split('T')[0]);
    }

    const rows = employees.map((e) => {
      const bucket = byEmployee.get(e.id)!;
      return {
        employeeNumber: e.employeeNumber,
        name: personName(e),
        unit: e.unit?.name ?? '—',
        present: bucket.counts['PRESENT'] ?? 0,
        late: bucket.counts['LATE'] ?? 0,
        absent: bucket.counts['ABSENT'] ?? 0,
        onLeave: bucket.counts['ON_LEAVE'] ?? 0,
        halfDay: bucket.counts['HALF_DAY'] ?? 0,
        daysWithRecord: bucket.days.size,
        noImportedRecord: Math.max(0, calendarDays - bucket.days.size),
      };
    });

    return {
      key: 'attendance',
      title: 'Attendance',
      description: 'Attendance facts per employee for the selected period.',
      period: { from: from.toISOString(), to: to.toISOString() },
      columns: [
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'name', label: 'Name' },
        { key: 'unit', label: 'Unit' },
        { key: 'present', label: 'Present' },
        { key: 'late', label: 'Late' },
        { key: 'absent', label: 'Absent' },
        { key: 'onLeave', label: 'On Leave' },
        { key: 'halfDay', label: 'Half Day' },
        { key: 'daysWithRecord', label: 'Days With Record' },
        { key: 'noImportedRecord', label: 'No Imported Record' },
      ],
      rows,
      totals: [
        { label: 'Employees', value: rows.length },
        { label: 'Attendance records', value: records.length },
        { label: 'Calendar days in range', value: calendarDays },
      ],
      summary: (() => {
        const t = (f: 'present' | 'late' | 'absent' | 'onLeave' | 'halfDay' | 'noImportedRecord') =>
          rows.reduce((n, r) => n + (r[f] as number), 0);
        const possible = rows.length * calendarDays;
        const lines = [
          `${plural(records.length, 'attendance record')} for ${plural(rows.length, 'employee')} over ${plural(calendarDays, 'calendar day')}.`,
        ];
        if (records.length) {
          lines.push(`Present on ${share(t('present'), records.length)} of the records, late on ${t('late')}, explicitly absent on ${t('absent')}.`);
        }
        const gaps = t('noImportedRecord');
        if (gaps > 0 && possible > 0) {
          lines.push(`${share(gaps, possible)} of employee-days have no imported record at all — those are gaps in the data, not absences.`);
        }
        return lines;
      })(),
      charts: [
        {
          id: 'attendance-mix',
          title: 'What the records say',
          subtitle: 'Every imported attendance record in the period',
          encoding: 'status',
          kind: 'share',
          slices: [
            { label: 'Present', value: rows.reduce((n, r) => n + r.present, 0), tone: 'good' as const },
            { label: 'Late', value: rows.reduce((n, r) => n + r.late, 0), tone: 'warning' as const },
            { label: 'Half day', value: rows.reduce((n, r) => n + r.halfDay, 0), tone: 'warning' as const },
            // Being on approved leave is information, not something to review.
            { label: 'On leave', value: rows.reduce((n, r) => n + r.onLeave, 0), tone: 'neutral' as const },
            { label: 'Absent', value: rows.reduce((n, r) => n + r.absent, 0), tone: 'critical' as const },
          ].filter((x) => x.value > 0),
          total: records.length,
          emptyMessage: 'No attendance has been imported for this period.',
        },
        {
          id: 'attendance-coverage',
          title: 'Data coverage',
          subtitle: 'Employee-days with a record, against days with none',
          encoding: 'status',
          kind: 'share',
          slices: [
            { label: 'Has a record', value: rows.reduce((n, r) => n + r.daysWithRecord, 0), tone: 'good' as const },
            // Neutral on purpose: a missing record is not an absence and must
            // never be coloured like a problem with the employee.
            { label: 'No imported record', value: rows.reduce((n, r) => n + r.noImportedRecord, 0), tone: 'neutral' as const },
          ].filter((x) => x.value > 0),
          total: rows.length * calendarDays,
        },
      ],
      notes: [
        '"Absent" counts only records explicitly marked Absent.',
        '"No Imported Record" means attendance data has not been imported for that day. It is NOT an absence.',
      ],
    };
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  private static async leave(filters: ReportFilters): Promise<ReportResult> {
    const { from, to } = parseRange(filters);

    // createdAt is the moment of filing, so the picked days are Manila days, not UTC ones
    const where: Prisma.LeaveRequestWhereInput = { deletedAt: null };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = businessDayStartInstant(filters.dateFrom!);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lt = businessDayStartInstant(new Date(toBusinessDate(filters.dateTo!).getTime() + 86_400_000));
    }
    if (filters.unitId || filters.departmentId || filters.jobRoleId) {
      where.employee = {
        ...(filters.unitId ? { unitId: filters.unitId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.jobRoleId ? { jobRoleId: filters.jobRoleId } : {}),
      };
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      select: {
        leaveType: true,
        status: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        createdAt: true,
        employee: {
          select: { employeeNumber: true, firstName: true, lastName: true, unit: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus = requests.reduce<Record<string, number>>((acc, r) => {
      acc[String(r.status)] = (acc[String(r.status)] ?? 0) + 1;
      return acc;
    }, {});

    return {
      key: 'leave',
      title: 'Leave Requests',
      description: 'Leave requests filed in the period, by status and type.',
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      columns: [
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'name', label: 'Name' },
        { key: 'unit', label: 'Unit' },
        { key: 'leaveType', label: 'Leave Type' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'totalDays', label: 'Days' },
        { key: 'status', label: 'Status' },
        { key: 'filedOn', label: 'Filed On' },
      ],
      rows: requests.map((r) => ({
        employeeNumber: r.employee.employeeNumber,
        name: personName(r.employee),
        unit: r.employee.unit?.name ?? '—',
        leaveType: String(r.leaveType),
        startDate: r.startDate.toISOString().split('T')[0],
        endDate: r.endDate.toISOString().split('T')[0],
        totalDays: r.totalDays,
        status: String(r.status),
        filedOn: businessDateKey(r.createdAt),
      })),
      totals: [
        { label: 'Total requests', value: requests.length },
        ...Object.entries(byStatus).map(([status, count]) => ({ label: status, value: count, tone: statusTone(status) })),
      ],
      summary: (() => {
        const lines = [`${plural(requests.length, 'leave request')} filed in this period.`];
        const approved = byStatus['APPROVED'] ?? 0;
        const pending = (byStatus['PENDING'] ?? 0) + (byStatus['FOR_REVIEW'] ?? 0);
        if (requests.length) {
          lines.push(`${share(approved, requests.length)} approved.`);
          if (pending > 0) lines.push(`${plural(pending, 'request')} ${verb(pending, 'is', 'are')} still waiting on a decision.`);
        }
        const types = tally(requests.map((r) => String(r.leaveType)));
        if (types[0]) lines.push(`Most common reason: ${types[0].label.replace(/_/g, ' ').toLowerCase()} (${types[0].value}).`);
        return lines;
      })(),
      charts: [
        {
          id: 'leave-by-status',
          title: 'Where requests stand',
          encoding: 'status',
          kind: 'share',
          slices: [
            { label: 'Approved', value: byStatus['APPROVED'] ?? 0, tone: 'good' as const },
            { label: 'Pending', value: byStatus['PENDING'] ?? 0, tone: 'warning' as const },
            { label: 'For review', value: byStatus['FOR_REVIEW'] ?? 0, tone: 'review' as const },
            { label: 'Rejected', value: byStatus['REJECTED'] ?? 0, tone: 'critical' as const },
            { label: 'Cancelled', value: byStatus['CANCELLED'] ?? 0, tone: 'neutral' as const },
          ].filter((x) => x.value > 0),
          total: requests.length,
          emptyMessage: 'No leave was filed in this period.',
        },
        {
          id: 'leave-by-type',
          title: 'Why leave was taken',
          encoding: 'nominal',
          kind: 'bar',
          slices: tally(requests.map((r) => String(r.leaveType).replace(/_/g, ' ')), { limit: 8 }),
          total: requests.length,
        },
      ],
      notes: [
        'Leave days are counted as inclusive calendar days. Hospicio de San Jose has not yet confirmed a chargeable-day rule (weekend, holiday or rest-day exclusions).',
      ],
    };
  }

  // ── Compliance ─────────────────────────────────────────────────────────────
  private static async compliance(filters: ReportFilters): Promise<ReportResult> {
    const now = new Date();

    const [employees, requirements] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere(filters),
        select: {
          id: true, employeeNumber: true, firstName: true, lastName: true,
          unitId: true, departmentId: true, jobRoleId: true,
          unit: { select: { name: true } },
        },
        orderBy: [{ lastName: 'asc' }],
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

    const rows = employees.map((emp) => {
      const tally = { valid: 0, missing: 0, needsReview: 0, expiringSoon: 0, expired: 0, applicable: 0 };

      for (const req of requirements) {
        const applies = req.scopes.some((s) => {
          switch (s.scopeType) {
            case 'ALL': return true;
            case 'UNIT': return s.targetUnitId === emp.unitId;
            case 'DEPARTMENT': return s.targetDepartmentId === emp.departmentId;
            case 'JOB_ROLE': return s.targetJobRoleId === emp.jobRoleId;
            case 'EMPLOYEE': return s.targetEmployeeId === emp.id;
            default: return false;
          }
        });
        if (!applies) continue;
        tally.applicable++;

        const latest =
          req.category === 'MEDICAL'
            ? req.medicalRecords.find((r) => r.employeeId === emp.id)
            : req.category === 'PSYCHOLOGICAL'
            ? req.psychRecords.find((r) => r.employeeId === emp.id)
            : req.complianceRecords.find((r) => r.employeeId === emp.id);

        if (!latest) tally.missing++;
        else if (latest.reviewStatus === 'PENDING_REVIEW' || latest.reviewStatus === 'NEEDS_CORRECTION') tally.needsReview++;
        else if (latest.expiresAt && latest.expiresAt < now) tally.expired++;
        else if (latest.expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          if (latest.expiresAt <= threshold) tally.expiringSoon++;
          else tally.valid++;
        } else tally.valid++;
      }

      return {
        employeeNumber: emp.employeeNumber,
        name: personName(emp),
        unit: emp.unit?.name ?? '—',
        applicable: tally.applicable,
        valid: tally.valid,
        missing: tally.missing,
        needsReview: tally.needsReview,
        expiringSoon: tally.expiringSoon,
        expired: tally.expired,
      };
    });

    const sum = (field: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

    return {
      key: 'compliance',
      title: 'Compliance Standing',
      description: 'Per-employee compliance status across active requirements.',
      period: { from: null, to: null },
      columns: [
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'name', label: 'Name' },
        { key: 'unit', label: 'Unit' },
        { key: 'applicable', label: 'Applicable' },
        { key: 'valid', label: 'Valid' },
        { key: 'missing', label: 'Missing' },
        { key: 'needsReview', label: 'Needs Review' },
        { key: 'expiringSoon', label: 'Expiring Soon' },
        { key: 'expired', label: 'Expired' },
      ],
      rows,
      totals: [
        { label: 'Employees', value: rows.length },
        { label: 'Active requirements', value: requirements.length },
        { label: 'Missing', value: sum('missing'), tone: 'critical' as const },
        { label: 'Expired', value: sum('expired'), tone: 'critical' as const },
        { label: 'Expiring soon', value: sum('expiringSoon'), tone: 'warning' as const },
        { label: 'Needs review', value: sum('needsReview'), tone: 'review' as const },
      ],
      summary: (() => {
        const missing = sum('missing'), expired = sum('expired');
        const expiring = sum('expiringSoon'), review = sum('needsReview');
        const valid = sum('valid');
        const applicable = rows.reduce((n, r) => n + r.applicable, 0);
        const lines = [
          `${plural(rows.length, 'employee')} measured against ${plural(requirements.length, 'active requirement')}.`,
        ];
        if (applicable) lines.push(`${share(valid, applicable)} applicable requirements are currently valid.`);
        const attention = missing + expired;
        lines.push(
          attention === 0
            ? 'Nothing is missing or expired right now.'
            : `${plural(attention, 'requirement')} ${verb(attention, 'needs', 'need')} attention now — ${missing} missing, ${expired} expired.`
        );
        if (expiring) lines.push(`${plural(expiring, 'requirement')} will expire soon.`);
        if (review) lines.push(`${plural(review, 'submission')} ${verb(review, 'is', 'are')} awaiting HR review.`);
        return lines;
      })(),
      charts: [
        {
          id: 'compliance-standing',
          title: 'Compliance standing',
          subtitle: 'Every applicable employee-requirement pair',
          encoding: 'status',
          kind: 'share',
          slices: [
            { label: 'Valid', value: sum('valid'), tone: 'good' as const },
            { label: 'Expiring soon', value: sum('expiringSoon'), tone: 'warning' as const },
            { label: 'Needs review', value: sum('needsReview'), tone: 'review' as const },
            { label: 'Expired', value: sum('expired'), tone: 'critical' as const },
            { label: 'Missing', value: sum('missing'), tone: 'critical' as const },
          ].filter((x) => x.value > 0),
          total: rows.reduce((n, r) => n + r.applicable, 0),
          emptyMessage: 'No requirements apply to the selected employees.',
        },
        {
          id: 'compliance-attention-by-unit',
          title: 'Where attention is needed',
          subtitle: 'Missing or expired requirements per unit',
          encoding: 'nominal',
          kind: 'bar',
          slices: (() => {
            const byUnit = new Map<string, number>();
            for (const r of rows) {
              const n = r.missing + r.expired;
              if (!n) continue;
              byUnit.set(r.unit, (byUnit.get(r.unit) ?? 0) + n);
            }
            return [...byUnit.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, value]) => ({ label, value }));
          })(),
          emptyMessage: 'Nothing is missing or expired.',
        },
      ],
      notes: [
        'Status is derived at report time from current records and HR-entered expiry dates.',
        '"Expiring soon" only applies where HR configured a reminder window on the requirement.',
      ],
    };
  }

  // ── Training ───────────────────────────────────────────────────────────────
  private static async training(filters: ReportFilters): Promise<ReportResult> {
    const { from, to } = parseRange(filters);

    const where: Prisma.TrainingActivityWhereInput = { deletedAt: null };
    if (from || to) {
      where.startDate = {};
      if (from) (where.startDate as Prisma.DateTimeFilter).gte = from;
      if (to) (where.startDate as Prisma.DateTimeFilter).lte = to;
    }

    const activities = await prisma.trainingActivity.findMany({
      where,
      select: {
        title: true, type: true, provider: true, venue: true,
        startDate: true, endDate: true, status: true, hoursCredit: true,
        participants: { select: { participationStatus: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const rows = activities.map((a) => {
      const counts = a.participants.reduce<Record<string, number>>((acc, p) => {
        acc[String(p.participationStatus)] = (acc[String(p.participationStatus)] ?? 0) + 1;
        return acc;
      }, {});
      return {
        title: a.title,
        type: String(a.type),
        provider: a.provider,
        venue: a.venue,
        startDate: a.startDate.toISOString().split('T')[0],
        endDate: a.endDate.toISOString().split('T')[0],
        status: String(a.status),
        hoursCredit: a.hoursCredit ?? 0,
        assigned: a.participants.length,
        completed: counts['COMPLETED'] ?? 0,
        didNotAttend: counts['DID_NOT_ATTEND'] ?? 0,
        excused: counts['EXCUSED'] ?? 0,
      };
    });

    const assigned = rows.reduce((s, r) => s + r.assigned, 0);
    const completed = rows.reduce((s, r) => s + r.completed, 0);

    return {
      key: 'training',
      title: 'Training & Seminars',
      description: 'Training activities and participation outcomes.',
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      columns: [
        { key: 'title', label: 'Activity' },
        { key: 'type', label: 'Type' },
        { key: 'provider', label: 'Provider' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'status', label: 'Status' },
        { key: 'hoursCredit', label: 'Hours' },
        { key: 'assigned', label: 'Assigned' },
        { key: 'completed', label: 'Completed' },
        { key: 'didNotAttend', label: 'Did Not Attend' },
        { key: 'excused', label: 'Excused' },
      ],
      rows,
      totals: [
        { label: 'Activities', value: rows.length },
        { label: 'Participants assigned', value: assigned },
        { label: 'Completed', value: completed, tone: 'good' as const },
        { label: 'Completion rate', value: assigned > 0 ? `${formatPercent(ratio(completed, assigned))} (${completed} of ${assigned})` : '—', tone: 'good' as const },
      ],
      summary: (() => {
        const noShow = rows.reduce((n, r) => n + r.didNotAttend, 0);
        const excused = rows.reduce((n, r) => n + r.excused, 0);
        const lines = [`${plural(rows.length, 'training activity', 'training activities')} with ${plural(assigned, 'participant')} assigned.`];
        if (assigned) lines.push(`${share(completed, assigned)} completed.`);
        if (noShow) lines.push(`${plural(noShow, 'participant')} did not attend; ${excused} ${verb(excused, 'was', 'were')} excused.`);
        const types = tally(rows.map((r) => String(r.type).replace(/_/g, ' ')));
        if (types[0] && types.length > 1) lines.push(`Most activities were ${types[0].label.toLowerCase()} (${types[0].value}).`);
        return lines;
      })(),
      charts: [
        {
          id: 'training-outcomes',
          title: 'Participation outcomes',
          subtitle: 'Every assigned participant in the period',
          encoding: 'status',
          kind: 'share',
          slices: [
            { label: 'Completed', value: completed, tone: 'good' as const },
            { label: 'Excused', value: rows.reduce((n, r) => n + r.excused, 0), tone: 'review' as const },
            { label: 'Did not attend', value: rows.reduce((n, r) => n + r.didNotAttend, 0), tone: 'critical' as const },
          ].filter((x) => x.value > 0),
          total: assigned,
          emptyMessage: 'No participants were assigned in this period.',
        },
        {
          id: 'training-by-activity',
          title: 'Largest activities',
          subtitle: 'Participants assigned per activity',
          encoding: 'nominal',
          kind: 'bar',
          slices: rows
            .map((r) => ({ label: String(r.title), value: r.assigned }))
            .filter((x) => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8),
        },
      ],
      notes: ['Filtered by activity start date.'],
    };
  }

  // ── Evaluations ────────────────────────────────────────────────────────────
  private static async evaluations(filters: ReportFilters): Promise<ReportResult> {
    const assignments = await prisma.evaluationAssignment.findMany({
      where: {
        deletedAt: null,
        ...(filters.unitId || filters.departmentId || filters.jobRoleId
          ? {
              employee: {
                ...(filters.unitId ? { unitId: filters.unitId } : {}),
                ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
                ...(filters.jobRoleId ? { jobRoleId: filters.jobRoleId } : {}),
              },
            }
          : {}),
      },
      select: {
        status: true, dueDate: true, submittedAt: true, finalizedAt: true, raterType: true, employeeId: true, cycleId: true,
        discussionCompletedAt: true,
        cycle: { select: { name: true, status: true } },
        employee: { select: { employeeNumber: true, firstName: true, lastName: true, unit: { select: { name: true } } } },
        evaluator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const byStatus = assignments.reduce<Record<string, number>>((acc, a) => {
      acc[String(a.status)] = (acc[String(a.status)] ?? 0) + 1;
      return acc;
    }, {});

    return {
      key: 'evaluations',
      title: 'Evaluations',
      description: 'Evaluation assignment progress.',
      period: { from: null, to: null },
      columns: [
        { key: 'cycle', label: 'Cycle' },
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'name', label: 'Employee' },
        { key: 'unit', label: 'Unit' },
        { key: 'rating', label: 'Rating by' },
        { key: 'evaluator', label: 'Evaluator' },
        { key: 'dueDate', label: 'Due' },
        { key: 'status', label: 'Status' },
        { key: 'overdue', label: 'Overdue' },
      ],
      rows: assignments.map((a) => ({
        cycle: a.cycle.name,
        employeeNumber: a.employee.employeeNumber,
        name: personName(a.employee),
        unit: a.employee.unit?.name ?? '—',
        rating: a.raterType === 'SELF' ? 'Self' : a.raterType === 'PEER' ? 'Peer' : 'Head / supervisor / coordinator',
        evaluator: personName(a.evaluator),
        dueDate: a.dueDate.toISOString().split('T')[0],
        status: String(a.status),
        overdue:
          a.dueDate < now && (a.status === 'NOT_STARTED' || a.status === 'IN_PROGRESS') ? 'Yes' : 'No',
      })),
      totals: [
        { label: 'Assignments (all raters)', value: assignments.length },
        { label: 'Employees evaluated', value: new Set(assignments.map((a) => `${a.cycleId}|${a.employeeId}`)).size },
        { label: 'Head evaluations finalised', value: assignments.filter((a) => a.raterType === 'HEAD' && a.status === 'FINALIZED').length, tone: 'good' as const },
        { label: 'Discussions recorded', value: assignments.filter((a) => a.raterType === 'HEAD' && a.discussionCompletedAt).length, tone: 'good' as const },
        ...Object.entries(byStatus).map(([status, count]) => ({ label: status, value: count, tone: statusTone(status) })),
      ],
      summary: (() => {
        const submitted = (byStatus['SUBMITTED'] ?? 0) + (byStatus['FINALIZED'] ?? 0);
        const notStarted = byStatus['NOT_STARTED'] ?? 0;
        const overdue = assignments.filter(
          (a) => a.dueDate < now && a.status !== 'SUBMITTED' && a.status !== 'FINALIZED'
        ).length;
        const lines = [`${plural(assignments.length, 'evaluation assignment')} across the active cycles.`];
        if (assignments.length) lines.push(`${share(submitted, assignments.length)} submitted.`);
        if (notStarted) lines.push(`${plural(notStarted, 'assignment')} ${verb(notStarted, 'has', 'have')} not been started.`);
        if (overdue) lines.push(`${plural(overdue, 'assignment')} ${verb(overdue, 'is', 'are')} past the due date.`);
        return lines;
      })(),
      charts: [
        {
          // Ordinal: these stages have an order, so the colour carries it.
          id: 'evaluation-progress',
          title: 'How far the cycle has got',
          subtitle: 'Assignments by stage',
          encoding: 'ordinal',
          kind: 'share',
          slices: [
            { label: 'Not started', value: byStatus['NOT_STARTED'] ?? 0 },
            { label: 'In progress', value: byStatus['IN_PROGRESS'] ?? 0 },
            { label: 'Submitted', value: byStatus['SUBMITTED'] ?? 0 },
            { label: 'Finalized', value: byStatus['FINALIZED'] ?? 0 },
          ].filter((x) => x.value > 0),
          total: assignments.length,
          emptyMessage: 'No evaluation assignments exist for the active cycles.',
        },
        {
          id: 'evaluation-by-unit',
          title: 'Assignments per unit',
          encoding: 'nominal',
          kind: 'bar',
          slices: tally(assignments.map((a) => a.employee.unit?.name), { limit: 8 }),
          total: assignments.length,
        },
      ],
      notes: ['Individual scores are not included in this report.'],
    };
  }

  // ── Recruitment ────────────────────────────────────────────────────────────
  private static async recruitment(filters: ReportFilters): Promise<ReportResult> {
    const { from, to } = parseRange(filters);

    const where: Prisma.JobApplicationWhereInput = {};
    if (from || to) {
      where.applicationDate = {};
      if (from) (where.applicationDate as Prisma.DateTimeFilter).gte = from;
      if (to) (where.applicationDate as Prisma.DateTimeFilter).lte = to;
    }
    if (filters.unitId) where.jobOpening = { unitId: filters.unitId };

    const [applications, openOpenings] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        select: {
          referenceNumber: true, status: true, applicationDate: true,
          jobOpening: { select: { title: true, referenceNumber: true, unit: { select: { name: true } } } },
        },
        orderBy: { applicationDate: 'desc' },
      }),
      prisma.jobOpening.count({ where: { status: 'OPEN' } }),
    ]);

    const byStatus = applications.reduce<Record<string, number>>((acc, a) => {
      acc[String(a.status)] = (acc[String(a.status)] ?? 0) + 1;
      return acc;
    }, {});

    return {
      key: 'recruitment',
      title: 'Recruitment Pipeline',
      description: 'Job openings and applications by stage.',
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      columns: [
        { key: 'referenceNumber', label: 'Application Ref.' },
        { key: 'jobTitle', label: 'Position' },
        { key: 'jobReference', label: 'Opening Ref.' },
        { key: 'unit', label: 'Unit' },
        { key: 'status', label: 'Stage' },
        { key: 'applicationDate', label: 'Applied On' },
      ],
      // Applicant names are intentionally excluded from the exportable report.
      rows: applications.map((a) => ({
        referenceNumber: a.referenceNumber,
        jobTitle: a.jobOpening.title,
        jobReference: a.jobOpening.referenceNumber,
        unit: a.jobOpening.unit?.name ?? '—',
        status: String(a.status),
        applicationDate: a.applicationDate.toISOString().split('T')[0],
      })),
      totals: [
        { label: 'Applications', value: applications.length },
        { label: 'Job Openings', value: openOpenings },
        ...Object.entries(byStatus).map(([status, count]) => ({ label: status, value: count, tone: statusTone(status) })),
      ],
      summary: (() => {
        const hired = byStatus['HIRED'] ?? 0;
        const rejected = byStatus['REJECTED'] ?? 0;
        const live = applications.length - hired - rejected - (byStatus['WITHDRAWN'] ?? 0);
        const lines = [`${plural(applications.length, 'application')} against ${plural(openOpenings, 'open job opening')}.`];
        if (applications.length) {
          lines.push(`${plural(Math.max(0, live), 'application')} ${verb(live, 'is', 'are')} still moving through the pipeline.`);
          if (hired) lines.push(`${share(hired, applications.length)} hired.`);
        }
        const roles = tally(applications.map((a) => a.jobOpening?.title));
        if (roles[0] && applications.length) lines.push(`Most applications were for ${roles[0].label} (${roles[0].value}).`);
        return lines;
      })(),
      charts: [
        {
          id: 'recruitment-pipeline',
          title: 'Pipeline',
          subtitle: 'Applications by stage, in order',
          encoding: 'nominal',
          kind: 'bar',
          slices: [
            { label: 'Submitted', value: byStatus['SUBMITTED'] ?? 0 },
            { label: 'Under review', value: byStatus['UNDER_REVIEW'] ?? 0 },
            { label: 'Shortlisted', value: byStatus['SHORTLISTED'] ?? 0 },
            { label: 'For interview', value: byStatus['FOR_INTERVIEW'] ?? 0 },
            { label: 'Interviewed', value: byStatus['INTERVIEWED'] ?? 0 },
            { label: 'For requirements', value: byStatus['FOR_REQUIREMENTS'] ?? 0 },
            { label: 'Hired', value: byStatus['HIRED'] ?? 0 },
          ].filter((x) => x.value > 0),
          total: applications.length,
          emptyMessage: 'No applications were received in this period.',
        },
        {
          id: 'recruitment-by-role',
          title: 'Which roles draw applicants',
          encoding: 'nominal',
          kind: 'bar',
          slices: tally(applications.map((a) => a.jobOpening?.title), { limit: 8 }),
          total: applications.length,
        },
      ],
      notes: ['Applicant names are excluded from this report to limit unnecessary distribution of personal data.'],
    };
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  static toExcel(report: ReportResult): Promise<Buffer> {
    return reportToExcel(report);
  }

  static toPdf(report: ReportResult): Promise<Buffer> {
    return reportToPdf(report);
  }

  static toCsv(report: ReportResult): string {
    return reportToCsv(report);
  }
}
