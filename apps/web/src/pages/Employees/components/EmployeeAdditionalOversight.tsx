import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadError } from "@/components/shared/LoadError";
import { InfoSection } from "@/components/ui/info-section";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";

interface Person {
  id: string;
  fullName: string;
  employeeNumber?: string;
  jobRoleTitle: string;
  unitName: string;
}

interface Summary {
  employee: Person;
  immediateSupervisorId: string | null;
  overseenBy: Array<{ relationshipId: string; viaJobRoleTitle: string | null; overseer: Person | null }>;
  oversees: Array<{
    relationshipId: string;
    target: { kind: "EMPLOYEE"; employee: Person } | { kind: "JOB_ROLE"; jobRole: { id: string; title: string } | null };
    covers: Person[];
  }>;
  directReports: Person[];
}

/**
 * Additional overseers (sub-supervisors) on the Employee Profile — HR only.
 * The Immediate Supervisor above stays the employee's normal supervisor; this
 * is a second, additional relationship (shown on the Org Chart as a dashed
 * line). Nothing else changes: branch, unit, role, department and every
 * module's access stay as they are.
 */
export function EmployeeAdditionalOversight({ employeeId, immediateSupervisorName }: { employeeId: string; immediateSupervisorName: string | null }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.get(`/employees/${employeeId}/additional-oversight`)
      .then((r) => setData(r.data?.data ?? null))
      .catch((err) => setError(getApiErrorMessage(err, "Additional overseers could not be loaded.")));
  }, [employeeId]);
  useEffect(load, [load]);

  const remove = async (relationshipId: string, label: string) => {
    if (!(await confirmAction({ title: `Remove ${label}?`, confirmLabel: "Remove", danger: true }))) return;
    try {
      await api.delete(`/employees/additional-oversight/${relationshipId}`);
      toast.success("Additional overseer removed.");
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "It could not be removed."));
    }
  };

  return (
    <InfoSection
      title="Additional Overseers (Sub-Supervisors)"
      action={
        <Button size="sm" variant="update" onClick={() => setAdding(true)} className="gap-1" disabled={!data}>
          <Plus className="h-4 w-4" /> Add additional overseer
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Someone who also oversees this employee — another Head, Sister, Supervisor or Coordinator. The Immediate Supervisor above does not change, nor does the employee's branch, unit or job role, and no extra leave, evaluation or attendance access comes with it.
      </p>
      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !data ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border-soft bg-muted/30 p-3 text-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Immediate supervisor (primary)</p>
              <p className="mt-1 font-semibold">{immediateSupervisorName ?? "None assigned"}</p>
            </div>
            <div className="rounded-xl border border-dashed border-primary-400 bg-primary-50/40 p-3 text-sm dark:border-primary-800 dark:bg-primary-900/20">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Additional overseer{data.overseenBy.length === 1 ? "" : "s"}</p>
              {data.overseenBy.length === 0 ? (
                <p className="mt-1 text-muted-foreground">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.overseenBy.map((o) => (
                    <li key={`${o.relationshipId}-${o.overseer?.id}`} className="flex items-start justify-between gap-2">
                      <span>
                        <span className="font-semibold">{o.overseer?.fullName ?? "—"}</span>
                        <span className="text-xs text-muted-foreground"> — {o.overseer?.jobRoleTitle}{o.viaJobRoleTitle ? ` (via job role ${o.viaJobRoleTitle})` : ""}</span>
                      </span>
                      {o.viaJobRoleTitle ? (
                        <span className="text-[11px] text-muted-foreground">Manage on the Org Chart</span>
                      ) : (
                        <Button size="xs" variant="ghost" className="text-status-danger-foreground" aria-label={`Remove ${o.overseer?.fullName}`} onClick={() => remove(o.relationshipId, `${o.overseer?.fullName} as additional overseer`)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.oversees.length > 0 && (
            <div className="text-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">This employee also oversees</p>
              <ul className="mt-1 space-y-1">
                {data.oversees.map((o) => (
                  <li key={o.relationshipId} className="flex items-start justify-between gap-2">
                    <span>
                      {o.target.kind === "EMPLOYEE" ? o.target.employee.fullName : `Everyone in ${o.target.jobRole?.title ?? "a job role"}`}
                      {o.target.kind === "JOB_ROLE" && <span className="text-xs text-muted-foreground"> ({o.covers.map((c) => c.fullName).join(", ") || "nobody holds it now"})</span>}
                    </span>
                    <Button size="xs" variant="ghost" className="text-status-danger-foreground" aria-label="Remove" onClick={() => remove(o.relationshipId, "this additional oversight")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {data && <AddOverseerDialog open={adding} onOpenChange={setAdding} summary={data} employeeId={employeeId} onSaved={(s) => { setData(s); }} />}
    </InfoSection>
  );
}

function AddOverseerDialog({ open, onOpenChange, summary, employeeId, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: Summary;
  employeeId: string;
  onSaved: (s: Summary) => void;
}) {
  const [people, setPeople] = useState<Array<{ id: string; label: string; name: string; role: string }>>([]);
  const [overseerId, setOverseerId] = useState("");
  const [include, setInclude] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOverseerId("");
    setInclude(false);
    setPicked(summary.directReports.map((r) => r.id));
    api.get("/employees", { params: { limit: 500, isArchived: "false" } })
      .then((r) => setPeople(((r.data?.data ?? []) as any[])
        .filter((x) => x.id !== employeeId)
        .map((x) => {
          const name = `${x.firstName} ${x.lastName}`.trim();
          return { id: x.id, name, role: x.jobRole?.title ?? "", label: `${name} — ${x.jobRole?.title ?? "No job role"}` };
        })
        .sort((a, b) => a.label.localeCompare(b.label))))
      .catch(() => setPeople([]));
  }, [open, employeeId, summary.directReports]);

  const overseer = people.find((p) => p.id === overseerId) ?? null;
  const reports = summary.directReports;
  const included = include ? reports.filter((r) => picked.includes(r.id)) : [];
  const alreadyPrimary = overseerId && overseerId === summary.immediateSupervisorId;
  const alreadyOverseer = summary.overseenBy.some((o) => o.overseer?.id === overseerId);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/employees/${employeeId}/additional-oversight`, { overseerId, includeReportIds: included.map((x) => x.id) });
      const { added, skipped, summary: next } = r.data?.data ?? {};
      toast.success(`Additional oversight added for ${added?.length ?? 0} employee${added?.length === 1 ? "" : "s"}.`);
      if (skipped?.length) toast.info(skipped.map((s: any) => s.reason).join(" "));
      onSaved(next);
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The additional overseer could not be added."));
    } finally {
      setBusy(false);
    }
  };

  const tree = useMemo(() => {
    if (!overseer) return null;
    return (
      <div className="overflow-x-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed [&>p]:whitespace-pre" aria-label="Preview">
        <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Preview — what will be saved</p>
        <p className="mt-1 font-semibold text-foreground">{overseer.name} <span className="font-normal text-muted-foreground">({overseer.role})</span></p>
        <p className="text-muted-foreground">└── Additional Oversight</p>
        <p className="text-foreground">{"    └── "}{summary.employee.fullName} <span className="text-muted-foreground">({summary.employee.jobRoleTitle})</span></p>
        {included.map((r, i) => (
          <p key={r.id} className="text-foreground">{"        "}{i === included.length - 1 ? "└── " : "├── "}{r.fullName} <span className="text-muted-foreground">({r.jobRoleTitle})</span></p>
        ))}
        <p className="mt-2 font-sans text-[11px] text-muted-foreground">
          {included.length
            ? `${1 + included.length} relationships. Everyone keeps their immediate supervisor and branch.`
            : `Only ${summary.employee.fullName}${reports.length ? " — not the people who report to them" : ""}.`}
        </p>
      </div>
    );
  }, [overseer, included, summary, reports.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Add additional overseer</DialogTitle>
          <DialogDescription>
            Who else oversees {summary.employee.fullName}? Their Immediate Supervisor stays as it is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Additional overseer</span>
            <select value={overseerId} onChange={(e) => setOverseerId(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2">
              <option value="">Select the person (e.g. the specific Sister)…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          {alreadyPrimary && <p className="text-xs text-status-warning-foreground">This person is already the Immediate Supervisor — that is the primary line, not additional oversight.</p>}
          {alreadyOverseer && <p className="text-xs text-status-warning-foreground">This person already oversees {summary.employee.fullName}.</p>}

          {reports.length > 0 && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-xs">
                <strong>{summary.employee.fullName}</strong> currently handles {reports.length} employee{reports.length === 1 ? "" : "s"}. Should the additional oversight include them too?
              </p>
              <div className="flex flex-col gap-1 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="include-reports" checked={!include} onChange={() => setInclude(false)} /> No — only {summary.employee.fullName}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="include-reports" checked={include} onChange={() => setInclude(true)} /> Yes — also include the employees they handle (choose below)
                </label>
              </div>
              {include && (
                <ul className="ml-5 space-y-0.5 text-xs">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} />
                        {r.fullName} <span className="text-muted-foreground">— {r.jobRoleTitle}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tree}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !overseerId || Boolean(alreadyPrimary)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

