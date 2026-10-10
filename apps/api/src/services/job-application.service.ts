import { prisma } from '../config/prisma';
import { isAcceptingApplications } from './job-opening.service';
import { Gender, JobApplicationStatus, RecruitmentCommunicationType } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';
import { removeFileQuietly } from '../middleware/upload';
import { RecruitmentAutomaticCommunicationService } from './recruitment-automatic-communication.service';
import { buildApplicationStatusUrl } from '../lib/applicationStatusToken';

export interface SubmitApplicationDTO {
  openingId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email: string;
  mobileNumber: string;
  presentAddress?: string;
  /** Picked from the list, or typed by the applicant under "Others". */
  religion?: string;
  /** MALE | FEMALE | PREFER_NOT_TO_SAY. Optional — never required to apply. */
  gender?: string;
  source?: string;
  message?: string;
  privacyConsent: boolean;
  resume: Express.Multer.File;
  coverLetter?: Express.Multer.File;
}

/** Accepts only the three values the enum defines; anything else is ignored. */
function normalizeGender(value?: string): Gender | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (Object.values(Gender) as string[]).includes(upper) ? (upper as Gender) : null;
}

export class JobApplicationService {
  private static generateApplicationReference(): string {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `HSJ-APP-${year}-${randomNum}`;
  }

  static async submitPublicApplication(data: SubmitApplicationDTO) {
    if (!data.privacyConsent) {
      throw new AppError('Privacy consent is required to submit an application.', 400, undefined, 'VALIDATION_ERROR');
    }
    if (!data.resume) {
      throw new AppError('Please attach your résumé (PDF, DOC or DOCX).', 400, undefined, 'VALIDATION_ERROR');
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Check if opening exists and is OPEN at exact time of submission
        const opening = await tx.jobOpening.findUnique({ where: { id: data.openingId } });
        if (!opening) throw new AppError('This job opening could not be found. It may have been removed.', 404, undefined, 'OPENING_NOT_FOUND');
        // The same rule as the Careers page: OPEN and within its dates.
        if (!isAcceptingApplications(opening)) {
          throw new AppError(
            'This job opening is no longer accepting applications. Browse the Careers page for current openings.',
            409,
            undefined,
            'OPENING_NOT_ACCEPTING'
          );
        }

        // Duplicate check: email or mobile for the same opening in an active state
        const existingApplication = await tx.jobApplication.findFirst({
          where: {
            jobOpeningId: data.openingId,
            applicant: {
              OR: [
                { email: data.email },
                { mobile: data.mobileNumber }
              ]
            },
            status: {
              notIn: ['REJECTED', 'WITHDRAWN']
            }
          }
        });

        // The existing rule, unchanged: one active application per opening for
        // the same email OR mobile number. Other openings are not affected.
        if (existingApplication) {
          throw new AppError(
            'An application for this position has already been submitted using this email address or mobile number.',
            409,
            undefined,
            'DUPLICATE_APPLICATION'
          );
        }

        // Find or create applicant
        let applicant = await tx.applicant.findFirst({
          where: { email: data.email }
        });

        if (!applicant) {
          applicant = await tx.applicant.create({
            data: {
              firstName: data.firstName,
              middleName: data.middleName,
              lastName: data.lastName,
              suffix: data.suffix,
              email: data.email,
              mobile: data.mobileNumber,
              address: data.presentAddress,
              religion: data.religion || null,
              gender: normalizeGender(data.gender),
            }
          });
        } else {
          applicant = await tx.applicant.update({
            where: { id: applicant.id },
            data: {
              mobile: data.mobileNumber,
              address: data.presentAddress || applicant.address,
              religion: data.religion || applicant.religion,
              gender: normalizeGender(data.gender) ?? applicant.gender,
            }
          });
        }

        const referenceNumber = this.generateApplicationReference();

        // Create Application
        const application = await tx.jobApplication.create({
          data: {
            applicantId: applicant.id,
            jobOpeningId: data.openingId,
            referenceNumber,
            source: data.source,
            applicantMessage: data.message,
            privacyConsent: data.privacyConsent,
            consentTimestamp: new Date(),
            status: JobApplicationStatus.SUBMITTED,
            statusHistory: {
              create: {
                newStatus: JobApplicationStatus.SUBMITTED,
                reason: 'Application submitted by candidate.',
                changedById: applicant.id,
              }
            }
          }
        });

        // Attach Resume
        await tx.applicantDocument.create({
          data: {
            applicationId: application.id,
            documentType: 'RESUME',
            originalFilename: data.resume.originalname,
            storedFilename: data.resume.filename,
            mimeType: data.resume.mimetype,
            sizeBytes: data.resume.size,
            storagePath: data.resume.path,
            uploadedBy: null
          }
        });

        // Attach Cover Letter if provided
        if (data.coverLetter) {
          await tx.applicantDocument.create({
            data: {
              applicationId: application.id,
              documentType: 'COVER_LETTER',
              originalFilename: data.coverLetter.originalname,
              storedFilename: data.coverLetter.filename,
              mimeType: data.coverLetter.mimetype,
              sizeBytes: data.coverLetter.size,
              storagePath: data.coverLetter.path,
              uploadedBy: null
            }
          });
        }

        return { application, applicant, opening, referenceNumber };
      });
    } catch (error) {
      // The transaction rolled back, so nothing references the uploaded files.
      await removeFileQuietly(data.resume?.path, 'application résumé');
      await removeFileQuietly(data.coverLetter?.path, 'application cover letter');
      throw error;
    }

    // The application is saved. The confirmation email is a side effect: if it
    // fails, the applicant still applied — the failure is recorded on the
    // communication (send status FAILED) or logged here, and never turned into
    // an error that would make them think they must apply again. The files are
    // now referenced by the application and must not be removed.
    try {
      await RecruitmentAutomaticCommunicationService.handleApplicationSubmitted(
        result.application.id,
        {
          applicantName: result.applicant.firstName,
          applicationReference: result.referenceNumber,
          jobTitle: result.opening.title,
          // Login-free, read-only status link (no applicant account is created).
          statusUrl: buildApplicationStatusUrl(result.application.id),
        },
        result.applicant.email,
        `${result.applicant.firstName} ${result.applicant.lastName}`
      );
    } catch (emailErr) {
      console.error(
        `[Recruitment] Application ${result.referenceNumber} was saved, but its confirmation email could not be queued:`,
        (emailErr as Error)?.message ?? emailErr
      );
    }

    return result.application;
  }

  static async listApplications(
    filters: { openingId?: string, status?: JobApplicationStatus, search?: string },
    pagination: { page: number, limit: number }
  ) {
    const where: any = {};

    if (filters.openingId) {
      where.jobOpeningId = filters.openingId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search } },
        { applicant: { firstName: { contains: filters.search } } },
        { applicant: { lastName: { contains: filters.search } } },
        { applicant: { email: { contains: filters.search } } },
      ];
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { applicationDate: 'desc' },
        include: {
          applicant: true,
          jobOpening: { select: { title: true, referenceNumber: true } }
        }
      }),
      prisma.jobApplication.count({ where })
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  static async getApplicationById(id: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        applicant: true,
        jobOpening: { include: { unit: true, department: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        documents: true,
        notes: { orderBy: { createdAt: 'desc' } },
        interviews: { orderBy: { scheduledAt: 'desc' } }
      }
    });

    if (!application) throw new AppError('Job Application not found', 404);
    return application;
  }

  static async changeStatus(id: string, newStatus: JobApplicationStatus, reason?: string, userId?: string) {
    const application = await prisma.jobApplication.findUnique({ 
      where: { id },
      include: { applicant: true, jobOpening: true }
    });
    if (!application) throw new AppError('Job Application not found', 404);

    if (application.status === 'HIRED' && newStatus !== 'HIRED') {
      throw new AppError('Cannot revert status from HIRED. Cancel the onboarding draft instead.', 409);
    }

    if (application.status === newStatus) {
      return application; // No change
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.jobApplication.update({
        where: { id },
        data: { status: newStatus }
      });

      const history = await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          previousStatus: application.status,
          newStatus,
          reason,
          changedById: userId || application.applicantId
        }
      });

      return { app, history };
    });

    if (userId) {
      await createAuditLog({
        action: `JOB_APPLICATION_STATUS_${newStatus}`,
        actorUserId: userId,
        entityType: 'JobApplication',
        entityId: id,
        metadata: { previousStatus: application.status, newStatus }
      });
    }

    // Trigger automatic email
    await RecruitmentAutomaticCommunicationService.handleStatusChanged(
      id,
      updated.history.id,
      newStatus,
      {
        applicantName: application.applicant.firstName,
        applicationReference: application.referenceNumber,
        jobTitle: application.jobOpening.title,
        requirements: newStatus === 'FOR_REQUIREMENTS' ? reason : undefined
      },
      application.applicant.email,
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      userId || ''
    );

    return updated.app;
  }
}
