import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type MyAwards } from "@/services/awards.service";

type NominationAward = MyAwards["nominationAwards"][number];

/**
 * Open nominations (Employee of the Quarter): any employee may nominate. Only
 * eligible people are offered — the right group, and not a position excluded
 * from nomination. "Nominated by" is recorded, as on Hospicio's paper form.
 */
export function AwardNominations({ award, onChanged }: { award: NominationAward; onChanged: () => void }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const nominate = async (categoryId: string) => {
    const nomineeId = choice[categoryId];
    if (!nomineeId) return;
    setBusy(categoryId);
    try {
      await AwardsService.nominate(categoryId, nomineeId, reason[categoryId]);
      toast.success("Nomination submitted.");
      setChoice((c) => ({ ...c, [categoryId]: "" }));
      setReason((r) => ({ ...r, [categoryId]: "" }));
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The nomination could not be submitted."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={`nom-${award.id}`} className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
      <header>
        <h3 id={`nom-${award.id}`} className="text-base font-bold text-foreground font-heading">{award.title} — {award.periodLabel}: nominations open</h3>
        {award.description && <p className="mt-0.5 text-xs text-muted-foreground">{award.description}</p>}
      </header>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {award.categories.map((c) => (
          <div key={c.id} className="rounded-xl border border-border p-3 space-y-2 text-sm">
            <p className="font-bold text-foreground">{c.title}</p>
            <p className="text-xs text-muted-foreground">Nominees come from {c.groupName}.</p>
            {c.options.length === 0 ? (
              <p className="text-xs text-muted-foreground">No eligible nominees in this group yet.</p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-foreground">Nominee</span>
                  <select
                    value={choice[c.id] ?? ""}
                    onChange={(e) => setChoice((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Select an employee…</option>
                    {c.options.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName} — {p.jobRoleTitle}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-foreground">Why (optional)</span>
                  <textarea
                    rows={2}
                    value={reason[c.id] ?? ""}
                    onChange={(e) => setReason((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => nominate(c.id)} disabled={!choice[c.id] || busy === c.id} className="gap-1">
                    {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Nominate
                  </Button>
                </div>
              </>
            )}
            {c.myNominations.length > 0 && (
              <p className="text-xs text-muted-foreground">You nominated: <span className="text-foreground">{c.myNominations.map((p) => p.fullName).join(", ")}</span></p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
