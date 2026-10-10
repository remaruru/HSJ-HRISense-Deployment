import { Request, Response, NextFunction } from 'express';
import { UnitService } from '../services/unit.service';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';

const createUnitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  departmentId: z.string().uuid('Invalid Department ID').optional(),
  description: z.string().optional(),
});

const updateUnitSchema = createUnitSchema.partial();

export class UnitController {
  static async createUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createUnitSchema.parse(req.body);
      const unit = await UnitService.createUnit(data);
      res.status(201).json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  static async getUnits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const units = await UnitService.getUnits();
      res.status(200).json({ success: true, data: units });
    } catch (error) {
      next(error);
    }
  }

  static async getUnitById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const unit = await UnitService.getUnitById(id);
      if (!unit) {
        throw new AppError('This unit could not be found. It may have been removed.', 404);
      }
      res.status(200).json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  static async updateUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateUnitSchema.parse(req.body);
      const unit = await UnitService.updateUnit(id, data);
      res.status(200).json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUnit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await UnitService.deleteUnit(id);
      res.status(200).json({ success: true, message: 'Unit deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
