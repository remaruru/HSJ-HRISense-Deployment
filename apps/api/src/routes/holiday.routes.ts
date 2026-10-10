import { Router } from 'express';
import { HolidayController } from '../controllers/holiday.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// HR ONLY routes (Authorization handled in Controller via SchedulingPolicy)
router.post('/suggestions/fetch', HolidayController.fetchSuggestions);
router.patch('/suggestions/:id/status', HolidayController.updateSuggestionStatus);
router.post('/manual', HolidayController.createManualEntry);
router.patch('/manual/:id', HolidayController.updateManualEntry);
// Units expected to work on an entry (everyone else observes it).
router.put('/:id/working-units', HolidayController.setWorkingUnits);
// Deactivate (never a hard delete — historical attendance is read against these
// entries). Both verbs are accepted so existing clients keep working.
router.post('/manual/:id/deactivate', HolidayController.deactivateEntry);
router.delete('/manual/:id', HolidayController.deactivateEntry);

// Viewable by all authenticated users (read-only for standard/supervisor)
router.get('/', HolidayController.list);

export default router;
