import { prisma } from '../config/prisma';
import { computeEvaluationScore, ratingScaleOf, scoreForLabel } from './evaluation-score';
import { computeCombinedResult, HOSPICIO_SOURCE_WEIGHTS, sourceWeightsProblem, weightsProblem } from './evaluation-weights';
import { AppError } from '../middleware/errorHandler';
import {
  EvaluationRatingMethod,
  EvaluationScoringMethod,
  EvaluationCycleStatus,
  EvaluationAssignmentStatus,
  EvaluationRaterType,
  EvaluationMode,
  RequirementScopeType,
  PermissionTier,
  Prisma,
} from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { cycleMetrics, cycleProgress, evaluatorDenial, finalizeDenial, RATER_LABEL, rateDenial, subjectProgress } from './evaluation-workflow';

type Actor = { id: string; employeeId?: string; permissionTier: PermissionTier };

const EVALUATOR_SELECT = { id: true, firstName: true, lastName: true, employeeNumber: true } as const;

type CriterionInput = {
  id?: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isRatingRequired?: boolean;
  isCommentRequired?: boolean;
  weight?: number;
};

/** A review area / performance factor and the statements rated under it. */
type GroupInput = { name: string; description?: string; weight?: number; items: CriterionInput[] };

type TemplateInput = {
  name: string;
  description?: string;
  ratingMethod?: EvaluationRatingMethod;
  minScore?: number;
  maxScore?: number;
  scoreLabels?: any;
  useWeighting?: boolean;
  jobRoleIds?: string[];
  /** Flat criteria — or `groups` for a template organised in review areas. */
  criteria?: CriterionInput[];
  groups?: GroupInput[];
  formLayout?: any;
};

/** A template with its areas and statements in order. */
const TEMPLATE_INCLUDE = {
  groups: { orderBy: { displayOrder: 'asc' } },
  criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
  jobRoles: { include: { jobRole: { select: { id: true, title: true, code: true, unitId: true } } } },
  _count: { select: { cycles: true, assignments: true } },
} satisfies Prisma.EvaluationTemplateInclude;
const ENDED_STATES = ['RESIGNED', 'TERMINATED', 'RETIRED', 'AWOL', 'OTHERS'];

export class EvaluationService {
  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────────

  static async listTemplates(filters?: { isActive?: boolean; search?: string }) {
    const where: any = { deletedAt: null };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    // Hospicio's official forms first (Form 1–4, then the Simplified form), then HR's own.
    return prisma.evaluationTemplate.findMany({
      where,
      include: TEMPLATE_INCLUDE,
      orderBy: [{ isOfficial: 'desc' }, { officialCode: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async getTemplate(id: string) {
    const template = await prisma.evaluationTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });

    if (!template || template.deletedAt) {
      throw new AppError('Evaluation template not found', 404);
    }

    return template;
  }

  /**
   * The job roles a template is used for. A job role has at most one template,
   * so a cycle can give each group its own form (e.g. one form for caregiving
   * roles, another for office roles); employees whose role has none use the
   * cycle's template. Templates and their contents are always HR's to define.
   */
  private static async setTemplateJobRoles(tx: Prisma.TransactionClient, templateId: string, jobRoleIds: string[]) {
    const ids = [...new Set((jobRoleIds ?? []).filter((x) => typeof x === 'string' && x))];
    if (ids.length) {
      const roles = await tx.jobRole.findMany({ where: { id: { in: ids } }, select: { id: true } });
      if (roles.length !== ids.length) throw new AppError('One or more selected job roles do not exist.', 400);
      const taken = await tx.evaluationTemplateJobRole.findMany({
        where: { jobRoleId: { in: ids }, NOT: { templateId }, template: { deletedAt: null } },
        include: { template: { select: { name: true } }, jobRole: { select: { title: true } } },
      });
      if (taken.length) {
        throw new AppError(
          `A job role can use only one evaluation template. Already assigned: ${taken
            .map((t) => `${t.jobRole.title} → ${t.template.name}`)
            .join('; ')}. Remove it from that template first.`,
          409
        );
      }
      // A mapping left on a deleted template is released.
      await tx.evaluationTemplateJobRole.deleteMany({ where: { jobRoleId: { in: ids }, NOT: { templateId } } });
    }
    await tx.evaluationTemplateJobRole.deleteMany({ where: { templateId } });
    if (ids.length) {
      await tx.evaluationTemplateJobRole.createMany({ data: ids.map((jobRoleId) => ({ templateId, jobRoleId })) });
    }
  }

  /** The frozen copy of a template stored on each assignment. */
  private static snapshotOf(template: any) {
    return {
      templateId: template.id,
      name: template.name,
      description: template.description,
      ratingMethod: template.ratingMethod,
      minScore: template.minScore,
      maxScore: template.maxScore,
      scoreLabels: template.scoreLabels,
      useWeighting: template.useWeighting,
      scoringMethod: template.scoringMethod ?? 'CRITERIA',
      isOfficial: Boolean(template.isOfficial),
      officialCode: template.officialCode ?? null,
      sourceDocument: template.sourceDocument ?? null,
      formLayout: template.formLayout ?? null,
      groups: (template.groups ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        displayOrder: g.displayOrder,
        weight: g.weight,
      })),
      criteria: (template.criteria ?? []).map((c: any) => ({
        id: c.id,
        groupId: c.groupId ?? null,
        name: c.name,
        description: c.description,
        displayOrder: c.displayOrder,
        isRatingRequired: c.isRatingRequired,
        isCommentRequired: c.isCommentRequired,
        weight: c.weight,
      })),
    };
  }

  /**
   * Checks a template's structure and returns the scoring method it implies:
   * review areas (with statements under each) or flat criteria. When weighting
   * is on, the weights — on the areas, or on flat criteria — must total exactly
   * 100% (checked in hundredths of a percent, so 33.33 + 33.33 + 33.34 passes).
   */
  private static checkStructure(input: TemplateInput, useWeighting: boolean): EvaluationScoringMethod {
    const groups = input.groups ?? [];
    if (groups.length) {
      groups.forEach((g, gi) => {
        if (!g?.name?.trim()) throw new AppError(`Review area #${gi + 1} needs a name.`, 400);
        const items = g.items ?? [];
        if (!items.length) throw new AppError(`Review area "${g.name.trim()}" needs at least one statement to rate.`, 400);
        items.forEach((c, ci) => {
          if (!c?.name?.trim()) throw new AppError(`Statement ${ci + 1} in "${g.name.trim()}" is empty.`, 400);
        });
      });
      if (useWeighting) {
        const problem = weightsProblem(groups.map((g) => g.weight as number), 'Review area weights');
        if (problem) throw new AppError(problem, 400);
      }
      return useWeighting ? EvaluationScoringMethod.AREA_WEIGHTED : EvaluationScoringMethod.AREA_AVERAGE;
    }

    const criteria = input.criteria ?? [];
    criteria.forEach((c, ci) => {
      if (!c?.name?.trim()) throw new AppError(`Criterion #${ci + 1} needs a name.`, 400);
    });
    if (useWeighting && criteria.length) {
      const problem = weightsProblem(criteria.map((c) => c.weight as number), 'Criterion weights');
      if (problem) throw new AppError(problem, 400);
    }
    return EvaluationScoringMethod.CRITERIA;
  }

  /**
   * A numeric scale's labels must name scores inside the scale, once each. A
   * labelled scale either gives every label its own value (it is then scored,
   * and its range is its lowest and highest value — returned) or none at all
   * (written answers, no score).
   */
  private static checkScale(ratingMethod: EvaluationRatingMethod, minScore: number, maxScore: number, scoreLabels: any): { min: number; max: number } | null {
    const options = Array.isArray(scoreLabels?.options) ? scoreLabels.options : [];
    const hasScore = (o: any) => o?.score !== undefined && o?.score !== null && o?.score !== '';
    if (!options.some(hasScore)) return null;
    const scores = options.map((o: any) => Number(o.score));
    if (ratingMethod !== EvaluationRatingMethod.NUMERIC) {
      if (!options.every(hasScore) || scores.some((s: number) => !Number.isFinite(s))) {
        throw new AppError('Give every rating label its numeric value, or none of them.', 400);
      }
      if (new Set(scores).size !== scores.length) throw new AppError('Two rating labels share the same value.', 400);
      return { min: Math.min(...scores), max: Math.max(...scores) };
    }
    if (scores.some((s: number) => !Number.isFinite(s) || s < minScore || s > maxScore)) {
      throw new AppError(`Every rating label must belong to a score between ${minScore} and ${maxScore}.`, 400);
    }
    if (new Set(scores).size !== scores.length) throw new AppError('Two rating labels share the same score.', 400);
    return null;
  }

  /** Writes a template's areas and statements (or flat criteria). */
  private static async writeStructure(tx: Prisma.TransactionClient, templateId: string, input: TemplateInput, useWeighting: boolean) {
    const groups = input.groups ?? [];
    const toRow = (c: CriterionInput, displayOrder: number, groupId: string | null, flatWeight: boolean) => ({
      templateId,
      groupId,
      name: c.name.trim(),
      description: c.description?.trim() || null,
      displayOrder,
      isRatingRequired: c.isRatingRequired !== undefined ? c.isRatingRequired : true,
      isCommentRequired: Boolean(c.isCommentRequired),
      weight: flatWeight && useWeighting ? (c.weight !== undefined && c.weight !== null ? Number(c.weight) : null) : null,
    });

    if (groups.length) {
      let order = 1;
      for (const [gi, g] of groups.entries()) {
        const group = await tx.evaluationCriterionGroup.create({
          data: {
            templateId,
            name: g.name.trim(),
            description: g.description?.trim() || null,
            displayOrder: gi + 1,
            weight: useWeighting && g.weight !== undefined && g.weight !== null ? Number(g.weight) : null,
          },
        });
        await tx.evaluationCriterion.createMany({ data: g.items.map((c) => toRow(c, order++, group.id, false)) });
      }
      return;
    }
    const criteria = input.criteria ?? [];
    if (criteria.length) {
      await tx.evaluationCriterion.createMany({
        data: criteria.map((c, index) => toRow(c, c.displayOrder !== undefined ? c.displayOrder : index + 1, null, true)),
      });
    }
  }

  /** Only the layout keys HRISense knows, as short strings. */
  private static cleanLayout(raw: any) {
    if (!raw || typeof raw !== 'object') return null;
    const str = (v: any, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const list = (v: any) => (Array.isArray(v) ? v.map((x) => str(x, 1000)).filter(Boolean).slice(0, 12) : []);
    return {
      instructions: list(raw.instructions),
      appraisalLabel: str(raw.appraisalLabel, 80),
      appraisalTypes: list(raw.appraisalTypes),
      overallLabel: str(raw.overallLabel, 80),
      generalCommentsLabel: str(raw.generalCommentsLabel, 80),
      goalsLabel: str(raw.goalsLabel, 80),
      goalsPrompt: str(raw.goalsPrompt),
      acknowledgment: str(raw.acknowledgment, 1000),
      itemComments: raw.itemComments !== false,
      itemMarker: raw.itemMarker === '.' ? '.' : ')',
      weightsSource: ['HRISENSE_EQUAL', 'FORM_FORMULA', 'HR'].includes(raw.weightsSource) ? raw.weightsSource : 'HR',
      copiedFrom: str(raw.copiedFrom, 80),
    };
  }

  static async createTemplate(data: TemplateInput, creatorUserId?: string) {
    if (!data.name?.trim()) {
      throw new AppError('Template name is required', 400);
    }

    const useWeighting = Boolean(data.useWeighting);
    const scoringMethod = this.checkStructure(data, useWeighting);
    const ratingMethod = data.ratingMethod || EvaluationRatingMethod.NUMERIC;
    const labelRange = this.checkScale(
      ratingMethod,
      data.minScore !== undefined ? Number(data.minScore) : 1,
      data.maxScore !== undefined ? Number(data.maxScore) : 5,
      data.scoreLabels
    );
    const minScore = labelRange?.min ?? (data.minScore !== undefined ? Number(data.minScore) : 1);
    const maxScore = labelRange?.max ?? (data.maxScore !== undefined ? Number(data.maxScore) : 5);

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.evaluationTemplate.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          ratingMethod,
          minScore,
          maxScore,
          scoreLabels: data.scoreLabels || Prisma.JsonNull,
          useWeighting,
          scoringMethod,
          formLayout: this.cleanLayout(data.formLayout) ?? Prisma.JsonNull,
          createdById: creatorUserId || null,
        },
      });

      await this.writeStructure(tx, created.id, data, useWeighting);
      if (data.jobRoleIds !== undefined) await this.setTemplateJobRoles(tx, created.id, data.jobRoleIds);

      return created;
    });

    await createAuditLog({
      actorUserId: creatorUserId,
      action: 'EVALUATION_TEMPLATE_CREATED',
      entityType: 'EvaluationTemplate',
      entityId: template.id,
      metadata: {
        name: template.name,
        ratingMethod: template.ratingMethod,
        scoringMethod,
        areas: data.groups?.length ?? 0,
        criteriaCount: data.groups?.length ? data.groups.reduce((n, g) => n + g.items.length, 0) : data.criteria?.length ?? 0,
      },
    });

    return this.getTemplate(template.id);
  }

  static async updateTemplate(id: string, data: TemplateInput & { isActive?: boolean }, actorUserId?: string) {
    const existing = await prisma.evaluationTemplate.findUnique({ where: { id } });

    if (!existing || existing.deletedAt) {
      throw new AppError('Evaluation template not found', 404);
    }
    if (existing.isOfficial) {
      throw new AppError(
        "Hospicio de San Jose's official templates cannot be edited, so the original form is never lost. Use “Duplicate as Custom” to make a version you can change. (Which job roles use it can still be changed.)",
        409
      );
    }

    const useWeighting = data.useWeighting !== undefined ? Boolean(data.useWeighting) : existing.useWeighting;
    const replacesStructure = data.groups !== undefined || data.criteria !== undefined;
    const scoringMethod = replacesStructure ? this.checkStructure(data, useWeighting) : undefined;
    const ratingMethod = data.ratingMethod ?? existing.ratingMethod;
    const labelRange = this.checkScale(
      ratingMethod,
      data.minScore !== undefined ? Number(data.minScore) : existing.minScore ?? 1,
      data.maxScore !== undefined ? Number(data.maxScore) : existing.maxScore ?? 5,
      data.scoreLabels !== undefined ? data.scoreLabels : existing.scoreLabels
    );

    await prisma.$transaction(async (tx) => {
      await tx.evaluationTemplate.update({
        where: { id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          description: data.description !== undefined ? data.description.trim() || null : undefined,
          ratingMethod: data.ratingMethod !== undefined ? data.ratingMethod : undefined,
          minScore: labelRange ? labelRange.min : data.minScore !== undefined ? Number(data.minScore) : undefined,
          maxScore: labelRange ? labelRange.max : data.maxScore !== undefined ? Number(data.maxScore) : undefined,
          scoreLabels: data.scoreLabels !== undefined ? data.scoreLabels ?? Prisma.JsonNull : undefined,
          useWeighting,
          scoringMethod,
          formLayout: data.formLayout !== undefined ? this.cleanLayout(data.formLayout) ?? Prisma.JsonNull : undefined,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        },
      });

      if (replacesStructure) {
        // Existing assignments keep their own frozen copy (templateSnapshot),
        // so replacing the structure only affects cycles created from now on.
        await tx.evaluationCriterion.deleteMany({ where: { templateId: id } });
        await tx.evaluationCriterionGroup.deleteMany({ where: { templateId: id } });
        await this.writeStructure(tx, id, data, useWeighting);
      }

      if (data.jobRoleIds !== undefined) await this.setTemplateJobRoles(tx, id, data.jobRoleIds);
    });

    await createAuditLog({
      actorUserId,
      action: 'EVALUATION_TEMPLATE_UPDATED',
      entityType: 'EvaluationTemplate',
      entityId: id,
      metadata: { name: data.name || existing.name },
    });

    return this.getTemplate(id);
  }

  /** Which job roles use a template — allowed on official templates too (it is configuration, not form content). */
  static async setJobRoles(id: string, jobRoleIds: string[], actorUserId?: string) {
    const existing = await prisma.evaluationTemplate.findUnique({ where: { id }, include: { jobRoles: true } });
    if (!existing || existing.deletedAt) throw new AppError('Evaluation template not found', 404);
    if (!Array.isArray(jobRoleIds)) throw new AppError('jobRoleIds must be a list.', 400);

    await prisma.$transaction((tx) => this.setTemplateJobRoles(tx, id, jobRoleIds));

    await createAuditLog({
      actorUserId,
      action: 'EVALUATION_TEMPLATE_JOB_ROLES_UPDATED',
      entityType: 'EvaluationTemplate',
      entityId: id,
      metadata: { name: existing.name, before: existing.jobRoles.map((j) => j.jobRoleId), after: [...new Set(jobRoleIds)] },
    });
    return this.getTemplate(id);
  }

  /**
   * Copies a template — official or custom — into a new CUSTOM template HR can
   * edit. The copy keeps the scale, review areas, statements, weights and
   * written sections; it starts with no job roles (a role uses one template).
   */
  static async duplicateTemplate(id: string, payload: { name?: string }, actorUserId?: string) {
    const source = await this.getTemplate(id);
    const layout: any = source.formLayout && typeof source.formLayout === 'object' ? { ...(source.formLayout as any) } : null;
    if (layout && source.isOfficial) layout.copiedFrom = source.name;

    const groups = source.groups;
    const input: TemplateInput = {
      name: payload?.name?.trim() || `${source.name} (Custom copy)`,
      description: source.description ?? undefined,
      ratingMethod: source.ratingMethod,
      minScore: source.minScore ?? 1,
      maxScore: source.maxScore ?? 5,
      scoreLabels: source.scoreLabels,
      useWeighting: source.useWeighting,
      formLayout: layout,
      ...(groups.length
        ? {
            groups: groups.map((g) => ({
              name: g.name,
              description: g.description ?? undefined,
              weight: g.weight ?? undefined,
              items: source.criteria.filter((c) => c.groupId === g.id).map((c) => ({
                name: c.name, description: c.description ?? undefined, isRatingRequired: c.isRatingRequired, isCommentRequired: c.isCommentRequired,
              })),
            })),
          }
        : {
            criteria: source.criteria.map((c) => ({
              name: c.name, description: c.description ?? undefined, displayOrder: c.displayOrder,
              isRatingRequired: c.isRatingRequired, isCommentRequired: c.isCommentRequired, weight: c.weight ?? undefined,
            })),
          }),
    };

    const created = await this.createTemplate(input, actorUserId);
    await createAuditLog({
      actorUserId,
      action: 'EVALUATION_TEMPLATE_DUPLICATED',
      entityType: 'EvaluationTemplate',
      entityId: created.id,
      metadata: { sourceTemplateId: source.id, sourceName: source.name, sourceOfficialCode: source.officialCode },
    });
    return created;
  }

  static async deactivateTemplate(id: string, actorUserId?: string) {
    const existing = await prisma.evaluationTemplate.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt) {
      throw new AppError('Evaluation template not found', 404);
    }
    if (existing.isOfficial) {
      throw new AppError("Hospicio de San Jose's official templates cannot be deactivated.", 409);
    }

    const updated = await prisma.evaluationTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      actorUserId,
      action: 'EVALUATION_TEMPLATE_DEACTIVATED',
      entityType: 'EvaluationTemplate',
      entityId: id,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CYCLES & SCOPING
  // ─────────────────────────────────────────────────────────────────────────────

  static async listCycles(filters?: { status?: EvaluationCycleStatus; search?: string }) {
    const where: any = { deletedAt: null };
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const cycles = await prisma.evaluationCycle.findMany({
      where,
      include: {
        template: {
          select: { id: true, name: true, ratingMethod: true, useWeighting: true, isOfficial: true },
        },
        defaultEvaluator: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assignments: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeId: true,
            raterType: true,
            status: true,
            overallScore: true,
            submittedAt: true,
            finalizedAt: true,
            discussionCompletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Counted per employee evaluated, not per rater row.
    return cycles.map((c) => ({ ...c, metrics: cycleMetrics(cycleProgress(c.assignments || [], this.progressOptions(c))) }));
  }

  static async getCycle(id: string) {
    const cycle = await prisma.evaluationCycle.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            groups: { orderBy: { displayOrder: 'asc' } },
            criteria: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        defaultEvaluator: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assignments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                jobRole: { select: { id: true, title: true } },
                unit: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
              },
            },
            evaluator: { select: EVALUATOR_SELECT },
            template: { select: { id: true, name: true, isOfficial: true } },
          },
          orderBy: { employee: { lastName: 'asc' } },
        },
      },
    });

    if (!cycle || cycle.deletedAt) {
      throw new AppError('Evaluation cycle not found', 404);
    }

    // The workflow per employee: self, peers (x of y), head, discussion, HR.
    const subjects = cycleProgress(cycle.assignments || [], this.progressOptions(cycle)).map((sp) => {
      const rows = (cycle.assignments || []).filter((a) => a.employeeId === sp.employeeId);
      const head = rows.find((r) => r.raterType === 'HEAD');
      const template = head?.template ?? rows[0]?.template ?? null;
      const headMax = ratingScaleOf((head?.templateSnapshot as any) ?? head?.template ?? cycle.template).max;
      return {
        ...sp,
        templateName: template?.name ?? null,
        templateIsOfficial: Boolean(template?.isOfficial),
        // Standard: the head evaluation's own overall result.
        standardResult:
          cycle.evaluationMode === EvaluationMode.STANDARD && head
            ? {
                overall: head.overallScore,
                maxScore: headMax,
                percent: head.overallScore !== null && headMax ? Number(((head.overallScore / headMax) * 100).toFixed(2)) : null,
                finalized: head.status === EvaluationAssignmentStatus.FINALIZED,
              }
            : null,
        // Weighted multi-rater: self + peer + head. A finalised evaluation shows
        // the result frozen when HR finalised it.
        combined: cycle.evaluationMode !== EvaluationMode.WEIGHTED_MULTI_RATER
          ? null
          : head?.status === EvaluationAssignmentStatus.FINALIZED && head.combinedBreakdown
            ? { ...(head.combinedBreakdown as any), finalized: true }
            : {
                ...computeCombinedResult({
                  weights: this.sourceWeightsOf(cycle),
                  self: this.ratingOf(rows.find((r) => r.raterType === 'SELF')),
                  peers: rows.filter((r) => r.raterType === 'PEER').map((r) => this.ratingOf(r)!),
                  head: this.ratingOf(head),
                  maxScore: headMax,
                }),
                // Not final until the discussion is recorded and HR finalises.
                finalized: false,
              },
      };
    });

    return {
      ...cycle,
      subjects,
      metrics: cycleMetrics(subjects),
    };
  }

  /**
   * Helper to resolve unique active employees matching a list of scopes.
   */
  static async resolveTargetEmployees(scopes: Array<{
    scopeType: RequirementScopeType;
    targetUnitId?: string;
    targetDepartmentId?: string;
    targetJobRoleId?: string;
    targetEmployeeId?: string;
  }>): Promise<string[]> {
    if (!scopes || scopes.length === 0) return [];

    const hasAll = scopes.some((s) => s.scopeType === RequirementScopeType.ALL);
    if (hasAll) {
      const allActive = await prisma.employee.findMany({
        where: { employmentState: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      return allActive.map((e) => e.id);
    }

    const matchedIds = new Set<string>();

    for (const scope of scopes) {
      if (scope.scopeType === RequirementScopeType.EMPLOYEE && scope.targetEmployeeId) {
        const emp = await prisma.employee.findUnique({
          where: { id: scope.targetEmployeeId },
          select: { id: true, employmentState: true, deletedAt: true },
        });
        if (emp && emp.employmentState === 'ACTIVE' && !emp.deletedAt) {
          matchedIds.add(emp.id);
        }
      } else if (scope.scopeType === RequirementScopeType.UNIT && scope.targetUnitId) {
        const emps = await prisma.employee.findMany({
          where: { unitId: scope.targetUnitId, employmentState: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        emps.forEach((e) => matchedIds.add(e.id));
      } else if (scope.scopeType === RequirementScopeType.DEPARTMENT && scope.targetDepartmentId) {
        const emps = await prisma.employee.findMany({
          where: { departmentId: scope.targetDepartmentId, employmentState: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        emps.forEach((e) => matchedIds.add(e.id));
      } else if (scope.scopeType === RequirementScopeType.JOB_ROLE && scope.targetJobRoleId) {
        const emps = await prisma.employee.findMany({
          where: { jobRoleId: scope.targetJobRoleId, employmentState: 'ACTIVE', deletedAt: null },
          select: { id: true },
        });
        emps.forEach((e) => matchedIds.add(e.id));
      }
    }

    return Array.from(matchedIds);
  }

  static async createCycle(
    data: {
      name: string;
      description?: string;
      templateId: string;
      startDate: string | Date;
      dueDate: string | Date;
      evaluatorAssignmentMethod?: 'ONE_EVALUATOR' | 'SUPERVISOR' | 'MANUAL';
      defaultEvaluatorId?: string;
      scopes?: Array<{
        scopeType: RequirementScopeType;
        targetUnitId?: string;
        targetDepartmentId?: string;
        targetJobRoleId?: string;
        targetEmployeeId?: string;
      }>;
      individualAssignments?: Array<{
        employeeId: string;
        evaluatorId: string;
      }>;
      autoActivate?: boolean;
      appraisalType?: string;
      /**
       * STANDARD: the head / supervisor / coordinator evaluates the employee.
       * WEIGHTED_MULTI_RATER: self 20% + peer 20% + head 60% — Hospicio's
       * weighting, which is not configurable.
       */
      evaluationMode?: EvaluationMode;
      selfWeight?: number;
      peerWeight?: number;
      headWeight?: number;
    },
    actor: Actor
  ) {
    if (!data.name?.trim()) throw new AppError('Evaluation cycle name is required', 400);
    const mode = data.evaluationMode;
    if (mode !== EvaluationMode.STANDARD && mode !== EvaluationMode.WEIGHTED_MULTI_RATER) {
      throw new AppError('Choose the evaluation type: Standard Evaluation or Weighted Multi-Rater Evaluation.', 400);
    }
    const weighted = mode === EvaluationMode.WEIGHTED_MULTI_RATER;
    const asked = [data.selfWeight, data.peerWeight, data.headWeight];
    if (!weighted && asked.some((w) => w !== undefined && w !== null)) {
      throw new AppError('A Standard Evaluation has no self or peer rating, so it has no self / peer / head percentages.', 400);
    }
    if (
      weighted && asked.some((w) => w !== undefined && w !== null) &&
      (Number(data.selfWeight) !== HOSPICIO_SOURCE_WEIGHTS.self || Number(data.peerWeight) !== HOSPICIO_SOURCE_WEIGHTS.peer || Number(data.headWeight) !== HOSPICIO_SOURCE_WEIGHTS.head)
    ) {
      throw new AppError(
        `A Weighted Multi-Rater Evaluation always uses Hospicio's weighting: self ${HOSPICIO_SOURCE_WEIGHTS.self}%, peer ${HOSPICIO_SOURCE_WEIGHTS.peer}%, head / supervisor / coordinator ${HOSPICIO_SOURCE_WEIGHTS.head}%.`,
        400
      );
    }
    const weights = weighted ? { ...HOSPICIO_SOURCE_WEIGHTS } : null;
    if (!data.templateId) throw new AppError('Evaluation template is required', 400);
    if (!data.startDate || !data.dueDate) throw new AppError('Start date and due date are required', 400);

    const startDate = new Date(data.startDate);
    const dueDate = new Date(data.dueDate);
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
      throw new AppError('Invalid date format for cycle start or due date', 400);
    }
    if (dueDate < startDate) {
      throw new AppError('Due date cannot be earlier than start date', 400);
    }

    const template = await prisma.evaluationTemplate.findUnique({
      where: { id: data.templateId },
      include: {
        criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!template || template.deletedAt || !template.isActive) {
      throw new AppError('Selected evaluation template is invalid or inactive', 400);
    }

    const scopes = data.scopes && data.scopes.length > 0
      ? data.scopes
      : [{ scopeType: RequirementScopeType.ALL }];

    const method = data.evaluatorAssignmentMethod || 'MANUAL';
    const subjectIds = await this.resolveTargetEmployees(scopes);

    // A weighted result needs a number from every rating, so every form the
    // cycle will use (the cycle's, and any job role's own) must be scored.
    if (weighted) {
      const roleIds = [...new Set((await prisma.employee.findMany({ where: { id: { in: subjectIds } }, select: { jobRoleId: true } })).map((e) => e.jobRoleId))];
      const mapped = await prisma.evaluationTemplateJobRole.findMany({
        where: { jobRoleId: { in: roleIds }, template: { isActive: true, deletedAt: null } },
        include: { template: { select: { name: true, ratingMethod: true, scoreLabels: true, minScore: true, maxScore: true } } },
      });
      const unscored = [template, ...mapped.map((m) => m.template)].filter((t) => !ratingScaleOf(t).scored);
      if (unscored.length) {
        throw new AppError(
          `A Weighted Multi-Rater Evaluation combines numeric scores, but ${[...new Set(unscored.map((t) => `“${t.name}”`))].join(', ')} records written answers (or labels without values). Use a scored form, or run a Standard Evaluation.`,
          400
        );
      }
    }

    // HR never makes themselves — or another administrator — an evaluator by hand.
    if (method === 'ONE_EVALUATOR' && !data.defaultEvaluatorId) throw new AppError('Choose the designated evaluator.', 400);
    if (data.defaultEvaluatorId) {
      const ev = await this.evaluatorOf(data.defaultEvaluatorId);
      if (data.defaultEvaluatorId === actor.employeeId) {
        throw new AppError('HR administers the evaluation and cannot be the designated evaluator.', 403);
      }
      if (ev.permissionTier === PermissionTier.FULL) {
        throw new AppError('HR and other full-access administrators do not rate employees, so they cannot be the designated evaluator.', 403);
      }
    }
    if (data.individualAssignments?.length) {
      const subjects = new Map(
        (await prisma.employee.findMany({
          where: { id: { in: data.individualAssignments.map((ia) => ia.employeeId) } },
          select: { id: true, immediateSupervisorId: true },
        })).map((e) => [e.id, e])
      );
      for (const ia of data.individualAssignments) {
        const subject = subjects.get(ia.employeeId);
        if (!subject || !ia.evaluatorId) continue;
        const ev = await this.evaluatorOf(ia.evaluatorId);
        const denial = evaluatorDenial({ role: 'HEAD', evaluator: ev, subject, chosenBy: actor });
        if (denial) throw new AppError(denial, 403);
      }
    }

    // Transactionally create cycle + scopes + assignments
    const cycle = await prisma.$transaction(async (tx) => {
      const created = await tx.evaluationCycle.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          templateId: data.templateId,
          startDate,
          dueDate,
          status: data.autoActivate ? EvaluationCycleStatus.ACTIVE : EvaluationCycleStatus.ACTIVE, // default active
          evaluatorAssignmentMethod: method,
          defaultEvaluatorId: data.defaultEvaluatorId || null,
          appraisalType: data.appraisalType?.trim() ? data.appraisalType.trim().slice(0, 80) : null,
          evaluationMode: mode,
          selfWeight: weights ? weights.self : null,
          peerWeight: weights ? weights.peer : null,
          headWeight: weights ? weights.head : null,
          createdById: actor.id || null,
          scopes: {
            create: scopes.map((s) => ({
              scopeType: s.scopeType,
              targetUnitId: s.targetUnitId || null,
              targetDepartmentId: s.targetDepartmentId || null,
              targetJobRoleId: s.targetJobRoleId || null,
              targetEmployeeId: s.targetEmployeeId || null,
            })),
          },
        },
      });

      return created;
    });

    // Populate assignments: the head evaluator by the chosen method, and — in a
    // weighted cycle — a self rating for everyone. Peers are selected by HR
    // afterwards, per employee (weighted cycles only).
    await this.generateCycleAssignments(cycle.id, {
      method,
      defaultEvaluatorId: data.defaultEvaluatorId,
      individualAssignments: data.individualAssignments,
      scopes,
    });

    await createAuditLog({
      actorUserId: actor.id,
      action: 'EVALUATION_CYCLE_CREATED',
      entityType: 'EvaluationCycle',
      entityId: cycle.id,
      metadata: {
        name: cycle.name,
        templateId: cycle.templateId,
        evaluationMode: mode,
        ...(weights ? { selfWeight: weights.self, peerWeight: weights.peer, headWeight: weights.head } : {}),
      },
    });

    return this.getCycle(cycle.id);
  }

  private static sourceWeightsOf(cycle: { selfWeight: number | null; peerWeight: number | null; headWeight: number | null }) {
    return { self: cycle.selfWeight ?? 0, peer: cycle.peerWeight ?? 0, head: cycle.headWeight ?? 0 };
  }

  /** The cycle's mode; in a weighted cycle with a peer weight, the peer rating is required to finalise. */
  private static progressOptions(cycle: { evaluationMode: EvaluationMode; peerWeight: number | null }) {
    return {
      mode: cycle.evaluationMode,
      requirePeer: cycle.evaluationMode === EvaluationMode.WEIGHTED_MULTI_RATER && (cycle.peerWeight ?? 0) > 0,
    };
  }

  /** An active employee, with the permission tier of their job role. */
  private static async evaluatorOf(id: string) {
    const e = await prisma.employee.findFirst({
      where: { id, deletedAt: null, employmentState: { notIn: ENDED_STATES as any } },
      select: { id: true, jobRole: { select: { permissionTier: true } } },
    });
    if (!e) throw new AppError('The selected evaluator is not an active employee.', 400);
    return { id: e.id, permissionTier: e.jobRole?.permissionTier ?? null };
  }

  /** The official evaluation weighting, for the screens to show and pre-fill (one source: the API). */
  static getConfig() {
    return {
      officialSourceWeights: { ...HOSPICIO_SOURCE_WEIGHTS },
      officialSourceWeightsLabel: "Hospicio de San Jose's official evaluation weighting",
    };
  }

  /** An assignment as one source of the combined rating. */
  private static ratingOf(
    a: { status: EvaluationAssignmentStatus; overallScore: number | null } | undefined | null,
    breakdown?: { rawTotal?: number | null; rawMax?: number | null }
  ) {
    if (!a) return null;
    return {
      overall: a.overallScore,
      submitted: a.status === EvaluationAssignmentStatus.SUBMITTED || a.status === EvaluationAssignmentStatus.FINALIZED,
      rawTotal: breakdown?.rawTotal ?? null,
      rawMax: breakdown?.rawMax ?? null,
    };
  }

  /** How an assignment's score is reached, from its frozen template copy. */
  private static breakdownOf(a: { templateSnapshot: any; template?: any; responses: Array<{ criterionId: string; ratingNumeric: number | null }> }) {
    const snap: any = a.templateSnapshot;
    const t: any = a.template ?? {};
    const scale = ratingScaleOf(snap ?? t);
    return computeEvaluationScore({
      ratingMethod: snap?.ratingMethod || t.ratingMethod,
      scored: scale.scored,
      useWeighting: Boolean(snap?.useWeighting ?? t.useWeighting),
      scoringMethod: snap?.scoringMethod ?? t.scoringMethod ?? 'CRITERIA',
      groups: (snap?.groups ?? t.groups ?? []).map((g: any) => ({ id: g.id, name: g.name, weight: g.weight })),
      criteria: (snap?.criteria || t.criteria || []).map((c: any) => ({ id: c.id, name: c.name, weight: c.weight, groupId: c.groupId ?? null })),
      responses: a.responses.map((r) => ({ criterionId: r.criterionId, ratingNumeric: r.ratingNumeric })),
      maxScore: scale.max,
    });
  }

  /** The combined self + peer + head result for one employee in a cycle (with raw totals). */
  private static async combinedResultFor(
    cycle: { id: string; selfWeight: number | null; peerWeight: number | null; headWeight: number | null },
    employeeId: string
  ) {
    const rows = await prisma.evaluationAssignment.findMany({
      where: { cycleId: cycle.id, employeeId, deletedAt: null },
      include: {
        responses: { select: { criterionId: true, ratingNumeric: true } },
        template: { include: { groups: true, criteria: { where: { isActive: true } } } },
      },
    });
    const withRaw = (a: (typeof rows)[number] | undefined) => (a ? this.ratingOf(a, this.breakdownOf(a)) : null);
    const head = rows.find((r) => r.raterType === EvaluationRaterType.HEAD);
    const base: any = head ?? rows[0];
    return computeCombinedResult({
      weights: this.sourceWeightsOf(cycle),
      self: withRaw(rows.find((r) => r.raterType === EvaluationRaterType.SELF)),
      peers: rows.filter((r) => r.raterType === EvaluationRaterType.PEER).map((r) => this.ratingOf(r)!),
      head: withRaw(head),
      maxScore: base ? ratingScaleOf(base.templateSnapshot ?? base.template).max : null,
    });
  }

  /**
   * Who will be evaluated, and with which template, before a cycle is created:
   * the job role's mapped template where there is one (e.g. Maintenance Staff →
   * Eval Form 1), otherwise the template chosen for the cycle. Nothing is
   * guessed from job titles — only HR's configured job-role mappings count.
   */
  static async previewCycle(data: { templateId: string; scopes?: Array<any> }) {
    if (!data?.templateId) throw new AppError('Choose the cycle template first.', 400);
    const cycleTemplate = await prisma.evaluationTemplate.findUnique({
      where: { id: data.templateId },
      select: { id: true, name: true, isOfficial: true, isActive: true, deletedAt: true },
    });
    if (!cycleTemplate || cycleTemplate.deletedAt || !cycleTemplate.isActive) {
      throw new AppError('Selected evaluation template is invalid or inactive', 400);
    }
    const scopes = data.scopes?.length ? data.scopes : [{ scopeType: RequirementScopeType.ALL }];
    const ids = await this.resolveTargetEmployees(scopes);
    const employees = await prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { id: true, title: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const mappings = await prisma.evaluationTemplateJobRole.findMany({
      where: { jobRoleId: { in: [...new Set(employees.map((e) => e.jobRole?.id).filter((x): x is string => !!x))] }, template: { isActive: true, deletedAt: null } },
      include: { template: { select: { id: true, name: true, isOfficial: true } } },
    });
    const base = { id: cycleTemplate.id, name: cycleTemplate.name, isOfficial: cycleTemplate.isOfficial };
    const rows = employees.map((e) => {
      const mapped = mappings.find((m) => m.jobRoleId === e.jobRole?.id)?.template;
      return { ...e, template: mapped ? { ...mapped, source: 'JOB_ROLE' as const } : { ...base, source: 'CYCLE' as const } };
    });
    const byTemplate = new Map<string, { templateId: string; name: string; isOfficial: boolean; count: number }>();
    for (const r of rows) {
      const cur = byTemplate.get(r.template.id) ?? { templateId: r.template.id, name: r.template.name, isOfficial: r.template.isOfficial, count: 0 };
      cur.count += 1;
      byTemplate.set(r.template.id, cur);
    }
    return { total: rows.length, byTemplate: [...byTemplate.values()], employees: rows };
  }

  /**
   * Creates the assignments for a cycle: a HEAD (head / supervisor /
   * coordinator) rating for every employee in scope when the head can be
   * determined — chosen individually by HR, the employee's immediate supervisor
   * (SUPERVISOR method), or the cycle's default evaluator — and, in a weighted
   * multi-rater cycle only, a SELF rating. Employees whose job role has its own
   * template are evaluated with that template. Peer evaluators are added by HR
   * afterwards (`addPeers`, weighted cycles only); nobody is exposed to a peer
   * evaluation HR did not select.
   */
  static async generateCycleAssignments(
    cycleId: string,
    options: {
      method: string;
      defaultEvaluatorId?: string;
      individualAssignments?: Array<{ employeeId: string; evaluatorId: string }>;
      scopes: Array<any>;
    }
  ) {
    const cycle = await prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      include: {
        template: { include: { groups: { orderBy: { displayOrder: 'asc' } }, criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } } },
      },
    });

    if (!cycle) throw new AppError('Cycle not found', 404);

    const targetEmployeeIds = await this.resolveTargetEmployees(options.scopes);
    if (targetEmployeeIds.length === 0) return;

    const subjects = await prisma.employee.findMany({
      where: { id: { in: targetEmployeeIds } },
      select: { id: true, jobRoleId: true, immediateSupervisorId: true },
    });

    // Per-job-role templates (active ones only); everyone else uses the cycle's.
    const mappings = await prisma.evaluationTemplateJobRole.findMany({
      where: { jobRoleId: { in: [...new Set(subjects.map((s) => s.jobRoleId))] }, template: { isActive: true, deletedAt: null } },
      include: { template: { include: { groups: { orderBy: { displayOrder: 'asc' } }, criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } } } },
    });
    const templateFor = (jobRoleId: string) => mappings.find((m) => m.jobRoleId === jobRoleId)?.template ?? cycle.template;

    const individualMap = new Map<string, string>();
    (options.individualAssignments ?? []).forEach((ia) => {
      if (ia.employeeId && ia.evaluatorId) individualMap.set(ia.employeeId, ia.evaluatorId);
    });
    const defaultEvaluatorId = options.defaultEvaluatorId || cycle.defaultEvaluatorId || undefined;

    const headFor = (s: { id: string; immediateSupervisorId: string | null }) => {
      let headId = individualMap.get(s.id);
      if (!headId && options.method === 'SUPERVISOR') headId = s.immediateSupervisorId ?? undefined;
      if (!headId && defaultEvaluatorId) headId = defaultEvaluatorId;
      return headId && headId !== s.id ? headId : undefined;
    };

    // Only active employees can be heads — and a full-access administrator
    // (HR, Sister) only of their own direct reports.
    const headIds = [...new Set(subjects.map(headFor).filter((x): x is string => !!x))];
    const activeHeads = new Map(
      (await prisma.employee.findMany({
        where: { id: { in: headIds }, deletedAt: null, employmentState: { notIn: ENDED_STATES as any } },
        select: { id: true, jobRole: { select: { permissionTier: true } } },
      })).map((e) => [e.id, { id: e.id, permissionTier: e.jobRole?.permissionTier ?? null }])
    );
    const weighted = cycle.evaluationMode === EvaluationMode.WEIGHTED_MULTI_RATER;

    await prisma.$transaction(async (tx) => {
      for (const subj of subjects) {
        const template = templateFor(subj.jobRoleId);
        const templateSnapshot = this.snapshotOf(template);

        if (weighted) await tx.evaluationAssignment.upsert({
          where: {
            cycleId_employeeId_raterType_evaluatorId: {
              cycleId, employeeId: subj.id, raterType: EvaluationRaterType.SELF, evaluatorId: subj.id,
            },
          },
          create: {
            cycleId, employeeId: subj.id, evaluatorId: subj.id, raterType: EvaluationRaterType.SELF,
            templateId: template.id, templateSnapshot, dueDate: cycle.dueDate, status: EvaluationAssignmentStatus.NOT_STARTED,
          },
          update: {},
        });

        const headId = headFor(subj);
        const head = headId ? activeHeads.get(headId) : undefined;
        if (!head || evaluatorDenial({ role: 'HEAD', evaluator: head, subject: subj })) continue;
        const existingHead = await tx.evaluationAssignment.findFirst({
          where: { cycleId, employeeId: subj.id, raterType: EvaluationRaterType.HEAD, deletedAt: null },
        });
        if (!existingHead) {
          await tx.evaluationAssignment.create({
            data: {
              cycleId, employeeId: subj.id, evaluatorId: head.id, raterType: EvaluationRaterType.HEAD,
              templateId: template.id, templateSnapshot, dueDate: cycle.dueDate, status: EvaluationAssignmentStatus.NOT_STARTED,
            },
          });
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PARTICIPANTS (HR-controlled)
  // ─────────────────────────────────────────────────────────────────────────────

  /** The employee's row set in a cycle, with the template the self rating uses. */
  private static async subjectRows(cycleId: string, employeeId: string) {
    const cycle = await prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.deletedAt) throw new AppError('Evaluation cycle not found', 404);
    const rows = await prisma.evaluationAssignment.findMany({
      where: { cycleId, employeeId, deletedAt: null },
      include: { evaluator: { select: EVALUATOR_SELECT } },
    });
    if (!rows.length) throw new AppError('This employee is not part of the evaluation cycle.', 404);
    return { cycle, rows };
  }

  /**
   * The evaluator must be an active employee other than the one evaluated; HR
   * cannot pick themselves or choose their own evaluators; and a full-access
   * administrator is never a peer, and a head only of their own direct reports.
   */
  private static async assertEvaluatorAllowed(evaluatorId: string, subjectId: string, actor: Actor, role: 'HEAD' | 'PEER') {
    if (!evaluatorId) throw new AppError('Choose an evaluator.', 400);
    if (evaluatorId === subjectId) throw new AppError('The employee cannot be their own peer or head evaluator.', 400);
    const subject = await prisma.employee.findUnique({ where: { id: subjectId }, select: { id: true, immediateSupervisorId: true } });
    if (!subject) throw new AppError('Employee not found', 404);
    const evaluator = await this.evaluatorOf(evaluatorId);
    const denial = evaluatorDenial({ role, evaluator, subject, chosenBy: actor });
    if (denial) throw new AppError(denial, 403);
  }

  /** Sets (or replaces) the head / supervisor / coordinator evaluator for one employee. */
  static async setHeadEvaluator(cycleId: string, employeeId: string, evaluatorId: string, actor: Actor) {
    const { cycle, rows } = await this.subjectRows(cycleId, employeeId);
    if (cycle.status !== EvaluationCycleStatus.ACTIVE) throw new AppError('The cycle is closed.', 400);
    await this.assertEvaluatorAllowed(evaluatorId, employeeId, actor, 'HEAD');

    const head = rows.find((r) => r.raterType === EvaluationRaterType.HEAD);
    if (head && (head.status === EvaluationAssignmentStatus.SUBMITTED || head.status === EvaluationAssignmentStatus.FINALIZED)) {
      throw new AppError('The head evaluation has already been submitted, so its evaluator can no longer be changed.', 409);
    }
    if (head?.evaluatorId === evaluatorId) return this.getCycle(cycleId);
    if (rows.some((r) => r.raterType === EvaluationRaterType.PEER && r.evaluatorId === evaluatorId)) {
      throw new AppError('This person is already a peer evaluator for the employee. Remove them as a peer first.', 409);
    }

    const base = rows.find((r) => r.raterType === EvaluationRaterType.SELF) ?? rows[0];
    await prisma.$transaction(async (tx) => {
      if (head) {
        // A different person rates from scratch: the previous evaluator's draft goes.
        await tx.evaluationResponse.deleteMany({ where: { assignmentId: head.id } });
        await tx.evaluationAssignment.update({
          where: { id: head.id },
          data: { evaluatorId, status: EvaluationAssignmentStatus.NOT_STARTED, startedAt: null, overallScore: null, evaluatorSummary: null, developmentRecommendations: null },
        });
      } else {
        await tx.evaluationAssignment.create({
          data: {
            cycleId, employeeId, evaluatorId, raterType: EvaluationRaterType.HEAD,
            templateId: base.templateId, templateSnapshot: base.templateSnapshot as any, dueDate: base.dueDate,
            status: EvaluationAssignmentStatus.NOT_STARTED,
          },
        });
      }
    });

    await createAuditLog({
      actorUserId: actor.id,
      targetEmployeeId: employeeId,
      action: head ? 'EVALUATION_HEAD_EVALUATOR_CHANGED' : 'EVALUATION_HEAD_EVALUATOR_ASSIGNED',
      entityType: 'EvaluationCycle',
      entityId: cycleId,
      metadata: { previousEvaluatorId: head?.evaluatorId ?? null, evaluatorId },
    });
    return this.getCycle(cycleId);
  }

  /** Adds peer evaluators HR selected (individually, or from a unit they picked). */
  static async addPeers(cycleId: string, employeeId: string, evaluatorIds: string[], actor: Actor) {
    const { cycle, rows } = await this.subjectRows(cycleId, employeeId);
    if (cycle.status !== EvaluationCycleStatus.ACTIVE) throw new AppError('The cycle is closed.', 400);
    if (cycle.evaluationMode !== EvaluationMode.WEIGHTED_MULTI_RATER) {
      throw new AppError('A Standard Evaluation has no peer rating — only the head / supervisor / coordinator evaluates.', 400);
    }
    const wanted = [...new Set((evaluatorIds ?? []).filter((x) => typeof x === 'string' && x))];
    if (!wanted.length) throw new AppError('Select at least one peer evaluator.', 400);
    for (const id of wanted) await this.assertEvaluatorAllowed(id, employeeId, actor, 'PEER');

    const head = rows.find((r) => r.raterType === EvaluationRaterType.HEAD);
    if (head && wanted.includes(head.evaluatorId)) {
      throw new AppError('The head evaluator cannot also be a peer evaluator for the same employee.', 409);
    }
    const base = rows.find((r) => r.raterType === EvaluationRaterType.SELF) ?? rows[0];
    const added: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const evaluatorId of wanted) {
        const existing = await tx.evaluationAssignment.findUnique({
          where: { cycleId_employeeId_raterType_evaluatorId: { cycleId, employeeId, raterType: EvaluationRaterType.PEER, evaluatorId } },
        });
        if (existing && !existing.deletedAt) continue;
        if (existing) {
          // Re-adding someone HR removed earlier restores a clean assignment.
          await tx.evaluationResponse.deleteMany({ where: { assignmentId: existing.id } });
          await tx.evaluationAssignment.update({
            where: { id: existing.id },
            data: { deletedAt: null, status: EvaluationAssignmentStatus.NOT_STARTED, startedAt: null, submittedAt: null, overallScore: null, evaluatorSummary: null, developmentRecommendations: null },
          });
        } else {
          await tx.evaluationAssignment.create({
            data: {
              cycleId, employeeId, evaluatorId, raterType: EvaluationRaterType.PEER,
              templateId: base.templateId, templateSnapshot: base.templateSnapshot as any, dueDate: base.dueDate,
              status: EvaluationAssignmentStatus.NOT_STARTED,
            },
          });
        }
        added.push(evaluatorId);
      }
    });

    if (added.length) {
      await createAuditLog({
        actorUserId: actor.id,
        targetEmployeeId: employeeId,
        action: 'EVALUATION_PEERS_ASSIGNED',
        entityType: 'EvaluationCycle',
        entityId: cycleId,
        metadata: { evaluatorIds: added },
      });
    }
    return this.getCycle(cycleId);
  }

  /** HR removes a peer evaluator who has not submitted yet (the row is kept, marked removed). */
  static async removePeer(assignmentId: string, actor: Actor) {
    const a = await prisma.evaluationAssignment.findUnique({ where: { id: assignmentId } });
    if (!a || a.deletedAt) throw new AppError('Evaluation assignment not found', 404);
    if (a.raterType !== EvaluationRaterType.PEER) throw new AppError('Only peer evaluators can be removed.', 400);
    if (a.status === EvaluationAssignmentStatus.SUBMITTED || a.status === EvaluationAssignmentStatus.FINALIZED) {
      throw new AppError('This peer evaluation has already been submitted and is kept.', 409);
    }
    await prisma.evaluationAssignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date() } });
    await createAuditLog({
      actorUserId: actor.id,
      targetEmployeeId: a.employeeId,
      action: 'EVALUATION_PEER_REMOVED',
      entityType: 'EvaluationAssignment',
      entityId: assignmentId,
      metadata: { evaluatorId: a.evaluatorId },
    });
    return this.getCycle(a.cycleId);
  }

  /**
   * Active employees HR may pick as peers or head for one employee (grouped by
   * unit in the UI), each marked with what they may be — the same rule the API
   * applies when the choice is saved.
   */
  static async evaluatorCandidates(cycleId: string, employeeId: string, actor: Actor) {
    const { cycle } = await this.subjectRows(cycleId, employeeId);
    const subject = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, immediateSupervisorId: true } });
    if (!subject) throw new AppError('Employee not found', 404);
    const people = await prisma.employee.findMany({
      where: { deletedAt: null, employmentState: { notIn: ENDED_STATES as any }, NOT: { id: employeeId } },
      select: {
        id: true, firstName: true, lastName: true, employeeNumber: true,
        jobRole: { select: { id: true, title: true, permissionTier: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const weighted = cycle.evaluationMode === EvaluationMode.WEIGHTED_MULTI_RATER;
    return people
      .map(({ jobRole, ...p }) => {
        const evaluator = { id: p.id, permissionTier: jobRole?.permissionTier ?? null };
        return {
          ...p,
          jobRole: jobRole ? { id: jobRole.id, title: jobRole.title } : null,
          canBeHead: !evaluatorDenial({ role: 'HEAD', evaluator, subject, chosenBy: actor }),
          canBePeer: weighted && !evaluatorDenial({ role: 'PEER', evaluator, subject, chosenBy: actor }),
        };
      })
      .filter((p) => p.canBeHead || p.canBePeer);
  }

  /** Who may be a cycle's designated evaluator: active employees who are not full-access administrators, nor the HR user. */
  static async designatedEvaluatorOptions(actor: Actor) {
    return prisma.employee.findMany({
      where: {
        deletedAt: null,
        employmentState: { notIn: ENDED_STATES as any },
        jobRole: { permissionTier: { not: PermissionTier.FULL } },
        ...(actor.employeeId ? { NOT: { id: actor.employeeId } } : {}),
      },
      select: {
        id: true, firstName: true, lastName: true, employeeNumber: true,
        jobRole: { select: { title: true } },
        unit: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  static async closeCycle(id: string, actorUserId?: string) {
    const cycle = await prisma.evaluationCycle.findUnique({ where: { id } });
    if (!cycle || cycle.deletedAt) throw new AppError('Cycle not found', 404);

    const updated = await prisma.evaluationCycle.update({
      where: { id },
      data: { status: EvaluationCycleStatus.CLOSED },
    });

    await createAuditLog({
      actorUserId,
      action: 'EVALUATION_CYCLE_CLOSED',
      entityType: 'EvaluationCycle',
      entityId: id,
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ASSIGNMENTS & EVALUATOR WORKSPACE
  // ─────────────────────────────────────────────────────────────────────────────

  static async listAssignments(
    requestingUser: Actor,
    filters?: {
      cycleId?: string;
      evaluatorId?: string;
      employeeId?: string;
      status?: EvaluationAssignmentStatus;
      raterType?: EvaluationRaterType;
      search?: string;
      /** Only the assignments the caller has to complete, whatever their tier. */
      mine?: boolean;
    }
  ) {
    const and: any[] = [{ deletedAt: null }];
    const me = requestingUser.employeeId || 'none';

    if (requestingUser.permissionTier === PermissionTier.FULL && !filters?.mine) {
      // HR administers: every assignment, filterable.
      if (filters?.evaluatorId) and.push({ evaluatorId: filters.evaluatorId });
      if (filters?.employeeId) and.push({ employeeId: filters.employeeId });
      if (filters?.raterType) and.push({ raterType: filters.raterType });
    } else if (filters?.mine) {
      and.push({ evaluatorId: me });
    } else {
      // Everyone else: what they were asked to complete (self, peer or head),
      // plus their own finalised result when HR made it visible.
      and.push({
        OR: [
          { evaluatorId: me },
          { employeeId: me, raterType: EvaluationRaterType.HEAD, status: EvaluationAssignmentStatus.FINALIZED, isEmployeeVisible: true },
        ],
      });
    }
    if (filters?.cycleId) and.push({ cycleId: filters.cycleId });
    if (filters?.status) and.push({ status: filters.status });

    if (filters?.search) {
      and.push({
        OR: [
          { employee: { firstName: { contains: filters.search } } },
          { employee: { lastName: { contains: filters.search } } },
          { employee: { employeeNumber: { contains: filters.search } } },
          { cycle: { name: { contains: filters.search } } },
        ],
      });
    }

    const rows = await prisma.evaluationAssignment.findMany({
      where: { AND: and },
      include: {
        cycle: { select: { id: true, name: true, status: true, startDate: true, dueDate: true } },
        template: { select: { id: true, name: true, ratingMethod: true, minScore: true, maxScore: true, scoreLabels: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobRole: { select: { id: true, title: true } },
            unit: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobRole: { select: { id: true, title: true } },
          },
        },
        responses: true,
      },
      orderBy: [{ dueDate: 'asc' }, { employee: { lastName: 'asc' } }],
    });

    // A peer's identity is not shown to the employee evaluated (they never see
    // peer rows anyway); everyone sees which kind of rating each row is.
    return rows.map((r) => ({ ...r, raterLabel: RATER_LABEL[r.raterType], isMine: r.evaluatorId === me }));
  }

  static async getAssignment(id: string, requestingUser: Actor) {
    const assignment = await prisma.evaluationAssignment.findUnique({
      where: { id },
      include: {
        cycle: {
          select: {
            id: true, name: true, status: true, startDate: true, dueDate: true,
            appraisalType: true, evaluationMode: true, selfWeight: true, peerWeight: true, headWeight: true,
          },
        },
        template: {
          include: {
            groups: { orderBy: { displayOrder: 'asc' } },
            criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobRole: { select: { id: true, title: true } },
            unit: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            immediateSupervisorId: true,
          },
        },
        evaluator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobRole: { select: { id: true, title: true } },
          },
        },
        responses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!assignment || assignment.deletedAt) {
      throw new AppError('Evaluation assignment not found', 404);
    }

    // Record-level authorization:
    //  · HR (FULL) may view every assignment — but never rate one (see saveDraft/submit).
    //  · The assigned evaluator sees their own assignment (self, peer or head).
    //  · The employee evaluated sees only the finalised head evaluation, and only
    //    when HR made it visible. Peer evaluations are never shown to them.
    const isHr = requestingUser.permissionTier === PermissionTier.FULL;
    const isEvaluator = Boolean(requestingUser.employeeId && assignment.evaluatorId === requestingUser.employeeId);
    const isSubject = Boolean(requestingUser.employeeId && assignment.employeeId === requestingUser.employeeId);

    if (!isHr && !isEvaluator) {
      const visibleResult =
        isSubject &&
        assignment.raterType === EvaluationRaterType.HEAD &&
        assignment.isEmployeeVisible &&
        assignment.status === EvaluationAssignmentStatus.FINALIZED;
      if (!visibleResult) {
        throw new AppError(
          isSubject ? 'Access forbidden: Evaluation is not yet finalized or visible' : 'Access forbidden: Insufficient permissions to view this evaluation',
          403
        );
      }
    }

    // How the overall score was reached, from the same function that stored it.
    const scoreBreakdown = this.breakdownOf(assignment);
    // The assigned evaluator, unless HR's administrative role bars them (rateDenial).
    const mayRate =
      isEvaluator &&
      rateDenial(
        { ...assignment, status: EvaluationAssignmentStatus.NOT_STARTED, discussionCompletedAt: null, subjectSupervisorId: assignment.employee?.immediateSupervisorId ?? null },
        requestingUser
      ) === null;

    const isHead = assignment.raterType === EvaluationRaterType.HEAD;
    const weighted = assignment.cycle.evaluationMode === EvaluationMode.WEIGHTED_MULTI_RATER;
    const cycleActive = assignment.cycle.status === EvaluationCycleStatus.ACTIVE;
    // HR sees how the employee's whole evaluation stands (all components).
    let workflow: any = null;
    let components: any[] | undefined;
    let finalizeBlockedReason: string | null = null;
    if (isHr) {
      const siblings = await prisma.evaluationAssignment.findMany({
        where: { cycleId: assignment.cycleId, employeeId: assignment.employeeId, deletedAt: null },
        include: { evaluator: { select: EVALUATOR_SELECT } },
      });
      workflow = subjectProgress(siblings, this.progressOptions(assignment.cycle));
      finalizeBlockedReason = finalizeDenial(siblings, requestingUser);
      // A standard evaluation is the head's alone.
      components = siblings.filter((x) => weighted || x.raterType === EvaluationRaterType.HEAD).map((x) => ({
        assignmentId: x.id, raterType: x.raterType, raterLabel: RATER_LABEL[x.raterType], evaluator: x.evaluator,
        status: x.status, submittedAt: x.submittedAt, overallScore: x.overallScore,
      }));
    }

    // The final combined self + peer + head rating, for HR, and for the employee
    // on their finalised, visible result. Finalised: the copy frozen by HR.
    let combined: any = null;
    if (weighted && (isHr || (isSubject && isHead))) {
      combined = isHead && assignment.status === EvaluationAssignmentStatus.FINALIZED && assignment.combinedBreakdown
        ? { ...(assignment.combinedBreakdown as any), finalized: true }
        : { ...(await this.combinedResultFor(assignment.cycle, assignment.employeeId)), finalized: false };
      // The employee evaluated never sees who their peers were (none are named here).
    }

    return {
      ...assignment,
      raterLabel: RATER_LABEL[assignment.raterType],
      scoreBreakdown,
      combined,
      // What the caller may do — the API enforces the same rules.
      evaluationMode: assignment.cycle.evaluationMode,
      canRate:
        mayRate && cycleActive &&
        assignment.status !== EvaluationAssignmentStatus.FINALIZED &&
        assignment.status !== EvaluationAssignmentStatus.SUBMITTED &&
        !(isHead && assignment.discussionCompletedAt),
      canAmend:
        mayRate && cycleActive &&
        assignment.status === EvaluationAssignmentStatus.SUBMITTED &&
        !(isHead && assignment.discussionCompletedAt),
      canRecordDiscussion: mayRate && isHead && assignment.status === EvaluationAssignmentStatus.SUBMITTED && !assignment.discussionCompletedAt,
      canFinalize: isHr && isHead && Boolean(workflow) && workflow.stage === 'READY_TO_FINALIZE' && !finalizeBlockedReason,
      finalizeBlockedReason: isHr && isHead ? finalizeBlockedReason : null,
      workflow,
      components,
    };
  }

  /** Only the assigned evaluator rates. HR's administrative access gives no right to rate. */
  private static assertCanRate(
    assignment: {
      evaluatorId: string;
      raterType: EvaluationRaterType;
      status: EvaluationAssignmentStatus;
      discussionCompletedAt: Date | null;
      employee: { immediateSupervisorId: string | null };
    },
    requestingUser: Actor
  ) {
    const denial = rateDenial({ ...assignment, subjectSupervisorId: assignment.employee.immediateSupervisorId }, requestingUser);
    if (denial) throw new AppError(denial.message, denial.status);
  }

  /**
   * The number recorded for an answer. A numeric scale records the score given;
   * a labelled scale records the configured value of the label chosen (looked
   * up here — never taken from the browser); written answers record none.
   */
  private static recordedRating(scale: ReturnType<typeof ratingScaleOf>, res: { ratingNumeric?: number | null; ratingLabel?: string | null }) {
    if (!scale.labelled) {
      return res.ratingNumeric !== undefined && res.ratingNumeric !== null && !isNaN(Number(res.ratingNumeric)) ? Number(res.ratingNumeric) : null;
    }
    return scale.scored ? scoreForLabel(scale, res.ratingLabel) : null;
  }

  static async saveDraft(
    id: string,
    payload: {
      responses?: Array<{
        criterionId: string;
        criterionName?: string;
        criterionDescription?: string;
        criterionWeight?: number;
        ratingNumeric?: number;
        ratingLabel?: string;
        comment?: string;
      }>;
      evaluatorSummary?: string;
      developmentRecommendations?: string;
    },
    requestingUser: Actor
  ) {
    const assignment = await prisma.evaluationAssignment.findUnique({
      where: { id },
      include: {
        template: { include: { criteria: true } },
        cycle: { select: { status: true } },
        employee: { select: { immediateSupervisorId: true } },
      },
    });

    if (!assignment || assignment.deletedAt) {
      throw new AppError('Evaluation assignment not found', 404);
    }
    this.assertCanRate(assignment, requestingUser);
    if (assignment.cycle.status !== EvaluationCycleStatus.ACTIVE) throw new AppError('The evaluation cycle is closed.', 400);

    const scale = ratingScaleOf((assignment.templateSnapshot as any) ?? assignment.template);
    const responses = (payload.responses || []).map((r) => ({ ...r, ratingNumeric: this.recordedRating(scale, r) }));

    await prisma.$transaction(async (tx) => {
      for (const res of responses) {
        if (!res.criterionId) continue;
        await tx.evaluationResponse.upsert({
          where: {
            assignmentId_criterionId: {
              assignmentId: id,
              criterionId: res.criterionId,
            },
          },
          create: {
            assignmentId: id,
            criterionId: res.criterionId,
            criterionName: res.criterionName || 'Criterion',
            criterionDescription: res.criterionDescription || null,
            criterionWeight: res.criterionWeight !== undefined ? Number(res.criterionWeight) : null,
            ratingNumeric: res.ratingNumeric,
            ratingLabel: res.ratingLabel || null,
            comment: res.comment || null,
          },
          update: {
            criterionName: res.criterionName !== undefined ? res.criterionName : undefined,
            criterionDescription: res.criterionDescription !== undefined ? res.criterionDescription : undefined,
            criterionWeight: res.criterionWeight !== undefined ? Number(res.criterionWeight) : undefined,
            ratingNumeric: res.ratingNumeric,
            ratingLabel: res.ratingLabel !== undefined ? res.ratingLabel : undefined,
            comment: res.comment !== undefined ? res.comment : undefined,
          },
        });
      }

      // Saving a draft of a submitted rating reopens it (IN_PROGRESS) so it can
      // be amended and submitted again — never once finalised or discussed.
      await tx.evaluationAssignment.update({
        where: { id },
        data: {
          status: EvaluationAssignmentStatus.IN_PROGRESS,
          startedAt: assignment.startedAt || new Date(),
          evaluatorSummary: payload.evaluatorSummary !== undefined ? payload.evaluatorSummary : assignment.evaluatorSummary,
          developmentRecommendations: payload.developmentRecommendations !== undefined ? payload.developmentRecommendations : assignment.developmentRecommendations,
        },
      });
    });

    await createAuditLog({
      actorUserId: requestingUser.id,
      targetEmployeeId: assignment.employeeId,
      action: 'EVALUATION_DRAFT_SAVED',
      entityType: 'EvaluationAssignment',
      entityId: id,
      metadata: { raterType: assignment.raterType },
    });

    return this.getAssignment(id, requestingUser);
  }

  static async submitEvaluation(
    id: string,
    payload: {
      responses: Array<{
        criterionId: string;
        criterionName?: string;
        criterionDescription?: string;
        criterionWeight?: number;
        ratingNumeric?: number;
        ratingLabel?: string;
        comment?: string;
      }>;
      evaluatorSummary?: string;
      developmentRecommendations?: string;
    },
    requestingUser: Actor
  ) {
    const assignment = await prisma.evaluationAssignment.findUnique({
      where: { id },
      include: {
        template: {
          include: { groups: { orderBy: { displayOrder: 'asc' } }, criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
        },
        cycle: { select: { status: true } },
        employee: { select: { immediateSupervisorId: true } },
      },
    });

    if (!assignment || assignment.deletedAt) {
      throw new AppError('Evaluation assignment not found', 404);
    }
    this.assertCanRate(assignment, requestingUser);
    if (assignment.cycle.status !== EvaluationCycleStatus.ACTIVE) throw new AppError('The evaluation cycle is closed.', 400);
    if (!Array.isArray(payload?.responses)) throw new AppError('Ratings are required.', 400);

    // Retrieve criteria from template or templateSnapshot
    const snapshot: any = assignment.templateSnapshot;
    const criteriaList: Array<any> = snapshot?.criteria || assignment.template.criteria;
    const ratingMethod: EvaluationRatingMethod = snapshot?.ratingMethod || assignment.template.ratingMethod;
    const minScore = snapshot?.minScore ?? assignment.template.minScore ?? 1;
    const maxScore = snapshot?.maxScore ?? assignment.template.maxScore ?? 5;
    // A labelled numeric scale (e.g. 1 — Unsatisfactory … 5 — Excellent) accepts only its own scores.
    const scaleOptions: Array<{ score: number; label: string }> = (snapshot?.scoreLabels ?? (assignment.template as any).scoreLabels)?.options
      ?.filter((o: any) => o?.score !== undefined && o?.score !== null)
      .map((o: any) => ({ score: Number(o.score), label: String(o.label ?? '') })) ?? [];
    const labelFor = (n: any) => (n === undefined || n === null ? null : scaleOptions.find((o) => o.score === Number(n))?.label ?? null);
    const scale = ratingScaleOf(snapshot ?? assignment.template);

    const responseMap = new Map<string, any>();
    payload.responses.forEach((r) => responseMap.set(r.criterionId, { ...r, ratingNumeric: this.recordedRating(scale, r) }));

    // Validation
    for (const crit of criteriaList) {
      const res = responseMap.get(crit.id);
      if (crit.isRatingRequired) {
        if (!res) {
          throw new AppError(`Rating is required for criterion: "${crit.name}"`, 400);
        }
        if (ratingMethod === EvaluationRatingMethod.NUMERIC) {
          if (res.ratingNumeric === undefined || res.ratingNumeric === null || isNaN(Number(res.ratingNumeric))) {
            throw new AppError(`A valid score between ${minScore} and ${maxScore} is required for "${crit.name}"`, 400);
          }
          const num = Number(res.ratingNumeric);
          if (num < minScore || num > maxScore) {
            throw new AppError(`Score for "${crit.name}" must be between ${minScore} and ${maxScore}`, 400);
          }
          if (scaleOptions.length && !scaleOptions.some((o) => o.score === num)) {
            throw new AppError(`Choose one of the rating options for "${crit.name}".`, 400);
          }
        } else {
          // LABELED / Descriptive
          if (!res.ratingLabel?.trim() && !res.comment?.trim()) {
            throw new AppError(`A rating label or assessment is required for "${crit.name}"`, 400);
          }
          // A scored label scale: the label must be one of the form's own.
          if (scale.scored && res.ratingLabel?.trim() && res.ratingNumeric === null) {
            throw new AppError(`Choose one of the rating options for "${crit.name}".`, 400);
          }
        }
      }

      if (crit.isCommentRequired && !res?.comment?.trim()) {
        throw new AppError(`A comment is required for criterion: "${crit.name}"`, 400);
      }
    }

    // Score calculation — the shared function that also explains the score later.
    // Each rater's score stays on their own assignment; nothing is merged.
    const overallScore: number | null = this.breakdownOf({
      templateSnapshot: snapshot,
      template: assignment.template,
      responses: [...responseMap.values()].map((r) => ({ criterionId: r.criterionId, ratingNumeric: r.ratingNumeric })),
    }).overallScore;

    const submitted = await prisma.$transaction(async (tx) => {
      // Claim the transition FIRST, with the status precondition inside the
      // write, so a double-click or a retried request submits exactly once.
      // Amending a submitted rating works by saving a draft first (which moves
      // it back to IN_PROGRESS, a legal source state again).
      const claimed = await tx.evaluationAssignment.updateMany({
        where: {
          id,
          status: {
            in: [
              EvaluationAssignmentStatus.NOT_STARTED,
              EvaluationAssignmentStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          status: EvaluationAssignmentStatus.SUBMITTED,
          submittedAt: new Date(),
          overallScore,
          evaluatorSummary: payload.evaluatorSummary?.trim() || null,
          developmentRecommendations: payload.developmentRecommendations?.trim() || null,
        },
      });
      if (claimed.count !== 1) return false;

      for (const crit of criteriaList) {
        const res = responseMap.get(crit.id) || {};
        await tx.evaluationResponse.upsert({
          where: {
            assignmentId_criterionId: {
              assignmentId: id,
              criterionId: crit.id,
            },
          },
          create: {
            assignmentId: id,
            criterionId: crit.id,
            criterionName: crit.name,
            criterionDescription: crit.description || null,
            criterionWeight: crit.weight !== undefined ? Number(crit.weight) : null,
            ratingNumeric: res.ratingNumeric ?? null,
            ratingLabel: res.ratingLabel || labelFor(res.ratingNumeric),
            comment: res.comment || null,
          },
          update: {
            criterionName: crit.name,
            criterionDescription: crit.description || null,
            criterionWeight: crit.weight !== undefined ? Number(crit.weight) : null,
            ratingNumeric: res.ratingNumeric ?? null,
            ratingLabel: res.ratingLabel || labelFor(res.ratingNumeric),
            comment: res.comment || null,
          },
        });
      }

      return true;
    });

    if (!submitted) {
      throw new AppError(
        'This evaluation has already been submitted or finalised. Refresh to see its current state.',
        409
      );
    }

    await createAuditLog({
      actorUserId: requestingUser.id,
      targetEmployeeId: assignment.employeeId,
      action: 'EVALUATION_SUBMITTED',
      entityType: 'EvaluationAssignment',
      entityId: id,
      metadata: { overallScore, raterType: assignment.raterType },
    });

    return this.getAssignment(id, requestingUser);
  }

  /**
   * The head / supervisor / coordinator records the discussion with the
   * employee, after submitting their evaluation. Required before HR finalises.
   */
  static async recordDiscussion(
    id: string,
    payload: { discussionDate?: string; notes?: string },
    requestingUser: Actor
  ) {
    const a = await prisma.evaluationAssignment.findUnique({
      where: { id },
      include: { cycle: { select: { status: true } }, employee: { select: { immediateSupervisorId: true } } },
    });
    if (!a || a.deletedAt) throw new AppError('Evaluation assignment not found', 404);
    if (a.raterType !== EvaluationRaterType.HEAD) throw new AppError('The discussion belongs to the head / supervisor / coordinator evaluation.', 400);
    if (!requestingUser.employeeId || a.evaluatorId !== requestingUser.employeeId) {
      throw new AppError('Only the assigned head / supervisor / coordinator evaluator can record the discussion.', 403);
    }
    const barred = rateDenial({ ...a, status: EvaluationAssignmentStatus.NOT_STARTED, discussionCompletedAt: null, subjectSupervisorId: a.employee.immediateSupervisorId }, requestingUser);
    if (barred) throw new AppError(barred.message, barred.status);
    if (a.status !== EvaluationAssignmentStatus.SUBMITTED) {
      throw new AppError('Submit your evaluation before recording the discussion with the employee.', 400);
    }
    if (a.discussionCompletedAt) throw new AppError('The discussion has already been recorded.', 409);

    const date = payload?.discussionDate ? new Date(`${String(payload.discussionDate).slice(0, 10)}T00:00:00.000Z`) : null;
    if (!date || isNaN(date.getTime())) throw new AppError('Enter the date the discussion took place.', 400);
    if (date.getTime() > Date.now()) throw new AppError('The discussion date cannot be in the future.', 400);
    const notes = String(payload?.notes ?? '').trim();
    if (!notes) throw new AppError('Enter notes from the discussion.', 400);

    const claimed = await prisma.evaluationAssignment.updateMany({
      where: { id, discussionCompletedAt: null, status: EvaluationAssignmentStatus.SUBMITTED },
      data: { discussionCompletedAt: new Date(), discussionDate: date, discussionNotes: notes, discussionRecordedById: requestingUser.employeeId },
    });
    if (claimed.count !== 1) throw new AppError('The discussion has already been recorded. Refresh to see it.', 409);

    await createAuditLog({
      actorUserId: requestingUser.id,
      targetEmployeeId: a.employeeId,
      action: 'EVALUATION_DISCUSSION_COMPLETED',
      entityType: 'EvaluationAssignment',
      entityId: id,
      metadata: { discussionDate: date.toISOString().slice(0, 10) },
    });
    return this.getAssignment(id, requestingUser);
  }

  static async finalizeEvaluation(
    id: string,
    payload: {
      isEmployeeVisible?: boolean;
    },
    requestingUser: Actor
  ) {
    if (requestingUser.permissionTier !== PermissionTier.FULL) {
      throw new AppError('Only HR Personnel (FULL tier) can finalize evaluations', 403);
    }

    const assignment = await prisma.evaluationAssignment.findUnique({
      where: { id },
      include: { cycle: { select: { id: true, evaluationMode: true, selfWeight: true, peerWeight: true, headWeight: true } } },
    });

    if (!assignment || assignment.deletedAt) {
      throw new AppError('Evaluation assignment not found', 404);
    }
    if (assignment.raterType !== EvaluationRaterType.HEAD) {
      throw new AppError("An employee's evaluation is finalised from the head / supervisor / coordinator evaluation.", 400);
    }

    if (assignment.status !== EvaluationAssignmentStatus.SUBMITTED && assignment.status !== EvaluationAssignmentStatus.FINALIZED) {
      throw new AppError('Evaluation must be submitted before it can be finalized', 400);
    }

    const siblings = await prisma.evaluationAssignment.findMany({
      where: { cycleId: assignment.cycleId, employeeId: assignment.employeeId, deletedAt: null },
    });
    // Not an evaluation the HR user is part of (their own, or one they rated).
    const conflict = finalizeDenial(siblings, requestingUser);
    if (conflict) throw new AppError(conflict, 403);

    // Every component must be complete. Standard: the head's evaluation and the
    // discussion. Weighted: also the self rating and the selected peers.
    if (assignment.status === EvaluationAssignmentStatus.SUBMITTED) {
      const progress = subjectProgress(siblings, this.progressOptions(assignment.cycle));
      if (progress.blockers.length) {
        throw new AppError(`This evaluation cannot be finalised yet: ${progress.blockers.join('; ')}.`, 400);
      }
    }

    // Weighted multi-rater cycles: the final self + peer + head rating is
    // computed here (server-side, fixed arithmetic) and frozen with its
    // breakdown. A missing component is never re-weighted away.
    let combined: Awaited<ReturnType<typeof EvaluationService.combinedResultFor>> | null = null;
    if (assignment.cycle.evaluationMode === EvaluationMode.WEIGHTED_MULTI_RATER && assignment.status === EvaluationAssignmentStatus.SUBMITTED) {
      const weightsIssue = sourceWeightsProblem(this.sourceWeightsOf(assignment.cycle));
      if (weightsIssue) throw new AppError(`This cycle's percentages cannot be used: ${weightsIssue}`, 400);
      combined = await this.combinedResultFor(assignment.cycle, assignment.employeeId);
      if (combined.final === null) {
        throw new AppError(`The final weighted rating cannot be calculated yet: ${combined.missing.join('; ')}.`, 400);
      }
    }

    const now = new Date();
    const visible = payload.isEmployeeVisible !== undefined ? Boolean(payload.isEmployeeVisible) : true;
    const claimed = await prisma.$transaction(async (tx) => {
      // Atomic claim: the "already finalised" guard lives in the WHERE clause, so a
      // repeated request finalises nothing a second time and raises no duplicate
      // audit entry.
      const c = await tx.evaluationAssignment.updateMany({
        where: { id, status: { not: EvaluationAssignmentStatus.FINALIZED } },
        data: {
          status: EvaluationAssignmentStatus.FINALIZED,
          finalizedAt: now,
          finalizedById: requestingUser.employeeId || requestingUser.id,
          isEmployeeVisible: visible,
          // HR finalises the ratings as given — it never enters a rating of its own.
          ...(combined ? { combinedScore: combined.final, combinedBreakdown: combined as any } : {}),
        },
      });
      if (c.count !== 1) return false;
      // The self and peer ratings (weighted cycles) are closed with it. Peer
      // ratings are never shown to the employee; the self rating follows HR's
      // visibility choice.
      await tx.evaluationAssignment.updateMany({
        where: { cycleId: assignment.cycleId, employeeId: assignment.employeeId, deletedAt: null, raterType: EvaluationRaterType.SELF, NOT: { id } },
        data: { status: EvaluationAssignmentStatus.FINALIZED, finalizedAt: now, finalizedById: requestingUser.employeeId || requestingUser.id, isEmployeeVisible: visible },
      });
      await tx.evaluationAssignment.updateMany({
        where: { cycleId: assignment.cycleId, employeeId: assignment.employeeId, deletedAt: null, raterType: EvaluationRaterType.PEER },
        data: { status: EvaluationAssignmentStatus.FINALIZED, finalizedAt: now, finalizedById: requestingUser.employeeId || requestingUser.id, isEmployeeVisible: false },
      });
      return true;
    });

    if (!claimed) {
      throw new AppError(
        'This evaluation has already been finalised. Refresh to see its current state.',
        409
      );
    }

    const updated = await prisma.evaluationAssignment.findUniqueOrThrow({ where: { id } });

    await createAuditLog({
      actorUserId: requestingUser.id,
      targetEmployeeId: assignment.employeeId,
      action: 'EVALUATION_FINALIZED',
      entityType: 'EvaluationAssignment',
      entityId: id,
      metadata: { overallRating: updated.overallRating, isEmployeeVisible: updated.isEmployeeVisible, combinedScore: updated.combinedScore },
    });

    return this.getAssignment(id, requestingUser);
  }

  static async listEmployeeEvaluationHistory(
    employeeId: string,
    requestingUser: { id: string; employeeId?: string; permissionTier: PermissionTier }
  ) {
    const isHr = requestingUser.permissionTier === PermissionTier.FULL;
    const isOwner = requestingUser.employeeId === employeeId;

    if (!isHr && !isOwner) {
      throw new AppError('Access forbidden: Cannot view another employee evaluation history', 403);
    }

    const where: any = {
      employeeId,
      deletedAt: null,
    };

    if (!isHr) {
      // The employee's record is the finalised head evaluation HR made visible.
      where.isEmployeeVisible = true;
      where.status = EvaluationAssignmentStatus.FINALIZED;
      where.raterType = EvaluationRaterType.HEAD;
    }

    return prisma.evaluationAssignment.findMany({
      where,
      include: {
        cycle: { select: { id: true, name: true, startDate: true, dueDate: true, status: true } },
        template: { select: { id: true, name: true, ratingMethod: true } },
        evaluator: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { title: true } } },
        },
        responses: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
