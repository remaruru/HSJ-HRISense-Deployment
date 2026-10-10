import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AchievementsService, type AchievementPageSummary } from "@/services/achievements.service";

/**
 * Yearly Achievements — Hospicio's institutional highlights, one page per year.
 * Everyone reads the published years; HR creates a page for any year here (no
 * year is built in) and manages it on the year's page. Not related to
 * performance evaluations.
 */
export default function YearlyAchievementsPage() {
  const { user } = useAuth();
  const isHr = user?.permissionTier === "FULL";
  const navigate = useNavigate();
  const [pages, setPages] = useState<AchievementPageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    AchievementsService.list().then(setPages).catch((err) => setError(getApiErrorMessage(err, "Yearly Achievements could not be loaded.")));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const page = await AchievementsService.create({ year: Number(year) });
      toast.success(`${page.year} page created as a draft.`);
      navigate({ to: `/achievements/${page.id}` as any });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The page could not be created."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="Yearly Achievements"
        subtitle="Hospicio de San Jose's achievements and milestones, year by year."
        actions={isHr ? <Button onClick={() => setCreating((v) => !v)} className="gap-1"><Plus className="h-4 w-4" /> New year</Button> : undefined}
      />

      {isHr && creating && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <label className="space-y-1 text-sm">
            <span className="block text-xs font-semibold">Year</span>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-10 w-28 rounded-lg border border-border bg-background px-3" />
          </label>
          <p className="flex-1 min-w-[12rem] text-xs text-muted-foreground">The page starts as a draft. Add the introduction and achievements, then publish it for everyone to see.</p>
          <Button onClick={create} disabled={busy || !year}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create page</Button>
        </div>
      )}

      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !pages ? (
        <p className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>
      ) : pages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No Yearly Achievements have been published yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                to={`/achievements/${p.id}` as any}
                className={cn(
                  "group flex h-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
                  p.status === "PUBLISHED" ? "border-border" : "border-dashed border-status-warning-border"
                )}
              >
                <div className="relative bg-gradient-to-br from-primary-600 to-primary-400 px-5 py-6 text-white">
                  <p className="text-5xl font-extrabold font-heading tracking-tight tabular-nums">{p.year}</p>
                  <div className="absolute right-3 top-3 flex gap-1.5">
                    {p.isSample && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-800">Sample</span>}
                    {p.status === "DRAFT" && <span className="rounded-full bg-status-warning-surface px-2 py-0.5 text-[10px] font-bold uppercase text-status-warning-foreground">Draft</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-bold text-foreground group-hover:text-primary-700 dark:group-hover:text-primary-300">{p.title}</h2>
                  {p.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>}
                  <p className="mt-auto pt-3 text-xs font-semibold text-muted-foreground">{p.entryCount} achievement{p.entryCount === 1 ? "" : "s"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
