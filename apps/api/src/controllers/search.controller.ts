import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';
import { AppError } from '../middleware/errorHandler';

export class SearchController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) throw new AppError('Your session has expired. Please sign in again.', 401);

      const { q } = req.query;
      const results = await SearchService.globalSearch(
        user.employeeId,
        user.permissionTier,
        q as string || ''
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
}
