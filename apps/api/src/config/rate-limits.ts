/**
 * Every HRISense rate limit, in one place.
 *
 * Each category has a production default and a (much higher) development
 * default, and every value can be overridden with an environment variable
 * named in the table — `RATE_LIMIT_<CATEGORY>_MAX` and
 * `RATE_LIMIT_<CATEGORY>_WINDOW_MINUTES`. Limits are enforced on the server
 * (middleware/rate-limit.ts); the web app only shows the 429 message.
 *
 * Why these numbers: Hospicio's staff may all reach the API from ONE public IP
 * (the office network), so IP-keyed limits are wide and exist only to stop
 * floods. The real per-person limits are keyed by the signed-in user. Sign-in
 * is keyed by IP + email so one person's typos never lock out the office.
 *
 * Storage: counters live in this process's memory (express-rate-limit's
 * MemoryStore). That is correct for the current single-server deployment. With
 * several API instances each would count separately — use a shared store (for
 * example Redis via `rate-limit-redis`) before scaling out.
 *
 * The AI assistant keeps its own per-user hourly limit (AI_RATE_LIMIT_PER_HOUR,
 * routes/ai.routes.ts); AI requests are not counted again here.
 */

export interface RateLimitRule {
  /** Shown in logs and the setting names. */
  name: string;
  windowMs: number;
  max: number;
}

type EnvSource = Record<string, string | undefined>;

/** Builds every rule from an environment (process.env by default — tests pass their own). */
export function buildRateLimits(source: EnvSource = process.env) {
  const production = source.NODE_ENV === 'production';
  const num = (key: string) => {
    const raw = source[key];
    const n = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const rule = (envName: string, defaults: { windowMinutes: number; prodMax: number; devMax: number }): RateLimitRule => {
    const windowMinutes = num(`RATE_LIMIT_${envName}_WINDOW_MINUTES`) ?? defaults.windowMinutes;
    const max = num(`RATE_LIMIT_${envName}_MAX`) ?? (production ? defaults.prodMax : defaults.devMax);
    return { name: envName, windowMs: Math.round(windowMinutes * 60 * 1000), max: Math.floor(max) };
  };

  return {
    /** Every /api/v1 request, per IP — a flood guard sized for a shared office IP. */
    GLOBAL: rule('GLOBAL', { windowMinutes: 15, prodMax: 5000, devMax: 50000 }),

    /** Sign-in attempts for one email from one IP. Account lockout (5 wrong passwords) still applies on top. */
    LOGIN_ACCOUNT: rule('LOGIN_ACCOUNT', { windowMinutes: 15, prodMax: 10, devMax: 50 }),
    /** All sign-in attempts from one IP, any email — stops password spraying. */
    LOGIN_IP: rule('LOGIN_IP', { windowMinutes: 15, prodMax: 100, devMax: 1000 }),
    /**
     * Google sign-ins with an email that has no HRISense account, from one IP.
     * Past the limit, Google sign-in is blocked for that IP until the window
     * ends (password sign-in is not affected). Same value in development so the
     * block can be seen working.
     */
    GOOGLE_UNREGISTERED: rule('GOOGLE_UNREGISTERED', { windowMinutes: 30, prodMax: 5, devMax: 5 }),
    /** Forgot-password and reset-password from one IP. */
    PASSWORD_RECOVERY: rule('PASSWORD_RECOVERY', { windowMinutes: 15, prodMax: 10, devMax: 100 }),
    /** Access-token refreshes from one IP (every open tab refreshes about every 15 minutes). */
    REFRESH: rule('REFRESH', { windowMinutes: 15, prodMax: 600, devMax: 6000 }),
    /** Password changes by one signed-in user. */
    PASSWORD_CHANGE: rule('PASSWORD_CHANGE', { windowMinutes: 15, prodMax: 5, devMax: 50 }),

    /** Reads (GET) by one signed-in user. */
    AUTHENTICATED_READ: rule('AUTHENTICATED_READ', { windowMinutes: 5, prodMax: 1500, devMax: 15000 }),
    /** Changes (POST / PUT / PATCH / DELETE) by one signed-in user. */
    WRITE: rule('WRITE', { windowMinutes: 5, prodMax: 300, devMax: 3000 }),
    /** Global search and list searches by one signed-in user. */
    SEARCH: rule('SEARCH', { windowMinutes: 1, prodMax: 120, devMax: 1200 }),
    /** File uploads (any multipart request) by one signed-in user. */
    UPLOAD: rule('UPLOAD', { windowMinutes: 10, prodMax: 40, devMax: 400 }),
    /** Attendance import uploads and decisions by one signed-in user. */
    IMPORT: rule('IMPORT', { windowMinutes: 10, prodMax: 20, devMax: 200 }),
    /** Excel / PDF / CSV exports by one signed-in user. */
    EXPORT: rule('EXPORT', { windowMinutes: 10, prodMax: 20, devMax: 200 }),
    /** Report generation (Reports & Analytics) by one signed-in user. */
    REPORT: rule('REPORT', { windowMinutes: 10, prodMax: 120, devMax: 1200 }),

    /** Public careers pages and the application-status link, per IP. */
    PUBLIC_READ: rule('PUBLIC_READ', { windowMinutes: 1, prodMax: 60, devMax: 600 }),
    /** Public job applications from one IP — wide enough for a shared school or office network. */
    PUBLIC_APPLICATION_IP: rule('PUBLIC_APPLICATION_IP', { windowMinutes: 60, prodMax: 20, devMax: 200 }),
    /** Public job applications from one email address, across all openings. */
    PUBLIC_APPLICATION_EMAIL: rule('PUBLIC_APPLICATION_EMAIL', { windowMinutes: 60, prodMax: 5, devMax: 50 }),
  } as const;
}

export const RATE_LIMITS = buildRateLimits();

export type RateLimitCategory = keyof typeof RATE_LIMITS;

/** Largest number of records one bulk request may touch. */
export const MAX_BULK_BATCH = 500;
