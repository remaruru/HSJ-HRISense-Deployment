import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleChoicesOf, type RatingScaleOption } from '@/services/evaluation.service';
import { weightStatus } from '@/lib/evaluationWeights';

type ScaleSource = Parameters<typeof scaleChoicesOf>[0];

/**
 * A template's answer choices, from its ACTUAL configuration — "5 — Excellent …
 * 1 — Unsatisfactory", a numeric range, or "written response only".
 */
export function RatingScaleList({
  template,
  order = 'desc',
  compact = false,
  className,
}: {
  template: ScaleSource;
  order?: 'asc' | 'desc';
  compact?: boolean;
  className?: string;
}) {
  const { kind, options } = scaleChoicesOf(template);
  const lines = (opts: RatingScaleOption[]) => (order === 'desc' ? [...opts].reverse() : opts);

  if (kind === 'WRITTEN') {
    return (
      <ul className={cn('text-xs text-muted-foreground space-y-0.5', className)}>
        <li>Written response / comments only</li>
        <li>No numeric score</li>
      </ul>
    );
  }
  if (kind === 'NUMERIC' && !options.length) {
    return (
      <ul className={cn('text-xs text-muted-foreground space-y-0.5', className)}>
        <li>Minimum: {template?.minScore ?? 1}</li>
        <li>Maximum: {template?.maxScore ?? 5}</li>
      </ul>
    );
  }
  if (kind === 'NUMERIC') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Minimum: {template?.minScore ?? 1} · Maximum: {template?.maxScore ?? 5}
      </p>
    );
  }
  return (
    <ul className={cn(compact ? 'text-xs space-y-0.5' : 'text-sm space-y-1', className)}>
      {lines(options).map((o) => (
        <li key={o.value} className="flex items-baseline gap-2">
          {kind === 'LABELED_NUMERIC' && (
            <span className="w-5 shrink-0 text-right font-bold tabular-nums text-foreground">{o.score}</span>
          )}
          {kind === 'LABELED_NUMERIC' && <span aria-hidden="true" className="text-muted-foreground">—</span>}
          <span className="text-foreground">{o.label}</span>
          {o.code && <span className="text-[11px] text-muted-foreground">({o.code})</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Total Weight: 80% / 100% · 20% remaining" — the status is in the words and
 * the icon as well as the colour.
 */
export function WeightTotalChip({ weights, className }: { weights: Array<number | string | null | undefined>; className?: string }) {
  const s = weightStatus(weights);
  const Icon = s.status === 'EXACT' ? CheckCircle2 : s.status === 'UNDER' ? MinusCircle : AlertTriangle;
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold sm:text-sm',
        s.status === 'EXACT'
          ? 'bg-status-success-surface text-status-success-foreground border-status-success-border'
          : s.status === 'UNDER'
            ? 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border'
            : 'bg-status-danger-surface text-status-danger-foreground border-status-danger-border',
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      Total Weight: {s.label}
    </span>
  );
}
