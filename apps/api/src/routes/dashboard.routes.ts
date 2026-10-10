import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { DashboardOverviewService, phtEndOfDay } from '../services/dashboard-overview.service';
import { DashboardCalendarService } from '../services/dashboard-calendar.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.use(authenticate);

// Single endpoint — returns different data depending on permission tier
router.get('/stats', DashboardController.getStats);

// Compliance cards, To Do and Recent Activity — scoped by tier on the server.
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const data = await DashboardOverviewService.getOverview(req.user!);
    res.json({ success: true, data });
  })
);

// "See all" for Recent Activity: the caller's own history, newest first.
//   ?asOf=YYYY-MM-DD   start from the end of that day (Philippine time)
//   ?before=<ISO time> continue after the previous page's last item
router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const asOf = req.query.asOf ? String(req.query.asOf) : null;
    const beforeRaw = req.query.before ? String(req.query.before) : null;
    let before: Date | undefined;
    if (beforeRaw) {
      before = new Date(beforeRaw);
      if (Number.isNaN(before.getTime())) throw new AppError('before must be an ISO date-time.', 400);
    } else if (asOf) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) {
        throw new AppError('asOf must be YYYY-MM-DD.', 400);
      }
      before = phtEndOfDay(asOf);
    }
    const limit = Number(req.query.limit) || 30;
    const data = await DashboardOverviewService.myActivity(req.user!.userId, { before, limit });
    res.json({ success: true, data });
  })
);

// Holidays, leave, trainings and deadlines for the dashboard calendar — scoped by tier.
router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    if (!day.test(from) || !day.test(to) || to < from) {
      throw new AppError('Provide from and to as YYYY-MM-DD, with to on or after from.', 400);
    }
    const data = await DashboardCalendarService.getEvents(req.user!, from, to);
    res.json({ success: true, data });
  })
);

export default router;
