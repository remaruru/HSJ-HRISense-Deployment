/**
 * Percentages — the ONE set of rules every HRISense figure follows.
 *
 *  • A rate is `part ÷ whole × 100`, shown to at most one decimal place
 *    (a trailing `.0` is dropped: 75, 85.7).
 *  • A zero, negative or missing denominator has NO percentage (`null`), which
 *    screens show as "No data" / "Not applicable" — never NaN, Infinity or 0%.
 *  • Parts of one whole (read/unread, a status distribution, criteria weights)
 *    are apportioned with the largest-remainder method so the displayed parts
 *    add up to exactly the displayed total. The raw counts are never altered.
 *  • Unrelated rates are never added together.
 */

/** `part ÷ whole × 100`, rounded to `decimals`; null when there is no denominator. */
export function ratio(part: number, whole: number, decimals = 1): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  const f = 10 ** decimals;
  return Math.round((part / whole) * 100 * f) / f;
}

/**
 * Rounds `values` to `decimals` so that they sum to exactly `target` (largest
 * remainder / Hamilton method). Used for the parts of one whole.
 */
export function apportion(values: number[], target: number, decimals = 1): number[] {
  if (!values.length) return [];
  const f = 10 ** decimals;
  const scaled = values.map((v) => (Number.isFinite(v) ? Math.max(0, v) * f : 0));
  const floors = scaled.map(Math.floor);
  let remaining = Math.round(target * f) - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = [...floors];
  // Give missing units to the largest remainders…
  for (let k = 0; remaining > 0; k = (k + 1) % order.length, remaining--) out[order[k].i] += 1;
  // …or take surplus units back from the smallest remainders (never below zero).
  let guard = order.length * 2 + Math.abs(remaining);
  for (let k = order.length - 1; remaining < 0 && guard-- > 0; k = (k - 1 + order.length) % order.length) {
    if (out[order[k].i] > 0) {
      out[order[k].i] -= 1;
      remaining++;
    }
  }
  return out.map((v) => v / f);
}

/** Shares of a whole that total exactly 100 (null when the total is zero). */
export function distribution(counts: number[], decimals = 1): number[] | null {
  const total = counts.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
  if (total <= 0) return null;
  return apportion(counts.map((c) => (Math.max(0, c) / total) * 100), 100, decimals);
}

/** `74%`, `85.7%`, or the given fallback when there is no percentage. */
export function formatPercent(value: number | null | undefined, fallback = 'No data'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${Number(value.toFixed(1))}%`;
}

/** "37 of 50 (74%)" — the count, the total and the percentage together. */
export function share(part: number, whole: number): string {
  const p = ratio(part, whole);
  return p === null ? String(part) : `${part} of ${whole} (${formatPercent(p)})`;
}
