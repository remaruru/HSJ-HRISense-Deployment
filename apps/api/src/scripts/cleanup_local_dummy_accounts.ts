/**
 * cleanup_local_dummy_accounts.ts
 *
 * LOCAL DEVELOPMENT DATA CLEANUP ONLY
 *
 * Purpose: Soft-archive HSJ dummy personal-name accounts, keeping only
 *          role-based DEV accounts active. Runs safe supervisor re-resolution
 *          after cleanup so the active hierarchy is clean and fully resolved.
 *
 * Phases:
 *   A — Safety guards: refuse to run in production
 *   B — Dry summary: print what will change before touching anything
 *   C — Fix DEV display names (e.g. "Psychologist Psychologist" → "Psychologist")
 *   D — Reassign any active subordinates pointing to HSJ supervisor accounts
 *   E — Soft-archive HSJ employee records (set deletedAt, deactivate User)
 *   F — Re-run automatic supervisor resolution for all active DEV employees
 *   G — Final summary report
 *
 * Safety:
 *   • Idempotent — safe to re-run
 *   • Never hard-deletes any record
 *   • Never touches DEV accounts negatively
 *   • Never modifies credentials, job roles, units, or org structure
 *   • Blocks self-supervision and circular chains
 *   • Audit log entries created for every change
 */

import 'dotenv/config';
import { NO_SUPERVISOR_REQUIRED_ROLE_CODES } from '../services/supervisor-resolver.service';
import {
  PrismaClient,
  SupervisorAssignmentSource,
  SupervisorAssignmentStatus,
  SupervisorPendingReason,
} from '@prisma/client';

// ─── Safety Guard ─────────────────────────────────────────────────────────────

const nodeEnv = process.env.NODE_ENV || 'development';
const isLocalAllowed = process.env.ALLOW_LOCAL_CLEANUP === 'true' || nodeEnv !== 'production';

if (!isLocalAllowed) {
  console.error('\n[BLOCKED] This script is LOCAL DEVELOPMENT DATA CLEANUP ONLY.');
  console.error('[BLOCKED] NODE_ENV is set to production. Aborting.');
  process.exit(1);
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('  LOCAL DEVELOPMENT DATA CLEANUP ONLY');
console.log('  cleanup_local_dummy_accounts.ts');
console.log('════════════════════════════════════════════════════════════\n');

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_PREFIX = 'DEV-';
const HSJ_PREFIX = 'HSJ-';
const AUDIT_REASON = 'LOCAL_DEVELOPMENT_DUMMY_CLEANUP';
const SCRIPT_ACTOR = 'cleanup_local_dummy_accounts.ts';

// DEV display-name corrections: employeeNumber → correct firstName/lastName
const DISPLAY_NAME_CORRECTIONS: Record<string, { firstName: string; lastName: string }> = {
  // "Psychologist Psychologist" → "Psychologist"
  'DEV-SOC-003': { firstName: 'Psychologist', lastName: '' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[cleanup] ${msg}`);
}

async function createAudit(
  targetEmployeeId: string | null,
  entityId: string | null,
  action: string,
  oldValue: any,
  newValue: any,
  metadata: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: null,
        targetEmployeeId,
        action,
        entityType: 'Employee',
        entityId: entityId ?? targetEmployeeId ?? undefined,
        metadata: { reason: AUDIT_REASON, script: SCRIPT_ACTOR, ...metadata },
        oldValue,
        newValue,
      },
    });
  } catch {
    // Non-fatal — do not block main flow
  }
}

async function detectCircle(
  empId: string,
  proposedSupervisorId: string,
  supervisorMap: Map<string, string | null>
): Promise<boolean> {
  const visited = new Set<string>();
  let current: string | null = proposedSupervisorId;
  while (current) {
    if (current === empId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = supervisorMap.get(current) ?? null;
  }
  return false;
}

// ─── Phase B: Dry Summary ────────────────────────────────────────────────────

async function dryRunSummary(
  hsjEmployees: any[],
  devEmployees: any[],
  allActiveEmployees: any[]
) {
  log('=== DRY-RUN SUMMARY (no changes yet) ===');
  log(`Total active (non-archived) employees: ${allActiveEmployees.length}`);
  log(`  DEV accounts (will be preserved): ${devEmployees.length}`);
  log(`  HSJ accounts (will be archived): ${hsjEmployees.length}`);

  if (hsjEmployees.length === 0) {
    log('  No HSJ accounts found — nothing to archive.');
  } else {
    log('\n  HSJ accounts to archive:');
    hsjEmployees.forEach((e) => {
      const hasUser = e.user ? `linked user: ${e.user.email}` : 'no linked user';
      const directReports = e.directReports?.length ?? 0;
      const isSup = e.immediateSupervisorId ? `reports to: ${e.immediateSupervisorId.slice(0,8)}...` : 'no supervisor';
      log(`    ${e.employeeNumber} "${e.firstName} ${e.lastName}" [${e.jobRole?.title}] — ${hasUser}, ${directReports} direct reports, ${isSup}`);
    });
  }

  // Name corrections
  const corrections = Object.keys(DISPLAY_NAME_CORRECTIONS).filter((empNo) =>
    devEmployees.some((e) => e.employeeNumber === empNo)
  );
  if (corrections.length > 0) {
    log(`\n  Display-name corrections:`);
    corrections.forEach((empNo) => {
      const emp = devEmployees.find((e) => e.employeeNumber === empNo);
      const fix = DISPLAY_NAME_CORRECTIONS[empNo];
      if (emp) {
        const current = `${emp.firstName} ${emp.lastName}`.trim();
        const target = `${fix.firstName} ${fix.lastName}`.trim();
        log(`    ${empNo}: "${current}" → "${target}"`);
      }
    });
  }

  log('\n────────────────────────────────────────────────────────────\n');
}

// ─── Phase C: Fix DEV Display Names ──────────────────────────────────────────

async function fixDevDisplayNames(devEmployees: any[]): Promise<number> {
  log('=== PHASE C: Fix DEV Display Names ===');
  let fixed = 0;
  for (const [empNo, correction] of Object.entries(DISPLAY_NAME_CORRECTIONS)) {
    const emp = devEmployees.find((e) => e.employeeNumber === empNo);
    if (!emp) {
      log(`  [SKIP] ${empNo} not found in active DEV accounts`);
      continue;
    }
    const currentFirst = emp.firstName;
    const currentLast = emp.lastName;
    if (currentFirst === correction.firstName && currentLast === correction.lastName) {
      log(`  [UNCHANGED] ${empNo} already has correct name`);
      continue;
    }
    await prisma.employee.update({
      where: { id: emp.id },
      data: { firstName: correction.firstName, lastName: correction.lastName },
    });
    log(`  [FIXED] ${empNo}: "${currentFirst} ${currentLast}" → "${correction.firstName} ${correction.lastName}"`);
    await createAudit(emp.id, emp.id, 'FIX_DISPLAY_NAME', { firstName: currentFirst, lastName: currentLast }, correction, {
      employeeNumber: empNo,
    });
    fixed++;
  }
  log(`Phase C complete. Names fixed: ${fixed}\n`);
  return fixed;
}

// ─── Phase D: Reassign Subordinates of HSJ Accounts ─────────────────────────

async function reassignSubordinates(
  hsjEmployees: any[],
  allActive: any[],
  supervisorMap: Map<string, string | null>
): Promise<{ reassigned: number; lefPending: number }> {
  log('=== PHASE D: Reassign Subordinates of HSJ Accounts ===');
  let reassigned = 0;
  let leftPending = 0;

  for (const hsjEmp of hsjEmployees) {
    // Find active employees who currently report to this HSJ account
    const subordinates = allActive.filter(
      (e) =>
        e.immediateSupervisorId === hsjEmp.id &&
        (e.supervisorAssignmentStatus === 'ASSIGNED' || e.supervisorAssignmentStatus === 'OVERRIDDEN')
    );

    if (subordinates.length === 0) {
      log(`  [NO_SUBS] ${hsjEmp.employeeNumber} has no active subordinates to reassign`);
      continue;
    }

    log(`  Processing ${subordinates.length} subordinate(s) of ${hsjEmp.employeeNumber} [${hsjEmp.jobRole?.title}]`);

    // Find the DEV replacement supervisor (same jobRoleId, not archived, not the HSJ account itself)
    const hsjJobRoleId = hsjEmp.jobRoleId;
    const devReplacement = allActive.find(
      (e) =>
        e.jobRoleId === hsjJobRoleId &&
        e.employeeNumber.startsWith(DEV_PREFIX) &&
        !e.deletedAt &&
        e.employmentState !== 'RESIGNED' &&
        e.employmentState !== 'TERMINATED' &&
        e.employmentState !== 'RETIRED'
    );

    for (const sub of subordinates) {
      if (!devReplacement) {
        // No DEV supervisor with the same role — leave pending
        await prisma.employee.update({
          where: { id: sub.id },
          data: {
            immediateSupervisorId: null,
            supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
            supervisorAssignmentSource: null,
            supervisorPendingReason: SupervisorPendingReason.NO_ACTIVE_SUPERVISOR,
          },
        });
        log(`  [PENDING] ${sub.employeeNumber} ${sub.firstName} ${sub.lastName} — no DEV replacement for ${hsjEmp.jobRole?.title}`);
        await createAudit(sub.id, sub.id, 'SUPERVISOR_UNSET_BEFORE_ARCHIVE', {
          immediateSupervisorId: hsjEmp.id,
          source: sub.supervisorAssignmentSource,
          status: sub.supervisorAssignmentStatus,
        }, { immediateSupervisorId: null, status: 'PENDING', reason: 'NO_ACTIVE_SUPERVISOR' }, {
          hsjAccountArchived: hsjEmp.employeeNumber,
        });
        supervisorMap.set(sub.id, null);
        leftPending++;
        continue;
      }

      // Self-supervision check
      if (devReplacement.id === sub.id) {
        log(`  [SELF_BLOCK] ${sub.employeeNumber} — would self-supervise via ${devReplacement.employeeNumber}, leaving PENDING`);
        await prisma.employee.update({
          where: { id: sub.id },
          data: {
            immediateSupervisorId: null,
            supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
            supervisorAssignmentSource: null,
            supervisorPendingReason: SupervisorPendingReason.UNCLEAR_HIERARCHY,
          },
        });
        supervisorMap.set(sub.id, null);
        leftPending++;
        continue;
      }

      // Circular check
      const wouldCycle = await detectCircle(sub.id, devReplacement.id, supervisorMap);
      if (wouldCycle) {
        log(`  [CYCLE_BLOCK] ${sub.employeeNumber} — circular chain detected via ${devReplacement.employeeNumber}, leaving PENDING`);
        await prisma.employee.update({
          where: { id: sub.id },
          data: {
            immediateSupervisorId: null,
            supervisorAssignmentStatus: SupervisorAssignmentStatus.PENDING,
            supervisorAssignmentSource: null,
            supervisorPendingReason: SupervisorPendingReason.UNCLEAR_HIERARCHY,
          },
        });
        supervisorMap.set(sub.id, null);
        leftPending++;
        continue;
      }

      // Perform reassignment
      const prevSupervisorId = sub.immediateSupervisorId;
      const source =
        sub.supervisorAssignmentSource === 'MANUAL_OVERRIDE'
          ? SupervisorAssignmentSource.MANUAL_OVERRIDE
          : SupervisorAssignmentSource.AUTO_JOB_ROLE;

      await prisma.employee.update({
        where: { id: sub.id },
        data: {
          immediateSupervisorId: devReplacement.id,
          supervisorAssignmentStatus: SupervisorAssignmentStatus.ASSIGNED,
          supervisorAssignmentSource: source,
          supervisorPendingReason: null,
        },
      });
      supervisorMap.set(sub.id, devReplacement.id);

      log(`  [REASSIGNED] ${sub.employeeNumber} ${sub.firstName} ${sub.lastName} → ${devReplacement.employeeNumber} [${devReplacement.jobRole?.title}]`);
      await createAudit(sub.id, sub.id, 'SUPERVISOR_REASSIGNED_BEFORE_ARCHIVE', {
        immediateSupervisorId: prevSupervisorId,
        source: sub.supervisorAssignmentSource,
      }, { immediateSupervisorId: devReplacement.id, source, status: 'ASSIGNED' }, {
        oldSupervisorHsj: hsjEmp.employeeNumber,
        newSupervisorDev: devReplacement.employeeNumber,
      });
      reassigned++;
    }
  }

  log(`Phase D complete. Reassigned: ${reassigned}, Left pending: ${leftPending}\n`);
  return { reassigned, lefPending: leftPending };
}

// ─── Phase E: Archive HSJ Accounts ───────────────────────────────────────────

async function archiveHsjAccounts(hsjEmployees: any[]): Promise<{ archived: number; usersDeactivated: number }> {
  log('=== PHASE E: Archive HSJ Accounts ===');
  let archived = 0;
  let usersDeactivated = 0;
  const now = new Date();

  for (const emp of hsjEmployees) {
    // Skip already archived
    if (emp.deletedAt) {
      log(`  [SKIP] ${emp.employeeNumber} already archived (deletedAt: ${emp.deletedAt.toISOString()})`);
      continue;
    }

    // Soft-archive the employee
    await prisma.employee.update({
      where: { id: emp.id },
      data: { deletedAt: now },
    });
    log(`  [ARCHIVED] ${emp.employeeNumber} "${emp.firstName} ${emp.lastName}" → deletedAt set`);

    await createAudit(emp.id, emp.id, 'HSJ_EMPLOYEE_ARCHIVED', {
      deletedAt: null,
      isActive: emp.user?.isActive,
    }, { deletedAt: now.toISOString() }, {
      employeeNumber: emp.employeeNumber,
      jobRole: emp.jobRole?.title,
      unit: emp.unit?.name,
    });
    archived++;

    // Deactivate linked user account
    if (emp.user) {
      if (!emp.user.isActive && emp.user.deletedAt) {
        log(`  [SKIP_USER] User for ${emp.employeeNumber} already deactivated`);
      } else {
        await prisma.user.update({
          where: { id: emp.user.id },
          data: { isActive: false, deletedAt: now },
        });
        log(`  [USER_DEACTIVATED] ${emp.user.email} (linked to ${emp.employeeNumber})`);
        await createAudit(emp.id, emp.user.id, 'HSJ_USER_DEACTIVATED', {
          isActive: emp.user.isActive,
        }, { isActive: false, deletedAt: now.toISOString() }, {
          email: emp.user.email,
          employeeNumber: emp.employeeNumber,
        });
        usersDeactivated++;
      }
    }

    // Revoke active sessions
    if (emp.user) {
      await prisma.userSession.updateMany({
        where: { userId: emp.user.id, isRevoked: false },
        data: { isRevoked: true },
      });
    }
  }

  log(`Phase E complete. Archived: ${archived}, Users deactivated: ${usersDeactivated}\n`);
  return { archived, usersDeactivated };
}

// ─── Phase F: Re-run Supervisor Resolution for Active DEV Accounts ────────────

async function rerunSupervisorResolution(): Promise<{
  noSupervisorRequired: number;
  assigned: number;
  pendingNoSupervisor: number;
  pendingMultiple: number;
  pendingTopRole: number;
  preserved: number;
  unchanged: number;
  auditCreated: number;
}> {
  log('=== PHASE F: Supervisor Resolution for Active DEV Accounts ===');

  // Reload active employees (HSJ now archived)
  const activeEmployees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true,
      jobRoleId: true, immediateSupervisorId: true,
      supervisorAssignmentSource: true,
      supervisorAssignmentStatus: true,
      supervisorPendingReason: true,
      employmentState: true,
      jobRole: {
        select: {
          code: true, title: true, parentJobRoleId: true
        }
      },
    },
  });

  const allRoles = await prisma.jobRole.findMany({
    select: { id: true, code: true, title: true, parentJobRoleId: true, isSupervisor: true }
  });
  const roleById = new Map(allRoles.map(r => [r.id, r]));

  const supervisorMap = new Map<string, string | null>(
    activeEmployees.map(e => [e.id, e.immediateSupervisorId ?? null])
  );

  async function getEligibleSupervisors(parentJobRoleId: string, excludeId: string): Promise<string[]> {
    const candidates = await prisma.employee.findMany({
      where: {
        jobRoleId: parentJobRoleId,
        deletedAt: null,
        employmentState: { notIn: ['RESIGNED', 'TERMINATED', 'RETIRED'] },
        id: { not: excludeId },
      },
      select: { id: true },
    });
    return candidates.map(c => c.id);
  }

  const summary = {
    noSupervisorRequired: 0,
    assigned: 0,
    pendingNoSupervisor: 0,
    pendingMultiple: 0,
    pendingTopRole: 0,
    preserved: 0,
    unchanged: 0,
    auditCreated: 0,
  };

  for (const emp of activeEmployees) {
    const empName = `${emp.firstName} ${emp.lastName}`.trim();
    const roleCode = emp.jobRole?.code;

    try {
      // 1. Preserve valid MANUAL_OVERRIDE
      if (
        emp.supervisorAssignmentSource === SupervisorAssignmentSource.MANUAL_OVERRIDE &&
        emp.immediateSupervisorId
      ) {
        const overrideSup = await prisma.employee.findUnique({
          where: { id: emp.immediateSupervisorId },
          select: { id: true, deletedAt: true, employmentState: true },
        });
        const isValid =
          overrideSup &&
          !overrideSup.deletedAt &&
          !['RESIGNED', 'TERMINATED', 'RETIRED'].includes(overrideSup.employmentState) &&
          emp.id !== emp.immediateSupervisorId;

        if (isValid) {
          log(`  [PRESERVED] ${emp.employeeNumber} ${empName} — valid MANUAL_OVERRIDE`);
          summary.preserved++;
          continue;
        } else {
          log(`  [INVALID_OVERRIDE] ${emp.employeeNumber} ${empName} — override supervisor archived/invalid, re-resolving`);
        }
      }

      // 2. Top-level roles (HR Officer, Sister): NO_SUPERVISOR_REQUIRED
      if (roleCode && NO_SUPERVISOR_REQUIRED_ROLE_CODES.includes(roleCode)) {
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
            },
          });
          await createAudit(emp.id, emp.id, 'AUTO_SUPERVISOR_RESOLUTION', {
            immediateSupervisorId: emp.immediateSupervisorId,
            status: emp.supervisorAssignmentStatus,
          }, { immediateSupervisorId: null, status: 'ASSIGNED', note: `${roleCode}_NO_SUPERVISOR_REQUIRED` }, {
            employeeNumber: emp.employeeNumber,
          });
          summary.auditCreated++;
        }
        summary.noSupervisorRequired++;
        continue;
      }

      // 3. Find parent role
      const myRole = emp.jobRoleId ? roleById.get(emp.jobRoleId) : null;
      const parentRoleId = myRole?.parentJobRoleId ?? null;

      if (!parentRoleId) {
        // Top role — PENDING (no confirmed parent)
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
            },
          });
          await createAudit(emp.id, emp.id, 'AUTO_SUPERVISOR_RESOLUTION', {
            immediateSupervisorId: emp.immediateSupervisorId,
            status: emp.supervisorAssignmentStatus,
          }, { immediateSupervisorId: null, status: 'PENDING', reason: 'MISSING_PARENT_ROLE' }, {
            employeeNumber: emp.employeeNumber,
          });
          summary.auditCreated++;
        }
        summary.pendingTopRole++;
        continue;
      }

      // 4. Find eligible supervisors
      const candidates = await getEligibleSupervisors(parentRoleId, emp.id);
      const parentRole = roleById.get(parentRoleId);
      const parentRoleCode = parentRole?.code ?? parentRoleId;

      if (candidates.length === 0) {
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
            },
          });
          summary.auditCreated++;
        }
        log(`  [PENDING/NO_SUP] ${emp.employeeNumber} ${empName} — no active ${parentRoleCode}`);
        summary.pendingNoSupervisor++;
        continue;
      }

      if (candidates.length > 1) {
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
            },
          });
          summary.auditCreated++;
        }
        log(`  [PENDING/MULTIPLE] ${emp.employeeNumber} ${empName} — ${candidates.length} candidates for ${parentRoleCode}`);
        summary.pendingMultiple++;
        continue;
      }

      // 5. Exactly one candidate
      const newSupervisorId = candidates[0];

      if (newSupervisorId === emp.id) {
        log(`  [SELF_BLOCK] ${emp.employeeNumber} — self-supervision blocked`);
        summary.pendingNoSupervisor++;
        continue;
      }

      const wouldCycle = await detectCircle(emp.id, newSupervisorId, supervisorMap);
      if (wouldCycle) {
        log(`  [CYCLE_BLOCK] ${emp.employeeNumber} — circular chain, leaving PENDING`);
        summary.pendingNoSupervisor++;
        continue;
      }

      const noChange =
        emp.immediateSupervisorId === newSupervisorId &&
        emp.supervisorAssignmentStatus === SupervisorAssignmentStatus.ASSIGNED &&
        emp.supervisorAssignmentSource === SupervisorAssignmentSource.AUTO_JOB_ROLE &&
        emp.supervisorPendingReason === null;

      if (noChange) {
        log(`  [UNCHANGED] ${emp.employeeNumber} ${empName}`);
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
        },
      });
      supervisorMap.set(emp.id, newSupervisorId);

      log(`  [ASSIGNED] ${emp.employeeNumber} ${empName} → ${newSupervisorId.slice(0,8)}... (role: ${parentRoleCode})`);
      await createAudit(emp.id, emp.id, 'AUTO_SUPERVISOR_RESOLUTION', {
        immediateSupervisorId: prevSupervisorId,
        status: emp.supervisorAssignmentStatus,
      }, { immediateSupervisorId: newSupervisorId, status: 'ASSIGNED', source: 'AUTO_JOB_ROLE' }, {
        employeeNumber: emp.employeeNumber,
        parentRoleCode,
      });
      summary.auditCreated++;
      summary.assigned++;

    } catch (err: any) {
      log(`  [ERROR] ${emp.employeeNumber} ${empName}: ${err.message}`);
    }
  }

  log(`Phase F complete.`);
  return summary;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    // ── Load all employees ────────────────────────────────────────────────────
    const allEmployees = await prisma.employee.findMany({
      select: {
        id: true, employeeNumber: true, firstName: true, lastName: true,
        jobRoleId: true, immediateSupervisorId: true,
        supervisorAssignmentSource: true, supervisorAssignmentStatus: true,
        supervisorPendingReason: true, deletedAt: true, employmentState: true,
        jobRole: { select: { id: true, code: true, title: true, parentJobRoleId: true } },
        unit: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, email: true, isActive: true, deletedAt: true } },
        directReports: { select: { id: true, employeeNumber: true } },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    const hsjEmployees = allEmployees.filter(
      (e) => e.employeeNumber.startsWith(HSJ_PREFIX) && !e.deletedAt
    );
    const hsjEmployeesAlreadyArchived = allEmployees.filter(
      (e) => e.employeeNumber.startsWith(HSJ_PREFIX) && e.deletedAt
    );
    const devEmployees = allEmployees.filter(
      (e) => e.employeeNumber.startsWith(DEV_PREFIX) && !e.deletedAt
    );
    const allActive = allEmployees.filter((e) => !e.deletedAt);

    // Build supervisorMap for cycle detection
    const supervisorMap = new Map<string, string | null>(
      allActive.map((e) => [e.id, e.immediateSupervisorId ?? null])
    );

    // Phase B: Dry summary
    await dryRunSummary(hsjEmployees, devEmployees, allActive);

    if (hsjEmployees.length === 0 && Object.keys(DISPLAY_NAME_CORRECTIONS).length === 0) {
      log('Nothing to do. All HSJ accounts already archived, no name corrections needed.');
      return;
    }

    // Phase C: Fix display names
    const nameFixed = await fixDevDisplayNames(devEmployees);

    // Phase D: Reassign subordinates
    const { reassigned, lefPending } = await reassignSubordinates(hsjEmployees, allActive, supervisorMap);

    // Phase E: Archive HSJ accounts
    const { archived, usersDeactivated } = await archiveHsjAccounts(hsjEmployees);

    // Phase F: Re-run supervisor resolution
    const resolutionSummary = await rerunSupervisorResolution();

    // ── Final Report ─────────────────────────────────────────────────────────
    log('\n════════════════════════════════════════════════════════════');
    log('  FINAL SUMMARY');
    log('════════════════════════════════════════════════════════════');
    log(`DEV accounts preserved (active):      ${devEmployees.length}`);
    log(`HSJ dummy employees archived:         ${archived}`);
    log(`HSJ accounts already archived before: ${hsjEmployeesAlreadyArchived.length}`);
    log(`HSJ user accounts deactivated:        ${usersDeactivated}`);
    log(`Display names corrected:              ${nameFixed}`);
    log(`Subordinates reassigned to DEV:       ${reassigned}`);
    log(`Subordinates left pending:            ${lefPending}`);
    log('');
    log('Supervisor resolution (post-cleanup):');
    log(`  → NO_SUPERVISOR_REQUIRED (HR):      ${resolutionSummary.noSupervisorRequired}`);
    log(`  → Automatically ASSIGNED:           ${resolutionSummary.assigned}`);
    log(`  → Manual overrides PRESERVED:       ${resolutionSummary.preserved}`);
    log(`  → PENDING (no active sup):          ${resolutionSummary.pendingNoSupervisor}`);
    log(`  → PENDING (multiple sup):           ${resolutionSummary.pendingMultiple}`);
    log(`  → PENDING (top role):               ${resolutionSummary.pendingTopRole}`);
    log(`  → Unchanged (already correct):      ${resolutionSummary.unchanged}`);
    log(`Audit records created:                ${resolutionSummary.auditCreated}`);
    log('');
    log('Active account summary by Unit (active DEV only):');

    const byUnit = new Map<string, number>();
    devEmployees.forEach((e) => {
      const unitName = e.unit?.name ?? 'Unknown';
      byUnit.set(unitName, (byUnit.get(unitName) ?? 0) + 1);
    });
    [...byUnit.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([unit, count]) => {
      log(`  ${unit}: ${count} active DEV account(s)`);
    });
    log('════════════════════════════════════════════════════════════\n');

    log('Local HRISense development accounts simplified. Role-based DEV accounts remain active, HSJ dummy personal-name records were safely archived, duplicate supervisory-role conflicts were removed from the active test hierarchy, and all records remain recoverable. Manual verification will be performed by the user.');
  } catch (err: any) {
    log(`FATAL ERROR: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
