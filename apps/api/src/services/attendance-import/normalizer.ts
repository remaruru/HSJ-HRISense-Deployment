import { AttendanceStatus } from '@prisma/client';

/**
 * The ONLY format-dependent seam in the attendance import pipeline.
 *
 * ── Status: NO REAL NORMALIZER EXISTS ────────────────────────────────────────
 * The official Mustard Seedtime export has not been supplied. Nothing in this
 * file, or anywhere else in the codebase, may assume:
 *
 *   • column names or ordering        • sheet names or sheet selection
 *   • the employee identifier format  • punch pairing rules
 *   • time-in / time-out extraction   • overnight-shift handling
 *   • lateness or half-day formulas   • absence derivation
 *
 * A wrong pairing rule produces confidently incorrect attendance, which is worse
 * than no import at all — it puts false marks on real people's records. The
 * registry below therefore FAILS CLOSED: with no normalizer registered,
 * `getRegisteredNormalizer()` returns null and the import pipeline refuses to
 * proceed past parsing.
 *
 * ── What IS built ────────────────────────────────────────────────────────────
 * Everything above this seam: batching, hashing, raw staging, classification,
 * conflict handling, apply safety, audit. Those consume `NormalizedDailyCandidate`
 * and know nothing about Excel. When the real sample arrives, implementing one
 * class and registering it is the whole remaining task.
 */

/** One row of the source workbook, exactly as read. Not interpreted. */
export interface RawSourceRow {
  /** 1-based position in the sheet, for "row 47 is invalid" messages. */
  sourceRowNumber: number;
  sourceSheetName: string | null;
  /** Verbatim cell values. Shape unknown until the real file is supplied. */
  payload: Record<string, unknown>;
}

/**
 * One normalized employee-day, ready for classification against
 * `AttendanceRecord`. Deliberately mirrors the shape of that table and nothing
 * else — no Mustard-specific field appears here.
 */
export interface NormalizedDailyCandidate {
  /**
   * Source rows that produced this candidate, by `sourceRowNumber`.
   * MANY raw rows may produce ONE candidate: if the export turns out to carry
   * several punches per employee-day, they merge here. This is why raw rows and
   * candidates are separate models.
   */
  sourceRowNumbers: number[];

  /** Resolved employee, or null when the identifier matched nobody. */
  employeeId: string | null;
  /** The raw identifier as it appeared in the file, for reporting. NEVER a name. */
  sourceEmployeeIdentifier: string | null;

  /** Business date (YYYY-MM-DD), or null when the row's date was unreadable. */
  date: string | null;

  /** First IN of the day. Kept so every existing reader of AttendanceRecord works. */
  timeIn: Date | null;
  /** Last OUT of the day. Null when the day's final pair was never closed. */
  timeOut: Date | null;
  status: AttendanceStatus | null;
  hoursWorked: number | null;
  overtimeHours: number | null;

  /**
   * EVERY punch pair the source reported, in file order, so a day with more than
   * one session is not flattened away. `timeIn`/`timeOut` are a summary of this,
   * never a replacement for it.
   */
  sessions: Array<{ in: string | null; out: string | null }> | null;
  /** The source's own hour columns, verbatim. Never recalculated. */
  sourceHours: Record<string, number | null> | null;
  /**
   * Conditions the row itself reveals — an unclosed pair, an out with no in, a
   * date in the future. Facts, not verdicts. Conditions that need HRISense's own
   * data (day off, leave, holiday) are added later by the day-context service.
   */
  reviewFlags: string[];

  /**
   * Set when the normalizer could not produce a usable candidate. Carried
   * through to `classificationReason` so HR sees why a row cannot be imported.
   */
  invalidReason: string | null;
}

export interface NormalizationResult {
  candidates: NormalizedDailyCandidate[];
  /** Identifies the parser build, so batches can be found if a rule is corrected. */
  normalizerVersion: string;
}

/**
 * Implemented once the official export format is confirmed. Until then, no
 * implementation exists and none may be invented.
 */
export interface AttendanceNormalizer {
  /** Stable identifier recorded on every batch this normalizer processes. */
  readonly version: string;
  /** Human-readable name shown to HR. */
  readonly displayName: string;
  normalize(rows: RawSourceRow[]): Promise<NormalizationResult> | NormalizationResult;
}

// ─── Registry ────────────────────────────────────────────────────────────────
// Intentionally empty. Registering a normalizer is a deliberate act that must
// follow receipt of a real sample file, not a default that quietly starts
// interpreting spreadsheets.
let registeredNormalizer: AttendanceNormalizer | null = null;

/**
 * Registers the production normalizer. Called once at startup when — and only
 * when — a confirmed implementation exists.
 */
export function registerAttendanceNormalizer(normalizer: AttendanceNormalizer): void {
  registeredNormalizer = normalizer;
}

/** The active normalizer, or null when none has been registered. */
export function getRegisteredNormalizer(): AttendanceNormalizer | null {
  return registeredNormalizer;
}

/**
 * Whether the import pipeline may proceed past raw staging.
 *
 * Every caller must check this. Returning false is the correct, honest state
 * today, and the UI says so rather than pretending processing is available.
 */
export function isAttendanceImportProcessingAvailable(): boolean {
  return registeredNormalizer !== null;
}

/** Explains to HR why processing is unavailable. Safe to display verbatim. */
export const NORMALIZER_UNAVAILABLE_MESSAGE =
  'Attendance import processing is not yet available. The official Mustard Seedtime ' +
  'export format has not been supplied, so HRISense cannot interpret the file. ' +
  'Uploading and reviewing the file record is possible; processing will be enabled ' +
  'once the real format is configured.';
