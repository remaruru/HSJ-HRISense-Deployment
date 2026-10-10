/**
 * Installs Hospicio de San Jose's five official evaluation templates
 * (src/data/official-evaluation-forms.ts, extracted from the Word forms HR
 * supplied) and maps them to the job roles that clearly belong to each form.
 *
 *   npx tsx src/scripts/seed_official_evaluation_templates.ts            # install / check
 *   npx tsx src/scripts/seed_official_evaluation_templates.ts --refresh  # rebuild an UNUSED official template from the data file
 *
 * Safe to run more than once:
 *   • an official template that already exists is compared with the form; it is
 *     rebuilt only with --refresh, and never while assignments use it (each
 *     assignment keeps its own frozen copy anyway);
 *   • a job role that already uses another template is left alone and reported;
 *   • nothing else is touched — custom templates, cycles and results stay as they are.
 *
 * Job-role mappings are only made where the role clearly is the group Hospicio
 * named. Deliberately NOT mapped (HR decides, from the template's Job roles):
 *   • Eval Form 2 (Houseparents): no job role is named houseparent / caregiver;
 *   • Eval Form 3 "Information": no management-information role exists, and
 *     "Office Staff" beyond the secretaries is HR's call;
 *   • Clinic Staff: listed under Health (Form 3) but configured as the Health
 *     unit's head (isHead) — conflicting, so left to HR;
 *   • HR Officer: configured as a head, but HR asked that HR roles not be
 *     classified automatically; Sister: not a supervisory role.
 * The Simplified form's roles are re-checked against the hierarchy flags
 * (isSupervisor / isHead) so a title alone never decides it.
 */
import 'dotenv/config';
import { EvaluationRatingMethod, EvaluationScoringMethod, Prisma, PrismaClient } from '@prisma/client';
import { OFFICIAL_EVALUATION_FORMS, OFFICIAL_SCALES, type OfficialEvaluationForm } from '../data/official-evaluation-forms';
import { distributeWeights } from '../services/evaluation-weights';

const prisma = new PrismaClient();
const refresh = process.argv.includes('--refresh');

function templateData(form: OfficialEvaluationForm) {
  const weighted = form.scoringMethod === 'AREA_WEIGHTED';
  return {
    name: form.name,
    description: `Hospicio de San Jose official ${form.formCode === 'Simplified' ? 'Employee Performance Evaluation (simplified)' : `Employee Performance Review (${form.formCode})`} for ${form.appliesTo.join(', ')}.`,
    ratingMethod: EvaluationRatingMethod.NUMERIC,
    minScore: 1,
    maxScore: 5,
    scoreLabels: {
      presetId: 'LIKERT_5',
      labelSet: form.scale,
      options: OFFICIAL_SCALES[form.scale].map((o) => ({ value: String(o.score), score: o.score, label: o.label, ...(o.code ? { code: o.code } : {}) })),
    },
    useWeighting: weighted,
    scoringMethod: weighted ? EvaluationScoringMethod.AREA_WEIGHTED : EvaluationScoringMethod.AREA_AVERAGE,
    isOfficial: true,
    officialCode: form.code,
    sourceDocument: form.sourceDocument,
    formLayout: { ...form.layout, appliesTo: form.appliesTo, formCode: form.formCode } as Prisma.InputJsonValue,
    isActive: true,
  };
}

async function writeAreas(tx: Prisma.TransactionClient, templateId: string, form: OfficialEvaluationForm) {
  const weights = form.scoringMethod === 'AREA_WEIGHTED' ? distributeWeights(form.areas.length) : null;
  let order = 1;
  for (const [i, area] of form.areas.entries()) {
    const group = await tx.evaluationCriterionGroup.create({
      data: { templateId, name: area.name, displayOrder: i + 1, weight: weights ? weights[i] : null },
    });
    await tx.evaluationCriterion.createMany({
      data: area.items.map((item) => ({
        templateId, groupId: group.id, name: item, displayOrder: order++, isRatingRequired: true, isCommentRequired: false, weight: null,
      })),
    });
  }
}

/** Differences between a stored official template and the form (empty = identical). */
function differences(form: OfficialEvaluationForm, stored: { groups: Array<{ id: string; name: string }>; criteria: Array<{ name: string; groupId: string | null }> }) {
  const diffs: string[] = [];
  if (stored.groups.length !== form.areas.length) diffs.push(`areas ${stored.groups.length} ≠ ${form.areas.length}`);
  form.areas.forEach((area, i) => {
    const g = stored.groups[i];
    if (!g) return;
    if (g.name !== area.name) diffs.push(`area ${i + 1} name "${g.name}" ≠ "${area.name}"`);
    const items = stored.criteria.filter((c) => c.groupId === g.id).map((c) => c.name);
    if (items.length !== area.items.length) diffs.push(`area ${i + 1} has ${items.length} statements, form has ${area.items.length}`);
    area.items.forEach((t, j) => {
      if (items[j] !== undefined && items[j] !== t) diffs.push(`area ${i + 1} statement ${String.fromCharCode(97 + j)} differs`);
    });
  });
  return diffs;
}

async function main() {
  const report: string[] = [];

  for (const form of OFFICIAL_EVALUATION_FORMS) {
    const existing = await prisma.evaluationTemplate.findUnique({
      where: { officialCode: form.code },
      include: {
        groups: { orderBy: { displayOrder: 'asc' } },
        criteria: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { assignments: true } },
      },
    });

    let templateId: string;
    if (!existing) {
      const created = await prisma.$transaction(async (tx) => {
        const t = await tx.evaluationTemplate.create({ data: templateData(form) });
        await writeAreas(tx, t.id, form);
        return t;
      });
      await prisma.auditLog.create({
        data: {
          action: 'EVALUATION_OFFICIAL_TEMPLATE_INSTALLED', entityType: 'EvaluationTemplate', entityId: created.id,
          metadata: { name: form.name, officialCode: form.code, sourceDocument: form.sourceDocument, areas: form.areas.length, statements: form.areas.reduce((n, a) => n + a.items.length, 0) },
        },
      });
      templateId = created.id;
      report.push(`CREATED  ${form.name}: ${form.areas.length} areas, ${form.areas.reduce((n, a) => n + a.items.length, 0)} statements`);
    } else {
      templateId = existing.id;
      const diffs = differences(form, existing);
      if (!diffs.length) {
        report.push(`OK       ${form.name}: matches the form`);
      } else if (refresh && existing._count.assignments === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.evaluationCriterion.deleteMany({ where: { templateId } });
          await tx.evaluationCriterionGroup.deleteMany({ where: { templateId } });
          await tx.evaluationTemplate.update({ where: { id: templateId }, data: templateData(form) });
          await writeAreas(tx, templateId, form);
        });
        report.push(`REBUILT  ${form.name} (${diffs.length} difference(s) fixed)`);
      } else {
        report.push(`DIFFERS  ${form.name}: ${diffs.slice(0, 5).join('; ')}${refresh ? ' — in use, left unchanged' : ' — run with --refresh to rebuild (only if unused)'}`);
      }
    }

    // Job-role mappings (configuration — HR can change them in the app).
    for (const code of form.roleCodes) {
      const role = await prisma.jobRole.findUnique({
        where: { code },
        select: { id: true, title: true, isHead: true, isSupervisor: true, evaluationTemplate: { include: { template: { select: { name: true, deletedAt: true } } } } },
      });
      if (!role) {
        report.push(`   skip ${code}: no such job role`);
        continue;
      }
      if (form.code === 'HSJ_SIMPLIFIED_SUPERVISORY' && !role.isHead && !role.isSupervisor) {
        report.push(`   skip ${role.title}: not configured as a supervisor or head`);
        continue;
      }
      const current = role.evaluationTemplate;
      if (current && current.templateId === templateId) {
        report.push(`   kept ${role.title} → ${form.name}`);
        continue;
      }
      if (current && !current.template.deletedAt) {
        report.push(`   skip ${role.title}: already uses "${current.template.name}"`);
        continue;
      }
      if (current) await prisma.evaluationTemplateJobRole.delete({ where: { id: current.id } });
      await prisma.evaluationTemplateJobRole.create({ data: { templateId, jobRoleId: role.id } });
      report.push(`   map  ${role.title} → ${form.name}`);
    }
  }

  console.log(report.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
