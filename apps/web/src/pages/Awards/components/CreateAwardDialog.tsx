import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type AwardGroup } from "@/services/awards.service";

type Kind = "EMPLOYEE_OF_THE_QUARTER" | "RECOGNITION" | "VINCENTIAN" | "LOUISIAN" | "SPECIAL" | "LONGEVITY" | "CUSTOM";

interface KindInfo {
  title: string;
  points: string[];
  flow: string[];
  /** Years of service matter, so the "counted up to" date is asked for. */
  usesServiceDate: boolean;
}

/** Hospicio's confirmed rules, in plain words. */
const KINDS: Record<Kind, KindInfo> = {
  EMPLOYEE_OF_THE_QUARTER: {
    title: "Employee of the Quarter",
    points: [
      "Employees nominate co-workers from their own group, then vote within their group.",
      "Heads, supervisors, coordinators and the HR Officer can't be nominated (they can vote).",
    ],
    flow: ["Nominate", "Vote", "Committee decides", "Announce"],
    usesServiceDate: false,
  },
  RECOGNITION: {
    title: "All of the year's recognition awards",
    points: ["Makes 4 drafts at once: Vincentian, Louisian, Special Awards and Longevity Awards. Each one is then run on its own."],
    flow: ["Vote", "Committee decides", "Announce"],
    usesServiceDate: true,
  },
  VINCENTIAN: {
    title: "Vincentian Service Award",
    points: ["For staff with 3 or more completed years.", "Everyone votes once per group (4 votes). The Top 15 go to the committee."],
    flow: ["Vote", "Committee decides", "Announce"],
    usesServiceDate: true,
  },
  LOUISIAN: {
    title: "Louisian Service Award",
    points: ["For staff with 3 completed years or less.", "Everyone has 1 vote. The Top 15 go to the committee."],
    flow: ["Vote", "Committee decides", "Announce"],
    usesServiceDate: true,
  },
  SPECIAL: {
    title: "Special Awards",
    points: ["Most Friendly, Responsible, Courteous, Available and Well Groomed.", "1 vote in each. The Top 5 of each go to the committee."],
    flow: ["Vote", "Committee decides", "Announce"],
    usesServiceDate: false,
  },
  LONGEVITY: {
    title: "Longevity Awards",
    points: ["5, 10, 15 and 20 years of service.", "No voting: HRISense lists who reached each milestone and HR confirms."],
    flow: ["HR confirms", "Announce"],
    usesServiceDate: true,
  },
  CUSTOM: {
    title: "Custom award",
    points: ["Your own award: you name it and choose its categories, groups and votes."],
    flow: ["You choose the steps"],
    usesServiceDate: true,
  },
};

interface CustomCategory {
  title: string;
  votesPerVoter: number;
  nomineeGroupId: string;
  voterGroupId: string;
}

const NEW_CATEGORY: CustomCategory = { title: "", votesPerVoter: 1, nomineeGroupId: "", voterGroupId: "" };

/**
 * Creating an award, in two steps: which award, then which period. Everything
 * starts as a draft — nothing reaches employees until HR opens it.
 */
export function CreateAwardDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string | null) => void }) {
  const now = new Date();
  const [step, setStep] = useState<1 | 2>(1);
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
  const [cats, setCats] = useState<CustomCategory[]>([{ ...NEW_CATEGORY }]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setKind("EMPLOYEE_OF_THE_QUARTER");
    setEligibilityDate("");
    AwardsService.groups().then(setGroups).catch(() => setGroups([]));
  }, [open]);

  const info = KINDS[kind];
  const quarterly = kind === "EMPLOYEE_OF_THE_QUARTER" || (kind === "CUSTOM" && custom.quarterly);
  const period = quarterly ? `Q${quarter} ${year}` : String(year);

  const submit = async () => {
    if (kind === "CUSTOM") {
      if (!custom.title.trim()) return toast.error("Give the custom award a name.");
      if (!custom.usesNomination && !custom.usesVoting) return toast.error("Choose nominations, voting, or both.");
      if (cats.some((c) => !c.title.trim())) return toast.error("Give every category a name.");
    }
    setBusy(true);
    try {
      const base = { year, ...(info.usesServiceDate && eligibilityDate ? { eligibilityDate } : {}) };
      if (kind === "RECOGNITION") {
        const r = await AwardsService.createRecognitionYear(year, eligibilityDate || undefined);
        toast.success(r.created.length ? `Drafts created: ${r.created.join(", ")}.` : "Nothing new to create.");
        if (r.skipped.length) toast.info(r.skipped.join(" "));
        onOpenChange(false);
        onCreated(null);
        return;
      }
      const body =
        kind === "CUSTOM"
          ? {
              ...base, type: "CUSTOM", title: custom.title.trim(), description: custom.description,
              quarter: custom.quarterly ? quarter : undefined,
              usesNomination: custom.usesNomination, usesVoting: custom.usesVoting, requiresConfirmation: custom.requiresConfirmation,
              resultMode: custom.resultMode, shortlistCount: custom.shortlistCount === "" ? null : Number(custom.shortlistCount),
              minYears: custom.minYears === "" ? null : Number(custom.minYears), maxYears: custom.maxYears === "" ? null : Number(custom.maxYears),
              excludeHallOfFame: custom.excludeHallOfFame,
              categories: cats.map((c) => ({ title: c.title.trim(), votesPerVoter: c.votesPerVoter, nomineeGroupId: c.nomineeGroupId || null, voterGroupId: c.voterGroupId || null })),
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

  const card = (k: Kind, size: "lg" | "sm" = "lg") => {
    const on = kind === k;
    return (
      <button
        key={k}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setKind(k)}
        className={cn(
          "w-full rounded-2xl border p-3 text-left transition-colors",
          on ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/40 dark:bg-primary-900/30" : "border-border bg-surface hover:bg-muted/50"
        )}
      >
        <span className="flex items-start gap-2">
          <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary-600" : "border-border")} aria-hidden="true">
            {on && <span className="h-2 w-2 rounded-full bg-primary-600" />}
          </span>
          <span className="min-w-0">
            <span className={cn("block font-bold text-foreground", size === "lg" ? "text-sm" : "text-[13px]")}>{KINDS[k].title}</span>
            {KINDS[k].points.map((p) => <span key={p} className="mt-0.5 block text-xs text-muted-foreground">{p}</span>)}
          </span>
        </span>
      </button>
    );
  };

  const groupSelect = (value: string, onChange: (v: string) => void, none: string, label: string) => (
    <label className="block space-y-1">
      <span className="block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs">
        <option value="">{none}</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </label>
  );

  const toggle = (key: "quarterly" | "usesNomination" | "usesVoting" | "requiresConfirmation" | "excludeHallOfFame", title: string, hint: string) => (
    <label className="flex items-start gap-2 rounded-xl border border-border p-2.5 text-xs">
      <input type="checkbox" className="mt-0.5" checked={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: e.target.checked })} />
      <span><span className="block font-semibold text-foreground">{title}</span><span className="block text-muted-foreground">{hint}</span></span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">Step {step} of 2</p>
          <DialogTitle>{step === 1 ? "Which award do you want to run?" : `When is the ${info.title} for?`}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Pick one. Hospicio's own awards come with their rules already set."
              : "It is saved as a draft. Nothing is sent to employees until you open it."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div role="radiogroup" aria-label="Award" className="min-w-0 space-y-4 text-sm">
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Every quarter</h3>
              {card("EMPLOYEE_OF_THE_QUARTER")}
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Once a year</h3>
              {card("RECOGNITION")}
              <p className="pt-1 text-xs text-muted-foreground">Or only one of them:</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["VINCENTIAN", "LOUISIAN", "SPECIAL", "LONGEVITY"] as Kind[]).map((k) => card(k, "sm"))}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Something else</h3>
              {card("CUSTOM")}
            </section>
          </div>
        ) : (
          <div className="min-w-0 space-y-4 text-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="block text-xs font-semibold">Year</span>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 w-28 rounded-xl border border-border bg-background px-3" />
              </label>
              {quarterly && (
                <label className="space-y-1">
                  <span className="block text-xs font-semibold">Quarter</span>
                  <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="h-10 rounded-xl border border-border bg-background px-3">
                    {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q} ({["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][q - 1]})</option>)}
                  </select>
                </label>
              )}
            </div>

            {info.usesServiceDate && (
              <label className="block space-y-1">
                <span className="block text-xs font-semibold">Count years of service up to <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input type="date" value={eligibilityDate} onChange={(e) => setEligibilityDate(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3" />
                <span className="block text-xs text-muted-foreground">Used to decide who has 3 years, 10 years and so on. Leave it empty to use today. You can change it while it's a draft.</span>
              </label>
            )}

            {kind === "CUSTOM" && (
              <div className="space-y-4 rounded-2xl border border-border p-3 sm:p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-xs font-semibold">Award name</span>
                    <input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="e.g. Volunteer of the Year" className="h-10 w-full rounded-xl border border-border bg-background px-3" />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-xs font-semibold">Instructions for employees <span className="font-normal text-muted-foreground">(optional)</span></span>
                    <textarea rows={2} value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2" />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">How it runs</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {toggle("usesNomination", "Employees nominate first", "A nomination stage before voting.")}
                    {toggle("usesVoting", "Employees vote", "Everyone in the voter group gets a ballot.")}
                    {toggle("requiresConfirmation", "Committee confirms winners", "HR records each decision before announcing.")}
                    {toggle("quarterly", "Every quarter", "Otherwise it runs once a year.")}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">Who can be nominated</p>
                  <div className="flex flex-wrap items-end gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="block font-semibold">At least … years</span>
                      <input type="number" min={0} value={custom.minYears} onChange={(e) => setCustom({ ...custom, minYears: e.target.value })} placeholder="any" className="h-9 w-24 rounded-lg border border-border bg-background px-2" />
                    </label>
                    <label className="space-y-1">
                      <span className="block font-semibold">At most … years</span>
                      <input type="number" min={0} value={custom.maxYears} onChange={(e) => setCustom({ ...custom, maxYears: e.target.value })} placeholder="any" className="h-9 w-24 rounded-lg border border-border bg-background px-2" />
                    </label>
                  </div>
                  {toggle("excludeHallOfFame", "Leave out Hall of Fame awardees", "They can still vote.")}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">Winners</p>
                  <div className="flex flex-wrap items-end gap-3 text-xs">
                    <label className="space-y-1">
                      <span className="block font-semibold">Ranking</span>
                      <select value={custom.resultMode} onChange={(e) => setCustom({ ...custom, resultMode: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-2">
                        <option value="PER_CATEGORY">A separate ranking for each category</option>
                        <option value="COMBINED">One ranking for all categories</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block font-semibold">Shortlist the top …</span>
                      <input type="number" min={1} value={custom.shortlistCount} onChange={(e) => setCustom({ ...custom, shortlistCount: e.target.value })} placeholder="all" className="h-9 w-24 rounded-lg border border-border bg-background px-2" />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">Categories</p>
                  {cats.map((c, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
                      <div className="flex items-end gap-2">
                        <label className="block flex-1 space-y-1">
                          <span className="block text-[11px] font-semibold text-muted-foreground">Category {i + 1} name</span>
                          <input value={c.title} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs" />
                        </label>
                        {custom.usesVoting && (
                          <label className="block space-y-1">
                            <span className="block text-[11px] font-semibold text-muted-foreground">Votes each</span>
                            <input type="number" min={1} max={10} value={c.votesPerVoter} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, votesPerVoter: Number(e.target.value) } : x)))} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-xs" />
                          </label>
                        )}
                        {cats.length > 1 && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Remove category ${i + 1}`} onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 /></Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {groupSelect(c.nomineeGroupId, (v) => setCats(cats.map((x, j) => (j === i ? { ...x, nomineeGroupId: v } : x))), "Anyone", "Who can be nominated")}
                        {custom.usesVoting && groupSelect(c.voterGroupId, (v) => setCats(cats.map((x, j) => (j === i ? { ...x, voterGroupId: v } : x))), "Everyone", "Who votes")}
                      </div>
                    </div>
                  ))}
                  <Button size="xs" variant="outline" onClick={() => setCats([...cats, { ...NEW_CATEGORY }])} className="gap-1"><Plus /> Add category</Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 rounded-xl border border-status-info-border bg-status-info-surface p-3 text-xs text-status-info-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                {kind === "RECOGNITION"
                  ? <>You're creating the <strong>{year}</strong> Vincentian, Louisian, Special and Longevity awards as drafts. </>
                  : <>You're creating <strong>{kind === "CUSTOM" ? custom.title.trim() || "a custom award" : info.title} — {period}</strong> as a draft. </>}
                {kind === "RECOGNITION" ? "They appear under Manage Awards; open each one and follow its steps" : "It opens right after, with its steps"}: {info.flow.join(" → ")}.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-border pt-3">
          {step === 1 ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          ) : (
            <Button variant="ghost" disabled={busy} onClick={() => setStep(1)} className="gap-1"><ArrowLeft /> Back</Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} className="gap-1">Next <ArrowRight /></Button>
          ) : (
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create draft</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
