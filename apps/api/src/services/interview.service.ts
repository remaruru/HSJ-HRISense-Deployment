import { prisma } from '../config/prisma';
import { InterviewType, InterviewStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { RecruitmentAutomaticCommunicationService } from './recruitment-automatic-communication.service';

export interface ScheduleInterviewDTO {
  applicationId: string;
  scheduledAt: Date;
  interviewType: InterviewType;
  locationDetails?: string;
  interviewer?: string;
}

export class InterviewService {
  static async scheduleInterview(data: ScheduleInterviewDTO, userId: string) {
    const interview = await prisma.applicantInterview.create({
      data: {
        applicationId: data.applicationId,
        scheduledAt: data.scheduledAt,
        interviewType: data.interviewType,
        locationDetails: data.locationDetails,
        interviewer: data.interviewer,
        status: InterviewStatus.SCHEDULED,
        createdById: userId,
        updatedById: userId,
      }
    });

    await createAuditLog({
      action: 'INTERVIEW_SCHEDULED',
      actorUserId: userId,
      entityType: 'ApplicantInterview',
      entityId: interview.id,
      metadata: { applicationId: data.applicationId, type: data.interviewType }
    });

    const application = await prisma.jobApplication.findUnique({
      where: { id: data.applicationId },
      include: { applicant: true, jobOpening: true }
    });

    if (application) {
      await RecruitmentAutomaticCommunicationService.handleInterviewScheduled(
        data.applicationId,
        interview.id,
        {
          applicantName: application.applicant.firstName,
          applicationReference: application.referenceNumber,
          jobTitle: application.jobOpening.title,
          interviewDate: data.scheduledAt.toLocaleDateString(),
          interviewTime: data.scheduledAt.toLocaleTimeString(),
          interviewLocation: data.locationDetails,
        },
        application.applicant.email,
        `${application.applicant.firstName} ${application.applicant.lastName}`,
        userId
      );
    }

    return interview;
  }

  static async updateInterviewStatus(id: string, status: InterviewStatus, recommendation?: string, notes?: string, userId?: string) {
    const interview = await prisma.applicantInterview.update({
      where: { id },
      data: {
        status,
        recommendation,
        notes,
        updatedById: userId
      }
    });

    if (userId) {
      await createAuditLog({
        action: `INTERVIEW_STATUS_${status}`,
        actorUserId: userId,
        entityType: 'ApplicantInterview',
        entityId: id,
        metadata: { applicationId: interview.applicationId }
      });
    }

    if (status === 'CANCELLED') {
      const application = await prisma.jobApplication.findUnique({
        where: { id: interview.applicationId },
        include: { applicant: true, jobOpening: true }
      });

      if (application) {
        await RecruitmentAutomaticCommunicationService.handleInterviewCancelled(
          interview.applicationId,
          interview.id,
          interview.updatedAt || new Date(),
          {
            applicantName: application.applicant.firstName,
            applicationReference: application.referenceNumber,
            jobTitle: application.jobOpening.title,
          },
          application.applicant.email,
          `${application.applicant.firstName} ${application.applicant.lastName}`,
          userId || ''
        );
      }
    }

    return interview;
  }

  static async rescheduleInterview(id: string, data: Partial<ScheduleInterviewDTO>, userId?: string) {
    const interview = await prisma.applicantInterview.update({
      where: { id },
      data: {
        ...(data.scheduledAt && { scheduledAt: data.scheduledAt }),
        ...(data.interviewType && { interviewType: data.interviewType }),
        ...(data.locationDetails !== undefined && { locationDetails: data.locationDetails }),
        ...(data.interviewer !== undefined && { interviewer: data.interviewer }),
        status: InterviewStatus.RESCHEDULED,
        updatedById: userId
      }
    });

    if (userId) {
      await createAuditLog({
        action: 'INTERVIEW_RESCHEDULED',
        actorUserId: userId,
        entityType: 'ApplicantInterview',
        entityId: id,
        metadata: { applicationId: interview.applicationId, newScheduledAt: interview.scheduledAt }
      });
    }

    const application = await prisma.jobApplication.findUnique({
      where: { id: interview.applicationId },
      include: { applicant: true, jobOpening: true }
    });

    if (application) {
      await RecruitmentAutomaticCommunicationService.handleInterviewRescheduled(
        interview.applicationId,
        interview.id,
        interview.updatedAt || new Date(),
        {
          applicantName: application.applicant.firstName,
          applicationReference: application.referenceNumber,
          jobTitle: application.jobOpening.title,
          interviewDate: interview.scheduledAt.toLocaleDateString(),
          interviewTime: interview.scheduledAt.toLocaleTimeString(),
          interviewLocation: interview.locationDetails || undefined,
        },
        application.applicant.email,
        `${application.applicant.firstName} ${application.applicant.lastName}`,
        userId || ''
      );
    }

    return interview;
  }
}
