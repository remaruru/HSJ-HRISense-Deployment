import { useState, useEffect, useRef } from"react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from"framer-motion";
import { Search, Loader2, FileText, User, Archive, Folder } from"lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { personProfilePath } from "@/lib/profileLinks";
import { usePermission } from "@/hooks/usePermission";
import { api } from "@/services/api";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
 employees: any[];
 archivedEmployees: any[];
 drafts: any[];
}

const STATIC_MODULES = [
 { label:"Dashboard", href: "/dashboard", desc:"Overview and metrics" },
 { label:"Employees Directory", href: "/employees", desc:"View all active employees" },
 { label:"Add Employee", href: "/employees/onboard", desc:"Onboard a new employee", requiresHR: true },
 { label:"Draft Employees", href: "/employees/drafts", desc:"Manage saved onboarding drafts", requiresHR: true },
 { label:"Archived Employees", href: "/employees/archived", desc:"View inactive and resigned employees", requiresHR: true },
 { label:"Org Chart", href: "/employees/org-chart", desc:"Organizational hierarchy visualization" },
 { label:"Recruitment", href: "/recruitment", desc:"Applicant tracking and hiring" },
 { label:"Attendance Monitoring", href: "/attendance", desc:"Daily time records" },
 { label:"Work Schedule", href: "/attendance/schedule", desc:"Shift scheduling" },
 { label:"Leave Requests", href: "/leave", desc:"Manage and approve time off" },
 { label:"Evaluations", href: "/performance", desc:"Performance reviews and goals" },
 { label:"Training & Seminars", href: "/training", desc:"Employee development" },
 { label:"Awards & Recognition", href: "/awards", desc:"Nominations, voting and recognition awards" },
 { label:"Yearly Achievements", href: "/achievements", desc:"Hospicio's achievements, year by year" },
 { label:"Health & Compliance", href: "/compliance", desc:"Medical records and safety" },
 { label:"Reports", href: "/reports", desc:"System analytics and exports", requiresHR: true },
 { label: "AI Assistance", href: "/ai-assistance", desc: "Ask about HRISense and your records" },
 { label:"Settings", href: "/settings", desc:"System configuration" },
];

export function GlobalSearch() {
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState("");
 const debouncedQuery = useDebounce(query, 300);
 const [results, setResults] = useState<SearchResult>({ employees: [], archivedEmployees: [], drafts: [] });
 const [isLoading, setIsLoading] = useState(false);
 const [selectedIndex, setSelectedIndex] = useState(0);
 const inputRef = useRef<HTMLInputElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 
 const navigate = useNavigate();
 const { user } = useAuth();
 const { hasPermission } = usePermission();

 const isFullHR = user?.permissionTier ==="FULL";

 const moduleResults = STATIC_MODULES.filter((m) => {
 if (m.requiresHR && !isFullHR) return false;
 return m.label.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
 m.desc.toLowerCase().includes(debouncedQuery.toLowerCase());
 }).slice(0, 5);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.key ==="k") {
 e.preventDefault();
 inputRef.current?.focus();
 setIsOpen(true);
 }
 if (e.key ==="Escape") {
 setIsOpen(false);
 inputRef.current?.blur();
 }
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, []);

 useEffect(() => {
 const handleClickOutside = (e: MouseEvent) => {
 if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
 setIsOpen(false);
 }
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 useEffect(() => {
 if (!debouncedQuery || debouncedQuery.length < 2) {
 setResults({ employees: [], archivedEmployees: [], drafts: [] });
 setIsLoading(false);
 return;
 }

 const controller = new AbortController();
 
 const fetchResults = async () => {
 setIsLoading(true);
 try {
 const res = await api.get(`/search?q=${encodeURIComponent(debouncedQuery)}`, {
 signal: controller.signal
 });
 setResults(res.data);
 } catch (err: any) {
 if (err.name !== 'CanceledError' && err.message !== 'canceled') {
 console.error("Search failed", err);
 }
 } finally {
 setIsLoading(false);
 }
 };

 fetchResults();

 return () => controller.abort();
 }, [debouncedQuery]);

 const flatResults = [
 ...moduleResults.map(m => ({ type: 'module', data: m })),
 ...results.employees.map(e => ({ type: 'employee', data: e })),
 ...results.drafts.map(d => ({ type: 'draft', data: d })),
 ...results.archivedEmployees.map(a => ({ type: 'archived', data: a }))
 ];

 useEffect(() => {
 setSelectedIndex(0);
 }, [debouncedQuery, results]);

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (!isOpen) return;
 if (e.key ==="ArrowDown") {
 e.preventDefault();
 setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
 } else if (e.key ==="ArrowUp") {
 e.preventDefault();
 setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
 } else if (e.key ==="Enter" && flatResults[selectedIndex]) {
 e.preventDefault();
 handleSelect(flatResults[selectedIndex]);
 }
 };

 const handleSelect = (item: any) => {
 setIsOpen(false);
 setQuery("");
 if (item.type === 'module') {
 navigate({ to: item.data.href as any });
 } else if (item.type === 'employee' || item.type === 'archived') {
 navigate({ to: personProfilePath(user, item.data.id) as any });
 } else if (item.type === 'draft') {
 navigate({ to: "/employees/onboard" as any, search: { draftId: item.data.id } as any });
 }
 };

 return (
 <div className="relative flex-1 max-w-md hidden sm:block" ref={containerRef}>
 <motion.div
 className={cn(
"relative hrisense-control flex items-center overflow-hidden",
 isOpen ?"border-ring ring-1 ring-ring shadow-[4px_4px_0_var(--ring)]" : ""
 )}
 >
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={(e) => {
 setQuery(e.target.value);
 setIsOpen(true);
 }}
 onFocus={() => setIsOpen(true)}
 onKeyDown={handleKeyDown}
 placeholder="Search employees, reports, modules… (⌘K)"
 className={cn(
"w-full pl-9 pr-12 py-2 text-[15px] bg-transparent",
"focus:outline-none text-foreground placeholder:text-muted-foreground"
 )}
 />
 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
 {isLoading ? (
 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
 ) : (
 <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
 <span className="text-xs">⌘</span>K
 </kbd>
 )}
 </div>
 </motion.div>

 <AnimatePresence>
 {isOpen && query.length >= 2 && (
 <motion.div
 initial={{ opacity: 0, y: 4 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 4 }}
 className="absolute top-full left-0 right-0 mt-2 z-50 hrisense-overlay max-h-[70vh] overflow-y-auto"
 >
 <div className="p-2 space-y-1">
 {flatResults.length === 0 && !isLoading && (
 <div className="p-4 text-center text-sm text-muted-foreground">
 No matching employees, pages, drafts, or modules were found.
 </div>
 )}

 {/* Modules Group */}
 {moduleResults.length > 0 && (
 <div className="mb-2">
 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Modules and Pages</div>
 {moduleResults.map((m, idx) => {
 const globalIdx = flatResults.findIndex(r => r.type === 'module' && r.data === m);
 return (
 <button
 key={m.label}
 onClick={() => handleSelect({ type: 'module', data: m })}
 className={cn(
"w-full flex flex-col items-start px-3 py-2 rounded-lg text-sm text-left transition-colors",
 globalIdx === selectedIndex ?"bg-muted" :"hover:bg-muted/50"
 )}
 >
 <div className="flex items-center gap-2 font-medium text-foreground">
 <Folder className="h-4 w-4 text-primary-500" /> {m.label}
 </div>
 <div className="text-[11px] text-muted-foreground pl-6">{m.desc}</div>
 </button>
 );
 })}
 </div>
 )}

 {/* Employees Group */}
 {results.employees.length > 0 && (
 <div className="mb-2">
 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Employees</div>
 {results.employees.map((emp) => {
 const globalIdx = flatResults.findIndex(r => r.type === 'employee' && r.data === emp);
 return (
 <button
 key={emp.id}
 onClick={() => handleSelect({ type: 'employee', data: emp })}
 className={cn(
"w-full flex flex-col items-start px-3 py-2 rounded-lg text-sm text-left transition-colors",
 globalIdx === selectedIndex ?"bg-muted" :"hover:bg-muted/50"
 )}
 >
 <div className="flex justify-between w-full">
 <span className="font-medium text-foreground flex items-center gap-2">
 <User className="h-4 w-4 text-primary-600 dark:text-primary-300" /> {emp.firstName} {emp.lastName}
 </span>
 <span className="text-[10px] text-muted-foreground">{emp.employeeNumber}</span>
 </div>
 <div className="text-[11px] text-muted-foreground pl-6 truncate">
 {emp.jobRole?.title} • {emp.unit?.name || 'Unassigned'}
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* Drafts Group */}
 {results.drafts.length > 0 && (
 <div className="mb-2">
 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Draft Employees</div>
 {results.drafts.map((draft) => {
 const globalIdx = flatResults.findIndex(r => r.type === 'draft' && r.data === draft);
 return (
 <button
 key={draft.id}
 onClick={() => handleSelect({ type: 'draft', data: draft })}
 className={cn(
"w-full flex flex-col items-start px-3 py-2 rounded-lg text-sm text-left transition-colors",
 globalIdx === selectedIndex ?"bg-muted" :"hover:bg-muted/50"
 )}
 >
 <div className="flex justify-between w-full">
 <span className="font-medium text-foreground flex items-center gap-2">
 <FileText className="h-4 w-4 text-status-warning-foreground" /> {draft.displayName || 'Untitled Draft'}
 </span>
 <span className="text-[10px] text-status-warning-foreground bg-status-warning-surface px-1.5 rounded">{draft.stepName}</span>
 </div>
 <div className="text-[11px] text-muted-foreground pl-6 truncate">
 {draft.email} • Updated {new Date(draft.updatedAt).toLocaleDateString()}
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* Archived Group */}
 {results.archivedEmployees.length > 0 && (
 <div className="mb-2">
 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Archived Employees</div>
 {results.archivedEmployees.map((emp) => {
 const globalIdx = flatResults.findIndex(r => r.type === 'archived' && r.data === emp);
 return (
 <button
 key={emp.id}
 onClick={() => handleSelect({ type: 'archived', data: emp })}
 className={cn(
"w-full flex flex-col items-start px-3 py-2 rounded-lg text-sm text-left transition-colors opacity-75 hover:opacity-100",
 globalIdx === selectedIndex ?"bg-muted" :"hover:bg-muted/50"
 )}
 >
 <div className="flex justify-between w-full">
 <span className="font-medium text-foreground flex items-center gap-2">
 <Archive className="h-4 w-4 text-muted-foreground" /> {emp.firstName} {emp.lastName}
 </span>
 <span className="text-[10px] text-muted-foreground">{emp.employeeNumber}</span>
 </div>
 <div className="text-[11px] text-muted-foreground pl-6 truncate">
 {emp.jobRole?.title} • {emp.unit?.name || 'Unassigned'}
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
