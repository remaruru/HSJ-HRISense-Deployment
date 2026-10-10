import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AwardController } from '../controllers/award.controller';

/**
 * Awards & Recognition. Every employee: their own view, nominations and ballot.
 * HR (FULL): periods, groups, the review / verification / finalisation, Hall of
 * Fame and history. No route returns who voted for whom.
 */
const router = Router();
router.use(authenticate);

// Everyone
router.get('/my', AwardController.my);
router.post('/categories/:categoryId/nominations', AwardController.nominate);
router.post('/:id/ballot', AwardController.vote);

// HR — specific paths before /:id
router.get('/history', authorize(['FULL']), AwardController.history);
router.get('/groups', authorize(['FULL']), AwardController.groups);
router.post('/groups', authorize(['FULL']), AwardController.saveGroup);
router.put('/groups/:groupId', authorize(['FULL']), AwardController.saveGroup);
router.delete('/groups/:groupId', authorize(['FULL']), AwardController.deleteGroup);
router.get('/hall-of-fame', authorize(['FULL']), AwardController.hallOfFame);
router.post('/hall-of-fame', authorize(['FULL']), AwardController.recordHallOfFame);
router.delete('/hall-of-fame/:recordId', authorize(['FULL']), AwardController.removeHallOfFame);
router.post('/recognition-year', authorize(['FULL']), AwardController.createRecognitionYear);
router.patch('/results/:resultId', authorize(['FULL']), AwardController.decide);

router.get('/', authorize(['FULL']), AwardController.list);
router.post('/', authorize(['FULL']), AwardController.create);
router.get('/:id', authorize(['FULL']), AwardController.get);
router.patch('/:id', authorize(['FULL']), AwardController.update);
router.delete('/:id', authorize(['FULL']), AwardController.remove);
router.post('/:id/transition', authorize(['FULL']), AwardController.transition);
router.post('/:id/confirm-shortlist', authorize(['FULL']), AwardController.confirmShortlist);

export default router;
