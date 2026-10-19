import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useState, useEffect, useMemo } from "react";
import { HelpLink } from '@/components/common/HelpLink';
import {
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  X,
  Users,
  GraduationCap,
  Award,
  BadgeCheck,
  Stethoscope,
  Brain,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  ComplianceService,
  ComplianceRequirement,
  OrgComplianceSummary,
  NeedsAttentionItem,
  EmployeeComplianceListItem,
  EmployeeComplianceSummaryItem,
  RequirementCategory,
} from "@/services/compliance.service";
import { api } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "@tanstack/react-router";
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
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from "@/components/shared/LoadError";

const CATEGORY_META: Record<
  RequirementCategory,
  { label: string; icon: any; class: string; lightBg: string }
> = {
  MEDICAL: {
    label: "Medical",
    icon: Stethoscope,
    class: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
    lightBg: "bg-teal-50 dark:bg-teal-950/30",
  },
  PSYCHOLOGICAL: {
    label: "Psychological",
    icon: Brain,
    class: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
    lightBg: "bg-status-accent-surface",
  },
  CERTIFICATION: {
    label: "Certification",
    icon: Award,
    class: "bg-status-info-surface text-status-info-foreground border-status-info-border",
    lightBg: "bg-status-info-surface",
  },
  PROFESSIONAL_LICENSE: {
    label: "Professional License",
    icon: BadgeCheck,
    class: "bg-status-info-surface text-status-info-foreground border-status-info-border",
    lightBg: "bg-status-info-surface",
  },
  TRAINING: {
    label: "Training",
    icon: GraduationCap,
    class: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
    lightBg: "bg-status-accent-surface",
  },
  DOCUMENT: {
    label: "Document",
    icon: FileText,
    class: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    lightBg: "bg-slate-50 dark:bg-slate-800/40",
  },
  OTHER: {
    label: "Other",
    icon: Layers,
    class: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
    lightBg: "bg-status-warning-surface",
  },
};

/**
 * Hospicio-confirmed requirement types. A preset only fills the name and
 * category (and, for role-specific ones, switches the scope to job roles) —
 * HR still chooses who it applies to and whether / when it expires. Nothing is
 * assigned to anyone by choosing a preset.
 */
const REQUIREMENT_PRESETS: Array<{ id: string; title: string; category: RequirementCategory; scope?: "JOB_ROLE"; note: string }> = [
  { id: "psych", title: "Psychological Assessment / Examination", category: "PSYCHOLOGICAL", note: "Fulfilled through the Psychological records module." },
  { id: "medical", title: "Medical Exam", category: "MEDICAL", note: "Fulfilled through the Medical records module." },
  { id: "ncii", title: "NCII Certificate — Caregiving", category: "CERTIFICATION", scope: "JOB_ROLE", note: "Choose the caregiving job role(s) it applies to." },
  { id: "license", title: "Professional License", category: "PROFESSIONAL_LICENSE", scope: "JOB_ROLE", note: "For Physical Therapist, Nurse, Midwife, Social Worker and Teacher roles — choose the job roles it applies to." },
  { id: "other", title: "", category: "OTHER", note: "Any other requirement — give it a name." },
];

/** Licensed professions Hospicio named for the Professional License requirement. */
const LICENSED_PROFESSION_WORDS = ["physical therap", "nurse", "midwife", "social worker", "teacher"];

const COMPLIANCE_STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  VALID: {
    label: "Valid",
    class: "bg-status-success-surface text-status-success-foreground border-status-success-border",
    icon: CheckCircle2,
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    class: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
    icon: Clock,
  },
  EXPIRED: {
    label: "Expired",
    class: "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
    icon: AlertTriangle,
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    class: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
    icon: AlertCircle,
  },
  MISSING: {
    label: "Missing",
    class: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    icon: AlertCircle,
  },
};

export default function CompliancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"REQUIREMENTS" | "EMPLOYEES">("REQUIREMENTS");

  // Summaries & Actionable Data
  const [summary, setSummary] = useState<OrgComplianceSummary>({
    totalChecks: 0,
    needsAttentionTotal: 0,
    summary: { missing: 0, needsReview: 0, expired: 0, expiringSoon: 0, valid: 0 },
    requirementCount: 0,
    employeeCount: 0,
  });
  const [needsAttentionItems, setNeedsAttentionItems] = useState<NeedsAttentionItem[]>([]);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [employeesComplianceList, setEmployeesComplianceList] = useState<EmployeeComplianceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Metadata for filter dropdowns
  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [jobRoles, setJobRoles] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Requirements tab filters
  const [reqSearch, setReqSearch] = useState("");
  const [reqCategoryFilter, setReqCategoryFilter] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("ACTIVE");
  const [reqScopeFilter, setReqScopeFilter] = useState("");

  // Employee Compliance tab filters
  const [empSearch, setEmpSearch] = useState("");
  const [empUnitFilter, setEmpUnitFilter] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("");
  const [empRoleFilter, setEmpRoleFilter] = useState("");
  const [empStatusFilter, setEmpStatusFilter] = useState("ALL");

  // Modals & Drawers
  const [isCreateReqOpen, setIsCreateReqOpen] = useState(false);
  const [isViewReqOpen, setIsViewReqOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<ComplianceRequirement | null>(null);

  // Employee Detail Drawer
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<any | null>(null);
  const [employeeSummaryItems, setEmployeeSummaryItems] = useState<EmployeeComplianceSummaryItem[]>([]);
  const [isEmpDetailLoading, setIsEmpDetailLoading] = useState(false);

  // Add Fulfillment Record Modal
  const [isAddFulfillmentOpen, setIsAddFulfillmentOpen] = useState(false);
  const [targetFulfillmentReq, setTargetFulfillmentReq] = useState<any | null>(null);
  const [fulfillmentRecordTitle, setFulfillmentRecordTitle] = useState("");
  const [fulfillmentRefNo, setFulfillmentRefNo] = useState("");
  const [fulfillmentCompletedAt, setFulfillmentCompletedAt] = useState(new Date().toISOString().split("T")[0]);
  const [fulfillmentExpiresAt, setFulfillmentExpiresAt] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");

  // Create Requirement Form states
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<RequirementCategory>("CERTIFICATION");
  const [formDescription, setFormDescription] = useState("");
  const [formScopeTarget, setFormScopeTarget] = useState<"ALL" | "UNIT" | "DEPARTMENT" | "JOB_ROLE" | "EMPLOYEE">("ALL");
  const [formTargetUnitId, setFormTargetUnitId] = useState("");
  const [formTargetDeptId, setFormTargetDeptId] = useState("");
  // A requirement can apply to several job roles (e.g. Professional License).
  const [formTargetRoleIds, setFormTargetRoleIds] = useState<string[]>([]);
  const [formPresetId, setFormPresetId] = useState<string | null>(null);
  const [formTargetEmpId, setFormTargetEmpId] = useState("");
  const [formTracksExpiry, setFormTracksExpiry] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createReqStep, setCreateReqStep] = useState<number>(1);
  const [createReqStepError, setCreateReqStepError] = useState<string | null>(null);

  const resolvedTargetCount = useMemo(() => {
    if (formScopeTarget === "ALL") return allEmployees.length;
    if (formScopeTarget === "UNIT") {
      if (!formTargetUnitId) return 0;
      return allEmployees.filter((e) => e.unitId === formTargetUnitId || e.unit?.id === formTargetUnitId).length;
    }
    if (formScopeTarget === "DEPARTMENT") {
      if (!formTargetDeptId) return 0;
      return allEmployees.filter((e) => e.departmentId === formTargetDeptId || e.department?.id === formTargetDeptId).length;
    }
    if (formScopeTarget === "JOB_ROLE") {
      if (!formTargetRoleIds.length) return 0;
      return allEmployees.filter((e) => formTargetRoleIds.includes(e.jobRoleId) || formTargetRoleIds.includes(e.jobRole?.id)).length;
    }
    if (formScopeTarget === "EMPLOYEE") {
      return formTargetEmpId ? 1 : 0;
    }
    return 0;
  }, [formScopeTarget, formTargetUnitId, formTargetDeptId, formTargetRoleIds, formTargetEmpId, allEmployees]);

  // ── Fetch all data ──
  // A part that fails is reported, never shown as "nothing here": the
  // requirements, summary and lists set `loadError`; a filter list only toasts.
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchAllData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [summaryRes, attentionRes, reqsRes, empListRes, unitsRes, deptsRes, rolesRes, empsRes] =
        await Promise.allSettled([
          ComplianceService.getOrgSummary(),
          ComplianceService.getNeedsAttention(),
          ComplianceService.listRequirements(),
          ComplianceService.getEmployeesComplianceList(),
          api.get("/employees/units"),
          api.get("/departments"),
          api.get("/employees/job-roles"),
          api.get("/employees?limit=300"),
        ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (attentionRes.status === "fulfilled") setNeedsAttentionItems(attentionRes.value || []);
      if (reqsRes.status === "fulfilled") setRequirements(reqsRes.value || []);
      if (empListRes.status === "fulfilled") setEmployeesComplianceList(empListRes.value || []);
      if (unitsRes.status === "fulfilled") setUnits(unitsRes.value.data?.data || []);
      if (deptsRes.status === "fulfilled") setDepartments(deptsRes.value.data?.data || []);
      if (rolesRes.status === "fulfilled") setJobRoles(rolesRes.value.data?.data || []);
      if (empsRes.status === "fulfilled") setAllEmployees(empsRes.value.data?.data || empsRes.value.data || []);

      const core = [summaryRes, attentionRes, reqsRes, empListRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (core) setLoadError(getApiErrorMessage(core.reason, "Compliance data could not be loaded."));
      const filters = [unitsRes, deptsRes, rolesRes, empsRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (filters) toast.error(getApiErrorMessage(filters.reason, "Some filter and targeting options could not be loaded."), { id: "compliance-filters" });
    } catch (err) {
      console.error("Error loading compliance data", err);
      toast.error(getApiErrorMessage(err, "Failed to load compliance data"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ── Open Employee Compliance Detail Drawer ──
  const handleOpenEmployeeDetail = async (emp: any) => {
    setSelectedEmployeeId(emp.id);
    setSelectedEmployeeData(emp);
    setIsEmpDetailLoading(true);
    try {
      const items = await ComplianceService.getEmployeeSummary(emp.id);
      setEmployeeSummaryItems(items || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load employee compliance breakdown"));
    } finally {
      setIsEmpDetailLoading(false);
    }
  };

  const handleCloseEmployeeDetail = () => {
    setSelectedEmployeeId(null);
    setSelectedEmployeeData(null);
    setEmployeeSummaryItems([]);
  };

  // ── Scope Display Formatter (No Technical Terminology) ──
  const getFriendlyScopeLabel = (req: ComplianceRequirement): string => {
    if (!req.scopes || req.scopes.length === 0) return "All Employees";
    const labels = req.scopes.map((s) => {
      if (s.scopeType === "ALL") return "All Employees";
      if (s.scopeType === "UNIT" && s.targetUnit?.name) return `${s.targetUnit.name} Unit`;
      if (s.scopeType === "DEPARTMENT" && s.targetDepartment?.name) return `${s.targetDepartment.name} Department`;
      if (s.scopeType === "JOB_ROLE" && s.targetJobRole?.title) return `${s.targetJobRole.title} Role`;
      if (s.scopeType === "EMPLOYEE" && s.targetEmployee) {
        return `${s.targetEmployee.firstName} ${s.targetEmployee.lastName}`;
      }
      return "Specific Group";
    });
    return labels.join(", ");
  };

  // ── Filtered Requirements ──
  const filteredRequirements = useMemo(() => {
    return requirements.filter((r) => {
      if (reqSearch.trim()) {
        const q = reqSearch.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = r.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (reqCategoryFilter && r.category !== reqCategoryFilter) return false;
      if (reqStatusFilter && r.lifecycle !== reqStatusFilter) return false;
      if (reqScopeFilter) {
        const hasScope = r.scopes?.some((s) => s.scopeType === reqScopeFilter);
        if (!hasScope) return false;
      }
      return true;
    });
  }, [requirements, reqSearch, reqCategoryFilter, reqStatusFilter, reqScopeFilter]);

  // ── Filtered Employees Compliance ──
  const filteredEmployeesList = useMemo(() => {
    return employeesComplianceList.filter((item) => {
      const emp = item.employee;
      if (empSearch.trim()) {
        const q = empSearch.toLowerCase();
        const matchesName = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
        const matchesNum = emp.employeeNumber.toLowerCase().includes(q);
        const matchesRole = emp.jobRole?.title?.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesRole) return false;
      }
      if (empUnitFilter && emp.unitId !== empUnitFilter) return false;
      if (empDeptFilter && emp.departmentId !== empDeptFilter) return false;
      if (empRoleFilter && emp.jobRoleId !== empRoleFilter) return false;

      if (empStatusFilter === "NEEDS_ATTENTION" && item.needsAttention === 0) return false;
      if (empStatusFilter === "MISSING" && item.missing === 0) return false;
      if (empStatusFilter === "EXPIRED" && item.expired === 0) return false;
      if (empStatusFilter === "EXPIRING" && item.expiring === 0) return false;
      if (empStatusFilter === "NEEDS_REVIEW" && item.needsReview === 0) return false;
      if (empStatusFilter === "ALL_VALID" && (item.needsAttention > 0 || item.valid === 0)) return false;

      return true;
    });
  }, [employeesComplianceList, empSearch, empUnitFilter, empDeptFilter, empRoleFilter, empStatusFilter]);

  // ── Create Requirement Handler ──
  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter a requirement name");
      return;
    }

    setIsSubmitting(true);
    try {
      const scopes: any[] = [];
      if (formScopeTarget === "ALL") {
        scopes.push({ scopeType: "ALL" });
      } else if (formScopeTarget === "UNIT" && formTargetUnitId) {
        scopes.push({ scopeType: "UNIT", targetUnitId: formTargetUnitId });
      } else if (formScopeTarget === "DEPARTMENT" && formTargetDeptId) {
        scopes.push({ scopeType: "DEPARTMENT", targetDepartmentId: formTargetDeptId });
      } else if (formScopeTarget === "JOB_ROLE" && formTargetRoleIds.length) {
        formTargetRoleIds.forEach((id) => scopes.push({ scopeType: "JOB_ROLE", targetJobRoleId: id }));
      } else if (formScopeTarget === "EMPLOYEE" && formTargetEmpId) {
        scopes.push({ scopeType: "EMPLOYEE", targetEmployeeId: formTargetEmpId });
      } else {
        scopes.push({ scopeType: "ALL" });
      }

      await ComplianceService.createRequirement({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        tracksExpiry: formTracksExpiry,
        reminderDays: formTracksExpiry ? Number(formReminderDays) : undefined,
        scopes,
      });

      toast.success("Compliance requirement created successfully");
      setIsCreateReqOpen(false);
      resetCreateForm();
      fetchAllData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to create requirement"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateReqStep = (step: number) => {
    setCreateReqStepError(null);
    if (step === 1) {
      if (!formTitle.trim()) {
        setCreateReqStepError("Please enter a requirement name before continuing.");
        return false;
      }
    } else if (step === 2) {
      if (formScopeTarget === "UNIT" && !formTargetUnitId) {
        setCreateReqStepError("Please select a target unit.");
        return false;
      }
      if (formScopeTarget === "DEPARTMENT" && !formTargetDeptId) {
        setCreateReqStepError("Please select a target department.");
        return false;
      }
      if (formScopeTarget === "JOB_ROLE" && !formTargetRoleIds.length) {
        setCreateReqStepError("Please select at least one job role.");
        return false;
      }
      if (formScopeTarget === "EMPLOYEE" && !formTargetEmpId) {
        setCreateReqStepError("Please select a target employee.");
        return false;
      }
    }
    return true;
  };

  const resetCreateForm = () => {
    setCreateReqStep(1);
    setCreateReqStepError(null);
    setFormTitle("");
    setFormCategory("CERTIFICATION");
    setFormDescription("");
    setFormScopeTarget("ALL");
    setFormTargetUnitId("");
    setFormTargetDeptId("");
    setFormTargetRoleIds([]);
    setFormPresetId(null);
    setFormTargetEmpId("");
    setFormTracksExpiry(false);
    setFormReminderDays(30);
  };

  // ── Deactivate Requirement ──
  const handleDeactivateRequirement = async (req: ComplianceRequirement) => {
    const ok = await confirmAction({
      title: "Deactivate this requirement?",
      message: "It will no longer be evaluated as an active requirement. Existing employee records and history will remain available.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;

    try {
      await ComplianceService.archiveRequirement(req.id);
      toast.success("Requirement deactivated");
      setIsViewReqOpen(false);
      fetchAllData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to deactivate requirement"));
    }
  };

  // ── Open Add Fulfillment Record Modal ──
  const handleOpenAddFulfillment = (emp: any, reqItem: any) => {
    if (reqItem.requirement.category === "MEDICAL") {
      navigate({ to: "/medical" });
      return;
    }
    if (reqItem.requirement.category === "PSYCHOLOGICAL") {
      navigate({ to: "/psychological" });
      return;
    }

    setSelectedEmployeeData(emp);
    setTargetFulfillmentReq(reqItem.requirement);
    setFulfillmentRecordTitle(reqItem.requirement.title || "Compliance Record");
    setFulfillmentRefNo("");
    setFulfillmentCompletedAt(new Date().toISOString().split("T")[0]);
    setFulfillmentExpiresAt("");
    setFulfillmentNotes("");
    setIsAddFulfillmentOpen(true);
  };

  // ── Save Generic Fulfillment Record ──
  const handleSaveFulfillmentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeData || !targetFulfillmentReq) return;

    setIsSubmitting(true);
    try {
      await ComplianceService.createEmployeeRecord({
        employeeId: selectedEmployeeData.id,
        requirementId: targetFulfillmentReq.id,
        recordTitle: fulfillmentRecordTitle.trim() || targetFulfillmentReq.title,
        referenceNumber: fulfillmentRefNo.trim() || undefined,
        completedAt: fulfillmentCompletedAt,
        expiresAt: fulfillmentExpiresAt || undefined,
        notes: fulfillmentNotes.trim() || undefined,
      });

      toast.success("Compliance record submitted successfully");
      setIsAddFulfillmentOpen(false);
      fetchAllData();
      if (selectedEmployeeId) {
        handleOpenEmployeeDetail(selectedEmployeeData);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to submit compliance record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── TRUE EMPTY DATABASE STATE ──
  const isTrueEmpty = !isLoading && !loadError && requirements.length === 0;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
      {/* ── 1. HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Compliance Monitoring
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage employee requirements, track validity, and review items that need attention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <HelpLink slug="compliance-needs-attention" />
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateReqOpen(true);
            }}
            variant="create">
            <Plus />
            Create Requirement
          </Button>
        </div>
      </div>

      {loadError && <LoadError compact message={loadError} onRetry={fetchAllData} />}

      {/* ── TRUE EMPTY STATE ── */}
      {isTrueEmpty ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 space-y-5 shadow-sm max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              No compliance requirements yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your first requirement to define mandatory certifications, health clearances, or documents that employees must maintain.
            </p>
          </div>
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateReqOpen(true);
            }}
            variant="create">
            <Plus />
            Create Requirement
          </Button>
        </div>
      ) : (
        <>
          {/* ── 2. SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Applicable Requirements */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Applicable Requirements
                </span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {summary.totalChecks}
                </span>
                <span className="text-xs text-muted-foreground">items assigned</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active requirement items assigned across employees
              </p>
            </div>

            {/* Valid */}
            <div className="p-5 rounded-2xl border border-status-success-border bg-status-success-surface/40 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-status-success-foreground">
                  Valid
                </span>
                <CheckCircle2 className="w-4 h-4 text-status-success-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-status-success-foreground">
                  {summary.summary.valid}
                </span>
                <span className="text-xs text-status-success-foreground/80">items</span>
              </div>
              <p className="text-xs text-status-success-foreground/70">
                Fulfilled, active, and verified compliance items
              </p>
            </div>

            {/* Needs Attention (Prominent) */}
            <div className="p-5 rounded-2xl border-2 border-status-warning-border bg-status-warning-surface/50 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-status-warning-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-status-warning-foreground" />
                  Needs Attention
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-status-warning-surface text-status-warning-foreground">
                  Action Required
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-status-warning-foreground">
                  {summary.summary.missing + summary.summary.needsReview + summary.summary.expired + summary.summary.expiringSoon}
                </span>
                <span className="text-xs text-status-warning-foreground">actionable items</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-1 text-slate-600 dark:text-slate-400 font-medium">
                <span className="text-status-danger-foreground">{summary.summary.expired} Expired</span>
                <span>·</span>
                <span className="text-slate-600 dark:text-slate-300">{summary.summary.missing} Missing</span>
                <span>·</span>
                <span className="text-status-warning-foreground">{summary.summary.expiringSoon} Expiring</span>
                <span>·</span>
                <span className="text-status-accent-foreground">{summary.summary.needsReview} Review</span>
              </div>
            </div>
          </div>

          {/* ── 3. PROMINENT "NEEDS ATTENTION" SECTION ── */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-status-warning-foreground" />
                  Items Needing Attention ({needsAttentionItems.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Actionable items prioritized by severity (Expired, Missing, Expiring Soon, Needs Review).
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAllData}
                className="h-8 text-xs text-slate-500 hover:text-slate-800 dark:text-muted-foreground dark:hover:text-foreground"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>

            {needsAttentionItems.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-muted-foreground">
                🎉 All assigned employee requirements are currently valid and up to date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Requirement</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Attention Reason</th>
                      <th className="py-2.5 px-3">Due / Valid Until</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {needsAttentionItems.slice(0, 8).map((item, idx) => {
                      const emp = item.employee;
                      const catMeta = CATEGORY_META[item.requirement.category] || CATEGORY_META.OTHER;
                      const statusStyle = COMPLIANCE_STATUS_STYLES[item.status] || COMPLIANCE_STATUS_STYLES.MISSING;
                      const CatIcon = catMeta.icon;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          {/* Employee */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {emp.jobRole} · {emp.unit} (<span className="font-mono">{emp.employeeNumber}</span>)
                            </div>
                          </td>

                          {/* Requirement */}
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.requirement.title}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={cn("text-xs px-2 py-0.5", catMeta.class)}>
                              <CatIcon className="w-3 h-3 mr-1" />
                              {catMeta.label}
                            </Badge>
                          </td>

                          {/* Attention Reason */}
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className={cn("text-xs px-2 py-0.5 font-medium", statusStyle.class)}>
                              {statusStyle.label}
                            </Badge>
                          </td>

                          {/* Due / Valid Until */}
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {item.expiresAt ? (
                              <span>{new Date(item.expiresAt).toLocaleDateString()}</span>
                            ) : item.status === "MISSING" ? (
                              <span className="text-muted-foreground italic">No record submitted</span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            {item.requirement.category === "MEDICAL" ? (
                              <Button
                                variant="review"
                                size="xs"
                                onClick={() => navigate({ to: "/medical" })}>
                                View Medical
                              </Button>
                            ) : item.requirement.category === "PSYCHOLOGICAL" ? (
                              <Button
                                variant="review"
                                size="xs"
                                onClick={() => navigate({ to: "/psychological" })}>
                                View Psych
                              </Button>
                            ) : (
                              <Button
                                variant="create"
                                size="xs"
                                onClick={() => handleOpenAddFulfillment(item.employee, item)}>
                                Add Record
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 4. WORKSPACE NAVIGATION TABS ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab("REQUIREMENTS")}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-all",
                  activeTab === "REQUIREMENTS"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                Requirements ({requirements.length})
              </button>
              <button
                onClick={() => setActiveTab("EMPLOYEES")}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-all",
                  activeTab === "EMPLOYEES"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                Employee Compliance ({employeesComplianceList.length})
              </button>
            </div>

            {/* ── TAB 1: REQUIREMENTS ── */}
            {activeTab === "REQUIREMENTS" && (
              <div className="space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search requirements..."
                        value={reqSearch}
                        onChange={(e) => setReqSearch(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                      {reqSearch && (
                        <button
                          onClick={() => setReqSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600 dark:hover:text-secondary-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <select
                        value={reqCategoryFilter}
                        onChange={(e) => setReqCategoryFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="">All Categories</option>
                        {Object.entries(CATEGORY_META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={reqStatusFilter}
                        onChange={(e) => setReqStatusFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="">All Statuses</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={reqScopeFilter}
                        onChange={(e) => setReqScopeFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="">All Scopes</option>
                        <option value="ALL">All Employees</option>
                        <option value="UNIT">Specific Unit</option>
                        <option value="DEPARTMENT">Specific Department</option>
                        <option value="JOB_ROLE">Specific Role</option>
                        <option value="EMPLOYEE">Specific Employees</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Requirements Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  {filteredRequirements.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No requirements match your filters
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReqSearch("");
                          setReqCategoryFilter("");
                          setReqStatusFilter("ACTIVE");
                          setReqScopeFilter("");
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4">Requirement</th>
                            <th className="py-3.5 px-4">Category</th>
                            <th className="py-3.5 px-4">Applies To</th>
                            <th className="py-3.5 px-4">Expiry Tracking</th>
                            <th className="py-3.5 px-4">Reminder</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {filteredRequirements.map((req) => {
                            const catMeta = CATEGORY_META[req.category] || CATEGORY_META.OTHER;
                            const CatIcon = catMeta.icon;

                            return (
                              <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm">
                                    {req.title}
                                  </span>
                                  {req.description && (
                                    <span className="text-muted-foreground text-xs line-clamp-1 mt-0.5">
                                      {req.description}
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-4">
                                  <Badge variant="outline" className={cn("text-[11px] px-2.5 py-0.5", catMeta.class)}>
                                    <CatIcon className="w-3.5 h-3.5 mr-1" />
                                    {catMeta.label}
                                  </Badge>
                                </td>

                                <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                  {getFriendlyScopeLabel(req)}
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {req.tracksExpiry ? (
                                    <span className="text-status-warning-foreground font-medium">Tracks Expiry</span>
                                  ) : (
                                    <span>No Expiry</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {req.reminderDays ? `${req.reminderDays} days before` : "—"}
                                </td>

                                <td className="py-3 px-4">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px]",
                                      req.lifecycle === "ACTIVE"
                                        ? "bg-status-success-surface text-status-success-foreground border-status-success-border"
                                        : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-2 dark:text-muted-foreground dark:border-border-soft"
                                    )}
                                  >
                                    {req.lifecycle === "ACTIVE" ? "Active" : "Inactive"}
                                  </Badge>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="review"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedReq(req);
                                      setIsViewReqOpen(true);
                                    }}>
                                    <Eye />
                                    Details
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: EMPLOYEE COMPLIANCE ── */}
            {activeTab === "EMPLOYEES" && (
              <div className="space-y-4">
                {/* Search & Organization Filter Toolbar */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4 relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search employees by name, ID, or job role..."
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                      {empSearch && (
                        <button
                          onClick={() => setEmpSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600 dark:hover:text-secondary-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={empUnitFilter}
                        onChange={(e) => setEmpUnitFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="">All Units</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={empDeptFilter}
                        onChange={(e) => setEmpDeptFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={empRoleFilter}
                        onChange={(e) => setEmpRoleFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="">All Roles</option>
                        {jobRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <select
                        value={empStatusFilter}
                        onChange={(e) => setEmpStatusFilter(e.target.value)}
                        className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
                      >
                        <option value="ALL">All Employees</option>
                        <option value="NEEDS_ATTENTION">Needs Attention</option>
                        <option value="MISSING">Has Missing</option>
                        <option value="EXPIRED">Has Expired</option>
                        <option value="EXPIRING">Has Expiring</option>
                        <option value="NEEDS_REVIEW">Needs Review</option>
                        <option value="ALL_VALID">All Valid</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Employee Compliance Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  {filteredEmployeesList.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No employees match your filters
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEmpSearch("");
                          setEmpUnitFilter("");
                          setEmpDeptFilter("");
                          setEmpRoleFilter("");
                          setEmpStatusFilter("ALL");
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4">Employee</th>
                            <th className="py-3.5 px-4">Role / Unit</th>
                            <th className="py-3.5 px-4">Valid</th>
                            <th className="py-3.5 px-4">Needs Attention</th>
                            <th className="py-3.5 px-4">Missing</th>
                            <th className="py-3.5 px-4">Expiring</th>
                            <th className="py-3.5 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {filteredEmployeesList.map((item) => {
                            const emp = item.employee;

                            return (
                              <tr
                                key={emp.id}
                                onClick={() => handleOpenEmployeeDetail(emp)}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                                      {emp.firstName?.[0]}
                                      {emp.lastName?.[0]}
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm group-hover:text-teal-600 transition-colors dark:group-hover:text-primary-300">
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      <span className="font-mono text-[11px] text-muted-foreground">
                                        {emp.employeeNumber}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                  <span className="font-medium">{emp.jobRole?.title || "Staff"}</span>
                                  <span className="text-muted-foreground block text-[11px]">{emp.unit?.name || "General"}</span>
                                </td>

                                <td className="py-3 px-4">
                                  <span className="font-semibold text-status-success-foreground">
                                    {item.valid} Valid
                                  </span>
                                </td>

                                <td className="py-3 px-4">
                                  {item.needsAttention > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-status-warning-surface text-status-warning-foreground border-status-warning-border font-bold px-2 py-0.5 text-[11px]"
                                    >
                                      {item.needsAttention} Need Action
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">0</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {item.missing > 0 ? (
                                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                      {item.missing} Missing
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                  {item.expiring > 0 ? (
                                    <span className="text-status-warning-foreground font-semibold">
                                      {item.expiring} Expiring
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="review"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEmployeeDetail(emp);
                                    }}
                                    className="h-8 text-xs">
                                    View Compliance
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CREATE REQUIREMENT GUIDED MODAL ── */}
      <Dialog
        open={isCreateReqOpen}
        onOpenChange={(open) => {
          setIsCreateReqOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className={workflowModalStyles.container('compliance')}>
          <WorkflowModalHeader
            icon={ShieldCheck}
            title="Create Compliance Requirement"
            subtitle="Define requirement rules, target scope, and validity tracking."
            onClose={() => {
              setIsCreateReqOpen(false);
              resetCreateForm();
            }}
          />

          <WorkflowStepper
            steps={[
              { id: 1, label: "Requirement" },
              { id: 2, label: "Who Needs It?" },
              { id: 3, label: "Validity" },
              { id: 4, label: "Review" },
            ]}
            currentStep={createReqStep}
            onStepClick={(s: number) => {
              if (s < createReqStep) setCreateReqStep(s);
            }}
          />

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (createReqStep < 4) {
                if (validateReqStep(createReqStep)) {
                  setCreateReqStep(createReqStep + 1);
                }
                return;
              }
              await handleCreateRequirement(e);
            }}
            className={workflowModalStyles.form}
          >
            <div className={workflowModalStyles.content}>
              {createReqStepError && (
                <div className="p-3 rounded-xl bg-status-danger-surface border border-status-danger-border text-status-danger-foreground text-xs flex items-start gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-status-danger-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Please check your inputs</p>
                    <p className="mt-0.5">{createReqStepError}</p>
                  </div>
                </div>
              )}

              {/* ── STEP 1: REQUIREMENT ── */}
              {createReqStep === 1 && (
                <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                  <WorkflowSection
                    title="What requirement are you adding?"
                    subtitle="Give the requirement a clear name and category that HR and staff will recognize"
                  >
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Start from a Hospicio requirement type</span>
                        <div className="flex flex-wrap gap-2">
                          {REQUIREMENT_PRESETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={formPresetId === p.id}
                              onClick={() => {
                                setFormPresetId(p.id);
                                setFormTitle(p.title);
                                setFormCategory(p.category);
                                if (p.scope) setFormScopeTarget(p.scope);
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                formPresetId === p.id
                                  ? "border-primary-500 bg-primary-50 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200"
                                  : "border-border text-foreground hover:bg-muted/50"
                              )}
                            >
                              {p.title || "Other"}
                            </button>
                          ))}
                        </div>
                        {formPresetId && (
                          <p className="text-xs text-muted-foreground">
                            {REQUIREMENT_PRESETS.find((p) => p.id === formPresetId)?.note} Expiry is not preset — set it later if this requirement expires.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Requirement Name <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Food Handling Certificate, PRC Professional License"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="text-sm sm:text-base font-medium h-11 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Category <span className="text-status-danger-foreground font-bold">*</span>
                        </label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as any)}
                          className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900"
                        >
                          {Object.entries(CATEGORY_META).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Description
                          </label>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
                        </div>
                        <textarea
                          placeholder="Brief description of why this requirement is needed..."
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          rows={3}
                          className="w-full p-3 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 2: WHO NEEDS IT? ── */}
              {createReqStep === 2 && (
                <div className="space-y-5 py-2 max-w-3xl mx-auto w-full">
                  <WorkflowSection
                    title="Who needs this requirement?"
                    subtitle="Select the target audience required to fulfill this requirement"
                  >
                    <div className="space-y-4 pt-1">
                      {/* 5 Selection Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          {
                            id: "ALL",
                            title: "Everyone",
                            desc: "Apply this requirement to all active employees across Hospicio.",
                          },
                          {
                            id: "UNIT",
                            title: "Specific Unit",
                            desc: "Apply to employees assigned to a specific organizational unit.",
                          },
                          {
                            id: "DEPARTMENT",
                            title: "Department",
                            desc: "Apply to employees in a specific department.",
                          },
                          {
                            id: "JOB_ROLE",
                            title: "Job Role",
                            desc: "Apply to employees with a specific job title or role.",
                          },
                          {
                            id: "EMPLOYEE",
                            title: "Specific Employee",
                            desc: "Apply to an individual employee only.",
                          },
                        ].map((scope) => {
                          const isSelected = formScopeTarget === scope.id;
                          return (
                            <button
                              key={scope.id}
                              type="button"
                              onClick={() => {
                                setFormScopeTarget(scope.id as any);
                                setCreateReqStepError(null);
                              }}
                              className={cn(
                                "p-4 rounded-xl border text-left transition-all space-y-1.5",
                                isSelected
                                  ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500 font-bold"
                                  : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              <span className="text-sm sm:text-base font-bold block">{scope.title}</span>
                              <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">
                                {scope.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Dynamic Single Scope Target Input */}
                      {formScopeTarget === "UNIT" && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Choose Unit <span className="text-status-danger-foreground font-bold">*</span>
                          </label>
                          <select
                            value={formTargetUnitId}
                            onChange={(e) => setFormTargetUnitId(e.target.value)}
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

                      {formScopeTarget === "DEPARTMENT" && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Choose Department <span className="text-status-danger-foreground font-bold">*</span>
                          </label>
                          <select
                            value={formTargetDeptId}
                            onChange={(e) => setFormTargetDeptId(e.target.value)}
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

                      {formScopeTarget === "JOB_ROLE" && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Choose Job Role(s) <span className="text-status-danger-foreground font-bold">*</span>
                          </label>
                          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-border">
                            {jobRoles.map((r) => (
                              <label key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted/40">
                                <input
                                  type="checkbox"
                                  checked={formTargetRoleIds.includes(r.id)}
                                  onChange={(e) => setFormTargetRoleIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))}
                                />
                                {r.title}
                              </label>
                            ))}
                          </div>
                          {formPresetId === "license" && (() => {
                            const suggested = jobRoles.filter((r) => LICENSED_PROFESSION_WORDS.some((w) => r.title.toLowerCase().includes(w)));
                            return (
                              <p className="text-xs text-muted-foreground">
                                {suggested.length
                                  ? <>Roles whose titles name a licensed profession: <strong className="text-foreground">{suggested.map((r) => r.title).join(", ")}</strong>.{" "}
                                    <button type="button" className="font-semibold text-primary-700 hover:underline dark:text-primary-300" onClick={() => setFormTargetRoleIds((prev) => [...new Set([...prev, ...suggested.map((r) => r.id)])])}>Tick these</button>. </>
                                  : "No job role title names one of these professions. "}
                                Other roles (for example where the profession is abbreviated) must be ticked by HR — nothing is assumed.
                              </p>
                            );
                          })()}
                        </div>
                      )}

                      {formScopeTarget === "EMPLOYEE" && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                          <EmployeePicker
                            employees={allEmployees}
                            selectedEmployee={allEmployees.find((e) => e.id === formTargetEmpId) || null}
                            onSelect={(emp) => setFormTargetEmpId(emp?.id || "")}
                            label="Choose Specific Employee"
                            required
                          />
                        </div>
                      )}

                      {/* Included Employees Counter */}
                      <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 flex items-center justify-between text-sm text-teal-900 dark:text-teal-200">
                        <span className="font-semibold">Estimated Audience:</span>
                        <span className="font-bold text-teal-800 dark:text-teal-300 text-sm sm:text-base">
                          {resolvedTargetCount} employee{resolvedTargetCount === 1 ? "" : "s"} included
                        </span>
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 3: VALIDITY ── */}
              {createReqStep === 3 && (
                <div className="space-y-5 py-2 max-w-2xl mx-auto w-full">
                  <WorkflowSection
                    title="Does this requirement expire?"
                    subtitle="Specify whether submitted documents require periodic renewal"
                  >
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setFormTracksExpiry(false)}
                          className={cn(
                            "p-5 rounded-xl border text-left transition-all space-y-2",
                            !formTracksExpiry
                              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500 font-bold"
                              : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <span className="text-base font-bold block">No expiration</span>
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">
                            Use when the requirement stays valid permanently unless HR updates it.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormTracksExpiry(true)}
                          className={cn(
                            "p-5 rounded-xl border text-left transition-all space-y-2",
                            formTracksExpiry
                              ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm ring-1 ring-teal-500 font-bold"
                              : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <span className="text-base font-bold block">Has an expiration date</span>
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 block font-medium leading-normal">
                            Use when HR needs to monitor renewal dates and send expiry notices.
                          </span>
                        </button>
                      </div>

                      {formTracksExpiry && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Reminder notice before expiration
                          </label>
                          <select
                            value={formReminderDays}
                            onChange={(e) => setFormReminderDays(Number(e.target.value))}
                            className="w-full h-11 px-3.5 text-sm sm:text-base font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                          >
                            <option value={15}>15 days before expiry</option>
                            <option value={30}>30 days before expiry (Standard)</option>
                            <option value={60}>60 days before expiry</option>
                            <option value={90}>90 days before expiry</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </WorkflowSection>
                </div>
              )}

              {/* ── STEP 4: REVIEW ── */}
              {createReqStep === 4 && (
                <div className="space-y-5">
                  <WorkflowSection
                    title="Review requirement"
                    subtitle="Verify all settings before creating the compliance requirement"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left Summary Card */}
                      <div className="p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Requirement Name
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg block mt-0.5">
                            {formTitle}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold">
                            {CATEGORY_META[formCategory]?.label || formCategory}
                          </span>
                        </div>

                        {formDescription && (
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                            <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                              Description
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 text-sm font-medium block mt-0.5">
                              {formDescription}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Summary Card */}
                      <div className="p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3.5">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Required For
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base block mt-0.5">
                            {formScopeTarget === "ALL"
                              ? "All Active Employees"
                              : formScopeTarget === "UNIT"
                              ? `Unit: ${units.find((u) => u.id === formTargetUnitId)?.name || "Selected Unit"}`
                              : formScopeTarget === "DEPARTMENT"
                              ? `Department: ${departments.find((d) => d.id === formTargetDeptId)?.name || "Selected Dept"}`
                              : formScopeTarget === "JOB_ROLE"
                              ? `Job Role${formTargetRoleIds.length === 1 ? "" : "s"}: ${formTargetRoleIds.map((id) => jobRoles.find((r) => r.id === id)?.title).filter(Boolean).join(", ") || "Selected Role"}`
                              : `Employee: ${allEmployees.find((e) => e.id === formTargetEmpId)?.firstName || "Staff"} ${allEmployees.find((e) => e.id === formTargetEmpId)?.lastName || ""}`}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium">
                            {resolvedTargetCount} staff member{resolvedTargetCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                          <span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-semibold tracking-wide">
                            Validity
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base block mt-0.5">
                            {formTracksExpiry
                              ? `Has expiration (${formReminderDays}-day reminder notice)`
                              : "No expiration (Permanent / One-time)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </WorkflowSection>
                </div>
              )}
            </div>

            <WorkflowModalFooter
              onCancel={() => {
                setIsCreateReqOpen(false);
                resetCreateForm();
              }}
              onBack={createReqStep > 1 ? () => setCreateReqStep(createReqStep - 1) : undefined}
              primaryLabel={createReqStep === 4 ? "Create Requirement" : "Next"}
              isSubmitting={isSubmitting}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* ── VIEW / EDIT REQUIREMENT DRAWER ── */}
      <Dialog open={isViewReqOpen} onOpenChange={setIsViewReqOpen}>
        <DialogContent className="max-w-xl p-6 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
          {selectedReq && (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="space-y-1">
                  <Badge variant="outline" className={cn("text-xs", CATEGORY_META[selectedReq.category]?.class)}>
                    {CATEGORY_META[selectedReq.category]?.label}
                  </Badge>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedReq.title}</h3>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    selectedReq.lifecycle === "ACTIVE"
                      ? "bg-status-success-surface text-status-success-foreground border-status-success-border"
                      : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-2 dark:text-muted-foreground dark:border-border-soft"
                  )}
                >
                  {selectedReq.lifecycle}
                </Badge>
              </div>

              {selectedReq.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{selectedReq.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-semibold">Applies To</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{getFriendlyScopeLabel(selectedReq)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-semibold">Expiry Tracking</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedReq.tracksExpiry ? `Yes (${selectedReq.reminderDays || 30}d reminder)` : "No Expiry"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                {selectedReq.lifecycle === "ACTIVE" && (
                  <Button
                    variant="delete"
                    size="sm"
                    onClick={() => handleDeactivateRequirement(selectedReq)}
                    className="text-xs">
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate Requirement
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsViewReqOpen(false)} className="ml-auto">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EMPLOYEE COMPLIANCE DETAIL DRAWER ── */}
      <Dialog open={Boolean(selectedEmployeeId)} onOpenChange={(open) => !open && handleCloseEmployeeDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
          {selectedEmployeeData && (
            <div className="space-y-6">
              {/* Employee Header Card */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center">
                    {selectedEmployeeData.firstName?.[0]}
                    {selectedEmployeeData.lastName?.[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {selectedEmployeeData.firstName} {selectedEmployeeData.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">
                      {selectedEmployeeData.jobRole?.title || "Staff"} · {selectedEmployeeData.unit?.name || "General"} (
                      <span className="font-mono">{selectedEmployeeData.employeeNumber}</span>)
                    </p>
                  </div>
                </div>
              </div>

              {/* Requirements Breakdown grouped by category */}
              {isEmpDetailLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading compliance breakdown...</div>
              ) : employeeSummaryItems.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-muted-foreground">
                  No compliance requirements currently apply to this employee.
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                    Applicable Requirements ({employeeSummaryItems.length})
                  </h4>

                  <div className="space-y-2.5">
                    {employeeSummaryItems.map((item, idx) => {
                      const catMeta = CATEGORY_META[item.requirement.category] || CATEGORY_META.OTHER;
                      const statusStyle = COMPLIANCE_STATUS_STYLES[item.status] || COMPLIANCE_STATUS_STYLES.MISSING;
                      const CatIcon = catMeta.icon;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs shadow-sm hover:border-teal-400 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-xs px-2 py-0.5", catMeta.class)}>
                                <CatIcon className="w-3 h-3 mr-1" />
                                {catMeta.label}
                              </Badge>
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                {item.requirement.title}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.expiresAt ? (
                                <span>Valid Until: {new Date(item.expiresAt).toLocaleDateString()}</span>
                              ) : item.latestRecordDate ? (
                                <span>Completed: {new Date(item.latestRecordDate).toLocaleDateString()}</span>
                              ) : (
                                <span>No submission record logged yet</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5", statusStyle.class)}>
                              {statusStyle.label}
                            </Badge>

                            {item.requirement.category === "MEDICAL" ? (
                              <Button
                                variant="review"
                                size="sm"
                                onClick={() => navigate({ to: "/medical" })}
                                className="h-7 text-xs">
                                Open Medical
                              </Button>
                            ) : item.requirement.category === "PSYCHOLOGICAL" ? (
                              <Button
                                variant="review"
                                size="sm"
                                onClick={() => navigate({ to: "/psychological" })}
                                className="h-7 text-xs">
                                Open Psych
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddFulfillment(selectedEmployeeData, item)}
                                className="h-7 text-xs"
                              >
                                + Record
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD GENERIC FULFILLMENT RECORD MODAL ── */}
      <Dialog open={isAddFulfillmentOpen} onOpenChange={setIsAddFulfillmentOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600 dark:text-primary-300" />
              Record Compliance Fulfillment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveFulfillmentRecord} className="space-y-4 mt-2">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <span className="text-muted-foreground block uppercase text-xs font-semibold">Requirement</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{targetFulfillmentReq?.title}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Record / Certificate Title *
              </label>
              <Input
                value={fulfillmentRecordTitle}
                onChange={(e) => setFulfillmentRecordTitle(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Completion Date *</label>
                <Input
                  type="date"
                  value={fulfillmentCompletedAt}
                  onChange={(e) => setFulfillmentCompletedAt(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Valid Until</label>
                <Input
                  type="date"
                  value={fulfillmentExpiresAt}
                  onChange={(e) => setFulfillmentExpiresAt(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reference / License Number (Optional)
              </label>
              <Input
                placeholder="e.g. CERT-2026-981"
                value={fulfillmentRefNo}
                onChange={(e) => setFulfillmentRefNo(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes (Optional)</label>
              <textarea
                placeholder="Administrative notes..."
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                rows={2}
                className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-input dark:border-slate-700 rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddFulfillmentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-teal-700 hover:bg-teal-800 text-white">
                {isSubmitting ? "Saving..." : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
