import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";

export interface RoleOption {
  id: string;
  title: string;
  unitId: string | null;
  departmentId: string | null;
}

/** "Kitchen-Staffs " → "kitchen staff" — the same comparison the API makes. */
export const normalizeRoleTitle = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)).join(" ");

/**
 * A position that does not exist yet becomes a new Job Role — with the
 * organisational details a role needs (unit, optional department, the position
 * it reports to, staff or supervisory). A title matching an existing role
 * (ignoring case, spacing, punctuation and a plural "s") is offered instead of
 * creating a duplicate; the API refuses duplicates too.
 */
export function NewPositionDialog({
  open,
  onOpenChange,
  roles,
  units,
  onCreated,
  onUseExisting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roles: RoleOption[];
  units: Array<{ id: string; name: string }>;
  onCreated: (role: RoleOption) => void;
  onUseExisting: (roleId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [parentId, setParentId] = useState("");
  const [tier, setTier] = useState<"STANDARD" | "SUPERVISOR">("STANDARD");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setUnitId("");
    setDepartmentId("");
    setParentId("");
    setTier("STANDARD");
  }, [open]);

  useEffect(() => {
    if (!unitId) return setDepartments([]);
    api.get("/departments", { params: { unitId } }).then((r) => setDepartments(r.data?.data ?? [])).catch(() => setDepartments([]));
  }, [unitId]);

  const twin = useMemo(() => {
    const n = normalizeRoleTitle(title);
    return n.length >= 2 ? roles.find((r) => normalizeRoleTitle(r.title) === n) ?? null : null;
  }, [title, roles]);
  const similar = useMemo(() => {
    const n = normalizeRoleTitle(title);
    if (twin || n.length < 3) return [];
    return roles.filter((r) => normalizeRoleTitle(r.title).includes(n) || n.includes(normalizeRoleTitle(r.title))).slice(0, 4);
  }, [title, roles, twin]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post("/job-roles", { title: title.trim(), unitId, departmentId: departmentId || null, parentJobRoleId: parentId || null, permissionTier: tier });
      const role = r.data?.data;
      toast.success(`Position “${role.title}” created.`);
      onCreated({ id: role.id, title: role.title, unitId: role.unitId, departmentId: role.departmentId ?? null });
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The position could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New position</DialogTitle>
          <DialogDescription>Only for a position that does not exist yet. It becomes a job role in Hospicio's structure, usable everywhere in HRISense.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Position title <span className="text-status-danger-foreground">*</span></span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3" placeholder="e.g. Nutritionist" />
          </label>
          {twin && (
            <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2 text-xs text-status-warning-foreground">
              “{twin.title}” already exists.{" "}
              <button type="button" className="font-semibold underline" onClick={() => { onUseExisting(twin.id); onOpenChange(false); }}>Use “{twin.title}”</button>
            </div>
          )}
          {similar.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Similar existing positions:{" "}
              {similar.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <button type="button" className="font-semibold text-primary-700 underline dark:text-primary-300" onClick={() => { onUseExisting(r.id); onOpenChange(false); }}>{r.title}</button>
                </span>
              ))}
            </p>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Unit <span className="text-status-danger-foreground">*</span></span>
            <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setDepartmentId(""); }} className="h-10 w-full rounded-lg border border-border bg-background px-2">
              <option value="">Select the unit…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          {departments.length > 0 && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold">Department (optional)</span>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-2">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Reports to (optional)</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-2">
              <option value="">Not set yet — HR confirms the reporting line later</option>
              {roles.filter((r) => !unitId || !r.unitId || r.unitId === unitId).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold">Level</legend>
            <div className="flex gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5"><input type="radio" checked={tier === "STANDARD"} onChange={() => setTier("STANDARD")} /> Staff</label>
              <label className="inline-flex items-center gap-1.5"><input type="radio" checked={tier === "SUPERVISOR"} onChange={() => setTier("SUPERVISOR")} /> Supervisory (has direct reports)</label>
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !title.trim() || !unitId || Boolean(twin)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create position</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
