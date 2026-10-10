import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JobOpeningStatus } from '@prisma/client';
import { acceptingApplicationsWhere, isAcceptingApplications } from '../job-opening.service';

/**
 * "Currently hiring" — the one rule the Careers directory, the public opening
 * page and the application endpoint share: OPEN and today inside its dates.
 */
const now = new Date(2026, 9, 4, 15, 0); // 4 Oct 2026, 3 pm local
const day = (d: number) => new Date(2026, 9, d);
const opening = (status: JobOpeningStatus, openingDate: Date, closingDate: Date) => ({ status, openingDate, closingDate });

describe('isAcceptingApplications', () => {
  test('an OPEN opening inside its dates accepts applications, including on its closing day', () => {
    assert.equal(isAcceptingApplications(opening(JobOpeningStatus.OPEN, day(1), day(31)), now), true);
    assert.equal(isAcceptingApplications(opening(JobOpeningStatus.OPEN, day(1), day(4)), now), true, 'closing day itself');
    assert.equal(isAcceptingApplications(opening(JobOpeningStatus.OPEN, day(4), day(10)), now), true, 'opening day itself');
  });

  test('an OPEN opening past its closing date, or not yet open, does not', () => {
    assert.equal(isAcceptingApplications(opening(JobOpeningStatus.OPEN, day(1), day(3)), now), false);
    assert.equal(isAcceptingApplications(opening(JobOpeningStatus.OPEN, day(5), day(31)), now), false);
  });

  test('DRAFT, CLOSED, FILLED and ARCHIVED never count, whatever the dates', () => {
    for (const status of [JobOpeningStatus.DRAFT, JobOpeningStatus.CLOSED, JobOpeningStatus.FILLED, JobOpeningStatus.ARCHIVED]) {
      assert.equal(isAcceptingApplications(opening(status, day(1), day(31)), now), false, status);
    }
  });

  test('the database filter asks for the same thing', () => {
    const where = acceptingApplicationsWhere(now) as any;
    assert.equal(where.status, JobOpeningStatus.OPEN);
    assert.equal(where.openingDate.lte.getTime(), now.getTime());
    assert.equal(where.closingDate.gte.getTime(), day(4).getTime(), 'from the start of today');
  });
});
