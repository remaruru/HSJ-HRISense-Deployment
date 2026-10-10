import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { JobApplicationService } from '../services/job-application.service';
import { RecruitmentPolicy, RecruitmentPolicyContext } from '../policies/recruitment.policy';
import { RecruitmentAuthorizationError } from '../lib/recruitment.errors';
import { JobApplicationStatus, InterviewType, InterviewStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApplicantNoteService } from '../services/applicant-note.service';
import { InterviewService } from '../services/interview.service';
import { ApplicantCommunicationService } from '../services/applicant-communication.service';
import { recruitmentConfig } from '../config/recruitment.config';
import { ApplicantConversionService } from '../services/applicant-conversion.service';
import { RecruitmentCommunicationType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class JobApplicationController {
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

  static async listApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { openingId, status, search, page = '1', limit = '10' } = req.query;
      
      const result = await JobApplicationService.listApplications(
        { 
          openingId: openingId as string,
          status: status as JobApplicationStatus, 
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

  static async getApplicationById(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const application = await JobApplicationService.getApplicationById(req.params.id);
      res.json({ success: true, data: application });
    } catch (err) {
      next(err);
    }
  }

  static async changeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canReviewApplications(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { status, reason } = z.object({ 
        status: z.nativeEnum(JobApplicationStatus),
        reason: z.string().optional()
      }).parse(req.body);

      if (!RecruitmentPolicy.canUpdateStatus(context, status)) {
        throw new RecruitmentAuthorizationError(`You are not authorized to change application status to ${status}.`);
      }

      const application = await JobApplicationService.changeStatus(req.params.id, status, reason, req.user!.userId);
      res.json({ success: true, data: application });
    } catch (err) {
      next(err);
    }
  }

  static async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canReviewApplications(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { note } = z.object({ note: z.string().min(1) }).parse(req.body);
      const applicantNote = await ApplicantNoteService.addNote(req.params.id, note, req.user!.userId);
      
      res.status(201).json({ success: true, data: applicantNote });
    } catch (err) {
      next(err);
    }
  }

  static async scheduleInterview(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canScheduleInterview(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const data = z.object({
        scheduledAt: z.string().transform((str) => new Date(str)),
        interviewType: z.nativeEnum(InterviewType),
        locationDetails: z.string().optional(),
        interviewer: z.string().optional()
      }).parse(req.body);

      const interview = await InterviewService.scheduleInterview({
        applicationId: req.params.id,
        ...data
      }, req.user!.userId);

      res.status(201).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  static async updateInterview(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canScheduleInterview(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { status, recommendation, notes } = z.object({
        status: z.nativeEnum(InterviewStatus),
        recommendation: z.string().optional(),
        notes: z.string().optional()
      }).parse(req.body);

      const interview = await InterviewService.updateInterviewStatus(
        req.params.interviewId, 
        status, 
        recommendation, 
        notes, 
        req.user!.userId
      );

      res.json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  static async rescheduleInterview(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canScheduleInterview(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const data = z.object({
        scheduledAt: z.string().transform((str) => new Date(str)).optional(),
        interviewType: z.nativeEnum(InterviewType).optional(),
        locationDetails: z.string().optional(),
        interviewer: z.string().optional()
      }).parse(req.body);

      const interview = await InterviewService.rescheduleInterview(
        req.params.interviewId, 
        data, 
        req.user!.userId
      );

      res.json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  static async previewEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      const { type, data } = req.body;

      if (!RecruitmentPolicy.canSendEmail(context, type)) {
        throw new RecruitmentAuthorizationError('You are not authorized to preview this type of email.');
      }

      const preview = ApplicantCommunicationService.previewEmail(type as RecruitmentCommunicationType, data);
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  }

  static async retryCommunication(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      // Wait, we need the communication to get its type, but checking canSendEmail generally is fine, or canReviewApplications
      if (!RecruitmentPolicy.canReviewApplications(context)) {
        throw new RecruitmentAuthorizationError('You are not authorized to retry emails.');
      }

      const communication = await ApplicantCommunicationService.retryCommunication(
        req.params.id,
        req.params.communicationId,
        req.user!.userId
      );

      res.status(201).json({ success: true, data: communication });
    } catch (err) {
      next(err);
    }
  }

  static async sendEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      const { type, data } = req.body;

      if (!RecruitmentPolicy.canSendEmail(context, type)) {
        throw new RecruitmentAuthorizationError('You are not authorized to send this type of email.');
      }

      const communication = await ApplicantCommunicationService.sendEmail(
        req.params.id,
        type as RecruitmentCommunicationType,
        data,
        req.user!.userId
      );

      res.status(201).json({ success: true, data: communication });
    } catch (err) {
      next(err);
    }
  }

  static async listCommunications(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canReviewApplications(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const communications = await ApplicantCommunicationService.listCommunications(req.params.id);
      const isDevMode = !recruitmentConfig.emailEnabled || recruitmentConfig.emailProvider === 'DEVELOPMENT';
      res.json({ success: true, data: communications, meta: { devEmailMode: isDevMode } });
    } catch (err) {
      next(err);
    }
  }

  static async convertToOnboarding(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canConvertToOnboarding(context)) {
        throw new RecruitmentAuthorizationError('Only HR Officers can convert applicants to onboarding drafts.');
      }

      const draft = await ApplicantConversionService.convertToOnboarding(req.params.id, req.user!.userId);
      res.status(201).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }

  static async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { id, documentId } = req.params;
      
      const document = await prisma.applicantDocument.findUnique({
        where: { id: documentId }
      });

      if (!document || document.applicationId !== id) {
        throw new AppError('This document could not be found. It may have been removed.', 404, undefined, 'DOCUMENT_NOT_FOUND');
      }

      const fs = require('fs');
      if (!fs.existsSync(document.storagePath)) {
        throw new AppError('The file for this document is missing from storage. Ask the applicant to send it again.', 404, undefined, 'FILE_MISSING');
      }

      // Log the download access securely
      const { createAuditLog } = require('../lib/audit');
      await createAuditLog({
        action: 'APPLICANT_DOCUMENT_ACCESSED',
        actorUserId: req.user!.userId,
        entityType: 'ApplicantDocument',
        entityId: document.id,
        metadata: { applicationId: id, documentType: document.documentType }
      });

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.download(document.storagePath, document.originalFilename);
    } catch (err) {
      next(err);
    }
  }

  static async previewDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await JobApplicationController.getPolicyContext(req);
      if (!RecruitmentPolicy.canViewRecruitment(context)) {
        throw new RecruitmentAuthorizationError();
      }

      const { id, documentId } = req.params;
      
      const document = await prisma.applicantDocument.findUnique({
        where: { id: documentId }
      });

      if (!document || document.applicationId !== id) {
        throw new AppError('This document could not be found. It may have been removed.', 404, undefined, 'DOCUMENT_NOT_FOUND');
      }

      // MVP Limitation: Only PDF is previewable inline
      if (document.mimeType !== 'application/pdf') {
        throw new AppError('Preview is unavailable for this document format. Download the file to view it securely.', 415, undefined, 'PREVIEW_UNSUPPORTED');
      }

      const fs = require('fs');
      if (!fs.existsSync(document.storagePath)) {
        throw new AppError('The file for this document is missing from storage. Ask the applicant to send it again.', 404, undefined, 'FILE_MISSING');
      }

      // Log the preview access securely
      const { createAuditLog } = require('../lib/audit');
      await createAuditLog({
        action: 'APPLICANT_DOCUMENT_PREVIEWED',
        actorUserId: req.user!.userId,
        entityType: 'ApplicantDocument',
        entityId: document.id,
        metadata: { applicationId: id, documentType: document.documentType }
      });

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${document.originalFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      const fileStream = fs.createReadStream(document.storagePath);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}
