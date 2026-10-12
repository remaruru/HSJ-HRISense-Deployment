import fs from 'fs';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { removeFileQuietly } from '../middleware/upload';
import { createAuditLog } from '../lib/audit';

/**
 * A person's own profile photo and profile banner, set from My Profile.
 *
 * Each image is stored like every other employee file — a protected document
 * streamed through `/documents/:id/preview` — so exactly the people who may
 * open the profile (the person, their supervisor, HR) can see it. Setting a new
 * one removes the document it replaces; removing the banner brings back the
 * default one.
 */
export type ProfileImageKind = 'photo' | 'banner';

const FIELD = { photo: 'photoUrl', banner: 'bannerUrl' } as const;
const NOTE = { photo: 'Profile photo, set by the employee', banner: 'Profile banner, set by the employee' };
const AUDIT = { photo: 'PROFILE_PHOTO_CHANGED', banner: 'PROFILE_BANNER_CHANGED' } as const;
const PREVIEW_PATH = /^\/documents\/([0-9a-f-]{36})\/preview$/i;

/** True when the file starts like a JPEG, PNG or WEBP image — the browser's MIME type is only a claim. */
function looksLikeImage(filePath: string): boolean {
  const head = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, head, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
  return jpeg || png || webp;
}

/** The document id behind a stored preview path, if it is one. */
const documentIdOf = (url: string | null | undefined) => (url ? PREVIEW_PATH.exec(url)?.[1] : undefined);

export class ProfileImageService {
  /** Makes the uploaded image the person's photo or banner, and removes the one it replaces. */
  static async set(
    kind: ProfileImageKind,
    employeeId: string,
    actorUserId: string,
    file: Express.Multer.File | undefined,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    if (!file) throw new AppError('Choose a JPG, PNG or WEBP image to upload.', 400);
    try {
      if (!looksLikeImage(file.path)) throw new AppError('That file is not a JPG, PNG or WEBP image.', 400);

      const url = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { photoUrl: true, bannerUrl: true } });
        if (!employee) throw new AppError('Employee not found', 404);

        const doc = await tx.employeeDocument.create({
          data: {
            employeeId,
            category: DocumentCategory.OTHER,
            originalFilename: file.originalname,
            storedFilename: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            isVisibleToEmployee: true,
            isVisibleToSupervisor: true,
            notes: NOTE[kind],
            uploadedById: actorUserId,
          },
        });
        const next = `/documents/${doc.id}/preview`;
        await tx.employee.update({ where: { id: employeeId }, data: { [FIELD[kind]]: next } });

        const replaced = documentIdOf(employee[FIELD[kind]]);
        if (replaced) {
          await tx.employeeDocument.updateMany({ where: { id: replaced, employeeId, deletedAt: null }, data: { deletedAt: new Date() } });
        }
        return next;
      });

      await createAuditLog({
        actorUserId,
        action: AUDIT[kind],
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        ipAddress,
        userAgent,
      });
      return url;
    } catch (err) {
      // Nothing points at the new file when anything above fails.
      await removeFileQuietly(file.path, `profile ${kind} upload`);
      throw err;
    }
  }

  /** Puts the default banner back and removes the person's own banner image. */
  static async removeBanner(employeeId: string, actorUserId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { bannerUrl: true } });
    if (!employee) throw new AppError('Employee not found', 404);
    if (!employee.bannerUrl) return;

    const replaced = documentIdOf(employee.bannerUrl);
    await prisma.$transaction([
      prisma.employee.update({ where: { id: employeeId }, data: { bannerUrl: null } }),
      ...(replaced
        ? [prisma.employeeDocument.updateMany({ where: { id: replaced, employeeId, deletedAt: null }, data: { deletedAt: new Date() } })]
        : []),
    ]);

    await createAuditLog({
      actorUserId,
      action: 'PROFILE_BANNER_REMOVED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      ipAddress,
      userAgent,
    });
  }
}
