import dotenv from 'dotenv';
import { RecruitmentConfig } from '../types/recruitment.types';

dotenv.config();

/**
 * Automatic applicant email policy.
 *
 * The application-received acknowledgement stays automatic — an applicant who
 * submits a form expects an immediate confirmation.
 *
 * Everything else (status changes, interview scheduling / rescheduling /
 * cancellation) is OFF by default so HR stays in control of what reaches an
 * applicant. HR sends those from the Communications tab, with preview, and every
 * attempt is still recorded. Set the flags to 'true' only after HSJ confirms they
 * want those messages to go out automatically.
 */
export const recruitmentAutoEmailPolicy = {
  applicationReceived: process.env.RECRUITMENT_AUTO_EMAIL_APPLICATION_RECEIVED !== 'false',
  statusChanges: process.env.RECRUITMENT_AUTO_EMAIL_STATUS_CHANGES === 'true',
  interviewEvents: process.env.RECRUITMENT_AUTO_EMAIL_INTERVIEW_EVENTS === 'true',
} as const;

export const recruitmentConfig: RecruitmentConfig = {
  // Whether emails should actually be sent by the provider (false = SIMULATED)
  emailEnabled: process.env.RECRUITMENT_EMAIL_SEND_ENABLED === 'true',
  
  emailProvider: (process.env.RECRUITMENT_EMAIL_PROVIDER as 'DEVELOPMENT' | 'BREVO') || 'DEVELOPMENT',
  testRecipient: process.env.RECRUITMENT_EMAIL_TEST_RECIPIENT,
  defaultFromEmail: process.env.RECRUITMENT_FROM_EMAIL || 'careers@hrisense.local',
  defaultFromName: process.env.RECRUITMENT_FROM_NAME || 'HRISense Careers',
  defaultReplyToEmail: process.env.RECRUITMENT_REPLY_TO_EMAIL,
  brevoApiKey: process.env.BREVO_API_KEY,
};
