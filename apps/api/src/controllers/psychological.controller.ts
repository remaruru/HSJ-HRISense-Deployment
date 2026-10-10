import { Request, Response, NextFunction } from 'express';
import { PsychologicalService } from '../services/psychological.service';
import { AppError } from '../middleware/errorHandler';

export class PsychologicalController {

  static async listAllRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await PsychologicalService.listAllRecords(req.query as any, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await PsychologicalService.getSummaryMetrics(currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async listRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await PsychologicalService.listRecords(req.params.employeeId, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await PsychologicalService.getRecordById(req.params.recordId, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async createRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const employeeId = req.params.employeeId || req.body.employeeId;
      const data = await PsychologicalService.createRecord(
        {
          employeeId,
          ...req.body,
          assessmentDate: new Date(req.body.assessmentDate),
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
      if (body.assessmentDate) body.assessmentDate = new Date(body.assessmentDate);
      if (body.expiresAt) body.expiresAt = new Date(body.expiresAt);
      const data = await PsychologicalService.updateRecord(req.params.recordId, body, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async reviewRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await PsychologicalService.reviewRecord(req.params.recordId, req.body, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await PsychologicalService.softDeleteRecord(req.params.recordId, user.id, req.ip, req.headers['user-agent']);
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
      const data = await PsychologicalService.uploadDocument(
        req.params.recordId, file,
        {
          visibility: req.body.visibility || 'HR_ONLY',
          notes: req.body.notes,
          uploadedById: user.id
        },
        user.id, req.ip, req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async streamDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const { filePath, mimeType, originalFilename } = await PsychologicalService.streamDocument(req.params.documentId, currentUser);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.sendFile(filePath);
    } catch (err) { next(err); }
  }

  static async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await PsychologicalService.deleteDocument(req.params.documentId, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Document deleted.' });
    } catch (err) { next(err); }
  }
}
