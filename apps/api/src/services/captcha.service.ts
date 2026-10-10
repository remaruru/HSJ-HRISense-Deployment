import { captchaEnabled, env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

/**
 * reCAPTCHA v2 ("I'm not a robot" checkbox).
 *
 * The browser shows the checkbox with the public site key and sends the token it
 * receives; the server checks that token with Google using the secret key
 * (server only). Off until both keys are configured.
 *
 * Used on the public job application (always) and on sign-in after repeated
 * failures (see login-captcha.ts).
 */

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const VERIFY_TIMEOUT_MS = 10_000;

export const CAPTCHA_REQUIRED_MESSAGE = 'Please tick "I\'m not a robot" to continue.';

export class CaptchaService {
  /** What a page needs to show the checkbox. The site key is public; the secret never leaves the server. */
  static config() {
    return { enabled: captchaEnabled, siteKey: captchaEnabled ? env.RECAPTCHA_SITE_KEY ?? null : null };
  }

  /**
   * Throws unless `token` is a fresh, valid checkbox result from Google. Each
   * token can be verified once; the page must reset the checkbox after a failed
   * request.
   */
  static async verify(token: unknown, remoteIp?: string): Promise<void> {
    if (!captchaEnabled) return;
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
      throw new AppError(CAPTCHA_REQUIRED_MESSAGE, 400, undefined, 'CAPTCHA_REQUIRED');
    }

    let result: { success?: boolean; 'error-codes'?: string[] };
    try {
      const body = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY!, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      result = (await res.json()) as typeof result;
    } catch {
      // Google unreachable: refuse rather than let the request through unchecked.
      throw new AppError('The robot check could not be completed right now. Please try again in a moment.', 503, undefined, 'CAPTCHA_UNAVAILABLE');
    }

    if (result.success !== true) {
      const codes = result['error-codes'] ?? [];
      // A misconfigured key is the server's problem, not the visitor's — log it (never the key).
      if (codes.some((c) => c === 'invalid-input-secret' || c === 'missing-input-secret')) {
        console.warn('[Captcha] The reCAPTCHA secret key was rejected by Google. Check RECAPTCHA_SECRET_KEY.');
      }
      throw new AppError('The robot check expired or was not accepted. Please tick "I\'m not a robot" again.', 400, undefined, 'CAPTCHA_FAILED');
    }
  }
}
