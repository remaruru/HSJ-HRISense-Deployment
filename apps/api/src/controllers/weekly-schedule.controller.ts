import { Request, Response } from 'express';
import { WeeklyScheduleService } from '../services/weekly-schedule.service';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier } from '@prisma/client';
import { OrgHierarchyService } from '../services/org-hierarchy.service';

export class WeeklyScheduleController {
  // ─────────────────────────────────────────────────────────────────────────────
  // SHIFT DEFINITIONS
  // ─────────────────────────────────────────────────────────────────────────────

  static async listShifts(req: Request, res: Response) {
    const shifts = await WeeklyScheduleService.listShifts();
    res.json({ data: shifts });
  }

  static async createShift(req: Request, res: Response) {
    if (req.user!.permissionTier !== PermissionTier.FULL) {
      throw new AppError('Only HR can manage shift definitions.', 403);
    }
    const shift = await WeeklyScheduleService.createShift(req.body, req.user!.userId);
    res.status(201).json({ data: shift });
  }

  static async updateShift(req: Request, res: Response) {
    if (req.user!.permissionTier !== PermissionTier.FULL) {
      throw new AppError('Only HR can manage shift definitions.', 403);
    }
    const shift = await WeeklyScheduleService.updateShift(req.params.id, req.body, req.user!.userId);
    res.json({ data: shift });
  }

  static async deactivateShift(req: Request, res: Response) {
    if (req.user!.permissionTier !== PermissionTier.FULL) {
      throw new AppError('Only HR can manage shift definitions.', 403);
    }
    await WeeklyScheduleService.deactivateShift(req.params.id);
    res.json({ message: 'Shift definition deactivated' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPLOYEE WEEKLY SCHEDULES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Object-level authorization for one employee's weekly schedule.
   *
   * FULL       → any employee.
   * SUPERVISOR → themselves and their own direct reports ONLY. (Previously a
   *              supervisor could read and WRITE any employee's schedule; the
   *              subordinate check was noted as missing and never implemented.)
   * STANDARD   → themselves, read-only.
   */
  private static async assertScheduleAccess(
    req: Request,
    employeeId: string,
    mode: 'read' | 'write'
  ): Promise<void> {
    const { permissionTier, employeeId: actorEmployeeId } = req.user!;

    if (permissionTier === PermissionTier.FULL) return;

    if (permissionTier === PermissionTier.STANDARD) {
      if (mode === 'write') {
        throw new AppError('Employees cannot edit work schedules.', 403);
      }
      if (actorEmployeeId !== employeeId) {
        throw new AppError('You can only view your own work schedule.', 403);
      }
      return;
    }

    // SUPERVISOR
    if (!actorEmployeeId) {
      throw new AppError('Supervisor must be linked to an employee profile.', 403);
    }
    if (actorEmployeeId === employeeId) {
      if (mode === 'write') {
        throw new AppError('You cannot edit your own work schedule. Ask HR.', 403);
      }
      return;
    }

    const isSubordinate = await OrgHierarchyService.isDirectSubordinate(actorEmployeeId, employeeId);
    if (!isSubordinate) {
      throw new AppError(
        mode === 'write'
          ? 'You can only edit the work schedule of your own direct reports.'
          : 'You can only view the work schedule of your own direct reports.',
        403
      );
    }
  }

  static async getEmployeeWeeklySchedule(req: Request, res: Response) {
    const { employeeId } = req.params;
    const { applicableDate } = req.query;

    if (!applicableDate || typeof applicableDate !== 'string') {
      throw new AppError('applicableDate is required', 400);
    }

    await WeeklyScheduleController.assertScheduleAccess(req, employeeId, 'read');

    const schedule = await WeeklyScheduleService.getEmployeeWeeklySchedule(employeeId, applicableDate);
    res.json({ data: schedule });
  }

  static async saveEmployeeWeeklySchedule(req: Request, res: Response) {
    const { employeeId } = req.params;
    const { effectiveFrom, days } = req.body;

    if (!effectiveFrom) throw new AppError('effectiveFrom is required', 400);
    if (!days || !Array.isArray(days)) throw new AppError('days array is required', 400);

    await WeeklyScheduleController.assertScheduleAccess(req, employeeId, 'write');

    const result = await WeeklyScheduleService.saveEmployeeWeeklySchedule(employeeId, effectiveFrom, days, req.user!.userId);
    res.json({ data: result });
  }
}
