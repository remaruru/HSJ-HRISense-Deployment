import { Request, Response, NextFunction } from 'express';
import { AnnouncementService, safeUnlinkAnnouncementFile } from '../services/announcement.service';
import { AppError } from '../middleware/errorHandler';
import { AnnouncementPriority } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENT CONTROLLER
// Thin HTTP adapter layer. All business logic lives in AnnouncementService.
// ─────────────────────────────────────────────────────────────────────────────

export class AnnouncementController {

  // ── Audience Preview ─────────────────────────────────────────────────────────

  static async previewAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const { scopes } = req.body;
      if (!Array.isArray(scopes)) {
        throw new AppError('Please provide an audience selection.', 400);
      }
      const result = await AnnouncementService.previewAudience(scopes);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  // ── HR Management ─────────────────────────────────────────────────────────────

  static async listForHR(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, priority, search, page, limit } = req.query as any;
      const result = await AnnouncementService.listForHR({
        status,
        priority: priority as AnnouncementPriority | undefined,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  static async getSummaryStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnnouncementService.getSummaryStats();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Create Draft ──────────────────────────────────────────────────────────────

  static async createDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = await AnnouncementService.createDraft(
        req.body,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Get By ID ────────────────────────────────────────────────────────────────

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = await AnnouncementService.getById(req.params.id, {
        userId: user.userId,
        employeeId: user.employeeId,
        permissionTier: user.permissionTier,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  static async updateAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = await AnnouncementService.updateAnnouncement(
        req.params.id,
        req.body,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Activate (Publish Now) ────────────────────────────────────────────────────

  static async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = await AnnouncementService.activateNow(
        req.params.id,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Schedule ─────────────────────────────────────────────────────────────────

  static async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { publishAt } = req.body;
      if (!publishAt) throw new AppError('Please provide a publish time.', 400);

      const publishDate = new Date(publishAt);
      if (isNaN(publishDate.getTime())) {
        throw new AppError('Please provide a valid publish date and time.', 400);
      }

      const data = await AnnouncementService.schedule(
        req.params.id,
        publishDate,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Archive ──────────────────────────────────────────────────────────────────

  static async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = await AnnouncementService.archive(
        req.params.id,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Delete Draft ──────────────────────────────────────────────────────────────

  static async deleteDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      await AnnouncementService.deleteDraft(
        req.params.id,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string,
      );
      res.json({ success: true, message: 'Draft announcement deleted.' });
    } catch (err) { next(err); }
  }

  // ── Recipient Feed ────────────────────────────────────────────────────────────

  static async listForRecipient(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      if (!user.employeeId) {
        // User has no employee record — return empty feed safely
        return res.json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        });
      }

      const { filter = 'current', page, limit, unreadOnly } = req.query as any;
      const result = await AnnouncementService.listForRecipient(
        user.employeeId,
        filter as 'current' | 'past',
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          unreadOnly: unreadOnly === 'true',
        }
      );
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  // ── Dashboard Data ────────────────────────────────────────────────────────────

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      if (!user.employeeId) {
        return res.json({ success: true, data: { announcements: [], unreadCurrentCount: 0 } });
      }

      const data = await AnnouncementService.getDashboardData(user.employeeId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Unread Count ──────────────────────────────────────────────────────────────

  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const count = user.employeeId
        ? await AnnouncementService.getUnreadCount(user.employeeId)
        : 0;
      res.json({ success: true, data: { unreadCount: count } });
    } catch (err) { next(err); }
  }

  // ── Mark Read ─────────────────────────────────────────────────────────────────

  static async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const result = await AnnouncementService.markRead(req.params.id, {
        userId: user.userId,
        employeeId: user.employeeId,
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  // ── Recipient List (HR) ───────────────────────────────────────────────────────

  static async listRecipients(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, readFilter, page, limit } = req.query as any;
      const result = await AnnouncementService.listRecipients(req.params.id, {
        search,
        readFilter: readFilter as 'all' | 'read' | 'unread' | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }

  // ── Recipient Stats ───────────────────────────────────────────────────────────

  static async getRecipientStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnnouncementService.getRecipientStats(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  // ── Attachments (Checkpoint 3) ────────────────────────────────────────────────

  static async uploadAttachment(req: Request, res: Response, next: NextFunction) {
    const file = req.file as Express.Multer.File;
    try {
      const user = req.user!;
      if (!file) {
        throw new AppError('Please choose a file to upload.', 400);
      }
      try {
        const data = await AnnouncementService.uploadAttachment(
          req.params.id,
          file,
          user.userId,
          req.ip,
          req.headers['user-agent'] as string
        );
        res.status(201).json({ success: true, data, message: 'Attachment uploaded successfully.' });
      } catch (serviceErr) {
        // Clean up orphan file written by Multer before service rejection
        if (file?.filename) {
          safeUnlinkAnnouncementFile(file.filename);
        }
        throw serviceErr;
      }
    } catch (err) {
      next(err);
    }
  }

  static async streamAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { filePath, mimeType, originalFilename } = await AnnouncementService.streamAttachment(
        req.params.id,
        req.params.attachmentId,
        {
          userId: user.userId,
          employeeId: user.employeeId,
          permissionTier: user.permissionTier,
        }
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      await AnnouncementService.deleteAttachment(
        req.params.id,
        req.params.attachmentId,
        user.userId,
        req.ip,
        req.headers['user-agent'] as string
      );
      res.json({ success: true, message: 'Attachment removed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  static async listAttachments(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnnouncementService.listAttachments(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
