import { Request, Response, NextFunction } from 'express';
import { ComplianceService } from '../services/compliance.service';
import { AppError } from '../middleware/errorHandler';
import { OrgHierarchyService } from '../services/org-hierarchy.service';
import { OwnRecordService } from '../services/own-record.service';
import { NotificationService } from '../services/notification.service';
import { prisma } from '../config/prisma';
import { NotificationType } from '@prisma/client';

/**
 * Sister's heads-up when someone changes who a requirement applies to, or
 * archives one: HR could otherwise quietly exempt themselves. Nothing is
 * blocked; Sister only oversees.
 */
async function tellSisterAboutRule(actor: any, requirementId: string | null | undefined, change: string) {
  if (!requirementId) return;
  const [requirement, who] = await Promise.all([
    prisma.complianceRequirement.findUnique({ where: { id: requirementId }, select: { title: true } }),
    actor?.employeeId
      ? prisma.employee.findUnique({ where: { id: actor.employeeId }, select: { firstName: true, lastName: true } })
      : null,
  ]);
  const name = who ? `${who.firstName} ${who.lastName}`.trim() : 'Someone';
  await NotificationService.notifySister({
    type: NotificationType.COMPLIANCE_ALERT,
    eventId: `requirement-rule-sister:${requirementId}:${Date.now()}`,
    title: 'Compliance requirement changed',
    message: `${name} ${change} "${requirement?.title ?? 'a requirement'}". This is for your information only.`,
    link: '/compliance',
  }, actor?.userId);
}

export class ComplianceController {

  // ── Requirements ─────────────────────────────────────────────────────────────

  static async listRequirements(req: Request, res: Response, next: NextFunction) {
    try {
      const { lifecycle, category, search } = req.query as any;
      const data = await ComplianceService.listRequirements({ lifecycle, category, search });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getRequirement(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceService.getRequirementById(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async createRequirement(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.createRequirement(
        { ...req.body, createdById: user.userId },
        user.userId,
        req.ip,
        req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async updateRequirement(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.updateRequirement(
        req.params.id, req.body, user.userId, req.ip, req.headers['user-agent']
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async archiveRequirement(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await ComplianceService.archiveRequirement(req.params.id, user.userId, req.ip, req.headers['user-agent']);
      await tellSisterAboutRule(user, req.params.id, 'archived the requirement');
      res.json({ success: true, message: 'Requirement archived.' });
    } catch (err) { next(err); }
  }

  // ── Scopes ───────────────────────────────────────────────────────────────────

  static async addScope(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.addScope(
        req.params.id, req.body, user.userId, req.ip, req.headers['user-agent']
      );
      await tellSisterAboutRule(user, req.params.id, 'changed who must meet the requirement (added a group to)');
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteScope(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const scope = await prisma.complianceRequirementScope.findUnique({
        where: { id: req.params.scopeId }, select: { requirementId: true },
      });
      await ComplianceService.deleteScope(req.params.scopeId, user.userId, req.ip, req.headers['user-agent']);
      await tellSisterAboutRule(user, scope?.requirementId, 'changed who must meet the requirement (removed a group from)');
      res.json({ success: true, message: 'Scope removed.' });
    } catch (err) { next(err); }
  }

  // ── Employee Records ──────────────────────────────────────────────────────────

  static async listEmployeeRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const data = await ComplianceService.listEmployeeRecords(req.params.employeeId, currentUser);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async createEmployeeRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const employeeId = req.params.employeeId || req.body.employeeId;
      // HR's own record is accepted automatically, so it needs proof. This
      // module has no file upload: the proof is the certificate or reference number.
      const ownRecord = OwnRecordService.isOwn(user, employeeId);
      const reference = typeof req.body.referenceNumber === 'string' ? req.body.referenceNumber.trim() : '';
      if (ownRecord && !reference) {
        throw new AppError(
          'Add the certificate or reference number. Your own records are accepted automatically, so they need proof.',
          400, undefined, 'VALIDATION_ERROR'
        );
      }
      const data = await ComplianceService.createEmployeeRecord(
        {
          employeeId,
          ...req.body,
          completedAt: new Date(req.body.completedAt),
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
          createdById: user.userId,
        },
        user.userId, req.ip, req.headers['user-agent']
      );
      const autoAccepted = ownRecord
        ? await OwnRecordService.acceptWithProof('compliance', data.id, user, `reference no. ${reference}`)
        : false;
      res.status(201).json({ success: true, data: autoAccepted ? { ...data, reviewStatus: 'ACCEPTED' } : data, autoAccepted });
    } catch (err) { next(err); }
  }

  static async reviewRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.reviewRecord(
        req.params.recordId, req.body, user.userId, req.ip, req.headers['user-agent']
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await ComplianceService.softDeleteRecord(req.params.recordId, user.userId, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Record deleted.' });
    } catch (err) { next(err); }
  }

  // ── Dashboards & Workspaces ───────────────────────────────────────────────────

  static async getEmployeeSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = (req as any).user;
      const { employeeId } = req.params;

      if (currentUser.permissionTier === 'STANDARD' && currentUser.employeeId !== employeeId) {
        throw new AppError('Unauthorized', 403);
      }
      // The same rule as the records list: a supervisor reads their own and their
      // direct reports' compliance — it used to return anyone's summary.
      if (currentUser.permissionTier === 'SUPERVISOR' && currentUser.employeeId !== employeeId) {
        const isSubordinate = await OrgHierarchyService.isDirectSubordinate(currentUser.employeeId, employeeId);
        if (!isSubordinate) throw new AppError('Unauthorized. Not a direct subordinate.', 403);
      }

      const data = await ComplianceService.getEmployeeComplianceSummary(employeeId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getOrgSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceService.getOrgComplianceSummary();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getNeedsAttention(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceService.getNeedsAttentionItems();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getEmployeesComplianceList(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ComplianceService.getAllEmployeesComplianceList();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}
