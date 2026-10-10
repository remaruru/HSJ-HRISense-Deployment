import { useState, useEffect } from"react";
import { api } from "@/services/api";

interface OrgSelectorProps {
 unitId: string;
 departmentId: string;
 jobRoleId: string;
 onChange: (values: { unitId: string; departmentId: string; jobRoleId: string }) => void;
 disabled?: boolean;
 unitRequired?: boolean;
 roleRequired?: boolean;
 isFilter?: boolean; // If true, includes"All Units" /"All Job Roles" options
 layout?:"grid" |"vertical";
}

export function OrgSelector({
 unitId,
 departmentId,
 jobRoleId,
 onChange,
 disabled = false,
 unitRequired = true,
 roleRequired = true,
 isFilter = false,
 layout ="grid",
}: OrgSelectorProps) {
 const [units, setUnits] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [jobRoles, setJobRoles] = useState<any[]>([]);
 const [loadingUnits, setLoadingUnits] = useState(true);
 const [loadingDepts, setLoadingDepts] = useState(false);
 const [loadingRoles, setLoadingRoles] = useState(false);

 // 1. Fetch Units on mount
 useEffect(() => {
 let isMounted = true;
 setLoadingUnits(true);
 api.get("/employees/units")
 .then((res) => {
 if (isMounted) setUnits(res.data.data || []);
 })
 .catch((err) => console.error("Failed to fetch units:", err))
 .finally(() => {
 if (isMounted) setLoadingUnits(false);
 });
 return () => { isMounted = false; };
 }, []);

 // 2. Fetch Departments & Job Roles when Unit changes
 useEffect(() => {
 if (!unitId) {
 setDepartments([]);
 setJobRoles([]);
 return;
 }

 let isMounted = true;
 setLoadingDepts(true);
 setLoadingRoles(true);

 Promise.all([
 api.get("/departments", { params: { unitId } }).catch(() => ({ data: { data: [] } })),
 api.get("/employees/job-roles", { params: { unitId, departmentId: departmentId || undefined } }).catch(() => ({ data: { data: [] } })),
 ]).then(([deptRes, roleRes]) => {
 if (!isMounted) return;
 setDepartments(deptRes.data.data || []);
 setJobRoles(roleRes.data.data || []);
 }).finally(() => {
 if (isMounted) {
 setLoadingDepts(false);
 setLoadingRoles(false);
 }
 });

 return () => { isMounted = false; };
 }, [unitId, departmentId]);

 // Handlers
 const handleUnitChange = (newUnitId: string) => {
 onChange({
 unitId: newUnitId,
 departmentId: "", // Clear invalid department
 jobRoleId: "", // Clear invalid job role
 });
 };

 const handleDeptChange = (newDeptId: string) => {
 onChange({
 unitId,
 departmentId: newDeptId,
 jobRoleId: "", // Clear invalid job role when dept changes
 });
 };

 const handleRoleChange = (newRoleId: string) => {
 onChange({
 unitId,
 departmentId,
 jobRoleId: newRoleId,
 });
 };

 // Form mode matches the other form controls (44px, soft border, brand focus);
 // filter mode stays compact so it fits in toolbars.
 const selectClass = [
 "w-full text-sm rounded-xl border border-input bg-surface text-foreground px-3.5",
 "transition-colors hover:border-primary-300 dark:hover:border-primary-900",
 "focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500",
 "disabled:bg-surface-2 disabled:text-muted-foreground disabled:cursor-not-allowed",
 isFilter ? "h-10" : "h-11",
 ].join(" ");
 const labelClass = isFilter
 ? "text-xs font-semibold text-secondary-foreground block mb-1"
 : "text-sm font-medium text-foreground block mb-1.5";

 const containerClass = layout ==="grid"
 ?"grid grid-cols-1 md:grid-cols-3 gap-4"
 :"space-y-4";

 return (
 <div className={containerClass}>
 {/* ── 1. Unit Selector ─────────────────────────────────────────────── */}
 <div>
 <label className={labelClass}>
 Unit {unitRequired && !isFilter && <span className="text-status-danger-foreground">*</span>}
 </label>
 <select
 value={unitId}
 disabled={disabled || loadingUnits}
 onChange={(e) => handleUnitChange(e.target.value)}
 className={selectClass}
 >
 <option value="">{isFilter ? "All units" : "Select unit…"}</option>
 {units.map((u) => (
 <option key={u.id} value={u.id}>
 {u.name}
 </option>
 ))}
 </select>
 </div>

 {/* ── 2. Department Selector (Hidden when no departments exist for Unit) ── */}
 {unitId && departments.length > 0 && (
 <div>
 <label className={labelClass}>
 Department
 </label>
 <select
 value={departmentId}
 disabled={disabled || loadingDepts}
 onChange={(e) => handleDeptChange(e.target.value)}
 className={selectClass}
 >
 <option value="">{isFilter ? "All departments" : "No department (optional)"}</option>
 {departments.map((d) => (
 <option key={d.id} value={d.id}>
 {d.name}
 </option>
 ))}
 </select>
 </div>
 )}

 {/* ── 3. Unit-Specific Job Role Selector ──────────────────────────── */}
 <div>
 <label className={labelClass}>
 Job Role {roleRequired && !isFilter && <span className="text-status-danger-foreground">*</span>}
 </label>
 <select
 value={jobRoleId}
 disabled={disabled || !unitId || loadingRoles}
 onChange={(e) => handleRoleChange(e.target.value)}
 className={selectClass}
 >
 {!unitId ? (
 <option value="">Choose a unit first</option>
 ) : (
 <>
 <option value="">{isFilter ? "All job roles" : "Select job role…"}</option>
 {jobRoles.map((r) => (
 <option key={r.id} value={r.id}>
 {r.title}
 </option>
 ))}
 </>
 )}
 </select>
 {unitId && jobRoles.length === 0 && !loadingRoles && (
 <p className="text-xs text-status-warning-foreground mt-1.5">No job roles configured for this unit.</p>
 )}
 </div>
 </div>
 );
}
