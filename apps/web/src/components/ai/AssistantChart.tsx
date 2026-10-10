import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import type { AssistantChartData } from '@/services/ai-assistant.service';

/**
 * Draws a chart the SERVER built (from data a tool computed for this user).
 * The payload is validated before it gets here; this component only maps it
 * onto a fixed set of Recharts components — nothing in it can execute.
 *
 * Categorical palette: validated with the dataviz palette validator against
 * HRISense's own chart surfaces (light #ffffff, dark #1b232d):
 *   light #2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 — all checks pass
 *   dark  #3987e5 #d95926 #199e70 #c98500 #d55181 #008300 — all checks pass
 * Three light hues sit under 3:1 against white; the required relief is here:
 * a legend for every multi-series chart, a tooltip on every mark, and the
 * "View data" table.
 */

const PALETTE = {
  light: { series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'], grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff' },
  dark: { series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'], grid: '#2a3440', axis: '#8d9aa9', surface: '#1b232d' },
};

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDark(el.classList.contains('dark')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

const formatNumber = (v: unknown) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v === null ? '—' : String(v));

export function AssistantChart({ chart, compact = false }: { chart: AssistantChartData; compact?: boolean }) {
  const dark = useIsDark();
  const theme = dark ? PALETTE.dark : PALETTE.light;
  const [showTable, setShowTable] = useState(false);
  const height = compact ? 210 : 260;
  const multi = chart.series.length > 1;
  const color = (i: number) => theme.series[i % theme.series.length];

  const tooltip = (
    <Tooltip
      formatter={(value: any, name: any) => [`${formatNumber(value)}${chart.unit && chart.unit !== '%' ? ` ${chart.unit}` : chart.unit === '%' ? '%' : ''}`, name]}
      contentStyle={{ background: theme.surface, border: `1px solid ${theme.grid}`, borderRadius: 12, fontSize: 12 }}
      labelStyle={{ color: theme.axis, fontWeight: 600 }}
      cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
    />
  );
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={theme.grid} strokeDasharray="0" />
      <XAxis dataKey={chart.xKey} tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={{ stroke: theme.grid }} interval="preserveStartEnd" minTickGap={8} />
      <YAxis tick={{ fontSize: 11, fill: theme.axis }} tickLine={false} axisLine={false} width={40} allowDecimals />
    </>
  );
  const legend = multi ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} /> : null;

  let body: React.ReactElement;
  if (chart.type === 'pie') {
    const key = chart.series[0].key;
    body = (
      <PieChart>
        <Pie data={chart.data} dataKey={key} nameKey={chart.xKey} innerRadius="52%" outerRadius="80%" paddingAngle={2} stroke={theme.surface} strokeWidth={2} isAnimationActive={false}>
          {chart.data.map((_, i) => (
            <Cell key={i} fill={color(i)} />
          ))}
        </Pie>
        {tooltip}
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    );
  } else if (chart.type === 'line') {
    body = (
      <LineChart data={chart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {axes}
        {tooltip}
        {legend}
        {chart.series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    );
  } else if (chart.type === 'area') {
    body = (
      <AreaChart data={chart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {axes}
        {tooltip}
        {legend}
        {chart.series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(i)} strokeWidth={2} fill={color(i)} fillOpacity={0.18} connectNulls isAnimationActive={false} />
        ))}
      </AreaChart>
    );
  } else {
    body = (
      <BarChart data={chart.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2}>
        {axes}
        {tooltip}
        {legend}
        {chart.series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(i)} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }

  return (
    <figure className="rounded-2xl border border-border-soft bg-surface p-3.5">
      <figcaption className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{chart.title}</p>
          {chart.unit && <p className="text-[11px] text-muted-foreground">Values in {chart.unit}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          aria-pressed={showTable}
        >
          {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'View chart' : 'View data'}
        </button>
      </figcaption>

      {showTable ? (
        <div className="max-h-64 overflow-auto rounded-xl border border-border-soft">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                <th scope="col" className="px-2.5 py-1.5 text-left font-semibold">{chart.xLabel}</th>
                {chart.series.map((s) => (
                  <th key={s.key} scope="col" className="px-2.5 py-1.5 text-right font-semibold">{s.label}{chart.unit === '%' ? ' (%)' : ''}</th>
                ))}
                {(chart.details ?? []).map((d) => (
                  <th key={d.key} scope="col" className="px-2.5 py-1.5 text-right font-semibold text-muted-foreground">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.map((row, i) => (
                <tr key={i} className="border-t border-border-soft">
                  <td className="px-2.5 py-1.5">{String(row[chart.xKey] ?? '—')}</td>
                  {chart.series.map((s) => (
                    <td key={s.key} className="px-2.5 py-1.5 text-right tabular-nums">{formatNumber(row[s.key])}</td>
                  ))}
                  {(chart.details ?? []).map((d) => (
                    <td key={d.key} className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(row[d.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={`${chart.title}. Use "View data" for the figures.`}>
          {/* initialDimension lets the chart draw before the container is measured
              (and when rendered on the server); the real width replaces it at once. */}
          <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 480, height }}>
            {body}
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
