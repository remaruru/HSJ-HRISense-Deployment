import React from "react";
import { cn } from "@/lib/utils";

/**
 * `onboarding` — nothing has been created yet. Explains what the feature is for
 *   and offers the create action.
 * `filtered`   — records exist but the current search/filter excludes them all.
 *   Must never suggest creating anything; it offers Clear Filters instead.
 * `error`      — the request failed. Shows the server message and a retry.
 *
 * Keeping these visually distinct matters: an onboarding panel shown after a
 * search reads as "your data is gone".
 */
export type EmptyStateVariant = "onboarding" | "filtered" | "error";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  variant = "onboarding",
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const isOnboarding = variant === "onboarding";
  const isError = variant === "error";

  return (
    <div
      className={cn(
        "text-center flex flex-col items-center",
        isOnboarding ? "px-6 py-16" : "px-6 py-12",
        className
      )}
      role={isError ? "alert" : undefined}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center rounded-2xl",
            isOnboarding && "h-14 w-14 bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-300",
            variant === "filtered" && "h-11 w-11 bg-surface-2 text-muted-foreground",
            isError && "h-11 w-11 bg-danger-light text-danger-dark dark:bg-danger/15 dark:text-danger"
          )}
        >
          {icon}
        </span>
      )}

      <h3
        className={cn(
          "mt-4 font-heading font-bold text-foreground",
          isOnboarding ? "text-base" : "text-sm",
          isError && "text-danger-dark dark:text-danger"
        )}
      >
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  );
}
