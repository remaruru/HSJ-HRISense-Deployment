import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type AwardGroup } from "@/services/awards.service";

type Kind = "EMPLOYEE_OF_THE_QUARTER" | "RECOGNITION" | "VINCENTIAN" | "LOUISIAN" | "SPECIAL" | "LONGEVITY" | "CUSTOM";

const KINDS: Array<{ id: Kind; title: string; desc: string; official: boolean }> = [
  { id: "EMPLOYEE_OF_THE_QUARTER", title: "Employee of the Quarter", desc: "Nomination → voting by group (Social 1 · Homelife 2 · Health 1 · Admin Services 2) → review → final.", official: true },
  { id: "RECOGNITION", title: "Personnel Recognition and Awards (whole year)", desc: "Creates the year's Vincentian, Louisian, Special Awards and Longevity Awards together.", official: true },
  { id: "VINCENTIAN", title: "Vincentian Service Award only", desc: "3+ completed years; 4 votes (Admin, SSD, Pastoral, Health); Top 15.", official: true },
  { id: "LOUISIAN", title: "Louisian Service Award only", desc: "3 completed years or less; 1 vote; Top 15.", official: true },
  { id: "SPECIAL", title: "Special Awards only", desc: "Five organisation-wide awards, 1 vote each, Top 5 each. Titles editable in the draft.", official: true },
  { id: "LONGEVITY", title: "Longevity Awards only", desc: "5 / 10 / 15 / 20 years: recommended by HRISense, confirmed by HR. No voting.", official: true },
  { id: "CUSTOM", title: "Custom award", desc: "A new award with its own categories, groups and votes.", official: false },
];

interface CustomCategory {
  title: string;
  votesPerVoter: number;
  nomineeGroupId: string;
  voterGroupId: string;
}

/** HR creates an award period: an official Hospicio award (its confirmed rules preset) or a custom one. */
export function CreateAwardDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string | null) => void }) {
  const now = new Date();
  const [kind, setKind] = useState<Kind>("EMPLOYEE_OF_THE_QUARTER");
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [eligibilityDate, setEligibilityDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<AwardGroup[]>([]);
  const [custom, setCustom] = useState({
    title: "", description: "", usesNomination: false, usesVoting: true, requiresConfirmation: true,
    resultMode: "PER_CATEGORY", shortlistCount: "", minYears: "", maxYears: "", excludeHallOfFame: false, quarterly: false,
  });
  const [cats, setCats] = useState<CustomCategory[]>([{ title: "", votesPerVoter: 1, nomineeGroupId: "", voterGroupId: "" }]);

  useEffect(() => {
    if (!open) return;
    setKind("EMPLOYEE_OF_THE_QUARTER");
    setEligibilityDate("");
    AwardsService.groups().then(setGroups).catch(() => setGroups([]));
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const base = { year, ...(eligibilityDate ? { eligibilityDate } : {}) };
      if (kind === "RECOGNITION") {
        const r = await AwardsService.createRecognitionYear(year, eligibilityDate || undefined);
        toast.success(r.created.length ? `Created: ${r.created.join(", ")}.` : "Nothing new to create.");
        if (r.skipped.length) toast.info(r.skipped.join(" "));
        onOpenChange(false);
        onCreated(null);
        return;
      }
      const body =
        kind === "CUSTOM"
          ? {
              ...base, type: "CUSTOM", title: custom.title, description: custom.description,
              quarter: custom.quarterly ? quarter : undefined,
              usesNomination: custom.usesNomination, usesVoting: custom.usesVoting, requiresConfirmation: custom.requiresConfirmation,
              resultMode: custom.resultMode, shortlistCount: custom.shortlistCount === "" ? null : Number(custom.shortlistCount),
              minYears: custom.minYears === "" ? null : Number(custom.minYears), maxYears: custom.maxYears === "" ? null : Number(custom.maxYears),
              excludeHallOfFame: custom.excludeHallOfFame,
              categories: cats.map((c) => ({ title: c.title, votesPerVoter: c.votesPerVoter, nomineeGroupId: c.nomineeGroupId || null, voterGroupId: c.voterGroupId || null })),
            }
          : { ...base, type: kind, ...(kind === "EMPLOYEE_OF_THE_QUARTER" ? { quarter } : {}) };
      const a = await AwardsService.create(body);
      toast.success(`${a.title} — ${a.periodLabel} created as a draft.`);
      onOpenChange(false);
      onCreated(a.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The award could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const groupSelect = (value: string, onChange: (v: string) => void, none: string, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-1 text-xs">
      <option value="">{none}</option>
      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create award</DialogTitle>
          <DialogDescription>New awards start as drafts. Hospicio's official awards use their confirmed rules; a custom award is set up here.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div role="radiogroup" aria-label="Award" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {KINDS.map((k) => (
              <button
                key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
                className={`rounded-xl border p-3 text-left text-xs transition-colors ${kind === k.id ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-900/30" : "border-border hover:bg-muted/40"}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  {k.title}
                  <span className="rounded border border-border px-1 text-[9px] font-bold uppercase text-muted-foreground">{k.official ? "Official" : "Custom"}</span>
                </span>
                <span className="mt-0.5 block text-muted-foreground">{k.desc}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-xs font-semibold">Year</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 w-24 rounded-lg border border-border bg-background px-2" />
            </label>
            {(kind === "EMPLOYEE_OF_THE_QUARTER" || (kind === "CUSTOM" && custom.quarterly)) && (
              <label className="space-y-1">
                <span className="block text-xs font-semibold">Quarter</span>
                <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="h-9 rounded-lg border border-border bg-background px-2">
                  {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </label>
            )}
            <label className="space-y-1">
              <span className="block text-xs font-semibold">Count years of service as of</span>
              <input type="date" value={eligibilityDate} onChange={(e) => setEligibilityDate(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" />
              <span className="block text-[11px] text-muted-foreground">Blank = today. Can be changed while it is a draft.</span>
            </label>
          </div>

          {kind === "CUSTOM" && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Award title</span>
                <input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">Description / instructions</span>
                <textarea rows={2} value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2 py-1" />
              </label>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={custom.quarterly} onChange={(e) => setCustom({ ...custom, quarterly: e.target.checked })} /> Quarterly</label>
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={custom.usesNomination} onChange={(e) => setCustom({ ...custom, usesNomination: e.target.checked })} /> Uses nomination</label>
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={custom.usesVoting} onChange={(e) => setCustom({ ...custom, usesVoting: e.target.checked })} /> Uses voting</label>
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={custom.requiresConfirmation} onChange={(e) => setCustom({ ...custom, requiresConfirmation: e.target.checked })} /> HR review & verification required</label>
                <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={custom.excludeHallOfFame} onChange={(e) => setCustom({ ...custom, excludeHallOfFame: e.target.checked })} /> Hall of Fame not eligible as nominees</label>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <label className="space-y-1">
                  <span className="block font-semibold">Results</span>
                  <select value={custom.resultMode} onChange={(e) => setCustom({ ...custom, resultMode: e.target.value })} className="h-8 rounded-lg border border-border bg-background px-1">
                    <option value="PER_CATEGORY">Ranked per category</option>
                    <option value="COMBINED">One ranking for all categories</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block font-semibold">Shortlist (Top N)</span>
                  <input type="number" min={1} value={custom.shortlistCount} onChange={(e) => setCustom({ ...custom, shortlistCount: e.target.value })} placeholder="all" className="h-8 w-20 rounded-lg border border-border bg-background px-1" />
                </label>
                <label className="space-y-1">
                  <span className="block font-semibold">Min. completed years</span>
                  <input type="number" min={0} value={custom.minYears} onChange={(e) => setCustom({ ...custom, minYears: e.target.value })} className="h-8 w-20 rounded-lg border border-border bg-background px-1" />
                </label>
                <label className="space-y-1">
                  <span className="block font-semibold">Max. completed years</span>
                  <input type="number" min={0} value={custom.maxYears} onChange={(e) => setCustom({ ...custom, maxYears: e.target.value })} className="h-8 w-20 rounded-lg border border-border bg-background px-1" />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold">Categories</p>
                {cats.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                    <input aria-label="Category title" placeholder="Category title" value={c.title} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="h-8 min-w-40 flex-1 rounded-lg border border-border bg-background px-2 text-xs" />
                    <label className="inline-flex items-center gap-1 text-xs">Votes
                      <input type="number" min={1} max={10} value={c.votesPerVoter} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, votesPerVoter: Number(e.target.value) } : x)))} className="h-8 w-14 rounded-lg border border-border bg-background px-1" />
                    </label>
                    {groupSelect(c.nomineeGroupId, (v) => setCats(cats.map((x, j) => (j === i ? { ...x, nomineeGroupId: v } : x))), "Nominees: everyone", "Nominee group")}
                    {groupSelect(c.voterGroupId, (v) => setCats(cats.map((x, j) => (j === i ? { ...x, voterGroupId: v } : x))), "Voters: everyone", "Voter group")}
                    {cats.length > 1 && (
                      <Button size="xs" variant="ghost" aria-label="Remove category" onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                ))}
                <Button size="xs" variant="outline" onClick={() => setCats([...cats, { title: "", votesPerVoter: 1, nomineeGroupId: "", voterGroupId: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add category</Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create draft</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
