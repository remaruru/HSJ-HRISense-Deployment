import { api } from '@/services/api';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, AlertCircle, Layers, Wand2, Info, ListTree, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  EvaluationService,
  EvaluationTemplate,
  CriterionInputDto,
  CriterionGroupInputDto,
  CreateTemplateDto,
  RatingPresetId,
  RatingLabelSetId,
  RatingScaleOption,
  RATING_PRESETS,
  RATING_LABEL_SETS,
  resolveRatingPreset,
} from '@/services/evaluation.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { distributeWeights, weightStatus } from '@/lib/evaluationWeights';
import {
  WorkflowModalHeader,
  WorkflowModalFooter,
  WorkflowStepper,
  WorkflowSection,
  workflowModalStyles,
} from '@/components/shared/WorkflowModal';
import { RatingScaleList, WeightTotalChip } from './RatingScale';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface EvaluationTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateToEdit?: EvaluationTemplate | null;
  onSuccess: () => void;
}

interface EditableCriterion {
  id?: string;
  name: string;
  description: string;
  isRatingRequired: boolean;
  isCommentRequired: boolean;
  weight: number | string;
}

interface EditableArea {
  name: string;
  description: string;
  weight: number | string;
  items: EditableCriterion[];
}

type LabelChoice = RatingLabelSetId | 'STORED';

const blankCriterion = (): EditableCriterion => ({ name: '', description: '', isRatingRequired: true, isCommentRequired: false, weight: '' });
const blankArea = (): EditableArea => ({ name: '', description: '', weight: '', items: [blankCriterion()] });

/** Which Hospicio label set stored options match, if any. */
function labelSetOf(options: RatingScaleOption[] | undefined): LabelChoice {
  const key = (o: RatingScaleOption[]) => o.map((x) => `${x.score}:${x.label}`).join('|');
  if (!options?.length || options.some((o) => o.score === undefined || o.score === null)) return 'STORED';
  for (const set of Object.values(RATING_LABEL_SETS)) if (key(set.options) === key(options)) return set.id;
  return 'STORED';
}

const inputBox = 'bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700';

export function EvaluationTemplateModal({ open, onOpenChange, templateToEdit, onSuccess }: EvaluationTemplateModalProps) {
  const isEditMode = Boolean(templateToEdit);

  // Stepper state (1: Template, 2: Rating, 3: Criteria, 4: Review)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Rating: the card HR picks; a 5-point scale also picks its labels.
  const [ratingPreset, setRatingPreset] = useState<RatingPresetId>('NUMERIC');
  const [labelChoice, setLabelChoice] = useState<LabelChoice>('HSJ_EPR');
  const [minScore, setMinScore] = useState<number>(1);
  const [maxScore, setMaxScore] = useState<number>(5);
  const [useWeighting, setUseWeighting] = useState<boolean>(false);

  // Criteria: flat, or review areas with statements under each.
  const [structure, setStructure] = useState<'FLAT' | 'AREAS'>('FLAT');
  const [criteria, setCriteria] = useState<EditableCriterion[]>([blankCriterion()]);
  const [areas, setAreas] = useState<EditableArea[]>([blankArea()]);

  const [saving, setSaving] = useState<boolean>(false);
  const [jobRoleIds, setJobRoleIds] = useState<string[]>([]);
  const [allJobRoles, setAllJobRoles] = useState<Array<{ id: string; title: string; unit?: { name: string } | null }>>([]);
  useEffect(() => {
    if (!open) return;
    api.get('/job-roles').then((res) => setAllJobRoles(res.data?.data || [])).catch(() => setAllJobRoles([]));
  }, [open]);
  const [stepError, setStepError] = useState<string | null>(null);

  // Hydrate when editing or reset on open
  useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
    setStepError(null);

    if (templateToEdit) {
      setName(templateToEdit.name || '');
      setDescription(templateToEdit.description || '');
      setJobRoleIds((templateToEdit.jobRoles ?? []).map((j) => j.jobRoleId));
      const preset = resolveRatingPreset(templateToEdit).id;
      setRatingPreset(preset);
      setLabelChoice(preset === 'LIKERT_5' ? labelSetOf(templateToEdit.scoreLabels?.options) : 'HSJ_EPR');
      setMinScore(templateToEdit.minScore ?? 1);
      setMaxScore(templateToEdit.maxScore ?? 5);
      setUseWeighting(Boolean(templateToEdit.useWeighting));
      const toEditable = (c: any): EditableCriterion => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        isRatingRequired: c.isRatingRequired ?? true,
        isCommentRequired: Boolean(c.isCommentRequired),
        weight: c.weight !== null && c.weight !== undefined ? c.weight : '',
      });
      const groups = templateToEdit.groups ?? [];
      if (groups.length) {
        setStructure('AREAS');
        setAreas(
          groups.map((g) => ({
            name: g.name,
            description: g.description || '',
            weight: g.weight !== null && g.weight !== undefined ? g.weight : '',
            items: (templateToEdit.criteria ?? []).filter((c) => c.groupId === g.id).map(toEditable),
          }))
        );
        setCriteria([blankCriterion()]);
      } else {
        setStructure('FLAT');
        setCriteria(templateToEdit.criteria?.length ? templateToEdit.criteria.map(toEditable) : [blankCriterion()]);
        setAreas([blankArea()]);
      }
    } else {
      setName('');
      setDescription('');
      setJobRoleIds([]);
      setRatingPreset('NUMERIC');
      setLabelChoice('HSJ_EPR');
      setMinScore(1);
      setMaxScore(5);
      setUseWeighting(false);
      setStructure('FLAT');
      setCriteria([blankCriterion()]);
      setAreas([blankArea()]);
    }
  }, [templateToEdit, open]);

  // ── The configured scale, for previews and saving ──────────────────────────
  const storedLikert = templateToEdit && resolveRatingPreset(templateToEdit).id === 'LIKERT_5' ? templateToEdit : null;
  const fivePointOptions: RatingScaleOption[] =
    labelChoice === 'STORED' ? storedLikert?.scoreLabels?.options ?? RATING_LABEL_SETS.HSJ_EPR.options : RATING_LABEL_SETS[labelChoice].options;
  const scaleFor = (preset: RatingPresetId) => {
    switch (preset) {
      case 'NUMERIC':
        return { ratingMethod: 'NUMERIC', minScore, maxScore, scoreLabels: null };
      case 'LIKERT_5':
        return labelChoice === 'STORED' && storedLikert
          ? { ratingMethod: storedLikert.ratingMethod, minScore: 1, maxScore: 5, scoreLabels: storedLikert.scoreLabels }
          : { ratingMethod: 'NUMERIC', minScore: 1, maxScore: 5, scoreLabels: { presetId: 'LIKERT_5', labelSet: labelChoice, options: fivePointOptions } };
      default:
        return { ratingMethod: 'LABELED', scoreLabels: { presetId: preset, options: RATING_PRESETS[preset].options } };
    }
  };
  const selectedScale = scaleFor(ratingPreset);
  const isScored = selectedScale.ratingMethod === 'NUMERIC';
  // Weights only mean something on a scored scale.
  useEffect(() => {
    if (!isScored) setUseWeighting(false);
  }, [isScored]);

  // ── Criteria / area editing ─────────────────────────────────────────────────
  const move = <T,>(list: T[], index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  const updateCriterion = (index: number, field: keyof EditableCriterion, value: any) =>
    setCriteria((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  const updateArea = (index: number, patch: Partial<EditableArea>) => setAreas((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  const updateItem = (ai: number, ii: number, patch: Partial<EditableCriterion>) =>
    setAreas((prev) => prev.map((a, i) => (i === ai ? { ...a, items: a.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : a)));

  /** The weights that must total 100: review areas, or flat criteria. */
  const weightList = structure === 'AREAS' ? areas.map((a) => a.weight) : criteria.map((c) => c.weight);
  const status = weightStatus(weightList);
  const statementCount = structure === 'AREAS' ? areas.reduce((n, a) => n + a.items.length, 0) : criteria.length;

  const autoDistribute = () => {
    const parts = distributeWeights(weightList.length);
    if (structure === 'AREAS') setAreas((prev) => prev.map((a, i) => ({ ...a, weight: parts[i] })));
    else setCriteria((prev) => prev.map((c, i) => ({ ...c, weight: parts[i] })));
    setStepError(null);
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    setStepError(null);
    if (!name.trim()) {
      setStepError('Template name is required.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setStepError(null);
    if (ratingPreset === 'NUMERIC' && minScore >= maxScore) {
      setStepError('Maximum score must be greater than minimum score.');
      return false;
    }
    return true;
  };

  const validWeight = (raw: number | string) => {
    const w = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(w) && w >= 0 && w <= 100 && Math.abs(w * 100 - Math.round(w * 100)) < 1e-6;
  };

  const validateStep3 = () => {
    setStepError(null);
    if (structure === 'AREAS') {
      if (!areas.length) return setStepError('Add at least one review area.'), false;
      for (const [i, a] of areas.entries()) {
        if (!a.name.trim()) return setStepError(`Review area #${i + 1} needs a name.`), false;
        if (!a.items.length) return setStepError(`"${a.name}" needs at least one statement to rate.`), false;
        for (const [j, it] of a.items.entries()) {
          if (!it.name.trim()) return setStepError(`Statement ${j + 1} in "${a.name}" is empty.`), false;
        }
        if (useWeighting && !validWeight(a.weight)) return setStepError(`"${a.name}" needs a weight between 0 and 100 (two decimals at most).`), false;
      }
    } else {
      if (!criteria.length) return setStepError('Please add at least one evaluation criterion.'), false;
      for (const [i, c] of criteria.entries()) {
        if (!c.name.trim()) return setStepError(`Criterion #${i + 1} requires a name / title.`), false;
        if (useWeighting && !validWeight(c.weight)) return setStepError(`Criterion #${i + 1} needs a weight between 0 and 100 (two decimals at most).`), false;
      }
    }
    if (useWeighting && status.status !== 'EXACT') {
      setStepError(`Weights must total exactly 100% before saving — currently ${status.label}. Press “Auto-Distribute to 100%” or adjust them.`);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
    else if (currentStep === 3 && validateStep3()) setCurrentStep(4);
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }
    if (!validateStep1()) return setCurrentStep(1);
    if (!validateStep2()) return setCurrentStep(2);
    if (!validateStep3()) return setCurrentStep(3);

    setSaving(true);
    setStepError(null);

    try {
      const toDto = (c: EditableCriterion, index: number, withWeight: boolean): CriterionInputDto => ({
        id: c.id,
        name: c.name.trim(),
        description: c.description.trim() || undefined,
        displayOrder: index + 1,
        weight: withWeight && useWeighting ? Number(c.weight) : undefined,
        isRatingRequired: c.isRatingRequired,
        isCommentRequired: c.isCommentRequired,
      });
      const groupsDto: CriterionGroupInputDto[] | undefined =
        structure === 'AREAS'
          ? areas.map((a) => ({
              name: a.name.trim(),
              description: a.description.trim() || undefined,
              weight: useWeighting ? Number(a.weight) : undefined,
              items: a.items.map((it, j) => toDto(it, j, false)),
            }))
          : undefined;

      // A copy of an official form keeps its written sections; if HR changes
      // the equal split HRISense started with, the weights become HR's own.
      let formLayout = templateToEdit?.formLayout ?? undefined;
      if (formLayout && structure === 'AREAS' && useWeighting) {
        const equal = distributeWeights(areas.length);
        const changed = areas.some((a, i) => Math.round(Number(a.weight) * 100) !== Math.round(equal[i] * 100));
        if (changed && formLayout.weightsSource === 'HRISENSE_EQUAL') formLayout = { ...formLayout, weightsSource: 'HR' };
      }

      const scale = selectedScale as any;
      const dto: CreateTemplateDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        ratingMethod: scale.ratingMethod,
        scoreLabels: scale.scoreLabels ?? null,
        minScore: isScored ? scale.minScore : undefined,
        maxScore: isScored ? scale.maxScore : undefined,
        useWeighting,
        jobRoleIds,
        ...(groupsDto ? { groups: groupsDto } : { criteria: criteria.map((c, i) => toDto(c, i, true)) }),
        ...(formLayout !== undefined ? { formLayout } : {}),
      };

      if (isEditMode && templateToEdit) {
        await EvaluationService.updateTemplate(templateToEdit.id, dto);
        toast.success('Evaluation template updated successfully.');
      } else {
        await EvaluationService.createTemplate(dto);
        toast.success('Evaluation template created successfully.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to save template. Please check your inputs.');
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, label: 'Template' },
    { id: 2, label: 'Rating' },
    { id: 3, label: 'Criteria' },
    { id: 4, label: 'Review' },
  ];

  const copiedFrom = templateToEdit?.formLayout?.copiedFrom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={workflowModalStyles.container('wide')}>
        <WorkflowModalHeader
          icon={Layers}
          title={isEditMode ? 'Edit Evaluation Template' : 'Create Evaluation Template'}
          subtitle={isEditMode ? 'Update evaluation criteria, scoring scales, or description.' : 'Define evaluation criteria, rating method, and scoring structure.'}
          onClose={() => onOpenChange(false)}
        />

        <WorkflowStepper steps={steps} currentStep={currentStep} onStepClick={(s: number) => { if (s < currentStep) setCurrentStep(s); }} />

        <form onSubmit={handleSubmit} className={workflowModalStyles.form}>
          <div className={workflowModalStyles.content}>
            {stepError && (
              <div role="alert" className="p-3 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-xs flex items-start gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 text-status-danger-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Please check your inputs</p>
                  <p className="mt-0.5">{stepError}</p>
                </div>
              </div>
            )}

            {/* ── STEP 1: TEMPLATE ── */}
            {currentStep === 1 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection title="Name your evaluation template" subtitle="Give this template a descriptive name and summary for HR and evaluators">
                  <div className="space-y-4 pt-1">
                    {copiedFrom && (
                      <p className="flex items-start gap-2 rounded-xl border border-status-accent-border bg-status-accent-surface px-3 py-2 text-xs text-status-accent-foreground">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        Custom copy of the official “{copiedFrom}” form. Your changes apply to this copy only — the official form stays as Hospicio issued it.
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Template Name <span className="text-status-danger-foreground font-bold">*</span>
                      </label>
                      <Input
                        placeholder="e.g. Annual Staff Performance Evaluation"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={cn('text-sm sm:text-base font-medium h-11 rounded-xl', inputBox)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Description</label>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
                      </div>
                      <textarea
                        placeholder="Purpose, instructions, or scope of this evaluation template..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className={cn('w-full p-3 text-sm sm:text-base font-medium rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500', inputBox)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Used for job roles</label>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Employees in the ticked job roles are evaluated with this template in every new cycle. Everyone else uses the template chosen for the cycle. A job role can use only one template.
                      </p>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                        {allJobRoles.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={jobRoleIds.includes(r.id)}
                              onChange={(e) => setJobRoleIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))}
                            />
                            <span className="min-w-0 flex-1">{r.title}</span>
                            <span className="text-xs text-muted-foreground">{r.unit?.name ?? 'Organisation-wide'}</span>
                          </label>
                        ))}
                        {allJobRoles.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No job roles found.</p>}
                      </div>
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 2: RATING ── */}
            {currentStep === 2 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection title="How should employees be rated?" subtitle="Each card shows the answers an evaluator will be able to choose">
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Rating method">
                      {Object.values(RATING_PRESETS).map((m) => {
                        const isSelected = ratingPreset === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setRatingPreset(m.id as RatingPresetId);
                              setStepError(null);
                            }}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all space-y-2',
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 shadow-sm ring-1 ring-primary-500'
                                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            )}
                          >
                            <span className="text-sm sm:text-base font-bold block text-foreground">{m.title}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 block font-medium leading-normal">{m.desc}</span>
                            <div className="rounded-lg border border-border-soft bg-surface/70 px-2.5 py-2">
                              <span className="sr-only">Answer choices: </span>
                              <RatingScaleList template={scaleFor(m.id as RatingPresetId) as any} order="asc" compact />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {ratingPreset === 'LIKERT_5' && (
                      <fieldset className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-2">
                        <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">5-point labels</legend>
                        {[
                          ...Object.values(RATING_LABEL_SETS).map((s) => ({ id: s.id as LabelChoice, title: s.title })),
                          ...(storedLikert && labelSetOf(storedLikert.scoreLabels?.options) === 'STORED' ? [{ id: 'STORED' as LabelChoice, title: 'Keep the labels saved with this template' }] : []),
                        ].map((opt) => (
                          <label key={opt.id} className="flex items-start gap-2 text-sm text-foreground">
                            <input type="radio" name="labelSet" className="mt-1" checked={labelChoice === opt.id} onChange={() => setLabelChoice(opt.id)} />
                            {opt.title}
                          </label>
                        ))}
                      </fieldset>
                    )}

                    {ratingPreset === 'NUMERIC' && (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Score Range</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="eval-min">Minimum Score</label>
                            <Input id="eval-min" type="number" value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value) || 1)} className="text-sm font-medium h-10 bg-surface dark:bg-slate-900" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="eval-max">Maximum Score</label>
                            <Input id="eval-max" type="number" value={maxScore} onChange={(e) => setMaxScore(parseInt(e.target.value) || 5)} className="text-sm font-medium h-10 bg-surface dark:bg-slate-900" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* The selected scale, as evaluators will see it */}
                    <section aria-labelledby="rating-scale-heading" className="p-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-primary-950/20">
                      <h3 id="rating-scale-heading" className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 mb-2">Rating Scale</h3>
                      <RatingScaleList template={selectedScale as any} order="desc" />
                    </section>

                    {isScored && (
                      <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span id="weighting-label" className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 block">Weighted Scoring</span>
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium">Give each criterion (or review area) a percentage weight; they must total exactly 100%.</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={useWeighting}
                          aria-labelledby="weighting-label"
                          onClick={() => setUseWeighting((prev) => !prev)}
                          className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', useWeighting ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700')}
                        >
                          <span className={cn('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow transition', useWeighting ? 'translate-x-5' : 'translate-x-0')} />
                        </button>
                      </div>
                    )}
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 3: CRITERIA ── */}
            {currentStep === 3 && (
              <div className="space-y-4 py-1 max-w-4xl mx-auto w-full">
                <WorkflowSection title="What should employees be evaluated on?" subtitle="Flat criteria, or review areas with the statements rated under each">
                  <div className="space-y-3 pt-1">
                    <div className="inline-flex rounded-xl border border-border p-1 gap-1" role="radiogroup" aria-label="Criteria structure">
                      {[
                        { id: 'FLAT' as const, label: 'Criteria', icon: List },
                        { id: 'AREAS' as const, label: 'Review areas with statements', icon: ListTree },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={structure === o.id}
                          onClick={() => setStructure(o.id)}
                          className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold', structure === o.id ? 'bg-primary-600 text-white' : 'text-foreground hover:bg-muted')}
                        >
                          <o.icon className="h-4 w-4" aria-hidden="true" /> {o.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {structure === 'AREAS' ? `${areas.length} review areas · ${statementCount} statements` : `${criteria.length} criteria`}
                        </span>
                        {useWeighting && <WeightTotalChip weights={weightList} />}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {useWeighting && (
                          <Button type="button" variant="outline" size="sm" onClick={autoDistribute} className="h-9 gap-1.5 text-xs sm:text-sm font-semibold">
                            <Wand2 className="w-4 h-4" aria-hidden="true" /> Auto-Distribute to 100%
                          </Button>
                        )}
                        <Button
                          variant="create"
                          type="button"
                          size="sm"
                          onClick={() => (structure === 'AREAS' ? setAreas((p) => [...p, blankArea()]) : setCriteria((p) => [...p, blankCriterion()]))}
                          className="text-xs sm:text-sm h-9 px-3.5 gap-1.5 font-semibold"
                        >
                          <Plus className="w-4 h-4" /> {structure === 'AREAS' ? 'Add Review Area' : 'Add Criterion'}
                        </Button>
                      </div>
                    </div>
                    {useWeighting && (
                      <p className="text-[11px] text-muted-foreground">
                        Auto-Distribute splits 100% equally (the last one absorbs the rounding, e.g. 33.33 / 33.33 / 33.34). It is an HRISense convenience — adjust any weight afterwards.
                        {structure === 'AREAS' && ' The weight belongs to the review area; its statements are averaged within it.'}
                      </p>
                    )}

                    {structure === 'FLAT' ? (
                      <div className="space-y-3">
                        {criteria.map((item, index) => (
                          <div key={index} className="p-3 sm:p-4 rounded-xl bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                              <Input
                                aria-label={`Criterion ${index + 1} title`}
                                placeholder={`Criterion #${index + 1} title`}
                                value={item.name}
                                onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                                className={cn('min-w-0 flex-1 basis-48 text-sm font-semibold h-10', inputBox)}
                                required
                              />
                              {useWeighting && (
                                <div className="flex items-center gap-1 w-28 shrink-0">
                                  <Input type="number" min="0" max="100" step="0.01" aria-label={`Weight for criterion ${index + 1}`} placeholder="%" value={item.weight} onChange={(e) => updateCriterion(index, 'weight', e.target.value)} className={cn('text-sm font-bold h-10 text-center', inputBox)} />
                                  <span className="text-sm text-muted-foreground font-bold">%</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 shrink-0">
                                <Button type="button" variant="ghost" size="sm" aria-label="Move up" onClick={() => setCriteria((p) => move(p, index, 'up'))} disabled={index === 0} className="h-9 w-9 p-0"><ChevronUp className="w-4 h-4" /></Button>
                                <Button type="button" variant="ghost" size="sm" aria-label="Move down" onClick={() => setCriteria((p) => move(p, index, 'down'))} disabled={index === criteria.length - 1} className="h-9 w-9 p-0"><ChevronDown className="w-4 h-4" /></Button>
                                <Button type="button" variant="delete" size="sm" aria-label={`Remove criterion ${index + 1}`} onClick={() => (criteria.length <= 1 ? toast.error('A template must have at least one criterion.') : setCriteria((p) => p.filter((_, i) => i !== index)))} className="h-9 w-9 p-0"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                            <Input aria-label={`Criterion ${index + 1} description`} placeholder="Description or scoring guide for evaluators (Optional)..." value={item.description} onChange={(e) => updateCriterion(index, 'description', e.target.value)} className="text-xs sm:text-sm font-medium h-9 bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {areas.map((area, ai) => (
                          <div key={ai} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-900 shadow-xs">
                            <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-border-soft bg-muted/30 rounded-t-xl">
                              <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center shrink-0">{ai + 1}</span>
                              <Input aria-label={`Review area ${ai + 1} name`} placeholder="Review area (e.g. KNOWLEDGE, SKILLS & ABILITIES)" value={area.name} onChange={(e) => updateArea(ai, { name: e.target.value })} className={cn('min-w-0 flex-1 basis-48 text-sm font-bold h-10', inputBox)} />
                              {useWeighting && (
                                <div className="flex items-center gap-1 w-28 shrink-0">
                                  <Input type="number" min="0" max="100" step="0.01" aria-label={`Weight for ${area.name || `review area ${ai + 1}`}`} placeholder="%" value={area.weight} onChange={(e) => updateArea(ai, { weight: e.target.value })} className={cn('text-sm font-bold h-10 text-center', inputBox)} />
                                  <span className="text-sm text-muted-foreground font-bold">%</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 shrink-0">
                                <Button type="button" variant="ghost" size="sm" aria-label="Move area up" onClick={() => setAreas((p) => move(p, ai, 'up'))} disabled={ai === 0} className="h-9 w-9 p-0"><ChevronUp className="w-4 h-4" /></Button>
                                <Button type="button" variant="ghost" size="sm" aria-label="Move area down" onClick={() => setAreas((p) => move(p, ai, 'down'))} disabled={ai === areas.length - 1} className="h-9 w-9 p-0"><ChevronDown className="w-4 h-4" /></Button>
                                <Button type="button" variant="delete" size="sm" aria-label={`Remove review area ${ai + 1}`} onClick={() => (areas.length <= 1 ? toast.error('A template must have at least one review area.') : setAreas((p) => p.filter((_, i) => i !== ai)))} className="h-9 w-9 p-0"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                            <ol className="p-3 sm:p-4 space-y-2">
                              {area.items.map((it, ii) => (
                                <li key={ii} className="flex items-start gap-2">
                                  <span className="mt-2.5 w-5 shrink-0 text-xs font-bold text-muted-foreground">{String.fromCharCode(97 + (ii % 26))})</span>
                                  <textarea
                                    aria-label={`Statement ${String.fromCharCode(97 + (ii % 26))} in ${area.name || `area ${ai + 1}`}`}
                                    placeholder="Statement the evaluator rates"
                                    value={it.name}
                                    rows={2}
                                    onChange={(e) => updateItem(ai, ii, { name: e.target.value })}
                                    className={cn('min-w-0 flex-1 rounded-lg border p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500', inputBox)}
                                  />
                                  <div className="flex shrink-0 flex-col sm:flex-row">
                                    <Button type="button" variant="ghost" size="sm" aria-label="Move statement up" onClick={() => updateArea(ai, { items: move(area.items, ii, 'up') })} disabled={ii === 0} className="h-8 w-8 p-0"><ChevronUp className="w-4 h-4" /></Button>
                                    <Button type="button" variant="ghost" size="sm" aria-label="Remove statement" onClick={() => (area.items.length <= 1 ? toast.error('A review area needs at least one statement.') : updateArea(ai, { items: area.items.filter((_, j) => j !== ii) }))} className="h-8 w-8 p-0 text-muted-foreground hover:text-danger"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </li>
                              ))}
                            </ol>
                            <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                              <Button type="button" variant="outline" size="sm" onClick={() => updateArea(ai, { items: [...area.items, blankCriterion()] })} className="h-8 gap-1.5 text-xs">
                                <Plus className="w-3.5 h-3.5" /> Add statement
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 4: REVIEW ── */}
            {currentStep === 4 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection title="Review evaluation template" subtitle="Verify template configuration and criteria before saving">
                  <div className="p-4 sm:p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">Template Name</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg block mt-0.5">{name}</span>
                      {description && <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium mt-1">{description}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">Rating Scale</span>
                        <RatingScaleList template={selectedScale as any} order="desc" compact className="mt-1" />
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">Scoring Method</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block mt-0.5">
                          {!isScored
                            ? 'No numeric score'
                            : structure === 'AREAS'
                              ? useWeighting ? `Σ area average × area weight (${status.total}%)` : 'Average of the area averages'
                              : useWeighting ? `Weighted (${status.total}%)` : 'Average of the ratings'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">Contents</span>
                        <span className="font-bold text-primary-800 dark:text-primary-300 text-sm block mt-0.5">
                          {structure === 'AREAS' ? `${areas.length} review areas · ${statementCount} statements` : `${criteria.length} criteria`}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                      <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">{structure === 'AREAS' ? 'Review Areas' : 'Included Criteria'}</span>
                      <div className="space-y-1.5">
                        {(structure === 'AREAS' ? areas.map((a) => ({ label: a.name, sub: `${a.items.length} statement${a.items.length === 1 ? '' : 's'}`, weight: a.weight })) : criteria.map((c) => ({ label: c.name, sub: '', weight: c.weight }))).map((row, i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">
                              {i + 1}. {row.label || 'Untitled'}
                              {row.sub && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {row.sub}</span>}
                            </span>
                            {useWeighting && <span className="font-bold text-primary-700 dark:text-primary-400 shrink-0">{row.weight}%</span>}
                          </div>
                        ))}
                      </div>
                      {useWeighting && <WeightTotalChip weights={weightList} />}
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}
          </div>

          <WorkflowModalFooter
            onCancel={() => onOpenChange(false)}
            onBack={currentStep > 1 ? handleBack : undefined}
            primaryLabel={currentStep === 4 ? (isEditMode ? 'Save Changes' : 'Create Evaluation Template') : 'Next'}
            isSubmitting={saving}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
