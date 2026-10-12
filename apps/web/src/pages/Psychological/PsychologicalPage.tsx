import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Brain,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Trash2,
  Edit2,
  UploadCloud,
  Eye,
  Download,
  Shield,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  History,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { STATUS_TONE_CHIP } from "@/components/ui/status-tone";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PsychologicalService,
  PsychologicalRecord,
  PsychologicalSummaryMetrics,
} from "@/services/psychological.service";
import { api } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  WorkflowModalHeader,
  WorkflowModalFooter,
  WorkflowStepper,
  WorkflowSection,
  workflowModalStyles,
} from "@/components/shared/WorkflowModal";
import { EmployeePicker } from "@/components/shared/EmployeePicker";
import { FileUploadCard } from "@/components/shared/FileUploadCard";
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from "@/components/shared/LoadError";

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  ANNUAL_PSYCHOLOGICAL_EVALUATION: "Annual Psychological Evaluation",
  PRE_EMPLOYMENT_PSYCH_TEST: "Pre-Employment Psych Testing",
  FIT_TO_WORK_PSYCH: "Fit-to-Work Mental Health Clearance",
  COUNSELING_EVALUATION: "Counseling & Wellness Evaluation",
  OTHER: "Other Psychological Assessment",
};

const COMPLIANCE_STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  VALID: {
    label: "Valid",
    class: STATUS_TONE_CHIP.success,
    icon: CheckCircle2,
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    class: STATUS_TONE_CHIP.warning,
    icon: Clock,
  },
  EXPIRED: {
    label: "Expired",
    class: STATUS_TONE_CHIP.danger,
    icon: AlertTriangle,
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    class: STATUS_TONE_CHIP.accent,
    icon: AlertCircle,
  },
};

const REVIEW_STATUS_STYLES: Record<string, { label: string; class: string }> = {
  ACCEPTED: {
    label: "Accepted",
    class: STATUS_TONE_CHIP.success,
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    class: STATUS_TONE_CHIP.warning,
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    class: STATUS_TONE_CHIP.danger,
  },
};

export default function PsychologicalPage() {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === "FULL";
  const userEmployeeId = user?.employee?.id;

  // Data states
  const [records, setRecords] = useState<PsychologicalRecord[]>([]);
  const [summary, setSummary] = useState<PsychologicalSummaryMetrics>({
    totalRecords: 0,
    needsReview: 0,
    expiringSoon: 0,
    expired: 0,
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobRoles, setJobRoles] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);

  // Self view states for standard employees
  const [selfRecords, setSelfRecords] = useState<PsychologicalRecord[]>([]);

  // Filter & Search states
  const [search, setSearch] = useState("");
  // One request after typing pauses, not one per keystroke.
  const debouncedSearch = useDebounce(search, 350);
  const [unitFilter, setUnitFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("");
  const [complianceStatusFilter, setComplianceStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "NEEDS_REVIEW" | "EXPIRING_SOON" | "EXPIRED">("ALL");

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // A failed load is shown as such — never as "No records yet" or zero totals.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Detail Drawer state
  const [detailRecord, setDetailRecord] = useState<PsychologicalRecord | null>(null);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PsychologicalRecord | null>(null);

  // Form states for Create / Edit
  const [formEmployeeSearch, setFormEmployeeSearch] = useState("");
  const [formSelectedEmployee, setFormSelectedEmployee] = useState<any | null>(null);
  const [formAssessmentType, setFormAssessmentType] = useState("ANNUAL_PSYCHOLOGICAL_EVALUATION");
  const [formRequirementId, setFormRequirementId] = useState("");
  const [formAssessmentDate, setFormAssessmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [formConductedBy, setFormConductedBy] = useState("");
  const [formEmployeeSummary, setFormEmployeeSummary] = useState("");
  const [formHrNotes, setFormHrNotes] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formInitialFile, setFormInitialFile] = useState<File | null>(null);
  const [formInitialDocVisibility, setFormInitialDocVisibility] = useState<"EMPLOYEE_VISIBLE" | "HR_ONLY">("HR_ONLY");

  // Review & Upload Form states
  const [reviewStatusVal, setReviewStatusVal] = useState<"ACCEPTED" | "NEEDS_CORRECTION">("ACCEPTED");
  const [reviewReasonVal, setReviewReasonVal] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocVisibility, setUploadDocVisibility] = useState<"EMPLOYEE_VISIBLE" | "HR_ONLY">("HR_ONLY");
  const [uploadNotes, setUploadNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [createStepError, setCreateStepError] = useState<string | null>(null);

  // ── Fetch filter metadata ──
  const fetchMetadata = async () => {
    try {
      const [empsRes, unitsRes, deptsRes, rolesRes, reqsRes] = await Promise.allSettled([
        api.get("/employees?limit=300"),
        api.get("/employees/units"),
        api.get("/departments"),
        api.get("/employees/job-roles"),
        api.get("/compliance/requirements"),
      ]);

      if (empsRes.status === "fulfilled") {
        setEmployees(empsRes.value.data?.data || empsRes.value.data || []);
      }
      if (unitsRes.status === "fulfilled") {
        setUnits(unitsRes.value.data?.data || []);
      }
      if (deptsRes.status === "fulfilled") {
        setDepartments(deptsRes.value.data?.data || []);
      }
      if (rolesRes.status === "fulfilled") {
        setJobRoles(rolesRes.value.data?.data || []);
      }
      if (reqsRes.status === "fulfilled") {
        const list = reqsRes.value.data?.data || [];
        setRequirements(list.filter((r: any) => r.category === "PSYCHOLOGICAL"));
      }
      // allSettled never throws — a filter list that failed is reported.
      const failed = [empsRes, unitsRes, deptsRes, rolesRes, reqsRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (failed) {
        toast.error(getApiErrorMessage(failed.reason, "Some filter options could not be loaded."), { id: "psychological-filters" });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The filter options could not be loaded."), { id: "psychological-filters" });
    }
  };

  // ── Fetch Records ──
  const fetchRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    setSummaryError(null);
    try {
      if (isFullHR) {
        let effectiveCompliance = complianceStatusFilter;
        let effectiveReview = reviewStatusFilter;

        if (activeTab === "NEEDS_REVIEW") {
          effectiveReview = "PENDING_REVIEW";
        } else if (activeTab === "EXPIRING_SOON") {
          effectiveCompliance = "EXPIRING_SOON";
        } else if (activeTab === "EXPIRED") {
          effectiveCompliance = "EXPIRED";
        }

        const [listData, summaryData] = await Promise.all([
          PsychologicalService.listAllRecords({
            search: debouncedSearch.trim() || undefined,
            unitId: unitFilter || undefined,
            departmentId: departmentFilter || undefined,
            jobRoleId: jobRoleFilter || undefined,
            assessmentType: assessmentTypeFilter || undefined,
            reviewStatus: effectiveReview || undefined,
            complianceStatus: effectiveCompliance || undefined,
            page,
            limit,
          }),
          PsychologicalService.getSummary().catch((summaryErr) => {
            setSummaryError(getApiErrorMessage(summaryErr, "The record totals could not be loaded."));
            return null;
          }),
        ]);

        setRecords(listData.records || []);
        setTotalPages(listData.pagination?.totalPages || 1);
        setTotalCount(listData.pagination?.total || 0);
        if (summaryData) setSummary(summaryData);
      } else if (userEmployeeId) {
        // Standard employee view: only own records
        const data = await PsychologicalService.listRecords(userEmployeeId);
        setSelfRecords(data || []);
      }
    } catch (err: any) {
      console.error("Failed to load psychological records", err);
      setLoadError(getApiErrorMessage(err, "Failed to load psychological records"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [
    isFullHR,
    userEmployeeId,
    page,
    debouncedSearch,
    unitFilter,
    departmentFilter,
    jobRoleFilter,
    assessmentTypeFilter,
    reviewStatusFilter,
    complianceStatusFilter,
    activeTab,
  ]);

  // ── Detail Drawer ──
  const handleOpenDetail = async (recordId: string) => {
    try {
      const fullRecord = await PsychologicalService.getRecord(recordId);
      setDetailRecord(fullRecord);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to load record details"));
    }
  };

  const handleCloseDetail = () => {
    setDetailRecord(null);
  };

  // ── Handle Clear Filters ──
  const handleClearFilters = () => {
    setSearch("");
    setUnitFilter("");
    setDepartmentFilter("");
    setJobRoleFilter("");
    setAssessmentTypeFilter("");
    setReviewStatusFilter("");
    setComplianceStatusFilter("");
    setActiveTab("ALL");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search ||
      unitFilter ||
      departmentFilter ||
      jobRoleFilter ||
      assessmentTypeFilter ||
      reviewStatusFilter ||
      complianceStatusFilter ||
      activeTab !== "ALL"
  );

  // ── Form Employee Search Filter ──
  const filteredFormEmployees = useMemo(() => {
    if (!formEmployeeSearch.trim()) return employees.slice(0, 10);
    const q = formEmployeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.firstName?.toLowerCase().includes(q) ||
        e.lastName?.toLowerCase().includes(q) ||
        e.employeeNumber?.toLowerCase().includes(q) ||
        e.jobRole?.title?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [employees, formEmployeeSearch]);

  // ── Create Record Handler ──
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSelectedEmployee) {
      toast.error("Please select an employee");
      return;
    }
    if (!formAssessmentDate) {
      toast.error("Please provide an assessment date");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await PsychologicalService.createRecord({
        employeeId: formSelectedEmployee.id,
        requirementId: formRequirementId || undefined,
        assessmentType: formAssessmentType,
        assessmentDate: formAssessmentDate,
        conductedBy: formConductedBy.trim() || undefined,
        employeeVisibleSummary: formEmployeeSummary.trim() || undefined,
        hrConfidentialNotes: formHrNotes.trim() || undefined,
        expiresAt: formExpiresAt || undefined,
      });

      let uploadProblem: string | null = null;
      if (formInitialFile) {
        try {
          await PsychologicalService.uploadDocument(created.id, formInitialFile, {
            visibility: formInitialDocVisibility,
            notes: "Initial assessment document",
          });
        } catch (uploadErr) {
          uploadProblem = getApiErrorMessage(uploadErr, "The document could not be uploaded.");
        }
      }

      if (uploadProblem) {
        toast.warning(`Assessment record created, but the document was not attached: ${uploadProblem} Upload it again from the record.`);
      } else {
        toast.success("Psychological assessment record created");
      }
      setIsCreateOpen(false);
      resetCreateForm();
      fetchRecords();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to create psychological record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validatePsychStep = (step: number) => {
    setCreateStepError(null);
    if (step === 1) {
      if (!formSelectedEmployee) {
        setCreateStepError("Please select an employee before continuing.");
        return false;
      }
    } else if (step === 2) {
      if (!formAssessmentType) {
        setCreateStepError("Please select an assessment type.");
        return false;
      }
      if (!formAssessmentDate) {
        setCreateStepError("Please provide an assessment date.");
        return false;
      }
    }
    return true;
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setCreateStepError(null);
    setFormSelectedEmployee(null);
    setFormEmployeeSearch("");
    setFormAssessmentType("ANNUAL_PSYCHOLOGICAL_EVALUATION");
    setFormRequirementId("");
    setFormAssessmentDate(new Date().toISOString().split("T")[0]);
    setFormConductedBy("");
    setFormEmployeeSummary("");
    setFormHrNotes("");
    setFormExpiresAt("");
    setFormInitialFile(null);
    setFormInitialDocVisibility("HR_ONLY");
  };

  // ── Edit Record Handler ──
  const handleOpenEdit = (rec: PsychologicalRecord) => {
    setSelectedRecord(rec);
    setFormAssessmentType(rec.assessmentType);
    setFormAssessmentDate(rec.assessmentDate ? rec.assessmentDate.split("T")[0] : "");
    setFormConductedBy(rec.conductedBy || "");
    setFormEmployeeSummary(rec.employeeVisibleSummary || "");
    setFormHrNotes(rec.hrConfidentialNotes || "");
    setFormExpiresAt(rec.expiresAt ? rec.expiresAt.split("T")[0] : "");
    setIsEditOpen(true);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setIsSubmitting(true);
    try {
      await PsychologicalService.updateRecord(selectedRecord.id, {
        assessmentType: formAssessmentType,
        assessmentDate: formAssessmentDate,
        conductedBy: formConductedBy.trim() || undefined,
        employeeVisibleSummary: formEmployeeSummary.trim() || undefined,
        hrConfidentialNotes: formHrNotes.trim() || undefined,
        expiresAt: formExpiresAt || undefined,
      });

      toast.success("Psychological record updated");
      setIsEditOpen(false);
      fetchRecords();
      if (detailRecord?.id === selectedRecord.id) {
        handleOpenDetail(selectedRecord.id);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Review Record Handler ──
  const handleOpenReview = (rec: PsychologicalRecord) => {
    setSelectedRecord(rec);
    setReviewStatusVal(rec.reviewStatus === "NEEDS_CORRECTION" ? "NEEDS_CORRECTION" : "ACCEPTED");
    setReviewReasonVal(rec.reviewReason || "");
    setIsReviewOpen(true);
  };

  const handleReviewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setIsSubmitting(true);
    try {
      await PsychologicalService.reviewRecord(selectedRecord.id, {
        reviewStatus: reviewStatusVal,
        reviewReason: reviewReasonVal.trim() || undefined,
      });

      toast.success(`Record marked as ${reviewStatusVal === "ACCEPTED" ? "Accepted" : "Needs Correction"}`);
      setIsReviewOpen(false);
      fetchRecords();
      if (detailRecord?.id === selectedRecord.id) {
        handleOpenDetail(selectedRecord.id);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to submit review"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Record Handler ──
  const handleDeleteRecord = async (rec: PsychologicalRecord) => {
    if (!confirm("Are you sure you want to delete this psychological record? This action cannot be undone.")) return;

    try {
      await PsychologicalService.deleteRecord(rec.id);
      toast.success("Psychological record deleted");
      if (detailRecord?.id === rec.id) {
        handleCloseDetail();
      }
      fetchRecords();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to delete record"));
    }
  };

  // ── Document Upload Handler ──
  const handleOpenUploadDoc = (rec: PsychologicalRecord) => {
    setSelectedRecord(rec);
    setUploadFile(null);
    setUploadDocVisibility("HR_ONLY");
    setUploadNotes("");
    setIsUploadDocOpen(true);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !uploadFile) {
      toast.error("Please select a document file to upload");
      return;
    }

    setIsSubmitting(true);
    try {
      await PsychologicalService.uploadDocument(selectedRecord.id, uploadFile, {
        visibility: uploadDocVisibility,
        notes: uploadNotes.trim() || undefined,
      });
      toast.success("Document uploaded successfully");
      setIsUploadDocOpen(false);
      setUploadFile(null);
      setUploadNotes("");
      fetchRecords();
      if (detailRecord?.id === selectedRecord.id) {
        handleOpenDetail(selectedRecord.id);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to upload document"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Document Handler ──
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await PsychologicalService.deleteDocument(docId);
      toast.success("Document deleted");
      if (detailRecord) {
        handleOpenDetail(detailRecord.id);
      }
      fetchRecords();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to delete document"));
    }
  };

  // ── STANDARD EMPLOYEE OWN-RESULT VIEW ──
  if (!isFullHR) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-accent-surface border border-status-accent-border flex items-center justify-center text-status-accent-foreground">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Psychological & Wellness Evaluations
            </h1>
            <p className="text-xs text-muted-foreground">
              Personal assessment records and authorized wellness summaries.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading your wellness records...</div>
        ) : loadError ? (
          <LoadError message={loadError} onRetry={fetchRecords} />
        ) : selfRecords.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border-soft rounded-2xl text-xs text-muted-foreground">
            No psychological or wellness records currently logged for your profile.
          </div>
        ) : (
          <div className="space-y-4">
            {selfRecords.map((rec) => (
              <div
                key={rec.id}
                className="bg-surface p-5 rounded-2xl border border-border-soft space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border-soft pb-3">
                  <div>
                    <h3 className="font-bold text-foreground text-sm">
                      {ASSESSMENT_TYPE_LABELS[rec.assessmentType] || rec.assessmentType}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Date: {new Date(rec.assessmentDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", REVIEW_STATUS_STYLES[rec.reviewStatus]?.class)}
                  >
                    {REVIEW_STATUS_STYLES[rec.reviewStatus]?.label}
                  </Badge>
                </div>

                {/* Safe Employee-Visible Summary */}
                <div className="p-4 rounded-xl bg-status-accent-surface/50 border border-status-accent-border text-xs space-y-1.5">
                  <span className="font-semibold text-status-accent-foreground uppercase tracking-wider text-[10px]">
                    Wellness Summary
                  </span>
                  <p className="text-foreground leading-relaxed">
                    {rec.employeeVisibleSummary || "No summary note provided."}
                  </p>
                </div>

                {/* Documents visible to employee */}
                {rec.documents && rec.documents.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground">
                      Available Documents:
                    </span>
                    {rec.documents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-border-soft text-xs dark:bg-surface-2"
                      >
                        <span className="font-medium text-foreground">{d.originalFilename}</span>
                        <button
                          type="button"
                          onClick={() => PsychologicalService.downloadDocument(d.id, d.originalFilename)}
                          title="Download document"
                          className="p-1 text-status-accent-foreground hover:text-status-accent-foreground"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FULL HR GLOBAL WORKSPACE VIEW ──
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-status-accent-surface border border-status-accent-border flex items-center justify-center text-status-accent-foreground shadow-sm">
              <Brain className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Psychological Records
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage protected employee psychological assessment records, documents, and review status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="create"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}>
            <Plus className="w-4 h-4" />
            Add Psychological Record
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ──
          Same shared StatCard and the same tones as Medical, tile for tile:
          Total Records the neutral total tone, Needs Review the purple review
          (accent) tone, Expiring Soon warning and Expired danger. */}
      {summaryError && <LoadError compact message={summaryError} onRetry={fetchRecords} />}
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", summaryError && "opacity-50")} aria-hidden={summaryError ? true : undefined}>
        <StatCard
          label="Total Records"
          value={summary.totalRecords}
          hint="Across all staff"
          tone="total"
          icon={<FileText />}
          selected={activeTab === "ALL"}
          onClick={() => {
            setActiveTab("ALL");
            setPage(1);
          }}
        />
        <StatCard
          label="Needs Review"
          value={summary.needsReview}
          hint="Pending HR action"
          tone="accent"
          icon={<AlertCircle />}
          selected={activeTab === "NEEDS_REVIEW"}
          onClick={() => {
            setActiveTab("NEEDS_REVIEW");
            setPage(1);
          }}
        />
        <StatCard
          label="Expiring Soon"
          value={summary.expiringSoon}
          hint="Within 30 days"
          tone="warning"
          icon={<Clock />}
          selected={activeTab === "EXPIRING_SOON"}
          onClick={() => {
            setActiveTab("EXPIRING_SOON");
            setPage(1);
          }}
        />
        <StatCard
          label="Expired"
          value={summary.expired}
          hint="Past validity date"
          tone="danger"
          icon={<AlertTriangle />}
          selected={activeTab === "EXPIRED"}
          onClick={() => {
            setActiveTab("EXPIRED");
            setPage(1);
          }}
        />
      </div>

      {/* ── SEARCH & FILTER TOOLBAR ── */}
      <div className="bg-surface p-4 rounded-2xl border border-border-soft space-y-3 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employee or assessment..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-surface-2 border-border-soft rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Unit */}
          <div className="md:col-span-2">
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-surface-2 border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="md:col-span-2">
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-surface-2 border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Role */}
          <div className="md:col-span-2">
            <select
              value={jobRoleFilter}
              onChange={(e) => {
                setJobRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-surface-2 border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Job Roles</option>
              {jobRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment / Type */}
          <div className="md:col-span-2">
            <select
              value={assessmentTypeFilter}
              onChange={(e) => {
                setAssessmentTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-surface-2 border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Assessment Types</option>
              {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row filters & reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-soft">
          <div className="flex flex-wrap items-center gap-2">
            {/* Review Status Filter */}
            <select
              value={reviewStatusFilter}
              onChange={(e) => {
                setReviewStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 text-xs bg-surface-2 border border-input rounded-lg text-foreground"
            >
              <option value="">All Review Statuses</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PENDING_REVIEW">Needs Review</option>
              <option value="NEEDS_CORRECTION">Needs Correction</option>
            </select>

            {/* Compliance Status Filter */}
            <select
              value={complianceStatusFilter}
              onChange={(e) => {
                setComplianceStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 text-xs bg-surface-2 border border-input rounded-lg text-foreground"
            >
              <option value="">All Compliance Statuses</option>
              <option value="VALID">Valid</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* ── RECORDS TABLE & WORKSPACE ── */}
      <div className="bg-surface rounded-2xl border border-border-soft overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-status-accent-foreground" />
            <p className="text-sm text-muted-foreground">Loading psychological records...</p>
          </div>
        ) : loadError ? (
          <div className="p-6">
            <LoadError message={loadError} onRetry={fetchRecords} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-muted-foreground">
              <Brain className="w-6 h-6" />
            </div>
            {hasActiveFilters ? (
              <div className="space-y-2">
                <p className="text-base font-semibold text-foreground">
                  No psychological records match your filters
                </p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search query or clearing applied filters.
                </p>
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-2">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-base font-semibold text-foreground">
                  No psychological assessment records yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Assessment records added for employees will appear here in the global management workspace.
                </p>
                <Button variant="create"
                  onClick={() => {
                    resetCreateForm();
                    setIsCreateOpen(true);
                  }}
                  className="mt-2">
                  <Plus className="w-4 h-4" />
                  Add Psychological Record
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-border-soft text-xs font-semibold text-secondary-foreground uppercase tracking-wider dark:bg-surface-2/80">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Assessment / Requirement</th>
                  <th className="py-3.5 px-4">Assessment Date</th>
                  <th className="py-3.5 px-4">Valid Until</th>
                  <th className="py-3.5 px-4">Compliance Status</th>
                  <th className="py-3.5 px-4">Review Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {records.map((rec) => {
                  const emp = rec.employee;
                  const compStatus = COMPLIANCE_STATUS_STYLES[rec.complianceStatus || "VALID"] || COMPLIANCE_STATUS_STYLES.VALID;
                  const revStatus = REVIEW_STATUS_STYLES[rec.reviewStatus] || REVIEW_STATUS_STYLES.PENDING_REVIEW;
                  const CompIcon = compStatus.icon;

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => handleOpenDetail(rec.id)}
                      className="hover:bg-surface-2 transition-colors cursor-pointer group"
                    >
                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-status-accent-surface border border-status-accent-border text-status-accent-foreground font-bold text-xs flex items-center justify-center shrink-0">
                            {emp ? `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}` : "—"}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground group-hover:text-status-accent-foreground dark:group-hover:text-accent transition-colors">
                              {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown Employee"}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] bg-surface-2 px-1 rounded">
                                {emp?.employeeNumber || "—"}
                              </span>
                              <span>·</span>
                              <span className="truncate max-w-[180px]">
                                {emp?.jobRole?.title || "Staff"} · {emp?.unit?.name || "General"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assessment / Requirement */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">
                          {ASSESSMENT_TYPE_LABELS[rec.assessmentType] || rec.assessmentType}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {rec.requirement ? (
                            <span className="text-status-accent-foreground truncate max-w-[180px]">
                              {rec.requirement.title}
                            </span>
                          ) : (
                            <span>General Psychological</span>
                          )}
                          {rec.documents && rec.documents.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-surface-2 px-1.5 py-0.5 rounded text-secondary-foreground">
                              <Paperclip className="w-3 h-3" />
                              {rec.documents.length} doc{rec.documents.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Assessment Date */}
                      <td className="py-3.5 px-4 text-secondary-foreground font-medium">
                        {rec.assessmentDate
                          ? new Date(rec.assessmentDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Valid Until */}
                      <td className="py-3.5 px-4">
                        {rec.expiresAt ? (
                          <span
                            className={cn(
                              "font-medium",
                              rec.complianceStatus === "EXPIRED"
                                ? "text-status-danger-foreground"
                                : rec.complianceStatus === "EXPIRING_SOON"
                                ? "text-status-warning-foreground"
                                : "text-secondary-foreground"
                            )}
                          >
                            {new Date(rec.expiresAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No Expiry Date</span>
                        )}
                      </td>

                      {/* Compliance Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn("px-2.5 py-0.5 text-xs font-medium flex items-center gap-1.5 w-fit", compStatus.class)}
                        >
                          <CompIcon className="w-3.5 h-3.5" />
                          {compStatus.label}
                        </Badge>
                      </td>

                      {/* Review Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={cn("px-2.5 py-0.5 text-xs font-medium w-fit", revStatus.class)}
                        >
                          {revStatus.label}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="review"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(rec.id);
                          }}
                          className="h-8 text-xs">
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PAGINATION CONTROLS ── */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 border-t border-border-soft flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(page * limit, totalCount)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{totalCount}</span> records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-2.5 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── RECORD DETAIL DRAWER / MODAL ── */}
      <Dialog open={Boolean(detailRecord)} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-surface border-border-soft shadow-xl">
          {detailRecord && (
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between gap-4 pr-12 border-b border-border-soft pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-status-accent-surface text-status-accent-foreground border-status-accent-border text-xs font-semibold">
                      {ASSESSMENT_TYPE_LABELS[detailRecord.assessmentType] || detailRecord.assessmentType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        COMPLIANCE_STATUS_STYLES[detailRecord.complianceStatus || "VALID"]?.class
                      )}
                    >
                      {COMPLIANCE_STATUS_STYLES[detailRecord.complianceStatus || "VALID"]?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        REVIEW_STATUS_STYLES[detailRecord.reviewStatus]?.class
                      )}
                    >
                      {REVIEW_STATUS_STYLES[detailRecord.reviewStatus]?.label}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    Psychological Assessment Details
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="update"
                    size="sm"
                    onClick={() => handleOpenEdit(detailRecord)}
                    className="h-8 text-xs">
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="review"
                    size="sm"
                    onClick={() => handleOpenReview(detailRecord)}
                    className="h-8 text-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Review
                  </Button>
                  <Button
                    variant="delete"
                    size="sm"
                    onClick={() => handleDeleteRecord(detailRecord)}
                    className="h-8 text-xs">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Employee Information Card */}
              <div className="bg-surface-2 p-4 rounded-xl border border-border-soft flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-accent text-white font-bold text-sm flex items-center justify-center">
                    {detailRecord.employee
                      ? `${detailRecord.employee.firstName?.[0] || ""}${detailRecord.employee.lastName?.[0] || ""}`
                      : "—"}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {detailRecord.employee
                        ? `${detailRecord.employee.firstName} ${detailRecord.employee.lastName}`
                        : "Unknown Employee"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {detailRecord.employee?.jobRole?.title} · {detailRecord.employee?.unit?.name} (
                      <span className="font-mono">{detailRecord.employee?.employeeNumber}</span>)
                    </p>
                  </div>
                </div>
              </div>

              {/* Examination & Record Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white border border-border-soft text-xs dark:bg-surface">
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase font-semibold text-[10px] tracking-wider">
                    Assessment Date
                  </span>
                  <span className="font-medium text-foreground text-sm">
                    {detailRecord.assessmentDate
                      ? new Date(detailRecord.assessmentDate).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase font-semibold text-[10px] tracking-wider">
                    Valid Until
                  </span>
                  <span className="font-medium text-foreground text-sm">
                    {detailRecord.expiresAt
                      ? new Date(detailRecord.expiresAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No Expiry Date"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase font-semibold text-[10px] tracking-wider">
                    Conducted By
                  </span>
                  <span className="font-medium text-foreground text-sm truncate block">
                    {detailRecord.conductedBy || "Not Specified"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1 uppercase font-semibold text-[10px] tracking-wider">
                    Requirement Link
                  </span>
                  <span className="font-medium text-status-accent-foreground text-sm truncate block">
                    {detailRecord.requirement?.title || "General / Unlinked"}
                  </span>
                </div>
              </div>

              {/* Review Feedback Section */}
              {detailRecord.reviewReason && (
                <div className="p-3.5 rounded-xl bg-status-warning-surface border border-status-warning-border text-xs space-y-1">
                  <div className="font-semibold text-status-warning-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Review Feedback ({detailRecord.reviewStatus}):
                  </div>
                  <p className="text-status-warning-foreground">{detailRecord.reviewReason}</p>
                </div>
              )}

              {/* ── TWO-ZONE PRIVACY SECTIONS ── */}
              <div className="space-y-4">
                {/* Zone 1: Employee-Visible Information */}
                <div className="p-4 rounded-xl border border-status-accent-border bg-status-accent-surface/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-status-accent-foreground">
                      <FileText className="w-3.5 h-3.5 text-status-accent-foreground" />
                      <span>Employee-Visible Information</span>
                    </div>
                    <span className="text-[10px] text-status-accent-foreground bg-status-accent-surface px-1.5 py-0.5 rounded">
                      Visible in staff self-view
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This information may be shown to the employee in their Psychological Result view.
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed pt-1">
                    {detailRecord.employeeVisibleSummary || "No general summary provided."}
                  </p>
                </div>

                {/* Zone 2: HR-Only Information */}
                <div className="p-4 rounded-xl border border-status-warning-border bg-status-warning-surface/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-status-warning-foreground">
                      <Lock className="w-3.5 h-3.5 text-status-warning-foreground" />
                      <span>HR-Only Information</span>
                    </div>
                    <span className="text-[10px] font-semibold text-status-warning-foreground bg-status-warning-surface px-1.5 py-0.5 rounded">
                      Strictly Confidential
                    </span>
                  </div>
                  <p className="text-[11px] text-status-warning-foreground/80">
                    Only authorized HR personnel can view this information.
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed pt-1">
                    {detailRecord.hrConfidentialNotes || "No confidential notes recorded for this assessment."}
                  </p>
                </div>
              </div>

              {/* Protected Documents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Protected Documents ({detailRecord.documents?.length || 0})
                    </h4>
                  </div>
                  <Button
                    variant="create"
                    size="sm"
                    onClick={() => handleOpenUploadDoc(detailRecord)}
                    className="h-7 text-xs">
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload Document
                  </Button>
                </div>

                {!detailRecord.documents || detailRecord.documents.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border-soft rounded-xl text-xs text-muted-foreground">
                    No documents attached to this psychological record.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailRecord.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border-soft text-xs dark:bg-surface-2"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-status-accent-foreground shrink-0" />
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground block truncate">
                                {doc.originalFilename}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  doc.visibility === "EMPLOYEE_VISIBLE"
                                    ? "bg-status-accent-surface text-status-accent-foreground border-status-accent-border"
                                    : "bg-status-warning-surface text-status-warning-foreground border-status-warning-border"
                                )}
                              >
                                {doc.visibility === "EMPLOYEE_VISIBLE" ? "Visible to Staff" : "HR Only"}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB · ` : ""}
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => PsychologicalService.downloadDocument(doc.id, doc.originalFilename)}
                            title="Download document"
                            className="p-1.5 text-muted-foreground hover:text-status-accent-foreground rounded"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            title="Delete document"
                            className="p-1.5 rounded text-status-danger-foreground hover:bg-status-danger-surface transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Employee Assessment History Drill-down */}
              {detailRecord.history && detailRecord.history.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border-soft">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Assessment History for this Employee ({detailRecord.history.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {detailRecord.history.map((hist) => (
                      <div
                        key={hist.id}
                        onClick={() => handleOpenDetail(hist.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/70 border border-border-soft/60 hover:border-status-accent-border cursor-pointer transition-colors text-xs dark:bg-surface-2/70"
                      >
                        <div>
                          <span className="font-semibold text-foreground block">
                            {ASSESSMENT_TYPE_LABELS[hist.assessmentType] || hist.assessmentType}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Date: {new Date(hist.assessmentDate).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", REVIEW_STATUS_STYLES[hist.reviewStatus]?.class)}
                        >
                          {REVIEW_STATUS_STYLES[hist.reviewStatus]?.label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CREATE PSYCHOLOGICAL RECORD GUIDED MODAL ── */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className={workflowModalStyles.container('wide')}>
          <WorkflowModalHeader
            icon={Brain}
            title="Add Psychological Record"
            subtitle="Record a psychological assessment with clear privacy controls."
            iconColor="text-status-accent-foreground"
            iconBg="bg-status-accent-surface border-status-accent-border"
            onClose={() => {
              setIsCreateOpen(false);
              resetCreateForm();
            }}
          />

          <WorkflowStepper
            steps={[
              { id: 1, label: "Employee" },
              { id: 2, label: "Assessment" },
              { id: 3, label: "Requirement" },
              { id: 4, label: "Notes & Privacy" },
              { id: 5, label: "Review" },
            ]}
            currentStep={createStep}
            onStepClick={(s: number) => {
              if (s < createStep) setCreateStep(s);
            }}
          />

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (createStep < 5) {
                if (validatePsychStep(createStep)) {
                  setCreateStep(createStep + 1);
                }
                return;
              }
              await handleCreateRecord(e);
            }}
            className={workflowModalStyles.form}
          >
            <div className={workflowModalStyles.content}>
              {createStepError && (
                <div className="p-3 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-xs flex items-start gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-status-danger-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Please check your inputs</p>
                    <p className="mt-0.5">{createStepError}</p>
                  </div>
                </div>
              )}

              {/* ── STEP 1: EMPLOYEE ── */}
              {createStep === 1 && (
                <div className="space-y-4 py-2 max-w-3xl mx-auto w-full">
                  <WorkflowSection
                    title="Who is this assessment for?"
                    subtitle="Search and select the employee receiving this psychological record"
                  >
                    <div className="pt-2">
                      <EmployeePicker
                        employees={employees}
                        selectedEmployee={formSelectedEmployee}
                        onSelect={(emp) => {
                          setFormSelectedEmployee(emp);
                          setCreateStepError(null);
                        }}
                        label="Target Employee"
                        required
                        accentColor="purple"
                        variant="workspace"
                      />
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 2: ASSESSMENT ── */}
              {createStep === 2 && (
                <div className="space-y-5 py-2 max-w-2xl mx-auto w-full">
                  <WorkflowSection
                    title="Enter assessment details"
                    subtitle="Specify the assessment type, date, and conducting psychologist or clinic"
                  >
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-foreground">
                            Assessment Type <span className="text-status-danger-foreground font-bold">*</span>
                          </label>
                          <select
                            value={formAssessmentType}
                            onChange={(e) => setFormAssessmentType(e.target.value)}
                            className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-surface-2 border border-input rounded-xl text-foreground focus:bg-surface"
                            required
                          >
                            {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-foreground">
                            Assessment Date <span className="text-status-danger-foreground font-bold">*</span>
                          </label>
                          <Input
                            type="date"
                            value={formAssessmentDate}
                            onChange={(e) => setFormAssessmentDate(e.target.value)}
                            className="text-sm sm:text-base font-medium h-11 bg-surface-2 border-border-soft rounded-xl focus:bg-surface"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-foreground">
                            Conducted By / Psychologist / Clinic
                          </label>
                          <span className="text-xs font-medium text-muted-foreground">Optional</span>
                        </div>
                        <Input
                          placeholder="e.g. Dra. Clara Ramirez, RPsy / Wellness Center"
                          value={formConductedBy}
                          onChange={(e) => setFormConductedBy(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-surface-2 border-border-soft rounded-xl focus:bg-surface placeholder:text-muted-foreground placeholder:text-sm"
                        />
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 3: VALIDITY & COMPLIANCE ── */}
              {createStep === 3 && (
                <div className="space-y-5 py-2 max-w-2xl mx-auto w-full">
                  <WorkflowSection
                    title="Does this assessment relate to a requirement?"
                    subtitle="Optionally link this assessment to a compliance requirement and expiration date"
                  >
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-foreground">
                            Compliance Requirement
                          </label>
                          <span className="text-xs font-medium text-muted-foreground">Optional</span>
                        </div>
                        <select
                          value={formRequirementId}
                          onChange={(e) => setFormRequirementId(e.target.value)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-surface-2 border border-input rounded-xl text-foreground"
                        >
                          <option value="">None / General Assessment</option>
                          {requirements.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-foreground">
                            Valid Until
                          </label>
                          <span className="text-xs font-medium text-muted-foreground">Optional</span>
                        </div>
                        <Input
                          type="date"
                          value={formExpiresAt}
                          onChange={(e) => setFormExpiresAt(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-surface-2 border-border-soft rounded-xl"
                        />
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Leave Valid Until empty if there is no confirmed expiry date.
                        </p>
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 4: RESULT & PRIVACY ── */}
              {createStep === 4 && (
                <div className="space-y-5">
                  <WorkflowSection
                    title="What information should be recorded?"
                    subtitle="Set employee-visible summary, confidential notes, and document visibility"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start pt-1">
                      {/* Card 1: Employee-Visible Summary */}
                      <div className="p-4 rounded-xl bg-status-accent-surface/60 border border-status-accent-border space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-status-accent-foreground">
                          <Eye className="w-4 h-4 text-status-accent-foreground" />
                          <span>Employee-Visible Summary</span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-status-accent-foreground/90">
                          The employee may see this summary in their profile.
                        </p>
                        <textarea
                          placeholder="e.g. Cleared for regular duties, recommended for wellness activities..."
                          value={formEmployeeSummary}
                          onChange={(e) => setFormEmployeeSummary(e.target.value)}
                          rows={3}
                          className="w-full p-3 text-sm sm:text-base font-medium bg-surface border border-status-accent-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>

                      {/* Card 2: HR Confidential Notes */}
                      <div className="p-4 rounded-xl bg-status-warning-surface/60 border border-status-warning-border space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-status-warning-foreground">
                          <Lock className="w-4 h-4 text-status-warning-foreground" />
                          <span>HR Confidential Notes</span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-status-warning-foreground/90">
                          Only authorized HR personnel can see these notes.
                        </p>
                        <textarea
                          placeholder="Confidential clinical notes, counseling details, or special accommodations..."
                          value={formHrNotes}
                          onChange={(e) => setFormHrNotes(e.target.value)}
                          rows={3}
                          className="w-full p-3 text-sm sm:text-base font-medium bg-surface border border-status-warning-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-warning"
                        />
                      </div>
                    </div>

                    {/* Below: Assessment Document & Privacy */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pt-2">
                      <div className="lg:col-span-7">
                        <FileUploadCard
                          label="Assessment Report / Document"
                          file={formInitialFile}
                          onFileChange={setFormInitialFile}
                          formatsLabel="PDF, JPG, PNG, DOCX (up to 10MB)"
                        />
                      </div>

                      <div className="lg:col-span-5 space-y-1.5">
                        <label className="text-sm font-semibold text-foreground">
                          Who can view this document?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFormInitialDocVisibility("HR_ONLY")}
                            className={cn(
                              "px-3.5 py-2.5 rounded-xl border text-sm font-medium text-left transition-all flex flex-col justify-center",
                              formInitialDocVisibility === "HR_ONLY"
                                ? "bg-status-accent-surface border-status-accent-foreground text-status-accent-foreground shadow-sm ring-1 ring-accent font-bold"
                                : "border-border-soft hover:bg-slate-50 text-foreground dark:hover:bg-surface-2"
                            )}
                          >
                            <span className="font-bold">HR only</span>
                            <span className="text-xs text-muted-foreground font-medium">Confidential</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormInitialDocVisibility("EMPLOYEE_VISIBLE")}
                            className={cn(
                              "px-3.5 py-2.5 rounded-xl border text-sm font-medium text-left transition-all flex flex-col justify-center",
                              formInitialDocVisibility === "EMPLOYEE_VISIBLE"
                                ? "bg-status-accent-surface border-status-accent-foreground text-status-accent-foreground shadow-sm ring-1 ring-accent font-bold"
                                : "border-border-soft hover:bg-slate-50 text-foreground dark:hover:bg-surface-2"
                            )}
                          >
                            <span className="font-bold">HR & Employee</span>
                            <span className="text-xs text-muted-foreground font-medium">Profile visible</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 5: REVIEW ── */}
              {createStep === 5 && (
                <div className="space-y-5">
                  <WorkflowSection
                    title="Review psychological record"
                    subtitle="Verify all details before saving to the employee psychological record"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left Review Summary */}
                      <div className="p-5 rounded-xl bg-surface-2 border border-border-soft space-y-3.5">
                        <div>
                          <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                            Employee
                          </span>
                          <span className="font-bold text-foreground text-base sm:text-lg block mt-0.5">
                            {formSelectedEmployee?.firstName} {formSelectedEmployee?.lastName}
                          </span>
                          <span className="text-secondary-foreground text-xs sm:text-sm font-medium">
                            #{formSelectedEmployee?.employeeNumber} · {formSelectedEmployee?.jobRole?.title || "Staff"} · {formSelectedEmployee?.department?.name || formSelectedEmployee?.unit?.name || "Hospicio"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-border-soft pt-3">
                          <div>
                            <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                              Assessment Type
                            </span>
                            <span className="font-bold text-foreground text-sm sm:text-base">
                              {ASSESSMENT_TYPE_LABELS[formAssessmentType] || formAssessmentType}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                              Date
                            </span>
                            <span className="font-bold text-foreground text-sm sm:text-base">
                              {formAssessmentDate}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-border-soft pt-3">
                          <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                            Conducted By
                          </span>
                          <span className="font-semibold text-foreground text-sm sm:text-base">
                            {formConductedBy || "None specified"}
                          </span>
                        </div>
                      </div>

                      {/* Right Review Summary */}
                      <div className="p-5 rounded-xl bg-surface-2 border border-border-soft space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                              Compliance Link
                            </span>
                            <span className="font-bold text-foreground text-sm sm:text-base truncate block">
                              {requirements.find((r) => r.id === formRequirementId)?.title || "None / General"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                              Valid Until
                            </span>
                            <span className="font-bold text-foreground text-sm sm:text-base">
                              {formExpiresAt || "No expiration"}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-border-soft pt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                                Employee Summary
                              </span>
                              <span className="font-semibold text-foreground text-sm sm:text-base">
                                {formEmployeeSummary.trim() ? "Added" : "None"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                                HR Confidential Notes
                              </span>
                              <span className="font-semibold text-foreground text-sm sm:text-base">
                                {formHrNotes.trim() ? "Added (Protected)" : "None"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-soft">
                            <div>
                              <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                                Document
                              </span>
                              <span className="font-semibold text-foreground text-sm sm:text-base truncate block">
                                {formInitialFile ? formInitialFile.name : "None attached"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs uppercase font-semibold tracking-wide">
                                Document Visibility
                              </span>
                              <span className="font-bold text-status-accent-foreground text-sm sm:text-base">
                                {formInitialDocVisibility === "HR_ONLY" ? "HR only" : "HR & Employee"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}
            </div>

            <WorkflowModalFooter
              onCancel={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              onBack={createStep > 1 ? () => setCreateStep(createStep - 1) : undefined}
              primaryLabel={createStep === 5 ? "Save Psychological Record" : "Next"}
              isSubmitting={isSubmitting}
              canProceed={createStep === 1 ? Boolean(formSelectedEmployee) : true}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT PSYCHOLOGICAL RECORD MODAL ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl p-6 rounded-2xl bg-surface border-border-soft">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-status-accent-foreground" />
              Edit Psychological Record
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateRecord} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Assessment Type *
              </label>
              <select
                value={formAssessmentType}
                onChange={(e) => setFormAssessmentType(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-input rounded-xl dark:bg-surface-2"
              >
                {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Assessment Date *
                </label>
                <Input
                  type="date"
                  value={formAssessmentDate}
                  onChange={(e) => setFormAssessmentDate(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Valid Until
                </label>
                <Input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Conducted By
              </label>
              <Input
                value={formConductedBy}
                onChange={(e) => setFormConductedBy(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-status-accent-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-status-accent-foreground" />
                Employee-Visible Summary
              </label>
              <textarea
                value={formEmployeeSummary}
                onChange={(e) => setFormEmployeeSummary(e.target.value)}
                rows={2}
                className="w-full p-2.5 text-xs bg-slate-50 border border-input rounded-xl dark:bg-surface-2"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-status-warning-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-status-warning-foreground" />
                HR Confidential Notes
              </label>
              <textarea
                value={formHrNotes}
                onChange={(e) => setFormHrNotes(e.target.value)}
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-input rounded-xl dark:bg-surface-2"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent-dark border-accent-dark text-white">
                {isSubmitting ? "Updating..." : "Update Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── REVIEW RECORD MODAL ── */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-surface border-border-soft">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-status-accent-foreground" />
              Administrative Review
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReviewRecord} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Review Decision *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewStatusVal("ACCEPTED")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                    reviewStatusVal === "ACCEPTED"
                      ? "bg-status-success-surface border-status-success-foreground text-status-success-foreground"
                      : "border-border-soft text-muted-foreground"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept Record
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatusVal("NEEDS_CORRECTION")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                    reviewStatusVal === "NEEDS_CORRECTION"
                      ? "bg-status-danger-surface border-status-danger-foreground text-status-danger-foreground"
                      : "border-border-soft text-muted-foreground"
                  )}
                >
                  <AlertCircle className="w-4 h-4" />
                  Needs Correction
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Review Notes / Feedback (Optional)
              </label>
              <textarea
                placeholder="Provide details if correction is requested..."
                value={reviewReasonVal}
                onChange={(e) => setReviewReasonVal(e.target.value)}
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-input rounded-xl dark:bg-surface-2"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsReviewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent-dark border-accent-dark text-white">
                {isSubmitting ? "Submitting..." : "Save Review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── UPLOAD DOCUMENT MODAL ── */}
      <Dialog open={isUploadDocOpen} onOpenChange={setIsUploadDocOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-surface border-border-soft">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-status-accent-foreground" />
              Upload Psychological Document
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUploadDocument} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Document File *
              </label>
              <Input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="text-xs"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Document Visibility *
              </label>
              <select
                value={uploadDocVisibility}
                onChange={(e) => setUploadDocVisibility(e.target.value as any)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-input rounded-xl dark:bg-surface-2"
              >
                <option value="HR_ONLY">HR Only (Strictly Confidential)</option>
                <option value="EMPLOYEE_VISIBLE">Visible to Employee</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Document Notes (Optional)
              </label>
              <Input
                placeholder="e.g. Official evaluation report, mental wellness summary"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsUploadDocOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !uploadFile}
                className="bg-accent hover:bg-accent-dark border-accent-dark text-white"
              >
                {isSubmitting ? "Uploading..." : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
