import { Router } from 'express';
import { LeaveController } from '../controllers/leave.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// ─── Balances ─────────────────────────────────────────────────────────────────
router.get('/balances', asyncHandler(LeaveController.getBalances));
// HR's own (manual) allotment — the automatic entitlement never overrides it.
router.put('/balances', authorize(['FULL']), asyncHandler(LeaveController.upsertBalance));

// ─── Completed-years entitlement ──────────────────────────────────────────────
router.get('/entitlements', asyncHandler(LeaveController.getEntitlements));
router.post('/entitlements/sync', authorize(['FULL']), asyncHandler(LeaveController.syncEntitlements));
router.post('/entitlements/:employeeId/apply', authorize(['FULL']), asyncHandler(LeaveController.applyEntitlement));

// ─── Calendar ─────────────────────────────────────────────────────────────────
router.get('/calendar', asyncHandler(LeaveController.getCalendar));

// ─── Requests ─────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(LeaveController.list));
router.post('/', asyncHandler(LeaveController.create));
router.post('/batch', asyncHandler(LeaveController.createBatch));
router.get('/:id', asyncHandler(LeaveController.getById));

// ─── Decision workflow ────────────────────────────────────────────────────────
// Supervisor endorses (PENDING → FOR_REVIEW); HR makes the final decision.
router.patch('/:id/endorse', authorize(['SUPERVISOR', 'FULL']), asyncHandler(LeaveController.endorse));
router.patch('/:id/approve', authorize(['FULL']), asyncHandler(LeaveController.approve));
// A supervisor may reject their own team's request while it is still PENDING.
router.patch('/:id/reject', authorize(['SUPERVISOR', 'FULL']), asyncHandler(LeaveController.reject));
router.patch('/:id/cancel', asyncHandler(LeaveController.cancel));

export default router;
