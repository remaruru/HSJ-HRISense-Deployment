import { Request, Response, NextFunction } from 'express';
import { HolidayService } from '../services/holiday.service';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { SchedulingPolicy, SchedulingPolicyContext } from '../policies/scheduling.policy';

export class HolidayController {
  private static async getPolicyContext(req: Request): Promise<SchedulingPolicyContext> {
    const user = req.user!;
    if (!user.employeeId) {
      return { userId: user.userId, permissionTier: user.permissionTier, employee: null };
    }
    const emp = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { jobRole: true }
    });
    return { userId: user.userId, permissionTier: user.permissionTier, employee: emp };
  }

  static async fetchSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      const result = await HolidayService.fetchSuggestions(year, req.user!.userId);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, status, source } = req.query;
      const data = await HolidayService.list({
        year: year ? parseInt(year as string, 10) : undefined,
        status: status as any,
        source: source as any,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async updateSuggestionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const { id } = req.params;
      const { status } = req.body;
      const updated = await HolidayService.updateSuggestionStatus(id, status, req.user!.userId);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async createManualEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const { date, name, type, notes } = req.body;
      const entry = await HolidayService.createManualEntry({ date, name, type, notes }, req.user!.userId);
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  static async updateManualEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const { id } = req.params;
      const updated = await HolidayService.updateManualEntry(id, req.body, req.user!.userId);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /holidays/:id/working-units — units expected to work on this entry. */
  static async setWorkingUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const unitIds = Array.isArray(req.body?.unitIds) ? req.body.unitIds : [];
      const data = await HolidayService.setWorkingUnits(req.params.id, unitIds, req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Deactivates a calendar entry.
   *
   * This is a real, named operation rather than the generic update handler the
   * DELETE route previously pointed at. Entries are never hard-deleted because
   * historical attendance is interpreted against them.
   */
  static async deactivateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await HolidayController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageOrganizationCalendar(context)) {
        throw new AppError('Permission denied', 403);
      }
      const { id } = req.params;
      const updated = await HolidayService.deactivateEntry(id, req.user!.userId, req.body?.remarks);
      res.json({
        success: true,
        data: updated,
        message: 'Calendar entry deactivated. It no longer applies, and the record is preserved.',
      });
    } catch (err) {
      next(err);
    }
  }
}
