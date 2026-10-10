import fs from 'fs';
import { distribution } from '../lib/percent';
import path from 'path';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  AnnouncementState,
  AnnouncementScopeType,
  AnnouncementPriority,
  EmploymentState,
  Prisma,
} from '@prisma/client';
import { createAuditLog } from '../lib/audit';

// ── Upload Directory ──────────────────────────────────────────────────────────
const ANNOUNCE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'announcements');
if (!fs.existsSync(ANNOUNCE_UPLOAD_DIR)) {
  fs.mkdirSync(ANNOUNCE_UPLOAD_DIR, { recursive: true });
}

/**
 * Validates storedFilename is a safe basename within uploads/announcements.
 * Reuses the hardened path-containment pattern from training.service.ts.
 * Returns absolute path on success, null on any containment failure.
 */
export function resolveSafeAnnouncementFilePath(storedFilename: string | null | undefined): string | null {
  if (!storedFilename || typeof storedFilename !== 'string') return null;
  const root = path.resolve(ANNOUNCE_UPLOAD_DIR);
  const safeFilename = path.basename(storedFilename.trim());
  if (!safeFilename || safeFilename === '.' || safeFilename === '..') return null;

  const target = path.resolve(root, safeFilename);
  const relative = path.relative(root, target);

  // Reject if relative path starts with '..' or is absolute or is empty
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;

  return target;
}

/**
 * Safely unlinks an announcement upload file.
 * Logs warning on path containment failure; logs error on unlink failure.
 * Never throws — caller continues regardless.
 */
export function safeUnlinkAnnouncementFile(storedFilename: string | null | undefined): void {
  if (!storedFilename) return;
  try {
    const target = resolveSafeAnnouncementFilePath(storedFilename);
    if (!target) {
      console.warn(`[Announcement File Security] Invalid path containment for deletion: ${storedFilename}`);
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      fs.unlinkSync(target);
    }
  } catch (err) {
    console.error('[Announcement File Safe Unlink Error]', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENT SERVICE
//
// Implements the complete Announcement lifecycle for HSJ HRISense.
// Domain: Internal HR Communication (NOT notifications, NOT payroll, NOT AI-generated).
//
// State machine (persisted):
//   DRAFT    → ACTIVE (via activate/schedule)  → ARCHIVED
//   ACTIVE   → ARCHIVED
//
// Derived statuses (computed from state + publishAt + expiresAt + server now):
//   DRAFT      state=DRAFT
//   SCHEDULED  state=ACTIVE AND publishAt > now
//   PUBLISHED  state=ACTIVE AND publishAt ≤ now AND (expiresAt null OR > now)
//   EXPIRED    state=ACTIVE AND publishAt ≤ now AND expiresAt ≤ now
//   ARCHIVED   state=ARCHIVED
//
// NO cron job. NO background scheduler. Status resolved at query time.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type DerivedAnnouncementStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'ARCHIVED';

export interface ScopeInput {
  scopeType: AnnouncementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
}

export interface CreateAnnouncementDto {
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  expiresAt?: string | Date | null;
  scopes?: ScopeInput[];
}

export interface UpdateAnnouncementDto {
  title?: string;
  body?: string;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  expiresAt?: string | Date | null;
  publishAt?: string | Date | null;
  scopes?: ScopeInput[];
}

// Employee select shape used in audience preview and recipient listings.
const EMPLOYEE_SAFE_SELECT = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  unit: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  jobRole: { select: { id: true, title: true } },
} as const;

// ── Derived Status Helper ─────────────────────────────────────────────────────

export function getDerivedStatus(
  announcement: { state: AnnouncementState; publishAt: Date | null; expiresAt: Date | null },
  now: Date = new Date()
): DerivedAnnouncementStatus {
  if (announcement.state === AnnouncementState.DRAFT) return 'DRAFT';
  if (announcement.state === AnnouncementState.ARCHIVED) return 'ARCHIVED';

  // state = ACTIVE
  if (!announcement.publishAt || announcement.publishAt > now) return 'SCHEDULED';

  // publishAt <= now
  if (announcement.expiresAt && announcement.expiresAt <= now) return 'EXPIRED';

  return 'PUBLISHED';
}

// ── Scope Validation ──────────────────────────────────────────────────────────

/**
 * Validates audience scope shapes. Throws AppError on invalid combinations.
 * Backend-authoritative — do not trust frontend scope shapes.
 */
function validateScopeShape(scope: ScopeInput): void {
  const { scopeType, targetUnitId, targetDepartmentId, targetJobRoleId, targetEmployeeId } = scope;

  switch (scopeType) {
    case AnnouncementScopeType.ALL:
      if (targetUnitId || targetDepartmentId || targetJobRoleId || targetEmployeeId) {
        throw new AppError(
          'The "Everyone" audience scope must not include a specific target. Please remove the extra target.',
          400
        );
      }
      break;
    case AnnouncementScopeType.UNIT:
      if (!targetUnitId) throw new AppError('A unit selection is required for Unit audience scope.', 400);
      if (targetDepartmentId || targetJobRoleId || targetEmployeeId) {
        throw new AppError('Unit scope must only have a unit target. Please remove extra targets.', 400);
      }
      break;
    case AnnouncementScopeType.DEPARTMENT:
      if (!targetDepartmentId) throw new AppError('A department selection is required for Department audience scope.', 400);
      if (targetUnitId || targetJobRoleId || targetEmployeeId) {
        throw new AppError('Department scope must only have a department target. Please remove extra targets.', 400);
      }
      break;
    case AnnouncementScopeType.JOB_ROLE:
      if (!targetJobRoleId) throw new AppError('A job role selection is required for Job Role audience scope.', 400);
      if (targetUnitId || targetDepartmentId || targetEmployeeId) {
        throw new AppError('Job Role scope must only have a job role target. Please remove extra targets.', 400);
      }
      break;
    case AnnouncementScopeType.EMPLOYEE:
      if (!targetEmployeeId) throw new AppError('A specific employee selection is required for Individual audience scope.', 400);
      if (targetUnitId || targetDepartmentId || targetJobRoleId) {
        throw new AppError('Individual scope must only have an employee target. Please remove extra targets.', 400);
      }
      break;
    default:
      throw new AppError('Invalid audience scope type.', 400);
  }
}

/**
 * Validates all scopes in an array and verifies referenced entity IDs exist.
 */
async function validateAndNormalizeScopes(scopes: ScopeInput[]): Promise<ScopeInput[]> {
  if (!scopes || scopes.length === 0) {
    throw new AppError('Please choose who should receive this announcement.', 400);
  }

  for (const scope of scopes) {
    validateScopeShape(scope);

    // Verify referenced entity exists
    if (scope.scopeType === AnnouncementScopeType.UNIT && scope.targetUnitId) {
      const unit = await prisma.unit.findUnique({ where: { id: scope.targetUnitId }, select: { id: true } });
      if (!unit) throw new AppError('The selected unit was not found. Please choose a valid unit.', 400);
    }
    if (scope.scopeType === AnnouncementScopeType.DEPARTMENT && scope.targetDepartmentId) {
      const dept = await prisma.department.findUnique({ where: { id: scope.targetDepartmentId }, select: { id: true } });
      if (!dept) throw new AppError('The selected department was not found. Please choose a valid department.', 400);
    }
    if (scope.scopeType === AnnouncementScopeType.JOB_ROLE && scope.targetJobRoleId) {
      const role = await prisma.jobRole.findUnique({ where: { id: scope.targetJobRoleId }, select: { id: true } });
      if (!role) throw new AppError('The selected job role was not found. Please choose a valid job role.', 400);
    }
      if (scope.scopeType === AnnouncementScopeType.EMPLOYEE && scope.targetEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: scope.targetEmployeeId },
        select: { id: true, employmentState: true, deletedAt: true },
      });
      if (
        !emp ||
        emp.deletedAt ||
        emp.employmentState === EmploymentState.RESIGNED ||
        emp.employmentState === EmploymentState.TERMINATED ||
        emp.employmentState === EmploymentState.RETIRED
      ) {
        throw new AppError('The selected employee was not found or is no longer active.', 400);
      }
    }
  }

  return scopes;
}

// ── Audience Resolution ───────────────────────────────────────────────────────

/**
 * Resolves a list of audience scopes into a deduplicated array of active employee IDs.
 * Queries the database directly — does NOT use paginated /employees endpoint.
 * Active employees: employmentState = ACTIVE, deletedAt = null.
 */
async function resolveAudienceToEmployeeIds(scopes: ScopeInput[]): Promise<string[]> {
  const idSet = new Set<string>();

  const activeWhere = {
    deletedAt: null,
    employmentState: EmploymentState.ACTIVE,
  };

  for (const scope of scopes) {
    let ids: string[] = [];

    switch (scope.scopeType) {
      case AnnouncementScopeType.ALL: {
        const employees = await prisma.employee.findMany({
          where: activeWhere,
          select: { id: true },
        });
        ids = employees.map((e) => e.id);
        break;
      }
      case AnnouncementScopeType.UNIT: {
        const employees = await prisma.employee.findMany({
          where: { ...activeWhere, unitId: scope.targetUnitId! },
          select: { id: true },
        });
        ids = employees.map((e) => e.id);
        break;
      }
      case AnnouncementScopeType.DEPARTMENT: {
        const employees = await prisma.employee.findMany({
          where: { ...activeWhere, departmentId: scope.targetDepartmentId! },
          select: { id: true },
        });
        ids = employees.map((e) => e.id);
        break;
      }
      case AnnouncementScopeType.JOB_ROLE: {
        const employees = await prisma.employee.findMany({
          where: { ...activeWhere, jobRoleId: scope.targetJobRoleId! },
          select: { id: true },
        });
        ids = employees.map((e) => e.id);
        break;
      }
      case AnnouncementScopeType.EMPLOYEE: {
        // Single employee — verify still active
        const emp = await prisma.employee.findUnique({
          where: { id: scope.targetEmployeeId! },
          select: { id: true, employmentState: true, deletedAt: true },
        });
        if (
          emp &&
          !emp.deletedAt &&
          emp.employmentState !== EmploymentState.RESIGNED &&
          emp.employmentState !== EmploymentState.TERMINATED &&
          emp.employmentState !== EmploymentState.RETIRED
        ) {
          ids = [emp.id];
        }
        break;
      }
    }

    ids.forEach((id) => idSet.add(id));
  }

  return Array.from(idSet);
}

// ── Recipient Snapshot ────────────────────────────────────────────────────────

/**
 * Replaces the recipient snapshot for an announcement within a given transaction.
 * Deletes existing recipients, inserts fresh deduplicated ones.
 * Protected by UNIQUE(announcementId, employeeId) at DB level.
 */
async function replaceRecipientSnapshot(
  announcementId: string,
  employeeIds: string[],
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.announcementRecipient.deleteMany({ where: { announcementId } });
  if (employeeIds.length === 0) return;

  await tx.announcementRecipient.createMany({
    data: employeeIds.map((employeeId) => ({ announcementId, employeeId })),
    skipDuplicates: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class AnnouncementService {

  // ── Audience Preview ─────────────────────────────────────────────────────────

  /**
   * Resolves audience without persisting. Used during wizard Step 2.
   * Returns totalRecipients + bounded preview list (max 20).
   * Zero is allowed — blocked only at activation/scheduling.
   */
  static async previewAudience(scopes: ScopeInput[]) {
    if (!scopes || scopes.length === 0) {
      return { totalRecipients: 0, previewEmployees: [] };
    }

    // Validate shapes only (not strict entity existence check for preview)
    for (const scope of scopes) {
      validateScopeShape(scope);
    }

    const employeeIds = await resolveAudienceToEmployeeIds(scopes);
    const total = employeeIds.length;
    const previewIds = employeeIds.slice(0, 20);

    const employees = previewIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: previewIds } },
          select: EMPLOYEE_SAFE_SELECT,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        })
      : [];

    return {
      totalRecipients: total,
      previewEmployees: employees.map((e) => ({
        employeeId: e.id,
        employeeNumber: e.employeeNumber,
        name: `${e.firstName} ${e.lastName}`,
        unit: e.unit,
        department: e.department,
        jobRole: e.jobRole,
      })),
    };
  }

  // ── Create Draft ──────────────────────────────────────────────────────────────

  static async createDraft(
    data: CreateAnnouncementDto,
    creatorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (!data.title?.trim()) throw new AppError('Please enter an announcement title.', 400);
    if (!data.body?.trim()) throw new AppError('Please write an announcement message.', 400);

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title.trim(),
        content: data.body.trim(),      // legacy column kept in sync
        body: data.body.trim(),
        priority: data.priority ?? AnnouncementPriority.NORMAL,
        state: AnnouncementState.DRAFT,
        isPinned: data.isPinned ?? false,
        expiresAt,
        createdByUserId: creatorUserId,
        audienceScopes: data.scopes?.length ? {
          create: data.scopes.map((s) => ({
            scopeType: s.scopeType,
            targetUnitId: s.targetUnitId ?? null,
            targetDepartmentId: s.targetDepartmentId ?? null,
            targetJobRoleId: s.targetJobRoleId ?? null,
            targetEmployeeId: s.targetEmployeeId ?? null,
          })),
        } : undefined,
      },
      include: {
        audienceScopes: true,
        _count: { select: { recipients: true, attachments: true } },
      },
    });

    await createAuditLog({
      actorUserId: creatorUserId,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'ANNOUNCEMENT',
      entityId: announcement.id,
      metadata: { title: announcement.title, state: 'DRAFT' },
      ipAddress,
      userAgent,
    });

    return { ...announcement, derivedStatus: getDerivedStatus(announcement) };
  }

  // ── Update Announcement ───────────────────────────────────────────────────────

  static async updateAnnouncement(
    id: string,
    data: UpdateAnnouncementDto,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const now = new Date();
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { audienceScopes: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const derived = getDerivedStatus(announcement, now);

    if (derived === 'ARCHIVED') {
      throw new AppError('Archived announcements cannot be edited.', 400);
    }

    const updateData: Prisma.AnnouncementUpdateInput = {};
    let rebuildSnapshot = false;

    if (derived === 'DRAFT') {
      // Drafts: all fields editable
      if (data.title !== undefined) {
        updateData.title = data.title.trim();
      }
      if (data.body !== undefined) {
        updateData.body = data.body.trim();
        updateData.content = data.body.trim(); // keep legacy in sync
      }
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

      if (data.scopes !== undefined) {
        await validateAndNormalizeScopes(data.scopes);
        // Replace scopes
        await prisma.announcementAudienceScope.deleteMany({ where: { announcementId: id } });
        if (data.scopes.length > 0) {
          await prisma.announcementAudienceScope.createMany({
            data: data.scopes.map((s) => ({
              announcementId: id,
              scopeType: s.scopeType,
              targetUnitId: s.targetUnitId ?? null,
              targetDepartmentId: s.targetDepartmentId ?? null,
              targetJobRoleId: s.targetJobRoleId ?? null,
              targetEmployeeId: s.targetEmployeeId ?? null,
            })),
          });
        }
      }
    } else if (derived === 'SCHEDULED') {
      // Future scheduled: all fields editable; scope change rebuilds snapshot
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.body !== undefined) {
        updateData.body = data.body.trim();
        updateData.content = data.body.trim();
      }
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      if (data.publishAt !== undefined) {
        const newPublishAt = new Date(data.publishAt as string);
        if (newPublishAt <= now) throw new AppError('Publish time must be in the future.', 400);
        updateData.publishAt = newPublishAt;
      }

      if (data.scopes !== undefined) {
        await validateAndNormalizeScopes(data.scopes);
        await prisma.announcementAudienceScope.deleteMany({ where: { announcementId: id } });
        if (data.scopes.length > 0) {
          await prisma.announcementAudienceScope.createMany({
            data: data.scopes.map((s) => ({
              announcementId: id,
              scopeType: s.scopeType,
              targetUnitId: s.targetUnitId ?? null,
              targetDepartmentId: s.targetDepartmentId ?? null,
              targetJobRoleId: s.targetJobRoleId ?? null,
              targetEmployeeId: s.targetEmployeeId ?? null,
            })),
          });
          rebuildSnapshot = true;
        }
      }
    } else {
      // PUBLISHED or EXPIRED: audience is LOCKED
      if (data.scopes !== undefined) {
        throw new AppError('The audience can no longer be changed after publication.', 400);
      }
      if (data.publishAt !== undefined) {
        throw new AppError('The publish time cannot be changed after publication.', 400);
      }
      // Allow: title, body, priority, isPinned, expiresAt
      if (data.title !== undefined) updateData.title = data.title.trim();
      if (data.body !== undefined) {
        updateData.body = data.body.trim();
        updateData.content = data.body.trim();
      }
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
      if (data.expiresAt !== undefined) {
        const newExpiry = data.expiresAt ? new Date(data.expiresAt) : null;
        if (newExpiry && announcement.publishAt && newExpiry <= announcement.publishAt) {
          throw new AppError('The end time must be after the publish time.', 400);
        }
        updateData.expiresAt = newExpiry;
      }
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        audienceScopes: true,
        _count: { select: { recipients: true, attachments: true } },
      },
    });

    // Rebuild snapshot if scopes changed while scheduled
    if (rebuildSnapshot) {
      const currentScopes = await prisma.announcementAudienceScope.findMany({ where: { announcementId: id } });
      const scopeInputs: ScopeInput[] = currentScopes.map((s) => ({
        scopeType: s.scopeType,
        targetUnitId: s.targetUnitId,
        targetDepartmentId: s.targetDepartmentId,
        targetJobRoleId: s.targetJobRoleId,
        targetEmployeeId: s.targetEmployeeId,
      }));
      const employeeIds = await resolveAudienceToEmployeeIds(scopeInputs);
      await prisma.$transaction(async (tx) => {
        await replaceRecipientSnapshot(id, employeeIds, tx);
      });
    }

    await createAuditLog({
      actorUserId,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      metadata: { title: updated.title, derivedStatus: derived },
      ipAddress,
      userAgent,
    });

    return { ...updated, derivedStatus: getDerivedStatus(updated) };
  }

  // ── Activate (Publish Now) ────────────────────────────────────────────────────

  /**
   * Publishes an announcement immediately.
   * Atomic: validates → resolves audience → creates snapshot → sets state=ACTIVE in ONE transaction.
   * Rejects if zero recipients.
   */
  static async activateNow(
    id: string,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const now = new Date();
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { audienceScopes: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const derived = getDerivedStatus(announcement, now);
    if (derived !== 'DRAFT' && derived !== 'SCHEDULED') {
      throw new AppError('This announcement has already been published or archived.', 400);
    }

    if (!announcement.title?.trim()) throw new AppError('Please enter an announcement title before publishing.', 400);
    if (!announcement.body?.trim()) throw new AppError('Please write an announcement message before publishing.', 400);
    if (!announcement.audienceScopes || announcement.audienceScopes.length === 0) {
      throw new AppError('Please choose who should receive this announcement before publishing.', 400);
    }

    const scopeInputs: ScopeInput[] = announcement.audienceScopes.map((s) => ({
      scopeType: s.scopeType,
      targetUnitId: s.targetUnitId,
      targetDepartmentId: s.targetDepartmentId,
      targetJobRoleId: s.targetJobRoleId,
      targetEmployeeId: s.targetEmployeeId,
    }));

    const employeeIds = await resolveAudienceToEmployeeIds(scopeInputs);
    if (employeeIds.length === 0) {
      throw new AppError('No active employees match the selected audience. Please adjust the audience before publishing.', 400);
    }

    if (announcement.expiresAt && announcement.expiresAt <= now) {
      throw new AppError('The end time must be after the publish time.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // State guard inside transaction to prevent double-activation
      const fresh = await tx.announcement.findUnique({ where: { id }, select: { state: true, publishAt: true } });
      if (!fresh) throw new AppError('Announcement not found.', 404);
      const freshDerived = getDerivedStatus({ state: fresh.state, publishAt: fresh.publishAt, expiresAt: announcement.expiresAt }, now);
      if (freshDerived !== 'DRAFT' && freshDerived !== 'SCHEDULED') {
        throw new AppError('This announcement has already been published.', 409);
      }

      await replaceRecipientSnapshot(id, employeeIds, tx);

      const result = await tx.announcement.update({
        where: { id },
        data: {
          state: AnnouncementState.ACTIVE,
          publishAt: now,
        },
        include: {
          audienceScopes: true,
          _count: { select: { recipients: true, attachments: true } },
        },
      });

      await createAuditLog({
        actorUserId,
        action: 'ANNOUNCEMENT_ACTIVATED',
        entityType: 'ANNOUNCEMENT',
        entityId: id,
        metadata: { title: result.title, recipientCount: employeeIds.length, publishAt: now },
        ipAddress,
        userAgent,
        tx,
      });

      return result;
    });

    return { ...updated, derivedStatus: getDerivedStatus(updated) };
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────

  /**
   * Schedules an announcement for future publication.
   * Recipient snapshot is created AT SCHEDULING TIME.
   */
  static async schedule(
    id: string,
    publishAt: Date,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const now = new Date();
    if (publishAt <= now) throw new AppError('Publish time must be in the future.', 400);

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { audienceScopes: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const derived = getDerivedStatus(announcement, now);
    if (derived !== 'DRAFT' && derived !== 'SCHEDULED') {
      throw new AppError('Only draft or currently-scheduled announcements can be rescheduled.', 400);
    }

    if (!announcement.title?.trim()) throw new AppError('Please enter an announcement title before scheduling.', 400);
    if (!announcement.body?.trim()) throw new AppError('Please write an announcement message before scheduling.', 400);
    if (!announcement.audienceScopes || announcement.audienceScopes.length === 0) {
      throw new AppError('Please choose who should receive this announcement before scheduling.', 400);
    }

    if (announcement.expiresAt && announcement.expiresAt <= publishAt) {
      throw new AppError('The end time must be after the publish time.', 400);
    }

    const scopeInputs: ScopeInput[] = announcement.audienceScopes.map((s) => ({
      scopeType: s.scopeType,
      targetUnitId: s.targetUnitId,
      targetDepartmentId: s.targetDepartmentId,
      targetJobRoleId: s.targetJobRoleId,
      targetEmployeeId: s.targetEmployeeId,
    }));

    const employeeIds = await resolveAudienceToEmployeeIds(scopeInputs);
    if (employeeIds.length === 0) {
      throw new AppError('No active employees match the selected audience. Please adjust the audience before scheduling.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.announcement.findUnique({ where: { id }, select: { state: true, publishAt: true } });
      if (!fresh) throw new AppError('Announcement not found.', 404);
      const freshDerived = getDerivedStatus({ state: fresh.state, publishAt: fresh.publishAt, expiresAt: announcement.expiresAt }, now);
      if (freshDerived !== 'DRAFT' && freshDerived !== 'SCHEDULED') {
        throw new AppError('This announcement has already been published.', 409);
      }

      await replaceRecipientSnapshot(id, employeeIds, tx);

      const result = await tx.announcement.update({
        where: { id },
        data: {
          state: AnnouncementState.ACTIVE,
          publishAt,
        },
        include: {
          audienceScopes: true,
          _count: { select: { recipients: true, attachments: true } },
        },
      });

      await createAuditLog({
        actorUserId,
        action: 'ANNOUNCEMENT_SCHEDULED',
        entityType: 'ANNOUNCEMENT',
        entityId: id,
        metadata: { title: result.title, recipientCount: employeeIds.length, publishAt },
        ipAddress,
        userAgent,
        tx,
      });

      return result;
    });

    return { ...updated, derivedStatus: getDerivedStatus(updated) };
  }

  // ── Archive ───────────────────────────────────────────────────────────────────

  static async archive(
    id: string,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    if (announcement.state === AnnouncementState.ARCHIVED) {
      throw new AppError('This announcement is already archived.', 400);
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        state: AnnouncementState.ARCHIVED,
        archivedAt: new Date(),
      },
      include: {
        _count: { select: { recipients: true, attachments: true } },
      },
    });

    await createAuditLog({
      actorUserId,
      action: 'ANNOUNCEMENT_ARCHIVED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      metadata: { title: announcement.title },
      ipAddress,
      userAgent,
    });

    return { ...updated, derivedStatus: 'ARCHIVED' as DerivedAnnouncementStatus };
  }

  // ── Delete Draft ──────────────────────────────────────────────────────────────

  /**
   * Hard deletes an announcement that is finished with: a DRAFT that was never
   * sent, or an ARCHIVED one that has already been pulled from every feed.
   *
   * An ACTIVE announcement is still in front of staff, so it must be archived
   * first — that is a deliberate two-step, not an oversight. Deleting an
   * archived notice also removes its read receipts; the audit log keeps the
   * record that it was deleted, by whom and when.
   *
   * CP3: Supports attachments — captures stored filenames first, performs the DB
   * delete in a transaction (CASCADE removes attachment rows), then safely
   * unlinks physical files after a successful commit.
   *
   * If DB transaction fails: physical files are NOT deleted.
   * If physical unlink fails after commit: logs warning, does not re-open it.
   */
  static async deleteDraft(
    id: string,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { attachments: { select: { storedFilename: true } } },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const deletableStates: AnnouncementState[] = [AnnouncementState.DRAFT, AnnouncementState.ARCHIVED];
    if (!deletableStates.includes(announcement.state)) {
      throw new AppError('A published announcement must be archived before it can be deleted.', 400);
    }

    // Capture stored filenames BEFORE the transaction deletes attachment rows
    const storedFilenames = announcement.attachments
      .map((a) => a.storedFilename)
      .filter(Boolean) as string[];

    // DB transaction: audit → delete (CASCADE handles attachment rows + scope rows)
    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorUserId,
        action: announcement.state === AnnouncementState.DRAFT
          ? 'ANNOUNCEMENT_DRAFT_DELETED'
          : 'ANNOUNCEMENT_DELETED',
        entityType: 'ANNOUNCEMENT',
        entityId: id,
        metadata: {
          title: announcement.title,
          state: announcement.state,
          attachmentCount: storedFilenames.length,
        },
        ipAddress,
        userAgent,
        tx,
      });

      // Cascade delete removes: audienceScopes, recipients, attachments, then announcement
      await tx.announcement.delete({ where: { id } });
    });

    // Physical file cleanup — AFTER successful DB commit
    // Failures are logged but do NOT restore the deleted draft
    for (const filename of storedFilenames) {
      safeUnlinkAnnouncementFile(filename);
    }
  }

  // ── HR Management List ────────────────────────────────────────────────────────

  static async listForHR(filters?: {
    status?: DerivedAnnouncementStatus;
    priority?: AnnouncementPriority;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const now = new Date();
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters?.limit ?? 20));
    const skip = (page - 1) * limit;

    // Build base where clause
    let where: Prisma.AnnouncementWhereInput = {};

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { body: { contains: filters.search } },
      ];
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }

    // Status filtering on derived statuses
    if (filters?.status) {
      switch (filters.status) {
        case 'DRAFT':
          where.state = AnnouncementState.DRAFT;
          break;
        case 'SCHEDULED':
          where.state = AnnouncementState.ACTIVE;
          where.publishAt = { gt: now };
          break;
        case 'PUBLISHED':
          where.state = AnnouncementState.ACTIVE;
          where.publishAt = { lte: now };
          where.OR = [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ];
          // Remove search OR if already added
          if (filters.search) {
            where = {
              state: AnnouncementState.ACTIVE,
              publishAt: { lte: now },
              AND: [
                { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                { OR: [{ title: { contains: filters.search } }, { body: { contains: filters.search } }] },
              ],
            };
          }
          break;
        case 'EXPIRED':
          where.state = AnnouncementState.ACTIVE;
          where.publishAt = { lte: now };
          where.expiresAt = { lte: now };
          break;
        case 'ARCHIVED':
          where.state = AnnouncementState.ARCHIVED;
          break;
      }
    }

    const [total, data] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        include: {
          audienceScopes: {
            include: {
              targetUnit: { select: { id: true, name: true } },
              targetDepartment: { select: { id: true, name: true } },
              targetJobRole: { select: { id: true, title: true } },
              targetEmployee: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          _count: { select: { recipients: true, attachments: true } },
          createdBy: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      data: data.map((a) => ({ ...a, derivedStatus: getDerivedStatus(a, now) })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── HR Summary Stats ──────────────────────────────────────────────────────────

  static async getSummaryStats() {
    const now = new Date();

    const [drafts, scheduled, published, expired, archived] = await Promise.all([
      prisma.announcement.count({ where: { state: AnnouncementState.DRAFT } }),
      prisma.announcement.count({
        where: { state: AnnouncementState.ACTIVE, publishAt: { gt: now } },
      }),
      prisma.announcement.count({
        where: {
          state: AnnouncementState.ACTIVE,
          publishAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      prisma.announcement.count({
        where: {
          state: AnnouncementState.ACTIVE,
          publishAt: { lte: now },
          expiresAt: { lte: now },
        },
      }),
      prisma.announcement.count({ where: { state: AnnouncementState.ARCHIVED } }),
    ]);

    return { drafts, scheduled, published, expired, archived };
  }

  // ── Get By ID (dual-mode: HR management or recipient) ────────────────────────

  /**
   * FULL: can access any announcement in management mode.
   * SUPERVISOR/STANDARD: must be an existing recipient; announcement must be
   *   published (ACTIVE + publishAt ≤ now) or historically expired (Past tab).
   *   Denied for: DRAFT, SCHEDULED, ARCHIVED.
   */
  static async getById(
    id: string,
    currentUser: { userId: string; employeeId?: string; permissionTier: string }
  ) {
    const now = new Date();
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        audienceScopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'asc' },
        },
        _count: { select: { recipients: true, attachments: true } },
        createdBy: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!announcement) throw new AppError('Announcement not found.', 404);

    const derived = getDerivedStatus(announcement, now);

    if (currentUser.permissionTier === 'FULL') {
      // HR management access — return full record regardless of derived status
      const recipientStats = await AnnouncementService.getRecipientStats(id);
      return {
        ...announcement,
        derivedStatus: derived,
        recipientStats,
      };
    }

    // SUPERVISOR / STANDARD: must be a recipient
    if (!currentUser.employeeId) {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    const recipient = await prisma.announcementRecipient.findUnique({
      where: {
        announcementId_employeeId: {
          announcementId: id,
          employeeId: currentUser.employeeId,
        },
      },
    });

    if (!recipient) {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    // Access rules for recipients
    if (derived === 'DRAFT') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }
    if (derived === 'SCHEDULED') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }
    if (derived === 'ARCHIVED') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    // PUBLISHED or EXPIRED — return recipient-safe view (no audienceScopes, no createdBy)
    return {
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      priority: announcement.priority,
      isPinned: announcement.isPinned,
      publishAt: announcement.publishAt,
      expiresAt: announcement.expiresAt,
      updatedAt: announcement.updatedAt,
      derivedStatus: derived,
      recipientRecord: { readAt: recipient.readAt },
      attachments: announcement.attachments,
      _count: { attachments: announcement._count.attachments },
    };
  }

  // ── Recipient Feed (Current + Past) ──────────────────────────────────────────

  /**
   * Returns the announcement feed for an authenticated employee.
   * filter='current': PUBLISHED (not expired, not archived)
   * filter='past': EXPIRED (historically received, not archived)
   */
  static async listForRecipient(
    employeeId: string,
    filter: 'current' | 'past' = 'current',
    options?: { page?: number; limit?: number; unreadOnly?: boolean }
  ) {
    const now = new Date();
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
    const skip = (page - 1) * limit;

    const baseRecipientWhere: Prisma.AnnouncementRecipientWhereInput = {
      employeeId,
      announcement: {
        state: AnnouncementState.ACTIVE,
        publishAt: { not: null, lte: now },
        ...(filter === 'current'
          ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
          : { expiresAt: { not: null, lte: now } }),
      },
      ...(options?.unreadOnly ? { readAt: null } : {}),
    };

    // Priority ordering: URGENT > IMPORTANT > NORMAL
    const priorityOrder: AnnouncementPriority[] = [
      AnnouncementPriority.URGENT,
      AnnouncementPriority.IMPORTANT,
      AnnouncementPriority.NORMAL,
    ];

    const [total, recipients] = await Promise.all([
      prisma.announcementRecipient.count({ where: baseRecipientWhere }),
      prisma.announcementRecipient.findMany({
        where: baseRecipientWhere,
        skip,
        take: limit,
        include: {
          announcement: {
            select: {
              id: true,
              title: true,
              body: true,
              priority: true,
              isPinned: true,
              publishAt: true,
              expiresAt: true,
              updatedAt: true,
              _count: { select: { attachments: true } },
            },
          },
        },
        orderBy: [
          { announcement: { isPinned: 'desc' } },
          { announcement: { publishAt: 'desc' } },
        ],
      }),
    ]);

    // Sort by priority within pinned/unpinned groups
    const sorted = recipients.sort((a, b) => {
      const aPinned = a.announcement.isPinned ? 1 : 0;
      const bPinned = b.announcement.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aPriority = priorityOrder.indexOf(a.announcement.priority as AnnouncementPriority);
      const bPriority = priorityOrder.indexOf(b.announcement.priority as AnnouncementPriority);
      if (aPriority !== bPriority) return aPriority - bPriority;

      return (b.announcement.publishAt?.getTime() ?? 0) - (a.announcement.publishAt?.getTime() ?? 0);
    });

    return {
      data: sorted.map((r) => ({
        ...r.announcement,
        derivedStatus: getDerivedStatus(r.announcement as any, now),
        readAt: r.readAt,
        isRead: r.readAt !== null,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Unread Count (Sidebar Badge) ──────────────────────────────────────────────

  /**
   * Counts CURRENT unread announcements for an employee.
   * Expired/Archived announcements do NOT inflate this count.
   */
  static async getUnreadCount(employeeId: string): Promise<number> {
    const now = new Date();
    return prisma.announcementRecipient.count({
      where: {
        employeeId,
        readAt: null,
        announcement: {
          state: AnnouncementState.ACTIVE,
          publishAt: { not: null, lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    });
  }

  // ── Dashboard Helper ──────────────────────────────────────────────────────────

  /**
   * Returns up to 3 current announcements for an employee + their unread count.
   * Used by dashboard widgets. Does NOT mark read.
   * FULL users with an employeeId also benefit from this.
   */
  static async getDashboardData(employeeId: string) {
    const now = new Date();

    const [recipients, unreadCurrentCount] = await Promise.all([
      prisma.announcementRecipient.findMany({
        where: {
          employeeId,
          announcement: {
            state: AnnouncementState.ACTIVE,
            publishAt: { not: null, lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        take: 3,
        include: {
          announcement: {
            select: {
              id: true,
              title: true,
              priority: true,
              isPinned: true,
              publishAt: true,
              expiresAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { announcement: { isPinned: 'desc' } },
          { announcement: { publishAt: 'desc' } },
        ],
      }),
      AnnouncementService.getUnreadCount(employeeId),
    ]);

    return {
      announcements: recipients.map((r) => ({
        ...r.announcement,
        isRead: r.readAt !== null,
      })),
      unreadCurrentCount,
    };
  }

  // ── Mark Read ─────────────────────────────────────────────────────────────────

  /**
   * Marks an announcement as read for the authenticated employee.
   *
   * CRITICAL SECURITY:
   * - NO UPSERT. Never creates a new AnnouncementRecipient row.
   * - Non-recipients receive 403.
   * - Idempotent: returns existing readAt if already read.
   * - Denied for: DRAFT, SCHEDULED (future), ARCHIVED.
   */
  static async markRead(
    announcementId: string,
    currentUser: { userId: string; employeeId?: string }
  ) {
    const now = new Date();

    if (!currentUser.employeeId) {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    // STEP 1: Find existing recipient row — NO upsert
    const recipient = await prisma.announcementRecipient.findUnique({
      where: {
        announcementId_employeeId: {
          announcementId,
          employeeId: currentUser.employeeId,
        },
      },
    });

    // STEP 2: 403 if not a recipient
    if (!recipient) {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    // STEP 3: Load announcement for visibility check
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { state: true, publishAt: true, expiresAt: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    // STEP 4: Visibility rules
    const derived = getDerivedStatus(announcement, now);
    if (derived === 'DRAFT') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }
    if (derived === 'SCHEDULED') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }
    if (derived === 'ARCHIVED') {
      throw new AppError('You do not have permission to view this announcement.', 403);
    }

    // STEP 5: Idempotent update — do NOT reset existing readAt
    if (recipient.readAt !== null) {
      return { readAt: recipient.readAt, alreadyRead: true };
    }

    // STEP 6: Mark read — UPDATE only, never upsert
    const updated = await prisma.announcementRecipient.update({
      where: {
        announcementId_employeeId: {
          announcementId,
          employeeId: currentUser.employeeId,
        },
      },
      data: { readAt: now },
    });

    return { readAt: updated.readAt, alreadyRead: false };
  }

  // ── Recipient Statistics ──────────────────────────────────────────────────────

  static async getRecipientStats(announcementId: string) {
    const [totalRecipients, readCount] = await Promise.all([
      prisma.announcementRecipient.count({ where: { announcementId } }),
      prisma.announcementRecipient.count({ where: { announcementId, readAt: { not: null } } }),
    ]);

    // Read and unread shares of ONE whole, apportioned so they total exactly 100.
    const shares = distribution([readCount, totalRecipients - readCount]);
    return {
      totalRecipients,
      readCount,
      unreadCount: totalRecipients - readCount,
      readPercent: shares ? shares[0] : null,
      unreadPercent: shares ? shares[1] : null,
    };
  }

  // ── Recipient List (Paginated, FULL HR only) ──────────────────────────────────

  static async listRecipients(
    announcementId: string,
    filters?: {
      search?: string;
      readFilter?: 'all' | 'read' | 'unread';
      page?: number;
      limit?: number;
    }
  ) {
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true } });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters?.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.AnnouncementRecipientWhereInput = { announcementId };

    if (filters?.readFilter === 'read') where.readAt = { not: null };
    if (filters?.readFilter === 'unread') where.readAt = null;

    if (filters?.search) {
      where.employee = {
        OR: [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { employeeNumber: { contains: filters.search } },
        ],
      };
    }

    const [total, recipients] = await Promise.all([
      prisma.announcementRecipient.count({ where }),
      prisma.announcementRecipient.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: EMPLOYEE_SAFE_SELECT,
          },
        },
        orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
      }),
    ]);

    return {
      data: recipients.map((r) => ({
        employeeId: r.employeeId,
        employeeNumber: r.employee.employeeNumber,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        unit: r.employee.unit,
        department: r.employee.department,
        jobRole: r.employee.jobRole,
        isRead: r.readAt !== null,
        readAt: r.readAt,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ATTACHMENT METHODS (Checkpoint 3)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Upload lifecycle guard: returns derived status for lifecycle check.
   * Allowed: DRAFT, SCHEDULED (ACTIVE + publishAt > now)
   * Rejected: PUBLISHED, EXPIRED, ARCHIVED
   */
  private static _assertAttachmentWriteAllowed(
    announcement: { state: AnnouncementState; publishAt: Date | null; expiresAt: Date | null },
    now: Date
  ) {
    const derived = getDerivedStatus(announcement, now);
    if (derived === 'PUBLISHED' || derived === 'EXPIRED') {
      throw new AppError('Attachments can only be changed before the announcement is published.', 400);
    }
    if (derived === 'ARCHIVED') {
      throw new AppError('Attachments cannot be changed on an archived announcement.', 400);
    }
    return derived;
  }

  /**
   * Uploads an attachment file to a DRAFT or SCHEDULED announcement.
   *
   * The physical file is written by Multer before this method is called.
   * If ANY later step fails, the caller MUST unlink the physical file.
   *
   * Returns safe metadata only — storedFilename is NEVER returned publicly.
   */
  static async uploadAttachment(
    announcementId: string,
    file: { originalname: string; filename: string; mimetype: string; size: number },
    uploadedByUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const now = new Date();
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, state: true, publishAt: true, expiresAt: true, title: true },
    });
    if (!announcement) {
      throw new AppError('Announcement not found.', 404);
    }

    AnnouncementService._assertAttachmentWriteAllowed(announcement, now);

    // Create DB record + audit in one transaction
    const attachment = await prisma.$transaction(async (tx) => {
      const record = await tx.announcementAttachment.create({
        data: {
          announcementId,
          originalFilename: file.originalname,
          storedFilename: file.filename,   // randomized hex name from Multer
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId,
          // Legacy fields intentionally left null for new uploads
          fileName: file.originalname,
          fileUrl: '',
        },
        select: {
          id: true,
          announcementId: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          // storedFilename intentionally excluded from response
        },
      });

      await createAuditLog({
        actorUserId: uploadedByUserId,
        action: 'ANNOUNCEMENT_ATTACHMENT_UPLOADED',
        entityType: 'ANNOUNCEMENT',
        entityId: announcementId,
        metadata: {
          attachmentId: record.id,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
        ipAddress,
        userAgent,
        tx,
      });

      return record;
    });

    return attachment;
  }

  /**
   * Streams an announcement attachment to the requester.
   *
   * Authorization:
   *   FULL: may access DRAFT, SCHEDULED, PUBLISHED, EXPIRED, ARCHIVED (management access).
   *   SUPERVISOR/STANDARD: must be a recipient AND announcement must be PUBLISHED or EXPIRED.
   *
   * Returns { filePath, mimeType, originalFilename } — caller sets headers and streams.
   * Does NOT mark readAt (explicit read-only side effect from POST /:id/read).
   */
  static async streamAttachment(
    announcementId: string,
    attachmentId: string,
    currentUser: { userId: string; employeeId?: string; permissionTier: string }
  ) {
    const now = new Date();

    // 1. Load attachment and verify it belongs to the route's announcement
    const attachment = await prisma.announcementAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        announcementId: true,
        storedFilename: true,
        originalFilename: true,
        mimeType: true,
      },
    });
    if (!attachment) throw new AppError('Attachment not found.', 404);

    // 2. Cross-announcement ID validation — prevents lateral file access
    if (attachment.announcementId !== announcementId) {
      throw new AppError('Attachment not found.', 404);
    }

    // 3. Load announcement for authorization
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { state: true, publishAt: true, expiresAt: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    const derived = getDerivedStatus(announcement, now);

    if (currentUser.permissionTier === 'FULL') {
      // FULL may access any lifecycle for management purposes
      // No readAt marking
    } else {
      // SUPERVISOR / STANDARD: must be a recipient
      if (!currentUser.employeeId) {
        throw new AppError('You do not have permission to access this attachment.', 403);
      }

      const recipient = await prisma.announcementRecipient.findUnique({
        where: {
          announcementId_employeeId: {
            announcementId,
            employeeId: currentUser.employeeId,
          },
        },
      });

      if (!recipient) {
        throw new AppError('You do not have permission to access this attachment.', 403);
      }

      // Recipients may only access PUBLISHED (current) or EXPIRED (past historical)
      if (derived !== 'PUBLISHED' && derived !== 'EXPIRED') {
        throw new AppError('You do not have permission to access this attachment.', 403);
      }
    }

    // 4. Resolve and validate physical file path
    if (!attachment.storedFilename) {
      throw new AppError('This attachment is no longer available.', 410);
    }

    const filePath = resolveSafeAnnouncementFilePath(attachment.storedFilename);
    if (!filePath) {
      console.error(`[Announcement Attachment] Path containment failure for storedFilename: ${attachment.storedFilename}`);
      throw new AppError('This attachment is no longer available.', 410);
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      console.error(`[Announcement Attachment] Missing physical file for attachment ${attachmentId}: ${filePath}`);
      throw new AppError('This attachment is no longer available.', 410);
    }

    return {
      filePath,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
      originalFilename: attachment.originalFilename ?? 'attachment',
    };
  }

  /**
   * Deletes an attachment from a DRAFT or SCHEDULED announcement.
   *
   * Sequence:
   *   1. Load announcement + attachment.
   *   2. Verify lifecycle allows removal.
   *   3. Capture storedFilename.
   *   4. DB transaction: delete attachment row + create audit.
   *   5. After successful commit: safely unlink physical file.
   *
   * If DB transaction fails: physical file is NOT deleted.
   * If physical unlink fails after commit: logged as warning only.
   */
  static async deleteAttachment(
    announcementId: string,
    attachmentId: string,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const now = new Date();

    // 1. Load and cross-validate
    const attachment = await prisma.announcementAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, announcementId: true, storedFilename: true, originalFilename: true, mimeType: true, sizeBytes: true },
    });
    if (!attachment) throw new AppError('Attachment not found.', 404);
    if (attachment.announcementId !== announcementId) throw new AppError('Attachment not found.', 404);

    // 2. Load announcement for lifecycle check
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { state: true, publishAt: true, expiresAt: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    AnnouncementService._assertAttachmentWriteAllowed(announcement, now);

    // 3. Capture filename before DB deletion
    const storedFilename = attachment.storedFilename;

    // 4. DB transaction: delete attachment row + audit
    await prisma.$transaction(async (tx) => {
      await createAuditLog({
        actorUserId,
        action: 'ANNOUNCEMENT_ATTACHMENT_REMOVED',
        entityType: 'ANNOUNCEMENT',
        entityId: announcementId,
        metadata: {
          attachmentId,
          originalFilename: attachment.originalFilename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
        },
        ipAddress,
        userAgent,
        tx,
      });

      await tx.announcementAttachment.delete({ where: { id: attachmentId } });
    });

    // 5. Physical unlink AFTER successful DB commit
    // Failure is logged only — an orphan physical file is safer than a broken DB reference
    safeUnlinkAnnouncementFile(storedFilename);
  }

  /**
   * Returns safe attachment metadata list for an announcement.
   * storedFilename is intentionally excluded.
   */
  static async listAttachments(announcementId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true },
    });
    if (!announcement) throw new AppError('Announcement not found.', 404);

    return prisma.announcementAttachment.findMany({
      where: { announcementId },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        // storedFilename intentionally excluded
      },
      orderBy: { uploadedAt: 'asc' },
    });
  }
}
