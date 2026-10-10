import { Router } from 'express';
import { DraftController } from '../controllers/draft.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Onboarding drafts are unfinished employee records created by the HR-only
// onboarding wizard. Previously any signed-in user could create one through the
// API, and it would then appear in HR's Draft Employees list.
router.use(authenticate);
router.use(authorize(['FULL']));

router.post('/', DraftController.create);
router.get('/', DraftController.list);
router.get('/:id', DraftController.getById);
router.put('/:id', DraftController.update);
router.delete('/:id', DraftController.delete);

export { router as draftRoutes };
