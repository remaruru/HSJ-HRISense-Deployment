import { Request, Response } from 'express';
import { AttendanceImportDecision } from '@prisma/client';
import { AttendanceImportService } from '../services/attendance-import/attendance-import.service';
import { AppError } from '../middleware/errorHandler';
import { cleanupUploadedFiles } from '../middleware/upload';

/**
 * HTTP surface for the attendance importer.
 *
 * Every route here is HR-only; that is enforced by the router, not by this file.
 * Nothing in a response carries a filesystem path — HR sees the name they
 * uploaded, never where it landed on the server.
 */
export class AttendanceImportController {
  /**
   * Upload and preview in one call. Parsing happens immediately because a batch
   * that is uploaded but never parsed is just clutter; the WRITE still waits for
   * a separate, explicit confirmation.
   */
  static async upload(req: Request, res: Response) {
    const file = req.file;
    if (!file) throw new AppError('Select the attendance export to upload.', 400);

    const userId = req.user!.userId;
    let batchId: string | null = null;
    try {
      const { batch, previouslyApplied } = await AttendanceImportService.createBatch(
        { path: file.path, originalname: file.originalname, size: file.size, filename: file.filename },
        userId
      );
      batchId = batch.id;
      const validated = await AttendanceImportService.parseAndClassify(batch.id, file.path);

      res.status(201).json({
        success: true,
        data: {
          batch: validated,
          // Not an error: the same export may legitimately be uploaded again.
          previouslyApplied: previouslyApplied
            ? { at: previouslyApplied.uploadedAt, filename: previouslyApplied.originalFilename }
            : null,
        },
      });
    } catch (error) {
      // The stored file is only useful next to a usable batch.
      if (!batchId) cleanupUploadedFiles([file]);
      throw error;
    }
  }

  static async preview(req: Request, res: Response) {
    const data = await AttendanceImportService.getPreview(req.params.id, {
      classification: req.query.classification as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  }

  static async decide(req: Request, res: Response) {
    const { candidateIds, decision, reason } = req.body as {
      candidateIds: string[];
      decision: AttendanceImportDecision;
      reason?: string;
    };
    const data = await AttendanceImportService.setDecision(
      req.params.id,
      candidateIds,
      decision,
      req.user!.userId,
      reason
    );
    res.json({ success: true, data });
  }

  static async apply(req: Request, res: Response) {
    const data = await AttendanceImportService.apply(req.params.id, req.user!.userId);
    res.json({ success: true, data });
  }

  static async cancel(req: Request, res: Response) {
    const data = await AttendanceImportService.cancel(req.params.id, req.user!.userId);
    res.json({ success: true, data });
  }

  static async list(req: Request, res: Response) {
    const data = await AttendanceImportService.listBatches(
      req.query.page ? Number(req.query.page) : 1,
      req.query.limit ? Number(req.query.limit) : 20
    );
    res.json({ success: true, data });
  }

  static async mapCode(req: Request, res: Response) {
    const { employeeId, code } = req.body as { employeeId: string; code: string };
    const data = await AttendanceImportService.mapCode(employeeId, code, req.user!.userId);
    res.json({ success: true, data });
  }
}
