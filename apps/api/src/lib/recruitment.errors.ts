export class RecruitmentError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'RecruitmentError';
  }
}

export class RecruitmentAuthorizationError extends RecruitmentError {
  constructor(message: string = 'You are not authorized to perform this recruitment action.') {
    super('RECRUITMENT_FORBIDDEN', message, 403);
    this.name = 'RecruitmentAuthorizationError';
  }
}

export class JobOpeningNotFoundError extends RecruitmentError {
  constructor() {
    super('JOB_OPENING_NOT_FOUND', 'The requested job opening was not found.', 404);
    this.name = 'JobOpeningNotFoundError';
  }
}

export class JobApplicationNotFoundError extends RecruitmentError {
  constructor() {
    super('JOB_APPLICATION_NOT_FOUND', 'The requested job application was not found.', 404);
    this.name = 'JobApplicationNotFoundError';
  }
}

export class EmailProviderConfigurationError extends RecruitmentError {
  constructor(message: string) {
    super('EMAIL_PROVIDER_CONFIG_ERROR', message, 500);
    this.name = 'EmailProviderConfigurationError';
  }
}

export class EmailSendFailedError extends RecruitmentError {
  constructor(message: string, public providerErrorCode?: string) {
    super('EMAIL_SEND_FAILED', message, 500);
    this.name = 'EmailSendFailedError';
  }
}
