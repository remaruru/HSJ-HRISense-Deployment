import { AttendanceImportClassification, AttendanceStatus } from '@prisma/client';
import type { NormalizedDailyCandidate } from './normalizer';
import { isHeld } from './review-flags';

/**
 * Compares a normalized employee-day against what HRISense already holds and
 * decides what should happen to it.
 *
 * Entirely format-independent: it consumes `NormalizedDailyCandidate`, never a
 * spreadsheet. That is what allows the whole review/apply pipeline to exist and
 * be reasoned about before the Mustard sample arrives.
 *
 * ── The one rule that matters most ───────────────────────────────────────────
 * An EXACT_DUPLICATE performs NO WRITE AT ALL — not even a no-op update. A no-op
 * `update` still bumps `updatedAt`, which pollutes the audit trail and makes
 * "when did this record last really change" unanswerable. Comparing first and
 * skipping is what makes re-importing the same file genuinely idempotent.
 */

/** The existing record's comparable state, captured at classification time. */
export interface ExistingRecordState {
  id: string;
  timeIn: Date | null;
  timeOut: Date | null;
  status: AttendanceStatus;
  hoursWorked: number | null;
  overtimeHours: number | null;
  /** Non-null means HR corrected this record by hand. */
  manuallyModifiedAt: Date | null;
  recordVersion: number;
}

export interface ClassificationOutcome {
  classification: AttendanceImportClassification;
  reason: string | null;
  /** Values captured for later drift detection at apply time. */
  existingSnapshot: ComparableFields | null;
  existingRecordVersion: number | null;
}

/**
 * The fields an import is authoritative for.
 *
 * `remarks` is deliberately EXCLUDED: it is HR's free-text field and an import
 * must never overwrite it, nor treat a difference in it as a conflict.
 */
export interface ComparableFields {
  timeIn: string | null;
  timeOut: string | null;
  status: string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
}

function toComparable(source: {
  timeIn: Date | null;
  timeOut: Date | null;
  status: AttendanceStatus | string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
}): ComparableFields {
  return {
    timeIn: source.timeIn ? source.timeIn.toISOString() : null,
    timeOut: source.timeOut ? source.timeOut.toISOString() : null,
    status: source.status ? String(source.status) : null,
    hoursWorked: source.hoursWorked ?? null,
    overtimeHours: source.overtimeHours ?? null,
  };
}

const COMPARED_FIELDS: Array<keyof ComparableFields> = [
  'timeIn',
  'timeOut',
  'status',
  'hoursWorked',
  'overtimeHours',
];

/** Fields where the two sides disagree, ignoring fields the upload leaves unset. */
function differingFields(existing: ComparableFields, incoming: ComparableFields): Array<keyof ComparableFields> {
  return COMPARED_FIELDS.filter((field) => {
    const uploaded = incoming[field];
    // The upload saying nothing about a field is not a disagreement about it.
    if (uploaded === null || uploaded === undefined) return false;
    return existing[field] !== uploaded;
  });
}

/**
 * True when the upload only ADDS information: every field the existing record
 * already holds is unchanged, and at least one field that was null is now
 * filled. This is the `timeOut: null → 17:00` case.
 */
function isStrictEnrichment(existing: ComparableFields, incoming: ComparableFields): boolean {
  let fillsSomething = false;
  for (const field of COMPARED_FIELDS) {
    const before = existing[field];
    const after = incoming[field];
    if (after === null || after === undefined) continue;
    if (before === null || before === undefined) {
      fillsSomething = true;
      continue;
    }
    if (before !== after) return false; // a known value changed — not enrichment
  }
  return fillsSomething;
}

export class AttendanceImportClassificationService {
  /**
   * Classifies one candidate.
   *
   * @param candidate the normalized employee-day
   * @param existing  the current AttendanceRecord for that employee-day, or null
   * @param seenInThisFile employee-day keys already staged from this same file
   */
  static classify(
    candidate: NormalizedDailyCandidate,
    existing: ExistingRecordState | null,
    seenInThisFile: Set<string>
  ): ClassificationOutcome {
    // ── INVALID: the normalizer could not produce a usable candidate ────────
    if (candidate.invalidReason) {
      return {
        classification: AttendanceImportClassification.INVALID,
        reason: candidate.invalidReason,
        existingSnapshot: null,
        existingRecordVersion: null,
      };
    }

    if (!candidate.date) {
      return {
        classification: AttendanceImportClassification.INVALID,
        reason: 'The date on this row could not be read.',
        existingSnapshot: null,
        existingRecordVersion: null,
      };
    }

    // ── UNKNOWN_EMPLOYEE: never guess a match ──────────────────────────────
    if (!candidate.employeeId) {
      return {
        classification: AttendanceImportClassification.UNKNOWN_EMPLOYEE,
        reason: candidate.sourceEmployeeIdentifier
          ? `No active employee matches the identifier "${candidate.sourceEmployeeIdentifier}".`
          : 'This row carries no employee identifier.',
        existingSnapshot: null,
        existingRecordVersion: null,
      };
    }

    // ── DUPLICATE_IN_FILE: the same employee-day appeared earlier ───────────
    const key = `${candidate.employeeId}|${candidate.date}`;
    if (seenInThisFile.has(key)) {
      return {
        classification: AttendanceImportClassification.DUPLICATE_IN_FILE,
        reason: 'This employee and date already appeared earlier in the same file. Only the first occurrence is used.',
        existingSnapshot: null,
        existingRecordVersion: null,
      };
    }

    // ── NEW: nothing on file for this employee-day ─────────────────────────
    if (!existing) {
      return {
        classification: AttendanceImportClassification.NEW,
        reason: null,
        existingSnapshot: null,
        existingRecordVersion: null,
      };
    }

    const existingComparable = toComparable(existing);
    const incomingComparable = toComparable(candidate);
    const snapshotVersion = existing.recordVersion;

    // ── EXACT_DUPLICATE: nothing to do, and nothing will be written ────────
    const differences = differingFields(existingComparable, incomingComparable);
    if (differences.length === 0) {
      return {
        classification: AttendanceImportClassification.EXACT_DUPLICATE,
        reason: null,
        existingSnapshot: existingComparable,
        existingRecordVersion: snapshotVersion,
      };
    }

    // ── ENRICHMENT: only fills gaps, changes nothing already known ─────────
    if (isStrictEnrichment(existingComparable, incomingComparable)) {
      return {
        classification: AttendanceImportClassification.ENRICHMENT,
        reason: 'The uploaded row fills in values that were previously missing and changes nothing already recorded.',
        existingSnapshot: existingComparable,
        existingRecordVersion: snapshotVersion,
      };
    }

    // ── CONFLICT_MANUAL: HR corrected this record by hand ──────────────────
    // Checked BEFORE plain CONFLICT so hand-checked work gets the louder class
    // and the safer default.
    const changed = differences.join(', ');
    if (existing.manuallyModifiedAt) {
      return {
        classification: AttendanceImportClassification.CONFLICT_MANUAL,
        reason: `This record was corrected by hand on ${existing.manuallyModifiedAt.toISOString().slice(0, 10)}. The uploaded row differs on: ${changed}.`,
        existingSnapshot: existingComparable,
        existingRecordVersion: snapshotVersion,
      };
    }

    // ── CONFLICT: genuine disagreement, HR must decide ─────────────────────
    return {
      classification: AttendanceImportClassification.CONFLICT,
      reason: `The uploaded row differs from the existing record on: ${changed}.`,
      existingSnapshot: existingComparable,
      existingRecordVersion: snapshotVersion,
    };
  }

  /**
   * The default decision for a classification.
   *
   * Conflicts default to PENDING so a batch cannot be confirmed until a human has
   * looked at every one of them. CONFLICT_MANUAL defaults to KEEP_EXISTING —
   * protecting HR's own correction unless they explicitly override it with a
   * reason.
   */
  static defaultDecision(
    classification: AttendanceImportClassification,
    reviewFlags: readonly string[] = []
  ):
    | 'PENDING'
    | 'KEEP_EXISTING'
    | 'USE_UPLOADED'
    | 'SKIP' {
    // A row nobody has a record for is still NEW even when it contradicts
    // itself, names the wrong person, or lands on a holiday. Classification
    // compares; it does not judge. So before the switch decides to apply
    // anything on its own, the row's own flags get a veto: anything holding
    // waits for HR. Skips stay skips — holding a row that was never going to be
    // written only fills the review queue with nothing to decide.
    if (isHeld(reviewFlags)) {
      switch (classification) {
        case AttendanceImportClassification.EXACT_DUPLICATE:
        case AttendanceImportClassification.DUPLICATE_IN_FILE:
        case AttendanceImportClassification.UNKNOWN_EMPLOYEE:
        case AttendanceImportClassification.INVALID:
          break; // nothing would be written anyway
        default:
          return 'PENDING';
      }
    }

    switch (classification) {
      case AttendanceImportClassification.NEW:
        return 'USE_UPLOADED';
      case AttendanceImportClassification.EXACT_DUPLICATE:
      case AttendanceImportClassification.DUPLICATE_IN_FILE:
        return 'SKIP';
      case AttendanceImportClassification.CONFLICT_MANUAL:
        return 'KEEP_EXISTING';
      case AttendanceImportClassification.ENRICHMENT:
      case AttendanceImportClassification.CONFLICT:
        // ENRICHMENT auto-apply is CLIENT POLICY REQUIRED — until Hospicio
        // decides, it waits for HR like any other conflict.
        return 'PENDING';
      case AttendanceImportClassification.UNKNOWN_EMPLOYEE:
      case AttendanceImportClassification.INVALID:
      default:
        return 'SKIP';
    }
  }

  /**
   * Whether a row must be decided before the batch can be confirmed.
   *
   * Takes the flags as well as the classification, because a held row is held
   * regardless of how it compares with the existing record.
   */
  static blocksConfirmation(
    classification: AttendanceImportClassification,
    reviewFlags: readonly string[] = []
  ): boolean {
    if (
      classification === AttendanceImportClassification.CONFLICT ||
      classification === AttendanceImportClassification.CONFLICT_MANUAL ||
      classification === AttendanceImportClassification.ENRICHMENT
    ) {
      return true;
    }
    // Held rows block only when they could otherwise have been written.
    return isHeld(reviewFlags) && this.canWrite(classification);
  }

  /** Whether a classification may ever write to AttendanceRecord. */
  static canWrite(classification: AttendanceImportClassification): boolean {
    return (
      classification === AttendanceImportClassification.NEW ||
      classification === AttendanceImportClassification.ENRICHMENT ||
      classification === AttendanceImportClassification.CONFLICT ||
      classification === AttendanceImportClassification.CONFLICT_MANUAL
    );
  }

  /** Exposed so the apply step compares against the same field set. */
  static toComparableFields = toComparable;
}
