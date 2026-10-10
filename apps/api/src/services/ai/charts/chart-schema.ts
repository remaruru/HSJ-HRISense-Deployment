import { z } from 'zod';

/**
 * Charts in the assistant — how numbers reach a picture without the model
 * ever supplying them.
 *
 *  1. A data tool that computes a breakdown registers it as a DATASET in the
 *     request's `DatasetStore` and tells the model only its id (`ds1`), its
 *     title and its series names.
 *  2. The model may ask for a chart by id: `{ datasetId, type, seriesKeys? }`.
 *  3. The server builds the chart payload from the stored rows, validates it
 *     against `chartPayloadSchema`, and sends it to the browser, which renders
 *     it with Recharts from a fixed component set.
 *
 * Consequences: a chart can only show numbers a tool computed for THIS user in
 * THIS request (so charts inherit the tool's authorization); the model cannot
 * invent or alter a value; and nothing the model writes is ever executed as
 * code or HTML.
 */

export const CHART_TYPES = ['bar', 'line', 'area', 'pie'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Safe object keys for chart rows (no `__proto__`, no spaces, no markup). */
const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
export const MAX_CHART_POINTS = 62;
export const MAX_PIE_SLICES = 12;
export const MAX_SERIES = 6;
export const MAX_CHARTS_PER_ANSWER = 3;

export interface DatasetSeries {
  key: string;
  label: string;
}

export interface Dataset {
  id: string;
  title: string;
  /** The category / date field. */
  xKey: string;
  xLabel: string;
  /** `date` datasets are ordered in time and suit line/area charts. */
  xType: 'category' | 'date';
  series: DatasetSeries[];
  rows: Array<Record<string, string | number | null>>;
  /** Unit of the values, e.g. "employees", "hours", "%". */
  unit?: string;
  /**
   * Extra columns shown only in the chart's "View data" table — for a
   * percentage chart, the counts behind each percentage (numerator, total).
   */
  details?: DatasetSeries[];
}

/** What the model may send inside `submit_answer`. */
export const chartRequestSchema = z
  .object({
    datasetId: z.string().regex(/^ds\d{1,3}$/),
    type: z.enum(CHART_TYPES),
    title: z.string().min(1).max(80).optional(),
    seriesKeys: z.array(z.string().regex(SAFE_KEY)).min(1).max(MAX_SERIES).optional(),
  })
  .strict();
export type ChartRequest = z.infer<typeof chartRequestSchema>;

/** What the browser receives. Validated server-side before sending. */
export const chartPayloadSchema = z
  .object({
    type: z.enum(CHART_TYPES),
    title: z.string().min(1).max(120),
    xKey: z.string().regex(SAFE_KEY),
    xLabel: z.string().max(60),
    unit: z.string().max(20).optional(),
    series: z
      .array(z.object({ key: z.string().regex(SAFE_KEY), label: z.string().min(1).max(60) }).strict())
      .min(1)
      .max(MAX_SERIES),
    /** Table-only columns: the counts behind a percentage chart. */
    details: z
      .array(z.object({ key: z.string().regex(SAFE_KEY), label: z.string().min(1).max(60) }).strict())
      .max(6)
      .optional(),
    data: z
      .array(z.record(z.string().regex(SAFE_KEY), z.union([z.string().max(80), z.number().finite(), z.null()])))
      .min(1)
      .max(MAX_CHART_POINTS),
  })
  .strict();
export type ChartPayload = z.infer<typeof chartPayloadSchema>;

export class DatasetStore {
  private readonly datasets = new Map<string, Dataset>();
  private counter = 0;

  /** Registers a dataset and returns its id. Invalid or empty datasets are refused. */
  add(input: Omit<Dataset, 'id'>): string | null {
    if (!input.rows.length || !input.series.length) return null;
    // Nothing to plot (every value null or zero): no chart — the text states it.
    const hasValue = input.rows.some((r) => input.series.some((s) => typeof r[s.key] === 'number' && r[s.key] !== 0));
    if (!hasValue) return null;
    if (!SAFE_KEY.test(input.xKey) || [...input.series, ...(input.details ?? [])].some((s) => !SAFE_KEY.test(s.key))) {
      throw new Error(`Dataset "${input.title}" uses an unsafe key.`);
    }
    this.counter += 1;
    const id = `ds${this.counter}`;
    this.datasets.set(id, { ...input, id, rows: input.rows.slice(0, MAX_CHART_POINTS) });
    return id;
  }

  get(id: string): Dataset | undefined {
    return this.datasets.get(id);
  }

  get size(): number {
    return this.datasets.size;
  }
}

export type ChartBuildResult = { ok: true; chart: ChartPayload } | { ok: false; reason: string };

/** Builds a chart from a stored dataset. Never trusts a value from the model. */
export function buildChart(store: DatasetStore, request: ChartRequest): ChartBuildResult {
  const dataset = store.get(request.datasetId);
  if (!dataset) return { ok: false, reason: `No dataset ${request.datasetId} was produced for this question.` };

  let series = dataset.series;
  if (request.seriesKeys) {
    const wanted = new Set(request.seriesKeys);
    series = dataset.series.filter((s) => wanted.has(s.key));
    if (series.length !== wanted.size) return { ok: false, reason: 'The chart asked for a series the data does not have.' };
  }
  series = series.slice(0, MAX_SERIES);

  if (request.type === 'pie') {
    series = series.slice(0, 1);
    if (dataset.rows.length > MAX_PIE_SLICES) return { ok: false, reason: 'Too many categories for a pie chart.' };
  }
  if ((request.type === 'line' || request.type === 'area') && dataset.rows.length < 2) {
    return { ok: false, reason: 'A trend chart needs at least two points.' };
  }

  const data = dataset.rows.map((row) => {
    const out: Record<string, string | number | null> = { [dataset.xKey]: String(row[dataset.xKey] ?? '—').slice(0, 80) };
    for (const s of [...series, ...(dataset.details ?? [])]) {
      const v = row[s.key];
      out[s.key] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    return out;
  });

  if (request.type === 'pie') {
    const key = series[0].key;
    const values = data.map((d) => d[key]);
    if (values.some((v) => typeof v === 'number' && v < 0)) return { ok: false, reason: 'A pie chart cannot show negative values.' };
    if (!values.some((v) => typeof v === 'number' && v > 0)) return { ok: false, reason: 'There is nothing to show in a pie chart.' };
  }

  const candidate = {
    type: request.type,
    title: (request.title ?? dataset.title).slice(0, 120),
    xKey: dataset.xKey,
    xLabel: dataset.xLabel.slice(0, 60),
    ...(dataset.unit ? { unit: dataset.unit.slice(0, 20) } : {}),
    series: series.map((s) => ({ key: s.key, label: s.label.slice(0, 60) })),
    ...(dataset.details?.length ? { details: dataset.details.slice(0, 6).map((d) => ({ key: d.key, label: d.label.slice(0, 60) })) } : {}),
    data,
  };
  const parsed = chartPayloadSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: 'The chart did not pass validation.' };
  return { ok: true, chart: parsed.data };
}

/** A compact description of a dataset for the model — ids and names, not rows. */
export function describeDataset(store: DatasetStore, id: string | null): { datasetId: string; title: string; series: string[]; points: number } | null {
  if (!id) return null;
  const ds = store.get(id);
  if (!ds) return null;
  return { datasetId: ds.id, title: ds.title, series: ds.series.map((s) => s.key), points: ds.rows.length };
}
