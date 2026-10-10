import { 
  PrismaClient, 
  SupervisorAssignmentSource, 
  SupervisorAssignmentStatus, 
  SupervisorPendingReason,
  HierarchyConfigurationStatus
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Top-level roles that need no immediate supervisor. This is the rule the
 * hierarchy scripts already applied to the HR Officer (ASSIGNED, no supervisor,
 * no source, no pending reason); it lives here so onboarding, edits, the preview
 * and override removal all apply it too. Sister is a top-level FULL role.
 */
export const NO_SUPERVISOR_REQUIRED_ROLE_CODES: readonly string[] = ['HR_OFFICER', 'SISTER'];

export interface ResolutionResult {
  supervisorId: string | null;
  assignmentSource: SupervisorAssignmentSource | null;
  assignmentStatus: SupervisorAssignmentStatus;
  pendingReason: SupervisorPendingReason | null;
  
  // Diagnostic fields
  requiredSupervisorRoleId?: string;
  candidateSupervisorIds?: string[];
  candidateCount?: number;
  diagnosticCode?: string;
  /** True for a top-level role that needs no supervisor (see NO_SUPERVISOR_REQUIRED_ROLE_CODES). */
  noSupervisorRequired?: boolean;
}

export class SupervisorResolverService {

  /**
   * Resolves the correct active supervisor for an employee based on the organizational 
   * hierarchy configuration of their job role, unit, and department.
   */
  async resolveForEmployee(targetEmployeeId: string, employeeJobRoleId: string): Promise<ResolutionResult> {
    const visitedRoleIds = new Set<string>();
    let currentRoleId: string | null = employeeJobRoleId;

    const returnPending = (reason: SupervisorPendingReason, diagCode: string, extras?: any): ResolutionResult => ({
      supervisorId: null,
      assignmentSource: null,
      assignmentStatus: SupervisorAssignmentStatus.PENDING,
      pendingReason: reason,
      diagnosticCode: diagCode,
      ...extras
    });

    // 0. A top-level role needs no supervisor: assigned, with nobody above it.
    //    No supervisor is invented to satisfy the hierarchy.
    const ownRole = await prisma.jobRole.findUnique({ where: { id: employeeJobRoleId }, select: { code: true } });
    if (ownRole && NO_SUPERVISOR_REQUIRED_ROLE_CODES.includes(ownRole.code)) {
      return {
        supervisorId: null,
        assignmentSource: null,
        assignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
        pendingReason: null,
        diagnosticCode: 'NO_SUPERVISOR_REQUIRED',
        noSupervisorRequired: true,
      };
    }

    const getEligibleSupervisors = async (jobRoleId: string): Promise<string[]> => {
      const candidates = await prisma.employee.findMany({
        where: {
          jobRoleId: jobRoleId,
          deletedAt: null, // Not archived
          employmentState: {
            notIn: ['RESIGNED', 'TERMINATED', 'RETIRED']
          },
          id: {
            not: targetEmployeeId // Cannot supervise self
          }
        },
        select: { id: true }
      });
      return candidates.map(c => c.id);
    };

    // 1. Traverse Job Roles (Parent Job Role fallback)
    while (currentRoleId) {
      if (visitedRoleIds.has(currentRoleId)) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'CYCLE_DETECTED_JOB_ROLE');
      }
      visitedRoleIds.add(currentRoleId);

      const role: any = await prisma.jobRole.findUnique({
        where: { id: currentRoleId },
        include: { department: true, unit: true }
      });

      if (!role) {
        return returnPending(SupervisorPendingReason.MISSING_PARENT_ROLE, 'JOB_ROLE_NOT_FOUND');
      }

      if (role.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'PENDING_CONFIRMATION_ROLE');
      }

      // We only check for supervisor fulfillment if we are NOT at the starting role,
      // OR if we are resolving for a role that acts as a head (but usually you don't supervise yourself).
      // Since targetEmployeeId is excluded in eligibility, it's safe to check.
      // However, we only resolve to a supervisor if isSupervisor = true.
      if (currentRoleId !== employeeJobRoleId && role.isSupervisor) {
        const candidateIds = await getEligibleSupervisors(role.id);
        
        if (candidateIds.length === 1) {
          return {
            supervisorId: candidateIds[0],
            assignmentSource: SupervisorAssignmentSource.AUTO_JOB_ROLE,
            assignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
            pendingReason: null,
            requiredSupervisorRoleId: role.id,
            candidateSupervisorIds: candidateIds,
            candidateCount: 1,
            diagnosticCode: 'RESOLVED_AUTO_JOB_ROLE'
          };
        }
        
        if (candidateIds.length > 1) {
          return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'MULTIPLE_SUPERVISOR_CANDIDATES', {
            requiredSupervisorRoleId: role.id,
            candidateSupervisorIds: candidateIds,
            candidateCount: candidateIds.length
          });
        }
        
        if (candidateIds.length === 0) {
          return returnPending(SupervisorPendingReason.NO_ACTIVE_SUPERVISOR, 'NO_ACTIVE_SUPERVISOR_CANDIDATE', {
            requiredSupervisorRoleId: role.id,
            candidateCount: 0
          });
        }
      }

      if (role.parentJobRoleId) {
        currentRoleId = role.parentJobRoleId;
      } else {
        // Stop Job Role traversal and proceed to Department/Unit fallback.
        break;
      }
    }

    // If we reach here, Job Role traversal exhausted without finding a supervisor.
    // We need to fetch the original role's department and unit to begin fallback.
    const originalRole = await prisma.jobRole.findUnique({
      where: { id: employeeJobRoleId },
      select: { departmentId: true, unitId: true }
    });

    if (!originalRole) {
       return returnPending(SupervisorPendingReason.MISSING_PARENT_ROLE, 'ORIGINAL_ROLE_NOT_FOUND');
    }

    // 2. Department Head Fallback
    if (originalRole.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: originalRole.departmentId },
        select: { headJobRoleId: true }
      });

      if (!department?.headJobRoleId) {
        return returnPending(SupervisorPendingReason.MISSING_HEAD_CONFIGURATION, 'MISSING_DEPARTMENT_HEAD');
      }

      const headRole = await prisma.jobRole.findUnique({ where: { id: department.headJobRoleId } });
      if (!headRole) {
        return returnPending(SupervisorPendingReason.MISSING_PARENT_ROLE, 'DEPARTMENT_HEAD_ROLE_NOT_FOUND');
      }

      if (headRole.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'PENDING_CONFIRMATION_DEPARTMENT_HEAD');
      }

      const candidateIds = await getEligibleSupervisors(headRole.id);

      if (candidateIds.length === 1) {
        return {
          supervisorId: candidateIds[0],
          assignmentSource: SupervisorAssignmentSource.AUTO_DEPARTMENT_HEAD,
          assignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
          pendingReason: null,
          requiredSupervisorRoleId: headRole.id,
          candidateSupervisorIds: candidateIds,
          candidateCount: 1,
          diagnosticCode: 'RESOLVED_AUTO_DEPARTMENT_HEAD'
        };
      }
      
      if (candidateIds.length > 1) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'MULTIPLE_DEPARTMENT_HEAD_CANDIDATES', {
          requiredSupervisorRoleId: headRole.id,
          candidateSupervisorIds: candidateIds,
          candidateCount: candidateIds.length
        });
      }

      if (candidateIds.length === 0) {
        return returnPending(SupervisorPendingReason.NO_ACTIVE_SUPERVISOR, 'NO_ACTIVE_DEPARTMENT_HEAD_CANDIDATE', {
          requiredSupervisorRoleId: headRole.id,
          candidateCount: 0
        });
      }
    }

    // 3. Unit Head Fallback
    if (!originalRole.unitId) {
      return returnPending(SupervisorPendingReason.MISSING_PARENT_ROLE, 'ORIGINAL_ROLE_HAS_NO_UNIT');
    }

    let currentUnitId: string | null = originalRole.unitId;
    const visitedUnitIds = new Set<string>();

    while (currentUnitId) {
      if (visitedUnitIds.has(currentUnitId)) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'CYCLE_DETECTED_UNIT');
      }
      visitedUnitIds.add(currentUnitId);

      const unit: any = await prisma.unit.findUnique({
        where: { id: currentUnitId },
        select: { headJobRoleId: true, parentUnitId: true }
      });

      if (!unit?.headJobRoleId) {
        return returnPending(SupervisorPendingReason.MISSING_HEAD_CONFIGURATION, 'MISSING_UNIT_HEAD');
      }

      const headRole = await prisma.jobRole.findUnique({ where: { id: unit.headJobRoleId } });
      
      if (!headRole) {
        return returnPending(SupervisorPendingReason.MISSING_PARENT_ROLE, 'UNIT_HEAD_ROLE_NOT_FOUND');
      }

      if (headRole.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'PENDING_CONFIRMATION_UNIT_HEAD');
      }

      const candidateIds = await getEligibleSupervisors(headRole.id);

      if (candidateIds.length === 1) {
        return {
          supervisorId: candidateIds[0],
          assignmentSource: SupervisorAssignmentSource.AUTO_UNIT_HEAD,
          assignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
          pendingReason: null,
          requiredSupervisorRoleId: headRole.id,
          candidateSupervisorIds: candidateIds,
          candidateCount: 1,
          diagnosticCode: 'RESOLVED_AUTO_UNIT_HEAD'
        };
      }
      
      if (candidateIds.length > 1) {
        return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'MULTIPLE_UNIT_HEAD_CANDIDATES', {
          requiredSupervisorRoleId: headRole.id,
          candidateSupervisorIds: candidateIds,
          candidateCount: candidateIds.length
        });
      }

      if (candidateIds.length === 0) {
        return returnPending(SupervisorPendingReason.NO_ACTIVE_SUPERVISOR, 'NO_ACTIVE_UNIT_HEAD_CANDIDATE', {
          requiredSupervisorRoleId: headRole.id,
          candidateCount: 0
        });
      }

      // If we are here, we somehow didn't return, which means candidate count was not handled?
      // Actually, all cases of lengths (1, >1, 0) are exhaustively handled above. 
      // We will only proceed if the code changes above. But just in case, we continue traversal:
      // Wait, if no active supervisor, it RETURNS! It does not continue to parent Unit Head!
      // The rules state: "Resolve exactly one eligible role holder. If no eligible employee exists, return PENDING with NO_ACTIVE_SUPERVISOR". 
      // It does NOT skip a missing active head to find a higher one.
      
      currentUnitId = unit.parentUnitId;
    }

    return returnPending(SupervisorPendingReason.UNCLEAR_HIERARCHY, 'EXHAUSTED_ALL_FALLBACKS');
  }

  /**
   * Generates a safe organizational path array of role titles for frontend display.
   */
  async getOrganizationalPath(jobRoleId: string, unitId?: string | null, departmentId?: string | null): Promise<string[]> {
    const path: string[] = [];
    const visitedRoleIds = new Set<string>();
    let currentRoleId: string | null = jobRoleId;

    // Phase 1: Traversal up the Job Role chain
    while (currentRoleId) {
      if (visitedRoleIds.has(currentRoleId)) break;
      visitedRoleIds.add(currentRoleId);

      const role: any = await prisma.jobRole.findUnique({
        where: { id: currentRoleId },
        select: { id: true, title: true, parentJobRoleId: true, hierarchyStatus: true }
      });

      if (!role) break;
      
      path.push(role.title);

      if (role.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) break;
      if (role.parentJobRoleId) {
        currentRoleId = role.parentJobRoleId;
      } else {
        break;
      }
    }

    // Phase 2 & 3: Department and Unit fallback
    const originalRole = await prisma.jobRole.findUnique({
      where: { id: jobRoleId },
      select: { departmentId: true, unitId: true }
    });

    // Use parameters if provided, else fallback to DB original role relationships
    const effectiveDeptId = departmentId !== undefined ? departmentId : originalRole?.departmentId;
    const effectiveUnitId = unitId !== undefined ? unitId : originalRole?.unitId;

    if (!currentRoleId && path.length > 0) { // If job role chain exhausted without finding anything else
      // Department
      if (effectiveDeptId) {
        const dept = await prisma.department.findUnique({ where: { id: effectiveDeptId }, select: { headJobRole: { select: { id: true, title: true, hierarchyStatus: true } } } });
        if (dept?.headJobRole && !visitedRoleIds.has(dept.headJobRole.id)) {
           path.push(dept.headJobRole.title);
           if (dept.headJobRole.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) return path;
        }
      }

      // Unit
      let currentUnitId: string | null = effectiveUnitId || null;
      const visitedUnitIds = new Set<string>();

      while (currentUnitId) {
        if (visitedUnitIds.has(currentUnitId)) break;
        visitedUnitIds.add(currentUnitId);

        const unit = await prisma.unit.findUnique({ where: { id: currentUnitId }, select: { parentUnitId: true, headJobRole: { select: { id: true, title: true, hierarchyStatus: true } } } });
        if (!unit) break;

        if (unit.headJobRole && !visitedRoleIds.has(unit.headJobRole.id)) {
           path.push(unit.headJobRole.title);
           visitedRoleIds.add(unit.headJobRole.id);
           if (unit.headJobRole.hierarchyStatus === HierarchyConfigurationStatus.PENDING_CONFIRMATION) break;
        }

        currentUnitId = unit.parentUnitId;
        // Limit depth
        if (path.length > 10) break;
      }
    }

    return path;
  }
}
