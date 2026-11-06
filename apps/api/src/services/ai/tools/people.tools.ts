import { EmploymentState, EmploymentStatus, PermissionTier } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../config/prisma';
import { servicePeriod } from '../../../lib/service-period';
import { finalResultOf } from '../../evaluation-workflow';
import { isHr } from '../actor/ai-actor';
import { describeDataset } from '../charts/chart-schema';
import { profileLinkFor } from '../links/app-links';
import { dateKey, fullName, humanise, teamIds } from './tool-helpers';
import { ALL_TIERS, AiTool, dateArg, defineTool, ToolContext } from './tool-types';

/**
 * People lookups the assistant uses to understand Hospicio's own words.
 *
 *   get_org_catalog   every unit and job role by name, so the model can map
 *                     everyday words ("nurse", "caretaker", "teacher") to the
 *                     roles Hospicio actually has ("Clinic Staff", the Pastoral
 *                     Care / Homelife staff, "ECCD Teacher") instead of matching
 *                     keywords.
 *   find_employees    filters people by role, unit, profession, experience,
 *                     length of service and age, sorted by any of them, within
 *                     what the asker may see (HR everyone; supervisor self and
 *                     direct reports; employee self).
 *
 * Experience has three parts and the tools always give all three:
 *   lengthOfService      at Hospicio, from the hire date (calendar years/months)
 *   priorExperienceYears before Hospicio, entered by HR (null = not recorded)
 *   totalExperienceYears the two added together
 */

// ── shared figures ───────────────────────────────────────────────────────────

export interface ExperienceFigures {
  lengthOfService: { years: number; months: number; text: string } | null;
  /** Service in years with one decimal, for sorting and charts. */
  serviceYears: number | null;
  priorExperienceYears: number | null;
  totalExperienceYears: number | null;
}

const yearsText = (years: number, months: number) =>
  [years ? `${years} year${years === 1 ? '' : 's'}` : null, months ? `${months} month${months === 1 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' ') || 'less than a month';

export function experienceFigures(hireDate: Date | null, priorExperienceYears: number | null, today: string): ExperienceFigures {
  const period = hireDate ? servicePeriod(hireDate, today) : null;
  const serviceYears = period ? Math.round((period.years + period.months / 12 + period.days / 365) * 10) / 10 : null;
  const prior = priorExperienceYears ?? null;
  return {
    lengthOfService: period ? { years: period.years, months: period.months, text: yearsText(period.years, period.months) } : null,
    serviceYears,
    priorExperienceYears: prior,
    totalExperienceYears: serviceYears === null ? prior : Math.round((serviceYears + (prior ?? 0)) * 10) / 10,
  };
}

/** Age in completed years on `today`, or null. */
export function ageOn(birthDate: Date | null, today: string): number | null {
  if (!birthDate) return null;
  return servicePeriod(birthDate, today)?.years ?? null;
}

/**
 * Whether this asker may see this employee's birth date, age and employee number:
 * HR for anyone, everyone else only for themselves. A supervisor never sees a
 * direct report's personal details (the same rule as My Team and the Org Chart).
 */
function mayDisclosePersonal(ctx: ToolContext, employeeId: string): boolean {
  if (employeeId === ctx.actor.employeeId) return true;
  return isHr(ctx.actor);
}

// ── Work groups: Hospicio's everyday words → its role codes ──────────────────

/**
 * Kinds of work people ask about in their own words, mapped to the job role
 * CODES that do that work at Hospicio. Fixed here (codes do not change when a
 * title is reworded), so "caretaker" always means the same people.
 */
export const WORK_GROUPS = [
  {
    key: 'caretakers',
    label: 'Caretakers / house parents (residential child care)',
    words: 'caretaker, caregiver, house parent, bantay, tagapag-alaga, homelife, cottage staff',
    roleCodes: ['RENDU_A_STAFF', 'RENDU_B_STAFF', 'RENDU_C_STAFF', 'ST_JOSEPH_STAFF', 'ST_MARY_STAFF', 'ST_VINCENT_STAFF', 'STA_LUISA_STAFF', 'SIGLIV_BOYS_STAFF', 'TAHAN_CENTER_STAFF', 'SANCTUARY_CENTER_STAFF', 'DORMITORY_STAFF'],
  },
  { key: 'nursing', label: 'Nursing / clinic', words: 'nurse, nursing, clinic, medical staff, health worker, first aid', roleCodes: ['CLINIC_STAFF'] },
  { key: 'therapy', label: 'Physical therapy', words: 'therapist, physical therapy, PT, rehab', roleCodes: ['PT_STAFF', 'PT_COORDINATOR'] },
  { key: 'teachers', label: 'Teachers / preschool', words: 'teacher, preschool, daycare, ECCD, tutor', roleCodes: ['ECCD_TEACHER', 'PRE_SCHOOL_STAFF'] },
  { key: 'psychologists', label: 'Psychologists', words: 'psychologist, counselor, guidance', roleCodes: ['PSYCHOLOGIST', 'PT_PSYCHOLOGIST'] },
  { key: 'social_workers', label: 'Social workers', words: 'social worker, case worker, SSD', roleCodes: ['SOCIAL_WORKER', 'HEAD_SSD'] },
  { key: 'kitchen', label: 'Kitchen, canteen and bakery', words: 'cook, kitchen, food, canteen, baker, bakery', roleCodes: ['KITCHEN_STAFF', 'KITCHEN_SUPERVISOR', 'CANTEEN_STAFF', 'BAKERY_STAFF'] },
  { key: 'cleaning', label: 'Janitorial and laundry', words: 'janitor, cleaner, housekeeping, laundry, labandera', roleCodes: ['JANITORIAL_STAFF', 'JANITORIAL_SUPERVISOR', 'LAUNDRY_STAFF'] },
  { key: 'maintenance', label: 'Maintenance', words: 'maintenance, electrician, plumber, repairs, carpenter', roleCodes: ['MAINTENANCE_STAFF', 'MAINTENANCE_SUPERVISOR'] },
  { key: 'drivers', label: 'Drivers', words: 'driver, tsuper, vehicle', roleCodes: ['DRIVER'] },
  { key: 'front_desk', label: 'Front desk and secretaries', words: 'receptionist, front desk, secretary', roleCodes: ['RECEPTIONIST', 'ADMIN_SEC'] },
  { key: 'finance', label: 'Finance and stockroom', words: 'accountant, finance, cashier, stockroom, supplies', roleCodes: ['ACCOUNTING_STAFF', 'STOCKROOM_STAFF', 'PMO_STAFF'] },
  { key: 'hr', label: 'Human Resources', words: 'HR, personnel', roleCodes: ['HR_OFFICER', 'HR_ASSISTANT'] },
  { key: 'heads', label: 'Heads and supervisors', words: 'head, supervisor, coordinator, manager, in charge', roleCodes: [] as string[] },
] as const;
export type WorkGroupKey = (typeof WORK_GROUPS)[number]['key'];
const WORK_GROUP_KEYS = WORK_GROUPS.map((g) => g.key) as unknown as [WorkGroupKey, ...WorkGroupKey[]];

// ── Org catalog ──────────────────────────────────────────────────────────────

const catalogTool = defineTool({
  name: 'get_org_catalog',
  description:
    "Every unit and job role Hospicio de San Jose has in HRISense, grouped by department and unit, with each role's id (HR also gets how many active employees hold it). Call this FIRST whenever the user names a kind of worker or work in their own words (nurse, caretaker, house parent, teacher, cook, guard, social worker, therapist…) so you can map it to the real role titles before searching. Hospicio's titles often differ from everyday words: nursing is done by Clinic Staff; residential child care by the Pastoral Care / Homelife staff of each home (Rendu A/B/C, St. Joseph, St. Mary, St. Vincent, Sta. Luisa, Sigliv Boys, Tahan Center, Sanctuary Center) and Dormitory Staff.",
  tiers: ALL_TIERS,
  args: z.object({}).strict(),
  async run(ctx: ToolContext) {
    const hr = isHr(ctx.actor);
    const [roles, counts] = await Promise.all([
      prisma.jobRole.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          title: true,
          isHead: true,
          isSupervisor: true,
          unit: { select: { id: true, name: true } },
          department: { select: { name: true } },
        },
        orderBy: { title: 'asc' },
      }),
      hr
        ? prisma.employee.groupBy({
            by: ['jobRoleId'],
            where: { deletedAt: null, employmentState: { in: [EmploymentState.ACTIVE, EmploymentState.ON_LEAVE] } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ jobRoleId: string; _count: { _all: number } }>),
    ]);
    const countOf = new Map(counts.map((c) => [c.jobRoleId, c._count._all]));
    const units = new Map<string, { unit: string; unitId: string | null; department: string | null; roles: any[] }>();
    for (const r of roles) {
      const key = r.unit?.id ?? 'org';
      if (!units.has(key)) {
        units.set(key, { unit: r.unit?.name ?? 'Organisation-wide', unitId: r.unit?.id ?? null, department: r.department?.name ?? null, roles: [] });
      }
      units.get(key)!.roles.push({
        roleId: r.id,
        title: r.title,
        head: r.isHead || undefined,
        supervisor: r.isSupervisor || undefined,
        activeEmployees: hr ? countOf.get(r.id) ?? 0 : undefined,
      });
    }
    const titleOf = new Map(roles.map((r) => [r.code, r.title]));
    return {
      data: {
        workGroups: WORK_GROUPS.map((g) => ({
          workGroup: g.key,
          label: g.label,
          everydayWords: g.words,
          roles: g.key === 'heads' ? roles.filter((r) => r.isHead || r.isSupervisor).map((r) => r.title) : g.roleCodes.map((c) => titleOf.get(c)).filter(Boolean),
        })),
        units: [...units.values()].sort((a, b) => a.unit.localeCompare(b.unit)),
        note: 'For a kind of work, pass workGroup to find_employees (it covers every role in the group). Otherwise map the user\'s words to these titles and pass roleIds. Say which roles you used, e.g. "nurses (Clinic Staff)". If no role does that work, say so plainly and name the closest one.',
      },
      rows: roles.length,
    };
  },
});

// ── People finder ────────────────────────────────────────────────────────────

const SORTS = ['serviceLength', 'totalExperience', 'priorExperience', 'age', 'hireDate', 'name'] as const;
type SortKey = (typeof SORTS)[number];
const EXTRAS = ['latestEvaluation', 'trainingsCompleted', 'complianceAttention'] as const;
type Extra = (typeof EXTRAS)[number];

const years = (desc: string) => z.number().min(0).max(80).describe(desc);

const findArgs = z
  .object({
    workGroup: z.enum(WORK_GROUP_KEYS).optional().describe('A kind of work in everyday words — caretakers, nursing, teachers, kitchen… (see get_org_catalog workGroups). Preferred for words like "caretaker" or "nurse".'),
    roleIds: z.array(z.string().uuid()).max(30).optional().describe('Job role ids from get_org_catalog.'),
    roleText: z.string().min(2).max(60).optional().describe('Part of a job role title, e.g. "Clinic" or "Staff". Use roleIds when you can.'),
    unitIds: z.array(z.string().uuid()).max(15).optional().describe('Unit ids from get_org_catalog.'),
    unitText: z.string().min(2).max(60).optional().describe('Part of a unit name, e.g. "Homelife".'),
    profession: z.string().min(2).max(60).optional().describe('Part of the profession on the PRC licence (often empty).'),
    employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
    includeSeparated: z.boolean().optional().describe('HR only: also include separated / archived employees.'),
    minServiceYears: years('At least this many years of service at Hospicio.').optional(),
    maxServiceYears: years('At most this many years of service at Hospicio.').optional(),
    minPriorExperienceYears: years('At least this many years of experience before Hospicio.').optional(),
    minTotalExperienceYears: years('At least this many years of experience in total (before + at Hospicio).').optional(),
    minAge: z.number().int().min(15).max(100).optional(),
    maxAge: z.number().int().min(15).max(100).optional(),
    hiredFrom: dateArg.optional(),
    hiredTo: dateArg.optional(),
    sortBy: z.enum(SORTS).optional().describe('Default: serviceLength (longest first) when filtering by experience or service, otherwise name.'),
    order: z.enum(['desc', 'asc']).optional().describe('Default desc for numbers (largest first), asc for name.'),
    limit: z.number().int().min(1).max(50).optional().describe('Default 10. Ask for more only when the user wants a longer list.'),
    include: z.array(z.enum(EXTRAS)).max(3).optional().describe('Extra facts per person: latestEvaluation (HR only), trainingsCompleted, complianceAttention (HR only).'),
  })
  .strict();
type FindArgs = z.infer<typeof findArgs>;

const findTool = defineTool({
  name: 'find_employees',
  description:
    "Find and rank people by job role, unit, profession, employment status, length of service at Hospicio, experience before Hospicio, total experience, age or hire date — e.g. \"Clinic Staff with at least 10 years of experience\", \"the 10 longest-serving caretakers\", \"who is the oldest employee\". Within the asker's access (HR: everyone; supervisor: themselves and direct reports; employee: themselves). Each person comes with lengthOfService, priorExperienceYears (null = not recorded), totalExperienceYears, birthDate and age (HR: anyone; everyone else: only themselves, null for others), a profileLink, and optional extras. When nobody matches, `closest` lists the nearest people (same role/unit filters, other limits ignored) so you can offer them. Also registers a chart dataset of the ranked measure.",
  tiers: ALL_TIERS,
  args: findArgs,
  async run(ctx: ToolContext, args: FindArgs) {
    const hr = isHr(ctx.actor);
    const scopeIds = hr ? null : [ctx.actor.employeeId, ...teamIds(ctx)];
    const where: any = {
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(hr && args.includeSeparated ? {} : { deletedAt: null, employmentState: { in: [EmploymentState.ACTIVE, EmploymentState.ON_LEAVE] } }),
      ...(args.employmentStatus ? { employmentStatus: args.employmentStatus } : {}),
    };
    const and: any[] = [];
    if (args.workGroup) {
      const group = WORK_GROUPS.find((g) => g.key === args.workGroup)!;
      and.push(group.key === 'heads' ? { jobRole: { OR: [{ isHead: true }, { isSupervisor: true }] } } : { jobRole: { code: { in: [...group.roleCodes] } } });
    }
    if (args.roleIds?.length) and.push({ jobRoleId: { in: args.roleIds } });
    if (args.roleText) and.push({ jobRole: { title: { contains: args.roleText } } });
    if (args.unitIds?.length) and.push({ unitId: { in: args.unitIds } });
    if (args.unitText) and.push({ unit: { name: { contains: args.unitText } } });
    if (args.profession) and.push({ professionalRole: { contains: args.profession } });
    if (args.hiredFrom || args.hiredTo) {
      and.push({ hireDate: { ...(args.hiredFrom ? { gte: new Date(args.hiredFrom) } : {}), ...(args.hiredTo ? { lte: new Date(args.hiredTo) } : {}) } });
    }
    if (and.length) where.AND = and;

    const candidates = await prisma.employee.findMany({
      where,
      take: 1000,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        hireDate: true,
        dateOfBirth: true,
        priorExperienceYears: true,
        professionalRole: true,
        employmentStatus: true,
        employmentState: true,
        deletedAt: true,
        jobRole: { select: { title: true } },
        unit: { select: { name: true } },
      },
    });

    const people = candidates.map((e) => {
      const fig = experienceFigures(e.hireDate, e.priorExperienceYears, ctx.today);
      const personal = mayDisclosePersonal(ctx, e.id);
      return {
        e,
        fig,
        age: personal ? ageOn(e.dateOfBirth, ctx.today) : null,
        birthDate: personal ? dateKey(e.dateOfBirth) : null,
      };
    });

    const numericFilter = (p: (typeof people)[number]) => {
      const s = p.fig.serviceYears ?? 0;
      if (args.minServiceYears !== undefined && s < args.minServiceYears) return false;
      if (args.maxServiceYears !== undefined && s > args.maxServiceYears) return false;
      if (args.minPriorExperienceYears !== undefined && (p.fig.priorExperienceYears ?? 0) < args.minPriorExperienceYears) return false;
      if (args.minTotalExperienceYears !== undefined && (p.fig.totalExperienceYears ?? 0) < args.minTotalExperienceYears) return false;
      if (args.minAge !== undefined && (p.age === null || p.age < args.minAge)) return false;
      if (args.maxAge !== undefined && (p.age === null || p.age > args.maxAge)) return false;
      return true;
    };

    const experienceAsked =
      args.minServiceYears !== undefined || args.maxServiceYears !== undefined || args.minTotalExperienceYears !== undefined || args.minPriorExperienceYears !== undefined;
    const sortBy: SortKey =
      args.sortBy ?? (args.minTotalExperienceYears !== undefined || args.minPriorExperienceYears !== undefined ? 'totalExperience' : experienceAsked ? 'serviceLength' : args.minAge !== undefined || args.maxAge !== undefined ? 'age' : 'name');
    const order = args.order ?? (sortBy === 'name' ? 'asc' : sortBy === 'hireDate' ? 'asc' : 'desc');
    const measure = (p: (typeof people)[number]): number | string => {
      switch (sortBy) {
        case 'serviceLength': return p.fig.serviceYears ?? -1;
        case 'totalExperience': return p.fig.totalExperienceYears ?? -1;
        case 'priorExperience': return p.fig.priorExperienceYears ?? -1;
        case 'age': return p.age ?? -1;
        case 'hireDate': return dateKey(p.e.hireDate) ?? '9999';
        default: return `${p.e.lastName} ${p.e.firstName}`.toLowerCase();
      }
    };
    const sorted = (list: typeof people) =>
      [...list].sort((a, b) => {
        const x = measure(a);
        const y = measure(b);
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return order === 'asc' ? c : -c;
      });

    const limit = args.limit ?? 10;
    const matched = sorted(people.filter(numericFilter));
    const shown = matched.slice(0, limit);
    let closest = matched.length ? [] : sorted(people).slice(0, 5);
    // A supervisor (or employee) whose own team has nobody in that role: offer the team.
    let teamInstead = false;
    if (!matched.length && !closest.length && !hr) {
      const team = await prisma.employee.findMany({
        where: { id: { in: scopeIds! }, deletedAt: null },
        take: 50,
        select: {
          id: true, firstName: true, lastName: true, employeeNumber: true, hireDate: true, dateOfBirth: true,
          priorExperienceYears: true, professionalRole: true, employmentStatus: true, employmentState: true, deletedAt: true,
          jobRole: { select: { title: true } }, unit: { select: { name: true } },
        },
      });
      closest = sorted(
        team.map((e) => ({
          e,
          fig: experienceFigures(e.hireDate, e.priorExperienceYears, ctx.today),
          age: mayDisclosePersonal(ctx, e.id) ? ageOn(e.dateOfBirth, ctx.today) : null,
          birthDate: mayDisclosePersonal(ctx, e.id) ? dateKey(e.dateOfBirth) : null,
        }))
      ).slice(0, 10);
      teamInstead = closest.length > 0;
    }

    const extras = new Set<Extra>(args.include ?? []);
    const ids = [...shown, ...closest].map((p) => p.e.id);
    const [evaluations, trainings, compliance] = await Promise.all([
      extras.has('latestEvaluation') && hr && ids.length
        ? prisma.evaluationAssignment.findMany({
            where: { employeeId: { in: ids }, deletedAt: null, raterType: 'HEAD', status: 'FINALIZED' },
            orderBy: { finalizedAt: 'desc' },
            select: {
              employeeId: true, status: true, finalizedAt: true, overallRating: true, overallScore: true,
              combinedScore: true, combinedBreakdown: true, templateSnapshot: true,
              cycle: { select: { name: true, evaluationMode: true } },
            },
          })
        : Promise.resolve([] as any[]),
      extras.has('trainingsCompleted') && ids.length
        ? prisma.trainingParticipant.groupBy({
            by: ['employeeId'],
            where: { employeeId: { in: ids }, participationStatus: 'COMPLETED', trainingActivity: { deletedAt: null } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ employeeId: string; _count: { _all: number } }>),
      extras.has('complianceAttention') && hr && ids.length
        ? Promise.all(ids.map(async (id) => [id, await complianceAttentionOf(id)] as const))
        : Promise.resolve([] as Array<readonly [string, number]>),
    ]);
    const latestEval = new Map<string, any>();
    for (const ev of evaluations) if (!latestEval.has(ev.employeeId)) latestEval.set(ev.employeeId, ev);
    const trainingCount = new Map(trainings.map((t) => [t.employeeId, t._count._all]));
    const complianceCount = new Map(compliance);

    const describe = (p: (typeof people)[number]) => {
      const ev = latestEval.get(p.e.id);
      return {
        id: p.e.id,
        name: fullName(p.e),
        employeeNumber: mayDisclosePersonal(ctx, p.e.id) ? p.e.employeeNumber : undefined,
        jobRole: p.e.jobRole?.title ?? null,
        unit: p.e.unit?.name ?? null,
        profession: p.e.professionalRole || undefined,
        employmentStatus: humanise(p.e.employmentStatus),
        employmentState: p.e.employmentState === 'ACTIVE' ? undefined : humanise(p.e.employmentState),
        archived: p.e.deletedAt ? true : undefined,
        hireDate: dateKey(p.e.hireDate),
        lengthOfService: p.fig.lengthOfService?.text ?? null,
        serviceYears: p.fig.serviceYears,
        priorExperienceYears: p.fig.priorExperienceYears,
        totalExperienceYears: p.fig.totalExperienceYears,
        birthDate: p.birthDate ?? undefined,
        age: p.age ?? undefined,
        latestEvaluation: extras.has('latestEvaluation')
          ? hr
            ? ev
              ? { cycle: ev.cycle.name, finalizedOn: dateKey(ev.finalizedAt), overallRating: ev.overallRating, finalResult: finalResultOf(ev, ev.cycle.evaluationMode)?.text ?? null }
              : 'none finalized'
            : undefined
          : undefined,
        trainingsCompleted: extras.has('trainingsCompleted') ? trainingCount.get(p.e.id) ?? 0 : undefined,
        complianceItemsNeedingAttention: extras.has('complianceAttention') && hr ? complianceCount.get(p.e.id) ?? 0 : undefined,
        profileLink: profileLinkFor(ctx.actor, p.e.id) ?? undefined,
      };
    };

    // A chart of the ranked measure, when there is something to compare.
    let dataset = null;
    const chartable = shown.length >= 2 && sortBy !== 'name' && sortBy !== 'hireDate';
    if (chartable) {
      const key = sortBy === 'age' ? 'age' : sortBy === 'priorExperience' ? 'priorYears' : sortBy === 'totalExperience' ? 'totalYears' : 'serviceYears';
      const label = sortBy === 'age' ? 'Age' : sortBy === 'priorExperience' ? 'Years before Hospicio' : sortBy === 'totalExperience' ? 'Total years of experience' : 'Years of service';
      const id = ctx.datasets.add({
        title: `${label} by employee`,
        xKey: 'employee',
        xLabel: 'Employee',
        xType: 'category',
        unit: sortBy === 'age' ? 'years old' : 'years',
        series: [{ key, label }],
        rows: shown
          .map((p) => ({
            employee: fullName(p.e) ?? 'Unnamed employee',
            [key]: sortBy === 'age' ? p.age : sortBy === 'priorExperience' ? p.fig.priorExperienceYears : sortBy === 'totalExperience' ? p.fig.totalExperienceYears : p.fig.serviceYears,
          }))
          .filter((r) => typeof r[key] === 'number'),
      });
      dataset = describeDataset(ctx.datasets, id);
    }

    // Averages and per-unit figures are computed here, never by the model.
    const avg = (xs: Array<number | null>) => {
      const v = xs.filter((x): x is number => typeof x === 'number');
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const summaryOf = (list: typeof people) => ({
      people: list.length,
      averageServiceYears: avg(list.map((p) => p.fig.serviceYears)),
      averageTotalExperienceYears: avg(list.map((p) => p.fig.totalExperienceYears)),
      averageAge: avg(list.map((p) => p.age)),
      priorExperienceNotRecorded: list.filter((p) => p.fig.priorExperienceYears === null).length || undefined,
    });
    const units = new Map<string, typeof people>();
    for (const p of matched) {
      const u = p.e.unit?.name ?? 'No unit';
      units.set(u, [...(units.get(u) ?? []), p]);
    }
    const summary = matched.length
      ? {
          ...summaryOf(matched),
          byUnit: units.size > 1 ? [...units.entries()].map(([unit, list]) => ({ unit, ...summaryOf(list) })).sort((a, b) => (b.averageServiceYears ?? 0) - (a.averageServiceYears ?? 0)) : undefined,
        }
      : undefined;

    const roleFilterEmpty = candidates.length === 0 && Boolean(args.workGroup || args.roleText || args.roleIds?.length || args.unitText || args.unitIds?.length || args.profession);
    return {
      data: {
        scope: hr ? 'Everyone' : ctx.actor.tier === PermissionTier.SUPERVISOR ? 'You and your direct reports' : 'Only you',
        asOf: ctx.today,
        sortedBy: `${sortBy} (${order === 'desc' ? 'largest first' : 'smallest first'})`,
        peopleInRoleOrUnit: candidates.length,
        matchedCount: matched.length,
        summary,
        showing: shown.length,
        matches: shown.map(describe),
        closest: closest.length ? closest.map(describe) : undefined,
        chart: dataset ?? undefined,
        experienceNote:
          'lengthOfService/serviceYears = at Hospicio (from the hire date). priorExperienceYears = before Hospicio (null = not recorded in HRISense). totalExperienceYears = both. When the user says "experience", give both parts and the total.',
        note: teamInstead
          ? 'Nobody the user may see (themselves and their DIRECT reports) holds that role. Say so plainly, then offer `closest` — their own team, by the same measure. People further down (their reports\' reports) are outside their access.'
          : roleFilterEmpty && hr
          ? 'Nobody holds a role/unit/profession matching those words. Call get_org_catalog, map the words to Hospicio\'s real role titles (e.g. nurse → Clinic Staff, or a workGroup) and search again.'
          : matched.length === 0
            ? 'Nobody met every limit. Say so in one sentence, then offer the people in `closest` (the nearest by the same measure) and a useful next step. For HR, when the role itself is missing or nobody qualifies, offer to prepare a job opening.'
            : matched.length > shown.length
              ? `Only the first ${shown.length} of ${matched.length} are listed; say so and offer the Employee Directory for the full list.`
              : undefined,
      },
      rows: shown.length + closest.length,
    };
  },
});

async function complianceAttentionOf(employeeId: string): Promise<number> {
  const { ComplianceService } = await import('../../compliance.service');
  const summary = await ComplianceService.getEmployeeComplianceSummary(employeeId);
  const items: any[] = Array.isArray(summary) ? summary : (summary as any)?.items ?? [];
  return items.filter((i) => ['MISSING', 'EXPIRED', 'EXPIRING_SOON', 'NEEDS_REVIEW'].includes(i.status)).length;
}

export const PEOPLE_TOOLS: AiTool[] = [catalogTool, findTool];
