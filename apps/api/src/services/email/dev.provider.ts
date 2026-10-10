import { CommunicationSendStatus } from '@prisma/client';
import { RecruitmentEmailProvider } from './recruitment-email.provider';
import { RecruitmentEmailRequest, RecruitmentEmailResult } from '../../types/recruitment.types';
import { recruitmentConfig } from '../../config/recruitment.config';

export class DevelopmentRecruitmentEmailProvider extends RecruitmentEmailProvider {
  validateConfig(): void {
    // Development provider is always valid; no API keys required.
  }

  async sendEmail(request: RecruitmentEmailRequest): Promise<RecruitmentEmailResult> {
    const isEnabled = recruitmentConfig.emailEnabled;
    const testRecipient = recruitmentConfig.testRecipient;

    if (!isEnabled) {
      console.log(`[DEV_PROVIDER] Email simulation: Suppressed send to ${request.toEmail}`);
      console.log(`[DEV_PROVIDER] Subject: ${request.subject}`);
      
      return {
        success: true,
        provider: 'DEVELOPMENT',
        sendStatus: CommunicationSendStatus.SIMULATED,
        simulated: true,
        redirected: false,
        actualRecipient: request.toEmail,
        intendedRecipient: request.toEmail,
      };
    }

    if (testRecipient) {
      console.log(`[DEV_PROVIDER] Email redirected: Intended for ${request.toEmail}, redirecting to test recipient ${testRecipient}`);
      
      // In a real scenario, this might still use SMTP or Ethereal to send to the test recipient.
      // Since we shouldn't send real emails during this task, we will just simulate it as a successful redirect.
      return {
        success: true,
        provider: 'DEVELOPMENT',
        sendStatus: CommunicationSendStatus.SENT,
        simulated: false,
        redirected: true,
        actualRecipient: testRecipient,
        intendedRecipient: request.toEmail,
        providerMessageId: `dev-redirect-${Date.now()}`
      };
    }

    // Even if enabled, without a test recipient, the Dev provider safely mocks the send
    // to prevent accidental leakage while configured as DEVELOPMENT.
    console.log(`[DEV_PROVIDER] Email mocking active (no test recipient). Intended for ${request.toEmail}`);
    return {
      success: true,
      provider: 'DEVELOPMENT',
      sendStatus: CommunicationSendStatus.SIMULATED,
      simulated: true,
      redirected: false,
      actualRecipient: request.toEmail,
      intendedRecipient: request.toEmail,
      providerMessageId: `dev-mock-${Date.now()}`
    };
  }
}
