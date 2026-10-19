import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { api } from "@/services/api";
import { useBlocker } from '@tanstack/react-router';
import {
  AlertCircle, Loader2, Building2, User, Phone, Siren, Briefcase, Lock, GitBranch, BookOpen,
} from "lucide-react";
import {
  BLOOD_TYPES, RECORD_FIELD_LABELS, recordFieldCascade, recordFieldErrors, recordFieldsFromEmployee,
  graduatedLabel, type RecordFieldKey,
} from "@/lib/employeeRecord";
import { ENDING_OPTIONS, hasEnded } from "@/lib/employment";
import { ReligionPicker } from "@/components/shared/ReligionPicker";
import { OrgSelector } from "@/components/common/OrgSelector";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { toast } from "sonner";
import { contactProblems, contactsFromEmployee, filledContacts, type EmergencyContactRow } from "@/lib/employeeContacts";
import { EmergencyContactsEditor } from "./EmergencyContactsEditor";

/**
 * Edit Profile.
 *
 * Field list follows the Employee model exactly. Date of birth and date hired
 * are required columns AND count toward profile completion, yet this form used
 * to have no way to change them; place of birth, nationality, religion,
 * telephone and permanent address were shown on the profile but not editable.
 *
 * Who can change what is the API's rule, mirrored here so the form never
 * pretends to save something the server will drop:
 *   • HR (FULL)          — every field below
 *   • the employee (self) — phone, addresses, emergency contacts, religion
 *     (the `PUT /employees/:id` whitelist); everything else is read-only.
 *     The personal email is the login address, so only HR changes it.
 *
 * Employment status and regularization date are intentionally absent: their
 * rules belong to the employment-status change (Phase 2), not to this form.
 */

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  gender: string;
  civilStatus: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  religion: string;
  mobilePhone: string;
  telephoneNumber: string;
  personalEmail: string;
  presentAddress: string;
  permanentAddress: string;
  hireDate: string;
  employmentStatus: string;
  employmentState: string;
  probationDate: string;
  regularizationDate: string;
  biometricCode: string;
  separationDate: string;
  separationReason: string;
  prcLicenseNumber: string;
  professionalRole: string;
  unitId: string;
  departmentId: string;
  jobRoleId: string;
} & Record<RecordFieldKey, string>;

/** Keys the API accepts from an employee editing their own record. */
const SELF_EDITABLE = new Set<keyof FormState>([
  "mobilePhone", "presentAddress", "permanentAddress", "religion",
]);

/** Non-null columns in the Employee model — they cannot be saved blank. */
const REQUIRED: Array<keyof FormState> = [
  "firstName", "lastName", "gender", "civilStatus", "dateOfBirth", "mobilePhone",
  "personalEmail", "presentAddress", "hireDate", "unitId", "jobRoleId",
];

const DATE_FIELDS = new Set<keyof FormState>([
  "dateOfBirth", "hireDate", "separationDate", "probationDate", "regularizationDate",
  "prcIssuedDate", "prcValidUntil", "ncValidUntil",
]);
const ORG_FIELDS = new Set<keyof FormState>(["unitId", "departmentId", "jobRoleId"]);

const FIELD_LABELS: Record<keyof FormState, string> = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  suffix: "Suffix",
  gender: "Sex",
  civilStatus: "Civil status",
  dateOfBirth: "Date of birth",
  placeOfBirth: "Place of birth",
  nationality: "Nationality",
  religion: "Religion",
  mobilePhone: "Mobile phone",
  telephoneNumber: "Telephone",
  personalEmail: "Personal email (login)",
  presentAddress: "Present address",
  permanentAddress: "Permanent / provincial address",
  hireDate: "Start date",
  employmentStatus: "Employment type",
  probationDate: "Probation ends",
  regularizationDate: "Regularization date",
  biometricCode: "Timekeeping code",
  employmentState: "Employee status",
  separationDate: "End date",
  separationReason: "Reason",
  prcLicenseNumber: "PRC License #",
  professionalRole: "Professional role",
  unitId: "Unit",
  departmentId: "Department",
  jobRoleId: "Job role",
  ...RECORD_FIELD_LABELS,
};

// Every value of the Gender / CivilStatus enums — the form used to offer only
// two sexes and four civil statuses, so the rest could never be selected.
const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];
const CIVIL_STATUS_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "SEPARATED", label: "Separated" },
  { value: "LEGALLY_SEPARATED", label: "Legally separated" },
];

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  PENDING: "Pending HR review",
  OVERRIDDEN: "Overridden by HR",
};
const ASSIGNMENT_SOURCE_LABEL: Record<string, string> = {
  AUTO_JOB_ROLE: "Job role hierarchy",
  AUTO_DEPARTMENT_HEAD: "Department head",
  AUTO_UNIT_HEAD: "Unit head",
  MANUAL_OVERRIDE: "Manual override by HR",
};

function humanize(value?: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `YYYY-MM-DD` for a date input, from whatever the API returned. */
function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function initialState(employee: any): FormState {
  return {
    firstName: employee.firstName || "",
    middleName: employee.middleName || "",
    lastName: employee.lastName || "",
    suffix: employee.suffix || "",
    // No silent defaults: an unset value stays unset instead of becoming
    // "Male" / "Single" and being saved on the next submit.
    gender: employee.gender || "",
    civilStatus: employee.civilStatus || "",
    dateOfBirth: toDateInput(employee.dateOfBirth),
    placeOfBirth: employee.placeOfBirth || "",
    nationality: employee.nationality || "",
    religion: employee.religion || "",
    mobilePhone: employee.mobilePhone || "",
    telephoneNumber: employee.telephoneNumber || "",
    personalEmail: employee.personalEmail || "",
    presentAddress: employee.presentAddress || "",
    permanentAddress: employee.permanentAddress || "",
    hireDate: toDateInput(employee.hireDate),
    employmentStatus: employee.employmentStatus || "REGULAR",
    probationDate: toDateInput(employee.probationDate),
    regularizationDate: toDateInput(employee.regularizationDate),
    biometricCode: employee.biometricCode || "",
    employmentState: employee.employmentState || "ACTIVE",
    separationDate: toDateInput(employee.separationDate),
    separationReason: employee.separationReason || "",
    prcLicenseNumber: employee.prcLicenseNumber || "",
    professionalRole: employee.professionalRole || "",
    unitId: employee.unitId || "",
    departmentId: employee.departmentId || "",
    jobRoleId: employee.jobRoleId || "",
    // Optional HSJ record fields — blank stays blank.
    ...recordFieldsFromEmployee(employee),
  };
}

export function EmployeeEditForm({
  isOpen,
  onClose,
  employee,
  onSaveSuccess,
  canEditAll = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onSaveSuccess: () => void;
  /** HR (FULL tier). When false, only the self-service fields are editable. */
  canEditAll?: boolean;
}) {
  const original = initialState(employee);
  const [formData, setFormData] = useState<FormState>(original);
  // Emergency contacts (up to three) and HR-managed leave eligibility live
  // outside the flat text fields.
  const originalContacts = contactsFromEmployee(employee);
  const [contacts, setContacts] = useState<EmergencyContactRow[]>(originalContacts);
  const [contactError, setContactError] = useState<string | null>(null);
  const originalEligibility = {
    paternityLeaveEligible: Boolean(employee.paternityLeaveEligible),
    soloParentLeaveEligible: Boolean(employee.soloParentLeaveEligible),
  };
  const [eligibility, setEligibility] = useState(originalEligibility);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Master Data
  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobRoles, setJobRoles] = useState<any[]>([]);

  // Supervisor Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Override Decision State
  const [overrideDecision, setOverrideDecision] = useState<string>('KEEP_MANUAL_OVERRIDE');
  const [newSupervisorId, setNewSupervisorId] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");

  // Leaving the page with unsaved edits asks first. (It used to block with no
  // question shown, so the page silently refused to change.)
  useBlocker({
    shouldBlockFn: async () => {
      if (!isDirty || isSubmitting) return false;
      return !(await confirmAction({ title: 'Leave without saving?', message: 'The changes you have not saved will be lost.', confirmLabel: 'Leave', cancelLabel: 'Stay', danger: true }));
    },
  });

  // Eligible Supervisors list for override selection
  const [eligibleSupervisors, setEligibleSupervisors] = useState<any[]>([]);

  // Re-seed the form each time it opens, so a cancelled edit never leaks into
  // the next one.
  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialState(employee));
    setContacts(contactsFromEmployee(employee));
    setEligibility({
      paternityLeaveEligible: Boolean(employee.paternityLeaveEligible),
      soloParentLeaveEligible: Boolean(employee.soloParentLeaveEligible),
    });
    setContactError(null);
    setErrors({});
    setIsDirty(false);
  }, [isOpen, employee]);

  useEffect(() => {
    if (!isOpen || !canEditAll) return;
    const fetchMasterData = async () => {
      try {
        const [uRes, dRes, jRes, supRes] = await Promise.all([
          api.get('/employees/units'),
          api.get('/departments'),
          api.get('/employees/job-roles'),
          api.get(`/employees/eligible-supervisors?excludeId=${employee.id}`),
        ]);
        setUnits(uRes.data.data || []);
        setDepartments(dRes.data.data || []);
        setJobRoles(jRes.data.data || []);
        setEligibleSupervisors(supRes.data.data || []);
      } catch (err) {
        toast.error(
          getApiErrorMessage(err, "The unit, department, job role and supervisor lists could not be loaded.") +
            " Close and reopen the form before changing those fields.",
          { id: "edit-form-master" }
        );
      }
    };
    fetchMasterData();
  }, [isOpen, employee.id, canEditAll]);

  const hasOrgChanges = formData.unitId !== (employee.unitId || "") ||
                        formData.departmentId !== (employee.departmentId || "") ||
                        formData.jobRoleId !== (employee.jobRoleId || "");

  // Debounced Preview
  useEffect(() => {
    if (!isOpen || !canEditAll) return;
    if (!hasOrgChanges || !formData.jobRoleId) {
      setPreviewData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(false);
        const res = await api.post('/employees/resolve-supervisor', {
          jobRoleId: formData.jobRoleId,
          unitId: formData.unitId || undefined,
          departmentId: formData.departmentId || undefined,
          employeeId: employee.id // Exclude self
        });
        setPreviewData(res.data.data);
      } catch (err) {
        console.error(err);
        setPreviewError(true);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.unitId, formData.departmentId, formData.jobRoleId, employee, isOpen, canEditAll, hasOrgChanges]);

  const canEdit = (key: keyof FormState) => canEditAll || SELF_EDITABLE.has(key);

  /** Changed, editable fields only — unchanged values are never re-sent. */
  const changedKeys = (Object.keys(formData) as Array<keyof FormState>).filter(
    (key) => canEdit(key) && formData[key] !== original[key]
  );
  const contactsChanged = JSON.stringify(filledContacts(contacts)) !== JSON.stringify(filledContacts(originalContacts));
  const eligibilityChanged =
    canEditAll &&
    (eligibility.paternityLeaveEligible !== originalEligibility.paternityLeaveEligible ||
      eligibility.soloParentLeaveEligible !== originalEligibility.soloParentLeaveEligible);
  const changeCount = changedKeys.length + (contactsChanged ? 1 : 0) + (eligibilityChanged ? 1 : 0);

  const handleClose = async () => {
    if (isDirty) {
      if (await confirmAction({ title: 'Discard your changes?', message: 'The changes you have not saved will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true })) {
        setIsDirty(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const setField = (key: keyof FormState, value: string) => {
    // Values that stop applying are cleared with it (Single → no spouse name;
    // no PRC / NC number → no dates for it).
    const cleared = recordFieldCascade(key, value);
    setFormData(prev => ({ ...prev, [key]: value, ...cleared }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setIsDirty(true);
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    for (const key of REQUIRED) {
      if (canEdit(key) && !String(formData[key] ?? "").trim()) {
        next[key] = `${FIELD_LABELS[key]} is required.`;
      }
    }
    if (formData.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail.trim())) {
      next.personalEmail = "Enter a valid email address.";
    }
    const problems = contactProblems(contacts);
    setContactError(problems.length ? `${problems.join("; ")}.` : null);
    if (formData.dateOfBirth && formData.hireDate && formData.dateOfBirth >= formData.hireDate) {
      next.hireDate = "Date hired must be after the date of birth.";
    }
    if (canEditAll) {
      const ended = hasEnded(formData.employmentState);
      if (ended && !formData.separationDate) {
        next.separationDate = "An end date is required for this status.";
      }
      if (!ended && formData.separationDate) {
        next.separationDate = "Clear the end date, or choose an ending status.";
      }
      if (ended && formData.separationDate && formData.hireDate && formData.separationDate < formData.hireDate) {
        next.separationDate = "The end date cannot be earlier than the start date.";
      }
      if (formData.employmentState === "OTHERS" && !formData.separationReason.trim()) {
        next.separationReason = "Give the specific reason when the status is Others.";
      }
      Object.assign(next, recordFieldErrors(formData));
    }
    setErrors(next);
    return Object.keys(next).length === 0 && problems.length === 0;
  };

  const openReview = () => {
    if (validate()) setShowReview(true);
    else toast.error("Please fix the highlighted fields.");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of changedKeys) {
        const value = formData[key].trim();
        // Optional text cleared by the user is stored as null, not "".
        payload[key] = value === "" && !REQUIRED.includes(key) ? null : value;
      }
      if (contactsChanged) payload.emergencyContacts = filledContacts(contacts);
      if (eligibilityChanged) {
        payload.paternityLeaveEligible = eligibility.paternityLeaveEligible;
        payload.soloParentLeaveEligible = eligibility.soloParentLeaveEligible;
      }

      if (employee.supervisorAssignmentSource === 'MANUAL_OVERRIDE' && hasOrgChanges) {
        payload.overrideDecision = overrideDecision;
        if (overrideDecision === 'SELECT_DIFFERENT_OVERRIDE') {
          payload.newSupervisorId = newSupervisorId;
          payload.overrideReason = overrideReason;
        }
      }

      await api.put(`/employees/${employee.id}`, payload);
      toast.success("Profile updated.");
      setIsDirty(false);
      setShowReview(false);
      onSaveSuccess();
      onClose();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "The profile could not be updated."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showOverrideWorkflow = canEditAll && employee.supervisorAssignmentSource === 'MANUAL_OVERRIDE' && hasOrgChanges;

  /** Renders a stored value the way a person would read it. */
  const display = (key: keyof FormState, value: string): string => {
    if (!value) return "Not set";
    if (DATE_FIELDS.has(key)) return new Date(`${value}T00:00:00`).toLocaleDateString();
    if (key === "gender") return GENDER_OPTIONS.find(o => o.value === value)?.label ?? humanize(value);
    if (key === "civilStatus") return CIVIL_STATUS_OPTIONS.find(o => o.value === value)?.label ?? humanize(value);
    if (key === "tertiaryGraduated") return graduatedLabel(value) ?? "Not set";
    return value;
  };

  // Shared field props: every input is wired the same way.
  const text = (key: keyof FormState, props: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => ({
    id: `edit-${key}`,
    name: key,
    value: formData[key],
    disabled: !canEdit(key),
    invalid: !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(key, e.target.value),
    ...props,
  });
  const choice = (key: keyof FormState) => ({
    id: `edit-${key}`,
    name: key,
    value: formData[key],
    disabled: !canEdit(key),
    invalid: !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setField(key, e.target.value),
  });

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border-soft bg-surface space-y-0">
          <div className="flex items-start gap-3.5 pr-10">
            <Avatar
              name={`${employee.firstName} ${employee.lastName}`}
              src={employee.photoUrl}
              size="md"
              className="shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight">
                {employee.firstName} {employee.lastName}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                <span className="font-mono">{employee.employeeNumber}</span>
                {employee.jobRole?.title ? <> · {employee.jobRole.title}</> : null}
                {employee.unit?.name ? <> · {employee.unit.name}</> : null}
              </DialogDescription>
              {!canEditAll && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  You can update your phone, addresses, emergency contacts and religion.
                  Everything else, including your login email, is managed by HR.
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto px-5 sm:px-6 py-5 space-y-4 bg-background">

          {/* ── Organizational assignment ─────────────────────────────────── */}
          <FormSection
            icon={<Building2 />}
            title="Organizational Assignment"
            description={canEditAll ? "Changing these recalculates the employee's supervisor." : undefined}
            locked={!canEditAll}
          >
            {canEditAll ? (
              <OrgSelector
                unitId={formData.unitId}
                departmentId={formData.departmentId}
                jobRoleId={formData.jobRoleId}
                onChange={({ unitId, departmentId, jobRoleId }) => {
                  setFormData(prev => ({ ...prev, unitId, departmentId, jobRoleId }));
                  setErrors(prev => ({ ...prev, unitId: undefined, jobRoleId: undefined }));
                  setIsDirty(true);
                }}
                unitRequired={true}
                roleRequired={true}
                layout="grid"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ReadOnly label="Unit" value={employee.unit?.name} />
                <ReadOnly label="Department" value={employee.department?.name} />
                <ReadOnly label="Job Role" value={employee.jobRole?.title} />
              </div>
            )}
            {(errors.unitId || errors.jobRoleId) && (
              <p className="mt-2 text-xs font-medium text-status-danger-foreground">
                {errors.unitId ?? errors.jobRoleId}
              </p>
            )}

            {/* Supervisor preview — only when the assignment is changing */}
            {canEditAll && hasOrgChanges && formData.jobRoleId && (
              <div className="mt-4 rounded-xl border border-status-info-border bg-status-info-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-status-info-foreground mb-3">
                  <GitBranch className="h-4 w-4" /> Supervisor after this change
                </p>
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Resolving hierarchy…
                  </div>
                ) : previewError ? (
                  <div className="flex items-center gap-2 text-sm text-status-danger-foreground">
                    <AlertCircle className="h-4 w-4" /> The supervisor could not be resolved.
                  </div>
                ) : previewData ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <PreviewValue label="Recommended supervisor">
                        {previewData.supervisor
                          ? `${previewData.supervisor.firstName} ${previewData.supervisor.lastName}`
                          : previewData.noSupervisorRequired
                            ? <span className="text-muted-foreground">Not required (top-level role)</span>
                            : <span className="text-status-warning-foreground">Pending assignment</span>}
                      </PreviewValue>
                      <PreviewValue label="Status">
                        {ASSIGNMENT_STATUS_LABEL[previewData.assignmentStatus] ?? humanize(previewData.assignmentStatus)}
                      </PreviewValue>
                      <PreviewValue label="Assigned through">
                        {ASSIGNMENT_SOURCE_LABEL[previewData.assignmentSource] ?? humanize(previewData.assignmentSource)}
                      </PreviewValue>
                    </div>
                    {previewData.assignmentStatus === 'PENDING' && previewData.pendingReason && (
                      <p className="text-xs rounded-lg border border-status-warning-border bg-status-warning-surface text-status-warning-foreground p-2">
                        {previewData.pendingReason}
                      </p>
                    )}
                    {previewData.organizationalPath?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Reporting path: {previewData.organizationalPath.join(' → ')}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Manual override workflow */}
            {showOverrideWorkflow && (
              <div className="mt-4 rounded-xl border border-status-warning-border bg-status-warning-surface p-4">
                <p className="text-sm font-bold text-status-warning-foreground mb-1">Manual override active</p>
                <p className="text-xs text-foreground/75 mb-3">
                  This employee's supervisor was set manually by HR. Their assignment is changing, so choose how to proceed:
                </p>
                <div className="space-y-2">
                  {[
                    { value: 'KEEP_MANUAL_OVERRIDE', label: 'Keep the current manual supervisor' },
                    { value: 'REVERT_TO_AUTOMATIC', label: 'Revert to the automatic hierarchy' },
                    { value: 'SELECT_DIFFERENT_OVERRIDE', label: 'Choose a different supervisor' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="overrideDecision"
                        value={opt.value}
                        checked={overrideDecision === opt.value}
                        onChange={(e) => setOverrideDecision(e.target.value)}
                        className="h-4 w-4 accent-primary-600"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {overrideDecision === 'SELECT_DIFFERENT_OVERRIDE' && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-surface border border-border-soft p-3">
                    <Field label="New supervisor" htmlFor="edit-newSupervisor">
                      <select
                        id="edit-newSupervisor"
                        value={newSupervisorId}
                        onChange={e => setNewSupervisorId(e.target.value)}
                        className={controlClass()}
                      >
                        <option value="">Choose an eligible supervisor…</option>
                        {eligibleSupervisors.map(sup => (
                          <option key={sup.id} value={sup.id}>
                            {sup.firstName} {sup.lastName} ({sup.employeeNumber}) — {sup.jobRole?.title || 'No role'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Reason for override" htmlFor="edit-overrideReason" required>
                      <input
                        id="edit-overrideReason"
                        type="text"
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        className={controlClass()}
                        placeholder="Why this supervisor…"
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </FormSection>

          {/* ── Personal ──────────────────────────────────────────────────── */}
          <FormSection icon={<User />} title="Personal Details" locked={!canEditAll}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" htmlFor="edit-firstName" required error={errors.firstName}>
                <TextInput {...text("firstName")} autoComplete="off" />
              </Field>
              <Field label="Last name" htmlFor="edit-lastName" required error={errors.lastName}>
                <TextInput {...text("lastName")} autoComplete="off" />
              </Field>
              <Field label="Middle name" htmlFor="edit-middleName">
                <TextInput {...text("middleName")} autoComplete="off" />
              </Field>
              <Field label="Suffix" htmlFor="edit-suffix" hint="e.g. Jr., III">
                <TextInput {...text("suffix")} autoComplete="off" />
              </Field>
              <Field label="Sex" htmlFor="edit-gender" required error={errors.gender}>
                <SelectInput {...choice("gender")} options={GENDER_OPTIONS} />
              </Field>
              <Field label="Civil status" htmlFor="edit-civilStatus" required error={errors.civilStatus}>
                <SelectInput {...choice("civilStatus")} options={CIVIL_STATUS_OPTIONS} />
              </Field>
              <Field label="Date of birth" htmlFor="edit-dateOfBirth" required error={errors.dateOfBirth}>
                <TextInput {...text("dateOfBirth")} type="date" max={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Place of birth" htmlFor="edit-placeOfBirth">
                <TextInput {...text("placeOfBirth")} />
              </Field>
              <Field label="Nationality" htmlFor="edit-nationality">
                <TextInput {...text("nationality")} />
              </Field>
              <Field label="Religion" htmlFor="edit-religion">
                {/* Pick from the list, or choose "Others" and write it in. An
                    existing record reopens on whichever it was saved as. */}
                <ReligionPicker
                  id="edit-religion"
                  value={formData.religion}
                  onChange={(religion) => setField("religion", religion)}
                  disabled={!canEdit("religion")}
                  controlClass={controlClass(!!errors.religion)}
                  otherPlaceholder="Please specify the religion"
                />
              </Field>
              {/* Optional. Blank = not provided — never a placeholder value. */}
              <Field label="Blood type" htmlFor="edit-bloodType">
                <select id="edit-bloodType" value={formData.bloodType} disabled={!canEdit("bloodType")} onChange={(e) => setField("bloodType", e.target.value)} className={controlClass()}>
                  <option value="">Not provided</option>
                  {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Number of children" htmlFor="edit-numberOfChildren" error={errors.numberOfChildren} hint="Leave blank if not provided; 0 is a valid answer.">
                <TextInput {...text("numberOfChildren")} type="number" min={0} max={30} step={1} inputMode="numeric" />
              </Field>
              {formData.civilStatus && formData.civilStatus !== "SINGLE" && (
                <Field label="Spouse name" htmlFor="edit-spouseName" error={errors.spouseName} className="sm:col-span-2">
                  <TextInput {...text("spouseName")} />
                </Field>
              )}
            </div>
          </FormSection>

          {/* ── Contact & address ─────────────────────────────────────────── */}
          <FormSection icon={<Phone />} title="Contact & Address">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mobile phone" htmlFor="edit-mobilePhone" required error={errors.mobilePhone}>
                <TextInput {...text("mobilePhone")} type="tel" inputMode="tel" />
              </Field>
              <Field label="Telephone" htmlFor="edit-telephoneNumber" hint={canEditAll ? undefined : "Managed by HR"}>
                <TextInput {...text("telephoneNumber")} type="tel" inputMode="tel" />
              </Field>
              <Field
                label="Personal email (login)"
                htmlFor="edit-personalEmail"
                required={canEditAll}
                error={errors.personalEmail}
                hint={canEditAll ? "Also the HRISense login — changing it changes how the employee signs in." : "This is your login email. Managed by HR."}
                className="sm:col-span-2"
              >
                <TextInput {...text("personalEmail")} type="email" />
              </Field>
              <Field label="Present address" htmlFor="edit-presentAddress" required error={errors.presentAddress} className="sm:col-span-2">
                <TextInput {...text("presentAddress")} />
              </Field>
              <Field label="Permanent / provincial address" htmlFor="edit-permanentAddress" className="sm:col-span-2">
                <TextInput {...text("permanentAddress")} />
              </Field>
              <Field label="HSJ residence" htmlFor="edit-hsjResidence" hint={canEditAll ? "Only if the employee lives at Hospicio." : "Managed by HR"}>
                <TextInput {...text("hsjResidence")} />
              </Field>
              <Field label="Unit / dorm" htmlFor="edit-residenceDorm" hint={canEditAll ? "Where they stay — not their work unit." : "Managed by HR"}>
                <TextInput {...text("residenceDorm")} />
              </Field>
            </div>
          </FormSection>

          {/* ── Emergency contact ─────────────────────────────────────────── */}
          <FormSection icon={<Siren />} title="Emergency Contacts" description="Up to three. The first is required.">
            <EmergencyContactsEditor
              idPrefix="edit-emergency"
              value={contacts}
              onChange={(next) => { setContacts(next); setContactError(null); setIsDirty(true); }}
              controlClassName={controlClass()}
            />
            {contactError && <p className="mt-2 text-xs font-medium text-status-danger-foreground" role="alert">{contactError}</p>}
          </FormSection>

          {/* ── Employment ────────────────────────────────────────────────── */}
          <FormSection icon={<Briefcase />} title="Employment" locked={!canEditAll}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Employment type" htmlFor="edit-employmentStatus" error={errors.employmentStatus}>
                <select
                  id="edit-employmentStatus"
                  value={formData.employmentStatus}
                  disabled={!canEditAll}
                  onChange={(e) => setField("employmentStatus", e.target.value)}
                  className={controlClass()}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="PROBATIONARY">Probationary</option>
                  <option value="CONTRACTUAL">Contractual</option>
                  <option value="CASUAL">Casual</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </Field>
              <Field label="Start date" htmlFor="edit-hireDate" required error={errors.hireDate}>
                <TextInput {...text("hireDate")} type="date" />
              </Field>
              <Field label="Probation ends" htmlFor="edit-probationDate" error={errors.probationDate}>
                <TextInput {...text("probationDate")} type="date" min={formData.hireDate || undefined} />
              </Field>
              <Field label="Regularization date" htmlFor="edit-regularizationDate" error={errors.regularizationDate}>
                <TextInput {...text("regularizationDate")} type="date" min={formData.hireDate || undefined} />
              </Field>
              <Field label="Employee status" htmlFor="edit-employmentState" error={errors.employmentState}>
                <select
                  id="edit-employmentState"
                  value={formData.employmentState}
                  disabled={!canEditAll}
                  onChange={(e) => setField("employmentState", e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-input-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  {ENDING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              {hasEnded(formData.employmentState) && (
                <>
                  <Field label="End date" htmlFor="edit-separationDate" required error={errors.separationDate}>
                    <TextInput {...text("separationDate")} type="date" min={formData.hireDate || undefined} />
                  </Field>
                  <Field
                    label={formData.employmentState === "OTHERS" ? "Specific reason" : "Reason (optional)"}
                    htmlFor="edit-separationReason"
                    required={formData.employmentState === "OTHERS"}
                    error={errors.separationReason}
                  >
                    <TextInput {...text("separationReason")} />
                  </Field>
                </>
              )}
              <Field
                label="Timekeeping code"
                htmlFor="edit-biometricCode"
                error={errors.biometricCode}
                hint="The number this person has on the biometric device. Attendance imports match on this."
                className="sm:col-span-2"
              >
                <TextInput {...text("biometricCode")} placeholder="e.g. 188" />
              </Field>
              <div className="sm:col-span-2 rounded-xl border border-border-soft bg-surface p-3">
                <p className="text-sm font-medium text-foreground">Leave eligibility (set by HR)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paternity and Solo Parent leave are granted automatically only when marked here. Never inferred from sex, civil status or any other field.
                </p>
                <div className="mt-2 flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" disabled={!canEditAll} checked={eligibility.paternityLeaveEligible}
                      onChange={(e) => { setEligibility((prev) => ({ ...prev, paternityLeaveEligible: e.target.checked })); setIsDirty(true); }} className="h-4 w-4" />
                    Eligible for Paternity Leave
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" disabled={!canEditAll} checked={eligibility.soloParentLeaveEligible}
                      onChange={(e) => { setEligibility((prev) => ({ ...prev, soloParentLeaveEligible: e.target.checked })); setIsDirty(true); }} className="h-4 w-4" />
                    Eligible for Solo Parent Leave
                  </label>
                </div>
              </div>
            </div>
          </FormSection>

          {/* ── Education & licenses ──────────────────────────────────────── */}
          {/* Everything here is optional: PRC and NC only for roles that hold
              them, and their dates only once the number is recorded. */}
          <FormSection icon={<BookOpen />} title="Education & Licenses" locked={!canEditAll}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="PRC License #" htmlFor="edit-prcLicenseNumber" error={errors.prcLicenseNumber}>
                <TextInput {...text("prcLicenseNumber")} placeholder="For licensed professionals only" />
              </Field>
              <Field label="Profession" htmlFor="edit-professionalRole" error={errors.professionalRole}>
                <TextInput {...text("professionalRole")} placeholder="e.g. Registered Nurse" />
              </Field>
              {formData.prcLicenseNumber.trim() && (
                <>
                  <Field label="PRC issued" htmlFor="edit-prcIssuedDate" error={errors.prcIssuedDate}>
                    <TextInput {...text("prcIssuedDate")} type="date" />
                  </Field>
                  <Field label="PRC valid until" htmlFor="edit-prcValidUntil" error={errors.prcValidUntil}>
                    <TextInput {...text("prcValidUntil")} type="date" min={formData.prcIssuedDate || undefined} />
                  </Field>
                </>
              )}
              <Field label="NC certificate number" htmlFor="edit-ncCertificateNumber" hint="TESDA national certificate, e.g. NC II">
                <TextInput {...text("ncCertificateNumber")} />
              </Field>
              <Field label="NC qualification" htmlFor="edit-ncQualification">
                <TextInput {...text("ncQualification")} placeholder="e.g. Caregiving NC II" />
              </Field>
              {formData.ncCertificateNumber.trim() && (
                <Field label="NC valid until" htmlFor="edit-ncValidUntil" error={errors.ncValidUntil} hint="Only if the certificate states one.">
                  <TextInput {...text("ncValidUntil")} type="date" />
                </Field>
              )}
              <Field label="Primary school" htmlFor="edit-primarySchool">
                <TextInput {...text("primarySchool")} />
              </Field>
              <Field label="Secondary school" htmlFor="edit-secondarySchool">
                <TextInput {...text("secondarySchool")} />
              </Field>
              <Field label="Tertiary school" htmlFor="edit-tertiarySchool">
                <TextInput {...text("tertiarySchool")} />
              </Field>
              <Field label="Course" htmlFor="edit-tertiaryCourse">
                <TextInput {...text("tertiaryCourse")} />
              </Field>
              <Field label="Graduated" htmlFor="edit-tertiaryGraduated">
                <select
                  id="edit-tertiaryGraduated"
                  value={formData.tertiaryGraduated}
                  disabled={!canEdit("tertiaryGraduated")}
                  onChange={(e) => setField("tertiaryGraduated", e.target.value)}
                  className={controlClass()}
                >
                  <option value="">Not recorded</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field label="Diploma" htmlFor="edit-diploma">
                <TextInput {...text("diploma")} />
              </Field>
              <Field label="Vocational qualification" htmlFor="edit-vocationalQualification" className="sm:col-span-2">
                <TextInput {...text("vocationalQualification")} />
              </Field>
            </div>
          </FormSection>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-t border-border-soft bg-surface">
          <p className="text-xs text-muted-foreground">
            {changeCount > 0
              ? `${changeCount} change${changeCount === 1 ? "" : "s"} not yet saved`
              : "No changes yet"}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button variant="review" onClick={openReview} disabled={isSubmitting || changeCount === 0}>
              Review Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Review Changes Dialog */}
    <Dialog open={showReview} onOpenChange={setShowReview}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
          <DialogDescription>Check these before saving. Nothing has been saved yet.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 py-2">

          {canEditAll && hasOrgChanges && (
            <div className="rounded-xl border border-status-info-border bg-status-info-surface p-4 space-y-3">
              <p className="text-sm font-bold text-status-info-foreground">Organizational changes</p>
              {formData.unitId !== original.unitId && (
                <ChangeRow
                  label="Unit"
                  from={units.find(u => u.id === original.unitId)?.name || "Not set"}
                  to={units.find(u => u.id === formData.unitId)?.name || "Not set"}
                />
              )}
              {formData.departmentId !== original.departmentId && (
                <ChangeRow
                  label="Department"
                  from={departments.find(d => d.id === original.departmentId)?.name || "Not set"}
                  to={departments.find(d => d.id === formData.departmentId)?.name || "Not set"}
                />
              )}
              {formData.jobRoleId !== original.jobRoleId && (
                <ChangeRow
                  label="Job role"
                  from={jobRoles.find(j => j.id === original.jobRoleId)?.title || "Not set"}
                  to={jobRoles.find(j => j.id === formData.jobRoleId)?.title || "Not set"}
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-status-info-border">
                <PreviewValue label="Supervisor now">
                  {employee.immediateSupervisor
                    ? `${employee.immediateSupervisor.firstName} ${employee.immediateSupervisor.lastName}`
                    : "None"}
                </PreviewValue>
                <PreviewValue label="Supervisor after saving">
                  {previewData
                    ? (previewData.supervisor
                        ? `${previewData.supervisor.firstName} ${previewData.supervisor.lastName}`
                        : previewData.noSupervisorRequired
                          ? "No supervisor required"
                          : ASSIGNMENT_STATUS_LABEL[previewData.assignmentStatus] ?? humanize(previewData.assignmentStatus))
                    : "Will be recalculated"}
                </PreviewValue>
              </div>
              {showOverrideWorkflow && (
                <p className="text-xs text-foreground/75">
                  <strong>Override decision:</strong> {humanize(overrideDecision)}
                </p>
              )}
            </div>
          )}

          {contactsChanged && (
            <div className="rounded-xl border border-border-soft bg-surface p-3 space-y-1">
              <p className="text-sm font-semibold text-foreground">Emergency contacts</p>
              {filledContacts(contacts).map((c, i) => (
                <p key={i} className="text-sm text-foreground/80">{i + 1}. {c.contactName} ({c.relationship}) · {c.mobilePhone}</p>
              ))}
            </div>
          )}
          {eligibilityChanged && (
            <div className="rounded-xl border border-border-soft bg-surface p-3 space-y-2">
              {eligibility.paternityLeaveEligible !== originalEligibility.paternityLeaveEligible && (
                <ChangeRow label="Paternity Leave eligibility" from={originalEligibility.paternityLeaveEligible ? "Eligible" : "Not eligible"} to={eligibility.paternityLeaveEligible ? "Eligible" : "Not eligible"} />
              )}
              {eligibility.soloParentLeaveEligible !== originalEligibility.soloParentLeaveEligible && (
                <ChangeRow label="Solo Parent Leave eligibility" from={originalEligibility.soloParentLeaveEligible ? "Eligible" : "Not eligible"} to={eligibility.soloParentLeaveEligible ? "Eligible" : "Not eligible"} />
              )}
            </div>
          )}
          {changedKeys.filter(k => !ORG_FIELDS.has(k)).map(key => (
            <div key={key} className="rounded-xl border border-border-soft bg-surface p-3">
              <ChangeRow
                label={FIELD_LABELS[key]}
                from={display(key, original[key])}
                to={display(key, formData[key])}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setShowReview(false)}>Back to Edit</Button>
          <Button
            variant="solid"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || (showOverrideWorkflow && overrideDecision === 'SELECT_DIFFERENT_OVERRIDE' && (!newSupervisorId || !overrideReason))}
          >
            {isSubmitting ? "Saving…" : "Confirm Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

/* ─── Form building blocks ──────────────────────────────────────────────── */

/** One visual style for every control in this form. */
function controlClass(invalid?: boolean) {
  return cn(
    "w-full h-11 px-3.5 text-sm rounded-xl border bg-surface text-foreground",
    "placeholder:text-muted-foreground transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500",
    "disabled:bg-surface-2 disabled:text-muted-foreground disabled:cursor-not-allowed",
    invalid
      ? "border-status-danger-foreground/60 bg-status-danger-surface/40"
      : "border-input hover:border-primary-300 dark:hover:border-primary-900"
  );
}

function FormSection({
  icon,
  title,
  description,
  locked,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Shown as read-only for someone editing their own profile. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface-2/40 dark:bg-surface-2/30 p-4 sm:p-5 shadow-none">
      <div className="flex items-start gap-3 mb-4">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300 flex items-center justify-center [&_svg]:size-[18px]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
            {title}
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" /> Managed by HR
              </span>
            )}
          </h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-status-danger-foreground ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-status-danger-foreground" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function TextInput({ invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={controlClass(invalid)} />;
}

function SelectInput({
  invalid,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; options: Array<{ value: string; label: string }> }) {
  return (
    <select {...props} aria-invalid={invalid || undefined} className={controlClass(invalid)}>
      <option value="" disabled>Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground break-words">{value || "Not set"}</p>
    </div>
  );
}

function PreviewValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground break-words">{children}</p>
    </div>
  );
}

function ChangeRow({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-status-danger-foreground line-through decoration-2">{from}</span>
        <span aria-hidden="true" className="text-muted-foreground">→</span>
        <span className="font-semibold text-status-success-foreground">{to}</span>
      </span>
    </div>
  );
}
