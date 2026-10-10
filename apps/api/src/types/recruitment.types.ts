import { CommunicationSendStatus } from '@prisma/client';

export interface RecruitmentEmailRequest {
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody?: string;
  textBody: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  metadata?: Record<string, any>;
}

export interface RecruitmentEmailResult {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  sendStatus: CommunicationSendStatus;
  simulated: boolean;
  redirected: boolean;
  actualRecipient: string;
  intendedRecipient: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface RecruitmentConfig {
  emailEnabled: boolean;
  emailProvider: 'DEVELOPMENT' | 'BREVO';
  testRecipient?: string;
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyToEmail?: string;
  brevoApiKey?: string;
}

export interface RenderedTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}
