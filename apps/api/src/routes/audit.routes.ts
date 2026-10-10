import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../utils/asyncHandler';
import { AuditService } from '../services/audit.service';
import { AUDIT_ACTION_TYPES, AUDIT_MODULES, AUDIT_TABS, AuditActionType, AuditModule, AuditTab } from '../services/audit-catalog';

const router = Router();

// Audit history is HR-only.
router.use(authenticate);
router.use(authorize(['FULL']));

/** A query value only when it is one of the allowed ids; anything else is ignored. */
const oneOf = <T extends string>(value: unknown, allowed: readonly string[]): T | undefined =>
  typeof value === 'string' && allowed.includes(value) ? (value as T) : undefined;
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : undefined);

/** GET /audit/options — the tabs, modules, action types and actors that occur. */
router.get(
  '/options',
  asyncHandler(async (_req, res) => {
    const options = await AuditService.getFilterOptions();
    res.json({ success: true, data: options });
  })
);

/** GET /audit — paginated, filterable, readable audit trail. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = req.query;
    const result = await AuditService.list({
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 25,
      tab: oneOf<AuditTab | 'ALL'>(q.tab, ['ALL', ...AUDIT_TABS.map((t) => t.id)]) ?? 'ALL',
      module: oneOf<AuditModule>(q.module, Object.keys(AUDIT_MODULES)),
      actionType: oneOf<AuditActionType>(q.actionType, Object.keys(AUDIT_ACTION_TYPES)),
      outcome: oneOf<'SUCCESS' | 'FAILURE'>(q.outcome, ['SUCCESS', 'FAILURE']),
      search: text(q.search),
      target: text(q.target),
      actorUserId: text(q.actorUserId),
      dateFrom: text(q.dateFrom),
      dateTo: text(q.dateTo),
    });
    res.json({ success: true, ...result });
  })
);

export default router;
