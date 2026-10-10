import { prisma } from '../config/prisma';
import { PermissionTier } from '@prisma/client';

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
}
