import { useMemo, useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** One choice in a PillPicker. `section` groups pills under a small heading. */
export interface PillOption {
  id: string;
  label: string;
  hint?: string;
  section?: string;
}

/**
 * Tap-to-select pills with a search box. Easier to scan than a column of tiny
 * checkboxes, and what is chosen stands out at a glance. Long lists show the
 * chosen pills plus the first `limit` others until something is typed.
 */
export function PillPicker({
  options,
  selected,
  onChange,
  searchLabel,
  limit,
  empty = "Nothing matches that search.",
}: {
  options: PillOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchLabel: string;
  limit?: number;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const sections = useMemo(() => {
    if (query) {
      const bySection = new Map<string, PillOption[]>();
      for (const o of options.filter((x) => `${x.label} ${x.hint ?? ""} ${x.section ?? ""}`.toLowerCase().includes(query))) {
        bySection.set(o.section ?? "", [...(bySection.get(o.section ?? "") ?? []), o]);
      }
      return [...bySection.entries()];
    }
    // Without a search, what is already chosen comes first, so it is never lost far down a long list.
    const chosen = options.filter((o) => selected.includes(o.id));
    let rest = options.filter((o) => !selected.includes(o.id));
    if (limit) rest = rest.slice(0, limit);
    const bySection = new Map<string, PillOption[]>();
    if (chosen.length) bySection.set("Chosen", chosen);
    for (const o of rest) bySection.set(o.section ?? (chosen.length ? "Others" : ""), [...(bySection.get(o.section ?? (chosen.length ? "Others" : "")) ?? []), o]);
    return [...bySection.entries()];
  }, [options, query, limit, selected]);

  const hidden = !query && limit ? Math.max(0, options.length - selected.length - limit) : 0;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{searchLabel}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchLabel}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <div className="max-h-[min(22rem,45vh)] space-y-3 overflow-y-auto pr-1">
        {sections.length === 0 && <p className="py-2 text-xs text-muted-foreground">{empty}</p>}
        {sections.map(([section, opts]) => (
          <div key={section} className="space-y-1.5">
            {section && <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{section}</p>}
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {opts.map((o) => {
                const on = selected.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      "inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors",
                      on
                        ? "border-primary-600 bg-primary-500 text-white dark:border-primary-400 dark:bg-primary-600"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    )}
                  >
                    {on ? (
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" aria-hidden="true" />
                    )}
                    <span className="min-w-0 truncate">{o.label}</span>
                    {o.hint && <span className="min-w-0 max-w-[45%] shrink-0 truncate opacity-70">· {o.hint}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {hidden > 0 && <p className="text-xs text-muted-foreground">{hidden} more — type a name to find them.</p>}
      </div>
    </div>
  );
}

export type StepState = "done" | "current" | "upcoming";

export interface GuideStep {
  key: string;
  title: string;
  state: StepState;
  /** One line on what the step is; always shown. */
  summary?: string;
  /** Instructions and buttons; shown on the current step. */
  body?: ReactNode;
}

/** A numbered, vertical list of steps: done ones ticked, the current one open. */
export function StepList({ steps, label }: { steps: GuideStep[]; label: string }) {
  return (
    <ol aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className={cn("absolute bottom-0 left-[15px] top-8 w-0.5", s.state === "done" ? "bg-status-success-border" : "bg-border")}
            />
          )}
          <span
            className={cn(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
              s.state === "done" && "border-status-success-border bg-status-success-surface text-status-success-foreground",
              s.state === "current" && "border-primary-500 bg-primary-500 text-white",
              s.state === "upcoming" && "border-border bg-surface text-muted-foreground"
            )}
          >
            {s.state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <p className={cn("text-sm font-bold", s.state === "upcoming" ? "text-muted-foreground" : "text-foreground")}>
              {s.title}
              {s.state === "done" && <span className="sr-only"> (done)</span>}
              {s.state === "current" && (
                <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                  You are here
                </span>
              )}
            </p>
            {s.summary && <p className="mt-0.5 text-xs text-muted-foreground">{s.summary}</p>}
            {s.state === "current" && s.body && <div className="mt-3">{s.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A short "how it works" row of numbered steps, for the top of a page. */
export function HowItWorks({ steps }: { steps: Array<{ title: string; text: string }> }) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">{s.title}</span>
            <span className="block text-xs text-muted-foreground">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
