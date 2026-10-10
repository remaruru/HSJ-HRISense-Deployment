import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { prisma } from '../config/prisma';
import { PermissionTier } from '@prisma/client';

/**
 * authorize() — two usage modes:
 *
 * 1. Tier whitelist (simple): authorize(['FULL']) or authorize(['FULL', 'SUPERVISOR'])
 *    → Allows only users whose permissionTier is in the array.
 *
 * 2. Granular permission check: authorize('employee', 'read')
 *    → FULL users pass immediately; others are checked against RolePermission table.
 */
export const authorize = (
  moduleOrTiers: string | PermissionTier[],
  action?: string
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('Please sign in to continue.', 401, undefined, 'UNAUTHENTICATED');
      }

      // ── Mode 1: tier whitelist ─────────────────────────────────────────────
      if (Array.isArray(moduleOrTiers)) {
        const allowed = moduleOrTiers as string[];
        if (!allowed.includes(user.permissionTier)) {
          throw new AppError("You don't have permission to do that. If you need access, contact HR.", 403, undefined, 'FORBIDDEN');
        }
        return next();
      }

      // ── Mode 2: granular module/action check ──────────────────────────────
      const module = moduleOrTiers;

      // HR Officer / Full Tier has ALL permissions
      if (user.permissionTier === PermissionTier.FULL) {
        return next();
      }

      // Look up permissions linked to the user's JobRole
      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          jobRole: { code: user.roleCode },
          permission: { module, action },
        },
        include: { permission: true },
      });

      if (!rolePermission) {
        throw new AppError("You don't have permission to do that. If you need access, contact HR.", 403, undefined, 'FORBIDDEN');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
