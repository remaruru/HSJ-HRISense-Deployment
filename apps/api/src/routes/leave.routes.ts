import { Router } from 'express';
import { LeaveController } from '../controllers/leave.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import {
  requireHrAuthorityOver, refuseOwn, targetFromBody, targetFromParam, targetOfLeave,
  OWN_LEAVE_BALANCE, OWN_LEAVE_DECISION,
} from '../middleware/hr-authority';

const router = Router();

router.use(authenticate);

// ─── Balances ─────────────────────────────────────────────────────────────────
router.get('/balances', asyncHandler(LeaveController.getBalances));
// HR's own (manual) allotment — the automatic entitlement never overrides it.
// Nobody changes their own balance; HR never changes another HR person's or Sister's.
router.put('/balances', authorize(['FULL']), requireHrAuthorityOver(targetFromBody('employeeId')),
  refuseOwn(targetFromBody('employeeId'), OWN_LEAVE_BALANCE), asyncHandler(LeaveController.upsertBalance));

// ─── Completed-years entitlement ──────────────────────────────────────────────
router.get('/entitlements', asyncHandler(LeaveController.getEntitlements));
router.post('/entitlements/sync', authorize(['FULL']), asyncHandler(LeaveController.syncEntitlements));
router.post('/entitlements/:employeeId/apply', authorize(['FULL']), requireHrAuthorityOver(targetFromParam('employeeId')),
  refuseOwn(targetFromParam('employeeId'), OWN_LEAVE_BALANCE), asyncHandler(LeaveController.applyEntitlement));

// ─── Calendar ─────────────────────────────────────────────────────────────────
router.get('/calendar', asyncHandler(LeaveController.getCalendar));

// ─── Requests ─────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(LeaveController.list));
router.post('/', asyncHandler(LeaveController.create));
router.post('/batch', asyncHandler(LeaveController.createBatch));
router.get('/:id', asyncHandler(LeaveController.getById));

// ─── Decision workflow ────────────────────────────────────────────────────────
// Supervisor endorses (PENDING → FOR_REVIEW); HR makes the final decision.
// HR never decides another HR person's or Sister's leave, and nobody decides
// their own: HR's own leave is accepted automatically when filed.
const hrOverLeave = [requireHrAuthorityOver(targetOfLeave), refuseOwn(targetOfLeave, OWN_LEAVE_DECISION)];
router.patch('/:id/endorse', authorize(['SUPERVISOR', 'FULL']), ...hrOverLeave, asyncHandler(LeaveController.endorse));
router.patch('/:id/approve', authorize(['FULL']), ...hrOverLeave, asyncHandler(LeaveController.approve));
// A supervisor may reject their own team's request while it is still PENDING.
router.patch('/:id/reject', authorize(['SUPERVISOR', 'FULL']), ...hrOverLeave, asyncHandler(LeaveController.reject));
router.patch('/:id/cancel', asyncHandler(LeaveController.cancel));

export default router;
