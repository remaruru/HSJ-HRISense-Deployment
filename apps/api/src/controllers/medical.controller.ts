import { Request, Response, NextFunction } from 'express';
import { MedicalService } from '../services/medical.service';
import { AppError } from '../middleware/errorHandler';

export class MedicalController {

  static async listAllRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await MedicalService.listAllRecords(req.query as any, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await MedicalService.getSummaryMetrics(currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async listRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await MedicalService.listRecords(req.params.employeeId, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await MedicalService.getRecordById(req.params.recordId, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async createRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const employeeId = req.params.employeeId || req.body.employeeId;
      const data = await MedicalService.createRecord(
        {
          employeeId,
          ...req.body,
          examDate: new Date(req.body.examDate),
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
          createdById: user.id,
        },
        user.id, req.ip, req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async updateRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const body = { ...req.body };
      if (body.examDate) body.examDate = new Date(body.examDate);
      if (body.expiresAt) body.expiresAt = new Date(body.expiresAt);
      const data = await MedicalService.updateRecord(req.params.recordId, body, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async reviewRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await MedicalService.reviewRecord(req.params.recordId, req.body, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await MedicalService.softDeleteRecord(req.params.recordId, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Record deleted.' });
    } catch (err) { next(err); }
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  static async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const file = req.file as Express.Multer.File;
      if (!file) {
        throw new AppError('Please choose a file to upload.', 400, undefined, 'FILE_REQUIRED');
      }
      const data = await MedicalService.uploadDocument(
        req.params.recordId, file,
        { notes: req.body.notes, uploadedById: user.id },
        user.id, req.ip, req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async streamDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const { filePath, mimeType, originalFilename } = await MedicalService.streamDocument(req.params.documentId, currentUser);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.sendFile(filePath);
    } catch (err) { next(err); }
  }

  static async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await MedicalService.deleteDocument(req.params.documentId, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Document deleted.' });
    } catch (err) { next(err); }
  }
}
