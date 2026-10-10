import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { PermissionTier } from '@prisma/client';

export class DashboardController {
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { permissionTier, employeeId } = req.user!;

      if (permissionTier === PermissionTier.FULL) {
        const stats = await DashboardService.getHRStats();
        return res.json({ success: true, data: stats, variant: 'HR' });
      }

      const stats = await DashboardService.getEmployeeStats(employeeId || '', permissionTier);
      const variant = permissionTier === PermissionTier.SUPERVISOR ? 'SUPERVISOR' : 'EMPLOYEE';
      return res.json({ success: true, data: stats, variant });
    } catch (err) {
      next(err);
    }
  }
}
