import { LeaveAllotmentSource, LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';
import { businessDateKey } from '../lib/businessDate';
import { anniversaryDate, completedYearsOfService, servicePeriod } from '../lib/service-period';
import { entitlementFor, LEAVE_ENTITLEMENT_RULES } from '../lib/leave-entitlement';

/**
 * Applies the completed-years leave entitlement to `LeaveBalance` rows.
 *
 * How it fits the existing balances — nothing already recorded is lost:
 *  • A balance HR entered by hand is MANUAL and is never changed here. The
 *    policy figure is shown next to it, and HR can choose to switch that balance
 *    to the automatic entitlement (`applyPolicy`).
 *  • An AUTOMATIC balance follows the entitlement: only `totalAllotted` moves
 *    (e.g. on the 1st and 3rd anniversaries, or when HR changes eligibility).
 *    `used`, `pending` and `forfeited` are never touched.
 *  • When no balance exists and the entitlement is above zero, an AUTOMATIC row
 *    is created for the current year, with `used` and `pending` taken from the
 *    employee's existing approved and pending requests of that type and year,
 *    so history filed before the row existed still counts.
 *
 * Balances stay per calendar year, as they already were. Nothing carries over
 * between years and no reset rule is added — Hospicio has not defined one.
 * There are no background jobs: the entitlement is brought up to date when a
 * balance is looked at, when leave is filed, and when HR changes the start date
 * or an eligibility flag.
 */

const ACTIVE_STATES = ['ACTIVE', 'ON_LEAVE'];

/** The calendar year (Manila) that balances are kept for on a given day. */
export function balanceYear(asOf: Date = new Date()): number {
  return Number(businessDateKey(asOf).slice(0, 4));
}

type Db = Prisma.TransactionClient | typeof prisma;

async function requestTotals(db: Db, employeeId: string, leaveType: LeaveType, year: number) {
  // Same year rule as LeaveService (the request's start date).
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const rows = await db.leaveRequest.findMany({
    where: { employeeId, leaveType, deletedAt: null, startDate: { gte: from, lt: to } },
    select: { status: true, totalDays: true },
  });
  const sum = (statuses: LeaveStatus[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + Number(r.totalDays || 0), 0);
  return { used: sum([LeaveStatus.APPROVED]), pending: sum([LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW]) };
}

export class LeaveEntitlementService {
  /**
   * Brings one employee's automatic balances for the current year in line with
   * their completed years and eligibility. Returns what changed.
   */
  static async syncEmployee(employeeId: string, opts: { actorUserId?: string | null; asOf?: Date } = {}) {
    const asOf = opts.asOf ?? new Date();
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, hireDate: true, employmentState: true, deletedAt: true, paternityLeaveEligible: true, soloParentLeaveEligible: true },
    });
    // Separated or archived employees keep whatever they had; nothing is granted.
    if (!employee || employee.deletedAt || !ACTIVE_STATES.includes(employee.employmentState) || !employee.hireDate) return [];

    const year = balanceYear(asOf);
    const completedYears = completedYearsOfService(employee.hireDate, asOf) ?? 0;
    const existing = await prisma.leaveBalance.findMany({ where: { employeeId, year } });
    const changes: Array<{ leaveType: LeaveType; action: 'CREATED' | 'UPDATED'; from?: number; to: number }> = [];

    for (const rule of LEAVE_ENTITLEMENT_RULES) {
      const ent = entitlementFor(rule, completedYears, employee);
      const row = existing.find((b) => b.leaveType === rule.leaveType);

      if (!row) {
        if (ent.days <= 0) continue;
        const totals = await requestTotals(prisma, employeeId, rule.leaveType, year);
        try {
          const created = await prisma.leaveBalance.create({
            data: {
              employeeId, year, leaveType: rule.leaveType, totalAllotted: ent.days,
              used: totals.used, pending: totals.pending, forfeited: 0,
              allotmentSource: LeaveAllotmentSource.AUTOMATIC,
              entitlementCompletedYears: completedYears, entitlementAppliedAt: new Date(),
            },
          });
          changes.push({ leaveType: rule.leaveType, action: 'CREATED', to: ent.days });
          await createAuditLog({
            actorUserId: opts.actorUserId ?? undefined,
            targetEmployeeId: employeeId,
            action: 'LEAVE_ENTITLEMENT_APPLIED',
            entityType: 'LeaveBalance',
            entityId: created.id,
            newValue: { totalAllotted: ent.days, used: totals.used, pending: totals.pending },
            metadata: { year, leaveType: rule.leaveType, completedYears, reason: ent.reason },
          });
        } catch (err) {
          // Another request created the same balance a moment earlier — fine.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
        continue;
      }

      if (row.allotmentSource !== LeaveAllotmentSource.AUTOMATIC) continue; // HR's manual figure stands.
      if (row.totalAllotted === ent.days && row.entitlementCompletedYears === completedYears) continue;

      await prisma.leaveBalance.update({
        where: { id: row.id },
        data: { totalAllotted: ent.days, entitlementCompletedYears: completedYears, entitlementAppliedAt: new Date() },
      });
      if (row.totalAllotted !== ent.days) {
        changes.push({ leaveType: rule.leaveType, action: 'UPDATED', from: row.totalAllotted, to: ent.days });
        await createAuditLog({
          actorUserId: opts.actorUserId ?? undefined,
          targetEmployeeId: employeeId,
          action: 'LEAVE_ENTITLEMENT_UPDATED',
          entityType: 'LeaveBalance',
          entityId: row.id,
          oldValue: { totalAllotted: row.totalAllotted },
          newValue: { totalAllotted: ent.days },
          metadata: { year, leaveType: rule.leaveType, completedYears, reason: ent.reason },
        });
      }
    }
    return changes;
  }

  /** Every active employee — HR's "bring all entitlements up to date". */
  static async syncAll(actorUserId?: string | null) {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, employmentState: { in: ACTIVE_STATES as any } },
      select: { id: true },
    });
    let changed = 0;
    for (const e of employees) {
      const c = await this.syncEmployee(e.id, { actorUserId });
      if (c.length) changed++;
    }
    return { employeesChecked: employees.length, employeesChanged: changed };
  }

  /**
   * The entitlement explained, for one employee, next to the balance actually
   * held — so HR (and the employee) can see why the number is what it is.
   */
  static async describe(employeeId: string, asOf: Date = new Date()) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true, hireDate: true, employmentState: true, deletedAt: true, separationDate: true,
        paternityLeaveEligible: true, soloParentLeaveEligible: true,
      },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const year = balanceYear(asOf);
    const active = !employee.deletedAt && ACTIVE_STATES.includes(employee.employmentState);
    const completedYears = completedYearsOfService(employee.hireDate, asOf) ?? 0;
    const balances = await prisma.leaveBalance.findMany({ where: { employeeId, year } });

    return {
      employeeId,
      year,
      asOf: businessDateKey(asOf),
      startDate: employee.hireDate ? businessDateKey(employee.hireDate) : null,
      active,
      completedYears,
      servicePeriod: employee.hireDate ? servicePeriod(employee.hireDate, asOf) : null,
      eligibility: {
        paternityLeaveEligible: employee.paternityLeaveEligible,
        soloParentLeaveEligible: employee.soloParentLeaveEligible,
      },
      items: LEAVE_ENTITLEMENT_RULES.map((rule) => {
        const ent = entitlementFor(rule, completedYears, employee);
        const b = balances.find((x) => x.leaveType === rule.leaveType) ?? null;
        const status = !b
          ? (ent.days > 0 && active ? 'NOT_YET_CREATED' : 'NO_ENTITLEMENT')
          : b.allotmentSource === LeaveAllotmentSource.AUTOMATIC
            ? 'AUTOMATIC'
            : b.totalAllotted === ent.days ? 'MANUAL_MATCHES_POLICY' : 'MANUAL_DIFFERS_FROM_POLICY';
        return {
          ...ent,
          requiresEligibility: Boolean(rule.eligibilityFlag),
          nextDate: ent.next && employee.hireDate ? anniversaryDate(employee.hireDate, ent.next.fromYears) : null,
          balance: b ? { id: b.id, totalAllotted: b.totalAllotted, used: b.used, pending: b.pending, forfeited: b.forfeited, allotmentSource: b.allotmentSource } : null,
          status,
        };
      }),
    };
  }

  /** HR switches a manual balance to the automatic entitlement (used/pending/forfeited kept). */
  static async applyPolicy(employeeId: string, leaveType: LeaveType, actorUserId: string) {
    const rule = LEAVE_ENTITLEMENT_RULES.find((r) => r.leaveType === leaveType);
    if (!rule) throw new AppError('This leave type has no automatic entitlement; its allotment is entered by HR.', 400);
    const year = balanceYear();
    const row = await prisma.leaveBalance.findUnique({ where: { employeeId_year_leaveType: { employeeId, year, leaveType } } });
    if (!row) {
      await this.syncEmployee(employeeId, { actorUserId });
      return this.describe(employeeId);
    }
    if (row.allotmentSource === LeaveAllotmentSource.AUTOMATIC) return this.describe(employeeId);

    await prisma.leaveBalance.update({ where: { id: row.id }, data: { allotmentSource: LeaveAllotmentSource.AUTOMATIC } });
    await createAuditLog({
      actorUserId,
      targetEmployeeId: employeeId,
      action: 'LEAVE_BALANCE_SWITCHED_TO_AUTOMATIC',
      entityType: 'LeaveBalance',
      entityId: row.id,
      oldValue: { allotmentSource: 'MANUAL', totalAllotted: row.totalAllotted },
      metadata: { year, leaveType },
    });
    await this.syncEmployee(employeeId, { actorUserId });
    return this.describe(employeeId);
  }
}
