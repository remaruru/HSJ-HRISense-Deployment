import { LeaveEntitlementService } from '../services/leave-entitlement.service';
import { Request, Response, NextFunction } from 'express';
import { LeaveService } from '../services/leave.service';
import { createAuditLog } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';

export class LeaveController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, employeeId, year, scope, unitId, departmentId, leaveType } = req.query;
      const result = await LeaveService.list(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 20,
          status: status as string,
          employeeId: employeeId as string,
          year: year ? Number(year) : undefined,
          scope: scope as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          leaveType: leaveType as string,
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const { start, end, scope, unitId, departmentId, employeeId, status, leaveType } = req.query;
      const events = await LeaveService.getCalendarEvents(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          start: start as string,
          end: end as string,
          scope: scope as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          employeeId: employeeId as string,
          status: status as string,
          leaveType: leaveType as string,
        }
      );
      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const leave = await LeaveService.getById(
        req.params.id,
        (req.user!.employeeId || ''),
        req.user!.permissionTier
      );
      res.json({ success: true, data: leave });
    } catch (err) {
      next(err);
    }
  }

  static async getBalances(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req.query.employeeId as string) || (req.user!.employeeId || '');
      const balances = await LeaveService.getBalances(
        employeeId,
        (req.user!.employeeId || ''),
        req.user!.permissionTier
      );
      res.json({ success: true, data: balances });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const leave = await LeaveService.create((req.user!.employeeId || ''), req.body);

      await createAuditLog({
        userId: req.user!.userId,
        action: 'LEAVE_FILED',
        resource: 'LeaveRequest',
        resourceId: leave.id,
        newValue: { leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: leave });
    } catch (err) {
      next(err);
    }
  }

  static async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeaveService.createBatch(
        req.user!.userId,
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        req.body
      );

      // Status 201 if fully successful, 207 Multi-Status if partial success, 400 if fully failed.
      let statusCode = 201;
      if (result.failed.length > 0 && result.created.length > 0) statusCode = 207;
      if (result.failed.length > 0 && result.created.length === 0) statusCode = 400;

      res.status(statusCode).json({ success: result.created.length > 0, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const leave: any = await LeaveService.approve(
        req.params.id,
        (req.user!.employeeId || ''),
        req.body.hrNotes,
        req.body.revision ?? null
      );

      const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
      await createAuditLog({
        userId: req.user!.userId,
        action: leave.revised ? 'LEAVE_APPROVED_WITH_REVISION' : 'LEAVE_APPROVED',
        resource: 'LeaveRequest',
        resourceId: req.params.id,
        newValue: {
          status: 'APPROVED',
          approvedBy: (req.user!.employeeId || ''),
          ...(leave.revised
            ? {
                originalStartDate: leave.originalStartDate,
                originalEndDate: leave.originalEndDate,
                originalTotalDays: leave.originalTotalDays,
                startDate: leave.startDate,
                endDate: leave.endDate,
                totalDays: leave.totalDays,
                detail: `${LeaveService.periodText(leave.startDate, leave.endDate)} (${days(leave.totalDays)}) instead of ${LeaveService.periodText(leave.originalStartDate, leave.originalEndDate)} (${days(leave.originalTotalDays)}). Reason: ${leave.adjustmentReason}`,
              }
            : {}),
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: leave });
    } catch (err) {
      next(err);
    }
  }

  /** Supervisor endorsement — PENDING → FOR_REVIEW. Not a final approval. */
  static async endorse(req: Request, res: Response, next: NextFunction) {
    try {
      const leave: any = await LeaveService.endorse(
        req.params.id,
        req.user!.employeeId || '',
        req.body?.note,
        req.body?.proposal ?? null
      );

      const n = leave.proposedTotalDays;
      await createAuditLog({
        userId: req.user!.userId,
        action: leave.proposedChange ? 'LEAVE_REVISION_PROPOSED' : 'LEAVE_ENDORSED',
        resource: 'LeaveRequest',
        resourceId: req.params.id,
        newValue: {
          status: 'FOR_REVIEW',
          endorsedBy: req.user!.employeeId,
          ...(leave.proposedChange
            ? {
                proposedStartDate: leave.proposedStartDate,
                proposedEndDate: leave.proposedEndDate,
                proposedTotalDays: n,
                detail: `Proposed ${LeaveService.periodText(leave.proposedStartDate, leave.proposedEndDate)} (${n} day${n === 1 ? '' : 's'}). Reason: ${leave.proposalReason}`,
              }
            : leave.endorsementNote
              ? { detail: `Note: ${leave.endorsementNote}` }
              : {}),
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: leave,
        message: leave.proposedChange ? 'Endorsed to HR with your proposed change.' : 'Leave request endorsed and sent to HR.',
      });
    } catch (err) {
      next(err);
    }
  }

  /** HR configures an employee's leave entitlement for a year and leave type. */
  /** GET /leave/entitlements?employeeId= — the completed-years entitlement explained. */
  static async getEntitlements(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req.query.employeeId as string) || (req.user!.employeeId || '');
      if (req.user!.permissionTier !== 'FULL' && employeeId !== req.user!.employeeId) {
        throw new AppError("You can only view your own leave entitlement.", 403);
      }
      await LeaveEntitlementService.syncEmployee(employeeId);
      res.json({ success: true, data: await LeaveEntitlementService.describe(employeeId) });
    } catch (err) {
      next(err);
    }
  }

  /** POST /leave/entitlements/sync — HR brings every active employee up to date. */
  static async syncEntitlements(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeaveEntitlementService.syncAll(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /** POST /leave/entitlements/:employeeId/apply — HR switches a manual balance to the policy. */
  static async applyEntitlement(req: Request, res: Response, next: NextFunction) {
    try {
      const { leaveType } = req.body ?? {};
      if (!leaveType) throw new AppError('leaveType is required.', 400);
      const data = await LeaveEntitlementService.applyPolicy(req.params.employeeId, leaveType, req.user!.userId);
      res.json({ success: true, data, message: 'Balance now follows the automatic entitlement.' });
    } catch (err) {
      next(err);
    }
  }

  static async upsertBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, year, leaveType, totalAllotted, forfeited } = req.body;

      if (!employeeId || !leaveType || year === undefined || totalAllotted === undefined) {
        throw new AppError(
          'employeeId, year, leaveType and totalAllotted are all required.',
          400
        );
      }

      const balance = await LeaveService.upsertBalance(req.user!.userId, {
        employeeId,
        year: Number(year),
        leaveType,
        totalAllotted: Number(totalAllotted),
        forfeited: forfeited === undefined ? undefined : Number(forfeited),
      });

      res.json({ success: true, data: balance, message: 'Leave balance saved.' });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const { rejectionReason } = req.body;
      if (!rejectionReason || !String(rejectionReason).trim()) {
        throw new AppError('A reason is required when rejecting a leave request.', 400);
      }
      const leave = await LeaveService.reject(req.params.id, String(rejectionReason).trim(), {
        employeeId: req.user!.employeeId || '',
        permissionTier: req.user!.permissionTier,
      });

      await createAuditLog({
        userId: req.user!.userId,
        action: 'LEAVE_REJECTED',
        resource: 'LeaveRequest',
        resourceId: req.params.id,
        newValue: { status: 'REJECTED', reason: rejectionReason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: leave });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const leave = await LeaveService.cancel(req.params.id, (req.user!.employeeId || ''));

      await createAuditLog({
        userId: req.user!.userId,
        action: 'LEAVE_CANCELLED',
        resource: 'LeaveRequest',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: leave });
    } catch (err) {
      next(err);
    }
  }
}
