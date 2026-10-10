import { api } from './api';

/**
 * The rating methods the DATABASE actually stores (`enum EvaluationRatingMethod`
 * in schema.prisma). Only these two values may ever be sent to the API.
 *
 * The UI previously offered 'LIKERT_5' | 'SATISFACTION_4' | 'DESCRIPTIVE' as if
 * they were backend enum values; saving any of them was rejected by Prisma, so
 * three of the four advertised methods could not be used at all.
 */
export type EvaluationRatingMethod = 'NUMERIC' | 'LABELED';

/**
 * What HR picks in the template builder. Everything except NUMERIC is a *preset*
 * over the canonical LABELED method — the preset's scale is carried in the
 * template's `scoreLabels` JSON, which the backend already persists and returns.
 */
export type RatingPresetId = 'NUMERIC' | 'LIKERT_5' | 'SATISFACTION_4' | 'DESCRIPTIVE';

export interface RatingScaleOption {
  value: string;
  label: string;
  /** The number recorded for this choice (labelled numeric scales). */
  score?: number;
  /** The code printed on Hospicio's form (Forms 1–4: U, F, G, VG, E). */
  code?: string;
}

/**
 * The labels a 5-point scale can carry — both exactly as printed on Hospicio de
 * San Jose's official evaluation forms. Numbers 1–5 are recorded with them, so
 * the evaluation has a score.
 */
export type RatingLabelSetId = 'HSJ_EPR' | 'HSJ_SIMPLIFIED';

export const RATING_LABEL_SETS: Record<RatingLabelSetId, { id: RatingLabelSetId; title: string; options: RatingScaleOption[] }> = {
  HSJ_EPR: {
    id: 'HSJ_EPR',
    title: 'Hospicio Eval Forms 1–4',
    options: [
      { value: '1', score: 1, code: 'U', label: 'Unsatisfactory' },
      { value: '2', score: 2, code: 'F', label: 'Fair' },
      { value: '3', score: 3, code: 'G', label: 'Good' },
      { value: '4', score: 4, code: 'VG', label: 'Very Good' },
      { value: '5', score: 5, code: 'E', label: 'Excellent' },
    ],
  },
  HSJ_SIMPLIFIED: {
    id: 'HSJ_SIMPLIFIED',
    title: 'Hospicio Simplified Evaluation (Coordinators, Supervisors, Heads)',
    options: [
      { value: '1', score: 1, label: 'Unsatisfactory' },
      { value: '2', score: 2, label: 'Improvement Needed' },
      { value: '3', score: 3, label: 'Satisfactory' },
      { value: '4', score: 4, label: 'Very Satisfactory' },
      { value: '5', score: 5, label: 'Exceptional' },
    ],
  },
};

export interface RatingPresetDefinition {
  id: RatingPresetId;
  title: string;
  desc: string;
  /** The canonical value persisted in `EvaluationTemplate.ratingMethod`. */
  ratingMethod: EvaluationRatingMethod;
  /** Persisted in `EvaluationTemplate.scoreLabels`; empty for free narrative. */
  options: RatingScaleOption[];
}

export const RATING_PRESETS: Record<RatingPresetId, RatingPresetDefinition> = {
  NUMERIC: {
    id: 'NUMERIC',
    title: 'Numeric Scale',
    desc: 'Numerical ratings (e.g. 1 to 5, 1 to 10) with custom min and max scores.',
    ratingMethod: 'NUMERIC',
    options: [],
  },
  LIKERT_5: {
    id: 'LIKERT_5',
    title: '5-Point Scale',
    desc: 'Five labelled levels, recorded as 1 to 5.',
    // New 5-point templates are scored (1–5) with Hospicio's printed labels.
    // Templates saved before keep the labels and method they were saved with.
    ratingMethod: 'NUMERIC',
    options: RATING_LABEL_SETS.HSJ_EPR.options,
  },
  SATISFACTION_4: {
    id: 'SATISFACTION_4',
    title: '4-Point Satisfaction',
    desc: 'Satisfaction scale (Highly Satisfactory, Satisfactory, Fair, Poor), counted 4 to 1.',
    ratingMethod: 'LABELED',
    // Evaluators pick the label; the value is what the score is calculated from.
    options: [
      { value: 'HIGHLY_SATISFACTORY', label: 'Highly Satisfactory', score: 4 },
      { value: 'SATISFACTORY', label: 'Satisfactory', score: 3 },
      { value: 'FAIR', label: 'Fair', score: 2 },
      { value: 'POOR', label: 'Poor', score: 1 },
    ],
  },
  DESCRIPTIVE: {
    id: 'DESCRIPTIVE',
    title: 'Written / Descriptive',
    desc: 'Qualitative narrative comments without numerical scoring.',
    ratingMethod: 'LABELED',
    options: [],
  },
};

/** The JSON shape stored in `EvaluationTemplate.scoreLabels`. */
export interface TemplateScoreLabels {
  presetId: RatingPresetId;
  options: RatingScaleOption[];
}

/**
 * Recovers which preset a stored template was built from, so the builder can
 * re-select the right card and lists can show the right label. Falls back to the
 * canonical method when a template predates presets.
 */
export function resolveRatingPreset(template: {
  ratingMethod?: EvaluationRatingMethod | string | null;
  scoreLabels?: unknown;
}): RatingPresetDefinition {
  const labels = template.scoreLabels as TemplateScoreLabels | null | undefined;
  const presetId = labels?.presetId;
  if (presetId && RATING_PRESETS[presetId]) return RATING_PRESETS[presetId];
  return template.ratingMethod === 'LABELED'
    ? RATING_PRESETS.LIKERT_5
    : RATING_PRESETS.NUMERIC;
}

/**
 * The answer choices a template (or an assignment's frozen copy) offers, from
 * its ACTUAL configuration: a labelled scale's own labels, the numbers of a
 * plain numeric range, or nothing for written answers.
 */
export function scaleChoicesOf(t: {
  ratingMethod?: EvaluationRatingMethod | string | null;
  scoreLabels?: any;
  minScore?: number | null;
  maxScore?: number | null;
} | null | undefined): { kind: 'LABELED_NUMERIC' | 'NUMERIC' | 'LABELED' | 'WRITTEN'; options: RatingScaleOption[] } {
  if (!t) return { kind: 'WRITTEN', options: [] };
  const stored: RatingScaleOption[] = Array.isArray(t.scoreLabels?.options) ? t.scoreLabels.options : [];
  if (t.ratingMethod === 'NUMERIC') {
    if (stored.some((o) => o.score !== undefined && o.score !== null)) {
      return { kind: 'LABELED_NUMERIC', options: [...stored].sort((a, b) => Number(a.score) - Number(b.score)) };
    }
    const min = Number(t.minScore ?? 1);
    const max = Number(t.maxScore ?? 5);
    const options = max - min <= 10 ? Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: String(min + i), score: min + i })) : [];
    return { kind: 'NUMERIC', options };
  }
  if (t.scoreLabels?.presetId === 'DESCRIPTIVE' || !stored.length) return { kind: 'WRITTEN', options: [] };
  return { kind: 'LABELED', options: stored };
}

/**
 * Whether a template produces a numeric score: a numeric scale, or labels that
 * each carry a value. Written / descriptive templates do not — they can be used
 * in a Standard Evaluation only (the API applies the same rule).
 */
export function isScoredTemplate(t: { ratingMethod?: EvaluationRatingMethod | string | null; scoreLabels?: any } | null | undefined): boolean {
  if (!t) return false;
  if (t.ratingMethod === 'NUMERIC') return true;
  const options: RatingScaleOption[] = Array.isArray(t.scoreLabels?.options) ? t.scoreLabels.options : [];
  return options.length > 0 && options.every((o) => o.score !== undefined && o.score !== null && Number.isFinite(Number(o.score)));
}

export type EvaluationCycleStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export type EvaluationAssignmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'FINALIZED';

export type RequirementScopeType =
  | 'ALL'
  | 'UNIT'
  | 'DEPARTMENT'
  | 'JOB_ROLE'
  | 'EMPLOYEE';

export interface EvaluationCriterion {
  id: string;
  templateId: string;
  /** The review area this statement belongs to (area templates). */
  groupId?: string | null;
  name: string;
  description?: string | null;
  displayOrder: number;
  isRatingRequired: boolean;
  isCommentRequired: boolean;
  weight?: number | null;
  isActive: boolean;
}

/** Whose rating an assignment is (the API keeps each rater's rating separate). */
export type EvaluationRaterType = 'SELF' | 'PEER' | 'HEAD';

export const RATER_TYPE_LABEL: Record<EvaluationRaterType, string> = {
  SELF: 'Self rating',
  PEER: 'Peer evaluation',
  HEAD: 'Head / supervisor / coordinator evaluation',
};

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
}

/** One employee's evaluation in a cycle, component by component (API: evaluation-workflow). */
/** The final combined self + peer + head rating (API: evaluation-weights.ts). */
export interface CombinedResult {
  rows: Array<{
    source: 'SELF' | 'PEER' | 'HEAD';
    label: string;
    evaluators: number;
    submitted: number;
    rawTotal: number | null;
    rawMax: number | null;
    average: number | null;
    weight: number;
    contribution: number | null;
  }>;
  final: number | null;
  /** The scale maximum and final ÷ maximum × 100 (e.g. 4.35 of 5 → 87). */
  maxScore?: number | null;
  finalPercent?: number | null;
  missing: string[];
  formula: string;
  /** True once HR has finalised (the frozen result); otherwise a calculation so far. */
  finalized?: boolean;
}

/**
 * How a cycle's employees are evaluated (chosen when HR creates the cycle):
 * STANDARD — the head / supervisor / coordinator evaluates;
 * WEIGHTED_MULTI_RATER — self 20% + peer 20% + head 60%.
 */
export type EvaluationMode = 'STANDARD' | 'WEIGHTED_MULTI_RATER';

export const EVALUATION_MODE_LABEL: Record<EvaluationMode, string> = {
  STANDARD: 'Standard Evaluation',
  WEIGHTED_MULTI_RATER: 'Weighted Multi-Rater Evaluation',
};

/** The official evaluation weighting, from the API (the one place it is set). */
export interface EvaluationConfig {
  officialSourceWeights: { self: number; peer: number; head: number };
  officialSourceWeightsLabel: string;
}

export interface SubjectProgress {
  employeeId: string;
  employee: any;
  templateName?: string | null;
  templateIsOfficial?: boolean;
  /** Weighted multi-rater cycles: self + peer + head. */
  combined?: CombinedResult | null;
  /** Standard cycles: the head evaluation's own overall result. */
  standardResult?: { overall: number | null; maxScore: number | null; percent: number | null; finalized: boolean } | null;
  self: { assignmentId: string; status: EvaluationAssignmentStatus; submittedAt: string | null } | null;
  peers: {
    total: number;
    submitted: number;
    items: Array<{ assignmentId: string; status: EvaluationAssignmentStatus; submittedAt: string | null; evaluator: PersonRef | null }>;
  };
  head: {
    assignmentId: string;
    status: EvaluationAssignmentStatus;
    submittedAt: string | null;
    evaluator: PersonRef | null;
    overallScore: number | null;
    overallRating: string | null;
  } | null;
  discussion: { completed: boolean; date: string | null; recordedAt: string | null };
  finalization: { finalized: boolean; finalizedAt: string | null; isEmployeeVisible: boolean };
  stage: 'NOT_STARTED' | 'IN_PROGRESS' | 'DISCUSSION_PENDING' | 'READY_TO_FINALIZE' | 'FINALIZED';
  blockers: string[];
}

export interface EvaluationCandidate {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { id: string; title: string } | null;
  unit?: { id: string; name: string } | null;
  /** What the API would accept this person as, for this employee. */
  canBeHead: boolean;
  canBePeer: boolean;
}

/** Someone who may be a new cycle's designated evaluator (never HR / full-access). */
export interface DesignatedEvaluatorOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string } | null;
  unit?: { name: string } | null;
}

/** A review area / performance factor and its weight (area templates). */
export interface EvaluationCriterionGroup {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  weight?: number | null;
}

export type EvaluationScoringMethod = 'CRITERIA' | 'AREA_WEIGHTED' | 'AREA_AVERAGE';

/** A form's written sections and wording (official forms carry Hospicio's own). */
export interface EvaluationFormLayout {
  instructions?: string[];
  appraisalLabel?: string | null;
  appraisalTypes?: string[];
  overallLabel?: string | null;
  generalCommentsLabel?: string | null;
  goalsLabel?: string | null;
  goalsPrompt?: string | null;
  acknowledgment?: string | null;
  itemComments?: boolean;
  itemMarker?: ')' | '.';
  /** HRISENSE_EQUAL: equal split set by HRISense (the paper form prints none). FORM_FORMULA: the form's own rule. */
  weightsSource?: 'HRISENSE_EQUAL' | 'FORM_FORMULA' | 'HR';
  appliesTo?: string[];
  formCode?: string;
  copiedFrom?: string | null;
}

export interface EvaluationTemplate {
  id: string;
  /** Job roles evaluated with this template (a role has at most one). */
  jobRoles?: Array<{ jobRoleId: string; jobRole: { id: string; title: string; code?: string; unitId?: string | null } }>;
  /** Hospicio de San Jose's official forms are read-only; HR duplicates them to customise. */
  isOfficial?: boolean;
  officialCode?: string | null;
  sourceDocument?: string | null;
  scoringMethod?: EvaluationScoringMethod;
  formLayout?: EvaluationFormLayout | null;
  groups?: EvaluationCriterionGroup[];
  name: string;
  description?: string | null;
  ratingMethod: EvaluationRatingMethod;
  minScore?: number | null;
  maxScore?: number | null;
  scoreLabels?: any | null;
  useWeighting: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  criteria?: EvaluationCriterion[];
  _count?: {
    cycles: number;
    assignments: number;
  };
}

export interface EvaluationCycleScope {
  id: string;
  cycleId: string;
  scopeType: RequirementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
  targetUnit?: { id: string; name: string } | null;
  targetDepartment?: { id: string; name: string } | null;
  targetJobRole?: { id: string; title: string } | null;
  targetEmployee?: { id: string; firstName: string; lastName: string } | null;
}

export interface EvaluationCycle {
  id: string;
  name: string;
  description?: string | null;
  templateId: string;
  template?: {
    id: string;
    name: string;
    ratingMethod: EvaluationRatingMethod;
    useWeighting: boolean;
    isOfficial?: boolean;
    maxScore?: number | null;
    formLayout?: EvaluationFormLayout | null;
    criteria?: EvaluationCriterion[];
  };
  startDate: string;
  dueDate: string;
  status: EvaluationCycleStatus;
  /** The paper form's "Nature of Appraisal" / "Type of Evaluation". */
  appraisalType?: string | null;
  /** Fixed when the cycle is created. */
  evaluationMode: EvaluationMode;
  /** Weighted cycles: the percentages the cycle runs with (20 / 20 / 60). */
  selfWeight?: number | null;
  peerWeight?: number | null;
  headWeight?: number | null;
  evaluatorAssignmentMethod?: 'ONE_EVALUATOR' | 'SUPERVISOR' | 'MANUAL';
  defaultEvaluatorId?: string | null;
  defaultEvaluator?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null;
  scopes?: EvaluationCycleScope[];
  assignments?: Array<EvaluationAssignment>;
  /** Per employee evaluated (cycle detail only). */
  subjects?: SubjectProgress[];
  /** Counted per employee evaluated, not per rater. */
  metrics?: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    finalized: number;
    discussionPending?: number;
    readyToFinalize?: number;
    selfSubmitted?: number;
    selfTotal?: number;
    peerSubmitted?: number;
    peerTotal?: number;
    headUnassigned?: number;
  };
  _count?: {
    assignments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationResponse {
  id: string;
  assignmentId: string;
  criterionId: string;
  criterionName?: string | null;
  criterionDescription?: string | null;
  criterionWeight?: number | null;
  ratingNumeric?: number | null;
  ratingLabel?: string | null;
  rating?: number | null;
  comment?: string | null;
  criterion?: EvaluationCriterion;
}

export interface EvaluationAssignment {
  id: string;
  cycleId: string;
  cycle?: {
    id: string;
    name: string;
    status: EvaluationCycleStatus;
    startDate: string;
    dueDate: string;
    appraisalType?: string | null;
    evaluationMode?: EvaluationMode;
    selfWeight?: number | null;
    peerWeight?: number | null;
    headWeight?: number | null;
  };
  templateId: string;
  template?: {
    id: string;
    name: string;
    ratingMethod: EvaluationRatingMethod;
    minScore?: number | null;
    maxScore?: number | null;
    scoreLabels?: any | null;
    useWeighting?: boolean;
    scoringMethod?: EvaluationScoringMethod;
    isOfficial?: boolean;
    formLayout?: EvaluationFormLayout | null;
    groups?: EvaluationCriterionGroup[];
    criteria?: EvaluationCriterion[];
  };
  templateSnapshot?: any;
  employeeId: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobRole?: { id: string; title: string } | null;
    unit?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
  };
  evaluatorId?: string | null;
  evaluator?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobRole?: { id: string; title: string } | null;
  } | null;
  status: EvaluationAssignmentStatus;
  dueDate: string;
  submittedAt?: string | null;
  finalizedAt?: string | null;
  overallScore?: number | null;
  /** How the overall score was reached (API: evaluation-score.ts). */
  scoreBreakdown?: {
    method: 'WEIGHTED' | 'AVERAGE' | 'AREA_WEIGHTED' | 'AREA_AVERAGE' | 'NOT_NUMERIC';
    rows: Array<{ criterionId: string; name: string; rating: number | null; weight: number | null; contribution: number | null }>;
    areas?: Array<{ groupId: string; name: string; itemCount: number; ratedCount: number; total: number; average: number | null; weight: number | null; contribution: number | null }>;
    totalWeight: number | null;
    overallScore: number | null;
    rawTotal?: number | null;
    rawMax?: number | null;
    ratedCount?: number;
    itemCount?: number;
    /** Overall ÷ scale maximum × 100. */
    overallPercent?: number | null;
    formula: string;
  } | null;
  /** The cycle's evaluation type (getAssignment). */
  evaluationMode?: EvaluationMode;
  /** Final weighted self + peer + head rating (weighted multi-rater cycles). */
  combined?: CombinedResult | null;
  combinedScore?: number | null;
  combinedBreakdown?: CombinedResult | null;
  overallRating?: string | null;
  evaluatorSummary?: string | null;
  developmentRecommendations?: string | null;
  isEmployeeVisible: boolean;
  responses?: EvaluationResponse[];
  /** SELF, PEER or HEAD (head / supervisor / coordinator). */
  raterType?: EvaluationRaterType;
  raterLabel?: string;
  /** Discussion with the employee (HEAD assignment). */
  discussionCompletedAt?: string | null;
  discussionDate?: string | null;
  discussionNotes?: string | null;
  /** What the caller may do — the API enforces the same rules. */
  canRate?: boolean;
  canAmend?: boolean;
  canRecordDiscussion?: boolean;
  canFinalize?: boolean;
  /** HR: why this HR user may not finalise it (their own, or one they rated). */
  finalizeBlockedReason?: string | null;
  /** HR only: the employee's whole evaluation in the cycle. */
  workflow?: SubjectProgress | null;
  components?: Array<{
    assignmentId: string;
    raterType: EvaluationRaterType;
    raterLabel: string;
    evaluator: PersonRef | null;
    status: EvaluationAssignmentStatus;
    submittedAt: string | null;
    overallScore: number | null;
  }>;
  isMine?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListTemplatesFilters {
  isActive?: boolean;
  search?: string;
}

export interface ListCyclesFilters {
  status?: EvaluationCycleStatus;
  search?: string;
}

export interface ListAssignmentsFilters {
  cycleId?: string;
  evaluatorId?: string;
  employeeId?: string;
  status?: EvaluationAssignmentStatus;
  raterType?: EvaluationRaterType;
  search?: string;
  /** Only what the caller has to complete (self, peer or head), whatever their tier. */
  mine?: boolean;
}

export interface CriterionGroupInputDto {
  name: string;
  description?: string | null;
  weight?: number | null;
  items: CriterionInputDto[];
}

export interface CriterionInputDto {
  id?: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  isRatingRequired?: boolean;
  isCommentRequired?: boolean;
  weight?: number | null;
}

export interface CreateTemplateDto {
  name: string;
  description?: string | null;
  ratingMethod?: EvaluationRatingMethod;
  minScore?: number;
  maxScore?: number;
  scoreLabels?: any;
  useWeighting?: boolean;
  jobRoleIds?: string[];
  criteria?: CriterionInputDto[];
  /** Review areas with statements, instead of flat criteria. */
  groups?: CriterionGroupInputDto[];
  formLayout?: EvaluationFormLayout | null;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string | null;
  ratingMethod?: EvaluationRatingMethod;
  minScore?: number;
  maxScore?: number;
  scoreLabels?: any;
  useWeighting?: boolean;
  isActive?: boolean;
  jobRoleIds?: string[];
  criteria?: CriterionInputDto[];
  groups?: CriterionGroupInputDto[];
  formLayout?: EvaluationFormLayout | null;
}

export interface CreateCycleScopeDto {
  scopeType: RequirementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
}

export interface CreateCycleDto {
  name: string;
  description?: string | null;
  templateId: string;
  startDate: string;
  dueDate: string;
  evaluatorAssignmentMethod: 'ONE_EVALUATOR' | 'SUPERVISOR' | 'MANUAL';
  defaultEvaluatorId?: string | null;
  scopes?: CreateCycleScopeDto[];
  individualAssignments?: Array<{
    employeeId: string;
    evaluatorId: string;
  }>;
  appraisalType?: string | null;
  /** Required: Standard or Weighted Multi-Rater (20 / 20 / 60, set by the API). */
  evaluationMode: EvaluationMode;
}

/** Who a cycle would cover and with which template (API: previewCycle). */
export interface CyclePreview {
  total: number;
  byTemplate: Array<{ templateId: string; name: string; isOfficial: boolean; count: number }>;
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobRole?: { id: string; title: string } | null;
    template: { id: string; name: string; isOfficial: boolean; source: 'JOB_ROLE' | 'CYCLE' };
  }>;
}

export interface EvaluationResponseInput {
  criterionId: string;
  criterionName?: string;
  criterionDescription?: string | null;
  criterionWeight?: number | null;
  ratingNumeric?: number | null;
  ratingLabel?: string | null;
  comment?: string | null;
}

export interface SaveDraftDto {
  responses?: EvaluationResponseInput[];
  evaluatorSummary?: string | null;
  developmentRecommendations?: string | null;
}

export interface SubmitEvaluationDto {
  responses: EvaluationResponseInput[];
  evaluatorSummary?: string | null;
  developmentRecommendations?: string | null;
}

export interface FinalizeEvaluationDto {
  isEmployeeVisible?: boolean;
}

export const EvaluationService = {
  // ── Templates ─────────────────────────────────────────────────────────────
  async listTemplates(filters?: ListTemplatesFilters): Promise<EvaluationTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);

    const res = await api.get<{ success: boolean; data: EvaluationTemplate[] }>(
      `/evaluations/templates?${params.toString()}`
    );
    return res.data.data;
  },

  async getTemplate(id: string): Promise<EvaluationTemplate> {
    const res = await api.get<{ success: boolean; data: EvaluationTemplate }>(
      `/evaluations/templates/${id}`
    );
    return res.data.data;
  },

  async createTemplate(data: CreateTemplateDto): Promise<EvaluationTemplate> {
    const res = await api.post<{ success: boolean; data: EvaluationTemplate; message: string }>(
      '/evaluations/templates',
      data
    );
    return res.data.data;
  },

  async updateTemplate(id: string, data: UpdateTemplateDto): Promise<EvaluationTemplate> {
    const res = await api.put<{ success: boolean; data: EvaluationTemplate; message: string }>(
      `/evaluations/templates/${id}`,
      data
    );
    return res.data.data;
  },

  /** Copies a template (official or custom) into a new custom one HR can edit. */
  async duplicateTemplate(id: string, name?: string): Promise<EvaluationTemplate> {
    const res = await api.post<{ success: boolean; data: EvaluationTemplate }>(`/evaluations/templates/${id}/duplicate`, name ? { name } : {});
    return res.data.data;
  },

  /** Which job roles use a template (allowed on official templates too). */
  async setTemplateJobRoles(id: string, jobRoleIds: string[]): Promise<EvaluationTemplate> {
    const res = await api.put<{ success: boolean; data: EvaluationTemplate }>(`/evaluations/templates/${id}/job-roles`, { jobRoleIds });
    return res.data.data;
  },

  async deactivateTemplate(id: string): Promise<EvaluationTemplate> {
    const res = await api.post<{ success: boolean; data: EvaluationTemplate; message: string }>(
      `/evaluations/templates/${id}/deactivate`
    );
    return res.data.data;
  },

  // ── Cycles ────────────────────────────────────────────────────────────────
  async listCycles(filters?: ListCyclesFilters): Promise<EvaluationCycle[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const res = await api.get<{ success: boolean; data: EvaluationCycle[] }>(
      `/evaluations/cycles?${params.toString()}`
    );
    return res.data.data;
  },

  async getCycle(id: string): Promise<EvaluationCycle> {
    const res = await api.get<{ success: boolean; data: EvaluationCycle }>(
      `/evaluations/cycles/${id}`
    );
    return res.data.data;
  },

  async createCycle(data: CreateCycleDto): Promise<EvaluationCycle> {
    const res = await api.post<{ success: boolean; data: EvaluationCycle; message: string }>(
      '/evaluations/cycles',
      data
    );
    return res.data.data;
  },

  async getConfig(): Promise<EvaluationConfig> {
    const res = await api.get<{ success: boolean; data: EvaluationConfig }>('/evaluations/config');
    return res.data.data;
  },

  async previewCycle(data: { templateId: string; scopes?: CreateCycleScopeDto[] }): Promise<CyclePreview> {
    const res = await api.post<{ success: boolean; data: CyclePreview }>('/evaluations/cycles/preview', data);
    return res.data.data;
  },

  async listDesignatedEvaluators(): Promise<DesignatedEvaluatorOption[]> {
    const res = await api.get<{ success: boolean; data: DesignatedEvaluatorOption[] }>('/evaluations/designated-evaluators');
    return res.data.data;
  },

  async closeCycle(id: string): Promise<EvaluationCycle> {
    const res = await api.post<{ success: boolean; data: EvaluationCycle; message: string }>(
      `/evaluations/cycles/${id}/close`
    );
    return res.data.data;
  },

  // ── Assignments / Evaluator Workspace ─────────────────────────────────────
  async listAssignments(filters?: ListAssignmentsFilters): Promise<EvaluationAssignment[]> {
    const params = new URLSearchParams();
    if (filters?.cycleId) params.append('cycleId', filters.cycleId);
    if (filters?.evaluatorId) params.append('evaluatorId', filters.evaluatorId);
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.raterType) params.append('raterType', filters.raterType);
    if (filters?.mine) params.append('mine', 'true');
    if (filters?.search) params.append('search', filters.search);

    const res = await api.get<{ success: boolean; data: EvaluationAssignment[] }>(
      `/evaluations/assignments?${params.toString()}`
    );
    return res.data.data;
  },

  async getAssignment(id: string): Promise<EvaluationAssignment> {
    const res = await api.get<{ success: boolean; data: EvaluationAssignment }>(
      `/evaluations/assignments/${id}`
    );
    return res.data.data;
  },

  async saveDraft(id: string, data: SaveDraftDto): Promise<EvaluationAssignment> {
    const res = await api.post<{ success: boolean; data: EvaluationAssignment; message: string }>(
      `/evaluations/assignments/${id}/draft`,
      data
    );
    return res.data.data;
  },

  async submitEvaluation(id: string, data: SubmitEvaluationDto): Promise<EvaluationAssignment> {
    const res = await api.post<{ success: boolean; data: EvaluationAssignment; message: string }>(
      `/evaluations/assignments/${id}/submit`,
      data
    );
    return res.data.data;
  },

  async finalizeEvaluation(id: string, data?: FinalizeEvaluationDto): Promise<EvaluationAssignment> {
    const res = await api.post<{ success: boolean; data: EvaluationAssignment; message: string }>(
      `/evaluations/assignments/${id}/finalize`,
      data || {}
    );
    return res.data.data;
  },

  // ── Participants (HR) and discussion (head evaluator) ────────────────────
  async listEvaluatorCandidates(cycleId: string, employeeId: string): Promise<EvaluationCandidate[]> {
    const res = await api.get<{ success: boolean; data: EvaluationCandidate[] }>(
      `/evaluations/cycles/${cycleId}/employees/${employeeId}/candidates`
    );
    return res.data.data;
  },

  async setHeadEvaluator(cycleId: string, employeeId: string, evaluatorId: string): Promise<EvaluationCycle> {
    const res = await api.put<{ success: boolean; data: EvaluationCycle }>(
      `/evaluations/cycles/${cycleId}/employees/${employeeId}/head`,
      { evaluatorId }
    );
    return res.data.data;
  },

  async addPeers(cycleId: string, employeeId: string, evaluatorIds: string[]): Promise<EvaluationCycle> {
    const res = await api.post<{ success: boolean; data: EvaluationCycle }>(
      `/evaluations/cycles/${cycleId}/employees/${employeeId}/peers`,
      { evaluatorIds }
    );
    return res.data.data;
  },

  async removePeer(assignmentId: string): Promise<EvaluationCycle> {
    const res = await api.delete<{ success: boolean; data: EvaluationCycle }>(`/evaluations/assignments/${assignmentId}/peer`);
    return res.data.data;
  },

  async recordDiscussion(assignmentId: string, data: { discussionDate: string; notes: string }): Promise<EvaluationAssignment> {
    const res = await api.post<{ success: boolean; data: EvaluationAssignment }>(
      `/evaluations/assignments/${assignmentId}/discussion`,
      data
    );
    return res.data.data;
  },

  // ── Employee History ──────────────────────────────────────────────────────
  async listEmployeeHistory(employeeId: string): Promise<EvaluationAssignment[]> {
    const res = await api.get<{ success: boolean; data: EvaluationAssignment[] }>(
      `/evaluations/employees/${employeeId}/history`
    );
    return res.data.data;
  },

  async getEmployeeEvaluationHistory(employeeId: string): Promise<EvaluationAssignment[]> {
    return this.listEmployeeHistory(employeeId);
  },
};

export interface FormattedEvaluationResult {
  isScore: boolean;
  isDescriptive: boolean;
  isCompleted: boolean;
  isPending: boolean;
  text: string;
  score?: number;
  maxScore?: number;
  /** The weighted self 20 + peer 20 + head 60 final (finalised head row of a weighted cycle). */
  isWeightedFinal?: boolean;
}

export function formatEvaluationResult(assignment?: EvaluationAssignment | null): FormattedEvaluationResult {
  if (!assignment) {
    return { isScore: false, isDescriptive: false, isCompleted: false, isPending: true, text: '—' };
  }

  const snapshot = assignment.templateSnapshot;
  const ratingMethod: EvaluationRatingMethod =
    snapshot?.ratingMethod || assignment.template?.ratingMethod || 'NUMERIC';

  // A finalised weighted evaluation's result is the 20 / 20 / 60 final — never
  // the head / supervisor / coordinator's own score.
  if (assignment.raterType === 'HEAD' && assignment.status === 'FINALIZED' && assignment.combinedScore !== null && assignment.combinedScore !== undefined) {
    const max = assignment.combinedBreakdown?.maxScore ?? snapshot?.maxScore ?? assignment.template?.maxScore ?? undefined;
    const final = Number(assignment.combinedScore);
    return {
      isScore: true,
      isDescriptive: false,
      isCompleted: true,
      isPending: false,
      text: max ? `${final.toFixed(2)} / ${max}` : final.toFixed(2),
      score: final,
      maxScore: max ?? undefined,
      isWeightedFinal: true,
    };
  }

  // Which labelled preset produced this template. The database keeps only
  // NUMERIC / LABELED, so the preset is recovered from `scoreLabels`.
  const preset = resolveRatingPreset({
    ratingMethod,
    scoreLabels: snapshot?.scoreLabels ?? assignment.template?.scoreLabels,
  });

  if (preset.id === 'DESCRIPTIVE') {
    return {
      isScore: false,
      isDescriptive: true,
      isCompleted: assignment.status === 'FINALIZED',
      isPending: assignment.status !== 'FINALIZED',
      text: 'Qualitative Assessment',
    };
  }

  const score = assignment.overallScore;
  if (score !== null && score !== undefined && !isNaN(Number(score))) {
    const numScore = Number(score);
    let maxScore: number | undefined;

    if (preset.id === 'SATISFACTION_4') {
      maxScore = 4;
    } else if (preset.id === 'LIKERT_5') {
      maxScore = 5;
    } else if (ratingMethod === 'NUMERIC') {
      const snapMax = snapshot?.maxScore ?? assignment.template?.maxScore;
      if (snapMax !== null && snapMax !== undefined && !isNaN(Number(snapMax)) && Number(snapMax) > 0) {
        maxScore = Number(snapMax);
      }
    }

    const text = maxScore !== undefined ? `${numScore} / ${maxScore}` : `${numScore}`;
    return {
      isScore: true,
      isDescriptive: false,
      isCompleted: assignment.status === 'FINALIZED',
      isPending: false,
      text,
      score: numScore,
      maxScore,
    };
  }

  if (assignment.status === 'FINALIZED') {
    return {
      isScore: false,
      isDescriptive: false,
      isCompleted: true,
      isPending: false,
      text: 'Completed',
    };
  }

  return {
    isScore: false,
    isDescriptive: false,
    isCompleted: false,
    isPending: true,
    text: '—',
  };
}
