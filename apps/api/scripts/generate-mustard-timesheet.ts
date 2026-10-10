/**
 * Generates a Mustard Seedtime timesheet of FAKE attendance for the employees in
 * this HRISense database, in the exact format of a real export.
 *
 *   npx tsx scripts/generate-mustard-timesheet.ts <real-export.xls> <output.xls | folder> [--from 2026-09-01] [--to 2026-09-30]
 *
 * The real export is used only as a TEMPLATE: its fonts, cell styles, margins,
 * page setup, header lines and block layout are reused record for record, and
 * every row of attendance is generated. None of the template's people, punches
 * or hours reach the output - the output is scanned afterwards to prove it.
 * The three defects of the export are fixed the same way as in
 * remap-mustard-export.ts (see lib/mustard-biff5.ts).
 *
 * ── How the fake attendance behaves, and where each rule comes from ──────────
 * Measured from a real Hospicio export (aggregate figures only):
 *   · Monday to Saturday are workdays with 9 hours required; Sunday is off.
 *   · Clock-in clusters before 08:00 (median 07:28), clock-out after 17:00
 *     (median 17:11).
 *   · Hours follow the device's own rule, which fits 79% of real days exactly:
 *     worked = time inside the shift, overtime = time outside it,
 *     undertime = required - worked, break 0.
 *   · A day with no punches carries 0 in every hours column.
 * An employee with a schedule in HRISense punches around THAT shift and keeps
 * its days off, so the importer's schedule checks see ordinary days.
 *
 * Problems are planted at low, deliberate rates so the review queue has real
 * work without drowning the import: a forgotten clock-out now and then, a device
 * glitch that records punches but no hours, a lunch punch-out, and a few people
 * clocking in on the 28 September holiday.
 *
 * Codes, order and the unmapped tail match generate-sample-timesheet.ts, so its
 * `--apply-codes` maps this file too.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { MustardSeedtimeReader } from '../src/services/attendance-import/mustard-seedtime.reader';
import { MustardSeedtimeNormalizer, toRawSourceRows } from '../src/services/attendance-import/mustard-seedtime.normalizer';
import { AttendanceDayContextService } from '../src/services/attendance-import/day-context.service';
import { isHeld } from '../src/services/attendance-import/review-flags';
import {
  FIRST_CODE, LEAVE_UNMAPPED, REC, type Rec,
  applyExportFixes, cell, containerEntries, deviceName, labelRecord, numberRecord,
  readBiff5, resolveOutput, serialize, writeContainer,
} from './lib/mustard-biff5';

// ── attendance model ─────────────────────────────────────────────────────────
const REQUIRED_HOURS = 9;
const DEFAULT_SHIFT = { start: 8 * 60, end: 17 * 60 };
/** The one approved holiday in September 2026 in this database. */
const HOLIDAY = '2026-09-28';
const HOLIDAY_WORKERS = 8;
const RATE = {
  absent: 0.04,          // a workday with nobody at the device
  late: 0.1,             // arrives after the shift starts
  forgotOut: 0.012,      // clocked in, never clocked out
  deviceGlitch: 0.004,   // punches recorded, hours left at zero
  lunchPunch: 0.008,     // punched out and back in at midday
};

// ── helpers ──────────────────────────────────────────────────────────────────
/** Deterministic, so the same inputs always produce the same file. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const dateSerial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - EXCEL_EPOCH) / 86_400_000;
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC',
});
function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface Session { in: number; out: number | null } // minutes, possibly fractional
interface Day {
  date: string;
  sessions: Session[];
  hours: { required: number; break: number; worked: number; overtime: number; undertime: number };
}

/** Hours the way the device computes them, measured against real exports. */
function deviceHours(sessions: Session[], shift: { start: number; end: number }, required: number) {
  let inside = 0, total = 0;
  for (const s of sessions) {
    if (s.out === null) continue;
    total += s.out - s.in;
    inside += Math.max(0, Math.min(s.out, shift.end) - Math.max(s.in, shift.start));
  }
  const worked = round2(inside / 60);
  return { required, break: 0, worked, overtime: round2((total - inside) / 60), undertime: round2(Math.max(0, required - worked)) };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const [tplArg, outArg] = positional;
  if (!tplArg || !outArg) throw new Error('Usage: generate-mustard-timesheet.ts <real-export.xls> <output.xls | folder> [--from YYYY-MM-DD] [--to YYYY-MM-DD]');
  const FROM = flag('--from', '2026-09-01');
  const TO = flag('--to', '2026-09-30');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(FROM) || !/^\d{4}-\d{2}-\d{2}$/.test(TO) || FROM > TO) throw new Error('Bad --from/--to.');
  const outPath = resolveOutput(resolve(outArg));

  const tpl = readBiff5(resolve(tplArg));
  const globals = tpl.records.slice(0, tpl.sheetStart);
  const sheet = tpl.records.slice(tpl.sheetStart);
  const firstCell = sheet.findIndex((r) => r.type === REC.LABEL || r.type === REC.NUMBER);
  let lastCell = -1;
  sheet.forEach((r, i) => { if (r.type === REC.LABEL || r.type === REC.NUMBER) lastCell = i; });
  const prelude = sheet.slice(0, firstCell);
  const postlude = sheet.slice(lastCell + 1);
  const cells = sheet.slice(firstCell, lastCell + 1);

  // ── learn the template's anatomy; refuse if it is not what this expects ──────
  const byRow = new Map<number, Rec[]>();
  for (const c of cells) { const r = cell.row(c); byRow.set(r, [...(byRow.get(r) ?? []), c]); }
  const at = (row: number, col: number) => byRow.get(row)?.find((c) => cell.col(c) === col);
  const need = (row: number, col: number, what: string) => {
    const c = at(row, col); if (!c) throw new Error(`Template is missing ${what} at row ${row + 1}.`); return c;
  };
  const textRows = (pattern: RegExp) => cells.filter((c) => c.type === REC.LABEL && cell.col(c) === 0 && pattern.test(cell.text(c))).map(cell.row);

  const empRows = textRows(/^employee\s*:/i);
  const footRows = textRows(/^days present/i);
  if (!empRows.length || empRows.length !== footRows.length) throw new Error('Template block structure not recognised.');
  const E = empRows[0];
  const tplDays = footRows[0] - (E + 6);
  if (at(E + 5 + tplDays, 0) === undefined || !/^total\s*:?$/i.test(cell.text(at(E + 5 + tplDays, 0)!))) {
    throw new Error('Template block layout differs from the verified one.');
  }
  if (empRows[1] !== undefined && empRows[1] !== footRows[0] + 6) throw new Error('Template block spacing differs.');

  // Header lines (column H) above the first block: kept verbatim except the period.
  const headerLines = cells.filter((c) => cell.row(c) < E && c.type === REC.LABEL);
  const periodLine = headerLines.find((c) => /^from\s/i.test(cell.text(c)));
  if (!periodLine) throw new Error('Template has no "From ... to ..." period line.');

  const empXf = cell.xf(need(E, 0, 'the employee line'));
  const headerCells = byRow.get(E + 3) ?? [];
  if (!headerCells.some((c) => c.type === REC.LABEL && cell.text(c) === 'Date')) throw new Error('Template column header not found.');

  // Data-row styles, gathered across every template day so an absent first day does not matter.
  const dataXf = new Map<number, number>();
  for (let e = 0; e < empRows.length; e++) {
    for (let d = 0; d < tplDays; d++) {
      for (const c of byRow.get(empRows[e] + 5 + d) ?? []) if (!dataXf.has(cell.col(c))) dataXf.set(cell.col(c), cell.xf(c));
    }
  }
  for (const col of [0, 2, 14, 15, 16, 17, 18]) if (!dataXf.has(col)) throw new Error(`Template has no data cell style for column ${col}.`);
  const timeXf = (col: number) => dataXf.get(col) ?? dataXf.get(2)!;

  const totalRow = E + 5 + tplDays;
  const totalXf = cell.xf(need(totalRow, 0, '"Total:"'));
  const foot = footRows[0];
  const footLabel = [need(foot, 0, 'Days Present'), need(foot, 3, 'Days Absent')];
  const footNumXf = { c2: cell.xf(need(foot, 2, 'present count')), c6: cell.xf(need(foot, 6, 'absent count')) };
  const footHoursXf = new Map([15, 16, 17, 18].map((col) => [col, cell.xf(need(foot, col, `footer column ${col}`))]));

  // File footer, anchored on the last block's footer as in the verified layout.
  const F = footRows[footRows.length - 1];
  const fileFoot = {
    totalEmp: F + 7, workDays: F + 10, holidays: F + 11, hoursReq: F + 13, last: F + 16,
  };
  for (const [what, row] of Object.entries(fileFoot)) if (!byRow.has(row)) throw new Error(`Template file footer (${what}) not at the expected row.`);
  if (!/^total employees/i.test(cell.text(need(fileFoot.totalEmp, 0, 'TOTAL EMPLOYEES')))) throw new Error('Template file footer differs.');

  const templateNames = empRows
    .map((r) => /^employee\s*:\s*(.*?)\s*\([^)]*\)\s*$/i.exec(cell.text(at(r, 0)!))?.[1]?.trim())
    .filter((n): n is string => !!n && n.length > 2);

  // ── who, and on what schedule ──────────────────────────────────────────────
  const prisma = new PrismaClient();
  const dates = eachDate(FROM, TO);
  const { employees, contexts } = await (async () => {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, employmentState: 'ACTIVE' },
      select: { id: true, employeeNumber: true, lastName: true, firstName: true, middleName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const contexts = await AttendanceDayContextService.loadMany(
      employees.flatMap((e) => dates.map((date) => ({ employeeId: e.id, date })))
    );
    return { employees, contexts };
  })().finally(() => prisma.$disconnect());
  if (!employees.length) throw new Error('No active employees.');

  // ── generate the attendance ────────────────────────────────────────────────
  const planted = { absent: 0, late: 0, forgotOut: 0, deviceGlitch: 0, lunchPunch: 0, holiday: 0, scheduledShift: 0 };
  const people = employees.map((e, i) => {
    const rand = rng(0x9e3779b9 ^ ((i + 1) * 2654435761));
    let absences = 0;
    const days: Day[] = dates.map((date) => {
      const blank: Day = { date, sessions: [], hours: { required: 0, break: 0, worked: 0, overtime: 0, undertime: 0 } };
      const ctx = contexts.get(`${e.id}|${date}`);
      const shifts = (ctx?.shifts ?? []).filter((s) => s.startTime && s.endTime);

      // Which days are workdays: the HRISense schedule where one exists, else Mon-Sat.
      if (ctx?.scheduleStatus === 'DAY_OFF') return blank;
      if (!shifts.length && dow(date) === 0) return blank;
      if (date === HOLIDAY && i >= HOLIDAY_WORKERS) return blank;
      if (date !== HOLIDAY && absences < 3 && rand() < RATE.absent) { absences++; planted.absent++; return blank; }

      const shift = shifts.length
        ? { start: Math.min(...shifts.map((s) => toMin(s.startTime))), end: Math.max(...shifts.map((s) => toMin(s.endTime))) }
        : DEFAULT_SHIFT;
      if (shifts.length) planted.scheduledShift++;
      const required = shifts.length ? round2((shift.end - shift.start) / 60) : REQUIRED_HOURS;

      const seconds = () => Math.floor(rand() * 60) / 60;
      const late = rand() < RATE.late;
      if (late) planted.late++;
      const inAt = late ? shift.start + 1 + Math.floor(rand() * 20) + seconds() : shift.start - Math.floor(rand() * 40) + seconds();
      const outAt = shift.end - 10 + Math.floor(rand() * 55) + seconds();
      let sessions: Session[] = [{ in: inAt, out: outAt }];

      const roll = rand();
      if (date === HOLIDAY) planted.holiday++;
      if (roll < RATE.forgotOut) {
        planted.forgotOut++;
        sessions = [{ in: inAt, out: null }];
        // The device cannot total an open day, so it reports nothing worked.
        return { date, sessions, hours: { required, break: 0, worked: 0, overtime: 0, undertime: required } };
      }
      if (roll < RATE.forgotOut + RATE.deviceGlitch) {
        planted.deviceGlitch++;
        return { date, sessions, hours: { required, break: 0, worked: 0, overtime: 0, undertime: required } };
      }
      if (roll < RATE.forgotOut + RATE.deviceGlitch + RATE.lunchPunch) {
        planted.lunchPunch++;
        const mid = Math.round((shift.start + shift.end) / 2);
        sessions = [{ in: inAt, out: mid - 20 + seconds() }, { in: mid + 15 + seconds(), out: outAt }];
      }
      return { date, sessions, hours: deviceHours(sessions, shift, required) };
    });
    return { employee: e, code: String(FIRST_CODE + i), days };
  });

  // ── render into the template's layout ───────────────────────────────────────
  const outCells: Rec[] = [];
  const put = (r: Rec) => outCells.push(r);
  const nDays = dates.length;

  for (const h of headerLines) {
    const text = h === periodLine ? `From ${longDate(FROM)} to ${longDate(TO)}` : cell.text(h);
    put(labelRecord(cell.row(h), cell.col(h), cell.xf(h), text));
  }

  let row = E;
  let lastFooter = -1;
  for (const p of people) {
    put(labelRecord(row, 0, empXf, `Employee: ${deviceName(p.employee)}  (${p.code})`));
    for (const hc of headerCells) {
      put(hc.type === REC.LABEL
        ? labelRecord(row + 3, cell.col(hc), cell.xf(hc), cell.text(hc))
        : numberRecord(row + 3, cell.col(hc), cell.xf(hc), cell.number(hc)));
    }
    p.days.forEach((d, k) => {
      const r = row + 5 + k;
      put(numberRecord(r, 0, dataXf.get(0)!, dateSerial(d.date)));
      d.sessions.slice(0, 6).forEach((s, j) => {
        put(numberRecord(r, 2 + j * 2, timeXf(2 + j * 2), s.in / 1440));
        if (s.out !== null) put(numberRecord(r, 3 + j * 2, timeXf(3 + j * 2), s.out / 1440));
      });
      const h = d.hours;
      [h.required, h.break, h.worked, h.overtime, h.undertime].forEach((v, j) => put(numberRecord(r, 14 + j, dataXf.get(14 + j)!, v)));
    });
    const tRow = row + 5 + nDays;
    put(labelRecord(tRow, 0, totalXf, cell.text(at(totalRow, 0)!)));
    const fRow = tRow + 1;
    const present = p.days.filter((d) => d.sessions.length).length;
    put(labelRecord(fRow, 0, cell.xf(footLabel[0]), cell.text(footLabel[0])));
    put(numberRecord(fRow, 2, footNumXf.c2, present));
    put(labelRecord(fRow, 3, cell.xf(footLabel[1]), cell.text(footLabel[1])));
    put(numberRecord(fRow, 6, footNumXf.c6, nDays - present));
    const sum = (k: 'break' | 'worked' | 'overtime' | 'undertime') => round2(p.days.reduce((t, d) => t + d.hours[k], 0));
    put(numberRecord(fRow, 15, footHoursXf.get(15)!, sum('break')));
    put(numberRecord(fRow, 16, footHoursXf.get(16)!, sum('worked')));
    put(numberRecord(fRow, 17, footHoursXf.get(17)!, sum('overtime')));
    put(numberRecord(fRow, 18, footHoursXf.get(18)!, sum('undertime')));
    lastFooter = fRow;
    row = fRow + 6;
  }

  // File footer: same cells as the template's, at the same offsets from the last block.
  const workDays = dates.filter((d) => dow(d) !== 0).length;
  const footerValue: Record<number, number> = {
    [fileFoot.totalEmp]: people.length,
    [fileFoot.workDays]: nDays,
    [fileFoot.holidays]: 0,
    [fileFoot.hoursReq]: workDays * REQUIRED_HOURS,
  };
  for (const tplRow of Object.values(fileFoot)) {
    for (const c of byRow.get(tplRow) ?? []) {
      const r = lastFooter + (tplRow - F);
      if (c.type === REC.NUMBER) put(numberRecord(r, cell.col(c), cell.xf(c), footerValue[tplRow] ?? cell.number(c)));
      else put(labelRecord(r, cell.col(c), cell.xf(c), /^report date/i.test(cell.text(c)) ? `Report Date: ${longDate(TO)}` : cell.text(c)));
    }
  }

  // Cells in row, then column, order - the order the export itself uses.
  outCells.sort((a, b) => cell.row(a) - cell.row(b) || cell.col(a) - cell.col(b));
  const maxRow = Math.max(...outCells.map(cell.row));
  const newPrelude = prelude.map((r) => {
    if (r.type !== REC.DIMENSIONS) return r;
    const body = Buffer.from(r.body);
    body.writeUInt16LE(0, 0);
    body.writeUInt16LE(maxRow + 1, 2);
    return { type: r.type, body };
  });

  const out: Rec[] = [...globals, ...newPrelude, ...outCells, ...postlude];
  const fixes = applyExportFixes(out, false);
  const stream = serialize(out);
  const file = writeContainer(tpl.source, stream);
  writeFileSync(outPath, file);

  // ── prove it ────────────────────────────────────────────────────────────────
  const text = stream.toString('latin1').toUpperCase();
  const leaked = templateNames.filter((n) => text.includes(n.toUpperCase())).length;
  const parsed = MustardSeedtimeReader.read(file);
  const codes = parsed.blocks.map((b) => b.code);
  const norm = await new MustardSeedtimeNormalizer({
    resolveEmployeeIdsByCode: async (cs: string[]) => new Map(cs.map((c) => [c, `id-${c}`])),
    now: () => new Date(`${TO}T23:00:00+08:00`),
  }).normalize(toRawSourceRows(parsed));
  const withData = norm.candidates.filter((c) => c.sessions?.length || (c.hoursWorked ?? 0));
  const flagged: Record<string, number> = {};
  for (const c of withData) for (const f of c.reviewFlags) flagged[f] = (flagged[f] ?? 0) + 1;
  const heldByRowFlags = withData.filter((c) => isHeld(c.reviewFlags)).length;

  console.log(`wrote ${outPath} (${(file.length / 1024).toFixed(0)} KB, BIFF5, template: ${tplArg.split(/[\\/]/).pop()})`);
  console.log(`period ${FROM} -> ${TO} (${nDays} days) | ${people.length} employees | codes ${codes[0]}-${codes.at(-1)}`);
  console.log(`container entries identical to template: ${containerEntries(file) === tpl.entries}`);
  console.log(`fixes: sheet named=${fixes.namedSheet}, column A widened=${fixes.widened}, filler records removed=${fixes.fillersDropped}`);
  console.log(`template names in output: ${leaked} of ${templateNames.length}`);
  console.log(`parser reads it: ${parsed.blocks.length} blocks, period ${parsed.reportPeriod.start} -> ${parsed.reportPeriod.end}, TOTAL EMPLOYEES ${parsed.reportTotals.employees}`);
  console.log(`\nfake attendance: ${withData.length} days with punches | planted: ${JSON.stringify(planted)}`);
  console.log(`row-level flags: ${JSON.stringify(flagged)}`);
  console.log(`held by the importer's row checks alone: ${heldByRowFlags} (holiday, schedule and existing-record checks run at import)`);

  if (leaked || parsed.blocks.length !== people.length || parsed.reportPeriod.start !== FROM || parsed.reportPeriod.end !== TO
      || new Set(codes).size !== people.length || containerEntries(file) !== tpl.entries) {
    throw new Error('Verification failed - do not use this file.');
  }
  const mapped = Math.max(0, people.length - LEAVE_UNMAPPED);
  console.log(`\ncodes ${FIRST_CODE}-${FIRST_CODE + mapped - 1} map to HRISense employees via generate-sample-timesheet.ts --apply-codes; ${FIRST_CODE + mapped}-${FIRST_CODE + people.length - 1} are left for the mapping panel`);
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
