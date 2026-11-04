import { prisma } from '../config/prisma';
import { PermissionTier } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

/**
 * Canonical supervisor / subordinate resolution for HRISense.
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 * HRISense previously had TWO supervisor mechanisms:
 *   • `Employee.immediateSupervisorId` — written by the live application
 *     (onboarding, org changes, manual override) and read by the dashboard,
 *     org chart and search.
 *   • `SupervisionLink` — a join table written ONLY by `prisma/seed.ts` and read
 *     by attendance, leave, schedules, compliance, evaluations and documents.
 *
 * Because nothing in the running application ever wrote `SupervisionLink`, a
 * supervisor whose reports were assigned through the UI had an empty team in
 * half the system while looking correct in the other half.
 *
 * `Employee.immediateSupervisorId` is the canonical source. Every module now
 * resolves subordinates through this service. `SupervisionLink` is retained as a
 * legacy/historical table but no runtime authorization depends on it.
 */
export class OrgHierarchyService {
  /** Direct reports of a supervisor (active, non-archived employees only). */
  static async getDirectSubordinateIds(supervisorEmployeeId: string): Promise<string[]> {
    if (!supervisorEmployeeId) return [];
    const rows = await prisma.employee.findMany({
      where: {
        immediateSupervisorId: supervisorEmployeeId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * The standard operational scope for a supervisor: themselves plus their direct
   * reports. Used by attendance, leave, schedules, documents and compliance.
   */
  static async getTeamScopeIds(supervisorEmployeeId: string): Promise<string[]> {
    const subordinates = await OrgHierarchyService.getDirectSubordinateIds(supervisorEmployeeId);
    return [supervisorEmployeeId, ...subordinates];
  }

  /** True when `employeeId` reports directly to `supervisorEmployeeId`. */
  static async isDirectSubordinate(
    supervisorEmployeeId: string,
    employeeId: string
  ): Promise<boolean> {
    if (!supervisorEmployeeId || !employeeId) return false;
    const match = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        immediateSupervisorId: supervisorEmployeeId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!match;
  }

  /**
   * Everyone below a supervisor, transitively. Not an access scope: a
   * supervisor's reach is their DIRECT reports only (`getTeamScopeIds`). A
   * coordinator's team belongs to that coordinator, not to the head above them.
   */
  static async getSubordinateTreeIds(supervisorEmployeeId: string): Promise<string[]> {
    if (!supervisorEmployeeId) return [];

    const all = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, immediateSupervisorId: true },
    });

    const childrenBySupervisor = new Map<string, string[]>();
    for (const emp of all) {
      if (!emp.immediateSupervisorId) continue;
      const bucket = childrenBySupervisor.get(emp.immediateSupervisorId) ?? [];
      bucket.push(emp.id);
      childrenBySupervisor.set(emp.immediateSupervisorId, bucket);
    }

    const collected = new Set<string>();
    const queue = [supervisorEmployeeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const child of childrenBySupervisor.get(current) ?? []) {
        if (collected.has(child)) continue; // cycle guard
        collected.add(child);
        queue.push(child);
      }
    }

    return Array.from(collected);
  }

  /** True when `employeeId` sits anywhere below `supervisorEmployeeId`. */
  static async isInSubordinateTree(
    supervisorEmployeeId: string,
    employeeId: string
  ): Promise<boolean> {
    if (!supervisorEmployeeId || !employeeId) return false;
    if (supervisorEmployeeId === employeeId) return false;
    const tree = await OrgHierarchyService.getSubordinateTreeIds(supervisorEmployeeId);
    return tree.includes(employeeId);
  }

  /** The chain of supervisors above an employee, nearest first. */
  static async getSupervisorChainIds(employeeId: string): Promise<string[]> {
    if (!employeeId) return [];

    const all = await prisma.employee.findMany({
      select: { id: true, immediateSupervisorId: true },
    });
    const supervisorOf = new Map(all.map((e) => [e.id, e.immediateSupervisorId]));

    const chain: string[] = [];
    const seen = new Set<string>([employeeId]);
    let current = supervisorOf.get(employeeId) ?? null;
    while (current && !seen.has(current)) {
      chain.push(current);
      seen.add(current);
      current = supervisorOf.get(current) ?? null;
    }
    return chain;
  }

  /**
   * Central object-level access decision for a single employee record.
   *
   * FULL       → any employee
   * SUPERVISOR → self + their DIRECT reports (active, not archived) — the same
   *              team every other module uses (`getTeamScopeIds`). It used to be
   *              the whole branch, so a head could open the records of a
   *              coordinator's staff.
   * STANDARD   → self only
   *
   * Being allowed to open a record is not being allowed to see all of it: a
   * supervisor gets the team-member (work) view — see `canViewFullEmployeeRecord`.
   */
  static async canAccessEmployeeRecord(
    actor: { employeeId?: string; permissionTier: PermissionTier },
    targetEmployeeId: string
  ): Promise<boolean> {
    if (actor.permissionTier === PermissionTier.FULL) return true;
    if (!actor.employeeId) return false;
    if (actor.employeeId === targetEmployeeId) return true;
    if (actor.permissionTier !== PermissionTier.SUPERVISOR) return false;
    return OrgHierarchyService.isDirectSubordinate(actor.employeeId, targetEmployeeId);
  }

  /**
   * Whether the actor may see the WHOLE record — personal details, contacts,
   * addresses, government IDs, emergency contacts, account details and the
   * record's audit history. HR (FULL) and the employee themselves only.
   *
   * No supervisor permission covers a report's personal record (supervisors hold
   * `attendance` / `attendance_log` / `activity` for SUBORDINATES and `profile`
   * for OWN only), so a supervisor opening a direct report sees the work profile.
   */
  static canViewFullEmployeeRecord(
    actor: { employeeId?: string; permissionTier: PermissionTier },
    targetEmployeeId: string
  ): boolean {
    if (actor.permissionTier === PermissionTier.FULL) return true;
    return !!actor.employeeId && actor.employeeId === targetEmployeeId;
  }

  /**
   * The set of employee ids an actor may see in a list.
   * `null` means "no restriction" (FULL tier).
   */
  static async getVisibleEmployeeIds(actor: {
    employeeId?: string;
    permissionTier: PermissionTier;
  }): Promise<string[] | null> {
    if (actor.permissionTier === PermissionTier.FULL) return null;
    if (!actor.employeeId) return [];
    if (actor.permissionTier === PermissionTier.SUPERVISOR) {
      return OrgHierarchyService.getTeamScopeIds(actor.employeeId);
    }
    return [actor.employeeId];
  }

  // ── Who may change whom (HR authority) ────────────────────────────────────
  //
  // The user's rule (2026-11-04): Sister may change anyone's record. HR — every
  // other FULL role, HR Officer and HR Assistant alike — may change their own
  // record and anyone below HR (supervisors, heads, coordinators, employees),
  // but not another HR person and not Sister. Only Sister gives someone an HR
  // or Sister job role, so the rule cannot be stepped around by promotion.
  //
  // "Change" covers Employee Management (the record, government IDs, documents,
  // supervisor override, additional oversight, archive / restore, the sign-in
  // account) and, since the second pass the same day, leave decisions and
  // balances, attendance, work schedules, medical, psychological and compliance
  // records, and training results. Reading is unchanged, except that HR never
  // sees the private psychological notes on an HR person's or Sister's record.
  //
  // HR's OWN items need no second person and nothing waits on Sister, who only
  // oversees: HR's own leave and records are accepted automatically (with
  // limits: enough leave days, no past dates, proof attached) and Sister is
  // notified. Nobody approves, reviews or deletes their own items, changes their
  // own leave balance or attendance. HR and Sister are not evaluated.

  /** True when the employee holds the Sister role (the top of the hierarchy). */
  static async isSister(employeeId: string | undefined | null): Promise<boolean> {
    if (!employeeId) return false;
    const row = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { jobRole: { select: { code: true } } },
    });
    return row?.jobRole?.code === SISTER_ROLE_CODE;
  }

  /** True when the employee holds an HR or Sister role (FULL tier). */
  static async isFullTier(employeeId: string | undefined | null): Promise<boolean> {
    if (!employeeId) return false;
    const row = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { jobRole: { select: { permissionTier: true } } },
    });
    return row?.jobRole?.permissionTier === PermissionTier.FULL;
  }

  /**
   * The people whose records this viewer may read but not change: for HR, every
   * other HR person and Sister; nobody for Sister. Screens use it to show those
   * records read-only (the API refuses the change either way).
   */
  static async lockedEmployeeIds(actor: { employeeId?: string; permissionTier: PermissionTier }): Promise<string[]> {
    if (actor.permissionTier !== PermissionTier.FULL) return [];
    if (await OrgHierarchyService.isSister(actor.employeeId)) return [];
    const rows = await prisma.employee.findMany({
      where: { jobRole: { permissionTier: PermissionTier.FULL }, ...(actor.employeeId ? { id: { not: actor.employeeId } } : {}) },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Whether the actor may change this employee's record and account. */
  static async canManageEmployee(
    actor: { employeeId?: string; permissionTier: PermissionTier },
    targetEmployeeId: string
  ): Promise<boolean> {
    if (actor.permissionTier !== PermissionTier.FULL) return false;
    if (actor.employeeId && actor.employeeId === targetEmployeeId) return true;
    if (await OrgHierarchyService.isSister(actor.employeeId)) return true;
    const target = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { jobRole: { select: { permissionTier: true } } },
    });
    // An unknown id is left to the action's own "not found".
    return !target || target.jobRole?.permissionTier !== PermissionTier.FULL;
  }

  /** Throws 403 unless the actor may change every one of these employees. */
  static async assertCanManageEmployees(
    actor: { employeeId?: string; permissionTier: PermissionTier },
    targetEmployeeIds: string[]
  ): Promise<void> {
    for (const id of targetEmployeeIds) {
      if (!(await OrgHierarchyService.canManageEmployee(actor, id))) {
        throw new AppError(HR_AUTHORITY_MESSAGE, 403, undefined, 'FORBIDDEN');
      }
    }
  }

  /**
   * Only Sister gives someone an HR or Sister job role (a FULL-tier role).
   * Keeping one's current role is never refused.
   */
  static async assertCanAssignJobRole(
    actor: { employeeId?: string; permissionTier: PermissionTier },
    jobRoleId: string | undefined | null,
    currentJobRoleId?: string | null
  ): Promise<void> {
    if (!jobRoleId || jobRoleId === currentJobRoleId) return;
    const role = await prisma.jobRole.findUnique({ where: { id: jobRoleId }, select: { permissionTier: true } });
    if (role?.permissionTier !== PermissionTier.FULL) return;
    if (await OrgHierarchyService.isSister(actor.employeeId)) return;
    throw new AppError('Only Sister can give someone an HR or Sister job role.', 403, undefined, 'FORBIDDEN');
  }
}

export const SISTER_ROLE_CODE = 'SISTER';

export const HR_AUTHORITY_MESSAGE =
  "Only Sister can change another HR person's or Sister's record. HR can change their own record and anyone below HR.";
