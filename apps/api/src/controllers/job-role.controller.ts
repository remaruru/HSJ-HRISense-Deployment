import { Request, Response, NextFunction } from 'express';
import { JobRoleService } from '../services/job-role.service';
import { z } from 'zod';
import { PermissionTier } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';
import { prisma } from '../config/prisma';
import { OrgHierarchyService } from '../services/org-hierarchy.service';

/**
 * HR and Sister roles (FULL tier) decide who has HR authority, so only Sister
 * changes or deletes one, or turns a role into one. Otherwise any HR could step
 * around "HR cannot change another HR person" by editing the role itself.
 */
async function assertMayChangeRole(req: Request, roleId: string | null, newTier?: PermissionTier): Promise<void> {
  const existing = roleId
    ? await prisma.jobRole.findUnique({ where: { id: roleId }, select: { permissionTier: true } })
    : null;
  const touchesHr = existing?.permissionTier === PermissionTier.FULL || newTier === PermissionTier.FULL;
  if (touchesHr && !(await OrgHierarchyService.isSister(req.user?.employeeId))) {
    throw new AppError('Only Sister can change an HR or Sister job role, or make a role one.', 403, undefined, 'FORBIDDEN');
  }
}

const createJobRoleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  unitId: z.string().uuid('Invalid Unit ID'),
  permissionTier: z.nativeEnum(PermissionTier),
});

const updateJobRoleSchema = createJobRoleSchema.partial();

const createPositionSchema = z.object({
  title: z.string().min(1, 'Enter the position title.'),
  unitId: z.string().uuid('Choose the unit this position belongs to.'),
  departmentId: z.string().uuid().nullable().optional(),
  parentJobRoleId: z.string().uuid().nullable().optional(),
  permissionTier: z.enum(['STANDARD', 'SUPERVISOR']).optional(),
});

export class JobRoleController {
  /**
   * A new position (HR). Title, unit, optional department and supervising
   * position; duplicates of an existing title are refused (JobRoleService).
   */
  static async createJobRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createPositionSchema.parse(req.body);
      const jobRole = await JobRoleService.createPosition(data);
      await createAuditLog({
        actorUserId: req.user?.userId,
        action: 'JOB_ROLE_CREATED',
        entityType: 'JobRole',
        entityId: jobRole.id,
        metadata: { title: jobRole.title, code: jobRole.code, unitId: jobRole.unitId, permissionTier: jobRole.permissionTier },
      });
      res.status(201).json({ success: true, data: jobRole, message: 'Position created' });
    } catch (error) {
      next(error);
    }
  }

  static async getJobRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobRoles = await JobRoleService.getJobRoles();
      res.status(200).json({ success: true, data: jobRoles });
    } catch (error) {
      next(error);
    }
  }

  static async getJobRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const jobRole = await JobRoleService.getJobRoleById(id);
      if (!jobRole) {
        throw new AppError('This job role could not be found. It may have been removed.', 404);
      }
      res.status(200).json({ success: true, data: jobRole });
    } catch (error) {
      next(error);
    }
  }

  static async updateJobRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateJobRoleSchema.parse(req.body);
      await assertMayChangeRole(req, id, data.permissionTier);
      const updateData: any = { ...data };
      if (data.unitId) {
        updateData.unit = { connect: { id: data.unitId } };
        delete updateData.unitId;
      }
      const jobRole = await JobRoleService.updateJobRole(id, updateData);
      res.status(200).json({ success: true, data: jobRole });
    } catch (error) {
      next(error);
    }
  }

  static async deleteJobRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await assertMayChangeRole(req, id);
      await JobRoleService.deleteJobRole(id);
      res.status(200).json({ success: true, message: 'Job Role deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
