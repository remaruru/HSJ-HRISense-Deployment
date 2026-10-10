import { Request, Response, NextFunction } from 'express';
import { DepartmentService } from '../services/department.service';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  description: z.string().optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial();

export class DepartmentController {
  static async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createDepartmentSchema.parse(req.body);
      const department = await DepartmentService.createDepartment(data);
      res.status(201).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { unitId } = req.query;
      const departments = await DepartmentService.getDepartments(unitId as string);
      res.status(200).json({ success: true, data: departments });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const department = await DepartmentService.getDepartmentById(id);
      if (!department) {
        throw new AppError('This department could not be found. It may have been removed.', 404);
      }
      res.status(200).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  static async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateDepartmentSchema.parse(req.body);
      const department = await DepartmentService.updateDepartment(id, data);
      res.status(200).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await DepartmentService.deleteDepartment(id);
      res.status(200).json({ success: true, message: 'Department deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
