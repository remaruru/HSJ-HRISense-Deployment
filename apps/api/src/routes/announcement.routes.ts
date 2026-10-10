import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { AnnouncementController } from '../controllers/announcement.controller';

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENT ROUTES
//
// Authorization summary:
//   FULL only:  audience-preview, /hr, /stats, POST, PUT, activate, schedule,
//               archive, DELETE, recipients, recipient stats,
//               POST attachments, DELETE attachments
//   All auth:   GET / (recipient feed), GET /dashboard, GET /unread-count,
//               GET /:id (service-level recipient check), POST /:id/read,
//               GET /:id/attachments, GET /:id/attachments/:attachmentId (service-level auth)
//
// IMPORTANT: Static routes (/hr, /stats, /dashboard, /audience-preview,
// /unread-count) are registered BEFORE /:id to prevent Express from matching
// them as an ID parameter.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── Multer Storage & Filter (Protected Announcements) ────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'announcements'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomHex}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new AppError('Invalid file type. Only PDF, JPG, PNG, WEBP, and DOC/DOCX are allowed.', 400));
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const forbiddenExts = ['.exe', '.sh', '.bat', '.cmd', '.js', '.ts', '.php', '.py', '.msi', '.vbs', '.ps1'];
  if (forbiddenExts.includes(ext)) {
    return cb(new AppError('Executable files are strictly prohibited.', 400));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file limit
  fileFilter,
});

router.use(authenticate);

// ── Static Routes (must precede /:id) ────────────────────────────────────────

// POST /announcements/audience-preview — FULL only
router.post('/audience-preview', authorize(['FULL']), AnnouncementController.previewAudience);

// GET /announcements/hr — FULL management list
router.get('/hr', authorize(['FULL']), AnnouncementController.listForHR);

// GET /announcements/stats — FULL summary counts
router.get('/stats', authorize(['FULL']), AnnouncementController.getSummaryStats);

// GET /announcements/dashboard — all authenticated (recipient context)
router.get('/dashboard', AnnouncementController.getDashboard);

// GET /announcements/unread-count — all authenticated (sidebar badge)
router.get('/unread-count', AnnouncementController.getUnreadCount);

// ── Collection Routes ────────────────────────────────────────────────────────

// GET /announcements — recipient feed (all authenticated)
router.get('/', AnnouncementController.listForRecipient);

// POST /announcements — create draft (FULL only)
router.post('/', authorize(['FULL']), AnnouncementController.createDraft);

// ── Attachment Routes (Checkpoints 3) ─────────────────────────────────────────

// POST /announcements/:id/attachments — upload attachment (FULL only)
// Note: authorize(['FULL']) runs BEFORE upload.single('file') to reject unauthenticated/unauthorized users before writing to disk
router.post('/:id/attachments', authorize(['FULL']), upload.single('file'), AnnouncementController.uploadAttachment);

// GET /announcements/:id/attachments — list safe attachment metadata
router.get('/:id/attachments', AnnouncementController.listAttachments);

// GET /announcements/:id/attachments/:attachmentId — stream/download (dual-mode: FULL or recipient)
router.get('/:id/attachments/:attachmentId', AnnouncementController.streamAttachment);

// DELETE /announcements/:id/attachments/:attachmentId — remove attachment (FULL only, DRAFT or SCHEDULED only)
router.delete('/:id/attachments/:attachmentId', authorize(['FULL']), AnnouncementController.deleteAttachment);

// ── Per-Resource Routes ───────────────────────────────────────────────────────

// GET /announcements/:id — dual-mode: HR management or recipient (service-level auth)
router.get('/:id', AnnouncementController.getById);

// PUT /announcements/:id — update (FULL only; state-dependent rules enforced in service)
router.put('/:id', authorize(['FULL']), AnnouncementController.updateAnnouncement);

// POST /announcements/:id/activate — publish now (FULL only)
router.post('/:id/activate', authorize(['FULL']), AnnouncementController.activate);

// POST /announcements/:id/schedule — schedule for future (FULL only)
router.post('/:id/schedule', authorize(['FULL']), AnnouncementController.schedule);

// POST /announcements/:id/archive — archive (FULL only)
router.post('/:id/archive', authorize(['FULL']), AnnouncementController.archive);

// DELETE /announcements/:id — delete DRAFT only (FULL only)
router.delete('/:id', authorize(['FULL']), AnnouncementController.deleteDraft);

// POST /announcements/:id/read — mark read (all authenticated; UPDATE-only, no upsert)
router.post('/:id/read', AnnouncementController.markRead);

// GET /announcements/:id/recipients — paginated recipient list (FULL only)
router.get('/:id/recipients', authorize(['FULL']), AnnouncementController.listRecipients);

// GET /announcements/:id/recipients/stats — recipient read statistics (FULL only)
router.get('/:id/recipients/stats', authorize(['FULL']), AnnouncementController.getRecipientStats);

export default router;
