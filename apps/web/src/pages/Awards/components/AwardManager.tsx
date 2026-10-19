import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Users } from "lucide-react";
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
  type AwardGroup,
  type AwardResultRow,
  type AwardStatus,
  type AwardSummary,
} from "@/services/awards.service";
import { CreateAwardDialog } from "./CreateAwardDialog";
import { PillPicker, StepList, type GuideStep } from "./AwardUi";

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

/** Each stage of an award, in plain words. */
const STAGE: Record<AwardStatus, { title: string; summary: string }> = {
  DRAFT: { title: "Check the draft", summary: "Rules and categories can still be changed. Employees don't see it yet." },
  NOMINATION_OPEN: { title: "Employees nominate", summary: "Employees nominate co-workers under My Awards." },
  NOMINATION_CLOSED: { title: "Nominations closed", summary: "No more nominations are accepted." },
  VOTING_OPEN: { title: "Employees vote", summary: "Employees vote under My Awards. Nobody sees who voted for whom." },
  VOTING_CLOSED: { title: "Votes counted", summary: "HRISense counts the votes automatically." },
  DELIBERATION: { title: "Committee decides", summary: "Confirm or reject each person on the shortlist." },
  VERIFIED: { title: "Results checked", summary: "A last look before announcing." },
  FINALIZED: { title: "Announced", summary: "Employees see the winners. Saved in Award History." },
};

const CONFIRM_TEXT: Partial<Record<AwardAction, string>> = {
  OPEN_NOMINATION: "Open nominations now? Every employee will see a Nominate form under My Awards.",
  CLOSE_NOMINATION: "Close nominations? Nobody can nominate after this.",
  OPEN_VOTING: "Open voting now? Employees will see their ballot under My Awards.",
  CLOSE_VOTING: "Close voting? Nobody can vote after this, and the votes are counted.",
  START_REVIEW: "Start the review? The vote count is frozen so the committee can decide. Nobody is a winner until you announce the results.",
  VERIFY: "Mark the results as checked?",
  FINALIZE: "Announce the final results? Employees will see the winners, and this becomes a permanent record.",
};

function stagesOf(a: { usesNomination: boolean; usesVoting: boolean; requiresConfirmation: boolean }): AwardStatus[] {
  const s: AwardStatus[] = ["DRAFT"];
  if (a.usesNomination) s.push("NOMINATION_OPEN", "NOMINATION_CLOSED");
  if (a.usesVoting) s.push("VOTING_OPEN", "VOTING_CLOSED");
  if (a.requiresConfirmation) s.push("DELIBERATION", "VERIFIED");
  s.push("FINALIZED");
  return s;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** HR: getting started, every award period, and one award run step by step. */
export function AwardManager({ onGoToGroups }: { onGoToGroups: () => void }) {
  const [awards, setAwards] = useState<AwardSummary[] | null>(null);
  const [groups, setGroups] = useState<AwardGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AwardsService.list().then(setAwards).catch((err) => setError(getApiErrorMessage(err, "Awards could not be loaded.")));
    AwardsService.groups().then(setGroups).catch(() => setGroups([]));
  }, []);
  useEffect(load, [load]);

  if (selected) return <AwardDetailView id={selected} onBack={() => { setSelected(null); load(); }} onGoToGroups={onGoToGroups} />;

  const emptyGroups = (groups ?? []).filter((g) => g.isOfficial && g.memberCount === 0);
  const groupsReady = groups !== null && emptyGroups.length === 0;
  const hasAwards = (awards?.length ?? 0) > 0;
  const years = [...new Set((awards ?? []).map((a) => a.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-3" aria-labelledby="awards-start">
        <h2 id="awards-start" className="text-base font-bold text-foreground font-heading">How to run an award</h2>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StartCard
            n={1}
            done={groupsReady}
            title="Put people in the groups"
            text={groups === null ? "Checking the groups…" : groupsReady ? "All of Hospicio's groups have people in them." : `${plural(emptyGroups.length, "group has", "groups have")} nobody in ${emptyGroups.length === 1 ? "it" : "them"} yet: ${emptyGroups.map((g) => g.name).join(", ")}.`}
            action={<Button size="sm" variant={groupsReady ? "outline" : "primary"} onClick={onGoToGroups} className="gap-1"><Users className="h-4 w-4" /> {groupsReady ? "View groups" : "Set up groups"}</Button>}
          />
          <StartCard
            n={2}
            done={hasAwards}
            title="Create an award"
            text="Pick the award and the period. It starts as a draft, so employees don't see anything yet."
            action={<Button size="sm" variant={groupsReady && !hasAwards ? "primary" : "outline"} onClick={() => setCreating(true)} className="gap-1"><Plus className="h-4 w-4" /> Create award</Button>}
          />
          <StartCard
            n={3}
            done={false}
            title="Open it and follow its steps"
            text="Select an award below. It shows where it is and the one thing to do next, until the winners are announced."
          />
        </ol>
      </section>

      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !awards ? (
        <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>
      ) : awards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No awards yet. Select <strong>Create award</strong> above to make the first one.</p>
      ) : (
        years.map((y) => (
          <section key={y} className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">{y}</h3>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {awards.filter((a) => a.year === y).map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setSelected(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{a.title} — {a.periodLabel}</span>
                        <OfficialBadge official={a.isOfficial} />
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_TONE[a.status])}>{a.statusLabel}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {a.actions.length ? <>Next step: <strong className="text-foreground">{AWARD_ACTION_LABEL[a.actions[0]]}</strong></> : STAGE[a.status].summary}
                        {a.usesVoting && !["DRAFT", "NOMINATION_OPEN", "NOMINATION_CLOSED"].includes(a.status) && <> · {plural(a._count?.ballots ?? 0, "ballot")}</>}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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

function StartCard({ n, done, title, text, action }: { n: number; done: boolean; title: string; text: string; action?: ReactNode }) {
  return (
    <li className={cn("flex flex-col gap-2 rounded-xl border p-3", done ? "border-status-success-border bg-status-success-surface/40" : "border-border bg-surface-2")}>
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-status-success-surface text-status-success-foreground" : "bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200")}>
          {done ? <CheckCircle2 className="h-4 w-4" aria-label="Done" /> : n}
        </span>
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{text}</p>
      {action && <div className="mt-auto pt-1">{action}</div>}
    </li>
  );
}

function AwardDetailView({ id, onBack, onGoToGroups }: { id: string; onBack: () => void; onGoToGroups: () => void }) {
  const [a, setA] = useState<AwardDetail | null>(null);
  const [groups, setGroups] = useState<AwardGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Array<{ id: string; title: string }>>([]);
  const [draft, setDraft] = useState<{ eligibilityDate: string; titles: Record<string, string>; excluded: string[] } | null>(null);
  const [editingExcluded, setEditingExcluded] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AwardsService.get(id).then(setA).catch((err) => setError(getApiErrorMessage(err, "The award could not be loaded.")));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    AwardsService.groups().then(setGroups).catch(() => setGroups([]));
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

  const back = <Button variant="ghost" size="sm" onClick={onBack} className="gap-1"><ChevronLeft className="h-4 w-4" /> All awards</Button>;
  if (error) return <div className="space-y-3">{back}<LoadError message={error} onRetry={load} /></div>;
  if (!a || !draft) return <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  const stages = stagesOf(a);
  const at = stages.indexOf(a.status);
  const isDraft = a.status === "DRAFT";
  const canRename = isDraft && (a.type === "SPECIAL" || a.type === "CUSTOM");
  const canExclude = isDraft && (a.type === "EMPLOYEE_OF_THE_QUARTER" || a.type === "CUSTOM");
  const longevity = a.type === "LONGEVITY";
  const pending = (a.results ?? []).filter((r) => r.shortlisted && r.decision === "PENDING").length;
  const usesServiceDate = a.minYears !== null || a.maxYears !== null || longevity;
  const groupVoted = a.categories.length > 0 && a.categories.every((c) => c.voterGroupId);
  const dirty =
    isDraft &&
    (draft.eligibilityDate !== a.eligibilityDate.slice(0, 10) ||
      (canRename && a.categories.some((c) => (draft.titles[c.id] ?? "") !== c.title)) ||
      (canExclude && [...draft.excluded].sort().join() !== [...a.excludedJobRoleIds].sort().join()));

  // Opening is refused while a category's group has nobody in it: say so up front.
  const opening = a.actions.find((x) => x === "OPEN_NOMINATION" || x === "OPEN_VOTING");
  const groupIds = opening ? a.categories.flatMap((c) => [c.nomineeGroupId, opening === "OPEN_VOTING" ? c.voterGroupId : null]) : [];
  const emptyGroups = groups.filter((g) => groupIds.includes(g.id) && g.memberCount === 0);

  const n = a.nominations.length;
  const instruction: Record<AwardStatus, string> = {
    DRAFT: a.usesNomination || a.usesVoting
      ? `Nothing has been sent to employees yet. Check “Who can take part” and the categories below — you can still change them. When it looks right, ${a.usesNomination ? "open nominations" : "open voting"}.`
      : "Nothing has been sent to employees yet. Start the review to see who reached each milestone.",
    NOMINATION_OPEN: `Employees are nominating co-workers under My Awards: ${plural(n, "nomination")} so far. When the nomination period is over, close nominations.`,
    NOMINATION_CLOSED: a.usesVoting
      ? `${plural(n, "nomination")} came in. Open voting so employees can choose among the nominees.`
      : `${plural(n, "nomination")} came in. Start the review to decide the winners.`,
    VOTING_OPEN: `${a.turnout ? `${a.turnout.ballots} of ${a.turnout.eligibleVoters}` : "Some"} employees have voted. The count stays hidden until voting closes. When the voting period is over, close voting.`,
    VOTING_CLOSED: a.requiresConfirmation
      ? "Voting is closed and the votes are counted (see Results). Start the review so the committee can confirm the winners."
      : "Voting is closed and the votes are counted (see Results). Announce them now, or review them first.",
    DELIBERATION: pending > 0
      ? `In Results, choose Confirm or Not awarded for each person on the shortlist. ${pending} still ${pending === 1 ? "needs" : "need"} a decision. Then mark the results as checked.`
      : "Everyone on the shortlist has a decision. Mark the results as checked.",
    VERIFIED: "The results are checked. Announce them to make them final: employees will see the winners, and the record can't be changed after. Need a change? Go back to the review.",
    FINALIZED: "Done. Employees can see the winners under My Awards, and this award is saved in Award History.",
  };

  const currentBody = (
    <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-950/30">
      <p className="text-sm text-foreground">{instruction[a.status]}</p>
      {emptyGroups.length > 0 && (
        <div className="space-y-2 rounded-lg border border-status-danger-border bg-status-danger-surface p-2.5 text-xs text-status-danger-foreground">
          <p className="flex gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>You can't {opening === "OPEN_NOMINATION" ? "open nominations" : "open voting"} yet: nobody is in {emptyGroups.map((g) => `“${g.name}”`).join(" and ")}. Add people to {emptyGroups.length === 1 ? "that group" : "those groups"} first.</span>
          </p>
          <Button size="xs" variant="outline" onClick={onGoToGroups} className="gap-1"><Users /> Set up groups</Button>
        </div>
      )}
      {dirty && <p className="text-xs font-semibold text-status-warning-foreground">Save your changes below before going on.</p>}
      {a.results && (a.status === "VOTING_CLOSED" || a.status === "DELIBERATION") && (
        <button
          type="button"
          onClick={() => document.getElementById("award-results")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
        >
          Go to Results ↓
        </button>
      )}
      {a.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {a.actions.map((act) => (
            <Button
              key={act}
              size="sm"
              disabled={busy || dirty || (act === opening && emptyGroups.length > 0) || (act === "VERIFY" && pending > 0)}
              variant={act === "FINALIZE" ? "create" : act === "RETURN_TO_REVIEW" || (act === "START_REVIEW" && a.actions.includes("FINALIZE")) ? "outline" : "primary"}
              onClick={() => step(act)}
            >
              {busy && <Loader2 className="animate-spin" />} {AWARD_ACTION_LABEL[act]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  const steps: GuideStep[] = stages.map((s, i) => ({
    key: s,
    title: STAGE[s].title,
    summary: s === "DELIBERATION" && longevity ? "Confirm each person who reached a milestone." : STAGE[s].summary,
    state: i < at ? "done" : i === at ? "current" : "upcoming",
    body: currentBody,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
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

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-foreground font-heading">{a.title} — {a.periodLabel}</h2>
          <OfficialBadge official={a.isOfficial} />
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_TONE[a.status])}>{a.statusLabel}</span>
        </div>
        {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section className="h-fit rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-4" aria-labelledby="award-steps">
          <h3 id="award-steps" className="mb-4 text-base font-bold text-foreground">Step by step</h3>
          <StepList steps={steps} label={`Steps for ${a.title}`} />
        </section>

        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-4 space-y-3 text-sm">
            <h3 className="font-bold text-foreground">Who can take part</h3>
            <ul className="space-y-1.5 text-sm text-foreground">
              <Rule>How it runs: {[a.usesNomination && "nominate", a.usesVoting && "vote", a.requiresConfirmation && "committee decides"].filter(Boolean).join(" → ") || "HR confirms"} → announce.</Rule>
              {a.usesVoting && (groupVoted ? (
                <Rule>
                  Employees vote only in their own group's category: <span className="text-muted-foreground">{a.categories.map((c) => `${c.title} ${plural(c.votesPerVoter, "vote")}`).join(" · ")}</span>.
                </Rule>
              ) : (
                <Rule>
                  Each voter has <strong>{plural(a.totalVotesPerVoter, "vote")}</strong>
                  {a.categories.length > 1 && <span className="text-muted-foreground"> ({a.categories.map((c) => `${c.title}: ${c.votesPerVoter}`).join(" · ")})</span>}.
                </Rule>
              ))}
              <Rule>
                Winners: {a.shortlistCount ? `the Top ${a.shortlistCount} ${a.resultMode === "COMBINED" ? "overall" : "in each category"} go to the committee` : longevity ? "HRISense lists who reached each milestone; HR confirms each one" : "everyone with a vote is ranked; the committee decides"}.
              </Rule>
              {usesServiceDate && (
                <Rule>
                  Years of service are counted up to{" "}
                  {isDraft ? (
                    <input type="date" aria-label="Count years of service up to" value={draft.eligibilityDate} onChange={(e) => setDraft({ ...draft, eligibilityDate: e.target.value })} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" />
                  ) : (
                    <strong>{new Date(a.eligibilityDate).toLocaleDateString()}</strong>
                  )}
                  .
                </Rule>
              )}
              {a.minYears !== null && <Rule>Only staff with <strong>{a.minYears} or more</strong> completed years can be nominated.</Rule>}
              {a.maxYears !== null && <Rule>Only staff with <strong>{a.maxYears} or fewer</strong> completed years can be nominated.</Rule>}
              {a.excludeHallOfFame && <Rule>Hall of Fame awardees can't be nominated (they can still vote).</Rule>}
              {a.usesVoting && <Rule>Employees may vote for themselves. Everyone starts at 0 votes.</Rule>}
            </ul>
            {(a.excludedJobRoles.length > 0 || canExclude) && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-bold text-foreground">Positions that can't be nominated <span className="font-normal text-muted-foreground">(they can still vote)</span></p>
                {canExclude && editingExcluded ? (
                  <>
                    <PillPicker
                      options={roles.map((r) => ({ id: r.id, label: r.title }))}
                      selected={draft.excluded}
                      onChange={(excluded) => setDraft({ ...draft, excluded })}
                      searchLabel="Search positions"
                    />
                    <Button size="xs" variant="outline" onClick={() => setEditingExcluded(false)}>Done</Button>
                  </>
                ) : (
                  <>
                    <ul className="flex flex-wrap gap-1.5">
                      {(canExclude ? roles.filter((r) => draft.excluded.includes(r.id)).map((r) => r.title) : a.excludedJobRoles).map((r) => (
                        <li key={r} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground">{r}</li>
                      ))}
                    </ul>
                    {canExclude && <Button size="xs" variant="outline" onClick={() => setEditingExcluded(true)}>Edit list</Button>}
                  </>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <h3 className="font-bold text-foreground">Categories</h3>
            <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {a.categories.map((c) => (
                <li key={c.id} className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-3 text-xs">
                  {canRename ? (
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Category name</span>
                      <input value={draft.titles[c.id] ?? ""} onChange={(e) => setDraft({ ...draft, titles: { ...draft.titles, [c.id]: e.target.value } })} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-semibold" />
                    </label>
                  ) : (
                    <p className="text-sm font-bold text-foreground">{c.title}</p>
                  )}
                  <p className="text-muted-foreground">
                    Nominees: <span className="text-foreground">{c.nomineeGroupName ?? (c.milestoneYears ? `${c.milestoneYears}+ completed years` : "anyone eligible")}</span>
                    {a.usesVoting && <> · Voters: <span className="text-foreground">{c.voterGroupName ?? "every employee"}</span></>}
                    {a.usesVoting && <> · {plural(c.votesPerVoter, "vote")} each</>}
                  </p>
                  {!longevity && (
                    <details>
                      <summary className="cursor-pointer font-semibold text-primary-700 dark:text-primary-300">
                        {a.usesNomination ? `${plural(c.nominationCount, "nomination")} · ${plural(c.candidates.length, "person", "people")} on the ballot` : `${plural(c.candidates.length, "person", "people")} on the ballot`}
                      </summary>
                      <p className="mt-1 text-foreground">{c.candidates.map((p) => p.fullName).join(", ") || (a.usesNomination ? "Nobody yet — people appear here once they are nominated." : "Nobody yet.")}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {dirty && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">You have unsaved changes.</span>
                <Button
                  size="sm" disabled={busy}
                  onClick={() => run(() => AwardsService.update(id, {
                    eligibilityDate: draft.eligibilityDate,
                    ...(canExclude ? { excludedJobRoleIds: draft.excluded } : {}),
                    ...(canRename ? { categories: a.categories.map((c) => ({ id: c.id, title: draft.titles[c.id] })) } : {}),
                  }), "Changes saved.")}
                >
                  Save changes
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
                    {a.nominations.map((nm) => (
                      <tr key={nm.id}>
                        <td className="py-1.5 pr-3">{a.categories.find((c) => c.id === nm.categoryId)?.title}</td>
                        <td className="py-1.5 pr-3">{nm.nominee.fullName}{!nm.stillEligible && <span className="ml-1 text-status-warning-foreground">(no longer eligible: {nm.ineligibleReason})</span>}</td>
                        <td className="py-1.5 pr-3">{nm.nominatedBy.fullName}</td>
                        <td className="py-1.5 text-muted-foreground">{nm.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {a.results && <ResultsReview award={a} busy={busy} pending={pending} onRun={run} />}
        </div>
      </div>
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function ResultsReview({ award: a, busy, pending, onRun }: { award: AwardDetail; busy: boolean; pending: number; onRun: (fn: () => Promise<AwardDetail>, ok: string) => Promise<void> }) {
  const deciding = a.status === "DELIBERATION";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const blocks = useMemo(() => {
    const rows = a.results ?? [];
    if (a.resultMode === "COMBINED") return [{ title: a.shortlistCount ? `Top ${a.shortlistCount}` : "Results", rows }];
    return a.categories.map((c) => ({ title: c.title, rows: rows.filter((r) => r.categoryId === c.id) }));
  }, [a]);
  const longevity = a.type === "LONGEVITY";

  const decide = (r: AwardResultRow, decision: "CONFIRMED" | "NOT_AWARDED" | "PENDING") => {
    if (!r.id) return;
    const pl = placements[r.id];
    void onRun(() => AwardsService.decide(r.id!, { decision, placement: pl ? Number(pl) : undefined, note: notes[r.id!] }), "Decision recorded.");
  };

  return (
    <section id="award-results" className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-foreground">{a.status === "VOTING_CLOSED" ? "Results (counted, not yet reviewed)" : longevity ? "Who reached a milestone" : "Results"}</h3>
          <p className="text-xs text-muted-foreground">
            {longevity
              ? "Employees who reached 5, 10, 15 or 20 completed years and haven't received that award. Confirm each one."
              : deciding
                ? "For each person on the shortlist choose Confirm (you can set their place) or Not awarded. Add a note if you like."
                : "Counted automatically from the ballots. Nobody is a winner until the results are announced."}
          </p>
        </div>
        {deciding && pending > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => window.confirm(`Confirm all ${pending} people still waiting${longevity ? "" : ", in their ranked places"}?`) && onRun(() => AwardsService.confirmShortlist(a.id), "Confirmed.")}>
            Confirm everyone left ({pending})
          </Button>
        )}
      </div>
      {blocks.map((b) => (
        <div key={b.title} className="space-y-1">
          <p className="text-sm font-bold text-foreground">{b.title}</p>
          {b.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{longevity ? "Nobody reached a milestone." : "No votes."}</p>
          ) : (
            <ul className="space-y-2">
              {b.rows.map((r, i) => (
                <li key={r.id ?? `${r.employeeId}-${i}`} className={cn("space-y-2 rounded-xl border border-border bg-surface-2 p-3", !r.shortlisted && "opacity-60")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {!longevity && (
                        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-bold text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                          #{r.rank}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{r.employee?.fullName}</p>
                        <p className="text-xs text-muted-foreground">{r.employee?.jobRoleTitle} · {r.employee?.unitName}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-foreground">
                          {longevity ? `${r.completedYears} completed years` : plural(r.voteCount, "vote")}
                          {!longevity && r.shortlisted && a.shortlistCount !== null && <span className="rounded bg-primary-50 px-1 text-[10px] font-semibold text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">Top {a.shortlistCount}</span>}
                          {r.tiedAtCutoff && <span className="rounded bg-status-warning-surface px-1 text-[10px] font-semibold text-status-warning-foreground">Tied for the last place</span>}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        r.decision === "CONFIRMED"
                          ? "border-status-success-border bg-status-success-surface text-status-success-foreground"
                          : r.decision === "NOT_AWARDED" || !r.shortlisted
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-status-warning-border bg-status-warning-surface text-status-warning-foreground"
                      )}
                    >
                      {r.decision === "CONFIRMED" ? `Confirmed${r.placement ? ` · #${r.placement}` : ""}` : r.decision === "NOT_AWARDED" ? "Not awarded" : r.shortlisted ? "Waiting for a decision" : "Not on the shortlist"}
                    </span>
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground">Note: {r.note}</p>}
                  {deciding && r.id && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                      {!longevity && (
                        <input aria-label="Place" placeholder={`Place #${r.rank ?? ""}`} value={placements[r.id] ?? ""} onChange={(e) => setPlacements((p) => ({ ...p, [r.id!]: e.target.value }))} className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-xs" inputMode="numeric" />
                      )}
                      <input aria-label="Note" placeholder="Note (optional)" value={notes[r.id] ?? ""} onChange={(e) => setNotes((nt) => ({ ...nt, [r.id!]: e.target.value }))} className="h-8 min-w-0 flex-1 basis-32 rounded-lg border border-border bg-background px-2 text-xs" />
                      <Button size="xs" variant="create" disabled={busy} onClick={() => decide(r, "CONFIRMED")}>Confirm</Button>
                      <Button size="xs" variant="outline" disabled={busy} onClick={() => decide(r, "NOT_AWARDED")}>Not awarded</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

export const awardTypeLabel = (t: keyof typeof AWARD_TYPE_LABEL) => AWARD_TYPE_LABEL[t];
