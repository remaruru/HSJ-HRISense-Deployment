import type { BreakdownRow, MetricBreakdownSpec } from './MetricBreakdown';
import { formatNum, formatPct } from '@/lib/percent';

/**
 * Profile completion breakdown, built from the API's own calculation
 * (apps/api/src/services/profile-completion.ts) — the browser computes nothing.
 */

export interface CompletionItem {
  id: string;
  label: string;
  group: string;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';
  weight: number;
  earned: number;
  maxShare: number | null;
  earnedShare: number | null;
  note: string | null;
}

export interface CompletionBreakdown {
  items: CompletionItem[];
  earnedPoints: number;
  applicablePoints: number;
  totalPoints: number;
  exactPercentage: number | null;
  formula: string;
}

const STATUS: Record<CompletionItem['status'], BreakdownRow['status']> = {
  COMPLETE: { text: 'Complete', tone: 'success' },
  PARTIAL: { text: 'Partly complete', tone: 'warning' },
  MISSING: { text: 'Missing', tone: 'danger' },
  NOT_APPLICABLE: { text: 'Not applicable', tone: 'neutral' },
};

const SECTIONS: Array<{ status: CompletionItem['status']; heading: string }> = [
  { status: 'COMPLETE', heading: 'Complete' },
  { status: 'PARTIAL', heading: 'Partly complete' },
  { status: 'MISSING', heading: 'Missing' },
  { status: 'NOT_APPLICABLE', heading: 'Not applicable — left out of the calculation' },
];

export function profileCompletionSpec(percentage: number, b: CompletionBreakdown | null | undefined, name?: string): MetricBreakdownSpec | null {
  if (!b || !b.items?.length) return null;
  const na = b.items.filter((i) => i.status === 'NOT_APPLICABLE');
  return {
    title: 'Profile completion',
    value: `${percentage}%`,
    caption: name ? `How ${name}'s profile completion is calculated.` : 'How this profile completion is calculated.',
    formula: [
      `Each item is worth a set number of points; all items together are worth ${formatNum(b.totalPoints)} points.`,
      na.length
        ? `Applicable points: ${formatNum(b.applicablePoints)} (${na.map((i) => i.label).join(', ')} ${na.length === 1 ? 'does' : 'do'} not apply and ${na.length === 1 ? 'is' : 'are'} left out).`
        : `Applicable points: ${formatNum(b.applicablePoints)} — every item applies.`,
      `Earned points: ${formatNum(b.earnedPoints)}.`,
      `${formatNum(b.earnedPoints)} ÷ ${formatNum(b.applicablePoints)} × 100 = ${formatPct(b.exactPercentage)} → shown as ${percentage}%.`,
    ],
    columns: ['Item', 'Points', 'Earned share', 'Maximum share'],
    sections: SECTIONS.map(({ status, heading }) => ({
      heading,
      rows: b.items
        .filter((i) => i.status === status)
        .map((i) => ({
          label: `${i.label}`,
          note: [i.group, i.note].filter(Boolean).join(' · '),
          muted: status === 'NOT_APPLICABLE',
          status: STATUS[i.status],
          cells: status === 'NOT_APPLICABLE' ? [`— / ${formatNum(i.weight)}`, '—', '—'] : [`${formatNum(i.earned)} / ${formatNum(i.weight)}`, formatPct(i.earnedShare), formatPct(i.maxShare)],
        })),
    })).filter((s) => s.rows.length),
    total: { label: 'TOTAL', cells: [`${formatNum(b.earnedPoints)} / ${formatNum(b.applicablePoints)}`, `${percentage}%`, '100%'] },
    notes: [
      'Earned share and maximum share are each item’s points as a share of the applicable points, rounded so each column adds up exactly to its total.',
      'An item is “Not applicable” only when it cannot be supplied for this employee (for example, no department exists for their unit). Missing information is never treated as not applicable.',
    ],
  };
}
