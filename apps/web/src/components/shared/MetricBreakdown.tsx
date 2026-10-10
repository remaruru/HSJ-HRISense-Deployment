import React from 'react';
import { Calculator, CheckCircle2, CircleDashed, Info, MinusCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { cn } from '@/lib/utils';

/**
 * The one way HRISense explains a percentage.
 *
 * Every percentage, rate or progress value can open this breakdown: the value,
 * the exact formula, every contributing item with its own figures and status,
 * a TOTAL row, and what was excluded. The card that opens it stays concise.
 *
 * Status is always written out (icon + text), never colour alone, and every
 * colour comes from the semantic status tokens so light and dark mode match.
 */

export type BreakdownTone = 'success' | 'danger' | 'warning' | 'accent' | 'neutral' | 'total';

export interface BreakdownRow {
  label: string;
  /** One value per data column (after the label column). */
  cells: React.ReactNode[];
  status?: { text: string; tone: BreakdownTone };
  note?: string | null;
  /** Rendered subdued, e.g. excluded or not-applicable items. */
  muted?: boolean;
}

export interface BreakdownSection {
  heading?: string;
  rows: BreakdownRow[];
}

export interface MetricBreakdownSpec {
  title: string;
  /** The headline, exactly as the card shows it ("74%", "No data"). */
  value: string;
  caption?: string;
  /** The calculation, one line per step. */
  formula?: string[];
  /** Column headers: the first is the label column. */
  columns: string[];
  sections: BreakdownSection[];
  total?: { label: string; cells: React.ReactNode[] };
  notes?: string[];
}

const TONE_ICON: Record<BreakdownTone, React.ElementType> = {
  success: CheckCircle2,
  total: CheckCircle2,
  danger: XCircle,
  warning: CircleDashed,
  accent: Info,
  neutral: MinusCircle,
};

export function MetricBreakdownDialog({
  open,
  onOpenChange,
  spec,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: MetricBreakdownSpec | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0 bg-surface border-border-soft">
        {spec && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border-soft text-left">
              <DialogTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{spec.title}</DialogTitle>
              <p className="text-3xl font-extrabold font-heading text-foreground tabular-nums">{spec.value}</p>
              {spec.caption ? (
                <DialogDescription className="text-sm text-muted-foreground">{spec.caption}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">How this figure is calculated</DialogDescription>
              )}
            </DialogHeader>

            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {spec.formula && spec.formula.length > 0 && (
                <div className="rounded-xl border border-border-soft bg-surface-2 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Calculation
                  </p>
                  {spec.formula.map((line, i) => (
                    <p key={i} className="text-sm text-foreground tabular-nums">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-border-soft">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {spec.columns.map((c, i) => (
                        <th key={i} scope="col" className={cn('px-3 py-2 font-semibold whitespace-nowrap', i === 0 ? 'text-left' : 'text-right')}>
                          {c}
                        </th>
                      ))}
                      {spec.sections.some((s) => s.rows.some((r) => r.status)) && (
                        <th scope="col" className="px-3 py-2 font-semibold text-left">
                          Status
                        </th>
                      )}
                    </tr>
                  </thead>
                  {spec.sections.map((section, si) => {
                    const hasStatus = spec.sections.some((s) => s.rows.some((r) => r.status));
                    return (
                      <tbody key={si} className="border-t border-border-soft">
                        {section.heading && (
                          <tr className="bg-background">
                            <th colSpan={spec.columns.length + (hasStatus ? 1 : 0)} scope="colgroup" className="px-3 pt-3 pb-1 text-left text-xs font-bold text-foreground">
                              {section.heading}
                            </th>
                          </tr>
                        )}
                        {section.rows.map((row, ri) => {
                          const Icon = row.status ? TONE_ICON[row.status.tone] : null;
                          return (
                            <tr key={ri} className={cn('border-t border-border-soft/60 align-top', row.muted && 'text-muted-foreground')}>
                              <td className="px-3 py-2">
                                <span className={cn('font-medium', row.muted ? 'text-muted-foreground' : 'text-foreground')}>{row.label}</span>
                                {row.note && <span className="block text-[11px] text-muted-foreground mt-0.5">{row.note}</span>}
                              </td>
                              {row.cells.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                              {hasStatus && (
                                <td className="px-3 py-2">
                                  {row.status && Icon && (
                                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', STATUS_TONE_CHIP[row.status.tone])}>
                                      <Icon className="h-3 w-3" aria-hidden="true" /> {row.status.text}
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                  {spec.total && (
                    <tfoot className="border-t-2 border-border bg-status-total-surface/60">
                      <tr>
                        <th scope="row" className="px-3 py-2.5 text-left font-bold text-foreground">
                          {spec.total.label}
                        </th>
                        {spec.total.cells.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2.5 text-right font-bold tabular-nums text-foreground whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                        {spec.sections.some((s) => s.rows.some((r) => r.status)) && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {spec.notes && spec.notes.length > 0 && (
                <ul className="space-y-1">
                  {spec.notes.map((n, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-muted-foreground leading-relaxed">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The small link-style trigger placed under a percentage. */
export function BreakdownButton({
  onClick,
  label = 'View breakdown',
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline dark:text-primary-300 dark:hover:text-primary-200',
        className
      )}
    >
      <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> {label}
    </button>
  );
}

/** Convenience: a spec for a simple count-based rate. */
export function ratioSpec(input: {
  title: string;
  value: number | null;
  numeratorLabel: string;
  numerator: number;
  denominatorLabel: string;
  denominator: number;
  /** Every category that exists, and whether it is in the denominator. */
  parts?: Array<{ label: string; count: number; included: boolean; inNumerator?: boolean; note?: string }>;
  notes?: string[];
  caption?: string;
}): MetricBreakdownSpec {
  const value = input.value === null ? 'No data' : `${Number(input.value.toFixed(1))}%`;
  return {
    title: input.title,
    value,
    caption: input.caption,
    formula:
      input.denominator > 0 && input.value !== null
        ? [
            `${input.numeratorLabel}: ${input.numerator}`,
            `${input.denominatorLabel}: ${input.denominator}`,
            `${input.numerator} ÷ ${input.denominator} × 100 = ${value}`,
          ]
        : [`${input.denominatorLabel} is 0, so there is no percentage to show.`],
    columns: ['Category', 'Count', 'In the calculation'],
    sections: [
      {
        rows: (input.parts ?? []).map((p) => ({
          label: p.label,
          note: p.note,
          muted: !p.included,
          cells: [String(p.count), p.included ? (p.inNumerator ? 'Numerator and total' : 'Total only') : 'Excluded'],
        })),
      },
    ],
    total: { label: input.denominatorLabel, cells: [String(input.denominator), ''] },
    notes: input.notes,
  };
}
