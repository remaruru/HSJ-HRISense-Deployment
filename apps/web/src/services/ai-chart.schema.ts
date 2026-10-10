import { z } from 'zod';

/**
 * The chart contract between the API (`chartPayloadSchema` in
 * apps/api/src/services/ai/charts/chart-schema.ts) and the browser. Kept in its
 * own module, with no other imports, so it can be checked against real API
 * payloads outside the browser.
 */

const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

export const chartSchema = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']),
  title: z.string().max(120),
  xKey: z.string().regex(SAFE_KEY),
  xLabel: z.string().max(60),
  unit: z.string().max(20).optional(),
  series: z.array(z.object({ key: z.string().regex(SAFE_KEY), label: z.string().max(60) })).min(1).max(6),
  /** Table-only columns: the counts behind a percentage chart. */
  details: z.array(z.object({ key: z.string().regex(SAFE_KEY), label: z.string().max(60) })).max(6).optional(),
  data: z.array(z.record(z.string().regex(SAFE_KEY), z.union([z.string().max(80), z.number(), z.null()]))).min(1).max(62),
});
export type AssistantChartData = z.infer<typeof chartSchema>;
