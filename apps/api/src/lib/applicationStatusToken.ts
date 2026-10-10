import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Secure, login-free application status tokens.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 * The token is an HMAC over the application id, so NOTHING is stored: there is no
 * token column, no token table, and therefore no raw token or token hash at rest
 * anywhere in HRISense. A token cannot be forged without the server secret, and
 * every token can be invalidated at once by rotating that secret.
 *
 * This deliberately avoids a schema migration. An earlier attempt at stored
 * status tokens was added and then removed again (migrations
 * `20260804224319_add_applicant_status_tokens` /
 * `20260804233351_remove_application_status_tokens`); a stateless token gives the
 * applicant the same read-only visibility with less to protect.
 *
 * Applicants still have NO HRISense account: this grants read-only sight of one
 * application's public-safe status and nothing else.
 */

const TOKEN_VERSION = 'v1';

function secret(): string {
  // A dedicated secret is preferred; JWT_SECRET is an acceptable fallback so the
  // feature works out of the box on a correctly configured install.
  return env.APPLICATION_STATUS_TOKEN_SECRET || env.JWT_SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(applicationId: string): string {
  return base64url(
    crypto.createHmac('sha256', secret()).update(`${TOKEN_VERSION}:${applicationId}`).digest()
  );
}

/** Builds the opaque status token for an application. */
export function createApplicationStatusToken(applicationId: string): string {
  return `${TOKEN_VERSION}.${base64url(applicationId)}.${sign(applicationId)}`;
}

/**
 * Verifies a token and returns the application id, or null when the token is
 * malformed, tampered with, or signed with a different secret.
 */
export function verifyApplicationStatusToken(token: string): string | null {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [version, encodedId, signature] = parts;
  if (version !== TOKEN_VERSION) return null;

  let applicationId: string;
  try {
    applicationId = fromBase64url(encodedId);
  } catch {
    return null;
  }
  if (!applicationId) return null;

  const expected = sign(applicationId);

  // Constant-time comparison — length is checked first because timingSafeEqual
  // throws on a length mismatch.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return applicationId;
}

/** Full public URL an applicant can open to check their application. */
export function buildApplicationStatusUrl(applicationId: string): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/careers/application-status/${createApplicationStatusToken(applicationId)}`;
}
