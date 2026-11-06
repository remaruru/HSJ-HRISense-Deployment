import { EmploymentStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * Job openings prepared by AI Assistance — the one thing the assistant helps
 * HR CREATE, and the reason it stays safe:
 *
 *   1. The model calls `prepare_job_opening`. The tool validates every field
 *      (the role and unit exist and belong together, the dates make sense) and
 *      keeps the result in this request's `DraftStore` under an id (`job1`).
 *      Nothing is written to the database.
 *   2. The model attaches the draft to its answer by id in `submit_answer`. The
 *      server copies the VALIDATED draft into the stored chat message, so the
 *      model cannot attach text the tool did not check.
 *   3. The browser shows HR the full breakdown with a Publish button. Only HR's
 *      click publishes it (POST …/publish-job-opening), through the same
 *      JobOpeningService and recruitment permission as the Job Openings form,
 *      using the draft as stored — not anything the browser sends.
 */

export const jobOpeningDraftSchema = z
  .object({
    title: z.string().min(2).max(120),
    jobRoleId: z.string().uuid(),
    jobRoleTitle: z.string().max(160),
    unitId: z.string().uuid(),
    unitName: z.string().max(160),
    departmentId: z.string().uuid().nullable(),
    departmentName: z.string().max(160).nullable(),
    employmentType: z.nativeEnum(EmploymentStatus),
    vacancies: z.number().int().min(1).max(50),
    description: z.string().min(10).max(4000),
    responsibilities: z.string().min(10).max(4000),
    qualifications: z.string().min(10).max(4000),
    requiredDocuments: z.string().max(2000).nullable(),
    openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type JobOpeningDraft = z.infer<typeof jobOpeningDraftSchema>;

/** The action stored on an assistant message, shown as a card in the chat. */
export const messageActionSchema = z.object({
  kind: z.literal('JOB_OPENING'),
  /** DRAFT = only in the chat; SAVED = saved as a draft opening (an HR Officer still publishes it); PUBLISHED = live on the Careers page. */
  state: z.enum(['DRAFT', 'SAVED', 'PUBLISHED']),
  draft: jobOpeningDraftSchema,
  published: z
    .object({
      openingId: z.string().uuid(),
      referenceNumber: z.string(),
      slug: z.string(),
      publishedAt: z.string(),
    })
    .optional(),
});
export type MessageAction = z.infer<typeof messageActionSchema>;

/** Drafts prepared during ONE request; ids are only valid inside it. */
export class DraftStore {
  private readonly drafts = new Map<string, JobOpeningDraft>();
  private counter = 0;

  add(draft: JobOpeningDraft): string {
    this.counter += 1;
    const id = `job${this.counter}`;
    this.drafts.set(id, jobOpeningDraftSchema.parse(draft));
    return id;
  }

  get(id: string): JobOpeningDraft | undefined {
    return this.drafts.get(id);
  }
}
