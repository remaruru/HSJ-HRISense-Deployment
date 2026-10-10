import { OAuth2Client } from 'google-auth-library';
import { env, googleSignInEnabled } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuthService } from './auth.service';

/**
 * Google Sign-In — an additional way to sign in to an EXISTING HRISense account.
 *
 * Flow ("Sign in with Google", Google Identity Services, popup):
 *   1. The login page shows Google's button with the public Client ID. Google's
 *      popup returns an ID token (a JWT signed by Google) to the page.
 *   2. The browser posts only that ID token to `POST /auth/google`.
 *   3. Here the token is verified: Google's signature (Google's public keys),
 *      issuer, audience = our Client ID, and expiry — then `email_verified`.
 *      An email typed or sent by the browser is never used.
 *   4. The verified email is matched to an existing account and HRISense issues
 *      its own normal session (AuthService.loginWithVerifiedEmail).
 *
 * No Client Secret is involved: an ID token is verified with Google's public
 * keys, and HRISense never calls Google on the user's behalf, so Google issues
 * no access or refresh token to HRISense at all. Nothing from Google is stored
 * or logged.
 */

/** Longest we wait for Google (fetching its signing keys) before answering. */
const GOOGLE_TIMEOUT_MS = 15_000;

const NOT_CONFIRMED = 'Google could not confirm your sign-in. Please try again.';

const client = new OAuth2Client();

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    work,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new AppError('Google did not respond in time. Please try again.', 504)), GOOGLE_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class GoogleAuthService {
  /** What the login page needs: whether to show the button, and the public Client ID. */
  static config() {
    return {
      enabled: googleSignInEnabled,
      clientId: googleSignInEnabled ? env.GOOGLE_CLIENT_ID ?? null : null,
    };
  }

  static async signIn(credential: string, ipAddress?: string, userAgent?: string) {
    if (!googleSignInEnabled || !env.GOOGLE_CLIENT_ID) {
      throw new AppError('Google sign-in is not available on this server. Sign in with your email and password.', 503);
    }

    let email: string;
    try {
      const ticket = await withTimeout(client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID }));
      const payload = ticket.getPayload();
      if (!payload?.email) throw new Error('no email');
      // Only an address Google itself has verified may stand in for a password.
      if (payload.email_verified !== true) {
        throw new AppError('Your Google account email is not verified, so it cannot be used to sign in to HRISense.', 403);
      }
      email = payload.email;
    } catch (error) {
      if (error instanceof AppError) throw error;
      // The library's messages can quote the token or its payload after a colon,
      // so only the reason before it is logged — never the token or the email.
      const reason = String((error as Error)?.message ?? error).split(':')[0].replace(/[A-Za-z0-9_-]{40,}/g, '[redacted]').slice(0, 160);
      console.warn(`[GoogleAuth] Google ID token rejected: ${reason}`);
      throw new AppError(NOT_CONFIRMED, 401);
    }

    return AuthService.loginWithVerifiedEmail(email, ipAddress, userAgent);
  }
}
