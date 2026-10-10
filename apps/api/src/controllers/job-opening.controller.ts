import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { JobOpeningService } from '../services/job-opening.service';
import { JobOpeningStatus, EmploymentStatus } from '@prisma/client';
import { RecruitmentPolicy, RecruitmentPolicyContext } from '../policies/recruitment.policy';
import { RecruitmentAuthorizationError } from '../lib/recruitment.errors';
import { prisma } from '../config/prisma';

const createJobOpeningSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  unitId: z.string().uuid('Invalid Unit ID'),
  departmentId: z.string().uuid('Invalid Department ID').optional(),
  jobRoleId: z.string().uuid('Invalid Job Role ID'),
  employmentType: z.nativeEnum(EmploymentStatus),
  vacancies: z.number().int().positive().optional(),
  description: z.string().min(1, 'Description is required'),
  responsibilities: z.string().min(1, 'Responsibilities are required'),
  qualifications: z.string().min(1, 'Qualifications are required'),
  requiredDocuments: z.string().optional(),
  openingDate: z.string().transform((str) => new Date(str)),
  closingDate: z.string().transform((str) => new Date(str)),
});

const updateJobOpeningSchema = createJobOpeningSchema.partial().extend({
  status: z.nativeEnum(JobOpeningStatus).optional()
});

export class JobOpeningController {
  private static async getPolicyContext(req: Request): Promise<RecruitmentPolicyContext> {
    const user = req.user!;
    let employeeData = null;

    if (user.employeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: user.employeeId },
        include: { jobRole: true, unit: true, department: true }
      });
      if (emp) {
        employeeData = {
          id: emp.id,
          unit: emp.unit,
          department: emp.department,
          jobRole: emp.jobRole
        };
      }
    }

    return {
      userId: user.userId,
      permissionTier: user.permissionTier,
      employee: employeeData
    };
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { status, search, page = '1', limit = '10' } = req.query;
      
      const result = await JobOpeningService.listJobOpenings(
        { 
          status: status as JobOpeningStatus, 
          search: search as string 
        }, 
        { 
          page: parseInt(page as string), 
          limit: parseInt(limit as string) 
        }
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const stats = await JobOpeningService.getOverviewStats();
      // Capabilities let the UI hide controls the caller genuinely cannot use
      // (HR Staff vs HR Officer) instead of surfacing a 403 after the click.
      res.json({
        success: true,
        data: stats,
        capabilities: RecruitmentPolicy.describeCapabilities(context),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const opening = await JobOpeningService.getJobOpeningById(req.params.id);
      res.json({ success: true, data: opening });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      if (!RecruitmentPolicy.canManageJobOpenings(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const data = createJobOpeningSchema.parse(req.body);
      const opening = await JobOpeningService.createJobOpening(data, req.user!.userId);
      
      res.status(201).json({ success: true, data: opening });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      if (!RecruitmentPolicy.canManageJobOpenings(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const data = updateJobOpeningSchema.parse(req.body);
      
      // If status is being updated to OPEN, ensure user has publish permission
      if (data.status === JobOpeningStatus.OPEN) {
         if (!RecruitmentPolicy.canPublishJobOpening(context)) {
           throw new RecruitmentAuthorizationError('You are not authorized to publish job openings.');
         }
      }
      
      const opening = await JobOpeningService.updateJobOpening(req.params.id, data, req.user!.userId);
      res.json({ success: true, data: opening });
    } catch (err) {
      next(err);
    }
  }

  static async changeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobOpeningController.getPolicyContext(req);
      const { status } = z.object({ status: z.nativeEnum(JobOpeningStatus) }).parse(req.body);

      if (!RecruitmentPolicy.canManageJobOpenings(context)) {
        throw new RecruitmentAuthorizationError();
      }

      if (status === JobOpeningStatus.OPEN && !RecruitmentPolicy.canPublishJobOpening(context)) {
         throw new RecruitmentAuthorizationError('You are not authorized to publish job openings.');
      }

      const opening = await JobOpeningService.changeStatus(req.params.id, status, req.user!.userId);
      res.json({ success: true, data: opening });
    } catch (err) {
      next(err);
    }
  }
}
