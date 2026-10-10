import { Router } from 'express';
import { z } from 'zod';
import { AttendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Body schema for an HR manual attendance correction.
 *
 * Previously this route had no validation at all: the service cast
 * `data.status as any` and handed it straight to Prisma, so a bad status or an
 * unparseable time surfaced as an opaque database error rather than a clear 400.
 *
 * `null` is meaningful and distinct from omission — clearing a time-out is a
 * legitimate correction — so nullable fields accept it explicitly while omitted
 * fields leave the stored value untouched.
 */
const ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'REST_DAY',
  'SUSPENDED',
] as const;

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Must be a valid date and time');

const updateAttendanceSchema = z.object({
  body: z
    .object({
      timeIn: isoDateTime.nullable().optional(),
      timeOut: isoDateTime.nullable().optional(),
      status: z.enum(ATTENDANCE_STATUSES).optional(),
      hoursWorked: z.number().min(0).max(24).nullable().optional(),
      overtimeHours: z.number().min(0).max(24).nullable().optional(),
      remarks: z.string().max(1000).nullable().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update')
    .refine(
      (b) =>
        !b.timeIn ||
        !b.timeOut ||
        new Date(b.timeOut).getTime() >= new Date(b.timeIn).getTime(),
      { message: 'Time out cannot be earlier than time in', path: ['timeOut'] }
    ),
});

router.use(authenticate);

// Today's summary (HR only — for dashboard)
router.get('/summary/today', authorize(['FULL']), asyncHandler(AttendanceController.getTodaySummary));

// Attendance calendar
router.get('/calendar', asyncHandler(AttendanceController.getCalendar));

// Work schedules (all tiers, scoped) — IMPORTANT: register before /:id to prevent swallowing
router.get('/schedule', asyncHandler(AttendanceController.getSchedules));

// Attendance tally — per-employee summary for a date range (all tiers, scope-enforced in service)
router.get('/tally', asyncHandler(AttendanceController.getTally));

// Attendance logs (late/tardiness) — HR + Supervisor only
router.get('/logs', authorize(['FULL', 'SUPERVISOR']), asyncHandler(AttendanceController.getLogs));

// Attendance records — all (own/subordinates/all based on tier)
router.get('/', asyncHandler(AttendanceController.list));

// HR can update records
router.put(
  '/:id',
  authorize(['FULL']),
  validate(updateAttendanceSchema),
  asyncHandler(AttendanceController.update)
);


// Export endpoints
router.post('/export/excel', asyncHandler(AttendanceController.exportExcel));
router.post('/export/pdf', asyncHandler(AttendanceController.exportPDF));

export default router;

