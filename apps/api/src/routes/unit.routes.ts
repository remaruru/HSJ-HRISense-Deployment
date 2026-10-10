import { Router } from 'express';
import { UnitController } from '../controllers/unit.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Protect all routes with auth
router.use(authenticate);

// List all units (anyone logged in can read)
router.get('/', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), UnitController.getUnits);

// Get specific unit
router.get('/:id', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), UnitController.getUnitById);

// Create unit (requires manage settings)
router.post('/', authorize(['FULL']), UnitController.createUnit);

// Update unit
router.patch('/:id', authorize(['FULL']), UnitController.updateUnit);

// Delete unit
router.delete('/:id', authorize(['FULL']), UnitController.deleteUnit);

export default router;
