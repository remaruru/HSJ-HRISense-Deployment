import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { authenticate as requireAuth } from '../middleware/authenticate';
import { authorize as requireRoles } from '../middleware/authorize';
import { DocumentController, uploadDocumentSchema, updateMetadataSchema } from '../controllers/document.controller';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Multer storage config for randomized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'documents'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  },
});

// File filter (Max 5MB, strict MIME types)
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

  // Reject executables and scripts explicitly by extension
  const ext = path.extname(file.originalname).toLowerCase();
  const forbiddenExts = ['.exe', '.sh', '.bat', '.cmd', '.js', '.ts', '.php', '.py', '.msi'];
  if (forbiddenExts.includes(ext)) {
    return cb(new AppError('Executable files are strictly prohibited.', 400));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

router.use(requireAuth);

// Routes for specific employee's documents
router.post(
  '/employees/:employeeId/documents',
  requireRoles(['FULL']),
  upload.single('file'),
  validate(uploadDocumentSchema),
  DocumentController.upload
);

router.get(
  '/employees/:employeeId/documents',
  DocumentController.listByEmployee
);

// Routes for manipulating a specific document
router.get(
  '/documents/:documentId/preview',
  DocumentController.preview
);

router.get(
  '/documents/:documentId/download',
  DocumentController.download
);

router.put(
  '/documents/:documentId',
  requireRoles(['FULL']),
  validate(updateMetadataSchema),
  DocumentController.updateMetadata
);

router.delete(
  '/documents/:documentId',
  requireRoles(['FULL']),
  DocumentController.delete
);

router.put(
  '/documents/:documentId/file',
  requireRoles(['FULL']),
  upload.single('file'),
  DocumentController.replace
);

export default router;
