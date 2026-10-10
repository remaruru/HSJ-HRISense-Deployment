import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Side navigation for long record screens (Employee Detail has up to 17
 * sections — too many for a horizontal strip, which cut the last tabs off).
 *
 * Desktop: a grouped vertical rail. Below `lg` the same list becomes a single
 * horizontally scrolling row, so there is one piece of markup and one source
 * of state.
 *
 * Each item can carry a completion status:
 *   • `missing: n` — a red count, "n things still needed in this section"
 *   • `complete`   — a green check, the section is fully filled in
 *   • neither      — the section is not part of profile completion
 */

export interface SectionNavItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** Number of completion items still missing in this section. */
  missing?: number;
  /** Section takes part in completion and has nothing missing. */
  complete?: boolean;
}

export interface SectionNavGroup<T extends string = string> {
  label: string;
  items: SectionNavItem<T>[];
}

export function SectionNav<T extends string = string>({
  groups,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  groups: SectionNavGroup<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "rounded-2xl border border-border-soft bg-surface shadow-card",
        "p-1.5 lg:p-2",
        className
      )}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible lg:gap-3"
      >
        {groups.map((group) => (
          <div
            key={group.label}
            role="presentation"
            className="flex gap-1 shrink-0 lg:flex-col lg:gap-0.5"
          >
            {/* Group headings only make sense in the vertical rail. */}
            <p className="hidden lg:block px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>

            {group.items.map((item) => {
              const active = item.id === value;
              const hasMissing = typeof item.missing === "number" && item.missing > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`section-${item.id}`}
                  onClick={() => onChange(item.id)}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 lg:py-2 shrink-0",
                    "text-sm whitespace-nowrap text-left transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary-50 text-primary-700 font-bold dark:bg-primary-950/50 dark:text-primary-200"
                      : "text-secondary-foreground font-medium hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  {/* Active marker: a bar on the rail, invisible in the row. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary-500 transition-opacity hidden lg:block",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />

                  {item.icon && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 [&_svg]:size-[18px]",
                        active ? "text-primary-600 dark:text-primary-300" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      {item.icon}
                    </span>
                  )}

                  <span className="lg:flex-1 min-w-0 truncate">{item.label}</span>

                  {hasMissing && (
                    <span
                      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-status-danger-foreground px-1.5 text-[11px] font-bold leading-none text-white dark:text-status-danger-surface tabular-nums"
                      title={`${item.missing} item${item.missing === 1 ? "" : "s"} missing`}
                    >
                      {item.missing}
                      <span className="sr-only"> missing</span>
                    </span>
                  )}
                  {!hasMissing && item.complete && (
                    <span
                      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-success-surface text-status-success-foreground"
                      title="Complete"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      <span className="sr-only">complete</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
