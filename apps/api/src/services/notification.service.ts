import { EventEmitter } from 'events';
import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Central notification service.
 *
 * Before this existed the `Notification` model had read endpoints but no writer,
 * so the feature could only ever be empty. Notifications are now raised for real
 * system events only — nothing is invented, and announcements keep their own
 * recipient feed rather than being duplicated here.
 *
 * Creation is always best-effort: a notification failure must never roll back the
 * business action that triggered it.
 */

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** In-app route the notification should open, e.g. `/leave/requests`. */
  link?: string;
  /**
   * Idempotency key for the business event behind this notification, e.g.
   * `leave-approved:<leaveRequestId>`. When supplied, re-raising the same event
   * (a retried request, a double-click) will NOT create a second notification —
   * the unique index rejects the duplicate and it is treated as already sent.
   *
   * The per-user suffix is added automatically, so a caller notifying several
   * people about one event passes a single event key.
   *
   * Omit it for notifications that genuinely have no natural event identity.
   * Never derive one from message text — that would dedupe unrelated events that
   * happen to read the same.
   */
  eventId?: string;
}

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

/** Scopes an event key to one recipient, so one event can notify many people. */
function scopedEventId(eventId: string | undefined, userId: string): string | null {
  return eventId ? `${eventId}:${userId}` : null;
}

/**
 * In-process "your notifications changed" signal, keyed by user id. The live
 * stream (GET /notifications/stream) listens to it so the bell's number moves
 * the moment a notification is raised or read, instead of on the next poll.
 * One API process serves HRISense, so an in-memory emitter is enough.
 */
const changes = new EventEmitter();
changes.setMaxListeners(0); // one listener per open browser tab

function announce(userIds: string[]) {
  for (const id of new Set(userIds)) changes.emit(id);
}

export class NotificationService {
  /** Creates one notification. Never throws. Idempotent when `eventId` is given. */
  static async notify(input: CreateNotificationInput): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          eventId: scopedEventId(input.eventId, input.userId),
        },
      });
      announce([input.userId]);
    } catch (err: any) {
      // A duplicate event key means this notification was already raised for
      // this user by an earlier attempt. That is the desired outcome, not a
      // failure worth logging as one.
      if (err?.code === UNIQUE_VIOLATION) return;
      console.error('[NotificationService] Failed to create notification:', err);
    }
  }

  /** Creates the same notification for several users. Never throws. */
  static async notifyMany(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>): Promise<void> {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (unique.length === 0) return;
    try {
      await prisma.notification.createMany({
        data: unique.map((userId) => ({
          userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link ?? null,
          eventId: scopedEventId(input.eventId, userId),
        })),
        // Recipients already notified about this event are skipped; the rest are
        // still created. Without this, one duplicate would fail the whole batch.
        skipDuplicates: true,
      });
      announce(unique);
    } catch (err) {
      console.error('[NotificationService] Failed to create notifications:', err);
    }
  }

  /**
   * Resolves the linked user id for an employee, or null when the employee has
   * no login account (in which case there is nobody to notify).
   */
  static async userIdForEmployee(employeeId: string | null | undefined): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { user: { select: { id: true } } },
    });
    return employee?.user?.id ?? null;
  }

  /** Every HR Personnel (FULL tier) user id — used for events HR must action. */
  static async hrUserIds(): Promise<string[]> {
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        employmentState: 'ACTIVE',
        jobRole: { permissionTier: 'FULL' },
        user: { isNot: null },
      },
      select: { user: { select: { id: true, isActive: true } } },
    });
    return employees
      .map((e) => e.user)
      .filter((u): u is { id: string; isActive: boolean } => !!u && u.isActive)
      .map((u) => u.id);
  }

  /**
   * Calls `listener` whenever this user's notifications change (a new one, or
   * one marked read — in any tab). Returns the unsubscribe function.
   */
  static onChange(userId: string, listener: () => void): () => void {
    changes.on(userId, listener);
    return () => {
      changes.off(userId, listener);
    };
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  static async list(
    userId: string,
    params: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(Math.max(1, Number(params.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (params.unreadOnly) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  static async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  static async markRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404);
    }
    if (notification.isRead) return notification;

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    announce([userId]);
    return updated;
  }

  static async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count > 0) announce([userId]);
    return { updated: result.count };
  }
}
