import { CommunicationSendStatus } from '@prisma/client';
import { RecruitmentEmailProvider } from './recruitment-email.provider';
import { RecruitmentEmailRequest, RecruitmentEmailResult } from '../../types/recruitment.types';
import { recruitmentConfig } from '../../config/recruitment.config';
import { EmailProviderConfigurationError } from '../../lib/recruitment.errors';

export class BrevoRecruitmentEmailProvider extends RecruitmentEmailProvider {
  validateConfig(): void {
    if (!recruitmentConfig.brevoApiKey) {
      throw new EmailProviderConfigurationError('BREVO_API_KEY is not configured in the environment.');
    }
  }

  async sendEmail(request: RecruitmentEmailRequest): Promise<RecruitmentEmailResult> {
    const isEnabled = recruitmentConfig.emailEnabled;
    const testRecipient = recruitmentConfig.testRecipient;

    if (!isEnabled) {
      return {
        success: true,
        provider: 'BREVO',
        sendStatus: CommunicationSendStatus.SIMULATED,
        simulated: true,
        redirected: false,
        actualRecipient: request.toEmail,
        intendedRecipient: request.toEmail,
        failureMessage: 'Email sending is globally disabled via configuration.'
      };
    }

    const actualRecipient = testRecipient ? testRecipient : request.toEmail;
    const redirected = !!testRecipient;

    try {
      this.validateConfig();

      const payload: any = {
        sender: {
          name: request.fromName || recruitmentConfig.defaultFromName,
          email: request.fromEmail || recruitmentConfig.defaultFromEmail,
        },
        to: [
          {
            email: actualRecipient,
            name: redirected ? `[TEST REDIRECT] ${request.toName}` : request.toName,
          }
        ],
        subject: request.subject,
        textContent: request.textBody,
      };

      if (request.htmlBody) {
        payload.htmlContent = request.htmlBody;
      }

      if (request.replyToEmail || recruitmentConfig.defaultReplyToEmail) {
        payload.replyTo = {
          email: request.replyToEmail || recruitmentConfig.defaultReplyToEmail
        };
      }

      // Timeout safety: 10 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': recruitmentConfig.brevoApiKey as string
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Safe error normalization without exposing sensitive full responses
        const errorData = await response.json().catch(() => ({})) as any;
        const failureCode = errorData.code || `HTTP_${response.status}`;
        const failureMessage = errorData.message || 'Unknown Brevo API error';

        console.error(`[BREVO_PROVIDER] Failed to send email to ${actualRecipient}: ${failureCode}`);

        return {
          success: false,
          provider: 'BREVO',
          sendStatus: CommunicationSendStatus.FAILED,
          simulated: false,
          redirected,
          actualRecipient,
          intendedRecipient: request.toEmail,
          failureCode,
          failureMessage
        };
      }

      const data = await response.json() as any;
      const providerMessageId = data.messageId;

      return {
        success: true,
        provider: 'BREVO',
        sendStatus: CommunicationSendStatus.SENT,
        simulated: false,
        redirected,
        actualRecipient,
        intendedRecipient: request.toEmail,
        providerMessageId
      };

    } catch (error: any) {
      console.error(`[BREVO_PROVIDER] Exception during email send:`, error.message);
      
      const failureCode = error.name === 'AbortError' ? 'TIMEOUT' : 'EXCEPTION';
      
      return {
        success: false,
        provider: 'BREVO',
        sendStatus: CommunicationSendStatus.FAILED,
        simulated: false,
        redirected,
        actualRecipient,
        intendedRecipient: request.toEmail,
        failureCode,
        failureMessage: error.message || 'Internal exception during send'
      };
    }
  }
}
