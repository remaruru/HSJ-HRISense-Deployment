import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../services/schedule.service';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier } from '@prisma/client';
import { SchedulingPolicy, SchedulingPolicyContext } from '../policies/scheduling.policy';
import { OrgHierarchyService } from '../services/org-hierarchy.service';

export class ScheduleController {
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

  static async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await ScheduleController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageScheduleTemplates(context)) {
        throw new AppError('Permission denied', 403);
      }
      const template = await ScheduleService.createTemplate(req.body, req.user!.userId);
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  static async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await ScheduleController.getPolicyContext(req);
      if (!SchedulingPolicy.canManageScheduleTemplates(context)) {
        throw new AppError('Permission denied', 403);
      }
      const { id } = req.params;
      const { data, effectiveDate } = req.body;
      if (!effectiveDate) throw new AppError('effectiveDate is required to revise a template.', 400);

      const template = await ScheduleService.updateTemplate(id, data, effectiveDate, req.user!.userId);
      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  static async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const includeCounts = req.query.includeCounts === 'true';
      const templates = await ScheduleService.listTemplates(req.user!.userId, includeCounts);
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  static async getEmployeeSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await ScheduleController.getPolicyContext(req);
      const params = {
        employeeId: req.query.employeeId as string,
        search: req.query.search as string,
        unitId: req.query.unitId as string,
        departmentId: req.query.departmentId as string,
        jobRoleId: req.query.jobRoleId as string,
        templateId: req.query.templateId as string,
        configurationStatus: req.query.configurationStatus as string,
        applicableDate: req.query.applicableDate as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      };
      const result = await ScheduleService.getEmployeeSchedules(context, params);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getCoverage(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await ScheduleController.getPolicyContext(req);
      const params = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
        unitId: req.query.unitId as string,
        departmentId: req.query.departmentId as string,
        templateId: req.query.templateId as string,
      };
      
      if (!params.startDate || !params.endDate) {
        throw new AppError('startDate and endDate are required', 400);
      }

      const result = await ScheduleService.getCoverage(context, params);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async listHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await ScheduleController.getPolicyContext(req);
      const { employeeId } = req.query;
      const history = await ScheduleService.listHistory(context, { employeeId: employeeId as string });
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  static async assignSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeIds, templateId, effectiveDate } = req.body;
      const actorUser = req.user!;
      const context = await ScheduleController.getPolicyContext(req);

      // Enforce Supervisor check or HR check
      if (!SchedulingPolicy.canAssignOrganizationSchedules(context)) {
        if (actorUser.permissionTier === PermissionTier.SUPERVISOR) {
        if (!actorUser.employeeId) throw new AppError('Supervisor must be linked to an employee profile.', 403);
        
        // Ensure all target employeeIds are active direct subordinates
        // (canonical hierarchy — see OrgHierarchyService).
        const subordinateIds = new Set(
          await OrgHierarchyService.getDirectSubordinateIds(actorUser.employeeId)
        );
        const unauthorized = employeeIds.filter((id: string) => !subordinateIds.has(id));

        if (unauthorized.length > 0) {
          throw new AppError('You can only assign schedules to your active direct subordinates.', 403);
        }
      } else {
        throw new AppError('Permission denied: You do not have HR scheduling authority.', 403);
      }
    }

    const result = await ScheduleService.assignSchedule(employeeIds, templateId, effectiveDate, actorUser.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }


}
