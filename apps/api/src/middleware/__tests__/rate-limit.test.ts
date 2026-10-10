import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { authenticatedCategory } from '../rate-limit';
import { buildRateLimits } from '../../config/rate-limits';

/** Just enough of an Express request for the categorizer. */
function req(method: string, url: string, contentType?: string): Request {
  const [path, qs] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
  return {
    method,
    originalUrl: url,
    path,
    query,
    is: (type: string) => (contentType && contentType.startsWith(type) ? type : false),
  } as unknown as Request;
}

describe('authenticatedCategory — which limit a signed-in request counts against', () => {
  test('ordinary reads and writes', () => {
    assert.equal(authenticatedCategory(req('GET', '/api/v1/employees/me')), 'AUTHENTICATED_READ');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/dashboard/hr')), 'AUTHENTICATED_READ');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/leave')), 'WRITE');
    assert.equal(authenticatedCategory(req('PUT', '/api/v1/employees/abc')), 'WRITE');
    assert.equal(authenticatedCategory(req('PATCH', '/api/v1/employees/abc/archive')), 'WRITE');
    assert.equal(authenticatedCategory(req('DELETE', '/api/v1/documents/abc')), 'WRITE');
  });

  test('search: the global search and any list asked to search', () => {
    assert.equal(authenticatedCategory(req('GET', '/api/v1/search?q=ana')), 'SEARCH');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/employees?search=ana&limit=25')), 'SEARCH');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/employees?search=&limit=25')), 'AUTHENTICATED_READ', 'an empty search is a plain read');
  });

  test('expensive work: exports, reports, uploads, imports', () => {
    assert.equal(authenticatedCategory(req('GET', '/api/v1/employees/export/excel')), 'EXPORT');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/attendance/export/pdf')), 'EXPORT');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/reports/headcount/export')), 'EXPORT');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/reports/headcount')), 'REPORT');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/reports/catalog')), 'AUTHENTICATED_READ', 'the catalog is a cheap read');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/employees/abc/documents', 'multipart/form-data; boundary=x')), 'UPLOAD');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/attendance/imports', 'multipart/form-data; boundary=x')), 'IMPORT', 'an import upload counts as an import');
    assert.equal(authenticatedCategory(req('POST', '/api/v1/attendance/imports/abc/commit')), 'IMPORT');
    assert.equal(authenticatedCategory(req('GET', '/api/v1/attendance/imports/abc')), 'AUTHENTICATED_READ', 'reading an import is a read');
  });

  test('not counted here: the live stream, AI (own limit), password change (own limit)', () => {
    assert.equal(authenticatedCategory(req('GET', '/api/v1/notifications/stream')), null);
    assert.equal(authenticatedCategory(req('POST', '/api/v1/ai/assistant/messages')), null);
    assert.equal(authenticatedCategory(req('POST', '/api/v1/auth/change-password')), null);
  });
});

describe('rate-limit configuration', () => {
  test('every rule has a positive window and limit; production is stricter than development', () => {
    const prod = buildRateLimits({ NODE_ENV: 'production' });
    const dev = buildRateLimits({ NODE_ENV: 'development' });
    for (const [key, rule] of Object.entries(prod)) {
      assert.ok(rule.windowMs > 0 && rule.max > 0, key);
      assert.ok(rule.max <= dev[key as keyof typeof dev].max, `${key}: production is never looser`);
    }
    assert.equal(prod.LOGIN_ACCOUNT.max, 10);
    assert.equal(prod.GOOGLE_UNREGISTERED.max, 5);
    assert.equal(dev.GOOGLE_UNREGISTERED.max, 5);
    assert.equal(prod.PUBLIC_APPLICATION_EMAIL.max, 5);
  });

  test('environment overrides apply; invalid values fall back to the default', () => {
    const limits = buildRateLimits({
      NODE_ENV: 'production',
      RATE_LIMIT_EXPORT_MAX: '7',
      RATE_LIMIT_EXPORT_WINDOW_MINUTES: '2',
      RATE_LIMIT_WRITE_MAX: 'not-a-number',
      RATE_LIMIT_SEARCH_MAX: '-5',
    });
    assert.equal(limits.EXPORT.max, 7);
    assert.equal(limits.EXPORT.windowMs, 2 * 60 * 1000);
    assert.equal(limits.WRITE.max, buildRateLimits({ NODE_ENV: 'production' }).WRITE.max);
    assert.equal(limits.SEARCH.max, buildRateLimits({ NODE_ENV: 'production' }).SEARCH.max);
  });
});
