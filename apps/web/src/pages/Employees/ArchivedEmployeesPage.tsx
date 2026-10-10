import { EMPLOYMENT_STATE_LABELS, employmentDuration, formatEmploymentDate, hasEnded, type EmploymentState } from "@/lib/employment";
import { useState, useEffect, useCallback, useMemo } from"react";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavigate } from "@tanstack/react-router";
import {
 Archive, Search, RefreshCw, AlertTriangle, RotateCcw, Eye,
 Building2, Calendar, User, Mail, ShieldAlert, ChevronLeft, ChevronRight
} from"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import { toast } from"sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface ArchivedEmployee {
 id: string;
 employeeNumber: string;
 firstName: string;
 lastName: string;
 middleName?: string | null;
 personalEmail?: string | null;
 employmentStatus: string;
 hireDate?: string | null;
 separationDate?: string | null;
 employmentState: string;
 deletedAt?: string | null;
 unit?: { id: string; name: string } | null;
 jobRole?: { id: string; title: string } | null;
 department?: { id: string; name: string } | null;
 user?: { id: string; email: string; isActive: boolean } | null;
}

export default function ArchivedEmployeesPage() {
 const navigate = useNavigate();
 const [employees, setEmployees] = useState<ArchivedEmployee[]>([]);
 const [total, setTotal] = useState(0);
 const [page, setPage] = useState(1);
 const [pages, setPages] = useState(1);
 const [isLoading, setIsLoading] = useState(true);
 const [hasError, setHasError] = useState(false);

 // Filters
 const [search, setSearch] = useState("");
 // One request after typing pauses, not one per keystroke.
 const debouncedSearch = useDebounce(search, 350);
 const [unitFilter, setUnitFilter] = useState("ALL");
 const [units, setUnits] = useState<any[]>([]);

 // Restore Modal State
 const [restoreTarget, setRestoreTarget] = useState<ArchivedEmployee | null>(null);
 const [isRestoring, setIsRestoring] = useState(false);

 const fetchUnits = async () => {
 try {
 const res = await api.get("/employees/units");
 setUnits(res.data?.data || []);
 } catch (err) {
 toast.error(getApiErrorMessage(err, "The unit filter options could not be loaded."), { id: "archived-units" });
 }
 };

 const fetchArchivedEmployees = useCallback(async () => {
 setIsLoading(true);
 setHasError(false);
 try {
 const params: any = {
 isArchived:"true",
 page,
 limit: 15,
 };
 if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
 if (unitFilter !=="ALL") params.unitId = unitFilter;

 const res = await api.get("/employees", { params });
 setEmployees(res.data?.data || []);
 setTotal(res.data?.total || 0);
 setPages(res.data?.pages || 1);
 } catch (err) {
 console.error("Failed to load archived employees", err);
 setHasError(true);
 } finally {
 setIsLoading(false);
 }
 }, [page, debouncedSearch, unitFilter]);

 useEffect(() => {
 fetchUnits();
 }, []);

 useEffect(() => {
 fetchArchivedEmployees();
 }, [fetchArchivedEmployees]);

 // Restore Handler
 const handleConfirmRestore = async () => {
 if (!restoreTarget) return;
 setIsRestoring(true);
 try {
 await api.patch(`/employees/${restoreTarget.id}/restore`);
 toast.success(`Employee ${restoreTarget.firstName} ${restoreTarget.lastName} restored to active directory`);
 setRestoreTarget(null);
 fetchArchivedEmployees();
 } catch (err: any) {
 toast.error(getApiErrorMessage(err, "Failed to restore employee"));
 } finally {
 setIsRestoring(false);
 }
 };

 return (
 <div className="max-w-[1600px] mx-auto p-6 space-y-6">

 {/* Page Header */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="flex items-center gap-3">
 <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center dark:bg-primary-900/40 dark:border-primary-900">
 <Archive className="h-5 w-5 text-primary-600 dark:text-primary-300" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h1 className="text-[24px] font-bold tracking-tight text-foreground font-heading">
 Archived Employees
 </h1>
 <Badge variant="outline" className="bg-slate-100 text-secondary-foreground border-border text-xs dark:bg-surface-2">
 Soft-Archived Records
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground mt-1">
 View and restore archived employee accounts
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="hrisense-surface px-4 py-2 flex items-center gap-2 border-primary-100 bg-primary-50/20 dark:border-primary-900 dark:bg-primary-900/40">
 <Archive className="h-4 w-4 text-primary-600 dark:text-primary-300" />
 <span className="text-[13px] text-muted-foreground font-medium">Archived Total:</span>
 <span className="text-[14px] font-bold text-foreground">{total}</span>
 </div>

 <Button
 variant="outline"
 size="sm"
 onClick={fetchArchivedEmployees}
 className="h-[38px] px-3 gap-1.5 text-[14px] font-semibold"
 >
 <RefreshCw className={cn("h-3.5 w-3.5", isLoading &&"animate-spin")} /> Refresh
 </Button>
 </div>
 </div>

 {/* Filter Toolbar */}
 <div className="hrisense-surface p-4 shadow-sm space-y-3">
 <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
 
 {/* Search */}
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 type="text"
 placeholder="Search by name, employee number, or email..."
 value={search}
 onChange={(e) => { setSearch(e.target.value); setPage(1); }}
 className="hrisense-control w-full pl-9"
 />
 </div>

 {/* Unit Filter */}
 <div className="w-full lg:w-56">
 <select
 value={unitFilter}
 onChange={(e) => { setUnitFilter(e.target.value); setPage(1); }}
 className="hrisense-control w-full"
 >
 <option value="ALL">All Units</option>
 {units.map((u) => (
 <option key={u.id} value={u.id}>{u.name}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Main Content Area */}
 {isLoading ? (
 <div className="hrisense-surface rounded-xl p-12 text-center space-y-3 shadow-sm">
 <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mx-auto" />
 <p className="text-sm font-medium text-muted-foreground">Loading archived records...</p>
 </div>
 ) : hasError ? (
 <div className="hrisense-surface border-status-danger-border rounded-xl p-8 text-center space-y-3 shadow-sm">
 <AlertTriangle className="h-10 w-10 text-status-danger-foreground mx-auto" />
 <h3 className="text-base font-bold text-foreground">Failed to Load Archived Employees</h3>
 <Button size="sm" onClick={fetchArchivedEmployees} className="mt-2">Retry</Button>
 </div>
 ) : employees.length === 0 ? (
 <div className="hrisense-surface rounded-xl p-12 text-center space-y-3 shadow-sm">
 <Archive className="h-10 w-10 text-muted-foreground mx-auto" />
 <h3 className="text-base font-bold text-foreground">No archived employee records were found.</h3>
 <p className="text-xs text-muted-foreground max-w-sm mx-auto">
 Soft-archived employee accounts will appear here and can be restored at any time.
 </p>
 </div>
 ) : (
 <div className="hrisense-table-container">
 <div className="overflow-x-auto">
 <table className="w-full text-left text-[14px] border-collapse">
 <thead>
 <tr className="bg-primary-50/50 border-b border-border text-muted-foreground font-semibold sticky top-0 z-10 shadow-sm backdrop-blur dark:bg-primary-900/40">
 <th className="py-3.5 px-4">Employee</th>
 <th className="py-3.5 px-4">Employee #</th>
 <th className="py-3.5 px-4">Unit & Role</th>
 <th className="py-3.5 px-4">Status</th>
 <th className="py-3.5 px-4">Service</th>
 <th className="py-3.5 px-4">Archived Date</th>
 <th className="py-3.5 px-4 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {employees.map((emp) => {
 const fullName = `${emp.firstName} ${emp.lastName}`.trim();
 const email = emp.personalEmail ||"No email";
 // Service runs start → end. Without a recorded end date nothing is counted:
 // measuring an archived employee up to today would invent an end date.
 const service = emp.separationDate ? employmentDuration(emp.hireDate, emp.separationDate) : null;
 const unitName = emp.unit?.name ||"Unassigned Unit";
 const roleTitle = emp.jobRole?.title ||"Unassigned Role";
 const archiveDate = emp.deletedAt ? new Date(emp.deletedAt).toLocaleDateString() :"Archived";

 return (
 <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
 {/* Employee Info */}
 <td className="py-3.5 px-4">
 <div className="flex items-center gap-3">
 <div className="h-8 w-8 rounded-full bg-slate-200 text-secondary-foreground font-bold text-xs flex items-center justify-center shrink-0 dark:bg-border-soft">
 {emp.firstName[0]}{emp.lastName[0]}
 </div>
 <div>
 <p
 onClick={() => navigate({ to: `/employees/${emp.id}` as any })}
 className="font-bold text-foreground cursor-pointer hover:text-primary-600 truncate max-w-48 dark:hover:text-primary-300"
 >
 {fullName}
 </p>
 <p className="text-[11px] text-muted-foreground truncate max-w-48">{email}</p>
 </div>
 </div>
 </td>

 {/* Employee # */}
 <td className="py-3.5 px-4 font-mono font-medium text-foreground">
 {emp.employeeNumber}
 </td>

 {/* Unit & Role */}
 <td className="py-3.5 px-4">
 <p className="font-semibold text-foreground truncate max-w-52">{unitName}</p>
 <p className="text-[11px] text-muted-foreground truncate max-w-52">{roleTitle}</p>
 </td>

 {/* Status Badges */}
 <td className="py-3.5 px-4 space-y-1">
 <div className="flex items-center gap-1.5 flex-wrap">
 <Badge variant="outline" className="bg-slate-100 text-secondary-foreground border-border text-[10px] dark:bg-surface-2">
 Archived
 </Badge>
 <Badge variant="outline" className="bg-status-info-surface text-status-info-foreground border-status-info-border text-[10px]">
 {emp.employmentStatus}
 </Badge>
 </div>
 </td>

 {/* Service period */}
 <td className="py-3.5 px-4 text-xs">
 <p className="text-foreground">{formatEmploymentDate(emp.hireDate)} → {emp.separationDate ? formatEmploymentDate(emp.separationDate) : "End date not recorded"}</p>
 <p className="text-muted-foreground mt-0.5">
 {EMPLOYMENT_STATE_LABELS[emp.employmentState as EmploymentState] ?? emp.employmentState}
 {" · "}
 {service ? service.text : hasEnded(emp.employmentState) ? "length not calculated (no end date)" : "no end date recorded"}
 </p>
 </td>

 {/* Archive Date */}
 <td className="py-3.5 px-4 text-muted-foreground">
 {archiveDate}
 </td>

 {/* Actions */}
 <td className="py-3.5 px-4 text-right">
 <div className="flex items-center justify-end gap-2">
 <Button
 size="sm"
 variant="outline"
 className="h-[38px] px-3 gap-1.5 text-[14px] font-medium border-border text-primary-700 hover:bg-primary-50 hover:text-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/40 dark:hover:text-primary-300"
 onClick={() => navigate({ to: `/employees/${emp.id}` as any })}
 >
 <Eye className="h-4 w-4" /> Profile
 </Button>
 <Button variant="create"
 size="sm"
 className="h-[38px] px-3 gap-1.5 text-[14px] font-semibold bg-[#148281] hover:bg-[#116968] shadow-sm"
 onClick={() => setRestoreTarget(emp)}>
 <RotateCcw className="h-4 w-4" /> Restore
 </Button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {/* Pagination Controls */}
 {pages > 1 && (
 <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
 <span>Showing Page {page} of {pages} ({total} total records)</span>
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 disabled={page <= 1}
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 className="h-7 text-xs gap-1"
 >
 <ChevronLeft className="h-3.5 w-3.5" /> Previous
 </Button>
 <Button
 size="sm"
 variant="outline"
 disabled={page >= pages}
 onClick={() => setPage((p) => Math.min(pages, p + 1))}
 className="h-7 text-xs gap-1"
 >
 Next <ChevronRight className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* ── Restore Confirmation Modal ──────────────────────────────────────── */}
 {restoreTarget && (
 <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="hrisense-surface rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
 <div className="flex items-center gap-3 text-status-success-foreground">
 <RotateCcw className="h-6 w-6" />
 <h3 className="text-base font-bold font-heading text-foreground">Restore Employee Record?</h3>
 </div>

 <p className="text-xs text-muted-foreground">
 Are you sure you want to restore <strong className="text-foreground">{restoreTarget.firstName} {restoreTarget.lastName}</strong> ({restoreTarget.employeeNumber}) back to active directory?
 The record will immediately reappear in the active employee directory and active organization chart.
 </p>

 <div className="pt-2 flex justify-end gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setRestoreTarget(null)}
 disabled={isRestoring}
 >
 Cancel
 </Button>
 <Button
 size="sm"
 onClick={handleConfirmRestore}
 disabled={isRestoring}
 className="bg-success hover:bg-status-success-foreground text-white font-semibold"
 >
 {isRestoring ?"Restoring..." :"Restore Employee"}
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
