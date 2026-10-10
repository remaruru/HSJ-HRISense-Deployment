import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "This could not be loaded" — the ERROR state of a data-driven section, kept
 * visibly different from its EMPTY state ("No records yet"). A failed load must
 * never look like there is simply nothing to show.
 *
 * `onRetry` adds a Try Again button; only pass it for safe reads (GET), never
 * for a write that could be duplicated.
 */
export function LoadError({
  message,
  onRetry,
  className,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
  /** Inline strip instead of a centred block. */
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-status-danger-border bg-status-danger-surface text-status-danger-foreground',
        compact ? 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3' : 'flex flex-col items-center gap-3 px-6 py-8 text-center',
        className
      )}
    >
      <div className={cn('flex gap-2', compact ? 'min-w-0 flex-1 items-start' : 'flex-col items-center')}>
        <AlertCircle className={cn('shrink-0', compact ? 'mt-0.5 h-4 w-4' : 'h-6 w-6')} aria-hidden="true" />
        <p className="min-w-0 break-words text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0 gap-1.5 bg-surface">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try Again
        </Button>
      )}
    </div>
  );
}
