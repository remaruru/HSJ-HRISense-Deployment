import { NextFunction, Request, Response, Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { HrContactService } from '../services/hr-contact.service';

const router = Router();

router.use(authenticate);

// Only HR manages the HR office contact (Settings). Everyone else reaches it through AI Assistance.
router.use(authorize(['FULL']));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await HrContactService.get() });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await HrContactService.update(req.body, req.user!.userId) });
  } catch (err) {
    next(err);
  }
});

export default router;
