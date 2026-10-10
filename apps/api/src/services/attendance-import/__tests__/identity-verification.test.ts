import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AttendanceImportClassification } from '@prisma/client';
import {
  compareNames,
  verifyIdentity,
  flagForVerdict,
  normalizeNameTokens,
} from '../identity-verification.service';
import { HOLDING_FLAGS, INFORMATIONAL_FLAGS, isHeld, holdingFlagsIn } from '../review-flags';
import { AttendanceImportClassificationService } from '../classification.service';
import { MUSTARD_FLAGS } from '../mustard-seedtime.normalizer';
import { DAY_FLAGS } from '../day-context.service';

/**
 * Every name here is invented. None comes from the official export - the whole
 * point of this module is that real names never reach source, tests or storage.
 */

const MATCH = (a: string, b: string) => {
  const { score, weakest } = compareNames(a, b);
  return score >= 80 && weakest >= 90;
};

describe('name comparison - the same person written differently', () => {
  const sameperson: Array<[string, string, string]> = [
    ['DELA CRUZ, JUAN P.', 'Dela Cruz Juan Perez', 'middle initial vs spelled out'],
    ['SANTOS, MARIA TERESA', 'Santos Ma. Teresa', 'MA. is how devices write MARIA'],
    ['STAFF, KITCHEN', 'Staff Kitchen', 'case only'],
    ['GARCIA, ANA', 'Garcia Ana Marie', 'middle name absent on one side'],
    ['DELACRUZ, JUAN', 'Dela Cruz Juan', 'compound surname, spacing differs'],
    ['SANTOS,  JOSE   M.', 'Santos Jose Miguel', 'stray whitespace and an initial'],
  ];

  for (const [source, stored, why] of sameperson) {
    test(`matches: ${why}`, () => {
      assert.ok(MATCH(source, stored), `expected a match for "${source}" vs "${stored}"`);
    });
  }
});

describe('name comparison - genuinely different people', () => {
  const different: Array<[string, string, string]> = [
    ['SANTOS, MARIA', 'Dela Cruz Juan', 'nothing in common'],
    ['STAFF, KITCHEN', 'Supervisor Maintenance', 'different roles'],
    ['CRUZ, PEDRO', 'Cruz Pablo', 'shared surname, different first name'],
  ];

  for (const [source, stored, why] of different) {
    test(`does not match: ${why}`, () => {
      assert.ok(!MATCH(source, stored), `expected no match for "${source}" vs "${stored}"`);
    });
  }

  /**
   * The case a mean-only score gets wrong. A perfect surname drags the average
   * over the line while the first name belongs to somebody else, so this must
   * not come back MATCH - it is exactly the silent misfiling the check exists
   * to prevent. UNCERTAIN is the right answer: ask, do not decide.
   */
  test('a one-letter first-name difference is never a silent match', () => {
    const { score, weakest } = compareNames('REYES, ANTONIO', 'Reyes Antonia');
    assert.ok(score >= 80, 'the average alone looks like a match');
    assert.ok(weakest < 90, 'but the weakest token must give it away');
    assert.ok(!MATCH('REYES, ANTONIO', 'Reyes Antonia'));
  });
});

describe('normalizeNameTokens', () => {
  test('strips punctuation and case but preserves order', () => {
    assert.deepEqual(normalizeNameTokens('Dela Cruz, Juan P.'), ['DELA', 'CRUZ', 'JUAN', 'P']);
  });

  test('strips accents', () => {
    assert.deepEqual(normalizeNameTokens('Muñoz, José'), ['MUNOZ', 'JOSE']);
  });
});

describe('verifyIdentity', () => {
  const roster = [
    { id: 'e1', lastName: 'Staff', firstName: 'Kitchen', middleName: null },
    { id: 'e2', lastName: 'Dela Cruz', firstName: 'Juan', middleName: 'Perez' },
  ];

  test('a correct mapping passes with no suggestion', () => {
    const r = verifyIdentity('STAFF, KITCHEN', roster[0], roster);
    assert.equal(r.verdict, 'MATCH');
    assert.equal(r.suggestedEmployeeId, null, 'a trusted mapping must not propose an alternative');
  });

  /** The whole reason this module exists: a device code handed to someone else. */
  test('a reassigned code is caught and the real person is proposed', () => {
    const r = verifyIdentity('DELA CRUZ, JUAN P.', roster[0], roster);
    assert.equal(r.verdict, 'MISMATCH');
    assert.equal(r.suggestedEmployeeId, 'e2');
    assert.ok((r.suggestedScore ?? 0) >= 80);
  });

  test('an unmapped code still gets a suggestion for HR to confirm', () => {
    const r = verifyIdentity('DELA CRUZ, JUAN P.', null, roster);
    assert.equal(r.verdict, 'NO_EMPLOYEE_TO_CHECK');
    assert.equal(r.suggestedEmployeeId, 'e2');
  });

  /**
   * Found by running the official export against the real roster: a lone letter
   * in an HRISense name ("Rendu A") was read as an initial and matched every word
   * starting with that letter, so an unrelated person was offered to HR as a
   * likely match. A single letter may support a match, never create one.
   */
  test('a stray single letter cannot manufacture a suggestion', () => {
    const units = [
      { id: 'u1', lastName: 'Staff', firstName: 'Rendu A', middleName: null },
      { id: 'u2', lastName: 'Staff', firstName: 'Rendu B', middleName: null },
    ];
    const r = verifyIdentity('ACOSTA, GUADA', null, units);
    assert.equal(r.suggestedEmployeeId, null);
    assert.equal(compareNames('ACOSTA, GUADA', 'Staff Rendu A').score, 0);
  });

  test('initials still support a match that a real word anchors', () => {
    assert.ok(MATCH('DELA CRUZ, JUAN P.', 'Dela Cruz Juan Perez'));
    assert.ok(MATCH('SANTOS, MARIBEL R', 'Santos Maribel Reyes'));
  });

  test('nobody close enough is proposed rather than the least-bad guess', () => {
    const r = verifyIdentity('QQQQ, ZZZZ', null, roster);
    assert.equal(r.suggestedEmployeeId, null);
  });

  test('no name in the file is not treated as a failed check', () => {
    const r = verifyIdentity(null, roster[0], roster);
    assert.equal(r.verdict, 'NO_NAME_IN_SOURCE');
    assert.equal(flagForVerdict(r.verdict), null, 'nothing to check must not flag the row');
  });

  test('a mismatch and an uncertain both earn the same flag', () => {
    assert.equal(flagForVerdict('MISMATCH'), 'IDENTITY_NAME_MISMATCH');
    assert.equal(flagForVerdict('UNCERTAIN'), 'IDENTITY_NAME_MISMATCH');
    assert.equal(flagForVerdict('MATCH'), null);
  });
});

describe('holding policy', () => {
  /**
   * Guards against a new flag being added to the normalizer and silently
   * defaulting to "safe to apply" because nobody classified it.
   */
  test('every flag the pipeline can raise is deliberately classified', () => {
    const all = [
      ...Object.values(MUSTARD_FLAGS),
      ...Object.values(DAY_FLAGS),
      'ARCHIVED_EMPLOYEE',
      'IDENTITY_NAME_MISMATCH',
      'IDENTITY_UNVERIFIED',
    ];
    const unclassified = all.filter((f) => !HOLDING_FLAGS.has(f) && !INFORMATIONAL_FLAGS.has(f));
    assert.deepEqual(unclassified, [], `unclassified flags: ${unclassified.join(', ')}`);
  });

  test('a contradictory row is held', () => {
    assert.ok(isHeld(['INCOMPLETE_PUNCH']));
    assert.ok(isHeld(['NON_SEQUENTIAL_PUNCHES']));
    assert.ok(isHeld(['IDENTITY_NAME_MISMATCH']));
  });

  test('an ordinary split shift is not held', () => {
    assert.ok(!isHeld(['MULTIPLE_SESSIONS']));
    assert.ok(!isHeld([]));
  });

  /**
   * Held because the day-context service applies a two-hour tolerance before it
   * raises this at all: arriving early or staying late never gets here, so a row
   * that does is genuinely not the shift it was meant to be.
   */
  test('a punch far outside the scheduled shift is held', () => {
    assert.ok(isHeld(['PUNCH_OUTSIDE_SCHEDULE']));
  });

  test('a day nobody could have worked is held', () => {
    assert.ok(isHeld(['IMPLAUSIBLE_DURATION']));
  });

  /**
   * Deliberately NOT held: most employees have no schedule assigned, so holding
   * on this would hold essentially every row and make the importer unusable.
   */
  test('an unassigned schedule is reported but does not hold the row', () => {
    assert.ok(!isHeld(['SCHEDULE_NOT_CONFIGURED']));
  });

  test('holdingFlagsIn reports only the holding ones', () => {
    assert.deepEqual(holdingFlagsIn(['MULTIPLE_SESSIONS', 'FUTURE_DATE']), ['FUTURE_DATE']);
  });
});

describe('flags veto auto-apply', () => {
  const NEW = AttendanceImportClassification.NEW;

  test('a clean NEW row still applies on its own', () => {
    assert.equal(AttendanceImportClassificationService.defaultDecision(NEW, []), 'USE_UPLOADED');
  });

  /** The gap this work closed: NEW used to apply regardless of its flags. */
  test('a flagged NEW row waits for a human', () => {
    assert.equal(
      AttendanceImportClassificationService.defaultDecision(NEW, ['INCOMPLETE_PUNCH']),
      'PENDING'
    );
    assert.equal(
      AttendanceImportClassificationService.defaultDecision(NEW, ['IDENTITY_NAME_MISMATCH']),
      'PENDING'
    );
  });

  test('a flagged NEW row also blocks the batch from being confirmed', () => {
    assert.equal(AttendanceImportClassificationService.blocksConfirmation(NEW, []), false);
    assert.equal(
      AttendanceImportClassificationService.blocksConfirmation(NEW, ['WORKED_ON_HOLIDAY']),
      true
    );
  });

  /**
   * Holding a row that was never going to be written only fills the queue with
   * nothing to decide.
   */
  test('rows that write nothing are not held', () => {
    for (const c of [
      AttendanceImportClassification.UNKNOWN_EMPLOYEE,
      AttendanceImportClassification.INVALID,
      AttendanceImportClassification.DUPLICATE_IN_FILE,
      AttendanceImportClassification.EXACT_DUPLICATE,
    ]) {
      assert.notEqual(
        AttendanceImportClassificationService.defaultDecision(c, ['INCOMPLETE_PUNCH']),
        'PENDING',
        `${c} should not be held`
      );
      assert.equal(
        AttendanceImportClassificationService.blocksConfirmation(c, ['INCOMPLETE_PUNCH']),
        false
      );
    }
  });
});
