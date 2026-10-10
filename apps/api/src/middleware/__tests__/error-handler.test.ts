import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { AppError, errorHandler, summarizeIssues, UNEXPECTED_ERROR_MESSAGE, validationError } from '../errorHandler';
import { RecruitmentAuthorizationError } from '../../lib/recruitment.errors';

/**
 * Every failure leaves through one envelope — { success:false, error, message,
 * code, fields?, requestId? } — with a status that says what happened, and
 * never a stack, a Prisma dump, a constraint name or a file path.
 */

function run(err: unknown, extra: Partial<Request> = {}) {
  const req = { method: 'POST', originalUrl: '/api/v1/test?token=abc', id: 'REQ12345', ...extra } as unknown as Request;
  let status = 0;
  let body: any;
  const res = {
    headersSent: false,
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  errorHandler(err as Error, req, res, () => undefined);
  return { status, body };
}

/** Nothing internal may appear anywhere in a response body. */
function assertSafe(body: unknown) {
  const text = JSON.stringify(body);
  for (const leak of ['P2002', 'P2025', 'prisma', 'Prisma', '.ts:', 'node_modules', 'C:\\\\', 'SELECT', '_key', 'stack']) {
    assert.ok(!text.includes(leak), `response leaks "${leak}": ${text}`);
  }
  assert.ok(!/\bat \S+ \(/.test(text), `response contains a stack frame: ${text}`);
}

const quiet = { warn: console.warn, error: console.error };
before(() => {
  console.warn = () => undefined;
  console.error = () => undefined;
});
after(() => {
  console.warn = quiet.warn;
  console.error = quiet.error;
});

describe('errorHandler — one envelope, the right status', () => {
  test('400 validation (zod): first problem as the message, every field listed', () => {
    let zerr: ZodError;
    try {
      z.object({ email: z.string().email('Enter a valid email address.'), name: z.string().min(1, 'Name is required.') }).parse({ email: 'x', name: '' });
      assert.fail('should have thrown');
    } catch (e) {
      zerr = e as ZodError;
    }
    const { status, body } = run(zerr!);
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.equal(body.message, 'Enter a valid email address. 1 more field needs attention.');
    assert.equal(body.error, body.message, 'error and message carry the same sentence');
    assert.deepEqual(body.fields, { email: 'Enter a valid email address.', name: 'Name is required.' });
    assertSafe(body);
  });

  test('400 validation (validate middleware / validationError) keeps its field list', () => {
    const { status, body } = run(validationError([{ field: 'endDate', message: 'End date must be after the start date.' }]));
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.equal(body.message, 'End date must be after the start date.');
    assert.deepEqual(body.fields, { endDate: 'End date must be after the start date.' });
  });

  test('401 / 403 / 404 / 409 AppErrors pass their user-written message and code', () => {
    for (const [code, status, msg] of [
      ['TOKEN_EXPIRED', 401, 'Your session has expired. Please sign in again.'],
      ['FORBIDDEN', 403, "You don't have permission to do that."],
      ['OPENING_NOT_FOUND', 404, 'This job opening could not be found.'],
      ['DUPLICATE_APPLICATION', 409, 'An application for this position has already been submitted using this email address or mobile number.'],
    ] as const) {
      const r = run(new AppError(msg, status, undefined, code));
      assert.equal(r.status, status);
      assert.equal(r.body.code, code);
      assert.equal(r.body.message, msg);
      assert.equal(r.body.requestId, undefined, 'expected failures carry no reference');
    }
  });

  test('an AppError without a code gets one from its status', () => {
    assert.equal(run(new AppError('Leave request not found', 404)).body.code, 'NOT_FOUND');
    assert.equal(run(new AppError('Only pending requests can be cancelled', 409)).body.code, 'CONFLICT');
  });

  test('errors declaring their own status (RecruitmentError) keep it', () => {
    const r = run(new RecruitmentAuthorizationError());
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'RECRUITMENT_FORBIDDEN');
  });

  test('409 from a unique constraint: specific where the schema says what it means, no internals', () => {
    const p2002 = (target: string) =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the constraint: `' + target + '`', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target },
      });
    let r = run(p2002('employees_biometricCode_key'));
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'DUPLICATE_BIOMETRIC_CODE');
    assertSafe(r.body);
    r = run(p2002('users_email_key'));
    assert.equal(r.body.code, 'DUPLICATE_EMAIL');
    r = run(p2002('some_unmapped_key'));
    assert.equal(r.body.code, 'DUPLICATE_RECORD');
    assertSafe(r.body);
  });

  test('404 from a missing Prisma record, 503 when the database is down', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('No record found for an update', { code: 'P2025', clientVersion: '5.22.0' });
    assert.equal(run(p2025).status, 404);
    const down = new Prisma.PrismaClientInitializationError("Can't reach database server at `localhost:3306`", '5.22.0');
    const r = run(down);
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'DATABASE_UNAVAILABLE');
    assert.ok(!JSON.stringify(r.body).includes('3306'));
  });

  test('413 for a file over the upload limit, naming the limit when known', () => {
    let r = run(new MulterError('LIMIT_FILE_SIZE', 'resume'));
    assert.equal(r.status, 413);
    assert.equal(r.body.code, 'FILE_TOO_LARGE');
    r = run(new MulterError('LIMIT_FILE_SIZE', 'file'), { uploadMaxBytes: 10 * 1024 * 1024 } as any);
    assert.match(r.body.message, /10 MB limit/);
  });

  test('413 / 400 for oversize or unreadable JSON bodies', () => {
    assert.equal(run(Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 })).status, 413);
    const bad = run(Object.assign(new SyntaxError('Unexpected token } in JSON at position 10'), { type: 'entity.parse.failed', status: 400 }));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'INVALID_JSON');
    assert.ok(!bad.body.message.includes('position'), 'parser detail is not echoed');
  });

  test('429 keeps its status and code', () => {
    const r = run(new AppError('Too many requests.', 429, undefined, 'RATE_LIMITED'));
    assert.equal(r.status, 429);
    assert.equal(r.body.code, 'RATE_LIMITED');
  });

  test('500: an unexpected error says nothing internal and carries a reference', () => {
    const boom = new TypeError("Cannot read properties of undefined (reading 'id') at C:\\xampp\\htdocs\\HRISense\\apps\\api\\src\\x.ts:12");
    const r = run(boom);
    assert.equal(r.status, 500);
    assert.equal(r.body.code, 'INTERNAL_ERROR');
    assert.equal(r.body.message, UNEXPECTED_ERROR_MESSAGE);
    assert.equal(r.body.requestId, 'REQ12345');
    assertSafe(r.body);
  });

  test('an AppError deliberately marked 500 is still treated as unexpected', () => {
    const r = run(new AppError('Failed to write C:\\uploads\\x.pdf', 500));
    assert.equal(r.body.message, UNEXPECTED_ERROR_MESSAGE);
  });

  test('503 from a provider keeps its user-facing message', () => {
    const r = run(new AppError('AI Assistance is not configured on this server.', 503));
    assert.equal(r.status, 503);
    assert.equal(r.body.message, 'AI Assistance is not configured on this server.');
    assert.equal(r.body.code, 'SERVICE_UNAVAILABLE');
  });
});

describe('summarizeIssues', () => {
  test('one, two and many problems', () => {
    assert.equal(summarizeIssues([{ field: 'a', message: 'First name is required' }]), 'First name is required.');
    assert.equal(
      summarizeIssues([
        { field: 'a', message: 'First name is required.' },
        { field: 'b', message: 'x' },
        { field: 'c', message: 'y' },
      ]),
      'First name is required. 2 more fields need attention.'
    );
  });
});
