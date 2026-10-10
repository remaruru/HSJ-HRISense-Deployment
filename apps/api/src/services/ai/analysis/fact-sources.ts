import { buildChart, ChartPayload, ChartType, DatasetStore } from '../charts/chart-schema';
import type { WorkforceFacts } from '../workforce-facts.service';

/**
 * Where each part of HR's workforce fact sheet comes from.
 *
 * The AI summary cites these KEYS (a closed list) instead of free text, so the
 * "Based on" line under every observation can be:
 *   • a link to the HRISense page that holds the underlying records, and
 *   • a chart drawn from the SAME fact sheet the model read — built here on the
 *     server, never from numbers the model wrote.
 */

type Row = Record<string, string | number | null>;

interface FactSource {
  key: string;
  label: string;
  /** What the model is told the key covers (fact-sheet field names). */
  covers: string;
  /** The HR page holding the underlying records. */
  path: string;
  chartType: ChartType;
  dataset: (f: WorkforceFacts) => { title: string; xKey: string; xLabel: string; unit: string; series: Array<{ key: string; label: string }>; rows: Row[] } | null;
}

const humanise = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const statusRows = (pairs: Array<{ status: string; count: number }>, key = 'count'): Row[] =>
  pairs.map((p) => ({ label: humanise(String(p.status)), [key]: p.count }));

export const FACT_SOURCES: FactSource[] = [
  {
    key: 'headcount_by_unit',
    label: 'Headcount by unit',
    covers: 'headcount.totalActive, headcount.byUnit',
    path: '/employees',
    chartType: 'bar',
    dataset: (f) => ({
      title: 'Active employees by unit',
      xKey: 'label',
      xLabel: 'Unit',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: f.headcount.byUnit.map((u) => ({ label: u.unit, employees: u.count })),
    }),
  },
  {
    key: 'employment_status',
    label: 'Employment status',
    covers: 'headcount.byEmploymentStatus',
    path: '/employees',
    chartType: 'pie',
    dataset: (f) => ({
      title: 'Active employees by employment status',
      xKey: 'label',
      xLabel: 'Status',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: statusRows(f.headcount.byEmploymentStatus, 'employees'),
    }),
  },
  {
    key: 'hires_and_separations',
    label: 'Hires and separations',
    covers: 'headcount.newHiresInPeriod, headcount.separationsInPeriod',
    path: '/employees',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Hires and separations — last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Movement',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: [
        { label: 'New hires', employees: f.headcount.newHiresInPeriod },
        { label: 'Separations', employees: f.headcount.separationsInPeriod },
      ],
    }),
  },
  {
    key: 'supervisor_assignment',
    label: 'Supervisor assignments',
    covers: 'headcount.pendingSupervisorAssignment',
    path: '/employees/org-chart',
    chartType: 'bar',
    dataset: (f) => ({
      title: 'Supervisor assignment',
      xKey: 'label',
      xLabel: 'Employees',
      unit: 'employees',
      series: [{ key: 'employees', label: 'Employees' }],
      rows: [
        { label: 'Assignment pending', employees: f.headcount.pendingSupervisorAssignment },
        { label: 'Other active employees', employees: Math.max(0, f.headcount.totalActive - f.headcount.pendingSupervisorAssignment) },
      ],
    }),
  },
  {
    key: 'attendance_records',
    label: 'Attendance records by status',
    covers: 'attendance.byStatus, attendance.recordCount, attendance.presentRate, attendance.lateCount',
    path: '/attendance/tally',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Imported attendance records by status — last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Status',
      unit: 'records',
      series: [{ key: 'records', label: 'Records' }],
      rows: statusRows(f.attendance.byStatus, 'records'),
    }),
  },
  {
    key: 'attendance_coverage',
    label: 'Attendance data coverage',
    covers: 'attendance.daysWithNoImportedRecord, attendance.recordCount, attendance.hasData',
    path: '/attendance/daily',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Employee-days with and without an imported record — last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Employee-days',
      unit: 'employee-days',
      series: [{ key: 'days', label: 'Employee-days' }],
      rows: [
        { label: 'Has an imported record', days: Math.max(0, f.headcount.totalActive * f.periodDays - f.attendance.daysWithNoImportedRecord) },
        { label: 'No imported record (not absence)', days: f.attendance.daysWithNoImportedRecord },
      ],
    }),
  },
  {
    key: 'leave_status',
    label: 'Leave requests by status',
    covers: 'leave.byStatus, leave.awaitingDecision, leave.totalRequestsInPeriod',
    path: '/leave/requests',
    chartType: 'pie',
    dataset: (f) => ({
      title: `Leave requests filed by status — last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Status',
      unit: 'requests',
      series: [{ key: 'requests', label: 'Requests' }],
      rows: statusRows(f.leave.byStatus, 'requests'),
    }),
  },
  {
    key: 'leave_type',
    label: 'Leave requests by type',
    covers: 'leave.byType',
    path: '/leave/requests',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Leave requests filed by type — last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Leave type',
      unit: 'requests',
      series: [{ key: 'requests', label: 'Requests' }],
      rows: f.leave.byType.map((t) => ({ label: humanise(t.type), requests: t.count })),
    }),
  },
  {
    key: 'compliance_standing',
    label: 'Compliance standing',
    covers: 'compliance.byStatus, compliance.missing, compliance.needsReview, compliance.expiringSoon, compliance.expired, compliance.activeRequirements',
    path: '/compliance',
    chartType: 'bar',
    dataset: (f) => ({
      title: 'Compliance checks by status',
      xKey: 'label',
      xLabel: 'Status',
      unit: 'checks',
      series: [{ key: 'checks', label: 'Requirement checks' }],
      rows: statusRows(f.compliance.byStatus, 'checks'),
    }),
  },
  {
    key: 'training_participation',
    label: 'Training participation',
    covers: 'training.activitiesInPeriod, training.participantsAssigned, training.participantsCompleted, training.participantsDidNotAttend, training.completionRate',
    path: '/training',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Training participants — activities in the last ${f.periodDays} days`,
      xKey: 'label',
      xLabel: 'Participants',
      unit: 'participants',
      series: [{ key: 'participants', label: 'Participants' }],
      rows: [
        { label: 'Assigned (all)', participants: f.training.participantsAssigned },
        { label: 'Completed', participants: f.training.participantsCompleted },
        { label: 'Did not attend', participants: f.training.participantsDidNotAttend },
      ],
    }),
  },
  {
    key: 'evaluation_progress',
    label: 'Evaluation progress',
    covers: 'evaluations.activeCycles, evaluations.assignmentsTotal, evaluations.byStatus, evaluations.overdue',
    path: '/evaluations',
    chartType: 'bar',
    dataset: (f) => ({
      title: 'Evaluation assignments in active cycles, by status',
      xKey: 'label',
      xLabel: 'Status',
      unit: 'assignments',
      series: [{ key: 'assignments', label: 'Assignments' }],
      rows: [...statusRows(f.evaluations.byStatus, 'assignments'), { label: 'Overdue (not finished)', assignments: f.evaluations.overdue }],
    }),
  },
  {
    key: 'recruitment_pipeline',
    label: 'Recruitment pipeline',
    covers: 'recruitment.openOpenings, recruitment.applicationsInPeriod, recruitment.byStatus',
    path: '/recruitment/applicants',
    chartType: 'bar',
    dataset: (f) => ({
      title: `Applications received in the last ${f.periodDays} days, by stage`,
      xKey: 'label',
      xLabel: 'Stage',
      unit: 'applications',
      series: [{ key: 'applications', label: 'Applications' }],
      rows: statusRows(f.recruitment.byStatus, 'applications'),
    }),
  },
];

export const FACT_SOURCE_KEYS = FACT_SOURCES.map((s) => s.key) as [string, ...string[]];
const BY_KEY = new Map(FACT_SOURCES.map((s) => [s.key, s]));

/** The catalogue as the model sees it. */
export function factSourceGuide(): string {
  return FACT_SOURCES.map((s) => `- ${s.key}: ${s.covers}`).join('\n');
}

/**
 * When the model gave no valid keys, infer them from its free-text basis
 * (which quotes fact-sheet field names such as "compliance.missing").
 */
export function inferSources(basis: string): string[] {
  const text = basis.toLowerCase();
  const found: string[] = [];
  for (const s of FACT_SOURCES) {
    const fields = s.covers.split(',').map((x) => x.trim().toLowerCase());
    if (fields.some((f) => text.includes(f))) found.push(s.key);
  }
  if (!found.length) {
    // Fall back to the section name alone ("compliance", "leave"…).
    const section = (/\b(headcount|attendance|leave|compliance|training|evaluations|recruitment)\b/.exec(text) ?? [])[1];
    const first = FACT_SOURCES.find((s) => s.covers.startsWith(`${section}.`));
    if (first) found.push(first.key);
  }
  return found;
}

export interface SourceRef {
  key: string;
  label: string;
  path: string;
  chart: ChartPayload | null;
}

/** Resolves keys to links and server-built charts (null when there is nothing to plot). */
export function resolveSources(keys: string[], facts: WorkforceFacts, cache: Map<string, SourceRef>): SourceRef[] {
  const out: SourceRef[] = [];
  for (const key of [...new Set(keys)].slice(0, 3)) {
    const source = BY_KEY.get(key);
    if (!source) continue;
    if (!cache.has(key)) {
      const store = new DatasetStore();
      const spec = source.dataset(facts);
      const id = spec ? store.add({ ...spec, xType: 'category' }) : null;
      const built = id ? buildChart(store, { datasetId: id, type: spec!.rows.length > 12 && source.chartType === 'pie' ? 'bar' : source.chartType }) : null;
      cache.set(key, { key, label: source.label, path: source.path, chart: built && built.ok ? built.chart : null });
    }
    out.push(cache.get(key)!);
  }
  return out;
}
