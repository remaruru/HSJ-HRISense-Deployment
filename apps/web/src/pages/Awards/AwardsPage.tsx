import { useCallback, useEffect, useState } from "react";
import { Award, History, Landmark, Loader2, Medal, Settings2, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TabNav } from "@/components/ui/tab-nav";
import { LoadError } from "@/components/shared/LoadError";
import { useAuth } from "@/providers/AuthProvider";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type HistoryAward, type MyAwards } from "@/services/awards.service";
import { AwardBallot } from "./components/AwardBallot";
import { AwardNominations } from "./components/AwardNominations";
import { AwardManager, OfficialBadge } from "./components/AwardManager";
import { AwardGroupsPanel } from "./components/AwardGroupsPanel";
import { HallOfFamePanel } from "./components/HallOfFamePanel";

type Tab = "mine" | "manage" | "groups" | "hof" | "history";

/**
 * Awards & Recognition. Everyone: open nominations, their ballots, final
 * results and their own award history. HR (FULL): award periods, groups, the
 * review / verification / final declaration, Hall of Fame and the full history.
 * The system tallies; people decide. Evaluation scores and AI play no part.
 */
export default function AwardsPage() {
  const { user } = useAuth();
  const isHr = user?.permissionTier === "FULL";
  const [tab, setTab] = useState<Tab>("mine");

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-screen-2xl mx-auto">
      <PageHeader
        icon={<Trophy className="h-5 w-5" />}
        title="Awards & Recognition"
        subtitle="Nominations, voting and Hospicio's recognition awards. Votes are tallied automatically; people review and declare the final results."
      />
      {isHr && (
        <TabNav<Tab>
          aria-label="Awards sections"
          value={tab}
          onChange={setTab}
          items={[
            { id: "mine", label: "My Awards", icon: <Award /> },
            { id: "manage", label: "Manage Awards", icon: <Settings2 /> },
            { id: "groups", label: "Voting Groups", icon: <Users /> },
            { id: "hof", label: "Hall of Fame", icon: <Landmark /> },
            { id: "history", label: "Award History", icon: <History /> },
          ]}
        />
      )}
      <div role={isHr ? "tabpanel" : undefined}>
        {tab === "mine" || !isHr ? <MyAwardsView /> : tab === "manage" ? <AwardManager /> : tab === "groups" ? <AwardGroupsPanel /> : tab === "hof" ? <HallOfFamePanel /> : <HistoryView />}
      </div>
    </div>
  );
}

function MyAwardsView() {
  const [data, setData] = useState<MyAwards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    AwardsService.my().then(setData).catch((err) => setError(getApiErrorMessage(err, "Awards could not be loaded.")));
  }, []);
  useEffect(load, [load]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!data) return <p className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  const nothingOpen = !data.nominationAwards.length && !data.votingAwards.length;
  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="open-heading">
        <h2 id="open-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Open now</h2>
        {nothingOpen && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No nominations or voting are open right now.</p>}
        {data.nominationAwards.map((a) => <AwardNominations key={a.id} award={a} onChanged={load} />)}
        {data.votingAwards.map((a) => <AwardBallot key={a.id} award={a} onSubmitted={load} />)}
      </section>

      <section className="space-y-3" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">My award history</h2>
        {data.myHistory.awards.length === 0 && data.myHistory.hallOfFame.length === 0 ? (
          <p className="text-sm text-muted-foreground">No awards recorded for you yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.myHistory.hallOfFame.map((h, i) => (
              <li key={`hof-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <Landmark className="h-4 w-4 text-primary-600 dark:text-primary-300" aria-hidden="true" /> {h.title}, {h.awardYear}
              </li>
            ))}
            {data.myHistory.awards.map((h, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <Medal className="h-4 w-4 text-primary-600 dark:text-primary-300" aria-hidden="true" />
                {h.award}{h.category && h.category !== h.award ? ` — ${h.category}` : ""}, {h.period}{h.placement ? ` · #${h.placement}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Final results</h2>
        {data.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No final results yet.</p>
        ) : (
          data.results.map((r) => <ResultCard key={r.id} title={`${r.title} — ${r.periodLabel}`} awardees={r.awardees} />)
        )}
      </section>
    </div>
  );
}

function ResultCard({ title, awardees, official, showVotes = false }: {
  title: string;
  awardees: Array<{ categoryTitle: string | null; placement: number | null; voteCount?: number; completedYears?: number | null; employee: { fullName: string; jobRoleTitle: string; unitName: string } }>;
  official?: boolean;
  showVotes?: boolean;
}) {
  const cats = [...new Set(awardees.map((a) => a.categoryTitle ?? ""))];
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 space-y-2">
      <h3 className="flex items-center gap-2 font-bold text-foreground">{title} {official !== undefined && <OfficialBadge official={official} />}</h3>
      {awardees.length === 0 ? (
        <p className="text-xs text-muted-foreground">No awardees were declared.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cats.map((c) => (
            <div key={c} className="space-y-1">
              {c && cats.length > 1 && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{c}</p>}
              <ol className="space-y-0.5 text-sm">
                {awardees.filter((a) => (a.categoryTitle ?? "") === c).map((a, i) => (
                  <li key={i}>
                    {a.placement ? <span className="mr-1 font-bold text-foreground">{a.placement}.</span> : null}
                    <span className="font-semibold text-foreground">{a.employee.fullName}</span>
                    <span className="text-xs text-muted-foreground"> — {a.employee.jobRoleTitle} · {a.employee.unitName}{showVotes && a.voteCount ? ` · ${a.voteCount} vote${a.voteCount === 1 ? "" : "s"}` : ""}{a.completedYears ? ` · ${a.completedYears} years` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function HistoryView() {
  const [rows, setRows] = useState<HistoryAward[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    AwardsService.history().then(setRows).catch((err) => setError(getApiErrorMessage(err, "Award history could not be loaded.")));
  }, []);
  useEffect(load, [load]);
  if (error) return <LoadError message={error} onRetry={load} />;
  if (!rows) return <p className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;
  if (!rows.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No finalized awards yet.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Every finalized award, with the title used that period. Vote totals are shown to HR only.</p>
      {rows.map((r) => (
        <ResultCard
          key={r.id}
          title={`${r.title} — ${r.periodLabel}${r.finalizedAt ? ` (finalized ${new Date(r.finalizedAt).toLocaleDateString()})` : ""}`}
          official={r.isOfficial}
          awardees={r.awardees}
          showVotes
        />
      ))}
    </div>
  );
}
