import { EmploymentStatus, JobApplicationStatus, JobOpeningStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../config/prisma';
import { describeDataset } from '../charts/chart-schema';
import { addDaysKey, dateKey, fullName, humanise, truncate } from './tool-helpers';
import { AiTool, AiToolError, dateArg, defineTool, HR_ONLY, ToolContext } from './tool-types';

/**
 * Recruitment help for HR.
 *
 *   prepare_job_opening  turns HR's request ("we need 2 Clinic Staff") into a
 *                        complete, validated job opening DRAFT for HR to review.
 *                        It saves nothing: HR publishes it with the Publish
 *                        button on the card (see actions/job-opening-draft.ts).
 *   compare_applicants   lays an opening's applicants side by side against what
 *                        the opening asks for — reported experience, documents
 *                        submitted, stage, interviews. It never ranks, scores or
 *                        recommends anyone, and never reads résumé contents or
 *                        interview notes: HR picks.
 */

const MAX_TEXT = 4000;

const prepareArgs = z
  .object({
    jobRoleId: z.string().uuid().optional().describe('The role id from get_org_catalog (preferred).'),
    jobRoleTitle: z.string().min(2).max(120).optional().describe('The exact role title, when you do not have the id.'),
    unitId: z.string().uuid().optional().describe('Only for an organisation-wide role that has no unit of its own.'),
    title: z.string().min(2).max(120).optional().describe('The title shown on the Careers page. Default: the role title.'),
    employmentType: z.nativeEnum(EmploymentStatus).optional().describe('Default REGULAR.'),
    vacancies: z.number().int().min(1).max(50).optional().describe('Default 1.'),
    description: z.string().min(10).max(MAX_TEXT).describe('2–4 sentences about the position at Hospicio de San Jose (a charitable care institution in Manila) and the unit.'),
    responsibilities: z.string().min(10).max(MAX_TEXT).describe('The main duties as "- " lines.'),
    qualifications: z.string().min(10).max(MAX_TEXT).describe('Education, licence, experience and skills as "- " lines; include any experience HR asked for, e.g. "At least 10 years of related experience".'),
    requiredDocuments: z.string().max(2000).optional().describe('Documents applicants submit, as "- " lines (e.g. résumé, PRC licence, NBI clearance).'),
    openingDate: dateArg.optional().describe('Default today.'),
    closingDate: dateArg.optional().describe('Default 30 days after the opening date.'),
  })
  .strict();
type PrepareArgs = z.infer<typeof prepareArgs>;

const prepareTool = defineTool({
  name: 'prepare_job_opening',
  description:
    "HR only. Prepares a complete job opening for HR to review — title, role, unit, employment type, vacancies, description, responsibilities, qualifications, required documents and dates — from what HR asked for. You write the description, responsibilities and qualifications yourself (clear, realistic, suited to Hospicio de San Jose; include what HR specified). Nothing is saved: the result is a DRAFT that you attach to your answer with jobOpeningDraftId in submit_answer, and HR publishes it with the Publish button on the card. Ask HR first only if the role is unclear; otherwise use sensible defaults and say which ones you assumed.",
  tiers: HR_ONLY,
  args: prepareArgs,
  async run(ctx: ToolContext, args: PrepareArgs) {
    if (!args.jobRoleId && !args.jobRoleTitle) {
      throw new AiToolError('INVALID_ARGS', 'Say which job role the opening is for: pass jobRoleId from get_org_catalog (or the exact jobRoleTitle).');
    }
    let role = args.jobRoleId
      ? await prisma.jobRole.findFirst({ where: { id: args.jobRoleId, isActive: true }, include: { unit: true, department: true } })
      : null;
    if (!role && args.jobRoleTitle) {
      const matches = await prisma.jobRole.findMany({ where: { isActive: true, title: { contains: args.jobRoleTitle } }, include: { unit: true, department: true }, take: 5 });
      const exact = matches.filter((r) => r.title.toLowerCase() === args.jobRoleTitle!.toLowerCase());
      if (exact.length === 1) role = exact[0];
      else if (matches.length === 1) role = matches[0];
      else if (matches.length > 1) {
        throw new AiToolError('INVALID_ARGS', `"${args.jobRoleTitle}" matches several roles: ${matches.map((m) => m.title).join(', ')}. Ask HR which one, or pass the jobRoleId.`);
      }
    }
    if (!role) throw new AiToolError('NOT_FOUND', 'No active job role matches. Call get_org_catalog and use one of its role ids; if Hospicio has no such role, tell HR it must first be added under Job Roles.');

    let unit = role.unit;
    if (!unit) {
      if (!args.unitId) throw new AiToolError('INVALID_ARGS', `${role.title} is an organisation-wide role; ask HR which unit the opening is for and pass unitId.`);
      unit = await prisma.unit.findUnique({ where: { id: args.unitId } });
      if (!unit) throw new AiToolError('NOT_FOUND', 'That unit does not exist. Use a unit id from get_org_catalog.');
    }
    const department = role.department ?? (unit.departmentId ? await prisma.department.findUnique({ where: { id: unit.departmentId } }) : null);

    const assumed: string[] = [];
    const openingDate = args.openingDate ?? ctx.today;
    if (!args.openingDate) assumed.push(`opens today (${openingDate})`);
    if (openingDate < ctx.today) throw new AiToolError('INVALID_ARGS', 'The opening date cannot be in the past.');
    const closingDate = args.closingDate ?? addDaysKey(openingDate, 30);
    if (!args.closingDate) assumed.push(`closes 30 days later (${closingDate})`);
    if (closingDate < openingDate) throw new AiToolError('INVALID_ARGS', 'The closing date must be on or after the opening date.');
    if (!args.employmentType) assumed.push('employment type Regular');
    if (!args.vacancies) assumed.push('1 vacancy');
    if (!args.requiredDocuments) assumed.push('no required documents listed');

    const draft = {
      title: (args.title ?? role.title).trim(),
      jobRoleId: role.id,
      jobRoleTitle: role.title,
      unitId: unit.id,
      unitName: unit.name,
      departmentId: department?.id ?? null,
      departmentName: department?.name ?? null,
      employmentType: args.employmentType ?? EmploymentStatus.REGULAR,
      vacancies: args.vacancies ?? 1,
      description: args.description.trim(),
      responsibilities: args.responsibilities.trim(),
      qualifications: args.qualifications.trim(),
      requiredDocuments: args.requiredDocuments?.trim() || null,
      openingDate,
      closingDate,
    };
    const draftId = ctx.drafts.add(draft);
    const existing = await prisma.jobOpening.count({ where: { jobRoleId: role.id, status: JobOpeningStatus.OPEN } });
    return {
      data: {
        draftId,
        breakdown: { ...draft, employmentType: humanise(draft.employmentType), jobRoleId: undefined, unitId: undefined, departmentId: undefined },
        assumed: assumed.length ? assumed : undefined,
        alreadyOpenForThisRole: existing || undefined,
        note: 'Nothing is saved yet. Attach it with jobOpeningDraftId: HR then sees a card under your answer with EVERY field and the Publish button. So keep your text short — one or two sentences: what you prepared (title, vacancies, closing date), which values you assumed, and that HR reviews the card and presses Publish (or "Edit in the form first"). Do not repeat the description, responsibilities or qualifications, and never mention the draft id. Never say it is published. For changes, call prepare_job_opening again with them.' +
          (existing ? ` Mention that ${existing} opening(s) for this role are already open.` : ''),
      },
      rows: 1,
    };
  },
});

const compareArgs = z
  .object({
    openingId: z.string().uuid().optional().describe('The job opening id. Omit to list the openings first.'),
    openingText: z.string().min(2).max(80).optional().describe('Part of the opening title or its reference number (JO-…).'),
    status: z.nativeEnum(JobApplicationStatus).optional().describe('Only applications in this status.'),
  })
  .strict();
type CompareArgs = z.infer<typeof compareArgs>;

const compareTool = defineTool({
  name: 'compare_applicants',
  description:
    "HR only. Lists a job opening's applicants side by side against what the opening asks for: the experience each applicant REPORTED on the Careers form, the documents they submitted, their stage in the process, interviews and dates, with a link to each application. Without an opening, lists the openings (with applicant counts) so you can ask HR which one. Present it as a comparison table and let HR choose: never rank, score or recommend an applicant, never call one the best, and never describe résumé contents or interview notes (they are not provided).",
  tiers: HR_ONLY,
  args: compareArgs,
  async run(ctx: ToolContext, args: CompareArgs) {
    let opening = args.openingId ? await prisma.jobOpening.findUnique({ where: { id: args.openingId }, include: { jobRole: true, unit: true } }) : null;
    if (!opening && args.openingText) {
      const found = await prisma.jobOpening.findMany({
        where: { OR: [{ title: { contains: args.openingText } }, { referenceNumber: { contains: args.openingText } }] },
        include: { jobRole: true, unit: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });
      if (found.length === 1) opening = found[0];
      else if (found.length > 1 && found.filter((o) => o.status === JobOpeningStatus.OPEN).length === 1) opening = found.find((o) => o.status === JobOpeningStatus.OPEN)!;
    }
    if (!opening) {
      const openings = await prisma.jobOpening.findMany({
        where: { status: { in: [JobOpeningStatus.OPEN, JobOpeningStatus.DRAFT, JobOpeningStatus.CLOSED] } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 20,
        select: { id: true, title: true, referenceNumber: true, status: true, closingDate: true, _count: { select: { applications: true } } },
      });
      return {
        data: {
          openings: openings.map((o) => ({
            openingId: o.id,
            title: o.title,
            reference: o.referenceNumber,
            status: humanise(o.status),
            closes: dateKey(o.closingDate),
            applicants: o._count.applications,
            link: `/recruitment/openings/${o.id}`,
          })),
          note: args.openingText
            ? `No single opening matched "${args.openingText}". Show these and ask HR which one.`
            : 'Ask HR which opening to compare, or pick the one they named.',
        },
        rows: openings.length,
      };
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobOpeningId: opening.id, ...(args.status ? { status: args.status } : {}) },
      orderBy: { applicationDate: 'asc' },
      take: 60,
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        applicationDate: true,
        priorExperienceYears: true,
        applicant: { select: { firstName: true, lastName: true } },
        documents: { select: { documentType: true } },
        interviews: { select: { status: true, scheduledAt: true, interviewType: true }, orderBy: { scheduledAt: 'desc' } },
      },
    });

    const rows = applications.map((a) => {
      const docs = a.documents.reduce<Record<string, number>>((acc, d) => ((acc[humanise(d.documentType)] = (acc[humanise(d.documentType)] ?? 0) + 1), acc), {});
      const latest = a.interviews[0];
      return {
        applicationId: a.id,
        reference: a.referenceNumber,
        applicant: fullName(a.applicant),
        stage: humanise(a.status),
        appliedOn: dateKey(a.applicationDate),
        reportedExperienceYears: a.priorExperienceYears ?? null,
        documentsSubmitted: Object.keys(docs).length ? docs : 'none',
        interviews: a.interviews.length
          ? { count: a.interviews.length, latest: `${humanise(latest.interviewType)} interview, ${humanise(latest.status).toLowerCase()} (${dateKey(latest.scheduledAt)})` }
          : 'none yet',
        link: `/recruitment/applicants/${a.id}`,
      };
    });

    const withExperience = rows.filter((r) => typeof r.reportedExperienceYears === 'number');
    const datasetId =
      withExperience.length >= 2
        ? ctx.datasets.add({
            title: `Reported experience — ${opening.title}`,
            xKey: 'applicant',
            xLabel: 'Applicant',
            xType: 'category',
            unit: 'years',
            series: [{ key: 'years', label: 'Years of experience (as reported)' }],
            rows: withExperience.map((r) => ({ applicant: r.applicant ?? r.reference, years: r.reportedExperienceYears as number })),
          })
        : null;

    return {
      data: {
        opening: {
          openingId: opening.id,
          title: opening.title,
          reference: opening.referenceNumber,
          role: opening.jobRole?.title ?? null,
          unit: opening.unit?.name ?? null,
          status: humanise(opening.status),
          vacancies: opening.vacancies,
          opens: dateKey(opening.openingDate),
          closes: dateKey(opening.closingDate),
          qualifications: truncate(opening.qualifications, 1500),
          requiredDocuments: truncate(opening.requiredDocuments, 800),
          link: `/recruitment/openings/${opening.id}`,
        },
        applicants: rows,
        chart: describeDataset(ctx.datasets, datasetId) ?? undefined,
        note:
          'Compare each applicant with the opening factually (reported experience against what the qualifications ask, documents submitted against the required documents, stage). reportedExperienceYears is what the applicant typed on the Careers form (null = not given) and is not verified. Do not rank, score or recommend anyone; end by leaving the choice to HR and linking the applications.',
      },
      rows: rows.length,
    };
  },
});

export const RECRUITMENT_TOOLS: AiTool[] = [prepareTool, compareTool];
