import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import {
  AWARD_ACTION_LABEL,
  AWARD_TYPE_LABEL,
  AwardsService,
  type AwardAction,
  type AwardDetail,
  type AwardResultRow,
  type AwardStatus,
  type AwardSummary,
} from "@/services/awards.service";
import { CreateAwardDialog } from "./CreateAwardDialog";

export const STATUS_TONE: Record<AwardStatus, string> = {
  DRAFT: "border-border bg-muted text-foreground",
  NOMINATION_OPEN: "border-status-info-border bg-status-info-surface text-status-info-foreground",
  NOMINATION_CLOSED: "border-border bg-muted text-foreground",
  VOTING_OPEN: "border-status-info-border bg-status-info-surface text-status-info-foreground",
  VOTING_CLOSED: "border-status-warning-border bg-status-warning-surface text-status-warning-foreground",
  DELIBERATION: "border-status-accent-border bg-status-accent-surface text-status-accent-foreground",
  VERIFIED: "border-status-accent-border bg-status-accent-surface text-status-accent-foreground",
  FINALIZED: "border-status-success-border bg-status-success-surface text-status-success-foreground",
};

export function OfficialBadge({ official }: { official: boolean }) {
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", official ? "border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200" : "border-border bg-muted text-muted-foreground")}>
      {official ? "Official" : "Custom"}
    </span>
  );
}

const CONFIRM_TEXT: Partial<Record<AwardAction, string>> = {
  OPEN_NOMINATION: "Open nominations? Every employee will be able to nominate.",
  CLOSE_NOMINATION: "Close nominations? No more nominations will be accepted.",
  OPEN_VOTING: "Open voting? Eligible employees will see their ballot.",
  CLOSE_VOTING: "Close voting? No more ballots will be accepted.",
  START_REVIEW: "Start the review? The automatic tally is frozen for the committee. Nobody becomes an awardee until it is verified and declared final.",
  VERIFY: "Mark the reviewed results as verified?",
  FINALIZE: "Declare these the final results? They become the permanent record and are shown to employees.",
};

/** HR: every award period, and one award's lifecycle, rules, nominations, turnout and review. */
export function AwardManager() {
  const [awards, setAwards] = useState<AwardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AwardsService.list().then(setAwards).catch((err) => setError(getApiErrorMessage(err, "Awards could not be loaded.")));
  }, []);
  useEffect(load, [load]);

  if (selected) return <AwardDetailView id={selected} onBack={() => { setSelected(null); load(); }} />;

  const years = [...new Set((awards ?? []).map((a) => a.year))].sort((a, b) => b - a);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Each award period is kept separately, so earlier years and quarters stay on record.</p>
        <Button onClick={() => setCreating(true)} className="gap-1"><Plus className="h-4 w-4" /> Create award</Button>
      </div>
      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !awards ? (
        <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>
      ) : awards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No awards yet. Create an Employee of the Quarter period or the year's recognition awards.</p>
      ) : (
        years.map((y) => (
          <section key={y} className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">{y}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {awards.filter((a) => a.year === y).map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setSelected(a.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/40">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{a.title} — {a.periodLabel}</span>
                      <OfficialBadge official={a.isOfficial} />
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      {a.usesVoting && <span className="text-muted-foreground">{a._count?.ballots ?? 0} ballots</span>}
                      <span className={cn("rounded-full border px-2 py-0.5 font-semibold", STATUS_TONE[a.status])}>{a.statusLabel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <CreateAwardDialog open={creating} onOpenChange={setCreating} onCreated={(id) => { load(); if (id) setSelected(id); }} />
    </div>
  );
}

function stagesOf(a: AwardDetail): AwardStatus[] {
  const s: AwardStatus[] = ["DRAFT"];
  if (a.usesNomination) s.push("NOMINATION_OPEN", "NOMINATION_CLOSED");
  if (a.usesVoting) s.push("VOTING_OPEN", "VOTING_CLOSED");
  if (a.requiresConfirmation) s.push("DELIBERATION", "VERIFIED");
  s.push("FINALIZED");
  return s;
}

const STAGE_LABEL: Record<AwardStatus, string> = {
  DRAFT: "Draft",
  NOMINATION_OPEN: "Nomination open",
  NOMINATION_CLOSED: "Nomination closed",
  VOTING_OPEN: "Voting open",
  VOTING_CLOSED: "Voting closed",
  DELIBERATION: "Review",
  VERIFIED: "Verified",
  FINALIZED: "Final",
};

function AwardDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [a, setA] = useState<AwardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Array<{ id: string; title: string }>>([]);
  const [draft, setDraft] = useState<{ eligibilityDate: string; titles: Record<string, string>; excluded: string[] } | null>(null);

  const load = useCallback(() => {
    setError(null);
    AwardsService.get(id).then(setA).catch((err) => setError(getApiErrorMessage(err, "The award could not be loaded.")));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    api.get("/employees/job-roles").then((r) => setRoles(((r.data?.data ?? []) as any[]).map((x) => ({ id: x.id, title: x.title })).sort((x, y) => x.title.localeCompare(y.title)))).catch(() => setRoles([]));
  }, []);
  useEffect(() => {
    if (a) setDraft({ eligibilityDate: a.eligibilityDate.slice(0, 10), titles: Object.fromEntries(a.categories.map((c) => [c.id, c.title])), excluded: a.excludedJobRoleIds });
  }, [a]);

  const run = async (fn: () => Promise<AwardDetail>, ok: string) => {
    setBusy(true);
    try {
      setA(await fn());
      toast.success(ok);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "That step could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  const step = (action: AwardAction) => {
    if (CONFIRM_TEXT[action] && !window.confirm(CONFIRM_TEXT[action])) return;
    void run(() => AwardsService.transition(id, action), `${AWARD_ACTION_LABEL[action]}: done.`);
  };

  if (error) return <div className="space-y-3"><Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="h-4 w-4" /> All awards</Button><LoadError message={error} onRetry={load} /></div>;
  if (!a || !draft) return <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  const stages = stagesOf(a);
  const at = stages.indexOf(a.status);
  const isDraft = a.status === "DRAFT";
  const canRename = isDraft && (a.type === "SPECIAL" || a.type === "CUSTOM");
  const canExclude = isDraft && (a.type === "EMPLOYEE_OF_THE_QUARTER" || a.type === "CUSTOM");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="h-4 w-4" /> All awards</Button>
        {isDraft && (
          <Button
            variant="ghost" size="sm" disabled={busy}
            className="gap-1 text-status-danger-foreground"
            onClick={async () => {
              if (!window.confirm("Delete this draft award? Only drafts with no nominations or votes can be deleted.")) return;
              try { await AwardsService.remove(id); toast.success("Draft deleted."); onBack(); } catch (err) { toast.error(getApiErrorMessage(err, "The draft could not be deleted.")); }
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete draft
          </Button>
        )}
      </div>

      <header className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-foreground font-heading">{a.title} — {a.periodLabel}</h2>
          <OfficialBadge official={a.isOfficial} />
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_TONE[a.status])}>{a.statusLabel}</span>
        </div>
        {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
        <ol className="flex flex-wrap gap-1.5 text-[11px]" aria-label="Stages">
          {stages.map((s, i) => (
            <li key={s} className={cn("rounded-full border px-2 py-0.5", i < at ? "border-status-success-border bg-status-success-surface text-status-success-foreground" : i === at ? "border-primary-500 bg-primary-50 font-bold text-primary-800 dark:bg-primary-900/40 dark:text-primary-200" : "border-border text-muted-foreground")}>
              {i + 1}. {STAGE_LABEL[s]}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          {a.actions.map((act) => (
            <Button key={act} size="sm" disabled={busy} variant={act === "FINALIZE" ? "create" : act === "RETURN_TO_REVIEW" ? "outline" : "primary"} onClick={() => step(act)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {AWARD_ACTION_LABEL[act]}
            </Button>
          ))}
          {a.status === "FINALIZED" && <span className="text-xs text-muted-foreground">Final results are a permanent record.</span>}
        </div>
      </header>

      {/* Rules */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2 text-sm">
        <h3 className="font-bold text-foreground">Rules for this period</h3>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <li>Stages: {[a.usesNomination && "nomination", a.usesVoting && "voting", a.requiresConfirmation && "review & verification"].filter(Boolean).join(" → ") || "HR review"} → final</li>
          {a.usesVoting && <li>Votes per voter: <strong>{a.totalVotesPerVoter}</strong> ({a.categories.map((c) => `${c.title} ${c.votesPerVoter}`).join(" · ")})</li>}
          <li>Results: {a.shortlistCount ? `Top ${a.shortlistCount} ${a.resultMode === "COMBINED" ? "overall" : "per category"}` : a.type === "LONGEVITY" ? "recommendations for HR to confirm" : "every nominee with a vote, ranked"}</li>
          <li>
            Service counted as of{" "}
            {isDraft ? (
              <input type="date" value={draft.eligibilityDate} onChange={(e) => setDraft({ ...draft, eligibilityDate: e.target.value })} className="rounded border border-border bg-background px-1 text-xs" />
            ) : (
              <strong>{new Date(a.eligibilityDate).toLocaleDateString()}</strong>
            )}
          </li>
          {a.minYears !== null && <li>Nominees: <strong>{a.minYears} or more</strong> completed years of service</li>}
          {a.maxYears !== null && <li>Nominees: <strong>{a.maxYears} or less</strong> completed years of service</li>}
          {a.excludeHallOfFame && <li>Hall of Fame awardees are not nominees (they still vote)</li>}
          {a.usesVoting && <li>Self-voting is allowed. Every nominee starts at 0 votes.</li>}
        </ul>
        {(a.excludedJobRoles.length > 0 || canExclude) && (
          <div className="pt-1 text-xs">
            <p className="font-semibold text-foreground">Positions that cannot be nominees (they may still vote):</p>
            {canExclude ? (
              <div className="mt-1 grid max-h-48 grid-cols-1 gap-x-4 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map((r) => (
                  <label key={r.id} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={draft.excluded.includes(r.id)} onChange={(e) => setDraft({ ...draft, excluded: e.target.checked ? [...draft.excluded, r.id] : draft.excluded.filter((x) => x !== r.id) })} />
                    {r.title}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{a.excludedJobRoles.join(", ")}</p>
            )}
          </div>
        )}
      </section>

      {/* Categories and who is on the ballot */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <h3 className="font-bold text-foreground">Categories</h3>
        <ul className="space-y-2">
          {a.categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-border p-3 text-xs space-y-1">
              {canRename ? (
                <label className="block">
                  <span className="sr-only">Title</span>
                  <input value={draft.titles[c.id] ?? ""} onChange={(e) => setDraft({ ...draft, titles: { ...draft.titles, [c.id]: e.target.value } })} className="h-8 w-full max-w-sm rounded-lg border border-border bg-background px-2 text-sm font-semibold" />
                </label>
              ) : (
                <p className="text-sm font-semibold text-foreground">{c.title}</p>
              )}
              <p className="text-muted-foreground">
                {a.usesVoting && <>{c.votesPerVoter} vote{c.votesPerVoter === 1 ? "" : "s"} per voter · </>}
                Nominees: {c.nomineeGroupName ?? (c.milestoneYears ? `${c.milestoneYears}+ completed years` : "organisation-wide")}
                {a.usesVoting && <> · Voters: {c.voterGroupName ?? "every employee"}</>}
              </p>
              {a.type !== "LONGEVITY" && (
                <details>
                  <summary className="cursor-pointer text-primary-700 dark:text-primary-300">
                    {a.usesNomination ? `${c.candidates.length} eligible nominee${c.candidates.length === 1 ? "" : "s"} (${c.nominationCount} nomination${c.nominationCount === 1 ? "" : "s"})` : `${c.candidates.length} eligible`}
                  </summary>
                  <p className="mt-1 text-foreground">{c.candidates.map((p) => p.fullName).join(", ") || "None"}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
        {isDraft && (canRename || canExclude || draft.eligibilityDate !== a.eligibilityDate.slice(0, 10)) && (
          <div className="flex justify-end">
            <Button
              size="sm" disabled={busy}
              onClick={() => run(() => AwardsService.update(id, {
                eligibilityDate: draft.eligibilityDate,
                ...(canExclude ? { excludedJobRoleIds: draft.excluded } : {}),
                ...(canRename ? { categories: a.categories.map((c) => ({ id: c.id, title: draft.titles[c.id] })) } : {}),
              }), "Draft saved.")}
            >
              Save draft changes
            </Button>
          </div>
        )}
      </section>

      {a.usesNomination && a.nominations.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <h3 className="font-bold text-foreground">Nominations ({a.nominations.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr><th className="py-1 pr-3">Category</th><th className="py-1 pr-3">Nominee</th><th className="py-1 pr-3">Nominated by</th><th className="py-1">Reason</th></tr></thead>
              <tbody className="divide-y divide-border">
                {a.nominations.map((n) => (
                  <tr key={n.id}>
                    <td className="py-1.5 pr-3">{a.categories.find((c) => c.id === n.categoryId)?.title}</td>
                    <td className="py-1.5 pr-3">{n.nominee.fullName}{!n.stillEligible && <span className="ml-1 text-status-warning-foreground">(not eligible: {n.ineligibleReason})</span>}</td>
                    <td className="py-1.5 pr-3">{n.nominatedBy.fullName}</td>
                    <td className="py-1.5 text-muted-foreground">{n.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {a.turnout && (a.status === "VOTING_OPEN" || a.status === "VOTING_CLOSED") && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm">
          Turnout: <strong>{a.turnout.ballots}</strong> of {a.turnout.eligibleVoters} eligible voters have submitted a ballot.
          {a.status === "VOTING_OPEN" && <span className="text-muted-foreground"> The tally is shown once voting closes.</span>}
        </p>
      )}

      {a.results && <ResultsReview award={a} busy={busy} onRun={run} />}
    </div>
  );
}

function ResultsReview({ award: a, busy, onRun }: { award: AwardDetail; busy: boolean; onRun: (fn: () => Promise<AwardDetail>, ok: string) => Promise<void> }) {
  const deciding = a.status === "DELIBERATION";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const blocks = useMemo(() => {
    const rows = a.results ?? [];
    if (a.resultMode === "COMBINED") return [{ title: a.shortlistCount ? `Top ${a.shortlistCount}` : "Results", rows }];
    return a.categories.map((c) => ({ title: c.title, rows: rows.filter((r) => r.categoryId === c.id) }));
  }, [a]);
  const pending = (a.results ?? []).filter((r) => r.shortlisted && r.decision === "PENDING").length;
  const longevity = a.type === "LONGEVITY";

  const decide = (r: AwardResultRow, decision: "CONFIRMED" | "NOT_AWARDED" | "PENDING") => {
    if (!r.id) return;
    const pl = placements[r.id];
    void onRun(() => AwardsService.decide(r.id!, { decision, placement: pl ? Number(pl) : undefined, note: notes[r.id!] }), "Decision recorded.");
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-foreground">{a.status === "VOTING_CLOSED" ? "Automatic tally (not yet reviewed)" : longevity ? "Recommendations for HR to confirm" : "Results"}</h3>
          <p className="text-xs text-muted-foreground">
            {longevity
              ? "HRISense recommends employees who reached each milestone in completed years and have not received it. HR confirms each one."
              : "Counted automatically from the ballots. Nobody is an awardee until the committee records its decision, verifies and declares the results final."}
          </p>
        </div>
        {deciding && pending > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => window.confirm(`Confirm all ${pending} undecided ${longevity ? "recommendations" : "shortlisted results"}${longevity ? "" : " in their ranked places"}?`) && onRun(() => AwardsService.confirmShortlist(a.id), "Confirmed.")}>
            Confirm all {pending} undecided
          </Button>
        )}
      </div>
      {blocks.map((b) => (
        <div key={b.title} className="space-y-1">
          <p className="text-sm font-bold text-foreground">{b.title}</p>
          {b.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{longevity ? "No one to recommend." : "No votes."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    {!longevity && <th className="py-1 pr-2">Rank</th>}
                    <th className="py-1 pr-2">Employee</th>
                    {longevity ? <th className="py-1 pr-2">Completed years</th> : <th className="py-1 pr-2">Votes</th>}
                    <th className="py-1 pr-2">Decision</th>
                    {deciding && <th className="py-1">Record</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {b.rows.map((r, i) => (
                    <tr key={r.id ?? `${r.employeeId}-${i}`} className={cn(!r.shortlisted && "opacity-60")}>
                      {!longevity && (
                        <td className="py-1.5 pr-2 align-top">
                          {r.rank}
                          {r.shortlisted && a.shortlistCount !== null && <span className="ml-1 rounded bg-primary-50 px-1 text-[10px] font-semibold text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">Top {a.shortlistCount}</span>}
                          {r.tiedAtCutoff && <span className="ml-1 rounded bg-status-warning-surface px-1 text-[10px] font-semibold text-status-warning-foreground">Tie at cutoff</span>}
                        </td>
                      )}
                      <td className="py-1.5 pr-2 align-top">
                        <span className="font-semibold text-foreground">{r.employee?.fullName}</span>
                        <span className="block text-muted-foreground">{r.employee?.jobRoleTitle} · {r.employee?.unitName}</span>
                      </td>
                      <td className="py-1.5 pr-2 align-top">{longevity ? r.completedYears : r.voteCount}</td>
                      <td className="py-1.5 pr-2 align-top">
                        {r.decision === "CONFIRMED" ? <span className="font-semibold text-status-success-foreground">Confirmed{r.placement ? ` · #${r.placement}` : ""}</span> : r.decision === "NOT_AWARDED" ? <span className="text-muted-foreground">Not awarded</span> : r.shortlisted ? <span className="text-status-warning-foreground">Pending</span> : <span className="text-muted-foreground">Outside the shortlist</span>}
                        {r.note && <span className="block text-muted-foreground">{r.note}</span>}
                      </td>
                      {deciding && r.id && (
                        <td className="py-1.5 align-top">
                          <div className="flex flex-wrap items-center gap-1">
                            {!longevity && (
                              <input aria-label="Placement" placeholder={String(r.rank ?? "")} value={placements[r.id] ?? ""} onChange={(e) => setPlacements((p) => ({ ...p, [r.id!]: e.target.value }))} className="h-7 w-14 rounded border border-border bg-background px-1" inputMode="numeric" />
                            )}
                            <input aria-label="Note" placeholder="Note" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id!]: e.target.value }))} className="h-7 w-32 rounded border border-border bg-background px-1" />
                            <Button size="xs" variant="create" disabled={busy} onClick={() => decide(r, "CONFIRMED")}>Confirm</Button>
                            <Button size="xs" variant="outline" disabled={busy} onClick={() => decide(r, "NOT_AWARDED")}>Not awarded</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export const awardTypeLabel = (t: keyof typeof AWARD_TYPE_LABEL) => AWARD_TYPE_LABEL[t];
