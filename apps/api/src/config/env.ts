import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars. Precedence: real environment variables > `.env.local` > `.env`.
//
// `.env.local` is git-ignored, so secrets such as AI provider keys can live
// outside `apps/api/.env`, which is tracked by git (see .gitignore). Other code
// (the Prisma client, recruitment.config.ts) loads `.env` on its own before this
// module runs, so a `.env.local` value replaces a variable only when it is unset
// or still holds the value from `.env` — never one the host environment (or a
// test) set explicitly.
{
  const basePath = path.join(__dirname, '../../.env');
  const localPath = path.join(__dirname, '../../.env.local');
  const base = fs.existsSync(basePath) ? dotenv.parse(fs.readFileSync(basePath)) : {};
  const local = fs.existsSync(localPath) ? dotenv.parse(fs.readFileSync(localPath)) : {};
  for (const [key, value] of Object.entries(local)) {
    if (process.env[key] === undefined || process.env[key] === base[key]) process.env[key] = value;
  }
  dotenv.config({ path: basePath });
}

/** Accepts the strings people actually write in a .env file. */
const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CLIENT_URL: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(8),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_SECRET: z.string().min(8),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    // ── AI Assistance (see docs/HRISENSE_AI_ARCHITECTURE.md) ─────────────────
    // Every value is optional: with no key configured the assistant reports
    // itself unavailable and every deterministic feature keeps working.
    /** Master switch. Unset = on whenever a usable key is present. */
    AI_ENABLED: booleanFlag.optional(),
    /** `openai` (default) or `anthropic`. */
    AI_PROVIDER: z.string().default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),
    /** Optional OpenAI-compatible endpoint (e.g. an Azure OpenAI or gateway URL). */
    OPENAI_BASE_URL: z.string().url().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
    ANTHROPIC_BASE_URL: z.string().url().optional(),
    /** Longest answer the model may write, in tokens. */
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(8000).default(1500),
    /** How many rounds of data lookups one question may take. */
    AI_MAX_TOOL_ROUNDS: z.coerce.number().int().min(1).max(10).default(6),
    /** Per provider call. */
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(60000),
    /** Earlier messages of a conversation sent back as context. */
    AI_HISTORY_MESSAGES: z.coerce.number().int().min(0).max(40).default(12),
    /** Assistant questions one user may ask per hour. */
    AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(10000).default(60),
    /** Optional sampling temperature. Unset = the provider's default (some models reject it). */
    AI_TEMPERATURE: z.coerce.number().min(0).max(1).optional(),
    // ── Google Sign-In (optional) ───────────────────────────────────────────
    // An extra way to sign in to an EXISTING account; HRISense still issues and
    // controls the session. On when the Client ID is set (empty = off). Google's
    // ID token is verified with Google's public keys, so no Client Secret is used.
    /** OAuth 2.0 Client ID (Web application). Not secret: the login page receives it from GET /auth/google/config. */
    GOOGLE_CLIENT_ID: z.string().trim().optional().transform((v) => v || undefined),
    // ── reCAPTCHA v2 checkbox (optional) ────────────────────────────────────
    // Off until both are set; an empty value counts as unset.
    /** Public site key — the browser receives it to show the checkbox. */
    RECAPTCHA_SITE_KEY: z.string().trim().optional().transform((v) => v || undefined),
    /** Secret key — server only, used to verify a ticked checkbox with Google. Keep it in `.env.local`. */
    RECAPTCHA_SECRET_KEY: z.string().trim().optional().transform((v) => v || undefined),
    UPLOAD_DIR: z.string().default('./uploads'),
    MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB

    // ── Variables whose ABSENCE materially changes behaviour ────────────────
    // These were previously read straight from `process.env` with no validation,
    // so a typo or a missing value failed silently at the point of use instead of
    // loudly at boot. They are validated here, but kept OPTIONAL so a developer
    // machine with integrations switched off still starts.

    /** Transactional email (welcome credentials, password resets). */
    ENABLE_TRANSACTIONAL_EMAILS: booleanFlag.optional(),
    BREVO_API_KEY: z.string().min(1).optional(),
    DEFAULT_FROM_NAME: z.string().min(1).optional(),
    DEFAULT_FROM_EMAIL: z.string().email().optional(),

    /**
     * Signs the login-free applicant status link. Falls back to JWT_SECRET when
     * unset — rotating either invalidates every outstanding link.
     */
    APPLICATION_STATUS_TOKEN_SECRET: z.string().min(16).optional(),

    /**
     * Number of proxy hops, or a specific value express understands. Deliberately
     * NOT defaulted to `true`: blind trust lets a client spoof its IP and defeat
     * the rate limiters.
     */
    TRUST_PROXY: z.string().optional(),

    /** Public endpoint rate limits. */
    PUBLIC_CAREERS_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().optional(),
    PUBLIC_CAREERS_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
    PUBLIC_APPLICATION_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().optional(),
    PUBLIC_APPLICATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  })
  // Conditional requirement: only demand the provider settings when sending is
  // actually switched on. Requiring them unconditionally would stop a developer
  // machine from booting for a feature it never uses.
  .superRefine((value, ctx) => {
    if (!value.ENABLE_TRANSACTIONAL_EMAILS) return;

    if (!value.BREVO_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BREVO_API_KEY'],
        message:
          'BREVO_API_KEY is required when ENABLE_TRANSACTIONAL_EMAILS is true, otherwise every send fails silently.',
      });
    }
    if (!value.DEFAULT_FROM_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEFAULT_FROM_EMAIL'],
        message:
          'DEFAULT_FROM_EMAIL is required when ENABLE_TRANSACTIONAL_EMAILS is true, and must be a sender address verified in your Brevo account.',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only variable NAMES and messages are printed — never a value.
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;

/** True when the reCAPTCHA checkbox is configured (site key and secret key both set). */
export const captchaEnabled: boolean = !!(env.RECAPTCHA_SITE_KEY && env.RECAPTCHA_SECRET_KEY);

/** True when Google Sign-In is configured (a Client ID is set). */
export const googleSignInEnabled: boolean = !!env.GOOGLE_CLIENT_ID;

/** True when transactional email may actually leave this machine. */
export const transactionalEmailEnabled: boolean =
  env.ENABLE_TRANSACTIONAL_EMAILS ?? env.NODE_ENV === 'production';
