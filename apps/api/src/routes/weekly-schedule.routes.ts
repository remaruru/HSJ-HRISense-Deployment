import { Router } from 'express';
import { WeeklyScheduleController } from '../controllers/weekly-schedule.controller';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// Shift Definitions
router.get('/shifts', asyncHandler(WeeklyScheduleController.listShifts));
router.post('/shifts', asyncHandler(WeeklyScheduleController.createShift));
router.put('/shifts/:id', asyncHandler(WeeklyScheduleController.updateShift));
router.delete('/shifts/:id', asyncHandler(WeeklyScheduleController.deactivateShift));

// Employee Weekly Schedules
router.get('/employees/:employeeId', asyncHandler(WeeklyScheduleController.getEmployeeWeeklySchedule));
router.post('/employees/:employeeId', asyncHandler(WeeklyScheduleController.saveEmployeeWeeklySchedule));

export default router;
