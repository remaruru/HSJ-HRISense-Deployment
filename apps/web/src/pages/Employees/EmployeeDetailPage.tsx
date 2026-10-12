import { useState, useEffect } from "react";
import { BreakdownButton, MetricBreakdownDialog } from '@/components/shared/MetricBreakdown';
import { profileCompletionSpec } from '@/components/shared/profileCompletionSpec';
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft, Edit2, Archive, UserCheck, Shield, UploadCloud, FileText, X,
  LayoutGrid, User, Phone, Briefcase, Landmark, Siren, CalendarClock, Clock,
  CalendarDays, ClipboardCheck, GraduationCap, BookOpen, ShieldCheck, Stethoscope, Brain,
  History, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { InfoSection, InfoGrid, InfoField, InfoEmpty } from "@/components/ui/info-section";
import { SectionNav, type SectionNavGroup } from "@/components/ui/section-nav";
import { STATUS_TONE_CHIP } from "@/components/ui/status-tone";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { api } from "@/services/api";
import { toast } from "sonner";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/error-handler.util";
import { downloadProtectedFile, openProtectedFile } from "@/lib/downloadProtectedFile";
import { EmployeeEditForm } from "./components/EmployeeEditForm";
import { DocumentUploadDialog } from "./components/DocumentUploadDialog";
import { DocumentEditMetadataDialog } from "./components/DocumentEditMetadataDialog";
import { DocumentReplaceDialog } from "./components/DocumentReplaceDialog";
import { DocumentDeleteDialog } from "./components/DocumentDeleteDialog";
import { SupervisorAssignmentDialog } from "./components/SupervisorAssignmentDialog";
import { AccountManagementPanel } from "./components/AccountManagementPanel";
import { GovernmentInfoDialog } from "./components/GovernmentInfoDialog";
import { LeaveBalancePanel } from "@/pages/Leave/components/LeaveBalancePanel";
import { useAuth } from "@/providers/AuthProvider";
import { formatAge } from "@/lib/age";
import {
  EMPLOYMENT_STATE_LABELS, employmentDuration, formatEmploymentDate, hasEnded, isProfessional,
  type EmploymentState,
} from "@/lib/employment";

import { EmployeeScheduleProfileTab } from "./components/EmployeeScheduleProfileTab";
import { EmployeeAttendanceProfileTab } from "./components/EmployeeAttendanceProfileTab";
import { EmployeeComplianceProfileTab } from "./components/EmployeeComplianceProfileTab";
import { EmployeeMedicalProfileTab } from "./components/EmployeeMedicalProfileTab";
import { EmployeePsychologicalProfileTab } from "./components/EmployeePsychologicalProfileTab";
import { EmployeeEvaluationProfileTab } from "./components/EmployeeEvaluationProfileTab";
import { EmployeeTrainingProfileTab } from "./components/EmployeeTrainingProfileTab";
import { EmployeeAdditionalOversight } from "./components/EmployeeAdditionalOversight";
import { LoadError } from "@/components/shared/LoadError";
import { ProfileBannerImage } from "@/pages/Profile/components/ProfileHero";
import { PersonalRecordFields, ResidenceFields, EducationLicensesSections } from "./components/EmployeeRecordSections";

/**
 * How the sections are grouped and labelled in the side navigation. Which of
 * them a viewer actually sees is still decided by `visibleTabs` inside the
 * component — this only arranges them.
 */
const SECTION_LAYOUT: Array<{ label: string; items: Array<{ id: string; icon: React.ReactNode }> }> = [
  {
    label: "Profile",
    items: [
      { id: "Overview", icon: <LayoutGrid /> },
      { id: "Personal", icon: <User /> },
      { id: "Contact", icon: <Phone /> },
      { id: "Employment", icon: <Briefcase /> },
      { id: "Government", icon: <Landmark /> },
      { id: "Education", icon: <BookOpen /> },
      { id: "Emergency", icon: <Siren /> },
    ],
  },
  {
    label: "Work",
    items: [
      { id: "Schedule", icon: <CalendarClock /> },
      { id: "Attendance", icon: <Clock /> },
      { id: "Leave Balances", icon: <CalendarDays /> },
      { id: "Evaluations", icon: <ClipboardCheck /> },
      { id: "Training", icon: <GraduationCap /> },
    ],
  },
  {
    label: "Records",
    items: [
      { id: "Documents", icon: <FileText /> },
      { id: "Compliance", icon: <ShieldCheck /> },
      { id: "Medical", icon: <Stethoscope /> },
      { id: "Psychological", icon: <Brain /> },
      { id: "Timeline", icon: <History /> },
    ],
  },
  {
    label: "Access",
    items: [{ id: "Account Management", icon: <KeyRound /> }],
  },
];

/**
 * Completion groups (from the API's single criteria table) → the section that
 * displays those fields. Sections not listed here are not part of completion.
 */
const COMPLETION_GROUP_TO_SECTION: Record<string, string> = {
  "Personal": "Personal",
  "Contact": "Contact",
  "Employment": "Employment",
  "Government IDs": "Government",
  "Emergency Contact": "Emergency",
  "Documents": "Documents",
};

/**
 * A document row as served by `GET /employees/:employeeId/documents`.
 *
 * Every field except `notes` and `expiresAt` is required by the database, but
 * this profile renders defensively anyway: a document filed by an older import
 * or an interrupted upload must show as an incomplete row, never crash the whole
 * 201 file.
 */
interface EmployeeDocument {
  id: string;
  category?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
  isVisibleToEmployee?: boolean;
  isVisibleToSupervisor?: boolean;
  notes?: string | null;
}

const PREVIEWABLE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Shown wherever an optional profile value has not been filled in yet. */
const NOT_PROVIDED = 'Not provided';

/** Turns a stored code such as `ON_LEAVE` into `On Leave` for display. */
function formatEnumLabel(value?: string | null): string {
  if (!value) return NOT_PROVIDED;
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formats a stored date, never rendering "Invalid Date" to the user. */
function formatDate(value?: string | Date | null): string {
  if (!value) return NOT_PROVIDED;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? NOT_PROVIDED : date.toLocaleDateString();
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function formatDocumentCategory(category?: string | null): string {
  if (!category) return 'Uncategorised';
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFileSize(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileType(mimeType?: string | null, filename?: string | null): string {
  const known: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  };
  if (mimeType && known[mimeType]) return known[mimeType];
  const ext = filename?.split('.').pop();
  if (ext && ext !== filename) return ext.toUpperCase();
  return '';
}

function formatUploadedAt(uploadedAt?: string | null): string {
  if (!uploadedAt) return '';
  const date = new Date(uploadedAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function canPreviewInBrowser(mimeType?: string | null): boolean {
  return !!mimeType && PREVIEWABLE_MIME_TYPES.includes(mimeType);
}

export default function EmployeeDetailPage() {
  // @ts-ignore
  const { employeeId } = useParams({ strict: false }) as any;
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === 'FULL';
  const isSelf = user?.employee?.id === employeeId;
  
  const visibleTabs = [
    "Overview",
    "Personal",
    "Contact",
    "Employment",
    "Schedule",
    "Attendance",
    "Government",
    "Education",
    "Emergency",
    "Documents",
    "Compliance",
    "Leave Balances",
  ];

  if (isFullHR || isSelf) {
    visibleTabs.push("Evaluations");
    visibleTabs.push("Training");
    visibleTabs.push("Medical");
    visibleTabs.push("Psychological");
  }

  visibleTabs.push("Timeline");

  if (isFullHR) {
    visibleTabs.push("Account Management");
  }

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSupervisorOpen, setIsSupervisorOpen] = useState(false);
  const [isGovernmentOpen, setIsGovernmentOpen] = useState(false);
  const [showMissingDetail, setShowMissingDetail] = useState(false);
  const [activeDocForEdit, setActiveDocForEdit] = useState<any>(null);
  const [activeDocForReplace, setActiveDocForReplace] = useState<any>(null);
  const [activeDocForDelete, setActiveDocForDelete] = useState<any>(null);

  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null);
  // Archive / restore in flight: the buttons wait for the server's answer.
  const [statusBusy, setStatusBusy] = useState(false);

  const fetchEmployee = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/employees/${employeeId}`);
      setEmployee(res.data.data);
      
      // Timeline is a secondary panel — a failure here must not blank the profile,
      // but it is surfaced rather than silently swallowed.
      try {
        const timelineRes = await api.get(`/employees/${employeeId}/timeline`);
        setTimeline(timelineRes.data.data ?? []);
        setTimelineError(null);
      } catch (timelineErr) {
        setTimeline([]);
        setTimelineError(getApiErrorMessage(timelineErr, 'The activity history could not be loaded.'));
      }

      // Document metadata comes from the documents endpoint, which applies the
      // per-viewer visibility rules. The employee record itself carries only
      // document ids (used for the profile completion figure).
      try {
        const docsRes = await api.get(`/employees/${employeeId}/documents`);
        setDocuments(Array.isArray(docsRes.data?.data) ? docsRes.data.data : []);
        setDocumentsError(null);
      } catch (docsErr) {
        setDocuments([]);
        setDocumentsError(getApiErrorMessage(docsErr, 'The documents for this employee could not be loaded.'));
      }
    } catch (error) {
      setEmployee(null);
      setLoadError({
        status: getApiErrorStatus(error),
        message: getApiErrorMessage(error, 'This employee profile could not be loaded.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [employeeId]);

  /**
   * Percentage and missing list both come from the API's single criteria table
   * (`profile-completion.ts`), so they can never describe different things.
   */
  const completion = {
    percentage: employee?.profileCompletion || 0,
    missing: employee?.missingFields || [],
    groups: (employee?.missingFieldGroups || []) as Array<{ group: string; items: string[] }>,
  };
  const [showCompletionBreakdown, setShowCompletionBreakdown] = useState(false);
  const completionSpec = profileCompletionSpec(
    completion.percentage,
    employee?.profileCompletionBreakdown,
    employee ? `${employee.firstName} ${employee.lastName}` : undefined
  );

  /**
   * Where the gaps are. Shown to HR and to the employee themselves — the same
   * audience as the detailed Missing Information panel. Supervisors keep the
   * compact summary only; no permission is widened.
   */
  const showCompletionMarkers = isFullHR || isSelf;
  const missingIds = new Set<string>(showCompletionMarkers ? employee?.missingFieldIds || [] : []);
  const isMissing = (id: string) => missingIds.has(id);

  const missingBySection: Record<string, number> = {};
  if (showCompletionMarkers) {
    for (const { group, items } of completion.groups) {
      const section = COMPLETION_GROUP_TO_SECTION[group];
      if (section) missingBySection[section] = (missingBySection[section] ?? 0) + items.length;
    }
  }
  const completionSections = new Set(Object.values(COMPLETION_GROUP_TO_SECTION));

  /**
   * Employment timeline. The end date only exists once the employment has
   * ended (AWOL / Resigned / Retired / Terminated / Others); while someone is
   * still employed the length of service counts up to today.
   */
  const employmentEnded = hasEnded(employee?.employmentState);
  const employmentEndDate = employmentEnded ? employee?.separationDate : null;
  // An ended employment without a recorded end date has no length of service:
  // counting it up to today would invent an end date.
  const endDateMissing = employmentEnded && !employee?.separationDate;
  const serviceLength = endDateMissing ? null : employmentDuration(employee?.hireDate, employmentEndDate);
  const employeeIsProfessional = isProfessional(employee);

  const navGroups: SectionNavGroup[] = SECTION_LAYOUT
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => visibleTabs.includes(item.id))
        .map((item) => ({
          id: item.id,
          label: item.id,
          icon: item.icon,
          missing: missingBySection[item.id],
          complete:
            showCompletionMarkers &&
            completionSections.has(item.id) &&
            !missingBySection[item.id],
        })),
    }))
    .filter((group) => group.items.length > 0);

  /**
   * Document streams require a bearer token, so they are fetched through the API
   * client rather than linked with a plain anchor (which would 401).
   */
  const handleDocumentAction = async (doc: EmployeeDocument, action: 'preview' | 'download') => {
    setBusyDocumentId(doc.id);
    try {
      if (action === 'preview') {
        await openProtectedFile(`/documents/${doc.id}/preview`);
      } else {
        await downloadProtectedFile(
          `/documents/${doc.id}/download`,
          doc.originalFilename?.trim() || `document-${doc.id}`
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The file could not be opened.'));
    } finally {
      setBusyDocumentId(null);
    }
  };

  // The page changes only after the server confirms: a failed archive leaves
  // the employee exactly as shown, with the reason in a toast.
  const handleArchive = async () => {
    if (statusBusy) return;
    if (!confirm("Are you sure you want to archive this employee? They will not be able to log in.")) return;
    setStatusBusy(true);
    try {
      await api.patch(`/employees/${employeeId}/archive`);
      toast.success("Employee archived.");
      // @ts-ignore
      navigate({ to: "/employees" });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The employee could not be archived."));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleRestore = async () => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      await api.patch(`/employees/${employeeId}/restore`);
      setEmployee({ ...employee, deletedAt: null });
      toast.success("Employee restored.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "The employee could not be restored."));
    } finally {
      setStatusBusy(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading profile...</div>;
  }

  if (!employee) {
    // 404 is "not found"; anything else is a failure to load, with a retry.
    if (loadError && loadError.status !== 404) {
      return (
        <div className="mx-auto max-w-xl p-6 sm:p-10">
          <LoadError message={loadError.message} onRetry={loadError.status === 403 ? undefined : fetchEmployee} />
        </div>
      );
    }
    return <div className="p-10 text-center text-danger">Employee not found. The record may have been removed.</div>;
  }

  const isArchived = !!employee.deletedAt;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-xl mx-auto"
    >
      {/* Employee Management is HR's (FULL) screen — the route sends everyone
          else to My Profile or My Team. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* @ts-ignore */}
        <Link to="/employees" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Employee Directory
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee Management</span>
      </div>

      {isSelf && isFullHR && (
        <p className={`rounded-xl border px-3 py-2 text-sm ${STATUS_TONE_CHIP.info}`}>
          This is your own record, opened in Employee Management.{' '}
          {/* @ts-ignore */}
          <Link to="/profile" className="font-semibold underline underline-offset-2">Open My Profile</Link> for your self-service profile.
        </p>
      )}

      <motion.div variants={staggerItem} className="rounded-2xl border border-border-soft bg-surface shadow-card overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary-600 to-primary-400 relative">
          <ProfileBannerImage src={employee.bannerUrl} />
          {isArchived && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="danger" className="text-sm">ARCHIVED</Badge>
            </div>
          )}
        </div>
        
        <div className="px-6 pb-6 relative flex flex-col md:flex-row justify-between items-start md:items-end -mt-12 gap-4">
          <div className="flex items-end gap-4">
            <Avatar 
              name={`${employee.firstName} ${employee.lastName}`} 
              src={employee.photoUrl} 
              className="h-24 w-24 border-4 border-surface shadow-md"
            />
            <div className="mb-2">
              <h1 className="text-2xl font-bold font-heading text-foreground">
                {employee.firstName} {employee.middleName || ''} {employee.lastName} {employee.suffix || ''}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`border ${STATUS_TONE_CHIP.neutral} font-mono`}>{employee.employeeNumber}</Badge>
                <Badge className={`border ${STATUS_TONE_CHIP.total}`}>{employee.jobRole?.title}</Badge>
                
                {/* Employee Status Badges */}
                {employee.employmentStatus === 'PROBATIONARY' && <Badge className={`border ${STATUS_TONE_CHIP.warning}`}>Probationary</Badge>}
                {Date.now() - new Date(employee.hireDate).getTime() < 30 * 24 * 60 * 60 * 1000 && <Badge className={`border ${STATUS_TONE_CHIP.info}`}>New Hire</Badge>}
                {/* The stored tiers are FULL / SUPERVISOR / STANDARD — this used to
                    compare against 'HR', so the badge never appeared. */}
                {employee.jobRole?.permissionTier === 'FULL' && <Badge className={`border ${STATUS_TONE_CHIP.accent}`}>HR Personnel</Badge>}
                {employee.jobRole?.permissionTier === 'SUPERVISOR' && <Badge className={`border ${STATUS_TONE_CHIP.total}`}>Supervisor</Badge>}
                {employee.deletedAt && <Badge className={`border ${STATUS_TONE_CHIP.danger}`}>Archived</Badge>}
                {employee.employmentState === 'ON_LEAVE' && <Badge className={`border ${STATUS_TONE_CHIP.warning}`}>On Leave</Badge>}
                {!employee.deletedAt && employee.employmentState === 'ACTIVE' && <Badge className={`border ${STATUS_TONE_CHIP.success}`}>Active</Badge>}
                {/* Ended employment — AWOL / Resigned / Retired / Terminated / Others. */}
                {employmentEnded && (
                  <Badge className={`border ${STATUS_TONE_CHIP.danger}`}>
                    {EMPLOYMENT_STATE_LABELS[employee.employmentState as EmploymentState] ?? formatEnumLabel(employee.employmentState)}
                  </Badge>
                )}
                {/* A PRC licence on file is what makes someone a professional. */}
                {employeeIsProfessional && (
                  <Badge className={`border ${STATUS_TONE_CHIP.info}`}>
                    Professional{employee.professionalRole ? ` · ${employee.professionalRole}` : ''}
                  </Badge>
                )}
                {isFullHR && employee.employeeNumber?.startsWith('DEV-') && <Badge className={`border ${STATUS_TONE_CHIP.neutral}`}>Development Account</Badge>}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-4">
            {/* Profile Completion */}
            <div className="bg-surface border border-border-soft rounded-xl p-3.5 text-right shadow-card min-w-[220px]">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile completion</span>
                <span className={`text-lg font-bold tabular-nums ${completion.percentage >= 100 ? 'text-status-success-foreground' : 'text-primary-600 dark:text-primary-300'}`}>
                  {completion.percentage}%
                </span>
              </div>
              <div
                className="w-full bg-surface-2 rounded-full h-2 mb-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={completion.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completion"
              >
                <div
                  className={`h-2 rounded-full transition-all ${completion.percentage >= 100 ? 'bg-status-success-foreground' : 'bg-primary-500'}`}
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              {(isFullHR || isSelf) && completionSpec && (
                <div className="text-left mb-1">
                  <BreakdownButton onClick={() => setShowCompletionBreakdown(true)} />
                </div>
              )}
              {completion.missing.length > 0 && (
                <div className="text-xs text-left">
                  <span className="text-status-danger-foreground font-semibold">Missing: </span>
                  <span className="text-muted-foreground">
                    {completion.missing.slice(0, 2).join(', ')}
                    {completion.missing.length > 2 ? ` +${completion.missing.length - 2} more` : ''}
                  </span>
                  {(isFullHR || isSelf) && (
                    <button
                      type="button"
                      onClick={() => setShowMissingDetail((open) => !open)}
                      aria-expanded={showMissingDetail}
                      className="ml-2 font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-2 dark:text-primary-300 dark:hover:text-primary-300"
                    >
                      {showMissingDetail ? 'Hide details' : 'View all'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Administrative actions: HR (FULL) only, and the API refuses them to
                anyone else (archive / restore / account routes are FULL-only).
                Self-service editing is Edit My Profile on My Profile. */}
            {isFullHR && (
              <div className="flex gap-2">
                <Button variant="update" leftIcon={<Edit2 className="h-4 w-4" />} onClick={() => setIsEditOpen(true)}>
                  Edit Profile
                </Button>
                {isArchived ? (
                  <Button variant="create" leftIcon={<Shield className="h-4 w-4" />} onClick={handleRestore} disabled={statusBusy}>
                    Restore Access
                  </Button>
                ) : (
                  <Button
                    variant="delete"
                    leftIcon={<Archive className="h-4 w-4" />}
                    onClick={handleArchive}
                    // Archiving deactivates the account: never your own (the API refuses it too).
                    disabled={statusBusy || isSelf}
                    title={isSelf ? 'You cannot archive your own record — another HR administrator must.' : undefined}
                  >
                    Archive
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <MetricBreakdownDialog open={showCompletionBreakdown} onOpenChange={setShowCompletionBreakdown} spec={completionSpec} />

      {/* Missing information — same criteria that produce the percentage above. */}
      {showMissingDetail && (isFullHR || isSelf) && completion.missing.length > 0 && (
        <motion.div variants={staggerItem}>
          <InfoSection
            title="Missing Information"
            description={`${completion.missing.length} item${completion.missing.length === 1 ? '' : 's'} still needed to reach 100% profile completion.`}
            className="border-status-danger-border bg-status-danger-surface/60"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {completion.groups.map(({ group, items }) => (
                <div key={group} className="min-w-0">
                  {COMPLETION_GROUP_TO_SECTION[group] && visibleTabs.includes(COMPLETION_GROUP_TO_SECTION[group]) ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(COMPLETION_GROUP_TO_SECTION[group])}
                      className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300 hover:underline underline-offset-2 mb-1"
                    >
                      {group} →
                    </button>
                  ) : (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      {group}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item} className="text-sm text-foreground flex items-start gap-2">
                        <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 rounded-full bg-status-danger-foreground shrink-0" />
                        <span className="break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </InfoSection>
        </motion.div>
      )}

      {/* Sections: a side rail on desktop, a scrolling row on smaller screens.
          The rail marks each section that still has missing information. */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
      <motion.div variants={staggerItem} className="min-w-0">
        <SectionNav
          aria-label="Employee record sections"
          groups={navGroups}
          value={activeTab}
          onChange={setActiveTab}
        />
      </motion.div>

      {/* Section Content */}
      <motion.div variants={staggerItem} id={`section-${activeTab}`} role="tabpanel" className="space-y-5 min-w-0">
        {activeTab === "Overview" && (
          <InfoSection title="Employee Summary" description="The identifying details HR needs most often.">
            <InfoGrid columns={3}>
              <InfoField label="Full Name" value={`${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()} />
              <InfoField label="Employee ID" value={employee.employeeNumber} />
              <InfoField label="Unit" value={employee.unit?.name} />
              <InfoField label="Job Role" value={employee.jobRole?.title} />
              <InfoField label="Status" value={formatEnumLabel(employee.employmentStatus)} />
              <InfoField label="Personal Email (login)" value={employee.personalEmail} />
            </InfoGrid>
          </InfoSection>
        )}

        {activeTab === "Personal" && (
          <InfoSection title="Personal Details" missingCount={missingBySection["Personal"]}>
            <InfoGrid columns={3}>
              <InfoField label="Sex" value={formatEnumLabel(employee.gender)} missing={isMissing("gender")} />
              <InfoField label="Civil Status" value={formatEnumLabel(employee.civilStatus)} missing={isMissing("civilStatus")} />
              <InfoField label="Date of Birth" value={formatDate(employee.dateOfBirth)} missing={isMissing("dateOfBirth")} />
              {/* Worked out from the date of birth each time — never stored. */}
              <InfoField label="Age" value={formatAge(employee.dateOfBirth) ?? undefined} />
              <InfoField label="Place of Birth" value={employee.placeOfBirth} />
              <InfoField label="Nationality" value={employee.nationality} />
              <InfoField label="Religion" value={employee.religion} />
              <PersonalRecordFields employee={employee} />
            </InfoGrid>
          </InfoSection>
        )}

        {activeTab === "Contact" && (
          <>
            <InfoSection title="Contact Details" missingCount={missingBySection["Contact"]}>
              <InfoGrid>
                <InfoField label="Mobile Number" value={employee.mobilePhone} missing={isMissing("mobilePhone")} />
                <InfoField label="Telephone Number" value={employee.telephoneNumber || employee.homePhone} />
                <InfoField label="Personal Email (login)" value={employee.personalEmail} missing={isMissing("email")} />
              </InfoGrid>
              {isFullHR && employee.loginEmailMatchesPersonalEmail === false && (
                <p className={`mt-3 rounded-xl border px-3 py-2 text-xs ${STATUS_TONE_CHIP.warning}`}>
                  This account still signs in with <strong>{employee.user?.email}</strong>, recorded before the personal
                  email became the login. Switch it from <strong>Account Management</strong>.
                </p>
              )}
            </InfoSection>
            <InfoSection title="Addresses">
              <InfoGrid>
                <InfoField label="Present Address" value={employee.presentAddress} missing={isMissing("presentAddress")} />
                <InfoField label="Permanent / Provincial Address" value={employee.permanentAddress} />
                <ResidenceFields employee={employee} />
              </InfoGrid>
            </InfoSection>
          </>
        )}

        {activeTab === "Employment" && (
          <>
            <InfoSection title="Employment Details" missingCount={missingBySection["Employment"]}>
              <InfoGrid columns={3}>
                <InfoField label="Employment Status" value={formatEnumLabel(employee.employmentStatus)} />
                <InfoField
                  label="Employee Status"
                  value={EMPLOYMENT_STATE_LABELS[employee.employmentState as EmploymentState] ?? formatEnumLabel(employee.employmentState)}
                />
                {employee.employmentState === 'OTHERS' && (
                  <InfoField label="Specific Reason" value={employee.separationReason} />
                )}
                <InfoField label="Start Date" value={formatEmploymentDate(employee.hireDate)} missing={isMissing("hireDate")} />
                {/* Only an ended employment has an end date; otherwise the row
                    says so rather than showing a blank. */}
                <InfoField
                  label="End Date"
                  value={employmentEnded
                    ? (employee.separationDate ? formatEmploymentDate(employee.separationDate) : "Not recorded")
                    : "Present — currently employed"}
                />
                <InfoField
                  label="Length of Service"
                  value={serviceLength
                    ? `${serviceLength.text}${serviceLength.ongoing ? ' (start date → present)' : ' (start date → end date)'}`
                    : endDateMissing ? "Cannot be calculated — no end date recorded" : undefined}
                />
                <InfoField
                  label="Leave Eligibility (HR)"
                  value={[employee.paternityLeaveEligible && "Paternity Leave", employee.soloParentLeaveEligible && "Solo Parent Leave"].filter(Boolean).join(", ") || "Not marked for Paternity or Solo Parent Leave"}
                />
                <InfoField label="Probation Date" value={formatDate(employee.probationDate)} />
                <InfoField label="Regularization Date" value={formatDate(employee.regularizationDate)} />
                <InfoField label="Unit" value={employee.unit?.name} missing={isMissing("unit")} />
                <InfoField label="Department" value={employee.department?.name} missing={isMissing("department")} />
                <InfoField label="Job Role" value={employee.jobRole?.title} missing={isMissing("jobRole")} />
                <InfoField label="Permission Tier" value={formatEnumLabel(employee.jobRole?.permissionTier)} />
              </InfoGrid>
            </InfoSection>

            <InfoSection
              title="Immediate Supervisor"
              action={user?.permissionTier === 'FULL' ? (
                <Button size="sm" variant="update" onClick={() => setIsSupervisorOpen(true)}>
                  Override Supervisor
                </Button>
              ) : undefined}
            >
              
              <div className="mb-4">
                {employee.supervisorAssignmentStatus === 'PENDING' && (
                  <div className="bg-status-warning-surface border border-status-warning-border text-status-warning-foreground text-sm px-3 py-2 rounded-lg mb-3">
                    <strong>Pending HR Review:</strong> {employee.supervisorPendingReason}
                  </div>
                )}
                {employee.supervisorAssignmentSource === 'MANUAL_OVERRIDE' && (
                  <div className="bg-status-info-surface border border-status-info-border text-status-info-foreground text-sm px-3 py-2 rounded-lg mb-3">
                    <strong>Manual Override Active:</strong> {employee.supervisorOverrideReason || 'Assigned by HR'}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                {employee.immediateSupervisor ? (
                  <div className="p-3 rounded-xl border border-border-soft bg-muted/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{employee.immediateSupervisor.firstName} {employee.immediateSupervisor.lastName}</p>
                        <p className="text-xs text-muted-foreground">{employee.immediateSupervisor.employeeNumber} · {employee.immediateSupervisor.jobRole?.title}</p>
                      </div>
                      <Badge variant="outline" className="bg-success-light text-success-dark">Active</Badge>
                    </div>
                    {employee.supervisorAssignmentSource === 'AUTOMATIC_HIERARCHY' && (
                      <p className="text-xs text-status-info-foreground mt-1">Automatically assigned based on the organizational hierarchy.</p>
                    )}
                    {employee.organizationalPath?.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Path: {employee.organizationalPath.join(' → ')}
                      </div>
                    )}
                  </div>
                ) : employee.noSupervisorRequired && employee.supervisorAssignmentStatus !== 'PENDING' ? (
                  <InfoEmpty>No supervisor required — {employee.jobRole?.title ?? 'this'} is a top-level role.</InfoEmpty>
                ) : (
                  <InfoEmpty>No active supervisor assigned.</InfoEmpty>
                )}
              </div>
            </InfoSection>

            {/* A second, additional overseer (HR only). The immediate supervisor above is unchanged. */}
            {isFullHR && (
              <EmployeeAdditionalOversight
                employeeId={employee.id}
                immediateSupervisorName={employee.immediateSupervisor ? `${employee.immediateSupervisor.firstName} ${employee.immediateSupervisor.lastName}`.trim() : null}
              />
            )}

            <InfoSection title="System Account">
              {employee.user ? (
                <InfoGrid>
                  <InfoField label="Login Email" value={employee.user.email} />
                </InfoGrid>
              ) : (
                <InfoEmpty>No user account linked.</InfoEmpty>
              )}
            </InfoSection>
          </>
        )}

        {activeTab === "Schedule" && (
          <EmployeeScheduleProfileTab
            employeeId={employeeId}
            employeeName={`${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || undefined}
          />
        )}

        {activeTab === "Attendance" && (
          <EmployeeAttendanceProfileTab employeeId={employeeId} />
        )}

        {activeTab === "Education" && (
          // PRC license, TESDA national certificate and education — all optional.
          <EducationLicensesSections employee={employee} />
        )}

        {activeTab === "Government" && (
          <InfoSection
            title="Government IDs"
            description="Statutory numbers on file for this employee."
            missingCount={missingBySection["Government"]}
            action={isFullHR ? (
              <Button size="sm" variant="update" leftIcon={<Edit2 />} onClick={() => setIsGovernmentOpen(true)}>
                Edit Government Information
              </Button>
            ) : undefined}
          >
            <InfoGrid>
              <InfoField label="SSS Number" value={employee.sssNumber} missing={isMissing("sssNumber")} />
              <InfoField label="PhilHealth Number" value={employee.philhealthNumber} missing={isMissing("philhealthNumber")} />
              <InfoField label="Pag-IBIG Number" value={employee.pagibigNumber} missing={isMissing("pagibigNumber")} />
              <InfoField label="TIN" value={employee.tinNumber} missing={isMissing("tinNumber")} />
              <InfoField
                label="Other Government IDs"
                span
                value={
                  employee.governmentIds?.length
                    ? (
                      <ul className="space-y-0.5">
                        {employee.governmentIds.map((g: any) => (
                          <li key={g.id}><span className="text-muted-foreground">{g.idType}:</span> {g.idNumber}</li>
                        ))}
                      </ul>
                    )
                    : employee.otherGovernmentIds ? undefined : "None recorded"
                }
              />
              {/* Text recorded before IDs became rows is kept as written. */}
              {employee.otherGovernmentIds && (
                <InfoField
                  label="Other Government Numbers (recorded as text)"
                  span
                  value={<span className="whitespace-pre-line">{employee.otherGovernmentIds}</span>}
                />
              )}
            </InfoGrid>
          </InfoSection>
        )}

        {activeTab === "Emergency" && (
          <InfoSection title="Emergency Contacts" missingCount={missingBySection["Emergency"]}>
            {employee.emergencyContacts?.length ? (
              <div className="space-y-4">
                {employee.emergencyContacts.map((c: any) => (
                  <div key={c.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact {c.position}</p>
                    <InfoGrid columns={3}>
                      <InfoField label="Contact Person" value={c.contactName} />
                      <InfoField label="Relationship" value={c.relationship} />
                      <InfoField label="Mobile Number" value={c.mobilePhone} />
                    </InfoGrid>
                  </div>
                ))}
              </div>
            ) : employee.emergencyContactName || employee.emergencyContactRel || employee.emergencyContactPhone
              || isMissing("emergencyContactName") || isMissing("emergencyContactPhone") ? (
              <InfoGrid columns={3}>
                <InfoField label="Contact Person" value={employee.emergencyContactName} missing={isMissing("emergencyContactName")} />
                <InfoField label="Relationship" value={employee.emergencyContactRel} />
                <InfoField label="Mobile Number" value={employee.emergencyContactPhone} missing={isMissing("emergencyContactPhone")} />
              </InfoGrid>
            ) : (
              <InfoEmpty>No emergency contact recorded.</InfoEmpty>
            )}
          </InfoSection>
        )}

        {activeTab === "Documents" && (
          <InfoSection
            title="Uploaded Documents"
            description="Contracts, clearances, IDs and certificates on file."
            missingCount={missingBySection["Documents"]}
            action={isFullHR ? (
              <Button size="sm" variant="create" leftIcon={<UploadCloud />} onClick={() => setIsUploadOpen(true)}>
                Upload File
              </Button>
            ) : undefined}
          >
            {(isMissing("photoUrl") || isMissing("documents")) && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {isMissing("photoUrl") && <InfoField label="Profile Photo" value={null} missing />}
                {isMissing("documents") && (
                  <InfoField
                    label="Uploaded Documents"
                    value={`${documents.length} on file — 2 needed for full completion`}
                    missing
                  />
                )}
              </dl>
            )}
            {documentsError ? (
              <div className="text-center py-8 border border-dashed border-danger/40 rounded-xl">
                <p className="text-danger-dark text-sm">{documentsError}</p>
              </div>
            ) : documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {documents.map((doc) => {
                  const filename = doc.originalFilename?.trim() || 'Unnamed file';
                  const isBusy = busyDocumentId === doc.id;
                  return (
                    <div key={doc.id} className="flex flex-col gap-2 p-3 border border-border-soft rounded-xl bg-muted/20">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary-500 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-semibold truncate" title={filename}>{filename}</p>
                          <p className="text-xs text-muted-foreground">{formatDocumentCategory(doc.category)}</p>
                          <p className="text-xs text-muted-foreground">
                            {[formatFileType(doc.mimeType, filename), formatFileSize(doc.sizeBytes), formatUploadedAt(doc.uploadedAt)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1 pt-2 border-t border-border">
                        {canPreviewInBrowser(doc.mimeType) && (
                          <Button
                            size="sm"
                            variant="review"
                            className="h-7 px-2 text-xs"
                            disabled={isBusy}
                            onClick={() => handleDocumentAction(doc, 'preview')}>
                            Preview
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={isBusy}
                          onClick={() => handleDocumentAction(doc, 'download')}
                        >
                          {isBusy ? 'Working...' : 'Download'}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={doc.isVisibleToEmployee ? "text-success-600 border-success-200 bg-success-50" : "text-muted-foreground"}>
                            {doc.isVisibleToEmployee ? "Employee Visible" : "Employee Hidden"}
                          </Badge>
                          <Badge variant="outline" className={doc.isVisibleToSupervisor ? "text-success-600 border-success-200 bg-success-50" : "text-muted-foreground"}>
                            {doc.isVisibleToSupervisor ? "Supervisor Visible" : "Supervisor Hidden"}
                          </Badge>
                        </div>
                        {isFullHR && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="update" className="h-7 px-2 text-xs" onClick={() => setActiveDocForEdit(doc)}>Edit</Button>
                            <Button size="sm" variant="update" className="h-7 px-2 text-xs" onClick={() => setActiveDocForReplace(doc)}>Replace</Button>
                            <Button size="sm" variant="delete" className="h-7 px-2 text-xs" onClick={() => setActiveDocForDelete(doc)}>Delete</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <InfoEmpty>No documents uploaded yet.</InfoEmpty>
            )}
          </InfoSection>
        )}
        {activeTab === "Timeline" && (
          <InfoSection title="Employee Timeline" description="Recorded activity on this employee's record.">
            <div className="relative border-l-2 border-primary-200 dark:border-primary-900 ml-3 space-y-6 pb-2">
              {timelineError ? (
                <div className="pl-6 text-sm text-danger-dark">{timelineError}</div>
              ) : timeline.length > 0 ? timeline.map((log: any) => (
                <div key={log.id} className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-surface border-2 border-primary-500 shadow-sm" />
                  <div className="bg-muted/40 border border-border-soft rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2 gap-3">
                      <p className="font-semibold text-sm text-foreground">{formatEnumLabel(log.action)}</p>
                      <p className="text-xs text-muted-foreground shrink-0">{formatDateTime(log.createdAt)}</p>
                    </div>
                    {log.actor?.name && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Performed by: <span className="font-medium">{log.actor.name}</span>
                        {log.actor.employeeNumber ? ` (${log.actor.employeeNumber})` : ''}
                      </p>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs bg-surface border border-border rounded p-3">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key} className="flex gap-1.5 min-w-0">
                            <dt className="text-muted-foreground shrink-0">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:
                            </dt>
                            <dd className="text-foreground font-medium truncate">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </div>
              )) : (
                <div className="pl-6"><InfoEmpty>No activity recorded for this employee yet.</InfoEmpty></div>
              )}
            </div>
          </InfoSection>
        )}

        {activeTab === "Leave Balances" && (
          <LeaveBalancePanel employeeId={employee.id} canManage={isFullHR} />
        )}

        {activeTab === "Compliance" && (
          <EmployeeComplianceProfileTab employeeId={employee.id} />
        )}

        {activeTab === "Evaluations" && (isFullHR || isSelf) && (
          <EmployeeEvaluationProfileTab employeeId={employee.id} />
        )}

        {activeTab === "Training" && (isFullHR || isSelf) && (
          <EmployeeTrainingProfileTab employeeId={employee.id} />
        )}

        {activeTab === "Medical" && (isFullHR || isSelf) && (
          <EmployeeMedicalProfileTab employeeId={employee.id} />
        )}

        {activeTab === "Psychological" && (isFullHR || isSelf) && (
          <EmployeePsychologicalProfileTab employeeId={employee.id} />
        )}

        {activeTab === "Account Management" && (
          <AccountManagementPanel employee={employee} onUpdate={fetchEmployee} />
        )}
      </motion.div>
      </div>

      {/* Dialogs */}
      <EmployeeEditForm
        isOpen={isEditOpen && isFullHR}
        onClose={() => setIsEditOpen(false)}
        employee={employee}
        onSaveSuccess={fetchEmployee}
        canEditAll={isFullHR}
      />
      <DocumentUploadDialog 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        employeeId={employee.id} 
        onUploadSuccess={fetchEmployee} 
      />
      <GovernmentInfoDialog
        isOpen={isGovernmentOpen}
        onClose={() => setIsGovernmentOpen(false)}
        employee={employee}
        onSaveSuccess={fetchEmployee}
      />
      <SupervisorAssignmentDialog 
        isOpen={isSupervisorOpen} 
        onClose={() => setIsSupervisorOpen(false)} 
        employeeId={employee.id} 
        onAssignmentSuccess={fetchEmployee} 
      />
      <DocumentEditMetadataDialog
        isOpen={!!activeDocForEdit}
        onClose={() => setActiveDocForEdit(null)}
        document={activeDocForEdit}
        onUpdateSuccess={fetchEmployee}
      />
      <DocumentReplaceDialog
        isOpen={!!activeDocForReplace}
        onClose={() => setActiveDocForReplace(null)}
        document={activeDocForReplace}
        onReplaceSuccess={fetchEmployee}
      />
      <DocumentDeleteDialog
        isOpen={!!activeDocForDelete}
        onClose={() => setActiveDocForDelete(null)}
        document={activeDocForDelete}
        onDeleteSuccess={fetchEmployee}
      />
    </motion.div>
  );
}

