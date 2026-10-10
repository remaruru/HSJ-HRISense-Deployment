/**
 * fix_org_hierarchy.ts
 *
 * Safe, idempotent script to:
 *   Phase A — Update JobRole parentJobRoleId + hierarchyStatus to match
 *             the confirmed Hospicio de San Jose organizational hierarchy.
 *   Phase B — Re-run automatic supervisor assignment for all active employees
 *             who do NOT have a valid MANUAL_OVERRIDE.
 *
 * Rules:
 *   • MANUAL_OVERRIDE assignments that are still valid are PRESERVED.
 *   • Exactly one eligible supervisor → ASSIGNED (AUTO_JOB_ROLE).
 *   • Zero eligible supervisors → PENDING (NO_ACTIVE_SUPERVISOR).
 *   • Multiple eligible supervisors → PENDING (UNCLEAR_HIERARCHY). No arbitrary pick.
 *   • HR Officer only → NO SUPERVISOR REQUIRED (supervisorAssignmentSource = null, status = ASSIGNED, supervisorId = null).
 *   • Top unit roles (Head, Coordinator, Supervisor) with no confirmed higher role → PENDING.
 *   • Self-supervision is blocked.
 *   • Circular supervision is detected before writing.
 *   • Audit logs are created for changed assignments.
 *   • Does NOT delete employees, job roles, units, or departments.
 *   • Does NOT change credentials, names, or personal data.
 *   • Does NOT run prisma db push or migrations.
 */

import 'dotenv/config';
import { NO_SUPERVISOR_REQUIRED_ROLE_CODES } from '../services/supervisor-resolver.service';
import { PrismaClient, SupervisorAssignmentSource, SupervisorAssignmentStatus, SupervisorPendingReason } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Confirmed Parent-Role Mappings ─────────────────────────────────────────
// child code → parent code (null = top role in its branch)
const ROLE_PARENT_MAP: Record<string, string | null> = {
  // Human Resource Department
  HR_OFFICER:           null,   // Top HR role — NO_SUPERVISOR_REQUIRED
  HR_ASSISTANT:         'HR_OFFICER',

  // Organisation-wide
  SISTER:               null,   // Top-level FULL role — NO_SUPERVISOR_REQUIRED

  // Administrative Services
  ASST_ADMIN:           null,   // Top ADM role — UNASSIGNED above
  ADMIN_SEC:            'ASST_ADMIN',
  RECEPTIONIST:         'ASST_ADMIN',

  // Finance — no confirmed supervisor role for any Finance employee
  ACCOUNTING_STAFF:     null,
  PMO_STAFF:            null,
  LIAISON_OFFICER:      null,
  STOCKROOM_STAFF:      null,

  // General Support Services
  KITCHEN_SUPERVISOR:   null,
  KITCHEN_STAFF:        'KITCHEN_SUPERVISOR',
  LAUNDRY_STAFF:        'KITCHEN_SUPERVISOR',
  JANITORIAL_SUPERVISOR: null,
  JANITORIAL_STAFF:     'JANITORIAL_SUPERVISOR',
  DRIVER:               'JANITORIAL_SUPERVISOR',
  MAINTENANCE_SUPERVISOR: null,
  MAINTENANCE_STAFF:    'MAINTENANCE_SUPERVISOR',

  // Auxiliary Services
  IGP_COORDINATOR:      null,
  CANTEEN_STAFF:        'IGP_COORDINATOR',
  BAKERY_STAFF:         'IGP_COORDINATOR',
  DORMITORY_STAFF:      'IGP_COORDINATOR',

  // Social Services
  HEAD_SSD:             null,
  SOCIAL_WORKER:        'HEAD_SSD',
  PSYCHOLOGIST:         'HEAD_SSD',
  ECCD_TEACHER:         'HEAD_SSD',
  PT_PSYCHOLOGIST:      'HEAD_SSD',

  // Pastoral Care / Homelife Services
  HEAD_PCH:             null,
  CHAPEL_STAFF:         'HEAD_PCH',
  CY_COORDINATOR:       'HEAD_PCH',
  PSN_COORDINATOR:      'HEAD_PCH',
  OP_COORDINATOR:       'HEAD_PCH',
  CIP_COORDINATOR:      'HEAD_PCH',
  PRE_SCHOOL_STAFF:     'CY_COORDINATOR',
  ST_MARY_STAFF:        'CY_COORDINATOR',
  ST_JOSEPH_STAFF:      'CY_COORDINATOR',
  RENDU_A_STAFF:        'PSN_COORDINATOR',
  RENDU_B_STAFF:        'PSN_COORDINATOR',
  RENDU_C_STAFF:        'PSN_COORDINATOR',
  STA_LUISA_STAFF:      'OP_COORDINATOR',
  ST_VINCENT_STAFF:     'OP_COORDINATOR',
  TAHAN_CENTER_STAFF:   'CIP_COORDINATOR',
  SANCTUARY_CENTER_STAFF: 'CIP_COORDINATOR',
  SIGLIV_BOYS_STAFF:    'CIP_COORDINATOR',

  // Health Services
  CLINIC_STAFF:         null,
  PT_COORDINATOR:       'CLINIC_STAFF',
  PT_STAFF:             'PT_COORDINATOR',
};

// Roles that are supervisory parent nodes (used in resolver)
const SUPERVISOR_ROLES = new Set([
  'HR_OFFICER', 'ASST_ADMIN', 'KITCHEN_SUPERVISOR', 'JANITORIAL_SUPERVISOR',
  'MAINTENANCE_SUPERVISOR', 'IGP_COORDINATOR', 'HEAD_SSD', 'HEAD_PCH',
  'CY_COORDINATOR', 'PSN_COORDINATOR', 'OP_COORDINATOR', 'CIP_COORDINATOR',
  'CLINIC_STAFF', 'PT_COORDINATOR',
]);

// Roles with NO_SUPERVISOR_REQUIRED status — the resolver's own list.
const NO_SUPERVISOR_REQUIRED_ROLES = NO_SUPERVISOR_REQUIRED_ROLE_CODES;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[fix_org_hierarchy] ${msg}`);
}

async function detectCircle(
  empId: string,
  proposedSupervisorId: string,
  allSupervisorMap: Map<string, string | null>
): Promise<boolean> {
  const visited = new Set<string>();
  let current: string | null = proposedSupervisorId;
  while (current) {
    if (current === empId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = allSupervisorMap.get(current) ?? null;
  }
  return false;
}

// ─── Phase A: Update Job Role Hierarchy ─────────────────────────────────────

async function phaseA_updateJobRoleHierarchy() {
  log('=== PHASE A: Job Role Hierarchy Update ===');

  const allRoles = await prisma.jobRole.findMany({
    select: { id: true, code: true, title: true, parentJobRoleId: true, hierarchyStatus: true, isSupervisor: true }
  });

  const roleByCode = new Map(allRoles.map(r => [r.code, r]));

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  log(`Found ${allRoles.length} job roles. Applying ${Object.keys(ROLE_PARENT_MAP).length} hierarchy mappings...`);

  for (const [childCode, parentCode] of Object.entries(ROLE_PARENT_MAP)) {
    const childRole = roleByCode.get(childCode);
    if (!childRole) {
      log(`  [MISSING] Role code '${childCode}' not found in DB — skipping`);
      missing++;
      continue;
    }

    let newParentId: string | null = null;
    if (parentCode !== null) {
      const parentRole = roleByCode.get(parentCode);
      if (!parentRole) {
        log(`  [MISSING PARENT] Parent code '${parentCode}' for '${childCode}' not found — skipping`);
        missing++;
        continue;
      }
      newParentId = parentRole.id;
    }

    const newIsSupervisor = SUPERVISOR_ROLES.has(childCode);

    // Check if update is needed
    const currentParentId = childRole.parentJobRoleId;
    const currentStatus = childRole.hierarchyStatus;
    const currentIsSupervisor = childRole.isSupervisor;
    const needsUpdate =
      currentParentId !== newParentId ||
      currentStatus !== 'CONFIRMED' ||
      currentIsSupervisor !== newIsSupervisor;

    if (!needsUpdate) {
      log(`  [UNCHANGED] ${childCode} → ${parentCode ?? 'null'}`);
      skipped++;
      continue;
    }

    await prisma.jobRole.update({
      where: { code: childCode },
      data: {
        parentJobRoleId: newParentId,
        hierarchyStatus: 'CONFIRMED',
        isSupervisor: newIsSupervisor,
        // isHead: true for confirmed top roles (null parent + CONFIRMED)
        isHead: parentCode === null && [
          'HR_OFFICER', 'ASST_ADMIN', 'HEAD_SSD', 'HEAD_PCH', 'CLINIC_STAFF'
        ].includes(childCode),
      }
    });
    log(`  [UPDATED] ${childCode} → parent: ${parentCode ?? 'null'} | isSupervisor: ${newIsSupervisor}`);
    updated++;
  }

  log(`Phase A complete. Updated: ${updated}, Unchanged: ${skipped}, Missing: ${missing}`);
  return { updated, skipped, missing };
}

// ─── Phase B: Automatic Employee Supervisor Assignment ───────────────────────

async function phaseB_assignSupervisors() {
  log('\n=== PHASE B: Employee Supervisor Assignment ===');

  // Load all active employees
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      jobRoleId: true,
      immediateSupervisorId: true,
      supervisorAssignmentSource: true,
      supervisorAssignmentStatus: true,
      supervisorPendingReason: true,
      supervisorOverrideReason: true,
      supervisorOverrideById: true,
      supervisorOverrideAt: true,
      employmentState: true,
      jobRole: { select: { code: true, title: true, parentJobRoleId: true } }
    }
  });

  log(`Processing ${employees.length} active employees...`);

  // Reload updated roles (after Phase A)
  const allRoles = await prisma.jobRole.findMany({
    select: { id: true, code: true, title: true, parentJobRoleId: true, isSupervisor: true, hierarchyStatus: true }
  });
  const roleById = new Map(allRoles.map(r => [r.id, r]));
  const roleByCode = new Map(allRoles.map(r => [r.code, r]));

  // Build current supervisor map for circular detection
  const supervisorMap = new Map<string, string | null>(
    employees.map(e => [e.id, e.immediateSupervisorId ?? null])
  );

  // Eligible active employees by job role ID
  async function getEligibleSupervisors(parentJobRoleId: string, excludeId: string): Promise<string[]> {
    const candidates = await prisma.employee.findMany({
      where: {
        jobRoleId: parentJobRoleId,
        deletedAt: null,
        employmentState: { notIn: ['RESIGNED', 'TERMINATED', 'RETIRED'] },
        id: { not: excludeId }
      },
      select: { id: true }
    });
    return candidates.map(c => c.id);
  }

  const summary = {
    totalProcessed: 0,
    noSupervisorRequired: 0,
    assigned: 0,
    preserved: 0,
    pendingNoSupervisor: 0,
    pendingMultiple: 0,
    pendingMissingParent: 0,
    pendingTopRole: 0,
    unchanged: 0,
    failed: 0,
    auditCreated: 0,
    conflicts: [] as { employeeNumber: string; name: string; role: string; candidateCount: number; parentRoleCode: string }[]
  };

  for (const emp of employees) {
    summary.totalProcessed++;
    const empName = `${emp.firstName} ${emp.lastName}`;

    try {
      // ── 1. Preserve valid MANUAL_OVERRIDE ─────────────────────────────────
      if (
        emp.supervisorAssignmentSource === SupervisorAssignmentSource.MANUAL_OVERRIDE &&
        emp.immediateSupervisorId
      ) {
        const overrideSup = await prisma.employee.findUnique({
          where: { id: emp.immediateSupervisorId },
          select: { id: true, deletedAt: true, employmentState: true }
        });

        const isSelf = emp.id === emp.immediateSupervisorId;
        const isValid = overrideSup &&
          !overrideSup.deletedAt &&
          !['RESIGNED', 'TERMINATED', 'RETIRED'].includes(overrideSup.employmentState) &&
          !isSelf;

        if (isValid) {
          log(`  [PRESERVED] ${emp.employeeNumber} ${empName} — MANUAL_OVERRIDE retained`);
          summary.preserved++;
          continue;
        } else {
          log(`  [INVALID_OVERRIDE] ${emp.employeeNumber} ${empName} — override supervisor invalid, will re-resolve`);
        }
      }

      // ── 2. NO_SUPERVISOR_REQUIRED for HR Officer only ──────────────────────
      const roleCode = emp.jobRole?.code;
      if (roleCode && NO_SUPERVISOR_REQUIRED_ROLES.includes(roleCode)) {
        const noChange =
          emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.ASSIGNED &&
          emp.immediateSupervisorId === null &&
          emp.supervisorAssignmentSource === null;

        if (!noChange) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: {
              immediateSupervisorId: null,
              supervisorAssignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
              supervisorAssignmentSource: null,
              supervisorPendingReason: null,
            }
          });
          log(`  [NO_SUP_REQUIRED] ${emp.employeeNumber} ${empName} (${roleCode}) — set ASSIGNED/null`);
          await createAuditEntry(emp, null, null, 'NO_SUPERVISOR_REQUIRED', `${roleCode} is a top-level role with no required supervisor`);
          summary.auditCreated++;
          summary.noSupervisorRequired++;
        } else {
          summary.noSupervisorRequired++;
        }
        continue;
      }

      // ── 3. Find parent role via parentJobRoleId ────────────────────────────
      const myRole = emp.jobRoleId ? roleById.get(emp.jobRoleId) : null;
      const parentRoleId = myRole?.parentJobRoleId ?? null;

      if (!parentRoleId) {
        // Top role in its branch — PENDING (no confirmed higher supervisor)
        const noChange =
          emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.PENDING &&
          emp.immediateSupervisorId === null &&
          emp.supervisorPendingReason === SupervisorPendingReason.MISSING_PARENT_ROLE;

        if (!noChange) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: {
              immediateSupervisorId: null,
              supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
              supervisorAssignmentSource: null,
              supervisorPendingReason: SupervisorPendingReason.MISSING_PARENT_ROLE,
            }
          });
          log(`  [TOP_ROLE/PENDING] ${emp.employeeNumber} ${empName} (${roleCode}) — no confirmed parent role`);
          summary.auditCreated++;
          await createAuditEntry(emp, emp.immediateSupervisorId, null, 'PENDING_TOP_ROLE', `${roleCode} has no confirmed parent role`);
        }
        summary.pendingTopRole++;
        continue;
      }

      // ── 4. Find eligible supervisors in parent role ────────────────────────
      const candidates = await getEligibleSupervisors(parentRoleId, emp.id);
      const parentRole = roleById.get(parentRoleId);
      const parentRoleCode = parentRole?.code ?? parentRoleId;

      if (candidates.length === 0) {
        // No eligible supervisor
        const noChange =
          emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.PENDING &&
          emp.immediateSupervisorId === null &&
          emp.supervisorPendingReason === SupervisorPendingReason.NO_ACTIVE_SUPERVISOR;

        if (!noChange) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: {
              immediateSupervisorId: null,
              supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
              supervisorAssignmentSource: null,
              supervisorPendingReason: SupervisorPendingReason.NO_ACTIVE_SUPERVISOR,
            }
          });
          log(`  [PENDING/NO_SUP] ${emp.employeeNumber} ${empName} — no active ${parentRoleCode}`);
          summary.auditCreated++;
          await createAuditEntry(emp, emp.immediateSupervisorId, null, 'PENDING_NO_SUPERVISOR', `No active employee holds ${parentRoleCode}`);
        }
        summary.pendingNoSupervisor++;
        continue;
      }

      if (candidates.length > 1) {
        // Multiple eligible supervisors — do not pick arbitrarily
        const noChange =
          emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.PENDING &&
          emp.immediateSupervisorId === null &&
          emp.supervisorPendingReason === SupervisorPendingReason.UNCLEAR_HIERARCHY;

        if (!noChange) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: {
              immediateSupervisorId: null,
              supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
              supervisorAssignmentSource: null,
              supervisorPendingReason: SupervisorPendingReason.UNCLEAR_HIERARCHY,
            }
          });
          log(`  [PENDING/MULTIPLE] ${emp.employeeNumber} ${empName} — ${candidates.length} candidates for ${parentRoleCode}`);
          summary.auditCreated++;
          await createAuditEntry(emp, emp.immediateSupervisorId, null, 'PENDING_MULTIPLE_CANDIDATES', `${candidates.length} candidates hold ${parentRoleCode}`);
        }
        summary.pendingMultiple++;
        summary.conflicts.push({
          employeeNumber: emp.employeeNumber,
          name: empName,
          role: roleCode ?? '',
          candidateCount: candidates.length,
          parentRoleCode,
        });
        continue;
      }

      // ── 5. Exactly one candidate ───────────────────────────────────────────
      const newSupervisorId = candidates[0];

      // Self-supervision check
      if (newSupervisorId === emp.id) {
        log(`  [SELF_SUPERVISION_BLOCKED] ${emp.employeeNumber} ${empName}`);
        summary.failed++;
        continue;
      }

      // Circular supervision check
      const wouldCycle = await detectCircle(emp.id, newSupervisorId, supervisorMap);
      if (wouldCycle) {
        log(`  [CYCLE_BLOCKED] ${emp.employeeNumber} ${empName} — circular chain detected, leaving PENDING`);
        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            immediateSupervisorId: null,
            supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
            supervisorAssignmentSource: null,
            supervisorPendingReason: SupervisorPendingReason.UNCLEAR_HIERARCHY,
          }
        });
        summary.failed++;
        continue;
      }

      // Unchanged check
      const noChange =
        emp.immediateSupervisorId === newSupervisorId &&
        emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.ASSIGNED &&
        emp.supervisorAssignmentSource === SupervisorAssignmentSource.AUTO_JOB_ROLE &&
        emp.supervisorPendingReason === null;

      if (noChange) {
        log(`  [UNCHANGED] ${emp.employeeNumber} ${empName} — already correctly assigned`);
        summary.unchanged++;
        continue;
      }

      const prevSupervisorId = emp.immediateSupervisorId;
      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          immediateSupervisorId: newSupervisorId,
          supervisorAssignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
          supervisorAssignmentSource: SupervisorAssignmentSource.AUTO_JOB_ROLE,
          supervisorPendingReason: null,
        }
      });
      supervisorMap.set(emp.id, newSupervisorId);

      log(`  [ASSIGNED] ${emp.employeeNumber} ${empName} → supervisor ${newSupervisorId} (role: ${parentRoleCode})`);
      await createAuditEntry(emp, prevSupervisorId, newSupervisorId, 'AUTO_ASSIGNED', `Auto-assigned to ${parentRoleCode} holder`);
      summary.auditCreated++;
      summary.assigned++;

    } catch (err: any) {
      log(`  [ERROR] ${emp.employeeNumber} ${empName}: ${err.message}`);
      summary.failed++;
    }
  }

  return summary;
}

// ─── Audit Entry Helper (script context — no userId) ─────────────────────────

async function createAuditEntry(
  emp: { id: string; employeeNumber: string },
  oldSupervisorId: string | null | undefined,
  newSupervisorId: string | null,
  action: string,
  reason: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: null, // system script
        targetEmployeeId: emp.id,
        action: 'FIX_SUPERVISOR_ASSIGNMENT',
        entityType: 'Employee',
        entityId: emp.id,
        metadata: { scriptAction: action, reason },
        oldValue: { immediateSupervisorId: oldSupervisorId ?? null },
        newValue: { immediateSupervisorId: newSupervisorId },
      }
    });
  } catch {
    // Non-fatal: audit failure does not block assignment
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting fix_org_hierarchy — HRISense Org Chart Hierarchy Correction');
  log('================================================================');

  try {
    const phaseAResult = await phaseA_updateJobRoleHierarchy();
    const phaseBResult = await phaseB_assignSupervisors();

    log('\n================================================================');
    log('FINAL SUMMARY');
    log('================================================================');
    log(`Job Role mappings updated:        ${phaseAResult.updated}`);
    log(`Job Role mappings unchanged:      ${phaseAResult.skipped}`);
    log(`Job Role codes not found in DB:   ${phaseAResult.missing}`);
    log('');
    log(`Employees processed:              ${phaseBResult.totalProcessed}`);
    log(`  → NO_SUPERVISOR_REQUIRED (HR):  ${phaseBResult.noSupervisorRequired}`);
    log(`  → Automatically ASSIGNED:       ${phaseBResult.assigned}`);
    log(`  → Manual override PRESERVED:    ${phaseBResult.preserved}`);
    log(`  → PENDING (no active sup):      ${phaseBResult.pendingNoSupervisor}`);
    log(`  → PENDING (multiple sups):      ${phaseBResult.pendingMultiple}`);
    log(`  → PENDING (top role, no parent):${phaseBResult.pendingTopRole}`);
    log(`  → Unchanged (already correct):  ${phaseBResult.unchanged}`);
    log(`  → Failed/Error:                 ${phaseBResult.failed}`);
    log(`Audit records created:            ${phaseBResult.auditCreated}`);

    if (phaseBResult.conflicts.length > 0) {
      log('\n--- Multiple Eligible Supervisor Conflicts (HR must assign manually) ---');
      phaseBResult.conflicts.forEach(c => {
        log(`  ${c.employeeNumber} ${c.name} [${c.role}] → ${c.candidateCount} candidates for ${c.parentRoleCode}`);
      });
    }

    log('\nfix_org_hierarchy completed successfully.');
  } catch (err: any) {
    log(`FATAL ERROR: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
