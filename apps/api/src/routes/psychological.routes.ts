import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { PsychologicalController } from '../controllers/psychological.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  requireHrAuthorityOver, refuseOwn, targetFromParamOrBody, targetOfPsychRecord, targetOfPsychDocument,
  OWN_RECORD_REVIEW, OWN_RECORD_DELETE, OWN_PROOF_DELETE,
} from '../middleware/hr-authority';
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
// HR changes records of anyone below HR, and their own; another HR person's and
// Sister's only Sister changes. Nobody reviews, deletes or strips the proof
// from their own (HR's own records are accepted automatically with proof).
router.post('/records', authorize(['FULL']), requireHrAuthorityOver(targetFromParamOrBody('employeeId')), PsychologicalController.createRecord);

// ── Single Employee Records (Profile Tab & Self View) ─────────────────────────
router.get('/employees/:employeeId/records', PsychologicalController.listRecords);
router.post('/employees/:employeeId/records', authorize(['FULL']), requireHrAuthorityOver(targetFromParamOrBody('employeeId')), PsychologicalController.createRecord);

// ── Single Record Detail & Operations ─────────────────────────────────────────
router.get('/records/:recordId', PsychologicalController.getRecord);
router.patch('/records/:recordId', authorize(['FULL']), requireHrAuthorityOver(targetOfPsychRecord), PsychologicalController.updateRecord);
router.patch('/records/:recordId/review', authorize(['FULL']), requireHrAuthorityOver(targetOfPsychRecord), refuseOwn(targetOfPsychRecord, OWN_RECORD_REVIEW), PsychologicalController.reviewRecord);
router.delete('/records/:recordId', authorize(['FULL']), requireHrAuthorityOver(targetOfPsychRecord), refuseOwn(targetOfPsychRecord, OWN_RECORD_DELETE), PsychologicalController.deleteRecord);

// ── Psychological Documents ───────────────────────────────────────────────────
router.post('/records/:recordId/documents', authorize(['FULL']), requireHrAuthorityOver(targetOfPsychRecord), upload.single('file'), PsychologicalController.uploadDocument);
router.get('/documents/:documentId/stream', PsychologicalController.streamDocument);
router.delete('/documents/:documentId', authorize(['FULL']), requireHrAuthorityOver(targetOfPsychDocument), refuseOwn(targetOfPsychDocument, OWN_PROOF_DELETE), PsychologicalController.deleteDocument);

export default router;
