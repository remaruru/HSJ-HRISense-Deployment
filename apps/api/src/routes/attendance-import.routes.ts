import { Router } from 'express';
import { z } from 'zod';
import { AttendanceImportController } from '../controllers/attendance-import.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { createDiskUpload } from '../middleware/upload';
import { ATTENDANCE_IMPORT_MAX_BYTES } from '../services/attendance-import/attendance-import.service';

const router = Router();

/**
 * Attendance import. HR only, on every route.
 *
 * Importing rewrites attendance for the whole organisation, so this is not
 * something a supervisor may do for their team — the existing attendance RBAC
 * (HR org-wide, supervisor team, employee self) governs READING the result and
 * is untouched by this router.
 */
router.use(authenticate, authorize(['FULL']));

/*
 * The timekeeping system exports legacy `.xls`, and browsers are inconsistent
 * about the MIME type they attach to it — Chrome sends application/vnd.ms-excel,
 * others send octet-stream. The list is therefore permissive and the REAL check
 * is the file's magic bytes, done in the service before anything is parsed.
 */
const upload = createDiskUpload({
  subdir: 'attendance-imports',
  allowedMimeTypes: [
    'application/vnd.ms-excel',
    'application/msexcel',
    'application/x-msexcel',
    'application/x-ms-excel',
    'application/x-excel',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  maxFileSizeBytes: ATTENDANCE_IMPORT_MAX_BYTES,
  maxFiles: 1,
  typeErrorMessage:
    'Invalid file type. Upload the .xls attendance export produced by the timekeeping system.',
});

const decideSchema = z.object({
  body: z.object({
    // A month of imported rows for every employee fits; a runaway request does not.
    candidateIds: z.array(z.string().uuid()).min(1, 'Select at least one record.').max(10000, 'Too many records in one request.'),
    decision: z.enum(['KEEP_EXISTING', 'USE_UPLOADED', 'SKIP']),
    reason: z.string().trim().max(500).optional(),
  }),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const correctSchema = z.object({
  body: z.object({
    sessions: z
      .array(z.object({ in: z.string().regex(HHMM, 'Use a 24-hour time like 08:00.'), out: z.string().regex(HHMM, 'Use a 24-hour time like 17:00.') }))
      .max(6, 'At most six clock-in/clock-out pairs.'),
    status: z.enum(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE']),
    reason: z.string().trim().min(3, 'Say why this day was corrected.').max(500),
  }),
});

const mapCodeSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid(),
    code: z.string().trim().min(1).max(40),
  }),
});

router.get('/', asyncHandler(AttendanceImportController.list));
router.post('/', upload.single('file'), asyncHandler(AttendanceImportController.upload));
router.get('/:id/preview', asyncHandler(AttendanceImportController.preview));
router.post('/:id/decisions', validate(decideSchema), asyncHandler(AttendanceImportController.decide));
router.post('/:id/candidates/:candidateId/correct', validate(correctSchema), asyncHandler(AttendanceImportController.correct));
router.post('/:id/apply', asyncHandler(AttendanceImportController.apply));
router.post('/:id/cancel', asyncHandler(AttendanceImportController.cancel));
router.post('/map-code', validate(mapCodeSchema), asyncHandler(AttendanceImportController.mapCode));

export default router;
