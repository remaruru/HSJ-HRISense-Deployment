import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";

interface PersonRef {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobRoleTitle: string;
  unitName: string;
  isArchived?: boolean;
}

interface OversightRelationship {
  id: string;
  overseer: PersonRef;
  target: { kind: "EMPLOYEE"; employee: PersonRef } | { kind: "JOB_ROLE"; jobRole: { id: string; title: string } | null };
  covers: PersonRef[];
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string } | null;
  unit?: { name: string } | null;
}

/**
 * HR manages additional oversight: an actual employee (the overseer) also
 * oversees one employee, or everyone holding a job role. The chart shows it as
 * a dashed line; the employee's branch and immediate supervisor never change,
 * and no access follows from it.
 */
export function AdditionalOversightDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an add / remove so the chart can redraw its lines. */
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<OversightRelationship[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overseerId, setOverseerId] = useState("");
  const [kind, setKind] = useState<"EMPLOYEE" | "JOB_ROLE">("JOB_ROLE");
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!open) return;
    setOverseerId("");
    setTargetId("");
    setLoading(true);
    Promise.all([
      api.get("/employees/additional-oversight"),
      api.get("/employees", { params: { limit: 500, isArchived: "false" } }),
      api.get("/employees/job-roles"),
    ])
      .then(([o, e, r]) => {
        setRows(o.data?.data ?? []);
        setEmployees(e.data?.data ?? []);
        setRoles(((r.data?.data ?? []) as Array<{ id: string; title: string }>).slice().sort((a, b) => a.title.localeCompare(b.title)));
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Additional oversight could not be loaded.")))
      .finally(() => setLoading(false));
  }, [open]);

  const people = useMemo(
    () => employees.slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
    [employees]
  );
  const label = (e: EmployeeOption) => `${`${e.firstName} ${e.lastName}`.trim()} — ${e.jobRole?.title ?? "No job role"}${e.unit ? ` · ${e.unit.name}` : ""}`;

  const grouped = useMemo(() => {
    const m = new Map<string, { overseer: PersonRef; items: OversightRelationship[] }>();
    for (const r of rows) {
      const g = m.get(r.overseer.id) ?? { overseer: r.overseer, items: [] };
      g.items.push(r);
      m.set(r.overseer.id, g);
    }
    return [...m.values()];
  }, [rows]);

  const run = async (fn: () => Promise<any>, message: string) => {
    setBusy(true);
    try {
      const res = await fn();
      setRows(res.data?.data ?? []);
      toast.success(message);
      onChanged();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The change could not be saved."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!overseerId || !targetId) return;
    const ok = await run(
      () => api.post("/employees/additional-oversight", { overseerId, ...(kind === "EMPLOYEE" ? { overseenEmployeeId: targetId } : { overseenJobRoleId: targetId }) }),
      "Additional oversight added."
    );
    if (ok) setTargetId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Additional Oversight</DialogTitle>
          <DialogDescription>
            Someone who also oversees people outside their normal branch. The employee stays in their own branch and keeps their immediate supervisor.
            This is shown on the Org Chart only — it does not change leave approval, evaluations, attendance, schedules, My Team or any other access.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>
        ) : (
          <div className="space-y-6 text-sm">
            <section className="space-y-3 rounded-xl border border-border p-4">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-foreground">Additional overseer</span>
                <select value={overseerId} onChange={(e) => setOverseerId(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                  <option value="">Select the employee…</option>
                  {people.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
                </select>
                <span className="block text-[11px] text-muted-foreground">Choose the actual person (for example, the specific Sister) — not everyone with that job role.</span>
              </label>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">Oversees</legend>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="oversight-kind" checked={kind === "JOB_ROLE"} onChange={() => { setKind("JOB_ROLE"); setTargetId(""); }} />
                    Everyone in a job role
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" name="oversight-kind" checked={kind === "EMPLOYEE"} onChange={() => { setKind("EMPLOYEE"); setTargetId(""); }} />
                    One employee
                  </label>
                </div>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                  <option value="">{kind === "JOB_ROLE" ? "Select the job role…" : "Select the employee…"}</option>
                  {kind === "JOB_ROLE"
                    ? roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)
                    : people.filter((e) => e.id !== overseerId).map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
                </select>
                {kind === "JOB_ROLE" && (
                  <span className="block text-[11px] text-muted-foreground">Covers whoever holds the job role, now and later — except anyone who already reports to the overseer.</span>
                )}
              </fieldset>

              <div className="flex justify-end">
                <Button size="sm" variant="create" onClick={add} disabled={busy || !overseerId || !targetId} className="gap-1">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="font-bold text-foreground">Current Additional Oversight ({rows.length})</h4>
              {grouped.length === 0 ? (
                <p className="text-xs text-muted-foreground">None yet.</p>
              ) : (
                <ul className="space-y-3">
                  {grouped.map((g) => (
                    <li key={g.overseer.id} className="rounded-xl border border-border p-3">
                      <p className="text-xs font-semibold text-foreground">
                        {g.overseer.fullName} <span className="font-normal text-muted-foreground">— {g.overseer.jobRoleTitle} · {g.overseer.unitName}</span>
                        {g.overseer.isArchived && <span className="ml-1 text-status-warning-foreground">(archived — not shown on the chart)</span>}
                      </p>
                      <ul className="mt-2 divide-y divide-border">
                        {g.items.map((r) => {
                          const what = r.target.kind === "EMPLOYEE" ? r.target.employee.fullName : r.target.jobRole?.title ?? "—";
                          const covers = r.covers.map((c) => c.fullName);
                          return (
                            <li key={r.id} className="flex items-start justify-between gap-2 py-1.5 text-xs">
                              <span className="text-foreground">
                                → {what}
                                <span className="text-muted-foreground">
                                  {r.target.kind === "JOB_ROLE"
                                    ? ` (job role · ${covers.length ? covers.join(", ") : "nobody holds it now"})`
                                    : ` (${r.target.employee.jobRoleTitle} · ${r.target.employee.unitName})`}
                                </span>
                              </span>
                              <Button
                                size="xs"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                  if (!confirm(`Remove ${g.overseer.fullName}'s additional oversight of ${what}?`)) return;
                                  void run(() => api.delete(`/employees/additional-oversight/${r.id}`), "Additional oversight removed.");
                                }}
                                className="gap-1 text-status-danger-foreground"
                                aria-label={`Remove ${g.overseer.fullName}'s additional oversight of ${what}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
