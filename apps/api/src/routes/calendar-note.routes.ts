import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../config/prisma';
import { NotificationService } from '../services/notification.service';

/**
 * Dashboard calendar notes.
 *
 *   PERSONAL  — anyone; visible only to the author (the default).
 *   ALL       — HR only; appears on every employee's calendar.
 *   SELECTED  — HR only; appears only on the chosen employees' calendars.
 *
 * Recipients see shared notes read-only. Only the author can change, complete
 * or delete a note — enforced in every write by filtering on the author's id.
 *
 * Every action is written to the audit log so it shows in Recent Activity. A
 * PERSONAL note's title is never stored there: the audit log is readable by HR,
 * and a private note must stay private.
 */
const router = Router();
router.use(authenticate);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;
const MAX_RECIPIENTS = 500;

const audienceSchema = z.enum(['PERSONAL', 'ALL', 'SELECTED']);

const createSchema = z.object({
  date: z.string().regex(DAY, 'Date must be YYYY-MM-DD.'),
  title: z.string().trim().min(1, 'Please enter a title.').max(120, 'Keep the title under 120 characters.'),
  details: z.string().trim().max(1000, 'Keep the details under 1000 characters.').optional().nullable(),
  audience: audienceSchema.optional(),
  recipientIds: z.array(z.string().min(1)).max(MAX_RECIPIENTS).optional(),
}).strict();

const updateSchema = z.object({
  date: z.string().regex(DAY, 'Date must be YYYY-MM-DD.').optional(),
  title: z.string().trim().min(1, 'Please enter a title.').max(120, 'Keep the title under 120 characters.').optional(),
  details: z.string().trim().max(1000, 'Keep the details under 1000 characters.').optional().nullable(),
  isDone: z.boolean().optional(),
  audience: audienceSchema.optional(),
  recipientIds: z.array(z.string().min(1)).max(MAX_RECIPIENTS).optional(),
}).strict();

/** `YYYY-MM-DD` → the UTC-midnight Date a `@db.Date` column stores. */
const toDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Invalid note.', 400);
  }
  return result.data;
}

const noteInclude = {
  user: { select: { id: true, employee: { select: { firstName: true, lastName: true } } } },
  recipients: { select: { employee: { select: { id: true, firstName: true, lastName: true } } } },
} as const;

type NoteRow = Awaited<ReturnType<typeof prisma.calendarNote.findFirst<{ include: typeof noteInclude }>>>;

/** API shape. Recipient names go only to the author. */
function present(note: NonNullable<NoteRow>, viewerId: string) {
  const isOwner = note.userId === viewerId;
  const author = note.user?.employee
    ? `${note.user.employee.firstName} ${note.user.employee.lastName}`.trim()
    : 'HR';
  return {
    id: note.id,
    date: note.date,
    title: note.title,
    details: note.details,
    isDone: note.isDone,
    audience: note.audience,
    isOwner,
    author,
    recipientCount: note.recipients.length,
    recipients: isOwner
      ? note.recipients.map((r) => ({ id: r.employee.id, name: `${r.employee.firstName} ${r.employee.lastName}`.trim() }))
      : undefined,
    createdAt: note.createdAt,
  };
}

/** Validates who a shared note may go to; only HR may share at all. */
async function resolveAudience(
  tier: string,
  audience: 'PERSONAL' | 'ALL' | 'SELECTED',
  recipientIds: string[] | undefined
): Promise<string[]> {
  if (audience === 'PERSONAL') return [];
  if (tier !== 'FULL') throw new AppError('Only HR can post notes to other employees.', 403);
  if (audience === 'ALL') return [];
  const ids = [...new Set(recipientIds ?? [])];
  if (ids.length === 0) throw new AppError('Choose at least one employee for this note.', 400);
  const found = await prisma.employee.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== ids.length) throw new AppError('One or more selected employees could not be found.', 400);
  return ids;
}

async function audit(
  actorUserId: string,
  action: string,
  noteId: string,
  metadata: Record<string, unknown>,
  ip?: string
) {
  await prisma.auditLog.create({
    data: { actorUserId, action, entityType: 'CalendarNote', entityId: noteId, metadata: metadata as any, ipAddress: ip },
  });
}

/** GET /calendar-notes?from&to — own notes plus notes shared with the caller. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!DAY.test(from) || !DAY.test(to)) throw new AppError('Provide from and to as YYYY-MM-DD.', 400);
    const start = toDay(from);
    const end = toDay(to);
    if (end < start) throw new AppError('The end date must be on or after the start date.', 400);
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new AppError(`Request at most ${MAX_RANGE_DAYS} days at a time.`, 400);
    }

    const me = req.user!;
    const notes = await prisma.calendarNote.findMany({
      where: {
        date: { gte: start, lte: end },
        OR: [
          { userId: me.userId },
          { audience: 'ALL' },
          ...(me.employeeId ? [{ audience: 'SELECTED' as const, recipients: { some: { employeeId: me.employeeId } } }] : []),
        ],
      },
      include: noteInclude,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: notes.map((n) => present(n, me.userId)) });
  })
);

/** POST /calendar-notes */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const body = parse(createSchema, req.body);
    const audience = body.audience ?? 'PERSONAL';
    const recipientIds = await resolveAudience(me.permissionTier, audience, body.recipientIds);

    const note = await prisma.calendarNote.create({
      data: {
        userId: me.userId,
        date: toDay(body.date),
        title: body.title,
        details: body.details || null,
        audience,
        recipients: recipientIds.length ? { create: recipientIds.map((employeeId) => ({ employeeId })) } : undefined,
      },
      include: noteInclude,
    });

    await audit(
      me.userId,
      audience === 'PERSONAL' ? 'PERSONAL_NOTE_CREATED' : 'CALENDAR_NOTE_POSTED',
      note.id,
      audience === 'PERSONAL'
        ? { date: body.date }
        : { title: note.title, date: body.date, audience, recipientCount: recipientIds.length },
      req.ip
    );
    await notifyRecipients(note, me.userId, recipientIds);
    res.status(201).json({ success: true, data: present(note, me.userId) });
  })
);

/**
 * Tells the people a shared note is for, so it lands on their bell as well as
 * their calendar: everyone active for ALL, the chosen employees' accounts for
 * SELECTED. The author is never notified about their own note. One event key
 * per note, so a retried request cannot notify anyone twice.
 */
async function notifyRecipients(
  note: { id: string; title: string; date: Date; audience: string },
  authorUserId: string,
  recipientEmployeeIds: string[]
) {
  if (note.audience === 'PERSONAL') return;
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      id: { not: authorUserId },
      ...(note.audience === 'SELECTED' ? { employeeId: { in: recipientEmployeeIds } } : {}),
    },
    select: { id: true },
  });
  const day = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', // @db.Date is stored as midnight UTC
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(note.date);
  await NotificationService.notifyMany(
    users.map((u) => u.id),
    {
      type: 'ANNOUNCEMENT',
      title: 'New calendar note from HR',
      message: `${note.title} — ${day}`,
      link: '/dashboard',
      eventId: `calendar-note:${note.id}`,
    }
  );
}

/** PATCH /calendar-notes/:id — author only; anyone else gets a plain 404. */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const body = parse(updateSchema, req.body);
    const existing = await prisma.calendarNote.findFirst({ where: { id: req.params.id, userId: me.userId } });
    if (!existing) throw new AppError('Note not found.', 404);

    const audience = body.audience ?? existing.audience;
    const audienceChanging = body.audience !== undefined || body.recipientIds !== undefined;
    const recipientIds = audienceChanging
      ? await resolveAudience(me.permissionTier, audience, body.recipientIds)
      : null;

    const note = await prisma.$transaction(async (tx) => {
      const result = await tx.calendarNote.updateMany({
        where: { id: existing.id, userId: me.userId },
        data: {
          ...(body.date !== undefined ? { date: toDay(body.date) } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.details !== undefined ? { details: body.details || null } : {}),
          ...(body.isDone !== undefined ? { isDone: body.isDone } : {}),
          ...(audienceChanging ? { audience } : {}),
        },
      });
      if (result.count !== 1) throw new AppError('Note not found.', 404);
      if (recipientIds) {
        await tx.calendarNoteRecipient.deleteMany({ where: { noteId: existing.id } });
        if (recipientIds.length) {
          await tx.calendarNoteRecipient.createMany({
            data: recipientIds.map((employeeId) => ({ noteId: existing.id, employeeId })),
          });
        }
      }
      return tx.calendarNote.findUniqueOrThrow({ where: { id: existing.id }, include: noteInclude });
    });

    const onlyToggle = Object.keys(body).length === 1 && body.isDone !== undefined;
    const action = note.audience === 'PERSONAL'
      ? onlyToggle ? (body.isDone ? 'PERSONAL_NOTE_COMPLETED' : 'PERSONAL_NOTE_REOPENED') : 'PERSONAL_NOTE_UPDATED'
      : 'CALENDAR_NOTE_UPDATED';
    await audit(
      me.userId,
      action,
      note.id,
      note.audience === 'PERSONAL'
        ? { date: note.date.toISOString().slice(0, 10) }
        : { title: note.title, date: note.date.toISOString().slice(0, 10), audience: note.audience, recipientCount: note.recipients.length },
      req.ip
    );
    res.json({ success: true, data: present(note, me.userId) });
  })
);

/** DELETE /calendar-notes/:id — author only. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const existing = await prisma.calendarNote.findFirst({ where: { id: req.params.id, userId: me.userId } });
    if (!existing) throw new AppError('Note not found.', 404);
    const result = await prisma.calendarNote.deleteMany({ where: { id: existing.id, userId: me.userId } });
    if (result.count !== 1) throw new AppError('Note not found.', 404);
    await audit(
      me.userId,
      existing.audience === 'PERSONAL' ? 'PERSONAL_NOTE_DELETED' : 'CALENDAR_NOTE_DELETED',
      existing.id,
      existing.audience === 'PERSONAL'
        ? { date: existing.date.toISOString().slice(0, 10) }
        : { title: existing.title, date: existing.date.toISOString().slice(0, 10), audience: existing.audience },
      req.ip
    );
    res.json({ success: true });
  })
);

export default router;
