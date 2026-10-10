import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { DocumentCategory, EmployeeDocument } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { createAuditLog } from '../lib/audit';
import { OrgHierarchyService } from './org-hierarchy.service';
import { cleanupUploadedFiles } from '../middleware/upload';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documents');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class DocumentService {
  static async uploadDocument(
    employeeId: string,
    file: Express.Multer.File,
    data: {
      category: DocumentCategory;
      notes?: string;
      isVisibleToEmployee: boolean;
      isVisibleToSupervisor: boolean;
      expiresAt?: Date;
      uploadedById: string;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    // Multer has already written the file to disk by the time this runs, so every
    // failure path below must remove it. Otherwise the upload directory silently
    // accumulates unreferenced files containing personal data — invisible to
    // every HRISense screen and to the employee they belong to.
    //
    // Onboarding already does this (EmployeeController.create calls
    // cleanupUploadedFiles on rollback); this path was missing it.
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      cleanupUploadedFiles([file]);
      throw new AppError('Employee not found', 404);
    }

    let document;
    try {
      document = await prisma.employeeDocument.create({
        data: {
          employeeId,
          category: data.category,
          originalFilename: file.originalname,
          storedFilename: file.filename, // Multer already randomized this
          mimeType: file.mimetype,
          sizeBytes: file.size,
          isVisibleToEmployee: data.isVisibleToEmployee,
          isVisibleToSupervisor: data.category === 'MEDICAL_CLEARANCE' || data.category === 'OTHER' ? false : data.isVisibleToSupervisor,
          expiresAt: data.expiresAt,
          notes: data.notes,
          uploadedById: data.uploadedById,
        },
      });
    } catch (err) {
      cleanupUploadedFiles([file]);
      throw err;
    }

    await createAuditLog({
      actorUserId: data.uploadedById,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: document.id,
      metadata: { category: data.category, filename: file.originalname },
      ipAddress,
      userAgent,
    });

    return document;
  }

  static async getDocumentsForEmployee(employeeId: string, currentUser: any) {
    // Check basic existence
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new AppError('Employee not found', 404);

    let whereClause: any = {
      employeeId,
      deletedAt: null,
    };

    if (currentUser.permissionTier === 'STANDARD') {
      if (currentUser.employeeId !== employeeId) {
        throw new AppError('Unauthorized access to employee documents', 403);
      }
      whereClause.isVisibleToEmployee = true;
    } else if (currentUser.permissionTier === 'SUPERVISOR') {
      if (currentUser.employeeId === employeeId) {
        // Own profile
        whereClause.isVisibleToEmployee = true;
      } else {
        // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
        const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
          currentUser.employeeId,
          employeeId
        );

        if (!isSubordinate) {
          throw new AppError('Unauthorized. Employee is not a direct subordinate.', 403);
        }
        whereClause.isVisibleToSupervisor = true;
      }
    }

    return await prisma.employeeDocument.findMany({
      where: whereClause,
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async getPreview(documentId: string, currentUser: any) {
    const document = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      throw new AppError('Document not found', 404);
    }

    // RBAC check
    if (currentUser.permissionTier === 'STANDARD') {
      if (document.employeeId !== currentUser.employeeId || !document.isVisibleToEmployee) {
        throw new AppError('Unauthorized', 403);
      }
    } else if (currentUser.permissionTier === 'SUPERVISOR') {
      if (document.employeeId === currentUser.employeeId) {
        if (!document.isVisibleToEmployee) throw new AppError('Unauthorized', 403);
      } else {
        const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
          currentUser.employeeId,
          document.employeeId
        );
        if (!isSubordinate || !document.isVisibleToSupervisor) {
          throw new AppError('Unauthorized', 403);
        }
      }
    }

    const filePath = path.join(UPLOAD_DIR, document.storedFilename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('File physically missing from storage', 404);
    }

    return {
      filePath,
      mimeType: document.mimeType,
      originalFilename: document.originalFilename,
    };
  }

  static async deleteDocument(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const document = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new AppError('Document not found', 404);

    await prisma.employeeDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'DOCUMENT_DELETED',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: documentId,
      ipAddress,
      userAgent,
    });
  }

  static async updateMetadata(documentId: string, data: any, userId: string, ipAddress?: string, userAgent?: string) {
    const document = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) throw new AppError('Document not found', 404);

    // Only allow FULL HR to update metadata (controlled in routes)
    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        category: data.category,
        notes: data.notes,
        isVisibleToEmployee: data.isVisibleToEmployee,
        isVisibleToSupervisor: data.isVisibleToSupervisor,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });

    if (document.isVisibleToEmployee !== data.isVisibleToEmployee || document.isVisibleToSupervisor !== data.isVisibleToSupervisor) {
      await createAuditLog({
        actorUserId: userId,
        action: 'DOCUMENT_VISIBILITY_CHANGED',
        entityType: 'EMPLOYEE_DOCUMENT',
        entityId: documentId,
        metadata: {
          employeeVisible: data.isVisibleToEmployee,
          supervisorVisible: data.isVisibleToSupervisor
        },
        ipAddress,
        userAgent,
      });
    }

    await createAuditLog({
      actorUserId: userId,
      action: 'DOCUMENT_METADATA_UPDATED',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: documentId,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async replaceDocument(
    documentId: string,
    file: Express.Multer.File,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const document = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      throw new AppError('Document not found', 404);
    }

    const oldFilename = document.storedFilename;
    const oldPath = path.join(UPLOAD_DIR, oldFilename);

    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        originalFilename: file.originalname,
        storedFilename: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        replacedAt: new Date(),
      },
    });

    if (fs.existsSync(oldPath)) {
      // The record is already gone; a leftover file is logged, never thrown.
      cleanupUploadedFiles([{ path: oldPath }]);
    }

    await createAuditLog({
      actorUserId: userId,
      action: 'DOCUMENT_REPLACED',
      entityType: 'EMPLOYEE_DOCUMENT',
      entityId: documentId,
      metadata: { 
        category: document.category,
        previousFilename: document.originalFilename, 
        newFilename: file.originalname,
        replacedAt: new Date()
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }
}
