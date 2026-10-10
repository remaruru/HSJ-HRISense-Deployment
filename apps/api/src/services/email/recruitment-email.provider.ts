import { RecruitmentEmailRequest, RecruitmentEmailResult } from '../../types/recruitment.types';

export abstract class RecruitmentEmailProvider {
  /**
   * Validates if the provider has all necessary configuration to send emails.
   * Should throw EmailProviderConfigurationError if invalid.
   */
  abstract validateConfig(): void;

  /**
   * Sends a recruitment email in a standardized, provider-neutral way.
   * Must never throw internally for send failures; instead return a safe RecruitmentEmailResult.
   */
  abstract sendEmail(request: RecruitmentEmailRequest): Promise<RecruitmentEmailResult>;
}
