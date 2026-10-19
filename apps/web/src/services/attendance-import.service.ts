import { api } from './api';

/**
 * Attendance import client. HR only — the API enforces that; this file just
 * describes the shape of what comes back.
 */

export type ImportClassification =
  | 'NEW'
  | 'EXACT_DUPLICATE'
  | 'ENRICHMENT'
  | 'CONFLICT'
  | 'CONFLICT_MANUAL'
  | 'DUPLICATE_IN_FILE'
  | 'UNKNOWN_EMPLOYEE'
  | 'INVALID';

export type ImportDecision = 'PENDING' | 'KEEP_EXISTING' | 'USE_UPLOADED' | 'SKIP';

export interface ImportBatch {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  status: string;
  uploadedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  detectedPeriodStart: string | null;
  detectedPeriodEnd: string | null;
  totalSourceRows: number;
  countNew: number;
  countExactDuplicate: number;
  countEnrichment: number;
  countConflict: number;
  countConflictManual: number;
  countDuplicateInFile: number;
  countUnknownEmployee: number;
  countInvalid: number;
  countApplied: number;
  countSkipped: number;
  countFailed: number;
  normalizerVersion: string | null;
  failureReason: string | null;
  uploadedByUser?: { email: string } | null;
  confirmedByUser?: { email: string } | null;
}

export interface ImportCandidate {
  id: string;
  date: string | null;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
  sourceEmployeeCode: string | null;
  sessions: Array<{ in: string | null; out: string | null }> | null;
  sourceHours: Record<string, number | null> | null;
  reviewFlags: string[] | null;
  classification: ImportClassification;
  classificationReason: string | null;
  existingSnapshot: Record<string, unknown> | null;
  hrDecision: ImportDecision;
  /** A new day HR must still accept or skip because of its review flags. */
  held?: boolean;
  /** The status HR chose when correcting the day (null until corrected). */
  status?: string | null;
  /** HR's correction before import, with the device's original values. */
  hrCorrection?: {
    original: { sessions: Array<{ in: string | null; out: string | null }> | null };
    status: string;
    reason: string;
    correctedAt: string;
  } | null;
  appliedAt: string | null;
  applyError: string | null;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

import type { UnmatchedCode } from '@/pages/Attendance/components/CodeMappingPanel';
import type { IdentityIssue } from '@/pages/Attendance/components/IdentityIssuesPanel';

export interface ImportPreview {
  batch: ImportBatch;
  rows: ImportCandidate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  unmatchedCodes: UnmatchedCode[];
  /** How many rows still need HR's decision before Apply can succeed (the apply gate's own count). */
  pendingDecisions?: number;
  /**
   * Codes that resolved to an employee whose name no longer matches the file —
   * the reassigned-device-number case. Held, never applied.
   */
  identityIssues: IdentityIssue[];
}

export const AttendanceImportService = {
  async list(page = 1, limit = 20) {
    const res = await api.get<{ data: { rows: ImportBatch[]; pagination: { total: number; totalPages: number } } }>(
      `/attendance/imports?page=${page}&limit=${limit}`
    );
    return res.data.data;
  },

  /** `onProgress` gets 0–100 while the file is being sent. */
  async upload(file: File, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<{ data: { batch: ImportBatch; previouslyApplied: { at: string; filename: string } | null } }>(
      '/attendance/imports',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => onProgress?.(e.total ? (e.loaded / e.total) * 100 : 0),
      }
    );
    return res.data.data;
  },

  async preview(batchId: string, opts: { classification?: string; needsDecision?: boolean; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.classification) params.set('classification', opts.classification);
    if (opts.needsDecision) params.set('needsDecision', 'true');
    params.set('page', String(opts.page ?? 1));
    params.set('limit', String(opts.limit ?? 50));
    const res = await api.get<{ data: ImportPreview }>(`/attendance/imports/${batchId}/preview?${params}`);
    return res.data.data;
  },

  /** HR fixes a day before it is imported; the day is then decided (imported with the fix). */
  async correct(
    batchId: string,
    candidateId: string,
    body: { sessions: Array<{ in: string; out: string }>; status: CorrectionStatus; reason: string }
  ) {
    const res = await api.post<{ data: ImportCandidate }>(`/attendance/imports/${batchId}/candidates/${candidateId}/correct`, body);
    return res.data.data;
  },

  async decide(batchId: string, candidateIds: string[], decision: Exclude<ImportDecision, 'PENDING'>, reason?: string) {
    const res = await api.post<{ data: { updated: number } }>(`/attendance/imports/${batchId}/decisions`, {
      candidateIds,
      decision,
      reason,
    });
    return res.data.data;
  },

  /** How many of the accepted days an apply has written so far. */
  async progress(batchId: string) {
    const res = await api.get<{ data: { status: string; done: number; total: number } }>(`/attendance/imports/${batchId}/progress`);
    return res.data.data;
  },

  async apply(batchId: string) {
    const res = await api.post<{ data: ImportBatch }>(`/attendance/imports/${batchId}/apply`);
    return res.data.data;
  },

  async cancel(batchId: string) {
    await api.post(`/attendance/imports/${batchId}/cancel`);
  },

  async mapCode(employeeId: string, code: string) {
    const res = await api.post<{ data: { employeeId: string; biometricCode: string } }>(
      '/attendance/imports/map-code',
      { employeeId, code }
    );
    return res.data.data;
  },
};

/** Plain-language labels. The review flags are facts, never verdicts. */
/** The statuses HR can give a day when correcting it before import. */
export const CORRECTION_STATUSES = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half day' },
  { value: 'ABSENT', label: 'Absent (no punches)' },
  { value: 'ON_LEAVE', label: 'On leave (no punches)' },
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number]['value'];

export const FLAG_LABELS: Record<string, string> = {
  HR_CORRECTED: 'Corrected by HR before import',
  INCOMPLETE_PUNCH: 'Punch not closed',
  OUT_WITHOUT_IN: 'Time out with no time in',
  MULTIPLE_SESSIONS: 'More than one session',
  NON_SEQUENTIAL_PUNCHES: 'Time out earlier than time in',
  HOURS_WITHOUT_PUNCHES: 'Hours reported with no punches',
  PUNCHES_WITHOUT_HOURS: 'Punches with no hours reported',
  HOURS_DISAGREE_WITH_PUNCHES: 'Reported hours differ from the punches',
  FUTURE_DATE: 'Date is in the future',
  NO_PUNCHES: 'No punches recorded',
  WORKED_ON_SCHEDULED_DAY_OFF: 'Attendance on a scheduled day off',
  ATTENDANCE_DURING_APPROVED_LEAVE: 'Attendance during approved leave',
  WORKED_ON_HOLIDAY: 'Attendance on a holiday',
  SCHEDULE_NOT_CONFIGURED: 'No work schedule configured',
  PUNCH_OUTSIDE_SCHEDULE: 'Punches outside the scheduled shift',
  ON_LEAVE_NO_PUNCH: 'On approved leave',
  HOLIDAY_NO_PUNCH: 'Holiday',
  DAY_OFF_NO_PUNCH: 'Scheduled day off',
  ARCHIVED_EMPLOYEE: 'Employee is archived',
};

export const CLASSIFICATION_LABELS: Record<ImportClassification, string> = {
  NEW: 'Ready to import',
  EXACT_DUPLICATE: 'Already imported',
  ENRICHMENT: 'Fills in missing values',
  CONFLICT: 'Differs from the record on file',
  CONFLICT_MANUAL: 'Differs from an HR correction',
  DUPLICATE_IN_FILE: 'Repeated in this file',
  UNKNOWN_EMPLOYEE: 'Unmatched employee',
  INVALID: 'Could not be read',
};

/** Explains the identity check's name similarity score (computed in the API's identity-verification.service). */
export const NAME_SIMILARITY_HELP =
  'Name similarity score (0–100): how closely the name in the file matches this employee’s name, word by word. 80+ with every name part matching well counts as the same person; below 55 is a different person; in between needs review. It is a likeness score, not a percentage of records.';
