import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { TrainingController } from '../controllers/training.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'training'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new AppError('Invalid file type. Only PDF, JPG, PNG, and DOCX/DOC are allowed.', 400));
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const forbiddenExts = ['.exe', '.sh', '.bat', '.cmd', '.js', '.ts', '.php', '.py', '.msi'];
  if (forbiddenExts.includes(ext)) {
    return cb(new AppError('Executable files are strictly prohibited.', 400));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter,
});

router.use(authenticate);

// ── Training Activities ───────────────────────────────────────────────────────
router.get('/', TrainingController.listActivities);
router.get('/:id', TrainingController.getActivity);
router.post('/', authorize(['FULL']), TrainingController.createActivity);
router.put('/:id', authorize(['FULL']), TrainingController.updateActivity);
router.post('/:id/cancel', authorize(['FULL']), TrainingController.cancelActivity);

// ── Activity Documents ────────────────────────────────────────────────────────
router.post('/:id/documents', authorize(['FULL']), upload.single('file'), TrainingController.uploadActivityDocument);
router.get('/:id/documents/:documentId', authorize(['FULL']), TrainingController.streamActivityDocument);

// ── Participants ─────────────────────────────────────────────────────────────
router.post('/:id/participants', authorize(['FULL']), TrainingController.addParticipants);
router.put('/:id/participants/:employeeId', authorize(['FULL']), TrainingController.updateParticipantStatus);
router.post('/:id/participants/bulk-status', authorize(['FULL']), TrainingController.bulkUpdateParticipantStatus);

// ── Participant Certificates ─────────────────────────────────────────────────
router.post('/:id/participants/:employeeId/certificate', authorize(['FULL']), upload.single('file'), TrainingController.uploadParticipantCertificate);
router.get('/:id/participants/:employeeId/certificate', TrainingController.streamParticipantCertificate);

// ── Employee Training History ────────────────────────────────────────────────
router.get('/employees/:employeeId/history', TrainingController.listEmployeeHistory);

export default router;
