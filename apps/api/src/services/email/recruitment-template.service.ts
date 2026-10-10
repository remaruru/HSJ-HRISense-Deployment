import { RecruitmentCommunicationType } from '@prisma/client';
import { RenderedTemplate } from '../../types/recruitment.types';

export interface TemplateContext {
  applicantName: string;
  applicationReference: string;
  jobTitle: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  meetingLink?: string;
  hrContactName?: string;
  hrContactEmail?: string;
  nextSteps?: string;
  requirements?: string;
  customMessage?: string;
  /**
   * Login-free, read-only application status link. When present it is added to
   * applicant emails so they can check progress without an account.
   */
  statusUrl?: string;
}

export class RecruitmentTemplateService {
  private static readonly PRIMARY_COLOR = '#148281';
  
  /**
   * Replaces allowed placeholders safely.
   */
  private static escapeHtml(text?: string): string {
    if (!text) return '';
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private static renderRecruitmentEmailLayout(preheader: string, contentHtml: string, hrContactEmail?: string): string {
    const doNotReplyText = hrContactEmail
      ? `This message was generated automatically by HRISense. For questions, you may reply to this email or contact Hospicio de San Jose Human Resources at <a href="mailto:${this.escapeHtml(hrContactEmail)}" style="color: ${this.PRIMARY_COLOR}; text-decoration: none;">${this.escapeHtml(hrContactEmail)}</a>.`
      : `This is an automated message from HRISense. Please do not reply directly to this email.`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HRISense Recruitment</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #374151; }
    table { border-collapse: collapse; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0px; overflow: hidden;">${this.escapeHtml(preheader)}</div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${this.PRIMARY_COLOR}; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">HRISense</h1>
              <p style="color: #e5e7eb; margin: 4px 0 0 0; font-size: 14px;">Hospicio de San Jose Human Resources</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 24px;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                ${doNotReplyText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private static renderRecruitmentPlainText(content: string, hrContactEmail?: string): string {
    const doNotReplyText = hrContactEmail
      ? `This message was generated automatically by HRISense. For questions, you may reply to this email or contact Hospicio de San Jose Human Resources at ${hrContactEmail}.`
      : `This is an automated message from HRISense. Please do not reply directly to this email.`;

    return `${content}\n\n---\n${doNotReplyText}`;
  }

  /**
   * Renders the login-free application status link, when one is supplied.
   * Applicants never receive HRISense accounts — this is read-only visibility of
   * their own application.
   */
  private static renderStatusLink(context: TemplateContext): string {
    if (!context.statusUrl) return '';
    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
        <tr>
          <td align="center" style="padding: 4px 0 12px 0;">
            <a href="${context.statusUrl}"
               style="background-color: ${this.PRIMARY_COLOR}; color: #ffffff; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; font-family: Arial, sans-serif; font-size: 14px;">
              Check your application status
            </a>
          </td>
        </tr>
        <tr>
          <td style="font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; text-align: center; padding-bottom: 4px;">
            No sign-in required. Keep this link private — it shows the status of your application.
          </td>
        </tr>
      </table>
    `;
  }

  private static renderApplicationDetailsCard(context: TemplateContext): string {
    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #374151;">Position:</strong> <span style="color: #4b5563;">${this.escapeHtml(context.jobTitle)}</span></p>
            <p style="margin: 0; font-size: 14px;"><strong style="color: #374151;">Application Reference:</strong> <span style="color: #4b5563;">${this.escapeHtml(context.applicationReference)}</span></p>
          </td>
        </tr>
      </table>
    `;
  }

  private static renderInterviewDetailsCard(context: TemplateContext): string {
    const rows = [];
    if (context.interviewDate) {
      rows.push(`<p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #374151;">Date:</strong> <span style="color: #4b5563;">${this.escapeHtml(context.interviewDate)}</span></p>`);
    }
    if (context.interviewTime) {
      rows.push(`<p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #374151;">Time:</strong> <span style="color: #4b5563;">${this.escapeHtml(context.interviewTime)}</span></p>`);
    }
    if (context.interviewLocation) {
      rows.push(`<p style="margin: 0 0 8px 0; font-size: 14px;"><strong style="color: #374151;">Location:</strong> <span style="color: #4b5563;">${this.escapeHtml(context.interviewLocation)}</span></p>`);
    }
    if (context.meetingLink && (context.meetingLink.startsWith('http://') || context.meetingLink.startsWith('https://'))) {
      rows.push(`<p style="margin: 0; font-size: 14px;"><strong style="color: #374151;">Meeting Link:</strong> <a href="${this.escapeHtml(context.meetingLink)}" style="color: ${this.PRIMARY_COLOR}; text-decoration: underline;">Join Meeting</a></p>`);
    }
    
    if (rows.length === 0) return '';

    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
        <tr>
          <td style="padding: 16px;">
            ${rows.join('')}
          </td>
        </tr>
      </table>
    `;
  }

  private static formatHeading(text: string): string {
    return `<h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">${text}</h2>`;
  }

  private static formatGreeting(name: string): string {
    return `<p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${this.escapeHtml(name)},</p>`;
  }

  private static formatParagraph(text: string): string {
    return `<p style="margin: 0 0 16px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">${text}</p>`;
  }

  static getTemplate(type: RecruitmentCommunicationType, context: TemplateContext): RenderedTemplate {
    let subject = '';
    let preheader = '';
    let htmlContent = '';
    let textContent = '';

    const safeName = this.escapeHtml(context.applicantName);
    const safeTitle = this.escapeHtml(context.jobTitle);

    switch (type) {
      case RecruitmentCommunicationType.APPLICATION_RECEIVED:
        subject = `Application Received - ${context.jobTitle}`;
        preheader = `We have received your application for ${context.jobTitle}.`;
        htmlContent = 
          this.formatHeading('Application Received') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Thank you for applying for the <strong>${safeTitle}</strong> position at Hospicio de San Jose.`) +
          this.formatParagraph('We are currently reviewing your application and will be in touch soon.') +
          this.renderApplicationDetailsCard(context) +
          this.renderStatusLink(context);

        textContent =
          `Dear ${context.applicantName},\n\nThank you for applying for the ${context.jobTitle} position at Hospicio de San Jose.\n\nWe are currently reviewing your application and will be in touch soon.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}` +
          (context.statusUrl
            ? `\n\nCheck your application status any time (no sign-in needed):\n${context.statusUrl}`
            : '');
        break;

      case RecruitmentCommunicationType.APPLICATION_UNDER_REVIEW:
        subject = `Application Under Review - ${context.jobTitle}`;
        preheader = `Your application for ${context.jobTitle} is now under review.`;
        htmlContent = 
          this.formatHeading('Status Update: Under Review') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Your application for the <strong>${safeTitle}</strong> position is now under review. We will notify you once we have an update.`) +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nYour application for the ${context.jobTitle} position is now under review. We will notify you once we have an update.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.INTERVIEW_PROCESS_UPDATE:
        subject = `Interview Process Update - ${context.jobTitle}`;
        preheader = `Your application for ${context.jobTitle} has moved to the interview phase.`;
        htmlContent = 
          this.formatHeading('Status Update: For Interview') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Good news! Your application for the <strong>${safeTitle}</strong> position has moved to the interview phase.`) +
          this.formatParagraph('Our HR team will contact you shortly to schedule an interview.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nGood news! Your application for the ${context.jobTitle} position has moved to the interview phase.\n\nOur HR team will contact you shortly to schedule an interview.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.INTERVIEW_INVITATION:
        subject = `Interview Invitation: ${context.jobTitle} - Hospicio de San Jose`;
        preheader = `You are invited to an interview for ${context.jobTitle}.`;
        htmlContent = 
          this.formatHeading('Interview Invitation') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`We would like to invite you to an interview for the <strong>${safeTitle}</strong> position.`) +
          this.renderInterviewDetailsCard(context) +
          this.formatParagraph('Please let us know if you can attend.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nWe would like to invite you to an interview for the ${context.jobTitle} position.\n\nDate: ${context.interviewDate || 'TBD'}\nTime: ${context.interviewTime || 'TBD'}\nLocation: ${context.interviewLocation || 'TBD'}\n\nPlease let us know if you can attend.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.INTERVIEW_RESCHEDULED:
        subject = `Interview Rescheduled: ${context.jobTitle} - Hospicio de San Jose`;
        preheader = `Your interview for ${context.jobTitle} has been rescheduled.`;
        htmlContent = 
          this.formatHeading('Interview Rescheduled') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Your interview for the <strong>${safeTitle}</strong> position has been rescheduled.`) +
          this.renderInterviewDetailsCard(context) +
          this.formatParagraph('Please let us know if you can attend the new schedule.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nYour interview for the ${context.jobTitle} position has been rescheduled.\n\nDate: ${context.interviewDate || 'TBD'}\nTime: ${context.interviewTime || 'TBD'}\nLocation: ${context.interviewLocation || 'TBD'}\n\nPlease let us know if you can attend the new schedule.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.INTERVIEW_CANCELLED:
        subject = `Interview Cancelled: ${context.jobTitle} - Hospicio de San Jose`;
        preheader = `Your interview for ${context.jobTitle} has been cancelled.`;
        htmlContent = 
          this.formatHeading('Interview Cancelled') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Your interview for the <strong>${safeTitle}</strong> position has been cancelled.`) +
          this.formatParagraph('We will reach out if it needs to be rescheduled or if there are other updates regarding your application.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nYour interview for the ${context.jobTitle} position has been cancelled.\n\nWe will reach out if it needs to be rescheduled or if there are other updates regarding your application.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.ADDITIONAL_REQUIREMENTS:
        subject = `Additional Requirements for ${context.jobTitle}`;
        preheader = `We need a few more documents to process your application.`;
        
        let requirementsText = context.requirements ? this.escapeHtml(context.requirements).replace(/\\n/g, '<br/>') : 'Our HR team will contact you shortly with the required information.';
        let requirementsPlain = context.requirements || 'Our HR team will contact you shortly with the required information.';
        
        htmlContent = 
          this.formatHeading('Additional Requirements Needed') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`We need a few more documents to process your application for the <strong>${safeTitle}</strong> position.`) +
          `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <strong style="color: #166534; display: block; margin-bottom: 8px;">Requirements:</strong>
            <div style="color: #15803d; font-size: 14px; line-height: 1.5;">${requirementsText}</div>
          </div>` +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nWe need a few more documents to process your application for the ${context.jobTitle} position.\n\nRequirements:\n${requirementsPlain}\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.APPLICATION_ACCEPTED:
        subject = `Job Offer: ${context.jobTitle} - Hospicio de San Jose`;
        preheader = `Congratulations! We are pleased to offer you the position.`;
        htmlContent = 
          this.formatHeading('Congratulations!') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`We are pleased to offer you the position of <strong>${safeTitle}</strong>.`) +
          this.formatParagraph(`Our Human Resources team will provide further onboarding instructions shortly.`) +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nCongratulations! We are pleased to offer you the position of ${context.jobTitle}.\n\nOur Human Resources team will provide further onboarding instructions shortly.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.APPLICATION_NOT_SELECTED:
        subject = `Update on your application for ${context.jobTitle}`;
        preheader = `Update regarding your recent application.`;
        htmlContent = 
          this.formatHeading('Application Update') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Thank you for taking the time to apply for the <strong>${safeTitle}</strong> position.`) +
          this.formatParagraph('After careful consideration, we will not be moving forward with your application at this time.') +
          this.formatParagraph('We wish you the best in your career search.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nThank you for taking the time to apply for the ${context.jobTitle} position.\n\nAfter careful consideration, we will not be moving forward with your application at this time.\n\nWe wish you the best in your career search.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.APPLICATION_WITHDRAWN_CONFIRMATION:
        subject = `Application Withdrawn - ${context.jobTitle}`;
        preheader = `We have recorded the withdrawal of your application.`;
        htmlContent = 
          this.formatHeading('Application Withdrawn') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`This email is to confirm that we have recorded the withdrawal of your application for the <strong>${safeTitle}</strong> position.`) +
          this.formatParagraph('Thank you for your interest in Hospicio de San Jose, and we wish you the best in your future endeavors.') +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nThis email is to confirm that we have recorded the withdrawal of your application for the ${context.jobTitle} position.\n\nThank you for your interest in Hospicio de San Jose, and we wish you the best in your future endeavors.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.SHORTLISTED:
        // Legacy support
        subject = `Good News! You have been shortlisted for ${context.jobTitle}`;
        preheader = `You have been shortlisted for ${context.jobTitle}.`;
        htmlContent = 
          this.formatHeading('Status Update: Shortlisted') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(`Congratulations! You have been shortlisted for the <strong>${safeTitle}</strong> position. We will be reaching out soon regarding the next steps.`) +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\nCongratulations! You have been shortlisted for the ${context.jobTitle} position. We will be reaching out soon regarding the next steps.\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;

      case RecruitmentCommunicationType.CUSTOM_MESSAGE:
      default:
        subject = `Update on your application: ${context.jobTitle}`;
        preheader = `Update regarding your recent application.`;
        const safeMessage = context.customMessage ? this.escapeHtml(context.customMessage).replace(/\\n/g, '<br/>') : 'Your application has been updated.';
        htmlContent = 
          this.formatHeading('Application Update') +
          this.formatGreeting(context.applicantName) +
          this.formatParagraph(safeMessage) +
          this.renderApplicationDetailsCard(context);
        
        textContent = 
          `Dear ${context.applicantName},\n\n${context.customMessage || 'Your application has been updated.'}\n\nPosition: ${context.jobTitle}\nApplication Reference: ${context.applicationReference}`;
        break;
    }

    return {
      subject,
      htmlBody: this.renderRecruitmentEmailLayout(preheader, htmlContent, context.hrContactEmail),
      textBody: this.renderRecruitmentPlainText(textContent, context.hrContactEmail)
    };
  }
}
