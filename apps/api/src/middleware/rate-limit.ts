import { removeFileQuietly } from './upload';
import { createAuditLog } from '../lib/audit';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { RATE_LIMITS, type RateLimitCategory, type RateLimitRule } from '../config/rate-limits';

/**
 * Server-side rate limiting for HRISense. Limits and windows come from
 * config/rate-limits.ts; this file decides which limit a request counts
 * against and answers 429 when it is used up.
 *
 * Rate limiting is not authorization: every route keeps its own permission
 * checks, and a limit resetting never grants access to anything.
 */

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again shortly.';

/** The client address Express resolved (honours TRUST_PROXY, never raw headers). */
const clientIp = (req: Request) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Who a limit was counted against, for the server log. */
const identityOf = (req: Request) => (req.user?.userId ? `user ${req.user.userId}` : `ip ${clientIp(req)}`);

/** One log line per limit and identity per minute, so a flood cannot flood the log. */
const lastLogged = new Map<string, number>();
function logLimitReached(rule: RateLimitRule, req: Request) {
  const key = `${rule.name}|${identityOf(req)}`;
  const now = Date.now();
  if ((lastLogged.get(key) ?? 0) > now - 60_000) return;
  if (lastLogged.size > 10_000) lastLogged.clear();
  lastLogged.set(key, now);
  console.warn(`[RateLimit] ${rule.name} limit reached (${identityOf(req)}) on ${req.method} ${req.originalUrl.split('?')[0]}`);
}

function limiter(
  rule: RateLimitRule,
  keyOf: (req: Request) => string,
  options: {
    message?: string;
    skip?: (req: Request) => boolean;
    onLimit?: (req: Request) => void;
    /** Count only the requests this returns true for (after the response); the rest are not counted. */
    countOnly?: (req: Request, res: Response) => boolean;
  } = {}
): RequestHandler {
  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${rule.name}:${keyOf(req)}`,
    skip: options.skip,
    ...(options.countOnly
      ? { skipSuccessfulRequests: true, requestWasSuccessful: (req: Request, res: Response) => !options.countOnly!(req, res) }
      : {}),
    handler: (req, res) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfterSeconds = Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now() + rule.windowMs) - Date.now()) / 1000));
      options.onLimit?.(req);
      logLimitReached(rule, req);
      const message = options.message ?? RATE_LIMIT_MESSAGE;
      // No internals: no keys, counters or addresses — just when to try again.
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ success: false, error: message, message, code: 'RATE_LIMITED', retryAfterSeconds });
    },
  });
}

const byIp = (req: Request) => `ip:${clientIp(req)}`;
const byUser = (req: Request) => (req.user?.userId ? `user:${req.user.userId}` : byIp(req));

/** The live notification stream is one long request — never counted or cut off. */
const isNotificationStream = (req: Request) => req.originalUrl.startsWith('/api/v1/notifications/stream');

// ─── Whole API ───────────────────────────────────────────────────────────────

/** Flood guard on every /api/v1 request, per IP. Static files and the SSE stream are not counted. */
export const globalApiLimiter = limiter(RATE_LIMITS.GLOBAL, byIp, {
  skip: (req) => !req.originalUrl.startsWith('/api/') || isNotificationStream(req),
});

// ─── Sign-in and passwords ───────────────────────────────────────────────────

/** Sign-in attempts for one email from one IP. Works alongside the wrong-password browser lock (sign-in-lock.ts). */
export const loginAccountLimiter = limiter(
  RATE_LIMITS.LOGIN_ACCOUNT,
  (req) => `${byIp(req)}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' }
);

/** All sign-in attempts from one IP. */
export const loginIpLimiter = limiter(RATE_LIMITS.LOGIN_IP, byIp, {
  message: 'Too many sign-in attempts from your network. Please wait a few minutes and try again.',
});

/** One audit entry per blocked IP per window, however many requests it keeps sending. */
const googleBlockAudited = new Map<string, number>();

/**
 * Google sign-ins with an unregistered email, per IP. Only those attempts count
 * (the controller marks them); once over the limit, every Google sign-in from
 * that IP is refused until the window ends. Password sign-in is unaffected.
 */
export const googleUnregisteredLimiter = limiter(RATE_LIMITS.GOOGLE_UNREGISTERED, byIp, {
  message:
    'Google sign-in is blocked on this network for a while after repeated sign-ins with unregistered emails. Hospicio de San Jose employees can still sign in with their email and password, or contact HR.',
  countOnly: (_req, res) => res.locals.googleUnregistered === true,
  onLimit: (req) => {
    const ip = clientIp(req);
    const now = Date.now();
    if ((googleBlockAudited.get(ip) ?? 0) > now - RATE_LIMITS.GOOGLE_UNREGISTERED.windowMs) return;
    if (googleBlockAudited.size > 10_000) googleBlockAudited.clear();
    googleBlockAudited.set(ip, now);
    void createAuditLog({
      action: 'GOOGLE_LOGIN_BLOCKED',
      entityType: 'USER',
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        method: 'GOOGLE',
        reason: 'TOO_MANY_UNREGISTERED_ATTEMPTS',
        limit: RATE_LIMITS.GOOGLE_UNREGISTERED.max,
        windowMinutes: Math.round(RATE_LIMITS.GOOGLE_UNREGISTERED.windowMs / 60000),
      },
    });
  },
});

/** Forgot-password and reset-password. */
export const passwordRecoveryLimiter = limiter(RATE_LIMITS.PASSWORD_RECOVERY, byIp, {
  message: 'Too many password reset requests. Please wait a few minutes and try again.',
});

/** Access-token refreshes. */
export const refreshLimiter = limiter(RATE_LIMITS.REFRESH, byIp);

/** Password changes by one signed-in user. */
export const passwordChangeLimiter = limiter(RATE_LIMITS.PASSWORD_CHANGE, byUser, {
  message: 'Too many password change attempts. Please wait a few minutes and try again.',
});

// ─── Signed-in traffic ───────────────────────────────────────────────────────

/**
 * Which limit a signed-in request counts against. `null` = none here: the SSE
 * stream, the AI assistant (its own hourly limit) and password changes (their
 * own limit).
 */
export function authenticatedCategory(req: Request): RateLimitCategory | null {
  const path = req.originalUrl.split('?')[0];
  if (isNotificationStream(req)) return null;
  if (path.startsWith('/api/v1/ai/')) return null;
  if (path === '/api/v1/auth/change-password') return null;

  const reading = req.method === 'GET' || req.method === 'HEAD';
  if (path.startsWith('/api/v1/attendance/imports') && !reading) return 'IMPORT';
  if (/\/export(\/|$)/.test(path)) return 'EXPORT';
  if (req.is('multipart/form-data')) return 'UPLOAD';
  if (reading) {
    if (path.startsWith('/api/v1/reports/') && path !== '/api/v1/reports/catalog') return 'REPORT';
    const search = req.query?.search ?? req.query?.q;
    if (path === '/api/v1/search' || (typeof search === 'string' && search.trim() !== '')) return 'SEARCH';
    return 'AUTHENTICATED_READ';
  }
  return 'WRITE';
}

const AUTHENTICATED_LIMITERS: Partial<Record<RateLimitCategory, RequestHandler>> = {
  AUTHENTICATED_READ: limiter(RATE_LIMITS.AUTHENTICATED_READ, byUser),
  WRITE: limiter(RATE_LIMITS.WRITE, byUser),
  SEARCH: limiter(RATE_LIMITS.SEARCH, byUser),
  UPLOAD: limiter(RATE_LIMITS.UPLOAD, byUser, { message: 'Too many uploads. Please wait a few minutes and try again.' }),
  IMPORT: limiter(RATE_LIMITS.IMPORT, byUser, { message: 'Too many import requests. Please wait a few minutes and try again.' }),
  EXPORT: limiter(RATE_LIMITS.EXPORT, byUser, { message: 'Too many exports in a short time. Please wait a few minutes and try again.' }),
  REPORT: limiter(RATE_LIMITS.REPORT, byUser),
};

/**
 * Counts a signed-in request against its category, once per request (some
 * routes authenticate twice). Called by `authenticate` after the user is known.
 */
export function limitAuthenticatedTraffic(req: Request, res: Response, next: NextFunction) {
  const flagged = req as Request & { __rateCounted?: boolean };
  if (flagged.__rateCounted) return next();
  flagged.__rateCounted = true;
  const category = authenticatedCategory(req);
  const handler = category ? AUTHENTICATED_LIMITERS[category] : undefined;
  return handler ? handler(req, res, next) : next();
}

// ─── Public careers ──────────────────────────────────────────────────────────

/** Older setting names keep working when set. */
const legacyRule = (base: RateLimitRule, windowMinutes?: number, max?: number): RateLimitRule => ({
  name: base.name,
  windowMs: windowMinutes ? windowMinutes * 60 * 1000 : base.windowMs,
  max: max ?? base.max,
});

/** Job openings, one opening, and the application-status link — per IP. */
export const publicReadLimiter = limiter(
  legacyRule(RATE_LIMITS.PUBLIC_READ, env.PUBLIC_CAREERS_RATE_LIMIT_WINDOW_MINUTES, env.PUBLIC_CAREERS_RATE_LIMIT_MAX),
  byIp,
  { message: 'Too many requests from your network. Please wait a moment before trying again.' }
);

/** Applications from one IP. Runs BEFORE the upload is parsed, so a flood never writes files. */
export const publicApplicationIpLimiter = limiter(
  legacyRule(RATE_LIMITS.PUBLIC_APPLICATION_IP, env.PUBLIC_APPLICATION_RATE_LIMIT_WINDOW_MINUTES, env.PUBLIC_APPLICATION_RATE_LIMIT_MAX),
  byIp,
  { message: 'Too many applications were received from your network. Please wait before trying again.' }
);

/** Removes files multer already stored for a request that is being refused. */
function discardUploads(req: Request) {
  const files = req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
  const list = Array.isArray(files) ? files : Object.values(files ?? {}).flat();
  for (const f of list) void removeFileQuietly(f?.path, 'rate-limited upload');
}

/**
 * Applications from one email address, across openings — the second layer,
 * so one shared network is not blocked for one person's repeated attempts.
 * Runs after the form is parsed; refused uploads are deleted. The existing
 * one-application-per-opening rule still applies on top.
 */
export const publicApplicationEmailLimiter = limiter(
  RATE_LIMITS.PUBLIC_APPLICATION_EMAIL,
  (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase() || byIp(req)}`,
  {
    message: 'Too many applications were submitted with this email address. Please wait before trying again.',
    onLimit: discardUploads,
  }
);
