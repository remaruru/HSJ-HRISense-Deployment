import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditSnapshotDiff,
  describeAction,
  employeeUpdateText,
  extractChanges,
  formatAuditValue,
  matchesFilters,
  summarize,
} from '../audit-catalog';

const SIGN_IN_NOISE = [
  'LOGIN_SUCCESS',
  'LOGOUT',
  'LOGIN_FAILED',
  'TOKEN_REFRESHED',
  'GOOGLE_LOGIN_SUCCESS',
  'GOOGLE_LOGIN_FAILED',
  'GOOGLE_LOGIN_UNREGISTERED',
  'GOOGLE_LOGIN_BLOCKED',
];
const SECURITY = [
  ...SIGN_IN_NOISE,
  'PASSWORD_CHANGED',
  'PASSWORD_CHANGE_FAILED',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUESTED',
  'RESET_PASSWORD',
  'FORCE_PASSWORD_CHANGE',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'ACTIVATE_USER',
  'DEACTIVATE_USER',
  'USER_ACCOUNT_CREATED',
  'APPLICANT_DOCUMENT_PREVIEWED',
  'AI_ASSISTANT_DATA_ACCESS',
];

describe('tabs and All Changes', () => {
  test('sign-in, session, password and account events are Security, never All Changes', () => {
    for (const action of SECURITY) {
      const info = describeAction(action);
      assert.equal(info.tab, 'SECURITY', action);
      assert.equal(matchesFilters(info, { tab: 'ALL' }), false, action);
      assert.equal(matchesFilters(info, { tab: 'SECURITY' }), true, action);
    }
  });

  test('HR changes are in All Changes and in their own module tab', () => {
    const cases: Array<[string, string, string]> = [
      ['UPDATE_EMPLOYEE', 'EMPLOYEES', 'UPDATE'],
      ['EMPLOYEE_ARCHIVED', 'EMPLOYEES', 'ARCHIVE'],
      ['EMPLOYEE_RESTORED', 'EMPLOYEES', 'RESTORE'],
      ['SUPERVISOR_OVERRIDE_APPLIED', 'EMPLOYEES', 'ASSIGN'],
      ['LEAVE_ENDORSED', 'LEAVE', 'APPROVE'],
      ['LEAVE_APPROVED', 'LEAVE', 'APPROVE'],
      ['LEAVE_REJECTED', 'LEAVE', 'REJECT'],
      ['EVALUATION_FINALIZED', 'EVALUATIONS', 'FINALIZE'],
      ['COMPLIANCE_RECORD_REVIEWED', 'COMPLIANCE', 'REVIEW'],
      ['MEDICAL_RECORD_UPDATED', 'COMPLIANCE', 'UPDATE'],
      ['JOB_OPENING_CREATED', 'RECRUITMENT', 'CREATE'],
      ['JOB_APPLICATION_STATUS_HIRED', 'RECRUITMENT', 'STATUS_CHANGE'],
      ['ANNOUNCEMENT_ACTIVATED', 'COMMUNICATION', 'PUBLISH'],
      ['WEEKLY_SCHEDULE_REVISED', 'ATTENDANCE', 'UPDATE'],
      ['HOLIDAY_SUGGESTION_APPROVED', 'ATTENDANCE', 'APPROVE'],
      ['AWARD_FINALIZED', 'AWARDS', 'FINALIZE'],
      ['DOCUMENT_UPLOADED', 'EMPLOYEES', 'UPLOAD'],
      ['DOCUMENT_DELETED', 'EMPLOYEES', 'DELETE'],
      ['ATTENDANCE_IMPORT_APPLIED', 'ATTENDANCE', 'IMPORT'],
      ['FIX_SUPERVISOR_ASSIGNMENT', 'SYSTEM', 'ASSIGN'],
    ];
    for (const [action, tab, type] of cases) {
      const info = describeAction(action);
      assert.equal(info.tab, tab, action);
      assert.equal(info.type, type, action);
      assert.equal(matchesFilters(info, { tab: 'ALL' }), true, action);
      assert.equal(info.unmapped, false, action);
    }
  });

  test('an action never seen before is still placed, by prefix or record type, and never hidden', () => {
    const byPrefix = describeAction('LEAVE_SOMETHING_NEW');
    assert.equal(byPrefix.module, 'LEAVE_REQUESTS');
    assert.equal(byPrefix.unmapped, true);
    const byEntity = describeAction('MYSTERY_ACTION', 'AttendanceRecord');
    assert.equal(byEntity.module, 'ATTENDANCE');
    const nowhere = describeAction('MYSTERY_ACTION_2');
    assert.equal(nowhere.tab, 'SYSTEM');
    assert.equal(matchesFilters(nowhere, { tab: 'ALL' }), true);
  });

  test('filters: module, action type and failures', () => {
    const failed = describeAction('LOGIN_FAILED');
    assert.equal(failed.outcome, 'FAILURE');
    assert.equal(describeAction('LOGIN_SUCCESS').outcome, 'SUCCESS');
    assert.equal(describeAction('GOOGLE_LOGIN_FAILED').outcome, 'FAILURE');
    assert.equal(describeAction('GOOGLE_LOGIN_UNREGISTERED').outcome, 'FAILURE');
    assert.equal(describeAction('GOOGLE_LOGIN_BLOCKED').outcome, 'FAILURE');
    assert.equal(
      summarize(describeAction('GOOGLE_LOGIN_UNREGISTERED'), { actor: null, subject: null, record: 'stranger@gmail.com' }),
      'A Google sign-in with the unregistered email “stranger@gmail.com” was refused.'
    );
    assert.equal(describeAction('APPLICANT_COMMUNICATION_FAILED').outcome, 'FAILURE');
    assert.equal(matchesFilters(failed, { tab: 'SECURITY', outcome: 'SUCCESS' }), false);
    assert.equal(matchesFilters(describeAction('LEAVE_APPROVED'), { tab: 'LEAVE', module: 'LEAVE_BALANCES' }), false);
    assert.equal(matchesFilters(describeAction('LEAVE_APPROVED'), { tab: 'ALL', actionType: 'APPROVE' }), true);
    assert.equal(matchesFilters(describeAction('LEAVE_APPROVED'), { tab: 'ALL', actionType: 'REJECT' }), false);
  });
});

describe('readable sentences', () => {
  test('actor, action, record and person', () => {
    const s = summarize(describeAction('LEAVE_APPROVED'), {
      actor: 'Maria Santos',
      subject: 'Juan Dela Cruz',
      record: 'Vacation leave, 24 Sep 2026 – 26 Sep 2026',
    });
    assert.equal(s, 'Maria Santos approved the leave request “Vacation leave, 24 Sep 2026 – 26 Sep 2026” of Juan Dela Cruz.');
  });

  test('an employee edit names the profile sections that changed', () => {
    const text = employeeUpdateText(['employmentStatus', 'hireDate']);
    assert.equal(text, 'updated the Employment Details of {s}');
    const info = { ...describeAction('UPDATE_EMPLOYEE'), text: text! };
    assert.equal(
      summarize(info, { actor: 'Maria Santos', subject: 'Juan Dela Cruz', record: null }),
      'Maria Santos updated the Employment Details of Juan Dela Cruz.'
    );
    assert.equal(employeeUpdateText(['mobilePhone', 'presentAddress']), 'updated the Contact Details and Addresses of {s}');
    assert.equal(employeeUpdateText([]), null);
  });

  test('no person, or the person is the actor: the clause is dropped, not invented', () => {
    assert.equal(summarize(describeAction('LEAVE_FILED'), { actor: 'Juan Dela Cruz', subject: 'Juan Dela Cruz', subjectIsActor: true, record: null }), 'Juan Dela Cruz filed a leave request.');
    assert.equal(summarize(describeAction('LOGIN_SUCCESS'), { actor: 'Ana Reyes', subject: null, record: null }), 'Ana Reyes signed in.');
    assert.equal(
      summarize(describeAction('UPDATE_EMPLOYEE'), { actor: 'Ana Reyes', subject: 'Ana Reyes', subjectIsActor: true, record: null }),
      'Ana Reyes updated their own employee record.'
    );
    assert.equal(
      summarize(describeAction('LEAVE_CANCELLED'), { actor: 'Ana Reyes', subject: 'Ana Reyes', subjectIsActor: true, record: 'Sick leave, Oct 1, 2026' }),
      'Ana Reyes cancelled their own leave request “Sick leave, Oct 1, 2026”.'
    );
    assert.equal(summarize(describeAction('EVALUATION_CYCLE_CLOSED'), { actor: null, subject: null, record: null }), 'System closed the evaluation cycle.');
  });

  test('a failed sign-in names the account, not a person who tried', () => {
    assert.equal(
      summarize(describeAction('LOGIN_FAILED'), { actor: 'Ana Reyes', subject: null, record: null }),
      'A sign-in to the account of Ana Reyes failed.'
    );
  });

  test('a personal calendar note never carries its title', () => {
    const info = describeAction('PERSONAL_NOTE_CREATED');
    assert.equal(info.text.includes('{r}'), false);
  });
});

describe('before / after', () => {
  const names = new Map([
    ['11111111-1111-4111-8111-111111111111', 'Kitchen Supervisor Person'],
    ['22222222-2222-4222-8222-222222222222', 'IGP Coordinator Person'],
  ]);

  test('only fields that differ, with ids resolved to names', () => {
    const info = describeAction('SUPERVISOR_ASSIGNMENT_MIGRATED');
    const out = extractChanges(
      {
        metadata: {
          previousSupervisorId: '11111111-1111-4111-8111-111111111111',
          newSupervisorId: '22222222-2222-4222-8222-222222222222',
          previousAssignmentStatus: 'PENDING',
          newAssignmentStatus: 'PENDING',
        },
        oldValue: null,
        newValue: null,
      },
      info,
      names
    );
    assert.deepEqual(
      out.changes.map((c) => [c.label, c.before, c.after]),
      [['Supervisor', 'Kitchen Supervisor Person', 'IGP Coordinator Person']]
    );
  });

  test('a snapshot pair shows just the differences', () => {
    const out = extractChanges(
      {
        metadata: null,
        oldValue: { date: '2026-09-15', status: 'PRESENT', remarks: 'first' },
        newValue: { date: '2026-09-15', status: 'PRESENT', remarks: 'second' },
      },
      describeAction('UPDATE_ATTENDANCE'),
      names
    );
    assert.deepEqual(out.changes.map((c) => [c.field, c.before, c.after]), [['remarks', 'first', 'second']]);
    assert.equal(out.recorded, null);
  });

  test('a key stored on only one side of a snapshot is "also recorded", not a change to or from blank', () => {
    const out = extractChanges(
      { metadata: { before: { combinedScoring: false, appraisalType: 'Annual' }, after: { combinedScoring: true, head: 50 } }, oldValue: null, newValue: null },
      describeAction('EVALUATION_CYCLE_SCORING_UPDATED'),
      names
    );
    assert.deepEqual(out.changes.map((c) => [c.field, c.before, c.after]), [['combinedScoring', 'No', 'Yes']]);
    assert.equal(out.recorded?.title, 'Also recorded');
    assert.deepEqual(out.recorded?.items, [
      { label: 'Head weight (%)', value: '50' },
      { label: 'Previous appraisal type', value: 'Annual' },
    ]);
  });

  test('typed text keeps its case; codes are turned into words', () => {
    assert.equal(formatAuditValue('title', 'MEETING', new Map()), 'MEETING');
    assert.equal(formatAuditValue('reviewStatus', 'NEEDS_CORRECTION', new Map()), 'Needs correction');
  });

  test('a value recorded on one side only is never presented as a before / after', () => {
    const out = extractChanges(
      { metadata: null, oldValue: null, newValue: { status: 'APPROVED' } },
      describeAction('LEAVE_APPROVED'),
      names
    );
    assert.equal(out.changes.length, 0);
    assert.deepEqual(out.recorded?.items, [{ label: 'Status', value: 'Approved' }]);
  });

  test('passwords, tokens and confidential notes never appear; ID numbers show as changed without values', () => {
    const out = extractChanges(
      {
        metadata: { password: 'x', resetToken: 'y', hrConfidentialNotes: 'z', reason: 'ok' },
        oldValue: { sssNumber: '11-1', mobilePhone: '0917' },
        newValue: { sssNumber: '22-2', mobilePhone: '0918' },
      },
      describeAction('UPDATE_EMPLOYEE'),
      names
    );
    const all = JSON.stringify(out);
    for (const secret of ['"x"', '"y"', '"z"', '11-1', '22-2']) assert.equal(all.includes(secret), false, secret);
    const sss = out.changes.find((c) => c.field === 'sssNumber');
    assert.equal(sss?.hidden, true);
    assert.equal(out.changes.find((c) => c.field === 'mobilePhone')?.after, '0918');
    assert.deepEqual(out.details, [{ label: 'Reason', value: 'ok' }]);
  });

  test('medical and psychological rows show which fields changed, never the values', () => {
    const out = extractChanges(
      { metadata: { examType: 'Annual Physical', reviewStatus: 'ACCEPTED' }, oldValue: { fitness: 'FIT' }, newValue: { fitness: 'UNFIT' } },
      describeAction('MEDICAL_RECORD_UPDATED'),
      names
    );
    assert.equal(out.changes[0].hidden, true);
    assert.equal(out.changes[0].before, '');
    assert.deepEqual(out.details, [{ label: 'Review status', value: 'Accepted' }]);
    assert.equal(JSON.stringify(out).includes('Annual Physical'), false);
  });

  test('the write-side diff records changed fields only, and no ID-number values', () => {
    const d = auditSnapshotDiff(
      { mobilePhone: '0917', tinNumber: '1', hireDate: new Date('2020-01-01'), updatedAt: new Date(1), user: { id: 'x' } },
      { mobilePhone: '0918', tinNumber: '2', hireDate: new Date('2020-01-01'), updatedAt: new Date(2), user: { id: 'y' } }
    );
    assert.deepEqual(d.fields, ['mobilePhone', 'tinNumber']);
    assert.deepEqual(d.oldValue, { mobilePhone: '0917' });
    assert.deepEqual(d.newValue, { mobilePhone: '0918' });
  });

  test('values read as words, not codes', () => {
    assert.equal(formatAuditValue('status', 'FOR_INTERVIEW', new Map()), 'For interview');
    assert.equal(formatAuditValue('eligible', true, new Map()), 'Yes');
    assert.equal(formatAuditValue('supervisorId', '33333333-3333-4333-8333-333333333333', new Map()), 'A record that no longer exists');
    assert.equal(formatAuditValue('hireDate', '2026-09-15T00:00:00.000Z', new Map()), 'Sep 15, 2026');
    assert.equal(formatAuditValue('publishAt', '2026-09-28T09:49:00.000Z', new Map()), 'Sep 28, 2026, 5:49 PM');
  });
});
