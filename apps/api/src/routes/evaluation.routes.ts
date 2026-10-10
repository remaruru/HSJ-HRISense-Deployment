import { Router } from 'express';
import { EvaluationController } from '../controllers/evaluation.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// ── Templates (HR FULL only) ──────────────────────────────────────────────────
router.get('/templates', authorize(['FULL']), EvaluationController.listTemplates);
router.get('/templates/:id', authorize(['FULL']), EvaluationController.getTemplate);
router.post('/templates', authorize(['FULL']), EvaluationController.createTemplate);
router.put('/templates/:id', authorize(['FULL']), EvaluationController.updateTemplate);
router.post('/templates/:id/deactivate', authorize(['FULL']), EvaluationController.deactivateTemplate);
router.post('/templates/:id/duplicate', authorize(['FULL']), EvaluationController.duplicateTemplate);
router.put('/templates/:id/job-roles', authorize(['FULL']), EvaluationController.setTemplateJobRoles);

// ── Configuration (HR FULL only): the official self / peer / head weighting ──
router.get('/config', authorize(['FULL']), EvaluationController.getConfig);

// ── Cycles (HR FULL only) ─────────────────────────────────────────────────────
router.get('/cycles', authorize(['FULL']), EvaluationController.listCycles);
router.get('/cycles/:id', authorize(['FULL']), EvaluationController.getCycle);
router.post('/cycles/preview', authorize(['FULL']), EvaluationController.previewCycle);
router.post('/cycles', authorize(['FULL']), EvaluationController.createCycle);
router.get('/designated-evaluators', authorize(['FULL']), EvaluationController.designatedEvaluators);
router.post('/cycles/:id/close', authorize(['FULL']), EvaluationController.closeCycle);

// ── Participants per employee (HR controls who evaluates) ─────────────────────
router.get('/cycles/:cycleId/employees/:employeeId/candidates', authorize(['FULL']), EvaluationController.evaluatorCandidates);
router.put('/cycles/:cycleId/employees/:employeeId/head', authorize(['FULL']), EvaluationController.setHeadEvaluator);
router.post('/cycles/:cycleId/employees/:employeeId/peers', authorize(['FULL']), EvaluationController.addPeers);
router.delete('/assignments/:id/peer', authorize(['FULL']), EvaluationController.removePeer);

// ── Assignments / Evaluator Workspace (HR, Supervisors, Employees) ───────────
router.get('/assignments', EvaluationController.listAssignments);
router.get('/assignments/:id', EvaluationController.getAssignment);
router.post('/assignments/:id/draft', EvaluationController.saveDraft);
router.post('/assignments/:id/submit', EvaluationController.submitEvaluation);
// The assigned head / supervisor / coordinator records the discussion.
router.post('/assignments/:id/discussion', EvaluationController.recordDiscussion);
router.post('/assignments/:id/finalize', authorize(['FULL']), EvaluationController.finalizeEvaluation);

// ── Employee History (Profile Tab & Self-View) ───────────────────────────────
router.get('/employees/:employeeId/history', EvaluationController.listEmployeeHistory);

export default router;
