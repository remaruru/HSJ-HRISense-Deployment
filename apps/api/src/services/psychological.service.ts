import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { RecordReviewStatus, PsychologicalDocumentVisibility } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import path from 'path';
import fs from 'fs';
import { cleanupUploadedFiles } from '../middleware/upload';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'psychological');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Psychological Service ──────────────────────────────────────────────────────
// Two-zone field model:
//   - employeeVisibleSummary : employee can see their own (read-only)
//   - hrConfidentialNotes    : FULL tier only, NEVER exposed to employee/supervisor
//
// Documents:
//   - EMPLOYEE_VISIBLE : employee can download their own
//   - HR_ONLY          : FULL tier only

export class PsychologicalService {

  // ── Global Organization List (HR FULL Tier Only) ──────────────────────────────

  static async listAllRecords(params: {
    search?: string;
    unitId?: string;
    departmentId?: string;
    jobRoleId?: string;
    requirementId?: string;
    assessmentType?: string;
    reviewStatus?: string;
    complianceStatus?: string;
    page?: number;
    limit?: number;
  }, currentUser: any) {
    if (currentUser.permissionTier !== 'FULL') {
      throw new AppError('Unauthorized. Only HR personnel can access organization-wide psychological records.', 403);
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (params.search && params.search.trim()) {
      const s = params.search.trim();
      where.OR = [
        { employee: { firstName: { contains: s } } },
        { employee: { lastName: { contains: s } } },
        { employee: { employeeNumber: { contains: s } } },
        { assessmentType: { contains: s } },
        { requirement: { title: { contains: s } } },
        { conductedBy: { contains: s } },
      ];
    }

    if (params.unitId) {
      where.employee = { ...where.employee, unitId: params.unitId };
    }
    if (params.departmentId) {
      where.employee = { ...where.employee, departmentId: params.departmentId };
    }
    if (params.jobRoleId) {
      where.employee = { ...where.employee, jobRoleId: params.jobRoleId };
    }
    if (params.requirementId) {
      where.requirementId = params.requirementId;
    }
    if (params.assessmentType) {
      where.assessmentType = params.assessmentType;
    }
    if (params.reviewStatus) {
      where.reviewStatus = params.reviewStatus as RecordReviewStatus;
    }

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (params.complianceStatus === 'EXPIRED') {
      where.expiresAt = { lt: now };
    } else if (params.complianceStatus === 'EXPIRING_SOON') {
      where.expiresAt = { gte: now, lte: soon };
      where.reviewStatus = 'ACCEPTED';
    } else if (params.complianceStatus === 'VALID') {
      where.reviewStatus = 'ACCEPTED';
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: soon } },
      ];
    } else if (params.complianceStatus === 'NEEDS_REVIEW') {
      where.reviewStatus = { in: ['PENDING_REVIEW', 'NEEDS_CORRECTION'] };
    }

    const [total, records] = await Promise.all([
      prisma.psychologicalRecord.count({ where }),
      prisma.psychologicalRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              unit: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
              jobRole: { select: { id: true, title: true, code: true } },
            },
          },
          requirement: { select: { id: true, title: true, category: true } },
          documents: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, visibility: true, uploadedAt: true, notes: true },
          },
        },
        orderBy: { assessmentDate: 'desc' },
      }),
    ]);

    const mapped = records.map((r) => {
      let complianceStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NEEDS_REVIEW' = 'VALID';
      if (r.reviewStatus === 'NEEDS_CORRECTION' || r.reviewStatus === 'PENDING_REVIEW') {
        complianceStatus = 'NEEDS_REVIEW';
      } else if (r.expiresAt && new Date(r.expiresAt) < now) {
        complianceStatus = 'EXPIRED';
      } else if (r.expiresAt && new Date(r.expiresAt) <= soon) {
        complianceStatus = 'EXPIRING_SOON';
      }

      // Response minimization: strip narrative text fields from global list rows
      const { hrConfidentialNotes, employeeVisibleSummary, ...safeRow } = r;
      return {
        ...safeRow,
        complianceStatus,
        documentCount: r.documents.length,
      };
    });

    return {
      records: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ── Global Summary Metrics (HR FULL Tier Only) ────────────────────────────────

  static async getSummaryMetrics(currentUser: any) {
    if (currentUser.permissionTier !== 'FULL') {
      throw new AppError('Unauthorized', 403);
    }

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalRecords, needsReview, expired, expiringSoon] = await Promise.all([
      prisma.psychologicalRecord.count({ where: { deletedAt: null } }),
      prisma.psychologicalRecord.count({
        where: {
          deletedAt: null,
          reviewStatus: { in: ['PENDING_REVIEW', 'NEEDS_CORRECTION'] },
        },
      }),
      prisma.psychologicalRecord.count({
        where: {
          deletedAt: null,
          expiresAt: { lt: now },
        },
      }),
      prisma.psychologicalRecord.count({
        where: {
          deletedAt: null,
          expiresAt: { gte: now, lte: soon },
          reviewStatus: 'ACCEPTED',
        },
      }),
    ]);

    return {
      totalRecords,
      needsReview,
      expiringSoon,
      expired,
    };
  }

  // ── Single Employee Records (Profile Tab & Self View) ─────────────────────────

  static async listRecords(employeeId: string, currentUser: any) {
    const isSelf = currentUser.employeeId === employeeId;

    if (currentUser.permissionTier === 'STANDARD' && !isSelf) {
      throw new AppError('Unauthorized', 403);
    }
    if (currentUser.permissionTier === 'SUPERVISOR' && !isSelf) {
      throw new AppError('Access to subordinate psychological records is not permitted.', 403);
    }

    const records = await prisma.psychologicalRecord.findMany({
      where: { employeeId, deletedAt: null },
      include: {
        requirement: { select: { id: true, title: true, category: true } },
        documents: {
          where: currentUser.permissionTier !== 'FULL'
            ? { visibility: 'EMPLOYEE_VISIBLE' }
            : undefined,
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            visibility: true,
            uploadedAt: true,
            notes: true,
          },
        },
      },
      orderBy: { assessmentDate: 'desc' },
    });

    if (currentUser.permissionTier !== 'FULL') {
      return records.map(r => {
        const { hrConfidentialNotes, ...rest } = r as any;
        return rest;
      });
    }

    return records;
  }

  // ── Single Record Detail with Employee History ────────────────────────────────

  static async getRecordById(recordId: string, currentUser: any) {
    const record = await prisma.psychologicalRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            unit: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobRole: { select: { id: true, title: true, code: true } },
          },
        },
        requirement: { select: { id: true, title: true, category: true } },
        documents: {
          where: currentUser.permissionTier !== 'FULL'
            ? { visibility: 'EMPLOYEE_VISIBLE' }
            : undefined,
        },
      },
    });

    if (!record || record.deletedAt) throw new AppError('Psychological record not found', 404);

    const isSelf = currentUser.employeeId === record.employeeId;
    // Someone else's confidential record answers exactly like a missing one,
    // so a non-HR user cannot learn that a record exists.
    if ((currentUser.permissionTier === 'STANDARD' || currentUser.permissionTier === 'SUPERVISOR') && !isSelf) {
      throw new AppError('Psychological record not found', 404);
    }

    // Fetch other historical records for this employee for drill-down view
    const history = await prisma.psychologicalRecord.findMany({
      where: { employeeId: record.employeeId, id: { not: recordId }, deletedAt: null },
      select: {
        id: true,
        assessmentType: true,
        assessmentDate: true,
        expiresAt: true,
        reviewStatus: true,
        requirement: { select: { id: true, title: true } },
      },
      orderBy: { assessmentDate: 'desc' },
    });

    if (currentUser.permissionTier !== 'FULL') {
      const { hrConfidentialNotes, ...rest } = record as any;
      return { ...rest, history };
    }

    return { ...record, history };
  }

  // ── Write Operations (FULL Tier Only) ─────────────────────────────────────────

  static async createRecord(data: {
    employeeId: string;
    requirementId?: string;
    assessmentType: string;
    assessmentDate: Date;
    conductedBy?: string;
    employeeVisibleSummary?: string;
    hrConfidentialNotes?: string;
    expiresAt?: Date;
    createdById: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError('Employee not found', 404);

    const record = await prisma.psychologicalRecord.create({
      data: {
        employeeId: data.employeeId,
        requirementId: data.requirementId,
        assessmentType: data.assessmentType,
        assessmentDate: data.assessmentDate,
        conductedBy: data.conductedBy,
        employeeVisibleSummary: data.employeeVisibleSummary,
        hrConfidentialNotes: data.hrConfidentialNotes,
        expiresAt: data.expiresAt,
        createdById: data.createdById,
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: data.employeeId,
      action: 'PSYCH_RECORD_CREATED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: record.id,
      metadata: { assessmentType: data.assessmentType },
      ipAddress,
      userAgent,
    });

    return record;
  }

  static async updateRecord(recordId: string, data: {
    assessmentType?: string;
    assessmentDate?: Date;
    conductedBy?: string;
    employeeVisibleSummary?: string;
    hrConfidentialNotes?: string;
    expiresAt?: Date;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.psychologicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Psychological record not found', 404);

    const updated = await prisma.psychologicalRecord.update({
      where: { id: recordId },
      data: {
        assessmentType: data.assessmentType,
        assessmentDate: data.assessmentDate,
        conductedBy: data.conductedBy,
        employeeVisibleSummary: data.employeeVisibleSummary,
        hrConfidentialNotes: data.hrConfidentialNotes,
        expiresAt: data.expiresAt,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'PSYCH_RECORD_UPDATED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: recordId,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async reviewRecord(recordId: string, data: {
    reviewStatus: RecordReviewStatus;
    reviewReason?: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.psychologicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Psychological record not found', 404);

    const updated = await prisma.psychologicalRecord.update({
      where: { id: recordId },
      data: {
        reviewStatus: data.reviewStatus,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        reviewReason: data.reviewReason,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'PSYCH_RECORD_REVIEWED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: recordId,
      metadata: { reviewStatus: data.reviewStatus },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async softDeleteRecord(recordId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.psychologicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Psychological record not found', 404);

    await prisma.psychologicalRecord.update({ where: { id: recordId }, data: { deletedAt: new Date() } });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'PSYCH_RECORD_DELETED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: recordId,
      ipAddress,
      userAgent,
    });
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  static async uploadDocument(
    recordId: string,
    file: Express.Multer.File,
    data: {
      visibility: PsychologicalDocumentVisibility;
      notes?: string;
      uploadedById: string;
    },
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const record = await prisma.psychologicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Psychological record not found', 404);

    const doc = await prisma.psychologicalRecordDocument.create({
      data: {
        psychologicalRecordId: recordId,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        visibility: data.visibility,
        notes: data.notes,
        uploadedById: data.uploadedById,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'PSYCH_DOCUMENT_UPLOADED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: recordId,
      metadata: { filename: file.originalname, visibility: data.visibility },
      ipAddress,
      userAgent,
    });

    return doc;
  }

  static async streamDocument(documentId: string, currentUser: any) {
    const doc = await prisma.psychologicalRecordDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new AppError('Document not found', 404);

    const record = await prisma.psychologicalRecord.findUnique({ where: { id: doc.psychologicalRecordId } });
    if (!record || record.deletedAt) throw new AppError('Associated record not found', 404);

    const isSelf = currentUser.employeeId === record.employeeId;

    if (doc.visibility === 'HR_ONLY' && currentUser.permissionTier !== 'FULL') {
      throw new AppError('Access denied. This document is confidential.', 403);
    }

    if (doc.visibility === 'EMPLOYEE_VISIBLE') {
      if (!isSelf && currentUser.permissionTier !== 'FULL') {
        throw new AppError('Unauthorized', 403);
      }
    }

    const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
    if (!fs.existsSync(filePath)) throw new AppError('File physically missing from storage', 404);

    return { filePath, mimeType: doc.mimeType, originalFilename: doc.originalFilename };
  }

  static async deleteDocument(documentId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const doc = await prisma.psychologicalRecordDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new AppError('Document not found', 404);

    const record = await prisma.psychologicalRecord.findUnique({ where: { id: doc.psychologicalRecordId } });

    await prisma.psychologicalRecordDocument.delete({ where: { id: documentId } });

    const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
    if (fs.existsSync(filePath)) {
      // The record is already gone; a leftover file is logged, never thrown.
      cleanupUploadedFiles([{ path: filePath }]);
    }

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record?.employeeId,
      action: 'PSYCH_DOCUMENT_DELETED',
      entityType: 'PSYCHOLOGICAL_RECORD',
      entityId: doc.psychologicalRecordId,
      metadata: { filename: doc.originalFilename, visibility: doc.visibility },
      ipAddress,
      userAgent,
    });
  }
}
