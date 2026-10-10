import { prisma } from '../config/prisma';
import { recruitmentConfig } from '../config/recruitment.config';
import { RecruitmentEmailProvider } from './email/recruitment-email.provider';
import { DevelopmentRecruitmentEmailProvider } from './email/dev.provider';
import { BrevoRecruitmentEmailProvider } from './email/brevo.provider';
import { RecruitmentTemplateService, TemplateContext } from './email/recruitment-template.service';
import { RecruitmentCommunicationType, CommunicationChannel, CommunicationInitiator } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';

export class ApplicantCommunicationService {
  private static provider: RecruitmentEmailProvider;

  static getProvider(): RecruitmentEmailProvider {
    if (!this.provider) {
      if (recruitmentConfig.emailProvider === 'BREVO') {
        this.provider = new BrevoRecruitmentEmailProvider();
      } else {
        this.provider = new DevelopmentRecruitmentEmailProvider();
      }
      this.provider.validateConfig();
    }
    return this.provider;
  }

  static async sendSystemEmail(
    applicationId: string,
    type: RecruitmentCommunicationType,
    data: TemplateContext
  ) {
    return this.sendEmailInternal(applicationId, type, data, null, CommunicationInitiator.SYSTEM);
  }

  static async sendEmail(
    applicationId: string,
    type: RecruitmentCommunicationType,
    data: TemplateContext,
    userId: string
  ) {
    if (!userId) throw new AppError('User ID is required for USER initiated communication', 400);
    return this.sendEmailInternal(applicationId, type, data, userId, CommunicationInitiator.USER);
  }

  private static async sendEmailInternal(
    applicationId: string,
    type: RecruitmentCommunicationType,
    data: TemplateContext,
    userId: string | null,
    initiatedBy: CommunicationInitiator
  ) {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: true, jobOpening: true }
    });

    if (!application) throw new AppError('Job Application not found', 404);

    const provider = this.getProvider();
    
    // Render templates
    const rendered = RecruitmentTemplateService.getTemplate(type, data);

    const result = await provider.sendEmail({
      toEmail: application.applicant.email,
      toName: `${application.applicant.firstName} ${application.applicant.lastName}`,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
    });

    const communication = await prisma.applicantCommunication.create({
      data: {
        jobApplicationId: applicationId,
        communicationType: type,
        channel: CommunicationChannel.EMAIL,
        recipientEmail: result.actualRecipient,
        recipientName: `${application.applicant.firstName} ${application.applicant.lastName}`,
        subjectSnapshot: rendered.subject,
        bodySnapshot: rendered.textBody, // or htmlBody depending on policy, text is safer for storage
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        sendStatus: result.sendStatus,
        initiatedBy,
        sentByUserId: userId,
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureMessage
      }
    });

    // We can skip audit for SYSTEM if desired, but user asked for "unsupported optional Recruitment notifications"
    // to not fail the transaction. We can wrap audit in try-catch.
    try {
      await createAuditLog({
        action: `APPLICANT_COMMUNICATION_${result.sendStatus}`,
        actorUserId: userId || 'SYSTEM',
        entityType: 'ApplicantCommunication',
        entityId: communication.id,
        metadata: { applicationId, communicationType: type, success: result.success, initiatedBy }
      });
    } catch (e) {
      console.error('[ApplicantCommunicationService] Audit failed', e);
    }

    return communication;
  }
  
  static async listCommunications(applicationId: string) {
    return prisma.applicantCommunication.findMany({
      where: { jobApplicationId: applicationId },
      orderBy: { sentAt: 'desc' },
      include: { sentByUser: { select: { email: true } } }
    });
  }

  static previewEmail(type: RecruitmentCommunicationType, data: TemplateContext) {
    return RecruitmentTemplateService.getTemplate(type, data);
  }

  static async retryCommunication(applicationId: string, communicationId: string, userId: string) {
    const original = await prisma.applicantCommunication.findUnique({
      where: { id: communicationId }
    });

    if (!original || original.jobApplicationId !== applicationId) {
      throw new AppError('Communication not found', 404);
    }

    if (original.sendStatus !== 'FAILED') {
      throw new AppError('Only FAILED communications can be retried', 409);
    }

    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: true }
    });

    if (!application) throw new AppError('Application not found', 404);

    const provider = this.getProvider();
    const result = await provider.sendEmail({
      toEmail: original.recipientEmail,
      toName: original.recipientName,
      subject: original.subjectSnapshot,
      htmlBody: original.bodySnapshot, // using snapshot
      textBody: original.bodySnapshot,
    });

    const newCommunication = await prisma.applicantCommunication.create({
      data: {
        jobApplicationId: applicationId,
        communicationType: original.communicationType,
        channel: original.channel,
        recipientEmail: result.actualRecipient,
        recipientName: original.recipientName,
        subjectSnapshot: original.subjectSnapshot,
        bodySnapshot: original.bodySnapshot,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        sendStatus: result.sendStatus,
        sentByUserId: userId,
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureMessage,
        retryOfCommunicationId: original.id
      }
    });

    await createAuditLog({
      action: `APPLICANT_COMMUNICATION_RETRY_${result.sendStatus}`,
      actorUserId: userId,
      entityType: 'ApplicantCommunication',
      entityId: newCommunication.id,
      metadata: { applicationId, originalCommunicationId: original.id, success: result.success }
    });

    return newCommunication;
  }
}
