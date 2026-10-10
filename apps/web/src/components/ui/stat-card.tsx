import React from "react";
import { cn } from "@/lib/utils";

/**
 * Semantic tone for a summary tile.
 *
 * Tone follows MEANING, never decoration: a count of expired records is
 * `danger` in Medical, in Compliance and on the dashboard alike. The label and
 * the number always carry the meaning too, so a tile never depends on colour
 * alone.
 *
 *   total    — a general count (brand teal)
 *   success  — healthy, complete, active, available
 *   warning  — pending, needs attention, expiring soon
 *   danger   — missing, expired, rejected, non-compliant
 *   info     — informational or awaiting-a-person states
 *   accent   — module identity (Psychological records)
 *   neutral  — no status meaning at all
 */
export type StatCardTone =
  | "total"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "neutral";

interface ToneStyles {
  surface: string;
  chip: string;
  value: string;
  ring: string;
}

const TONES: Record<StatCardTone, ToneStyles> = {
  total: {
    surface: "bg-status-total-surface border-status-total-border",
    chip: "bg-status-total-foreground/10 text-status-total-foreground",
    value: "text-status-total-foreground",
    ring: "ring-status-total-foreground/40",
  },
  success: {
    surface: "bg-status-success-surface border-status-success-border",
    chip: "bg-status-success-foreground/10 text-status-success-foreground",
    value: "text-status-success-foreground",
    ring: "ring-status-success-foreground/40",
  },
  warning: {
    surface: "bg-status-warning-surface border-status-warning-border",
    chip: "bg-status-warning-foreground/10 text-status-warning-foreground",
    value: "text-status-warning-foreground",
    ring: "ring-status-warning-foreground/40",
  },
  danger: {
    surface: "bg-status-danger-surface border-status-danger-border",
    chip: "bg-status-danger-foreground/10 text-status-danger-foreground",
    value: "text-status-danger-foreground",
    ring: "ring-status-danger-foreground/40",
  },
  info: {
    surface: "bg-status-info-surface border-status-info-border",
    chip: "bg-status-info-foreground/10 text-status-info-foreground",
    value: "text-status-info-foreground",
    ring: "ring-status-info-foreground/40",
  },
  accent: {
    surface: "bg-status-accent-surface border-status-accent-border",
    chip: "bg-status-accent-foreground/10 text-status-accent-foreground",
    value: "text-status-accent-foreground",
    ring: "ring-status-accent-foreground/40",
  },
  neutral: {
    surface: "bg-status-neutral-surface border-status-neutral-border",
    chip: "bg-status-neutral-foreground/10 text-status-neutral-foreground",
    value: "text-foreground",
    ring: "ring-status-neutral-foreground/40",
  },
};

export interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Short qualifier under the number, e.g. "Awaiting evaluator start". */
  hint?: string;
  tone?: StatCardTone;
  /** Renders placeholder bars at the same box height — no layout shift. */
  loading?: boolean;
  /** Makes the tile a filter control (Medical and Psychological use this). */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * Single summary tile. Fixed internal rhythm (label + icon → number → hint) so
 * a row of these stays aligned however long each label is.
 */
export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
  onClick,
  selected = false,
  className,
}: StatCardProps) {
  const t = TONES[tone];
  const interactive = typeof onClick === "function";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* 14px, not 12px: these labels are read at a glance, often by people
            who are not looking for them. */}
        <p className="text-sm font-semibold text-foreground/80 leading-tight">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center [&_svg]:size-5",
              t.chip
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <>
          <div className="skeleton mt-3 h-9 w-14 rounded-lg" />
          <div className="skeleton mt-2 h-3 w-24 rounded" />
        </>
      ) : (
        <>
          <p
            className={cn(
              "mt-3 text-4xl font-bold font-heading leading-none tabular-nums",
              t.value
            )}
          >
            {value}
          </p>
          {/* Grey muted text fails on the Hospicio fills (as low as 3.2:1).
              The card's own foreground at 70% stays under the label and
              measures ≥5.5:1 on every fill. */}
          <p className="mt-2 text-xs leading-tight text-foreground/70">
            {hint ?? " "}
          </p>
        </>
      )}
    </>
  );

  const shell = cn(
    "rounded-2xl border p-4 text-left transition-all duration-200",
    t.surface,
    interactive && "cursor-pointer hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    selected && cn("ring-2 ring-offset-1 ring-offset-background", t.ring),
    className
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={shell}>
        {body}
      </button>
    );
  }

  return (
    <div
      className={shell}
      role="group"
      aria-label={loading ? `${label}: loading` : `${label}: ${String(value)}`}
    >
      {body}
    </div>
  );
}
