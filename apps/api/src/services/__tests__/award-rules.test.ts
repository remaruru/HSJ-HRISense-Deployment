import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkBallot,
  defaultEotqExcludedRoleIds,
  inGroup,
  longevityRecommendations,
  nomineeDenial,
  rankTally,
  type BallotCategory,
} from '../award-rules';

const p = (id: string, hire: string | null, jobRoleId = 'STAFF', unitId = 'U1') => ({ id, unitId, departmentId: null, jobRoleId, hireDate: hire });
const asOf = '2026-10-09';
const none = new Set<string>();

describe('nominee eligibility — completed years, not days ÷ 365', () => {
  const vincentian = { minYears: 3, maxYears: null, excludeHallOfFame: true, excludedJobRoleIds: [], eligibilityDate: asOf };
  const louisian = { minYears: null, maxYears: 3, excludeHallOfFame: true, excludedJobRoleIds: [], eligibilityDate: asOf };

  test('exactly 3 completed years qualifies for BOTH Vincentian and Louisian', () => {
    const e = p('e', '2023-10-09');
    assert.equal(nomineeDenial(e, null, vincentian, none), null);
    assert.equal(nomineeDenial(e, null, louisian, none), null);
  });

  test('one day short of the 3rd anniversary is 2 completed years: Louisian only', () => {
    const e = p('e', '2023-10-10');
    assert.match(nomineeDenial(e, null, vincentian, none) ?? '', /2 completed years/);
    assert.equal(nomineeDenial(e, null, louisian, none), null);
  });

  test('4 completed years: Vincentian only', () => {
    const e = p('e', '2022-01-01');
    assert.equal(nomineeDenial(e, null, vincentian, none), null);
    assert.match(nomineeDenial(e, null, louisian, none) ?? '', /needs 3 or less/);
  });

  test('Hall of Fame awardees are not nominees (they still vote — voting is not checked here)', () => {
    assert.match(nomineeDenial(p('h', '2010-01-01'), null, vincentian, new Set(['h'])) ?? '', /Hall of Fame/);
  });

  test('Employee of the Quarter: leadership positions excluded; their staff are not', () => {
    const rules = { minYears: null, maxYears: null, excludeHallOfFame: false, excludedJobRoleIds: ['KS'], eligibilityDate: asOf };
    assert.match(nomineeDenial(p('sup', '2020-01-01', 'KS'), null, rules, none) ?? '', /not eligible/);
    assert.equal(nomineeDenial(p('staff', '2020-01-01', 'KITCHEN'), null, rules, none), null);
  });
});

describe('Employee of the Quarter exclusions from the current job roles', () => {
  test('the four named positions plus every Supervisor and Coordinator — not Clinic Staff, not Sister', () => {
    const roles = [
      { id: '1', code: 'ASST_ADMIN', title: 'Assistant Administrator' },
      { id: '2', code: 'HR_OFFICER', title: 'Human Resource Officer' },
      { id: '3', code: 'HEAD_PCH', title: 'Head Pastoral Care/Homelife Services' },
      { id: '4', code: 'HEAD_SSD', title: 'Head SSD' },
      { id: '5', code: 'KITCHEN_SUPERVISOR', title: 'Kitchen Supervisor' },
      { id: '6', code: 'PT_COORDINATOR', title: 'PT Coordinator' },
      { id: '7', code: 'CLINIC_STAFF', title: 'Clinic Staff' },
      { id: '8', code: 'SISTER', title: 'Sister' },
      { id: '9', code: 'KITCHEN_STAFF', title: 'Kitchen Staff' },
    ];
    assert.deepEqual(defaultEotqExcludedRoleIds(roles).sort(), ['1', '2', '3', '4', '5', '6']);
  });
});

describe('groups', () => {
  test('membership by unit, department, job role or name; no group = everyone', () => {
    const scope = { unitIds: [], departmentIds: [], jobRoleIds: ['CLINIC'], employeeIds: ['x'] };
    assert.ok(inGroup(p('a', null, 'CLINIC'), scope));
    assert.ok(inGroup(p('x', null, 'OTHER'), scope));
    assert.ok(!inGroup(p('b', null, 'OTHER'), scope));
    assert.ok(inGroup(p('b', null, 'OTHER'), null));
  });
});

describe('ballots', () => {
  const cat = (over: Partial<BallotCategory> = {}): BallotCategory => ({ id: 'c', title: 'Homelife Staff of the Quarter', votesPerVoter: 2, candidateIds: new Set(['a', 'b', 'me']), voterEligible: true, ...over });

  test('two votes must go to two DIFFERENT nominees', () => {
    assert.match((checkBallot([cat()], [{ categoryId: 'c', nomineeIds: ['a', 'a'] }]) as any).error, /different nominees/);
  });
  test('no more votes than allowed', () => {
    assert.match((checkBallot([cat({ votesPerVoter: 1 })], [{ categoryId: 'c', nomineeIds: ['a', 'b'] }]) as any).error, /allows 1 vote/);
  });
  test('self-voting is allowed', () => {
    assert.deepEqual(checkBallot([cat()], [{ categoryId: 'c', nomineeIds: ['me', 'a'] }]), {
      votes: [{ categoryId: 'c', nomineeId: 'me', slot: 1 }, { categoryId: 'c', nomineeId: 'a', slot: 2 }],
    });
  });
  test('only where the voter is in the voting group', () => {
    assert.match((checkBallot([cat({ voterEligible: false })], [{ categoryId: 'c', nomineeIds: ['a'] }]) as any).error, /not in the voting group/);
  });
  test('only eligible nominees; the same category cannot appear twice', () => {
    assert.match((checkBallot([cat()], [{ categoryId: 'c', nomineeIds: ['zz'] }]) as any).error, /not an eligible nominee/);
    assert.match((checkBallot([cat()], [{ categoryId: 'c', nomineeIds: ['a'] }, { categoryId: 'c', nomineeIds: ['b'] }]) as any).error, /appears twice/);
  });
});

describe('tally', () => {
  test('everyone starts at 0: only cast votes count, and 0-vote nominees are not results', () => {
    const r = rankTally([{ employeeId: 'a', categoryId: 'c', voteCount: 2 }, { employeeId: 'b', categoryId: 'c', voteCount: 0 }], 'PER_CATEGORY', 5);
    assert.deepEqual(r.map((x) => x.employeeId), ['a']);
  });

  test('Top 5 PER category — never one combined Top 5', () => {
    const entries = ['f', 'r'].flatMap((cat) => Array.from({ length: 7 }, (_, i) => ({ employeeId: `${cat}${i}`, categoryId: cat, voteCount: 10 - i })));
    const r = rankTally(entries, 'PER_CATEGORY', 5);
    assert.equal(r.filter((x) => x.categoryId === 'f' && x.shortlisted).length, 5);
    assert.equal(r.filter((x) => x.categoryId === 'r' && x.shortlisted).length, 5);
  });

  test('a tie at the last shortlisted place is kept whole and flagged for the committee', () => {
    const r = rankTally([10, 9, 8, 7, 6, 6, 6, 1].map((v, i) => ({ employeeId: `e${i}`, categoryId: 'c', voteCount: v })), 'PER_CATEGORY', 5);
    assert.deepEqual(r.filter((x) => x.shortlisted).map((x) => x.rank), [1, 2, 3, 4, 5, 5, 5]);
    assert.deepEqual(r.filter((x) => x.tiedAtCutoff).map((x) => x.employeeId), ['e4', 'e5', 'e6']);
  });

  test('COMBINED (Vincentian Top 15) adds an employee’s votes across the group categories', () => {
    const r = rankTally([{ employeeId: 'a', categoryId: 'admin', voteCount: 3 }, { employeeId: 'b', categoryId: 'health', voteCount: 5 }], 'COMBINED', 15);
    assert.deepEqual(r.map((x) => [x.employeeId, x.rank]), [['b', 1], ['a', 2]]);
  });
});

describe('longevity recommendations', () => {
  test('5 / 10 / 15 / 20 completed years, minus milestones already confirmed', () => {
    const people = [p('ten', '2016-10-09'), p('nine', '2016-10-10'), p('twentytwo', '2004-01-01')];
    const r = longevityRecommendations(people, [5, 10, 15, 20], asOf, new Set(['twentytwo:5', 'twentytwo:10']));
    assert.deepEqual(r.map((x) => `${x.employeeId}:${x.milestone}`), ['ten:5', 'ten:10', 'nine:5', 'twentytwo:15', 'twentytwo:20']);
  });
});
