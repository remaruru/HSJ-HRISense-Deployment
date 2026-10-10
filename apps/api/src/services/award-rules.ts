/**
 * Awards & Recognition — the confirmed Hospicio rules as pure functions.
 *
 *   The system identifies who is eligible and tallies the votes; people review,
 *   verify and declare the final results. Nothing here picks a winner, and
 *   evaluation scores play no part.
 *
 * Group mappings, exclusions and vote counts below are only what Hospicio HR
 * confirmed (9 Oct 2026). Hospicio's grouping words that do not name a CURRENT
 * job role are listed as unresolved for HR to map — never turned into roles.
 */
import { completedYearsOfService } from '../lib/service-period';

// ─── Hospicio's four organisational groups ──────────────────────────────────

export type OfficialGroupKey = 'ADMIN' | 'SOCIAL' | 'PASTORAL' | 'HEALTH';

export interface OfficialGroupDefinition {
  key: OfficialGroupKey;
  name: string;
  /** Hospicio's own grouping words, as given. */
  hospicioTerms: string[];
  /** Job role CODES that clearly are one of those words. */
  roleCodes: string[];
  /** Hospicio words with no clear current job role: HR maps them. */
  unresolved: string[];
}

export const OFFICIAL_GROUPS: OfficialGroupDefinition[] = [
  {
    key: 'SOCIAL',
    name: 'Social Services',
    hospicioTerms: ['Social Worker', 'ECCD', 'Secretary'],
    roleCodes: ['SOCIAL_WORKER', 'ECCD_TEACHER'],
    unresolved: ['Secretary'],
  },
  {
    key: 'PASTORAL',
    name: 'Pastoral Care & Homelife Services',
    hospicioTerms: ['Houseparents / Caregivers'],
    roleCodes: [],
    unresolved: ['Houseparents / Caregivers'],
  },
  {
    key: 'HEALTH',
    name: 'Health Services',
    hospicioTerms: ['Health Staff', 'PT', 'Clinic Staff'],
    roleCodes: ['CLINIC_STAFF', 'PT_STAFF', 'PT_COORDINATOR'],
    unresolved: ['Health Staff'],
  },
  {
    key: 'ADMIN',
    name: 'Admin Services',
    hospicioTerms: ['Motorpool', 'Admin / HR', 'Accounting', 'PMO', 'Maintenance', 'Janitorial', 'Kitchen', 'Canteen', 'Bakery', 'Information', 'Chapel', 'Stockroom', 'Laundry'],
    roleCodes: [
      'ACCOUNTING_STAFF', 'PMO_STAFF',
      'MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR',
      'JANITORIAL_STAFF', 'JANITORIAL_SUPERVISOR',
      'KITCHEN_STAFF', 'KITCHEN_SUPERVISOR',
      'CANTEEN_STAFF', 'BAKERY_STAFF', 'CHAPEL_STAFF', 'STOCKROOM_STAFF', 'LAUNDRY_STAFF',
    ],
    unresolved: ['Motorpool', 'Admin / HR', 'Information'],
  },
];

/**
 * Employee of the Quarter: positions that cannot be NOMINEES (they may still
 * vote). HR's list: Assistant Administrator, HR Officer, Pastoral Care & Home
 * Life Services Head, SSD Head, all Supervisors, all Coordinators.
 */
export const EOTQ_EXCLUDED_ROLE_CODES = ['ASST_ADMIN', 'HR_OFFICER', 'HEAD_PCH', 'HEAD_SSD'];
const SUPERVISOR_OR_COORDINATOR = /\b(supervisor|coordinator)\b/i;

export function defaultEotqExcludedRoleIds(roles: Array<{ id: string; code: string; title: string }>): string[] {
  return roles.filter((r) => EOTQ_EXCLUDED_ROLE_CODES.includes(r.code) || SUPERVISOR_OR_COORDINATOR.test(r.title)).map((r) => r.id);
}

// ─── Official award presets ─────────────────────────────────────────────────

export const SPECIAL_AWARD_TITLES = ['Most Friendly', 'Most Responsible', 'Most Courteous', 'Most Available', 'Most Well Groomed'];
export const LONGEVITY_MILESTONES = [5, 10, 15, 20];

export const EOTQ_CATEGORIES: Array<{ title: string; group: OfficialGroupKey; votesPerVoter: number }> = [
  { title: 'Social Worker of the Quarter', group: 'SOCIAL', votesPerVoter: 1 },
  { title: 'Homelife Staff of the Quarter', group: 'PASTORAL', votesPerVoter: 2 },
  { title: 'Health Staff of the Quarter', group: 'HEALTH', votesPerVoter: 1 },
  { title: 'Admin Services Staff of the Quarter', group: 'ADMIN', votesPerVoter: 2 },
];

/** Vincentian: one vote for each group's nominee — 4 votes. */
export const VINCENTIAN_CATEGORIES: Array<{ title: string; group: OfficialGroupKey }> = [
  { title: 'Admin', group: 'ADMIN' },
  { title: 'SSD', group: 'SOCIAL' },
  { title: 'Pastoral', group: 'PASTORAL' },
  { title: 'Health', group: 'HEALTH' },
];

/** Completed years: Vincentian at least 3, Louisian at most 3 (exactly 3 is both — confirmed). */
export const VINCENTIAN_MIN_YEARS = 3;
export const LOUISIAN_MAX_YEARS = 3;
export const VINCENTIAN_TOP = 15;
export const LOUISIAN_TOP = 15;
export const SPECIAL_TOP = 5;

// ─── Groups and eligibility ─────────────────────────────────────────────────

export interface GroupScope {
  unitIds: string[];
  departmentIds: string[];
  jobRoleIds: string[];
  employeeIds: string[];
}

export interface PersonForAwards {
  id: string;
  unitId: string | null;
  departmentId: string | null;
  jobRoleId: string | null;
  hireDate: Date | string | null;
}

export const scopeOf = (g: { unitIds: unknown; departmentIds: unknown; jobRoleIds: unknown; employeeIds: unknown }): GroupScope => {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { unitIds: list(g.unitIds), departmentIds: list(g.departmentIds), jobRoleIds: list(g.jobRoleIds), employeeIds: list(g.employeeIds) };
};

export const isEmptyScope = (s: GroupScope) => !s.unitIds.length && !s.departmentIds.length && !s.jobRoleIds.length && !s.employeeIds.length;

/** In the group: by unit, department, job role or by name. No group (null) = everyone. */
export function inGroup(p: PersonForAwards, scope: GroupScope | null): boolean {
  if (!scope) return true;
  return (
    scope.employeeIds.includes(p.id) ||
    (!!p.jobRoleId && scope.jobRoleIds.includes(p.jobRoleId)) ||
    (!!p.unitId && scope.unitIds.includes(p.unitId)) ||
    (!!p.departmentId && scope.departmentIds.includes(p.departmentId))
  );
}

export interface NomineeRules {
  minYears: number | null;
  maxYears: number | null;
  excludeHallOfFame: boolean;
  excludedJobRoleIds: string[];
  eligibilityDate: Date | string;
}

/** Why someone cannot be a nominee, or null when they can. */
export function nomineeDenial(p: PersonForAwards, scope: GroupScope | null, rules: NomineeRules, hallOfFameIds: Set<string>): string | null {
  if (!inGroup(p, scope)) return 'not in this award group';
  if (rules.excludeHallOfFame && hallOfFameIds.has(p.id)) return 'Hall of Fame awardee';
  if (p.jobRoleId && rules.excludedJobRoleIds.includes(p.jobRoleId)) return 'position not eligible as nominee';
  if (rules.minYears !== null || rules.maxYears !== null) {
    const years = completedYearsOfService(p.hireDate, rules.eligibilityDate);
    if (years === null) return 'no hire date on record';
    if (rules.minYears !== null && years < rules.minYears) return `${years} completed year${years === 1 ? '' : 's'} (needs ${rules.minYears} or more)`;
    if (rules.maxYears !== null && years > rules.maxYears) return `${years} completed years (needs ${rules.maxYears} or less)`;
  }
  return null;
}

// ─── Ballots ────────────────────────────────────────────────────────────────

export interface BallotCategory {
  id: string;
  title: string;
  votesPerVoter: number;
  candidateIds: Set<string>;
  /** The voter belongs to this category's voter group. */
  voterEligible: boolean;
}

/**
 * Checks one voter's selections. Each category: at most its number of votes,
 * all to DIFFERENT eligible nominees (self-votes are allowed), only where the
 * voter may vote. Returns the votes to store, or the reason it is refused.
 */
export function checkBallot(
  categories: BallotCategory[],
  selections: Array<{ categoryId: string; nomineeIds: string[] }>
): { votes: Array<{ categoryId: string; nomineeId: string; slot: number }> } | { error: string } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const votes: Array<{ categoryId: string; nomineeId: string; slot: number }> = [];
  for (const s of selections ?? []) {
    const c = byId.get(s?.categoryId);
    if (!c) return { error: 'A vote was cast for a category that is not on this ballot.' };
    if (seen.has(c.id)) return { error: `“${c.title}” appears twice on the ballot.` };
    seen.add(c.id);
    const ids = (Array.isArray(s.nomineeIds) ? s.nomineeIds : []).filter((x) => typeof x === 'string' && x);
    if (!ids.length) continue;
    if (!c.voterEligible) return { error: `You are not in the voting group for “${c.title}”.` };
    if (ids.length > c.votesPerVoter) return { error: `“${c.title}” allows ${c.votesPerVoter} vote${c.votesPerVoter === 1 ? '' : 's'}.` };
    if (new Set(ids).size !== ids.length) return { error: `Your votes for “${c.title}” must go to different nominees.` };
    for (const [i, id] of ids.entries()) {
      if (!c.candidateIds.has(id)) return { error: `Someone you chose is not an eligible nominee for “${c.title}”.` };
      votes.push({ categoryId: c.id, nomineeId: id, slot: i + 1 });
    }
  }
  if (!votes.length) return { error: 'Choose at least one nominee before submitting your ballot.' };
  return { votes };
}

// ─── Tally ──────────────────────────────────────────────────────────────────

export interface TallyEntry {
  employeeId: string;
  categoryId: string | null;
  voteCount: number;
}

export interface RankedEntry extends TallyEntry {
  rank: number;
  shortlisted: boolean;
  tiedAtCutoff: boolean;
}

/**
 * Ranks vote totals (everyone starts at 0; only cast votes count). Equal totals
 * share a rank (1, 2, 2, 4). The shortlist is the Top N — every nominee whose
 * rank is within N, so a tie at the last place is kept whole and flagged for
 * the committee rather than cut arbitrarily. Nominees without a vote are not
 * results. COMBINED adds an employee's votes across categories into one list.
 */
export function rankTally(entries: TallyEntry[], mode: 'PER_CATEGORY' | 'COMBINED', shortlistCount: number | null): RankedEntry[] {
  const withVotes = entries.filter((e) => e.voteCount > 0);
  const groups = new Map<string, TallyEntry[]>();
  if (mode === 'COMBINED') {
    const byEmployee = new Map<string, TallyEntry & { cats: Set<string | null> }>();
    for (const e of withVotes) {
      const cur = byEmployee.get(e.employeeId) ?? { employeeId: e.employeeId, categoryId: e.categoryId, voteCount: 0, cats: new Set() };
      cur.voteCount += e.voteCount;
      cur.cats.add(e.categoryId);
      byEmployee.set(e.employeeId, cur);
    }
    groups.set('*', [...byEmployee.values()].map(({ cats, ...e }) => ({ ...e, categoryId: cats.size === 1 ? e.categoryId : null })));
  } else {
    for (const e of withVotes) groups.set(e.categoryId ?? '', [...(groups.get(e.categoryId ?? '') ?? []), e]);
  }

  const out: RankedEntry[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => b.voteCount - a.voteCount);
    const ranked: RankedEntry[] = [];
    let rank = 0;
    sorted.forEach((e, i) => {
      if (i === 0 || e.voteCount !== sorted[i - 1].voteCount) rank = i + 1;
      ranked.push({ ...e, rank, shortlisted: shortlistCount === null || rank <= shortlistCount, tiedAtCutoff: false });
    });
    const shortlisted = ranked.filter((e) => e.shortlisted);
    if (shortlistCount !== null && shortlisted.length > shortlistCount) {
      const lastRank = Math.max(...shortlisted.map((e) => e.rank));
      for (const e of shortlisted) if (e.rank === lastRank) e.tiedAtCutoff = true;
    }
    out.push(...ranked);
  }
  return out;
}

// ─── Longevity ──────────────────────────────────────────────────────────────

/**
 * Longevity recommendations: completed years (as of the eligibility date) at or
 * above the milestone, and no confirmed award for that milestone yet. HR decides
 * — nobody becomes an awardee without confirmation.
 */
export function longevityRecommendations(
  people: PersonForAwards[],
  milestones: number[],
  asOf: Date | string,
  alreadyAwarded: Set<string>
): Array<{ employeeId: string; milestone: number; completedYears: number }> {
  const out: Array<{ employeeId: string; milestone: number; completedYears: number }> = [];
  for (const p of people) {
    const years = completedYearsOfService(p.hireDate, asOf);
    if (years === null) continue;
    for (const m of milestones) {
      if (years >= m && !alreadyAwarded.has(`${p.id}:${m}`)) out.push({ employeeId: p.id, milestone: m, completedYears: years });
    }
  }
  return out;
}
