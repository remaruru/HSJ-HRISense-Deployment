import axios, { AxiosError } from 'axios';

/**
 * Turns any failed request into one sentence a person can act on.
 *
 * The API answers every failure with the same envelope
 * (`{ success: false, error, message, code, fields?, requestId? }`), and its
 * messages are written for users — so a 4xx message from the server is shown
 * as is. What the server cannot say (no connection, a timeout, a crash) gets
 * wording here. Raw library text such as "Network Error", "Failed to fetch" or
 * "Request failed with status code 500" is never returned.
 */

interface ApiErrorBody {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  fields?: unknown;
  requestId?: unknown;
  retryAfterSeconds?: unknown;
}

export const NETWORK_ERROR_MESSAGE = 'Unable to connect to HRISense. Check your connection and try again.';
export const TIMEOUT_ERROR_MESSAGE = 'The request took too long. Please try again.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

function asAxiosError(err: unknown): AxiosError<ApiErrorBody> | null {
  return axios.isAxiosError(err) ? (err as AxiosError<ApiErrorBody>) : null;
}

function bodyOf(err: unknown): ApiErrorBody | undefined {
  const data = asAxiosError(err)?.response?.data;
  return data && typeof data === 'object' ? (data as ApiErrorBody) : undefined;
}

/** The server's own sentence, if it sent one. */
function serverMessage(err: unknown): string | undefined {
  const body = bodyOf(err);
  for (const value of [body?.message, body?.error]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** HTTP status of a failed request, or undefined when no response arrived. */
export function getApiErrorStatus(err: unknown): number | undefined {
  return asAxiosError(err)?.response?.status;
}

/** The API's stable error code (e.g. DUPLICATE_APPLICATION), if any. */
export function getApiErrorCode(err: unknown): string | undefined {
  const code = bodyOf(err)?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Per-field messages from a 400 VALIDATION_ERROR, keyed by field name. */
export function getApiFieldErrors(err: unknown): Record<string, string> {
  const fields = bodyOf(err)?.fields;
  if (!fields || typeof fields !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/** True when the request never reached the API (offline, server down, CORS). */
export function isNetworkError(err: unknown): boolean {
  const e = asAxiosError(err);
  return !!e && !e.response && !isTimeoutError(err) && !axios.isCancel(err);
}

export function isTimeoutError(err: unknown): boolean {
  const code = asAxiosError(err)?.code;
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT';
}

/** Seconds to wait before retrying a 429, from the body or the Retry-After header. */
export function getRetryAfterSeconds(err: unknown): number | undefined {
  const fromBody = Number(bodyOf(err)?.retryAfterSeconds);
  if (Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  const header = asAxiosError(err)?.response?.headers?.['retry-after'];
  const fromHeader = Number(header);
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : undefined;
}

function waitPhrase(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** "Please try again in 2 minutes." when the server said how long; otherwise "shortly". */
export function rateLimitMessage(err: unknown): string {
  const wait = getRetryAfterSeconds(err);
  const base = serverMessage(err) ?? 'Too many requests.';
  return wait ? `${base.replace(/\s*Please (wait|try).*$/i, '')} Please try again in ${waitPhrase(wait)}.` : base;
}

/** The non-sensitive reference the API attaches to unexpected failures. */
export function getErrorReference(err: unknown): string | undefined {
  const fromBody = bodyOf(err)?.requestId;
  if (typeof fromBody === 'string' && fromBody) return fromBody;
  const header = asAxiosError(err)?.response?.headers?.['x-request-id'];
  return typeof header === 'string' && header ? header : undefined;
}

/**
 * The message to show for a failed request.
 * `fallback` describes what failed ("The leave request could not be submitted.")
 * and is used when the server gave no specific reason.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = asAxiosError(err);
  if ((err as Error)?.name === 'EmptyDownloadError') {
    return 'The file came back empty, so nothing was saved. Please try again.';
  }
  if (!e) return fallback; // not a request failure — never show a raw JS error
  if (axios.isCancel(err)) return 'The request was cancelled.';
  if (isTimeoutError(err)) return TIMEOUT_ERROR_MESSAGE;
  if (!e.response) return NETWORK_ERROR_MESSAGE;

  const status = e.response.status;
  const said = serverMessage(err);

  if (status === 429) return rateLimitMessage(err);

  if (status >= 500) {
    // 502/503 carry a deliberate "temporarily unavailable" message; a plain
    // 500 is generic on the server too. Either way, add the reference.
    const base = status === 500 ? SERVER_ERROR_MESSAGE : said ?? 'This service is temporarily unavailable. Please try again shortly.';
    const ref = getErrorReference(err);
    return ref && status === 500 ? `${base} Reference: ${ref}` : base;
  }

  if (said) return said;
  switch (status) {
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return 'That record could not be found. It may have been moved or removed.';
    case 413:
      return 'This file is larger than the allowed size.';
    default:
      return fallback;
  }
}
