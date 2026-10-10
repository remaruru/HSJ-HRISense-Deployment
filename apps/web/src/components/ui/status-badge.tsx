import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  label: string;
  /**
   * Colour classes owned by the feature's own status map (e.g.
   * `TRAINING_STATUS_META[status].badgeClass`). This component deliberately does
   * NOT define its own palette — statuses come from the existing enums so the
   * badge can never drift from the source of truth.
   */
  className?: string;
  /** Optional leading glyph. Also gives the badge a non-colour cue. */
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

/**
 * Unifies the *shape* of every status pill (radius, padding, weight, alignment)
 * while leaving the *colour* to the caller's enum metadata.
 */
export function StatusBadge({
  label,
  className,
  icon,
  size = "md",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {icon && (
        <span aria-hidden="true" className="shrink-0 flex items-center">
          {icon}
        </span>
      )}
      {label}
    </span>
  );
}
