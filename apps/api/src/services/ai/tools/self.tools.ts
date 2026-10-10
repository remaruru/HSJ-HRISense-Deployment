import { z } from 'zod';
import { prisma } from '../../../config/prisma';
import { toBusinessDate } from '../../../lib/businessDate';
import { AnnouncementService } from '../../announcement.service';
import { DashboardCalendarService } from '../../dashboard-calendar.service';
import { ComplianceService } from '../../compliance.service';
import { NotificationService } from '../../notification.service';
import { describeSchedule, leaveOn, loadApprovedLeave, loadHolidays, loadSchedules } from './day-context';
import { describeHolidays } from './day-context';
import { dateKey, humanise, manilaTime, parseRange, truncate } from './tool-helpers';
import { ALL_TIERS, AiTool, dateArg, defineTool, ToolContext } from './tool-types';

/**
 * Tools about the person asking and nobody else. They take no employee id at
 * all, so there is nothing to manipulate: the target is always the actor.
 */

const announcementsTool = defineTool({
  name: 'get_my_announcements',
  description:
    'Announcements sent to the person asking (current ones by default, or past ones), with priority, publish date and whether they have read each. Content is shortened.',
  tiers: ALL_TIERS,
  args: z.object({ unreadOnly: z.boolean().optional(), past: z.boolean().optional() }).strict(),
  async run(ctx: ToolContext, args: { unreadOnly?: boolean; past?: boolean }) {
    const result = await AnnouncementService.listForRecipient(ctx.actor.employeeId, args.past ? 'past' : 'current', {
      limit: 15,
      unreadOnly: args.unreadOnly,
    });
    const unread = await AnnouncementService.getUnreadCount(ctx.actor.employeeId);
    return {
      data: {
        unreadCurrentCount: unread,
        total: result.pagination.total,
        announcements: result.data.map((a: any) => ({
          title: a.title,
          priority: a.priority,
          pinned: a.isPinned,
          publishedOn: dateKey(a.publishAt),
          expiresOn: dateKey(a.expiresAt),
          read: a.isRead,
          excerpt: truncate(a.body, 400),
          attachments: a._count?.attachments ?? 0,
        })),
      },
      rows: result.data.length,
    };
  },
});

const notificationsTool = defineTool({
  name: 'get_my_notifications',
  description: "The person asking's notifications (newest first, up to 20), with type, message, date and read state.",
  tiers: ALL_TIERS,
  args: z.object({ unreadOnly: z.boolean().optional() }).strict(),
  async run(ctx: ToolContext, args: { unreadOnly?: boolean }) {
    const result = await NotificationService.list(ctx.actor.userId, { limit: 20, unreadOnly: args.unreadOnly });
    return {
      data: {
        unreadCount: result.unreadCount,
        notifications: result.data.map((n) => ({
          type: humanise(n.type),
          title: truncate(n.title, 120),
          message: truncate(n.message, 300),
          createdOn: dateKey(n.createdAt),
          read: n.isRead,
          link: n.link && /^\/[a-z0-9\-/]*$/i.test(n.link) ? n.link : null,
        })),
      },
      rows: result.data.length,
    };
  },
});

const calendarTool = defineTool({
  name: 'get_my_calendar',
  description:
    "The person asking's calendar for a date range (default: today and the next 13 days; at most 60): holidays, leave, training, deadlines (evaluations due, compliance expiries), interviews for HR, and calendar notes they wrote or that were shared with them. Uses the same audience rules as the dashboard calendar.",
  tiers: ALL_TIERS,
  args: z.object({ from: dateArg.optional(), to: dateArg.optional() }).strict(),
  async run(ctx: ToolContext, args: { from?: string; to?: string }) {
    const range = parseRange(ctx, args.from, args.to, { fromOffset: 0, toOffset: 13 }, 60);
    const [events, notes] = await Promise.all([
      DashboardCalendarService.getEvents(
        { permissionTier: ctx.actor.tier, employeeId: ctx.actor.employeeId },
        range.fromKey,
        range.toKey
      ),
      prisma.calendarNote.findMany({
        where: {
          date: { gte: range.from, lte: range.to },
          OR: [
            { userId: ctx.actor.userId },
            { audience: 'ALL' },
            { audience: 'SELECTED', recipients: { some: { employeeId: ctx.actor.employeeId } } },
          ],
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        take: 40,
        select: { date: true, title: true, isDone: true, audience: true, userId: true },
      }),
    ]);

    return {
      data: {
        period: { from: range.fromKey, to: range.toKey },
        // Birthdays are left out: they are derived from dates of birth.
        events: events
          .filter((e) => e.type !== 'birthday')
          .slice(0, 60)
          .map((e) => ({
            type: e.type,
            title: truncate(e.title, 120),
            detail: truncate(e.detail, 160),
            from: e.start,
            to: e.end,
            tentative: e.tentative || undefined,
            overdue: e.overdue || undefined,
          })),
        notes: notes.map((n) => ({
          date: dateKey(n.date),
          title: truncate(n.title, 120),
          done: n.isDone,
          sharedWithMe: n.userId !== ctx.actor.userId,
        })),
      },
      rows: events.length + notes.length,
    };
  },
});

const todayTool = defineTool({
  name: 'get_my_day',
  description:
    "A snapshot for the person asking: today's schedule and attendance record, holidays, approved leave today, pending leave requests, unread notifications and announcements, compliance items needing attention, and upcoming training. Use it for 'what do I need to know today' or dashboard-style questions.",
  tiers: ALL_TIERS,
  args: z.object({}).strict(),
  async run(ctx: ToolContext) {
    const me = ctx.actor.employeeId;
    const range = parseRange(ctx, ctx.today, ctx.today, { fromOffset: 0, toOffset: 0 }, 1);
    const [schedules, holidays, leave, record, pendingLeave, unreadNotifications, unreadAnnouncements, compliance, upcomingTraining] =
      await Promise.all([
        loadSchedules([me], range),
        loadHolidays(range),
        loadApprovedLeave([me], range),
        prisma.attendanceRecord.findFirst({
          where: { employeeId: me, date: toBusinessDate(ctx.today) },
          select: { status: true, timeIn: true, timeOut: true, hoursWorked: true },
        }),
        prisma.leaveRequest.count({ where: { employeeId: me, deletedAt: null, status: { in: ['PENDING', 'FOR_REVIEW'] } } }),
        NotificationService.unreadCount(ctx.actor.userId),
        AnnouncementService.getUnreadCount(me),
        ComplianceService.getEmployeeComplianceSummary(me),
        prisma.trainingParticipant.findMany({
          where: {
            employeeId: me,
            participationStatus: 'ASSIGNED',
            trainingActivity: { deletedAt: null, status: 'SCHEDULED', startDate: { gte: toBusinessDate(ctx.today) } },
          },
          orderBy: { trainingActivity: { startDate: 'asc' } },
          take: 5,
          select: { trainingActivity: { select: { title: true, startDate: true, startTime: true, venue: true } } },
        }),
      ]);

    const sched = describeSchedule(schedules.get(me)?.get(ctx.today));
    const needsAttention = (compliance as any[]).filter((c) => c.status !== 'VALID');
    return {
      data: {
        today: ctx.today,
        schedule: { status: sched.status, shifts: sched.shifts },
        holiday: describeHolidays(holidays.get(ctx.today)),
        onApprovedLeave: leaveOn(leave, me, ctx.today) ? humanise(leaveOn(leave, me, ctx.today)!.leaveType) : null,
        attendanceToday: record
          ? { status: record.status, timeIn: manilaTime(record.timeIn), timeOut: manilaTime(record.timeOut), hoursWorked: record.hoursWorked }
          : null,
        attendanceNote: record ? null : 'No attendance record has been imported for today yet. Imports happen after the biometric export; this is not an absence.',
        pendingLeaveRequests: pendingLeave,
        unreadNotifications,
        unreadAnnouncements,
        complianceNeedingAttention: needsAttention.map((c) => ({ requirement: c.requirement.title, status: c.status, expiresOn: dateKey(c.expiresAt) })),
        upcomingTraining: upcomingTraining.map((t) => ({
          title: t.trainingActivity.title,
          date: dateKey(t.trainingActivity.startDate),
          time: t.trainingActivity.startTime,
          venue: t.trainingActivity.venue,
        })),
      },
      rows: 1,
    };
  },
});

export const SELF_TOOLS: AiTool[] = [todayTool, announcementsTool, notificationsTool, calendarTool];
