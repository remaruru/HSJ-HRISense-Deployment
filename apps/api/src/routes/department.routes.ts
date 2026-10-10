import { Router } from 'express';
import { DepartmentController } from '../controllers/department.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// Protect all routes with auth
router.use(authenticate);

// List all departments (anyone logged in can read)
router.get('/', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), DepartmentController.getDepartments);

// Get specific department
router.get('/:id', authorize(['FULL', 'SUPERVISOR', 'STANDARD']), DepartmentController.getDepartmentById);

// Create department (requires FULL tier)
router.post('/', authorize(['FULL']), DepartmentController.createDepartment);

// Update department
router.patch('/:id', authorize(['FULL']), DepartmentController.updateDepartment);

// Delete department
router.delete('/:id', authorize(['FULL']), DepartmentController.deleteDepartment);

export default router;
