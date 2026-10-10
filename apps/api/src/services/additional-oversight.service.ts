import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { createAuditLog } from '../lib/audit';

/**
 * Additional oversight — the Org Chart's secondary, cross-branch relationships.
 *
 * An actual employee (e.g. Sister) also oversees another employee, or everyone
 * currently holding a job role (e.g. Kitchen Supervisor), outside their normal
 * branch. The employee stays in their real branch: `immediateSupervisorId` is
 * still the primary hierarchy. This is display information only — it grants no
 * access in leave, evaluations, attendance, schedules, My Team, employee
 * editing, archiving, compliance or medical / psychological records.
 */

type Actor = { id: string; employeeId?: string | null };

export interface OversightPair {
  relationshipId: string;
  overseerId: string;
  overseenId: string;
  /** Set when the relationship targets a job role rather than one employee. */
  viaJobRoleTitle: string | null;
}

interface RelationshipRow {
  id: string;
  overseerId: string;
  overseenEmployeeId: string | null;
  overseenJobRoleId: string | null;
  overseenJobRole?: { title: string } | null;
}

interface EmployeeRow {
  id: string;
  jobRoleId: string;
  immediateSupervisorId: string | null;
}

/**
 * Relationships → overseer → employee pairs, over the given (active) employees.
 * Never oneself; never someone who already reports to the overseer (that is the
 * primary line, not an additional one); each pair once, even when an employee
 * target and a job-role target name the same person.
 */
export function expandOversight(rels: RelationshipRow[], employees: EmployeeRow[]): OversightPair[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const byRole = new Map<string, EmployeeRow[]>();
  for (const e of employees) byRole.set(e.jobRoleId, [...(byRole.get(e.jobRoleId) ?? []), e]);

  const out: OversightPair[] = [];
  const seen = new Set<string>();
  for (const r of rels) {
    if (!byId.has(r.overseerId)) continue;
    const targets = r.overseenEmployeeId
      ? [byId.get(r.overseenEmployeeId)].filter((x): x is EmployeeRow => !!x)
      : byRole.get(r.overseenJobRoleId ?? '') ?? [];
    for (const t of targets) {
      if (t.id === r.overseerId || t.immediateSupervisorId === r.overseerId) continue;
      const key = `${r.overseerId}>${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        relationshipId: r.id,
        overseerId: r.overseerId,
        overseenId: t.id,
        viaJobRoleTitle: r.overseenJobRoleId ? r.overseenJobRole?.title ?? null : null,
      });
    }
  }
  return out;
}

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeNumber: true,
  jobRole: { select: { title: true } },
  unit: { select: { name: true } },
} as const;

const personOf = (e: { id: string; firstName: string; lastName: string; employeeNumber: string; jobRole?: { title: string } | null; unit?: { name: string } | null }) => ({
  id: e.id,
  fullName: `${e.firstName} ${e.lastName}`.trim(),
  employeeNumber: e.employeeNumber,
  jobRoleTitle: e.jobRole?.title ?? 'Unassigned Role',
  unitName: e.unit?.name ?? 'Unassigned Unit',
});

const activeEmployees = () =>
  prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, jobRoleId: true, immediateSupervisorId: true } });

export class AdditionalOversightService {
  /** Every relationship, with whom it covers right now (HR's manager). */
  static async list() {
    const rels = await prisma.additionalOversight.findMany({
      include: {
        overseer: { select: { ...PERSON_SELECT, deletedAt: true } },
        overseenEmployee: { select: { ...PERSON_SELECT, deletedAt: true } },
        overseenJobRole: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const pairs = expandOversight(rels, await activeEmployees());
    const coveredIds = [...new Set(pairs.map((p) => p.overseenId))];
    const covered = new Map(
      (await prisma.employee.findMany({ where: { id: { in: coveredIds } }, select: PERSON_SELECT })).map((e) => [e.id, personOf(e)])
    );
    return rels.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      overseer: { ...personOf(r.overseer), isArchived: r.overseer.deletedAt !== null },
      target: r.overseenEmployee
        ? { kind: 'EMPLOYEE' as const, employee: { ...personOf(r.overseenEmployee), isArchived: r.overseenEmployee.deletedAt !== null } }
        : { kind: 'JOB_ROLE' as const, jobRole: r.overseenJobRole },
      /** The employees this relationship puts on the chart now. */
      covers: pairs.filter((p) => p.relationshipId === r.id).map((p) => covered.get(p.overseenId)!).filter(Boolean),
    }));
  }

  static async add(input: { overseerId?: string; overseenEmployeeId?: string | null; overseenJobRoleId?: string | null }, actor: Actor) {
    const overseerId = String(input?.overseerId ?? '').trim();
    const employeeId = String(input?.overseenEmployeeId ?? '').trim() || null;
    const jobRoleId = String(input?.overseenJobRoleId ?? '').trim() || null;
    if (!overseerId) throw new AppError('Choose the additional overseer.', 400);
    if (Boolean(employeeId) === Boolean(jobRoleId)) throw new AppError('Choose who they oversee: one employee, or everyone in a job role.', 400);

    const overseer = await prisma.employee.findFirst({ where: { id: overseerId, deletedAt: null }, select: PERSON_SELECT });
    if (!overseer) throw new AppError('The additional overseer must be an active employee.', 400);
    const overseerName = personOf(overseer).fullName;

    let targetLabel: string;
    if (employeeId) {
      if (employeeId === overseerId) throw new AppError('An employee cannot oversee themselves.', 400);
      const target = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { ...PERSON_SELECT, immediateSupervisorId: true } });
      if (!target) throw new AppError('The employee to oversee must be an active employee.', 400);
      targetLabel = personOf(target).fullName;
      if (target.immediateSupervisorId === overseerId) {
        throw new AppError(`${overseerName} is already ${targetLabel}'s immediate supervisor — that is the primary reporting line, not additional oversight.`, 409);
      }
      if (await prisma.additionalOversight.findFirst({ where: { overseerId, overseenEmployeeId: employeeId } })) {
        throw new AppError(`${overseerName} already has additional oversight of ${targetLabel}.`, 409);
      }
    } else {
      const role = await prisma.jobRole.findUnique({ where: { id: jobRoleId! }, select: { id: true, title: true } });
      if (!role) throw new AppError('Job role not found.', 400);
      targetLabel = role.title;
      const holders = (await prisma.employee.findMany({ where: { jobRoleId: role.id, deletedAt: null }, select: { id: true, immediateSupervisorId: true } }))
        .filter((h) => h.id !== overseerId);
      if (holders.length && holders.every((h) => h.immediateSupervisorId === overseerId)) {
        throw new AppError(`Everyone in ${role.title} already reports to ${overseerName} — that is the primary reporting line, not additional oversight.`, 409);
      }
      if (await prisma.additionalOversight.findFirst({ where: { overseerId, overseenJobRoleId: role.id } })) {
        throw new AppError(`${overseerName} already has additional oversight of ${role.title}.`, 409);
      }
    }

    const created = await prisma.additionalOversight.create({
      data: { overseerId, overseenEmployeeId: employeeId, overseenJobRoleId: jobRoleId, createdById: actor.id || null },
    });
    await createAuditLog({
      actorUserId: actor.id,
      targetEmployeeId: employeeId ?? undefined,
      action: 'ADDITIONAL_OVERSIGHT_ADDED',
      entityType: 'AdditionalOversight',
      entityId: created.id,
      metadata: { overseerId, overseer: overseerName, overseenEmployeeId: employeeId, overseenJobRoleId: jobRoleId, oversees: targetLabel },
    });
    return created;
  }

  static async remove(id: string, actor: Actor) {
    const rel = await prisma.additionalOversight.findUnique({
      where: { id },
      include: { overseer: { select: PERSON_SELECT }, overseenEmployee: { select: PERSON_SELECT }, overseenJobRole: { select: { title: true } } },
    });
    if (!rel) throw new AppError('Additional oversight not found.', 404);
    await prisma.additionalOversight.delete({ where: { id } });
    await createAuditLog({
      actorUserId: actor.id,
      targetEmployeeId: rel.overseenEmployeeId ?? undefined,
      action: 'ADDITIONAL_OVERSIGHT_REMOVED',
      entityType: 'AdditionalOversight',
      entityId: id,
      metadata: {
        overseer: personOf(rel.overseer).fullName,
        oversees: rel.overseenEmployee ? personOf(rel.overseenEmployee).fullName : rel.overseenJobRole?.title ?? null,
      },
    });
  }

  /**
   * One employee's additional oversight, for their Employee Profile: who else
   * oversees them (with their immediate supervisor kept separate), whom they
   * additionally oversee, and their current direct reports — the people HR may
   * choose to include when adding an overseer to a supervisor.
   */
  static async forEmployee(employeeId: string) {
    const target = await prisma.employee.findUnique({ where: { id: employeeId }, select: { ...PERSON_SELECT, immediateSupervisorId: true } });
    if (!target) throw new AppError('Employee not found', 404);
    const rels = await prisma.additionalOversight.findMany({
      include: { overseenJobRole: { select: { id: true, title: true } }, overseenEmployee: { select: PERSON_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    const pairs = expandOversight(rels, await activeEmployees());
    const directReports = await prisma.employee.findMany({
      where: { immediateSupervisorId: employeeId, deletedAt: null },
      select: PERSON_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const ids = [...new Set(pairs.flatMap((p) => [p.overseerId, p.overseenId]))];
    const people = new Map((await prisma.employee.findMany({ where: { id: { in: ids } }, select: PERSON_SELECT })).map((e) => [e.id, personOf(e)]));
    return {
      employee: personOf(target),
      immediateSupervisorId: target.immediateSupervisorId,
      overseenBy: pairs
        .filter((p) => p.overseenId === employeeId)
        .map((p) => ({ relationshipId: p.relationshipId, viaJobRoleTitle: p.viaJobRoleTitle, overseer: people.get(p.overseerId) ?? null })),
      oversees: rels
        .filter((r) => r.overseerId === employeeId)
        .map((r) => ({
          relationshipId: r.id,
          target: r.overseenEmployee
            ? { kind: 'EMPLOYEE' as const, employee: personOf(r.overseenEmployee) }
            : { kind: 'JOB_ROLE' as const, jobRole: r.overseenJobRole },
          covers: pairs.filter((p) => p.relationshipId === r.id).map((p) => people.get(p.overseenId)).filter(Boolean),
        })),
      directReports: directReports.map(personOf),
    };
  }

  /**
   * Adds an overseer to one employee from their profile. When that employee is a
   * supervisor, HR may ALSO include some or all of the people who currently
   * report to them — only the ones HR ticked, and only actual current direct
   * reports (checked here, never taken on trust). Each included person gets
   * their own relationship; anyone already covered is reported, not duplicated.
   */
  static async addForEmployee(input: { overseerId?: string; overseenEmployeeId?: string; includeReportIds?: unknown }, actor: Actor) {
    const overseerId = String(input?.overseerId ?? '').trim();
    const employeeId = String(input?.overseenEmployeeId ?? '').trim();
    const wanted = Array.isArray(input?.includeReportIds) ? [...new Set(input.includeReportIds.filter((x): x is string => typeof x === 'string' && !!x))] : [];
    if (!employeeId) throw new AppError('Choose who is overseen.', 400);
    if (wanted.length) {
      const reports = new Set(
        (await prisma.employee.findMany({ where: { immediateSupervisorId: employeeId, deletedAt: null }, select: { id: true } })).map((r) => r.id)
      );
      const stray = wanted.filter((id) => !reports.has(id));
      if (stray.length) throw new AppError('Only people who currently report to this employee can be included.', 400);
    }

    const added: string[] = [];
    const skipped: Array<{ employeeId: string; reason: string }> = [];
    const tryAdd = async (targetId: string, isMain: boolean) => {
      try {
        await this.add({ overseerId, overseenEmployeeId: targetId }, actor);
        added.push(targetId);
      } catch (e: any) {
        // The main relationship must be valid; an included report that is already
        // covered (or reports to the overseer) is simply reported back.
        if (isMain && e?.statusCode !== 409) throw e;
        skipped.push({ employeeId: targetId, reason: e?.message ?? 'Not added' });
      }
    };
    await tryAdd(employeeId, true);
    for (const id of wanted) await tryAdd(id, false);
    return { added, skipped };
  }

  /**
   * The oversight lines for an Org Chart view. HR (FULL) gets every pair that
   * touches a person on the chart; anyone else only pairs between people they
   * can already see on their chart, plus their own (who also oversees them,
   * whom they also oversee). People off the chart come back as `people` refs —
   * name, role and unit only — so a card can name them without a line.
   */
  static async forOrgChart(visibleIds: Set<string>, viewer: { isFull: boolean; employeeId: string | null }) {
    const rels = await prisma.additionalOversight.findMany({ include: { overseenJobRole: { select: { title: true } } } });
    if (!rels.length) return { links: [] as OversightPair[], people: {} as Record<string, ReturnType<typeof personOf>> };
    const pairs = expandOversight(rels, await activeEmployees()).filter((p) =>
      viewer.isFull
        ? visibleIds.has(p.overseerId) || visibleIds.has(p.overseenId)
        : (visibleIds.has(p.overseerId) && visibleIds.has(p.overseenId)) || p.overseerId === viewer.employeeId || p.overseenId === viewer.employeeId
    );
    const offChart = [...new Set(pairs.flatMap((p) => [p.overseerId, p.overseenId]))].filter((id) => !visibleIds.has(id));
    const people = Object.fromEntries(
      (await prisma.employee.findMany({ where: { id: { in: offChart } }, select: PERSON_SELECT })).map((e) => [e.id, personOf(e)])
    );
    return { links: pairs, people };
  }
}
