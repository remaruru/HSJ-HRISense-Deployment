import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';
import { OrgHierarchyService } from './org-hierarchy.service';
import {
  TrainingActivityType,
  TrainingActivityStatus,
  TrainingParticipationStatus,
  RecordReviewStatus,
  Prisma,
} from '@prisma/client';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'training');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function resolveSafeTrainingFilePath(storedFilename: string | null | undefined): string | null {
  if (!storedFilename || typeof storedFilename !== 'string') return null;
  const root = path.resolve(UPLOAD_DIR);
  // Extract basename to strictly prevent any directory traversal or path separators
  const safeFilename = path.basename(storedFilename.trim());
  if (!safeFilename || safeFilename === '.' || safeFilename === '..') return null;

  const target = path.resolve(root, safeFilename);
  const relative = path.relative(root, target);

  // Reject if relative path starts with '..' or is absolute or is empty
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return target;
}

function safeUnlinkTrainingFile(storedFilename: string | null | undefined) {
  if (!storedFilename) return;
  try {
    const target = resolveSafeTrainingFilePath(storedFilename);
    if (!target) {
      console.warn(`[Training File Security] Invalid path containment check for deletion: ${storedFilename}`);
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      fs.unlinkSync(target);
    }
  } catch (err) {
    console.error('[Training File Safe Unlink Error]', err);
  }
}

export interface CreateTrainingActivityDto {
  title: string;
  type?: TrainingActivityType;
  description?: string;
  provider: string;
  venue: string;
  startDate: string | Date;
  startTime?: string;
  endDate: string | Date;
  endTime?: string;
  hoursCredit?: number;
  maxParticipants?: number;
  status?: TrainingActivityStatus;
  complianceRequirementId?: string;
  materialsUrl?: string;
  participantEmployeeIds?: string[];
}

export interface UpdateTrainingActivityDto {
  title?: string;
  type?: TrainingActivityType;
  description?: string;
  provider?: string;
  venue?: string;
  startDate?: string | Date;
  startTime?: string;
  endDate?: string | Date;
  endTime?: string;
  hoursCredit?: number;
  maxParticipants?: number;
  status?: TrainingActivityStatus;
  complianceRequirementId?: string | null;
  materialsUrl?: string;
}

export interface AddParticipantsDto {
  employeeIds: string[];
}

export interface UpdateParticipantStatusDto {
  participationStatus: TrainingParticipationStatus;
  completedAt?: string | Date | null;
  validUntil?: string | Date | null;
  notes?: string | null;
  complianceRecordId?: string | null;
}

export interface ListTrainingFilters {
  type?: TrainingActivityType;
  status?: TrainingActivityStatus;
  search?: string;
}

export interface UserContext {
  id: string;
  employeeId?: string | null;
  permissionTier: string;
}

/**
 * Participant rows a viewer may see on an activity.
 *
 * HR sees the whole roster. Everyone else sees the activity itself and its
 * aggregate counts, but only their OWN participant row: who else was assigned,
 * and who did not attend, is personnel information. Previously every signed-in
 * user received every roster with names and outcomes.
 */
function visibleParticipants<T extends { employeeId: string }>(participants: T[], userContext: UserContext): T[] {
  if (userContext.permissionTier === 'FULL') return participants;
  if (!userContext.employeeId) return [];
  return participants.filter((p) => p.employeeId === userContext.employeeId);
}

export class TrainingService {
  // ── List Activities ─────────────────────────────────────────────────────────
  static async listActivities(userContext: UserContext, filters?: ListTrainingFilters) {
    const where: Prisma.TrainingActivityWhereInput = {
      deletedAt: null,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q } },
        { provider: { contains: q } },
        { venue: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const activities = await prisma.trainingActivity.findMany({
      where,
      include: {
        complianceRequirement: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        participants: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobRole: true,
                department: true,
                unit: true,
              },
            },
          },
        },
        documents: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return activities.map((act: any) => {
      const assignedCount = act.participants.filter(
        (p: any) => p.participationStatus === TrainingParticipationStatus.ASSIGNED
      ).length;
      const completedCount = act.participants.filter(
        (p: any) => p.participationStatus === TrainingParticipationStatus.COMPLETED
      ).length;
      const didNotAttendCount = act.participants.filter(
        (p: any) => p.participationStatus === TrainingParticipationStatus.DID_NOT_ATTEND
      ).length;
      const excusedCount = act.participants.filter(
        (p: any) => p.participationStatus === TrainingParticipationStatus.EXCUSED
      ).length;
      const cancelledCount = act.participants.filter(
        (p: any) => p.participationStatus === TrainingParticipationStatus.CANCELLED
      ).length;

      return {
        ...act,
        participants: visibleParticipants(act.participants, userContext),
        participantStats: {
          total: act.participants.length,
          assigned: assignedCount,
          completed: completedCount,
          didNotAttend: didNotAttendCount,
          excused: excusedCount,
          cancelled: cancelledCount,
        },
      };
    });
  }

  // ── Get Activity by ID ──────────────────────────────────────────────────────
  static async getActivity(id: string, userContext: UserContext) {
    const activity = await prisma.trainingActivity.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        complianceRequirement: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        participants: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobRole: true,
                department: true,
                unit: true,
              },
            },
            complianceRecord: {
              select: {
                id: true,
                recordTitle: true,
                expiresAt: true,
                reviewStatus: true,
              },
            },
          },
          orderBy: {
            assignedAt: 'asc',
          },
        },
        documents: {
          orderBy: {
            uploadedAt: 'desc',
          },
        },
      },
    });

    if (!activity) {
      throw new AppError('Training activity not found', 404);
    }

    const assignedCount = activity.participants.filter(
      (p: any) => p.participationStatus === TrainingParticipationStatus.ASSIGNED
    ).length;
    const completedCount = activity.participants.filter(
      (p: any) => p.participationStatus === TrainingParticipationStatus.COMPLETED
    ).length;
    const didNotAttendCount = activity.participants.filter(
      (p: any) => p.participationStatus === TrainingParticipationStatus.DID_NOT_ATTEND
    ).length;
    const excusedCount = activity.participants.filter(
      (p: any) => p.participationStatus === TrainingParticipationStatus.EXCUSED
    ).length;

    return {
      ...activity,
      participants: visibleParticipants(activity.participants, userContext),
      participantStats: {
        total: activity.participants.length,
        assigned: assignedCount,
        completed: completedCount,
        didNotAttend: didNotAttendCount,
        excused: excusedCount,
      },
    };
  }

  // ── Create Training Activity ────────────────────────────────────────────────
  static async createActivity(data: CreateTrainingActivityDto, userId?: string) {
    if (!data.title?.trim()) {
      throw new AppError('Activity title is required', 400);
    }
    if (!data.provider?.trim()) {
      throw new AppError('Provider / Facilitator is required', 400);
    }
    if (!data.venue?.trim()) {
      throw new AppError('Venue / Location is required', 400);
    }
    if (!data.startDate) {
      throw new AppError('Start date is required', 400);
    }
    if (!data.endDate) {
      throw new AppError('End date is required', 400);
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid start or end date format', 400);
    }

    if (endDate < startDate) {
      throw new AppError('End date cannot be earlier than start date', 400);
    }

    // Verify requirement if linked
    if (data.complianceRequirementId) {
      const req = await prisma.complianceRequirement.findUnique({
        where: { id: data.complianceRequirementId },
      });
      if (!req) {
        throw new AppError('Linked compliance requirement not found', 404);
      }
    }

    const activity = await prisma.trainingActivity.create({
      data: {
        title: data.title.trim(),
        type: data.type || TrainingActivityType.TRAINING,
        description: data.description?.trim() || null,
        provider: data.provider.trim(),
        venue: data.venue.trim(),
        startDate,
        startTime: data.startTime || null,
        endDate,
        endTime: data.endTime || null,
        hoursCredit: data.hoursCredit ? Number(data.hoursCredit) : null,
        maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : null,
        status: data.status || TrainingActivityStatus.SCHEDULED,
        complianceRequirementId: data.complianceRequirementId || null,
        materialsUrl: data.materialsUrl?.trim() || null,
        createdById: userId || null,
      },
    });

    // Add initial participants if provided
    if (data.participantEmployeeIds && data.participantEmployeeIds.length > 0) {
      const uniqueEmployeeIds = Array.from(new Set(data.participantEmployeeIds));
      await prisma.trainingParticipant.createMany({
        data: uniqueEmployeeIds.map((empId) => ({
          trainingActivityId: activity.id,
          employeeId: empId,
          participationStatus: TrainingParticipationStatus.ASSIGNED,
        })),
        skipDuplicates: true,
      });
    }

    return this.getActivity(activity.id, { id: userId || '', permissionTier: 'FULL' });
  }

  // ── Update Training Activity ────────────────────────────────────────────────
  static async updateActivity(id: string, data: UpdateTrainingActivityDto, userId?: string) {
    const existing = await prisma.trainingActivity.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError('Training activity not found', 404);
    }

    const updateData: Prisma.TrainingActivityUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.provider !== undefined) updateData.provider = data.provider.trim();
    if (data.venue !== undefined) updateData.venue = data.venue.trim();
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.startTime !== undefined) updateData.startTime = data.startTime || null;
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.endTime !== undefined) updateData.endTime = data.endTime || null;
    if (data.hoursCredit !== undefined) updateData.hoursCredit = data.hoursCredit !== null ? Number(data.hoursCredit) : null;
    if (data.maxParticipants !== undefined) updateData.maxParticipants = data.maxParticipants !== null ? Number(data.maxParticipants) : null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.materialsUrl !== undefined) updateData.materialsUrl = data.materialsUrl ? data.materialsUrl.trim() : null;

    if (data.complianceRequirementId !== undefined) {
      if (data.complianceRequirementId) {
        const req = await prisma.complianceRequirement.findUnique({
          where: { id: data.complianceRequirementId },
        });
        if (!req) {
          throw new AppError('Linked compliance requirement not found', 404);
        }
        updateData.complianceRequirement = { connect: { id: data.complianceRequirementId } };
      } else {
        updateData.complianceRequirement = { disconnect: true };
      }
    }

    await prisma.trainingActivity.update({
      where: { id },
      data: updateData,
    });

    return this.getActivity(id, { id: userId || '', permissionTier: 'FULL' });
  }

  // ── Cancel Activity ─────────────────────────────────────────────────────────
  static async cancelActivity(id: string, userId?: string) {
    const existing = await prisma.trainingActivity.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError('Training activity not found', 404);
    }

    await prisma.trainingActivity.update({
      where: { id },
      data: {
        status: TrainingActivityStatus.CANCELLED,
      },
    });

    return this.getActivity(id, { id: userId || '', permissionTier: 'FULL' });
  }

  // ── Add Participants ────────────────────────────────────────────────────────
  static async addParticipants(id: string, dto: AddParticipantsDto, userId?: string) {
    const activity = await prisma.trainingActivity.findFirst({
      where: { id, deletedAt: null },
      include: {
        participants: true,
      },
    });

    if (!activity) {
      throw new AppError('Training activity not found', 404);
    }

    if (!dto.employeeIds || dto.employeeIds.length === 0) {
      throw new AppError('No employees specified to add', 400);
    }

    const uniqueIds = Array.from(new Set(dto.employeeIds));

    // Check capacity if set
    if (activity.maxParticipants) {
      const activeCount = activity.participants.filter(
        (p: any) => p.participationStatus !== TrainingParticipationStatus.CANCELLED
      ).length;
      if (activeCount + uniqueIds.length > activity.maxParticipants) {
        throw new AppError(
          `Cannot add ${uniqueIds.length} participants: activity capacity is ${activity.maxParticipants} (currently ${activeCount} assigned)`,
          400
        );
      }
    }

    for (const empId of uniqueIds) {
      await prisma.trainingParticipant.upsert({
        where: {
          trainingActivityId_employeeId: {
            trainingActivityId: id,
            employeeId: empId,
          },
        },
        create: {
          trainingActivityId: id,
          employeeId: empId,
          participationStatus: TrainingParticipationStatus.ASSIGNED,
        },
        update: {
          participationStatus: TrainingParticipationStatus.ASSIGNED,
        },
      });
    }

    return this.getActivity(id, { id: userId || '', permissionTier: 'FULL' });
  }

  // ── Update Single Participant Status ────────────────────────────────────────
  static async updateParticipantStatus(
    activityId: string,
    employeeId: string,
    dto: UpdateParticipantStatusDto,
    userId?: string
  ) {
    const activity = await prisma.trainingActivity.findFirst({
      where: { id: activityId, deletedAt: null },
      include: {
        complianceRequirement: true,
      },
    });

    if (!activity) {
      throw new AppError('Training activity not found', 404);
    }

    const participant = await prisma.trainingParticipant.findUnique({
      where: {
        trainingActivityId_employeeId: {
          trainingActivityId: activityId,
          employeeId,
        },
      },
    });

    if (!participant) {
      throw new AppError('Employee is not a participant in this training activity', 404);
    }

    // A request that omits `participationStatus` — for example one sending the
    // wrong field name `status` — used to fall straight through and return
    // 200 "Participant status updated" while changing nothing and generating no
    // compliance record. Tell the caller the write did not happen.
    const allowedStatuses = Object.values(TrainingParticipationStatus) as string[];
    if (!dto.participationStatus || !allowedStatuses.includes(String(dto.participationStatus))) {
      throw new AppError(
        `\`participationStatus\` is required and must be one of: ${allowedStatuses.join(', ')}.`,
        400
      );
    }

    const completedAt = dto.completedAt ? new Date(dto.completedAt) : (dto.participationStatus === TrainingParticipationStatus.COMPLETED ? new Date() : null);
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    const shouldGenerateCompliance =
      dto.participationStatus === TrainingParticipationStatus.COMPLETED &&
      !!activity.complianceRequirementId &&
      !participant.complianceRecordId;

    // ── One atomic boundary ──────────────────────────────────────────────────
    // The compliance record and the participant link are written together. They
    // were previously two separate top-level writes: if the second failed, an
    // orphaned "ACCEPTED" compliance record was left claiming the employee was
    // compliant, and because nothing linked back to it, a retry created a SECOND
    // one.
    //
    // Idempotency comes from `generatedFromTrainingParticipantId`, which is
    // unique. A concurrent retry loses the race with P2002 and reuses the record
    // the winner created, rather than duplicating it.
    const updated = await prisma.$transaction(async (tx) => {
      let complianceRecordId = participant.complianceRecordId;

      if (shouldGenerateCompliance) {
        // Another attempt may already have generated it for this completion.
        const existing = await tx.employeeComplianceRecord.findUnique({
          where: { generatedFromTrainingParticipantId: participant.id },
          select: { id: true },
        });

        if (existing) {
          complianceRecordId = existing.id;
        } else {
          const compRecord = await tx.employeeComplianceRecord.create({
            data: {
              employeeId,
              requirementId: activity.complianceRequirementId!,
              recordTitle: activity.title,
              completedAt: completedAt || new Date(),
              // Expiry is whatever HR entered. No validity period is inferred.
              expiresAt: validUntil,
              referenceNumber: `TRN-${activity.id.slice(0, 8).toUpperCase()}`,
              reviewStatus: RecordReviewStatus.ACCEPTED,
              notes: `Auto-generated from completed training activity "${activity.title}".`,
              createdById: userId || null,
              generatedFromTrainingParticipantId: participant.id,
            },
          });
          complianceRecordId = compRecord.id;
        }
      }

      return tx.trainingParticipant.update({
        where: {
          trainingActivityId_employeeId: {
            trainingActivityId: activityId,
            employeeId,
          },
        },
        data: {
          participationStatus: dto.participationStatus,
          completedAt,
          validUntil,
          notes: dto.notes !== undefined ? dto.notes : participant.notes,
          complianceRecordId,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              jobRole: true,
              department: true,
              unit: true,
            },
          },
          complianceRecord: true,
        },
      });
    });

    return updated;
  }

  // ── Bulk Update Participant Status ──────────────────────────────────────────
  static async bulkUpdateParticipantStatus(
    activityId: string,
    employeeIds: string[],
    dto: {
      status: TrainingParticipationStatus;
      completedAt?: string | Date | null;
      validUntil?: string | Date | null;
      notes?: string | null;
    },
    userId?: string
  ) {
    if (!employeeIds || employeeIds.length === 0) {
      throw new AppError('No employee IDs specified for status update', 400);
    }

    for (const empId of employeeIds) {
      await this.updateParticipantStatus(
        activityId,
        empId,
        {
          participationStatus: dto.status,
          completedAt: dto.completedAt,
          validUntil: dto.validUntil,
          notes: dto.notes,
        },
        userId
      );
    }

    return this.getActivity(activityId, { id: userId || '', permissionTier: 'FULL' });
  }

  // ── Participant Certificate Upload ──────────────────────────────────────────
  static async uploadParticipantCertificate(
    trainingId: string,
    employeeId: string,
    file: Express.Multer.File,
    userContext: UserContext,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (userContext.permissionTier !== 'FULL') {
      safeUnlinkTrainingFile(file.filename);
      throw new AppError('Access denied. Only FULL HR can upload participant certificates.', 403);
    }

    const activity = await prisma.trainingActivity.findFirst({
      where: { id: trainingId, deletedAt: null },
    });
    if (!activity) {
      safeUnlinkTrainingFile(file.filename);
      throw new AppError('Training activity not found', 404);
    }

    const participant = await prisma.trainingParticipant.findUnique({
      where: {
        trainingActivityId_employeeId: {
          trainingActivityId: trainingId,
          employeeId,
        },
      },
    });
    if (!participant) {
      safeUnlinkTrainingFile(file.filename);
      throw new AppError('Participant not found for this activity', 404);
    }

    const oldStoredFilename = participant.certificateStoredFilename;

    let updated;
    try {
      // Execute database update and audit log creation in ONE atomic transaction
      updated = await prisma.$transaction(async (tx) => {
        const res = await tx.trainingParticipant.update({
          where: { id: participant.id },
          data: {
            certificateOriginalFilename: file.originalname,
            certificateStoredFilename: file.filename,
            certificateMimeType: file.mimetype,
            certificateSizeBytes: file.size,
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobRole: { select: { id: true, title: true } },
                department: { select: { id: true, name: true } },
                unit: { select: { id: true, name: true } },
              },
            },
            complianceRecord: {
              select: {
                id: true,
                recordTitle: true,
                expiresAt: true,
                reviewStatus: true,
              },
            },
          },
        });

        await createAuditLog({
          tx,
          actorUserId: userContext.id,
          targetEmployeeId: employeeId,
          action: 'TRAINING_CERTIFICATE_UPLOADED',
          entityType: 'TRAINING_PARTICIPANT',
          entityId: participant.id,
          metadata: {
            trainingActivityId: trainingId,
            activityTitle: activity.title,
            originalFilename: file.originalname,
            fileSizeBytes: file.size,
            mimeType: file.mimetype,
          },
          ipAddress,
          userAgent,
        });

        return res;
      });
    } catch (err) {
      // If the atomic transaction fails (DB update or audit creation),
      // roll back and safely delete the newly uploaded file.
      // The database is untouched, and the old physical file remains intact.
      safeUnlinkTrainingFile(file.filename);
      throw err;
    }

    // ONLY after successful transaction commit:
    // safely delete the OLD physical certificate file if one existed
    if (oldStoredFilename && oldStoredFilename !== file.filename) {
      safeUnlinkTrainingFile(oldStoredFilename);
    }

    return updated;
  }

  // ── Participant Certificate Download / Stream ──────────────────────────────
  static async streamParticipantCertificate(
    trainingId: string,
    employeeId: string,
    userContext: UserContext
  ) {
    const isFullHR = userContext.permissionTier === 'FULL';
    const isSelf = userContext.employeeId === employeeId;

    if (!isFullHR && !isSelf) {
      throw new AppError('Access denied. You do not have permission to access this certificate.', 403);
    }

    const participant = await prisma.trainingParticipant.findUnique({
      where: {
        trainingActivityId_employeeId: {
          trainingActivityId: trainingId,
          employeeId,
        },
      },
    });

    if (!participant || !participant.certificateStoredFilename) {
      throw new AppError('No certificate has been uploaded for this training record.', 404);
    }

    const filePath = resolveSafeTrainingFilePath(participant.certificateStoredFilename);
    if (!filePath) {
      throw new AppError('File physically missing from storage.', 404);
    }

    return {
      filePath,
      mimeType: participant.certificateMimeType || 'application/octet-stream',
      originalFilename: participant.certificateOriginalFilename || 'certificate.pdf',
    };
  }

  // ── Upload Activity Document ────────────────────────────────────────────────
  static async uploadActivityDocument(
    trainingId: string,
    file: Express.Multer.File,
    notes: string | undefined,
    userContext: UserContext,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (userContext.permissionTier !== 'FULL') {
      safeUnlinkTrainingFile(file.filename);
      throw new AppError('Access denied. Only FULL HR can upload activity documents.', 403);
    }

    const activity = await prisma.trainingActivity.findFirst({
      where: { id: trainingId, deletedAt: null },
    });
    if (!activity) {
      safeUnlinkTrainingFile(file.filename);
      throw new AppError('Training activity not found', 404);
    }

    let doc;
    try {
      doc = await prisma.$transaction(async (tx) => {
        const createdDoc = await tx.trainingActivityDocument.create({
          data: {
            trainingActivityId: trainingId,
            originalFilename: file.originalname,
            storedFilename: file.filename,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            notes: notes?.trim() || null,
            uploadedById: userContext.id,
          },
        });

        await createAuditLog({
          tx,
          actorUserId: userContext.id,
          action: 'TRAINING_DOCUMENT_UPLOADED',
          entityType: 'TRAINING_ACTIVITY_DOCUMENT',
          entityId: createdDoc.id,
          metadata: {
            trainingActivityId: trainingId,
            activityTitle: activity.title,
            originalFilename: file.originalname,
            fileSizeBytes: file.size,
          },
          ipAddress,
          userAgent,
        });

        return createdDoc;
      });
    } catch (err) {
      safeUnlinkTrainingFile(file.filename);
      throw err;
    }

    return doc;
  }

  // ── Stream Activity Document ────────────────────────────────────────────────
  static async streamActivityDocument(
    trainingId: string,
    documentId: string,
    userContext: UserContext
  ) {
    if (userContext.permissionTier !== 'FULL') {
      throw new AppError('Access denied. Only FULL HR can access activity documents.', 403);
    }

    const doc = await prisma.trainingActivityDocument.findFirst({
      where: {
        id: documentId,
        trainingActivityId: trainingId,
      },
    });

    if (!doc) {
      throw new AppError('Document not found for this activity.', 404);
    }

    const filePath = resolveSafeTrainingFilePath(doc.storedFilename);
    if (!filePath) {
      throw new AppError('File physically missing from storage.', 404);
    }

    return {
      filePath,
      mimeType: doc.mimeType || 'application/octet-stream',
      originalFilename: doc.originalFilename || 'document.pdf',
    };
  }

  // ── List Employee Training History (For Employee Profile Tab) ───────────────
  static async listEmployeeTrainingHistory(employeeId: string, userContext: UserContext) {
    // Same object-level rule as the employee profile this tab sits on. Without it
    // any signed-in user could read anyone's training history and HR notes.
    const allowed = await OrgHierarchyService.canAccessEmployeeRecord(
      { employeeId: userContext.employeeId ?? undefined, permissionTier: userContext.permissionTier as any },
      employeeId
    );
    if (!allowed) {
      throw new AppError('You do not have permission to view this training history.', 403);
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!emp) {
      throw new AppError('Employee not found', 404);
    }

    const participations = await prisma.trainingParticipant.findMany({
      where: {
        employeeId,
        trainingActivity: {
          deletedAt: null,
        },
      },
      include: {
        trainingActivity: {
          include: {
            complianceRequirement: {
              select: {
                id: true,
                title: true,
                category: true,
              },
            },
          },
        },
        complianceRecord: {
          select: {
            id: true,
            recordTitle: true,
            expiresAt: true,
            reviewStatus: true,
          },
        },
      },
      orderBy: {
        trainingActivity: {
          startDate: 'desc',
        },
      },
    });

    return participations.map((p: any) => ({
      participantId: p.id,
      activityId: p.trainingActivity.id,
      title: p.trainingActivity.title,
      type: p.trainingActivity.type,
      provider: p.trainingActivity.provider,
      venue: p.trainingActivity.venue,
      startDate: p.trainingActivity.startDate,
      endDate: p.trainingActivity.endDate,
      hoursCredit: p.trainingActivity.hoursCredit,
      activityStatus: p.trainingActivity.status,
      participationStatus: p.participationStatus,
      assignedAt: p.assignedAt,
      completedAt: p.completedAt,
      validUntil: p.validUntil,
      notes: p.notes,
      certificateOriginalFilename: p.certificateOriginalFilename,
      certificateSizeBytes: p.certificateSizeBytes,
      complianceRequirement: p.trainingActivity.complianceRequirement,
      complianceRecord: p.complianceRecord,
    }));
  }
}
