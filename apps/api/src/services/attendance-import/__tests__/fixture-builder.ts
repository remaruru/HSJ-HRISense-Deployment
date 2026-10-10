import * as XLSX from 'xlsx';

/**
 * Builds synthetic Mustard Seedtime workbooks for tests.
 *
 * Modelled on the FORMAT of the official export and nothing else. Every employee
 * here is invented (QA-001, QA-002 …); no name, code or figure from a real
 * export appears in this file or in any test that uses it.
 *
 * The layout mirrors what the real workbook does, including the details that
 * would break a careless parser:
 *   · column B is EMPTY — "In 1" starts at C
 *   · dates and times are numeric serials, not strings
 *   · blocks are separated by blank rows
 *   · each block ends with "Total:" and "Days Present:" / "Days Absent:"
 */

export interface FixtureDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Up to six `[in, out]` pairs as `HH:MM`, or null for a blank cell. */
  pairs?: Array<[string | null, string | null]>;
  hours?: Partial<{ required: number; break: number; worked: number; overtime: number; undertime: number }>;
  /** Writes the date cell as junk text instead of a serial. */
  brokenDate?: boolean;
  /** Writes a punch cell as junk text instead of a serial. */
  brokenPunch?: boolean;
}

export interface FixtureEmployee {
  /** The number that appears in parentheses — matched on, never the name. */
  code: string | null;
  /** Invented display name. Never taken from a real export. */
  name: string;
  days: FixtureDay[];
  daysPresent?: number;
  daysAbsent?: number;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const dateSerial = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - EXCEL_EPOCH) / 86_400_000;
};

const timeSerial = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 1440;
};

export function buildFixtureWorkbook(options: {
  employees: FixtureEmployee[];
  periodStart?: string;
  periodEnd?: string;
  /** Omit the "TIMESHEET REPORT" marker, to test structure detection. */
  omitMarker?: boolean;
}): Buffer {
  const rows: Array<Array<string | number | null>> = [];
  const blank = () => rows.push([]);

  const long = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC',
    });

  /** A value parked in column H, where the real report puts its header lines. */
  const atH = (value: string) => rows.push([null, null, null, null, null, null, null, value]);

  // ── report header ─────────────────────────────────────────────────────────
  // Row offsets copied from the official export: organisation on row 2, address
  // on 4, contact line on 6, the marker on 9 and the period on 11. The parser
  // searches for these rather than indexing them, but a sample that is meant to
  // stand in for the real file should sit where the real file sits.
  blank();
  atH('QA Test Organisation');
  blank();
  atH('QA Address Line, Sample City');
  blank();
  atH('Telephone: 000-0000; Website: example.test');
  blank();
  blank();
  if (!options.omitMarker) {
    atH('TIMESHEET REPORT');
    blank();
    if (options.periodStart && options.periodEnd) {
      atH(`From ${long(options.periodStart)} to ${long(options.periodEnd)}`);
    }
  }
  blank();
  blank();
  blank();
  blank();

  for (const emp of options.employees) {
    rows.push([emp.code === null ? `Employee: ${emp.name}` : `Employee: ${emp.name}  (${emp.code})`]);
    // TWO blank rows before the column header, as the official export writes it.
    blank();
    blank();

    // Header row: note the empty column B — In 1 lands at C.
    rows.push([
      'Date', null,
      'In 1', 'Out 1', 'In 2', 'Out 2', 'In 3', 'Out 3',
      'In 4', 'Out 4', 'In 5', 'Out 5', 'In 6', 'Out 6',
      'Hrs Required', 'Tot Hrs Break', 'Hrs Worked', 'Hrs OT', 'Hrs UT',
    ]);
    blank();

    for (const day of emp.days) {
      const row: Array<string | number | null> = new Array(19).fill(null);
      row[0] = day.brokenDate ? 'not-a-date' : dateSerial(day.date);

      (day.pairs ?? []).slice(0, 6).forEach((pair, i) => {
        const [inTime, outTime] = pair;
        if (inTime !== null) row[2 + i * 2] = day.brokenPunch ? 'not-a-time' : timeSerial(inTime);
        if (outTime !== null) row[3 + i * 2] = timeSerial(outTime);
      });

      const h = day.hours ?? {};
      row[14] = h.required ?? 0;
      row[15] = h.break ?? 0;
      row[16] = h.worked ?? 0;
      row[17] = h.overtime ?? 0;
      row[18] = h.undertime ?? 0;
      rows.push(row);
    }

    rows.push(['Total:']);
    const footer: Array<string | number | null> = new Array(19).fill(null);
    footer[0] = 'Days Present:';
    footer[2] = emp.daysPresent ?? emp.days.filter((d) => (d.pairs ?? []).length > 0).length;
    footer[3] = 'Days Absent:';
    footer[6] = emp.daysAbsent ?? 0;
    // The real footer also carries the block's hour totals under their columns.
    // They are decoration as far as the parser is concerned - it must ignore this
    // row - which is exactly why the sample should carry them.
    const sum = (pick: (h: NonNullable<FixtureDay['hours']>) => number | undefined) =>
      Math.round(emp.days.reduce((t, d) => t + (pick(d.hours ?? {}) ?? 0), 0) * 100) / 100;
    footer[15] = sum((h) => h.break);
    footer[16] = sum((h) => h.worked);
    footer[17] = sum((h) => h.overtime);
    footer[18] = sum((h) => h.undertime);
    rows.push(footer);
    // Five blank rows between blocks, as the official export writes it.
    blank(); blank(); blank(); blank(); blank();
  }

  // ── file footer ───────────────────────────────────────────────────────────
  rows.push(['TOTAL EMPLOYEES:', null, null, options.employees.length]);
  blank();
  blank();
  rows.push(['Total Working Days:', null, null, options.employees[0]?.days.length ?? 0]);
  rows.push(['Total Holidays W/in the Period:', null, null, 0]);
  blank();
  rows.push([
    'Total Hours Required:', null, null,
    Math.round(
      options.employees[0]?.days.reduce((t, d) => t + (d.hours?.required ?? 0), 0) ?? 0
    ),
  ]);
  blank();
  blank();
  const reportDate = options.periodEnd ? `Report Date: ${long(options.periodEnd)}` : null;
  rows.push([
    'Mustard Seed Systems Bio-office Time and Attendance',
    null, null, null, null, null, null, 'Page -1 of 1',
    null, null, null, null, null, null, reportDate,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });

  // The official export declares a 20-column range whose last column (T) is
  // entirely empty. Harmless, but a sample standing in for that file should have
  // the same shape, and it proves the parser tolerates a trailing empty column.
  const declared = XLSX.utils.decode_range(ws['!ref'] as string);
  declared.e.c = Math.max(declared.e.c, 19);
  ws['!ref'] = XLSX.utils.encode_range(declared);

  // aoa_to_sheet types numbers as plain numbers; the parser distinguishes dates
  // from times by their FORMAT, so the fixture must carry formats like the real
  // file does.
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (a && a.t === 'n') a.z = 'mm"/"dd"/"yyyy';
    for (let c = 2; c <= 13; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = 'h:mm AM/PM';
    }
    for (let c = 14; c <= 18; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = '#,##0.00_);-#,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  // `.xls` (BIFF8) on purpose: the production file is legacy Excel, and a test
  // that only ever feeds the parser `.xlsx` would not prove it reads the real one.
  return XLSX.write(wb, { type: 'buffer', bookType: 'xls' }) as Buffer;
}
