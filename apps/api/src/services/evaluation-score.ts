/**
 * The evaluation overall score — one function, used when an evaluation is
 * submitted (the stored `overallScore`) and to explain that score afterwards.
 *
 *   CRITERIA, weighted  (template weighting on; weights total 100%):
 *       overall = Σ rating × weight ÷ 100
 *   CRITERIA, unweighted:
 *       overall = average of the ratings given
 *   AREA_WEIGHTED  (review areas carry the weights, total 100%):
 *       area average = total of the area's ratings ÷ statements rated
 *       overall      = Σ area average × area weight ÷ 100
 *   AREA_AVERAGE   (the Simplified form's printed rule):
 *       area average = total of the area's ratings ÷ statements rated  ("÷ 3")
 *       overall      = Σ area averages ÷ areas rated                    ("÷ 10")
 *   Labelled templates are scored through the values configured for their
 *   labels (Excellent = 5 …); written / descriptive templates have no score.
 *
 * Area averages and contributions are rounded to 2 decimals before they are
 * added, so the breakdown shown always adds up to the overall exactly.
 */

export interface ScoreCriterion {
  id: string;
  name: string;
  weight?: number | null;
  groupId?: string | null;
}

export interface ScoreGroup {
  id: string;
  name: string;
  weight?: number | null;
}

export interface ScoreResponse {
  criterionId: string;
  ratingNumeric?: number | null;
}

export interface ScoreBreakdownRow {
  criterionId: string;
  name: string;
  rating: number | null;
  /** Percent weight (weighted templates only). */
  weight: number | null;
  /** rating × weight ÷ 100 (weighted) — or null. */
  contribution: number | null;
}

export interface ScoreAreaRow {
  groupId: string;
  name: string;
  itemCount: number;
  ratedCount: number;
  total: number;
  average: number | null;
  /** AREA_WEIGHTED only. */
  weight: number | null;
  contribution: number | null;
}

export interface ScoreBreakdown {
  method: 'WEIGHTED' | 'AVERAGE' | 'AREA_WEIGHTED' | 'AREA_AVERAGE' | 'NOT_NUMERIC';
  rows: ScoreBreakdownRow[];
  areas?: ScoreAreaRow[];
  totalWeight: number | null;
  overallScore: number | null;
  /** Sum of every rating given, and the most it could be. */
  rawTotal?: number | null;
  rawMax?: number | null;
  ratedCount?: number;
  itemCount?: number;
  /** Overall ÷ scale maximum × 100, 2 decimals (null when there is no score or maximum). */
  overallPercent?: number | null;
  formula: string;
}

export interface RatingScaleOption {
  value: string;
  label: string;
  /** The number this answer counts as — null when the template gives it none. */
  score: number | null;
}

export interface RatingScale {
  /** Every answer has a number: a numeric scale, or labels that each carry a value. */
  scored: boolean;
  /** Evaluators answer with labels (the number is looked up, never typed). */
  labelled: boolean;
  min: number | null;
  max: number | null;
  options: RatingScaleOption[];
}

/**
 * A template's rating scale as configured — its own labels and values, never a
 * scale assumed for every template. A numeric template is scored on its range;
 * a labelled one only when each of its labels carries a value.
 */
export function ratingScaleOf(t: { ratingMethod?: string | null; scoreLabels?: any; minScore?: number | null; maxScore?: number | null } | null | undefined): RatingScale {
  const options: RatingScaleOption[] = (Array.isArray(t?.scoreLabels?.options) ? t!.scoreLabels.options : []).map((o: any) => ({
    value: String(o?.value ?? ''),
    label: String(o?.label ?? ''),
    score: o?.score === undefined || o?.score === null || o?.score === '' || !Number.isFinite(Number(o.score)) ? null : Number(o.score),
  }));
  if (t?.ratingMethod === 'NUMERIC') {
    return { scored: true, labelled: false, min: Number(t.minScore ?? 1), max: Number(t.maxScore ?? 5), options };
  }
  const scored = options.length > 0 && options.every((o) => o.score !== null);
  const scores = options.map((o) => o.score as number);
  return { scored, labelled: true, min: scored ? Math.min(...scores) : null, max: scored ? Math.max(...scores) : null, options };
}

/** The configured value of the label an evaluator chose (matched by its stored value, then its wording). */
export function scoreForLabel(scale: RatingScale, answer: string | null | undefined): number | null {
  const a = String(answer ?? '').trim();
  if (!a) return null;
  const opt = scale.options.find((o) => o.value === a) ?? scale.options.find((o) => o.label.trim().toLowerCase() === a.toLowerCase());
  return opt?.score ?? null;
}

const r2 = (n: number) => Number(n.toFixed(2));

export function computeEvaluationScore(input: {
  ratingMethod: string;
  /** The answers carry numbers (numeric scale, or labels with values). Defaults to ratingMethod === 'NUMERIC'. */
  scored?: boolean;
  useWeighting: boolean;
  scoringMethod?: string | null;
  groups?: ScoreGroup[] | null;
  criteria: ScoreCriterion[];
  responses: ScoreResponse[];
  maxScore?: number | null;
}): ScoreBreakdown {
  const b = scoreOf(input);
  const max = input.maxScore ? Number(input.maxScore) : null;
  return { ...b, overallPercent: b.overallScore !== null && max ? r2((b.overallScore / max) * 100) : null };
}

function scoreOf(input: Parameters<typeof computeEvaluationScore>[0]): ScoreBreakdown {
  const byCriterion = new Map(input.responses.map((r) => [r.criterionId, r]));
  if (!(input.scored ?? input.ratingMethod === 'NUMERIC')) {
    return { method: 'NOT_NUMERIC', rows: [], totalWeight: null, overallScore: null, formula: 'This template records written answers, or labels without values, so it has no numeric score.' };
  }

  const ratingOf = (id: string) => {
    const raw = byCriterion.get(id)?.ratingNumeric;
    return raw === undefined || raw === null || Number.isNaN(Number(raw)) ? null : Number(raw);
  };
  const ratings = input.criteria.map((c) => ratingOf(c.id)).filter((x): x is number => x !== null);
  const rawTotal = r2(ratings.reduce((n, x) => n + x, 0));
  const rawMax = input.maxScore ? input.criteria.length * Number(input.maxScore) : null;
  const counts = { rawTotal, rawMax, ratedCount: ratings.length, itemCount: input.criteria.length };
  const of = input.maxScore ? ` of ${input.maxScore}` : '';

  const scoring = input.scoringMethod ?? 'CRITERIA';
  if ((scoring === 'AREA_WEIGHTED' || scoring === 'AREA_AVERAGE') && input.groups?.length) {
    const areas: ScoreAreaRow[] = input.groups.map((g) => {
      const items = input.criteria.filter((c) => c.groupId === g.id);
      const rated = items.map((c) => ratingOf(c.id)).filter((x): x is number => x !== null);
      const total = r2(rated.reduce((n, x) => n + x, 0));
      const average = rated.length ? r2(total / rated.length) : null;
      const weight = scoring === 'AREA_WEIGHTED' ? Number(g.weight || 0) : null;
      return {
        groupId: g.id, name: g.name, itemCount: items.length, ratedCount: rated.length, total, average, weight,
        contribution: weight === null ? null : r2((average ?? 0) * weight / 100),
      };
    });
    const rows = input.criteria.map((c) => ({ criterionId: c.id, name: c.name, rating: ratingOf(c.id), weight: null, contribution: null }));

    if (scoring === 'AREA_WEIGHTED') {
      const totalWeight = r2(areas.reduce((n, a) => n + (a.weight ?? 0), 0));
      const overallScore = totalWeight > 0 && ratings.length ? r2(areas.reduce((n, a) => n + (a.contribution ?? 0), 0)) : null;
      return {
        method: 'AREA_WEIGHTED', rows, areas, totalWeight, overallScore, ...counts,
        formula: overallScore === null
          ? 'No statement has been rated.'
          : `Σ (area average × area weight ÷ 100) over ${areas.length} review areas = ${overallScore}${of} (weights total ${totalWeight}%)`,
      };
    }

    const ratedAreas = areas.filter((a) => a.average !== null);
    const sum = r2(ratedAreas.reduce((n, a) => n + (a.average ?? 0), 0));
    const overallScore = ratedAreas.length ? r2(sum / ratedAreas.length) : null;
    return {
      method: 'AREA_AVERAGE', rows, areas, totalWeight: null, overallScore, ...counts,
      formula: overallScore === null
        ? 'No statement has been rated.'
        : `Each factor: total ÷ statements rated = average. Overall: ${sum} (sum of ${ratedAreas.length} factor averages) ÷ ${ratedAreas.length} = ${overallScore}${of}`,
    };
  }

  if (input.useWeighting) {
    let weightedSum = 0;
    let totalWeight = 0;
    const rows = input.criteria.map((c) => {
      const rating = ratingOf(c.id);
      const weight = Number(c.weight || 0);
      // An unrated weighted criterion counts as 0 — the same as at submission.
      const contribution = (rating ?? 0) * (weight / 100);
      weightedSum += contribution;
      totalWeight += weight;
      return { criterionId: c.id, name: c.name, rating, weight, contribution: r2(contribution) };
    });
    const overallScore = totalWeight > 0 ? r2(weightedSum) : null;
    return {
      method: 'WEIGHTED',
      rows,
      totalWeight: r2(totalWeight),
      overallScore,
      ...counts,
      formula:
        overallScore === null
          ? 'No weights are set.'
          : `Σ (rating × weight ÷ 100) over ${rows.length} criteria = ${overallScore}${of} (weights total ${r2(totalWeight)}%)`,
    };
  }

  const sum = ratings.reduce((n, x) => n + x, 0);
  const overallScore = ratings.length ? r2(sum / ratings.length) : null;
  return {
    method: 'AVERAGE',
    rows: input.criteria.map((c) => ({ criterionId: c.id, name: c.name, rating: ratingOf(c.id), weight: null, contribution: null })),
    totalWeight: null,
    overallScore,
    ...counts,
    formula:
      overallScore === null
        ? 'No criterion has been rated.'
        : `${r2(sum)} total of ${ratings.length} rated criteria ÷ ${ratings.length} = ${overallScore}${of}`,
  };
}
