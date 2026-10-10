import { 
  PrismaClient, 
  SupervisorAssignmentSource, 
  SupervisorAssignmentStatus, 
  SupervisorPendingReason 
} from '@prisma/client';
import { SupervisorResolverService } from '../src/services/supervisor-resolver.service';

const prisma = new PrismaClient();
const resolver = new SupervisorResolverService();

async function main() {
  console.log('Starting Phase 4D: Existing Employee Supervisor Assignment Migration...\n');

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    include: {
      jobRole: true,
      supervisorLinks: {
        where: { isActive: true },
        select: { supervisorId: true }
      }
    }
  });

  const summary = {
    totalProcessed: 0,
    resolverAssigned: 0,
    resolverPending: 0,
    manualOverridesRetained: 0,
    pendingUnclearHierarchy: 0,
    pendingNoActiveSupervisor: 0,
    pendingMissingParentRole: 0,
    pendingMissingHeadConfiguration: 0,
    expectedParentRoleMissing: 0,
    multipleCandidates: 0,
    hierarchyCycles: 0,
    invalidManualOverrides: 0,
    matchesLegacyLink: 0,
    differsFromLegacyLink: 0,
    noLegacyLink: 0,
    multipleLegacyLinks: 0,
    failedRecords: 0,
    unchangedRecords: 0,
    successfullyUpdatedRecords: 0
  };

  const migrationId = `MIG-SUP-${Date.now()}`;

  for (const emp of employees) {
    summary.totalProcessed++;
    let hasFailed = false;

    try {
      let finalSupervisorId: string | null = null;
      let finalSource: SupervisorAssignmentSource | null = null;
      let finalStatus: SupervisorAssignmentStatus = SupervisorAssignmentStatus.PENDING;
      let finalPendingReason: SupervisorPendingReason | null = null;
      let isInvalidOverride = false;
      let overrideAuditMeta: any = null;

      // Check manual override
      if (emp.supervisorAssignmentSource === SupervisorAssignmentSource.MANUAL_OVERRIDE && emp.immediateSupervisorId) {
        const overrideSup = await prisma.employee.findUnique({
          where: { id: emp.immediateSupervisorId }
        });
        
        const isSelf = emp.id === emp.immediateSupervisorId;
        const isArchived = overrideSup?.deletedAt !== null;
        const isActive = overrideSup && ['ACTIVE', 'ON_LEAVE'].includes(overrideSup.employmentState);
        const isTerminated = overrideSup ? ['RESIGNED', 'TERMINATED', 'RETIRED'].includes(overrideSup.employmentState) : true;

        if (!overrideSup || isArchived || isTerminated || isSelf) {
          isInvalidOverride = true;
          summary.invalidManualOverrides++;
          
          overrideAuditMeta = {
            invalidatedOverrideSupervisorId: emp.immediateSupervisorId,
            invalidatedOverrideReason: emp.supervisorOverrideReason
          };

          // Invalid override: Clear and set pending
          finalSupervisorId = null;
          finalSource = null;
          finalStatus = SupervisorAssignmentStatus.PENDING;
          finalPendingReason = SupervisorPendingReason.UNCLEAR_HIERARCHY;
        } else {
          // Keep manual override
          summary.manualOverridesRetained++;
          finalSupervisorId = emp.immediateSupervisorId;
          finalSource = SupervisorAssignmentSource.MANUAL_OVERRIDE;
          finalStatus = SupervisorAssignmentStatus.OVERRIDDEN;
          finalPendingReason = null;
        }
      }

      // If not manual override, or override was invalid, run automatic resolution
      if (!finalSource && emp.jobRoleId) {
        const result = await resolver.resolveForEmployee(emp.id, emp.jobRoleId);

        // Check Expected Parent Role Missing vs Top Level Role
        let isExpectedParentMissing = false;
        if (result.assignmentStatus === SupervisorAssignmentStatus.PENDING && 
            result.pendingReason === SupervisorPendingReason.MISSING_PARENT_ROLE && 
            emp.jobRole?.isHead && 
            !emp.jobRole?.parentJobRoleId) {
            
            // As per rules, if it is Asst Admin missing Administrator, it's EXPECTED_PARENT_ROLE_MISSING.
            isExpectedParentMissing = true;
            summary.expectedParentRoleMissing++;
        }

        finalSupervisorId = result.supervisorId;
        finalSource = result.assignmentSource;
        finalStatus = result.assignmentStatus;
        finalPendingReason = result.pendingReason;

        // Categorize pending reasons for summary
        if (result.assignmentStatus === SupervisorAssignmentStatus.PENDING && !isExpectedParentMissing && !isInvalidOverride) {
          if (result.pendingReason === SupervisorPendingReason.UNCLEAR_HIERARCHY) summary.pendingUnclearHierarchy++;
          if (result.pendingReason === SupervisorPendingReason.NO_ACTIVE_SUPERVISOR) summary.pendingNoActiveSupervisor++;
          if (result.pendingReason === SupervisorPendingReason.MISSING_PARENT_ROLE) summary.pendingMissingParentRole++;
          if (result.pendingReason === SupervisorPendingReason.MISSING_HEAD_CONFIGURATION) summary.pendingMissingHeadConfiguration++;
          
          if (result.diagnosticCode === 'MULTIPLE_SUPERVISOR_CANDIDATES' || 
              result.diagnosticCode === 'MULTIPLE_DEPARTMENT_HEAD_CANDIDATES' || 
              result.diagnosticCode === 'MULTIPLE_UNIT_HEAD_CANDIDATES') {
            summary.multipleCandidates++;
          }
          if (result.diagnosticCode === 'CYCLE_DETECTED_JOB_ROLE' || result.diagnosticCode === 'CYCLE_DETECTED_UNIT') {
            summary.hierarchyCycles++;
          }
        } else if (result.assignmentStatus === SupervisorAssignmentStatus.ASSIGNED) {
          summary.resolverAssigned++;
        }
      } else if (!finalSource && !emp.jobRoleId) {
        finalStatus = SupervisorAssignmentStatus.PENDING;
        finalPendingReason = SupervisorPendingReason.MISSING_PARENT_ROLE;
        summary.pendingMissingParentRole++;
      }

      if (finalStatus === SupervisorAssignmentStatus.PENDING) {
        summary.resolverPending++;
      }

      // Compare with legacy SupervisionLink
      const legacyLinks = emp.supervisorLinks || [];
      let legacyComparison = 'NO_LEGACY_LINK';
      if (legacyLinks.length === 0) {
        summary.noLegacyLink++;
      } else if (legacyLinks.length === 1) {
        if (legacyLinks[0].supervisorId === finalSupervisorId) {
          legacyComparison = 'MATCHES_LEGACY_LINK';
          summary.matchesLegacyLink++;
        } else {
          legacyComparison = 'DIFFERS_FROM_LEGACY_LINK';
          summary.differsFromLegacyLink++;
        }
      } else {
        legacyComparison = 'MULTIPLE_LEGACY_LINKS';
        summary.multipleLegacyLinks++;
      }

      // Detect if changes are needed
      const hasChanged = 
        emp.immediateSupervisorId !== finalSupervisorId ||
        emp.supervisorAssignmentSource !== finalSource ||
        emp.supervisorAssignmentStatus !== finalStatus ||
        emp.supervisorPendingReason !== finalPendingReason;

      if (!hasChanged) {
        summary.unchangedRecords++;
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.employee.update({
            where: { id: emp.id },
            data: {
              immediateSupervisorId: finalSupervisorId,
              supervisorAssignmentSource: finalSource,
              supervisorAssignmentStatus: finalStatus,
              supervisorPendingReason: finalPendingReason
            }
          });

          await tx.auditLog.create({
            data: {
              action: 'SUPERVISOR_ASSIGNMENT_MIGRATED',
              actorUserId: null, 
              targetEmployeeId: emp.id,
              entityType: 'EMPLOYEE',
              entityId: emp.id,
              metadata: JSON.parse(JSON.stringify({
                migrationId,
                previousSupervisorId: emp.immediateSupervisorId,
                newSupervisorId: finalSupervisorId,
                previousAssignmentSource: emp.supervisorAssignmentSource,
                newAssignmentSource: finalSource,
                previousAssignmentStatus: emp.supervisorAssignmentStatus,
                newAssignmentStatus: finalStatus,
                pendingReason: finalPendingReason,
                legacyComparison,
                ...(overrideAuditMeta || {})
              }))
            }
          });
        });
        summary.successfullyUpdatedRecords++;
      }

    } catch (error) {
      console.error(`Failed to process employee ${emp.employeeNumber}:`, error);
      summary.failedRecords++;
      hasFailed = true;
    }
  }

  console.log('--- MIGRATION SUMMARY ---');
  console.table(summary);
  console.log('\nMigration script execution completed safely.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
