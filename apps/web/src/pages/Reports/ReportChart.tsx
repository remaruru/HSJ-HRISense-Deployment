import { useEffect, useState } from 'react';
import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Check, Clock, AlertTriangle, Eye, Minus, Table2, BarChart3 } from 'lucide-react';
import { distribution, formatPct, ratio } from '@/lib/percent';
import { cn } from '@/lib/utils';
import { CHART_THEME, sliceColor, TONE_ICON, type ReportTone } from './chartTheme';

/**
 * One chart in a report.
 *
 * Mark specs follow the house rules: bars capped at 24px with a 4px rounded
 * data-end square at the baseline, hairline grid, no border around any mark —
 * the separation is a 2px gap in the surface colour. Values are labelled at the
 * bar tip and the axis carries the rest.
 *
 * Every chart here is a horizontal bar, including the ones the server calls a
 * "share". That is deliberate: these categories have long names (unit names,
 * leave types, pipeline stages), and a horizontal bar reads them without
 * rotating text — where a pie would make five similar wedges impossible to rank.
 */

export interface ReportChartSpec {
  id: string;
  title: string;
  subtitle?: string;
  encoding: 'status' | 'ordinal' | 'nominal';
  kind: 'bar' | 'share';
  slices: Array<{ label: string; value: number; tone?: ReportTone }>;
  total?: number;
  emptyMessage?: string;
}

const ICONS = { check: Check, clock: Clock, alert: AlertTriangle, eye: Eye, minus: Minus };

function useIsDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDark(el.classList.contains('dark')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * Shares for the slices. When the slices make up the whole total they are
 * apportioned so the labels add up to exactly 100%; when they are a subset,
 * each is its own share of the total. No total → no percentages.
 */
function sliceShares(values: number[], total?: number): Array<number | null> {
  if (!total || total <= 0) return values.map(() => null);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === total) return distribution(values) ?? values.map(() => null);
  return values.map((v) => ratio(v, total));
}

export function ReportChart({ spec }: { spec: ReportChartSpec }) {
  const isDark = useIsDark();
  const mode = isDark ? CHART_THEME.dark : CHART_THEME.light;

  const data = spec.slices.map((s, i) => ({
    ...s,
    fill: sliceColor(mode, spec.encoding, i, spec.slices.length, s.tone),
  }));

  const hasData = data.some((d) => d.value > 0);
  const shares = sliceShares(data.map((d) => d.value), spec.total);
  // The text at the bar tip: count and share, precomputed so it cannot drift from the table.
  const labelled = data.map((d, i) => ({ ...d, labelText: shares[i] !== null ? `${d.value} · ${formatPct(shares[i])}` : String(d.value) }));
  const shareOf = (label: string) => shares[data.findIndex((d) => d.label === label)] ?? null;
  const [showData, setShowData] = useState(false);
  // ~34px per bar keeps the 24px cap with air around it.
  const height = Math.max(150, data.length * 34 + 24);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">{spec.title}</h3>
          {spec.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{spec.subtitle}</p>}
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => setShowData((v) => !v)}
            aria-pressed={showData}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            {showData ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            {showData ? 'View chart' : 'View data'}
          </button>
        )}
      </div>

      {hasData && showData ? (
        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Category</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Count</th>
                {spec.total ? <th scope="col" className="px-3 py-2 text-right font-semibold">Share of {spec.total}</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label} className="border-t border-border-soft">
                  <td className="px-3 py-1.5 text-foreground">{d.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.value}</td>
                  {spec.total ? <td className="px-3 py-1.5 text-right tabular-nums">{formatPct(shares[i])}</td> : null}
                </tr>
              ))}
            </tbody>
            {spec.total ? (
              <tfoot className="border-t-2 border-border">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-bold">Total</th>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{spec.total}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {data.reduce((a, d) => a + d.value, 0) === spec.total ? '100%' : `${formatPct(ratio(data.reduce((a, d) => a + d.value, 0), spec.total))} shown`}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
          {spec.total ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border-soft">
              Share = count ÷ {spec.total} × 100. When the categories make up the whole, shares are rounded so they total exactly 100%.
            </p>
          ) : null}
        </div>
      ) : !hasData ? (
        <p className="py-8 text-center text-sm text-muted-foreground italic">
          {spec.emptyMessage ?? 'Nothing to show for these filters.'}
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={labelled} layout="vertical" margin={{ top: 0, right: 78, bottom: 0, left: 0 }} barCategoryGap={10}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={148}
                tickLine={false}
                axisLine={false}
                // Axis text wears a text token, never the series colour.
                tick={{ fill: mode.axis, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: isDark ? '#ffffff0d' : '#0f172a08' }}
                contentStyle={{
                  background: mode.surface,
                  border: `1px solid ${mode.grid}`,
                  borderRadius: 12,
                  fontSize: 12,
                  color: isDark ? '#d5dde6' : '#0f172a',
                }}
                formatter={(value, _name, item: any) => {
                  const n = Number(value ?? 0);
                  const p = shareOf(item?.payload?.label);
                  return [p !== null ? `${n} of ${spec.total} (${formatPct(p)})` : String(n), 'Count'] as [string, string];
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                <LabelList dataKey="labelText" position="right" fill={mode.axis} fontSize={12} />
                {data.map((d) => (
                  // No stroke: marks are separated by the gap, never a border.
                  <Cell key={d.label} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Status charts carry a legend with an icon per state, so meaning
              never rests on colour alone. Single-hue charts need no legend —
              the title already names what is plotted. */}
          {spec.encoding === 'status' && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border-soft">
              {data.map((d) => {
                const Icon = ICONS[(TONE_ICON[d.tone ?? 'neutral'] ?? 'minus') as keyof typeof ICONS];
                return (
                  <li key={d.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.fill }} aria-hidden="true" />
                    <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {d.label}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** The KPI row. A headline number is a stat tile, not a one-bar chart. */
export function ReportStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-2xl border border-border bg-surface p-4',
      emphasis && 'bg-nav-selected-surface/30'
    )}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
