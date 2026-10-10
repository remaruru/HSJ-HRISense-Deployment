import { cn } from "@/lib/utils";

/**
 * Shared layout pieces for record screens (Employee Detail and anything else
 * that shows stored values rather than a form).
 *
 * The rules they encode, so tabs cannot drift apart again:
 *   • one soft-bordered panel per topic, not one card per field
 *   • a heading on every panel, with its own actions beside it
 *   • labels and values in a fixed hierarchy, so a column of values scans
 *   • a short line when a section is empty, never a tall blank panel
 */

export function InfoSection({
  title,
  description,
  action,
  missingCount,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Buttons that belong to THIS section — kept beside its heading. */
  action?: React.ReactNode;
  /** Completion items still missing here; the fields themselves are marked. */
  missingCount?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border-soft bg-surface p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
            {title}
            {!!missingCount && missingCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-status-danger-border bg-status-danger-surface px-2 py-0.5 text-[11px] font-bold text-status-danger-foreground">
                {missingCount} missing
              </span>
            )}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Value grid. Two columns on tablets; three only where the values are short
 * enough to stay readable, which the caller decides.
 */
export function InfoGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        className
      )}
    >
      {children}
    </dl>
  );
}

export function InfoField({
  label,
  value,
  span,
  missing,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  /** Long values (addresses, notes) take the full row. */
  span?: boolean;
  /**
   * The field counts toward profile completion and is not filled in. Only pass
   * this from the API's `missingFieldIds` — an optional field that is merely
   * blank should stay a quiet "Not provided".
   */
  missing?: boolean;
  className?: string;
}) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "Not provided";

  if (missing) {
    return (
      <div
        className={cn(
          "min-w-0 rounded-xl border border-status-danger-border bg-status-danger-surface px-3 py-2 -mx-1",
          span && "sm:col-span-2 lg:col-span-3",
          className
        )}
      >
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-status-danger-foreground">
          {label}
        </dt>
        <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-status-danger-foreground">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-danger-foreground shrink-0" />
          {isEmpty ? "Missing" : value}
        </dd>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", span && "sm:col-span-2 lg:col-span-3", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm break-words",
          isEmpty ? "text-muted-foreground italic" : "font-medium text-foreground"
        )}
      >
        {isEmpty ? "Not provided" : value}
      </dd>
    </div>
  );
}

/** One concise line for a section with nothing in it yet. */
export function InfoEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}
