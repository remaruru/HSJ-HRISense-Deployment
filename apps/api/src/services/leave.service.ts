import { prisma } from '../config/prisma';
import { leaveBalanceFigures, withLeaveBalanceFigures } from '../lib/leave-balance';
import { completedYearsOfService } from '../lib/service-period';
import { LeaveEntitlementService } from './leave-entitlement.service';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier, LeaveStatus, LeaveType, NotificationType, Prisma } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { OrgHierarchyService } from './org-hierarchy.service';
import { NotificationService } from './notification.service';
import { instantToBusinessDate } from '../lib/businessDate';
import * as crypto from 'crypto';

export class LeaveService {
  // ── Periods ─────────────────────────────────────────────────────────────────

  /**
   * Leave days from start to end, inclusive, as calendar days — the rule in use
   * until Hospicio confirms how weekends, rest days and holidays are charged.
   * Used for the request, a head's proposed change and HR's revised approval.
   */
  static calendarDays(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  /** A date-only value ("YYYY-MM-DD" or ISO), checked. */
  private static parseLeaveDate(value: unknown, label: string): Date {
    const raw = String(value ?? '').trim().slice(0, 10);
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
      throw new AppError(`${label} is not a valid date.`, 400, undefined, 'VALIDATION_ERROR');
    }
    return d;
  }

  /** Optional free text, trimmed; null when blank. */
  private static optionalText(value: unknown, label: string, max: number): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return null;
    if (text.length > max) throw new AppError(`${label} must be ${max} characters or fewer.`, 400, undefined, 'VALIDATION_ERROR');
    return text;
  }

  /** Refuses a period that overlaps the employee's other open or approved leave. */
  private static async assertNoOverlap(employeeId: string, start: Date, end: Date, excludeId?: string) {
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        status: { in: [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW, LeaveStatus.APPROVED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new AppError('Those dates overlap another leave request of this employee.', 409, undefined, 'LEAVE_OVERLAP');
    }
  }

  /**
   * A different period for an existing request — a head's proposal or HR's
   * revised approval. It must differ from what was requested, come with a
   * reason, and not overlap the employee's other leave.
   */
  private static async changedPeriod(
    leave: { id: string; employeeId: string; startDate: Date; endDate: Date },
    change: { startDate?: unknown; endDate?: unknown; reason?: unknown },
    what: 'proposed change' | 'revised leave'
  ): Promise<{ start: Date; end: Date; days: number; reason: string }> {
    const start = LeaveService.parseLeaveDate(change.startDate, `The ${what} start date`);
    const end = LeaveService.parseLeaveDate(change.endDate, `The ${what} end date`);
    if (start > end) throw new AppError(`The ${what} must end on or after its start date.`, 400, undefined, 'VALIDATION_ERROR');
    const reason = LeaveService.optionalText(change.reason, 'The reason for the change', 1000);
    if (!reason) throw new AppError(`Give the reason for the ${what}.`, 400, undefined, 'VALIDATION_ERROR');
    if (start.getTime() === leave.startDate.getTime() && end.getTime() === leave.endDate.getTime()) {
      throw new AppError(`The ${what} has the same dates as the request — endorse or approve it as requested instead.`, 400, undefined, 'VALIDATION_ERROR');
    }
    await LeaveService.assertNoOverlap(leave.employeeId, start, end, leave.id);
    return { start, end, days: LeaveService.calendarDays(start, end), reason };
  }

  /**
   * List leave requests with scope enforcement.
   * FULL: all (optionally filtered) | SUPERVISOR: self + team | STANDARD: own only
   * scope param: 'self' | 'team' | 'all'
   */
  static async list(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      employeeId?: string;
      year?: number;
      scope?: string;
      unitId?: string;
      departmentId?: string;
      leaveType?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, status, employeeId, year, scope, unitId, departmentId, leaveType } = params;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    // Resolve effective scope based on permission tier
    const effectiveScope = LeaveService.resolveScope(permissionTier, scope);

    if (effectiveScope === 'own') {
      where.employeeId = requestingEmployeeId;
    } else if (effectiveScope === 'team') {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      where.employeeId = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else {
      // 'all' — FULL only
      if (employeeId) where.employeeId = employeeId;
    }

    if (status) where.status = status;
    if (leaveType) where.leaveType = leaveType;
    if (year) {
      where.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    // HR-only filters
    if (permissionTier === PermissionTier.FULL) {
      if (unitId) {
        where.employee = { ...where.employee, unitId };
      }
      if (departmentId) {
        where.employee = { ...where.employee, departmentId };
      }
    }

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              // No head in the chain → the request is waiting for HR, not a head.
              immediateSupervisorId: true,
              unit: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
              jobRole: { select: { title: true } },
            },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get leave events for the calendar. Uses overlap query to capture
   * multi-day leaves that cross month boundaries.
   * start/end must be date strings: 'YYYY-MM-DD'
   */
  static async getCalendarEvents(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      start: string;
      end: string;
      scope?: string;
      unitId?: string;
      departmentId?: string;
      employeeId?: string;
      status?: string;
      leaveType?: string;
    }
  ) {
    const { start, end, scope, unitId, departmentId, employeeId, status, leaveType } = params;

    if (!start || !end) throw new AppError('start and end dates are required', 400);

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }
    if (startDate > endDate) throw new AppError('start must be before end', 400);

    // Bounded range check (max 6 months for calendar safety)
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 186) throw new AppError('Calendar range cannot exceed 6 months', 400);

    const effectiveScope = LeaveService.resolveScope(permissionTier, scope);

    const where: any = {
      deletedAt: null,
      // Only show APPROVED and PENDING on calendar; not REJECTED or CANCELLED
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
      // Proper overlap query: leave overlaps [startDate, endDate]
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };

    if (status && ['APPROVED', 'PENDING'].includes(status)) {
      where.status = status as LeaveStatus;
    }
    if (leaveType) where.leaveType = leaveType;

    if (effectiveScope === 'own') {
      where.employeeId = requestingEmployeeId;
    } else if (effectiveScope === 'team') {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(requestingEmployeeId);
      const allowedIds = [requestingEmployeeId, ...subordinateIds];
      where.employeeId = employeeId && allowedIds.includes(employeeId)
        ? employeeId
        : { in: allowedIds };
    } else {
      // FULL — all employees
      if (employeeId) where.employeeId = employeeId;
      if (unitId) where.employee = { ...where.employee, unitId };
      if (departmentId) where.employee = { ...where.employee, departmentId };
    }

    const events = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            unit: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });

    return events;
  }

  /**
   * Resolve effective data scope from permission tier and requested scope.
   *
   * STANDARD: own only. Explicit scope=team or scope=all → 403.
   * SUPERVISOR: own (default) or team. Explicit scope=all → 403.
   * FULL: own (default), team, or all.
   *
   * If no scope is provided, returns the role's default. If an unauthorized
   * scope is EXPLICITLY requested, throws 403 (not silently downgraded).
   */
  private static resolveScope(
    permissionTier: PermissionTier,
    requestedScope?: string
  ): 'own' | 'team' | 'all' {
    // No explicit scope — return role defaults
    if (!requestedScope) {
      return 'own';
    }

    if (permissionTier === PermissionTier.STANDARD) {
      if (requestedScope === 'self') return 'own';
      // STANDARD explicitly requesting team or all → 403
      throw new AppError(
        `Permission denied: scope '${requestedScope}' requires a higher access tier.`,
        403
      );
    }

    if (permissionTier === PermissionTier.SUPERVISOR) {
      if (requestedScope === 'self') return 'own';
      if (requestedScope === 'team') return 'team';
      // SUPERVISOR explicitly requesting all → 403
      throw new AppError(
        `Permission denied: scope '${requestedScope}' requires FULL access tier.`,
        403
      );
    }

    // FULL — all scopes permitted
    if (requestedScope === 'all') return 'all';
    if (requestedScope === 'team') return 'team';
    return 'own';
  }

  /**
   * Get a single leave request.
   */
  static async getById(
    id: string,
    requestingEmployeeId: string,
    permissionTier: PermissionTier
  ) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            hireDate: true,
            immediateSupervisorId: true,
            unit: { select: { name: true } },
            department: { select: { name: true } },
            jobRole: { select: { title: true } },
          },
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        endorsedBy: { select: { id: true, firstName: true, lastName: true, jobRole: { select: { title: true } } } },
        proposedBy: { select: { id: true, firstName: true, lastName: true, jobRole: { select: { title: true } } } },
      },
    });

    if (!leave) throw new AppError('Leave request not found', 404);

    if (permissionTier === PermissionTier.FULL) {
      return LeaveService.withDetail(leave);
    }

    if (permissionTier === PermissionTier.SUPERVISOR) {
      if (leave.employeeId === requestingEmployeeId) return LeaveService.withDetail(leave);
      // Check if it's a subordinate (canonical hierarchy).
      const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
        requestingEmployeeId,
        leave.employeeId
      );
      if (isSubordinate) return LeaveService.withDetail(leave);
      throw new AppError("You can only view leave requests of your direct reports.", 403);
    }

    // STANDARD: own only
    if (leave.employeeId !== requestingEmployeeId) {
      throw new AppError("You can only view your own leave requests.", 403);
    }

    return LeaveService.withDetail(leave);
  }

  /** Audit actions that make up a leave request's history, in plain words. */
  private static readonly HISTORY_LABELS: Record<string, string> = {
    LEAVE_FILED: 'Request submitted',
    LEAVE_REQUEST_CREATED_ON_BEHALF: 'Request filed on the employee\'s behalf',
    LEAVE_ENDORSED: 'Endorsed to HR',
    LEAVE_REVISION_PROPOSED: 'Endorsed to HR with a proposed change',
    LEAVE_APPROVED: 'Approved by HR',
    LEAVE_APPROVED_WITH_REVISION: 'Approved by HR with changes',
    LEAVE_AUTO_APPROVED: 'Accepted automatically (HR leave)',
    LEAVE_REJECTED: 'Declined',
    LEAVE_CANCELLED: 'Cancelled by the employee',
  };

  /**
   * What a reviewer (head or HR) or the employee needs on one screen: the
   * employee's position and service, the leave record for this leave type (the
   * paper form's "Total Available / Less: This Leave / Balance to Date"), and the
   * history of what actually happened to the request.
   */
  private static async withDetail(leave: any) {
    await LeaveEntitlementService.syncEmployee(leave.employeeId);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    // Days are reserved (or charged) against the balance of the leave's year.
    const year = new Date(leave.startDate).getFullYear();
    const row = await prisma.leaveBalance.findUnique({
      where: { employeeId_year_leaveType: { employeeId: leave.employeeId, year, leaveType: leave.leaveType } },
    });
    let leaveRecord: any = null;
    if (row) {
      const { available } = leaveBalanceFigures(row);
      // An open or approved request already sits in `pending` / `used`, so the
      // total available BEFORE this leave adds it back.
      const counted = [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW, LeaveStatus.APPROVED].includes(leave.status);
      const totalAvailable = r2(available + (counted ? leave.totalDays : 0));
      leaveRecord = {
        year,
        totalAllotted: row.totalAllotted,
        totalAvailable,
        lessThisLeave: leave.totalDays,
        balanceAfter: r2(totalAvailable - leave.totalDays),
        proposedBalanceAfter: leave.proposedTotalDays != null ? r2(totalAvailable - leave.proposedTotalDays) : null,
        counted,
      };
    }

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'LeaveRequest', entityId: leave.id, action: { in: Object.keys(LeaveService.HISTORY_LABELS) } },
      orderBy: { createdAt: 'asc' },
      select: { action: true, createdAt: true, newValue: true, metadata: true, actorUserId: true },
    });
    const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId).filter(Boolean))) as string[];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, employee: { select: { firstName: true, lastName: true, jobRole: { select: { title: true, permissionTier: true } } } } },
    });
    const actorById = new Map(actors.map((a) => [a.id, a.employee]));
    const history = logs.map((l) => {
      const actor = l.actorUserId ? actorById.get(l.actorUserId) : null;
      const v: any = l.newValue ?? l.metadata ?? {};
      let label = LeaveService.HISTORY_LABELS[l.action] ?? l.action;
      if (l.action === 'LEAVE_REJECTED') label = actor?.jobRole?.permissionTier === 'FULL' ? 'Declined by HR' : 'Declined by the head';
      return {
        action: l.action,
        label,
        at: l.createdAt,
        by: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
        byRole: actor?.jobRole?.title ?? null,
        detail: typeof v.detail === 'string' ? v.detail : l.action === 'LEAVE_REJECTED' && typeof v.reason === 'string' ? `Reason: ${v.reason}` : null,
      };
    });

    const hire = leave.employee?.hireDate ?? null;
    return {
      ...leave,
      leaveRecord,
      history,
      completedYearsOfService: hire ? completedYearsOfService(hire, new Date()) : null,
      // No head in the chain → the request goes straight to HR.
      routedTo: leave.employee?.immediateSupervisorId ? 'HEAD' : 'HR',
    };
  }

  /**
   * Get leave balances for an employee.
   */
  static async getBalances(
    employeeId: string,
    requestingEmployeeId: string,
    permissionTier: PermissionTier
  ) {
    if (permissionTier !== PermissionTier.FULL && employeeId !== requestingEmployeeId) {
      throw new AppError("You can only view your own leave balances.", 403);
    }

    // Bring the completed-years entitlement up to date before showing it
    // (automatic balances only; HR's manual figures are never changed).
    await LeaveEntitlementService.syncEmployee(employeeId);

    const year = new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
      orderBy: { leaveType: 'asc' },
    });

    // `available` is computed once, here, for every screen (lib/leave-balance).
    return balances.map(withLeaveBalanceFigures);
  }

  /**
   * File a new leave request (always for self).
   */
  static async create(
    requestingEmployeeId: string,
    data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason: string;
      supportingDocUrl?: string;
      /** Hospicio form: where the employee can be reached during the leave. */
      addressDuringLeave?: string;
      /** Hospicio form: contact number during the leave. */
      contactNumber?: string;
    },
    /** Who is filing. HR (FULL tier, Sister included) has their own leave accepted automatically. */
    actor?: { permissionTier?: PermissionTier | string; userId?: string }
  ) {
    if (!requestingEmployeeId) throw new AppError('No employee profile linked to this account', 400);
    if (!(Object.values(LeaveType) as string[]).includes(String(data.leaveType))) {
      throw new AppError('Choose one of the listed leave types.', 400, undefined, 'VALIDATION_ERROR');
    }
    if (!String(data.reason ?? '').trim()) {
      throw new AppError('Give the reason for the leave.', 400, undefined, 'VALIDATION_ERROR');
    }

    const start = LeaveService.parseLeaveDate(data.startDate, 'The start date');
    const end = LeaveService.parseLeaveDate(data.endDate, 'The end date');

    if (start > end) throw new AppError('Start date must be before end date', 400);

    // Inclusive calendar days. Hospicio-specific chargeable-day rules (weekends,
    // holidays, rest days) have NOT been confirmed — do not apply exclusions
    // without that confirmation.
    const totalDays = LeaveService.calendarDays(start, end);
    const addressDuringLeave = LeaveService.optionalText(data.addressDuringLeave, 'Address during leave', 255);
    const contactNumber = LeaveService.optionalText(data.contactNumber, 'Contact number', 40);

    // Check for overlapping leaves
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: requestingEmployeeId,
        deletedAt: null,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW, LeaveStatus.APPROVED] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlap) {
      throw new AppError('You already have a leave request overlapping these dates', 409);
    }

    // HR's own leave needs no second person (the user's rule, 2026-11-04): it is
    // accepted automatically, but only from today on and only within the days
    // the balance still has. Sister is told; nothing waits on her.
    const autoAccept = actor?.permissionTier === PermissionTier.FULL;
    if (autoAccept && start < instantToBusinessDate(new Date())) {
      throw new AppError(
        "As HR, your leave is accepted automatically, so it has to start today or later. Past dates can't be filed.",
        400, undefined, 'VALIDATION_ERROR'
      );
    }

    // Make sure this year's automatic balance exists before the days are reserved.
    await LeaveEntitlementService.syncEmployee(requestingEmployeeId);

    if (autoAccept) {
      return LeaveService.createAutoAccepted(requestingEmployeeId, {
        leaveType: data.leaveType as LeaveType, start, end, totalDays,
        reason: data.reason.trim(), supportingDocUrl: data.supportingDocUrl, addressDuringLeave, contactNumber,
      }, actor?.userId ?? null);
    }

    const leave = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          employeeId: requestingEmployeeId,
          leaveType: data.leaveType as any,
          startDate: start,
          endDate: end,
          totalDays,
          reason: data.reason.trim(),
          supportingDocUrl: data.supportingDocUrl,
          addressDuringLeave,
          contactNumber,
          status: LeaveStatus.PENDING,
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true, immediateSupervisorId: true },
          },
        },
      });

      // Reserve the days against the balance. Filing previously never
      // incremented `pending` while approval decremented it, so the figure drifted
      // negative. No balance row is created here: balances come from the
      // completed-years entitlement (LeaveEntitlementService) or from HR.
      await LeaveService.reservePendingDays(tx, created);

      return created;
    });

    await LeaveService.notifyLeaveFiled(leave);

    return leave;
  }

  /** "vacation", "solo parent" — a leave type in message words. */
  private static typeWords(type: string): string {
    return type.toLowerCase().replace(/_/g, ' ');
  }

  /**
   * HR's own leave, accepted on filing. The balance for the leave's year must
   * exist and still hold enough days — the check a human approver used to make
   * — and the days are charged straight to `used`.
   */
  private static async createAutoAccepted(
    employeeId: string,
    d: {
      leaveType: LeaveType; start: Date; end: Date; totalDays: number; reason: string;
      supportingDocUrl?: string; addressDuringLeave: string | null; contactNumber: string | null;
    },
    actorUserId: string | null
  ) {
    const year = d.start.getFullYear();
    const words = LeaveService.typeWords(d.leaveType);
    const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

    const leave = await prisma.$transaction(async (tx) => {
      const balance = await tx.leaveBalance.findUnique({
        where: { employeeId_year_leaveType: { employeeId, year, leaveType: d.leaveType } },
      });
      if (!balance) {
        throw new AppError(
          `You have no ${words} leave balance for ${year}, so this leave can't be accepted automatically. Sister can set one.`,
          400, undefined, 'VALIDATION_ERROR'
        );
      }
      const { available } = leaveBalanceFigures(balance);
      if (available < d.totalDays) {
        throw new AppError(
          `You have ${days(Math.max(0, available))} of ${words} leave left for ${year}, and this leave needs ${days(d.totalDays)}.`,
          400, undefined, 'VALIDATION_ERROR'
        );
      }

      const created = await tx.leaveRequest.create({
        data: {
          employeeId,
          leaveType: d.leaveType,
          startDate: d.start,
          endDate: d.end,
          totalDays: d.totalDays,
          reason: d.reason,
          supportingDocUrl: d.supportingDocUrl,
          addressDuringLeave: d.addressDuringLeave,
          contactNumber: d.contactNumber,
          status: LeaveStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: employeeId,
          hrNotes: "Accepted automatically: HR's own leave needs no approval.",
        },
        include: {
          employee: { select: { firstName: true, lastName: true, jobRole: { select: { title: true } } } },
        },
      });
      await tx.leaveBalance.update({ where: { id: balance.id }, data: { used: { increment: d.totalDays } } });
      return created;
    });

    const name = `${leave.employee.firstName} ${leave.employee.lastName}`.trim();
    await NotificationService.notifySister({
      type: NotificationType.LEAVE_APPROVED,
      eventId: `leave-auto-approved-sister:${leave.id}`,
      title: 'HR leave accepted automatically',
      message: `${name}${leave.employee.jobRole?.title ? ` (${leave.employee.jobRole.title})` : ''} filed ${words} leave for ${LeaveService.periodText(d.start, d.end)} (${days(d.totalDays)}). HR's own leave is accepted automatically; this is for your information only.`,
      link: '/leave/requests',
    }, actorUserId);

    return { ...leave, autoAccepted: true as const };
  }

  /**
   * Increments `LeaveBalance.pending` for a filed request, when HR has configured
   * a balance for that employee / year / leave type. Silently does nothing when
   * no balance exists — that is a configuration gap, not an error.
   */
  private static async reservePendingDays(
    tx: Prisma.TransactionClient,
    leave: { employeeId: string; startDate: Date; leaveType: LeaveType; totalDays: number }
  ) {
    const year = leave.startDate.getFullYear();
    const balance = await tx.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveType: {
          employeeId: leave.employeeId,
          year,
          leaveType: leave.leaveType,
        },
      },
    });
    if (!balance) return;

    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: leave.totalDays } },
    });
  }

  /**
   * Moves a leave request from an expected status to a new one, atomically.
   *
   * The status precondition lives in the WHERE clause, so the check and the write
   * are one operation. Previously the guard was a `findUnique` before the
   * transaction and the update carried no status condition — two concurrent
   * approvals (a double-click, or a client retry after a timeout where the server
   * had actually succeeded) both passed the guard and both applied their balance
   * side effects, double-charging the employee.
   *
   * @returns true when THIS caller performed the transition. false means another
   *          request already moved the row — the caller must then skip every side
   *          effect rather than repeating it.
   */
  private static async transitionStatus(
    tx: Prisma.TransactionClient,
    id: string,
    fromStatuses: LeaveStatus[],
    data: Prisma.LeaveRequestUpdateManyMutationInput
  ): Promise<boolean> {
    const result = await tx.leaveRequest.updateMany({
      where: { id, deletedAt: null, status: { in: fromStatuses } },
      data,
    });
    return result.count === 1;
  }

  /**
   * Releases reserved days from `pending` using database-side arithmetic.
   *
   * The decrement is guarded by `pending >= days` in the WHERE clause, so two
   * concurrent releases cannot both succeed against the same reservation. The
   * previous code computed `Math.max(0, balance.pending - days)` in Node from a
   * value read moments earlier — a read-modify-write that silently lost one
   * decrement under concurrency, with the clamp hiding the drift.
   *
   * When the guarded decrement matches nothing, the stored `pending` is smaller
   * than the days being released: a genuine data-integrity condition. It is
   * recorded in the audit trail and returned to the caller rather than being
   * quietly clamped away — but it does not block HR's decision, because refusing
   * to approve leave over a stale counter would be worse than reporting it.
   */
  private static async releasePendingDays(
    tx: Prisma.TransactionClient,
    leave: { employeeId: string; startDate: Date; leaveType: LeaveType; totalDays: number },
    context: { action: string; leaveRequestId: string; actorUserId?: string | null }
  ): Promise<{ anomaly: string | null }> {
    const year = leave.startDate.getFullYear();
    const balance = await tx.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveType: {
          employeeId: leave.employeeId,
          year,
          leaveType: leave.leaveType,
        },
      },
    });
    if (!balance) return { anomaly: null };

    const released = await tx.leaveBalance.updateMany({
      where: { id: balance.id, pending: { gte: leave.totalDays } },
      data: { pending: { decrement: leave.totalDays } },
    });

    if (released.count === 1) return { anomaly: null };

    // Underflow: surface it instead of hiding it behind a clamp.
    const anomaly =
      `Leave balance anomaly: tried to release ${leave.totalDays} pending day(s) for ` +
      `${leave.leaveType} ${year} but only ${balance.pending} were reserved. ` +
      `The pending figure has been corrected to 0 and this has been recorded.`;

    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: 0 },
    });

    await tx.auditLog.create({
      data: {
        action: 'LEAVE_BALANCE_PENDING_ANOMALY',
        entityType: 'LeaveBalance',
        entityId: balance.id,
        actorUserId: context.actorUserId ?? null,
        targetEmployeeId: leave.employeeId,
        metadata: {
          triggeredBy: context.action,
          leaveRequestId: context.leaveRequestId,
          leaveType: leave.leaveType,
          year,
          daysBeingReleased: leave.totalDays,
          pendingBeforeCorrection: balance.pending,
          pendingAfterCorrection: 0,
        },
      },
    });

    return { anomaly };
  }

  /**
   * Routes a newly filed request to the right reviewer.
   * With a supervisor → notify the supervisor for endorsement.
   * Without one (head roles, unresolved hierarchy) → route straight to HR.
   */
  private static async notifyLeaveFiled(leave: {
    id: string;
    employeeId: string;
    leaveType: LeaveType;
    startDate: Date;
    endDate: Date;
    employee: { firstName: string; lastName: string; immediateSupervisorId?: string | null };
  }) {
    const employeeName = `${leave.employee.firstName} ${leave.employee.lastName}`.trim();
    const period = `${leave.startDate.toDateString()} – ${leave.endDate.toDateString()}`;

    const supervisorUserId = await NotificationService.userIdForEmployee(
      leave.employee.immediateSupervisorId ?? null
    );

    if (supervisorUserId) {
      await NotificationService.notify({
        userId: supervisorUserId,
        type: NotificationType.LEAVE_FILED,
        eventId: `leave-filed-supervisor:${leave.id}`,
        title: 'Leave request awaiting your endorsement',
        message: `${employeeName} filed a ${leave.leaveType.toLowerCase()} leave request for ${period}.`,
        link: '/leave/requests',
      });
      return;
    }

    // No supervisor in the chain — HR reviews it directly. No supervisor is
    // fabricated to fill the gap.
    const hrUserIds = await NotificationService.hrUserIds();
    await NotificationService.notifyMany(hrUserIds, {
      type: NotificationType.LEAVE_FILED,
      eventId: `leave-filed-hr:${leave.id}`,
      title: 'Leave request awaiting HR decision',
      message: `${employeeName} filed a ${leave.leaveType.toLowerCase()} leave request for ${period}. They have no assigned supervisor, so it is routed directly to HR.`,
      link: '/leave/requests',
    });
  }

  /**
   * Batch create leave requests on behalf of employees
   */
  static async createBatch(
    actorUserId: string,
    actorEmployeeId: string,
    permissionTier: PermissionTier,
    data: {
      targetMode: 'self' | 'employees' | 'all';
      targetEmployeeIds?: string[];
      leaveType: string;
      startDate: string;
      endDate: string;
      reason: string;
      supportingDocUrl?: string;
    }
  ) {
    if (data.targetMode === 'all' && permissionTier !== PermissionTier.FULL) {
      throw new AppError('Permission denied: Organization-wide leave creation requires FULL access tier.', 403);
    }
    if (data.targetMode === 'employees' && permissionTier === PermissionTier.STANDARD) {
      throw new AppError('Permission denied: You can only create leave for yourself.', 403);
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) throw new AppError('Start date must be before end date', 400);

    const totalDays = LeaveService.calendarDays(start, end);

    let targetIds: string[] = [];

    if (data.targetMode === 'self') {
      targetIds = [actorEmployeeId];
    } else if (data.targetMode === 'all') {
      const activeEmps = await prisma.employee.findMany({
        where: { deletedAt: null, employmentState: 'ACTIVE' },
        select: { id: true }
      });
      targetIds = activeEmps.map(e => e.id);
    } else if (data.targetMode === 'employees') {
      if (!data.targetEmployeeIds || data.targetEmployeeIds.length === 0) {
        throw new AppError('No target employees provided.', 400);
      }
      targetIds = Array.from(new Set(data.targetEmployeeIds));
    }

    const created = [];
    const failed = [];
    const batchReference = crypto.randomUUID();

    // Cache direct reports for SUPERVISOR (canonical hierarchy).
    let authorizedSubordinateIds = new Set<string>();
    if (permissionTier === PermissionTier.SUPERVISOR) {
      const subordinateIds = await OrgHierarchyService.getDirectSubordinateIds(actorEmployeeId);
      authorizedSubordinateIds = new Set(subordinateIds);
    }

    // HR files for anyone below HR; another HR person and Sister file their own.
    const lockedIds = new Set(
      permissionTier === PermissionTier.FULL
        ? await OrgHierarchyService.lockedEmployeeIds({ employeeId: actorEmployeeId, permissionTier })
        : []
    );

    // Cache active employee check for FULL
    const existingActiveIds = new Set<string>();
    if (permissionTier === PermissionTier.FULL && data.targetMode === 'employees') {
       const existing = await prisma.employee.findMany({
         where: { id: { in: targetIds }, deletedAt: null, employmentState: 'ACTIVE' },
         select: { id: true }
       });
       existing.forEach(e => existingActiveIds.add(e.id));
    }

    for (const empId of targetIds) {
      // HR's own leave goes through the normal filing, which accepts it
      // automatically (with the balance and date checks).
      if (permissionTier === PermissionTier.FULL && empId === actorEmployeeId) {
        try {
          const own: any = await LeaveService.create(actorEmployeeId, {
            leaveType: data.leaveType, startDate: data.startDate, endDate: data.endDate,
            reason: data.reason, supportingDocUrl: data.supportingDocUrl,
          }, { permissionTier, userId: actorUserId });
          for (const action of ['LEAVE_FILED', 'LEAVE_AUTO_APPROVED']) {
            await createAuditLog({
              actorUserId, targetEmployeeId: empId, action, entityType: 'LeaveRequest', entityId: own.id,
              metadata: { batchReference, leaveType: data.leaveType, startDate: data.startDate, endDate: data.endDate },
            });
          }
          created.push(own);
        } catch (err: any) {
          failed.push({ employeeId: empId, reason: err?.message || 'Could not file your own leave.' });
        }
        continue;
      }
      if (lockedIds.has(empId)) {
        failed.push({ employeeId: empId, reason: 'An HR person or Sister: they file their own leave.' });
        continue;
      }

      // 1. Authorization
      if (permissionTier === PermissionTier.SUPERVISOR) {
        if (empId !== actorEmployeeId && !authorizedSubordinateIds.has(empId)) {
          failed.push({ employeeId: empId, reason: 'Not an active direct subordinate.' });
          continue;
        }
      } else if (permissionTier === PermissionTier.FULL && data.targetMode === 'employees') {
        if (!existingActiveIds.has(empId)) {
          failed.push({ employeeId: empId, reason: 'Employee is not active or does not exist.' });
          continue;
        }
      }

      // 2. Overlap Check
      const overlap = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: empId,
          deletedAt: null,
          status: { in: [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW, LeaveStatus.APPROVED] },
          OR: [
            { startDate: { lte: end }, endDate: { gte: start } },
          ],
        },
      });

      if (overlap) {
        failed.push({ employeeId: empId, reason: 'Employee already has an overlapping leave request.' });
        continue;
      }

      // 3. Create — and reserve the days, as filing one's own request does
      // (batch requests used to reserve nothing, so approving one later
      // released days that were never held).
      try {
        const leave = await prisma.$transaction(async (tx) => {
          const row = await tx.leaveRequest.create({
            data: {
              employeeId: empId,
              leaveType: data.leaveType as any,
              startDate: start,
              endDate: end,
              totalDays,
              reason: data.reason,
              supportingDocUrl: data.supportingDocUrl,
              status: LeaveStatus.PENDING,
            },
            include: {
              employee: { select: { firstName: true, lastName: true } },
            },
          });
          await LeaveService.reservePendingDays(tx, row);
          return row;
        });

        await createAuditLog({
          actorUserId,
          targetEmployeeId: empId,
          action: 'LEAVE_REQUEST_CREATED_ON_BEHALF',
          entityType: 'LeaveRequest',
          entityId: leave.id,
          metadata: {
            batchReference,
            targetMode: data.targetMode,
            startDate: data.startDate,
            endDate: data.endDate,
            leaveType: data.leaveType
          }
        });

        created.push(leave);
      } catch (err: any) {
        failed.push({ employeeId: empId, reason: 'Internal error during creation.' });
      }
    }

    return {
      created,
      failed,
      summary: {
        requested: targetIds.length,
        created: created.length,
        failed: failed.length
      }
    };
  }

  /**
   * Head / supervisor recommendation — moves PENDING → FOR_REVIEW.
   *
   * The head recommends; they do NOT grant final approval. HR decides. The head
   * may endorse the request as filed, or endorse it with a PROPOSED CHANGE
   * (other dates or fewer days, with a reason) for HR to decide on. A proposal
   * never changes the request itself — the employee's dates stay as filed until
   * HR approves something different.
   */
  static async endorse(
    id: string,
    supervisorEmployeeId: string,
    note?: string,
    proposal?: { startDate?: unknown; endDate?: unknown; reason?: unknown } | null
  ) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id, deletedAt: null },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!leave) throw new AppError('Leave request not found', 404);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new AppError(
        `Only a pending request can be endorsed. This one is already ${leave.status}.`,
        400
      );
    }

    const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
      supervisorEmployeeId,
      leave.employeeId
    );
    if (!isSubordinate) {
      throw new AppError('You can only endorse leave requests from your own team members.', 403);
    }

    const endorsementNote = LeaveService.optionalText(note, 'The endorsement note', 1000);
    const change = proposal ? await LeaveService.changedPeriod(leave, proposal, 'proposed change') : null;
    const now = new Date();

    // Atomic transition. A second click or a retried request finds the row no
    // longer PENDING and performs no side effects.
    const moved = await prisma.$transaction(async (tx) => {
      const ok = await LeaveService.transitionStatus(tx, id, [LeaveStatus.PENDING], {
        status: LeaveStatus.FOR_REVIEW,
        endorsedAt: now,
        endorsementNote,
        ...(change
          ? {
              proposedStartDate: change.start,
              proposedEndDate: change.end,
              proposedTotalDays: change.days,
              proposalReason: change.reason,
              proposedAt: now,
            }
          : {}),
      });
      if (!ok) return false;
      // Relation keys cannot be set in the guarded updateMany; this caller has
      // already won the transition, so attaching them here is safe.
      await tx.leaveRequest.update({
        where: { id },
        data: {
          endorsedBy: { connect: { id: supervisorEmployeeId } },
          ...(change ? { proposedBy: { connect: { id: supervisorEmployeeId } } } : {}),
        },
      });
      return true;
    });

    if (!moved) {
      throw new AppError(
        'This request has already been acted on. Refresh to see its current status.',
        409
      );
    }

    const updated = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });
    const changeText = change ? `${LeaveService.periodText(change.start, change.end)} (${change.days} day${change.days === 1 ? '' : 's'})` : '';

    // HR now has something to decide on.
    const hrUserIds = await NotificationService.hrUserIds();
    await NotificationService.notifyMany(hrUserIds, {
      type: NotificationType.LEAVE_FILED,
      // NOTE: NotificationType has no LEAVE_ENDORSED member. Adding one is a
      // schema migration for a display label only, so the type stays LEAVE_FILED
      // and the title carries the distinction. The idempotency key below is the
      // part that matters for correctness.
      eventId: `leave-endorsed-hr:${leave.id}`,
      title: change ? 'Leave request endorsed with a proposed change' : 'Leave request endorsed for HR decision',
      message: change
        ? `${leave.employee.firstName} ${leave.employee.lastName}'s ${leave.leaveType.toLowerCase()} leave was endorsed by their head, who proposes ${changeText} instead. Awaiting your decision.`
        : `${leave.employee.firstName} ${leave.employee.lastName}'s ${leave.leaveType.toLowerCase()} leave was endorsed by their supervisor and is awaiting your decision.`,
      link: '/leave/requests',
    });

    const employeeUserId = await NotificationService.userIdForEmployee(leave.employeeId);
    if (employeeUserId) {
      await NotificationService.notify({
        userId: employeeUserId,
        type: NotificationType.LEAVE_FILED,
        eventId: `leave-endorsed-employee:${leave.id}`,
        title: change ? 'A change was proposed to your leave request' : 'Your leave request was endorsed',
        message: change
          ? `Your head endorsed your leave request to HR and proposed ${changeText} instead. Reason: ${change.reason}. HR will make the final decision.`
          : 'Your supervisor endorsed your leave request. It is now awaiting the HR decision.',
        link: '/leave/requests',
      });
    }

    return { ...updated, proposedChange: !!change };
  }

  /** "Oct 12, 2026 – Oct 14, 2026" for messages. */
  static periodText(start: Date, end: Date): string {
    const f = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return start.getTime() === end.getTime() ? f(start) : `${f(start)} – ${f(end)}`;
  }

  /**
   * Final approval — HR only.
   *
   * Accepts a request that is PENDING (no supervisor in the chain, or HR acting
   * directly) or FOR_REVIEW (already endorsed by the supervisor).
   *
   * HR approves either exactly what was requested, the head's proposed change
   * (`revision.useProposal`), or its own revised dates (`revision.startDate /
   * endDate / reason`). When the approved leave differs, the employee's ORIGINAL
   * request is kept in original* and startDate / endDate / totalDays become the
   * final leave — so calendars, attendance and balances all follow the final
   * leave, and the balance is charged the FINAL days, never the original ones.
   */
  static async approve(
    id: string,
    approverId: string,
    hrNotes?: string,
    revision?: { useProposal?: boolean; startDate?: unknown; endDate?: unknown; reason?: unknown } | null
  ) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id, deletedAt: null },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!leave) throw new AppError('Leave request not found', 404);
    if (leave.status !== LeaveStatus.PENDING && leave.status !== LeaveStatus.FOR_REVIEW) {
      throw new AppError(`Cannot approve a leave that is already ${leave.status}`, 400);
    }

    // The final period: as requested, the head's proposal, or HR's revision.
    let final: { start: Date; end: Date; days: number; reason: string } | null = null;
    if (revision?.useProposal) {
      if (!leave.proposedStartDate || !leave.proposedEndDate) {
        throw new AppError('There is no proposed change on this request to approve.', 400, undefined, 'VALIDATION_ERROR');
      }
      const reason = LeaveService.optionalText(revision.reason, 'The reason for the change', 1000) ?? leave.proposalReason ?? '';
      final = await LeaveService.changedPeriod(
        leave,
        { startDate: leave.proposedStartDate.toISOString(), endDate: leave.proposedEndDate.toISOString(), reason: reason || 'As proposed by the head.' },
        'revised leave'
      );
    } else if (revision && (revision.startDate || revision.endDate)) {
      final = await LeaveService.changedPeriod(leave, revision, 'revised leave');
    }

    const year = (final?.start ?? leave.startDate).getFullYear();
    const finalDays = final?.days ?? leave.totalDays;

    const outcome = await prisma.$transaction(async (tx) => {
      // The status precondition is part of the write. A concurrent or retried
      // approval finds count === 0 here and applies NO balance side effects.
      // `updateMany` cannot set relation-backed foreign keys, so the guarded
      // claim carries the scalar fields and the approver is attached immediately
      // afterwards inside the same transaction — safe, because this caller has
      // already won the claim.
      const moved = await LeaveService.transitionStatus(
        tx,
        id,
        [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW],
        {
          status: LeaveStatus.APPROVED,
          approvedAt: new Date(),
          hrNotes: LeaveService.optionalText(hrNotes, 'HR notes', 1000) ?? leave.hrNotes,
          // A different final leave keeps the original request beside it.
          ...(final
            ? {
                originalStartDate: leave.startDate,
                originalEndDate: leave.endDate,
                originalTotalDays: leave.totalDays,
                startDate: final.start,
                endDate: final.end,
                totalDays: final.days,
                adjustmentReason: final.reason,
              }
            : {}),
        }
      );
      if (!moved) return { moved: false as const, anomaly: null };

      await tx.leaveRequest.update({
        where: { id },
        data: { approvedBy: { connect: { id: approverId } } },
      });

      // Move the days from `pending` to `used` — but ONLY when HR has actually
      // configured a balance for this employee/year/type. HRISense must never
      // invent an entitlement (the old code created one with totalAllotted: 15).
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_year_leaveType: {
            employeeId: leave.employeeId,
            year,
            leaveType: leave.leaveType,
          },
        },
      });

      let anomaly: string | null = null;
      if (balance) {
        // `used` grows by the FINAL days (database-side arithmetic).
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: finalDays } },
        });
      }
      // What was reserved at filing — the ORIGINAL request — is released, by the
      // guarded helper so an underflow is reported rather than clamped.
      ({ anomaly } = await LeaveService.releasePendingDays(tx, leave, {
        action: 'LEAVE_APPROVED',
        leaveRequestId: id,
        actorUserId: null,
      }));

      return { moved: true as const, anomaly };
    });

    if (!outcome.moved) {
      throw new AppError(
        'This request has already been decided. Refresh to see its current status.',
        409
      );
    }

    const updated = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });

    // Side effects run only after the guarded transition actually succeeded.
    const employeeUserId = await NotificationService.userIdForEmployee(leave.employeeId);
    if (employeeUserId) {
      await NotificationService.notify({
        userId: employeeUserId,
        type: NotificationType.LEAVE_APPROVED,
        eventId: `leave-approved:${id}`,
        title: final ? 'Leave approved with changes' : 'Leave request approved',
        message: final
          ? `Your ${leave.leaveType.toLowerCase()} leave was approved for ${LeaveService.periodText(final.start, final.end)} (${final.days} day${final.days === 1 ? '' : 's'}) instead of ${LeaveService.periodText(leave.startDate, leave.endDate)} (${leave.totalDays} day${leave.totalDays === 1 ? '' : 's'}). Reason: ${final.reason}`
          : `Your ${leave.leaveType.toLowerCase()} leave from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been approved.`,
        link: '/leave/requests',
      });
    }

    const result: any = { ...updated, revised: !!final };
    return outcome.anomaly ? { ...result, balanceWarning: outcome.anomaly } : result;
  }

  /**
   * Reject a leave request.
   *
   * HR may reject a PENDING or FOR_REVIEW request. A supervisor may reject a
   * PENDING request from their own team before it reaches HR.
   */
  static async reject(
    id: string,
    rejectionReason: string,
    actor: { employeeId: string; permissionTier: PermissionTier }
  ) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id, deletedAt: null },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!leave) throw new AppError('Leave request not found', 404);

    if (actor.permissionTier === PermissionTier.SUPERVISOR) {
      if (leave.status !== LeaveStatus.PENDING) {
        throw new AppError(
          'This request has already moved to HR. Only HR can decide on it now.',
          400
        );
      }
      const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
        actor.employeeId,
        leave.employeeId
      );
      if (!isSubordinate) {
        throw new AppError('You can only act on leave requests from your own team members.', 403);
      }
    } else if (actor.permissionTier === PermissionTier.FULL) {
      if (leave.status !== LeaveStatus.PENDING && leave.status !== LeaveStatus.FOR_REVIEW) {
        throw new AppError(`Cannot reject a leave that is already ${leave.status}`, 400);
      }
    } else {
      throw new AppError('You do not have permission to decide on leave requests.', 403);
    }

    // A supervisor may only reject a PENDING request; HR may also reject one
    // already endorsed. The permitted source statuses become the precondition of
    // the atomic write, so a retry cannot re-run the balance release.
    const allowedFrom =
      actor.permissionTier === PermissionTier.SUPERVISOR
        ? [LeaveStatus.PENDING]
        : [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW];

    const outcome = await prisma.$transaction(async (tx) => {
      const moved = await LeaveService.transitionStatus(tx, id, allowedFrom, {
        status: LeaveStatus.REJECTED,
        rejectionReason,
      });
      if (!moved) return { moved: false as const, anomaly: null };

      const { anomaly } = await LeaveService.releasePendingDays(tx, leave, {
        action: 'LEAVE_REJECTED',
        leaveRequestId: id,
        actorUserId: null,
      });
      return { moved: true as const, anomaly };
    });

    if (!outcome.moved) {
      throw new AppError(
        'This request has already been decided. Refresh to see its current status.',
        409
      );
    }

    const updated = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });

    const employeeUserId = await NotificationService.userIdForEmployee(leave.employeeId);
    if (employeeUserId) {
      await NotificationService.notify({
        userId: employeeUserId,
        type: NotificationType.LEAVE_REJECTED,
        eventId: `leave-rejected:${id}`,
        title: 'Leave request not approved',
        message: `Your ${leave.leaveType.toLowerCase()} leave request was not approved. Reason: ${rejectionReason}`,
        link: '/leave/requests',
      });
    }

    return outcome.anomaly ? { ...updated, balanceWarning: outcome.anomaly } : updated;
  }

  /**
   * Cancel a leave request (own request, before a final decision is made).
   */
  static async cancel(id: string, requestingEmployeeId: string) {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id, deletedAt: null },
    });

    if (!leave) throw new AppError('Leave request not found', 404);
    if (leave.employeeId !== requestingEmployeeId) throw new AppError("You can only cancel your own leave requests.", 403);

    // HR's own leave skips review, so a mistake is caught by nobody: it may be
    // cancelled until the day it starts, and its days go back to the balance.
    if (leave.status === LeaveStatus.APPROVED && leave.approvedById === leave.employeeId) {
      return LeaveService.cancelAutoAccepted(leave);
    }

    if (leave.status !== LeaveStatus.PENDING && leave.status !== LeaveStatus.FOR_REVIEW) {
      throw new AppError('Only requests still awaiting a decision can be cancelled', 400);
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const moved = await LeaveService.transitionStatus(
        tx,
        id,
        [LeaveStatus.PENDING, LeaveStatus.FOR_REVIEW],
        { status: LeaveStatus.CANCELLED }
      );
      if (!moved) return { moved: false as const, anomaly: null };

      const { anomaly } = await LeaveService.releasePendingDays(tx, leave, {
        action: 'LEAVE_CANCELLED',
        leaveRequestId: id,
        actorUserId: null,
      });
      return { moved: true as const, anomaly };
    });

    if (!outcome.moved) {
      throw new AppError(
        'This request has already been acted on. Refresh to see its current status.',
        409
      );
    }

    const updated = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });
    return outcome.anomaly ? { ...updated, balanceWarning: outcome.anomaly } : updated;
  }

  /** Cancels HR's own automatically accepted leave before it starts. */
  private static async cancelAutoAccepted(leave: { id: string; employeeId: string; startDate: Date; leaveType: LeaveType; totalDays: number }) {
    if (leave.startDate <= instantToBusinessDate(new Date())) {
      throw new AppError('This leave has already started, so it can no longer be cancelled.', 400);
    }
    const year = leave.startDate.getFullYear();
    const moved = await prisma.$transaction(async (tx) => {
      const ok = await LeaveService.transitionStatus(tx, leave.id, [LeaveStatus.APPROVED], { status: LeaveStatus.CANCELLED });
      if (!ok) return false;
      // The days charged on filing go back (guarded: never below zero).
      await tx.leaveBalance.updateMany({
        where: { employeeId: leave.employeeId, year, leaveType: leave.leaveType, used: { gte: leave.totalDays } },
        data: { used: { decrement: leave.totalDays } },
      });
      return true;
    });
    if (!moved) {
      throw new AppError('This request has already been acted on. Refresh to see its current status.', 409);
    }
    return prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
  }

  // ── Leave balance administration (HR) ───────────────────────────────────────

  /**
   * Creates or updates one employee's leave balance for a year and leave type.
   *
   * A value entered here is HR's own (MANUAL) and the automatic entitlement never
   * overrides it. The completed-years entitlement covers Vacation, Sick,
   * Bereavement, Paternity and Solo Parent leave (LeaveEntitlementService); other
   * leave types have no confirmed entitlement and are only ever set here.
   */
  static async upsertBalance(
    actorUserId: string,
    data: {
      employeeId: string;
      year: number;
      leaveType: string;
      totalAllotted: number;
      forfeited?: number;
    }
  ) {
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    if (!Number.isFinite(data.totalAllotted) || data.totalAllotted < 0) {
      throw new AppError('Total allotted days must be zero or greater.', 400);
    }
    if (data.forfeited !== undefined && (!Number.isFinite(data.forfeited) || data.forfeited < 0)) {
      throw new AppError('Forfeited days must be zero or greater.', 400);
    }
    if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
      throw new AppError('Please provide a valid year.', 400);
    }

    const existing = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_year_leaveType: {
          employeeId: data.employeeId,
          year: data.year,
          leaveType: data.leaveType as LeaveType,
        },
      },
    });

    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_year_leaveType: {
          employeeId: data.employeeId,
          year: data.year,
          leaveType: data.leaveType as LeaveType,
        },
      },
      update: {
        totalAllotted: data.totalAllotted,
        ...(data.forfeited !== undefined ? { forfeited: data.forfeited } : {}),
        allotmentSource: 'MANUAL',
        entitlementCompletedYears: null,
        entitlementAppliedAt: null,
      },
      create: {
        employeeId: data.employeeId,
        year: data.year,
        leaveType: data.leaveType as LeaveType,
        totalAllotted: data.totalAllotted,
        forfeited: data.forfeited ?? 0,
        used: 0,
        pending: 0,
        allotmentSource: 'MANUAL',
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: data.employeeId,
      action: existing ? 'LEAVE_BALANCE_UPDATED' : 'LEAVE_BALANCE_CREATED',
      entityType: 'LeaveBalance',
      entityId: balance.id,
      oldValue: existing
        ? { totalAllotted: existing.totalAllotted, forfeited: existing.forfeited }
        : undefined,
      newValue: { totalAllotted: balance.totalAllotted, forfeited: balance.forfeited },
      metadata: { year: data.year, leaveType: data.leaveType },
    });

    return balance;
  }
}
