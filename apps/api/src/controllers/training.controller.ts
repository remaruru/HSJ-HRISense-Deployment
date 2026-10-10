import { Request, Response, NextFunction } from 'express';
import { TrainingService } from '../services/training.service';
import { AppError } from '../middleware/errorHandler';

export class TrainingController {
  // ── Activities ──────────────────────────────────────────────────────────────
  static async listActivities(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { type, status, search } = req.query;
      const activities = await TrainingService.listActivities(
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        },
        {
          type: type as any,
          status: status as any,
          search: search as string,
        }
      );
      res.json({ success: true, data: activities });
    } catch (err) {
      next(err);
    }
  }

  static async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id } = req.params;
      const activity = await TrainingService.getActivity(id, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: activity });
    } catch (err) {
      next(err);
    }
  }

  static async createActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const activity = await TrainingService.createActivity(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: activity, message: 'Training activity created successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async updateActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const activity = await TrainingService.updateActivity(id, req.body, req.user?.userId);
      res.json({ success: true, data: activity, message: 'Training activity updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async cancelActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const activity = await TrainingService.cancelActivity(id, req.user?.userId);
      res.json({ success: true, data: activity, message: 'Training activity cancelled' });
    } catch (err) {
      next(err);
    }
  }

  // ── Participants ────────────────────────────────────────────────────────────
  static async addParticipants(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const activity = await TrainingService.addParticipants(id, req.body, req.user?.userId);
      res.json({ success: true, data: activity, message: 'Participants added successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async updateParticipantStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, employeeId } = req.params;
      const participant = await TrainingService.updateParticipantStatus(id, employeeId, req.body, req.user?.userId);
      res.json({ success: true, data: participant, message: 'Participant status updated' });
    } catch (err) {
      next(err);
    }
  }

  static async bulkUpdateParticipantStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { employeeIds, status, completedAt, validUntil, notes } = req.body;
      const activity = await TrainingService.bulkUpdateParticipantStatus(
        id,
        employeeIds,
        { status, completedAt, validUntil, notes },
        req.user?.userId
      );
      res.json({ success: true, data: activity, message: 'Participants status updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ── Employee History (Profile Tab) ──────────────────────────────────────────
  static async listEmployeeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { employeeId } = req.params;
      const history = await TrainingService.listEmployeeTrainingHistory(employeeId, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  // ── Participant Certificate ────────────────────────────────────────────────
  static async uploadParticipantCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const file = req.file as Express.Multer.File;
      if (!file) {
        throw new AppError('No certificate file uploaded.', 400);
      }
      const { id, employeeId } = req.params;
      const participant = await TrainingService.uploadParticipantCertificate(
        id,
        employeeId,
        file,
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        },
        req.ip,
        req.headers['user-agent']
      );
      res.status(201).json({ success: true, data: participant, message: 'Certificate uploaded successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async streamParticipantCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id, employeeId } = req.params;
      const { filePath, mimeType, originalFilename } = await TrainingService.streamParticipantCertificate(
        id,
        employeeId,
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        }
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }

  // ── Activity Documents ──────────────────────────────────────────────────────
  static async uploadActivityDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const file = req.file as Express.Multer.File;
      if (!file) {
        throw new AppError('No document file uploaded.', 400);
      }
      const { id } = req.params;
      const doc = await TrainingService.uploadActivityDocument(
        id,
        file,
        req.body?.notes,
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        },
        req.ip,
        req.headers['user-agent']
      );
      res.status(201).json({ success: true, data: doc, message: 'Document uploaded successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async streamActivityDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id, documentId } = req.params;
      const { filePath, mimeType, originalFilename } = await TrainingService.streamActivityDocument(
        id,
        documentId,
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        }
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
}
