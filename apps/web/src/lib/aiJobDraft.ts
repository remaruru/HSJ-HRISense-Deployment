/**
 * Hand-off from AI Assistance to the Job Openings form: "Edit in the form first"
 * on a job opening the assistant prepared puts its fields here, and the form
 * starts from them once (then the key is removed). Nothing is saved until HR
 * saves or publishes the form as usual.
 */
export const AI_JOB_DRAFT_KEY = 'hrisense.ai.jobOpeningDraft';

export interface AiJobDraft {
  title: string;
  jobRoleId: string;
  unitId: string;
  departmentId: string | null;
  employmentType: string;
  vacancies: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredDocuments: string | null;
  openingDate: string;
  closingDate: string;
}

/** Reads and clears the hand-off, or null. */
export function takeAiJobDraft(): AiJobDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_JOB_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(AI_JOB_DRAFT_KEY);
    const d = JSON.parse(raw);
    return d && typeof d.title === 'string' && typeof d.jobRoleId === 'string' ? (d as AiJobDraft) : null;
  } catch {
    return null;
  }
}
