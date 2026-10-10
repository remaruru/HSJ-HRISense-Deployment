import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type MyAwards } from "@/services/awards.service";

type VotingAward = MyAwards["votingAwards"][number];

/**
 * One award's ballot. Each category: choose up to its number of votes, all for
 * DIFFERENT nominees (yourself included, if you wish). The ballot is submitted
 * once — the server refuses a second one, so a refresh or another tab cannot
 * add votes. Nobody else ever sees your choices.
 */
export function AwardBallot({ award, onSubmitted }: { award: VotingAward; onSubmitted: () => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = award.categories.filter((c) => c.canVote && c.candidates.length > 0);
  const allowed = open.reduce((n, c) => n + c.votesPerVoter, 0);
  const used = Object.values(picked).reduce((n, l) => n + l.length, 0);

  const toggle = (categoryId: string, max: number, id: string) => {
    setPicked((prev) => {
      const cur = prev[categoryId] ?? [];
      if (cur.includes(id)) return { ...prev, [categoryId]: cur.filter((x) => x !== id) };
      if (max === 1) return { ...prev, [categoryId]: [id] };
      if (cur.length >= max) {
        toast.info(`You can choose ${max} different nominees here.`);
        return prev;
      }
      return { ...prev, [categoryId]: [...cur, id] };
    });
  };

  const submit = async () => {
    if (!used) return toast.error("Choose at least one nominee first.");
    const unused = allowed - used;
    if (!window.confirm(`Submit your ballot for ${award.title} — ${award.periodLabel}?${unused > 0 ? `\n\nYou still have ${unused} unused vote${unused === 1 ? "" : "s"}.` : ""}\n\nA ballot cannot be changed after it is submitted.`)) return;
    setBusy(true);
    try {
      await AwardsService.vote(award.id, Object.entries(picked).map(([categoryId, nomineeIds]) => ({ categoryId, nomineeIds })));
      toast.success("Your ballot has been submitted.");
      onSubmitted();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Your ballot could not be submitted."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`ballot-${award.id}`} className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`ballot-${award.id}`} className="text-base font-bold text-foreground font-heading">{award.title} — {award.periodLabel}</h3>
          {award.description && <p className="mt-0.5 text-xs text-muted-foreground">{award.description}</p>}
        </div>
        {award.submittedAt ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-surface px-2.5 py-1 text-xs font-semibold text-status-success-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ballot submitted {new Date(award.submittedAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            Votes used: {used} / {allowed} · remaining {Math.max(0, allowed - used)}
          </span>
        )}
      </header>

      <div className="space-y-4">
        {award.categories.map((c) => {
          const mine = picked[c.id] ?? [];
          const q = (filter[c.id] ?? "").trim().toLowerCase();
          const shown = q ? c.candidates.filter((p) => `${p.fullName} ${p.jobRoleTitle} ${p.unitName}`.toLowerCase().includes(q)) : c.candidates;
          return (
            <fieldset key={c.id} className="rounded-xl border border-border p-3 space-y-2">
              <legend className="px-1 text-sm font-bold text-foreground">{c.title}</legend>
              <p className="text-xs text-muted-foreground">
                {c.votesPerVoter === 1 ? "Choose 1" : `Choose ${c.votesPerVoter} different nominees`}
                {!award.submittedAt && c.canVote && c.candidates.length > 0 && <> · Selected <strong className="text-foreground">{mine.length} / {c.votesPerVoter}</strong></>}
                {c.groupName && <> · {c.groupName}</>}
              </p>

              {award.submittedAt ? (
                <p className="text-xs text-foreground">
                  Your vote{c.myVotes.length === 1 ? "" : "s"}: {c.myVotes.length ? c.myVotes.map((p) => p.fullName).join(", ") : <span className="text-muted-foreground">none</span>}
                </p>
              ) : !c.canVote ? (
                <p className="text-xs text-muted-foreground">Only the {c.groupName ?? "designated"} group votes in this category.</p>
              ) : c.candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No eligible nominees.</p>
              ) : (
                <>
                  {c.candidates.length > 12 && (
                    <label className="relative block">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Search nominees for {c.title}</span>
                      <input
                        value={filter[c.id] ?? ""}
                        onChange={(e) => setFilter((f) => ({ ...f, [c.id]: e.target.value }))}
                        placeholder="Search name, role or unit"
                        className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm"
                      />
                    </label>
                  )}
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-80 overflow-y-auto pr-1">
                    {shown.map((p) => {
                      const on = mine.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(c.id, c.votesPerVoter, p.id)}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                              on ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-900/30" : "border-border hover:bg-muted/50"
                            )}
                          >
                            <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary-600 bg-primary-600 text-white" : "border-border")}>
                              {on && <CheckCircle2 className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-foreground">{p.fullName}</span>
                              <span className="block text-muted-foreground">{p.jobRoleTitle} · {p.unitName}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </fieldset>
          );
        })}
      </div>

      {!award.submittedAt && open.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Your choices are private. A submitted ballot cannot be changed.</span>
          <Button onClick={submit} disabled={busy || used === 0} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />} Submit ballot
          </Button>
        </div>
      )}
    </section>
  );
}
