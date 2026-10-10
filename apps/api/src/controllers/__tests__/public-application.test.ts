import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { submitApplicationSchema } from '../public-recruitment.controller';

/** The fields a real submission sends (multipart, so everything is text). */
const base = {
  firstName: 'Test', lastName: 'Applicant', email: 'applicant@example.test',
  mobileNumber: '09170000000', privacyConsent: 'true',
};

describe('public application — sex and religion are optional', () => {
  test('both blank', () => {
    const r = submitApplicationSchema.safeParse({ ...base, gender: '', religion: '' });
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.gender, undefined);
    assert.equal(r.success && r.data.religion, undefined);
  });
  test('both omitted', () => {
    const r = submitApplicationSchema.safeParse(base);
    assert.equal(r.success, true);
  });
  test('sex given, religion blank', () => {
    const r = submitApplicationSchema.safeParse({ ...base, gender: 'FEMALE', religion: '' });
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.gender, 'FEMALE');
    assert.equal(r.success && r.data.religion, undefined);
  });
  test('sex blank, religion given (including a typed "Others" answer)', () => {
    const r = submitApplicationSchema.safeParse({ ...base, gender: '', religion: 'Iglesia ni Cristo' });
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.gender, undefined);
    assert.equal(r.success && r.data.religion, 'Iglesia ni Cristo');
    const typed = submitApplicationSchema.safeParse({ ...base, religion: '  A faith not on the list  ' });
    assert.equal(typed.success && typed.data.religion, 'A faith not on the list');
  });
  test('both given', () => {
    const r = submitApplicationSchema.safeParse({ ...base, gender: 'PREFER_NOT_TO_SAY', religion: 'Roman Catholic' });
    assert.equal(r.success, true);
  });
  test('a sex that is not one of the options is still rejected', () => {
    assert.equal(submitApplicationSchema.safeParse({ ...base, gender: 'OTHER' }).success, false);
  });
  test('the other required fields are still required', () => {
    assert.equal(submitApplicationSchema.safeParse({ ...base, firstName: '' }).success, false);
    assert.equal(submitApplicationSchema.safeParse({ ...base, privacyConsent: 'false' }).success, false);
  });
});
