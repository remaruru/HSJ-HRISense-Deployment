/**
 * Percentage weights for evaluation templates and cycles — the same arithmetic
 * as the API (apps/api/src/services/evaluation-weights.ts), so what HR sees
 * while editing is exactly what the server will accept.
 *
 * Weights are counted in HUNDREDTHS of a percent (integers): a total is exactly
 * 100 or it is not — never 99.99 / 100.01 from floating-point sums.
 */

export const toHundredths = (w: number | string | null | undefined): number => {
  const n = typeof w === 'string' ? parseFloat(w) : Number(w);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * Splits 100% across `n` items: an equal share in hundredths, the last one
 * absorbing the rounding remainder — 3 → 33.33, 33.33, 33.34.
 */
export function distributeWeights(n: number): number[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  const base = Math.floor(10000 / n);
  const parts = new Array<number>(n).fill(base);
  parts[n - 1] = 10000 - base * (n - 1);
  return parts.map((h) => h / 100);
}

export interface WeightStatus {
  /** Total as a percent, exact to two decimals. */
  total: number;
  status: 'EXACT' | 'UNDER' | 'OVER';
  /** Distance from 100 in percent (≥ 0). */
  difference: number;
  /** "100% / 100% · Ready", "80% / 100% · 20% remaining", "110% / 100% · 10% over". */
  label: string;
}

const fmt = (n: number) => String(Number(n.toFixed(2)));

export function weightStatus(weights: Array<number | string | null | undefined>): WeightStatus {
  const h = weights.reduce<number>((sum, w) => sum + toHundredths(w), 0);
  const status = h === 10000 ? 'EXACT' : h < 10000 ? 'UNDER' : 'OVER';
  const total = h / 100;
  const difference = Math.abs(10000 - h) / 100;
  const tail = status === 'EXACT' ? 'Ready' : status === 'UNDER' ? `${fmt(difference)}% remaining` : `${fmt(difference)}% over`;
  return { total, status, difference, label: `${fmt(total)}% / 100% · ${tail}` };
}
