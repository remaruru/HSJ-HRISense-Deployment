import { NotificationType, PermissionTier } from '@prisma/client';
import { prisma } from '../config/prisma';
import { NotificationService } from './notification.service';

/**
 * Upcoming employee birthdays, for the dashboard calendar and for the reminders
 * HR and supervisors get in their notifications.
 *
 * Birthdays repeat every year, which SQL cannot match on a stored date without
 * date arithmetic per row, so the month-and-day matching happens here in JS.
 * The set it runs over is small — active employees only — and the calendar asks
 * for at most 100 days at a time.
 *
 * Following the rule the announcement service states out loud: NO cron job, NO
 * background scheduler. Reminders are raised when a dashboard is loaded, and the
 * notification's event key keeps that idempotent — the same birthday can be
 * raised a hundred times and still produces one notification per person.
 */

/** Philippine calendar day of an instant, `YYYY-MM-DD`. */
const phtDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);

export interface UpcomingBirthday {
  employeeId: string;
  firstName: string;
  lastName: string;
  /** The birthday itself, `YYYY-MM-DD`, in the year it lands on next. */
  date: string;
  /** Whole days from today; 0 means today. */
  inDays: number;
  /** Null when the year of birth is not on record. */
  turningAge: number | null;
  supervisorId: string | null;
}

/** How far ahead a reminder is raised. */
const REMINDER_WINDOW_DAYS = 7;

/**
 * The next occurrence of a birthday on or after `from`, as `YYYY-MM-DD`.
 * The stored value is a `@db.Date`, so its UTC month and day are the real ones.
 */
function nextOccurrence(dob: Date, from: Date): { date: string; inDays: number } {
  const month = dob.getUTCMonth();
  const day = dob.getUTCDate();
  const fromDay = new Date(`${phtDay(from)}T00:00:00.000Z`);

  let year = fromDay.getUTCFullYear();
  // 29 February in a common year is marked on the 1st of March.
  const build = (y: number) => {
    const d = new Date(Date.UTC(y, month, day));
    return d.getUTCMonth() === month ? d : new Date(Date.UTC(y, month + 1, 1));
  };

  let occurrence = build(year);
  if (occurrence < fromDay) occurrence = build(++year);

  return {
    date: occurrence.toISOString().slice(0, 10),
    inDays: Math.round((occurrence.getTime() - fromDay.getTime()) / 86_400_000),
  };
}

export class BirthdayService {
  /**
   * Whose birthdays this person may see: HR sees everyone, a supervisor sees
   * their own team. Nobody else gets a list — an employee has no business
   * being shown the roster's dates of birth.
   */
  private static async inScope(viewer: { permissionTier: string; employeeId?: string | null }) {
    const isHr = viewer.permissionTier === PermissionTier.FULL;
    const isSupervisor = viewer.permissionTier === PermissionTier.SUPERVISOR;
    if (!isHr && !(isSupervisor && viewer.employeeId)) return [];

    return prisma.employee.findMany({
      where: {
        deletedAt: null,
        employmentState: { in: ['ACTIVE', 'ON_LEAVE'] },
        ...(isHr ? {} : { immediateSupervisorId: viewer.employeeId! }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        immediateSupervisorId: true,
      },
    });
  }

  /** Birthdays falling inside `[from, to]` (both `YYYY-MM-DD`, inclusive). */
  static async listInRange(
    viewer: { permissionTier: string; employeeId?: string | null },
    from: string,
    to: string
  ): Promise<UpcomingBirthday[]> {
    const employees = await this.inScope(viewer);
    if (!employees.length) return [];

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const today = new Date();

    const out: UpcomingBirthday[] = [];
    for (const e of employees) {
      if (!e.dateOfBirth) continue;
      const { date } = nextOccurrence(e.dateOfBirth, fromDate);
      if (date < from || date > to) continue;

      const { inDays } = nextOccurrence(e.dateOfBirth, today);
      const bornYear = e.dateOfBirth.getUTCFullYear();
      out.push({
        employeeId: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        date,
        inDays,
        turningAge: bornYear > 1900 ? Number(date.slice(0, 4)) - bornYear : null,
        supervisorId: e.immediateSupervisorId,
      });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Raise reminders for birthdays in the next week, for the person loading their
   * dashboard. Best-effort: a failure here must never break the dashboard.
   */
  static async raiseReminders(viewer: {
    userId: string;
    permissionTier: string;
    employeeId?: string | null;
  }): Promise<void> {
    try {
      const today = phtDay(new Date());
      const horizon = new Date(Date.now() + REMINDER_WINDOW_DAYS * 86_400_000);
      const upcoming = await this.listInRange(viewer, today, phtDay(horizon));

      for (const b of upcoming) {
        // Never remind someone about their own birthday.
        if (viewer.employeeId && b.employeeId === viewer.employeeId) continue;

        const name = `${b.firstName} ${b.lastName}`.trim();
        const when =
          b.inDays === 0 ? 'is today' : b.inDays === 1 ? 'is tomorrow' : `is in ${b.inDays} days`;

        await NotificationService.notify({
          userId: viewer.userId,
          type: NotificationType.BIRTHDAY_REMINDER,
          title: b.inDays === 0 ? `🎂 ${name}'s birthday is today` : `🎂 Upcoming birthday: ${name}`,
          message: `${name}'s birthday ${when}${b.turningAge ? ` — turning ${b.turningAge}` : ''}.`,
          link: `/employees/${b.employeeId}`,
          // One reminder per person, per birthday, per year.
          eventId: `birthday:${b.employeeId}:${b.date}`,
        });
      }
    } catch (error) {
      console.warn('[birthday] reminders could not be raised', error);
    }
  }
}
