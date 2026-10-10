import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ratio, apportion, distribution, formatPercent, share } from '../percent';
import { leaveBalanceFigures } from '../leave-balance';
import { attendanceRateFromCounts } from '../attendance-metrics';
import {
  getProfileCompletion,
  PROFILE_COMPLETION_CRITERIA,
  PROFILE_COMPLETION_TOTAL_WEIGHT,
} from '../../services/profile-completion';
import { computeEvaluationScore } from '../../services/evaluation-score';

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 1000) / 1000;

describe('percent: ratio', () => {
  test('part ÷ whole × 100 to one decimal', () => {
    assert.equal(ratio(37, 50), 74);
    assert.equal(ratio(6, 7), 85.7);
    assert.equal(ratio(1, 3, 0), 33);
  });
  test('no denominator → null, never NaN/Infinity/0', () => {
    assert.equal(ratio(0, 0), null);
    assert.equal(ratio(5, 0), null);
    assert.equal(ratio(5, -1), null);
    assert.equal(ratio(Number.NaN, 10), null);
  });
  test('formatting', () => {
    assert.equal(formatPercent(74), '74%');
    assert.equal(formatPercent(85.7), '85.7%');
    assert.equal(formatPercent(null), 'No data');
    assert.equal(formatPercent(null, 'Not applicable'), 'Not applicable');
    assert.equal(share(37, 50), '37 of 50 (74%)');
    assert.equal(share(3, 0), '3');
  });
});

describe('percent: distributions total exactly 100', () => {
  test('three equal thirds', () => {
    const d = distribution([1, 1, 1])!;
    assert.equal(sum(d), 100);
    assert.deepEqual(d, [33.4, 33.3, 33.3]);
  });
  test('whole-number apportioning', () => {
    const d = distribution([1, 1, 1], 0)!;
    assert.equal(sum(d), 100);
  });
  test('read / unread pair', () => {
    const d = distribution([2, 5])!;
    assert.equal(sum(d), 100);
    assert.deepEqual(d, [28.6, 71.4]);
  });
  test('many awkward categories', () => {
    const counts = [7, 13, 1, 1, 29, 3, 11];
    assert.equal(sum(distribution(counts)!), 100);
    assert.equal(sum(distribution(counts, 0)!), 100);
  });
  test('zero total → null', () => {
    assert.equal(distribution([0, 0]), null);
  });
  test('apportion hits an arbitrary target and never goes negative', () => {
    const a = apportion([10.04, 10.04, 10.04], 30, 1);
    assert.equal(sum(a), 30);
    assert.ok(a.every((v) => v >= 0));
    const b = apportion([0, 0.05, 0.05], 0, 1);
    assert.equal(sum(b), 0);
    assert.ok(b.every((v) => v >= 0));
  });
});

describe('attendance rate from counts', () => {
  test('presence ÷ (presence + explicit absent); others excluded', () => {
    const r = attendanceRateFromCounts({ PRESENT: 30, LATE: 5, HALF_DAY: 2, ABSENT: 3, ON_LEAVE: 4, HOLIDAY: 1 });
    assert.equal(r.presence, 37);
    assert.equal(r.recordedAbsent, 3);
    assert.equal(r.otherRecorded, 5);
    assert.equal(r.attendanceRate, 92.5);
  });
  test('only leave/holiday records → no rate', () => {
    assert.equal(attendanceRateFromCounts({ ON_LEAVE: 4 }).attendanceRate, null);
  });
});

describe('leave balance', () => {
  test('available = allotted − used − pending − forfeited', () => {
    const f = leaveBalanceFigures({ totalAllotted: 15, used: 4, pending: 2, forfeited: 1 });
    assert.equal(f.available, 8);
    assert.equal(f.availablePercent, 53.3);
  });
  test('nothing allotted → no percentage', () => {
    assert.equal(leaveBalanceFigures({ totalAllotted: 0, used: 0, pending: 0, forfeited: 0 }).availablePercent, null);
  });
  test('over-committed balance shows negative days but a 0% share', () => {
    const f = leaveBalanceFigures({ totalAllotted: 5, used: 4, pending: 3, forfeited: 0 });
    assert.equal(f.available, -2);
    assert.equal(f.availablePercent, 0);
  });
});

/** An invented, fully complete employee record. */
const complete = () => ({
  firstName: 'Ana', lastName: 'Example', dateOfBirth: new Date('1990-01-01'), gender: 'FEMALE', civilStatus: 'SINGLE',
  mobilePhone: '09170000000', personalEmail: 'ana@example.test', presentAddress: 'Somewhere',
  unitId: 'u1', departmentId: 'd1', unit: { departmentId: 'd1' }, jobRoleId: 'j1', hireDate: new Date('2020-01-01'),
  sssNumber: '1', philhealthNumber: '2', pagibigNumber: '3', tinNumber: '4',
  emergencyContactName: 'Ben', emergencyContactPhone: '09170000001',
  photoUrl: '/p.jpg', documents: [{}, {}],
});

describe('profile completion', () => {
  test('criteria weights total exactly 100', () => {
    assert.equal(PROFILE_COMPLETION_TOTAL_WEIGHT, 100);
    assert.equal(sum(PROFILE_COMPLETION_CRITERIA.map((c) => c.weight)), 100);
  });

  test('a complete profile is 100% and its shares total 100', () => {
    const r = getProfileCompletion(complete());
    assert.equal(r.percentage, 100);
    assert.deepEqual(r.missing, []);
    assert.equal(sum(r.breakdown.items.map((i) => i.earnedShare ?? 0)), 100);
    assert.equal(sum(r.breakdown.items.map((i) => i.maxShare ?? 0)), 100);
  });

  test('department is Not Applicable when nothing links to a department — no 94% cap', () => {
    const e = { ...complete(), departmentId: null, unit: { departmentId: null }, jobRole: { departmentId: null } };
    const r = getProfileCompletion(e);
    assert.equal(r.percentage, 100);
    assert.equal(r.breakdown.applicablePoints, 94);
    const dept = r.breakdown.items.find((i) => i.id === 'department')!;
    assert.equal(dept.status, 'NOT_APPLICABLE');
    assert.equal(dept.earnedShare, null);
    assert.ok(!r.missingIds.includes('department'));
  });

  test('department is Missing when the unit belongs to one but the employee has none', () => {
    const e = { ...complete(), departmentId: null };
    const r = getProfileCompletion(e);
    assert.equal(r.percentage, 94);
    assert.ok(r.missingIds.includes('department'));
  });

  test('documents: one earns half credit and stays outstanding; the photo is not a document', () => {
    const one = getProfileCompletion({ ...complete(), documents: [{}] });
    const doc = one.breakdown.items.find((i) => i.id === 'documents')!;
    assert.equal(doc.status, 'PARTIAL');
    assert.equal(doc.earned, 5);
    assert.equal(one.percentage, 95);
    assert.ok(one.missingIds.includes('documents'));

    const none = getProfileCompletion({ ...complete(), documents: [] });
    assert.equal(none.breakdown.items.find((i) => i.id === 'documents')!.earned, 0);
    assert.equal(none.percentage, 90);
  });

  test('earned shares always add up to exactly the displayed percentage', () => {
    const variants = [
      { ...complete(), civilStatus: null, tinNumber: null, documents: [{}] },
      { ...complete(), sssNumber: null, philhealthNumber: null, photoUrl: null },
      { ...complete(), departmentId: null, unit: {}, jobRole: {}, pagibigNumber: null, documents: [] },
      { firstName: 'Only', lastName: 'Names' },
    ];
    for (const v of variants) {
      const r = getProfileCompletion(v);
      assert.equal(sum(r.breakdown.items.map((i) => i.earnedShare ?? 0)), r.percentage, JSON.stringify(r.breakdown.formula));
      assert.equal(sum(r.breakdown.items.map((i) => i.maxShare ?? 0)), 100);
    }
  });
});

describe('evaluation score', () => {
  const criteria = [
    { id: 'a', name: 'Quality', weight: 50 },
    { id: 'b', name: 'Attendance', weight: 30 },
    { id: 'c', name: 'Teamwork', weight: 20 },
  ];

  test('weighted: Σ rating × weight ÷ 100, contributions add to the score', () => {
    const r = computeEvaluationScore({
      ratingMethod: 'NUMERIC', useWeighting: true, criteria, maxScore: 5,
      responses: [{ criterionId: 'a', ratingNumeric: 4 }, { criterionId: 'b', ratingNumeric: 5 }, { criterionId: 'c', ratingNumeric: 3 }],
    });
    assert.equal(r.method, 'WEIGHTED');
    assert.equal(r.overallScore, 4.1);
    assert.equal(r.totalWeight, 100);
    assert.equal(sum(r.rows.map((x) => x.contribution ?? 0)), 4.1);
  });

  test('weighted: an unrated criterion contributes 0 (same as at submission)', () => {
    const r = computeEvaluationScore({
      ratingMethod: 'NUMERIC', useWeighting: true, criteria,
      responses: [{ criterionId: 'a', ratingNumeric: 4 }],
    });
    assert.equal(r.overallScore, 2);
    assert.equal(r.rows[1].rating, null);
  });

  test('unweighted: average of the ratings given', () => {
    const r = computeEvaluationScore({
      ratingMethod: 'NUMERIC', useWeighting: false, criteria,
      responses: [{ criterionId: 'a', ratingNumeric: 4 }, { criterionId: 'b', ratingNumeric: 5 }],
    });
    assert.equal(r.method, 'AVERAGE');
    assert.equal(r.overallScore, 4.5);
  });

  test('label templates have no numeric score', () => {
    const r = computeEvaluationScore({ ratingMethod: 'LABELED', useWeighting: false, criteria, responses: [] });
    assert.equal(r.method, 'NOT_NUMERIC');
    assert.equal(r.overallScore, null);
  });
});
