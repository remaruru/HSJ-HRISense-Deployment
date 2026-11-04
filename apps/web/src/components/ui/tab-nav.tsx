import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Which ends still hide tabs. Re-measured on scroll and whenever the strip or
  // its tabs change size (window resize, sidebar collapse, counts loading).
  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, items]);

  // A mouse wheel has no sideways motion: let its up/down scroll the strip while
  // the tabs overflow, so the hidden ones can be reached without a trackpad.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return; // let the page scroll on
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keep the selected tab in sight.
  useEffect(() => {
    const el = trackRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active) return;
    const left = active.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, left - 48), behavior: "smooth" });
    }
  }, [value]);

  const scrollBy = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {/*
        Segmented container, not underlined text. Every tab is a filled box so
        it reads as something you can press — the flat underline style tested
        badly with non-technical users. The track scrolls horizontally when the
        tabs outgrow it (Employee Detail has up to 17); arrows appear at an end
        that hides tabs.
      */}
      <div className="relative min-w-0">
        <div
          ref={trackRef}
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

        {canLeft && <ScrollArrow side="left" onClick={() => scrollBy(-1)} />}
        {canRight && <ScrollArrow side="right" onClick={() => scrollBy(1)} />}
      </div>

      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  );
}

/** An arrow over one end of the strip, on a fade so the cut-off tab reads as "more this way". */
function ScrollArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-px flex items-center rounded-2xl from-surface-2 via-surface-2/90 to-transparent",
        side === "left" ? "left-px bg-gradient-to-r pl-1 pr-6" : "right-px bg-gradient-to-l pr-1 pl-6"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={side === "left" ? "Show earlier tabs" : "Show more tabs"}
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-surface text-foreground shadow-sm hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {side === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
