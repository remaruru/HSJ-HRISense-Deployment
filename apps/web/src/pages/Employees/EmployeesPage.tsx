import React, { useState, useEffect, useMemo, useCallback, useRef } from"react";
import { MetricBreakdownDialog, type MetricBreakdownSpec } from "@/components/shared/MetricBreakdown";
import { profileCompletionSpec } from "@/components/shared/profileCompletionSpec";
import { motion, AnimatePresence } from"framer-motion";
import {
 Search, Plus, Filter, Download,
 Clock, AlertCircle, RefreshCw, AlertTriangle,
 ChevronUp, ChevronDown, ChevronsUpDown, Archive, RotateCcw,
 CheckSquare, FileSpreadsheet, FileText, X, ChevronLeft,
 ChevronRight, Users, UserCheck, Shield, FileType
} from"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
 useReactTable,
 getCoreRowModel,
 flexRender,
 ColumnDef,
 PaginationState,
 SortingState,
 VisibilityState,
} from "@tanstack/react-table";
import { toast } from"sonner";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/providers/AuthProvider";
import { OrgSelector } from "@/components/common/OrgSelector";
import { isProfessional } from "@/lib/employment";
import { getApiErrorMessage } from "@/utils/error-handler.util";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
 id: string;
 employeeNumber: string;
 firstName: string;
 middleName?: string;
 lastName: string;
 photoUrl?: string;
 jobRole?: { id: string; title: string };
 department?: { id: string; name: string };
 unit?: { id: string; name: string };
 immediateSupervisor?: { id: string; firstName: string; lastName: string; jobRole?: { title: string } };
 supervisorAssignmentStatus?: string;
 noSupervisorRequired?: boolean;
 supervisorAssignmentSource?: string;
 employmentStatus?: string; // REGULAR | PROBATIONARY | CONTRACTUAL | CASUAL | PART_TIME
 employmentState?: string; // ACTIVE | ON_LEAVE | RESIGNED | TERMINATED | RETIRED | AWOL | OTHERS
 separationDate?: string | null;
 separationReason?: string | null;
 prcLicenseNumber?: string | null;
 professionalRole?: string | null;
 hireDate?: string;
 profileCompletion?: number;
 user?: { id: string; email: string; isActive: boolean } | null;
 deletedAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const employmentStateColor: Record<string, string> = {
 ACTIVE:"bg-success-50 text-success-700 border-success-200",
 ON_LEAVE:"bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
 RESIGNED:"bg-gray-50 text-gray-600 border-gray-200 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft",
 TERMINATED:"bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
 RETIRED:"bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
 AWOL:"bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
 OTHERS:"bg-status-neutral-surface text-status-neutral-foreground border-status-neutral-border",
};

const employmentStateLabel: Record<string, string> = {
 ACTIVE:"Active",
 ON_LEAVE:"On Leave",
 RESIGNED:"Resigned",
 TERMINATED:"Terminated",
 RETIRED:"Retired",
 AWOL:"AWOL",
 OTHERS:"Others",
};

const employmentStatusLabel: Record<string, string> = {
 REGULAR:"Regular",
 PROBATIONARY:"Probationary",
 CONTRACTUAL:"Contractual",
 CASUAL:"Casual",
 PART_TIME:"Part-time",
};

const formatDate = (dateStr?: string) => {
 if (!dateStr) return "—";
 return new Date(dateStr).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" });
};

// ─── Shared cell pieces (table and phone cards) ───────────────────────────────
function SupervisorInfo({ emp }: { emp: Employee }) {
 if (emp.supervisorAssignmentStatus ==="PENDING") {
 return (
 <Badge variant="outline" className="bg-status-warning-surface text-status-warning-foreground border-status-warning-border text-xs">
 <Clock className="h-3 w-3 mr-1" /> Pending Assignment
 </Badge>
 );
 }
 if (emp.immediateSupervisor) {
 return (
 <div className="min-w-0">
 <p className="text-sm font-medium break-words">
 {emp.immediateSupervisor.firstName} {emp.immediateSupervisor.lastName}
 </p>
 <p className="text-xs text-muted-foreground break-words">{emp.immediateSupervisor.jobRole?.title}</p>
 </div>
 );
 }
 if (emp.noSupervisorRequired) {
 return <span className="text-muted-foreground text-xs">Not required (top-level role)</span>;
 }
 return <span className="text-muted-foreground italic text-xs">Not yet assigned</span>;
}

/** The completion bar; the percentage opens the breakdown (same calculation as the profile). */
function CompletionMeter({ pct, onOpen }: { pct: number; onOpen: () => void }) {
 return (
 <div className="flex items-center gap-2 min-w-[90px]">
 <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden dark:bg-border-soft">
 <div
 className={cn(
"h-full rounded-full transition-all",
 pct >= 80 ?"bg-[#148281]" :"bg-warning"
 )}
 style={{ width: `${pct}%` }}
 />
 </div>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onOpen(); }}
 title="View how this percentage is calculated"
 aria-label={`Profile completion ${pct}% — view breakdown`}
 className="text-xs font-semibold text-foreground font-mono underline decoration-dotted underline-offset-2 hover:text-primary-700 dark:hover:text-primary-300"
 >
 {pct}%
 </button>
 </div>
 );
}

/** Sort choices for phones, where there are no column headers to press. */
const MOBILE_SORTS: Array<{ value: string; label: string }> = [
 { value:"", label:"Default order" },
 { value:"firstName:asc", label:"Name (A–Z)" },
 { value:"firstName:desc", label:"Name (Z–A)" },
 { value:"jobRole:asc", label:"Job role" },
 { value:"unit:asc", label:"Unit" },
 { value:"hireDate:desc", label:"Newest hires" },
 { value:"hireDate:asc", label:"Longest serving" },
 { value:"profileCompletion:asc", label:"Lowest completion" },
];

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({
 open, onConfirm, onCancel, title, description, confirmLabel ="Confirm", dangerous = false
}: {
 open: boolean; onConfirm: () => void; onCancel: () => void;
 title: string; description: string; confirmLabel?: string; dangerous?: boolean;
}) {
 if (!open) return null;
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="bg-surface rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
 >
 <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
 <p className="text-sm text-muted-foreground mb-6">{description}</p>
 <div className="flex gap-2 justify-end">
 <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
 <Button
 size="sm"
 className={dangerous ?"bg-danger hover:bg-status-danger-foreground text-white" : ""}
 onClick={onConfirm}
 >
 {confirmLabel}
 </Button>
 </div>
 </motion.div>
 </div>
 );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function EmployeesPage() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const { tier } = usePermission();
 const isFullHR = tier ==="FULL";

 const searchParams = useSearch({ strict: false }) as any;

 // ─── Table State ──────────────────────────────────────────────────────────
 const [data, setData] = useState<Employee[]>([]);
 const [total, setTotal] = useState(0);
 const [loading, setLoading] = useState(true);
 // The reason the list failed (no connection, too many requests, server), or null.
 const [error, setError] = useState<string | null>(null);
 const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

 // Pagination
 const [pagination, setPagination] = useState<PaginationState>({
 pageIndex: searchParams.page ? Number(searchParams.page) - 1 : 0,
 pageSize: searchParams.limit ? Number(searchParams.limit) : 25,
 });

 // Sorting
 const [sorting, setSorting] = useState<SortingState>(
 searchParams.sortBy
 ? [{ id: searchParams.sortBy, desc: searchParams.sortOrder ==="desc" }]
 : []
 );

 // Search
 // The router reads a numbers-only search in the URL (a timekeeping code such as 927) as a number.
 const [searchInput, setSearchInput] = useState(searchParams.search != null ? String(searchParams.search) : "");
 const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
 const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

 useEffect(() => {
 clearTimeout(debounceRef.current);
 debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400);
 return () => clearTimeout(debounceRef.current);
 }, [searchInput]);

 // Filters
 const [employmentStateFilter, setEmploymentStateFilter] = useState<string>(
 searchParams.employmentState ||"ALL"
 );
 const [supervisorStatusFilter, setSupervisorStatusFilter] = useState<boolean>(
 searchParams.supervisorAssignmentStatus ==="PENDING"
 );
 const [showFilterPanel, setShowFilterPanel] = useState(false);
 const [unitFilter, setUnitFilter] = useState(searchParams.unitId || "");
 const [departmentFilter, setDepartmentFilter] = useState(searchParams.departmentId || "");
 const [jobRoleFilter, setJobRoleFilter] = useState(searchParams.jobRoleId || "");
 const [accountStatusFilter, setAccountStatusFilter] = useState(searchParams.accountStatus || "");
 const [hireDateFrom, setHireDateFrom] = useState(searchParams.hireDateFrom || "");
 const [hireDateTo, setHireDateTo] = useState(searchParams.hireDateTo || "");
 const [isArchivedFilter, setIsArchivedFilter] = useState<string>(searchParams.isArchived ||"false");

 // Master data for filter dropdowns
 const [units, setUnits] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [jobRoles, setJobRoles] = useState<any[]>([]);

 // Export Menu State & Ref
 const [showExportMenu, setShowExportMenu] = useState(false);
 const exportMenuRef = useRef<HTMLDivElement>(null);

 // Column Visibility State & Ref
 const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
 department: false,
 employmentStatus: false,
 hireDate: false,
 });
 const [showColumnMenu, setShowColumnMenu] = useState(false);
 const columnMenuRef = useRef<HTMLDivElement>(null);

 // Close menus on click outside or escape key
 useEffect(() => {
 function handleClickOutside(event: MouseEvent) {
 const target = event.target as Node;
 if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
 setShowExportMenu(false);
 }
 if (columnMenuRef.current && !columnMenuRef.current.contains(target)) {
 setShowColumnMenu(false);
 }
 }
 function handleKeyDown(event: KeyboardEvent) {
 if (event.key ==="Escape") {
 setShowExportMenu(false);
 setShowColumnMenu(false);
 }
 }
 document.addEventListener("mousedown", handleClickOutside);
 document.addEventListener("keydown", handleKeyDown);
 return () => {
 document.removeEventListener("mousedown", handleClickOutside);
 document.removeEventListener("keydown", handleKeyDown);
 };
 }, []);

 // Bulk action confirm
 const [confirmState, setConfirmState] = useState<{
 open: boolean; action:"archive" |"restore" |"activate" |"deactivate" | null;
 }>({ open: false, action: null });

 // ─── Load Master Data ─────────────────────────────────────────────────────
 useEffect(() => {
 if (!isFullHR) return;
 Promise.all([api.get("/employees/units"), api.get("/departments")]).then(([uRes, dRes]) => {
 setUnits(uRes.data.data || []);
 setDepartments(dRes.data.data || []);
 }).catch((err) => {
 toast.error(getApiErrorMessage(err, "The unit and department filter options could not be loaded."), { id: "employees-master" });
 });
 }, [isFullHR]);

 // Load job roles based on unit filter
 useEffect(() => {
 if (!isFullHR) return;
 const params = unitFilter ? { unitId: unitFilter } : {};
 api.get("/employees/job-roles", { params }).then(res => {
 setJobRoles(res.data.data || []);
 }).catch((err) => {
 toast.error(getApiErrorMessage(err, "The job role filter options could not be loaded."), { id: "employees-roles" });
 });
 }, [unitFilter, isFullHR]);

 // ─── URL State Sync ───────────────────────────────────────────────────────
 useEffect(() => {
 navigate({
 search: ((prev: any) => ({
 ...prev,
 page: pagination.pageIndex + 1,
 limit: pagination.pageSize,
 search: debouncedSearch || undefined,
 employmentState: employmentStateFilter !=="ALL" ? employmentStateFilter : undefined,
 supervisorAssignmentStatus: supervisorStatusFilter ?"PENDING" : undefined,
 unitId: unitFilter || undefined,
 departmentId: departmentFilter || undefined,
 jobRoleId: jobRoleFilter || undefined,
 accountStatus: accountStatusFilter || undefined,
 hireDateFrom: hireDateFrom || undefined,
 hireDateTo: hireDateTo || undefined,
 isArchived: isArchivedFilter !=="false" ? isArchivedFilter : undefined,
 sortBy: sorting.length > 0 ? sorting[0].id : undefined,
 sortOrder: sorting.length > 0 ? (sorting[0].desc ?"desc" :"asc") : undefined,
 })) as any,
 replace: true,
 } as any);
 }, [pagination, debouncedSearch, employmentStateFilter, supervisorStatusFilter,
 unitFilter, departmentFilter, jobRoleFilter, accountStatusFilter, hireDateFrom, hireDateTo, isArchivedFilter, sorting]);

 // ─── Data Fetch ───────────────────────────────────────────────────────────
 // Only the newest request may fill the table: while typing, an older, slower
 // search could otherwise answer last and show results for the wrong words.
 const latestRequest = useRef(0);
 const fetchData = useCallback(async () => {
 const requestId = ++latestRequest.current;
 try {
 setLoading(true);
 setError(null);
 setRowSelection({});
 const res = await api.get("/employees", {
 params: {
 page: pagination.pageIndex + 1,
 limit: pagination.pageSize,
 search: debouncedSearch || undefined,
 employmentState: employmentStateFilter !=="ALL" ? employmentStateFilter : undefined,
 supervisorAssignmentStatus: supervisorStatusFilter ?"PENDING" : undefined,
 unitId: unitFilter || undefined,
 departmentId: departmentFilter || undefined,
 jobRoleId: jobRoleFilter || undefined,
 accountStatus: accountStatusFilter || undefined,
 hireDateFrom: hireDateFrom || undefined,
 hireDateTo: hireDateTo || undefined,
 isArchived: isArchivedFilter,
 sortBy: sorting.length > 0 ? sorting[0].id : undefined,
 sortOrder: sorting.length > 0 ? (sorting[0].desc ?"desc" :"asc") : undefined,
 },
 });
 if (requestId !== latestRequest.current) return;
 setData(res.data.data || []);
 setTotal(res.data.total || 0);
 } catch (err) {
 if (requestId !== latestRequest.current) return;
 setError(getApiErrorMessage(err, "The employee list could not be loaded."));
 } finally {
 if (requestId === latestRequest.current) setLoading(false);
 }
 }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, employmentStateFilter,
 supervisorStatusFilter, unitFilter, departmentFilter, jobRoleFilter,
 accountStatusFilter, hireDateFrom, hireDateTo, isArchivedFilter, sorting]);

 useEffect(() => { fetchData(); }, [fetchData]);

 // ─── Bulk Actions ─────────────────────────────────────────────────────────
 const selectedIndices = Object.keys(rowSelection).filter(k => rowSelection[k]);
 const selectedIds = selectedIndices.map(idx => data[parseInt(idx)]?.id).filter(Boolean);
 const selectedEmployees = data.filter((_, i) => rowSelection[i]);

 const executeBulkAction = async (action:"archive" |"restore" |"activate" |"deactivate") => {
 setConfirmState({ open: false, action: null });
 try {
 if (action ==="archive") {
 await Promise.all(selectedIds.map(id => api.delete(`/employees/${id}`)));
 toast.success(`${selectedIds.length} employee(s) archived.`);
 } else if (action ==="restore") {
 await api.post("/employees/bulk-restore", { ids: selectedIds });
 toast.success(`${selectedIds.length} employee(s) restored.`);
 } else if (action ==="activate" || action ==="deactivate") {
 // Employee-centric account surface — the single authoritative account API.
 const withAccounts = selectedEmployees.filter(emp => emp.user?.id);
 const skipped = selectedEmployees.length - withAccounts.length;

 await Promise.all(
 withAccounts.map(emp => api.post(`/employees/${emp.id}/account/${action}`))
 );

 const verb = action ==="activate" ?"activated" :"deactivated";
 if (withAccounts.length === 0) {
 toast.error("None of the selected employees have a HRISense login account.");
 } else if (skipped > 0) {
 toast.success(`${withAccounts.length} account(s) ${verb}. ${skipped} employee(s) skipped — no login account.`);
 } else {
 toast.success(`${withAccounts.length} account(s) ${verb}.`);
 }
 }
 setRowSelection({});
 await fetchData();
 } catch (err) {
 toast.error(getApiErrorMessage(err, "Bulk action failed. Please try again."));
 }
 };

 // ─── Export Handler (Excel, PDF, CSV) ────────────────────────────────────
 const handleExport = async (scope:"CURRENT_PAGE" |"SELECTED" |"ALL_MATCHING", format:"excel" |"pdf" |"csv") => {
 setShowExportMenu(false);
 try {
 toast.info(`Generating ${format.toUpperCase()} report…`);
 const exportParams = {
 scope,
 selectedIds: scope ==="SELECTED" ? selectedIds.join(",") : undefined,
 page: pagination.pageIndex + 1,
 limit: pagination.pageSize,
 search: debouncedSearch || undefined,
 employmentState: employmentStateFilter !=="ALL" ? employmentStateFilter : undefined,
 supervisorAssignmentStatus: supervisorStatusFilter ?"PENDING" : undefined,
 unitId: unitFilter || undefined,
 departmentId: departmentFilter || undefined,
 jobRoleId: jobRoleFilter || undefined,
 accountStatus: accountStatusFilter || undefined,
 hireDateFrom: hireDateFrom || undefined,
 hireDateTo: hireDateTo || undefined,
 isArchived: isArchivedFilter,
 sortBy: sorting.length > 0 ? sorting[0].id : undefined,
 sortOrder: sorting.length > 0 ? (sorting[0].desc ?"desc" :"asc") : undefined,
 };

 if (format ==="csv") {
 let rowsToExport = data;
 if (scope ==="SELECTED") rowsToExport = selectedEmployees;
 else if (scope ==="ALL_MATCHING") {
 const res = await api.get("/employees", { params: { ...exportParams, page: 1, limit: 5000 } });
 rowsToExport = res.data.data || [];
 }
 exportCSV(rowsToExport);
 toast.success("CSV export downloaded.");
 return;
 }

 // Backend Excel or PDF download
 const response = await api.post(`/employees/export/${format}`, exportParams, {
 responseType:"blob",
 });

 const blob = new Blob([response.data], {
 type: format ==="excel" ?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :"application/pdf"
 });
 const url = URL.createObjectURL(blob);
 const link = document.createElement("a");
 link.href = url;
 link.download = `Employee_Directory_${Date.now()}.${format ==="excel" ?"xlsx" :"pdf"}`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 toast.success(`${format.toUpperCase()} report exported successfully.`);
 } catch (err) {
 toast.error(getApiErrorMessage(err, `Failed to export ${format.toUpperCase()} report.`));
 }
 };

 const exportCSV = (rows: Employee[]) => {
 const headers = [
"Employee No","First Name","Middle Name","Last Name",
"Job Role","Department","Unit",
"Supervisor","Supervisor Role","Supervisor Status",
"Employment Status","Employment State","Account Status","Date Hired","Completion (%)"
 ];
 const csvRows = rows.map(e => [
 e.employeeNumber, e.firstName, e.middleName || "", e.lastName,
 e.jobRole?.title || "", e.department?.name || "", e.unit?.name || "",
 e.immediateSupervisor ? `${e.immediateSupervisor.firstName} ${e.immediateSupervisor.lastName}` :"Not Assigned",
 e.immediateSupervisor?.jobRole?.title || "",
 e.supervisorAssignmentStatus || "",
 e.employmentStatus ? employmentStatusLabel[e.employmentStatus] || e.employmentStatus : "",
 e.employmentState ? employmentStateLabel[e.employmentState] || e.employmentState : "",
 e.user ? (e.user.isActive ?"Active" :"Inactive") :"No Account",
 formatDate(e.hireDate),
 `${e.profileCompletion || 0}%`
 ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
 const csv = [headers.join(","), ...csvRows].join("\n");
 const blob = new Blob([csv], { type:"text/csv" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `Employee_Directory_${Date.now()}.csv`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 // ─── Navigation ───────────────────────────────────────────────────────────
 const goToProfile = (id: string) => navigate({ to: `/employees/${id}` as any });

 // ─── Sort Helper ──────────────────────────────────────────────────────────
 const SortIcon = ({ colId }: { colId: string }) => {
 const sorted = sorting.find(s => s.id === colId);
 if (!sorted) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
 return sorted.desc
 ? <ChevronDown className="h-3.5 w-3.5 text-primary-600 dark:text-primary-300" />
 : <ChevronUp className="h-3.5 w-3.5 text-primary-600 dark:text-primary-300" />;
 };

 const handleSort = (colId: string) => {
 setSorting(prev => {
 const existing = prev.find(s => s.id === colId);
 if (!existing) return [{ id: colId, desc: false }];
 if (!existing.desc) return [{ id: colId, desc: true }];
 return [];
 });
 setPagination(p => ({ ...p, pageIndex: 0 }));
 };

 // Profile completion breakdown — fetched on demand, same calculation as the profile.
 const [completionSpec, setCompletionSpec] = useState<MetricBreakdownSpec | null>(null);
 const [completionOpen, setCompletionOpen] = useState(false);
 const openCompletion = useCallback(async (employeeId: string) => {
 try {
 const res = await api.get(`/employees/${employeeId}/profile-completion`);
 const d = res.data?.data;
 setCompletionSpec(profileCompletionSpec(d?.percentage ?? 0, d?.breakdown, d?.name));
 setCompletionOpen(true);
 } catch (err) {
 toast.error(getApiErrorMessage(err, "The profile completion breakdown could not be loaded."));
 }
 }, []);

 // ─── 13 Columns (Explicitly Defined) ──────────────────────────────────────
 const columns = useMemo<ColumnDef<Employee>[]>(() => [
 // 1. Selection
 {
 id:"select",
 enableSorting: false,
 header: ({ table }) => isFullHR ? (
 <input
 type="checkbox"
 checked={table.getIsAllPageRowsSelected()}
 onChange={table.getToggleAllPageRowsSelectedHandler()}
 className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer dark:border-border-soft dark:text-primary-300"
 />
 ) : null,
 cell: ({ row }) => isFullHR ? (
 <input
 type="checkbox"
 checked={row.getIsSelected()}
 onChange={row.getToggleSelectedHandler()}
 className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer dark:border-border-soft dark:text-primary-300"
 />
 ) : null,
 size: 36,
 },
 // 2. Profile Photo + Employee Number + Full Name
 {
 id:"firstName",
 accessorKey:"firstName",
 enableSorting: true,
 header:"Employee",
 cell: ({ row }) => {
 const emp = row.original;
 return (
 <div className="flex items-center gap-3 min-w-[180px]">
 <Avatar
 size="sm"
 src={emp.photoUrl || undefined}
 name={`${emp.firstName} ${emp.lastName}`}
 />
 <div>
 <p className="text-sm font-semibold text-foreground leading-tight">
 {emp.firstName} {emp.middleName ? emp.middleName[0] + ". " : ""}{emp.lastName}
 </p>
 <div className="flex items-center gap-1.5">
 <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>
 {/* A PRC licence on file is what marks someone as a professional. */}
 {isProfessional(emp) && (
 <span
 className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-status-info-surface text-status-info-foreground border border-status-info-border"
 title={emp.professionalRole ? `Professional — ${emp.professionalRole}` : "Professional"}
 >
 Professional
 </span>
 )}
 {isFullHR && emp.employeeNumber.startsWith('DEV-') && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
 Development Account
 </span>
 )}
 </div>
 </div>
 </div>
 );
 },
 },
 // 3. Job Role
 {
 id:"jobRole",
 accessorKey:"jobRole",
 enableSorting: true,
 header:"Job Role",
 cell: ({ row }) =>
 row.original.jobRole?.title
 ? <span className="text-sm">{row.original.jobRole.title}</span>
 : <span className="text-muted-foreground italic text-xs">Unassigned</span>,
 },
 // 4. Department
 {
 id:"department",
 enableSorting: true,
 header:"Department",
 cell: ({ row }) => <span className="text-sm">{row.original.department?.name ?? <span className="text-muted-foreground text-xs">—</span>}</span>,
 },
 // 5. Unit
 {
 id:"unit",
 enableSorting: true,
 header:"Unit",
 cell: ({ row }) => <span className="text-sm">{row.original.unit?.name ?? <span className="text-muted-foreground italic text-xs">No Unit</span>}</span>,
 },
 // 6. Immediate Supervisor
 {
 id:"supervisor",
 enableSorting: false,
 header:"Immediate Supervisor",
 cell: ({ row }) => <div className="min-w-[140px]"><SupervisorInfo emp={row.original} /></div>,
 },
 // 7. Employment Status
 {
 id:"employmentStatus",
 accessorKey:"employmentStatus",
 enableSorting: true,
 header:"Status",
 cell: ({ row }) => {
 const s = row.original.employmentStatus;
 return s
 ? <Badge variant="outline" className="text-xs">{employmentStatusLabel[s] ?? s}</Badge>
 : <span className="text-muted-foreground text-xs">—</span>;
 },
 },
 // 8. Employment State
 {
 id:"employmentState",
 accessorKey:"employmentState",
 enableSorting: true,
 header:"State",
 cell: ({ row }) => {
 const s = row.original.employmentState;
 if (!s) return <span className="text-muted-foreground text-xs">—</span>;
 return (
 <Badge variant="outline" className={cn("text-xs", employmentStateColor[s] ?? "")}>
 {employmentStateLabel[s] ?? s}
 </Badge>
 );
 },
 },
 // 9. Account Status
 {
 id:"accountStatus",
 enableSorting: false,
 header:"Account",
 cell: ({ row }) => {
 const u = row.original.user;
 if (!u) return <Badge variant="outline" className="text-xs bg-gray-50 text-muted-foreground border-gray-200 dark:bg-surface-2 dark:border-border-soft">No Account</Badge>;
 return u.isActive
 ? <Badge variant="outline" className="text-xs bg-success-50 text-success-700 border-success-200">Active</Badge>
 : <Badge variant="outline" className="text-xs bg-status-danger-surface text-status-danger-foreground border-status-danger-border">Inactive</Badge>;
 },
 },
 // 10. Date Hired
 {
 id:"hireDate",
 accessorKey:"hireDate",
 enableSorting: true,
 header:"Date Hired",
 cell: ({ row }) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.original.hireDate)}</span>,
 },
 // 11. Profile Completion (Required Column)
 {
 id:"profileCompletion",
 accessorKey:"profileCompletion",
 enableSorting: true,
 header:"Completion",
 cell: ({ row }) => <CompletionMeter pct={row.original.profileCompletion ?? 0} onOpen={() => openCompletion(row.original.id)} />,
 },
 // 12. Actions
 {
 id:"actions",
 enableSorting: false,
 header: "",
 cell: ({ row }) => {
 const emp = row.original;
 return (
 <div className="flex items-center gap-1 justify-end">
 {emp.supervisorAssignmentStatus ==="PENDING" && isFullHR && (
 <Button size="sm" variant="review" className="text-[13px] h-8 px-3 font-semibold"
 onClick={(e) => { e.stopPropagation(); goToProfile(emp.id); }}>
 Review
 </Button>
 )}
 <Button size="sm" variant="review" className="h-8 px-3 text-[13px] font-semibold"
 onClick={() => goToProfile(emp.id)}>
 View
 </Button>
 {isFullHR && (
 <Button size="sm" variant="update" className="h-8 px-3 text-[13px] font-semibold border-border"
 onClick={() => goToProfile(emp.id)}>
 Edit
 </Button>
 )}
 </div>
 );
 },
 },
 ], [isFullHR, sorting, openCompletion]);

 // ─── Table Instance ───────────────────────────────────────────────────────
 const table = useReactTable({
 data,
 columns,
 state: { pagination, sorting, rowSelection, columnVisibility },
 onPaginationChange: setPagination,
 onSortingChange: setSorting,
 onRowSelectionChange: setRowSelection,
 onColumnVisibilityChange: setColumnVisibility,
 getCoreRowModel: getCoreRowModel(),
 manualPagination: true,
 manualSorting: true,
 pageCount: Math.ceil(total / pagination.pageSize),
 enableRowSelection: isFullHR,
 });

 const selectedCount = Object.values(rowSelection).filter(Boolean).length;
 const activeFilterCount = [
 unitFilter, departmentFilter, jobRoleFilter, accountStatusFilter,
 hireDateFrom, hireDateTo,
 employmentStateFilter !=="ALL" ? employmentStateFilter : "",
 supervisorStatusFilter ?"pending" : "",
 isArchivedFilter !=="false" ?"archived" : "",
 ].filter(Boolean).length;

 // ─── Render ───────────────────────────────────────────────────────────────
 return (
 <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">

 {/* ── Header ──────────────────────────────────────────────────────── */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="flex items-center gap-3">
 <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary-50/50 border border-primary-100 flex items-center justify-center dark:bg-primary-900/40 dark:border-primary-900">
 <Users className="h-6 w-6 text-primary-600 dark:text-primary-300" />
 </div>
 <div>
 <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-foreground font-heading leading-tight">
 Employee Directory
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 {total > 0 ? `${total.toLocaleString()} employee${total !== 1 ?"s" : ""}` :"Manage and view employee records"}
 </p>
 </div>
 </div>
 <div className="flex gap-3 flex-wrap">
 {/* Export Dropdown with scope choices */}
 <div className="relative" ref={exportMenuRef}>
 <Button variant="outline" size="sm" className="gap-1.5 h-[42px] px-4 text-[14px] font-medium" onClick={() => setShowExportMenu(prev => !prev)}
 aria-expanded={showExportMenu}
 aria-haspopup="true"
 >
 <Download className="h-4 w-4" />
 Export Reports
 </Button>
 {showExportMenu && (
 <div className="absolute right-0 mt-1 w-64 bg-surface rounded-xl shadow-xl border border-border z-20 p-2 space-y-2">
 <div>
 <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Excel Workbook (.xlsx)</p>
 <button onClick={() => handleExport("CURRENT_PAGE","excel")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <FileSpreadsheet className="h-3.5 w-3.5 text-status-success-foreground" /> Current Page
 </button>
 {selectedCount > 0 && (
 <button onClick={() => handleExport("SELECTED","excel")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <CheckSquare className="h-3.5 w-3.5 text-status-success-foreground" /> Selected ({selectedCount})
 </button>
 )}
 <button onClick={() => handleExport("ALL_MATCHING","excel")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <FileSpreadsheet className="h-3.5 w-3.5 text-status-success-foreground" /> All Filtered Results
 </button>
 </div>
 <div className="border-t border-border pt-1">
 <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">PDF Document (.pdf)</p>
 <button onClick={() => handleExport("CURRENT_PAGE","pdf")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <FileType className="h-3.5 w-3.5 text-status-danger-foreground" /> Current Page
 </button>
 {selectedCount > 0 && (
 <button onClick={() => handleExport("SELECTED","pdf")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <CheckSquare className="h-3.5 w-3.5 text-status-danger-foreground" /> Selected ({selectedCount})
 </button>
 )}
 <button onClick={() => handleExport("ALL_MATCHING","pdf")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <FileType className="h-3.5 w-3.5 text-status-danger-foreground" /> All Filtered Results
 </button>
 </div>
 <div className="border-t border-border pt-1">
 <p className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">CSV (.csv)</p>
 <button onClick={() => handleExport("ALL_MATCHING","csv")} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer">
 <FileText className="h-3.5 w-3.5 text-status-info-foreground" /> Download CSV
 </button>
 </div>
 </div>
 )}
 </div>
 {/* Columns Visibility Dropdown — the table's control, so tablets and up (phones get cards). */}
 <div className="relative hidden md:block" ref={columnMenuRef}>
 <Button variant="outline" size="sm" className="gap-1.5 h-[42px] px-4 text-[14px] font-medium" onClick={() => setShowColumnMenu(prev => !prev)}
 aria-expanded={showColumnMenu}
 aria-haspopup="true"
 >
 <Filter className="h-4 w-4" />
 Columns
 </Button>
 {showColumnMenu && (
 <div className="absolute right-0 mt-1 w-56 bg-surface rounded-xl shadow-xl border border-border z-20 p-2 space-y-1">
 <p className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Toggle Columns</p>
 <div className="border-t border-border my-1" />
 {table.getAllLeafColumns()
 .filter(col => col.id !=="select" && col.id !=="actions")
 .map(col => {
 const labelMap: Record<string, string> = {
 firstName:"Employee",
 jobRole:"Job Role",
 department:"Department",
 unit:"Unit",
 supervisor:"Supervisor",
 employmentStatus:"Status",
 employmentState:"State",
 accountStatus:"Account",
 hireDate:"Date Hired",
 profileCompletion:"Completion"
 };
 const label = labelMap[col.id] || col.id;
 return (
 <label
 key={col.id}
 className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted rounded-lg text-foreground cursor-pointer select-none"
 >
 <input
 type="checkbox"
 checked={col.getIsVisible()}
 onChange={col.getToggleVisibilityHandler()}
 className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer dark:border-border-soft dark:text-primary-300"
 />
 {label}
 </label>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ── Search & Quick Filters ───────────────────────────────────────── */}
 <div className="hrisense-surface p-3 flex flex-col sm:flex-row gap-3">
 {/* Search */}
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 id="employee-search"
 type="text"
 placeholder="Search by name, ID, job role, unit, department…"
 value={searchInput}
 onChange={(e) => {
 setSearchInput(e.target.value);
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 className="hrisense-control w-full pl-9"
 />
 {searchInput && (
 <button
 onClick={() => { setSearchInput(""); setDebouncedSearch(""); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 aria-label="Clear search"
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
 >
 <X className="h-3.5 w-3.5" />
 </button>
 )}
 </div>

 {/* Quick filters row */}
 <div className="flex gap-2 items-center flex-wrap">
 <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
 {["ALL","ACTIVE","ON_LEAVE"].map(state => (
 <button
 key={state}
 onClick={() => { setEmploymentStateFilter(state); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 className={cn(
"px-4 py-2 text-[14px] font-semibold rounded-md transition-all",
 employmentStateFilter === state
 ?"bg-[#148281] shadow-sm text-white"
 :"text-muted-foreground hover:text-foreground"
 )}
 >
 {state ==="ALL" ?"All States" : employmentStateLabel[state]}
 </button>
 ))}
 </div>

 <button
 onClick={() => {
 setSupervisorStatusFilter(p => !p);
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 className={cn(
"flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-semibold border transition-all",
 supervisorStatusFilter
 ?"bg-status-warning-surface text-status-warning-foreground border-status-warning-border"
 :"bg-surface text-muted-foreground border-border hover:bg-muted"
 )}
 >
 <AlertCircle className="h-3.5 w-3.5" />
 Pending Supervisor
 {supervisorStatusFilter && <X className="h-3 w-3" />}
 </button>

 {isFullHR && (
 <button
 onClick={() => setShowFilterPanel(p => !p)}
 className={cn(
"flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-semibold border transition-all",
 showFilterPanel || activeFilterCount > 0
 ?"bg-primary-50 text-primary-800 border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900"
 :"bg-surface text-muted-foreground border-border hover:bg-muted"
 )}
 >
 <Filter className="h-3.5 w-3.5" />
 More Filters
 {activeFilterCount > 0 && (
 <span className="bg-primary-600 text-white rounded-full h-4 w-4 text-[10px] flex items-center justify-center">
 {activeFilterCount}
 </span>
 )}
 </button>
 )}
 </div>
 </div>

 {/* ── Advanced Filter Panel ────────────────────────────────────────── */}
 <AnimatePresence>
 {showFilterPanel && isFullHR && (
 <motion.div
 initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height:"auto" }}
 exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
 >
 <div className="hrisense-surface p-4 space-y-3">
 <div className="flex justify-between items-center mb-1">
 <h3 className="text-sm font-semibold text-foreground">Advanced Directory Filters</h3>
 <button
 onClick={() => {
 setUnitFilter("");
 setDepartmentFilter("");
 setJobRoleFilter("");
 setAccountStatusFilter("");
 setHireDateFrom("");
 setHireDateTo("");
 setIsArchivedFilter("false");
 setSearchInput("");
 setDebouncedSearch("");
 setEmploymentStateFilter("ALL");
 setSupervisorStatusFilter(false);
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 className="text-xs text-muted-foreground hover:text-foreground"
 >
 Clear all filters
 </button>
 </div>
 <div className="bg-gray-50/50 p-3 rounded-lg border border-border dark:bg-surface-2/50">
 <OrgSelector
 unitId={unitFilter}
 departmentId={departmentFilter}
 jobRoleId={jobRoleFilter}
 onChange={({ unitId, departmentId, jobRoleId }) => {
 setUnitFilter(unitId);
 setDepartmentFilter(departmentId);
 setJobRoleFilter(jobRoleId);
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 isFilter={true}
 layout="grid"
 />
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
 {/* Account Status */}
 <div>
 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Account Status</label>
 <select
 value={accountStatusFilter}
 onChange={e => { setAccountStatusFilter(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 className="hrisense-control w-full"
 >
 <option value="">All Accounts</option>
 <option value="ACTIVE">Account Active</option>
 <option value="INACTIVE">Account Inactive</option>
 <option value="NO_ACCOUNT">No Account Created</option>
 </select>
 </div>
 {/* Date Hired From */}
 <div>
 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Hired From</label>
 <input
 type="date"
 value={hireDateFrom}
 onChange={e => { setHireDateFrom(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 className="hrisense-control w-full"
 />
 </div>
 {/* Date Hired To */}
 <div>
 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Hired To</label>
 <input
 type="date"
 value={hireDateTo}
 onChange={e => { setHireDateTo(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 className="w-full text-sm border border-border rounded-lg px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500"
 />
 </div>
 {/* Active vs Archived Toggle */}
 <div>
 <label className="text-xs font-semibold text-muted-foreground mb-1 block">Record Scope</label>
 <select
 value={isArchivedFilter}
 onChange={e => { setIsArchivedFilter(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
 className="w-full text-sm border border-border rounded-lg px-2 py-1.5 bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500"
 >
 <option value="false">Active Employees Only</option>
 <option value="true">Archived Employees Only</option>
 <option value="all">Active & Archived</option>
 </select>
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* ── Bulk Actions Bar ─────────────────────────────────────────────── */}
 <AnimatePresence>
 {selectedCount > 0 && isFullHR && (
 <motion.div
 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
 className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 dark:bg-primary-900/40 dark:border-primary-900"
 >
 <div className="flex items-center gap-2">
 <CheckSquare className="h-4 w-4 text-primary-700 dark:text-primary-300" />
 <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">
 {selectedCount} employee{selectedCount !== 1 ?"s" : ""} selected
 </span>
 </div>
 <div className="flex gap-2 flex-wrap">
 {isArchivedFilter ==="true" ? (
 <Button
 size="sm" variant="create" 
 onClick={() => setConfirmState({ open: true, action:"restore" })}>
 <RotateCcw className="h-3.5 w-3.5" /> Restore Selected
 </Button>
 ) : (
 <Button
 size="sm" variant="delete" 
 onClick={() => setConfirmState({ open: true, action:"archive" })}>
 <Archive className="h-3.5 w-3.5" /> Archive Selected
 </Button>
 )}
 <Button
 size="sm" variant="create" 
 onClick={() => setConfirmState({ open: true, action:"activate" })}>
 <UserCheck className="h-3.5 w-3.5" /> Activate Accounts
 </Button>
 <Button
 size="sm" variant="delete" 
 onClick={() => setConfirmState({ open: true, action:"deactivate" })}>
 <Shield className="h-3.5 w-3.5" /> Deactivate Accounts
 </Button>
 <Button
 size="sm" variant="outline" className="bg-surface"
 onClick={() => handleExport("SELECTED","excel")}
 >
 <FileSpreadsheet className="h-3.5 w-3.5 text-status-success-foreground" /> Export Excel
 </Button>
 <Button
 size="sm" variant="outline" className="bg-surface"
 onClick={() => handleExport("SELECTED","pdf")}
 >
 <FileType className="h-3.5 w-3.5 text-status-danger-foreground" /> Export PDF
 </Button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* ── Table (tablets and up) / cards (phones) ─────────────────────────── */}
 <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
 {/* Phones: sort and select without column headers. */}
 <div className="md:hidden flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-primary-50/50 dark:bg-primary-900/40">
 {isFullHR ? (
 <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none">
 <input
 type="checkbox"
 checked={table.getIsAllPageRowsSelected()}
 onChange={table.getToggleAllPageRowsSelectedHandler()}
 disabled={loading || data.length === 0}
 className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer dark:border-border-soft dark:text-primary-300"
 />
 Select page
 </label>
 ) : <span />}
 <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground min-w-0">
 Sort
 <select
 aria-label="Sort employees"
 value={sorting[0] ? `${sorting[0].id}:${sorting[0].desc ?"desc" :"asc"}` :""}
 onChange={(e) => {
 const [id, dir] = e.target.value.split(":");
 setSorting(id ? [{ id, desc: dir ==="desc" }] : []);
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 className="hrisense-control h-9 py-1 text-sm min-w-0 max-w-[11rem]"
 >
 {MOBILE_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 </label>
 </div>

 <ul className="md:hidden divide-y divide-border/60" aria-label="Employees">
 {loading ? (
 Array.from({ length: 4 }).map((_, i) => (
 <li key={i} className="p-4 animate-pulse space-y-3">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-full bg-muted" />
 <div className="flex-1 space-y-2">
 <div className="h-3.5 bg-muted rounded w-2/3" />
 <div className="h-3 bg-muted rounded w-1/3" />
 </div>
 </div>
 <div className="h-3 bg-muted rounded w-full" />
 <div className="h-3 bg-muted rounded w-4/5" />
 </li>
 ))
 ) : error ? (
 <li className="px-4 py-12 text-center">
 <AlertTriangle className="h-8 w-8 text-status-danger-foreground mx-auto mb-2" />
 <p className="text-sm font-medium text-foreground mb-1">Failed to load employees</p>
 <p role="alert" className="text-xs text-muted-foreground mb-3">{error}</p>
 <Button size="sm" variant="outline" onClick={fetchData}>
 <RefreshCw className="h-3.5 w-3.5" /> Retry
 </Button>
 </li>
 ) : data.length === 0 ? (
 <li className="px-4 py-14 text-center">
 <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
 <p className="text-sm font-medium text-foreground mb-1">No employees found</p>
 <p className="text-xs text-muted-foreground">
 {debouncedSearch || activeFilterCount > 0
 ?"Try adjusting your search or filters."
 :"No employee records exist yet."}
 </p>
 </li>
 ) : (
 table.getRowModel().rows.map(row => {
 const emp = row.original;
 const name = `${emp.firstName} ${emp.middleName ? emp.middleName[0] +". " :""}${emp.lastName}`;
 const state = emp.employmentState;
 return (
 <li key={row.id} className={cn("p-4", row.getIsSelected() &&"bg-primary-50/60 dark:bg-primary-900/40")}>
 <div className="flex items-start gap-3 min-w-0">
 {isFullHR && (
 <input
 type="checkbox"
 checked={row.getIsSelected()}
 onChange={row.getToggleSelectedHandler()}
 aria-label={`Select ${name}`}
 className="mt-3 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer dark:border-border-soft dark:text-primary-300"
 />
 )}
 <Avatar size="md" src={emp.photoUrl || undefined} name={`${emp.firstName} ${emp.lastName}`} />
 <div className="min-w-0 flex-1">
 <p className="text-[15px] font-semibold text-foreground leading-tight break-words">{name}</p>
 <p className="text-xs text-muted-foreground font-mono mt-0.5">{emp.employeeNumber}</p>
 <div className="mt-1 flex flex-wrap gap-1">
 {isProfessional(emp) && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-status-info-surface text-status-info-foreground border border-status-info-border">
 Professional{emp.professionalRole ? ` · ${emp.professionalRole}` :""}
 </span>
 )}
 {isFullHR && emp.employeeNumber.startsWith('DEV-') && (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
 Development Account
 </span>
 )}
 </div>
 </div>
 </div>

 <dl className="mt-3 grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-4 gap-y-3">
 <div className="min-w-0">
 <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Job Role</dt>
 <dd className="mt-0.5 text-sm break-words">{emp.jobRole?.title ?? <span className="text-muted-foreground italic text-xs">Unassigned</span>}</dd>
 </div>
 <div className="min-w-0">
 <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</dt>
 <dd className="mt-0.5 text-sm break-words">{emp.unit?.name ?? <span className="text-muted-foreground italic text-xs">No Unit</span>}</dd>
 </div>
 <div className="min-w-0 min-[400px]:col-span-2">
 <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Immediate Supervisor</dt>
 <dd className="mt-0.5"><SupervisorInfo emp={emp} /></dd>
 </div>
 <div className="min-w-0">
 <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
 <dd className="mt-1 flex flex-wrap gap-1">
 {state ? (
 <Badge variant="outline" className={cn("text-xs", employmentStateColor[state] ??"")}>{employmentStateLabel[state] ?? state}</Badge>
 ) : null}
 {emp.employmentStatus && <Badge variant="outline" className="text-xs">{employmentStatusLabel[emp.employmentStatus] ?? emp.employmentStatus}</Badge>}
 {!state && !emp.employmentStatus && <span className="text-muted-foreground text-xs">—</span>}
 </dd>
 </div>
 <div className="min-w-0">
 <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile Completion</dt>
 <dd className="mt-1"><CompletionMeter pct={emp.profileCompletion ?? 0} onOpen={() => openCompletion(emp.id)} /></dd>
 </div>
 </dl>

 <div className="mt-3 flex gap-2">
 {emp.supervisorAssignmentStatus ==="PENDING" && isFullHR && (
 <Button size="sm" variant="review" className="h-10 px-4 font-semibold" onClick={() => goToProfile(emp.id)}>
 Review
 </Button>
 )}
 <Button size="sm" variant="review" className="h-10 flex-1 font-semibold" onClick={() => goToProfile(emp.id)}>
 View Employee
 </Button>
 </div>
 </li>
 );
 })
 )}
 </ul>

 <div className="hidden md:block overflow-x-auto">
 <table className="w-full text-[14px] text-left">
 <thead className="bg-primary-50/50 border-b border-border sticky top-0 z-10 shadow-sm backdrop-blur dark:bg-primary-900/40">
 {table.getHeaderGroups().map(hg => (
 <tr key={hg.id}>
 {hg.headers.map(header => {
 const canSort = header.column.getCanSort();
 return (
 <th
 key={header.id}
 className={cn(
"px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none whitespace-nowrap",
 canSort &&"cursor-pointer hover:text-foreground group"
 )}
 onClick={canSort ? () => handleSort(header.column.id) : undefined}
 >
 <div className="flex items-center gap-1">
 {flexRender(header.column.columnDef.header, header.getContext())}
 {canSort && <SortIcon colId={header.column.id} />}
 </div>
 </th>
 );
 })}
 </tr>
 ))}
 </thead>
 <tbody className="divide-y divide-border/60">
 {loading ? (
 Array.from({ length: pagination.pageSize > 10 ? 10 : pagination.pageSize }).map((_, i) => (
 <tr key={i} className="animate-pulse">
 {table.getVisibleLeafColumns().map((_, ci) => (
 <td key={ci} className="px-4 py-3">
 <div className="h-4 bg-muted rounded w-full max-w-[120px]" />
 </td>
 ))}
 </tr>
 ))
 ) : error ? (
 <tr>
 <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-12 text-center">
 <AlertTriangle className="h-8 w-8 text-status-danger-foreground mx-auto mb-2" />
 <p className="text-sm font-medium text-foreground mb-1">Failed to load employees</p>
 <p role="alert" className="text-xs text-muted-foreground mb-3">{error}</p>
 <Button size="sm" variant="outline" onClick={fetchData}>
 <RefreshCw className="h-3.5 w-3.5" /> Retry
 </Button>
 </td>
 </tr>
 ) : data.length === 0 ? (
 <tr>
 <td colSpan={table.getVisibleLeafColumns().length} className="px-4 py-14 text-center">
 <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
 <p className="text-sm font-medium text-foreground mb-1">No employees found</p>
 <p className="text-xs text-muted-foreground">
 {debouncedSearch || activeFilterCount > 0
 ?"Try adjusting your search or filters."
 :"No employee records exist yet."}
 </p>
 </td>
 </tr>
 ) : (
 table.getRowModel().rows.map(row => (
 <tr
 key={row.id}
 className={cn(
"hover:bg-muted/30 transition-colors cursor-pointer",
 row.getIsSelected() &&"bg-primary-50/60 dark:bg-primary-900/40"
 )}
 onClick={() => goToProfile(row.original.id)}
 >
 {row.getVisibleCells().map(cell => (
 <td
 key={cell.id}
 className="px-4 py-3 align-middle"
 onClick={
 cell.column.id ==="select" || cell.column.id ==="actions"
 ? e => e.stopPropagation()
 : undefined
 }
 >
 {flexRender(cell.column.columnDef.cell, cell.getContext())}
 </td>
 ))}
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* ── Pagination ──────────────────────────────────────────────── */}
 <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2">
 <label className="text-xs text-muted-foreground">Rows per page</label>
 <select
 className="border border-border rounded-lg px-2 py-1 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500"
 value={pagination.pageSize}
 onChange={e => {
 table.setPageSize(Number(e.target.value));
 setPagination(p => ({ ...p, pageIndex: 0 }));
 }}
 >
 {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
 </select>
 </div>
 <span className="text-xs text-muted-foreground">
 {total > 0 ? (
 <>
 {(pagination.pageIndex * pagination.pageSize + 1).toLocaleString()}–
 {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total).toLocaleString()} of {total.toLocaleString()}
 </>
 ) :"0 results"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline" size="sm" className="h-8 w-8 p-0"
 onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
 >
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <span className="text-xs text-muted-foreground px-1">
 Page {pagination.pageIndex + 1} of {table.getPageCount() || 1}
 </span>
 <Button
 variant="outline" size="sm" className="h-8 w-8 p-0"
 onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
 >
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </div>

 {/* ── Confirm Dialog ───────────────────────────────────────────────── */}
 <ConfirmDialog
 open={confirmState.open}
 onCancel={() => setConfirmState({ open: false, action: null })}
 onConfirm={() => confirmState.action && executeBulkAction(confirmState.action)}
 title={
 confirmState.action ==="archive"
 ? `Archive ${selectedCount} Employee${selectedCount !== 1 ?"s" : ""}?`
 : confirmState.action ==="restore"
 ? `Restore ${selectedCount} Employee${selectedCount !== 1 ?"s" : ""}?`
 : confirmState.action ==="activate"
 ? `Activate ${selectedCount} Account${selectedCount !== 1 ?"s" : ""}?`
 : `Deactivate ${selectedCount} Account${selectedCount !== 1 ?"s" : ""}?`
 }
 description={
 confirmState.action ==="archive"
 ?"This will soft-archive the selected employees and deactivate their accounts. This action can be reversed."
 : confirmState.action ==="restore"
 ?"This will restore the selected archived employee records."
 : confirmState.action ==="activate"
 ?"The selected employees' accounts will be set to active."
 :"The selected employees' accounts will be deactivated. They will no longer be able to log in."
 }
 confirmLabel={
 confirmState.action ==="archive" ?"Archive" :
 confirmState.action ==="restore" ?"Restore" :
 confirmState.action ==="activate" ?"Activate" :"Deactivate"
 }
 dangerous={confirmState.action ==="archive"}
 />
 <MetricBreakdownDialog open={completionOpen} onOpenChange={setCompletionOpen} spec={completionSpec} />
 </div>
 );
}

export default EmployeesPage;
