import { PermissionTier } from '@prisma/client';
import type { ChartType } from '../charts/chart-schema';
import type { AttendanceMetrics } from '../analytics/attendance-metrics';
import { monthStartKey } from '../tools/person.tools';
import { humanise } from '../tools/tool-helpers';

/**
 * Quick analytics — deterministic analytical views that need NO AI provider.
 *
 * Each view is a fixed, server-side recipe: one of the assistant's own tools
 * with fixed arguments, the datasets to chart, and a templated summary built
 * only from the tool's figures. The browser sends a view id and nothing else,
 * so a view can never be pointed at another person or widened; and it runs
 * through the same `executeTool`, so the same tier and scope checks apply.
 *
 * They exist so HRISense's analytics are usable (and verifiable) before an AI
 * key is configured, and remain as instant, zero-cost views afterwards.
 */

type Data = any;

export interface QuickViewChart {
  pick: (data: Data) => string | null | undefined;
  type: ChartType;
  seriesKeys?: string[];
  title?: string;
}

export interface QuickView {
  id: string;
  label: string;
  group: 'You' | 'Your team' | 'Organisation';
  tiers: readonly PermissionTier[];
  tool: string;
  args: (today: string) => Record<string, unknown>;
  charts: QuickViewChart[];
  summarize: (data: Data) => string;
  links?: Array<{ path: string; label: string }>;
}

const ALL = [PermissionTier.FULL, PermissionTier.SUPERVISOR, PermissionTier.STANDARD] as const;
const TEAM = [PermissionTier.FULL, PermissionTier.SUPERVISOR] as const;
const HR = [PermissionTier.FULL] as const;

const n = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—');
const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;
const chartAt = (i: number) => (d: Data) => d?.charts?.[i]?.datasetId;
const theChart = (d: Data) => d?.chart?.datasetId;

/** The standard attendance explanation, from the metrics only. */
export function attendanceText(scope: string, m: AttendanceMetrics, period: string): string {
  if (!m || m.daysWithRecord === 0) {
    return `No attendance records have been imported for ${scope} for ${period}, so there is nothing to measure yet. Days without a record are **not absences** — the biometric export for these dates has not been imported.`;
  }
  const lines = [
    `**Attendance for ${scope}, ${period}**`,
    `- Presence days: **${n(m.presenceDays)}** (Present ${n(m.presentDays)}, Late ${n(m.lateDays)}, Half day ${n(m.halfDays)}); explicit Absent records: **${n(m.recordedAbsentDays)}**.`,
    `- Attendance rate on recorded days: **${m.attendanceRate === null ? 'not available' : `${n(m.attendanceRate)}%`}** — presence ÷ (presence + recorded absent).`,
    m.recordCoverage === null
      ? `- Record coverage: **cannot be calculated** — no day in this period is a scheduled workday (the weekly schedule is not configured).`
      : `- Record coverage: **${n(m.recordCoverage)}%** of scheduled workdays have a record (${n(m.scheduledWorkdaysWithRecord)} of ${n(m.scheduledWorkdays)}).`,
    `- No imported record: **${plural(m.noImportedRecordDays, 'calendar day')}** — not counted as absence.`,
    `- Approved leave ${plural(m.approvedLeaveDays, 'day')}, holidays ${plural(m.holidayDays, 'day')}, days off ${plural(m.dayOffDays, 'day')}; hours worked ${n(m.totalHoursWorked)}.`,
  ];
  return lines.join('\n');
}

function periodText(data: Data): string {
  const p = data?.period;
  return p ? `${p.from} to ${p.to}` : 'the selected period';
}

function noDataPeriods(data: Data): string {
  const list: string[] = data?.periodsWithNoImportedData ?? [];
  const span = data?.attendanceDataAvailable;
  const parts: string[] = [];
  if (list.length) parts.push(`No attendance was imported for: ${list.join(', ')} — shown as gaps, not as 0%.`);
  if (span?.first) parts.push(`Imported attendance exists from ${span.first} to ${span.last}.`);
  return parts.length ? `\n\n${parts.join(' ')}` : '';
}

function countsLine(title: string, counts: Record<string, number> | undefined): string {
  const entries = Object.entries(counts ?? {}).filter(([, v]) => v > 0);
  if (!entries.length) return `**${title}:** none.`;
  return `**${title}:** ${entries.map(([k, v]) => `${humanise(k)} ${n(v)}`).join(' · ')}`;
}

export const QUICK_VIEWS: QuickView[] = [
  // ── You ──────────────────────────────────────────────────────────────────
  {
    id: 'my-attendance-6-months',
    label: 'My attendance — last 6 months',
    group: 'You',
    tiers: ALL,
    tool: 'get_attendance_summary',
    args: () => ({}),
    charts: [
      { pick: chartAt(0), type: 'line' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) => `${attendanceText('you', d.totals, periodText(d))}${noDataPeriods(d)}`,
    links: [{ path: '/attendance/daily', label: 'Daily Monitoring' }],
  },
  {
    id: 'my-attendance-this-month',
    label: 'My attendance — this month',
    group: 'You',
    tiers: ALL,
    tool: 'get_attendance',
    args: (today) => ({ from: monthStartKey(today, 0), to: today }),
    charts: [
      { pick: chartAt(1), type: 'pie' },
      { pick: chartAt(0), type: 'bar' },
    ],
    summarize: (d) => attendanceText('you', d.metrics, periodText(d)),
  },
  {
    id: 'my-leave-balances',
    label: 'My leave balances',
    group: 'You',
    tiers: ALL,
    tool: 'get_leave_balances',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      d.hasBalances
        ? `**Leave balances for ${d.year}**\n${(d.balances as any[])
            .map((b) => `- ${b.leaveType}: **${n(b.available)} available** (allotted ${n(b.allotted)}, used ${n(b.used)}, pending ${n(b.pending)}, forfeited ${n(b.forfeited)})`)
            .join('\n')}\n\nAvailable = allotted − used − pending − forfeited.`
        : `No leave balances have been set up for you for ${d.year} yet. HR sets balances; nothing is assumed.`,
    links: [{ path: '/leave/new', label: 'File a Leave Request' }],
  },
  {
    id: 'my-leave-requests',
    label: 'My leave requests by status',
    group: 'You',
    tiers: ALL,
    tool: 'get_leave_requests',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'pie' }],
    summarize: (d) =>
      (d.requests as any[]).length
        ? `${countsLine('Your leave requests', d.countsByStatus)}\n\nPENDING waits for your supervisor's endorsement; FOR_REVIEW waits for HR.`
        : 'You have not filed any leave requests.',
    links: [{ path: '/leave/requests', label: 'Leave Requests' }],
  },
  {
    id: 'my-compliance',
    label: 'My compliance status',
    group: 'You',
    tiers: ALL,
    tool: 'get_compliance_status',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'pie' }],
    summarize: (d) => {
      const reqs = d.requirements as any[];
      if (!reqs.length) return 'No active compliance requirement applies to you.';
      const attention = reqs.filter((r) => r.status !== 'VALID');
      return `${countsLine('Your compliance requirements', d.countsByStatus)}${
        attention.length
          ? `\n\n**Needing attention:**\n${attention.map((r) => `- ${r.requirement}: ${humanise(r.status)}${r.expiresOn ? ` (expires ${r.expiresOn})` : ''}`).join('\n')}`
          : '\n\nEverything is valid.'
      }`;
    },
  },
  {
    id: 'my-training',
    label: 'My training history',
    group: 'You',
    tiers: ALL,
    tool: 'get_training_history',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      (d.activities as any[]).length
        ? `${countsLine('Your training', d.countsByParticipation)}\n\nCompleted training hours: **${n(d.completedHours)}**.`
        : 'You have not been assigned to any training activity yet.',
  },
  {
    id: 'my-schedule-week',
    label: 'My schedule — next 7 days',
    group: 'You',
    tiers: ALL,
    tool: 'get_schedule',
    args: () => ({}),
    charts: [],
    summarize: (d) =>
      `**Your schedule, ${d.period.from} to ${d.period.to}**\n\n| Date | Day | Schedule |\n|---|---|---|\n${(d.days as any[])
        .map((x) => `| ${x.date} | ${humanise(x.weekday)} | ${x.approvedLeave ? `Approved leave (${x.approvedLeave})` : x.holiday ? `Holiday: ${x.holiday}` : x.status === 'WORKING' ? `Working${x.shifts ? ` — ${x.shifts}` : ''}` : x.status === 'DAY_OFF' ? 'Day off' : 'Not configured'} |`)
        .join('\n')}`,
  },

  // ── Your team (direct reports) ───────────────────────────────────────────
  {
    id: 'team-today',
    label: "My team's attendance today",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_overview',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) => {
      if (!d.teamSize) return d.message;
      const noRecord = (d.members as any[]).filter((m) => !m.record && !m.approvedLeave && m.schedule === 'WORKING');
      return `**Your ${plural(d.teamSize, 'direct report')} on ${d.date}${d.holiday ? ` (holiday: ${d.holiday})` : ''}**\n- Has a record: **${n(d.totals.withRecord)}** · On approved leave: ${n(d.totals.onApprovedLeave)} · Day off: ${n(d.totals.dayOff)} · Schedule not configured: ${n(d.totals.scheduleNotConfigured)}\n- Scheduled but no imported record yet: **${n(d.totals.scheduledButNoRecord)}**${
        noRecord.length ? ` — ${noRecord.map((m) => m.name).join(', ')}` : ''
      }\n\nNo imported record is not an absence; it means today's attendance has not been imported yet.`;
    },
    links: [{ path: '/attendance/daily', label: 'Daily Monitoring' }],
  },
  {
    id: 'team-attendance-this-month',
    label: "My team's attendance — this month",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_attendance',
    args: () => ({}),
    charts: [
      { pick: chartAt(0), type: 'bar' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) => (d.teamSize ? attendanceText(`your ${plural(d.teamSize, 'direct report')}`, d.totals, periodText(d)) : d.message),
  },
  {
    id: 'team-attendance-3-months',
    label: "My team's attendance trend — last 3 months",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_attendance',
    args: (today) => ({ groupBy: 'month', from: monthStartKey(today, -2), to: today }),
    charts: [
      { pick: chartAt(0), type: 'line' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) => (d.teamSize ? `${attendanceText(`your ${plural(d.teamSize, 'direct report')}`, d.totals, periodText(d))}${noDataPeriods(d)}` : d.message),
  },
  {
    id: 'team-leave',
    label: "My team's leave requests",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_leave',
    args: () => ({}),
    charts: [{ pick: chartAt(0), type: 'pie' }],
    summarize: (d) =>
      d.teamSize
        ? `${countsLine("Your team's current and recent leave requests", d.countsByStatus)}\n\nAwaiting your endorsement: **${n(d.awaitingYourEndorsement)}**.`
        : d.message,
    links: [{ path: '/leave/requests', label: 'Leave Requests' }],
  },
  {
    id: 'team-compliance',
    label: "My team's compliance",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_compliance',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) => {
      if (!d.teamSize) return d.message;
      const people = (d.members as any[]).filter((m) => m.needingAttention.length);
      return `${countsLine("Your team's requirement checks", d.totals)}${
        people.length ? `\n\n**Needing attention:**\n${people.map((m) => `- ${m.name}: ${m.needingAttention.map((i: any) => `${i.requirement} (${humanise(i.status)})`).join(', ')}`).join('\n')}` : ''
      }${d.notes?.length ? `\n\n${d.notes[0]}` : ''}`;
    },
  },
  {
    id: 'team-training',
    label: "My team's training",
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_team_training',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      d.teamSize
        ? `**Training by team member**\n${(d.members as any[]).map((m) => `- ${m.name}: ${n(m.completed)} completed of ${n(m.total)}${m.completionRate === null ? '' : ` (${n(m.completionRate)}%)`}`).join('\n')}`
        : d.message,
  },
  {
    id: 'evaluations-to-complete',
    label: 'Evaluations I need to complete',
    group: 'Your team',
    tiers: TEAM,
    tool: 'get_evaluations',
    args: () => ({}),
    charts: [{ pick: (d) => d?.evaluationsToCompleteByStatus?.datasetId, type: 'pie' }],
    summarize: (d) => {
      const list = d.evaluationsToComplete as any[];
      if (!list.length) return 'You have no evaluations assigned to you as an evaluator.';
      const open = list.filter((a) => a.status === 'NOT_STARTED' || a.status === 'IN_PROGRESS');
      return `You are the evaluator on **${plural(list.length, 'evaluation')}**; **${n(open.length)}** still to finish${
        list.some((a) => a.overdue) ? `, of which ${n(list.filter((a) => a.overdue).length)} overdue` : ''
      }.\n${open.slice(0, 15).map((a) => `- ${a.subject} — ${a.cycle}, due ${a.dueDate}${a.overdue ? ' (overdue)' : ''}`).join('\n')}`;
    },
    links: [{ path: '/evaluations', label: 'Evaluations' }],
  },

  // ── Organisation (HR) ────────────────────────────────────────────────────
  {
    id: 'org-headcount-unit',
    label: 'Headcount by unit',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_headcount',
    args: () => ({ groupBy: 'unit' }),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      `**Active workforce: ${n(d.total)}**\n${(d.groups as any[]).map((g) => `- ${g.group}: ${n(g.employees)} (${n(g.share)}%)`).join('\n')}`,
  },
  {
    id: 'org-status-distribution',
    label: 'Employment status distribution',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_headcount',
    args: () => ({ groupBy: 'employmentStatus' }),
    charts: [{ pick: theChart, type: 'pie' }],
    summarize: (d) => `**Active workforce by employment status (${n(d.total)})**\n${(d.groups as any[]).map((g) => `- ${g.group}: ${n(g.employees)} (${n(g.share)}%)`).join('\n')}`,
  },
  {
    id: 'org-attendance-by-unit',
    label: 'Attendance by unit — this month',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_attendance_trends',
    args: () => ({ groupBy: 'unit' }),
    charts: [
      { pick: chartAt(0), type: 'bar' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) => `${attendanceText('the active workforce', d.totals, periodText(d))}\n\n${d.notes?.[d.notes.length - 1] ?? ''}`,
    links: [{ path: '/attendance/tally', label: 'Attendance Tally' }],
  },
  {
    id: 'org-attendance-6-months',
    label: 'Attendance trend — last 6 months',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_attendance_trends',
    args: (today) => ({ groupBy: 'month', from: monthStartKey(today, -5), to: today }),
    charts: [
      { pick: chartAt(0), type: 'line' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) => `${attendanceText('the active workforce', d.totals, periodText(d))}${noDataPeriods(d)}`,
  },
  {
    id: 'org-no-record-ranking',
    label: 'Most "No imported record" days — this month',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_attendance_trends',
    args: () => ({ groupBy: 'employee', sortBy: 'noImportedRecordDays', limit: 15 }),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      `**Employees with the most calendar days without an imported record, ${periodText(d)}**\n${(d.employees as any[])
        .slice(0, 15)
        .map((e) => `- ${e.name} (${e.unit}): ${plural(e.noImportedRecordDays, 'day')}`)
        .join('\n')}\n\nThis measures missing attendance DATA, not absence — usually the export for those dates has not been imported.`,
    links: [{ path: '/attendance/daily', label: 'Daily Monitoring' }],
  },
  {
    id: 'org-leave',
    label: 'Leave by status and type',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_leave_overview',
    args: () => ({}),
    charts: [
      { pick: chartAt(0), type: 'pie' },
      { pick: chartAt(2), type: 'bar' },
    ],
    summarize: (d) =>
      `**Leave filed ${d.filedInPeriod.period.from} to ${d.filedInPeriod.period.to}: ${n(d.filedInPeriod.total)} request(s), ${n(d.filedInPeriod.totalDaysRequested)} day(s)**\n${countsLine('By status', d.filedInPeriod.byStatus)}\n- Awaiting HR decision now: **${n(d.awaitingHrDecision.count)}** · awaiting supervisor endorsement: ${n(d.awaitingSupervisorEndorsement.count)}\n- On approved leave today: ${n(d.onApprovedLeaveToday.length)}`,
    links: [{ path: '/leave/requests', label: 'Leave Requests' }],
  },
  {
    id: 'org-compliance',
    label: 'Compliance standing',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_compliance_overview',
    args: () => ({ withinDays: 30 }),
    charts: [
      { pick: chartAt(0), type: 'pie' },
      { pick: chartAt(1), type: 'bar' },
    ],
    summarize: (d) =>
      `**Compliance across ${n(d.activeEmployees)} active employees (${n(d.totalChecks)} requirement checks)**\n${countsLine('By status', d.byStatus)}\n- Needing attention: **${n(d.needingAttention.total)}**\n- Expiring within 30 days: **${n(d.expiringWithinDays.count)}**${
        d.expiringWithinDays.items.length ? `\n${(d.expiringWithinDays.items as any[]).slice(0, 10).map((i) => `  - ${i.employee}: ${i.requirement}, ${i.expiresOn}`).join('\n')}` : ''
      }`,
    links: [{ path: '/compliance', label: 'Compliance' }],
  },
  {
    id: 'org-training-unit',
    label: 'Training completion by unit',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_training_overview',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      (d.byUnit as any[]).length
        ? `**Training completion by unit, ${d.period.from} to ${d.period.to}**\n${(d.byUnit as any[]).map((u) => `- ${u.unit}: ${n(u.completed)} of ${n(u.assigned)}${u.completionRate === null ? '' : ` (${n(u.completionRate)}%)`}`).join('\n')}`
        : `No training activity started between ${d.period.from} and ${d.period.to}.`,
  },
  {
    id: 'org-evaluations',
    label: 'Evaluation progress',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_evaluation_overview',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      (d.cycles as any[]).length
        ? `**Active evaluation cycles**\n${(d.cycles as any[]).map((c) => `- ${c.cycle} (due ${c.due}): ${n(c.finalized)} finalized, ${n(c.submitted)} submitted, ${n(c.inProgress)} in progress, ${n(c.notStarted)} not started — ${c.completionRate === null ? 'no assignments' : `${n(c.completionRate)}% submitted or finalized`}${c.overdue ? `, ${n(c.overdue)} overdue` : ''}`).join('\n')}`
        : 'There are no active evaluation cycles.',
    links: [{ path: '/evaluations', label: 'Evaluations' }],
  },
  {
    id: 'org-recruitment',
    label: 'Recruitment pipeline',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_recruitment_overview',
    args: () => ({}),
    charts: [
      { pick: chartAt(0), type: 'pie' },
      { pick: chartAt(1), type: 'line' },
    ],
    summarize: (d) =>
      `${countsLine('Job openings', d.openingsByStatus)}\n${countsLine('Applications by stage (all openings)', d.pipelineAllOpenings)}\n- Received in the last ${n(d.receivedInLastDays.days)} days: **${n(d.receivedInLastDays.total)}**`,
    links: [{ path: '/recruitment/applicants', label: 'Applicants' }],
  },
  {
    id: 'org-announcements',
    label: 'Announcement read rates',
    group: 'Organisation',
    tiers: HR,
    tool: 'get_announcement_read_rates',
    args: () => ({}),
    charts: [{ pick: theChart, type: 'bar' }],
    summarize: (d) =>
      (d.announcements as any[]).length
        ? `**Active announcements**\n${(d.announcements as any[]).map((a) => `- ${a.title}: ${n(a.read)} of ${n(a.recipients)} read${a.readRate === null ? '' : ` (${n(a.readRate)}%)`}`).join('\n')}`
        : 'There are no active announcements.',
    links: [{ path: '/announcements', label: 'Announcements' }],
  },
];

const BY_ID = new Map(QUICK_VIEWS.map((v) => [v.id, v]));

export function quickViewsForTier(tier: PermissionTier): Array<{ id: string; label: string; group: QuickView['group'] }> {
  return QUICK_VIEWS.filter((v) => v.tiers.includes(tier)).map(({ id, label, group }) => ({ id, label, group }));
}

/** The view, only if this tier may run it. */
export function getQuickView(id: string, tier: PermissionTier): QuickView | null {
  const view = BY_ID.get(id);
  return view && view.tiers.includes(tier) ? view : null;
}
