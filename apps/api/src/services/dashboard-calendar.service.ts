import { PermissionTier } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ComplianceService } from './compliance.service';
import { BirthdayService } from './birthday.service';
import { AppError } from '../middleware/errorHandler';

/**
 * Events for the dashboard calendar ("My Calendar"), in a date range.
 *
 * Read-only and scoped on the server by permission tier — the same audience
 * rules as the rest of HRISense:
 *
 *              holidays  leave                   training            deadlines / other
 *   FULL       all       everyone's approved     every activity      evaluation cycles due, interviews
 *   SUPERVISOR all       own + team (+ pending)  ones they attend    evaluations they must complete
 *   STANDARD   all       own (+ pending)         ones they attend    own compliance expiries
 *
 * Personal notes are not here: they come from /calendar-notes.
 */

const RATING_TASK_TITLE: Record<string, (name: string) => string> = {
  SELF: () => 'Complete your self rating',
  PEER: (name) => `Peer evaluation — ${name}`,
  HEAD: (name) => `Evaluate ${name}`,
};

export type CalendarEventType = 'holiday' | 'leave' | 'training' | 'deadline' | 'interview' | 'birthday';

export interface DashboardCalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  detail: string | null;
  /** `YYYY-MM-DD`, Philippine date. */
  start: string;
  end: string;
  link: string | null;
  /** Pending leave, or a deadline already passed. */
  tentative?: boolean;
  overdue?: boolean;
}

const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Unknown';

const humanize = (code?: string | null) =>
  (code ?? '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * Philippine calendar day of an instant. Correct for both kinds of stored
 * value: `@db.Date` columns (UTC midnight → same day at 08:00 PHT) and real
 * timestamps such as an interview at 9:00 PM UTC (→ next day in Manila).
 */
const phtDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);

const MAX_RANGE_DAYS = 100;

export class DashboardCalendarService {
  static async getEvents(
    user: { permissionTier: string; employeeId?: string | null },
    from: string,
    to: string
  ): Promise<DashboardCalendarEvent[]> {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new AppError(`Request at most ${MAX_RANGE_DAYS} days at a time.`, 400);
    }

    const isHr = user.permissionTier === PermissionTier.FULL;
    const isSupervisor = user.permissionTier === PermissionTier.SUPERVISOR;
    const me = user.employeeId ?? null;
    const today = phtDay(new Date());

    // Whose leave this person may see.
    let leaveScope: string[] | 'ALL' = [];
    if (isHr) leaveScope = 'ALL';
    else if (me) {
      leaveScope = [me];
      if (isSupervisor) {
        const team = await prisma.employee.findMany({
          where: { immediateSupervisorId: me, deletedAt: null },
          select: { id: true },
        });
        leaveScope.push(...team.map((t) => t.id));
      }
    }

    const overlaps = { startDate: { lte: end }, endDate: { gte: start } };

    const [holidays, leaves, trainings, cycles, assignments, interviews, requirements] = await Promise.all([
      prisma.organizationCalendarEntry.findMany({
        where: { status: 'APPROVED', date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
      }),
      leaveScope === 'ALL' || leaveScope.length
        ? prisma.leaveRequest.findMany({
            where: {
              ...overlaps,
              deletedAt: null,
              // HR sees the confirmed schedule; people see their own (and their
              // team's) requests while they are still pending too.
              status: isHr ? 'APPROVED' : { in: ['APPROVED', 'PENDING', 'FOR_REVIEW'] },
              ...(leaveScope === 'ALL' ? {} : { employeeId: { in: leaveScope } }),
            },
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { startDate: 'asc' },
          })
        : Promise.resolve([]),
      prisma.trainingActivity.findMany({
        where: {
          ...overlaps,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'COMPLETED'] },
          ...(isHr ? {} : me ? { participants: { some: { employeeId: me, participationStatus: { not: 'CANCELLED' } } } } : { id: '__none__' }),
        },
        orderBy: { startDate: 'asc' },
      }),
      isHr
        ? prisma.evaluationCycle.findMany({
            where: { status: 'ACTIVE', deletedAt: null, dueDate: { gte: start, lte: end } },
            orderBy: { dueDate: 'asc' },
          })
        : Promise.resolve([]),
      // Self, peer and head ratings the person was asked to complete.
      me
        ? prisma.evaluationAssignment.findMany({
            where: { evaluatorId: me, deletedAt: null, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }, dueDate: { gte: start, lte: end } },
            include: { employee: { select: { firstName: true, lastName: true } } },
          })
        : Promise.resolve([]),
      isHr
        ? prisma.applicantInterview.findMany({
            where: { status: { in: ['SCHEDULED', 'RESCHEDULED'] }, scheduledAt: { gte: start, lte: end } },
            include: { application: { select: { id: true, applicant: { select: { firstName: true, lastName: true } } } } },
            orderBy: { scheduledAt: 'asc' },
          })
        : Promise.resolve([]),
      !isHr && !isSupervisor && me ? ComplianceService.getEmployeeComplianceSummary(me) : Promise.resolve([]),
    ]);

    // Birthdays repeat yearly, so they are matched in JS rather than SQL.
    const birthdays = await BirthdayService.listInRange(user, from, to);

    const events: DashboardCalendarEvent[] = [
      ...holidays.map((h) => ({
        id: `holiday:${h.id}`,
        type: 'holiday' as const,
        title: h.name,
        detail: humanize(h.type),
        start: phtDay(h.date),
        end: phtDay(h.date),
        link: null,
      })),
      ...leaves.map((l) => {
        const self = l.employee?.id === me;
        return {
          id: `leave:${l.id}`,
          type: 'leave' as const,
          title: self ? `My ${humanize(l.leaveType).toLowerCase()} leave` : `${fullName(l.employee)} — ${humanize(l.leaveType).toLowerCase()} leave`,
          detail: l.status === 'APPROVED' ? 'Approved' : l.status === 'FOR_REVIEW' ? 'Endorsed, awaiting HR' : 'Pending',
          start: phtDay(l.startDate),
          end: phtDay(l.endDate),
          link: '/leave/calendar',
          tentative: l.status !== 'APPROVED',
        };
      }),
      ...trainings.map((t) => ({
        id: `training:${t.id}`,
        type: 'training' as const,
        title: t.title,
        // The chip already says "Training"; only name the kind when it adds something (Seminar, Workshop…).
        detail: [t.type !== 'TRAINING' ? humanize(t.type) : null, t.venue, t.startTime].filter(Boolean).join(' · '),
        start: phtDay(t.startDate),
        end: phtDay(t.endDate),
        link: '/training',
      })),
      ...cycles.map((c) => ({
        id: `cycle:${c.id}`,
        type: 'deadline' as const,
        title: `Evaluations due — ${c.name}`,
        detail: 'Evaluation cycle deadline',
        start: phtDay(c.dueDate),
        end: phtDay(c.dueDate),
        link: '/evaluations',
        overdue: phtDay(c.dueDate) < today,
      })),
      ...assignments.map((a) => ({
        id: `evaluation:${a.id}`,
        type: 'deadline' as const,
        title: (RATING_TASK_TITLE[(a as any).raterType] ?? RATING_TASK_TITLE.HEAD)(fullName(a.employee)),
        detail: a.status === 'IN_PROGRESS' ? 'Draft in progress' : 'Not started',
        start: phtDay(a.dueDate),
        end: phtDay(a.dueDate),
        link: '/evaluations',
        overdue: phtDay(a.dueDate) < today,
      })),
      ...interviews.map((i) => ({
        id: `interview:${i.id}`,
        type: 'interview' as const,
        title: `Interview — ${fullName(i.application?.applicant)}`,
        detail: `${humanize(i.interviewType)} · ${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(i.scheduledAt)}`,
        start: phtDay(i.scheduledAt),
        end: phtDay(i.scheduledAt),
        link: `/recruitment/applicants/${i.application?.id ?? ''}`,
      })),
      ...(requirements as Array<{ requirement: { id: string; title: string }; expiresAt: Date | null; status: string }>)
        .filter((r) => r.expiresAt && r.expiresAt >= start && r.expiresAt <= end)
        .map((r) => ({
          id: `expiry:${r.requirement.id}`,
          type: 'deadline' as const,
          title: `${r.requirement.title} expires`,
          detail: humanize(r.status),
          start: phtDay(r.expiresAt as Date),
          end: phtDay(r.expiresAt as Date),
          link: me ? `/employees/${me}` : null,
          overdue: phtDay(r.expiresAt as Date) < today,
        })),
      // Birthdays: HR sees everyone's, a supervisor sees their team's.
      ...birthdays.map((b) => ({
        id: `birthday:${b.employeeId}:${b.date}`,
        type: 'birthday' as const,
        title: `${b.firstName} ${b.lastName}`.trim(),
        detail: b.turningAge ? `Turning ${b.turningAge}` : 'Birthday',
        start: b.date,
        end: b.date,
        link: `/employees/${b.employeeId}`,
      })),
    ];

    return events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  }
}
