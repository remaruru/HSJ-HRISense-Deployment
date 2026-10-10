import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// ── Summary & Actionable Items ────────────────────────────────────────────────
router.get('/summary', authorize(['FULL']), ComplianceController.getOrgSummary);
router.get('/needs-attention', authorize(['FULL']), ComplianceController.getNeedsAttention);
router.get('/employees-list', authorize(['FULL']), ComplianceController.getEmployeesComplianceList);
router.get('/employees/:employeeId/summary', ComplianceController.getEmployeeSummary);

// ── Requirements Management (HR FULL only) ───────────────────────────────────
router.get('/requirements', authorize(['FULL']), ComplianceController.listRequirements);
router.get('/requirements/:id', authorize(['FULL']), ComplianceController.getRequirement);
router.post('/requirements', authorize(['FULL']), ComplianceController.createRequirement);
router.patch('/requirements/:id', authorize(['FULL']), ComplianceController.updateRequirement);
router.delete('/requirements/:id', authorize(['FULL']), ComplianceController.archiveRequirement);

// ── Scopes Management (HR FULL only) ──────────────────────────────────────────
router.post('/requirements/:id/scopes', authorize(['FULL']), ComplianceController.addScope);
router.delete('/scopes/:scopeId', authorize(['FULL']), ComplianceController.deleteScope);

// ── Employee Fulfillment Records ──────────────────────────────────────────────
router.get('/employees/:employeeId/records', ComplianceController.listEmployeeRecords);
router.post('/employees/:employeeId/records', authorize(['FULL']), ComplianceController.createEmployeeRecord);
router.post('/records', authorize(['FULL']), ComplianceController.createEmployeeRecord);
router.patch('/records/:recordId/review', authorize(['FULL']), ComplianceController.reviewRecord);
router.delete('/records/:recordId', authorize(['FULL']), ComplianceController.deleteRecord);

export default router;
