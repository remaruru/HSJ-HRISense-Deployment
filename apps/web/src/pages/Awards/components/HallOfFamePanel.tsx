import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type HallOfFameRow } from "@/services/awards.service";

/**
 * Hall of Fame: the official record of employees who were conferred the award.
 * HR records it — no formula decides it. Awardees are not nominees for the
 * Vincentian, Louisian or Special Awards, but they still vote.
 */
export function HallOfFamePanel() {
  const [rows, setRows] = useState<HallOfFameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Array<{ id: string; label: string }>>([]);
  const [form, setForm] = useState({ employeeId: "", awardYear: String(new Date().getFullYear()), title: "Hall of Fame Award", conferredOn: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AwardsService.hallOfFame().then(setRows).catch((err) => setError(getApiErrorMessage(err, "Hall of Fame records could not be loaded.")));
  }, []);
  useEffect(() => {
    load();
    api.get("/employees", { params: { limit: 500, isArchived: "all" } })
      .then((r) => setPeople((r.data?.data ?? []).map((x: any) => ({ id: x.id, label: `${`${x.firstName} ${x.lastName}`.trim()} — ${x.jobRole?.title ?? ""}` })).sort((a: any, b: any) => a.label.localeCompare(b.label))))
      .catch(() => setPeople([]));
  }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      setRows(await AwardsService.recordHallOfFame({ ...form, awardYear: Number(form.awardYear), conferredOn: form.conferredOn || undefined, notes: form.notes || undefined }));
      toast.success("Hall of Fame record saved.");
      setForm({ ...form, employeeId: "", notes: "", conferredOn: "" });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The record could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Record employees already conferred the Hall of Fame Award. They are then excluded as nominees from the Vincentian, Louisian and Special Awards, and still vote. HRISense never decides who enters the Hall of Fame.
      </p>
      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs font-semibold">Employee</span>
          <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2">
            <option value="">Select…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold">Award year</span>
          <input type="number" value={form.awardYear} onChange={(e) => setForm({ ...form, awardYear: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold">Date conferred</span>
          <input type="date" value={form.conferredOn} onChange={(e) => setForm({ ...form, conferredOn: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold">Award title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2" />
        </label>
        <label className="space-y-1 sm:col-span-2 lg:col-span-4">
          <span className="block text-xs font-semibold">Notes (optional)</span>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2" />
        </label>
        <div className="flex items-end">
          <Button onClick={add} disabled={busy || !form.employeeId || !form.awardYear} className="w-full gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Record</Button>
        </div>
      </div>
      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !rows ? (
        <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No Hall of Fame records yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <span className="font-semibold text-foreground">{r.employee.fullName}</span>
                <span className="text-muted-foreground"> — {r.title}, {r.awardYear}{r.conferredOn ? ` (conferred ${new Date(r.conferredOn).toLocaleDateString()})` : ""}</span>
                {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
              </span>
              <Button size="xs" variant="ghost" className="text-status-danger-foreground" onClick={async () => {
                if (!window.confirm(`Remove ${r.employee.fullName}'s ${r.awardYear} Hall of Fame record? Only do this to correct a mistake.`)) return;
                try { setRows(await AwardsService.removeHallOfFame(r.id)); toast.success("Record removed."); } catch (err) { toast.error(getApiErrorMessage(err, "The record could not be removed.")); }
              }}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
