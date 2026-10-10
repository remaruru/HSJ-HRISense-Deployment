import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';

/**
 * ONE error path for the whole API. Every failure — thrown by a service, a
 * validator, multer, body parsing or Prisma — ends here and leaves as the same
 * envelope:
 *
 *   { success: false, error: "<message>", message: "<message>", code: "<CODE>",
 *     fields?: { field: "message" }, requestId?: "3F9A1C2B" }
 *
 * `error` and `message` carry the same human sentence: older screens read one,
 * newer ones the other. `code` is our own stable vocabulary (never a Prisma or
 * driver code). `requestId` appears on unexpected (5xx) failures so a user can
 * quote it; the matching server log line starts with it.
 */

export class AppError extends Error {
  public statusCode: number;
  public errors?: any;
  /** Optional stable application code (e.g. PASSWORD_CHANGE_REQUIRED), sent to the client. */
  public code?: string;

  constructor(message: string, statusCode: number = 500, errors?: any, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Shown for any failure we did not anticipate. The detail stays in the server log. */
export const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

/** The code a response carries when the error did not name its own. */
const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Any error class that declares its own HTTP status, without having to extend
 * `AppError`. `RecruitmentError` (and its subclasses) do exactly this — they set
 * `statusCode` to 403 / 404 / 500 but extend plain `Error`, so the previous
 * `err instanceof AppError` check ignored the property and every recruitment
 * failure collapsed to HTTP 500 (BUG-005).
 */
function declaredStatusCode(err: unknown): number | undefined {
  const code = (err as { statusCode?: unknown })?.statusCode;
  return typeof code === 'number' && code >= 400 && code <= 599 ? code : undefined;
}

/**
 * `code` on an error class that carries a stable application error code, e.g.
 * `RECRUITMENT_FORBIDDEN`. Safe to expose: it is our own vocabulary, not a
 * database or driver detail.
 */
function declaredErrorCode(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return undefined; // P2002 etc. are Prisma's, not ours
  const code = (err as { code?: unknown })?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : undefined;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * One sentence a toast can show on its own, from a list of field problems:
 * the first problem, plus how many more there are.
 */
export function summarizeIssues(issues: FieldIssue[]): string {
  if (issues.length === 0) return 'Please review the form and try again.';
  const first = issues[0].message.replace(/\.?$/, '.');
  const more = issues.length - 1;
  return more > 0 ? `${first} ${more} more field${more === 1 ? ' needs' : 's need'} attention.` : first;
}

/** `{ field: message }`, first message per field — for highlighting inputs. */
function fieldMap(issues: FieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const i of issues) if (i.field && !map[i.field]) map[i.field] = i.message;
  return map;
}

export function issuesFromZod(err: ZodError): FieldIssue[] {
  return err.errors.map((e) => ({
    field: e.path.join('.').replace(/^(body|query|params)\./, ''),
    message: e.message,
  }));
}

/** A 400 VALIDATION_ERROR carrying the field problems. */
export function validationError(issues: FieldIssue[]): AppError {
  return new AppError(summarizeIssues(issues), 400, issues, 'VALIDATION_ERROR');
}

function isFieldIssueList(value: unknown): value is FieldIssue[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => v && typeof v.field === 'string' && typeof v.message === 'string')
  );
}

// ─── Database ────────────────────────────────────────────────────────────────

/**
 * Unique constraints whose meaning is fixed by the schema, keyed by the index
 * name MySQL reports (Prisma's `meta.target`). Only these get a specific code;
 * any other duplicate stays the generic DUPLICATE_RECORD. Services check most
 * of these first with their own message — this is the safety net for a race.
 */
const UNIQUE_CONSTRAINTS: Record<string, { code: string; message: string }> = {
  users_email_key: { code: 'DUPLICATE_EMAIL', message: 'An account with this email address already exists.' },
  users_employeeId_key: { code: 'DUPLICATE_ACCOUNT', message: 'This employee already has a sign-in account.' },
  employees_employeeNumber_key: { code: 'DUPLICATE_EMPLOYEE_NUMBER', message: 'Another employee already uses this employee number.' },
  employees_workEmail_key: { code: 'DUPLICATE_EMAIL', message: 'Another employee already uses this work email address.' },
  employees_biometricCode_key: { code: 'DUPLICATE_BIOMETRIC_CODE', message: 'Another employee already uses this biometric code.' },
  departments_name_key: { code: 'DUPLICATE_NAME', message: 'A department with this name already exists.' },
  departments_code_key: { code: 'DUPLICATE_CODE', message: 'A department with this code already exists.' },
  units_name_key: { code: 'DUPLICATE_NAME', message: 'A unit with this name already exists.' },
  units_code_key: { code: 'DUPLICATE_CODE', message: 'A unit with this code already exists.' },
  job_roles_code_key: { code: 'DUPLICATE_CODE', message: 'A job role with this code already exists.' },
  attendance_records_employeeId_date_key: { code: 'DUPLICATE_ATTENDANCE', message: 'This employee already has an attendance record for that date.' },
  leave_balances_employeeId_year_leaveType_key: { code: 'DUPLICATE_LEAVE_BALANCE', message: 'This employee already has a balance for that leave type and year.' },
  training_participants_trainingActivityId_employeeId_key: { code: 'DUPLICATE_PARTICIPANT', message: 'This employee is already a participant in this training activity.' },
  organization_calendar_entries_date_name_key: { code: 'DUPLICATE_CALENDAR_ENTRY', message: 'An entry with this name already exists on that date.' },
  shift_definitions_name_version_key: { code: 'DUPLICATE_NAME', message: 'A shift with this name already exists.' },
  schedule_templates_name_version_key: { code: 'DUPLICATE_NAME', message: 'A schedule template with this name already exists.' },
  employee_weekly_schedules_employeeId_effectiveFrom_key: { code: 'DUPLICATE_SCHEDULE', message: 'This employee already has a weekly schedule starting on that date.' },
  evaluation_templates_officialCode_key: { code: 'DUPLICATE_TEMPLATE', message: 'This official template has already been loaded.' },
};

/**
 * Prisma exception messages are multi-line dumps that embed the absolute source
 * path, the source line, a code excerpt, the full generated query and the record
 * ids involved. They must never reach a client (BUG-009). Each known request
 * code is mapped to an HTTP status and a message written for a human.
 */
function translatePrismaError(
  err: unknown
): { statusCode: number; message: string; code: string } | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = err.meta?.target;
        const name = Array.isArray(target) ? target.join('_') : String(target ?? '');
        const known = UNIQUE_CONSTRAINTS[name];
        return known
          ? { statusCode: 409, ...known }
          : {
              statusCode: 409,
              code: 'DUPLICATE_RECORD',
              message: 'That record already exists. Check for an existing entry before creating a new one.',
            };
      }
      case 'P2025':
        return { statusCode: 404, code: 'RECORD_NOT_FOUND', message: 'The requested record was not found. It may have been removed.' };
      case 'P2003':
        return {
          statusCode: 409,
          code: 'RELATED_RECORD_MISSING',
          message: 'A record this action depends on no longer exists, or is still in use. Refresh and try again.',
        };
      case 'P2014':
        return { statusCode: 409, code: 'RELATION_CONSTRAINT', message: 'This change would break a required relationship between records.' };
      case 'P2000':
        return { statusCode: 400, code: 'VALUE_TOO_LONG', message: 'One of the values is longer than allowed. Shorten it and try again.' };
      case 'P2034':
        return {
          statusCode: 409,
          code: 'WRITE_CONFLICT',
          message: 'Someone else changed this record at the same moment. Refresh and try again.',
        };
      case 'P2024':
        return { statusCode: 503, code: 'DATABASE_BUSY', message: 'HRISense is busy right now. Please try again in a moment.' };
      default:
        return {
          statusCode: 400,
          code: 'DATABASE_REQUEST_REJECTED',
          message: 'The database rejected this request. Please check the submitted values and try again.',
        };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      code: 'INVALID_REQUEST_SHAPE',
      message: 'Some submitted values are not valid for this operation. Please review the form and try again.',
    };
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The HRISense database is not reachable right now. Please try again shortly.',
    };
  }

  return null;
}

// ─── Uploads and request bodies ──────────────────────────────────────────────

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function translateMulterError(err: MulterError, req: Request): { statusCode: number; message: string; code: string } {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE': {
      // createDiskUpload records its limit on the request (middleware/upload.ts).
      const limit = (req as Request & { uploadMaxBytes?: number }).uploadMaxBytes;
      return {
        statusCode: 413,
        code: 'FILE_TOO_LARGE',
        message: limit
          ? `This file is larger than the ${megabytes(limit)} limit. Choose a smaller file.`
          : 'This file is larger than the size limit for this upload. Choose a smaller file.',
      };
    }
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return { statusCode: 400, code: 'TOO_MANY_FILES', message: 'This upload has more files than allowed. Remove the extra files and try again.' };
    default:
      return { statusCode: 400, code: 'UPLOAD_REJECTED', message: 'The upload could not be read. Check the file and try again.' };
  }
}

/** body-parser marks its own failures with `type`. */
function translateBodyParserError(err: unknown): { statusCode: number; message: string; code: string } | null {
  const type = (err as { type?: unknown })?.type;
  if (type === 'entity.parse.failed') {
    return { statusCode: 400, code: 'INVALID_JSON', message: 'The request could not be read. Refresh the page and try again.' };
  }
  if (type === 'entity.too.large') {
    return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large to process.' };
  }
  return null;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/** Keys whose values must never be written to a log line. */
const SECRET_KEY_PATTERN =
  /("?(?:password|passwordHash|newPassword|currentPassword|oldPassword|confirmPassword|temporaryPassword|otp|otpCode|token|refreshToken|accessToken|secret|apiKey|api_key|authorization)"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi;

/** Redacts secret-looking values before anything is written to the server log. */
export function redactForLog(text: string): string {
  return text.replace(SECRET_KEY_PATTERN, '$1"[REDACTED]"');
}

/** The URL without its query string — queries can carry search text and tokens. */
function routeForLog(req: Request): string {
  return (req.originalUrl || req.url || '').split('?')[0];
}

// ─── The handler ─────────────────────────────────────────────────────────────

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // A response already on its way (a stream that failed mid-flight) cannot be
  // replaced; Express closes the connection.
  if (res.headersSent) {
    console.error(`[Error] ${req.id ?? '-'} ${req.method} ${routeForLog(req)} failed after the response started: ${redactForLog(err?.message ?? String(err))}`);
    return next(err);
  }

  let statusCode: number;
  let message: string;
  let code: string | undefined = declaredErrorCode(err);
  let issues: FieldIssue[] | undefined;
  let expected = true;

  const prismaTranslation = translatePrismaError(err);
  const bodyTranslation = translateBodyParserError(err);

  if (err instanceof ZodError) {
    issues = issuesFromZod(err);
    statusCode = 400;
    message = summarizeIssues(issues);
    code = 'VALIDATION_ERROR';
  } else if (err instanceof MulterError) {
    ({ statusCode, message, code } = translateMulterError(err, req));
  } else if (err?.message === 'INVALID_FILE_TYPE') {
    statusCode = 400;
    code = 'UNSUPPORTED_FILE_TYPE';
    message = 'Please upload a valid PDF, DOC, or DOCX file within the allowed size.';
  } else if (prismaTranslation) {
    // Raw Prisma text is dropped here; only the safe translation continues.
    ({ statusCode, message, code } = prismaTranslation);
    expected = statusCode < 500;
  } else if (bodyTranslation) {
    ({ statusCode, message, code } = bodyTranslation);
  } else {
    // `AppError` and any error declaring its own `statusCode` (RecruitmentError
    // and friends) carry a message written for the user — passed through for
    // 4xx and for 502/503 (a provider being down is worth saying). A 500 is by
    // definition unexpected: its text stays in the log.
    const declared = declaredStatusCode(err);
    if (declared !== undefined && declared !== 500) {
      statusCode = declared;
      message = err.message || 'Request could not be completed.';
      const extra = (err as AppError).errors;
      if (isFieldIssueList(extra)) {
        issues = extra;
        code = code ?? 'VALIDATION_ERROR';
      }
    } else {
      statusCode = 500;
      message = UNEXPECTED_ERROR_MESSAGE;
      code = 'INTERNAL_ERROR';
      expected = false;
    }
  }

  code = code ?? DEFAULT_CODES[statusCode] ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  // One line per failure: reference, route, who, classification. The stack is
  // logged only for unexpected failures; secrets are redacted either way.
  const who = req.user?.userId ? `user=${req.user.userId}` : 'user=-';
  const head = `[Error] ${req.id ?? '-'} ${req.method} ${routeForLog(req)} ${who} ${statusCode} ${code}`;
  if (expected && statusCode < 500) {
    console.warn(`${head}: ${redactForLog(message)}`);
  } else {
    console.error(`${head}: ${redactForLog(err?.stack || err?.message || String(err))}`);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
    code,
    ...(issues ? { fields: fieldMap(issues), errors: issues } : {}),
    ...(statusCode >= 500 && req.id ? { requestId: req.id } : {}),
  });
};

/** JSON 404 for any /api path no route matched. */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'This HRISense address does not exist.',
    message: 'This HRISense address does not exist.',
    code: 'ROUTE_NOT_FOUND',
  });
};
