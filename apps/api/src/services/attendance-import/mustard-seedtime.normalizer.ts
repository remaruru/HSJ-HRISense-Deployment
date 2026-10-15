import type {
  AttendanceNormalizer,
  NormalizationResult,
  NormalizedDailyCandidate,
  RawSourceRow,
} from './normalizer';
import type { RawMustardDay, RawMustardWorkbook } from './mustard-seedtime.reader';

/**
 * Turns a parsed Mustard Seedtime workbook into one normalized candidate per
 * employee-day.
 *
 * ── What this deliberately does NOT do ───────────────────────────────────────
 * It assigns NO attendance status. Not PRESENT, not ABSENT, not LATE. Deciding
 * those needs Hospicio policy (lateness thresholds, half-day rules) that has not
 * been confirmed, and a punch is not by itself proof of a status. `status` is
 * left null and the facts are carried instead. A later, separate step compares
 * the day against the schedule, leave and holidays and records what it finds as
 * review flags — still without inventing a verdict.
 *
 * It also never matches on a name. The export's employee line carries a numeric
 * code in parentheses; that code is matched against `Employee.biometricCode` and
 * nothing else. An unmatched code produces a candidate with a null employee, to
 * be reported as UNKNOWN_EMPLOYEE — never attached to a similar-looking person.
 */

/** Philippine Standard Time. Fixed at UTC+8: the country observes no DST. */
const PHT_OFFSET_MINUTES = 8 * 60;

/**
 * A Manila wall-clock time on a given day, as the instant it actually was.
 *
 * The export writes local times with no zone. Stored as a true instant, the UI —
 * which formats in the viewer's own zone — shows the same clock face the
 * timekeeping device printed.
 */
export function phtInstant(date: string, minutesFromMidnight: number): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, minutesFromMidnight - PHT_OFFSET_MINUTES, 0, 0));
}

/** `HH:MM` for the stored session list, so the file's own clock face survives. */
const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const MUSTARD_FLAGS = {
  INCOMPLETE_PUNCH: 'INCOMPLETE_PUNCH',
  OUT_WITHOUT_IN: 'OUT_WITHOUT_IN',
  MULTIPLE_SESSIONS: 'MULTIPLE_SESSIONS',
  NON_SEQUENTIAL_PUNCHES: 'NON_SEQUENTIAL_PUNCHES',
  HOURS_WITHOUT_PUNCHES: 'HOURS_WITHOUT_PUNCHES',
  PUNCHES_WITHOUT_HOURS: 'PUNCHES_WITHOUT_HOURS',
  HOURS_DISAGREE_WITH_PUNCHES: 'HOURS_DISAGREE_WITH_PUNCHES',
  FUTURE_DATE: 'FUTURE_DATE',
  NO_PUNCHES: 'NO_PUNCHES',
  IMPLAUSIBLE_DURATION: 'IMPLAUSIBLE_DURATION',
} as const;

/**
 * How far the source's own hours may sit from the span the punches describe
 * before it is worth telling HR. Generous on purpose: breaks, rounding and the
 * device's own rules all legitimately move this, and the point is to surface a
 * real disagreement, not to audit the export's arithmetic.
 *
 * Measured against the official file: comparing the span with "Hrs Worked"
 * ALONE matched only 33% of days, because the export reports overtime in a
 * separate column and excludes it from "Hrs Worked". Comparing against
 * worked + overtime matches 87%, so that is the comparison — the earlier one
 * would have flagged a third of every import for nothing.
 */
const HOURS_TOLERANCE = 1.0;

/**
 * Hours in one day beyond which the row is reporting something a person did not
 * physically do, and the likeliest explanation is a punch-out that never
 * happened.
 *
 * A sanity bound on the DATA, deliberately not a rule about overtime: it is set
 * far above any real shift so that a long, genuine day is never questioned. If
 * Hospicio ever runs shifts longer than this, raise it - it is not a policy.
 */
const IMPLAUSIBLE_DAY_HOURS = 16;

export interface MustardNormalizerDeps {
  /**
   * Resolves source employee codes to HRISense employee ids in one call.
   * Codes with no match must be ABSENT from the returned map, never guessed.
   */
  resolveEmployeeIdsByCode(codes: string[]): Promise<Map<string, string>>;
  /** Injected so tests can pin "now" rather than depending on the clock. */
  now?: () => Date;
}

export class MustardSeedtimeNormalizer implements AttendanceNormalizer {
  readonly version = 'mustard-seedtime/1.0.0';
  readonly displayName = 'Mustard Seed Systems Bio-office — Timesheet Report (.xls)';

  constructor(private readonly deps: MustardNormalizerDeps) {}

  /**
   * The registry contract takes flat `RawSourceRow[]`. The Mustard file is not
   * flat, so the batch service parses it into blocks first and stages each day
   * as one raw row whose payload carries its block's code. `normalize` therefore
   * works from the payloads, which is also what makes the staged rows a faithful
   * record of what was read.
   */
  async normalize(rows: RawSourceRow[]): Promise<NormalizationResult> {
    const codes = new Set<string>();
    for (const row of rows) {
      const code = (row.payload as unknown as MustardRowPayload).employeeCode;
      if (code) codes.add(code);
    }
    const resolved = await this.deps.resolveEmployeeIdsByCode([...codes]);
    const now = (this.deps.now ?? (() => new Date()))();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);

    const candidates = rows.map((row) =>
      this.toCandidate(row, resolved, today)
    );
    return { candidates, normalizerVersion: this.version };
  }

  private toCandidate(
    row: RawSourceRow,
    resolved: Map<string, string>,
    today: string
  ): NormalizedDailyCandidate {
    const payload = row.payload as unknown as MustardRowPayload;
    const day = payload.day;
    const code = payload.employeeCode;

    const base: NormalizedDailyCandidate = {
      sourceRowNumbers: [row.sourceRowNumber],
      employeeId: code ? resolved.get(code) ?? null : null,
      sourceEmployeeIdentifier: code,
      date: day.date,
      timeIn: null,
      timeOut: null,
      status: null,
      hoursWorked: null,
      overtimeHours: null,
      sessions: null,
      sourceHours: null,
      reviewFlags: [],
      invalidReason: null,
    };

    if (!code) {
      base.invalidReason = 'This employee section carried no identifier in parentheses, so its rows cannot be attributed to anyone.';
      return base;
    }
    if (!day.date) {
      base.invalidReason = `The date on this row could not be read (the cell showed "${day.dateDisplay || 'nothing'}").`;
      return base;
    }

    // ── punches ───────────────────────────────────────────────────────────
    const sessions: Array<{ in: string | null; out: string | null }> = [];
    const flags = new Set<string>();
    let firstIn: number | null = null;
    let lastOut: number | null = null;
    let unreadable = false;

    for (const pair of day.pairs) {
      const inM = pair.in ? pair.in.minutes : null;
      const outM = pair.out ? pair.out.minutes : null;

      if ((pair.in && inM === null) || (pair.out && outM === null)) {
        unreadable = true;
        continue;
      }

      sessions.push({ in: inM === null ? null : hhmm(inM), out: outM === null ? null : hhmm(outM) });

      // An unclosed pair is reported, never completed with a guess.
      if (inM !== null && outM === null) flags.add(MUSTARD_FLAGS.INCOMPLETE_PUNCH);
      if (inM === null && outM !== null) flags.add(MUSTARD_FLAGS.OUT_WITHOUT_IN);

      if (inM !== null && (firstIn === null || inM < firstIn)) firstIn = inM;
      if (outM !== null && (lastOut === null || outM > lastOut)) lastOut = outM;
    }

    if (unreadable) {
      base.invalidReason = 'A punch time on this row could not be read as a time.';
      return base;
    }

    if (sessions.length > 1) flags.add(MUSTARD_FLAGS.MULTIPLE_SESSIONS);
    if (sessions.length === 0) flags.add(MUSTARD_FLAGS.NO_PUNCHES);

    /*
     * An OUT earlier than its IN is the shape an overnight shift would take, but
     * the export stores every punch as a time of day with no date part — so the
     * file itself cannot say whether the OUT belongs to the next morning or was
     * simply recorded oddly. Rather than attach a punch to a date the file never
     * stated, the pair is preserved as-is and flagged for a human.
     */
    for (const s of sessions) {
      if (s.in && s.out && s.out < s.in) flags.add(MUSTARD_FLAGS.NON_SEQUENTIAL_PUNCHES);
    }

    // ── the source's own hour columns, kept exactly as exported ───────────
    const hours = day.hours;
    const sourceHours = {
      required: hours.required,
      break: hours.break,
      worked: hours.worked,
      overtime: hours.overtime,
      undertime: hours.undertime,
    };

    const hasPunches = sessions.length > 0;
    const workedReported = hours.worked !== null && hours.worked > 0;
    if (hasPunches && !workedReported) flags.add(MUSTARD_FLAGS.PUNCHES_WITHOUT_HOURS);
    if (!hasPunches && workedReported) flags.add(MUSTARD_FLAGS.HOURS_WITHOUT_PUNCHES);

    // Compare, never replace: both numbers are kept and the gap is reported.
    if (hasPunches && workedReported && firstIn !== null && lastOut !== null && lastOut > firstIn) {
      const spanHours = (lastOut - firstIn) / 60;
      const reported = (hours.worked ?? 0) + (hours.overtime ?? 0);
      if (Math.abs(spanHours - reported) > HOURS_TOLERANCE) {
        flags.add(MUSTARD_FLAGS.HOURS_DISAGREE_WITH_PUNCHES);
      }
    }

    // A day nobody could actually have worked.
    //
    // The comparison above only catches hours that DISAGREE with the punches; a
    // twenty-hour span whose hours agree with it passes cleanly, and that is
    // precisely the shape of a missed punch-out rolling into the next day. This
    // is a data-sanity bound, NOT a policy about overtime: it says "a human did
    // not do this", and leaves what to do about it to HR.
    const longestSpan = firstIn !== null && lastOut !== null && lastOut > firstIn
      ? (lastOut - firstIn) / 60
      : 0;
    const reportedTotal = (hours.worked ?? 0) + (hours.overtime ?? 0);
    if (Math.max(longestSpan, reportedTotal) > IMPLAUSIBLE_DAY_HOURS) {
      flags.add(MUSTARD_FLAGS.IMPLAUSIBLE_DURATION);
    }

    if (day.date > today) flags.add(MUSTARD_FLAGS.FUTURE_DATE);

    base.timeIn = firstIn === null ? null : phtInstant(day.date, firstIn);
    base.timeOut = lastOut === null ? null : phtInstant(day.date, lastOut);
    base.sessions = sessions.length ? sessions : null;
    base.sourceHours = sourceHours;
    base.hoursWorked = hours.worked;
    base.overtimeHours = hours.overtime;
    base.reviewFlags = [...flags];
    return base;
  }
}

/** The payload shape staged for every Mustard day row. */
export interface MustardRowPayload {
  employeeCode: string | null;
  /** The employee line with the name removed — never the person's name. */
  employeeLabel: string;
  day: RawMustardDay;
}

/**
 * Flattens a parsed workbook into the raw rows the pipeline stages.
 * One row per employee-day, carrying its block's code so the flat contract holds.
 */
export function toRawSourceRows(workbook: RawMustardWorkbook): RawSourceRow[] {
  const rows: RawSourceRow[] = [];
  for (const block of workbook.blocks) {
    for (const day of block.days) {
      rows.push({
        sourceRowNumber: day.sourceRowNumber,
        sourceSheetName: workbook.sheetName,
        payload: {
          employeeCode: block.code,
          employeeLabel: block.label,
          day,
        } satisfies MustardRowPayload as unknown as Record<string, unknown>,
      });
    }
  }
  return rows;
}
