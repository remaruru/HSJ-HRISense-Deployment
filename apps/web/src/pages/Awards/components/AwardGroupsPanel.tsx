import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type AwardGroup } from "@/services/awards.service";
import { OfficialBadge } from "./AwardManager";

interface Opt { id: string; label: string }

/**
 * Voting / nominee groups: Hospicio's grouping words mapped by HR to CURRENT
 * job roles, units and employees. HRISense mapped only the words that clearly
 * name a current job role; the rest are listed for HR — never invented as roles.
 */
export function AwardGroupsPanel() {
  const [groups, setGroups] = useState<AwardGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [people, setPeople] = useState<Opt[]>([]);
  const [editing, setEditing] = useState<AwardGroup | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AwardsService.groups().then(setGroups).catch((err) => setError(getApiErrorMessage(err, "Groups could not be loaded.")));
  }, []);
  useEffect(() => {
    load();
    Promise.all([api.get("/employees/job-roles"), api.get("/employees/units"), api.get("/employees", { params: { limit: 500, isArchived: "false" } })])
      .then(([r, u, e]) => {
        setRoles((r.data?.data ?? []).map((x: any) => ({ id: x.id, label: x.title })).sort((a: Opt, b: Opt) => a.label.localeCompare(b.label)));
        setUnits((u.data?.data ?? []).map((x: any) => ({ id: x.id, label: x.name })));
        setPeople((e.data?.data ?? []).map((x: any) => ({ id: x.id, label: `${`${x.firstName} ${x.lastName}`.trim()} — ${x.jobRole?.title ?? ""}` })).sort((a: Opt, b: Opt) => a.label.localeCompare(b.label)));
      })
      .catch(() => toast.error("Job roles, units or employees could not be loaded."));
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      setGroups(await AwardsService.saveGroup(editing.id || null, editing));
      toast.success("Group saved.");
      setEditing(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The group could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = useMemo(() => {
    const m = new Map([...roles, ...units, ...people].map((o) => [o.id, o.label]));
    return (id: string) => m.get(id) ?? "—";
  }, [roles, units, people]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!groups) return <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  const checklist = (title: string, opts: Opt[], key: "jobRoleIds" | "unitIds") => (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="grid max-h-56 grid-cols-1 gap-x-4 overflow-y-auto rounded-lg border border-border p-2 text-xs sm:grid-cols-2">
        {opts.map((o) => (
          <label key={o.id} className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={editing![key].includes(o.id)}
              onChange={(e) => setEditing({ ...editing!, [key]: e.target.checked ? [...editing![key], o.id] : editing![key].filter((x) => x !== o.id) })}
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Who belongs to each Employee of the Quarter / Vincentian group. Employees match a group by job role, unit or by name. Only employees in a group vote in that group's Employee of the Quarter category.
      </p>
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-bold text-foreground">{g.name} <OfficialBadge official={g.isOfficial} /></p>
              <span className="text-xs text-muted-foreground">{g.memberCount} employee{g.memberCount === 1 ? "" : "s"}</span>
            </div>
            {g.hospicioTerms.length > 0 && <p className="text-xs text-muted-foreground">Hospicio grouping: {g.hospicioTerms.join(", ")}</p>}
            {g.unresolvedTerms.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-surface px-2 py-1 text-xs text-status-warning-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Not matched to a current job role — map by job role, unit or employee if they belong here: {g.unresolvedTerms.join(", ")}.
              </p>
            )}
            <p className="text-xs text-foreground">
              {[...g.jobRoleIds.map(nameOf), ...g.unitIds.map((u) => `Unit: ${nameOf(u)}`), ...g.employeeIds.map((e) => nameOf(e))].join(" · ") || <span className="text-muted-foreground">Nothing mapped yet.</span>}
            </p>
            {editing?.id === g.id ? (
              <div className="space-y-3 border-t border-border pt-3">
                {checklist("Job roles", roles, "jobRoleIds")}
                {checklist("Whole units", units, "unitIds")}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Individual employees</p>
                  <select
                    value=""
                    onChange={(e) => e.target.value && !editing.employeeIds.includes(e.target.value) && setEditing({ ...editing, employeeIds: [...editing.employeeIds, e.target.value] })}
                    className="h-8 w-full rounded-lg border border-border bg-background px-1 text-xs"
                  >
                    <option value="">Add an employee…</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <ul className="flex flex-wrap gap-1.5">
                    {editing.employeeIds.map((id) => (
                      <li key={id} className="rounded border border-border px-1.5 text-xs">
                        {nameOf(id)} <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => setEditing({ ...editing, employeeIds: editing.employeeIds.filter((x) => x !== id) })} className="ml-1 text-muted-foreground">×</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save group</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => setEditing({ ...g })}>Edit mapping</Button>
                {!g.isOfficial && (
                  <Button size="xs" variant="ghost" className="text-status-danger-foreground" onClick={async () => {
                    if (!window.confirm(`Delete the group “${g.name}”?`)) return;
                    try { setGroups(await AwardsService.deleteGroup(g.id)); toast.success("Group deleted."); } catch (err) { toast.error(getApiErrorMessage(err, "The group could not be deleted.")); }
                  }}>Delete</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
        <label className="space-y-1 text-xs">
          <span className="block font-semibold">New group (for custom awards)</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 w-64 rounded-lg border border-border bg-background px-2" />
        </label>
        <Button size="sm" variant="outline" disabled={!newName.trim()} className="gap-1" onClick={() => { setEditing({ id: "", name: newName.trim(), description: null, isOfficial: false, unitIds: [], departmentIds: [], jobRoleIds: [], employeeIds: [], memberCount: 0, hospicioTerms: [], unresolvedTerms: [] }); setNewName(""); }}>
          <Plus className="h-4 w-4" /> Add group
        </Button>
      </div>
      {editing && !editing.id && (
        <div className="rounded-2xl border border-primary-300 bg-surface p-4 space-y-3">
          <p className="font-bold text-foreground">{editing.name}</p>
          {checklist("Job roles", roles, "jobRoleIds")}
          {checklist("Whole units", units, "unitIds")}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={busy}>Create group</Button>
          </div>
        </div>
      )}
    </div>
  );
}
