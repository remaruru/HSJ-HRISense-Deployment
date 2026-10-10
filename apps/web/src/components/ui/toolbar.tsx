import React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One cohesive strip that owns search + filters + the strip-level action, so a
 * screen never grows a second competing row of controls.
 */
export function Toolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border border-border-soft bg-surface p-3",
        "sm:flex-row sm:items-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Pushes everything after it to the right edge of the toolbar. */
export function ToolbarSpacer() {
  return <div className="hidden sm:block sm:flex-1" />;
}

export interface SearchFieldProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Shown to screen readers; the visible cue is the placeholder. */
  label: string;
  containerClassName?: string;
}

export function SearchField({
  value,
  onValueChange,
  label,
  className,
  containerClassName,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn("relative w-full sm:w-72", containerClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "transition-colors hover:border-border",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
          className
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FilterSelectProps extends React.ComponentProps<"select"> {
  /** Shown to screen readers; the first option carries the visible meaning. */
  label: string;
}

export function FilterSelect({
  label,
  className,
  children,
  ...props
}: FilterSelectProps) {
  return (
    <select
      aria-label={label}
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
        "transition-colors hover:border-border cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        "sm:w-auto",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
