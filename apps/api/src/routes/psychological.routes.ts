import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { PsychologicalController } from '../controllers/psychological.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'psychological'));
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
    return cb(new AppError('Invalid file type. Only PDF, JPG, PNG, and DOCX are allowed.', 400));
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter,
});

router.use(authenticate);

// ── Organization Psychological Records (HR FULL Tier) ─────────────────────────
router.get('/records', authorize(['FULL']), PsychologicalController.listAllRecords);
router.get('/summary', authorize(['FULL']), PsychologicalController.getSummary);
router.post('/records', authorize(['FULL']), PsychologicalController.createRecord);

// ── Single Employee Records (Profile Tab & Self View) ─────────────────────────
router.get('/employees/:employeeId/records', PsychologicalController.listRecords);
router.post('/employees/:employeeId/records', authorize(['FULL']), PsychologicalController.createRecord);

// ── Single Record Detail & Operations ─────────────────────────────────────────
router.get('/records/:recordId', PsychologicalController.getRecord);
router.patch('/records/:recordId', authorize(['FULL']), PsychologicalController.updateRecord);
router.patch('/records/:recordId/review', authorize(['FULL']), PsychologicalController.reviewRecord);
router.delete('/records/:recordId', authorize(['FULL']), PsychologicalController.deleteRecord);

// ── Psychological Documents ───────────────────────────────────────────────────
router.post('/records/:recordId/documents', authorize(['FULL']), upload.single('file'), PsychologicalController.uploadDocument);
router.get('/documents/:documentId/stream', PsychologicalController.streamDocument);
router.delete('/documents/:documentId', authorize(['FULL']), PsychologicalController.deleteDocument);

export default router;
