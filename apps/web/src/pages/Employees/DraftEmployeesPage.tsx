import { upgradeDraftData } from '@/lib/employeeContacts';
import { BreakdownButton, MetricBreakdownDialog, type MetricBreakdownSpec } from '@/components/shared/MetricBreakdown';
import { formatPct, ratio } from '@/lib/percent';
import { useState, useEffect, useMemo, useCallback } from"react";
import { useNavigate } from "@tanstack/react-router";
import {
 FileText, FileEdit, Search, RefreshCw, AlertTriangle, Trash2, Play, Eye,
 Building2, Calendar, User, Mail, Layers, CheckCircle2, Clock, X,
 Briefcase, Shield, Phone, Filter, Sparkles, AlertCircle
} from"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import { toast } from"sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface DraftItem {
 id: string;
 status: string;
 data: any;
 createdById: string;
 lastUpdatedById: string;
 createdEmployeeId?: string | null;
 completedAt?: string | null;
 createdAt: string;
 updatedAt: string;
 displayName?: string;
 email?: string;
 unitName?: string;
 jobRoleTitle?: string;
 completionPct?: number;
 fieldStatus?: Array<{ key: string; label: string; filled: boolean }>;
 stepIdx?: number;
 stepName?: string;
}

const STEP_NAMES = [
"Personal Info",
"Contact Info",
"Employment Info",
"Government IDs",
"Emergency Contact",
"Documents",
"Review & Confirm"
];

export default function DraftEmployeesPage() {
 const navigate = useNavigate();
 const [drafts, setDrafts] = useState<DraftItem[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [hasError, setHasError] = useState(false);

 // Filters
 const [search, setSearch] = useState("");
 const [unitFilter, setUnitFilter] = useState("ALL");
 const [stepFilter, setStepFilter] = useState("ALL");
 const [sortBy, setSortBy] = useState<"newest" |"oldest" |"updated">("updated");

 // Master Data for labels
 const [units, setUnits] = useState<any[]>([]);
 const [jobRoles, setJobRoles] = useState<any[]>([]);

 // Dialog States
 const [selectedSummaryDraft, setSelectedSummaryDraft] = useState<DraftItem | null>(null);
 const [draftSpec, setDraftSpec] = useState<MetricBreakdownSpec | null>(null);
 const [discardTarget, setDiscardTarget] = useState<DraftItem | null>(null);
 const [isDiscarding, setIsDiscarding] = useState(false);

 const fetchMasterData = async () => {
 try {
 const [uRes, rRes] = await Promise.all([
 api.get("/employees/units"),
 api.get("/employees/job-roles")
 ]);
 setUnits(uRes.data?.data || []);
 setJobRoles(rRes.data?.data || []);
 } catch (err) {
 toast.error(getApiErrorMessage(err, "The unit and job role filter options could not be loaded."), { id: "draft-master" });
 }
 };

 const fetchDrafts = useCallback(async () => {
 setIsLoading(true);
 setHasError(false);
 try {
 const res = await api.get("/onboarding-drafts?status=DRAFT");
 setDrafts(res.data?.data || []);
 } catch (err) {
 console.error("Failed to load drafts", err);
 setHasError(true);
 } finally {
 setIsLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchMasterData();
 fetchDrafts();
 }, [fetchDrafts]);

 // Unit and Role Maps for Quick Lookup
 const unitMap = useMemo(() => {
 const map = new Map<string, string>();
 units.forEach((u) => map.set(u.id, u.name));
 return map;
 }, [units]);

 const roleMap = useMemo(() => {
 const map = new Map<string, string>();
 jobRoles.forEach((r) => map.set(r.id, r.title));
 return map;
 }, [jobRoles]);

 // Processed & Filtered Drafts
 const processedDrafts = useMemo(() => {
 return drafts
 .map((draft) => {
 // Older drafts (single contact, text IDs, work email) are read in today's shape.
 const d = upgradeDraftData(draft.data || {});
 const firstName = (d.firstName || "").trim();
 const lastName = (d.lastName || "").trim();
 const displayName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() :"Untitled Employee Draft";
 const email = d.personalEmail ||"No email entered";
 const unitName = d.unitId ? (unitMap.get(d.unitId) ||"Unit selected") :"Unit not selected";
 const jobRoleTitle = d.jobRoleId ? (roleMap.get(d.jobRoleId) ||"Job role selected") :"Job Role not selected";

 // Draft completion = filled fields ÷ tracked fields × 100 (see DRAFT_COMPLETION_FIELDS).
 const fieldStatus = DRAFT_COMPLETION_FIELDS.map((f) => {
 const v = f.get ? f.get(d) : d[f.key];
 return { ...f, filled: Boolean(v && String(v).trim()) };
 });
 const filled = fieldStatus.filter((f) => f.filled).length;
 const completionPct = Math.round(ratio(filled, DRAFT_COMPLETION_FIELDS.length, 0) ?? 0);

 // Determine step index (0..6)
 let stepIdx = 0;
 if (d.firstName || d.lastName) stepIdx = 1;
 if (d.personalEmail || d.mobilePhone) stepIdx = 2;
 if (d.unitId || d.jobRoleId) stepIdx = 3;
 if (d.sssNumber || d.tinNumber) stepIdx = 4;
 if (d.emergencyContacts?.[0]?.contactName) stepIdx = 5;

 return {
 ...draft,
 displayName,
 email,
 unitName,
 jobRoleTitle,
 completionPct,
 fieldStatus,
 stepIdx,
 stepName: STEP_NAMES[stepIdx] ||"Personal Info"
 };
 })
 .filter((item) => {
 if (search.trim()) {
 const q = search.toLowerCase();
 const matchName = item.displayName.toLowerCase().includes(q);
 const matchEmail = item.email.toLowerCase().includes(q);
 const matchId = item.id.toLowerCase().includes(q);
 if (!matchName && !matchEmail && !matchId) return false;
 }
 if (unitFilter !=="ALL" && item.data?.unitId !== unitFilter) return false;
 if (stepFilter !=="ALL" && String(item.stepIdx) !== stepFilter) return false;
 return true;
 })
 .sort((a, b) => {
 if (sortBy ==="newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
 if (sortBy ==="oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
 return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
 });
 }, [drafts, search, unitFilter, stepFilter, sortBy, unitMap, roleMap]);

 // Discard Handler
 const handleConfirmDiscard = async () => {
 if (!discardTarget) return;
 setIsDiscarding(true);
 try {
 await api.delete(`/onboarding-drafts/${discardTarget.id}`);
 toast.success("Draft discarded successfully");
 setDrafts((prev) => prev.filter((d) => d.id !== discardTarget.id));
 setDiscardTarget(null);
 } catch (err: any) {
 toast.error(getApiErrorMessage(err, "Failed to discard draft"));
 } finally {
 setIsDiscarding(false);
 }
 };

 return (
 <div className="min-h-[calc(100vh-4rem)] bg-background p-6 space-y-6 max-w-[1600px] mx-auto">

 {/* Page Header */}
 <div className="space-y-3">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="flex items-start gap-3">
 <div className="h-10 w-10 rounded-xl bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-700 shrink-0 shadow-sm mt-0.5 dark:bg-primary-900/60 dark:border-primary-900 dark:text-primary-300">
 <FileEdit className="h-5 w-5" />
 </div>
 <div>
 <div className="flex items-center gap-2.5 flex-wrap">
 <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
 Draft Employees
 </h1>
 <Badge variant="outline" className="bg-primary-50 text-primary-800 border-primary-200 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
 Saved Onboarding
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">
 Resume or manage pending employee onboarding drafts
 </p>
 </div>
 </div>

 {/* Header Controls: Total Drafts Summary Card & Refresh */}
 <div className="flex items-center gap-3 w-full sm:w-auto">
 <div className="hrisense-surface px-4 py-2 shadow-sm flex items-center gap-3 flex-1 sm:flex-initial">
 <div className="h-9 w-9 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600 shrink-0 dark:bg-primary-900/40 dark:border-primary-900 dark:text-primary-300">
 <FileText className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Drafts</p>
 <p className="text-base font-bold text-foreground leading-none font-heading">{drafts.length}</p>
 </div>
 </div>

 <Button
 variant="outline"
 size="sm"
 onClick={fetchDrafts}
 className="h-11 px-4 font-semibold border-2 border-border hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/50 gap-2 rounded-xl transition-all shrink-0"
 title="Refresh Drafts"
 >
 <RefreshCw className={cn("text-primary-600 dark:text-primary-300", isLoading &&"animate-spin")} />
 <span className="hidden sm:inline">Refresh</span>
 </Button>
 </div>
 </div>

 {/* Teal Header Accent Divider Line */}
 <div className="h-0.5 w-full bg-gradient-to-r from-primary-500/40 via-primary-300/20 to-transparent rounded-full" />
 </div>

 {/* Search and Filter Container */}
 <div className="hrisense-surface p-4 shadow-sm space-y-3">
 <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
 
 {/* Search */}
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Search by draft name, work email, or reference ID..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none bg-surface text-foreground placeholder:text-muted-foreground transition-all"
 />
 </div>

 {/* Unit Filter */}
 <div className="w-full lg:w-52">
 <select
 value={unitFilter}
 onChange={(e) => setUnitFilter(e.target.value)}
 className="w-full py-2.5 px-3 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none bg-surface text-foreground transition-all"
 >
 <option value="ALL">All Units</option>
 {units.map((u) => (
 <option key={u.id} value={u.id}>{u.name}</option>
 ))}
 </select>
 </div>

 {/* Onboarding Step Filter */}
 <div className="w-full lg:w-52">
 <select
 value={stepFilter}
 onChange={(e) => setStepFilter(e.target.value)}
 className="w-full py-2.5 px-3 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none bg-surface text-foreground transition-all"
 >
 <option value="ALL">All Onboarding Steps</option>
 {STEP_NAMES.map((name, idx) => (
 <option key={idx} value={String(idx)}>Step {idx + 1}: {name}</option>
 ))}
 </select>
 </div>

 {/* Sort By */}
 <div className="w-full lg:w-44">
 <select
 value={sortBy}
 onChange={(e: any) => setSortBy(e.target.value)}
 className="w-full py-2.5 px-3 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none bg-surface text-foreground transition-all"
 >
 <option value="updated">Recently Updated</option>
 <option value="newest">Newest Created</option>
 <option value="oldest">Oldest Created</option>
 </select>
 </div>
 </div>
 </div>

 {/* Main Content Area */}
 {isLoading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <div key={i} className="hrisense-surface p-5 shadow-sm space-y-4 animate-pulse">
 <div className="flex justify-between items-start">
 <div className="space-y-2 flex-1">
 <div className="h-4 bg-slate-200 rounded-md w-3/4 dark:bg-border-soft" />
 <div className="h-3 bg-muted rounded-md w-1/2" />
 </div>
 <div className="h-5 bg-primary-100 rounded-full w-16 dark:bg-primary-900/60" />
 </div>
 <div className="space-y-1.5">
 <div className="h-3 bg-muted rounded-md w-full" />
 <div className="h-2 bg-slate-200 rounded-full w-full dark:bg-border-soft" />
 </div>
 <div className="h-8 bg-muted rounded-xl w-full" />
 </div>
 ))}
 </div>
 ) : hasError ? (
 <div className="bg-surface border-2 border-status-danger-border rounded-2xl p-8 text-center space-y-3 shadow-sm">
 <AlertTriangle className="h-10 w-10 text-status-danger-foreground mx-auto" />
 <h3 className="text-base font-bold text-foreground font-heading">Failed to Load Saved Drafts</h3>
 <p className="text-xs text-muted-foreground max-w-md mx-auto">
 An error occurred while fetching saved onboarding drafts. Please try again.
 </p>
 <Button size="sm" onClick={fetchDrafts} className="mt-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold">
 Retry
 </Button>
 </div>
 ) : processedDrafts.length === 0 ? (
 <div className="hrisense-surface p-12 text-center space-y-4 shadow-sm">
 <div className="h-14 w-14 rounded-2xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600 mx-auto shadow-sm dark:bg-primary-900/40 dark:border-primary-900 dark:text-primary-300">
 <FileText className="h-7 w-7" />
 </div>
 <div className="space-y-1">
 <h3 className="text-base font-bold text-foreground font-heading">No saved employee drafts were found.</h3>
 <p className="text-xs text-muted-foreground max-w-md mx-auto">
 When you save an in-progress onboarding form, it will appear here for easy resumption.
 </p>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
 {processedDrafts.map((draft) => {
 const isUntitled = draft.displayName ==="Untitled Employee Draft";

 return (
 <div
 key={draft.id}
 className="hrisense-surface p-5 shadow-sm hover:shadow-card-hover border-t-4 border-t-primary-500 transition-all duration-200 flex flex-col justify-between space-y-4"
 >
 <div className="space-y-3.5">
 
 {/* Card Header */}
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <h3 className={cn(
"text-base font-bold font-heading leading-tight truncate",
 isUntitled ?"text-muted-foreground italic font-medium" :"text-foreground"
 )}>
 {draft.displayName}
 </h3>
 <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
 <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
 <span className="truncate">{draft.email}</span>
 </p>
 </div>
 <Badge variant="outline" className="bg-primary-50 text-primary-800 border-primary-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
 Step {draft.stepIdx + 1}
 </Badge>
 </div>

 {/* Progress Bar Section */}
 <div className="space-y-1.5 bg-muted/80 p-3 rounded-xl border border-border/80 ">
 <div className="flex justify-between items-center text-[11px]">
 <span className="text-foreground font-semibold truncate max-w-[170px]">
 {draft.stepName}
 </span>
 <span className="font-bold text-primary-700 shrink-0 dark:text-primary-300">
 {draft.completionPct}% Complete
 </span>
 </div>
 <div className="flex justify-end">
 <BreakdownButton onClick={() => setDraftSpec(draftCompletionSpec(draft))} />
 </div>
 <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden border border-border/40 dark:bg-border-soft ">
 <div
 className="h-full bg-gradient-to-r from-primary-600 to-primary-500 rounded-full transition-all duration-300"
 style={{ width: `${draft.completionPct}%` }}
 />
 </div>
 </div>

 {/* Info Metadata Details */}
 <div className="space-y-2 text-xs text-muted-foreground pt-0.5">
 <div className="flex items-center gap-2">
 <Building2 className="h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-300 " />
 <span className="truncate font-medium text-foreground">
 {draft.unitName}
 </span>
 </div>

 <div className="flex items-center gap-2">
 <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-300 " />
 <span className="truncate font-medium text-foreground">
 {draft.jobRoleTitle}
 </span>
 </div>

 <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60 text-[11px]">
 <span className="flex items-center gap-1 text-muted-foreground ">
 <Clock className="h-3 w-3 text-muted-foreground" />
 Updated {new Date(draft.updatedAt).toLocaleDateString()}
 </span>
 <span className="font-mono text-[10px] text-muted-foreground">
 Ref #{draft.id.slice(-6).toUpperCase()}
 </span>
 </div>
 </div>
 </div>

 {/* Card Actions */}
 <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setSelectedSummaryDraft(draft)}
 className="h-9 px-3 border border-border hover:border-primary-400 text-primary-700 hover:bg-primary-50/60 text-xs font-semibold rounded-xl gap-1.5 transition-colors dark:text-primary-300 dark:hover:bg-primary-900/40"
 >
 <Eye className="h-3.5 w-3.5" /> Summary
 </Button>

 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="delete"
 onClick={() => setDiscardTarget(draft)}
 className="h-9 px-3 border text-xs font-semibold rounded-xl gap-1.5 transition-colors">
 <Trash2 className="h-3.5 w-3.5" /> Discard
 </Button>

 <Button
 size="sm"
 onClick={() => navigate({ to: "/employees/onboard" as any, search: { draftId: draft.id } as any })}
 className="h-9 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-sm gap-1.5 transition-all"
 >
 <Play className="h-3.5 w-3.5" /> Resume
 </Button>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}

 {/* ── Summary View Dialog ──────────────────────────────────────────────── */}
 {selectedSummaryDraft && (
 <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="hrisense-surface max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
 
 {/* Header */}
 <div className="flex items-center justify-between border-b border-border pb-4">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-600 dark:bg-primary-900/60 dark:border-primary-900 dark:text-primary-300 ">
 <FileText className="h-4.5 w-4.5" />
 </div>
 <div>
 <h3 className="text-base font-bold text-foreground font-heading leading-tight">
 Draft Summary: {selectedSummaryDraft.displayName}
 </h3>
 <p className="text-xs text-muted-foreground mt-0.5">Ref ID: {selectedSummaryDraft.id}</p>
 </div>
 </div>
 <button
 onClick={() => setSelectedSummaryDraft(null)}
 className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* Progress Overview Badge */}
 <div className="bg-primary-50/60 dark:bg-primary-950/40 border border-primary-200/80 dark:border-primary-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-primary-600 dark:text-primary-400" />
 <span className="font-semibold text-primary-900 dark:text-primary-300">Onboarding Completion</span>
 </div>
 <span className="font-bold text-primary-700 dark:text-primary-400">
 {selectedSummaryDraft.completionPct}% ({selectedSummaryDraft.stepName})
 </span>
 </div>

 {/* Structured Summary Breakdown */}
 <div className="space-y-4 text-xs">
 
 {/* Personal Information */}
 <div className="border border-border rounded-xl p-3.5 space-y-2">
 <p className="font-bold text-foreground flex items-center gap-2">
 <User className="h-4 w-4 text-primary-600 dark:text-primary-300" /> Personal Information
 </p>
 <div className="grid grid-cols-2 gap-2 text-muted-foreground">
 <div>Name: <strong className="text-foreground">{selectedSummaryDraft.displayName}</strong></div>
 <div>Gender: <strong className="text-foreground">{selectedSummaryDraft.data?.gender ||"Not specified"}</strong></div>
 <div>Date of Birth: <strong className="text-foreground">{selectedSummaryDraft.data?.dateOfBirth ||"Not entered"}</strong></div>
 <div>Civil Status: <strong className="text-foreground">{selectedSummaryDraft.data?.civilStatus ||"Not specified"}</strong></div>
 </div>
 </div>

 {/* Contact Information */}
 <div className="border border-border rounded-xl p-3.5 space-y-2">
 <p className="font-bold text-foreground flex items-center gap-2">
 <Mail className="h-4 w-4 text-primary-600 dark:text-primary-300" /> Contact Information
 </p>
 <div className="grid grid-cols-2 gap-2 text-muted-foreground">
 <div>Personal Email (login): <strong className="text-foreground">{upgradeDraftData(selectedSummaryDraft.data || {}).personalEmail ||"Not entered"}</strong></div>
 <div>Mobile Phone: <strong className="text-foreground">{selectedSummaryDraft.data?.mobilePhone ||"Not entered"}</strong></div>
 <div>Address: <strong className="text-foreground">{selectedSummaryDraft.data?.presentAddress ||"Not entered"}</strong></div>
 </div>
 </div>

 {/* Employment Information */}
 <div className="border border-border rounded-xl p-3.5 space-y-2">
 <p className="font-bold text-foreground flex items-center gap-2">
 <Briefcase className="h-4 w-4 text-primary-600 dark:text-primary-300" /> Employment Information
 </p>
 <div className="grid grid-cols-2 gap-2 text-muted-foreground">
 <div>Unit: <strong className="text-foreground">{selectedSummaryDraft.unitName}</strong></div>
 <div>Job Role: <strong className="text-foreground">{selectedSummaryDraft.jobRoleTitle}</strong></div>
 <div>Status: <strong className="text-foreground">{selectedSummaryDraft.data?.employmentStatus ||"REGULAR"}</strong></div>
 <div>Hire Date: <strong className="text-foreground">{selectedSummaryDraft.data?.hireDate ||"Not set"}</strong></div>
 </div>
 </div>

 {/* Emergency Contact */}
 <div className="border border-border rounded-xl p-3.5 space-y-2">
 <p className="font-bold text-foreground flex items-center gap-2">
 <Phone className="h-4 w-4 text-primary-600 dark:text-primary-300" /> Emergency Contacts
 </p>
 <ul className="space-y-1 text-muted-foreground">
 {(upgradeDraftData(selectedSummaryDraft.data || {}).emergencyContacts as any[])
 .filter((c) => c.contactName || c.mobilePhone)
 .map((c, i) => (
 <li key={i}>{i + 1}. <strong className="text-foreground">{c.contactName || "Not entered"}</strong>{c.relationship ? ` (${c.relationship})` : ""} · {c.mobilePhone || "No number"}</li>
 ))}
 {!(upgradeDraftData(selectedSummaryDraft.data || {}).emergencyContacts as any[]).some((c) => c.contactName || c.mobilePhone) && <li>Not entered</li>}
 </ul>
 </div>

 {/* Raw JSON Snapshot */}
 <div className="space-y-1.5">
 <p className="font-bold text-foreground">Stored Data Snapshot:</p>
 <pre className="bg-surface-elevated text-foreground p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-44 border border-slate-800">
 {JSON.stringify(selectedSummaryDraft.data || {}, null, 2)}
 </pre>
 </div>
 </div>

 {/* Modal Actions */}
 <div className="pt-3 border-t border-border flex justify-end gap-2">
 <Button variant="outline" size="sm" onClick={() => setSelectedSummaryDraft(null)} className="h-9 px-4 border border-border">
 Close
 </Button>
 <Button
 size="sm"
 onClick={() => {
 const id = selectedSummaryDraft.id;
 setSelectedSummaryDraft(null);
 navigate({ to: "/employees/onboard" as any, search: { draftId: id } as any });
 }}
 className="h-9 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold gap-1.5"
 >
 <Play className="h-3.5 w-3.5" /> Resume Draft
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* ── Discard Confirmation Modal ──────────────────────────────────────── */}
 {discardTarget && (
 <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="hrisense-surface max-w-md w-full p-6 shadow-2xl space-y-4">
 <div className="flex items-center gap-3 text-status-danger-foreground">
 <div className="h-10 w-10 rounded-xl bg-status-danger-surface border border-status-danger-border flex items-center justify-center shrink-0">
 <AlertTriangle className="h-5 w-5" />
 </div>
 <div>
 <h3 className="text-base font-bold font-heading text-foreground leading-tight">Discard Onboarding Draft?</h3>
 <p className="text-xs text-muted-foreground mt-0.5">Permanent draft removal</p>
 </div>
 </div>

 <p className="text-xs text-muted-foreground leading-relaxed">
 Are you sure you want to discard the saved draft for <strong className="text-foreground">{discardTarget.displayName}</strong>?
 This action cannot be undone. Completed employee accounts will not be affected.
 </p>

 <div className="pt-2 flex justify-end gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setDiscardTarget(null)}
 disabled={isDiscarding}
 className="h-9 px-4 border border-border"
 >
 Cancel
 </Button>
 <Button
 size="sm"
 onClick={handleConfirmDiscard}
 disabled={isDiscarding}
 className="h-9 px-4 bg-danger hover:bg-status-danger-foreground text-white font-bold gap-1.5"
 >
 {isDiscarding ?"Discarding..." :"Discard Draft"}
 </Button>
 </div>
 </div>
 </div>
 )}
 <MetricBreakdownDialog open={draftSpec !== null} onOpenChange={(o) => !o && setDraftSpec(null)} spec={draftSpec} />
 </div>
 );
}

/**
 * The onboarding fields a draft's completion counts. A draft is a work in
 * progress, so this is NOT profile completion (which uses weighted criteria
 * on a saved employee); every field here counts equally.
 */
const DRAFT_COMPLETION_FIELDS: Array<{ key: string; label: string; get?: (d: any) => unknown }> = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'gender', label: 'Sex' },
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'personalEmail', label: 'Personal email (login)' },
  { key: 'mobilePhone', label: 'Mobile number' },
  { key: 'presentAddress', label: 'Present address' },
  { key: 'unitId', label: 'Unit' },
  { key: 'jobRoleId', label: 'Job role' },
  { key: 'employmentStatus', label: 'Employment status' },
  { key: 'hireDate', label: 'Date hired' },
  { key: 'sssNumber', label: 'SSS number' },
  { key: 'emergencyContactName', label: 'Emergency contact 1 — person', get: (d) => d.emergencyContacts?.[0]?.contactName },
  { key: 'emergencyContactPhone', label: 'Emergency contact 1 — mobile number', get: (d) => d.emergencyContacts?.[0]?.mobilePhone },
];

function draftCompletionSpec(draft: any): MetricBreakdownSpec {
  const fields: Array<{ label: string; filled: boolean }> = draft.fieldStatus ?? [];
  const filled = fields.filter((f) => f.filled).length;
  return {
    title: 'Draft completion',
    value: `${draft.completionPct}%`,
    caption: `${draft.displayName ?? 'This draft'} — fields filled so far in the onboarding form.`,
    formula: [`${filled} of ${fields.length} tracked fields filled`, `${filled} ÷ ${fields.length} × 100 = ${formatPct(ratio(filled, fields.length))} → shown as ${draft.completionPct}%`],
    columns: ['Field', 'Counts'],
    sections: [
      { heading: 'Filled', rows: fields.filter((f) => f.filled).map((f) => ({ label: f.label, cells: ['1 / 1'], status: { text: 'Filled', tone: 'success' as const } })) },
      { heading: 'Not filled yet', rows: fields.filter((f) => !f.filled).map((f) => ({ label: f.label, cells: ['0 / 1'], status: { text: 'Missing', tone: 'danger' as const } })) },
    ].filter((sec) => sec.rows.length),
    total: { label: 'TOTAL', cells: [`${filled} / ${fields.length}`] },
    notes: ['Each tracked field counts equally. Draft completion is separate from the weighted profile completion an employee gets once saved.'],
  };
}
