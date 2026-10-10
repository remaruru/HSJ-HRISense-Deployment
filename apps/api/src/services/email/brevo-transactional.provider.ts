import { env, transactionalEmailEnabled } from '../../config/env';

export interface TransactionalEmailOptions {
  toEmail: string;
  toName: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
}

export interface TransactionalEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when nothing left the server (development simulation). */
  simulated?: boolean;
  /** The address the message was actually addressed to. */
  recipient: string;
}

/**
 * Whether real transactional email may leave this machine.
 *
 * Resolved once, at boot, by the validated env config:
 *   Production  — enabled unless ENABLE_TRANSACTIONAL_EMAILS is explicitly false.
 *   Development — DISABLED unless ENABLE_TRANSACTIONAL_EMAILS is explicitly true.
 *
 * The development default is deliberately opt-in so a machine holding a real
 * Brevo key cannot accidentally email real employees or applicants.
 *
 * The config layer additionally REQUIRES BREVO_API_KEY and a verified
 * DEFAULT_FROM_EMAIL whenever sending is switched on, so a half-configured
 * installation fails loudly at boot instead of silently at the first send.
 */

/**
 * Brevo transactional sender for HRISense account email.
 *
 * DELIVERY RULE — no redirection.
 * Every message sent through this provider carries credentials or a credential
 * link (welcome credentials, HR-issued reset credentials, self-service reset
 * links). A "send everything to a test address" switch previously existed here;
 * it was removed deliberately, because redirecting a credential message means
 * HRISense reports "sent" to HR while the employee receives nothing — and the
 * password lands in somebody else's inbox. Messages here always go to the
 * address the caller resolved, or they are honestly reported as not sent.
 *
 * Applicant recruitment email is a separate provider with its own configuration
 * and carries no credentials.
 */
export class BrevoTransactionalEmailProvider {
  static async sendEmail(options: TransactionalEmailOptions): Promise<TransactionalEmailResult> {
    const apiKey = env.BREVO_API_KEY;
    const isEnabled = transactionalEmailEnabled;
    const recipient = options.toEmail;

    if (!isEnabled) {
      console.log(
        `[BREVO_TRANSACTIONAL] Simulation mode: "${options.subject}" to ${recipient} was NOT sent. ` +
          'Set ENABLE_TRANSACTIONAL_EMAILS=true (with BREVO_API_KEY and a verified DEFAULT_FROM_EMAIL) to deliver for real.'
      );
      return {
        success: false,
        simulated: true,
        recipient,
        error: 'Transactional email is disabled in this environment',
      };
    }

    if (!apiKey) {
      console.error('[BREVO_TRANSACTIONAL] BREVO_API_KEY is not configured in the environment.');
      return { success: false, recipient, error: 'BREVO_API_KEY missing' };
    }

    try {
      const payload: any = {
        sender: {
          name: env.DEFAULT_FROM_NAME || 'HRISense System',
          email: env.DEFAULT_FROM_EMAIL || 'no-reply@hrisense.local',
        },
        to: [{ email: recipient, name: options.toName }],
        subject: options.subject,
        textContent: options.textBody,
      };

      if (options.htmlBody) {
        payload.htmlContent = options.htmlBody;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey as string
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        console.error(`[BREVO_TRANSACTIONAL] Failed to send email to ${recipient}:`, errorData);
        return { success: false, recipient, error: errorData.message || 'Unknown Brevo error' };
      }

      const data = await response.json() as any;
      return { success: true, recipient, messageId: data.messageId };
    } catch (error: any) {
      console.error(`[BREVO_TRANSACTIONAL] Exception during email send:`, error.message);
      return { success: false, recipient, error: error.message };
    }
  }
}
