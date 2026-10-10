import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { RecordReviewStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import path from 'path';
import fs from 'fs';
import { cleanupUploadedFiles } from '../middleware/upload';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'medical');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Medical Service ────────────────────────────────────────────────────────────
// Handles MedicalRecord and MedicalRecordDocument.
// Access: FULL tier only for organization-wide oversight and write operations.
// Read: FULL tier receives full record with hrNotes. STANDARD/SUPERVISOR never receive hrNotes.

export class MedicalService {

  // ── Global Organization List (HR FULL Tier Only) ──────────────────────────────

  static async listAllRecords(params: {
    search?: string;
    unitId?: string;
    departmentId?: string;
    jobRoleId?: string;
    requirementId?: string;
    examType?: string;
    reviewStatus?: string;
    complianceStatus?: string;
    page?: number;
    limit?: number;
  }, currentUser: any) {
    if (currentUser.permissionTier !== 'FULL') {
      throw new AppError('Unauthorized. Only HR personnel can access organization-wide medical records.', 403);
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
        { examType: { contains: s } },
        { requirement: { title: { contains: s } } },
        { examinedBy: { contains: s } },
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
    if (params.examType) {
      where.examType = params.examType;
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
      prisma.medicalRecord.count({ where }),
      prisma.medicalRecord.findMany({
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
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, uploadedAt: true, notes: true },
          },
        },
        orderBy: { examDate: 'desc' },
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

      // Minimal table projection: strip narrative hrNotes from table rows
      const { hrNotes, ...safeRow } = r;
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
      prisma.medicalRecord.count({ where: { deletedAt: null } }),
      prisma.medicalRecord.count({
        where: {
          deletedAt: null,
          reviewStatus: { in: ['PENDING_REVIEW', 'NEEDS_CORRECTION'] },
        },
      }),
      prisma.medicalRecord.count({
        where: {
          deletedAt: null,
          expiresAt: { lt: now },
        },
      }),
      prisma.medicalRecord.count({
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
      throw new AppError('Access to subordinate medical records is not permitted.', 403);
    }

    const records = await prisma.medicalRecord.findMany({
      where: { employeeId, deletedAt: null },
      include: {
        documents: {
          select: { id: true, originalFilename: true, mimeType: true, uploadedAt: true, notes: true },
        },
        requirement: { select: { id: true, title: true, category: true } },
      },
      orderBy: { examDate: 'desc' },
    });

    if (currentUser.permissionTier !== 'FULL') {
      return records.map(r => ({ ...r, hrNotes: undefined }));
    }
    return records;
  }

  // ── Single Record Detail with Employee History ────────────────────────────────

  static async getRecordById(recordId: string, currentUser: any) {
    const record = await prisma.medicalRecord.findUnique({
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
        documents: true,
        requirement: { select: { id: true, title: true, category: true } },
      },
    });
    if (!record || record.deletedAt) throw new AppError('Medical record not found', 404);

    const isSelf = currentUser.employeeId === record.employeeId;
    // Someone else's confidential record answers exactly like a missing one,
    // so a non-HR user cannot learn that a record exists.
    if ((currentUser.permissionTier === 'STANDARD' || currentUser.permissionTier === 'SUPERVISOR') && !isSelf) {
      throw new AppError('Medical record not found', 404);
    }

    // Fetch other historical records for this employee for drill-down view
    const history = await prisma.medicalRecord.findMany({
      where: { employeeId: record.employeeId, id: { not: recordId }, deletedAt: null },
      select: {
        id: true,
        examType: true,
        examDate: true,
        expiresAt: true,
        reviewStatus: true,
        requirement: { select: { id: true, title: true } },
      },
      orderBy: { examDate: 'desc' },
    });

    if (currentUser.permissionTier !== 'FULL') {
      const { hrNotes, ...rest } = record as any;
      return { ...rest, history };
    }

    return { ...record, history };
  }

  // ── Write Operations (FULL Tier Only) ─────────────────────────────────────────

  static async createRecord(data: {
    employeeId: string;
    requirementId?: string;
    examType: string;
    examDate: Date;
    examinedBy?: string;
    hrNotes?: string;
    expiresAt?: Date;
    createdById: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError('Employee not found', 404);

    const record = await prisma.medicalRecord.create({
      data: {
        employeeId: data.employeeId,
        requirementId: data.requirementId,
        examType: data.examType,
        examDate: data.examDate,
        examinedBy: data.examinedBy,
        hrNotes: data.hrNotes,
        expiresAt: data.expiresAt,
        createdById: data.createdById,
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: data.employeeId,
      action: 'MEDICAL_RECORD_CREATED',
      entityType: 'MEDICAL_RECORD',
      entityId: record.id,
      metadata: { examType: data.examType },
      ipAddress,
      userAgent,
    });

    return record;
  }

  static async updateRecord(recordId: string, data: {
    examType?: string;
    examDate?: Date;
    examinedBy?: string;
    hrNotes?: string;
    expiresAt?: Date;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Medical record not found', 404);

    const updated = await prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        examType: data.examType,
        examDate: data.examDate,
        examinedBy: data.examinedBy,
        hrNotes: data.hrNotes,
        expiresAt: data.expiresAt,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'MEDICAL_RECORD_UPDATED',
      entityType: 'MEDICAL_RECORD',
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
    const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Medical record not found', 404);

    const updated = await prisma.medicalRecord.update({
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
      action: 'MEDICAL_RECORD_REVIEWED',
      entityType: 'MEDICAL_RECORD',
      entityId: recordId,
      metadata: { reviewStatus: data.reviewStatus },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async softDeleteRecord(recordId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Medical record not found', 404);

    await prisma.medicalRecord.update({ where: { id: recordId }, data: { deletedAt: new Date() } });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'MEDICAL_RECORD_DELETED',
      entityType: 'MEDICAL_RECORD',
      entityId: recordId,
      ipAddress,
      userAgent,
    });
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  static async uploadDocument(
    recordId: string,
    file: Express.Multer.File,
    data: { notes?: string; uploadedById: string },
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Medical record not found', 404);

    const doc = await prisma.medicalRecordDocument.create({
      data: {
        medicalRecordId: recordId,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        notes: data.notes,
        uploadedById: data.uploadedById,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'MEDICAL_DOCUMENT_UPLOADED',
      entityType: 'MEDICAL_RECORD',
      entityId: recordId,
      metadata: { filename: file.originalname },
      ipAddress,
      userAgent,
    });

    return doc;
  }

  static async streamDocument(documentId: string, currentUser: any) {
    if (currentUser.permissionTier !== 'FULL') {
      throw new AppError('Access denied. Medical documents require FULL tier access.', 403);
    }

    const doc = await prisma.medicalRecordDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new AppError('Document not found', 404);

    const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
    if (!fs.existsSync(filePath)) throw new AppError('File physically missing from storage', 404);

    return { filePath, mimeType: doc.mimeType, originalFilename: doc.originalFilename };
  }

  static async deleteDocument(documentId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const doc = await prisma.medicalRecordDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new AppError('Document not found', 404);

    const record = await prisma.medicalRecord.findUnique({ where: { id: doc.medicalRecordId } });

    await prisma.medicalRecordDocument.delete({ where: { id: documentId } });

    const filePath = path.join(UPLOAD_DIR, doc.storedFilename);
    if (fs.existsSync(filePath)) {
      // The record is already gone; a leftover file is logged, never thrown.
      cleanupUploadedFiles([{ path: filePath }]);
    }

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record?.employeeId,
      action: 'MEDICAL_DOCUMENT_DELETED',
      entityType: 'MEDICAL_RECORD',
      entityId: doc.medicalRecordId,
      metadata: { filename: doc.originalFilename },
      ipAddress,
      userAgent,
    });
  }
}
