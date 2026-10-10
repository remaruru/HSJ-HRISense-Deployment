import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AppError } from '../middleware/errorHandler';
import { createDiskUpload, IMAGE_MIME_ALLOWLIST } from '../middleware/upload';
import { YearlyAchievementService as S } from '../services/yearly-achievement.service';

/**
 * Yearly Achievements. Everyone signed in: published pages (and their files).
 * HR (FULL): create, edit, publish / unpublish, delete pages and their entries.
 */
const router = Router();
router.use(authenticate);

const upload = createDiskUpload({
  subdir: 'achievements',
  allowedMimeTypes: [...IMAGE_MIME_ALLOWLIST, 'application/pdf'],
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxFiles: 1,
  typeErrorMessage: 'Attach a JPG, PNG or WEBP image, or a PDF.',
}).single('attachment');

const actor = (req: Request) => {
  if (!req.user) throw new AppError('Authentication required', 401);
  return { id: req.user.userId, employeeId: req.user.employeeId, permissionTier: req.user.permissionTier };
};
const handle =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get('/', handle(async (req, res) => { res.json({ success: true, data: await S.list(actor(req)) }); }));
router.get('/entries/:entryId/attachment', handle(async (req, res) => {
  const f = await S.attachment(req.params.entryId, actor(req));
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name)}"`);
  res.sendFile(f.filePath);
}));
router.get('/:id', handle(async (req, res) => { res.json({ success: true, data: await S.get(req.params.id, actor(req)) }); }));

router.post('/', authorize(['FULL']), handle(async (req, res) => {
  res.status(201).json({ success: true, data: await S.create(req.body ?? {}, actor(req)), message: 'Page created' });
}));
router.patch('/:id', authorize(['FULL']), handle(async (req, res) => {
  res.json({ success: true, data: await S.update(req.params.id, req.body ?? {}, actor(req)), message: 'Page saved' });
}));
router.delete('/:id', authorize(['FULL']), handle(async (req, res) => {
  await S.remove(req.params.id, actor(req));
  res.json({ success: true, message: 'Page deleted' });
}));
router.post('/:id/entries', authorize(['FULL']), upload, handle(async (req, res) => {
  res.status(201).json({ success: true, data: await S.addEntry(req.params.id, req.body ?? {}, req.file as any, actor(req)), message: 'Achievement added' });
}));
router.patch('/entries/:entryId', authorize(['FULL']), upload, handle(async (req, res) => {
  res.json({ success: true, data: await S.updateEntry(req.params.entryId, req.body ?? {}, req.file as any, actor(req)), message: 'Achievement saved' });
}));
router.post('/entries/:entryId/move', authorize(['FULL']), handle(async (req, res) => {
  res.json({ success: true, data: await S.moveEntry(req.params.entryId, req.body?.direction === 'up' ? 'up' : 'down', actor(req)) });
}));
router.delete('/entries/:entryId', authorize(['FULL']), handle(async (req, res) => {
  res.json({ success: true, data: await S.deleteEntry(req.params.entryId, actor(req)), message: 'Achievement removed' });
}));

export default router;
