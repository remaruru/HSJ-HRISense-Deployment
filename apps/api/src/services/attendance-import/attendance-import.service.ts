import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  AttendanceImportClassification,
  AttendanceImportDecision,
  AttendanceImportIdentityVerdict,
  AttendanceImportStatus,
  AttendanceRecordSource,
  AttendanceStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../lib/audit';
import {
  AttendanceImportClassificationService,
  type ExistingRecordState,
} from './classification.service';
import { AttendanceDayContextService, DAY_FLAGS } from './day-context.service';
import { heldReason, isHeld } from './review-flags';
import { flagForVerdict, verifyIdentity, type IdentityCheck } from './identity-verification.service';
import { MustardParseError, MustardSeedtimeReader } from './mustard-seedtime.reader';
import {
  MUSTARD_FLAGS,
  MustardSeedtimeNormalizer,
  phtInstant,
  toRawSourceRows,
  type MustardRowPayload,
} from './mustard-seedtime.normalizer';
import {
  registerAttendanceNormalizer,
  type NormalizedDailyCandidate,
} from './normalizer';

/**
 * Orchestrates one attendance import: upload → parse → stage → classify →
 * preview → HR confirms → apply.
 *
 * ── What this service refuses to do ──────────────────────────────────────────
 * It never writes an AttendanceRecord as a side effect of uploading. Selecting a
 * file produces a batch and a preview and nothing else; the write happens only
 * after a human confirms. It never invents a status, never marks anyone absent
 * for a day the file did not mention, and never resolves a disagreement by
 * discarding one side of it.
 */

/** OLE2 compound document — the signature of a genuine legacy `.xls`. */
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** ZIP local header — an `.xlsx`, which SheetJS also reads. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export const ATTENDANCE_IMPORT_MAX_BYTES = 15 * 1024 * 1024;

/** Flag raised when the code matched somebody who is no longer active. */
const ARCHIVED_EMPLOYEE_FLAG = 'ARCHIVED_EMPLOYEE';

// The seam is filled here, at the point where a confirmed implementation exists.
const normalizer = new MustardSeedtimeNormalizer({
  resolveEmployeeIdsByCode: (codes) => AttendanceImportService.resolveEmployeeIdsByCode(codes),
});
registerAttendanceNormalizer(normalizer);

/** Warnings about the punches themselves — a correction by HR resolves them. */
const CORRECTABLE_FLAGS: ReadonlySet<string> = new Set([
  MUSTARD_FLAGS.INCOMPLETE_PUNCH,
  MUSTARD_FLAGS.OUT_WITHOUT_IN,
  MUSTARD_FLAGS.NON_SEQUENTIAL_PUNCHES,
  MUSTARD_FLAGS.HOURS_WITHOUT_PUNCHES,
  MUSTARD_FLAGS.PUNCHES_WITHOUT_HOURS,
  MUSTARD_FLAGS.HOURS_DISAGREE_WITH_PUNCHES,
  MUSTARD_FLAGS.IMPLAUSIBLE_DURATION,
  MUSTARD_FLAGS.NO_PUNCHES,
  MUSTARD_FLAGS.MULTIPLE_SESSIONS,
]);

/** Informational: the day was corrected by HR before it was imported. */
const HR_CORRECTED_FLAG = 'HR_CORRECTED';

/** True when the row reports neither a punch nor any worked hours. */
function carriesNoFact(candidate: NormalizedDailyCandidate): boolean {
  return !candidate.sessions?.length && !(candidate.hoursWorked ?? 0);
}

export class AttendanceImportService {
  /**
   * Maps source codes to employees on `biometricCode` and nothing else.
   *
   * Archived employees are included on purpose: their past attendance is still
   * their attendance, and dropping the row would silently lose a fact. The row
   * is flagged instead, and nothing about the employee's archived state changes.
   */
  static async resolveEmployeeIdsByCode(codes: string[]): Promise<Map<string, string>> {
    if (!codes.length) return new Map();
    const employees = await prisma.employee.findMany({
      where: { biometricCode: { in: codes } },
      select: { id: true, biometricCode: true },
    });
    const map = new Map<string, string>();
    for (const e of employees) if (e.biometricCode) map.set(e.biometricCode, e.id);
    return map;
  }

  // ── 1. Upload ──────────────────────────────────────────────────────────────

  static async createBatch(
    file: { path: string; originalname: string; size: number; filename: string },
    userId: string
  ) {
    const buffer = fs.readFileSync(file.path);

    // Trust the bytes, not the extension or the browser's MIME guess.
    const isOle2 = buffer.subarray(0, 8).equals(OLE2_MAGIC);
    const isZip = buffer.subarray(0, 4).equals(ZIP_MAGIC);
    if (!isOle2 && !isZip) {
      throw new AppError(
        'This file is not an Excel workbook. The attendance export must be the .xls file produced by the timekeeping system.',
        400
      );
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // A repeat upload of the same bytes is allowed — a previous attempt may have
    // been cancelled — but the earlier batch is reported so HR is not surprised.
    const previous = await prisma.attendanceImportBatch.findFirst({
      where: { fileHash, status: { in: [AttendanceImportStatus.COMPLETED, AttendanceImportStatus.PARTIALLY_APPLIED] } },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, uploadedAt: true, originalFilename: true },
    });

    const batch = await prisma.attendanceImportBatch.create({
      data: {
        fileHash,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        fileSizeBytes: file.size,
        uploadedByUserId: userId,
        status: AttendanceImportStatus.UPLOADED,
      },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'ATTENDANCE_IMPORT_UPLOADED',
      entityType: 'ATTENDANCE_IMPORT_BATCH',
      entityId: batch.id,
      metadata: { originalFilename: file.originalname, fileSizeBytes: file.size },
    });

    return { batch, previouslyApplied: previous };
  }

  // ── 2. Parse, stage and classify ───────────────────────────────────────────

  /**
   * Reads the workbook, stages every row verbatim, normalizes it and classifies
   * each employee-day against what HRISense already holds. Writes nothing to
   * AttendanceRecord.
   */
  static async parseAndClassify(batchId: string, filePath: string) {
    const batch = await prisma.attendanceImportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError('Import batch not found.', 404);
    if (batch.status !== AttendanceImportStatus.UPLOADED) {
      throw new AppError('This import has already been processed.', 409);
    }

    await prisma.attendanceImportBatch.update({
      where: { id: batchId },
      data: { status: AttendanceImportStatus.PARSING },
    });

    try {
      const workbook = MustardSeedtimeReader.read(fs.readFileSync(filePath));
      const rawRows = toRawSourceRows(workbook);
      if (!rawRows.length) {
        throw new MustardParseError('No attendance rows were found in this timesheet.');
      }

      // ── stage the raw rows, exactly as read ─────────────────────────────
      const rawRecords = rawRows.map((row) => {
        const payload = row.payload as unknown as MustardRowPayload;
        return {
          batchId,
          sourceRowNumber: row.sourceRowNumber,
          sourceSheetName: row.sourceSheetName,
          rawPayload: payload as unknown as Prisma.InputJsonValue,
          rawRowHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
        };
      });
      for (let i = 0; i < rawRecords.length; i += 500) {
        await prisma.attendanceImportRawRow.createMany({ data: rawRecords.slice(i, i + 500) });
      }

      // ── normalize ───────────────────────────────────────────────────────
      const { candidates, normalizerVersion } = await normalizer.normalize(rawRows);

      // ── the facts HRISense already holds for those days ─────────────────
      const keys = candidates
        .filter((c) => c.employeeId && c.date)
        .map((c) => ({ employeeId: c.employeeId as string, date: c.date as string }));

      const [dayContexts, existingRecords, archivedIds] = await Promise.all([
        AttendanceDayContextService.loadMany(keys),
        this.loadExistingRecords(keys),
        this.loadArchivedEmployeeIds([...new Set(keys.map((k) => k.employeeId))]),
      ]);

      // ── does each code still belong to the person it is mapped to? ───────
      //
      // The name is read from the workbook blocks, compared here, and dropped.
      // It is never staged, never logged, and never written: what survives this
      // call is a verdict, a score and HRISense employee ids.
      const identities = await this.verifyBlockIdentities(workbook.blocks);

      // ── classify ────────────────────────────────────────────────────────
      const seen = new Set<string>();
      const counts = this.emptyCounts();
      const rowsByCandidate: Array<{ candidate: NormalizedDailyCandidate; data: Prisma.AttendanceImportCandidateCreateManyInput }> = [];

      for (const candidate of candidates) {
        const key = candidate.employeeId && candidate.date ? `${candidate.employeeId}|${candidate.date}` : null;
        const existing = key ? existingRecords.get(key) ?? null : null;

        const outcome = AttendanceImportClassificationService.classify(candidate, existing, seen);
        if (key && outcome.classification !== AttendanceImportClassification.DUPLICATE_IN_FILE) {
          seen.add(key);
        }

        // Day-level facts are merged into the row's own flags. They never change
        // the classification — a conflict with the schedule is not a conflict
        // with an existing record, and collapsing the two would hide both.
        const context = key ? dayContexts.get(key) : undefined;
        const hasPunches = !!candidate.sessions?.length;
        const flags = new Set<string>(candidate.reviewFlags);
        for (const f of AttendanceDayContextService.flagsFor(context, hasPunches)) flags.add(f);
        if (AttendanceDayContextService.punchOutsideSchedule(context, candidate.sessions)) {
          flags.add(DAY_FLAGS.PUNCH_OUTSIDE_SCHEDULE);
        }
        if (candidate.employeeId && archivedIds.has(candidate.employeeId)) {
          flags.add(ARCHIVED_EMPLOYEE_FLAG);
        }

        const identity = candidate.sourceEmployeeIdentifier
          ? identities.get(candidate.sourceEmployeeIdentifier)
          : undefined;
        const identityFlag = identity ? flagForVerdict(identity.verdict) : null;
        if (identityFlag) flags.add(identityFlag);

        counts[outcome.classification] = (counts[outcome.classification] ?? 0) + 1;

        rowsByCandidate.push({
          candidate,
          data: {
            batchId,
            employeeId: candidate.employeeId,
            date: candidate.date ? new Date(`${candidate.date}T00:00:00.000Z`) : null,
            timeIn: candidate.timeIn,
            timeOut: candidate.timeOut,
            status: candidate.status,
            hoursWorked: candidate.hoursWorked,
            overtimeHours: candidate.overtimeHours,
            sourceEmployeeCode: candidate.sourceEmployeeIdentifier,
            sessions: (candidate.sessions ?? undefined) as unknown as Prisma.InputJsonValue,
            sourceHours: (candidate.sourceHours ?? undefined) as unknown as Prisma.InputJsonValue,
            reviewFlags: [...flags] as unknown as Prisma.InputJsonValue,
            classification: outcome.classification,
            identityVerdict: (identity?.verdict ?? null) as AttendanceImportIdentityVerdict | null,
            identityScore: identity?.score ?? null,
            suggestedEmployeeId: identity?.suggestedEmployeeId ?? null,
            suggestedScore: identity?.suggestedScore ?? null,
            existingRecordId: outcome.existingSnapshot ? existing?.id ?? null : null,
            existingSnapshot: (outcome.existingSnapshot ?? undefined) as unknown as Prisma.InputJsonValue,
            existingRecordVersion: outcome.existingRecordVersion,
            // A row that carries no attendance fact must never be written.
            //
            // The export lists EVERY date in the period for every employee,
            // including days the device recorded nothing at all — 813 of them in
            // the official file. Left on the default decision those would import
            // as attendance records with no times, which the rest of the system
            // would read as "present". A day with no punches is an absence of
            // evidence, not evidence of absence: it stays NO_RECORD.
            hrDecision: carriesNoFact(candidate)
              ? AttendanceImportDecision.SKIP
              : (AttendanceImportClassificationService.defaultDecision(
                  outcome.classification,
                  [...flags]
                ) as AttendanceImportDecision),
            classificationReason: carriesNoFact(candidate)
              ? 'The export lists this date but recorded no punches and no hours, so there is nothing to import. The day is left with no record rather than marked present or absent.'
              : // A held row's reason says WHY it is waiting. Without this HR sees
                // a PENDING row with an empty explanation and no way to judge it.
                [outcome.reason, heldReason([...flags])].filter(Boolean).join(' ') || null,
          },
        });
      }

      // A duplicate employee-day inside one file must not become two candidates:
      // the unique index would reject the batch. Duplicates are staged as raw
      // rows and reported through the count, which is where they belong.
      const unique = new Map<string, Prisma.AttendanceImportCandidateCreateManyInput>();
      const spilled: Prisma.AttendanceImportCandidateCreateManyInput[] = [];
      for (const { data } of rowsByCandidate) {
        const k = `${data.employeeId ?? 'none'}|${data.date ? new Date(data.date).toISOString().slice(0, 10) : 'none'}`;
        if (data.employeeId && data.date && unique.has(k)) { spilled.push(data); continue; }
        if (data.employeeId && data.date) unique.set(k, data);
        else spilled.push(data); // unknown-employee / invalid rows share no key
      }
      const toInsert = [...unique.values(), ...spilled.filter((d) => !d.employeeId || !d.date)];
      for (let i = 0; i < toInsert.length; i += 500) {
        await prisma.attendanceImportCandidate.createMany({ data: toInsert.slice(i, i + 500) });
      }

      const period = this.detectPeriod(candidates, workbook.reportPeriod);

      const updated = await prisma.attendanceImportBatch.update({
        where: { id: batchId },
        data: {
          status: AttendanceImportStatus.VALIDATED,
          normalizerVersion,
          totalSourceRows: rawRows.length,
          detectedPeriodStart: period.start ? new Date(`${period.start}T00:00:00.000Z`) : null,
          detectedPeriodEnd: period.end ? new Date(`${period.end}T00:00:00.000Z`) : null,
          countNew: counts.NEW ?? 0,
          countExactDuplicate: counts.EXACT_DUPLICATE ?? 0,
          countEnrichment: counts.ENRICHMENT ?? 0,
          countConflict: counts.CONFLICT ?? 0,
          countConflictManual: counts.CONFLICT_MANUAL ?? 0,
          countDuplicateInFile: counts.DUPLICATE_IN_FILE ?? 0,
          countUnknownEmployee: counts.UNKNOWN_EMPLOYEE ?? 0,
          countInvalid: counts.INVALID ?? 0,
          // Counted over the rows that will actually be staged, not over every
          // parsed candidate, so the number matches what HR can open.
          countIdentityFlagged: toInsert.filter(
            (d) =>
              d.identityVerdict === AttendanceImportIdentityVerdict.MISMATCH ||
              d.identityVerdict === AttendanceImportIdentityVerdict.UNCERTAIN
          ).length,
        },
      });
      return updated;
    } catch (error) {
      const reason =
        error instanceof MustardParseError || error instanceof AppError
          ? error.message
          : 'The file could not be processed.';
      await prisma.attendanceImportBatch.update({
        where: { id: batchId },
        data: { status: AttendanceImportStatus.FAILED, failureReason: reason },
      });
      throw error instanceof AppError ? error : new AppError(reason, 400);
    }
  }

  private static emptyCounts(): Record<string, number> {
    return {};
  }

  private static async loadExistingRecords(keys: Array<{ employeeId: string; date: string }>) {
    const map = new Map<string, ExistingRecordState>();
    if (!keys.length) return map;
    const dates = [...new Set(keys.map((k) => k.date))].sort();
    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: [...new Set(keys.map((k) => k.employeeId))] },
        date: {
          gte: new Date(`${dates[0]}T00:00:00.000Z`),
          lte: new Date(`${dates[dates.length - 1]}T00:00:00.000Z`),
        },
      },
      select: {
        id: true, employeeId: true, date: true, timeIn: true, timeOut: true, status: true,
        hoursWorked: true, overtimeHours: true, manuallyModifiedAt: true, recordVersion: true,
      },
    });
    for (const r of records) {
      map.set(`${r.employeeId}|${r.date.toISOString().slice(0, 10)}`, {
        id: r.id,
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        status: r.status,
        hoursWorked: r.hoursWorked,
        overtimeHours: r.overtimeHours,
        manuallyModifiedAt: r.manuallyModifiedAt,
        recordVersion: r.recordVersion,
      });
    }
    return map;
  }

  /**
   * Compares the name beside each device code against the employee that code is
   * mapped to, and works out who else it might be.
   *
   * ── The one rule ──────────────────────────────────────────────────────────
   * The names come in as arguments and leave as a verdict. Nothing in the map
   * this returns contains text taken from the file: only enums, integers and
   * HRISense employee ids. That is what lets the check exist at all without
   * reintroducing employee names into the database.
   *
   * The whole active roster is loaded once and reused for every block, because
   * the suggestion has to consider everybody, not just the codes in this file.
   */
  private static async verifyBlockIdentities(
    blocks: readonly { code: string | null; nameForVerificationOnly: string | null }[]
  ): Promise<Map<string, IdentityCheck>> {
    const result = new Map<string, IdentityCheck>();
    const coded = blocks.filter((b) => b.code);
    if (!coded.length) return result;

    const roster = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true, middleName: true, biometricCode: true },
    });
    const byCode = new Map(roster.filter((e) => e.biometricCode).map((e) => [e.biometricCode as string, e]));

    for (const block of coded) {
      const code = block.code as string;
      // One entry per code, not per row: the same block cannot disagree with
      // itself, and HR decides per code, not per day.
      if (result.has(code)) continue;
      result.set(code, verifyIdentity(block.nameForVerificationOnly, byCode.get(code) ?? null, roster));
    }
    return result;
  }

  private static async loadArchivedEmployeeIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await prisma.employee.findMany({
      where: { id: { in: ids }, NOT: { deletedAt: null } },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /** The period the ROWS describe, falling back to the report's own header. */
  private static detectPeriod(
    candidates: NormalizedDailyCandidate[],
    headerPeriod: { start: string | null; end: string | null }
  ) {
    const dates = candidates.map((c) => c.date).filter((d): d is string => !!d).sort();
    if (!dates.length) return headerPeriod;
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  // ── 3. Preview ─────────────────────────────────────────────────────────────

  /**
   * Rows that still need HR's decision before the batch can be applied — the
   * same set the apply gate counts, so the screen and the gate never disagree.
   */
  private static pendingWhere(batchId: string): Prisma.AttendanceImportCandidateWhereInput {
    return {
      batchId,
      appliedAt: null,
      hrDecision: AttendanceImportDecision.PENDING,
      classification: {
        in: [
          AttendanceImportClassification.NEW,
          AttendanceImportClassification.CONFLICT,
          AttendanceImportClassification.CONFLICT_MANUAL,
          AttendanceImportClassification.ENRICHMENT,
        ],
      },
    };
  }

  static async getPreview(
    batchId: string,
    filters: { classification?: string; needsDecision?: boolean; page?: number; limit?: number }
  ) {
    const batch = await prisma.attendanceImportBatch.findUnique({
      where: { id: batchId },
      include: { uploadedByUser: { select: { email: true } } },
    });
    if (!batch) throw new AppError('Import batch not found.', 404);

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));

    const where: Prisma.AttendanceImportCandidateWhereInput = filters.needsDecision
      ? this.pendingWhere(batchId)
      : {
          batchId,
          ...(filters.classification ? { classification: filters.classification as AttendanceImportClassification } : {}),
        };

    const [found, total, unmatched, pendingDecisions] = await Promise.all([
      prisma.attendanceImportCandidate.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        },
        orderBy: [{ date: 'asc' }, { sourceEmployeeCode: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendanceImportCandidate.count({ where }),
      // The codes HR still has to map, with how many days each one is holding up.
      prisma.attendanceImportCandidate.groupBy({
        by: ['sourceEmployeeCode'],
        where: { batchId, classification: AttendanceImportClassification.UNKNOWN_EMPLOYEE },
        _count: { _all: true },
      }),
      prisma.attendanceImportCandidate.count({ where: this.pendingWhere(batchId) }),
    ]);
    // `held`: a new day HR must still accept or skip because of its review flags.
    const rows = found.map((r) => ({ ...r, held: isHeld(r.reviewFlags as string[] | null) }));

    // ── who each troublesome code looks like ────────────────────────────────
    //
    // One representative row per code carries the verdict and the suggestion —
    // they are identical across that code's days, because identity is decided
    // per code, not per day.
    const identityRows = await prisma.attendanceImportCandidate.findMany({
      where: {
        batchId,
        OR: [
          { classification: AttendanceImportClassification.UNKNOWN_EMPLOYEE },
          { identityVerdict: { in: [AttendanceImportIdentityVerdict.MISMATCH, AttendanceImportIdentityVerdict.UNCERTAIN] } },
        ],
      },
      distinct: ['sourceEmployeeCode'],
      select: {
        sourceEmployeeCode: true,
        identityVerdict: true,
        identityScore: true,
        suggestedScore: true,
        classification: true,
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        suggestedEmployee: {
          select: {
            id: true, employeeNumber: true, firstName: true, lastName: true,
            jobRole: { select: { title: true } }, unit: { select: { name: true } },
          },
        },
      },
    });
    const identityByCode = new Map(identityRows.map((r) => [r.sourceEmployeeCode, r]));

    /** Days per code for the mismatched ones, so HR sees the blast radius. */
    const mismatchedCounts = await prisma.attendanceImportCandidate.groupBy({
      by: ['sourceEmployeeCode'],
      where: {
        batchId,
        identityVerdict: { in: [AttendanceImportIdentityVerdict.MISMATCH, AttendanceImportIdentityVerdict.UNCERTAIN] },
      },
      _count: { _all: true },
    });

    return {
      batch,
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      /** How many rows still need HR's decision before Apply can succeed. */
      pendingDecisions,
      unmatchedCodes: unmatched
        .map((u) => {
          const id = u.sourceEmployeeCode ? identityByCode.get(u.sourceEmployeeCode) : undefined;
          return {
            code: u.sourceEmployeeCode,
            days: u._count._all,
            // A proposal for HR to confirm. Never applied on its own.
            suggestedEmployee: id?.suggestedEmployee ?? null,
            suggestedScore: id?.suggestedScore ?? null,
          };
        })
        .sort((a, b) => b.days - a.days),
      /**
       * Codes that DID resolve but whose name no longer agrees with the employee
       * they are mapped to — the reassigned-device-number case.
       */
      identityIssues: mismatchedCounts
        .map((m) => {
          const id = m.sourceEmployeeCode ? identityByCode.get(m.sourceEmployeeCode) : undefined;
          return {
            code: m.sourceEmployeeCode,
            days: m._count._all,
            verdict: id?.identityVerdict ?? null,
            score: id?.identityScore ?? null,
            mappedTo: id?.employee ?? null,
            suggestedEmployee: id?.suggestedEmployee ?? null,
            suggestedScore: id?.suggestedScore ?? null,
          };
        })
        .sort((a, b) => b.days - a.days),
    };
  }

  // ── 4. HR decisions ────────────────────────────────────────────────────────

  static async setDecision(
    batchId: string,
    candidateIds: string[],
    decision: AttendanceImportDecision,
    userId: string,
    reason?: string
  ) {
    const batch = await prisma.attendanceImportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError('Import batch not found.', 404);
    if (batch.status !== AttendanceImportStatus.VALIDATED) {
      throw new AppError('Decisions can only be recorded while the import is awaiting confirmation.', 409);
    }
    const result = await prisma.attendanceImportCandidate.updateMany({
      where: { id: { in: candidateIds }, batchId },
      data: { hrDecision: decision, hrDecisionByUserId: userId, hrDecisionAt: new Date(), hrDecisionReason: reason ?? null },
    });
    return { updated: result.count };
  }

  /**
   * HR fixes a day BEFORE it is imported — the missing clock-out, punches in the
   * wrong order, or the status — with a reason.
   *
   * The candidate's own fields become the corrected day, and the device's
   * original values are kept beside them in `hrCorrection` (the raw rows still
   * hold the file itself). The punch-data warnings the fix resolves are dropped;
   * the facts about the day (holiday, day off, leave) stay, because a fix does
   * not change them. The day is then decided: it will be imported, as an HR
   * correction that no later import overwrites.
   */
  static async correctCandidate(
    batchId: string,
    candidateId: string,
    input: { sessions: Array<{ in: string; out: string }>; status: AttendanceStatus; reason: string },
    userId: string
  ) {
    const batch = await prisma.attendanceImportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError('Import batch not found.', 404);
    if (batch.status !== AttendanceImportStatus.VALIDATED) {
      throw new AppError('Days can only be corrected while the import is awaiting confirmation.', 409);
    }
    const candidate = await prisma.attendanceImportCandidate.findFirst({ where: { id: candidateId, batchId } });
    if (!candidate) throw new AppError('That day is not part of this import.', 404);
    if (candidate.appliedAt) throw new AppError('This day has already been imported.', 409);
    if (!candidate.employeeId || !candidate.date || !AttendanceImportClassificationService.canWrite(candidate.classification)) {
      throw new AppError('This day cannot be corrected here. Map its code to an employee first, or skip it.', 400);
    }

    // Absent / on leave: there are no punches to keep.
    const noPunches = input.status === AttendanceStatus.ABSENT || input.status === AttendanceStatus.ON_LEAVE;
    const sessions = noPunches ? [] : input.sessions;
    if (!noPunches && sessions.length === 0) {
      throw new AppError('Enter at least one clock-in and clock-out for a day that was worked.', 400);
    }
    const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    let previousOut = -1;
    let workedMinutes = 0;
    for (const [i, s] of sessions.entries()) {
      const inM = toMinutes(s.in);
      const outM = toMinutes(s.out);
      if (outM <= inM) throw new AppError(`Pair ${i + 1}: the clock-out must be later than the clock-in.`, 400);
      if (inM < previousOut) throw new AppError(`Pair ${i + 1} starts before the previous pair ends.`, 400);
      previousOut = outM;
      workedMinutes += outM - inM;
    }

    const dateKey = candidate.date.toISOString().slice(0, 10);
    const previous = candidate.hrCorrection as { original?: unknown } | null;
    // A second correction keeps the device's values from before the FIRST one.
    const original = previous?.original ?? {
      timeIn: candidate.timeIn,
      timeOut: candidate.timeOut,
      sessions: candidate.sessions,
      hoursWorked: candidate.hoursWorked,
      overtimeHours: candidate.overtimeHours,
      status: candidate.status,
      reviewFlags: candidate.reviewFlags,
    };
    const originalFlags = ((previous?.original as { reviewFlags?: string[] } | undefined)?.reviewFlags ??
      (candidate.reviewFlags as string[] | null) ??
      []) as string[];
    const flags = new Set(originalFlags.filter((f) => !CORRECTABLE_FLAGS.has(f)));
    if (sessions.length > 1) flags.add(MUSTARD_FLAGS.MULTIPLE_SESSIONS);
    flags.add(HR_CORRECTED_FLAG);

    const reason = input.reason.trim();
    const updated = await prisma.attendanceImportCandidate.update({
      where: { id: candidate.id },
      data: {
        timeIn: sessions.length ? phtInstant(dateKey, toMinutes(sessions[0].in)) : null,
        timeOut: sessions.length ? phtInstant(dateKey, toMinutes(sessions[sessions.length - 1].out)) : null,
        sessions: sessions.length ? sessions : Prisma.DbNull,
        hoursWorked: Math.round((workedMinutes / 60) * 100) / 100,
        // The device's overtime no longer describes the corrected punches.
        overtimeHours: null,
        status: input.status,
        reviewFlags: [...flags],
        hrCorrection: {
          original,
          status: input.status,
          reason,
          correctedByUserId: userId,
          correctedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        hrDecision: AttendanceImportDecision.USE_UPLOADED,
        hrDecisionByUserId: userId,
        hrDecisionAt: new Date(),
        hrDecisionReason: reason,
      },
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'ATTENDANCE_IMPORT_DAY_CORRECTED',
      entityType: 'EMPLOYEE',
      entityId: candidate.employeeId,
      oldValue: { date: dateKey, sessions: (original as { sessions?: unknown }).sessions ?? null },
      newValue: { date: dateKey, sessions, status: input.status, reason, batchId },
    });

    return { ...updated, held: isHeld(updated.reviewFlags as string[] | null) };
  }

  // ── 5. Apply ───────────────────────────────────────────────────────────────

  /**
   * Writes the confirmed candidates. Every write re-checks the record it is
   * about to touch against the snapshot taken at preview time, so a decision
   * made against a stale screen is refused rather than executed.
   */
  /**
   * How far an apply has got, for the progress bar while it runs. Each day is
   * written in its own transaction, so the count moves as the work happens.
   */
  static async getApplyProgress(batchId: string) {
    const batch = await prisma.attendanceImportBatch.findUnique({ where: { id: batchId }, select: { status: true } });
    if (!batch) throw new AppError('Import not found.', 404);
    const accepted = { batchId, hrDecision: AttendanceImportDecision.USE_UPLOADED };
    const [total, done] = await Promise.all([
      prisma.attendanceImportCandidate.count({ where: accepted }),
      prisma.attendanceImportCandidate.count({ where: { ...accepted, OR: [{ appliedAt: { not: null } }, { applyError: { not: null } }] } }),
    ]);
    return { status: batch.status, done, total };
  }

  static async apply(batchId: string, userId: string) {
    // The conditional update is what stops two people applying the same batch.
    const claimed = await prisma.attendanceImportBatch.updateMany({
      where: { id: batchId, status: AttendanceImportStatus.VALIDATED },
      data: { status: AttendanceImportStatus.APPLYING, confirmedByUserId: userId, confirmedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new AppError('This import is not awaiting confirmation. It may already have been applied.', 409);
    }

    const pending = await prisma.attendanceImportCandidate.count({
      where: {
        batchId,
        hrDecision: AttendanceImportDecision.PENDING,
        // Every classification that could WRITE something. NEW belongs here now
        // that a flagged NEW row is held at PENDING: without it the gate would
        // wave the batch through and the held rows would simply never apply,
        // silently losing the very days that needed attention.
        classification: {
          in: [
            AttendanceImportClassification.NEW,
            AttendanceImportClassification.CONFLICT,
            AttendanceImportClassification.CONFLICT_MANUAL,
            AttendanceImportClassification.ENRICHMENT,
          ],
        },
      },
    });
    if (pending > 0) {
      await prisma.attendanceImportBatch.update({
        where: { id: batchId },
        data: { status: AttendanceImportStatus.VALIDATED },
      });
      throw new AppError(`${pending} record${pending === 1 ? '' : 's'} still need a decision before this import can be applied.`, 400);
    }

    const candidates = await prisma.attendanceImportCandidate.findMany({
      where: { batchId, appliedAt: null, hrDecision: AttendanceImportDecision.USE_UPLOADED },
      orderBy: { date: 'asc' },
    });

    let applied = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const candidate of candidates) {
      if (!candidate.employeeId || !candidate.date) { failed++; continue; }
      if (!AttendanceImportClassificationService.canWrite(candidate.classification)) continue;
      // Second line of defence: even an explicit decision cannot write a record
      // that asserts attendance the file never reported.
      const sessions = candidate.sessions as Array<unknown> | null;
      const correction = candidate.hrCorrection as { reason?: string; correctedByUserId?: string } | null;
      if (!sessions?.length && !(candidate.hoursWorked ?? 0) && !correction) continue;

      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.attendanceRecord.findUnique({
            where: { employeeId_date: { employeeId: candidate.employeeId as string, date: candidate.date as Date } },
            select: { id: true, recordVersion: true },
          });

          // Drift check: the record changed since HR looked at it.
          if (existing && candidate.existingRecordVersion !== null && existing.recordVersion !== candidate.existingRecordVersion) {
            throw new Error('The record changed after this import was previewed.');
          }

          const payload = {
            timeIn: candidate.timeIn,
            timeOut: candidate.timeOut,
            hoursWorked: candidate.hoursWorked,
            overtimeHours: candidate.overtimeHours,
            sessions: (candidate.sessions ?? undefined) as Prisma.InputJsonValue,
            sourceHours: (candidate.sourceHours ?? undefined) as Prisma.InputJsonValue,
            reviewFlags: (candidate.reviewFlags ?? undefined) as Prisma.InputJsonValue,
            sourceType: AttendanceRecordSource.IMPORT,
            lastImportBatchId: batchId,
            // Corrected by HR before import: their status and reason, marked as
            // a manual correction so no later import overwrites it.
            ...(correction
              ? {
                  status: candidate.status ?? AttendanceStatus.PRESENT,
                  remarks: correction.reason ?? null,
                  sourceType: AttendanceRecordSource.MANUAL,
                  manuallyModifiedAt: new Date(),
                  manuallyModifiedById: correction.correctedByUserId ?? userId,
                }
              : {}),
          };

          if (existing) {
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              // `status` and `remarks` are deliberately NOT written: the import
              // carries no status, and remarks belong to HR.
              data: { ...payload, recordVersion: { increment: 1 } },
            });
          } else {
            await tx.attendanceRecord.create({
              data: {
                employeeId: candidate.employeeId as string,
                date: candidate.date as Date,
                // A punch is evidence of attendance, not of a policy outcome.
                // PRESENT is the plainest true statement the enum can make; the
                // review flags carry everything that needs a human.
                status: AttendanceStatus.PRESENT,
                ...payload,
                recordVersion: 1,
              },
            });
          }

          await tx.attendanceImportCandidate.update({
            where: { id: candidate.id },
            data: { appliedAt: new Date(), applyError: null },
          });
        });
        applied++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown failure.';
        failures.push(`${candidate.sourceEmployeeCode ?? '?'} ${candidate.date?.toISOString().slice(0, 10) ?? '?'}: ${message}`);
        await prisma.attendanceImportCandidate.update({
          where: { id: candidate.id },
          data: { applyError: message },
        });
      }
    }

    const skipped = await prisma.attendanceImportCandidate.count({
      where: { batchId, appliedAt: null },
    });

    const batch = await prisma.attendanceImportBatch.update({
      where: { id: batchId },
      data: {
        status: failed > 0 ? AttendanceImportStatus.PARTIALLY_APPLIED : AttendanceImportStatus.COMPLETED,
        countApplied: applied,
        countSkipped: skipped,
        countFailed: failed,
        completedAt: new Date(),
        failureReason: failures.length ? failures.slice(0, 20).join('\n') : null,
      },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'ATTENDANCE_IMPORT_APPLIED',
      entityType: 'ATTENDANCE_IMPORT_BATCH',
      entityId: batchId,
      metadata: { applied, skipped, failed },
    });

    return batch;
  }

  // ── 6. Cancel and history ──────────────────────────────────────────────────

  static async cancel(batchId: string, userId: string) {
    const claimed = await prisma.attendanceImportBatch.updateMany({
      where: { id: batchId, status: { in: [AttendanceImportStatus.UPLOADED, AttendanceImportStatus.VALIDATED, AttendanceImportStatus.FAILED] } },
      data: { status: AttendanceImportStatus.CANCELLED },
    });
    if (!claimed.count) throw new AppError('This import can no longer be cancelled.', 409);
    await createAuditLog({
      actorUserId: userId,
      action: 'ATTENDANCE_IMPORT_CANCELLED',
      entityType: 'ATTENDANCE_IMPORT_BATCH',
      entityId: batchId,
    });
    return { cancelled: true };
  }

  static async listBatches(page = 1, limit = 20) {
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await Promise.all([
      prisma.attendanceImportBatch.findMany({
        // The stored filename is a local path detail and is never returned.
        select: {
          id: true, originalFilename: true, fileSizeBytes: true, status: true,
          uploadedAt: true, confirmedAt: true, completedAt: true,
          detectedPeriodStart: true, detectedPeriodEnd: true, totalSourceRows: true,
          countNew: true, countExactDuplicate: true, countEnrichment: true,
          countConflict: true, countConflictManual: true, countDuplicateInFile: true,
          countUnknownEmployee: true, countInvalid: true,
          countApplied: true, countSkipped: true, countFailed: true,
          normalizerVersion: true, failureReason: true,
          uploadedByUser: { select: { email: true } },
          confirmedByUser: { select: { email: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take,
      }),
      prisma.attendanceImportBatch.count(),
    ]);
    return { rows, pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  /** Maps a source code to an employee, so the next import matches it. */
  static async mapCode(employeeId: string, code: string, userId: string) {
    const trimmed = code.trim();
    if (!trimmed) throw new AppError('A timekeeping code is required.', 400);

    const clash = await prisma.employee.findFirst({
      where: { biometricCode: trimmed, NOT: { id: employeeId } },
      select: { employeeNumber: true },
    });
    if (clash) {
      throw new AppError(`Code ${trimmed} is already assigned to employee ${clash.employeeNumber}.`, 409);
    }

    await prisma.employee.update({ where: { id: employeeId }, data: { biometricCode: trimmed } });
    await createAuditLog({
      actorUserId: userId,
      targetEmployeeId: employeeId,
      action: 'ATTENDANCE_BIOMETRIC_CODE_MAPPED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      metadata: { biometricCode: trimmed },
    });
    return { employeeId, biometricCode: trimmed };
  }
}
