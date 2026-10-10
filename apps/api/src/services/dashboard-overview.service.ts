import { PermissionTier } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ComplianceService } from './compliance.service';
import { BirthdayService } from './birthday.service';

/**
 * Dashboard overview — the compliance cards, the "To Do" list and "Recent
 * Activity" for whoever is signed in.
 *
 * Read-only aggregation over existing records. Every list is scoped on the
 * server by permission tier, so a supervisor only ever receives their own
 * team's items and an employee only their own:
 *
 *   FULL        organisation compliance (no To Do list for HR)
 *   SUPERVISOR  team compliance · endorsements + evaluations waiting
 *   STANDARD    own compliance · own requirements + trainings
 *
 * Every role also sees its own calendar notes that are due today or overdue.
 *
 * Recent Activity is the same rule for everyone: ONLY what the signed-in person
 * did themselves (their own audit trail), never other people's actions — so
 * each account's feed stays about that account. Things done TO you arrive as
 * notifications (the bell); the organisation-wide trail is the Audit Trail page.
 */

const RATING_TASK_TITLE: Record<string, (name: string) => string> = {
  SELF: () => 'Complete your self rating',
  PEER: (name) => `Peer evaluation — ${name}`,
  HEAD: (name) => `Evaluate ${name}`,
};

export type OverviewTone = 'danger' | 'warning' | 'review' | 'positive' | 'neutral';

export interface TodoItem {
  /** Stable per record, so a dismissal on the client survives refreshes. */
  id: string;
  kind:
    | 'leave' | 'compliance' | 'evaluation' | 'application' | 'training'
    | 'note' | 'interview' | 'record' | 'holiday' | 'onboarding' | 'supervisor';
  title: string;
  context: string;
  /** ISO date the item is due or was raised, when there is one. */
  date: string | null;
  link: string;
  tone: OverviewTone;
}

export interface ActivityItem {
  id: string;
  title: string;
  context: string;
  at: string;
  link: string | null;
}

/** One page of the signed-in person's own history, newest first. */
export interface ActivityPage {
  items: ActivityItem[];
  /** Pass back as `before` for the next (older) page; null when there is none. */
  nextBefore: string | null;
}

export interface DashboardOverview {
  scope: 'organization' | 'team' | 'self';
  compliance: {
    /** Missing + expired: something must be submitted or renewed. */
    actionRequired: number;
    needsReview: number;
    expiringSoon: number;
  };
  todo: TodoItem[];
  activity: ActivityItem[];
}

const TODO_LIMIT = 8;
/** The dashboard rail's share of your history (the latest few, across days). */
const ACTIVITY_RAIL_LIMIT = 20;

/**
 * Left out of the dashboard feed (they stay on the Audit Trail page):
 * sign-in bookkeeping, read-only views, and one-off data-migration or
 * dev-account scripts that would otherwise dominate the list.
 */
const ACTIVITY_NOISE = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED', 'GOOGLE_LOGIN_SUCCESS', 'GOOGLE_LOGIN_FAILED',
  'APPLICANT_DOCUMENT_PREVIEWED', 'DOCUMENT_PREVIEWED', 'DOCUMENT_DOWNLOADED',
  'DEVELOPMENT_ACCOUNT_STANDARDIZED', 'SUPERVISOR_ASSIGNMENT_MIGRATED', 'FIX_SUPERVISOR_ASSIGNMENT',
];

const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Unknown';

const humanize = (code?: string | null) =>
  (code ?? '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const iso = (d?: Date | null) => (d ? d.toISOString() : null);

/** Today's date in the Philippines, as `YYYY-MM-DD`. */
const phtToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

/** The instant a Philippine calendar day ends (UTC+8, no DST). */
export const phtEndOfDay = (day: string) => new Date(new Date(`${day}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000);

export class DashboardOverviewService {
  static async getOverview(user: {
    userId: string;
    permissionTier: string;
    employeeId?: string | null;
  }): Promise<DashboardOverview> {
    /*
     * Birthday reminders are raised here rather than from a scheduler, the same
     * way announcement status is resolved at query time: HR and supervisors get
     * them when they open their dashboard. The notification's event key makes
     * this idempotent, so loading the dashboard ten times a day still produces
     * one reminder per birthday. Not awaited — a reminder must never hold up or
     * break the dashboard.
     */
    if (
      user.permissionTier === PermissionTier.FULL ||
      user.permissionTier === PermissionTier.SUPERVISOR
    ) {
      void BirthdayService.raiseReminders(user);
    }

    if (user.permissionTier === PermissionTier.FULL) {
      return DashboardOverviewService.forHr(user.userId);
    }
    if (!user.employeeId) {
      // An account with no employee record has nothing personal to show.
      return {
        scope: 'self',
        compliance: { actionRequired: 0, needsReview: 0, expiringSoon: 0 },
        todo: await DashboardOverviewService.dueNotes(user.userId),
        activity: (await DashboardOverviewService.myActivity(user.userId, { limit: ACTIVITY_RAIL_LIMIT })).items,
      };
    }
    if (user.permissionTier === PermissionTier.SUPERVISOR) {
      return DashboardOverviewService.forSupervisor(user.userId, user.employeeId);
    }
    return DashboardOverviewService.forEmployee(user.userId, user.employeeId);
  }

  // ── HR ─────────────────────────────────────────────────────────────────────
  // HR's dashboard has no To Do list (removed at HSJ's request); HR works from
  // the module pages. HR still gets the organisation compliance figures.
  private static async forHr(userId: string): Promise<DashboardOverview> {
    const [summary, activity] = await Promise.all([
      ComplianceService.getOrgComplianceSummary(),
      DashboardOverviewService.myActivity(userId, { limit: ACTIVITY_RAIL_LIMIT }).then((p) => p.items),
    ]);
    return {
      scope: 'organization',
      compliance: {
        actionRequired: summary.summary.missing + summary.summary.expired,
        needsReview: summary.summary.needsReview,
        expiringSoon: summary.summary.expiringSoon,
      },
      todo: [],
      activity,
    };
  }

  // ── Supervisor ─────────────────────────────────────────────────────────────
  private static async forSupervisor(userId: string, employeeId: string): Promise<DashboardOverview> {
    const team = await prisma.employee.findMany({
      where: { immediateSupervisorId: employeeId, deletedAt: null, employmentState: 'ACTIVE' },
      select: { id: true },
    });
    const teamIds = team.map((t) => t.id);

    const [summary, endorsements, evaluations, notes, activity] = await Promise.all([
      teamIds.length
        ? ComplianceService.getOrgComplianceSummary(teamIds)
        : Promise.resolve({ summary: { missing: 0, expired: 0, needsReview: 0, expiringSoon: 0 } }),
      prisma.leaveRequest.findMany({
        where: { status: 'PENDING', deletedAt: null, employeeId: { in: teamIds } },
        orderBy: { createdAt: 'asc' },
        take: TODO_LIMIT,
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
      prisma.evaluationAssignment.findMany({
        where: { evaluatorId: employeeId, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }, deletedAt: null },
        orderBy: { dueDate: 'asc' },
        take: TODO_LIMIT,
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
      DashboardOverviewService.dueNotes(userId, employeeId),
      DashboardOverviewService.myActivity(userId, { limit: ACTIVITY_RAIL_LIMIT }).then((p) => p.items),
    ]);

    const now = Date.now();
    const todo: TodoItem[] = [
      ...notes,
      ...endorsements.map((l): TodoItem => ({
        id: `leave:${l.id}`,
        kind: 'leave',
        title: `Endorse leave — ${fullName(l.employee)}`,
        context: `${humanize(l.leaveType)} · ${l.totalDays} day${l.totalDays === 1 ? '' : 's'}`,
        date: iso(l.startDate),
        link: '/leave/requests',
        tone: 'warning',
      })),
      ...evaluations.map((e): TodoItem => ({
        id: `evaluation:${e.id}`,
        kind: 'evaluation',
        title: (RATING_TASK_TITLE[(e as any).raterType] ?? RATING_TASK_TITLE.HEAD)(fullName(e.employee)),
        context: e.status === 'IN_PROGRESS' ? 'Draft in progress' : 'Not started',
        date: iso(e.dueDate),
        link: '/evaluations',
        tone: e.dueDate.getTime() < now ? 'danger' : 'warning',
      })),
    ];

    return {
      scope: 'team',
      compliance: {
        actionRequired: summary.summary.missing + summary.summary.expired,
        needsReview: summary.summary.needsReview,
        expiringSoon: summary.summary.expiringSoon,
      },
      todo: DashboardOverviewService.limit(todo),
      activity,
    };
  }

  // ── Employee ───────────────────────────────────────────────────────────────
  private static async forEmployee(userId: string, employeeId: string): Promise<DashboardOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [requirements, trainings, notes, activity] = await Promise.all([
      ComplianceService.getEmployeeComplianceSummary(employeeId),
      prisma.trainingParticipant.findMany({
        where: {
          employeeId,
          participationStatus: 'ASSIGNED',
          trainingActivity: { status: 'SCHEDULED', startDate: { gte: today }, deletedAt: null },
        },
        orderBy: { trainingActivity: { startDate: 'asc' } },
        take: TODO_LIMIT,
        include: { trainingActivity: { select: { title: true, startDate: true, venue: true } } },
      }),
      DashboardOverviewService.dueNotes(userId, employeeId),
      DashboardOverviewService.myActivity(userId, { limit: ACTIVITY_RAIL_LIMIT }).then((p) => p.items),
    ]);

    const REQUIREMENT_ACTION: Record<string, { verb: string; tone: OverviewTone }> = {
      EXPIRED: { verb: 'Renew', tone: 'danger' },
      MISSING: { verb: 'Submit', tone: 'danger' },
      EXPIRING_SOON: { verb: 'Renew soon', tone: 'warning' },
      NEEDS_REVIEW: { verb: 'Awaiting HR review', tone: 'review' },
    };

    const todo: TodoItem[] = [
      ...notes,
      ...requirements
        .filter((r) => REQUIREMENT_ACTION[r.status])
        .map((r): TodoItem => ({
          id: `compliance:${r.requirement.id}:${employeeId}`,
          kind: 'compliance',
          title: `${REQUIREMENT_ACTION[r.status].verb} — ${r.requirement.title}`,
          context: humanize(r.status),
          date: iso(r.expiresAt as Date | null),
          link: `/employees/${employeeId}`,
          tone: REQUIREMENT_ACTION[r.status].tone,
        })),
      ...trainings.map((t): TodoItem => ({
        id: `training:${t.id}`,
        kind: 'training',
        title: `Attend ${t.trainingActivity.title}`,
        context: t.trainingActivity.venue,
        date: iso(t.trainingActivity.startDate),
        link: '/training',
        tone: 'neutral',
      })),
    ];

    let actionRequired = 0, needsReview = 0, expiringSoon = 0;
    for (const r of requirements) {
      if (r.status === 'MISSING' || r.status === 'EXPIRED') actionRequired++;
      else if (r.status === 'NEEDS_REVIEW') needsReview++;
      else if (r.status === 'EXPIRING_SOON') expiringSoon++;
    }

    return {
      scope: 'self',
      compliance: { actionRequired, needsReview, expiringSoon },
      todo: DashboardOverviewService.limit(todo),
      activity,
    };
  }

  // ── shared sources ─────────────────────────────────────────────────────────

  /**
   * Notes for the To Do list: the caller's own unfinished notes that are due
   * today or overdue, plus HR calendar notes addressed to them for today.
   */
  private static async dueNotes(userId: string, employeeId: string | null = null): Promise<TodoItem[]> {
    const today = phtToday();
    const todayDate = new Date(`${today}T00:00:00.000Z`);
    const [own, shared] = await Promise.all([
      prisma.calendarNote.findMany({
        where: { userId, isDone: false, date: { lte: todayDate } },
        orderBy: { date: 'asc' },
        take: TODO_LIMIT,
      }),
      prisma.calendarNote.findMany({
        where: {
          date: todayDate,
          userId: { not: userId },
          OR: [
            { audience: 'ALL' },
            ...(employeeId ? [{ audience: 'SELECTED' as const, recipients: { some: { employeeId } } }] : []),
          ],
        },
        take: TODO_LIMIT,
      }),
    ]);
    return [
      ...own.map((n): TodoItem => {
        const day = n.date.toISOString().slice(0, 10);
        return {
          id: `note:${n.id}`,
          kind: 'note',
          title: n.title,
          context: day < today ? 'Overdue note' : 'Note for today',
          date: iso(n.date),
          link: '/dashboard',
          tone: day < today ? 'danger' : 'warning',
        };
      }),
      ...shared.map((n): TodoItem => ({
        id: `hr-note:${n.id}`,
        kind: 'note',
        title: n.title,
        context: 'Note from HR for today',
        date: iso(n.date),
        link: '/dashboard',
        tone: 'review',
      })),
    ];
  }

  /**
   * Turns calendar-note audit rows into readable lines. A personal note's title
   * is looked up live and only for its own author; the audit row never stores
   * it (HR can read the audit log, and a private note must stay private).
   */
  private static async noteTitles(
    logs: Array<{ action: string; entityId: string | null; actorUserId: string | null }>,
    viewerId: string
  ) {
    const ids = logs
      .filter((l) => l.action.startsWith('PERSONAL_NOTE_') && l.actorUserId === viewerId && l.entityId)
      .map((l) => l.entityId as string);
    if (!ids.length) return new Map<string, string>();
    const notes = await prisma.calendarNote.findMany({
      where: { id: { in: ids }, userId: viewerId },
      select: { id: true, title: true },
    });
    return new Map(notes.map((n) => [n.id, n.title]));
  }

  private static describe(
    log: { action: string; entityId: string | null; metadata: unknown },
    titles: Map<string, string>
  ): string {
    const meta = (log.metadata ?? {}) as { title?: string };
    const own = log.entityId ? titles.get(log.entityId) : undefined;
    const withTitle = (verb: string, title?: string) => (title ? `${verb}: ${title}` : verb);
    switch (log.action) {
      case 'PERSONAL_NOTE_CREATED': return withTitle('Added a note', own);
      case 'PERSONAL_NOTE_UPDATED': return withTitle('Edited a note', own);
      case 'PERSONAL_NOTE_COMPLETED': return withTitle('Completed', own);
      case 'PERSONAL_NOTE_REOPENED': return withTitle('Reopened', own);
      case 'PERSONAL_NOTE_DELETED': return 'Deleted a note';
      case 'CALENDAR_NOTE_POSTED': return withTitle('Posted a calendar note', meta.title);
      case 'CALENDAR_NOTE_UPDATED': return withTitle('Updated a calendar note', meta.title);
      case 'CALENDAR_NOTE_DELETED': return withTitle('Removed a calendar note', meta.title);
      default: return humanize(log.action);
    }
  }

  private static audienceText(metadata: unknown): string | null {
    const meta = (metadata ?? {}) as { audience?: string; recipientCount?: number };
    if (meta.audience === 'ALL') return 'for all employees';
    if (meta.audience === 'SELECTED') {
      const n = meta.recipientCount ?? 0;
      return `for ${n} employee${n === 1 ? '' : 's'}`;
    }
    return null;
  }

  /**
   * Recent Activity: what THIS person did, newest first, one page at a time
   * (`before` = continue after the last item of the previous page). Only audit
   * entries they are the actor of — other accounts' actions never appear,
   * whatever the viewer's role. The client groups the items under Today,
   * Yesterday and dated headings. The line names who the change was about
   * (e.g. the employee whose leave you approved) and, for shared calendar
   * notes, who it went to.
   */
  static async myActivity(
    userId: string,
    { before, limit = 30 }: { before?: Date; limit?: number } = {}
  ): Promise<ActivityPage> {
    const take = Math.min(Math.max(limit, 1), 100);
    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: userId,
        action: { notIn: ACTIVITY_NOISE },
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const page = logs.slice(0, take);
    const targetIds = [...new Set(page.map((l) => l.targetEmployeeId).filter((x): x is string => !!x))];
    const [targets, titles] = await Promise.all([
      targetIds.length
        ? prisma.employee.findMany({ where: { id: { in: targetIds } }, select: { id: true, firstName: true, lastName: true } })
        : Promise.resolve([]),
      DashboardOverviewService.noteTitles(page, userId),
    ]);
    const nameOf = new Map(targets.map((t) => [t.id, fullName(t)]));

    return {
      items: page.map((log) => ({
        id: log.id,
        title: DashboardOverviewService.describe(log, titles),
        context: [
          log.targetEmployeeId ? nameOf.get(log.targetEmployeeId) : null,
          DashboardOverviewService.audienceText(log.metadata),
        ].filter(Boolean).join(' · '),
        at: log.createdAt.toISOString(),
        link: log.targetEmployeeId ? `/employees/${log.targetEmployeeId}` : null,
      })),
      nextBefore: logs.length > take ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  /** Most urgent first (danger → warning → review → rest), then capped. */
  private static limit(items: TodoItem[]): TodoItem[] {
    const rank: Record<OverviewTone, number> = { danger: 0, warning: 1, review: 2, positive: 3, neutral: 4 };
    return [...items].sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, TODO_LIMIT * 2);
  }
}
