/**
 * Percentage weights for evaluations — criterion / review-area weights and the
 * self / peer / head contribution weights of a cycle.
 *
 * Weights are handled in HUNDREDTHS of a percent (integers), so a total is
 * exactly 100 or it is not: no 99.99 / 100.01 from floating-point sums.
 */

/** 12.5 → 1250. Weights carry at most two decimals. */
export const toHundredths = (w: number | string | null | undefined): number => {
  const n = Number(w);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const fromHundredths = (h: number): number => h / 100;

/**
 * Splits 100% across `n` criteria: an equal share in hundredths, with the last
 * one absorbing the rounding remainder — 3 → 33.33, 33.33, 33.34; 4 → 25 each.
 * An HRISense convenience, never a weight printed on Hospicio's forms.
 */
export function distributeWeights(n: number): number[] {
  if (!Number.isInteger(n) || n <= 0) return [];
  const base = Math.floor(10000 / n);
  const parts = new Array<number>(n).fill(base);
  parts[n - 1] = 10000 - base * (n - 1);
  return parts.map(fromHundredths);
}

export interface WeightTotal {
  /** Total in hundredths of a percent. */
  hundredths: number;
  /** Total as a percent (exact to two decimals). */
  percent: number;
  status: 'EXACT' | 'UNDER' | 'OVER';
  /** How far from 100, in percent (always ≥ 0). */
  difference: number;
}

export function weightTotal(weights: Array<number | string | null | undefined>): WeightTotal {
  const hundredths = weights.reduce<number>((sum, w) => sum + toHundredths(w), 0);
  const status = hundredths === 10000 ? 'EXACT' : hundredths < 10000 ? 'UNDER' : 'OVER';
  return { hundredths, percent: fromHundredths(hundredths), status, difference: fromHundredths(Math.abs(10000 - hundredths)) };
}

/** Null when the weights are usable; otherwise why not. */
export function weightsProblem(weights: Array<number | string | null | undefined>, what = 'Weights'): string | null {
  for (const w of weights) {
    const n = Number(w);
    if (w === null || w === undefined || w === '' || !Number.isFinite(n)) return `${what}: every weight needs a number.`;
    if (n < 0 || n > 100) return `${what}: each weight must be between 0 and 100.`;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return `${what}: use at most two decimal places.`;
  }
  const t = weightTotal(weights);
  if (t.status === 'UNDER') return `${what} total ${t.percent}% — ${t.difference}% short of 100%.`;
  if (t.status === 'OVER') return `${what} total ${t.percent}% — ${t.difference}% over 100%.`;
  return null;
}

// ─── Self / peer / head contributions ─────────────────────────────────────────

export interface SourceWeights {
  self: number;
  peer: number;
  head: number;
}

/**
 * Hospicio de San Jose's official evaluation weighting, confirmed by Hospicio:
 * the employee's self rating 20%, the peer rating 20% (however many peers),
 * the head / supervisor / coordinator rating 60%. Every new cycle uses it;
 * a cycle that differs records why (audited). This is the ONE place it is set.
 */
export const HOSPICIO_SOURCE_WEIGHTS: Readonly<SourceWeights> = Object.freeze({ self: 20, peer: 20, head: 60 });

export const isOfficialSourceWeights = (w: Partial<SourceWeights> | null | undefined) =>
  !!w &&
  toHundredths(w.self) === toHundredths(HOSPICIO_SOURCE_WEIGHTS.self) &&
  toHundredths(w.peer) === toHundredths(HOSPICIO_SOURCE_WEIGHTS.peer) &&
  toHundredths(w.head) === toHundredths(HOSPICIO_SOURCE_WEIGHTS.head);

/** Null when the three contribution weights are usable (each 0–100, total exactly 100). */
export function sourceWeightsProblem(w: Partial<SourceWeights> | null | undefined): string | null {
  if (!w) return 'Set the self, peer and head / supervisor / coordinator percentages.';
  return weightsProblem([w.self as number, w.peer as number, w.head as number], 'Self + peer + head percentages');
}

const r2 = (n: number) => Number(n.toFixed(2));
const r4 = (n: number) => Number(n.toFixed(4));

export type RatingSource = 'SELF' | 'PEER' | 'HEAD';

export interface SourceRating {
  /** The assignment's overall score (null until submitted). */
  overall: number | null;
  submitted: boolean;
  /** Sum of the item ratings and the most it could have been (for "raw score"). */
  rawTotal?: number | null;
  rawMax?: number | null;
}

export interface CombinedSourceRow {
  source: RatingSource;
  label: string;
  /** Evaluators assigned for this source, and how many have submitted. */
  evaluators: number;
  submitted: number;
  /** Self / head: their raw total. Peers: not summed across evaluators. */
  rawTotal: number | null;
  rawMax: number | null;
  /**
   * Self / head: their overall score. Peers: the average of the submitted peers'
   * overall scores, to 4 decimals (4.20, 4.00, 4.30 → 4.1667).
   */
  average: number | null;
  /** Contribution weight in percent. */
  weight: number;
  /** average × weight ÷ 100. */
  contribution: number | null;
}

export interface CombinedResult {
  rows: CombinedSourceRow[];
  /** Σ contributions, or null while a weighted source has no submitted rating. */
  final: number | null;
  /** The scale's maximum (e.g. 5) and final ÷ maximum × 100, 2 decimals. */
  maxScore: number | null;
  finalPercent: number | null;
  missing: string[];
  formula: string;
}

const SOURCE_LABEL: Record<RatingSource, string> = {
  SELF: 'Self rating',
  PEER: 'Peer rating',
  HEAD: 'Head / supervisor / coordinator rating',
};

/**
 * The final combined rating, computed on the server with fixed arithmetic.
 *
 *   source average  — self: the self rating's overall score;
 *                     peer: the average of the submitted peers' overall scores,
 *                           4 decimals (several peers share the ONE peer weight
 *                           — three peers at 20% still contribute 20% in total);
 *                     head: the head evaluation's overall score.
 *   contribution    = source average × source weight ÷ 100   (2 decimals)
 *   final           = Σ contributions                         (2 decimals)
 *   equivalent %    = final ÷ scale maximum × 100             (2 decimals)
 *
 * Every figure is rounded BEFORE it is used in the next step, so the numbers
 * shown reproduce the final exactly (4.00×20% + 4.25×20% + 4.50×60% =
 * 0.80 + 0.85 + 2.70 = 4.35 → 87%).
 *
 * A source with a weight above 0 and no submitted rating leaves the final
 * rating incomplete (null) rather than silently re-weighting the others.
 */
export function computeCombinedResult(input: {
  weights: SourceWeights;
  self: SourceRating | null;
  peers: SourceRating[];
  head: SourceRating | null;
  maxScore?: number | null;
}): CombinedResult {
  const rows: CombinedSourceRow[] = [];
  const missing: string[] = [];

  const single = (source: RatingSource, r: SourceRating | null, weight: number): CombinedSourceRow => {
    const average = r && r.submitted && r.overall !== null ? r2(r.overall) : null;
    return {
      source, label: SOURCE_LABEL[source],
      evaluators: r ? 1 : 0, submitted: r && r.submitted ? 1 : 0,
      rawTotal: r && r.submitted ? r.rawTotal ?? null : null,
      rawMax: r && r.submitted ? r.rawMax ?? null : null,
      average, weight,
      contribution: average === null ? null : r2((average * weight) / 100),
    };
  };

  rows.push(single('SELF', input.self, input.weights.self));

  const done = input.peers.filter((p) => p.submitted && p.overall !== null);
  const peerAverage = done.length ? r4(done.reduce((n, p) => n + Number(p.overall), 0) / done.length) : null;
  rows.push({
    source: 'PEER', label: SOURCE_LABEL.PEER,
    evaluators: input.peers.length, submitted: done.length,
    rawTotal: null, rawMax: null,
    average: peerAverage, weight: input.weights.peer,
    contribution: peerAverage === null ? null : r2((peerAverage * input.weights.peer) / 100),
  });

  rows.push(single('HEAD', input.head, input.weights.head));

  // A rating that was submitted but has no number (a form whose answers carry no
  // values) is named as such — it is not "not submitted".
  const unscored: Record<RatingSource, boolean> = {
    SELF: Boolean(input.self?.submitted && input.self.overall === null),
    PEER: done.length === 0 && input.peers.some((p) => p.submitted && p.overall === null),
    HEAD: Boolean(input.head?.submitted && input.head.overall === null),
  };
  for (const row of rows) {
    if (row.weight > 0 && row.contribution === null) {
      missing.push(
        row.evaluators === 0
          ? `${row.label}: no evaluator assigned`
          : unscored[row.source]
            ? `${row.label}: submitted, but the form's answers have no numeric values`
            : `${row.label}: not submitted yet`
      );
    }
  }

  const final = missing.length ? null : r2(rows.reduce((n, r) => n + (r.contribution ?? 0), 0));
  const maxScore = input.maxScore ? Number(input.maxScore) : null;
  const finalPercent = final !== null && maxScore ? r2((final / maxScore) * 100) : null;
  const fmt = (n: number | null) => (n === null ? '0.00' : n.toFixed(2));
  // Averages show 2 decimals, or 4 when the peer average needs them (4.1667).
  const avgText = (n: number | null) => (n === null ? '0.00' : Number.isInteger(Math.round(n * 10000) / 100) ? n.toFixed(2) : String(n));
  const formula = final === null
    ? `Incomplete — ${missing.join('; ')}. Nothing is re-weighted: the result waits for every component.`
    : `${rows.map((r) => `${avgText(r.average)} × ${r.weight}%`).join(' + ')} = ${rows.map((r) => fmt(r.contribution)).join(' + ')} = ${fmt(final)}${maxScore ? ` of ${maxScore}` : ''}` +
      (finalPercent !== null ? ` (${fmt(final)} ÷ ${maxScore} × 100 = ${finalPercent}%)` : '');
  return { rows, final, maxScore, finalPercent, missing, formula };
}
