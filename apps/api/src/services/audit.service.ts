import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  AUDIT_ACTION_TYPES,
  AUDIT_MODULES,
  AUDIT_TABS,
  ActionInfo,
  AuditActionType,
  AuditModule,
  AuditTab,
  actionMatchesText,
  collectIds,
  describeAction,
  employeeUpdateText,
  extractChanges,
  formatDateValue,
  humanise,
  isUuid,
  matchesFilters,
  summarize,
} from './audit-catalog';

/**
 * Read side of the audit trail (`GET /audit`, FULL tier only).
 *
 * Two stores feed it: `audit_logs` (everything written through `createAuditLog`)
 * and `schedule_history_logs` (schedule templates, weekly schedules and the
 * holiday calendar, which keep their own history). Both are classified by
 * `audit-catalog.ts` into tabs, modules and action types, so a tab or filter is
 * just a list of action names and pagination stays in the database.
 *
 * Nothing raw leaves the server: each row is returned as a plain sentence, the
 * record and person it concerns, and before/after values taken only from what
 * the row recorded. Credential-like and clinically confidential keys are never
 * shown, government ID numbers are reported as changed without their values,
 * and medical / psychological rows show no values at all.
 */

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  /** `ALL` = All Changes (every tab except Security & Authentication). */
  tab?: AuditTab | 'ALL';
  module?: AuditModule;
  actionType?: AuditActionType;
  outcome?: AuditOutcome;
  /** Free text: people, action, module, record title or reference. */
  search?: string;
  /** Free text matched against the person or record an event is about. */
  target?: string;
  /** A user id, or `SYSTEM` for events no signed-in user performed. */
  actorUserId?: string;
  /** `YYYY-MM-DD`, Philippine days. */
  dateFrom?: string;
  dateTo?: string;
}

type Source = 'audit' | 'schedule';

interface RawRow {
  source: Source;
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetEmployeeId: string | null;
  actorUserId: string | null;
  metadata: unknown;
  oldValue: unknown;
  newValue: unknown;
  remarks: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

interface Person {
  kind: 'EMPLOYEE' | 'APPLICANT';
  id: string;
  name: string;
  reference: string | null;
}

/** Deepest page the merged (two-store) listing will build. */
const MAX_MERGED_ROWS = 10_000;

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dateRange(f: AuditLogFilters): Prisma.DateTimeFilter | undefined {
  const from = f.dateFrom && DAY.test(f.dateFrom) ? new Date(`${f.dateFrom}T00:00:00.000+08:00`) : null;
  const to = f.dateTo && DAY.test(f.dateTo) ? new Date(`${f.dateTo}T23:59:59.999+08:00`) : null;
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

function leaveLabel(type: unknown, start: unknown, end: unknown): string | null {
  const t = str(type);
  if (!t) return null;
  const s = start ? formatDateValue(start as string | Date) : null;
  const e = end ? formatDateValue(end as string | Date) : null;
  const when = s && e && s !== e ? `${s} – ${e}` : s ?? e;
  return `${humanise(t)} leave${when ? `, ${when}` : ''}`;
}

function recordTypeLabel(row: RawRow): string {
  if (row.source === 'schedule') return 'Schedule & holiday history';
  if (!row.entityType) return '—';
  return humanise(row.entityType.replace(/([a-z])([A-Z])/g, '$1_$2'));
}

export class AuditService {
  // ───────────────────────────────────────────────────────────────────────
  // Listing
  // ───────────────────────────────────────────────────────────────────────

  static async list(filters: AuditLogFilters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(Math.max(1, Number(filters.limit) || 25), 100);
    const skip = (page - 1) * limit;
    const spec = { tab: filters.tab ?? 'ALL', module: filters.module, actionType: filters.actionType, outcome: filters.outcome } as const;

    const present = await this.presentActions();
    const { audit: auditBase, schedule: scheduleBase } = await this.baseWhere(filters, present);

    // Per-action counts under every filter except the tab: they give the tab
    // badges and the exact action names the current tab / module / type allow.
    const [auditGroups, scheduleGroups] = await Promise.all([
      auditBase ? prisma.auditLog.groupBy({ by: ['action'], where: auditBase, _count: { _all: true } }) : Promise.resolve([]),
      scheduleBase ? prisma.scheduleHistoryLog.groupBy({ by: ['action'], where: scheduleBase, _count: { _all: true } }) : Promise.resolve([]),
    ]);

    const tabCounts: Record<string, number> = { ALL: 0 };
    for (const t of AUDIT_TABS) tabCounts[t.id] = 0;
    const allowed: Record<Source, string[]> = { audit: [], schedule: [] };
    let total = 0;
    const tally = (source: Source, groups: Array<{ action: string; _count: { _all: number } }>) => {
      for (const g of groups) {
        const info = describeAction(g.action, present.entityTypes.get(g.action));
        const n = g._count._all;
        if (matchesFilters(info, spec, { ignoreTab: true })) {
          tabCounts[info.tab] += n;
          if (info.tab !== 'SECURITY') tabCounts.ALL += n;
        }
        if (matchesFilters(info, spec)) {
          allowed[source].push(g.action);
          total += n;
        }
      }
    };
    tally('audit', auditGroups);
    tally('schedule', scheduleGroups);

    const auditWhere: Prisma.AuditLogWhereInput | null =
      auditBase && allowed.audit.length ? { AND: [auditBase, { action: { in: allowed.audit } }] } : null;
    const scheduleWhere: Prisma.ScheduleHistoryLogWhereInput | null =
      scheduleBase && allowed.schedule.length ? { AND: [scheduleBase, { action: { in: allowed.schedule } }] } : null;

    let pageRows: RawRow[] = [];
    if (auditWhere && scheduleWhere) {
      // Both stores contribute: take the newest `skip + limit` ids of each,
      // merge by time, keep this page, then load just those rows.
      const take = skip + limit;
      if (take <= MAX_MERGED_ROWS) {
        const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
        const [a, s] = await Promise.all([
          prisma.auditLog.findMany({ where: auditWhere, select: { id: true, createdAt: true }, orderBy: order, take }),
          prisma.scheduleHistoryLog.findMany({ where: scheduleWhere, select: { id: true, createdAt: true }, orderBy: order, take }),
        ]);
        const slice = [
          ...a.map((r) => ({ ...r, source: 'audit' as const })),
          ...s.map((r) => ({ ...r, source: 'schedule' as const })),
        ]
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime() || (y.id > x.id ? 1 : -1))
          .slice(skip, skip + limit);
        const [auditRows, scheduleRows] = await Promise.all([
          this.loadAudit({ id: { in: slice.filter((r) => r.source === 'audit').map((r) => r.id) } }),
          this.loadSchedule({ id: { in: slice.filter((r) => r.source === 'schedule').map((r) => r.id) } }),
        ]);
        const byId = new Map([...auditRows, ...scheduleRows].map((r) => [`${r.source}:${r.id}`, r]));
        pageRows = slice.map((r) => byId.get(`${r.source}:${r.id}`)).filter((r): r is RawRow => !!r);
      }
    } else if (auditWhere) {
      pageRows = await this.loadAudit(auditWhere, { skip, take: limit });
    } else if (scheduleWhere) {
      pageRows = await this.loadSchedule(scheduleWhere, { skip, take: limit });
    }

    const data = await this.present(pageRows, present.entityTypes);
    return { data, total, page, limit, tabCounts };
  }

  private static async loadAudit(where: Prisma.AuditLogWhereInput, paging?: { skip: number; take: number }): Promise<RawRow[]> {
    const rows = await prisma.auditLog.findMany({
      where,
      ...(paging ?? {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        targetEmployeeId: true,
        actorUserId: true,
        metadata: true,
        oldValue: true,
        newValue: true,
        ipAddress: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({ ...r, source: 'audit' as const, remarks: null }));
  }

  private static async loadSchedule(where: Prisma.ScheduleHistoryLogWhereInput, paging?: { skip: number; take: number }): Promise<RawRow[]> {
    const rows = await prisma.scheduleHistoryLog.findMany({
      where,
      ...(paging ?? {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => ({
      source: 'schedule' as const,
      id: r.id,
      action: r.action,
      entityType: null,
      entityId: null,
      targetEmployeeId: r.targetEmployeeId,
      actorUserId: r.actorUserId,
      metadata: r.bulkBatchId ? { bulkBatchId: r.bulkBatchId } : null,
      oldValue: r.previousValue,
      newValue: r.newValue,
      remarks: r.remarks,
      ipAddress: null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Date, actor, search and target filters for each store. `null` means the
   * store cannot match at all (e.g. a schedule row has no IP or record id).
   */
  private static async baseWhere(f: AuditLogFilters, present: PresentActions) {
    const audit: Prisma.AuditLogWhereInput[] = [];
    const schedule: Prisma.ScheduleHistoryLogWhereInput[] = [];
    let scheduleOk = true;

    const created = dateRange(f);
    if (created) {
      audit.push({ createdAt: created });
      schedule.push({ createdAt: created });
    }

    if (f.actorUserId) {
      if (f.actorUserId === 'SYSTEM') {
        audit.push({ actorUserId: null });
        scheduleOk = false; // schedule history always has an actor
      } else {
        audit.push({ actorUserId: f.actorUserId });
        schedule.push({ actorUserId: f.actorUserId });
      }
    }

    for (const [text, mode] of [
      [f.search, 'search'],
      [f.target, 'target'],
    ] as const) {
      const q = text?.trim();
      if (!q) continue;
      const clauses = await this.textClauses(q.slice(0, 100), mode, present);
      audit.push({ OR: clauses.audit });
      if (clauses.schedule.length) schedule.push({ OR: clauses.schedule });
      else scheduleOk = false;
    }

    return {
      audit: audit.length ? { AND: audit } : ({} as Prisma.AuditLogWhereInput),
      schedule: scheduleOk ? (schedule.length ? { AND: schedule } : ({} as Prisma.ScheduleHistoryLogWhereInput)) : null,
    };
  }

  /**
   * What a piece of free text can match. `search` covers the actor, the action
   * and its module; both modes cover the person an event is about (employee or
   * applicant), the record's title or reference, and a pasted record id.
   */
  private static async textClauses(q: string, mode: 'search' | 'target', present: PresentActions) {
    const tokens = q.split(/\s+/).filter(Boolean);
    const nameOr = (first: string, last: string) => {
      const or: Array<Record<string, unknown>> = [{ [first]: { contains: q } }, { [last]: { contains: q } }];
      if (tokens.length >= 2) or.push({ AND: [{ [first]: { contains: tokens[0] } }, { [last]: { contains: tokens[tokens.length - 1] } }] });
      return or;
    };

    const [employees, applications, openings, announcements, cycles, templates, requirements, awards] = await Promise.all([
      prisma.employee.findMany({
        where: { OR: [...(nameOr('firstName', 'lastName') as Prisma.EmployeeWhereInput[]), { employeeNumber: { contains: q } }] },
        select: { id: true },
        take: 200,
      }),
      prisma.jobApplication.findMany({
        where: {
          OR: [
            { referenceNumber: { contains: q } },
            ...(nameOr('firstName', 'lastName').map((c) => ({ applicant: c })) as Prisma.JobApplicationWhereInput[]),
          ],
        },
        select: { id: true },
        take: 200,
      }),
      prisma.jobOpening.findMany({ where: { OR: [{ title: { contains: q } }, { referenceNumber: { contains: q } }] }, select: { id: true }, take: 100 }),
      prisma.announcement.findMany({ where: { title: { contains: q } }, select: { id: true }, take: 100 }),
      prisma.evaluationCycle.findMany({ where: { name: { contains: q } }, select: { id: true }, take: 100 }),
      prisma.evaluationTemplate.findMany({ where: { name: { contains: q } }, select: { id: true }, take: 100 }),
      prisma.complianceRequirement.findMany({ where: { title: { contains: q } }, select: { id: true }, take: 100 }),
      prisma.award.findMany({ where: { title: { contains: q } }, select: { id: true }, take: 100 }),
    ]);
    const empIds = employees.map((e) => e.id);
    const appIds = applications.map((a) => a.id);

    // Records that belong to the matched employees but whose audit rows name
    // only the record (older leave, document and attendance entries).
    const [leaves, documents, attendance] = empIds.length
      ? await Promise.all([
          prisma.leaveRequest.findMany({ where: { employeeId: { in: empIds } }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1000 }),
          prisma.employeeDocument.findMany({ where: { employeeId: { in: empIds } }, select: { id: true }, orderBy: { uploadedAt: 'desc' }, take: 1000 }),
          prisma.attendanceRecord.findMany({
            where: { employeeId: { in: empIds }, manuallyModifiedAt: { not: null } },
            select: { id: true },
            orderBy: { date: 'desc' },
            take: 1000,
          }),
        ])
      : [[], [], []];

    // Titles, file names and references kept in the row's own details. Personal
    // calendar notes are excluded: their titles are private to their author.
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const jsonKeys = ['title', 'name', 'recordTitle', 'referenceNumber', 'originalFilename', 'filename', 'overseer', 'oversees', 'employeeNumber', 'fullName', 'jobRoleName'];
    const jsonOr = Prisma.join(
      jsonKeys.map((k) => Prisma.sql`JSON_UNQUOTE(JSON_EXTRACT(metadata, ${`$.${k}`})) LIKE ${like}`),
      ' OR '
    );
    const appClause = appIds.length
      ? Prisma.sql` OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationId')) IN (${Prisma.join(appIds)})`
      : Prisma.empty;
    const jsonHits = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM audit_logs
      WHERE action NOT LIKE 'PERSONAL\\_NOTE\\_%' AND metadata IS NOT NULL AND ((${jsonOr})${appClause})
      ORDER BY createdAt DESC
      LIMIT 2000`;

    const entityIds = [
      ...empIds,
      ...appIds,
      ...leaves.map((r) => r.id),
      ...documents.map((r) => r.id),
      ...attendance.map((r) => r.id),
      ...openings.map((r) => r.id),
      ...announcements.map((r) => r.id),
      ...cycles.map((r) => r.id),
      ...templates.map((r) => r.id),
      ...requirements.map((r) => r.id),
      ...awards.map((r) => r.id),
    ];

    const audit: Prisma.AuditLogWhereInput[] = [];
    const schedule: Prisma.ScheduleHistoryLogWhereInput[] = [];
    if (empIds.length) {
      audit.push({ targetEmployeeId: { in: empIds } });
      schedule.push({ targetEmployeeId: { in: empIds } });
    }
    if (entityIds.length) audit.push({ entityId: { in: entityIds } });
    if (jsonHits.length) audit.push({ id: { in: jsonHits.map((r) => r.id) } });
    if (isUuid(q)) audit.push({ id: q }, { entityId: q });
    schedule.push({ remarks: { contains: q } });

    if (mode === 'search') {
      const actions = present.all.filter((a) => actionMatchesText(describeAction(a, present.entityTypes.get(a)), q));
      if (actions.length) {
        audit.push({ action: { in: actions } });
        schedule.push({ action: { in: actions } });
      }
      const actorOr = [{ email: { contains: q } }, ...(empIds.length ? [{ employeeId: { in: empIds } }] : [])];
      audit.push(...actorOr.map((c) => ({ actorUser: c })));
      schedule.push(...actorOr.map((c) => ({ user: c })));
    }

    // Nothing can match: an impossible clause keeps the query honest.
    if (!audit.length) audit.push({ id: '__no_match__' });
    return { audit, schedule };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Readable rows
  // ───────────────────────────────────────────────────────────────────────

  private static async present(rows: RawRow[], entityTypes: Map<string, string>) {
    if (!rows.length) return [];

    const ofType = (...types: string[]) =>
      rows.filter((r) => r.entityId && types.includes((r.entityType ?? '').toUpperCase())).map((r) => r.entityId as string);
    const metaIds = (key: string) => rows.map((r) => asObject(r.metadata)[key]).filter(isUuid);
    const valueIds = rows.flatMap((r) => collectIds(r.metadata, r.oldValue, r.newValue));
    const uniq = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));
    const when = <T>(ids: string[], fn: (ids: string[]) => Promise<T[]>) => (ids.length ? fn(uniq(ids)) : Promise.resolve([] as T[]));

    const [
      users,
      employees,
      units,
      departments,
      jobRoles,
      leaves,
      documents,
      attendance,
      batches,
      openings,
      applications,
      announcements,
      cycles,
      assignments,
      templates,
      requirements,
      complianceRecords,
      participants,
      trainingDocs,
      awards,
      awardGroups,
      pages,
    ] = await Promise.all([
      when([...rows.map((r) => r.actorUserId as string), ...ofType('USER'), ...valueIds], (ids) =>
        prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, email: true, employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
        })
      ),
      when([...rows.map((r) => r.targetEmployeeId as string), ...ofType('EMPLOYEE'), ...metaIds('employeeId'), ...valueIds], (ids) =>
        prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, employeeNumber: true } })
      ),
      when(valueIds, (ids) => prisma.unit.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })),
      when(valueIds, (ids) => prisma.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })),
      when([...ofType('JOBROLE'), ...valueIds], (ids) => prisma.jobRole.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })),
      when(ofType('LEAVEREQUEST'), (ids) =>
        prisma.leaveRequest.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, leaveType: true, startDate: true, endDate: true } })
      ),
      when(ofType('EMPLOYEE_DOCUMENT'), (ids) =>
        prisma.employeeDocument.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, originalFilename: true } })
      ),
      when(ofType('ATTENDANCERECORD'), (ids) =>
        prisma.attendanceRecord.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, date: true } })
      ),
      when(ofType('ATTENDANCE_IMPORT_BATCH'), (ids) =>
        prisma.attendanceImportBatch.findMany({ where: { id: { in: ids } }, select: { id: true, originalFilename: true } })
      ),
      when([...ofType('JOBOPENING'), ...valueIds], (ids) =>
        prisma.jobOpening.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, referenceNumber: true } })
      ),
      when([...ofType('JOBAPPLICATION'), ...metaIds('applicationId')], (ids) =>
        prisma.jobApplication.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            referenceNumber: true,
            applicant: { select: { firstName: true, lastName: true } },
            jobOpening: { select: { title: true } },
          },
        })
      ),
      when(ofType('ANNOUNCEMENT'), (ids) => prisma.announcement.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })),
      when([...ofType('EVALUATIONCYCLE'), ...valueIds], (ids) =>
        prisma.evaluationCycle.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      ),
      when(ofType('EVALUATIONASSIGNMENT'), (ids) =>
        prisma.evaluationAssignment.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, cycle: { select: { name: true } } } })
      ),
      when([...ofType('EVALUATIONTEMPLATE'), ...valueIds], (ids) =>
        prisma.evaluationTemplate.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      ),
      when([...ofType('COMPLIANCE_REQUIREMENT'), ...valueIds], (ids) =>
        prisma.complianceRequirement.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })
      ),
      when(ofType('EMPLOYEE_COMPLIANCE_RECORD'), (ids) =>
        prisma.employeeComplianceRecord.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, recordTitle: true } })
      ),
      when(ofType('TRAINING_PARTICIPANT'), (ids) =>
        prisma.trainingParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, employeeId: true, trainingActivity: { select: { title: true } } } })
      ),
      when(ofType('TRAINING_ACTIVITY_DOCUMENT'), (ids) =>
        prisma.trainingActivityDocument.findMany({ where: { id: { in: ids } }, select: { id: true, originalFilename: true, trainingActivity: { select: { title: true } } } })
      ),
      when([...ofType('AWARD'), ...metaIds('awardId')], (ids) =>
        prisma.award.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, periodLabel: true } })
      ),
      when(ofType('AWARDGROUP'), (ids) => prisma.awardGroup.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })),
      when(ofType('YEARLYACHIEVEMENTPAGE'), (ids) =>
        prisma.yearlyAchievementPage.findMany({ where: { id: { in: ids } }, select: { id: true, year: true, title: true } })
      ),
    ]);

    // Employees named only by the records just loaded (a leave's requester, a
    // document's owner…).
    const known = new Set(employees.map((e) => e.id));
    const owners = uniq(
      [...leaves, ...documents, ...attendance, ...assignments, ...complianceRecords, ...participants]
        .map((r) => r.employeeId)
        .filter((id) => !known.has(id))
    );
    if (owners.length) {
      employees.push(
        ...(await prisma.employee.findMany({ where: { id: { in: owners } }, select: { id: true, firstName: true, lastName: true, employeeNumber: true } }))
      );
    }

    const by = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    const userById = by(users);
    const employeeById = by(employees);
    const leaveById = by(leaves);
    const documentById = by(documents);
    const attendanceById = by(attendance);
    const batchById = by(batches);
    const openingById = by(openings);
    const applicationById = by(applications);
    const announcementById = by(announcements);
    const cycleById = by(cycles);
    const assignmentById = by(assignments);
    const templateById = by(templates);
    const requirementById = by(requirements);
    const complianceById = by(complianceRecords);
    const participantById = by(participants);
    const trainingDocById = by(trainingDocs);
    const awardById = by(awards);
    const groupById = by(awardGroups);
    const pageById = by(pages);

    // id → readable name, for values such as a supervisor or unit id.
    const names = new Map<string, string>();
    for (const u of users) names.set(u.id, fullName(u.employee) || u.email);
    for (const e of employees) names.set(e.id, fullName(e) || e.employeeNumber);
    for (const u of units) names.set(u.id, u.name);
    for (const d of departments) names.set(d.id, d.name);
    for (const r of jobRoles) names.set(r.id, r.title);
    for (const o of openings) names.set(o.id, o.title);
    for (const c of cycles) names.set(c.id, c.name);
    for (const t of templates) names.set(t.id, t.name);
    for (const r of requirements) names.set(r.id, r.title);

    const employeePerson = (id: string | null | undefined): Person | null => {
      if (!id) return null;
      const e = employeeById.get(id);
      return e ? { kind: 'EMPLOYEE', id: e.id, name: fullName(e) || e.employeeNumber, reference: e.employeeNumber } : null;
    };
    const awardLabel = (id: unknown) => {
      const a = isUuid(id) ? awardById.get(id) : undefined;
      return a ? `${a.title}${a.periodLabel ? ` (${a.periodLabel})` : ''}` : null;
    };

    return rows.map((row) => {
      let info: ActionInfo = describeAction(row.action, row.entityType ?? entityTypes.get(row.action));
      const meta = asObject(row.metadata);
      const type = (row.entityType ?? '').toUpperCase();
      const actorUser = row.actorUserId ? userById.get(row.actorUserId) : undefined;
      const actor = actorUser
        ? {
            id: actorUser.id,
            name: fullName(actorUser.employee) || actorUser.email,
            email: actorUser.email,
            employeeNumber: actorUser.employee?.employeeNumber ?? null,
          }
        : null;

      let subject: Person | null = employeePerson(row.targetEmployeeId);
      let record: string | null = null;

      if (row.source === 'schedule') {
        const nv = asObject(row.newValue);
        const pv = asObject(row.oldValue);
        record = str(nv.name) ?? str(pv.name) ?? (row.remarks?.includes(': ') ? row.remarks.slice(row.remarks.indexOf(': ') + 2) : null);
      } else {
        switch (type) {
          case 'EMPLOYEE':
            subject ??= employeePerson(row.entityId) ?? employeePerson(str(meta.employeeId));
            if (row.action === 'DEVELOPMENT_ACCOUNT_STANDARDIZED') record = str(meta.employeeNumber);
            break;
          case 'USER': {
            if (row.action === 'GOOGLE_LOGIN_UNREGISTERED') record = str(meta.email);
            if (row.action === 'GOOGLE_LOGIN_BLOCKED') record = row.ipAddress;
            if (!subject && row.entityId && row.entityId !== row.actorUserId) {
              const u = userById.get(row.entityId);
              if (u?.employee) subject = { kind: 'EMPLOYEE', id: u.employee.id, name: fullName(u.employee), reference: u.employee.employeeNumber };
            }
            break;
          }
          case 'LEAVEREQUEST': {
            const lr = row.entityId ? leaveById.get(row.entityId) : undefined;
            subject ??= employeePerson(lr?.employeeId);
            const nv = asObject(row.newValue);
            record = lr
              ? leaveLabel(lr.leaveType, lr.startDate, lr.endDate)
              : leaveLabel(meta.leaveType ?? nv.leaveType, meta.startDate ?? nv.startDate, meta.endDate ?? nv.endDate);
            break;
          }
          case 'LEAVEBALANCE':
            record = str(meta.leaveType) ? `${humanise(String(meta.leaveType))} leave${meta.year ? ` ${meta.year}` : ''}` : null;
            break;
          case 'EMPLOYEE_DOCUMENT': {
            const d = row.entityId ? documentById.get(row.entityId) : undefined;
            subject ??= employeePerson(d?.employeeId);
            record = str(meta.filename) ?? str(meta.originalFilename) ?? d?.originalFilename ?? null;
            break;
          }
          case 'ATTENDANCERECORD': {
            const a = row.entityId ? attendanceById.get(row.entityId) : undefined;
            subject ??= employeePerson(a?.employeeId);
            const date = a?.date ?? asObject(row.newValue).date ?? asObject(row.oldValue).date;
            record = date ? formatDateValue(date as string | Date) : null;
            break;
          }
          case 'ATTENDANCE_IMPORT_BATCH':
            record = str(meta.originalFilename) ?? (row.entityId ? batchById.get(row.entityId)?.originalFilename ?? null : null);
            break;
          case 'JOBOPENING': {
            const o = row.entityId ? openingById.get(row.entityId) : undefined;
            record = str(meta.title) ?? o?.title ?? str(meta.referenceNumber);
            break;
          }
          case 'JOBAPPLICATION':
          case 'APPLICANTDOCUMENT':
          case 'APPLICANTINTERVIEW':
          case 'APPLICANTCOMMUNICATION': {
            const appId = type === 'JOBAPPLICATION' ? row.entityId : str(meta.applicationId);
            const app = appId ? applicationById.get(appId) : undefined;
            if (app) subject = { kind: 'APPLICANT', id: app.id, name: fullName(app.applicant) || app.referenceNumber, reference: app.referenceNumber };
            record =
              type === 'APPLICANTDOCUMENT'
                ? str(meta.documentType) && humanise(String(meta.documentType))
                : type === 'APPLICANTINTERVIEW'
                  ? str(meta.type) && `${humanise(String(meta.type))} interview`
                  : type === 'APPLICANTCOMMUNICATION'
                    ? str(meta.communicationType) && humanise(String(meta.communicationType))
                    : app?.jobOpening?.title ?? null;
            break;
          }
          case 'ANNOUNCEMENT':
            record = str(meta.title) ?? (row.entityId ? announcementById.get(row.entityId)?.title ?? null : null);
            break;
          case 'EVALUATIONCYCLE':
            record = (row.entityId ? cycleById.get(row.entityId)?.name : undefined) ?? str(meta.name);
            break;
          case 'EVALUATIONASSIGNMENT': {
            const as = row.entityId ? assignmentById.get(row.entityId) : undefined;
            subject ??= employeePerson(as?.employeeId);
            record = as?.cycle?.name ?? null;
            break;
          }
          case 'EVALUATIONTEMPLATE':
            record = str(meta.name) ?? (row.entityId ? templateById.get(row.entityId)?.name ?? null : null);
            break;
          case 'COMPLIANCE_REQUIREMENT':
            record = str(meta.title) ?? (row.entityId ? requirementById.get(row.entityId)?.title ?? null : null);
            break;
          case 'EMPLOYEE_COMPLIANCE_RECORD': {
            const c = row.entityId ? complianceById.get(row.entityId) : undefined;
            subject ??= employeePerson(c?.employeeId);
            record = str(meta.recordTitle) ?? c?.recordTitle ?? null;
            break;
          }
          case 'TRAINING_PARTICIPANT': {
            const p = row.entityId ? participantById.get(row.entityId) : undefined;
            subject ??= employeePerson(p?.employeeId);
            record = p?.trainingActivity?.title ?? null;
            break;
          }
          case 'TRAINING_ACTIVITY_DOCUMENT': {
            const d = row.entityId ? trainingDocById.get(row.entityId) : undefined;
            record = d ? `${d.originalFilename} — ${d.trainingActivity?.title ?? ''}`.replace(/ — $/, '') : null;
            break;
          }
          case 'AWARD':
            record = awardLabel(row.entityId) ?? str(meta.title);
            break;
          case 'AWARDCATEGORY':
          case 'AWARDRESULT':
            record = awardLabel(meta.awardId);
            break;
          case 'AWARDGROUP':
            record = (row.entityId ? groupById.get(row.entityId)?.name : undefined) ?? str(meta.name);
            break;
          case 'HALLOFFAMERECORD':
            record = str(meta.title) ? `${meta.title}${meta.awardYear ? ` ${meta.awardYear}` : ''}` : null;
            break;
          case 'YEARLYACHIEVEMENTPAGE': {
            const p = row.entityId ? pageById.get(row.entityId) : undefined;
            record = row.action.startsWith('YEARLY_ACHIEVEMENT_')
              ? str(meta.title)
              : p
                ? `${p.year} — ${p.title}`
                : meta.year
                  ? `Yearly Achievements ${meta.year}`
                  : null;
            break;
          }
          case 'CALENDARNOTE':
            // Never the title of a personal note.
            record = row.action.startsWith('PERSONAL_NOTE_') ? null : str(meta.title);
            break;
          case 'ADDITIONALOVERSIGHT':
            record = str(meta.overseer) && str(meta.oversees) ? `${meta.overseer} → ${meta.oversees}` : null;
            break;
          case 'JOBROLE':
            record = (row.entityId ? names.get(row.entityId) : undefined) ?? str(meta.title);
            break;
          case 'AI_REQUEST': {
            const looked = Array.isArray(meta.targetEmployeeIds) ? (meta.targetEmployeeIds as unknown[]).filter(isUuid) : [];
            if (!subject && looked.length > 1) record = `${looked.length} employees`;
            break;
          }
          default:
            break;
        }
      }

      const subjectIsActor = !!subject && subject.kind === 'EMPLOYEE' && !!actorUser?.employee && actorUser.employee.id === subject.id;

      // An employee edit names the profile sections that changed, when recorded.
      const legacyEmployeeUpdate = row.action === 'UPDATE_EMPLOYEE' && !row.oldValue;
      if (row.action === 'UPDATE_EMPLOYEE' && Array.isArray(meta.fields)) {
        const text = employeeUpdateText(meta.fields.filter((f): f is string => typeof f === 'string'));
        if (text) info = { ...info, text };
      }

      const extracted = extractChanges(row, info, names, { submittedOnly: legacyEmployeeUpdate });
      // The record and person are already named in the sentence.
      extracted.details = extracted.details.filter((d) => d.value !== record && d.value !== subject?.name);
      if (row.remarks) extracted.details.unshift({ label: 'Note', value: row.remarks });

      return {
        id: row.id,
        source: row.source,
        createdAt: row.createdAt,
        action: row.action,
        actionLabel: info.label,
        actionType: info.type,
        actionTypeLabel: info.typeLabel,
        module: info.module,
        moduleLabel: info.moduleLabel,
        tab: info.tab,
        tabLabel: info.tabLabel,
        outcome: info.outcome,
        confidential: info.confidential,
        summary: summarize(info, { actor: actor?.name ?? null, subject: subject?.name ?? null, subjectIsActor, record }),
        actor,
        subject,
        record: {
          type: recordTypeLabel(row),
          label: record,
          reference: row.entityId,
        },
        changes: extracted.changes,
        changedFields: extracted.changedFields,
        recorded: extracted.recorded,
        details: extracted.details,
        ipAddress: row.ipAddress,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Filter options
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Tabs, modules, action types and actors that actually occur — nothing is
   * offered for a module or action type with no recorded events.
   */
  static async getFilterOptions() {
    const present = await this.presentActions();
    const infos = present.all.map((a) => describeAction(a, present.entityTypes.get(a)));

    const [auditActors, scheduleActors, systemRows] = await Promise.all([
      prisma.auditLog.findMany({ where: { actorUserId: { not: null } }, distinct: ['actorUserId'], select: { actorUserId: true } }),
      prisma.scheduleHistoryLog.findMany({ distinct: ['actorUserId'], select: { actorUserId: true } }),
      prisma.auditLog.count({ where: { actorUserId: null } }),
    ]);
    const actorIds = Array.from(new Set([...auditActors.map((a) => a.actorUserId as string), ...scheduleActors.map((a) => a.actorUserId)]));
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
        })
      : [];

    const modulesOf = (list: ActionInfo[]) =>
      (Object.keys(AUDIT_MODULES) as AuditModule[])
        .filter((m) => list.some((i) => i.module === m))
        .map((m) => ({ id: m, label: AUDIT_MODULES[m].label, tab: AUDIT_MODULES[m].tab }));
    const typesOf = (list: ActionInfo[]) =>
      (Object.keys(AUDIT_ACTION_TYPES) as AuditActionType[])
        .filter((t) => list.some((i) => i.type === t))
        .map((t) => ({ id: t, label: AUDIT_ACTION_TYPES[t].label }));
    const scope = (list: ActionInfo[]) => ({ modules: modulesOf(list), actionTypes: typesOf(list), hasFailures: list.some((i) => i.outcome === 'FAILURE') });

    const changes = infos.filter((i) => i.tab !== 'SECURITY');
    return {
      tabs: [
        { id: 'ALL', label: 'All Changes', ...scope(changes) },
        ...AUDIT_TABS.filter((t) => infos.some((i) => i.tab === t.id)).map((t) => ({
          id: t.id,
          label: t.label,
          ...scope(infos.filter((i) => i.tab === t.id)),
        })),
      ],
      actors: [
        ...users
          .map((u) => ({ id: u.id, name: fullName(u.employee) || u.email, employeeNumber: u.employee?.employeeNumber ?? null }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        ...(systemRows ? [{ id: 'SYSTEM', name: 'System (no signed-in user)', employeeNumber: null }] : []),
      ],
    };
  }

  /** Every action name in either store, with the record type it is usually written with. */
  private static async presentActions(): Promise<PresentActions> {
    const [audit, schedule] = await Promise.all([
      prisma.auditLog.groupBy({ by: ['action', 'entityType'], _count: { _all: true } }),
      prisma.scheduleHistoryLog.groupBy({ by: ['action'] }),
    ]);
    const entityTypes = new Map<string, string>();
    const best = new Map<string, number>();
    for (const g of audit) {
      if (g.entityType && (best.get(g.action) ?? -1) < g._count._all) {
        best.set(g.action, g._count._all);
        entityTypes.set(g.action, g.entityType);
      }
    }
    const all = Array.from(new Set([...audit.map((g) => g.action), ...schedule.map((g) => g.action)])).sort();
    return { all, entityTypes };
  }
}

interface PresentActions {
  all: string[];
  entityTypes: Map<string, string>;
}
