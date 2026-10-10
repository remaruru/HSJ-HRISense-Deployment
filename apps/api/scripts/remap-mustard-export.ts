/**
 * Produces an EXACT copy of a real Mustard Seedtime timesheet export in which
 * every employee is a person who exists in this HRISense database.
 *
 *   npx tsx scripts/remap-mustard-export.ts <real-export.xls> <output.xls | folder> [--as-exported]
 *
 * Given a folder, the file is named "<date> <time> template excel hrisense.xls",
 * so the newest one is always obvious.
 *
 * ── Three deliberate differences, all fixing defects in the export itself ─────
 * 1. The export names its worksheet with an EMPTY string. Every Excel sheet
 *    needs a name, so Excel reports "We found a problem with some content" on
 *    the ORIGINAL file too and offers to repair it. Verified: the untouched
 *    original is refused by Excel, and the same file with only the name added
 *    opens cleanly. The sheet is named "Sheet1" - what Excel's repair produces
 *    and what the importer already reads it as.
 * 2. Dates are mm/dd/yyyy (ten characters) in a column the file sets to exactly
 *    ten characters wide, so Excel shows every date as "######" - again in the
 *    original too. One column-width record widens column A.
 * 3. After each page-margin record the export writes an EMPTY record of type
 *    0x0000 - four in all, zero bytes each. Excel does not recognise them and
 *    warns "File error: data may have been lost" when the file opens. Verified
 *    by opening variants in a real Excel window: removing only these four makes
 *    the warning disappear, and no other single change does. They hold no data,
 *    so removing them loses nothing.
 * None of these changes a value, and the importer reads none of them.
 * `--as-exported` leaves all three defects in place for a copy that behaves
 * exactly like the export.
 *
 * ── Why this is not built with a spreadsheet library ─────────────────────────
 * The official export is a legacy Excel 5.0/95 (BIFF5) file carrying 16 fonts
 * and 37 cell styles. Every JavaScript writer available here produces BIFF8 and
 * flattens formatting, and Excel itself refuses to open BIFF5 under automation.
 * So this edits the original's own records: the employee lines are rewritten,
 * the blocks beyond HRISense's headcount are removed, and EVERY other byte -
 * fonts, styles, margins, page setup, the exporter's own quirks - is carried
 * across untouched. The container is rebuilt from the original's header and
 * directory bytes, so no marker streams are added either.
 *
 * ── Real names ───────────────────────────────────────────────────────────────
 * Real names are read from the source file only to locate rows. None is ever
 * printed, logged or kept: each is overwritten or deleted, and the output is
 * scanned afterwards to prove none survived.
 *
 * ── Codes ────────────────────────────────────────────────────────────────────
 * Identical to generate-sample-timesheet.ts (same employees, same order, codes
 * from 901, last four left unmapped), so that script's `--apply-codes` maps this
 * file too. 9xx cannot collide with a real device number (the real range is
 * 2-217).
 *
 * The script refuses any input whose structure it has not been verified against
 * (BIFF8, shared strings, row/index records): editing those needs more than this.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { MustardSeedtimeReader } from '../src/services/attendance-import/mustard-seedtime.reader';
import {
  FIRST_CODE, LEAVE_UNMAPPED, DATE_COLUMN_CHARS, SHEET_NAME, REC, type Rec,
  applyExportFixes, cell, containerEntries, deviceName, readBiff5, resolveOutput, serialize, writeContainer,
} from './lib/mustard-biff5';

async function main() {
  const [srcArg, outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!srcArg || !outArg) throw new Error('Usage: remap-mustard-export.ts <real-export.xls> <output.xls | folder>');
  const srcPath = resolve(srcArg);
  const outPath = resolveOutput(resolve(outArg));
  if (srcPath === outPath) throw new Error('Refusing to overwrite the source export.');
  const asExported = process.argv.includes('--as-exported');

  const { source, entries: original, records, sheetStart } = readBiff5(srcPath);
  const label = (r: Rec) => ({ row: cell.row(r), col: cell.col(r), text: cell.text(r) });

  // ── locate blocks (column A text) ─────────────────────────────────────────
  const colA = records.slice(sheetStart).filter((r) => r.type === REC.LABEL).map(label).filter((l) => l.col === 0);
  const employeeRows = colA.filter((l) => /^employee\s*:/i.test(l.text)).map((l) => l.row);
  const footerRows = colA.filter((l) => /^days present/i.test(l.text)).map((l) => l.row);
  const totalEmpRow = colA.find((l) => /^total employees/i.test(l.text))?.row;
  if (employeeRows.length !== footerRows.length || totalEmpRow === undefined) {
    throw new Error('Block structure not recognised.');
  }
  const realNames = colA
    .filter((l) => /^employee\s*:/i.test(l.text))
    .map((l) => /^employee\s*:\s*(.*?)\s*\([^)]*\)\s*$/i.exec(l.text)?.[1]?.trim())
    .filter((n): n is string => !!n && n.length > 2);

  // ── the people who will stand in, in the generator's exact order ────────────
  const prisma = new PrismaClient();
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, employmentState: 'ACTIVE' },
    select: { employeeNumber: true, lastName: true, firstName: true, middleName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  }).finally(() => prisma.$disconnect());
  const keep = Math.min(employees.length, employeeRows.length);
  if (!keep) throw new Error('No active employees to put in the file.');

  const newLine = new Map<number, string>();
  employees.slice(0, keep).forEach((e, i) => {
    const original = colA.find((l) => l.row === employeeRows[i])!.text;
    const m = /^(employee\s*:\s*)(.*?)(\s*\()([^)]*)(\)\s*)$/i.exec(original);
    if (!m) throw new Error('Unexpected employee line shape.');
    const text = `${m[1]}${deviceName(e)}${m[3]}${FIRST_CODE + i}${m[5]}`;
    if (!/^[\x20-\x7e]*$/.test(text)) throw new Error(`Non-ASCII name cannot be written safely: ${e.employeeNumber}`);
    newLine.set(employeeRows[i], text);
  });

  // Delete from the first dropped block's employee line through five rows past
  // the last block's footer; the original's sixth blank row then sits between
  // the last kept block and TOTAL EMPLOYEES, exactly as before.
  const delFrom = keep < employeeRows.length ? employeeRows[keep] : Infinity;
  const delTo = keep < employeeRows.length ? footerRows[footerRows.length - 1] + 5 : -Infinity;
  const removed = Number.isFinite(delFrom) ? delTo - delFrom + 1 : 0;
  const shift = (row: number) => (row > delTo ? row - removed : row);

  // ── rewrite the sheet ─────────────────────────────────────────────────────
  let rewritten = 0, totalSet = 0, dropped = 0;
  const out: Rec[] = [];
  records.forEach((r, i) => {
    if (i < sheetStart) { out.push(r); return; } // globals: untouched
    if (r.type === REC.LABEL || r.type === REC.NUMBER) {
      const row = r.body.readUInt16LE(0);
      const col = r.body.readUInt16LE(2);
      if (row >= delFrom && row <= delTo) { dropped++; return; }

      let body = Buffer.from(r.body);
      if (r.type === REC.LABEL && col === 0 && newLine.has(row)) {
        const text = Buffer.from(newLine.get(row)!, 'latin1');
        body = Buffer.alloc(8 + text.length);
        r.body.copy(body, 0, 0, 6); // row, col and the cell's own style index
        body.writeUInt16LE(text.length, 6);
        text.copy(body, 8);
        rewritten++;
      }
      if (r.type === REC.NUMBER && row === totalEmpRow && col === 3) {
        body.writeDoubleLE(keep, 6);
        totalSet++;
      }
      body.writeUInt16LE(shift(row), 0);
      out.push({ type: r.type, body });
      return;
    }
    if (r.type === REC.DIMENSIONS) {
      const body = Buffer.from(r.body);
      body.writeUInt16LE(body.readUInt16LE(2) - removed, 2);
      out.push({ type: r.type, body });
      return;
    }
    out.push(r); // margins, setup, window, filler: untouched here
  });
  if (rewritten !== keep) throw new Error(`Rewrote ${rewritten} employee lines, expected ${keep}.`);

  const fixes = applyExportFixes(out, asExported);
  if (totalSet !== 1) throw new Error('TOTAL EMPLOYEES cell not found exactly once.');

  const stream = serialize(out);
  const file = writeContainer(source, stream);
  writeFileSync(outPath, file);

  // ── prove it ──────────────────────────────────────────────────────────────
  const entries = containerEntries(file);
  const outText = stream.toString('latin1').toUpperCase();
  const leaked = realNames.filter((n) => outText.includes(n.toUpperCase())).length;
  const edited = [REC.LABEL, REC.NUMBER, REC.DIMENSIONS, REC.BOUNDSHEET, REC.COLINFO] as number[];
  const isDroppedFiller = (r: Rec) => !asExported && r.type === REC.EMPTY_FILLER && r.body.length === 0;
  const untouched = records.filter((r) => !edited.includes(r.type) && !isDroppedFiller(r));
  const untouchedOut = out.filter((r) => !edited.includes(r.type));
  const addedColinfo = out.filter((r) => r.type === REC.COLINFO).length;
  const identical = untouched.length === untouchedOut.length &&
    untouched.every((r, i) => r.type === untouchedOut[i].type && r.body.equals(untouchedOut[i].body));
  const parsed = MustardSeedtimeReader.read(file);

  console.log(`wrote ${outPath} (${(file.length / 1024).toFixed(0)} KB, BIFF5)`);
  console.log(`blocks: ${employeeRows.length} in source -> ${keep} kept | rows ${delFrom + 1}-${delTo + 1} removed (${removed}) | ${dropped} cells dropped`);
  console.log(`container entries identical to source: ${entries === original}  [${entries}]`);
  console.log(`non-cell records byte-identical to source: ${identical} (${untouched.length} records: fonts, styles, margins, setup...)`);
  if (asExported) console.log('as exported: sheet left unnamed and column A left narrow, exactly like the source');
  else {
    console.log(`fixed: sheet ${fixes.namedSheet ? `named "${SHEET_NAME}" (the export leaves it blank, which is what makes Excel offer to repair it)` : 'already had a name'}`);
    console.log(`fixed: column A -> ${DATE_COLUMN_CHARS} chars, so dates show instead of ######`);
    console.log(`fixed: removed ${fixes.fillersDropped} empty filler records (they make Excel warn "data may have been lost")`);
  }
  console.log(`real names remaining in output: ${leaked} of ${realNames.length}`);
  console.log(`parser reads it: ${parsed.blocks.length} blocks, codes ${parsed.blocks[0]?.code}-${parsed.blocks.at(-1)?.code}, period ${parsed.reportPeriod.start} -> ${parsed.reportPeriod.end}, TOTAL EMPLOYEES ${parsed.reportTotals.employees}`);
  if (leaked || !identical || entries !== original || parsed.blocks.length !== keep || addedColinfo !== (fixes.widened ? 1 : 0)) {
    throw new Error('Verification failed - do not use this file.');
  }

  const mapped = Math.max(0, keep - LEAVE_UNMAPPED);
  console.log('\ncode  employeeNumber  name');
  employees.slice(0, keep).forEach((e, i) => {
    console.log(`${String(FIRST_CODE + i).padEnd(6)}${e.employeeNumber.padEnd(16)}${deviceName(e).slice(0, 34).padEnd(35)}${i < mapped ? '' : 'unmapped on purpose'}`);
  });
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
