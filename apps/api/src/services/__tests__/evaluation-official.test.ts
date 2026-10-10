import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_EVALUATION_FORMS, OFFICIAL_SCALES } from '../../data/official-evaluation-forms';
import { computeCombinedResult, distributeWeights, HOSPICIO_SOURCE_WEIGHTS, isOfficialSourceWeights, sourceWeightsProblem, toHundredths, weightTotal, weightsProblem } from '../evaluation-weights';
import { computeEvaluationScore, ratingScaleOf, scoreForLabel } from '../evaluation-score';
import { evaluatorDenial, finalizeDenial, finalResultOf, rateDenial, subjectProgress } from '../evaluation-workflow';
import { EvaluationService } from '../evaluation.service';

const form = (code: string) => {
  const f = OFFICIAL_EVALUATION_FORMS.find((x) => x.code === code);
  assert.ok(f, code);
  return f!;
};
const counts = (code: string) => form(code).areas.map((a) => a.items.length);
const names = (code: string) => form(code).areas.map((a) => a.name);
const hasStatement = (code: string, text: string) => form(code).areas.some((a) => a.items.includes(text));

describe('official Hospicio templates — content from the source forms', () => {
  test('Eval Form 1 (EVAL FORM 1.docx): 10 review areas, 39 statements', () => {
    assert.equal(form('HSJ_EPR_FORM_1').sourceDocument, 'EVAL FORM 1.docx');
    assert.deepEqual(counts('HSJ_EPR_FORM_1'), [4, 5, 3, 3, 3, 4, 5, 3, 4, 5]);
    assert.deepEqual(names('HSJ_EPR_FORM_1'), [
      'KNOWLEDGE, SKILLS & ABILITIES', 'QUALITY AND QUANTITY OF WORK', 'INITIATIVE AND DEPENDABILITY', 'COMMUNICATION',
      'JUDGMENT & PROBLEM SOLVING', 'INTERPERSONAL SKILLS', 'PERSONAL ATTRIBUTES', 'FLEXIBILITY', 'ATTENDANCE & PUNCTUALITY', 'COMMITMENT',
    ]);
    assert.equal(form('HSJ_EPR_FORM_1').areas[0].items[0], 'Has practical/technical skills and knowledge in doing the assigned job.');
  });

  test('Eval Form 2 (Houseparents): 10 areas, 41 statements', () => {
    assert.deepEqual(counts('HSJ_EPR_FORM_2'), [4, 4, 4, 4, 3, 4, 5, 4, 4, 5]);
    assert.ok(hasStatement('HSJ_EPR_FORM_2', 'Has practical/technical skills and knowledge in giving care and managing children or adults.'));
    assert.ok(hasStatement('HSJ_EPR_FORM_2', 'Welcomes transfer in job assignments.'));
  });

  test('Eval Form 3: 10 areas, 37 statements, its own area names', () => {
    assert.deepEqual(counts('HSJ_EPR_FORM_3'), [4, 4, 3, 4, 4, 3, 4, 4, 3, 4]);
    assert.ok(names('HSJ_EPR_FORM_3').includes('INITIATIVE AND CREATIVITY'));
    assert.ok(names('HSJ_EPR_FORM_3').includes('FLEXIBILITY & ADAPTABILITY'));
  });

  test('Eval Form 4 (Social Workers): 10 areas, 30 statements, social-work content', () => {
    assert.deepEqual(counts('HSJ_EPR_FORM_4'), [4, 4, 2, 3, 2, 2, 3, 3, 3, 4]);
    assert.deepEqual(names('HSJ_EPR_FORM_4').slice(-1), ['ETHICS']);
    assert.ok(hasStatement('HSJ_EPR_FORM_4', 'Practices and apply social work standards and principles in dealing with clients and others.'));
  });

  test('Simplified form: 10 performance factors × 3 statements', () => {
    assert.deepEqual(counts('HSJ_SIMPLIFIED_SUPERVISORY'), [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    assert.deepEqual(names('HSJ_SIMPLIFIED_SUPERVISORY'), [
      'QUALITY', 'WORK HABITS', 'JOB KNOWLEDGE', 'RELIABILITY', 'ATTENDANCE & PUNCTUALITY',
      'INITIATIVE AND CREATIVITY', 'TEAMWORK', 'COMMITMENT', 'PROBLEM SOLVING', 'ADAPTABILITY',
    ]);
  });

  test('the four forms are not mixed into one', () => {
    assert.ok(!names('HSJ_EPR_FORM_4').includes('QUALITY AND QUANTITY OF WORK'));
    assert.ok(!hasStatement('HSJ_EPR_FORM_1', 'Welcomes transfer in job assignments.'));
    assert.ok(!OFFICIAL_EVALUATION_FORMS.filter((f) => f.code !== 'HSJ_EPR_FORM_4').some((f) => f.areas.some((a) => a.name === 'ETHICS')));
  });

  test('written sections follow each form', () => {
    for (const code of ['HSJ_EPR_FORM_1', 'HSJ_EPR_FORM_2', 'HSJ_EPR_FORM_3', 'HSJ_EPR_FORM_4']) {
      const l = form(code).layout;
      assert.equal(l.itemComments, true, code);
      assert.equal(l.goalsLabel, 'Goals and Objectives', code);
      assert.ok(l.goalsPrompt && l.goalsPrompt.length > 20, code);
      assert.match(l.generalCommentsLabel, /^Additional Comments/, code);
      assert.match(l.acknowledgment ?? '', /does not necessarily indicate that I agree/, code);
      assert.deepEqual(l.appraisalTypes, ['Regularization', 'Mid-Year / Annual Review']);
      assert.equal(form(code).scoringMethod, 'AREA_WEIGHTED');
    }
    const s = form('HSJ_SIMPLIFIED_SUPERVISORY');
    assert.equal(s.layout.itemComments, false);
    assert.equal(s.layout.goalsLabel, null);
    assert.equal(s.layout.generalCommentsLabel, 'Comments');
    assert.deepEqual(s.layout.appraisalTypes, ['1st Term', '2nd Term', 'For Regularization', 'For Annual']);
    assert.equal(s.scoringMethod, 'AREA_AVERAGE');
  });
});

describe('official rating scales', () => {
  test('Forms 1–4: Unsatisfactory / Fair / Good / Very Good / Excellent', () => {
    assert.deepEqual(OFFICIAL_SCALES.HSJ_EPR.map((o) => [o.score, o.code, o.label]), [
      [1, 'U', 'Unsatisfactory'], [2, 'F', 'Fair'], [3, 'G', 'Good'], [4, 'VG', 'Very Good'], [5, 'E', 'Excellent'],
    ]);
    for (const code of ['HSJ_EPR_FORM_1', 'HSJ_EPR_FORM_2', 'HSJ_EPR_FORM_3', 'HSJ_EPR_FORM_4']) assert.equal(form(code).scale, 'HSJ_EPR');
  });

  test('Simplified: Unsatisfactory / Improvement Needed / Satisfactory / Very Satisfactory / Exceptional', () => {
    assert.deepEqual(OFFICIAL_SCALES.HSJ_SIMPLIFIED.map((o) => [o.score, o.label]), [
      [1, 'Unsatisfactory'], [2, 'Improvement Needed'], [3, 'Satisfactory'], [4, 'Very Satisfactory'], [5, 'Exceptional'],
    ]);
    assert.equal(form('HSJ_SIMPLIFIED_SUPERVISORY').scale, 'HSJ_SIMPLIFIED');
  });
});

describe('criterion weights — Auto-Distribute to 100%', () => {
  const exact = (w: number[]) => assert.equal(weightTotal(w).hundredths, 10000);
  test('1 criterion → 100', () => assert.deepEqual(distributeWeights(1), [100]));
  test('2 → 50 / 50', () => assert.deepEqual(distributeWeights(2), [50, 50]));
  test('3 → 33.33 / 33.33 / 33.34, exactly 100', () => {
    assert.deepEqual(distributeWeights(3), [33.33, 33.33, 33.34]);
    exact(distributeWeights(3));
  });
  test('4 → 25 each', () => assert.deepEqual(distributeWeights(4), [25, 25, 25, 25]));
  test('10 → 10 each', () => assert.deepEqual(distributeWeights(10), new Array(10).fill(10)));
  test('7 and 9 still total exactly 100', () => {
    exact(distributeWeights(7));
    exact(distributeWeights(9));
  });
  test('manual edits are allowed and the total is reported exactly', () => {
    const w = distributeWeights(4);
    w[0] = 15; // HR raises one…
    assert.equal(weightTotal(w).status, 'UNDER');
    assert.equal(weightTotal(w).difference, 10);
    w[1] = 35;
    assert.equal(weightTotal(w).status, 'EXACT');
    w[2] = 30;
    assert.deepEqual([weightTotal(w).status, weightTotal(w).difference], ['OVER', 5]);
  });
  test('a weighted template cannot be saved unless the total is exactly 100', () => {
    assert.equal(weightsProblem([33.33, 33.33, 33.34]), null);
    assert.match(weightsProblem([33.33, 33.33, 33.33]) ?? '', /0.01% short/);
    assert.match(weightsProblem([50, 50.5]) ?? '', /0.5% over/);
    assert.match(weightsProblem([10.005, 89.995]) ?? '', /two decimal places/);
    const check = (EvaluationService as any).checkStructure.bind(EvaluationService);
    assert.throws(() => check({ name: 'x', groups: [{ name: 'A', weight: 60, items: [{ name: 'a' }] }, { name: 'B', weight: 30, items: [{ name: 'b' }] }] }, true), /short of 100/);
    assert.equal(check({ name: 'x', groups: [{ name: 'A', weight: 60, items: [{ name: 'a' }] }, { name: 'B', weight: 40, items: [{ name: 'b' }] }] }, true), 'AREA_WEIGHTED');
    assert.throws(() => check({ name: 'x', criteria: [{ name: 'a', weight: 70 }, { name: 'b', weight: 20 }] }, true), /short of 100/);
  });
  test('weights are compared in hundredths, not floating point', () => {
    assert.equal(toHundredths(33.33) + toHundredths(33.33) + toHundredths(33.34), 10000);
    assert.equal(0.1 + 0.2 === 0.3, false); // why it matters
    assert.equal(weightTotal([0.1, 0.2, 99.7]).status, 'EXACT');
  });
});

describe('self / peer / head contribution weights', () => {
  test('must total exactly 100', () => {
    assert.equal(sourceWeightsProblem({ self: 20, peer: 20, head: 60 }), null);
    assert.match(sourceWeightsProblem({ self: 20, peer: 20, head: 50 }) ?? '', /10% short/);
    assert.match(sourceWeightsProblem({ self: 30, peer: 30, head: 50 }) ?? '', /10% over/);
    assert.ok(sourceWeightsProblem(null));
  });

  test('combined result — the worked example', () => {
    const r = computeCombinedResult({
      weights: { self: 20, peer: 20, head: 60 },
      self: { overall: 4, submitted: true, rawTotal: 156, rawMax: 195 },
      peers: [{ overall: 4.25, submitted: true }],
      head: { overall: 4.5, submitted: true },
      maxScore: 5,
    });
    assert.deepEqual(r.rows.map((x) => [x.source, x.average, x.weight, x.contribution]), [
      ['SELF', 4, 20, 0.8], ['PEER', 4.25, 20, 0.85], ['HEAD', 4.5, 60, 2.7],
    ]);
    assert.equal(r.final, 4.35);
    assert.equal(r.rows[0].rawTotal, 156);
  });

  test('three peers share ONE peer weight (averaged, not 3 × 20%)', () => {
    const r = computeCombinedResult({
      weights: { self: 20, peer: 20, head: 60 },
      self: { overall: 4, submitted: true },
      peers: [{ overall: 4, submitted: true }, { overall: 4.5, submitted: true }, { overall: 4.25, submitted: true }],
      head: { overall: 4.5, submitted: true },
    });
    const peer = r.rows.find((x) => x.source === 'PEER')!;
    assert.equal(peer.evaluators, 3);
    assert.equal(peer.average, 4.25);
    assert.equal(peer.contribution, 0.85);
    assert.equal(r.rows.reduce((n, x) => n + x.weight, 0), 100);
    assert.equal(r.final, 4.35);
  });

  test('a weighted source with nothing submitted leaves the result incomplete', () => {
    const r = computeCombinedResult({
      weights: { self: 20, peer: 20, head: 60 },
      self: { overall: 4, submitted: true },
      peers: [],
      head: { overall: 4.5, submitted: true },
    });
    assert.equal(r.final, null);
    assert.match(r.missing.join(), /Peer rating: no evaluator assigned/);
  });

  test('a 0% source is not required', () => {
    const r = computeCombinedResult({
      weights: { self: 30, peer: 0, head: 70 },
      self: { overall: 4, submitted: true },
      peers: [],
      head: { overall: 5, submitted: true },
    });
    assert.equal(r.final, 4.7);
  });
});

describe('area scoring', () => {
  const groups = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, name: `Factor ${i + 1}`, weight: 10 }));
  const criteria = groups.flatMap((g) => [0, 1, 2].map((j) => ({ id: `${g.id}-${j}`, name: `${g.name}${j}`, groupId: g.id })));
  // Factor 1 rated 5,4,3 (total 12 → average 4); every other factor 3,3,3 (average 3).
  const responses = criteria.map((c) => ({ criterionId: c.id, ratingNumeric: c.groupId === 'g0' ? [5, 4, 3][Number(c.id.slice(-1))] : 3 }));

  test("Simplified form's own rule: total ÷ 3 per factor, then the averages ÷ 10", () => {
    const r = computeEvaluationScore({ ratingMethod: 'NUMERIC', useWeighting: false, scoringMethod: 'AREA_AVERAGE', groups, criteria, responses, maxScore: 5 });
    assert.equal(r.areas![0].average, 4);
    assert.equal(r.areas![1].average, 3);
    assert.equal(r.overallScore, 3.1); // (4 + 9 × 3) ÷ 10
    assert.equal(r.rawTotal, 93);
    assert.equal(r.rawMax, 150);
  });

  test('weighted review areas: Σ area average × weight ÷ 100', () => {
    const r = computeEvaluationScore({ ratingMethod: 'NUMERIC', useWeighting: true, scoringMethod: 'AREA_WEIGHTED', groups, criteria, responses, maxScore: 5 });
    assert.equal(r.areas![0].contribution, 0.4);
    assert.equal(r.totalWeight, 100);
    assert.equal(r.overallScore, 3.1);
  });

  test('the area weight is not repeated on each statement', () => {
    const r = computeEvaluationScore({ ratingMethod: 'NUMERIC', useWeighting: true, scoringMethod: 'AREA_WEIGHTED', groups, criteria, responses, maxScore: 5 });
    assert.ok(r.rows.every((row) => row.weight === null));
  });

  test('flat templates still score as before', () => {
    const r = computeEvaluationScore({
      ratingMethod: 'NUMERIC', useWeighting: false,
      criteria: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      responses: [{ criterionId: 'a', ratingNumeric: 4 }, { criterionId: 'b', ratingNumeric: 5 }],
    });
    assert.equal(r.method, 'AVERAGE');
    assert.equal(r.overallScore, 4.5);
  });
});

describe('HR administers but does not rate', () => {
  const head = { evaluatorId: 'head-1', raterType: 'HEAD' as const, status: 'IN_PROGRESS' as const, discussionCompletedAt: null };
  test('HR (FULL) who is not the assigned evaluator cannot submit ratings', () => {
    const d = rateDenial(head, { employeeId: 'hr-1', permissionTier: 'FULL' });
    assert.equal(d?.status, 403);
    assert.match(d!.message, /HR administers evaluations but does not rate them/);
  });
  test('the assigned evaluator can', () => assert.equal(rateDenial(head, { employeeId: 'head-1', permissionTier: 'SUPERVISOR' }), null));
  test('not after finalisation, nor after the discussion is recorded', () => {
    assert.equal(rateDenial({ ...head, status: 'FINALIZED' }, { employeeId: 'head-1', permissionTier: 'SUPERVISOR' })?.status, 400);
    assert.equal(rateDenial({ ...head, status: 'SUBMITTED', discussionCompletedAt: new Date() }, { employeeId: 'head-1', permissionTier: 'SUPERVISOR' })?.status, 400);
  });
});

describe("Hospicio's official evaluation weighting — self 20 / peer 20 / head 60", () => {
  const W = HOSPICIO_SOURCE_WEIGHTS;
  const all = (over: Partial<Parameters<typeof computeCombinedResult>[0]> = {}) =>
    computeCombinedResult({
      weights: W,
      self: { overall: 4, submitted: true },
      peers: [{ overall: 4.25, submitted: true }],
      head: { overall: 4.5, submitted: true },
      maxScore: 5,
      ...over,
    });

  test('20 + 20 + 60 = 100%', () => {
    assert.deepEqual({ ...W }, { self: 20, peer: 20, head: 60 });
    assert.equal(sourceWeightsProblem(W), null);
    assert.equal(weightTotal([W.self, W.peer, W.head]).hundredths, 10000);
    assert.ok(isOfficialSourceWeights({ self: 20, peer: 20, head: 60 }));
    assert.ok(!isOfficialSourceWeights({ self: 25, peer: 25, head: 50 }));
  });

  test('the worked example: 0.80 + 0.85 + 2.70 = 4.35 of 5 = 87%', () => {
    const r = all();
    assert.deepEqual(r.rows.map((x) => x.contribution), [0.8, 0.85, 2.7]);
    assert.equal(r.final, 4.35);
    assert.equal(r.finalPercent, 87);
    assert.equal(r.formula, '4.00 × 20% + 4.25 × 20% + 4.50 × 60% = 0.80 + 0.85 + 2.70 = 4.35 of 5 (4.35 ÷ 5 × 100 = 87%)');
  });

  test('one peer: that peer’s score is the peer component, worth 20%', () => {
    const r = all({ peers: [{ overall: 3.8, submitted: true }] });
    const peer = r.rows.find((x) => x.source === 'PEER')!;
    assert.deepEqual([peer.evaluators, peer.average, peer.weight, peer.contribution], [1, 3.8, 20, 0.76]);
  });

  test('several peers: averaged first (4.20, 4.00, 4.30 → 4.1667), then 20% — never 3 × 20%', () => {
    const r = all({ peers: [{ overall: 4.2, submitted: true }, { overall: 4.0, submitted: true }, { overall: 4.3, submitted: true }] });
    const peer = r.rows.find((x) => x.source === 'PEER')!;
    assert.equal(peer.evaluators, 3);
    assert.equal(peer.average, 4.1667);
    assert.equal(peer.weight, 20);
    assert.equal(peer.contribution, 0.83);
    assert.equal(r.rows.reduce((n, x) => n + x.weight, 0), 100);
  });

  test('missing self rating: no final result, nothing re-weighted', () => {
    const r = all({ self: { overall: null, submitted: false } });
    assert.equal(r.final, null);
    assert.match(r.missing.join(), /Self rating: not submitted yet/);
    assert.deepEqual(r.rows.map((x) => x.weight), [20, 20, 60]);
  });

  test('missing peer rating: no final result', () => {
    assert.equal(all({ peers: [] }).final, null);
    assert.equal(all({ peers: [{ overall: null, submitted: false }] }).final, null);
  });

  test('missing head / supervisor / coordinator rating: no final result (not 50 / 50)', () => {
    const r = all({ head: null });
    assert.equal(r.final, null);
    assert.equal(r.finalPercent, null);
    assert.match(r.missing.join(), /Head \/ supervisor \/ coordinator rating: no evaluator assigned/);
  });

  test('the figures shown reproduce the final exactly', () => {
    for (const peers of [[4.2, 4.0, 4.3], [3.33], [4.5, 2.75], [5, 5, 4.99, 1]]) {
      const r = all({ peers: peers.map((p) => ({ overall: p, submitted: true })) });
      const fromRows = Number(r.rows.reduce((n, x) => n + Number((x.average! * x.weight / 100).toFixed(2)), 0).toFixed(2));
      assert.equal(fromRows, r.final);
      assert.equal(Number((r.final! / 5 * 100).toFixed(2)), r.finalPercent);
    }
  });
});

describe('finalisation gate in a 20 / 20 / 60 cycle', () => {
  const row = (raterType: 'SELF' | 'PEER' | 'HEAD', status: any, extra: any = {}) =>
    ({ id: `${raterType}-${Math.random()}`, employeeId: 'e1', raterType, status, ...extra }) as any;
  const done = (extra: any = {}) => [row('SELF', 'SUBMITTED'), row('PEER', 'SUBMITTED'), row('HEAD', 'SUBMITTED', extra)];
  const W = { mode: 'WEIGHTED_MULTI_RATER' as const, requirePeer: true };

  test('all ratings in but no discussion: cannot finalise', () => {
    const p = subjectProgress(done(), W);
    assert.notEqual(p.stage, 'READY_TO_FINALIZE');
    assert.ok(p.blockers.includes('Discussion with the employee not recorded'));
  });

  test('all ratings and the discussion: HR may finalise', () => {
    const p = subjectProgress(done({ discussionCompletedAt: new Date() }), W);
    assert.equal(p.stage, 'READY_TO_FINALIZE');
    assert.deepEqual(p.blockers, []);
  });

  test('no peer assigned: blocked, because the peer rating counts 20%', () => {
    const p = subjectProgress([row('SELF', 'SUBMITTED'), row('HEAD', 'SUBMITTED', { discussionCompletedAt: new Date() })], W);
    assert.notEqual(p.stage, 'READY_TO_FINALIZE');
    assert.match(p.blockers.join(), /No peer evaluator assigned/);
  });

  test('self rating missing: blocked', () => {
    const p = subjectProgress([row('SELF', 'IN_PROGRESS'), row('PEER', 'SUBMITTED'), row('HEAD', 'SUBMITTED', { discussionCompletedAt: new Date() })], W);
    assert.ok(p.blockers.includes('Self rating not submitted'));
  });

  test('head rating missing: blocked', () => {
    const p = subjectProgress([row('SELF', 'SUBMITTED'), row('PEER', 'SUBMITTED'), row('HEAD', 'IN_PROGRESS')], W);
    assert.ok(p.blockers.includes('Head / supervisor / coordinator evaluation not submitted'));
  });

  test('HR attempting the 60% head rating is denied', () => {
    const d = rateDenial({ evaluatorId: 'head-1', raterType: 'HEAD', status: 'NOT_STARTED', discussionCompletedAt: null }, { employeeId: 'hr-1', permissionTier: 'FULL' });
    assert.equal(d?.status, 403);
  });

  test('new cycles default to the official 20 / 20 / 60', () => {
    assert.deepEqual(EvaluationService.getConfig().officialSourceWeights, { self: 20, peer: 20, head: 60 });
  });
});

describe('Standard Evaluation — the head / supervisor / coordinator alone', () => {
  const row = (raterType: 'SELF' | 'PEER' | 'HEAD', status: any, extra: any = {}) =>
    ({ id: `${raterType}-${Math.random()}`, employeeId: 'e1', raterType, status, ...extra }) as any;
  const S = { mode: 'STANDARD' as const };

  test('head submitted + discussion recorded: ready for HR — no self or peer needed', () => {
    const p = subjectProgress([row('HEAD', 'SUBMITTED', { discussionCompletedAt: new Date() })], S);
    assert.equal(p.stage, 'READY_TO_FINALIZE');
    assert.equal(p.self, null);
    assert.equal(p.peers.total, 0);
  });

  test('discussion still required before HR finalises', () => {
    const p = subjectProgress([row('HEAD', 'SUBMITTED')], S);
    assert.equal(p.stage, 'DISCUSSION_PENDING');
    assert.ok(p.blockers.includes('Discussion with the employee not recorded'));
  });

  test('self / peer rows an older cycle holds are not part of a standard evaluation', () => {
    const p = subjectProgress([row('SELF', 'NOT_STARTED'), row('PEER', 'NOT_STARTED'), row('HEAD', 'SUBMITTED', { discussionCompletedAt: new Date() })], S);
    assert.equal(p.stage, 'READY_TO_FINALIZE');
  });

  test('a weighted evaluation with no self rating is blocked', () => {
    const p = subjectProgress([row('PEER', 'SUBMITTED'), row('HEAD', 'SUBMITTED', { discussionCompletedAt: new Date() })], { mode: 'WEIGHTED_MULTI_RATER', requirePeer: true });
    assert.ok(p.blockers.includes('No self rating in this evaluation'));
  });
});

describe('HR never rates — evaluator eligibility', () => {
  const staff = { id: 'staff-1', immediateSupervisorId: 'head-1' };
  const hrAssistant = { id: 'hra-1', immediateSupervisorId: 'hro-1' };
  const hr = { employeeId: 'hro-1' };

  test('HR cannot pick themselves (designated / head / peer)', () => {
    assert.match(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'hro-1', permissionTier: 'FULL' }, subject: staff, chosenBy: hr }) ?? '', /cannot assign themselves/);
    assert.match(evaluatorDenial({ role: 'PEER', evaluator: { id: 'hro-1', permissionTier: 'FULL' }, subject: staff, chosenBy: hr }) ?? '', /cannot assign themselves/);
  });

  test('a full-access administrator (HR, Sister) is never a peer, and not the head of someone outside their own reports', () => {
    assert.match(evaluatorDenial({ role: 'PEER', evaluator: { id: 'sister-1', permissionTier: 'FULL' }, subject: staff, chosenBy: hr }) ?? '', /cannot be peer evaluators/);
    assert.match(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'sister-1', permissionTier: 'FULL' }, subject: staff, chosenBy: hr }) ?? '', /only of their own direct reports/);
  });

  test('…but the org structure counts: a full-access employee is the head of their own direct report', () => {
    assert.equal(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'hro-1', permissionTier: 'FULL' }, subject: hrAssistant }), null);
    assert.equal(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'hro-1', permissionTier: 'FULL' }, subject: hrAssistant, chosenBy: { employeeId: 'sister-1' } }), null);
  });

  test('nobody chooses the evaluators of their own evaluation', () => {
    assert.match(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'hro-1', permissionTier: 'FULL' }, subject: hrAssistant, chosenBy: { employeeId: 'hra-1' } }) ?? '', /your own evaluation/);
  });

  test('ordinary supervisors and colleagues are fine', () => {
    assert.equal(evaluatorDenial({ role: 'HEAD', evaluator: { id: 'head-1', permissionTier: 'SUPERVISOR' }, subject: staff, chosenBy: hr }), null);
    assert.equal(evaluatorDenial({ role: 'PEER', evaluator: { id: 'staff-2', permissionTier: 'STANDARD' }, subject: staff, chosenBy: hr }), null);
  });

  test('rating: an assigned full-access user rates only as the head of a direct report', () => {
    const base = { status: 'NOT_STARTED' as const, discussionCompletedAt: null };
    const asHr = { employeeId: 'hro-1', permissionTier: 'FULL' };
    assert.equal(rateDenial({ ...base, evaluatorId: 'hro-1', raterType: 'HEAD', subjectSupervisorId: 'hro-1' }, asHr), null);
    assert.equal(rateDenial({ ...base, evaluatorId: 'hro-1', raterType: 'HEAD', subjectSupervisorId: 'head-1' }, asHr)?.status, 403);
    assert.equal(rateDenial({ ...base, evaluatorId: 'hro-1', raterType: 'PEER', subjectSupervisorId: 'head-1' }, asHr)?.status, 403);
    assert.equal(rateDenial({ ...base, evaluatorId: 'hro-1', raterType: 'SELF', subjectSupervisorId: null }, asHr), null);
  });

  test('HR does not finalise an evaluation it is part of', () => {
    const rows = [
      { employeeId: 'hra-1', evaluatorId: 'hra-1', raterType: 'SELF' as const },
      { employeeId: 'hra-1', evaluatorId: 'hro-1', raterType: 'HEAD' as const },
    ];
    assert.match(finalizeDenial(rows, { employeeId: 'hro-1' }) ?? '', /one of the evaluators/);
    assert.match(finalizeDenial(rows, { employeeId: 'hra-1' }) ?? '', /your own evaluation/);
    assert.equal(finalizeDenial(rows, { employeeId: 'sister-1' }), null);
  });
});

describe('labelled rating forms are scored through their configured values', () => {
  const fivePoint = {
    ratingMethod: 'LABELED',
    scoreLabels: { options: [
      { value: 'OUTSTANDING', label: 'Outstanding', score: 5 }, { value: 'VERY_SATISFACTORY', label: 'Very Satisfactory', score: 4 },
      { value: 'SATISFACTORY', label: 'Satisfactory', score: 3 }, { value: 'NEEDS_IMPROVEMENT', label: 'Needs Improvement', score: 2 },
      { value: 'UNSATISFACTORY', label: 'Unsatisfactory', score: 1 },
    ] },
  };

  test('the scale is read from the template, not assumed', () => {
    const scale = ratingScaleOf(fivePoint);
    assert.deepEqual([scale.scored, scale.labelled, scale.min, scale.max], [true, true, 1, 5]);
    assert.equal(scoreForLabel(scale, 'VERY_SATISFACTORY'), 4);
    assert.equal(scoreForLabel(scale, 'very satisfactory'), 4);
    assert.equal(scoreForLabel(scale, 'Excellent'), null);
    const four = ratingScaleOf({ ratingMethod: 'LABELED', scoreLabels: { options: [{ value: 'A', label: 'A', score: 4 }, { value: 'B', label: 'B', score: 1 }] } });
    assert.equal(four.max, 4);
  });

  test('labels without values, or written answers, have no score', () => {
    assert.equal(ratingScaleOf({ ratingMethod: 'LABELED', scoreLabels: { options: [{ value: 'A', label: 'A' }] } }).scored, false);
    assert.equal(ratingScaleOf({ ratingMethod: 'LABELED', scoreLabels: { presetId: 'DESCRIPTIVE', options: [] } }).scored, false);
  });

  test('area averages, overall and percentage from the mapped values', () => {
    const groups = [{ id: 'g1', name: 'Knowledge & Skills' }, { id: 'g2', name: 'Attendance & Punctuality' }];
    const criteria = [
      ...['a', 'b', 'c', 'd'].map((x) => ({ id: `g1${x}`, name: x, groupId: 'g1' })),
      ...['a', 'b'].map((x) => ({ id: `g2${x}`, name: x, groupId: 'g2' })),
    ];
    const r = computeEvaluationScore({
      ratingMethod: 'LABELED', scored: true, useWeighting: false, scoringMethod: 'AREA_AVERAGE', groups, criteria, maxScore: 5,
      responses: [['g1a', 4], ['g1b', 5], ['g1c', 3], ['g1d', 4], ['g2a', 4], ['g2b', 4]].map(([criterionId, ratingNumeric]) => ({ criterionId: String(criterionId), ratingNumeric: Number(ratingNumeric) })),
    });
    assert.deepEqual(r.areas?.map((a) => a.average), [4, 4]);
    assert.equal(r.overallScore, 4);
    assert.equal(r.overallPercent, 80);
  });

  test('a submitted rating without numbers is named, not called "not submitted"', () => {
    const r = computeCombinedResult({
      weights: { self: 20, peer: 20, head: 60 },
      self: { overall: null, submitted: true },
      peers: [{ overall: 4, submitted: true }],
      head: { overall: 4, submitted: true },
    });
    assert.equal(r.final, null);
    assert.match(r.missing.join(), /Self rating: submitted, but the form's answers have no numeric values/);
  });
});

describe('the reported final result', () => {
  const snapshot = { ratingMethod: 'NUMERIC', minScore: 1, maxScore: 5 };
  test('weighted: the 20/20/60 result (4.33), never the head score (4.50)', () => {
    const combined = computeCombinedResult({
      weights: { self: 20, peer: 20, head: 60 },
      self: { overall: 4, submitted: true },
      peers: [4.2, 4.0, 4.3].map((o) => ({ overall: o, submitted: true })),
      head: { overall: 4.5, submitted: true },
      maxScore: 5,
    });
    const r = finalResultOf({ status: 'FINALIZED', overallScore: 4.5, combinedScore: combined.final, combinedBreakdown: combined, templateSnapshot: snapshot }, 'WEIGHTED_MULTI_RATER');
    assert.equal(r?.finalScore, 4.33);
    assert.equal(r?.text, '4.33 / 5 (86.6%)');
  });

  test('standard: the head evaluation\'s overall score', () => {
    const r = finalResultOf({ status: 'FINALIZED', overallScore: 4.18, combinedScore: null, combinedBreakdown: null, templateSnapshot: snapshot }, 'STANDARD');
    assert.equal(r?.text, '4.18 / 5 (83.6%)');
  });

  test('nothing is reported before HR finalises', () => {
    assert.equal(finalResultOf({ status: 'SUBMITTED', overallScore: 4.5, combinedScore: null, combinedBreakdown: null, templateSnapshot: snapshot }, 'STANDARD'), null);
  });
});
