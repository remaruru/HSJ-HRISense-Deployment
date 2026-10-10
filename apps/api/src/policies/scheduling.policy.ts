import { PermissionTier } from '@prisma/client';

export interface SchedulingPolicyContext {
  userId: string;
  permissionTier: PermissionTier;
  employee?: {
    id: string;
    jobRole?: {
      code: string;
      title: string;
    } | null;
  } | null;
}

export class SchedulingPolicy {
  /**
   * Resolves whether the user holds the HR authority to manage organization schedules.
   */
  static isHrSchedulingAuthorized(context: SchedulingPolicyContext): boolean {
    // 1. Stable role codes
    const roleCode = context.employee?.jobRole?.code;
    if (roleCode === 'HR_OFFICER' || roleCode === 'HR_ASSISTANT' || roleCode === 'HR_STAFF') {
      return true;
    }

    // 2. Normalized role name fallback
    const roleTitle = context.employee?.jobRole?.title?.toUpperCase();
    if (roleTitle === 'HR OFFICER' || roleTitle === 'HR ASSISTANT' || roleTitle === 'HR STAFF') {
      return true;
    }

    // 3. Technical Admin Fallback (Preserving HRISense pattern)
    if (context.permissionTier === PermissionTier.FULL) {
      return true;
    }

    return false;
  }

  static canManageOrganizationCalendar(context: SchedulingPolicyContext): boolean {
    return this.isHrSchedulingAuthorized(context);
  }

  static canManageScheduleTemplates(context: SchedulingPolicyContext): boolean {
    return this.isHrSchedulingAuthorized(context);
  }

  static canAssignOrganizationSchedules(context: SchedulingPolicyContext): boolean {
    return this.isHrSchedulingAuthorized(context);
  }
}
