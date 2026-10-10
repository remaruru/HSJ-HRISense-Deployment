import { AwardResultDecision, AwardResultMode, AwardStatus, AwardType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';
import { ENDED_STATES } from '../lib/employment';
import { businessDateKey } from '../lib/businessDate';
import {
  checkBallot,
  defaultEotqExcludedRoleIds,
  EOTQ_CATEGORIES,
  inGroup,
  isEmptyScope,
  longevityRecommendations,
  LONGEVITY_MILESTONES,
  LOUISIAN_MAX_YEARS,
  LOUISIAN_TOP,
  nomineeDenial,
  OFFICIAL_GROUPS,
  OfficialGroupKey,
  rankTally,
  scopeOf,
  SPECIAL_AWARD_TITLES,
  SPECIAL_TOP,
  VINCENTIAN_CATEGORIES,
  VINCENTIAN_MIN_YEARS,
  VINCENTIAN_TOP,
  type BallotCategory,
  type GroupScope,
  type NomineeRules,
} from './award-rules';

/**
 * Awards & Recognition. HR (FULL) runs award periods; every employee may
 * nominate and vote where the confirmed rules allow. The system identifies
 * eligibility and tallies; people review, verify and declare the results.
 * Who voted for whom is never returned by any method here.
 */

type Actor = { id: string; employeeId?: string | null; permissionTier: string };

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeNumber: true,
  unitId: true,
  departmentId: true,
  jobRoleId: true,
  hireDate: true,
  jobRole: { select: { title: true } },
  unit: { select: { name: true } },
} as const;

type Person = Prisma.EmployeeGetPayload<{ select: typeof PERSON_SELECT }>;

const view = (p: Pick<Person, 'id' | 'firstName' | 'lastName' | 'employeeNumber' | 'jobRole' | 'unit'>) => ({
  id: p.id,
  fullName: `${p.firstName} ${p.lastName}`.trim(),
  employeeNumber: p.employeeNumber,
  jobRoleTitle: p.jobRole?.title ?? 'No job role',
  unitName: p.unit?.name ?? 'No unit',
});

const today = () => new Date(`${businessDateKey(new Date())}T00:00:00.000Z`);
const asDate = (v: unknown, what: string) => {
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new AppError(`${what} is not a valid date.`, 400);
  return d;
};
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []);

const AWARD_INCLUDE = {
  categories: {
    orderBy: { displayOrder: 'asc' },
    include: { nomineeGroup: true, voterGroup: true },
  },
} satisfies Prisma.AwardInclude;

type AwardFull = Prisma.AwardGetPayload<{ include: typeof AWARD_INCLUDE }>;
type CategoryFull = AwardFull['categories'][number];

/** Labels HR sees for each status. */
export const AWARD_STATUS_LABEL: Record<AwardStatus, string> = {
  DRAFT: 'Draft',
  NOMINATION_OPEN: 'Nomination open',
  NOMINATION_CLOSED: 'Nomination closed',
  VOTING_OPEN: 'Voting open',
  VOTING_CLOSED: 'Voting closed',
  DELIBERATION: 'Review / deliberation',
  VERIFIED: 'Verified',
  FINALIZED: 'Finalized',
};

export type AwardAction =
  | 'OPEN_NOMINATION'
  | 'CLOSE_NOMINATION'
  | 'OPEN_VOTING'
  | 'CLOSE_VOTING'
  | 'START_REVIEW'
  | 'VERIFY'
  | 'RETURN_TO_REVIEW'
  | 'FINALIZE';

/** The next steps an award may take — only the stages its type uses. */
export function allowedActions(a: { status: AwardStatus; usesNomination: boolean; usesVoting: boolean; requiresConfirmation: boolean }): AwardAction[] {
  switch (a.status) {
    case 'DRAFT':
      if (a.usesNomination) return ['OPEN_NOMINATION'];
      if (a.usesVoting) return ['OPEN_VOTING'];
      return ['START_REVIEW'];
    case 'NOMINATION_OPEN':
      return ['CLOSE_NOMINATION'];
    case 'NOMINATION_CLOSED':
      if (a.usesVoting) return ['OPEN_VOTING'];
      return a.requiresConfirmation ? ['START_REVIEW'] : ['START_REVIEW', 'FINALIZE'];
    case 'VOTING_OPEN':
      return ['CLOSE_VOTING'];
    case 'VOTING_CLOSED':
      return a.requiresConfirmation ? ['START_REVIEW'] : ['START_REVIEW', 'FINALIZE'];
    case 'DELIBERATION':
      return ['VERIFY'];
    case 'VERIFIED':
      return ['FINALIZE', 'RETURN_TO_REVIEW'];
    default:
      return [];
  }
}

export class AwardService {
  // ── Shared lookups ──────────────────────────────────────────────────────────

  private static activePeople() {
    return prisma.employee.findMany({
      where: { deletedAt: null, employmentState: { notIn: ENDED_STATES } },
      select: PERSON_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  private static async hallOfFameIds() {
    const rows = await prisma.hallOfFameRecord.findMany({ where: { deletedAt: null }, select: { employeeId: true } });
    return new Set(rows.map((r) => r.employeeId));
  }

  private static rulesOf(a: AwardFull): NomineeRules {
    return {
      minYears: a.minYears,
      maxYears: a.maxYears,
      excludeHallOfFame: a.excludeHallOfFame,
      excludedJobRoleIds: ids(a.excludedJobRoleIds),
      eligibilityDate: a.eligibilityDate,
    };
  }

  private static nomineeScope(c: CategoryFull): GroupScope | null {
    return c.nomineeGroup ? scopeOf(c.nomineeGroup) : null;
  }

  private static voterScope(c: CategoryFull): GroupScope | null {
    return c.voterGroup ? scopeOf(c.voterGroup) : null;
  }

  private static async loadAward(id: string) {
    const a = await prisma.award.findFirst({ where: { id, deletedAt: null }, include: AWARD_INCLUDE });
    if (!a) throw new AppError('Award not found.', 404);
    return a;
  }

  /**
   * The people on a category's ballot: the nominated (when the award uses
   * nomination) or everyone eligible, under the award's nominee rules.
   */
  private static async candidates(a: AwardFull, people: Person[], hof: Set<string>) {
    const rules = this.rulesOf(a);
    const nominated = a.usesNomination
      ? await prisma.awardNomination.findMany({
          where: { categoryId: { in: a.categories.map((c) => c.id) } },
          select: { categoryId: true, nomineeId: true },
        })
      : [];
    const out = new Map<string, Person[]>();
    for (const c of a.categories) {
      const scope = this.nomineeScope(c);
      const pool = a.usesNomination
        ? people.filter((p) => nominated.some((n) => n.categoryId === c.id && n.nomineeId === p.id))
        : people;
      out.set(c.id, pool.filter((p) => nomineeDenial(p, scope, rules, hof) === null));
    }
    return out;
  }

  // ── Groups (Hospicio grouping terms → current organisation) ────────────────

  /** Creates Hospicio's four official groups once, with only the clear job-role matches. */
  static async ensureOfficialGroups() {
    const existing = await prisma.awardGroup.findMany({ where: { isOfficial: true } });
    const missing = OFFICIAL_GROUPS.filter((d) => !existing.some((g) => g.name === d.name));
    if (missing.length) {
      const roles = await prisma.jobRole.findMany({ select: { id: true, code: true } });
      for (const d of missing) {
        try {
          await prisma.awardGroup.create({
            data: {
              name: d.name,
              isOfficial: true,
              description: `Hospicio grouping: ${d.hospicioTerms.join(', ')}.`,
              jobRoleIds: roles.filter((r) => d.roleCodes.includes(r.code)).map((r) => r.id),
              unitIds: [],
              departmentIds: [],
              employeeIds: [],
            },
          });
        } catch (e: any) {
          if (e?.code !== 'P2002') throw e;
        }
      }
    }
    const groups = await prisma.awardGroup.findMany({ where: { isOfficial: true } });
    return new Map(OFFICIAL_GROUPS.map((d) => [d.key, groups.find((g) => g.name === d.name)!] as const));
  }

  static async listGroups() {
    await this.ensureOfficialGroups();
    const [groups, people] = await Promise.all([
      prisma.awardGroup.findMany({ orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }] }),
      this.activePeople(),
    ]);
    return groups.map((g) => {
      const scope = scopeOf(g);
      const def = OFFICIAL_GROUPS.find((d) => d.name === g.name && g.isOfficial);
      return {
        ...g,
        ...scope,
        memberCount: isEmptyScope(scope) ? 0 : people.filter((p) => inGroup(p, scope)).length,
        hospicioTerms: def?.hospicioTerms ?? [],
        /** Hospicio words with no clear current job role (HR maps them). */
        unresolvedTerms: def?.unresolved ?? [],
      };
    });
  }

  static async saveGroup(id: string | null, input: any, actor: Actor) {
    const data = {
      unitIds: ids(input?.unitIds),
      departmentIds: ids(input?.departmentIds),
      jobRoleIds: ids(input?.jobRoleIds),
      employeeIds: ids(input?.employeeIds),
      description: typeof input?.description === 'string' ? input.description.trim().slice(0, 1000) || null : undefined,
    };
    let group;
    if (id) {
      const existing = await prisma.awardGroup.findUnique({ where: { id } });
      if (!existing) throw new AppError('Group not found.', 404);
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      group = await prisma.awardGroup.update({
        where: { id },
        // An official group keeps Hospicio's name; only its mapping changes.
        data: { ...data, ...(name && !existing.isOfficial ? { name: name.slice(0, 120) } : {}) },
      });
    } else {
      const name = String(input?.name ?? '').trim();
      if (!name) throw new AppError('Give the group a name.', 400);
      try {
        group = await prisma.awardGroup.create({ data: { ...data, name: name.slice(0, 120), isOfficial: false } });
      } catch (e: any) {
        if (e?.code === 'P2002') throw new AppError('A group with that name already exists.', 409);
        throw e;
      }
    }
    await createAuditLog({
      actorUserId: actor.id,
      action: id ? 'AWARD_GROUP_UPDATED' : 'AWARD_GROUP_CREATED',
      entityType: 'AwardGroup',
      entityId: group.id,
      metadata: { name: group.name, ...data },
    });
    return group;
  }

  static async deleteGroup(id: string, actor: Actor) {
    const g = await prisma.awardGroup.findUnique({ where: { id }, include: { _count: { select: { nomineeCategories: true, voterCategories: true } } } });
    if (!g) throw new AppError('Group not found.', 404);
    if (g.isOfficial) throw new AppError("Hospicio's official groups cannot be deleted; change their mapping instead.", 409);
    if (g._count.nomineeCategories + g._count.voterCategories) throw new AppError('This group is used by an award and cannot be deleted.', 409);
    await prisma.awardGroup.delete({ where: { id } });
    await createAuditLog({ actorUserId: actor.id, action: 'AWARD_GROUP_DELETED', entityType: 'AwardGroup', entityId: id, metadata: { name: g.name } });
  }

  // ── Creating awards ─────────────────────────────────────────────────────────

  static async createAward(input: any, actor: Actor) {
    const type = input?.type as AwardType;
    if (!Object.values(AwardType).includes(type)) throw new AppError('Choose the award.', 400);
    const year = Number(input?.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError('Enter the award year.', 400);
    const quarter = type === 'EMPLOYEE_OF_THE_QUARTER' || (type === 'CUSTOM' && input?.quarter) ? Number(input?.quarter) : null;
    if (quarter !== null && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4)) throw new AppError('Choose the quarter (1 to 4).', 400);
    const eligibilityDate = input?.eligibilityDate ? asDate(input.eligibilityDate, 'The eligibility date') : today();

    if (type !== 'CUSTOM') {
      const dup = await prisma.award.findFirst({ where: { type, year, quarter, deletedAt: null } });
      if (dup) throw new AppError(`${dup.title} — ${dup.periodLabel} already exists.`, 409);
    }

    const groups = type === 'CUSTOM' ? null : await this.ensureOfficialGroups();
    const g = (k: OfficialGroupKey) => groups!.get(k)!.id;
    const cy = `CY ${year}`;
    let data: Prisma.AwardCreateInput;
    let categories: Prisma.AwardCategoryCreateWithoutAwardInput[];

    switch (type) {
      case 'EMPLOYEE_OF_THE_QUARTER': {
        const roles = await prisma.jobRole.findMany({ select: { id: true, code: true, title: true } });
        data = {
          type, isOfficial: true, title: 'Employee of the Quarter', year, quarter, periodLabel: `Q${quarter} ${year}`,
          usesNomination: true, usesVoting: true, resultMode: 'PER_CATEGORY', shortlistCount: null,
          eligibilityDate, excludedJobRoleIds: defaultEotqExcludedRoleIds(roles),
          description: 'Nominations, then voting by each group. Votes are tallied automatically; results are reviewed and verified before they are final.',
        };
        categories = EOTQ_CATEGORIES.map((c, i) => ({
          title: c.title, displayOrder: i + 1, votesPerVoter: c.votesPerVoter,
          nomineeGroup: { connect: { id: g(c.group) } }, voterGroup: { connect: { id: g(c.group) } },
        }));
        break;
      }
      case 'VINCENTIAN':
        data = {
          type, isOfficial: true, title: 'Vincentian Service Award', year, periodLabel: cy,
          usesNomination: false, usesVoting: true, resultMode: 'COMBINED', shortlistCount: VINCENTIAN_TOP,
          eligibilityDate, minYears: VINCENTIAN_MIN_YEARS, excludeHallOfFame: true,
          description: `Employees with ${VINCENTIAN_MIN_YEARS} or more completed years of service. One vote for each group: 4 votes.`,
        };
        categories = VINCENTIAN_CATEGORIES.map((c, i) => ({ title: c.title, displayOrder: i + 1, votesPerVoter: 1, nomineeGroup: { connect: { id: g(c.group) } } }));
        break;
      case 'LOUISIAN':
        data = {
          type, isOfficial: true, title: 'Louisian Service Award', year, periodLabel: cy,
          usesNomination: false, usesVoting: true, resultMode: 'COMBINED', shortlistCount: LOUISIAN_TOP,
          eligibilityDate, maxYears: LOUISIAN_MAX_YEARS, excludeHallOfFame: true,
          description: `Employees with ${LOUISIAN_MAX_YEARS} completed years of service or less (exactly ${LOUISIAN_MAX_YEARS} is also Vincentian-eligible). 1 vote.`,
        };
        categories = [{ title: 'Louisian Service Award', displayOrder: 1, votesPerVoter: 1 }];
        break;
      case 'SPECIAL': {
        // Titles carry over from the latest Special Awards period (HR may have renamed them).
        const last = await prisma.award.findFirst({
          where: { type: 'SPECIAL', deletedAt: null }, orderBy: { year: 'desc' },
          include: { categories: { orderBy: { displayOrder: 'asc' } } },
        });
        const asked = Array.isArray(input?.categoryTitles) ? input.categoryTitles.map((t: any) => String(t ?? '').trim()) : null;
        const titles: string[] = asked ?? (last?.categories.map((c) => c.title) || SPECIAL_AWARD_TITLES);
        if (titles.length !== SPECIAL_AWARD_TITLES.length || titles.some((t) => !t)) throw new AppError('Give each of the five Special Awards a title.', 400);
        data = {
          type, isOfficial: true, title: 'Special Awards', year, periodLabel: cy,
          usesNomination: false, usesVoting: true, resultMode: 'PER_CATEGORY', shortlistCount: SPECIAL_TOP,
          eligibilityDate, excludeHallOfFame: true,
          description: 'Organisation-wide. One vote for each Special Award; each award has its own Top 5.',
        };
        categories = titles.map((t, i) => ({ title: t.slice(0, 120), displayOrder: i + 1, votesPerVoter: 1 }));
        break;
      }
      case 'LONGEVITY':
        data = {
          type, isOfficial: true, title: 'Longevity Awards', year, periodLabel: cy,
          usesNomination: false, usesVoting: false, resultMode: 'PER_CATEGORY', shortlistCount: null, eligibilityDate,
          description: 'HRISense recommends employees who have reached each milestone in completed years of service; HR reviews and confirms.',
        };
        categories = LONGEVITY_MILESTONES.map((m, i) => ({ title: `${m} Years`, displayOrder: i + 1, votesPerVoter: 1, milestoneYears: m }));
        break;
      default: {
        const title = String(input?.title ?? '').trim();
        if (!title) throw new AppError('Give the award a title.', 400);
        const usesNomination = Boolean(input?.usesNomination);
        const usesVoting = Boolean(input?.usesVoting);
        if (!usesNomination && !usesVoting) throw new AppError('A custom award uses nomination, voting, or both.', 400);
        const shortlist = input?.shortlistCount === null || input?.shortlistCount === undefined || input?.shortlistCount === '' ? null : Number(input.shortlistCount);
        if (shortlist !== null && (!Number.isInteger(shortlist) || shortlist < 1 || shortlist > 100)) throw new AppError('The result count must be 1 to 100.', 400);
        const years = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
        const minYears = years(input?.minYears);
        const maxYears = years(input?.maxYears);
        for (const y of [minYears, maxYears]) if (y !== null && (!Number.isInteger(y) || y < 0 || y > 60)) throw new AppError('Years of service must be 0 to 60.', 400);
        const cats = Array.isArray(input?.categories) ? input.categories : [];
        if (!cats.length) throw new AppError('Add at least one category.', 400);
        const groupIds = ids(cats.flatMap((c: any) => [c?.nomineeGroupId, c?.voterGroupId]));
        if (groupIds.length && (await prisma.awardGroup.count({ where: { id: { in: groupIds } } })) !== groupIds.length) throw new AppError('A chosen group no longer exists.', 400);
        categories = cats.map((c: any, i: number) => {
          const t = String(c?.title ?? '').trim();
          const v = Number(c?.votesPerVoter ?? 1);
          if (!t) throw new AppError(`Category ${i + 1} needs a title.`, 400);
          if (!Number.isInteger(v) || v < 1 || v > 10) throw new AppError(`“${t}”: votes per voter must be 1 to 10.`, 400);
          return {
            title: t.slice(0, 120), description: c?.description ? String(c.description).slice(0, 1000) : null, displayOrder: i + 1, votesPerVoter: v,
            ...(c?.nomineeGroupId ? { nomineeGroup: { connect: { id: c.nomineeGroupId } } } : {}),
            ...(c?.voterGroupId ? { voterGroup: { connect: { id: c.voterGroupId } } } : {}),
          };
        });
        data = {
          type, isOfficial: false, title: title.slice(0, 150), description: input?.description ? String(input.description).slice(0, 2000) : null,
          year, quarter, periodLabel: quarter ? `Q${quarter} ${year}` : cy,
          usesNomination, usesVoting, requiresConfirmation: input?.requiresConfirmation !== false,
          resultMode: input?.resultMode === 'COMBINED' ? AwardResultMode.COMBINED : AwardResultMode.PER_CATEGORY,
          shortlistCount: shortlist, eligibilityDate, minYears, maxYears, excludeHallOfFame: Boolean(input?.excludeHallOfFame),
          excludedJobRoleIds: ids(input?.excludedJobRoleIds),
        };
      }
    }

    const award = await prisma.award.create({ data: { ...data, createdById: actor.id || null, categories: { create: categories } } });
    await createAuditLog({
      actorUserId: actor.id, action: 'AWARD_CREATED', entityType: 'Award', entityId: award.id,
      metadata: { type, title: award.title, period: award.periodLabel, official: award.isOfficial },
    });
    return this.getAward(award.id);
  }

  /** Personnel Recognition and Awards for a calendar year: Vincentian, Louisian, Special Awards and Longevity. */
  static async createRecognitionYear(year: number, actor: Actor, eligibilityDate?: string) {
    const created: string[] = [];
    const skipped: string[] = [];
    for (const type of ['VINCENTIAN', 'LOUISIAN', 'SPECIAL', 'LONGEVITY'] as const) {
      try {
        const a = await this.createAward({ type, year, eligibilityDate }, actor);
        created.push(a.title);
      } catch (e: any) {
        if (e?.statusCode === 409) skipped.push(e.message);
        else throw e;
      }
    }
    return { created, skipped };
  }

  /** Draft-only edits. Official awards keep their confirmed rules; their Special Award titles and dates may change. */
  static async updateAward(id: string, input: any, actor: Actor) {
    const a = await this.loadAward(id);
    if (a.status !== 'DRAFT') throw new AppError('An award can be changed only while it is a draft.', 409);
    const data: Prisma.AwardUpdateInput = {};
    if (typeof input?.description === 'string') data.description = input.description.trim().slice(0, 2000) || null;
    if (input?.eligibilityDate) data.eligibilityDate = asDate(input.eligibilityDate, 'The eligibility date');
    if (input?.excludedJobRoleIds !== undefined && (a.type === 'EMPLOYEE_OF_THE_QUARTER' || a.type === 'CUSTOM')) data.excludedJobRoleIds = ids(input.excludedJobRoleIds);
    if (!a.isOfficial && typeof input?.title === 'string' && input.title.trim()) data.title = input.title.trim().slice(0, 150);

    const renames = Array.isArray(input?.categories) ? input.categories : [];
    const canRename = a.type === 'SPECIAL' || a.type === 'CUSTOM';
    await prisma.$transaction(async (tx) => {
      await tx.award.update({ where: { id }, data });
      for (const c of renames) {
        const cat = a.categories.find((x) => x.id === c?.id);
        const title = String(c?.title ?? '').trim();
        if (!cat || !title || title === cat.title) continue;
        if (!canRename) throw new AppError("This official award's categories are fixed.", 400);
        await tx.awardCategory.update({ where: { id: cat.id }, data: { title: title.slice(0, 120) } });
      }
    });
    await createAuditLog({ actorUserId: actor.id, action: 'AWARD_UPDATED', entityType: 'Award', entityId: id, metadata: { fields: Object.keys(data), renamed: renames.length } });
    return this.getAward(id);
  }

  /** Only an untouched draft can be deleted; nothing finalised is ever deleted. */
  static async deleteAward(id: string, actor: Actor) {
    const a = await this.loadAward(id);
    if (a.status !== 'DRAFT') throw new AppError('Only a draft award can be deleted. Finalized results are permanent records.', 409);
    const activity = await prisma.awardNomination.count({ where: { category: { awardId: id } } }) + (await prisma.awardBallot.count({ where: { awardId: id } }));
    if (activity) throw new AppError('This award already has nominations or votes and cannot be deleted.', 409);
    await prisma.award.update({ where: { id }, data: { deletedAt: new Date() } });
    await createAuditLog({ actorUserId: actor.id, action: 'AWARD_DELETED', entityType: 'Award', entityId: id, metadata: { title: a.title, period: a.periodLabel } });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  static async transition(id: string, action: AwardAction, actor: Actor) {
    const a = await this.loadAward(id);
    if (!allowedActions(a).includes(action)) {
      throw new AppError(`“${a.title} — ${a.periodLabel}” is ${AWARD_STATUS_LABEL[a.status].toLowerCase()}; that step is not available now.`, 409);
    }
    const now = new Date();
    const set = async (data: Prisma.AwardUpdateInput) => prisma.award.update({ where: { id }, data });

    if (action === 'OPEN_NOMINATION' || action === 'OPEN_VOTING') {
      for (const c of a.categories) {
        if (c.nomineeGroup && isEmptyScope(scopeOf(c.nomineeGroup))) {
          throw new AppError(`“${c.title}”: the group “${c.nomineeGroup.name}” has no units, roles or employees mapped yet. Map it under Voting Groups first.`, 400);
        }
        if (action === 'OPEN_VOTING' && c.voterGroup && isEmptyScope(scopeOf(c.voterGroup))) {
          throw new AppError(`“${c.title}”: the voting group “${c.voterGroup.name}” has no one mapped yet.`, 400);
        }
      }
    }
    if (action === 'OPEN_VOTING') {
      const people = await this.activePeople();
      const cands = await this.candidates(a, people, await this.hallOfFameIds());
      if (![...cands.values()].some((l) => l.length)) throw new AppError('There is nobody to vote for yet: no category has an eligible nominee.', 400);
    }

    switch (action) {
      case 'OPEN_NOMINATION': await set({ status: 'NOMINATION_OPEN', nominationOpenedAt: now }); break;
      case 'CLOSE_NOMINATION': await set({ status: 'NOMINATION_CLOSED', nominationClosedAt: now }); break;
      case 'OPEN_VOTING': await set({ status: 'VOTING_OPEN', votingOpenedAt: now }); break;
      case 'CLOSE_VOTING': await set({ status: 'VOTING_CLOSED', votingClosedAt: now }); break;
      case 'START_REVIEW': await this.freezeResults(a, false); await set({ status: 'DELIBERATION', reviewStartedAt: now }); break;
      case 'VERIFY': {
        const pending = await prisma.awardResult.count({ where: { awardId: id, shortlisted: true, decision: 'PENDING' } });
        if (pending) throw new AppError(`${pending} result${pending === 1 ? ' still needs' : 's still need'} a decision (Confirm or Not awarded) before the results can be verified.`, 400);
        await set({ status: 'VERIFIED', verifiedAt: now, verifiedById: actor.employeeId ?? actor.id });
        break;
      }
      case 'RETURN_TO_REVIEW': await set({ status: 'DELIBERATION', verifiedAt: null, verifiedById: null }); break;
      case 'FINALIZE':
        if (a.status !== 'VERIFIED') await this.freezeResults(a, true); // no confirmation step: the shortlist is the result
        await set({ status: 'FINALIZED', finalizedAt: now, finalizedById: actor.employeeId ?? actor.id });
        break;
    }
    await createAuditLog({
      actorUserId: actor.id, action: action === 'FINALIZE' ? 'AWARD_FINALIZED' : 'AWARD_STATUS_CHANGED', entityType: 'Award', entityId: id,
      metadata: { from: a.status, action, title: a.title, period: a.periodLabel },
    });
    return this.getAward(id);
  }

  /** The automatic tally (or, for Longevity, the recommendations), frozen for review. */
  private static async freezeResults(a: AwardFull, confirmShortlist: boolean) {
    const rows = await this.computeResults(a);
    await prisma.$transaction(async (tx) => {
      await tx.awardResult.deleteMany({ where: { awardId: a.id } });
      if (rows.length) {
        await tx.awardResult.createMany({
          data: rows.map((r) => ({
            ...r,
            awardId: a.id,
            ...(confirmShortlist && r.shortlisted ? { decision: AwardResultDecision.CONFIRMED, placement: r.rank, decidedAt: new Date() } : {}),
          })),
        });
      }
    });
  }

  private static async computeResults(a: AwardFull) {
    if (a.type === 'LONGEVITY') {
      const people = await this.activePeople();
      const awarded = await prisma.awardResult.findMany({
        where: { decision: 'CONFIRMED', award: { type: 'LONGEVITY', status: 'FINALIZED', deletedAt: null } },
        select: { employeeId: true, category: { select: { milestoneYears: true } } },
      });
      const done = new Set(awarded.map((r) => `${r.employeeId}:${r.category?.milestoneYears}`));
      const milestones = a.categories.map((c) => c.milestoneYears).filter((m): m is number => m !== null);
      return longevityRecommendations(people, milestones, a.eligibilityDate, done).map((r) => ({
        categoryId: a.categories.find((c) => c.milestoneYears === r.milestone)!.id,
        employeeId: r.employeeId, voteCount: 0, rank: null as number | null, shortlisted: true, tiedAtCutoff: false, completedYears: r.completedYears,
      }));
    }
    if (!a.usesVoting) {
      // Nomination only: each eligible nominee once, for the committee to decide.
      const people = await this.activePeople();
      const cands = await this.candidates(a, people, await this.hallOfFameIds());
      return [...cands.entries()].flatMap(([categoryId, list]) =>
        list.map((p) => ({ categoryId, employeeId: p.id, voteCount: 0, rank: null as number | null, shortlisted: true, tiedAtCutoff: false, completedYears: null }))
      );
    }
    const counts = await prisma.awardVote.groupBy({
      by: ['categoryId', 'nomineeId'],
      where: { categoryId: { in: a.categories.map((c) => c.id) } },
      _count: { _all: true },
    });
    return rankTally(
      counts.map((c) => ({ categoryId: c.categoryId, employeeId: c.nomineeId, voteCount: c._count._all })),
      a.resultMode,
      a.shortlistCount
    ).map((r) => ({ ...r, completedYears: null }));
  }

  /** The committee's decision on one result (during review). */
  static async decideResult(resultId: string, input: any, actor: Actor) {
    const r = await prisma.awardResult.findUnique({ where: { id: resultId }, include: { award: true } });
    if (!r || r.award.deletedAt) throw new AppError('Result not found.', 404);
    if (r.award.status !== 'DELIBERATION') throw new AppError('Decisions are recorded during the review, before the results are verified.', 409);
    const decision = input?.decision as AwardResultDecision;
    if (!Object.values(AwardResultDecision).includes(decision)) throw new AppError('Choose Confirm or Not awarded.', 400);
    const placement = input?.placement === null || input?.placement === undefined || input?.placement === '' ? null : Number(input.placement);
    if (placement !== null && (!Number.isInteger(placement) || placement < 1 || placement > 1000)) throw new AppError('Placement must be a whole number from 1.', 400);
    await prisma.awardResult.update({
      where: { id: resultId },
      data: {
        decision,
        placement: decision === 'CONFIRMED' ? placement ?? r.rank : null,
        note: typeof input?.note === 'string' ? input.note.trim().slice(0, 1000) || null : undefined,
        decidedById: actor.employeeId ?? actor.id,
        decidedAt: new Date(),
      },
    });
    await createAuditLog({ actorUserId: actor.id, targetEmployeeId: r.employeeId, action: 'AWARD_RESULT_DECIDED', entityType: 'AwardResult', entityId: resultId, metadata: { awardId: r.awardId, decision, placement } });
    return this.getAward(r.awardId);
  }

  /** "Confirm the shortlist as ranked": every undecided shortlisted result, placed by its rank. */
  static async confirmShortlist(awardId: string, actor: Actor) {
    const a = await this.loadAward(awardId);
    if (a.status !== 'DELIBERATION') throw new AppError('Decisions are recorded during the review.', 409);
    const pending = await prisma.awardResult.findMany({ where: { awardId, shortlisted: true, decision: 'PENDING' } });
    for (const r of pending) {
      await prisma.awardResult.update({ where: { id: r.id }, data: { decision: 'CONFIRMED', placement: r.rank, decidedById: actor.employeeId ?? actor.id, decidedAt: new Date() } });
    }
    await createAuditLog({ actorUserId: actor.id, action: 'AWARD_SHORTLIST_CONFIRMED', entityType: 'Award', entityId: awardId, metadata: { confirmed: pending.length } });
    return this.getAward(awardId);
  }

  // ── Reading (HR) ────────────────────────────────────────────────────────────

  static async listAwards() {
    const awards = await prisma.award.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { ballots: true, categories: true } } },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }, { createdAt: 'desc' }],
    });
    return awards.map((a) => ({ ...a, statusLabel: AWARD_STATUS_LABEL[a.status], actions: allowedActions(a) }));
  }

  /**
   * One award for HR: its rules, categories, who is eligible, nominations (with
   * who nominated — as on the paper form), turnout, and — once voting has closed —
   * the tally. Never who voted for whom.
   */
  static async getAward(id: string) {
    const a = await this.loadAward(id);
    const [people, hof, roles] = await Promise.all([this.activePeople(), this.hallOfFameIds(), prisma.jobRole.findMany({ select: { id: true, title: true } })]);
    const byId = new Map(people.map((p) => [p.id, p]));
    const cands = await this.candidates(a, people, hof);
    const nominations = a.usesNomination
      ? await prisma.awardNomination.findMany({
          where: { categoryId: { in: a.categories.map((c) => c.id) } },
          include: { nominee: { select: PERSON_SELECT }, nominatedBy: { select: PERSON_SELECT } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const ballots = await prisma.awardBallot.count({ where: { awardId: id } });
    const voters = a.usesVoting ? people.filter((p) => a.categories.some((c) => inGroup(p, this.voterScope(c)))).length : 0;
    const rules = this.rulesOf(a);

    let tally: any[] | null = null;
    if (a.status === 'VOTING_CLOSED') tally = (await this.computeResults(a)).map((r) => ({ ...r, id: null, decision: 'PENDING', placement: null, note: null }));
    if (a.status === 'DELIBERATION' || a.status === 'VERIFIED' || a.status === 'FINALIZED') {
      tally = await prisma.awardResult.findMany({ where: { awardId: id }, orderBy: [{ rank: 'asc' }, { voteCount: 'desc' }] });
    }
    const resultEmployees = tally?.length
      ? new Map((await prisma.employee.findMany({ where: { id: { in: tally.map((t) => t.employeeId) } }, select: PERSON_SELECT })).map((e) => [e.id, view(e)]))
      : new Map();

    return {
      ...a,
      excludedJobRoleIds: rules.excludedJobRoleIds,
      excludedJobRoles: roles.filter((r) => rules.excludedJobRoleIds.includes(r.id)).map((r) => r.title).sort(),
      statusLabel: AWARD_STATUS_LABEL[a.status],
      actions: allowedActions(a),
      totalVotesPerVoter: a.categories.reduce((n, c) => n + c.votesPerVoter, 0),
      categories: a.categories.map((c) => ({
        ...c,
        nomineeGroupName: c.nomineeGroup?.name ?? null,
        voterGroupName: c.voterGroup?.name ?? null,
        candidates: (cands.get(c.id) ?? []).map(view),
        nominationCount: nominations.filter((n) => n.categoryId === c.id).length,
      })),
      nominations: nominations.map((n) => ({
        id: n.id, categoryId: n.categoryId, createdAt: n.createdAt, reason: n.reason,
        nominee: view(n.nominee), nominatedBy: view(n.nominatedBy),
        stillEligible: (cands.get(n.categoryId) ?? []).some((p) => p.id === n.nomineeId),
        ineligibleReason: (() => {
          const cat = a.categories.find((c) => c.id === n.categoryId)!;
          const p = byId.get(n.nomineeId);
          return p ? nomineeDenial(p, this.nomineeScope(cat), rules, hof) : 'no longer an active employee';
        })(),
      })),
      turnout: a.usesVoting ? { ballots, eligibleVoters: voters } : null,
      // Rank order; equal totals listed by name so the list never reshuffles.
      results:
        tally
          ?.map((t) => ({ ...t, employee: resultEmployees.get(t.employeeId) ?? null }))
          .sort((x, y) => (x.rank ?? 1e9) - (y.rank ?? 1e9) || y.voteCount - x.voteCount || (x.employee?.fullName ?? '').localeCompare(y.employee?.fullName ?? '')) ?? null,
    };
  }

  /** Finalized awards and their confirmed awardees — the permanent record (HR, with vote totals). */
  static async history() {
    const awards = await prisma.award.findMany({
      where: { status: 'FINALIZED', deletedAt: null },
      include: {
        categories: { orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } },
        results: { where: { decision: 'CONFIRMED' }, include: { employee: { select: PERSON_SELECT } }, orderBy: [{ placement: 'asc' }] },
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }, { finalizedAt: 'desc' }],
    });
    return awards.map((a) => ({
      id: a.id, type: a.type, isOfficial: a.isOfficial, title: a.title, periodLabel: a.periodLabel, year: a.year, quarter: a.quarter, finalizedAt: a.finalizedAt,
      resultMode: a.resultMode,
      awardees: a.results.map((r) => ({
        categoryTitle: a.categories.find((c) => c.id === r.categoryId)?.title ?? null,
        placement: r.placement, voteCount: r.voteCount, completedYears: r.completedYears, employee: view(r.employee),
      })),
    }));
  }

  // ── Employees: nominate, vote, see results ─────────────────────────────────

  static async nominate(categoryId: string, input: any, actor: Actor) {
    if (!actor.employeeId) throw new AppError('Only employees can nominate.', 403);
    const cat = await prisma.awardCategory.findUnique({ where: { id: categoryId }, select: { awardId: true } });
    if (!cat) throw new AppError('Award category not found.', 404);
    const a = await this.loadAward(cat.awardId);
    if (a.status !== 'NOMINATION_OPEN') throw new AppError('Nominations for this award are not open.', 409);
    const category = a.categories.find((c) => c.id === categoryId)!;
    const nomineeId = String(input?.nomineeId ?? '');
    const nominee = await prisma.employee.findFirst({ where: { id: nomineeId, deletedAt: null, employmentState: { notIn: ENDED_STATES } }, select: PERSON_SELECT });
    if (!nominee) throw new AppError('Choose an active employee to nominate.', 400);
    const denial = nomineeDenial(nominee, this.nomineeScope(category), this.rulesOf(a), await this.hallOfFameIds());
    if (denial) throw new AppError(`${view(nominee).fullName} cannot be nominated for “${category.title}”: ${denial}.`, 400);
    try {
      await prisma.awardNomination.create({
        data: { categoryId, nomineeId, nominatedById: actor.employeeId, reason: typeof input?.reason === 'string' ? input.reason.trim().slice(0, 2000) || null : null },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError(`You have already nominated ${view(nominee).fullName} for “${category.title}”.`, 409);
      throw e;
    }
    await createAuditLog({ actorUserId: actor.id, targetEmployeeId: nomineeId, action: 'AWARD_NOMINATION_SUBMITTED', entityType: 'AwardCategory', entityId: categoryId, metadata: { awardId: a.id } });
    return { ok: true };
  }

  /**
   * One ballot per voter per award. The ballot row is created first inside the
   * transaction (unique per award and voter), so a refresh, a second tab or a
   * double click cannot add votes; the vote rows' own unique keys stop a slot or
   * a nominee being used twice. The audit entry records THAT a ballot was cast,
   * never the choices.
   */
  static async submitBallot(awardId: string, input: any, actor: Actor) {
    if (!actor.employeeId) throw new AppError('Only employees can vote.', 403);
    const a = await this.loadAward(awardId);
    if (a.status !== 'VOTING_OPEN') throw new AppError('Voting for this award is not open.', 409);
    const people = await this.activePeople();
    const me = people.find((p) => p.id === actor.employeeId);
    if (!me) throw new AppError('Only active employees can vote.', 403);
    const cands = await this.candidates(a, people, await this.hallOfFameIds());
    const ballot: BallotCategory[] = a.categories.map((c) => ({
      id: c.id, title: c.title, votesPerVoter: c.votesPerVoter,
      candidateIds: new Set((cands.get(c.id) ?? []).map((p) => p.id)),
      voterEligible: inGroup(me, this.voterScope(c)),
    }));
    const checked = checkBallot(ballot, input?.selections);
    if ('error' in checked) throw new AppError(checked.error, 400);

    try {
      await prisma.$transaction(async (tx) => {
        const open = await tx.award.findFirst({ where: { id: awardId, status: 'VOTING_OPEN', deletedAt: null }, select: { id: true } });
        if (!open) throw new AppError('Voting for this award has just closed.', 409);
        const b = await tx.awardBallot.create({ data: { awardId, voterId: me.id } });
        await tx.awardVote.createMany({ data: checked.votes.map((v) => ({ ...v, ballotId: b.id })) });
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new AppError('You have already submitted your ballot for this award.', 409);
      throw e;
    }
    await createAuditLog({ actorUserId: actor.id, action: 'AWARD_BALLOT_SUBMITTED', entityType: 'Award', entityId: awardId, metadata: { votes: checked.votes.length } });
    return { ok: true };
  }

  /** Everything an employee may see: open nominations, open ballots, final results, their own history. */
  static async myAwards(actor: Actor) {
    const awards = await prisma.award.findMany({
      where: { deletedAt: null, status: { in: ['NOMINATION_OPEN', 'VOTING_OPEN'] } },
      include: AWARD_INCLUDE,
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });
    const [people, hof] = await Promise.all([this.activePeople(), this.hallOfFameIds()]);
    const me = actor.employeeId ? people.find((p) => p.id === actor.employeeId) ?? null : null;

    const nominationAwards = [];
    const votingAwards = [];
    for (const a of awards) {
      const rules = this.rulesOf(a);
      if (a.status === 'NOMINATION_OPEN') {
        const mine = me
          ? await prisma.awardNomination.findMany({ where: { nominatedById: me.id, categoryId: { in: a.categories.map((c) => c.id) } }, include: { nominee: { select: PERSON_SELECT } } })
          : [];
        nominationAwards.push({
          id: a.id, title: a.title, periodLabel: a.periodLabel, description: a.description, isOfficial: a.isOfficial,
          categories: a.categories.map((c) => ({
            id: c.id, title: c.title, groupName: c.nomineeGroup?.name ?? 'Organisation-wide',
            options: people.filter((p) => nomineeDenial(p, this.nomineeScope(c), rules, hof) === null).map(view),
            myNominations: mine.filter((n) => n.categoryId === c.id).map((n) => view(n.nominee)),
          })),
        });
      } else {
        const cands = await this.candidates(a, people, hof);
        const ballot = me
          ? await prisma.awardBallot.findUnique({ where: { awardId_voterId: { awardId: a.id, voterId: me.id } }, include: { votes: { include: { nominee: { select: PERSON_SELECT } } } } })
          : null;
        votingAwards.push({
          id: a.id, title: a.title, periodLabel: a.periodLabel, description: a.description, isOfficial: a.isOfficial,
          submittedAt: ballot?.submittedAt ?? null,
          categories: a.categories.map((c) => ({
            id: c.id, title: c.title, votesPerVoter: c.votesPerVoter,
            groupName: c.nomineeGroup?.name ?? null,
            canVote: Boolean(me && inGroup(me, this.voterScope(c))),
            candidates: (cands.get(c.id) ?? []).map(view),
            // Your own choices only, once your ballot is in.
            myVotes: ballot ? ballot.votes.filter((v) => v.categoryId === c.id).sort((x, y) => x.slot - y.slot).map((v) => view(v.nominee)) : [],
          })),
        });
      }
    }

    // Final results: awardees and placement — vote totals stay with HR.
    const finals = await prisma.award.findMany({
      where: { status: 'FINALIZED', deletedAt: null },
      include: {
        categories: { orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } },
        results: { where: { decision: 'CONFIRMED' }, include: { employee: { select: PERSON_SELECT } }, orderBy: [{ placement: 'asc' }] },
      },
      orderBy: [{ finalizedAt: 'desc' }],
      take: 30,
    });
    const results = finals.map((a) => ({
      id: a.id, title: a.title, periodLabel: a.periodLabel, type: a.type, finalizedAt: a.finalizedAt, resultMode: a.resultMode,
      awardees: a.results.map((r) => ({ categoryTitle: a.categories.find((c) => c.id === r.categoryId)?.title ?? null, placement: r.placement, employee: view(r.employee) })),
    }));

    const myHistory = me
      ? {
          awards: (await prisma.awardResult.findMany({
            where: { employeeId: me.id, decision: 'CONFIRMED', award: { status: 'FINALIZED', deletedAt: null } },
            include: { award: { select: { title: true, periodLabel: true, finalizedAt: true } }, category: { select: { title: true } } },
            orderBy: { createdAt: 'desc' },
          })).map((r) => ({ award: r.award.title, category: r.category?.title ?? null, period: r.award.periodLabel, placement: r.placement, finalizedAt: r.award.finalizedAt })),
          hallOfFame: await prisma.hallOfFameRecord.findMany({ where: { employeeId: me.id, deletedAt: null }, select: { awardYear: true, title: true, conferredOn: true } }),
        }
      : { awards: [], hallOfFame: [] };

    return { nominationAwards, votingAwards, results, myHistory, isHallOfFame: me ? hof.has(me.id) : false };
  }

  // ── Hall of Fame ────────────────────────────────────────────────────────────

  static async listHallOfFame() {
    const rows = await prisma.hallOfFameRecord.findMany({
      where: { deletedAt: null },
      include: { employee: { select: PERSON_SELECT } },
      orderBy: [{ awardYear: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => ({ ...r, employee: view(r.employee) }));
  }

  static async recordHallOfFame(input: any, actor: Actor) {
    const employeeId = String(input?.employeeId ?? '');
    const awardYear = Number(input?.awardYear);
    if (!employeeId) throw new AppError('Choose the employee.', 400);
    if (!Number.isInteger(awardYear) || awardYear < 1900 || awardYear > 2100) throw new AppError('Enter the year the award was conferred.', 400);
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: PERSON_SELECT });
    if (!emp) throw new AppError('Employee not found.', 404);
    const dup = await prisma.hallOfFameRecord.findFirst({ where: { employeeId, awardYear, deletedAt: null } });
    if (dup) throw new AppError(`${view(emp).fullName} already has a Hall of Fame record for ${awardYear}.`, 409);
    const row = await prisma.hallOfFameRecord.create({
      data: {
        employeeId, awardYear,
        title: typeof input?.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 150) : 'Hall of Fame Award',
        conferredOn: input?.conferredOn ? asDate(input.conferredOn, 'The conferred date') : null,
        notes: typeof input?.notes === 'string' ? input.notes.trim().slice(0, 2000) || null : null,
        recordedById: actor.employeeId ?? actor.id,
      },
    });
    await createAuditLog({ actorUserId: actor.id, targetEmployeeId: employeeId, action: 'HALL_OF_FAME_RECORDED', entityType: 'HallOfFameRecord', entityId: row.id, metadata: { awardYear, title: row.title } });
    return row;
  }

  /** Corrects a record entered by mistake (kept, marked removed). */
  static async removeHallOfFame(id: string, actor: Actor) {
    const r = await prisma.hallOfFameRecord.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw new AppError('Hall of Fame record not found.', 404);
    await prisma.hallOfFameRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    await createAuditLog({ actorUserId: actor.id, targetEmployeeId: r.employeeId, action: 'HALL_OF_FAME_REMOVED', entityType: 'HallOfFameRecord', entityId: id, metadata: { awardYear: r.awardYear } });
  }
}
