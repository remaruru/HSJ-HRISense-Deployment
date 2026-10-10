import { PermissionTier, JobApplicationStatus, RecruitmentCommunicationType } from '@prisma/client';

export interface RecruitmentPolicyContext {
  userId: string;
  permissionTier: PermissionTier;
  employee?: {
    id: string;
    department?: {
      code: string;
      name: string;
    } | null;
    unit?: {
      code: string;
      name: string;
    } | null;
    jobRole?: {
      code: string;
      title: string;
    } | null;
  } | null;
}

/**
 * Job roles that hold final HR authority in recruitment. Hospicio confirmed that
 * a Sister has the same HRISense authority as HR, so SISTER is listed with the
 * HR Officer here — the one place this authority is decided.
 */
export const FINAL_HR_AUTHORITY_ROLE_CODES: readonly string[] = ['HR_OFFICER', 'SISTER'];

export class RecruitmentPolicy {
  /**
   * Resolves whether the user holds the final HR hiring authority (HR Officer,
   * or Sister — see FINAL_HR_AUTHORITY_ROLE_CODES). Role code first.
   */
  static isHrOfficer(context: RecruitmentPolicyContext): boolean {
    // 1. Stable role code
    const roleCode = context.employee?.jobRole?.code;
    if (roleCode && FINAL_HR_AUTHORITY_ROLE_CODES.includes(roleCode)) {
      return true;
    }
    // 4. Normalized role name fallback (documented risk: easily changed in UI)
    if (context.employee?.jobRole?.title.toUpperCase() === 'HR OFFICER') {
      return true;
    }
    return false;
  }

  /**
   * Resolves whether the user is HR support staff (HR Assistant or HR Staff).
   */
  static isHrStaff(context: RecruitmentPolicyContext): boolean {
    const roleCode = context.employee?.jobRole?.code;
    if (roleCode === 'HR_ASSISTANT' || roleCode === 'HR_STAFF') {
      return true;
    }
    
    const roleTitle = context.employee?.jobRole?.title.toUpperCase();
    if (roleTitle === 'HR ASSISTANT' || roleTitle === 'HR STAFF') {
      return true;
    }
    return false;
  }

  /**
   * ── Authority model ─────────────────────────────────────────────────────────
   * HR Officer,
   * Sister      → final recruitment authority (publish, hire, reject, sensitive
   *               applicant emails, conversion to onboarding).
   * HR Staff /
   * HR Assistant→ screening and administrative work only.
   *
   * IMPORTANT: `permissionTier === FULL` grants MODULE ACCESS, never HR Officer
   * authority. Both HR_OFFICER and HR_ASSISTANT are seeded as FULL, so ORing the
   * tier into every check (as the previous implementation did) collapsed the two
   * roles and erased the distinction entirely.
   */

  /** Module access — any HR role, or any FULL-tier user for technical access. */
  static canViewRecruitment(context: RecruitmentPolicyContext): boolean {
    if (this.isHrOfficer(context) || this.isHrStaff(context)) return true;
    return context.permissionTier === PermissionTier.FULL;
  }

  /** Drafting and editing openings is ordinary administrative work. */
  static canManageJobOpenings(context: RecruitmentPolicyContext): boolean {
    return this.canViewRecruitment(context);
  }

  /** Publishing an opening to the public careers page is HR Officer authority. */
  static canPublishJobOpening(context: RecruitmentPolicyContext): boolean {
    return this.isHrOfficer(context);
  }

  /** Screening applicants is ordinary administrative work. */
  static canReviewApplications(context: RecruitmentPolicyContext): boolean {
    return this.canViewRecruitment(context);
  }

  static canScheduleInterview(context: RecruitmentPolicyContext): boolean {
    return this.canReviewApplications(context);
  }

  /** HIRED and REJECTED are final decisions — HR Officer only. */
  static canUpdateStatus(context: RecruitmentPolicyContext, targetStatus: JobApplicationStatus): boolean {
    if (!this.canReviewApplications(context)) return false;

    const finalStatuses: JobApplicationStatus[] = [
      JobApplicationStatus.HIRED,
      JobApplicationStatus.REJECTED,
    ];

    if (finalStatuses.includes(targetStatus)) {
      return this.isHrOfficer(context);
    }

    return true; // Staff may move applicants through the screening stages.
  }

  /** Acceptance, rejection and free-text messages are HR Officer only. */
  static canSendEmail(context: RecruitmentPolicyContext, communicationType: RecruitmentCommunicationType): boolean {
    if (!this.canReviewApplications(context)) return false;

    const restrictedTypes: RecruitmentCommunicationType[] = [
      RecruitmentCommunicationType.APPLICATION_ACCEPTED,
      RecruitmentCommunicationType.APPLICATION_NOT_SELECTED,
      RecruitmentCommunicationType.CUSTOM_MESSAGE,
    ];

    if (restrictedTypes.includes(communicationType)) {
      return this.isHrOfficer(context);
    }

    return true; // Staff may send administrative/process emails.
  }

  static canMarkHired(context: RecruitmentPolicyContext): boolean {
    return this.isHrOfficer(context);
  }

  static canConvertToOnboarding(context: RecruitmentPolicyContext): boolean {
    return this.isHrOfficer(context);
  }

  /**
   * Capability summary for the frontend, so the UI can hide controls the caller
   * genuinely cannot use instead of letting them fail with a 403.
   */
  static describeCapabilities(context: RecruitmentPolicyContext) {
    return {
      isHrOfficer: this.isHrOfficer(context),
      isHrStaff: this.isHrStaff(context),
      canView: this.canViewRecruitment(context),
      canManageOpenings: this.canManageJobOpenings(context),
      canPublishOpening: this.canPublishJobOpening(context),
      canReviewApplications: this.canReviewApplications(context),
      canScheduleInterview: this.canScheduleInterview(context),
      canMarkHired: this.canMarkHired(context),
      canConvertToOnboarding: this.canConvertToOnboarding(context),
    };
  }
}
