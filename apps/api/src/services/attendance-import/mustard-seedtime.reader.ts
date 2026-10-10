import * as XLSX from 'xlsx';

/**
 * Reads a Mustard Seed Systems Bio-office "TIMESHEET REPORT" workbook into flat
 * raw rows. Reading only — no attendance meaning is assigned here.
 *
 * ── The format, as observed in the official export ───────────────────────────
 * Legacy BIFF `.xls` (OLE2 compound document), a single worksheet, no merged
 * cells. One report header at the top, then one block per employee, then a file
 * footer. Nothing repeats per page.
 *
 *   report header   row with "TIMESHEET REPORT", and a row
 *                   "From <Month DD, YYYY> to <Month DD, YYYY>"
 *   employee line   col A: "Employee: <NAME>  (<CODE>)"      ← code in parens
 *   column header   col A: "Date", then the punch/hours labels
 *   data rows       col A: a date serial; punches and hours across
 *   employee footer col A: "Total:", then "Days Present:" / "Days Absent:"
 *   file footer     "TOTAL EMPLOYEES:", "Total Working Days:",
 *                   "Total Holidays W/in the Period:", "Total Hours Required:"
 *
 * ── Column positions ─────────────────────────────────────────────────────────
 * Read from the header row of each block rather than hardcoded, because column B
 * is EMPTY in the official file — "In 1" sits at C, not B — and trusting a fixed
 * offset would silently shift every punch by one column in any future export
 * that closes that gap. The labels are the contract; the positions are not.
 *
 * ── Cell types ───────────────────────────────────────────────────────────────
 * Dates and times are both numeric serials, distinguished by their format:
 *   date   `mm"/"dd"/"yyyy`, integer part = the day
 *   punch  `h:mm AM/PM`, value strictly between 0 and 1 = fraction of a day
 * Every punch in the official file is < 1, so the format carries NO date part on
 * a punch and therefore cannot express a punch after midnight. That is a
 * property of the source, and the parser does not paper over it.
 */

/** A punch as the file gave it: minutes from midnight, plus the display text. */
export interface RawPunch {
  /** 0–1439. Null when the cell held something unreadable. */
  minutes: number | null;
  /** What the sheet displayed, e.g. "6:02 AM". Kept verbatim for HR. */
  display: string;
}

export interface RawMustardDay {
  /** 1-based row in the sheet, for "row 47" messages. */
  sourceRowNumber: number;
  /** `YYYY-MM-DD`, or null when the date cell could not be read. */
  date: string | null;
  /** Whatever the date cell displayed, kept for invalid-row reporting. */
  dateDisplay: string;
  /** Up to six pairs, in file order. A side that was blank stays null. */
  pairs: Array<{ in: RawPunch | null; out: RawPunch | null }>;
  hours: {
    required: number | null;
    break: number | null;
    worked: number | null;
    overtime: number | null;
    undertime: number | null;
  };
}

export interface RawMustardEmployeeBlock {
  /** Row of the "Employee:" line. */
  sourceRowNumber: number;
  /** The identifier in parentheses. Null when the line carried none. */
  code: string | null;
  /**
   * The employee line verbatim, MINUS the name.
   *
   * The name is deliberately dropped at the edge of the system: it is never
   * needed — matching is on `code` alone — and keeping it out means it cannot
   * leak into staged rows, logs or error messages later.
   */
  label: string;
  /**
   * The name exactly as the file wrote it, kept ONLY so the identity verifier can
   * compare it against the employee this code resolves to.
   *
   * NEVER persist this, log it, or include it in an error message. It is dropped
   * the moment verification has produced a verdict. See
   * `transientNameFromEmployeeLine`.
   */
  nameForVerificationOnly: string | null;
  days: RawMustardDay[];
  footer: { daysPresent: number | null; daysAbsent: number | null };
}

export interface RawMustardWorkbook {
  sheetName: string;
  /** From the "From … to …" header line, when present. */
  reportPeriod: { start: string | null; end: string | null };
  /** From the file footer, used only to sanity-check the parse. */
  reportTotals: { employees: number | null; workingDays: number | null };
  blocks: RawMustardEmployeeBlock[];
}

export class MustardParseError extends Error {}

/** Excel serial → `YYYY-MM-DD`, using the workbook's own epoch handling. */
function serialToDate(serial: number, date1904: boolean): string | null {
  const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

/** Time-of-day serial (0 ≤ v < 1) → minutes from midnight. */
function serialToMinutes(serial: number): number | null {
  if (!Number.isFinite(serial)) return null;
  const fraction = serial - Math.floor(serial);
  const minutes = Math.round(fraction * 24 * 60);
  if (minutes < 0 || minutes > 1439) return null;
  return minutes;
}

const text = (cell: XLSX.CellObject | undefined): string =>
  cell == null || cell.v == null ? '' : String(cell.w ?? cell.v).trim();

const num = (cell: XLSX.CellObject | undefined): number | null =>
  cell && cell.t === 'n' && typeof cell.v === 'number' ? cell.v : null;

/** Labels of the five hour columns, lowercased, as the header row spells them. */
const HOURS_LABELS: Record<string, keyof RawMustardDay['hours']> = {
  'hrs required': 'required',
  'tot hrs break': 'break',
  'hrs worked': 'worked',
  'hrs ot': 'overtime',
  'hrs ut': 'undertime',
};

interface ColumnMap {
  date: number;
  pairs: Array<{ in: number | null; out: number | null }>;
  hours: Partial<Record<keyof RawMustardDay['hours'], number>>;
}

/** Builds the column map from a "Date" header row. Positions are never assumed. */
function readHeaderRow(ws: XLSX.WorkSheet, row: number, lastCol: number): ColumnMap {
  const map: ColumnMap = { date: -1, pairs: [], hours: {} };
  const pairIndex = new Map<number, { in: number | null; out: number | null }>();

  for (let c = 0; c <= lastCol; c++) {
    const label = text(ws[XLSX.utils.encode_cell({ r: row, c })]).toLowerCase();
    if (!label) continue;
    if (label === 'date') { map.date = c; continue; }

    const punch = /^(in|out)\s*(\d+)$/.exec(label);
    if (punch) {
      const n = Number(punch[2]);
      const slot = pairIndex.get(n) ?? { in: null, out: null };
      if (punch[1] === 'in') slot.in = c; else slot.out = c;
      pairIndex.set(n, slot);
      continue;
    }

    const hours = HOURS_LABELS[label];
    if (hours) map.hours[hours] = c;
  }

  map.pairs = [...pairIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
  return map;
}

/** Strips the employee name, keeping only the structural shape and the code. */
function safeEmployeeLabel(line: string, code: string | null): string {
  return code ? `Employee (${code})` : 'Employee (no code)';
}

/**
 * The name as the file wrote it — for IN-MEMORY VERIFICATION ONLY.
 *
 * This is the one place a name survives the reader, and it exists for a single
 * purpose: comparing it against the employee its code resolves to, so that a
 * device number quietly reassigned to a different person is caught instead of
 * silently filing one person's attendance under another's.
 *
 * It must never be persisted, logged, or put in an error message. `toRawSourceRows`
 * deliberately does not copy it into the staged payload, and a test asserts that.
 * What gets stored is the VERDICT of the comparison, never its input.
 */
function transientNameFromEmployeeLine(line: string): string | null {
  const afterLabel = line.replace(RE_EMPLOYEE, '');
  const withoutCode = afterLabel.replace(RE_CODE, '');
  const name = withoutCode.trim();
  return name || null;
}

const RE_EMPLOYEE = /^employee\s*:/i;
/*
 * The identifier in the trailing parentheses.
 *
 * Every code in the official export is numeric, but requiring digits ONLY meant
 * a device that ever emitted an alphanumeric code would parse as "no identifier"
 * and silently invalidate that employee's whole block. So the shape is widened —
 * while still requiring at least one digit, so a name ending in a parenthetical
 * such as "(JR)" is not mistaken for a code.
 */
const RE_CODE = /\(([A-Za-z0-9][A-Za-z0-9._-]*)\)\s*$/;
const looksLikeCode = (value: string) => /\d/.test(value);
const RE_TOTAL = /^total\s*:?$/i;
const RE_DAYS_PRESENT = /^days\s+present/i;
const RE_DAYS_ABSENT = /^days\s+absent/i;
const RE_PERIOD = /from\s+(.+?)\s+to\s+(.+?)\s*$/i;

/** "September 01, 2026" → `2026-09-01`. Returns null rather than guessing. */
function parseLongDate(value: string): string | null {
  const parsed = Date.parse(value.trim());
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export class MustardSeedtimeReader {
  /**
   * Parses a workbook buffer. Throws only when the file is not a Mustard
   * timesheet at all — anything wrong with an individual row is carried in the
   * row so the rest of the import can still proceed.
   */
  static read(buffer: Buffer): RawMustardWorkbook {
    let wb: XLSX.WorkBook;
    try {
      // No macro or embedded-content handling is requested: cell values only.
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: true, cellFormula: false, cellHTML: false });
    } catch {
      throw new MustardParseError('The file could not be opened as an Excel workbook.');
    }

    const sheetName = wb.SheetNames[0];
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws || !ws['!ref']) throw new MustardParseError('The workbook has no readable worksheet.');

    const date1904 = !!(wb.Workbook?.WBProps as { date1904?: boolean } | undefined)?.date1904;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const lastCol = range.e.c;

    const result: RawMustardWorkbook = {
      sheetName,
      reportPeriod: { start: null, end: null },
      reportTotals: { employees: null, workingDays: null },
      blocks: [],
    };

    let sawTimesheetMarker = false;
    let block: RawMustardEmployeeBlock | null = null;
    let columns: ColumnMap | null = null;

    for (let r = range.s.r; r <= range.e.r; r++) {
      // Scan the whole row once: the report header sits in a middle column, not A.
      const cells: string[] = [];
      let hasAnything = false;
      for (let c = 0; c <= lastCol; c++) {
        const t = text(ws[XLSX.utils.encode_cell({ r, c })]);
        cells.push(t);
        if (t) hasAnything = true;
      }
      if (!hasAnything) continue; // blank rows are structural padding, not data

      const joined = cells.join(' ');
      if (/timesheet\s+report/i.test(joined)) { sawTimesheetMarker = true; continue; }

      if (!result.reportPeriod.start) {
        const period = RE_PERIOD.exec(joined);
        if (period && /from/i.test(joined)) {
          result.reportPeriod.start = parseLongDate(period[1]);
          result.reportPeriod.end = parseLongDate(period[2]);
          continue;
        }
      }

      const first = cells[0];

      // ── file footer ───────────────────────────────────────────────────────
      if (/^total\s+employees/i.test(first)) {
        result.reportTotals.employees = firstNumberInRow(ws, r, lastCol);
        continue;
      }
      if (/^total\s+working\s+days/i.test(first)) {
        result.reportTotals.workingDays = firstNumberInRow(ws, r, lastCol);
        continue;
      }

      // ── employee block boundary ───────────────────────────────────────────
      if (RE_EMPLOYEE.test(first)) {
        const raw = (RE_CODE.exec(first) ?? [])[1] ?? null;
        const code = raw && looksLikeCode(raw) ? raw : null;
        block = {
          sourceRowNumber: r + 1,
          code,
          label: safeEmployeeLabel(first, code),
          nameForVerificationOnly: transientNameFromEmployeeLine(first),
          days: [],
          footer: { daysPresent: null, daysAbsent: null },
        };
        columns = null;
        result.blocks.push(block);
        continue;
      }

      // ── column header inside a block ──────────────────────────────────────
      if (first.toLowerCase() === 'date') {
        columns = readHeaderRow(ws, r, lastCol);
        continue;
      }

      if (!block) continue; // anything before the first employee line is report chrome

      // ── per-employee footer ───────────────────────────────────────────────
      if (RE_TOTAL.test(first)) continue; // a totals line, never an attendance day
      if (RE_DAYS_PRESENT.test(first)) {
        // "Days Present:" and "Days Absent:" share the row; each value is the
        // next number after its own label, so the labels are located first.
        block.footer.daysPresent = numberAfterLabel(ws, r, lastCol, RE_DAYS_PRESENT);
        block.footer.daysAbsent = numberAfterLabel(ws, r, lastCol, RE_DAYS_ABSENT);
        continue;
      }

      // ── attendance day ────────────────────────────────────────────────────
      const dateCell = ws[XLSX.utils.encode_cell({ r, c: columns?.date ?? 0 })];
      const dateSerial = num(dateCell);
      if (dateSerial === null) continue; // not a data row; nothing is guessed from it

      const day: RawMustardDay = {
        sourceRowNumber: r + 1,
        date: serialToDate(dateSerial, date1904),
        dateDisplay: text(dateCell),
        pairs: [],
        hours: { required: null, break: null, worked: null, overtime: null, undertime: null },
      };

      const pairCols = columns?.pairs ?? [];
      for (const slot of pairCols) {
        const readPunch = (col: number | null): RawPunch | null => {
          if (col === null) return null;
          const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
          if (!cell || cell.v == null || cell.v === '') return null;
          const serial = num(cell);
          return {
            minutes: serial === null ? null : serialToMinutes(serial),
            display: text(cell),
          };
        };
        const inPunch = readPunch(slot.in);
        const outPunch = readPunch(slot.out);
        if (inPunch || outPunch) day.pairs.push({ in: inPunch, out: outPunch });
      }

      for (const [key, col] of Object.entries(columns?.hours ?? {})) {
        day.hours[key as keyof RawMustardDay['hours']] = num(ws[XLSX.utils.encode_cell({ r, c: col as number })]);
      }

      block.days.push(day);
    }

    if (!sawTimesheetMarker && result.blocks.length === 0) {
      throw new MustardParseError(
        'No Mustard Seedtime timesheet structure was found in this file. Expected a "TIMESHEET REPORT" header and at least one "Employee:" section.'
      );
    }
    if (result.blocks.length === 0) {
      throw new MustardParseError('No employee sections were found in this timesheet.');
    }

    return result;
  }
}

function firstNumberInRow(ws: XLSX.WorkSheet, row: number, lastCol: number): number | null {
  for (let c = 0; c <= lastCol; c++) {
    const v = num(ws[XLSX.utils.encode_cell({ r: row, c })]);
    if (v !== null) return v;
  }
  return null;
}

/** The first number to the right of the cell whose text matches `label`. */
function numberAfterLabel(ws: XLSX.WorkSheet, row: number, lastCol: number, label: RegExp): number | null {
  let found = -1;
  for (let c = 0; c <= lastCol; c++) {
    if (label.test(text(ws[XLSX.utils.encode_cell({ r: row, c })]))) { found = c; break; }
  }
  if (found < 0) return null;
  for (let c = found + 1; c <= lastCol; c++) {
    const v = num(ws[XLSX.utils.encode_cell({ r: row, c })]);
    if (v !== null) return v;
  }
  return null;
}
