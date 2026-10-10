import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { PublicRecruitmentController } from '../controllers/public-recruitment.controller';
import { AppError } from '../middleware/errorHandler';
import { publicApplicationEmailLimiter, publicApplicationIpLimiter, publicReadLimiter } from '../middleware/rate-limit';
import { CaptchaService } from '../services/captcha.service';

// ---------------------------------------------------------
// 1. RATE LIMITING
// ---------------------------------------------------------
// Values live in config/rate-limits.ts (PUBLIC_READ, PUBLIC_APPLICATION_IP,
// PUBLIC_APPLICATION_EMAIL); the older PUBLIC_CAREERS_* / PUBLIC_APPLICATION_*
// settings still apply when set. Layers for an application:
//   1. per IP, before the upload is parsed (a flood never writes files) — wide,
//      so a shared school or office network is not blocked;
//   2. per email address, after parsing (refused uploads are deleted);
//   3. the existing one-application-per-opening rule in the service.

// ---------------------------------------------------------
// 2. FILE UPLOAD & STORAGE
// ---------------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'recruitment', 'documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('The selected document is not a PDF, DOC, or DOCX file.', 400, undefined, 'UNSUPPORTED_FILE_TYPE'));
  }
};

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 2, // maximum 2 files
    fields: 20, // Strict multipart fields count
    parts: 25 // fields + files max
  },
  fileFilter,
});

const router = Router();

// Public Job Openings
router.get('/openings', publicReadLimiter, PublicRecruitmentController.listOpenings);
// Every Job Role (position) with its current openings — the Careers directory.
router.get('/positions', publicReadLimiter, PublicRecruitmentController.listPositions);
router.get('/openings/:slug', publicReadLimiter, PublicRecruitmentController.getOpeningBySlug);

// Login-free, read-only application status. No applicant account is involved.
router.get(
  '/application-status/:token',
  publicReadLimiter,
  PublicRecruitmentController.getApplicationStatus
);

// Application Submission
// Rate limiter runs BEFORE multer parses the body!
router.post(
  '/openings/:openingId/apply',
  publicApplicationIpLimiter,
  // "I'm not a robot" (when configured), checked BEFORE the upload is parsed so a
  // bot's files are never written. The token travels in a header for that reason.
  (req, _res, next) => {
    CaptchaService.verify(req.get('X-Captcha-Token'), req.ip).then(() => next(), next);
  },
  (req, res, next) => {
    const uploadFields = upload.fields([
      { name: 'resume', maxCount: 1 },
      { name: 'coverLetter', maxCount: 1 }
    ]);
    
    // Upload problems leave through the shared error handler, in the standard
    // envelope, with wording for applicants.
    uploadFields(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('This file is larger than the 5 MB limit. Choose a smaller file.', 413, undefined, 'FILE_TOO_LARGE'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError('Only one résumé and one optional cover letter may be uploaded.', 400, undefined, 'TOO_MANY_FILES'));
        }
        return next(new AppError('Your documents could not be uploaded. Check the files and try again.', 400, undefined, 'UPLOAD_REJECTED'));
      }
      next(err);
    });
  },
  publicApplicationEmailLimiter,
  PublicRecruitmentController.apply
);

export default router;
