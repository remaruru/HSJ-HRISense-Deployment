import { Router } from 'express';
import { ScheduleController } from '../controllers/schedule.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

// Templates (HR Only - Checked in Controller)
router.post('/templates', ScheduleController.createTemplate);
router.put('/templates/:id', ScheduleController.updateTemplate);
router.get('/templates', ScheduleController.listTemplates);

// Employees (HR or Supervisor)
router.get('/employees', ScheduleController.getEmployeeSchedules);

// Coverage (HR or Supervisor)
router.get('/coverage', ScheduleController.getCoverage);

// Assignments (HR or Supervisor - Checked in Controller)
router.post('/assignments', ScheduleController.assignSchedule);


// History (HR or Supervisor)
router.get('/history', ScheduleController.listHistory);

export default router;
