import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LeaveType } from '@prisma/client';
import { anniversaryDate, completedYearsOfService, servicePeriod } from '../service-period';
import { entitlementFor, LEAVE_ENTITLEMENT_RULES } from '../leave-entitlement';
import { calendarEntryAppliesToUnit } from '../calendar-scope';
import { cycleMetrics, cycleProgress, subjectProgress, type WorkflowRow } from '../../services/evaluation-workflow';
import { normalizeEmergencyContacts, normalizeGovernmentIds, normalizeLoginEmail } from '../../services/employee-contact-details';
import { RecruitmentPolicy } from '../../policies/recruitment.policy';

const rule = (t: LeaveType) => LEAVE_ENTITLEMENT_RULES.find((r) => r.leaveType === t)!;
const none = { paternityLeaveEligible: false, soloParentLeaveEligible: false };

describe('service period — calendar-correct, never days ÷ 365', () => {
  test('years, months and days', () => {
    assert.deepEqual(servicePeriod('2020-03-15', '2025-08-20'), { years: 5, months: 5, days: 5 });
    assert.deepEqual(servicePeriod('2025-01-31', '2025-03-01'), { years: 0, months: 1, days: 1 });
  });
  test('missing or reversed dates give no period (nothing fabricated)', () => {
    assert.equal(servicePeriod(null, '2025-01-01'), null);
    assert.equal(servicePeriod('2025-01-01', null), null);
    assert.equal(servicePeriod('2025-02-01', '2025-01-01'), null);
  });
  test('the anniversary is recognised on the day itself', () => {
    // Hospicio's example: hired 15 June 2025.
    assert.equal(completedYearsOfService('2025-06-15', '2026-06-14'), 0);
    assert.equal(completedYearsOfService('2025-06-15', '2026-06-15'), 1);
    assert.equal(anniversaryDate('2025-06-15', 1), '2026-06-15');
  });
  test('11 months completed is 0 years', () => {
    assert.equal(completedYearsOfService('2025-01-10', '2025-12-31'), 0);
  });
  test('29 February start: anniversary on 28 February in a common year', () => {
    assert.equal(completedYearsOfService('2024-02-29', '2025-02-27'), 0);
    assert.equal(completedYearsOfService('2024-02-29', '2025-02-28'), 1);
    assert.equal(anniversaryDate('2024-02-29', 1), '2025-02-28');
  });
});

describe('leave entitlement by completed years', () => {
  const days = (t: LeaveType, years: number, flags = none) => entitlementFor(rule(t), years, flags).days;

  test('Vacation: 0 / 10 / 15', () => {
    assert.equal(days(LeaveType.VACATION, 0), 0);
    assert.equal(days(LeaveType.VACATION, 1), 10);
    assert.equal(days(LeaveType.VACATION, 2), 10);
    assert.equal(days(LeaveType.VACATION, 3), 15);
    assert.equal(days(LeaveType.VACATION, 12), 15);
  });
  test('Sick 7 and Bereavement 5 from one completed year', () => {
    assert.equal(days(LeaveType.SICK, 0), 0);
    assert.equal(days(LeaveType.SICK, 1), 7);
    assert.equal(days(LeaveType.BEREAVEMENT, 0), 0);
    assert.equal(days(LeaveType.BEREAVEMENT, 4), 5);
  });
  test('Paternity and Solo Parent only with the HR eligibility flag', () => {
    assert.equal(days(LeaveType.PATERNITY, 5), 0);
    assert.equal(entitlementFor(rule(LeaveType.PATERNITY), 5, none).eligible, false);
    assert.equal(days(LeaveType.PATERNITY, 5, { ...none, paternityLeaveEligible: true }), 7);
    assert.equal(days(LeaveType.PATERNITY, 0, { ...none, paternityLeaveEligible: true }), 0);
    assert.equal(days(LeaveType.SOLO_PARENT, 2), 0);
    assert.equal(days(LeaveType.SOLO_PARENT, 2, { ...none, soloParentLeaveEligible: true }), 7);
  });
  test('only the five confirmed types are automatic', () => {
    assert.deepEqual(
      LEAVE_ENTITLEMENT_RULES.map((r) => r.leaveType).sort(),
      [LeaveType.BEREAVEMENT, LeaveType.PATERNITY, LeaveType.SICK, LeaveType.SOLO_PARENT, LeaveType.VACATION].sort()
    );
  });
  test('the next step is reported', () => {
    const r = entitlementFor(rule(LeaveType.VACATION), 1, none);
    assert.deepEqual(r.next, { fromYears: 3, days: 15 });
  });
});

describe('holiday working units', () => {
  const entry = { workingUnits: [{ unitId: 'pch' }] };
  test('a working unit does not observe the entry; others do', () => {
    assert.equal(calendarEntryAppliesToUnit(entry, 'pch'), false);
    assert.equal(calendarEntryAppliesToUnit(entry, 'gss'), true);
    assert.equal(calendarEntryAppliesToUnit({ workingUnits: [] }, 'pch'), true);
    assert.equal(calendarEntryAppliesToUnit(entry, null), true);
  });
});

describe('evaluation workflow (weighted multi-rater: self + peers + head)', () => {
  const M = { mode: 'WEIGHTED_MULTI_RATER' as const };
  const row = (over: Partial<WorkflowRow>): WorkflowRow => ({
    id: Math.random().toString(36).slice(2), employeeId: 'e1', raterType: 'SELF', status: 'NOT_STARTED', ...over,
  });

  test('nothing done → not started, every component listed as a blocker', () => {
    const p = subjectProgress([row({ raterType: 'SELF' }), row({ raterType: 'HEAD' })], M);
    assert.equal(p.stage, 'NOT_STARTED');
    assert.ok(p.blockers.some((b) => b.includes('Self rating')));
    assert.ok(p.blockers.some((b) => b.includes('Head')));
  });

  test('head submitted without discussion → discussion pending, cannot finalise', () => {
    const p = subjectProgress([
      row({ raterType: 'SELF', status: 'SUBMITTED' }),
      row({ raterType: 'PEER', status: 'SUBMITTED' }),
      row({ raterType: 'HEAD', status: 'SUBMITTED' }),
    ], M);
    assert.equal(p.stage, 'DISCUSSION_PENDING');
    assert.deepEqual(p.blockers, ['Discussion with the employee not recorded']);
  });

  test('peers counted as x of y; a pending peer blocks finalisation', () => {
    const p = subjectProgress([
      row({ raterType: 'SELF', status: 'SUBMITTED' }),
      row({ raterType: 'PEER', status: 'SUBMITTED' }),
      row({ raterType: 'PEER', status: 'IN_PROGRESS' }),
      row({ raterType: 'PEER', status: 'SUBMITTED' }),
      row({ raterType: 'HEAD', status: 'SUBMITTED', discussionCompletedAt: new Date() }),
    ], M);
    assert.equal(p.peers.total, 3);
    assert.equal(p.peers.submitted, 2);
    assert.deepEqual(p.blockers, ['1 of 3 peer evaluations not submitted']);
  });

  test('everything in + discussion → ready to finalise', () => {
    const p = subjectProgress([
      row({ raterType: 'SELF', status: 'SUBMITTED' }),
      row({ raterType: 'HEAD', status: 'SUBMITTED', discussionCompletedAt: new Date(), discussionDate: new Date() }),
    ], M);
    assert.equal(p.stage, 'READY_TO_FINALIZE');
    assert.deepEqual(p.blockers, []);
  });

  test('no head evaluator assigned is a blocker', () => {
    const p = subjectProgress([row({ raterType: 'SELF', status: 'SUBMITTED' })], M);
    assert.ok(p.blockers.includes('No head / supervisor / coordinator evaluator assigned'));
  });

  test('removed (deleted) peers do not count', () => {
    const p = subjectProgress([
      row({ raterType: 'SELF', status: 'SUBMITTED' }),
      row({ raterType: 'PEER', status: 'NOT_STARTED', deletedAt: new Date() }),
      row({ raterType: 'HEAD', status: 'SUBMITTED', discussionCompletedAt: new Date() }),
    ], M);
    assert.equal(p.peers.total, 0);
    assert.equal(p.stage, 'READY_TO_FINALIZE');
  });

  test('legacy finalised head evaluation (no self row) stays finalised', () => {
    const p = subjectProgress([row({ raterType: 'HEAD', status: 'FINALIZED' })]);
    assert.equal(p.stage, 'FINALIZED');
    assert.deepEqual(p.blockers, []);
  });

  test('cycle metrics count employees, not rater rows', () => {
    const rows = [
      row({ employeeId: 'a', raterType: 'SELF', status: 'SUBMITTED' }),
      row({ employeeId: 'a', raterType: 'PEER', status: 'SUBMITTED' }),
      row({ employeeId: 'a', raterType: 'HEAD', status: 'FINALIZED' }),
      row({ employeeId: 'b', raterType: 'SELF' }),
    ];
    const m = cycleMetrics(cycleProgress(rows, M));
    assert.equal(m.total, 2);
    assert.equal(m.finalized, 1);
    assert.equal(m.notStarted, 1);
    assert.equal(m.headUnassigned, 1);
    assert.equal(m.selfSubmitted, 1);
    assert.equal(m.selfTotal, 2);
  });
});

describe('employee contact details', () => {
  test('up to three emergency contacts; first required; partial rows rejected', () => {
    const three = [1, 2, 3].map((i) => ({ contactName: `C${i}`, relationship: 'Sibling', mobilePhone: '0917' }));
    assert.equal(normalizeEmergencyContacts(three)!.length, 3);
    assert.throws(() => normalizeEmergencyContacts([...three, three[0]]), /at most 3/);
    assert.throws(() => normalizeEmergencyContacts([{ contactName: 'A', relationship: '', mobilePhone: '0917' }]), /missing: relationship/);
    assert.deepEqual(normalizeEmergencyContacts([{ contactName: '', relationship: '', mobilePhone: '' }]), []);
  });
  test('the single legacy contact still works for older clients', () => {
    const rows = normalizeEmergencyContacts(undefined, { emergencyContactName: 'A', emergencyContactRel: 'Parent', emergencyContactPhone: '0917' });
    assert.deepEqual(rows, [{ contactName: 'A', relationship: 'Parent', mobilePhone: '0917' }]);
  });
  test('lists may arrive as JSON text (multipart onboarding)', () => {
    const rows = normalizeGovernmentIds(JSON.stringify([{ idType: 'Passport', idNumber: 'P1' }, { idType: '', idNumber: '' }]));
    assert.deepEqual(rows, [{ idType: 'Passport', idNumber: 'P1' }]);
    assert.throws(() => normalizeGovernmentIds([{ idType: 'UMID', idNumber: '' }]), /ID type and the ID number/);
  });
  test('login email must be a valid address', () => {
    assert.equal(normalizeLoginEmail(' ana@example.test '), 'ana@example.test');
    assert.equal(normalizeLoginEmail(''), null);
    assert.throws(() => normalizeLoginEmail('not-an-email'), /valid personal email/);
  });
});

describe('Sister holds HR authority', () => {
  const ctx = (code: string, title: string) => ({
    userId: 'u', permissionTier: 'FULL' as any, employee: { id: 'e', jobRole: { code, title } },
  });
  test('Sister has the HR Officer recruitment authority', () => {
    const sister = ctx('SISTER', 'Sister');
    assert.equal(RecruitmentPolicy.isHrOfficer(sister), true);
    assert.equal(RecruitmentPolicy.canPublishJobOpening(sister), true);
    assert.equal(RecruitmentPolicy.canMarkHired(sister), true);
    assert.equal(RecruitmentPolicy.canConvertToOnboarding(sister), true);
  });
  test('HR Assistant still does not', () => {
    const assistant = ctx('HR_ASSISTANT', 'Human Resource Assistant/Staff');
    assert.equal(RecruitmentPolicy.canPublishJobOpening(assistant), false);
    assert.equal(RecruitmentPolicy.canViewRecruitment(assistant), true);
  });
});
