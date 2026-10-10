import { Router } from 'express';
import { JobRoleController } from '../controllers/job-role.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Protect all routes with auth
router.use(authenticate);

// List all job roles (anyone logged in can read)
router.get('/', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), JobRoleController.getJobRoles);

// Get specific job role
router.get('/:id', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), JobRoleController.getJobRoleById);

// Create job role (requires manage settings)
router.post('/', authorize(['FULL']), JobRoleController.createJobRole);

// Update job role
router.patch('/:id', authorize(['FULL']), JobRoleController.updateJobRole);

// Delete job role
router.delete('/:id', authorize(['FULL']), JobRoleController.deleteJobRole);

export default router;
