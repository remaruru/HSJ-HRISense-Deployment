import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Megaphone,
  Pin,
  Calendar,
  Clock,
  Users,
  Building2,
  Briefcase,
  User,
  Plus,
  Trash2,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle2,
  Eye,
  Info,
  Layers,
  Lock,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Announcement,
  AnnouncementPriority,
  AnnouncementScopeType,
  ScopeInput,
  AnnouncementService,
  AudiencePreviewEmployee,
  AnnouncementAttachment,
} from '@/services/announcement.service';
import { api } from '@/services/api';
import {
  WorkflowModalHeader,
  WorkflowStepper,
  WorkflowSection,
  workflowModalStyles,
  WorkflowStep,
} from '@/components/shared/WorkflowModal';
import { AudiencePreviewModal } from './AudiencePreviewModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore } from 'date-fns';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from '@/components/shared/LoadError';

interface AnnouncementWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcementToEdit?: Announcement | null;
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
  jobRole?: { title: string } | null;
  department?: { name: string } | null;
  unit?: { name: string } | null;
}

const WIZARD_STEPS: WorkflowStep[] = [
  { id: 1, label: 'Announcement', description: 'Title & message' },
  { id: 2, label: 'Audience', description: 'Target recipients' },
  { id: 3, label: 'Schedule', description: 'Publishing & expiry' },
  { id: 4, label: 'Review', description: 'Confirm & save' },
];

export function AnnouncementWizardModal({
  open,
  onOpenChange,
  announcementToEdit,
  onSuccess,
}: AnnouncementWizardModalProps) {
  const isEditing = Boolean(announcementToEdit);
  const isPublishedEdit = announcementToEdit?.derivedStatus === 'PUBLISHED' || announcementToEdit?.derivedStatus === 'EXPIRED';

  // ── Step State ──
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatusText, setSubmitStatusText] = useState<string>('');

  // ── Step 1: Announcement Info ──
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [priority, setPriority] = useState<AnnouncementPriority>('NORMAL');
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Attachments
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AnnouncementAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Audience Scopes ──
  const [scopes, setScopes] = useState<ScopeInput[]>([{ scopeType: 'ALL' }]);
  const [audienceMode, setAudienceMode] = useState<AnnouncementScopeType>('ALL');

  // Specific scope targets being added
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Reference Data
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loadingRefData, setLoadingRefData] = useState<boolean>(false);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  // Live Audience Preview
  const [previewRecipients, setPreviewRecipients] = useState<number>(0);
  const [previewSample, setPreviewSample] = useState<AudiencePreviewEmployee[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  // ── Step 3: Schedule ──
  const [publishMode, setPublishMode] = useState<'NOW' | 'LATER'>('NOW');
  const [publishDate, setPublishDate] = useState<string>('');
  const [publishTime, setPublishTime] = useState<string>('09:00');

  const [hasExpiry, setHasExpiry] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [expiryTime, setExpiryTime] = useState<string>('17:00');

  // Load org reference data
  useEffect(() => {
    if (!open) return;
    const fetchOrgData = async () => {
      setLoadingRefData(true);
      try {
        const [uRes, dRes, rRes, eRes] = await Promise.allSettled([
          api.get('/units'),
          api.get('/departments'),
          api.get('/job-roles'),
          api.get('/employees?limit=500&employmentState=ACTIVE&isArchived=false'),
        ]);

        if (uRes.status === 'fulfilled') setUnits(uRes.value.data?.data || []);
        if (dRes.status === 'fulfilled') setDepartments(dRes.value.data?.data || []);
        if (rRes.status === 'fulfilled') setJobRoles(rRes.value.data?.data || []);
        if (eRes.status === 'fulfilled') setEmployees(eRes.value.data?.data || []);
        // allSettled never throws: a list that failed would otherwise just be
        // missing from the targeting choices without a word.
        const failed = [uRes, dRes, rRes, eRes].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setRefDataError(
          failed
            ? getApiErrorMessage(failed.reason, 'Some targeting choices could not be loaded.') +
                ' Some units, departments, job roles or employees may be missing from the lists — close and reopen this window to try again.'
            : null
        );
      } finally {
        setLoadingRefData(false);
      }
    };

    fetchOrgData();
  }, [open]);

  // Reset or Populate form when modal opens
  useEffect(() => {
    if (!open) return;

    setCurrentStep(1);
    setStepError(null);
    setIsSubmitting(false);
    setSubmitStatusText('');
    setStagedFiles([]);

    if (announcementToEdit) {
      setTitle(announcementToEdit.title || '');
      setBody(announcementToEdit.body || announcementToEdit.content || '');
      setPriority(announcementToEdit.priority || 'NORMAL');
      setIsPinned(Boolean(announcementToEdit.isPinned));
      setExistingAttachments(announcementToEdit.attachments || []);

      // Scopes
      if (announcementToEdit.audienceScopes && announcementToEdit.audienceScopes.length > 0) {
        setScopes(
          announcementToEdit.audienceScopes.map((s) => ({
            scopeType: s.scopeType,
            targetUnitId: s.targetUnitId,
            targetDepartmentId: s.targetDepartmentId,
            targetJobRoleId: s.targetJobRoleId,
            targetEmployeeId: s.targetEmployeeId,
          }))
        );
      } else {
        setScopes([{ scopeType: 'ALL' }]);
      }

      // Schedule
      if (announcementToEdit.publishAt) {
        const pDate = new Date(announcementToEdit.publishAt);
        setPublishDate(format(pDate, 'yyyy-MM-dd'));
        setPublishTime(format(pDate, 'HH:mm'));
        setPublishMode(announcementToEdit.derivedStatus === 'SCHEDULED' ? 'LATER' : 'NOW');
      } else {
        setPublishMode('NOW');
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setPublishDate(format(tomorrow, 'yyyy-MM-dd'));
        setPublishTime('09:00');
      }

      // Expiry
      if (announcementToEdit.expiresAt) {
        setHasExpiry(true);
        const eDate = new Date(announcementToEdit.expiresAt);
        setExpiryDate(format(eDate, 'yyyy-MM-dd'));
        setExpiryTime(format(eDate, 'HH:mm'));
      } else {
        setHasExpiry(false);
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        setExpiryDate(format(nextWeek, 'yyyy-MM-dd'));
        setExpiryTime('17:00');
      }
    } else {
      // Default new state
      setTitle('');
      setBody('');
      setPriority('NORMAL');
      setIsPinned(false);
      setExistingAttachments([]);
      setScopes([{ scopeType: 'ALL' }]);
      setAudienceMode('ALL');

      setPublishMode('NOW');
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setPublishDate(format(tomorrow, 'yyyy-MM-dd'));
      setPublishTime('09:00');

      setHasExpiry(false);
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setExpiryDate(format(nextWeek, 'yyyy-MM-dd'));
      setExpiryTime('17:00');
    }
  }, [open, announcementToEdit]);

  // Debounced audience preview
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAudiencePreview = useCallback(async (currentScopes: ScopeInput[]) => {
    if (!currentScopes || currentScopes.length === 0) {
      setPreviewRecipients(0);
      setPreviewSample([]);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await AnnouncementService.previewAudience(currentScopes);
      setPreviewRecipients(res.totalRecipients);
      setPreviewSample(res.previewEmployees);
    } catch (err) {
      // Unknown, not zero: publishing stays blocked until a count is confirmed.
      setPreviewRecipients(0);
      setPreviewSample([]);
      setPreviewError(getApiErrorMessage(err, 'The recipient count could not be worked out.'));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    previewTimerRef.current = setTimeout(() => {
      runAudiencePreview(scopes);
    }, 250);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [scopes, open, runAudiencePreview]);

  // ── Step 1 File Staging ──
  const handleAddLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const newValidFiles: File[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large. Maximum file size is 10 MB.`);
        continue;
      }

      if (!allowedMimes.includes(file.type)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'].includes(ext || '')) {
          toast.error(`"${file.name}" has an unsupported format. Please upload PDF, JPG, PNG, WEBP, or DOC/DOCX.`);
          continue;
        }
      }

      newValidFiles.push(file);
    }

    if (newValidFiles.length > 0) {
      setStagedFiles((prev) => [...prev, ...newValidFiles]);
      toast.success(`${newValidFiles.length} file(s) added.`);
    }
  };

  const handleRemoveStagedFile = (idx: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    if (!announcementToEdit) return;
    try {
      await AnnouncementService.deleteAttachment(announcementToEdit.id, attachmentId);
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Attachment removed.');
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to remove attachment.'));
    }
  };

  // ── Step 2 Scope Management ──
  const handleSelectEveryone = () => {
    setScopes([{ scopeType: 'ALL' }]);
    setAudienceMode('ALL');
  };

  /**
   * Picking a specific target group drops "Everyone".
   *
   * The two are mutually exclusive — Everyone already covers all staff — but the
   * picker below is only rendered when Everyone is NOT selected. Leaving it on
   * meant clicking Department or Individual highlighted the button and then
   * showed nothing, so those groups looked broken.
   */
  const handleChooseTargetGroup = (mode: typeof audienceMode) => {
    setAudienceMode(mode);
    setScopes((prev) => prev.filter((s) => s.scopeType !== 'ALL'));
  };

  const handleAddScope = (newScope: ScopeInput) => {
    // If scopes currently only contains ALL, replace it with the specific scope
    if (scopes.length === 1 && scopes[0].scopeType === 'ALL') {
      setScopes([newScope]);
      return;
    }

    // Check for duplicates
    const isDuplicate = scopes.some((s) => {
      if (s.scopeType !== newScope.scopeType) return false;
      if (s.scopeType === 'UNIT') return s.targetUnitId === newScope.targetUnitId;
      if (s.scopeType === 'DEPARTMENT') return s.targetDepartmentId === newScope.targetDepartmentId;
      if (s.scopeType === 'JOB_ROLE') return s.targetJobRoleId === newScope.targetJobRoleId;
      if (s.scopeType === 'EMPLOYEE') return s.targetEmployeeId === newScope.targetEmployeeId;
      return true;
    });

    if (isDuplicate) {
      toast.info('This audience group is already added.');
      return;
    }

    setScopes((prev) => [...prev, newScope]);
  };

  const handleRemoveScope = (indexToRemove: number) => {
    const updated = scopes.filter((_, i) => i !== indexToRemove);
    if (updated.length === 0) {
      setScopes([{ scopeType: 'ALL' }]);
      setAudienceMode('ALL');
    } else {
      setScopes(updated);
    }
  };

  // ── Step Navigation Validation ──
  const validateStep = (step: number): boolean => {
    setStepError(null);

    if (step === 1) {
      if (!title.trim()) {
        setStepError('Please enter an announcement title.');
        return false;
      }
      if (!body.trim()) {
        setStepError('Please write an announcement message.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!isPublishedEdit && scopes.length === 0) {
        setStepError('Please choose who should receive this announcement.');
        return false;
      }
      if (!isPublishedEdit && previewError) {
        setStepError('The recipient count could not be confirmed. Use Try Again on the audience preview before continuing.');
        return false;
      }
      if (!isPublishedEdit && previewRecipients === 0) {
        setStepError('No active employees match the selected audience. Please adjust your targeting.');
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (publishMode === 'LATER') {
        if (!publishDate) {
          setStepError('Please choose a publish date.');
          return false;
        }
        const publishDateTime = new Date(`${publishDate}T${publishTime || '00:00'}:00`);
        if (publishDateTime <= new Date()) {
          setStepError('The publish time must be in the future.');
          return false;
        }
      }

      if (hasExpiry) {
        if (!expiryDate) {
          setStepError('Please select an end date for this announcement.');
          return false;
        }
        const expiryDateTime = new Date(`${expiryDate}T${expiryTime || '23:59'}:00`);
        const compareBase =
          publishMode === 'LATER' && publishDate
            ? new Date(`${publishDate}T${publishTime || '00:00'}:00`)
            : new Date();

        if (expiryDateTime <= compareBase) {
          setStepError('The end date and time must be after the publish time.');
          return false;
        }
      }

      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStepError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // ── Final Action Submissions (Save Draft / Publish / Schedule) ──

  const executeSaveOrPublish = async (actionType: 'SAVE_DRAFT' | 'PUBLISH_NOW' | 'SCHEDULE') => {
    setStepError(null);

    // 1. Validate mandatory fields
    if (!title.trim()) {
      setStepError('Please enter an announcement title.');
      setCurrentStep(1);
      return;
    }
    if (!body.trim()) {
      setStepError('Please write an announcement message.');
      setCurrentStep(1);
      return;
    }

    if (actionType !== 'SAVE_DRAFT' && !isPublishedEdit && previewRecipients === 0) {
      setStepError(
        previewError
          ? 'The recipient count could not be confirmed. Use Try Again on the audience preview before publishing.'
          : 'No active employees match the selected audience. Please adjust targeting before publishing.'
      );
      setCurrentStep(2);
      return;
    }

    // 2. Prepare dates
    let publishAtISO: string | null = null;
    if (actionType === 'SCHEDULE' || (publishMode === 'LATER' && publishDate)) {
      const pDate = new Date(`${publishDate}T${publishTime || '09:00'}:00`);
      if (pDate <= new Date()) {
        setStepError('Publish time must be in the future.');
        setCurrentStep(3);
        return;
      }
      publishAtISO = pDate.toISOString();
    }

    let expiresAtISO: string | null = null;
    if (hasExpiry && expiryDate) {
      const eDate = new Date(`${expiryDate}T${expiryTime || '17:00'}:00`);
      expiresAtISO = eDate.toISOString();
    }

    setIsSubmitting(true);
    setSubmitStatusText('Saving announcement details...');

    let activeAnnouncementId = announcementToEdit?.id || '';

    try {
      // Step A: Create or Update Draft / Announcement record
      if (announcementToEdit) {
        const updatePayload: any = {
          title: title.trim(),
          body: body.trim(),
          priority,
          isPinned,
          expiresAt: expiresAtISO,
        };

        if (!isPublishedEdit) {
          updatePayload.scopes = scopes;
          if (publishAtISO) updatePayload.publishAt = publishAtISO;
        }

        const updated = await AnnouncementService.updateAnnouncement(
          announcementToEdit.id,
          updatePayload
        );
        activeAnnouncementId = updated.id;
      } else {
        const createPayload = {
          title: title.trim(),
          body: body.trim(),
          priority,
          isPinned,
          expiresAt: expiresAtISO,
          scopes,
        };

        const created = await AnnouncementService.createDraft(createPayload);
        activeAnnouncementId = created.id;
      }

      // Step B: Upload any staged local attachments one by one
      const failedUploads: string[] = [];
      if (stagedFiles.length > 0) {
        for (let i = 0; i < stagedFiles.length; i++) {
          const file = stagedFiles[i];
          setSubmitStatusText(`Uploading attachment ${i + 1} of ${stagedFiles.length}...`);

          try {
            await AnnouncementService.uploadAttachment(activeAnnouncementId, file);
          } catch (uploadErr: any) {
            const reason = getApiErrorMessage(uploadErr, 'The upload failed.');
            failedUploads.push(`"${file.name}" (${reason})`);

            if (actionType === 'PUBLISH_NOW' || actionType === 'SCHEDULE') {
              // Crucial Safety: do NOT publish/schedule if attachment upload fails
              setIsSubmitting(false);
              setSubmitStatusText('');
              setStepError(
                `The announcement was saved as a draft, but the attachment "${file.name}" failed to upload: ${reason} It was NOT ${actionType === 'PUBLISH_NOW' ? 'published' : 'scheduled'}.`
              );
              toast.error(
                `Announcement saved as draft, but attachment "${file.name}" failed to upload.`
              );
              onSuccess();
              return;
            }
          }
        }
      }

      // Step C: Execute activation or scheduling if requested
      if (actionType === 'PUBLISH_NOW') {
        setSubmitStatusText('Publishing announcement...');
        await AnnouncementService.activateAnnouncement(activeAnnouncementId);
        toast.success('Announcement published successfully!');
      } else if (actionType === 'SCHEDULE') {
        setSubmitStatusText('Scheduling announcement...');
        await AnnouncementService.scheduleAnnouncement(activeAnnouncementId, publishAtISO!);
        toast.success(`Announcement scheduled for ${format(new Date(publishAtISO!), 'MMM d, yyyy · h:mm a')}`);
      } else if (failedUploads.length > 0) {
        toast.warning(
          `Draft saved, but ${failedUploads.length === 1 ? 'an attachment was' : `${failedUploads.length} attachments were`} not uploaded: ${failedUploads.join('; ')}. Open the draft and attach ${failedUploads.length === 1 ? 'it' : 'them'} again.`
        );
      } else {
        toast.success('Announcement saved as draft.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Wizard submission failed', err);
      const errMsg = getApiErrorMessage(err, 'Failed to save announcement. Please try again.');
      setStepError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
      setSubmitStatusText('');
    }
  };

  // Helper formatting for selected scopes
  const formatScopeLabel = (scope: ScopeInput) => {
    if (scope.scopeType === 'ALL') return 'All Active Employees';
    if (scope.scopeType === 'UNIT') {
      const u = units.find((x) => x.id === scope.targetUnitId);
      return `Unit: ${u?.name || 'Selected Unit'}`;
    }
    if (scope.scopeType === 'DEPARTMENT') {
      const d = departments.find((x) => x.id === scope.targetDepartmentId);
      return `Department: ${d?.name || 'Selected Department'}`;
    }
    if (scope.scopeType === 'JOB_ROLE') {
      const r = jobRoles.find((x) => x.id === scope.targetJobRoleId);
      return `Job Role: ${r?.title || 'Selected Role'}`;
    }
    if (scope.scopeType === 'EMPLOYEE') {
      const e = employees.find((x) => x.id === scope.targetEmployeeId);
      return `Employee: ${e ? `${e.firstName} ${e.lastName} (${e.employeeNumber})` : 'Selected Employee'}`;
    }
    return 'Target Group';
  };

  const filteredEmployeesForPicker = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 10);
    return employees
      .filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeNumber?.toLowerCase().includes(q) ||
          e.jobRole?.title?.toLowerCase().includes(q) ||
          e.department?.name?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [employees, employeeSearch]);

  const hasEveryoneScope = scopes.some((s) => s.scopeType === 'ALL');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={workflowModalStyles.container('wide')}>
          {/* Header */}
          <WorkflowModalHeader
            icon={Megaphone}
            title={
              isEditing
                ? `Edit Announcement (${announcementToEdit?.derivedStatus || 'Draft'})`
                : 'Create Announcement'
            }
            subtitle="Share important company notices and track employee read receipts."
            onClose={() => onOpenChange(false)}
          />

          {/* Stepper */}
          <WorkflowStepper
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            onStepClick={(stepId) => {
              if (stepId < currentStep) {
                setStepError(null);
                setCurrentStep(stepId);
              }
            }}
          />

          {/* Step Error Banner */}
          {stepError && (
            <div className="mx-6 sm:mx-8 mt-3 p-3.5 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-xs flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-status-danger-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Please check your inputs</p>
                <p className="mt-0.5">{stepError}</p>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className={workflowModalStyles.content}>
            {/* ══════════════════════════════════════════════════════════════
                STEP 1: ANNOUNCEMENT
               ══════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-6 max-w-3xl mx-auto w-full py-1">
                <WorkflowSection
                  title="Announcement Details"
                  subtitle="Provide a clear, readable title and message for employees."
                >
                  <div className="space-y-5">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>
                          Announcement Title <span className="text-status-danger-foreground font-bold">*</span>
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {title.length}/150
                        </span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Fire Drill Schedule & Evacuation Procedure"
                        value={title}
                        maxLength={150}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-11 text-base font-medium bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                    </div>

                    {/* Message Body */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Message Content <span className="text-status-danger-foreground font-bold">*</span>
                      </label>
                      <textarea
                        rows={6}
                        placeholder="Write your announcement message here. You can use line breaks for readability..."
                        value={body}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                        className="w-full rounded-xl p-3 text-sm leading-relaxed bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>

                    {/* Priority Choices */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Priority Level
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setPriority('NORMAL')}
                          className={cn(
                            'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                            priority === 'NORMAL'
                              ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              Normal
                            </span>
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 text-[10px] dark:bg-surface-2 dark:text-secondary-foreground">
                              Default
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Regular company news and general updates.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPriority('IMPORTANT')}
                          className={cn(
                            'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                            priority === 'IMPORTANT'
                              ? 'border-status-warning-foreground bg-status-warning-surface/70 ring-1 ring-warning shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-status-warning-foreground">
                              Important
                            </span>
                            <Badge variant="outline" className="bg-status-warning-surface text-status-warning-foreground text-[10px] border-status-warning-border">
                              Notice
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Policy changes or items needing staff attention.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPriority('URGENT')}
                          className={cn(
                            'p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                            priority === 'URGENT'
                              ? 'border-status-danger-foreground bg-status-danger-surface/70 ring-1 ring-danger shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-status-danger-foreground">
                              Urgent
                            </span>
                            <Badge variant="outline" className="bg-status-danger-surface text-status-danger-foreground text-[10px] border-status-danger-border">
                              Action Req.
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Time-sensitive emergencies or mandatory deadlines.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Pin Toggle */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                          <Pin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Pin this announcement
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Pinned announcements appear first while they are current.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-5 h-5 accent-teal-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Attachments Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                            Attachments <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX (Max 10 MB per file).
                          </p>
                        </div>

                        {!isPublishedEdit && (
                          <>
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              onChange={handleAddLocalFiles}
                              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="create"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs font-semibold gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              Add File
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Staged & Existing Attachments List */}
                      {(stagedFiles.length > 0 || existingAttachments.length > 0) ? (
                        <div className="space-y-2">
                          {/* Existing uploaded files */}
                          {existingAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="w-4 h-4 text-teal-600 shrink-0 dark:text-primary-300" />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {att.originalFilename}
                                </span>
                                <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-muted-foreground">
                                  Saved ({Math.round(att.sizeBytes / 1024)} KB)
                                </Badge>
                              </div>

                              {!isPublishedEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExistingAttachment(att.id)}
                                  className="text-status-danger-foreground hover:text-status-danger-foreground p-1 rounded-md transition-colors cursor-pointer"
                                  title="Remove existing attachment"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Newly staged local files */}
                          {stagedFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="p-3 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="w-4 h-4 text-teal-600 shrink-0 dark:text-primary-300" />
                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {file.name}
                                </span>
                                <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300 dark:text-primary-300 dark:border-primary-900">
                                  Ready to upload ({Math.round(file.size / 1024)} KB)
                                </Badge>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveStagedFile(idx)}
                                className="text-muted-foreground hover:text-status-danger-foreground p-1 rounded-md transition-colors cursor-pointer"
                                title="Remove staged file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-muted-foreground">
                          No attachments attached yet.
                        </div>
                      )}
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2: AUDIENCE
               ══════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-6 max-w-3xl mx-auto w-full py-1">
                <WorkflowSection
                  title="Target Audience"
                  subtitle="Choose who will receive and see this announcement."
                >
                  {isPublishedEdit ? (
                    <div className="p-5 rounded-2xl bg-status-warning-surface/80 border border-status-warning-border text-xs text-status-warning-foreground flex items-start gap-3">
                      <Lock className="w-5 h-5 text-status-warning-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">Audience Locked</p>
                        <p className="mt-0.5 leading-relaxed">
                          The target audience cannot be modified after an announcement has been published. Historical recipient snapshots remain preserved.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {refDataError && <LoadError compact message={refDataError} />}
                      {/* Live Audience Preview Box */}
                      <div className="p-4 sm:p-5 rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                            {previewLoading ? '...' : previewError ? '!' : previewRecipients}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider block">
                              Active Recipients
                            </span>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {previewLoading
                                ? 'Resolving audience...'
                                : previewError
                                  ? `Recipients could not be counted. ${previewError}`
                                  : `${previewRecipients} eligible active ${previewRecipients === 1 ? 'employee' : 'employees'}`}
                            </p>
                          </div>
                        </div>

                        {previewError && !previewLoading && (
                          <Button type="button" variant="outline" size="sm" onClick={() => runAudiencePreview(scopes)} className="text-xs font-semibold shrink-0">
                            Try Again
                          </Button>
                        )}
                        {previewRecipients > 0 && (
                          <Button
                            type="button"
                            variant="review"
                            size="sm"
                            onClick={() => setPreviewModalOpen(true)}
                            className="text-xs font-semibold gap-1.5 shrink-0">
                            <Eye className="w-3.5 h-3.5" />
                            View Preview List
                          </Button>
                        )}
                      </div>

                      {/* Mode selection buttons */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Add Target Group
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <button
                            type="button"
                            onClick={handleSelectEveryone}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5',
                              hasEveryoneScope
                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 font-bold ring-1 ring-teal-500'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <Users className="w-4 h-4 text-teal-600 dark:text-primary-300" />
                            <span className="text-xs">Everyone</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChooseTargetGroup('DEPARTMENT')}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5',
                              audienceMode === 'DEPARTMENT' && !hasEveryoneScope
                                ? 'border-status-accent-foreground bg-status-accent-surface text-status-accent-foreground font-bold ring-1 ring-ring'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <Building2 className="w-4 h-4 text-status-accent-foreground" />
                            <span className="text-xs">Department</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChooseTargetGroup('UNIT')}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5',
                              audienceMode === 'UNIT' && !hasEveryoneScope
                                ? 'border-status-info-foreground bg-status-info-surface text-status-info-foreground font-bold ring-1 ring-ring'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <Building2 className="w-4 h-4 text-status-info-foreground" />
                            <span className="text-xs">Unit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChooseTargetGroup('JOB_ROLE')}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5',
                              audienceMode === 'JOB_ROLE' && !hasEveryoneScope
                                ? 'border-status-accent-foreground bg-status-accent-surface text-status-accent-foreground font-bold ring-1 ring-accent'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <Briefcase className="w-4 h-4 text-status-accent-foreground" />
                            <span className="text-xs">Job Role</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleChooseTargetGroup('EMPLOYEE')}
                            className={cn(
                              'p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5',
                              audienceMode === 'EMPLOYEE' && !hasEveryoneScope
                                ? 'border-status-success-foreground bg-status-success-surface text-status-success-foreground font-bold ring-1 ring-success'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <User className="w-4 h-4 text-status-success-foreground" />
                            <span className="text-xs">Individual</span>
                          </button>
                        </div>
                      </div>

                      {/* Specific Sub-Selectors */}
                      {!hasEveryoneScope && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                          {audienceMode === 'DEPARTMENT' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={selectedDeptId}
                                onChange={(e) => setSelectedDeptId(e.target.value)}
                                className="flex-1 h-10 rounded-xl px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                              >
                                <option value="">-- Choose a Department --</option>
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                disabled={!selectedDeptId}
                                onClick={() => {
                                  if (selectedDeptId) {
                                    handleAddScope({ scopeType: 'DEPARTMENT', targetDepartmentId: selectedDeptId });
                                    setSelectedDeptId('');
                                  }
                                }}
                                className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold"
                              >
                                + Add Department
                              </Button>
                            </div>
                          )}

                          {audienceMode === 'UNIT' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={selectedUnitId}
                                onChange={(e) => setSelectedUnitId(e.target.value)}
                                className="flex-1 h-10 rounded-xl px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                              >
                                <option value="">-- Choose a Unit --</option>
                                {units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                disabled={!selectedUnitId}
                                onClick={() => {
                                  if (selectedUnitId) {
                                    handleAddScope({ scopeType: 'UNIT', targetUnitId: selectedUnitId });
                                    setSelectedUnitId('');
                                  }
                                }}
                                className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold"
                              >
                                + Add Unit
                              </Button>
                            </div>
                          )}

                          {audienceMode === 'JOB_ROLE' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={selectedJobRoleId}
                                onChange={(e) => setSelectedJobRoleId(e.target.value)}
                                className="flex-1 h-10 rounded-xl px-3 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                              >
                                <option value="">-- Choose a Job Role --</option>
                                {jobRoles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.title}
                                  </option>
                                ))}
                              </select>
                              <Button
                                type="button"
                                disabled={!selectedJobRoleId}
                                onClick={() => {
                                  if (selectedJobRoleId) {
                                    handleAddScope({ scopeType: 'JOB_ROLE', targetJobRoleId: selectedJobRoleId });
                                    setSelectedJobRoleId('');
                                  }
                                }}
                                className="bg-accent hover:bg-status-accent-foreground text-white text-xs font-semibold"
                              >
                                + Add Role
                              </Button>
                            </div>
                          )}

                          {audienceMode === 'EMPLOYEE' && (
                            <div className="space-y-2">
                              <Input
                                type="text"
                                placeholder="Type employee name or ID to search..."
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                className="h-9 text-xs bg-white dark:bg-slate-900"
                              />

                              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {filteredEmployeesForPicker.map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {emp.firstName} {emp.lastName}
                                      </p>
                                      <p className="text-[11px] text-slate-500 truncate dark:text-muted-foreground">
                                        {emp.employeeNumber} · {emp.jobRole?.title || emp.department?.name || 'Staff'}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        handleAddScope({ scopeType: 'EMPLOYEE', targetEmployeeId: emp.id });
                                        setEmployeeSearch('');
                                      }}
                                      className="h-7 text-xs px-2.5 font-semibold text-status-success-foreground border-status-success-border hover:bg-status-success-surface"
                                    >
                                      + Add
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Selected Additive Scopes Display */}
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Selected Audience Groups ({scopes.length})
                        </label>

                        {hasEveryoneScope ? (
                          <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/40 text-xs text-teal-800 dark:text-teal-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-teal-600 dark:text-primary-300" />
                              <span className="font-bold">Everyone</span>
                              <span>— All active hospital employees are included.</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {scopes.map((s, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs flex items-center gap-2 shadow-2xs"
                              >
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatScopeLabel(s)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveScope(idx)}
                                  className="text-muted-foreground hover:text-status-danger-foreground transition-colors p-0.5 rounded cursor-pointer"
                                  title="Remove this group"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </WorkflowSection>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3: SCHEDULE
               ══════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-6 max-w-3xl mx-auto w-full py-1">
                <WorkflowSection
                  title="Publishing Schedule & Expiry"
                  subtitle="Choose when employees will see this announcement and when it becomes past."
                >
                  <div className="space-y-6">
                    {/* Publishing Options */}
                    {isPublishedEdit ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          Published Notice
                        </span>
                        <p className="text-slate-500 mt-0.5 dark:text-muted-foreground">
                          Published on{' '}
                          {announcementToEdit?.publishAt
                            ? format(new Date(announcementToEdit.publishAt), 'MMMM d, yyyy · h:mm a')
                            : 'now'}
                          . The publish date cannot be changed.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          When should employees see this?
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPublishMode('NOW')}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                              publishMode === 'NOW'
                                ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              Publish Immediately
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Employees will see this notice as soon as you publish.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPublishMode('LATER')}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                              publishMode === 'LATER'
                                ? 'border-status-info-foreground bg-status-info-surface/70 ring-1 ring-ring shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                            )}
                          >
                            <span className="font-bold text-sm text-status-info-foreground">
                              Schedule for Later
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Set a future date and time for automatic visibility.
                            </p>
                          </button>
                        </div>

                        {publishMode === 'LATER' && (
                          <div className="p-4 rounded-xl border border-status-info-border bg-status-info-surface/30 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Publish Date <span className="text-status-danger-foreground">*</span>
                              </label>
                              <Input
                                type="date"
                                value={publishDate}
                                min={format(new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => setPublishDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 text-sm h-10"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Publish Time <span className="text-status-danger-foreground">*</span>
                              </label>
                              <Input
                                type="time"
                                value={publishTime}
                                onChange={(e) => setPublishTime(e.target.value)}
                                className="bg-white dark:bg-slate-900 text-sm h-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expiry Section */}
                    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                          When should this stop appearing as current?
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          After this time, employees can still view it under their Past Announcements tab.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setHasExpiry(false)}
                          className={cn(
                            'p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                            !hasExpiry
                              ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                          )}
                        >
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                            No Expiration
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5 block dark:text-muted-foreground">
                            Remains current until archived by HR.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setHasExpiry(true)}
                          className={cn(
                            'p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                            hasExpiry
                              ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-1 ring-teal-500 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-surface-2'
                          )}
                        >
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                            Set End Date
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5 block dark:text-muted-foreground">
                            Moves to Past Announcements on schedule.
                          </span>
                        </button>
                      </div>

                      {hasExpiry && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              End Date <span className="text-status-danger-foreground">*</span>
                            </label>
                            <Input
                              type="date"
                              value={expiryDate}
                              min={publishMode === 'LATER' && publishDate ? publishDate : format(new Date(), 'yyyy-MM-dd')}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="bg-white dark:bg-slate-900 text-sm h-10"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              End Time <span className="text-status-danger-foreground">*</span>
                            </label>
                            <Input
                              type="time"
                              value={expiryTime}
                              onChange={(e) => setExpiryTime(e.target.value)}
                              className="bg-white dark:bg-slate-900 text-sm h-10"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 4: REVIEW
               ══════════════════════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="space-y-5 max-w-3xl mx-auto w-full py-1">
                <WorkflowSection
                  title="Review Announcement"
                  subtitle="Verify details before publishing or saving."
                >
                  <div className="space-y-4">
                    {/* Summary Header Card */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Announcement Title
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                            {title || 'Untitled Notice'}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPinned && (
                            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs gap-1 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
                              <Pin className="w-3 h-3 text-teal-600 dark:text-primary-300" />
                              Pinned
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn('text-xs', {
                              'bg-status-danger-surface text-status-danger-foreground border-status-danger-border': priority === 'URGENT',
                              'bg-status-warning-surface text-status-warning-foreground border-status-warning-border': priority === 'IMPORTANT',
                              'bg-slate-100 text-slate-700 border-slate-200 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft': priority === 'NORMAL',
                            })}
                          >
                            {priority}
                          </Badge>
                        </div>
                      </div>

                      {/* Message Preview */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Message Body
                        </span>
                        <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                          {body || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Target Audience */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] dark:text-muted-foreground">
                            Target Audience
                          </span>
                          <span className="font-bold text-teal-600 dark:text-primary-300">
                            {previewRecipients} {previewRecipients === 1 ? 'recipient' : 'recipients'}
                          </span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                          {hasEveryoneScope
                            ? 'All Active Employees'
                            : scopes.map((s) => formatScopeLabel(s)).join(', ')}
                        </p>
                      </div>

                      {/* Publishing & Expiry Timing */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block dark:text-muted-foreground">
                          Schedule & Visibility
                        </span>
                        <div className="space-y-0.5 text-slate-800 dark:text-slate-200 font-medium">
                          <p>
                            <span className="text-muted-foreground">Publish:</span>{' '}
                            {publishMode === 'NOW'
                              ? 'Immediately upon publishing'
                              : `${publishDate} at ${publishTime}`}
                          </p>
                          <p>
                            <span className="text-muted-foreground">End date:</span>{' '}
                            {hasExpiry ? `${expiryDate} at ${expiryTime}` : 'No expiration'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Attachments Summary */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs space-y-1.5">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] block dark:text-muted-foreground">
                        Attachments ({existingAttachments.length + stagedFiles.length})
                      </span>
                      {existingAttachments.length + stagedFiles.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {existingAttachments.map((a) => (
                            <Badge key={a.id} variant="outline" className="bg-slate-50 text-slate-700 dark:bg-surface-2 dark:text-secondary-foreground">
                              {a.originalFilename}
                            </Badge>
                          ))}
                          {stagedFiles.map((f, i) => (
                            <Badge key={i} variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
                              {f.name} (New)
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No attached documents.</p>
                      )}
                    </div>
                  </div>
                </WorkflowSection>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="sticky bottom-0 z-30 flex-shrink-0 mt-auto flex items-center justify-between px-6 sm:px-8 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800">
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                className="text-xs sm:text-sm h-10 px-4 font-semibold text-slate-700 dark:text-slate-200"
              >
                Cancel
              </Button>
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={handleBack}
                  className="text-xs sm:text-sm h-10 px-4 font-semibold text-slate-700 dark:text-slate-200"
                >
                  Back
                </Button>
              )}

              {/* Step 1-3 Next Button */}
              {currentStep < 4 && (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm h-10 px-5 font-semibold"
                >
                  Next Step
                </Button>
              )}

              {/* Step 4 Review Submission Buttons */}
              {currentStep === 4 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => executeSaveOrPublish('SAVE_DRAFT')}
                    className="text-xs sm:text-sm h-10 px-4 font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-border-soft"
                  >
                    {isSubmitting ? 'Saving...' : 'Save as Draft'}
                  </Button>

                  {publishMode === 'LATER' ? (
                    <Button
                      type="button"
                      disabled={isSubmitting || previewRecipients === 0}
                      onClick={() => executeSaveOrPublish('SCHEDULE')}
                      className="bg-slate-600 hover:bg-slate-700 text-white text-xs sm:text-sm h-10 px-5 font-semibold gap-1.5 shadow-sm"
                    >
                      {isSubmitting ? submitStatusText || 'Scheduling...' : 'Schedule Announcement'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={isSubmitting || previewRecipients === 0}
                      onClick={() => executeSaveOrPublish('PUBLISH_NOW')}
                      className="bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm h-10 px-5 font-semibold gap-1.5 shadow-sm"
                    >
                      {isSubmitting ? submitStatusText || 'Publishing...' : 'Publish Announcement'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audience Preview Modal */}
      <AudiencePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        totalRecipients={previewRecipients}
        previewEmployees={previewSample}
      />
    </>
  );
}
