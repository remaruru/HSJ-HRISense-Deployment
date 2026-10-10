import { PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../middleware/errorHandler';
import { OrgHierarchyService } from '../../org-hierarchy.service';

/**
 * Who is asking — resolved on the server for every request.
 *
 * The ONLY input is the authenticated user id from the verified access token.
 * Role, tier, employee id, permissions and direct reports are then re-read from
 * the database, so:
 *   • nothing the browser sends (a body field, a header, a query string, a
 *     sentence in the chat) can change them;
 *   • a demotion or deactivation takes effect on the next question, not when
 *     the token expires.
 */
export interface AiActor {
  userId: string;
  employeeId: string;
  tier: PermissionTier;
  roleCode: string;
  roleTitle: string;
  unitName: string | null;
  firstName: string;
  displayName: string;
  /** `module.action.scope` strings granted to the job role (FULL has all). */
  permissions: string[];
  /**
   * Employees whose `immediateSupervisorId` is this person. This is the team.
   * Colleagues in the same unit are NOT included.
   */
  directReportIds: string[];
}

export async function resolveAiActor(userId: string): Promise<AiActor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      deletedAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
          unit: { select: { name: true } },
          jobRole: { select: { id: true, code: true, title: true, permissionTier: true } },
        },
      },
    },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw new AppError('Your account is not active.', 403);
  }
  const employee = user.employee;
  if (!employee || employee.deletedAt || !employee.jobRole) {
    throw new AppError('Your account is not linked to an active employee record, so AI Assistance cannot determine what you may see.', 403);
  }

  const tier = employee.jobRole.permissionTier;
  const [rolePermissions, directReportIds] = await Promise.all([
    tier === PermissionTier.FULL
      ? Promise.resolve([] as Array<{ permission: { module: string; action: string; scope: string | null } }>)
      : prisma.rolePermission.findMany({
          where: { jobRoleId: employee.jobRole.id },
          select: { permission: { select: { module: true, action: true, scope: true } } },
        }),
    OrgHierarchyService.getDirectSubordinateIds(employee.id),
  ]);

  return {
    userId: user.id,
    employeeId: employee.id,
    tier,
    roleCode: employee.jobRole.code,
    roleTitle: employee.jobRole.title,
    unitName: employee.unit?.name ?? null,
    firstName: employee.firstName,
    displayName: `${employee.firstName} ${employee.lastName}`.trim(),
    permissions:
      tier === PermissionTier.FULL
        ? ['*']
        : rolePermissions.map((rp) => [rp.permission.module, rp.permission.action, rp.permission.scope].filter(Boolean).join('.')),
    directReportIds,
  };
}

export const TIER_LABEL: Record<PermissionTier, string> = {
  FULL: 'HR',
  SUPERVISOR: 'Supervisor',
  STANDARD: 'Employee',
};

/**
 * The assistant's person-level access rule.
 *
 *   HR (FULL)    → anyone
 *   Supervisor   → themselves and their direct reports (immediateSupervisorId)
 *   Employee     → themselves only
 *
 * The same rule as the profile API (OrgHierarchyService.canAccessEmployeeRecord):
 * a supervisor's scope is the direct team, never a coordinator's staff below it.
 */
export function canAccessEmployee(actor: AiActor, employeeId: string): boolean {
  if (!employeeId) return false;
  if (actor.tier === PermissionTier.FULL) return true;
  if (employeeId === actor.employeeId) return true;
  if (actor.tier === PermissionTier.SUPERVISOR) return actor.directReportIds.includes(employeeId);
  return false;
}

export const isHr = (actor: AiActor): boolean => actor.tier === PermissionTier.FULL;
export const isSupervisor = (actor: AiActor): boolean => actor.tier === PermissionTier.SUPERVISOR;
