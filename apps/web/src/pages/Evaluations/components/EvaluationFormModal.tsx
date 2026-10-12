import { BreakdownButton, MetricBreakdownDialog, type MetricBreakdownSpec } from '@/components/shared/MetricBreakdown';
import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Send,
  Lock,
  UserCheck,
  Calendar,
  Layers,
  Sparkles,
  FileText,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  EvaluationService,
  EvaluationAssignment,
  EvaluationResponseInput,
  EvaluationRatingMethod,
  resolveRatingPreset,
  EvaluationAssignmentStatus,
  formatEvaluationResult,
  scaleChoicesOf,
  type EvaluationCriterionGroup,
  type EvaluationFormLayout,
  type CombinedResult,
} from '@/services/evaluation.service';
import { TemplateOriginBadge } from './EvaluationTemplateViewer';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error-handler.util';

interface EvaluationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId?: string | null;
  onSuccess?: () => void;
  readOnlyForce?: boolean;
}

interface CriterionDisplay {
  id: string;
  groupId?: string | null;
  name: string;
  description?: string | null;
  displayOrder: number;
  isRatingRequired: boolean;
  isCommentRequired: boolean;
  weight?: number | null;
}

export function EvaluationFormModal({
  open,
  onOpenChange,
  assignmentId,
  onSuccess,
  readOnlyForce = false,
}: EvaluationFormModalProps) {
  const { user } = useAuth();
  const isHR = user?.permissionTier === 'FULL';

  // Assignment data state. HR can step from the head evaluation to the self
  // and peer ratings of the same employee without leaving the modal.
  const [currentId, setCurrentId] = useState<string | null>(assignmentId ?? null);
  useEffect(() => setCurrentId(assignmentId ?? null), [assignmentId]);
  const [loading, setLoading] = useState<boolean>(true);
  const [assignment, setAssignment] = useState<EvaluationAssignment | null>(null);

  // Discussion with the employee (head evaluator)
  const [discussionDate, setDiscussionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [discussionNotes, setDiscussionNotes] = useState<string>('');
  const [recordingDiscussion, setRecordingDiscussion] = useState<boolean>(false);
  const [reopening, setReopening] = useState<boolean>(false);

  // Form states
  const [responses, setResponses] = useState<Record<string, { ratingNumeric?: number | null; ratingLabel?: string | null; comment?: string }>>({});
  const [evaluatorSummary, setEvaluatorSummary] = useState<string>('');
  const [developmentRecommendations, setDevelopmentRecommendations] = useState<string>('');
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  // Visibility state during HR finalization (defaults to false for conservative visibility)
  const [isEmployeeVisible, setIsEmployeeVisible] = useState<boolean>(false);

  // Action states
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation modals
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState<boolean>(false);

  // Fetch full assignment details
  const fetchAssignmentData = async () => {
    if (!currentId) return;
    setLoading(true);
    setFormError(null);
    try {
      const data = await EvaluationService.getAssignment(currentId);
      setAssignment(data);

      // Hydrate form responses
      const initialResponses: Record<string, { ratingNumeric?: number | null; ratingLabel?: string | null; comment?: string }> = {};
      if (data.responses && data.responses.length > 0) {
        data.responses.forEach((r) => {
          initialResponses[r.criterionId] = {
            ratingNumeric: r.ratingNumeric !== undefined && r.ratingNumeric !== null ? Number(r.ratingNumeric) : (r.rating !== undefined && r.rating !== null ? Number(r.rating) : null),
            ratingLabel: r.ratingLabel || '',
            comment: r.comment || '',
          };
        });
      }
      setResponses(initialResponses);
      setEvaluatorSummary(data.evaluatorSummary || '');
      setDevelopmentRecommendations(data.developmentRecommendations || '');
    } catch (err: any) {
      const msg = getApiErrorStatus(err) === 403
        ? 'You do not have permission to view or update this evaluation.'
        : getApiErrorMessage(err, 'Failed to load evaluation assignment.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && currentId) {
      fetchAssignmentData();
    } else {
      setAssignment(null);
      setResponses({});
      setEvaluatorSummary('');
      setDevelopmentRecommendations('');
      setFormError(null);
    }
  }, [open, currentId]);

  // Derive Criteria & Rating Method from Snapshot / Template
  const snapshot = assignment?.templateSnapshot;
  const ratingMethod: EvaluationRatingMethod =
    snapshot?.ratingMethod || assignment?.template?.ratingMethod || 'NUMERIC';

  /**
   * The database stores only NUMERIC / LABELED. Which labelled preset the
   * template was built from lives in `scoreLabels`, so the evaluator sees the
   * same scale HR chose (5-point, 4-point satisfaction, or free narrative).
   */
  const preset = resolveRatingPreset({
    ratingMethod,
    scoreLabels: snapshot?.scoreLabels ?? assignment?.template?.scoreLabels,
  });
  const isDescriptive = preset.id === 'DESCRIPTIVE';
  const isLabeled = ratingMethod === 'LABELED' && !isDescriptive;

  const minScore: number = snapshot?.minScore ?? assignment?.template?.minScore ?? 1;
  const maxScore: number = snapshot?.maxScore ?? assignment?.template?.maxScore ?? 5;
  const useWeighting: boolean = Boolean(snapshot?.useWeighting ?? assignment?.template?.useWeighting);

  // The template's own answer choices, review areas and written sections.
  const scale = useMemo(() => scaleChoicesOf(snapshot ?? assignment?.template ?? null), [snapshot, assignment]);
  const layout: EvaluationFormLayout | null = snapshot?.formLayout ?? assignment?.template?.formLayout ?? null;
  const groups: EvaluationCriterionGroup[] = useMemo(() => {
    const g: EvaluationCriterionGroup[] = snapshot?.groups ?? assignment?.template?.groups ?? [];
    return [...g].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [snapshot, assignment]);
  const scoringMethod: string = snapshot?.scoringMethod ?? assignment?.template?.scoringMethod ?? 'CRITERIA';
  const itemComments = layout ? layout.itemComments !== false : true;
  const marker = layout?.itemMarker ?? ')';
  const isOfficialForm = Boolean(snapshot?.isOfficial ?? assignment?.template?.isOfficial);

  const criteriaList: CriterionDisplay[] = useMemo(() => {
    if (snapshot?.criteria && Array.isArray(snapshot.criteria) && snapshot.criteria.length > 0) {
      return [...snapshot.criteria].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    if (assignment?.template?.criteria && assignment.template.criteria.length > 0) {
      return [...assignment.template.criteria].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    if (assignment?.responses && assignment.responses.length > 0) {
      return assignment.responses.map((r, idx) => ({
        id: r.criterionId,
        name: r.criterionName || `Criterion #${idx + 1}`,
        description: r.criterionDescription,
        displayOrder: idx + 1,
        isRatingRequired: true,
        isCommentRequired: false,
        weight: r.criterionWeight,
      }));
    }
    return [];
  }, [snapshot, assignment]);

  // Permissions & State Checks
  const isAssignedEvaluator = Boolean(
    user?.employee?.id && assignment?.evaluatorId === user.employee.id
  );
  // Only the assigned evaluator rates — HR administers but never rates. The API
  // computes these flags and enforces the same rules on every write.
  const canEdit = !readOnlyForce && isAssignedEvaluator && Boolean(assignment?.canRate);
  const canAmend = !readOnlyForce && isAssignedEvaluator && Boolean(assignment?.canAmend);
  const canRecordDiscussion = !readOnlyForce && Boolean(assignment?.canRecordDiscussion);
  const isSubmitted = assignment?.status === 'SUBMITTED';
  const isFinalized = assignment?.status === 'FINALIZED';
  const canFinalize = !readOnlyForce && isHR && Boolean(assignment?.canFinalize);
  const raterType = assignment?.raterType ?? 'HEAD';
  const isSelfRating = raterType === 'SELF';

  // ── Progress: required statements answered ──
  const [showMissing, setShowMissing] = useState(false);
  useEffect(() => setShowMissing(false), [currentId]);
  const hasRating = (id: string) => {
    const r = responses[id];
    return isLabeled ? Boolean(r?.ratingLabel) : r?.ratingNumeric !== undefined && r?.ratingNumeric !== null;
  };
  const ratedItems = isDescriptive ? [] : criteriaList.filter((c) => c.isRatingRequired);
  const unanswered = ratedItems.filter((c) => !hasRating(c.id));
  const answeredCount = ratedItems.length - unanswered.length;
  const progressPct = ratedItems.length ? Math.round((answeredCount / ratedItems.length) * 100) : 100;

  /** Review areas with their statements — or one untitled section of flat criteria. */
  const sections = useMemo(() => {
    if (!groups.length) return [{ key: 'all', title: null as string | null, weight: null as number | null, items: criteriaList }];
    const placed = new Set<string>();
    const out = groups.map((g) => {
      const items = criteriaList.filter((c) => c.groupId === g.id);
      items.forEach((c) => placed.add(c.id));
      return { key: g.id, title: g.name as string | null, weight: (g.weight ?? null) as number | null, items };
    });
    const rest = criteriaList.filter((c) => !placed.has(c.id));
    return rest.length ? [...out, { key: 'rest', title: 'Other', weight: null, items: rest }] : out;
  }, [groups, criteriaList]);

  const generalCommentsLabel = layout?.generalCommentsLabel ?? (isSelfRating ? 'Your Summary' : 'Overall Evaluator Summary');
  const goals: { label: string; prompt: string | null } | null = layout
    ? layout.goalsLabel ? { label: layout.goalsLabel, prompt: layout.goalsPrompt ?? null } : null
    : { label: 'Development Recommendations', prompt: 'Optional notes regarding potential training, development areas, or career guidance.' };

  const ratingText = (r: { ratingNumeric?: number | null; ratingLabel?: string | null }) => {
    if (isLabeled) return scale.options.find((o) => o.value === r.ratingLabel)?.label ?? r.ratingLabel ?? '';
    const opt = scale.options.find((o) => o.score === Number(r.ratingNumeric));
    return scale.kind === 'LABELED_NUMERIC' && opt ? `${opt.score} — ${opt.label}` : `${r.ratingNumeric} / ${maxScore}`;
  };

  /** The score as it stands — the same arithmetic as the server, which recalculates it on submission. */
  const scorePreview = useMemo(() => {
    if (ratingMethod !== 'NUMERIC') return null;
    const r2 = (n: number) => Number(n.toFixed(2));
    const val = (id: string) => {
      const v = responses[id]?.ratingNumeric;
      return v === undefined || v === null ? null : Number(v);
    };
    if ((scoringMethod === 'AREA_WEIGHTED' || scoringMethod === 'AREA_AVERAGE') && groups.length) {
      const areas = groups.map((g) => {
        const vals = criteriaList.filter((c) => c.groupId === g.id).map((c) => val(c.id)).filter((x): x is number => x !== null);
        return { weight: Number(g.weight || 0), avg: vals.length ? r2(r2(vals.reduce((n, x) => n + x, 0)) / vals.length) : null };
      });
      if (!areas.some((a) => a.avg !== null)) return null;
      if (scoringMethod === 'AREA_WEIGHTED') return r2(areas.reduce((n, a) => n + r2(((a.avg ?? 0) * a.weight) / 100), 0));
      const rated = areas.filter((a) => a.avg !== null);
      return r2(r2(rated.reduce((n, a) => n + (a.avg ?? 0), 0)) / rated.length);
    }
    const vals = criteriaList.map((c) => ({ v: val(c.id), w: Number(c.weight || 0) })).filter((x) => x.v !== null);
    if (!vals.length) return null;
    if (useWeighting) return r2(vals.reduce((n, x) => n + (x.v as number) * (x.w / 100), 0));
    return r2(vals.reduce((n, x) => n + (x.v as number), 0) / vals.length);
  }, [ratingMethod, scoringMethod, groups, criteriaList, responses, useWeighting]);


  // Update criterion response
  const setCriterionLabel = (criterionId: string, label: string | null) => {
    if (!canEdit) return;
    setResponses((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], ratingLabel: label },
    }));
  };

  const setCriterionRating = (criterionId: string, ratingValue: number | null) => {
    if (!canEdit) return;
    setResponses((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        ratingNumeric: ratingValue,
      },
    }));
  };

  const setCriterionComment = (criterionId: string, commentText: string) => {
    if (!canEdit) return;
    setResponses((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        comment: commentText,
      },
    }));
  };

  // Build Payload
  const buildPayloadResponses = (): EvaluationResponseInput[] => {
    return criteriaList.map((crit) => {
      const res = responses[crit.id] || {};
      return {
        criterionId: crit.id,
        criterionName: crit.name,
        criterionDescription: crit.description || null,
        criterionWeight: crit.weight !== undefined ? Number(crit.weight) : null,
        ratingNumeric: res.ratingNumeric !== undefined && res.ratingNumeric !== null ? Number(res.ratingNumeric) : null,
        ratingLabel: res.ratingLabel || null,
        comment: res.comment?.trim() || null,
      };
    });
  };

  // ── Reopen a submitted rating to amend it (before finalisation / discussion) ──
  const handleReopen = async () => {
    if (!currentId || !canAmend) return;
    setReopening(true);
    setFormError(null);
    try {
      await EvaluationService.saveDraft(currentId, {
        responses: buildPayloadResponses(),
        evaluatorSummary: evaluatorSummary.trim() || null,
        developmentRecommendations: developmentRecommendations.trim() || null,
      });
      toast.success('Reopened for editing. Submit again when you are done.');
      onSuccess?.();
      fetchAssignmentData();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Could not reopen this evaluation.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setReopening(false);
    }
  };

  // ── Record the discussion with the employee (head evaluator) ──
  const handleRecordDiscussion = async () => {
    if (!currentId || !canRecordDiscussion) return;
    if (!discussionDate) return setFormError('Enter the date the discussion took place.');
    if (!discussionNotes.trim()) return setFormError('Enter notes from the discussion.');
    setRecordingDiscussion(true);
    setFormError(null);
    try {
      await EvaluationService.recordDiscussion(currentId, { discussionDate, notes: discussionNotes.trim() });
      toast.success('Discussion recorded. HR can now finalize once every rating is in.');
      setDiscussionNotes('');
      onSuccess?.();
      fetchAssignmentData();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Could not record the discussion.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setRecordingDiscussion(false);
    }
  };

  // ── Save Draft ──
  const handleSaveDraft = async () => {
    if (!currentId || !canEdit) return;
    setSavingDraft(true);
    setFormError(null);
    try {
      const payload = {
        responses: buildPayloadResponses(),
        evaluatorSummary: evaluatorSummary.trim() || null,
        developmentRecommendations: developmentRecommendations.trim() || null,
      };
      await EvaluationService.saveDraft(currentId, payload);
      toast.success('Evaluation draft saved successfully.');
      onSuccess?.();
      fetchAssignmentData();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to save draft. Please try again.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Submit Validation ──
  const validateForSubmission = (): string | null => {
    if (unanswered.length) {
      setShowMissing(true);
      document.getElementById(`eval-item-${unanswered[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return `${unanswered.length} of ${ratedItems.length} required item${ratedItems.length === 1 ? '' : 's'} still need a rating — the first is “${unanswered[0].name}”.`;
    }
    for (let i = 0; i < criteriaList.length; i++) {
      const crit = criteriaList[i];
      const res = responses[crit.id];

      if (crit.isCommentRequired) {
        if (!res?.comment || !res.comment.trim()) {
          return `A written comment is required for "${crit.name}".`;
        }
      }
    }
    return null;
  };

  // ── Submit Evaluation ──
  const triggerSubmit = () => {
    const errorMsg = validateForSubmission();
    if (errorMsg) {
      setFormError(errorMsg);
      return;
    }
    setFormError(null);
    setConfirmSubmitOpen(true);
  };

  const confirmSubmit = async () => {
    if (!currentId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        responses: buildPayloadResponses(),
        evaluatorSummary: evaluatorSummary.trim() || null,
        developmentRecommendations: developmentRecommendations.trim() || null,
      };
      await EvaluationService.submitEvaluation(currentId, payload);
      toast.success(
        raterType === 'HEAD'
          ? 'Evaluation submitted. Next: discuss it with the employee and record the discussion here.'
          : 'Submitted. Thank you.'
      );
      setConfirmSubmitOpen(false);
      onSuccess?.();
      fetchAssignmentData();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to submit evaluation.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Finalize Evaluation ──
  const confirmFinalize = async () => {
    if (!currentId || !canFinalize) return;
    setFinalizing(true);
    setFormError(null);
    try {
      await EvaluationService.finalizeEvaluation(currentId, {
        isEmployeeVisible,
      });
      toast.success('Evaluation finalized and completed successfully.');
      setConfirmFinalizeOpen(false);
      onSuccess?.();
      fetchAssignmentData();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to finalize evaluation.');
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-surface shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-heading font-bold text-foreground">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                  <ClipboardList className="h-5 w-5" />
                </div>
                {assignment?.raterLabel ?? 'Performance Evaluation'}
              </DialogTitle>

              {assignment?.status && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                      assignment.status === 'NOT_STARTED' && 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-border-soft',
                      assignment.status === 'IN_PROGRESS' && 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
                      assignment.status === 'SUBMITTED' && 'bg-status-success-surface text-status-success-foreground border-status-success-border',
                      assignment.status === 'FINALIZED' && 'bg-status-success-surface text-status-success-foreground border-status-success-border'
                    )}
                  >
                    {assignment.status === 'NOT_STARTED' && <Clock className="h-3.5 w-3.5" />}
                    {assignment.status === 'IN_PROGRESS' && <Sparkles className="h-3.5 w-3.5" />}
                    {assignment.status === 'SUBMITTED' && <AlertCircle className="h-3.5 w-3.5" />}
                    {assignment.status === 'FINALIZED' && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {assignment.status === 'NOT_STARTED' && 'Not Started'}
                    {assignment.status === 'IN_PROGRESS' && 'In Progress (Draft)'}
                    {assignment.status === 'SUBMITTED' && (raterType === 'HEAD' && !assignment.discussionCompletedAt ? 'Submitted — Discussion Pending' : 'Submitted — Awaiting HR')}
                    {assignment.status === 'FINALIZED' && 'Completed'}
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
            {loading ? (
              <div className="p-16 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-500" />
                <p className="text-sm">Loading evaluation details...</p>
              </div>
            ) : formError && !assignment ? (
              <div className="p-4 rounded-xl bg-danger-light border border-danger/30 text-danger-dark text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : assignment ? (
              <>
                {/* Meta Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border text-xs">
                  <div>
                    <span className="text-muted-foreground block font-semibold">Employee</span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {assignment.employee?.firstName} {assignment.employee?.lastName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {assignment.employee?.employeeNumber} · {assignment.employee?.jobRole?.title || 'Staff'}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block font-semibold">{isSelfRating ? 'Rated by' : 'Assigned Evaluator'}</span>
                    <span className="font-medium text-foreground mt-0.5 block">
                      {assignment.evaluator
                        ? `${assignment.evaluator.firstName} ${assignment.evaluator.lastName}`
                        : 'Unassigned'}
                    </span>
                    {assignment.evaluator?.employeeNumber && (
                      <span className="text-[11px] text-muted-foreground">
                        {assignment.evaluator.employeeNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-muted-foreground block font-semibold">Evaluation Cycle</span>
                    <span className="font-medium text-foreground mt-0.5 block">
                      {assignment.cycle?.name || 'Review Period'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block font-semibold">Form</span>
                    <span className="font-medium text-foreground mt-0.5 block">
                      {snapshot?.name ?? assignment.template?.name ?? (isDescriptive ? 'Descriptive (No Score)' : isLabeled ? preset.title : `Numeric (${minScore}–${maxScore})`)}
                    </span>
                    {isOfficialForm && <div className="mt-1"><TemplateOriginBadge template={{ isOfficial: true }} /></div>}
                    {assignment.cycle?.appraisalType && (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {layout?.appraisalLabel ?? 'Appraisal'}: {assignment.cycle.appraisalType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Notice Banners */}
                {isSubmitted && (
                  <div className="p-3.5 rounded-xl bg-status-warning-surface border border-status-warning-border text-xs text-status-warning-foreground flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-status-warning-foreground" />
                      <div>
                        <span className="font-bold block">
                          {raterType === 'HEAD'
                            ? assignment.discussionCompletedAt ? 'Submitted · Discussion recorded — awaiting HR finalization' : 'Submitted — discussion with the employee is next'
                            : 'Submitted — awaiting HR finalization of the employee’s evaluation'}
                        </span>
                        <span>
                          {canFinalize
                            ? 'Every rating is in and the discussion is recorded. HR may finalize this evaluation.'
                            : canAmend ? 'You can reopen it to make changes until the discussion is recorded or HR finalizes.' : 'Responses are locked.'}
                        </span>
                      </div>
                    </div>
                    {canAmend && (
                      <Button size="sm" variant="outline" onClick={handleReopen} disabled={reopening} className="shrink-0">
                        {reopening ? 'Reopening…' : 'Reopen to edit'}
                      </Button>
                    )}
                    {canFinalize && (
                      <Button
                        size="sm"
                        onClick={() => setConfirmFinalizeOpen(true)}
                        className="gap-1.5 shrink-0 bg-success hover:bg-status-success-foreground text-white"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Finalize Evaluation
                      </Button>
                    )}
                  </div>
                )}

                {isFinalized && (
                  <div className="p-3.5 rounded-xl bg-status-success-surface border border-status-success-border text-xs text-status-success-foreground flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold block">Evaluation Completed & Finalized</span>
                          {isHR && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold',
                                assignment.isEmployeeVisible
                                  ? 'bg-status-success-surface text-status-success-foreground border-status-success-border'
                                  : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-border-soft'
                              )}
                            >
                              {assignment.isEmployeeVisible ? 'Visible to Employee' : 'Employee Access Hidden'}
                            </Badge>
                          )}
                        </div>
                        <span>
                          {assignment.isEmployeeVisible
                            ? 'This evaluation is recorded in official records and accessible to the employee in their profile.'
                            : 'This evaluation is recorded in official records. Employee access is currently disabled.'}
                        </span>
                      </div>
                    </div>
                    {(() => {
                      const res = formatEvaluationResult(assignment);
                      if (res.isScore) {
                        return (
                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-status-success-foreground font-semibold block">
                              {res.isWeightedFinal ? 'Final rating (self 20% + peer 20% + head 60%)' : 'Overall Score'}
                            </span>
                            <span className="text-lg font-bold text-status-success-foreground">
                              {res.text}
                            </span>
                            {/* A weighted final's breakdown is the Final rating panel below. */}
                            {!res.isWeightedFinal && assignment.scoreBreakdown && assignment.scoreBreakdown.method !== 'NOT_NUMERIC' && (
                              <BreakdownButton className="mt-1" onClick={() => setShowScoreBreakdown(true)} />
                            )}
                          </div>
                        );
                      }
                      if (res.isDescriptive) {
                        return (
                          <div className="text-right shrink-0">
                            <span className="text-[11px] text-status-success-foreground font-semibold block">Appraisal Result</span>
                            <span className="text-sm font-bold text-status-success-foreground">
                              {res.text}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* HR: the employee's whole evaluation, component by component */}
                {isHR && assignment.workflow && (
                  <div className="rounded-xl border border-border bg-surface p-3.5 text-xs space-y-2">
                    <p className="font-bold text-foreground">Evaluation workflow for {assignment.employee?.firstName} {assignment.employee?.lastName}</p>
                    <ul className="space-y-1">
                      {(assignment.components ?? []).map((c) => (
                        <li key={c.assignmentId} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-foreground">
                            {c.raterLabel}
                            {c.raterType !== 'SELF' && c.evaluator ? ` — ${c.evaluator.firstName} ${c.evaluator.lastName}` : ''}
                            <span className="ml-2 text-muted-foreground">
                              {c.status === 'SUBMITTED' || c.status === 'FINALIZED' ? 'Completed' : c.status === 'IN_PROGRESS' ? 'In progress' : 'Pending'}
                              {c.overallScore !== null && c.overallScore !== undefined ? ` · score ${c.overallScore}` : ''}
                            </span>
                          </span>
                          {c.assignmentId !== assignment.id && (
                            <Button variant="ghost" size="xs" onClick={() => setCurrentId(c.assignmentId)}>View</Button>
                          )}
                        </li>
                      ))}
                      <li className="text-foreground">
                        Discussion with the employee:{' '}
                        <span className="text-muted-foreground">
                          {assignment.workflow.discussion.completed
                            ? `Completed${assignment.workflow.discussion.date ? ` on ${new Date(assignment.workflow.discussion.date).toLocaleDateString()}` : ''}`
                            : assignment.workflow.finalization.finalized ? 'Not recorded (finalized before this step existed)' : 'Pending'}
                        </span>
                      </li>
                      <li className="text-foreground">
                        HR finalization: <span className="text-muted-foreground">{assignment.workflow.finalization.finalized ? 'Completed' : 'Pending'}</span>
                      </li>
                    </ul>
                    {assignment.finalizeBlockedReason && (
                      <p className="text-status-warning-foreground">{assignment.finalizeBlockedReason}</p>
                    )}
                    {assignment.workflow.blockers.length > 0 && (
                      <p className="text-status-warning-foreground">Before HR can finalize: {assignment.workflow.blockers.join('; ')}.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {assignment.evaluationMode === 'WEIGHTED_MULTI_RATER'
                        ? 'Each rating is kept separately; the final rating combines them only by the 20 / 20 / 60 rule.'
                        : 'A Standard Evaluation is the head / supervisor / coordinator evaluation alone.'}{' '}
                      HR reviews and finalizes but does not rate.
                    </p>
                  </div>
                )}

                {assignment.combined && <CombinedResultPanel combined={assignment.combined} maxScore={maxScore} />}
                {assignment.evaluationMode === 'STANDARD' && raterType === 'HEAD' && assignment.scoreBreakdown &&
                  assignment.scoreBreakdown.method !== 'NOT_NUMERIC' && assignment.scoreBreakdown.overallScore !== null && (
                    <StandardResultPanel breakdown={assignment.scoreBreakdown} maxScore={maxScore} finalized={assignment.status === 'FINALIZED'} />
                  )}

                {/* Discussion with the employee (head / supervisor / coordinator) */}
                {raterType === 'HEAD' && (assignment.discussionCompletedAt || canRecordDiscussion) && (
                  <div className="rounded-xl border border-border bg-surface p-3.5 text-xs space-y-2">
                    <p className="font-bold text-foreground">Discussion with the evaluated employee</p>
                    {assignment.discussionCompletedAt ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">Recording the discussion does not mean the employee agrees with the evaluation.</p>
                        <p className="text-foreground">
                          <span className="font-semibold">Completed</span>
                          {assignment.discussionDate ? ` on ${new Date(assignment.discussionDate).toLocaleDateString()}` : ''}
                        </p>
                        {assignment.discussionNotes && (
                          <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-2.5 text-foreground">{assignment.discussionNotes}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground">Discuss this evaluation with the employee, then record it here. HR cannot finalize until you do.</p>
                        {layout?.acknowledgment && (
                          <p className="rounded-lg border border-border bg-muted/20 p-2.5 text-muted-foreground">
                            On the paper form the employee signs: <span className="italic">“{layout.acknowledgment}”</span>
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                          <label className="space-y-1">
                            <span className="block font-semibold text-foreground">Discussion date *</span>
                            <Input type="date" value={discussionDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDiscussionDate(e.target.value)} className="h-9 text-xs" />
                          </label>
                          <label className="space-y-1">
                            <span className="block font-semibold text-foreground">Discussion notes *</span>
                            <textarea rows={3} value={discussionNotes} onChange={(e) => setDiscussionNotes(e.target.value)} placeholder="What was discussed and agreed with the employee" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500" />
                          </label>
                        </div>
                        <Button size="sm" onClick={handleRecordDiscussion} disabled={recordingDiscussion} className="gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          {recordingDiscussion ? 'Saving…' : 'Mark discussion completed'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {formError && (
                  <div className="p-3.5 rounded-xl bg-danger-light border border-danger/30 text-danger-dark text-xs flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Please check</span>
                      <span>{formError}</span>
                    </div>
                  </div>
                )}

                {/* ── Progress and the rating scale, always in view while rating ── */}
                {!isDescriptive && ratedItems.length > 0 && (
                  <div className="sticky -top-5 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface/95 backdrop-blur border-b border-border space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-foreground" role="status">
                        {answeredCount} of {ratedItems.length} items answered
                        <span className="ml-1.5 font-normal text-muted-foreground">({progressPct}% complete)</span>
                      </span>
                      {unanswered.length > 0 && canEdit && (
                        <span className="text-status-warning-foreground">{unanswered.length} still to rate</span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    {scale.options.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">Rating scale: </span>
                        {[...scale.options].reverse().map((o, i) => (
                          <span key={o.value}>
                            {i > 0 && ' · '}
                            {scale.kind === 'LABELED_NUMERIC' ? `${o.score} — ${o.label}` : o.label}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}

                {layout?.instructions?.length ? (
                  <details className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-foreground">Instructions from the form</summary>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      {layout.instructions.map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  </details>
                ) : null}

                {/* ── Section: Evaluation Criteria ── */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {groups.length ? `${groups.length} review areas · ${criteriaList.length} statements` : `Evaluation Criteria (${criteriaList.length})`}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {canEdit ? 'Rate each statement' : 'Recorded responses'}
                    </span>
                  </div>

                  {sections.map((section, si) => (
                    <section key={section.key} aria-labelledby={`eval-section-${si}`} className="space-y-3">
                      {section.title && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-50/60 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900 px-3 py-2">
                          <h4 id={`eval-section-${si}`} className="text-sm font-bold text-foreground">
                            {si + 1}. {section.title}
                          </h4>
                          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {section.items.filter((c) => hasRating(c.id)).length}/{section.items.length} rated
                            {scoringMethod === 'AREA_WEIGHTED' && section.weight !== null && section.weight !== undefined && (
                              <Badge variant="outline" className="text-[10px] font-bold bg-status-accent-surface text-status-accent-foreground border-status-accent-border">
                                Weight {section.weight}%
                              </Badge>
                            )}
                          </span>
                        </div>
                      )}

                      {section.items.map((criterion, index) => {
                        const response = responses[criterion.id] || {};
                        const selectedRating = response.ratingNumeric;
                        const itemLabel = section.title ? `${String.fromCharCode(97 + (index % 26))}${marker}` : String(criterion.displayOrder || index + 1);
                        const missing = canEdit && showMissing && criterion.isRatingRequired && !isDescriptive && !hasRating(criterion.id);

                        return (
                          <div
                            key={criterion.id || index}
                            id={`eval-item-${criterion.id}`}
                            className={cn('bg-surface rounded-2xl border p-3 sm:p-4 shadow-sm space-y-3', missing ? 'border-status-warning-border ring-1 ring-status-warning-border' : 'border-border')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 flex shrink-0 items-center justify-center h-5 min-w-5 px-1 rounded bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 font-bold text-xs">
                                    {itemLabel}
                                  </span>
                                  <p id={`eval-item-label-${criterion.id}`} className={cn('text-sm text-foreground', section.title ? 'font-medium' : 'font-bold')}>{criterion.name}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pl-7">
                                  {missing && (
                                    <Badge variant="outline" className="text-[10px] text-status-warning-foreground border-status-warning-border">Not rated yet</Badge>
                                  )}
                                  {criterion.isCommentRequired && (
                                    <Badge variant="outline" className="text-[10px] text-status-warning-foreground border-status-warning-border">Comment Required</Badge>
                                  )}
                                </div>
                                {criterion.description && <p className="text-xs text-muted-foreground pl-7">{criterion.description}</p>}
                              </div>

                              {!section.title && useWeighting && criterion.weight !== null && criterion.weight !== undefined && (
                                <Badge variant="outline" className="text-xs font-bold bg-status-accent-surface text-status-accent-foreground border-status-accent-border shrink-0">
                                  Weight: {criterion.weight}%
                                </Badge>
                              )}
                            </div>

                            {/* Rating: one row of choices on wider screens, a vertical list on phones */}
                            {!isDescriptive && (
                              canEdit ? (
                                <div role="radiogroup" aria-labelledby={`eval-item-label-${criterion.id}`} className={cn('grid gap-1.5', scale.options.length <= 6 ? 'grid-cols-1 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]' : 'grid-cols-5 sm:grid-cols-10')} style={{ ['--n' as any]: scale.options.length }}>
                                  {scale.options.map((opt) => {
                                    const isSelected = isLabeled ? response.ratingLabel === opt.value : selectedRating === opt.score;
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        onClick={() => (isLabeled ? setCriterionLabel(criterion.id, opt.value) : setCriterionRating(criterion.id, opt.score ?? Number(opt.value)))}
                                        className={cn(
                                          'min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition-all flex items-center gap-2 sm:flex-col sm:justify-center sm:gap-0.5 sm:text-center',
                                          isSelected
                                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm ring-2 ring-primary-500/30'
                                            : 'bg-background hover:bg-muted/40 text-foreground border-border'
                                        )}
                                      >
                                        {scale.kind === 'LABELED_NUMERIC' ? (
                                          <>
                                            <span className="text-sm font-bold tabular-nums">{opt.score}</span>
                                            <span className={cn('leading-tight', isSelected ? 'text-white' : 'text-muted-foreground')}>{opt.label}</span>
                                          </>
                                        ) : (
                                          <span className="w-full text-center">{opt.label}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {hasRating(criterion.id) ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-primary-50 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200 font-bold text-sm border border-primary-200 dark:border-primary-800">
                                      {ratingText(response)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">No rating recorded</span>
                                  )}
                                </div>
                              )
                            )}

                            {/* Comments on the statement, where the form has them */}
                            {(itemComments || criterion.isCommentRequired || isDescriptive) && (
                              <div>
                                <label htmlFor={`eval-comment-${criterion.id}`} className="block text-xs font-semibold text-foreground mb-1">
                                  {isDescriptive ? 'Assessment' : 'Comments'} {criterion.isCommentRequired && <span className="text-danger">*</span>}
                                </label>
                                {canEdit ? (
                                  <textarea
                                    id={`eval-comment-${criterion.id}`}
                                    rows={2}
                                    placeholder={isDescriptive ? 'Write the assessment…' : 'Optional comment on this statement…'}
                                    value={response.comment || ''}
                                    onChange={(e) => setCriterionComment(criterion.id, e.target.value)}
                                    className="w-full text-sm sm:text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  />
                                ) : (
                                  <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded-xl border border-border whitespace-pre-wrap">
                                    {response.comment || <span className="text-muted-foreground italic">No comment.</span>}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>

                {/* ── Written sections (the form's own labels) ── */}
                <div className="space-y-4 pt-2">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {layout?.overallLabel ?? 'Overall Evaluation & Recommendations'}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="eval-general-comments" className="block text-xs font-semibold text-foreground mb-1">
                        {generalCommentsLabel}
                      </label>
                      {canEdit ? (
                        <textarea
                          id="eval-general-comments"
                          rows={3}
                          placeholder={layout ? '' : "Provide a comprehensive summary of the employee's overall performance during this period..."}
                          value={evaluatorSummary}
                          onChange={(e) => setEvaluatorSummary(e.target.value)}
                          className="w-full text-sm sm:text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      ) : (
                        <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-border whitespace-pre-wrap">
                          {evaluatorSummary || <span className="text-muted-foreground italic">None given.</span>}
                        </p>
                      )}
                    </div>

                    {goals && (
                      <div>
                        <label htmlFor="eval-goals" className="block text-xs font-semibold text-foreground mb-1">{goals.label}</label>
                        {goals.prompt && <p className="text-[11px] text-muted-foreground mb-1">{goals.prompt}</p>}
                        {canEdit ? (
                          <textarea
                            id="eval-goals"
                            rows={3}
                            value={developmentRecommendations}
                            onChange={(e) => setDevelopmentRecommendations(e.target.value)}
                            className="w-full text-sm sm:text-xs bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        ) : (
                          <p className="text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-border whitespace-pre-wrap">
                            {developmentRecommendations || <span className="text-muted-foreground italic">None given.</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-surface shrink-0 flex flex-row flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={savingDraft || submitting || finalizing}
            >
              Close
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting}
                    className="gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    {savingDraft ? 'Saving Draft...' : 'Save Draft'}
                  </Button>

                  <Button
                    type="button"
                    onClick={triggerSubmit}
                    disabled={savingDraft || submitting}
                    className="gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    Review & Submit
                  </Button>
                </>
              )}

              {canFinalize && (
                <Button
                  type="button"
                  onClick={() => setConfirmFinalizeOpen(true)}
                  disabled={finalizing}
                  className="gap-1.5 bg-success hover:bg-status-success-foreground text-white"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {finalizing ? 'Finalizing...' : 'Finalize Evaluation'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review before submission */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary-600 dark:text-primary-300">
              <Send className="h-5 w-5" />
              Review before submitting
            </DialogTitle>
          </DialogHeader>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/20 p-3 text-xs">
            <div><dt className="text-muted-foreground">Employee</dt><dd className="font-semibold text-foreground">{assignment?.employee?.firstName} {assignment?.employee?.lastName}</dd></div>
            <div><dt className="text-muted-foreground">Form</dt><dd className="font-semibold text-foreground">{snapshot?.name ?? assignment?.template?.name}</dd></div>
            <div><dt className="text-muted-foreground">Evaluator type</dt><dd className="font-semibold text-foreground">{assignment?.raterLabel}</dd></div>
            <div>
              <dt className="text-muted-foreground">Answered</dt>
              <dd className="font-semibold text-foreground">{answeredCount} of {ratedItems.length} items{unanswered.length ? ` · ${unanswered.length} unanswered` : ' · none unanswered'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Comments</dt>
              <dd className="font-semibold text-foreground">
                {criteriaList.filter((c) => responses[c.id]?.comment?.trim()).length} on statements
                {evaluatorSummary.trim() ? ` · ${generalCommentsLabel} given` : ''}
                {goals && developmentRecommendations.trim() ? ` · ${goals.label} given` : ''}
              </dd>
            </div>
            {scorePreview !== null && (
              <div>
                <dt className="text-muted-foreground">Calculated score</dt>
                <dd className="font-semibold text-foreground">{scorePreview} / {maxScore}</dd>
              </div>
            )}
          </dl>
          {groups.length > 0 && !isDescriptive && (
            <ul className="space-y-1 text-xs">
              {sections.map((sec) => (
                <li key={sec.key} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{sec.title}</span>
                  <span className="text-muted-foreground tabular-nums">{sec.items.filter((c) => hasRating(c.id)).length}/{sec.items.length} rated</span>
                </li>
              ))}
            </ul>
          )}
          <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1 text-muted-foreground">
            <p>
              {raterType === 'HEAD'
                ? '• After submitting, discuss the evaluation with the employee and record the discussion. HR finalizes after that.'
                : '• Once submitted, your responses are locked (you can reopen them until HR finalizes).'}
            </p>
            {scorePreview !== null && <p>• The server recalculates the score from your ratings when you submit.</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)} disabled={submitting}>
              Back to the form
            </Button>
            <Button onClick={confirmSubmit} disabled={submitting} className="gap-1.5">
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Submit Evaluation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Finalize Evaluation */}
      <Dialog open={confirmFinalizeOpen} onOpenChange={setConfirmFinalizeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-success-foreground">
              <ShieldCheck className="h-5 w-5" />
              Finalize Evaluation?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Finalizing will record this evaluation as the official completed appraisal for{' '}
              <strong className="text-foreground">
                {assignment?.employee?.firstName} {assignment?.employee?.lastName}
              </strong>.
            </p>
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <p>• Finalizing permanently confirms this evaluation record.</p>
              <p>• Further modifications cannot be made once finalized.</p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
              <span className="text-xs font-bold text-foreground block">Employee Access</span>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEmployeeVisible}
                  onChange={(e) => setIsEmployeeVisible(e.target.checked)}
                  className="mt-0.5 rounded border-border text-primary-600 focus:ring-primary-500 dark:text-primary-300"
                />
                <div className="text-xs">
                  <span className="font-semibold text-foreground block">
                    Allow employee to view this finalized evaluation
                  </span>
                  <span className="text-muted-foreground text-[11px] block mt-0.5">
                    The employee will only be able to view the finalized rating and feedback in their profile if this option is enabled.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmFinalizeOpen(false)}
              disabled={finalizing}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmFinalize}
              disabled={finalizing}
              className="gap-1.5 bg-success hover:bg-status-success-foreground text-white"
            >
              {finalizing ? 'Finalizing...' : 'Finalize & Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {assignment?.scoreBreakdown && (
        <MetricBreakdownDialog
          open={showScoreBreakdown}
          onOpenChange={setShowScoreBreakdown}
          spec={scoreBreakdownSpec(assignment.scoreBreakdown, maxScore)}
        />
      )}
    </>
  );
}

/** How the overall score was reached — from the API's scoring function (evaluation-score.ts). */
function scoreBreakdownSpec(b: any, maxScore: number): MetricBreakdownSpec {
  const raw = b.rawTotal !== undefined && b.rawTotal !== null && b.rawMax ? `Raw score: ${b.rawTotal} of ${b.rawMax} points (${b.ratedCount} of ${b.itemCount} items rated).` : null;
  const value = b.overallScore === null || b.overallScore === undefined ? 'Not scored' : `${b.overallScore} / ${maxScore}`;
  if (b.method === 'AREA_WEIGHTED' || b.method === 'AREA_AVERAGE') {
    const weighted = b.method === 'AREA_WEIGHTED';
    return {
      title: 'Overall score',
      value,
      caption: weighted ? 'Each review area: the average of its statements, counted by the area’s weight.' : 'Each factor: total ÷ statements rated = average; then the average of the factor averages.',
      formula: [b.formula],
      columns: weighted ? ['Review area', 'Total', 'Average', 'Weight', 'Contribution'] : ['Performance factor', 'Total', 'Average'],
      sections: [
        {
          rows: (b.areas ?? []).map((a: any) => ({
            label: a.name,
            muted: a.average === null,
            note: a.average === null ? 'Not rated' : `${a.total} ÷ ${a.ratedCount} = ${a.average}${weighted ? ` · × ${a.weight}% = ${a.contribution}` : ''}`,
            cells: weighted
              ? [String(a.total), a.average === null ? '—' : String(a.average), `${a.weight}%`, String(a.contribution ?? 0)]
              : [String(a.total), a.average === null ? '—' : String(a.average)],
          })),
        },
      ],
      total: weighted
        ? { label: 'TOTAL', cells: ['', '', `${b.totalWeight}%`, String(b.overallScore ?? '—')] }
        : { label: 'Overall', cells: ['', String(b.overallScore ?? '—')] },
      notes: [
        ...(raw ? [raw] : []),
        weighted ? 'Area weights total 100% (checked when the template is saved).' : 'This is the Simplified form’s own rule: factor total ÷ 3, then the sum of the averages ÷ 10.',
        'The score is on the rating scale, not a percentage.',
      ],
    };
  }
  const weighted = b.method === 'WEIGHTED';
  return {
    title: 'Overall score',
    value,
    caption: weighted ? 'Weighted template: each criterion counts by its weight.' : 'Unweighted template: the average of the ratings given.',
    formula: [b.formula],
    columns: weighted ? ['Criterion', 'Rating', 'Weight', 'Contribution'] : ['Criterion', 'Rating'],
    sections: [
      {
        rows: (b.rows ?? []).map((r: any) => ({
          label: r.name,
          muted: r.rating === null,
          note: r.rating === null ? 'Not rated' : weighted ? `${r.rating} × ${r.weight}% = ${r.contribution}` : null,
          cells: weighted
            ? [r.rating === null ? '—' : `${r.rating} / ${maxScore}`, `${r.weight}%`, String(r.contribution ?? 0)]
            : [r.rating === null ? '—' : `${r.rating} / ${maxScore}`],
        })),
      },
    ],
    total: weighted
      ? { label: 'TOTAL', cells: ['', `${b.totalWeight}%`, String(b.overallScore ?? '—')] }
      : { label: 'Average', cells: [String(b.overallScore ?? '—')] },
    notes: [
      ...(raw ? [raw] : []),
      ...(weighted ? ['Weights must total 100% when weighting is enabled (checked when the template is saved).'] : []),
      'The score is on the rating scale, not a percentage.',
    ],
  };
}

/**
 * A Standard Evaluation's result: the head / supervisor / coordinator's
 * ratings, averaged per review area (or per criterion), the overall result and
 * its percentage — all calculated by the server (evaluation-score.ts).
 */
function StandardResultPanel({
  breakdown,
  maxScore,
  finalized,
}: {
  breakdown: NonNullable<EvaluationAssignment['scoreBreakdown']>;
  maxScore: number;
  finalized: boolean;
}) {
  const two = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Number(n).toFixed(2));
  const byArea = breakdown.areas && breakdown.areas.length > 0;
  const rows = byArea
    ? breakdown.areas!.map((a) => ({ key: a.groupId, name: a.name, value: a.average, note: a.average === null ? 'Not rated' : `${a.total} ÷ ${a.ratedCount} rated` }))
    : breakdown.rows.map((r) => ({ key: r.criterionId, name: r.name, value: r.rating, note: r.rating === null ? 'Not rated' : null }));
  return (
    <section aria-labelledby="standard-result-heading" className="rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-950/20 p-3.5 text-xs space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="standard-result-heading" className="font-bold text-foreground">Result — Standard Evaluation</h3>
          <p className={cn('mt-0.5 font-semibold', finalized ? 'text-status-success-foreground' : 'text-status-warning-foreground')}>
            {finalized ? '✓ Finalized by HR' : '! Not final yet — the discussion and HR finalization come first'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-foreground">Overall {two(breakdown.overallScore)} / {maxScore}</p>
          {breakdown.overallPercent !== null && breakdown.overallPercent !== undefined && (
            <p className="text-muted-foreground">Equivalent <span className="font-semibold text-foreground">{breakdown.overallPercent}%</span></p>
          )}
        </div>
      </div>
      <table className="w-full text-left">
        <caption className="sr-only">{byArea ? 'Average per review area' : 'Rating per criterion'}</caption>
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 font-semibold">{byArea ? 'Criteria' : 'Criterion'}</th>
            <th scope="col" className="py-1 font-semibold text-right">{byArea ? 'Average' : 'Rating'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-1.5 text-foreground">
                {r.name}
                {r.note && <span className="ml-1 text-muted-foreground">({r.note})</span>}
              </td>
              <td className="py-1.5 text-right font-semibold text-foreground tabular-nums">{r.value === null ? '—' : `${two(r.value)} / ${maxScore}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground">{breakdown.formula}</p>
      <p className="text-[11px] text-muted-foreground">Calculated by HRISense from the submitted ratings; the AI never sets an evaluation score.</p>
    </section>
  );
}

/**
 * The final combined rating: self, peer and head / supervisor / coordinator,
 * each counted by the cycle's percentage. Calculated by the server; shown with
 * every step so the final figure can be checked.
 */
function CombinedResultPanel({ combined, maxScore }: { combined: CombinedResult; maxScore: number }) {
  const max = combined.maxScore ?? maxScore;
  // Two decimals; a peer average keeps its 4 (4.1667) — exactly what the server used.
  const avg = (n: number | null) => (n === null ? '—' : Number.isInteger(Math.round(n * 10000) / 100) ? n.toFixed(2) : String(n));
  const two = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(2));
  const label: Record<string, string> = { SELF: 'Self rating', PEER: 'Peer rating', HEAD: 'Head / supervisor / coordinator' };
  return (
    <section aria-labelledby="combined-heading" className="rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-950/20 p-3.5 text-xs space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="combined-heading" className="font-bold text-foreground">Final rating</h3>
          <p className={cn('mt-0.5 font-semibold', combined.finalized ? 'text-status-success-foreground' : 'text-status-warning-foreground')}>
            {combined.finalized ? '✓ Finalized by HR' : combined.final === null ? '! Incomplete — not every rating is in' : '! Not final yet — the discussion and HR finalization come first'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-foreground">{combined.final === null ? 'Incomplete' : `${two(combined.final)} / ${max}`}</p>
          {combined.finalPercent !== null && combined.finalPercent !== undefined && (
            <p className="text-muted-foreground">Equivalent <span className="font-semibold text-foreground">{combined.finalPercent}%</span></p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {combined.rows.map((r) => (
          <div key={r.source} className="rounded-lg border border-border bg-surface p-2.5 space-y-0.5">
            <p className="font-semibold uppercase tracking-wide text-foreground">{label[r.source] ?? r.label}</p>
            {r.source === 'PEER' ? (
              <p className="text-muted-foreground">Peer evaluators: {r.evaluators} ({r.submitted} submitted)</p>
            ) : r.rawTotal !== null && r.rawMax ? (
              <p className="text-muted-foreground">Raw score: {r.rawTotal} of {r.rawMax} points</p>
            ) : null}
            <p className="text-foreground">{r.source === 'PEER' ? 'Peer average' : 'Average'}: <span className="font-semibold">{r.average === null ? '—' : `${avg(r.average)} / ${max}`}</span></p>
            <p className="text-foreground">Weight: <span className="font-semibold">{r.weight}%</span></p>
            <p className="text-foreground">
              Weighted contribution: <span className="font-semibold">{two(r.contribution)}</span>
              {r.average !== null && <span className="text-muted-foreground"> ({avg(r.average)} × {r.weight}%)</span>}
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground">{combined.formula}</p>
      <p className="text-[11px] text-muted-foreground">
        Several peers share the one peer percentage — their scores are averaged first. Calculated by HRISense from the submitted ratings; the AI never sets an evaluation score.
      </p>
    </section>
  );
}
