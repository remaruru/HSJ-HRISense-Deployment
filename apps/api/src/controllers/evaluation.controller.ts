import { Request, Response, NextFunction } from 'express';
import { EvaluationService } from '../services/evaluation.service';
import { AppError } from '../middleware/errorHandler';

export class EvaluationController {
  // ── Templates (HR FULL only) ────────────────────────────────────────────────
  static async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive, search } = req.query;
      const templates = await EvaluationService.listTemplates({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search: search as string,
      });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  static async getTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const template = await EvaluationService.getTemplate(id);
      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  static async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await EvaluationService.createTemplate(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: template, message: 'Template created successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const template = await EvaluationService.updateTemplate(id, req.body, req.user?.userId);
      res.json({ success: true, data: template, message: 'Template updated successfully' });
    } catch (err) {
      next(err);
    }
  }

  /** Copy any template (official or custom) into a new custom template HR can edit. */
  static async duplicateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await EvaluationService.duplicateTemplate(req.params.id, req.body ?? {}, req.user?.userId);
      res.status(201).json({ success: true, data: template, message: 'Template duplicated as a custom template' });
    } catch (err) {
      next(err);
    }
  }

  /** Which job roles use a template — allowed on official templates too. */
  static async setTemplateJobRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await EvaluationService.setJobRoles(req.params.id, req.body?.jobRoleIds, req.user?.userId);
      res.json({ success: true, data: template, message: 'Job roles updated' });
    } catch (err) {
      next(err);
    }
  }

  static async deactivateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const template = await EvaluationService.deactivateTemplate(id, req.user?.userId);
      res.json({ success: true, data: template, message: 'Template deactivated' });
    } catch (err) {
      next(err);
    }
  }

  // ── Cycles (HR FULL only) ───────────────────────────────────────────────────
  static async listCycles(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const cycles = await EvaluationService.listCycles({
        status: status as any,
        search: search as string,
      });
      res.json({ success: true, data: cycles });
    } catch (err) {
      next(err);
    }
  }

  static async getCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cycle = await EvaluationService.getCycle(id);
      res.json({ success: true, data: cycle });
    } catch (err) {
      next(err);
    }
  }

  static async createCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const cycle = await EvaluationService.createCycle(req.body ?? {}, EvaluationController.actor(req));
      res.status(201).json({ success: true, data: cycle, message: 'Evaluation cycle created' });
    } catch (err) {
      next(err);
    }
  }

  /** The official evaluation weighting (self 20 / peer 20 / head 60), from the one place it is set. */
  static async getConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: EvaluationService.getConfig() });
    } catch (err) {
      next(err);
    }
  }

  /** Who a new cycle would cover, and with which template (job-role mappings first). */
  static async previewCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const preview = await EvaluationService.previewCycle(req.body ?? {});
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  }

  /** Who may be a new cycle's designated evaluator (never HR / full-access administrators). */
  static async designatedEvaluators(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EvaluationService.designatedEvaluatorOptions(EvaluationController.actor(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async closeCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cycle = await EvaluationService.closeCycle(id, req.user?.userId);
      res.json({ success: true, data: cycle, message: 'Evaluation cycle closed' });
    } catch (err) {
      next(err);
    }
  }

  // ── Assignments / Evaluator Workspace ───────────────────────────────────────
  static async listAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { cycleId, evaluatorId, employeeId, status, search, raterType, mine } = req.query;
      const assignments = await EvaluationService.listAssignments(
        {
          id: req.user.userId,
          employeeId: req.user.employeeId,
          permissionTier: req.user.permissionTier,
        },
        {
          cycleId: cycleId as string,
          evaluatorId: evaluatorId as string,
          employeeId: employeeId as string,
          status: status as any,
          search: search as string,
          raterType: raterType as any,
          mine: mine === 'true',
        }
      );
      res.json({ success: true, data: assignments });
    } catch (err) {
      next(err);
    }
  }

  static async getAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id } = req.params;
      const assignment = await EvaluationService.getAssignment(id, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: assignment });
    } catch (err) {
      next(err);
    }
  }

  static async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id } = req.params;
      const assignment = await EvaluationService.saveDraft(id, req.body, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: assignment, message: 'Draft saved successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async submitEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id } = req.params;
      const assignment = await EvaluationService.submitEvaluation(id, req.body, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: assignment, message: 'Evaluation submitted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async finalizeEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { id } = req.params;
      const assignment = await EvaluationService.finalizeEvaluation(id, req.body, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: assignment, message: 'Evaluation finalized' });
    } catch (err) {
      next(err);
    }
  }

  // ── Participants (HR) and discussion (head evaluator) ─────────────────────
  private static actor(req: Request) {
    if (!req.user) throw new AppError('Authentication required', 401);
    return { id: req.user.userId, employeeId: req.user.employeeId, permissionTier: req.user.permissionTier };
  }

  static async evaluatorCandidates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EvaluationService.evaluatorCandidates(req.params.cycleId, req.params.employeeId, EvaluationController.actor(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async setHeadEvaluator(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EvaluationService.setHeadEvaluator(req.params.cycleId, req.params.employeeId, req.body?.evaluatorId, EvaluationController.actor(req));
      res.json({ success: true, data, message: 'Head / supervisor / coordinator evaluator assigned' });
    } catch (err) {
      next(err);
    }
  }

  static async addPeers(req: Request, res: Response, next: NextFunction) {
    try {
      const ids = Array.isArray(req.body?.evaluatorIds) ? req.body.evaluatorIds : [];
      const data = await EvaluationService.addPeers(req.params.cycleId, req.params.employeeId, ids, EvaluationController.actor(req));
      res.json({ success: true, data, message: 'Peer evaluators added' });
    } catch (err) {
      next(err);
    }
  }

  static async removePeer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EvaluationService.removePeer(req.params.id, EvaluationController.actor(req));
      res.json({ success: true, data, message: 'Peer evaluator removed' });
    } catch (err) {
      next(err);
    }
  }

  static async recordDiscussion(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EvaluationService.recordDiscussion(req.params.id, req.body ?? {}, EvaluationController.actor(req));
      res.json({ success: true, data, message: 'Discussion with the employee recorded' });
    } catch (err) {
      next(err);
    }
  }

  // ── Employee History (Profile Tab) ──────────────────────────────────────────
  static async listEmployeeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { employeeId } = req.params;
      const history = await EvaluationService.listEmployeeEvaluationHistory(employeeId, {
        id: req.user.userId,
        employeeId: req.user.employeeId,
        permissionTier: req.user.permissionTier,
      });
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
}
