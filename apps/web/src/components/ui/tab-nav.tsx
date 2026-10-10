import React from "react";
import { cn } from "@/lib/utils";

export interface TabNavItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** Rendered as a subtle count pill. Omit when a count is meaningless. */
  count?: number;
}

export interface TabNavProps<T extends string = string> {
  items: TabNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Utility controls pinned to the right of the tab strip (e.g. Refresh). */
  trailing?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function TabNav<T extends string = string>({
  items,
  value,
  onChange,
  trailing,
  className,
  "aria-label": ariaLabel,
}: TabNavProps<T>) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {/*
        Segmented container, not underlined text. Every tab is a filled box so
        it reads as something you can press — the flat underline style tested
        badly with non-technical users. The track scrolls horizontally when the
        tabs outgrow it (Employee Detail has up to 17).
      */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-surface-2 border border-border-soft p-1.5 min-w-0"
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`tabpanel-${item.id}`}
              onClick={() => onChange(item.id)}
              className={cn(
                "group relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 shrink-0",
                "text-sm font-semibold transition-colors duration-200 [&_svg]:size-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  // Filled surface + brand text + a soft ring: obvious at a glance
                  // without shouting, and it survives dark mode.
                  ? "bg-surface text-primary-700 dark:text-primary-200 shadow-sm ring-1 ring-primary-200 dark:ring-primary-800"
                  : "text-muted-foreground hover:bg-surface/70 hover:text-foreground"
              )}
            >
              {item.icon && (
                <span aria-hidden="true" className="shrink-0">
                  {item.icon}
                </span>
              )}
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-colors",
                    active
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-950/70 dark:text-primary-200"
                      : "bg-surface text-muted-foreground"
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  );
}
