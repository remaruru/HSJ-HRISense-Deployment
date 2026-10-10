import { Request, Response, NextFunction } from 'express';
import { DraftService } from '../services/draft.service';
import { OnboardingDraftStatus } from '@prisma/client';

export class DraftController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, status } = req.body;
      const draft = await DraftService.create(req.user!.userId, data, status as OnboardingDraftStatus);
      res.status(201).json({ success: true, data: draft });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { data, status, assignedToId } = req.body;
      const draft = await DraftService.update(id, req.user!.userId, req.user!.permissionTier, {
        data,
        status: status as OnboardingDraftStatus,
        assignedToId
      });
      res.json({ success: true, data: draft });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const drafts = await DraftService.list(req.user!.userId, req.user!.permissionTier, status as OnboardingDraftStatus);
      res.json({ success: true, data: drafts });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const draft = await DraftService.getById(id, req.user!.userId, req.user!.permissionTier);
      res.json({ success: true, data: draft });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await DraftService.delete(id, req.user!.userId, req.user!.permissionTier);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
