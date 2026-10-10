import { Request, Response, NextFunction } from 'express';
import { ComplianceService } from '../services/compliance.service';
import { AppError } from '../middleware/errorHandler';
import { OrgHierarchyService } from '../services/org-hierarchy.service';

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
        { ...req.body, createdById: user.id },
        user.id,
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
        req.params.id, req.body, user.id, req.ip, req.headers['user-agent']
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async archiveRequirement(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await ComplianceService.archiveRequirement(req.params.id, user.id, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Requirement archived.' });
    } catch (err) { next(err); }
  }

  // ── Scopes ───────────────────────────────────────────────────────────────────

  static async addScope(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.addScope(
        req.params.id, req.body, user.id, req.ip, req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteScope(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await ComplianceService.deleteScope(req.params.scopeId, user.id, req.ip, req.headers['user-agent']);
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
      const data = await ComplianceService.createEmployeeRecord(
        {
          employeeId,
          ...req.body,
          completedAt: new Date(req.body.completedAt),
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
          createdById: user.id,
        },
        user.id, req.ip, req.headers['user-agent']
      );
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async reviewRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await ComplianceService.reviewRecord(
        req.params.recordId, req.body, user.id, req.ip, req.headers['user-agent']
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      await ComplianceService.softDeleteRecord(req.params.recordId, user.id, req.ip, req.headers['user-agent']);
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
