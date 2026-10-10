import { BrevoTransactionalEmailProvider } from './brevo-transactional.provider';

export interface EmployeeEmailOutcome {
  sent: boolean;
  /** True when the environment deliberately suppressed the send. */
  simulated: boolean;
  /** The address HRISense addressed the message to. */
  recipient: string;
  /** HR-facing explanation. Always safe to display. */
  message: string;
}

const SIGNATURE = `
        <p style="color: #334155; font-size: 14px; margin-top: 30px;">Best regards,<br/>HR Department<br/>Hospicio de San Jose</p>`;

const SECURITY_REMINDER =
  'Keep these credentials private. HRISense staff will never ask you for your password. Do not share it with anyone, including co-workers.';

function wrap(inner: string): string {
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
${inner}${SIGNATURE}
      </div>
    `;
}

/** The HRISense sign-in address, when the installation has one configured. */
function loginUrl(): string | null {
  const base = process.env.CLIENT_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/login`;
}

function loginUrlHtml(): string {
  const url = loginUrl();
  if (!url) return '';
  return `
        <p style="margin: 20px 0;">
          <a href="${url}" style="background-color: #148281; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Sign in to HRISense</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">If the button does not work, copy this address into your browser:<br/><span style="word-break: break-all;">${url}</span></p>`;
}

function loginUrlText(): string {
  const url = loginUrl();
  return url ? `\nSign in here: ${url}\n` : '';
}

function toOutcome(
  result: { success: boolean; simulated?: boolean; error?: string; recipient: string },
  label: string
): EmployeeEmailOutcome {
  const to = result.recipient;
  if (result.success) {
    return { sent: true, simulated: false, recipient: to, message: `${label} sent to ${to}.` };
  }
  if (result.simulated) {
    return {
      sent: false,
      simulated: true,
      recipient: to,
      message:
        `Email delivery is switched off for this HRISense installation, so the ${label.toLowerCase()} was not sent to ${to}. ` +
        'Give the credentials to the employee directly, or ask your system administrator to switch on email delivery.',
    };
  }
  return {
    sent: false,
    simulated: false,
    recipient: to,
    message: `The ${label.toLowerCase()} could not be delivered to ${to}. Give the credentials to the employee directly.`,
  };
}

export interface WelcomeCredentialsInput {
  /**
   * Delivery address for the first-login credentials. This is the employee's
   * PERSONAL email — see EmployeeController.create for how it is resolved.
   */
  toEmail: string;
  employeeName: string;
  employeeNumber: string;
  /** The address the employee signs in with (may differ from `toEmail`). */
  loginId: string;
  temporaryPassword: string;
}

export class EmployeeEmailService {
  /**
   * Sends the first-login credentials for a newly created HRISense account to
   * the employee's own personal email address.
   *
   * Returns an honest outcome — the caller must never report "sent" on failure.
   */
  static async sendWelcomeEmail(input: WelcomeCredentialsInput): Promise<EmployeeEmailOutcome> {
    const { toEmail, employeeName, employeeNumber, loginId, temporaryPassword } = input;
    const subject = 'Welcome to HRISense — Your Login Credentials';

    const textBody =
      `Welcome to HRISense, ${employeeName}!\n\n` +
      `Your employee record and HRISense account have been created.\n\n` +
      `Employee Name: ${employeeName}\n` +
      `Employee Number: ${employeeNumber}\n` +
      `Login ID: ${loginId}\n` +
      `Temporary Password: ${temporaryPassword}\n` +
      `${loginUrlText()}\n` +
      `You must change this temporary password the first time you sign in.\n\n` +
      `${SECURITY_REMINDER}`;

    const htmlBody = wrap(`
        <h2 style="color: #0f172a;">Welcome to HRISense, ${employeeName}!</h2>
        <p style="color: #334155; font-size: 16px;">Your employee record and HRISense account have been created. You can sign in with the credentials below.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #475569;"><strong>Employee Name:</strong> ${employeeName}</p>
          <p style="margin: 0 0 10px 0; color: #475569;"><strong>Employee Number:</strong> ${employeeNumber}</p>
          <p style="margin: 0 0 10px 0; color: #475569;"><strong>Login ID:</strong> ${loginId}</p>
          <p style="margin: 0; color: #475569;"><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        </div>${loginUrlHtml()}
        <p style="color: #b45309; font-size: 14px;"><strong>You must change this temporary password the first time you sign in.</strong></p>
        <p style="color: #64748b; font-size: 13px;">${SECURITY_REMINDER}</p>`);

    const result = await BrevoTransactionalEmailProvider.sendEmail({
      toEmail,
      toName: employeeName,
      subject,
      textBody,
      htmlBody,
    });

    if (!result.success && !result.simulated) {
      console.error(`[EMPLOYEE_EMAIL] Welcome email failed for ${toEmail}:`, result.error);
    }
    return toOutcome(result, 'Welcome email');
  }

  /**
   * Sends a newly issued temporary password after an HR-initiated reset.
   * HRISense never stores plaintext passwords, so an existing password can never
   * be "re-sent" — a reset always issues a brand-new credential.
   */
  static async sendResetCredentialsEmail(
    toEmail: string,
    toName: string,
    username: string,
    tempPassword: string
  ): Promise<EmployeeEmailOutcome> {
    const subject = 'HRISense — Your Password Has Been Reset';

    const textBody =
      `Hello ${toName},\n\nHR has reset your HRISense password.\n\n` +
      `Login ID: ${username}\nNew Temporary Password: ${tempPassword}\n` +
      `${loginUrlText()}\n` +
      `You must change this temporary password the next time you sign in. ` +
      `If you did not expect this, contact the HR Department immediately.\n\n${SECURITY_REMINDER}`;

    const htmlBody = wrap(`
        <h2 style="color: #0f172a;">Your HRISense password has been reset</h2>
        <p style="color: #334155; font-size: 16px;">Hello ${toName}, HR has issued a new temporary password for your account.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #475569;"><strong>Login ID:</strong> ${username}</p>
          <p style="margin: 0; color: #475569;"><strong>New Temporary Password:</strong> ${tempPassword}</p>
        </div>${loginUrlHtml()}
        <p style="color: #64748b; font-size: 14px;"><em>You must change this temporary password the next time you sign in. If you did not expect this, contact the HR Department immediately.</em></p>
        <p style="color: #64748b; font-size: 13px;">${SECURITY_REMINDER}</p>`);

    const result = await BrevoTransactionalEmailProvider.sendEmail({
      toEmail,
      toName,
      subject,
      textBody,
      htmlBody,
    });

    if (!result.success && !result.simulated) {
      console.error(`[EMPLOYEE_EMAIL] Reset credentials email failed for ${toEmail}:`, result.error);
    }
    return toOutcome(result, 'Password reset email');
  }

  /**
   * Sends the password-reset link produced by the self-service "Forgot password"
   * flow. The raw token travels ONLY inside this link — it is never returned by
   * the API.
   */
  static async sendPasswordResetLink(
    toEmail: string,
    toName: string,
    resetUrl: string,
    expiresInMinutes: number
  ): Promise<EmployeeEmailOutcome> {
    const subject = 'HRISense — Password Reset Request';

    const textBody = `Hello ${toName},\n\nA password reset was requested for your HRISense account.\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes. If you did not request this, you can safely ignore this message — your password will not change.`;

    const htmlBody = wrap(`
        <h2 style="color: #0f172a;">Reset your HRISense password</h2>
        <p style="color: #334155; font-size: 16px;">Hello ${toName}, a password reset was requested for your account.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #148281; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Choose a new password</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">If the button does not work, copy this address into your browser:<br/><span style="word-break: break-all;">${resetUrl}</span></p>
        <p style="color: #64748b; font-size: 14px;"><em>This link expires in ${expiresInMinutes} minutes. If you did not request this, you can safely ignore this message — your password will not change.</em></p>`);

    const result = await BrevoTransactionalEmailProvider.sendEmail({
      toEmail,
      toName,
      subject,
      textBody,
      htmlBody,
    });

    if (!result.success && !result.simulated) {
      console.error(`[EMPLOYEE_EMAIL] Password reset link failed for ${toEmail}:`, result.error);
    }
    return toOutcome(result, 'Password reset email');
  }
}
