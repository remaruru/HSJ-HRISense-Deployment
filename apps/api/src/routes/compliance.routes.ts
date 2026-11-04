import { Router } from 'express';
import { ComplianceController } from '../controllers/compliance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  requireHrAuthorityOver, refuseOwn, targetFromParamOrBody, targetOfComplianceRecord,
  OWN_RECORD_REVIEW, OWN_RECORD_DELETE,
} from '../middleware/hr-authority';

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
// The HR rule, as for medical and psychological records. HR's own compliance
// record is accepted automatically when it carries a reference number.
const hrOverNewRecord = requireHrAuthorityOver(targetFromParamOrBody('employeeId'));
router.post('/employees/:employeeId/records', authorize(['FULL']), hrOverNewRecord, ComplianceController.createEmployeeRecord);
router.post('/records', authorize(['FULL']), hrOverNewRecord, ComplianceController.createEmployeeRecord);
router.patch('/records/:recordId/review', authorize(['FULL']), requireHrAuthorityOver(targetOfComplianceRecord),
  refuseOwn(targetOfComplianceRecord, OWN_RECORD_REVIEW), ComplianceController.reviewRecord);
router.delete('/records/:recordId', authorize(['FULL']), requireHrAuthorityOver(targetOfComplianceRecord),
  refuseOwn(targetOfComplianceRecord, OWN_RECORD_DELETE), ComplianceController.deleteRecord);

export default router;
