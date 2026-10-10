import { EvaluationAssignmentStatus, EvaluationMode, EvaluationRaterType } from '@prisma/client';
import { ratingScaleOf } from './evaluation-score';

/**
 * The Hospicio evaluation workflow, as pure functions over assignment rows.
 * A cycle runs in one of two modes, chosen when HR creates it:
 *
 *   STANDARD
 *     HR creates / distributes the evaluation
 *     → the assigned HEAD / supervisor / coordinator evaluates the employee
 *     → the head discusses it with the employee (recorded: date, notes)
 *     → HR reviews and finalises
 *
 *   WEIGHTED_MULTI_RATER  (self 20% + peer 20% + head 60%)
 *     HR creates / distributes the evaluation
 *     → the employee completes a SELF rating
 *     → selected PEER evaluators complete peer ratings
 *     → the assigned HEAD / supervisor / coordinator completes the evaluator rating
 *     → the head discusses the evaluation with the employee (recorded: date, notes)
 *     → HR reviews and finalises
 *
 * Either way the result is visible according to the visibility setting, and HR
 * administers but never rates.
 *
 * Each rater has their own assignment row, so the ratings stay separate — they
 * are never merged into one anonymous score. The HEAD row carries the
 * discussion and the finalisation for the employee's evaluation in the cycle.
 * Participants may submit in any order; only the discussion waits for the head
 * rating, and finalisation waits for every component.
 */

export const RATER_LABEL: Record<EvaluationRaterType, string> = {
  SELF: 'Self rating',
  PEER: 'Peer evaluation',
  HEAD: 'Head / supervisor / coordinator evaluation',
};

export interface WorkflowRow {
  id: string;
  employeeId: string;
  raterType: EvaluationRaterType;
  status: EvaluationAssignmentStatus;
  deletedAt?: Date | null;
  submittedAt?: Date | null;
  finalizedAt?: Date | null;
  isEmployeeVisible?: boolean;
  discussionCompletedAt?: Date | null;
  discussionDate?: Date | null;
  overallScore?: number | null;
  overallRating?: string | null;
  evaluator?: { id: string; firstName: string; lastName: string; employeeNumber?: string } | null;
  employee?: any;
}

const done = (s: EvaluationAssignmentStatus) => s === 'SUBMITTED' || s === 'FINALIZED';

/**
 * HR (and anyone else with full access, such as Sister) administers evaluations
 * and never rates employees in that capacity. Being FULL never makes someone a
 * rating source; the one thing that does is the org structure: a full-access
 * employee who is a subject's actual immediate supervisor is that employee's
 * head. Null when `evaluator` may evaluate `subject` in that role.
 *
 * `chosenBy` is the HR user picking the evaluator by hand — they may not pick
 * themselves, nor choose the evaluators of their own evaluation. It is null when
 * the org structure assigns the head (the immediate-supervisor method).
 */
export function evaluatorDenial(input: {
  role: 'HEAD' | 'PEER';
  evaluator: { id: string; permissionTier?: string | null };
  subject: { id: string; immediateSupervisorId?: string | null };
  chosenBy?: { employeeId?: string | null } | null;
}): string | null {
  const { role, evaluator, subject, chosenBy } = input;
  if (evaluator.id === subject.id) return 'The employee cannot be their own peer or head evaluator.';
  if (chosenBy?.employeeId && chosenBy.employeeId === subject.id) {
    return 'You cannot choose the evaluators for your own evaluation — another HR administrator must.';
  }
  if (chosenBy?.employeeId && chosenBy.employeeId === evaluator.id) {
    return 'HR administers the evaluation and cannot assign themselves as an evaluator.';
  }
  if (evaluator.permissionTier === 'FULL') {
    if (role === 'PEER') return 'HR and other full-access administrators do not rate employees, so they cannot be peer evaluators.';
    if (!subject.immediateSupervisorId || subject.immediateSupervisorId !== evaluator.id) {
      return 'HR and other full-access administrators do not rate employees. They can be the head evaluator only of their own direct reports.';
    }
  }
  return null;
}

/**
 * Who may enter ratings: only the assigned evaluator. HR administers the
 * evaluation — creates the cycle, assigns evaluators, monitors and finalises —
 * but never rates on someone's behalf. A full-access user rates only their own
 * self rating, or as the head of their own direct report. Null when the actor
 * may rate.
 */
export function rateDenial(
  assignment: {
    evaluatorId: string;
    raterType: EvaluationRaterType;
    status: EvaluationAssignmentStatus;
    discussionCompletedAt: Date | null;
    /** The evaluated employee's immediate supervisor. */
    subjectSupervisorId?: string | null;
  },
  actor: { employeeId?: string | null; permissionTier: string }
): { status: 403 | 400; message: string } | null {
  const isEvaluator = Boolean(actor.employeeId && assignment.evaluatorId === actor.employeeId);
  if (!isEvaluator) {
    return {
      status: 403,
      message: actor.permissionTier === 'FULL'
        ? 'HR administers evaluations but does not rate them. Only the assigned evaluator can enter ratings.'
        : 'Access forbidden: only the assigned evaluator can enter these ratings.',
    };
  }
  if (
    actor.permissionTier === 'FULL' &&
    assignment.raterType !== 'SELF' &&
    !(assignment.raterType === 'HEAD' && assignment.subjectSupervisorId && assignment.subjectSupervisorId === actor.employeeId)
  ) {
    return {
      status: 403,
      message: 'HR administers evaluations and does not rate employees. A full-access user enters a head evaluation only for their own direct report.',
    };
  }
  if (assignment.status === 'FINALIZED') return { status: 400, message: 'Cannot edit an evaluation that has already been finalized' };
  if (assignment.raterType === 'HEAD' && assignment.discussionCompletedAt) {
    return { status: 400, message: 'The discussion with the employee has been recorded, so the head evaluation can no longer be changed.' };
  }
  return null;
}

export interface SubjectProgress {
  employeeId: string;
  employee: any;
  self: { assignmentId: string; status: EvaluationAssignmentStatus; submittedAt: Date | null } | null;
  peers: {
    total: number;
    submitted: number;
    items: Array<{ assignmentId: string; status: EvaluationAssignmentStatus; submittedAt: Date | null; evaluator: WorkflowRow['evaluator'] }>;
  };
  head: {
    assignmentId: string;
    status: EvaluationAssignmentStatus;
    submittedAt: Date | null;
    evaluator: WorkflowRow['evaluator'];
    overallScore: number | null;
    overallRating: string | null;
  } | null;
  discussion: { completed: boolean; date: Date | null; recordedAt: Date | null };
  finalization: { finalized: boolean; finalizedAt: Date | null; isEmployeeVisible: boolean };
  /** Overall stage of this employee's evaluation. */
  stage: 'NOT_STARTED' | 'IN_PROGRESS' | 'DISCUSSION_PENDING' | 'READY_TO_FINALIZE' | 'FINALIZED';
  /** What still stands between this evaluation and HR finalisation. */
  blockers: string[];
}

export interface ProgressOptions {
  /** STANDARD (default): only the head evaluation counts. WEIGHTED_MULTI_RATER: self + peers + head. */
  mode?: EvaluationMode;
  /**
   * Weighted cycles whose peer weight is above 0: at least one peer must be
   * assigned and every assigned peer must submit before HR can finalise.
   */
  requirePeer?: boolean;
}

/** One employee's components, from all of their (non-deleted) rows in a cycle. */
export function subjectProgress(rows: WorkflowRow[], options: ProgressOptions = {}): SubjectProgress {
  const weighted = options.mode === 'WEIGHTED_MULTI_RATER';
  const live = rows.filter((r) => !r.deletedAt);
  // A standard evaluation is the head's alone: any self / peer rows an older
  // cycle may hold stay in the record but are not part of it.
  const self = weighted ? live.find((r) => r.raterType === 'SELF') ?? null : null;
  const peers = weighted ? live.filter((r) => r.raterType === 'PEER') : [];
  const head = live.find((r) => r.raterType === 'HEAD') ?? null;

  const blockers: string[] = [];
  if (weighted && !self) blockers.push('No self rating in this evaluation');
  if (self && !done(self.status)) blockers.push('Self rating not submitted');
  const peersPending = peers.filter((p) => !done(p.status)).length;
  if (weighted && options.requirePeer && peers.length === 0) blockers.push('No peer evaluator assigned (the peer rating is part of the final rating)');
  if (peersPending) blockers.push(`${peersPending} of ${peers.length} peer evaluation${peers.length === 1 ? '' : 's'} not submitted`);
  if (!head) blockers.push('No head / supervisor / coordinator evaluator assigned');
  else if (!done(head.status)) blockers.push('Head / supervisor / coordinator evaluation not submitted');
  else if (!head.discussionCompletedAt && head.status !== 'FINALIZED') blockers.push('Discussion with the employee not recorded');

  const finalized = head?.status === 'FINALIZED';
  const anyStarted = live.some((r) => r.status !== 'NOT_STARTED');
  const stage: SubjectProgress['stage'] = finalized
    ? 'FINALIZED'
    : blockers.length === 0
      ? 'READY_TO_FINALIZE'
      : head && done(head.status) && !head.discussionCompletedAt
        ? 'DISCUSSION_PENDING'
        : anyStarted ? 'IN_PROGRESS' : 'NOT_STARTED';

  const anyRow = live[0] ?? rows[0];
  return {
    employeeId: anyRow?.employeeId,
    employee: anyRow?.employee ?? null,
    self: self ? { assignmentId: self.id, status: self.status, submittedAt: self.submittedAt ?? null } : null,
    peers: {
      total: peers.length,
      submitted: peers.filter((p) => done(p.status)).length,
      items: peers.map((p) => ({ assignmentId: p.id, status: p.status, submittedAt: p.submittedAt ?? null, evaluator: p.evaluator ?? null })),
    },
    head: head
      ? {
          assignmentId: head.id, status: head.status, submittedAt: head.submittedAt ?? null, evaluator: head.evaluator ?? null,
          overallScore: head.overallScore ?? null, overallRating: head.overallRating ?? null,
        }
      : null,
    discussion: { completed: Boolean(head?.discussionCompletedAt), date: head?.discussionDate ?? null, recordedAt: head?.discussionCompletedAt ?? null },
    finalization: { finalized, finalizedAt: head?.finalizedAt ?? null, isEmployeeVisible: Boolean(head?.isEmployeeVisible) },
    stage,
    blockers: finalized ? [] : blockers,
  };
}

/**
 * HR finalises, but not an evaluation they are part of: their own (as the
 * employee evaluated) or one they rated (as head or peer). Another HR
 * administrator — or Sister — finalises it. Null when the actor may finalise.
 */
export function finalizeDenial(
  rows: Array<{ employeeId: string; evaluatorId: string; raterType: EvaluationRaterType; deletedAt?: Date | null }>,
  actor: { employeeId?: string | null }
): string | null {
  const me = actor.employeeId;
  if (!me) return null;
  const live = rows.filter((r) => !r.deletedAt);
  if (live.some((r) => r.employeeId === me)) return 'This is your own evaluation, so another HR administrator must finalize it.';
  if (live.some((r) => r.raterType !== 'SELF' && r.evaluatorId === me)) {
    return 'You are one of the evaluators of this evaluation, so another HR administrator must finalize it.';
  }
  return null;
}

export const EVALUATION_MODE_LABEL: Record<EvaluationMode, string> = {
  STANDARD: 'Standard Evaluation (head / supervisor / coordinator)',
  WEIGHTED_MULTI_RATER: 'Weighted Multi-Rater Evaluation (self 20% + peer 20% + head 60%)',
};

/**
 * An employee's final evaluation result, read from their finalised HEAD row —
 * the one figure to report. Standard: the head evaluation's overall score.
 * Weighted multi-rater: the weighted self + peer + head result frozen at
 * finalisation, never the head's own score. Null until HR finalises.
 */
export function finalResultOf(
  head: { status: EvaluationAssignmentStatus; overallScore: number | null; combinedScore: number | null; combinedBreakdown: any; templateSnapshot: any },
  mode: EvaluationMode
) {
  if (head.status !== 'FINALIZED') return null;
  const weighted = mode === 'WEIGHTED_MULTI_RATER';
  const score = weighted ? head.combinedScore : head.overallScore;
  const max = (weighted ? head.combinedBreakdown?.maxScore : null) ?? ratingScaleOf(head.templateSnapshot).max;
  const percent = score !== null && score !== undefined && max ? Number(((score / max) * 100).toFixed(2)) : null;
  return {
    evaluationType: EVALUATION_MODE_LABEL[mode],
    finalScore: score ?? null,
    maxScore: score !== null && score !== undefined ? max : null,
    finalPercent: percent,
    text:
      score === null || score === undefined
        ? weighted ? 'No weighted result was recorded' : 'No numeric score (the form records written answers)'
        : `${score.toFixed(2)}${max ? ` / ${max}` : ''}${percent !== null ? ` (${percent}%)` : ''}`,
    // Weighted: how the final was reached (no peer is named).
    calculation: weighted ? head.combinedBreakdown?.formula ?? null : null,
  };
}

/** Every employee in a cycle, grouped. */
export function cycleProgress(rows: WorkflowRow[], options: ProgressOptions = {}): SubjectProgress[] {
  const byEmployee = new Map<string, WorkflowRow[]>();
  for (const r of rows) byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  return [...byEmployee.values()].map((r) => subjectProgress(r, options));
}

/**
 * Cycle metrics counted per EMPLOYEE evaluated (not per rater row), so the
 * totals mean what they say: "12 employees, 4 finalised".
 */
export function cycleMetrics(subjects: SubjectProgress[]) {
  const count = (stage: SubjectProgress['stage']) => subjects.filter((s) => s.stage === stage).length;
  return {
    total: subjects.length,
    notStarted: count('NOT_STARTED'),
    inProgress: count('IN_PROGRESS'),
    discussionPending: count('DISCUSSION_PENDING'),
    // "Submitted" = the head's evaluation is in and HR has not finalised yet.
    submitted: count('DISCUSSION_PENDING') + count('READY_TO_FINALIZE'),
    readyToFinalize: count('READY_TO_FINALIZE'),
    finalized: count('FINALIZED'),
    selfSubmitted: subjects.filter((s) => s.self && done(s.self.status)).length,
    selfTotal: subjects.filter((s) => s.self).length,
    peerSubmitted: subjects.reduce((n, s) => n + s.peers.submitted, 0),
    peerTotal: subjects.reduce((n, s) => n + s.peers.total, 0),
    headUnassigned: subjects.filter((s) => !s.head).length,
  };
}
