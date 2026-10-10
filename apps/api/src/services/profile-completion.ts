import { apportion, ratio } from '../lib/percent';

/**
 * Profile completion — one definition, used by the percentage, the "missing
 * information" list, the breakdown, the directory, exports and every screen.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Each criterion has a weight (points); the weights of all criteria total 100.
 * A criterion that cannot apply to this employee is NOT APPLICABLE and leaves
 * the denominator — it never counts against them:
 *
 *     completion = earned points ÷ applicable points × 100   (rounded to a whole %)
 *
 * Genuinely missing information is never marked not applicable.
 *
 * ── Changes from the original scoring (1 October 2026) ───────────────────────
 *  • Department is applicable only when a department can be assigned: the
 *    employee already has one, or their unit or job role belongs to one.
 *    Previously it was always worth 6 points while HRISense has no departments,
 *    so no profile could exceed 94%.
 *  • "Uploaded documents" counts uploaded documents only. Previously, with no
 *    documents, the profile photo also earned 5 of the 10 document points — on
 *    top of its own 5 points — so the item showed credit for documents that did
 *    not exist.
 */

export type CompletionStatus = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';

export interface CompletionCriterion {
  id: string;
  /** Shown to HR in the missing list. */
  label: string;
  /** Heading the item is listed under. */
  group: string;
  /** Maximum contribution, in points of 100. */
  weight: number;
  /** Points actually earned for this employee (0..weight). */
  score: (emp: any) => number;
  /** When given and false, the criterion cannot apply to this employee. */
  applies?: (emp: any) => boolean;
  /** Plain explanation for partial or not-applicable results. */
  note?: (emp: any) => string | null;
}

const all = (weight: number, met: boolean) => (met ? weight : 0);
const docCount = (e: any) => (Array.isArray(e.documents) ? e.documents.length : 0);

export const PROFILE_COMPLETION_CRITERIA: CompletionCriterion[] = [
  // ── Personal (20) ──────────────────────────────────────────────────────────
  { id: 'fullName', label: 'Full name', group: 'Personal', weight: 8,
    score: (e) => all(8, !!(e.firstName && e.lastName)) },
  { id: 'dateOfBirth', label: 'Date of birth', group: 'Personal', weight: 4,
    score: (e) => all(4, !!e.dateOfBirth) },
  { id: 'gender', label: 'Sex', group: 'Personal', weight: 4,
    score: (e) => all(4, !!e.gender) },
  { id: 'civilStatus', label: 'Civil status', group: 'Personal', weight: 4,
    score: (e) => all(4, !!e.civilStatus) },

  // ── Contact (15) ───────────────────────────────────────────────────────────
  { id: 'mobilePhone', label: 'Mobile number', group: 'Contact', weight: 5,
    score: (e) => all(5, !!e.mobilePhone) },
  { id: 'email', label: 'Personal email (login)', group: 'Contact', weight: 5,
    score: (e) => all(5, !!e.personalEmail) },
  { id: 'presentAddress', label: 'Present address', group: 'Contact', weight: 5,
    score: (e) => all(5, !!e.presentAddress) },

  // ── Employment (25) — supervisor is deliberately NOT part of completion ────
  { id: 'unit', label: 'Unit', group: 'Employment', weight: 7,
    score: (e) => all(7, !!e.unitId) },
  {
    id: 'department',
    label: 'Department',
    group: 'Employment',
    weight: 6,
    score: (e) => all(6, !!e.departmentId),
    applies: (e) => Boolean(e.departmentId || e.unit?.departmentId || e.jobRole?.departmentId),
    note: (e) =>
      e.departmentId || e.unit?.departmentId || e.jobRole?.departmentId
        ? null
        : "Not applicable: this employee's unit and job role do not belong to any department.",
  },
  { id: 'jobRole', label: 'Job role', group: 'Employment', weight: 6,
    score: (e) => all(6, !!e.jobRoleId) },
  { id: 'hireDate', label: 'Date hired', group: 'Employment', weight: 6,
    score: (e) => all(6, !!e.hireDate) },

  // ── Government IDs (15) — 3.75 each ───────────────────────────────────────
  { id: 'sssNumber', label: 'SSS number', group: 'Government IDs', weight: 3.75,
    score: (e) => all(3.75, !!e.sssNumber) },
  { id: 'philhealthNumber', label: 'PhilHealth number', group: 'Government IDs', weight: 3.75,
    score: (e) => all(3.75, !!e.philhealthNumber) },
  { id: 'pagibigNumber', label: 'Pag-IBIG number', group: 'Government IDs', weight: 3.75,
    score: (e) => all(3.75, !!e.pagibigNumber) },
  { id: 'tinNumber', label: 'TIN', group: 'Government IDs', weight: 3.75,
    score: (e) => all(3.75, !!e.tinNumber) },

  // ── Emergency contact (10) ────────────────────────────────────────────────
  { id: 'emergencyContactName', label: 'Emergency contact name', group: 'Emergency Contact', weight: 5,
    score: (e) => all(5, !!e.emergencyContactName) },
  { id: 'emergencyContactPhone', label: 'Emergency contact number', group: 'Emergency Contact', weight: 5,
    score: (e) => all(5, !!e.emergencyContactPhone) },

  // ── Photo and documents (15) ──────────────────────────────────────────────
  { id: 'photoUrl', label: 'Profile photo', group: 'Documents', weight: 5,
    score: (e) => all(5, !!e.photoUrl) },
  {
    id: 'documents',
    label: 'Uploaded documents',
    group: 'Documents',
    weight: 10,
    // Two uploaded documents earn the full 10; one earns half.
    score: (e) => (docCount(e) >= 2 ? 10 : docCount(e) === 1 ? 5 : 0),
    note: (e) => {
      const n = docCount(e);
      return n >= 2 ? `${n} documents uploaded` : n === 1 ? '1 of 2 documents uploaded (half credit)' : 'No documents uploaded';
    },
  },
];

/** Every weight together — must be exactly 100 (checked by a unit test). */
export const PROFILE_COMPLETION_TOTAL_WEIGHT = PROFILE_COMPLETION_CRITERIA.reduce((n, c) => n + c.weight, 0);

export interface CompletionBreakdownItem {
  id: string;
  label: string;
  group: string;
  status: CompletionStatus;
  /** Points: maximum and earned (of 100). */
  weight: number;
  earned: number;
  /**
   * Share of the displayed percentage, in % — the item's weight and earned
   * points as a share of the APPLICABLE points, apportioned so the earned
   * shares add up to exactly the displayed percentage and the maximum shares
   * to exactly 100. Null for not-applicable items.
   */
  maxShare: number | null;
  earnedShare: number | null;
  note: string | null;
}

export interface CompletionBreakdown {
  items: CompletionBreakdownItem[];
  earnedPoints: number;
  applicablePoints: number;
  totalPoints: number;
  /** earned ÷ applicable × 100, one decimal — before rounding to the displayed whole %. */
  exactPercentage: number | null;
  formula: string;
}

export interface ProfileCompletion {
  percentage: number;
  /** Flat labels, for compact summaries. */
  missing: string[];
  /**
   * Criterion ids of the same items (`sssNumber`, `emergencyContactPhone`…), so
   * the profile screen can mark the exact field without matching on label text.
   */
  missingIds: string[];
  /** The same items grouped by section, for the detailed panel. */
  missingGroups: Array<{ group: string; items: string[] }>;
  /** How the percentage was reached — every criterion, earned and maximum. */
  breakdown: CompletionBreakdown;
}

const EMPTY: ProfileCompletion = {
  percentage: 0,
  missing: [],
  missingIds: [],
  missingGroups: [],
  breakdown: { items: [], earnedPoints: 0, applicablePoints: 0, totalPoints: PROFILE_COMPLETION_TOTAL_WEIGHT, exactPercentage: null, formula: 'No profile.' },
};

const pts = (n: number) => Number(n.toFixed(2));

export function getProfileCompletion(emp: any): ProfileCompletion {
  if (!emp) return EMPTY;

  const missing: string[] = [];
  const missingIds: string[] = [];
  const grouped = new Map<string, string[]>();
  const raw: Array<Omit<CompletionBreakdownItem, 'maxShare' | 'earnedShare'>> = [];
  let earnedPoints = 0;
  let applicablePoints = 0;

  for (const c of PROFILE_COMPLETION_CRITERIA) {
    const applicable = c.applies ? c.applies(emp) : true;
    if (!applicable) {
      raw.push({ id: c.id, label: c.label, group: c.group, status: 'NOT_APPLICABLE', weight: c.weight, earned: 0, note: c.note?.(emp) ?? 'Not applicable to this employee.' });
      continue;
    }
    const earned = Math.max(0, Math.min(c.weight, c.score(emp)));
    earnedPoints += earned;
    applicablePoints += c.weight;
    const status: CompletionStatus = earned >= c.weight ? 'COMPLETE' : earned > 0 ? 'PARTIAL' : 'MISSING';
    // Anything short of full weight is still outstanding, so partial credit
    // (a single document) keeps the item on the list.
    if (status !== 'COMPLETE') {
      missing.push(c.label);
      missingIds.push(c.id);
      grouped.set(c.group, [...(grouped.get(c.group) ?? []), c.label]);
    }
    raw.push({ id: c.id, label: c.label, group: c.group, status, weight: c.weight, earned, note: c.note?.(emp) ?? null });
  }

  const exact = ratio(earnedPoints, applicablePoints, 1);
  const percentage = applicablePoints > 0 ? Math.min(100, Math.round((earnedPoints / applicablePoints) * 100)) : 0;

  // Shares of the displayed whole: max shares total 100, earned shares total the displayed %.
  const applicableItems = raw.filter((r) => r.status !== 'NOT_APPLICABLE');
  const maxShares = apportion(applicableItems.map((r) => (r.weight / applicablePoints) * 100), 100, 1);
  const earnedShares = apportion(applicableItems.map((r) => (r.earned / applicablePoints) * 100), percentage, 1);
  let k = 0;
  const items: CompletionBreakdownItem[] = raw.map((r) => {
    if (r.status === 'NOT_APPLICABLE') return { ...r, maxShare: null, earnedShare: null };
    const out = { ...r, maxShare: maxShares[k], earnedShare: earnedShares[k] };
    k++;
    return out;
  });

  return {
    percentage,
    missing,
    missingIds,
    missingGroups: Array.from(grouped, ([group, items]) => ({ group, items })),
    breakdown: {
      items,
      earnedPoints: pts(earnedPoints),
      applicablePoints: pts(applicablePoints),
      totalPoints: PROFILE_COMPLETION_TOTAL_WEIGHT,
      exactPercentage: exact,
      formula:
        applicablePoints > 0
          ? `${pts(earnedPoints)} earned ÷ ${pts(applicablePoints)} applicable points × 100 = ${exact}% → shown as ${percentage}%`
          : 'No criterion applies.',
    },
  };
}

/** Percentage only — for the directory list and exports. Same source. */
export function calculateProfileCompletion(emp: any): number {
  return getProfileCompletion(emp).percentage;
}

/** Missing labels only — same source as the percentage. */
export function listMissingProfileFields(emp: any): string[] {
  return getProfileCompletion(emp).missing;
}
