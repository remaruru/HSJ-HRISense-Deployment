import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { businessDateKey, businessDayStartInstant } from '../businessDate';

describe('business date: a filing timestamp and its Manila day', () => {
  test('a request filed at 7:32 AM Manila belongs to that day, not the UTC day before', () => {
    // 2026-10-26 07:32 Manila is 2026-10-25 23:32 UTC
    assert.equal(businessDateKey(new Date('2026-10-25T23:32:00Z')), '2026-10-26');
    assert.equal(businessDateKey(new Date('2026-10-26T15:59:59Z')), '2026-10-26');
    assert.equal(businessDateKey(new Date('2026-10-26T16:00:00Z')), '2026-10-27');
  });

  test('a picked day starts at midnight Manila (16:00 UTC the day before)', () => {
    assert.equal(businessDayStartInstant('2026-10-26').toISOString(), '2026-10-25T16:00:00.000Z');
    assert.equal(businessDayStartInstant(new Date('2026-10-26T00:00:00Z')).toISOString(), '2026-10-25T16:00:00.000Z');
  });

  test('a filing at 7:32 AM falls inside its own day\'s range and outside the day before', () => {
    const filed = new Date('2026-10-25T23:32:00Z');
    const start = businessDayStartInstant('2026-10-26');
    const next = businessDayStartInstant('2026-10-27');
    assert.ok(filed >= start && filed < next);
    assert.ok(!(filed < start));
  });
});
