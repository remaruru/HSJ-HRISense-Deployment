import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';

/**
 * Yearly Achievements — Hospicio's institutional achievements, one page per
 * year, created by HR (FULL) through the UI for any year (nothing is hard-coded).
 * Every signed-in employee reads the PUBLISHED pages; drafts are HR-only.
 */

export const ACHIEVEMENT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'achievements');

type Actor = { id: string; employeeId?: string | null; permissionTier: string };
type UploadedFile = { filename: string; originalname: string; mimetype: string; path: string } | undefined;

const isHr = (a: Actor) => a.permissionTier === 'FULL';
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const removeFile = (stored?: string | null) => {
  if (!stored) return;
  const p = path.join(ACHIEVEMENT_UPLOAD_DIR, path.basename(stored));
  fs.promises.unlink(p).catch(() => undefined);
};

const entryView = (e: any) => ({
  id: e.id,
  title: e.title,
  description: e.description,
  displayOrder: e.displayOrder,
  attachment: e.attachmentPath ? { name: e.attachmentName, mime: e.attachmentMime, isImage: String(e.attachmentMime ?? '').startsWith('image/') } : null,
});

export class YearlyAchievementService {
  static async list(actor: Actor) {
    const pages = await prisma.yearlyAchievementPage.findMany({
      where: { deletedAt: null, ...(isHr(actor) ? {} : { status: 'PUBLISHED' }) },
      include: { _count: { select: { entries: true } } },
      orderBy: { year: 'desc' },
    });
    return pages.map(({ _count, ...p }) => ({ ...p, entryCount: _count.entries }));
  }

  private static async load(id: string) {
    const page = await prisma.yearlyAchievementPage.findFirst({
      where: { id, deletedAt: null },
      include: { entries: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!page) throw new AppError('Yearly Achievements page not found.', 404);
    return page;
  }

  static async get(id: string, actor: Actor) {
    const page = await this.load(id);
    if (page.status !== 'PUBLISHED' && !isHr(actor)) throw new AppError('Yearly Achievements page not found.', 404);
    return { ...page, entries: page.entries.map(entryView) };
  }

  static async create(input: any, actor: Actor) {
    const year = Number(input?.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new AppError('Enter the year (for example 2027).', 400);
    if (await prisma.yearlyAchievementPage.findFirst({ where: { year, deletedAt: null } })) {
      throw new AppError(`A Yearly Achievements page for ${year} already exists — open it to add achievements.`, 409);
    }
    const page = await prisma.yearlyAchievementPage.create({
      data: {
        year,
        title: clean(input?.title, 150) || `${year} Yearly Achievements`,
        summary: clean(input?.summary, 5000) || null,
        createdById: actor.id || null,
        updatedById: actor.id || null,
      },
    });
    await createAuditLog({ actorUserId: actor.id, action: 'YEARLY_ACHIEVEMENTS_CREATED', entityType: 'YearlyAchievementPage', entityId: page.id, metadata: { year } });
    return this.get(page.id, actor);
  }

  static async update(id: string, input: any, actor: Actor) {
    const page = await this.load(id);
    const data: any = { updatedById: actor.id || null };
    if (input?.title !== undefined) {
      const t = clean(input.title, 150);
      if (!t) throw new AppError('The page needs a title.', 400);
      data.title = t;
    }
    if (input?.summary !== undefined) data.summary = clean(input.summary, 5000) || null;
    if (input?.year !== undefined && Number(input.year) !== page.year) {
      const year = Number(input.year);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new AppError('Enter a valid year.', 400);
      if (await prisma.yearlyAchievementPage.findFirst({ where: { year, deletedAt: null, NOT: { id } } })) throw new AppError(`${year} already has a page.`, 409);
      data.year = year;
    }
    if (input?.status === 'PUBLISHED' || input?.status === 'DRAFT') {
      data.status = input.status;
      if (input.status === 'PUBLISHED' && page.status !== 'PUBLISHED') data.publishedAt = new Date();
    }
    await prisma.yearlyAchievementPage.update({ where: { id }, data });
    await createAuditLog({
      actorUserId: actor.id,
      action: data.status && data.status !== page.status ? (data.status === 'PUBLISHED' ? 'YEARLY_ACHIEVEMENTS_PUBLISHED' : 'YEARLY_ACHIEVEMENTS_UNPUBLISHED') : 'YEARLY_ACHIEVEMENTS_UPDATED',
      entityType: 'YearlyAchievementPage',
      entityId: id,
      metadata: { year: data.year ?? page.year, fields: Object.keys(data).filter((k) => k !== 'updatedById') },
    });
    return this.get(id, actor);
  }

  static async remove(id: string, actor: Actor) {
    const page = await this.load(id);
    await prisma.yearlyAchievementPage.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.id || null } });
    await createAuditLog({ actorUserId: actor.id, action: 'YEARLY_ACHIEVEMENTS_DELETED', entityType: 'YearlyAchievementPage', entityId: id, metadata: { year: page.year, sample: page.isSample } });
  }

  static async addEntry(pageId: string, input: any, file: UploadedFile, actor: Actor) {
    const page = await this.load(pageId);
    const title = clean(input?.title, 200);
    const description = clean(input?.description, 10000);
    if (!title || !description) {
      removeFile(file?.filename);
      throw new AppError('An achievement needs a title and a description.', 400);
    }
    const last = page.entries[page.entries.length - 1];
    await prisma.yearlyAchievementEntry.create({
      data: {
        pageId, title, description, displayOrder: (last?.displayOrder ?? 0) + 1,
        ...(file ? { attachmentPath: file.filename, attachmentName: file.originalname.slice(0, 200), attachmentMime: file.mimetype } : {}),
      },
    });
    await prisma.yearlyAchievementPage.update({ where: { id: pageId }, data: { updatedById: actor.id || null } });
    await createAuditLog({ actorUserId: actor.id, action: 'YEARLY_ACHIEVEMENT_ADDED', entityType: 'YearlyAchievementPage', entityId: pageId, metadata: { title } });
    return this.get(pageId, actor);
  }

  static async updateEntry(entryId: string, input: any, file: UploadedFile, actor: Actor) {
    const entry = await prisma.yearlyAchievementEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      removeFile(file?.filename);
      throw new AppError('Achievement not found.', 404);
    }
    const data: any = {};
    if (input?.title !== undefined) data.title = clean(input.title, 200);
    if (input?.description !== undefined) data.description = clean(input.description, 10000);
    if (data.title === '' || data.description === '') {
      removeFile(file?.filename);
      throw new AppError('An achievement needs a title and a description.', 400);
    }
    const dropAttachment = input?.removeAttachment === true || input?.removeAttachment === 'true';
    if (file || dropAttachment) {
      removeFile(entry.attachmentPath);
      Object.assign(data, file
        ? { attachmentPath: file.filename, attachmentName: file.originalname.slice(0, 200), attachmentMime: file.mimetype }
        : { attachmentPath: null, attachmentName: null, attachmentMime: null });
    }
    await prisma.yearlyAchievementEntry.update({ where: { id: entryId }, data });
    await createAuditLog({ actorUserId: actor.id, action: 'YEARLY_ACHIEVEMENT_UPDATED', entityType: 'YearlyAchievementPage', entityId: entry.pageId, metadata: { entryId } });
    return this.get(entry.pageId, actor);
  }

  static async deleteEntry(entryId: string, actor: Actor) {
    const entry = await prisma.yearlyAchievementEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new AppError('Achievement not found.', 404);
    await prisma.yearlyAchievementEntry.delete({ where: { id: entryId } });
    removeFile(entry.attachmentPath);
    await createAuditLog({ actorUserId: actor.id, action: 'YEARLY_ACHIEVEMENT_REMOVED', entityType: 'YearlyAchievementPage', entityId: entry.pageId, metadata: { title: entry.title } });
    return this.get(entry.pageId, actor);
  }

  /** Moves an achievement up or down the page. */
  static async moveEntry(entryId: string, direction: 'up' | 'down', actor: Actor) {
    const entry = await prisma.yearlyAchievementEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new AppError('Achievement not found.', 404);
    const siblings = await prisma.yearlyAchievementEntry.findMany({ where: { pageId: entry.pageId }, orderBy: { displayOrder: 'asc' } });
    const i = siblings.findIndex((s) => s.id === entryId);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < siblings.length) {
      const order = siblings.map((s) => s.id);
      [order[i], order[j]] = [order[j], order[i]];
      await prisma.$transaction(order.map((id, k) => prisma.yearlyAchievementEntry.update({ where: { id }, data: { displayOrder: k + 1 } })));
    }
    return this.get(entry.pageId, actor);
  }

  /** The stored file of an achievement — only for someone who may see its page. */
  static async attachment(entryId: string, actor: Actor) {
    const entry = await prisma.yearlyAchievementEntry.findUnique({ where: { id: entryId }, include: { page: true } });
    if (!entry || !entry.attachmentPath || entry.page.deletedAt) throw new AppError('File not found.', 404);
    if (entry.page.status !== 'PUBLISHED' && !isHr(actor)) throw new AppError('File not found.', 404);
    const filePath = path.join(ACHIEVEMENT_UPLOAD_DIR, path.basename(entry.attachmentPath));
    if (!fs.existsSync(filePath)) throw new AppError('File not found.', 404);
    return { filePath, mime: entry.attachmentMime ?? 'application/octet-stream', name: entry.attachmentName ?? 'attachment' };
  }
}
