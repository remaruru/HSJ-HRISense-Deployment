import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "circle" | "rect" | "avatar" | "text-block" | "card";
  lines?: number;
}

export function Skeleton({
  className,
  variant = "rect",
  lines = 3,
  ...props
}: SkeletonProps) {
  if (variant === "text-block") {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "skeleton h-4 rounded",
              i === lines - 1 && "w-4/5"
            )}
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div className={cn("flex items-center gap-3", className)} {...props}>
        <div className="skeleton h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-surface p-5 space-y-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 rounded w-full" />
          <div className="skeleton h-4 rounded w-5/6" />
          <div className="skeleton h-4 rounded w-4/6" />
        </div>
        <div className="skeleton h-24 rounded-xl w-full" />
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div
        className={cn("skeleton rounded-full", className)}
        {...props}
      />
    );
  }

  if (variant === "line") {
    return <div className={cn("skeleton h-4 rounded w-full", className)} {...props} />;
  }

  return <div className={cn("skeleton rounded-xl", className)} {...props} />;
}

/** Page-level skeleton — mirrors a typical dashboard page layout */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton variant="line" className="h-8 w-64" />
        <Skeleton variant="line" className="h-4 w-96" />
      </div>

      {/* Metric cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-surface p-5 space-y-3"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between">
              <Skeleton variant="circle" className="h-10 w-10" />
              <Skeleton variant="line" className="h-3 w-12" />
            </div>
            <Skeleton variant="line" className="h-8 w-16" />
            <Skeleton variant="line" className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Chart + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Skeleton variant="card" className="h-72" />
        </div>
        <div className="space-y-4">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton variant="line" className="h-5 w-32" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton variant="avatar" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Row placeholder for a data table. Renders the same row height and column
 * count as the real table so switching from loading to loaded does not shift
 * the page.
 */
export function TableSkeleton({
  rows = 5,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border-soft", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-5 py-4"
          style={{ animationDelay: `${r * 0.04}s` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className={cn(
                "skeleton h-4 rounded",
                c === 0 ? "w-1/4" : "flex-1",
                c === columns - 1 && "w-16 flex-none"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
