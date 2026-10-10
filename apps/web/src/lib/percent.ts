/**
 * Percentages in the browser — the SAME rules as the API (apps/api/src/lib/percent.ts):
 *  • a rate is part ÷ whole × 100, shown to at most one decimal place;
 *  • no denominator → no percentage (shown as "No data"), never NaN/Infinity;
 *  • parts of one whole are apportioned (largest remainder) to total exactly 100;
 *  • unrelated rates are never added together.
 * Prefer a percentage the API already computed; these are for values that only
 * exist in the browser (e.g. an unsaved draft) and for splitting a whole.
 */

export function ratio(part: number, whole: number, decimals = 1): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  const f = 10 ** decimals;
  return Math.round((part / whole) * 100 * f) / f;
}

export function apportion(values: number[], target: number, decimals = 1): number[] {
  if (!values.length) return [];
  const f = 10 ** decimals;
  const scaled = values.map((v) => (Number.isFinite(v) ? Math.max(0, v) * f : 0));
  const out = scaled.map(Math.floor);
  let remaining = Math.round(target * f) - out.reduce((a, b) => a + b, 0);
  const order = scaled.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; remaining > 0; k = (k + 1) % order.length, remaining--) out[order[k].i] += 1;
  let guard = order.length * 2 + Math.abs(remaining);
  for (let k = order.length - 1; remaining < 0 && guard-- > 0; k = (k - 1 + order.length) % order.length) {
    if (out[order[k].i] > 0) {
      out[order[k].i] -= 1;
      remaining++;
    }
  }
  return out.map((v) => v / f);
}

/** Shares of one whole that total exactly 100 (null when the total is zero). */
export function distribution(counts: number[], decimals = 1): number[] | null {
  const total = counts.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
  if (total <= 0) return null;
  return apportion(counts.map((c) => (Math.max(0, c) / total) * 100), 100, decimals);
}

/** `74%`, `85.7%`, or the fallback when there is no percentage. */
export function formatPct(value: number | null | undefined, fallback = 'No data'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${Number(value.toFixed(1))}%`;
}

/** `12` or `3.75` — points and counts without float noise. */
export function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(2)));
}
