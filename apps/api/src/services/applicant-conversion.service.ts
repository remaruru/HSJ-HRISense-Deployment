import { prisma } from '../config/prisma';
import { OnboardingDraftStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';

export class ApplicantConversionService {
  static async convertToOnboarding(applicationId: string, userId: string) {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: true, jobOpening: true }
    });

    if (!application) throw new AppError('Job Application not found', 404);

    if (application.status !== 'HIRED') {
      throw new AppError('Only HIRED applications can be converted to onboarding drafts.', 409);
    }

    if (application.onboardingDraftId) {
      throw new AppError('This application has already been converted to an onboarding draft.', 409);
    }

    const draft = await prisma.$transaction(async (tx) => {
      const newDraft = await tx.onboardingDraft.create({
        data: {
          data: {
            firstName: application.applicant.firstName,
            middleName: application.applicant.middleName,
            lastName: application.applicant.lastName,
            suffix: application.applicant.suffix,
            personalEmail: application.applicant.email,
            mobilePhone: application.applicant.mobile,
            presentAddress: application.applicant.address || '',
            // Only what the applicant actually gave; blank stays blank for HR to
            // complete during onboarding. Nothing is invented.
            religion: application.applicant.religion || '',
            gender: application.applicant.gender || '',
            // Never collected from applicants — HR chooses it during onboarding.
            civilStatus: '',
            departmentId: application.jobOpening.departmentId,
            unitId: application.jobOpening.unitId,
            jobRoleId: application.jobOpening.jobRoleId,
            employmentStatus: application.jobOpening.employmentType,
          },
          status: OnboardingDraftStatus.DRAFT,
          createdById: userId,
          lastUpdatedById: userId
        }
      });

      await tx.jobApplication.update({
        where: { id: applicationId },
        data: { onboardingDraftId: newDraft.id }
      });

      return newDraft;
    });

    await createAuditLog({
      action: 'APPLICANT_CONVERTED_TO_ONBOARDING',
      actorUserId: userId,
      entityType: 'JobApplication',
      entityId: applicationId,
      metadata: { onboardingDraftId: draft.id }
    });

    return draft;
  }
}
