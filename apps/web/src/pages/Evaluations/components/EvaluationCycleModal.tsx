import { useState, useEffect, useMemo } from 'react';
import type { CyclePreview, DesignatedEvaluatorOption, EvaluationConfig, EvaluationMode } from '@/services/evaluation.service';
import {
  Calendar,
  Layers,
  FileText,
  Users,
  AlertCircle,
  Search,
  Check,
  Building2,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  EvaluationService,
  EvaluationTemplate,
  RequirementScopeType,
  CreateCycleDto,
  CreateCycleScopeDto,
  isScoredTemplate,
} from '@/services/evaluation.service';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  WorkflowModalHeader,
  WorkflowModalFooter,
  WorkflowStepper,
  WorkflowSection,
  workflowModalStyles,
} from '@/components/shared/WorkflowModal';
import { EmployeePicker } from '@/components/shared/EmployeePicker';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface EvaluationCycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EvaluationTemplate[];
  onSuccess: () => void;
}

interface UnitItem {
  id: string;
  name: string;
}

interface JobRoleItem {
  id: string;
  title: string;
}

interface EmployeeItem {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string } | null;
  unit?: { name: string } | null;
  department?: { name: string } | null;
  employmentState?: string;
}

export function EvaluationCycleModal({
  open,
  onOpenChange,
  templates,
  onSuccess,
}: EvaluationCycleModalProps) {
  // Stepper State (1: Review Details, 2: Employees, 3: Evaluators & Review)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showParticipantList, setShowParticipantList] = useState<boolean>(false);

  // Form State - Step 1: Review Details
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  // Scopes State - Step 2: Employees
  const [scopeType, setScopeType] = useState<RequirementScopeType>('ALL');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Evaluator Setup State - Step 3: Evaluators & Review
  const [evaluatorMethod, setEvaluatorMethod] = useState<'ONE_EVALUATOR' | 'SUPERVISOR' | 'MANUAL'>('SUPERVISOR');
  const [defaultEvaluatorId, setDefaultEvaluatorId] = useState<string>('');
  // Who may be the designated evaluator — never HR / full-access administrators (API rule).
  const [designatedOptions, setDesignatedOptions] = useState<DesignatedEvaluatorOption[]>([]);

  // Org Reference Data
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loadingOrgData, setLoadingOrgData] = useState<boolean>(false);

  // Submitting & Errors
  const [saving, setSaving] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // The paper form's "Nature of Appraisal" / "Type of Evaluation".
  const [appraisalType, setAppraisalType] = useState<string>('');
  // Standard (head evaluates) or Weighted Multi-Rater (self / peer / head at
  // Hospicio's fixed percentages, from the API). HR chooses; nothing is assumed.
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode | null>(null);
  const [config, setConfig] = useState<EvaluationConfig | null>(null);
  const official = config?.officialSourceWeights;
  const weighted = evaluationMode === 'WEIGHTED_MULTI_RATER';

  // Which template each employee will be evaluated with (job-role mappings first).
  const [preview, setPreview] = useState<CyclePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(false);

  // Active templates filter
  const activeTemplates = useMemo(() => {
    return templates.filter((t) => t.isActive);
  }, [templates]);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === templateId);
  }, [templates, templateId]);

  // Reset fields on modal open
  useEffect(() => {
    if (!open) return;

    setCurrentStep(1);
    setShowParticipantList(false);
    setName('');
    setDescription('');
    setTemplateId(activeTemplates[0]?.id || '');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDueDate(thirtyDaysLater);
    setScopeType('ALL');
    setSelectedUnitId('');
    setSelectedJobRoleId('');
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
    setEvaluatorMethod('SUPERVISOR');
    setDefaultEvaluatorId('');
    setStepError(null);
    setAppraisalType('');
    setEvaluationMode(null);
    EvaluationService.getConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
    EvaluationService.listDesignatedEvaluators()
      .then(setDesignatedOptions)
      .catch(() => setDesignatedOptions([]));
    setPreview(null);
    setShowPreviewList(false);

    const loadRefData = async () => {
      setLoadingOrgData(true);
      try {
        // Departments are no longer a cycle scope, so the list is not fetched.
        const [uRes, rRes, eRes] = await Promise.allSettled([
          api.get('/employees/units'),
          api.get('/employees/job-roles'),
          api.get('/employees?limit=500&employmentState=ACTIVE&isArchived=false'),
        ]);

        if (uRes.status === 'fulfilled') setUnits(uRes.value.data?.data || []);
        if (rRes.status === 'fulfilled') setJobRoles(rRes.value.data?.data || []);
        if (eRes.status === 'fulfilled') setEmployees(eRes.value.data?.data || []);
        // allSettled never throws — say so when a list is missing.
        const failed = [uRes, rRes, eRes].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (failed) {
          toast.error(
            getApiErrorMessage(failed.reason, 'Some participant choices could not be loaded.') +
              ' Units, job roles or employees may be missing — close and reopen this window to try again.',
            { id: 'cycle-ref-data' }
          );
        }
      } finally {
        setLoadingOrgData(false);
      }
    };

    loadRefData();
  }, [open, activeTemplates]);

  // Resolve matching employees for scope preview
  const resolvedEmployees = useMemo(() => {
    if (scopeType === 'ALL') {
      return employees;
    }
    if (scopeType === 'UNIT') {
      if (!selectedUnitId) return [];
      return employees.filter((e: any) => e.unitId === selectedUnitId || e.unit?.id === selectedUnitId);
    }
    if (scopeType === 'JOB_ROLE') {
      if (!selectedJobRoleId) return [];
      return employees.filter((e: any) => e.jobRoleId === selectedJobRoleId || e.jobRole?.id === selectedJobRoleId);
    }
    if (scopeType === 'EMPLOYEE') {
      return employees.filter((e) => selectedEmployeeIds.includes(e.id));
    }
    return [];
  }, [scopeType, employees, selectedUnitId, selectedJobRoleId, selectedEmployeeIds]);

  const filteredEmployeesForScope = useMemo(() => {
    if (!employeeSearch.trim()) return employees.slice(0, 30);
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.employeeNumber?.toLowerCase().includes(q) ||
        e.jobRole?.title?.toLowerCase().includes(q) ||
        e.department?.name?.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredEmployeesForScope.map((e) => e.id);
    setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleClearSelected = () => {
    setSelectedEmployeeIds([]);
  };

  const buildScopes = (): CreateCycleScopeDto[] => {
    if (scopeType === 'ALL') return [{ scopeType: 'ALL' }];
    if (scopeType === 'UNIT' && selectedUnitId) return [{ scopeType: 'UNIT', targetUnitId: selectedUnitId }];
    if (scopeType === 'JOB_ROLE' && selectedJobRoleId) return [{ scopeType: 'JOB_ROLE', targetJobRoleId: selectedJobRoleId }];
    if (scopeType === 'EMPLOYEE') return selectedEmployeeIds.map((id) => ({ scopeType: 'EMPLOYEE' as const, targetEmployeeId: id }));
    return [];
  };

  useEffect(() => {
    if (!open || currentStep !== 3 || !templateId) return;
    let cancelled = false;
    setPreviewLoading(true);
    EvaluationService.previewCycle({ templateId, scopes: buildScopes() })
      .then((p) => !cancelled && setPreview(p))
      .catch(() => !cancelled && setPreview(null))
      .finally(() => !cancelled && setPreviewLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStep, templateId, scopeType, selectedUnitId, selectedJobRoleId, selectedEmployeeIds]);

  // Validation
  const validateStep1 = () => {
    setStepError(null);
    if (!evaluationMode) {
      setStepError('Choose the evaluation type: Standard Evaluation or Weighted Multi-Rater Evaluation.');
      return false;
    }
    if (!name.trim()) {
      setStepError('Cycle name is required.');
      return false;
    }
    if (!templateId) {
      setStepError('Please select an active evaluation template.');
      return false;
    }
    if (weighted && selectedTemplate && !isScoredTemplate(selectedTemplate)) {
      setStepError('A Weighted Multi-Rater Evaluation combines numeric scores. This template records written answers — choose a scored template, or run a Standard Evaluation.');
      return false;
    }
    if (!startDate) {
      setStepError('Start date is required.');
      return false;
    }
    if (!dueDate) {
      setStepError('Due date is required.');
      return false;
    }
    if (new Date(dueDate) < new Date(startDate)) {
      setStepError('Due date cannot be earlier than start date.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setStepError(null);
    if (scopeType === 'UNIT' && !selectedUnitId) {
      setStepError('Please select a target unit.');
      return false;
    }
    if (scopeType === 'JOB_ROLE' && !selectedJobRoleId) {
      setStepError('Please select a target job role.');
      return false;
    }
    if (scopeType === 'EMPLOYEE' && selectedEmployeeIds.length === 0) {
      setStepError('Please select at least one employee.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    setStepError(null);
    if (evaluatorMethod === 'ONE_EVALUATOR' && !defaultEvaluatorId) {
      setStepError('Please select a designated evaluator.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      handleNext();
      return;
    }

    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      return;
    }

    setSaving(true);
    setStepError(null);

    try {
      const scopes = buildScopes();

      const payload: CreateCycleDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        templateId,
        startDate,
        dueDate,
        evaluatorAssignmentMethod: evaluatorMethod,
        defaultEvaluatorId: evaluatorMethod === 'ONE_EVALUATOR' ? defaultEvaluatorId : undefined,
        scopes,
        appraisalType: appraisalType || undefined,
        evaluationMode: evaluationMode!,
      };

      await EvaluationService.createCycle(payload);
      toast.success('Evaluation cycle created successfully.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to create evaluation cycle.');
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, label: 'Review Details' },
    { id: 2, label: 'Employees' },
    { id: 3, label: 'Evaluators & Review' },
  ];

  const selectedEvaluatorEmployee = useMemo(() => {
    return designatedOptions.find((e) => e.id === defaultEvaluatorId) || null;
  }, [designatedOptions, defaultEvaluatorId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={workflowModalStyles.container('wide')}>
        <WorkflowModalHeader
          icon={Layers}
          title="Create Evaluation Cycle"
          subtitle="Set up evaluation period, target staff, and evaluator assignments."
          onClose={() => onOpenChange(false)}
        />

        <WorkflowStepper
          steps={steps}
          currentStep={currentStep}
          onStepClick={(s: number) => {
            if (s < currentStep) setCurrentStep(s);
          }}
        />

        <form onSubmit={handleSubmit} className={workflowModalStyles.form}>
          <div className={workflowModalStyles.content}>
            {stepError && (
              <div className="p-3 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-xs flex items-start gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 text-status-danger-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Please check your inputs</p>
                  <p className="mt-0.5">{stepError}</p>
                </div>
              </div>
            )}

            {/* ── STEP 1: REVIEW DETAILS ── */}
            {currentStep === 1 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="Evaluation type"
                  subtitle="How this cycle's employees are evaluated. It cannot be changed once the cycle is created."
                >
                  <div role="radiogroup" aria-label="Evaluation type" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {([
                      {
                        id: 'STANDARD' as const,
                        title: 'Standard Evaluation',
                        desc: 'The head / supervisor / coordinator evaluates the employee. No self rating, no peer rating.',
                        lines: ['Head / supervisor / coordinator rating'],
                      },
                      {
                        id: 'WEIGHTED_MULTI_RATER' as const,
                        title: 'Weighted Multi-Rater Evaluation',
                        desc: 'The employee, selected peers and the head / supervisor / coordinator all rate; the final result is weighted.',
                        lines: official
                          ? [`${official.self}% Self rating`, `${official.peer}% Peer rating (peers averaged first)`, `${official.head}% Head / supervisor / coordinator`]
                          : ['Self · Peer · Head / supervisor / coordinator'],
                      },
                    ]).map((m) => {
                      const isSelected = evaluationMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setEvaluationMode(m.id)}
                          className={cn(
                            'relative p-4 rounded-xl border text-left transition-all space-y-1.5',
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-2 ring-teal-500'
                              : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                          )}
                        >
                          {isSelected && (
                            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              <Check className="h-3 w-3" aria-hidden="true" /> Selected
                            </span>
                          )}
                          <span className="text-sm sm:text-base font-bold block pr-20">{m.title}</span>
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">{m.desc}</span>
                          <ul className="pt-1 space-y-0.5 text-xs font-semibold text-foreground">
                            {m.lines.map((l) => <li key={l}>• {l}</li>)}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-2">
                    Either way, the head / supervisor / coordinator discusses the result with the employee before HR finalizes. HR administers the evaluation and does not rate.
                  </p>
                </WorkflowSection>

                <WorkflowSection
                  title="Set up the evaluation period"
                  subtitle="Name your cycle, select an active evaluation template, and set evaluation dates"
                >
                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Cycle Name <span className="text-status-danger-foreground font-bold">*</span>
                      </label>
                      <Input
                        placeholder="e.g. FY2026 Mid-Year Performance Review"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Evaluation Template <span className="text-status-danger-foreground font-bold">*</span>
                      </label>
                      {activeTemplates.length > 0 ? (
                        <select
                          value={templateId}
                          onChange={(e) => setTemplateId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900"
                          required
                        >
                          {activeTemplates.map((t) => (
                            <option key={t.id} value={t.id} disabled={weighted && !isScoredTemplate(t)}>
                              {t.isOfficial ? 'Official · ' : ''}{t.name} ({t.groups?.length ? `${t.groups.length} areas · ${t.criteria?.length || 0} statements` : `${t.criteria?.length || 0} criteria`})
                              {weighted && !isScoredTemplate(t) ? ' — written answers, Standard only' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-status-warning-surface border border-status-warning-border text-status-warning-foreground text-sm flex items-center gap-2.5 font-medium">
                          <ShieldAlert className="w-4 h-4 text-status-warning-foreground shrink-0" />
                          <span>
                            No active evaluation templates available. Please create an active template first.
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="-mt-2 text-xs text-muted-foreground">
                      Employees whose job role has its own template are evaluated with that one (for example, Maintenance Staff → Eval Form 1); everyone else uses this template. You will see who gets which before creating the cycle.
                    </p>

                    {selectedTemplate?.formLayout?.appraisalTypes?.length ? (
                      <div className="space-y-1.5">
                        <label htmlFor="cycle-appraisal" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {selectedTemplate.formLayout.appraisalLabel ?? 'Nature of Appraisal'}
                        </label>
                        <select
                          id="cycle-appraisal"
                          value={appraisalType}
                          onChange={(e) => setAppraisalType(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        >
                          <option value="">Not specified</option>
                          {selectedTemplate.formLayout.appraisalTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Start Date <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Due Date <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Description
                        </label>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
                      </div>
                      <textarea
                        placeholder="Brief summary of guidelines or expectations for this evaluation cycle..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full p-3 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 2: EMPLOYEES ── */}
            {currentStep === 2 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="Who will be evaluated?"
                  subtitle="Select the target staff members to be evaluated in this cycle"
                >
                  <div className="space-y-4 pt-1">
                    {/* Scope Selection Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { id: 'ALL', title: 'Everyone', desc: 'All active employees across the organisation.' },
                        { id: 'UNIT', title: 'Specific Unit', desc: 'Employees assigned to a specific unit.' },
                        { id: 'JOB_ROLE', title: 'Job Role', desc: 'Employees with a specific job title.' },
                        { id: 'EMPLOYEE', title: 'Specific Staff', desc: 'Select specific staff members.' },
                      ].map((mode) => {
                        const isSelected = scopeType === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              setScopeType(mode.id as RequirementScopeType);
                              setStepError(null);
                            }}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all space-y-1.5',
                              isSelected
                                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500 font-bold'
                                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                            )}
                          >
                            <span className="text-sm sm:text-base font-bold block">{mode.title}</span>
                            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">
                              {mode.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Scope Config Controls */}
                    {scopeType === 'UNIT' && (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Choose Unit <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <select
                          value={selectedUnitId}
                          onChange={(e) => setSelectedUnitId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        >
                          <option value="">Select a unit...</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {scopeType === 'JOB_ROLE' && (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Choose Job Role <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <select
                          value={selectedJobRoleId}
                          onChange={(e) => setSelectedJobRoleId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        >
                          <option value="">Select a job role...</option>
                          {jobRoles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {scopeType === 'EMPLOYEE' && (
                      <div className="space-y-3.5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search employee by name, role, ID..."
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                              className="pl-10 text-sm font-medium h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllFiltered}
                            className="text-xs sm:text-sm h-11 px-3.5 font-semibold"
                          >
                            Select Matches
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearSelected}
                            className="text-xs sm:text-sm h-11 px-3 text-slate-500 font-semibold dark:text-muted-foreground"
                          >
                            Clear
                          </Button>
                        </div>

                        <div className="max-h-52 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredEmployeesForScope.map((emp) => {
                            const isSelected = selectedEmployeeIds.includes(emp.id);
                            return (
                              <div
                                key={emp.id}
                                onClick={() => toggleEmployeeSelection(emp.id)}
                                className={cn(
                                  'p-2.5 rounded-lg text-sm flex items-center justify-between cursor-pointer transition-colors',
                                  isSelected
                                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                                    : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium'
                                )}
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {emp.firstName} {emp.lastName}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block truncate">
                                    #{emp.employeeNumber} · {emp.jobRole?.title || 'Staff'}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                    isSelected
                                      ? 'bg-teal-700 border-teal-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  )}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Employee Count Summary Bar */}
                    <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 flex flex-wrap items-center justify-between gap-2.5 text-sm">
                      <div>
                        <span className="font-semibold text-teal-950 dark:text-teal-100">
                          Employees Selected:{' '}
                        </span>
                        <span className="font-bold text-teal-700 dark:text-teal-300 text-sm sm:text-base">
                          {resolvedEmployees.length} staff member{resolvedEmployees.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {resolvedEmployees.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowParticipantList((prev) => !prev)}
                          className="text-xs sm:text-sm h-8 px-3 font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-primary-300"
                        >
                          {showParticipantList ? 'Hide List' : 'View Employees'}
                        </Button>
                      )}
                    </div>

                    {/* Localized View List */}
                    {showParticipantList && resolvedEmployees.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-slate-900">
                        {resolvedEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm flex items-center justify-between"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="font-mono text-xs text-slate-500 font-semibold dark:text-muted-foreground">
                              #{emp.employeeNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 3: EVALUATORS & REVIEW ── */}
            {currentStep === 3 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="Who is the head / supervisor / coordinator evaluator?"
                  subtitle={
                    weighted
                      ? 'Every employee also completes a self rating. Peer evaluators are chosen per employee after the cycle is created.'
                      : 'In a Standard Evaluation the head / supervisor / coordinator is the only evaluator.'
                  }
                >
                  <div className="space-y-4 pt-1">
                    {/* Evaluator Assignment Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          id: 'SUPERVISOR',
                          title: 'Immediate Supervisor',
                          desc: "Starts from each employee's immediate supervisor. HR can change any of them afterwards.",
                        },
                        {
                          id: 'ONE_EVALUATOR',
                          title: 'One Evaluator',
                          desc: 'One designated head evaluator for everyone in this cycle. HR can change any of them afterwards.',
                        },
                        {
                          id: 'MANUAL',
                          title: 'Manual Assignment',
                          desc: "HR assigns each employee's head evaluator after the cycle is created.",
                        },
                      ].map((m) => {
                        const isSelected = evaluatorMethod === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEvaluatorMethod(m.id as any)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all space-y-1.5',
                              isSelected
                                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500 font-bold'
                                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                            )}
                          >
                            <span className="text-sm sm:text-base font-bold block">{m.title}</span>
                            <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">
                              {m.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Single Evaluator Selector */}
                    {evaluatorMethod === 'ONE_EVALUATOR' && (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                        <EmployeePicker
                          employees={designatedOptions}
                          selectedEmployee={selectedEvaluatorEmployee}
                          onSelect={(emp) => setDefaultEvaluatorId(emp?.id || '')}
                          label="Designated Evaluator"
                          required
                        />
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          HR and other full-access administrators are not listed: they administer the evaluation and do not rate.
                        </p>
                      </div>
                    )}

                    {/* The result, as the chosen evaluation type calculates it */}
                    <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5 text-xs">
                      <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 block">
                        Result — {evaluationMode ? (weighted ? 'Weighted Multi-Rater Evaluation' : 'Standard Evaluation') : 'evaluation type not chosen'}
                      </span>
                      {weighted ? (
                        <>
                          <p className="text-foreground">
                            {official
                              ? `Self rating ${official.self}% + Peer rating ${official.peer}% + Head / supervisor / coordinator ${official.head}% = 100% — ${config?.officialSourceWeightsLabel ?? 'the official weighting'}.`
                              : 'Self + Peer + Head / supervisor / coordinator, at the official weighting.'}
                          </p>
                          <p className="text-muted-foreground">
                            Several peer evaluators share the one peer percentage — their scores are averaged first. A missing rating is never re-weighted: HR finalizes only when the self, peer and head ratings are all in.
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">
                          The head / supervisor / coordinator's ratings: each review area's average and the overall result (and its percentage) are calculated automatically.
                        </p>
                      )}
                    </div>

                    {/* Which template each employee gets */}
                    <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 space-y-2 text-xs">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Templates that will be used</h4>
                      {previewLoading ? (
                        <p className="text-muted-foreground">Checking each employee's job role…</p>
                      ) : preview ? (
                        <>
                          <ul className="space-y-1">
                            {preview.byTemplate.map((b) => (
                              <li key={b.templateId} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-foreground">{b.isOfficial ? 'Official · ' : ''}{b.name}</span>
                                <span className="text-muted-foreground">{b.count} employee{b.count === 1 ? '' : 's'}</span>
                              </li>
                            ))}
                          </ul>
                          {preview.employees.length > 0 && (
                            <button type="button" onClick={() => setShowPreviewList((v) => !v)} className="font-semibold text-primary-700 dark:text-primary-300 hover:underline">
                              {showPreviewList ? 'Hide' : 'Show'} each employee's template
                            </button>
                          )}
                          {showPreviewList && (
                            <ul className="max-h-60 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                              {preview.employees.map((e) => (
                                <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-foreground">{e.firstName} {e.lastName} <span className="text-muted-foreground">· {e.jobRole?.title ?? 'No job role'}</span></span>
                                  <span className="text-muted-foreground">
                                    {e.template.name} <span className="text-[11px]">({e.template.source === 'JOB_ROLE' ? 'job role' : 'cycle template'})</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">The preview could not be loaded.</p>
                      )}
                    </div>

                    {/* Clear Review Summary Card */}
                    <div className="p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5 text-xs">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Cycle Summary
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-slate-200 dark:border-slate-700 pt-3">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Cycle Name
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg block mt-0.5">
                            {name}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Evaluation Period
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base block mt-0.5">
                            {startDate} — {dueDate}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Evaluation Type
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base block mt-0.5">
                            {weighted ? `Weighted Multi-Rater${official ? ` (${official.self} / ${official.peer} / ${official.head})` : ''}` : 'Standard'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Template
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate block mt-0.5">
                            {selectedTemplate?.name || 'Selected Template'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Employees to Evaluate
                          </span>
                          <span className="font-bold text-teal-800 dark:text-teal-300 text-sm sm:text-base block mt-0.5">
                            {resolvedEmployees.length} staff member{resolvedEmployees.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="sm:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Evaluator Assignment
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base block mt-0.5">
                            {evaluatorMethod === 'SUPERVISOR'
                              ? 'Immediate Supervisor'
                              : evaluatorMethod === 'ONE_EVALUATOR'
                              ? `Designated Evaluator: ${selectedEvaluatorEmployee ? `${selectedEvaluatorEmployee.firstName} ${selectedEvaluatorEmployee.lastName}` : 'Selected'}`
                              : 'Manual Assignment'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}
          </div>

          <WorkflowModalFooter
            onCancel={() => onOpenChange(false)}
            onBack={currentStep > 1 ? handleBack : undefined}
            primaryLabel={currentStep === 3 ? 'Create Evaluation Cycle' : 'Next'}
            isSubmitting={saving}
            canProceed={activeTemplates.length > 0}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
