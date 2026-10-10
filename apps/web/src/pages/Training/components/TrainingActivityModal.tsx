import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Building,
  Users,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  TrainingService,
  TrainingActivity,
  TrainingActivityType,
  TRAINING_TYPE_LABELS,
  CreateTrainingActivityDto,
  UpdateTrainingActivityDto,
} from '@/services/training.service';
import { ComplianceRequirement } from '@/services/compliance.service';
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
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface TrainingActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityToEdit?: TrainingActivity | null;
  onSuccess: () => void;
}

interface UnitItem {
  id: string;
  name: string;
}

interface DepartmentItem {
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
  unitId?: string | null;
  departmentId?: string | null;
  jobRoleId?: string | null;
  unit?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  jobRole?: { id: string; title: string } | null;
  employmentState?: string;
}

type ScopeMode = 'ALL' | 'UNIT' | 'DEPARTMENT' | 'JOB_ROLE' | 'EMPLOYEE';

export function TrainingActivityModal({
  open,
  onOpenChange,
  activityToEdit,
  onSuccess,
}: TrainingActivityModalProps) {
  const isEdit = Boolean(activityToEdit);

  // Stepper State (1: Activity, 2: Schedule & Details, 3: Participants, 4: Review)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showParticipantList, setShowParticipantList] = useState<boolean>(false);

  // Form Fields - Step 1: Activity
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<TrainingActivityType>('TRAINING');
  const [description, setDescription] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [venue, setVenue] = useState<string>('');

  // Form Fields - Step 2: Schedule & Details
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [hoursCredit, setHoursCredit] = useState<string>('');
  const [maxParticipants, setMaxParticipants] = useState<string>('');
  const [complianceRequirementId, setComplianceRequirementId] = useState<string>('');
  const [materialsUrl, setMaterialsUrl] = useState<string>('');

  // Form Fields - Step 3: Participants (Create mode)
  const [scopeMode, setScopeMode] = useState<ScopeMode>('ALL');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Reference Data
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [trainingRequirements, setTrainingRequirements] = useState<ComplianceRequirement[]>([]);
  const [loadingOrg, setLoadingOrg] = useState<boolean>(false);

  // Submission & Validation State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Load organizational data and training compliance requirements
  useEffect(() => {
    if (!open) return;

    setCurrentStep(1);
    setShowParticipantList(false);

    if (activityToEdit) {
      setTitle(activityToEdit.title || '');
      setType(activityToEdit.type || 'TRAINING');
      setDescription(activityToEdit.description || '');
      setProvider(activityToEdit.provider || '');
      setVenue(activityToEdit.venue || '');
      setStartDate(activityToEdit.startDate ? activityToEdit.startDate.split('T')[0] : '');
      setStartTime(activityToEdit.startTime || '');
      setEndDate(activityToEdit.endDate ? activityToEdit.endDate.split('T')[0] : '');
      setEndTime(activityToEdit.endTime || '');
      setHoursCredit(activityToEdit.hoursCredit ? String(activityToEdit.hoursCredit) : '');
      setMaxParticipants(activityToEdit.maxParticipants ? String(activityToEdit.maxParticipants) : '');
      setComplianceRequirementId(activityToEdit.complianceRequirementId || '');
      setMaterialsUrl(activityToEdit.materialsUrl || '');
      setStepError(null);
    } else {
      setTitle('');
      setType('TRAINING');
      setDescription('');
      setProvider('');
      setVenue('');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setStartTime('09:00');
      setEndDate(today);
      setEndTime('17:00');
      setHoursCredit('8');
      setMaxParticipants('');
      setComplianceRequirementId('');
      setMaterialsUrl('');
      setScopeMode('ALL');
      setSelectedUnitId('');
      setSelectedDeptId('');
      setSelectedJobRoleId('');
      setSelectedEmployeeIds([]);
      setEmployeeSearch('');
      setStepError(null);
    }

    const loadRefData = async () => {
      setLoadingOrg(true);
      try {
        const [uRes, dRes, rRes, cRes] = await Promise.allSettled([
          api.get('/employees/units'),
          api.get('/departments'),
          api.get('/employees/job-roles'),
          api.get('/compliance/requirements'),
        ]);

        if (uRes.status === 'fulfilled') setUnits(uRes.value.data?.data || []);
        if (dRes.status === 'fulfilled') setDepartments(dRes.value.data?.data || []);
        if (rRes.status === 'fulfilled') setJobRoles(rRes.value.data?.data || []);
        if (cRes.status === 'fulfilled') {
          const allReqs: ComplianceRequirement[] = cRes.value.data?.data || [];
          const trainingOnly = allReqs.filter(
            (r) => r.category === 'TRAINING' && r.lifecycle === 'ACTIVE'
          );
          setTrainingRequirements(trainingOnly);
        }
        // allSettled never throws — say so when a targeting list is missing.
        const failed = [uRes, dRes, rRes, cRes].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        if (failed) {
          toast.error(
            getApiErrorMessage(failed.reason, 'Some targeting choices could not be loaded.') +
              ' Units, departments, job roles or training requirements may be missing — close and reopen this window to try again.',
            { id: 'training-ref-lists' }
          );
        }

        let allEmps: EmployeeItem[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const empRes = await api.get(
            `/employees?page=${page}&limit=500&employmentState=ACTIVE&isArchived=false`
          );
          const pageData = empRes.data?.data || [];
          allEmps = allEmps.concat(pageData);
          totalPages = empRes.data?.totalPages || 1;
          page++;
          if (page > 20) break;
        }
        setEmployees(allEmps);
      } catch (err) {
        toast.error(
          getApiErrorMessage(err, 'The units, job roles and employees for targeting could not be loaded.') +
            ' Close and reopen this window to try again.',
          { id: 'training-ref-data' }
        );
      } finally {
        setLoadingOrg(false);
      }
    };

    loadRefData();
  }, [open, activityToEdit]);

  // Target Employee Resolution
  const resolvedTargetEmployees = useMemo(() => {
    if (isEdit) return [];
    if (scopeMode === 'ALL') {
      return employees;
    }
    if (scopeMode === 'UNIT') {
      if (!selectedUnitId) return [];
      return employees.filter((e) => e.unitId === selectedUnitId || e.unit?.id === selectedUnitId);
    }
    if (scopeMode === 'DEPARTMENT') {
      if (!selectedDeptId) return [];
      return employees.filter(
        (e) => e.departmentId === selectedDeptId || e.department?.id === selectedDeptId
      );
    }
    if (scopeMode === 'JOB_ROLE') {
      if (!selectedJobRoleId) return [];
      return employees.filter(
        (e) => e.jobRoleId === selectedJobRoleId || e.jobRole?.id === selectedJobRoleId
      );
    }
    if (scopeMode === 'EMPLOYEE') {
      return employees.filter((e) => selectedEmployeeIds.includes(e.id));
    }
    return [];
  }, [
    isEdit,
    scopeMode,
    employees,
    selectedUnitId,
    selectedDeptId,
    selectedJobRoleId,
    selectedEmployeeIds,
  ]);

  const resolvedTargetEmployeeIds = useMemo(
    () => resolvedTargetEmployees.map((e) => e.id),
    [resolvedTargetEmployees]
  );

  // Filtered employees for multi-select
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

  const handleSelectAllFilteredEmployees = () => {
    const idsToAdd = filteredEmployeesForScope.map((e) => e.id);
    setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleClearEmployeeSelections = () => {
    setSelectedEmployeeIds([]);
  };

  // Selected Compliance Requirement object
  const selectedComplianceReq = useMemo(() => {
    return trainingRequirements.find((r) => r.id === complianceRequirementId);
  }, [trainingRequirements, complianceRequirementId]);

  // Capacity Exceeded Check
  const isCapacityExceeded = useMemo(() => {
    if (isEdit || !maxParticipants) return false;
    const limit = Number(maxParticipants);
    return !isNaN(limit) && limit > 0 && resolvedTargetEmployeeIds.length > limit;
  }, [isEdit, maxParticipants, resolvedTargetEmployeeIds]);

  // Validate Step 1 (Activity Details)
  const validateStep1 = () => {
    setStepError(null);
    if (!title.trim()) {
      setStepError('Activity title is required.');
      return false;
    }
    if (!provider.trim()) {
      setStepError('Provider / Facilitator name is required.');
      return false;
    }
    if (!venue.trim()) {
      setStepError('Venue / Location is required.');
      return false;
    }
    return true;
  };

  // Validate Step 2 (Schedule & Details)
  const validateStep2 = () => {
    setStepError(null);
    if (!startDate) {
      setStepError('Start date is required.');
      return false;
    }
    if (!endDate) {
      setStepError('End date is required.');
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setStepError('Please enter valid start and end dates.');
      return false;
    }
    if (end < start) {
      setStepError('End date cannot be earlier than start date.');
      return false;
    }

    const parsedHours = hoursCredit ? Number(hoursCredit) : undefined;
    if (parsedHours !== undefined && (isNaN(parsedHours) || parsedHours < 0)) {
      setStepError('Hours credit must be a positive number.');
      return false;
    }

    const parsedMax = maxParticipants ? Number(maxParticipants) : undefined;
    if (parsedMax !== undefined && (isNaN(parsedMax) || parsedMax <= 0)) {
      setStepError('Maximum participants must be a positive whole number.');
      return false;
    }

    return true;
  };

  // Validate Step 3 (Participants)
  const validateStep3 = () => {
    setStepError(null);
    if (scopeMode === 'UNIT' && !selectedUnitId) {
      setStepError('Please select a target unit.');
      return false;
    }
    if (scopeMode === 'DEPARTMENT' && !selectedDeptId) {
      setStepError('Please select a target department.');
      return false;
    }
    if (scopeMode === 'JOB_ROLE' && !selectedJobRoleId) {
      setStepError('Please select a target job role.');
      return false;
    }
    if (scopeMode === 'EMPLOYEE' && selectedEmployeeIds.length === 0) {
      setStepError('Please select at least one specific employee.');
      return false;
    }
    if (isCapacityExceeded) {
      setStepError(
        `Targeted participants (${resolvedTargetEmployeeIds.length}) exceed activity capacity (${maxParticipants}).`
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(isEdit ? 4 : 3);
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
        setCurrentStep(4);
      }
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (currentStep === 4) {
      setCurrentStep(isEdit ? 2 : 3);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Final Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }

    setStepError(null);
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!isEdit && !validateStep3()) {
      setCurrentStep(3);
      return;
    }

    const parsedHours = hoursCredit ? Number(hoursCredit) : undefined;
    const parsedMax = maxParticipants ? Number(maxParticipants) : undefined;

    setSubmitting(true);

    try {
      if (isEdit && activityToEdit) {
        const updatePayload: UpdateTrainingActivityDto = {
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          provider: provider.trim(),
          venue: venue.trim(),
          startDate,
          startTime: startTime || undefined,
          endDate,
          endTime: endTime || undefined,
          hoursCredit: parsedHours,
          maxParticipants: parsedMax,
          complianceRequirementId: complianceRequirementId || null,
          materialsUrl: materialsUrl.trim() || undefined,
        };
        await TrainingService.updateActivity(activityToEdit.id, updatePayload);
        toast.success('Training activity updated successfully.');
      } else {
        const createPayload: CreateTrainingActivityDto = {
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          provider: provider.trim(),
          venue: venue.trim(),
          startDate,
          startTime: startTime || undefined,
          endDate,
          endTime: endTime || undefined,
          hoursCredit: parsedHours,
          maxParticipants: parsedMax,
          status: 'SCHEDULED',
          complianceRequirementId: complianceRequirementId || null,
          materialsUrl: materialsUrl.trim() || undefined,
          participantEmployeeIds: resolvedTargetEmployeeIds,
        };
        await TrainingService.createActivity(createPayload);
        toast.success(
          `Training activity created with ${resolvedTargetEmployeeIds.length} participant${
            resolvedTargetEmployeeIds.length === 1 ? '' : 's'
          }.`
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg =
        getApiErrorMessage(err, 'Failed to save training activity. Please check your inputs.');
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = isEdit
    ? [
        { id: 1, label: 'Activity' },
        { id: 2, label: 'Schedule & Details' },
        { id: 4, label: 'Review & Save' },
      ]
    : [
        { id: 1, label: 'Activity' },
        { id: 2, label: 'Schedule & Details' },
        { id: 3, label: 'Participants' },
        { id: 4, label: 'Review' },
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={workflowModalStyles.container('wide')}>
        <WorkflowModalHeader
          icon={BookOpen}
          title={isEdit ? 'Edit Training / Seminar Activity' : 'Create Training / Seminar Activity'}
          subtitle={
            isEdit
              ? 'Update activity schedule, venue, facilitator, or compliance linkage.'
              : 'Set activity details, schedule, and participant roster.'
          }
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

            {/* ── STEP 1: ACTIVITY ── */}
            {currentStep === 1 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="What activity are you creating?"
                  subtitle="Specify the activity title, category, facilitator, and venue"
                >
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-8 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Activity Title <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Fire Safety & Emergency Response Seminar"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
                          required
                        />
                      </div>

                      <div className="sm:col-span-4 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Activity Type <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as TrainingActivityType)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900"
                        >
                          {Object.entries(TRAINING_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Provider / Facilitator <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Philippine Red Cross, Safety Officer"
                          value={provider}
                          onChange={(e) => setProvider(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Venue / Location <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Hospicio Main Auditorium, Online Zoom"
                          value={venue}
                          onChange={(e) => setVenue(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
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
                        placeholder="Brief summary of learning objectives, agenda, or prerequisites..."
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

            {/* ── STEP 2: SCHEDULE & DETAILS ── */}
            {currentStep === 2 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="When will it happen?"
                  subtitle="Set activity schedule, hours credit, capacity, and optional compliance link"
                >
                  <div className="space-y-4 pt-1">
                    {/* Schedule Cards Side by Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-2.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Start Schedule
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Date *</label>
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="text-sm font-medium h-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-lg"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Time</label>
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="text-sm font-medium h-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-2.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" /> End Schedule
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Date *</label>
                            <Input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="text-sm font-medium h-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-lg"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Time</label>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="text-sm font-medium h-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Details Grid */}
                    <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-3.5">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Additional Details
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Hours Credit
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="e.g. 8"
                            value={hoursCredit}
                            onChange={(e) => setHoursCredit(e.target.value)}
                            className="text-sm sm:text-base font-medium h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Capacity Limit
                          </label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Unlimited"
                            value={maxParticipants}
                            onChange={(e) => setMaxParticipants(e.target.value)}
                            className="text-sm sm:text-base font-medium h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Materials Link
                          </label>
                          <Input
                            placeholder="https://drive.google.com/..."
                            value={materialsUrl}
                            onChange={(e) => setMaterialsUrl(e.target.value)}
                            className="text-sm sm:text-base font-medium h-11 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Compliance Requirement
                          </label>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
                        </div>
                        <select
                          value={complianceRequirementId}
                          onChange={(e) => setComplianceRequirementId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        >
                          <option value="">None / Standalone Training</option>
                          {trainingRequirements.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                          Completed participants will automatically satisfy the selected requirement.
                        </p>
                      </div>
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ── STEP 3: PARTICIPANTS ── */}
            {currentStep === 3 && !isEdit && (
              <div className="space-y-5 py-2 max-w-4xl mx-auto w-full">
                <WorkflowSection
                  title="Who should attend?"
                  subtitle="Select target audience to generate the participant roster"
                >
                  <div className="space-y-4 pt-1">
                    {/* Targeting scope cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { id: 'ALL', title: 'Everyone', desc: 'All active employees across all units.' },
                        { id: 'UNIT', title: 'Specific Unit', desc: 'Employees in a specific unit.' },
                        { id: 'DEPARTMENT', title: 'Department', desc: 'Employees in a department.' },
                        { id: 'JOB_ROLE', title: 'Job Role', desc: 'Employees with a specific title.' },
                        { id: 'EMPLOYEE', title: 'Specific Employees', desc: 'Hand-pick individual staff.' },
                      ].map((mode) => {
                        const isSelected = scopeMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => {
                              setScopeMode(mode.id as ScopeMode);
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
                    {scopeMode === 'UNIT' && (
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

                    {scopeMode === 'DEPARTMENT' && (
                      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Choose Department <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <select
                          value={selectedDeptId}
                          onChange={(e) => setSelectedDeptId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          required
                        >
                          <option value="">Select a department...</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {scopeMode === 'JOB_ROLE' && (
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

                    {scopeMode === 'EMPLOYEE' && (
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
                            onClick={handleSelectAllFilteredEmployees}
                            className="text-xs sm:text-sm h-11 px-3.5 font-semibold"
                          >
                            Select Matches
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearEmployeeSelections}
                            className="text-xs sm:text-sm h-11 px-3 text-slate-500 font-semibold dark:text-muted-foreground"
                          >
                            Clear
                          </Button>
                        </div>

                        {/* Local scroll list for employee selection */}
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

                    {/* Participant Summary Bar */}
                    <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 flex flex-wrap items-center justify-between gap-2.5 text-sm">
                      <div>
                        <span className="font-semibold text-teal-950 dark:text-teal-100">
                          Participants Selected:{' '}
                        </span>
                        <span className="font-bold text-teal-700 dark:text-teal-300 text-sm sm:text-base">
                          {resolvedTargetEmployeeIds.length} employee{resolvedTargetEmployeeIds.length === 1 ? '' : 's'}
                        </span>
                        {maxParticipants && (
                          <span className="text-slate-600 dark:text-slate-400 font-medium ml-2 text-xs sm:text-sm">
                            ({resolvedTargetEmployeeIds.length} of {maxParticipants} capacity limit)
                          </span>
                        )}
                      </div>

                      {resolvedTargetEmployeeIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowParticipantList((prev) => !prev)}
                          className="text-xs sm:text-sm h-8 px-3 font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-primary-300"
                        >
                          {showParticipantList ? 'Hide List' : 'View List'}
                        </Button>
                      )}
                    </div>

                    {/* Inline Capacity Warning */}
                    {isCapacityExceeded && (
                      <div className="p-3.5 rounded-xl bg-status-warning-surface border border-status-warning-border text-status-warning-foreground text-sm flex items-start gap-2.5 shadow-xs">
                        <AlertTriangle className="w-4 h-4 text-status-warning-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Participant Limit Exceeded</p>
                          <p className="mt-0.5 text-xs sm:text-sm font-medium">
                            Targeted participants ({resolvedTargetEmployeeIds.length}) exceed activity capacity of {maxParticipants}.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Localized View List */}
                    {showParticipantList && resolvedTargetEmployees.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-slate-900">
                        {resolvedTargetEmployees.map((emp) => (
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

            {/* ── STEP 4: REVIEW ── */}
            {currentStep === 4 && (
              <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                <WorkflowSection
                  title="Review training activity"
                  subtitle="Verify details before creating or saving the activity"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Left Review Summary */}
                    <div className="p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5">
                      <div>
                        <Badge
                          variant="outline"
                          className="text-xs bg-teal-50 text-teal-700 border-teal-200 mb-1.5 font-semibold dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900"
                        >
                          {TRAINING_TYPE_LABELS[type] || type}
                        </Badge>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                          {title}
                        </h3>
                        {description && (
                          <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium mt-1 line-clamp-2">{description}</p>
                        )}
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2.5">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            When
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {startDate} {startTime && `at ${startTime}`} — {endDate}{' '}
                            {endTime && `at ${endTime}`}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Where & Provider
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {venue} · {provider}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Review Summary */}
                    <div className="p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Participants
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {isEdit
                              ? 'Existing Roster'
                              : `${resolvedTargetEmployeeIds.length} employee${
                                  resolvedTargetEmployeeIds.length === 1 ? '' : 's'
                                }`}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Capacity Limit
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {maxParticipants ? `${maxParticipants} max` : 'Unlimited'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Hours Credit
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                            {hoursCredit ? `${hoursCredit} hrs` : 'None'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Compliance Link
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate block">
                            {selectedComplianceReq ? selectedComplianceReq.title : 'None / Standalone'}
                          </span>
                        </div>
                      </div>

                      {materialsUrl && (
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Materials Link
                          </span>
                          <span className="text-teal-700 dark:text-teal-400 font-mono text-xs sm:text-sm font-semibold truncate block">
                            {materialsUrl}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}
          </div>

          <WorkflowModalFooter
            onCancel={() => onOpenChange(false)}
            onBack={currentStep > 1 ? handleBack : undefined}
            primaryLabel={
              currentStep === 4
                ? isEdit
                  ? 'Save Changes'
                  : 'Create Training / Seminar'
                : 'Next'
            }
            isSubmitting={submitting}
            canProceed={!isCapacityExceeded}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
