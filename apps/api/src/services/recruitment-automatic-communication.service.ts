import { prisma } from '../config/prisma';
import { 
  JobApplication, 
  ApplicantCommunication, 
  RecruitmentCommunicationType, 
  RecruitmentCommunicationSource,
  CommunicationChannel,
  InterviewStatus,
  NotificationType
} from '@prisma/client';
import { recruitmentAutoEmailPolicy } from '../config/recruitment.config';
import { NotificationService } from './notification.service';
import { RecruitmentTemplateService, TemplateContext } from './email/recruitment-template.service';
import { BrevoRecruitmentEmailProvider } from './email/brevo.provider';
import { createAuditLog } from '../lib/audit';

interface AutoTriggerPayload {
  applicationId: string;
  communicationType: RecruitmentCommunicationType;
  eventId: string;
  triggerType: string;
  relatedEntityId?: string;
  context: TemplateContext;
  recipientEmail: string;
  recipientName: string;
  userId?: string;
}

export class RecruitmentAutomaticCommunicationService {
  private static provider = new BrevoRecruitmentEmailProvider();

  /**
   * Core orchestrator for idempotent automatic communication.
   * MUST be called AFTER the primary database transaction commits successfully.
   */
  private static async sendAutomatedEmail(payload: AutoTriggerPayload) {
    // 1. Idempotency Check
    const existing = await prisma.applicantCommunication.findUnique({
      where: { eventId: payload.eventId }
    });

    if (existing) {
      console.log(`[AutoComm] Skip: Event ${payload.eventId} already processed.`);
      return;
    }

    // 2. Build Template
    const template = RecruitmentTemplateService.getTemplate(payload.communicationType, payload.context);

    // 3. Create SENDING record
    const comm = await prisma.applicantCommunication.create({
      data: {
        jobApplicationId: payload.applicationId,
        communicationType: payload.communicationType,
        source: RecruitmentCommunicationSource.AUTOMATIC_SYSTEM,
        eventId: payload.eventId,
        triggerType: payload.triggerType,
        relatedEntityId: payload.relatedEntityId,
        channel: CommunicationChannel.EMAIL,
        recipientEmail: payload.recipientEmail,
        recipientName: payload.recipientName,
        subjectSnapshot: template.subject,
        bodySnapshot: template.htmlBody, // Save htmlBody here since it's missing
        provider: 'BREVO', // Add required provider field
        sendStatus: 'SENDING',
        initiatedBy: 'SYSTEM', // Set initiatedBy to SYSTEM
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // 4. Provider Call
    const sendEnabled = process.env.RECRUITMENT_EMAIL_SEND_ENABLED === 'true';

    try {
      if (sendEnabled) {
        await this.provider.sendEmail({
          toEmail: payload.recipientEmail,
          toName: payload.recipientName,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody
        });

        await prisma.applicantCommunication.update({
          where: { id: comm.id },
          data: { sendStatus: 'SENT', sentAt: new Date() }
        });
      } else {
        await prisma.applicantCommunication.update({
          where: { id: comm.id },
          data: { sendStatus: 'SIMULATED', sentAt: new Date() }
        });
      }
    } catch (error: any) {
      // 5. Failure Handling
      await prisma.applicantCommunication.update({
        where: { id: comm.id },
        data: { 
          sendStatus: 'FAILED',
          failureReason: error.message || 'Unknown email provider error',
          failedAt: new Date()
        }
      });
      
      // We log the failure but do not throw, so the HR action is NOT rolled back (it already committed anyway).
      console.error(`[AutoComm] Failed to send email for ${payload.eventId}:`, error);
      
      if (payload.userId) {
        await createAuditLog({
          action: 'AUTOMATIC_EMAIL_FAILED',
          actorUserId: payload.userId,
          entityType: 'ApplicantCommunication',
          entityId: comm.id,
          metadata: { eventId: payload.eventId, error: error.message }
        });
      }
      
      // Tell HR in-app that an applicant email did not go out, so a failed send
      // is not something they only discover by reading the server log.
      const hrUserIds = await NotificationService.hrUserIds();
      await NotificationService.notifyMany(hrUserIds, {
        type: NotificationType.SYSTEM,
        title: 'Applicant email could not be sent',
        message: `An automatic ${payload.communicationType.replace(/_/g, ' ').toLowerCase()} email to ${payload.recipientName} failed to send. Open the applicant's Communications tab to retry it.`,
        link: `/recruitment/applicants/${payload.applicationId}`,
      });
    }
  }

  // ============================================================================
  // TRIGGERS
  // ============================================================================

  static async handleApplicationSubmitted(applicationId: string, context: TemplateContext, applicantEmail: string, applicantName: string) {
    if (!recruitmentAutoEmailPolicy.applicationReceived) {
      console.log('[AutoComm] Application-received email suppressed by configuration.');
      return;
    }

    const eventId = `application-submitted:${applicationId}`;

    await this.sendAutomatedEmail({
      applicationId,
      communicationType: RecruitmentCommunicationType.APPLICATION_RECEIVED,
      eventId,
      triggerType: 'APPLICATION_SUBMITTED',
      context,
      recipientEmail: applicantEmail,
      recipientName: applicantName
    });
  }

  static async handleStatusChanged(
    applicationId: string, 
    statusHistoryId: string, 
    newStatus: string, 
    context: TemplateContext, 
    applicantEmail: string, 
    applicantName: string,
    userId: string
  ) {
    // OFF by default. HR sends status-change messages deliberately from the
    // Communications tab (with preview) so an applicant is never emailed as a
    // side effect of an internal pipeline move.
    if (!recruitmentAutoEmailPolicy.statusChanges) {
      console.log(
        `[AutoComm] Status-change email for ${applicationId} (${newStatus}) not sent — automatic status emails are disabled. HR can send it from the Communications tab.`
      );
      return;
    }

    const eventId = `application-status-changed:${statusHistoryId}`;

    let commType: RecruitmentCommunicationType | null = null;
    
    switch (newStatus) {
      case 'UNDER_REVIEW':
        commType = RecruitmentCommunicationType.APPLICATION_UNDER_REVIEW;
        break;
      case 'FOR_INTERVIEW':
        commType = RecruitmentCommunicationType.INTERVIEW_PROCESS_UPDATE;
        break;
      case 'FOR_REQUIREMENTS':
        commType = RecruitmentCommunicationType.ADDITIONAL_REQUIREMENTS;
        break;
      case 'HIRED':
        commType = RecruitmentCommunicationType.APPLICATION_ACCEPTED;
        break;
      case 'REJECTED':
        commType = RecruitmentCommunicationType.APPLICATION_NOT_SELECTED;
        break;
      case 'WITHDRAWN':
        commType = RecruitmentCommunicationType.APPLICATION_WITHDRAWN_CONFIRMATION;
        break;
      // SUBMITTED is handled by handleApplicationSubmitted
      // SHORTLISTED and INTERVIEWED are deprecated for new actions
    }

    if (!commType) return; // No mapped email for this status

    await this.sendAutomatedEmail({
      applicationId,
      communicationType: commType,
      eventId,
      triggerType: 'APPLICATION_STATUS_CHANGED',
      relatedEntityId: statusHistoryId,
      context,
      recipientEmail: applicantEmail,
      recipientName: applicantName,
      userId
    });
  }

  static async handleInterviewScheduled(
    applicationId: string,
    interviewId: string,
    context: TemplateContext,
    applicantEmail: string,
    applicantName: string,
    userId: string
  ) {
    // OFF by default so an applicant is never emailed as a side effect of an
    // internal calendar change. HR sends interview messages deliberately from the
    // Communications tab, with preview.
    if (!recruitmentAutoEmailPolicy.interviewEvents) {
      console.log('[AutoComm] Interview invitation email suppressed — automatic interview emails are disabled.');
      return;
    }

    const eventId = `interview-scheduled:${interviewId}`;

    await this.sendAutomatedEmail({
      applicationId,
      communicationType: RecruitmentCommunicationType.INTERVIEW_INVITATION,
      eventId,
      triggerType: 'INTERVIEW_SCHEDULED',
      relatedEntityId: interviewId,
      context,
      recipientEmail: applicantEmail,
      recipientName: applicantName,
      userId
    });
  }

  static async handleInterviewRescheduled(
    applicationId: string,
    interviewId: string,
    committedUpdatedAt: Date,
    context: TemplateContext,
    applicantEmail: string,
    applicantName: string,
    userId: string
  ) {
    if (!recruitmentAutoEmailPolicy.interviewEvents) {
      console.log('[AutoComm] Interview reschedule email suppressed — automatic interview emails are disabled.');
      return;
    }

    const timestamp = committedUpdatedAt.getTime();
    const eventId = `interview-rescheduled:${interviewId}:${timestamp}`;

    await this.sendAutomatedEmail({
      applicationId,
      communicationType: RecruitmentCommunicationType.INTERVIEW_RESCHEDULED,
      eventId,
      triggerType: 'INTERVIEW_RESCHEDULED',
      relatedEntityId: interviewId,
      context,
      recipientEmail: applicantEmail,
      recipientName: applicantName,
      userId
    });
  }

  static async handleInterviewCancelled(
    applicationId: string,
    interviewId: string,
    committedUpdatedAt: Date,
    context: TemplateContext,
    applicantEmail: string,
    applicantName: string,
    userId: string
  ) {
    if (!recruitmentAutoEmailPolicy.interviewEvents) {
      console.log('[AutoComm] Interview cancellation email suppressed — automatic interview emails are disabled.');
      return;
    }

    const timestamp = committedUpdatedAt.getTime();
    const eventId = `interview-cancelled:${interviewId}:${timestamp}`;

    await this.sendAutomatedEmail({
      applicationId,
      communicationType: RecruitmentCommunicationType.INTERVIEW_CANCELLED,
      eventId,
      triggerType: 'INTERVIEW_CANCELLED',
      relatedEntityId: interviewId,
      context,
      recipientEmail: applicantEmail,
      recipientName: applicantName,
      userId
    });
  }
}
