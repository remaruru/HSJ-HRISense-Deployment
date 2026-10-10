import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DocumentService } from '../services/document.service';
import { AppError } from '../middleware/errorHandler';
import { DocumentCategory } from '@prisma/client';

export const uploadDocumentSchema = z.object({
  body: z.object({
    category: z.nativeEnum(DocumentCategory),
    notes: z.string().optional(),
    isVisibleToEmployee: z.preprocess((val) => val === 'true' || val === true, z.boolean()),
    isVisibleToSupervisor: z.preprocess((val) => val === 'true' || val === true, z.boolean()),
    expiresAt: z.string().optional(),
  }),
});

export const updateMetadataSchema = z.object({
  body: z.object({
    category: z.nativeEnum(DocumentCategory).optional(),
    notes: z.string().optional(),
    isVisibleToEmployee: z.boolean().optional(),
    isVisibleToSupervisor: z.boolean().optional(),
    expiresAt: z.string().optional(),
  }),
});

export class DocumentController {
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const file = req.file;
      const uploaderId = req.user?.userId;

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }
      if (!uploaderId) {
        throw new AppError('Unauthorized', 401);
      }

      const { category, notes, isVisibleToEmployee, isVisibleToSupervisor, expiresAt } = req.body;

      const result = await DocumentService.uploadDocument(
        employeeId,
        file,
        {
          category,
          notes,
          isVisibleToEmployee,
          isVisibleToSupervisor,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          uploadedById: uploaderId,
        },
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listByEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const user = req.user!;

      const result = await DocumentService.getDocumentsForEmployee(employeeId, user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentId } = req.params;
      const user = req.user!;

      const fileData = await DocumentService.getPreview(documentId, user);
      
      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileData.originalFilename}"`);
      res.sendFile(fileData.filePath);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentId } = req.params;
      const user = req.user!;

      const fileData = await DocumentService.getPreview(documentId, user);
      
      res.setHeader('Content-Type', fileData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalFilename}"`);
      res.sendFile(fileData.filePath);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentId } = req.params;
      const user = req.user!;

      await DocumentService.deleteDocument(documentId, user.userId, req.ip, req.headers['user-agent']);
      res.status(200).json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async updateMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentId } = req.params;
      const user = req.user!;

      const result = await DocumentService.updateMetadata(
        documentId, 
        req.body, 
        user.userId, 
        req.ip, 
        req.headers['user-agent']
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async replace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentId } = req.params;
      const file = req.file;
      const user = req.user!;

      if (!file) {
        throw new AppError('No file uploaded for replacement', 400);
      }

      const result = await DocumentService.replaceDocument(
        documentId,
        file,
        user.userId,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
