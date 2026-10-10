import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { SearchController } from '../controllers/search.controller';

const router = Router();

router.use(authenticate);

router.get('/', SearchController.search);

export default router;
