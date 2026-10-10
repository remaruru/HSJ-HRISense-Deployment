/**
 * Reading and writing the legacy Excel 5.0/95 (BIFF5) files the Mustard Seedtime
 * exporter produces - shared by the scripts that make test timesheets from a real
 * export.
 *
 * No JavaScript spreadsheet library writes BIFF5 with its formatting intact, and
 * Excel refuses BIFF5 under automation, so these helpers work at the record
 * level: a real export is parsed into its records, those records are reused as a
 * template, and a new file is serialised in the same container.
 *
 * ── The export's three defects, and why they are fixed ───────────────────────
 * Each was confirmed by opening variants in a real Excel window.
 *  1. The worksheet is named with an EMPTY string. Excel reports "We found a
 *     problem with some content" and offers to repair - on the original export.
 *  2. Four EMPTY records of type 0x0000 follow the page margins. Excel warns
 *     "File error: data may have been lost". They hold nothing.
 *  3. Dates are mm/dd/yyyy (ten characters) in a column exactly ten characters
 *     wide, so Excel shows "######".
 * None of the fixes changes a value, and the importer reads none of them.
 */
import * as XLSX from 'xlsx';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The fields of a compound-file directory entry these helpers read. */
type CfbEntry = { name: string; type: number; content?: unknown };

/** Device codes issued to HRISense employees in test files - see generate-sample-timesheet.ts. */
export const FIRST_CODE = 901;
/** The last few employees are left unmapped so the mapping panel has work. */
export const LEAVE_UNMAPPED = 4;
/** Column A width once widened: "09/01/2026" is ten characters, plus padding. */
export const DATE_COLUMN_CHARS = 12;
/** The export's default cell format (General, default font) - checked on load. */
export const DEFAULT_CELL_XF = 15;
/** What an unnamed sheet is called once fixed - Excel's own repair gives this. */
export const SHEET_NAME = 'Sheet1';

export const REC = {
  BOF: 0x0809, EOF: 0x000a, LABEL: 0x0204, NUMBER: 0x0203, DIMENSIONS: 0x0200,
  DEFCOLWIDTH: 0x0055, COLINFO: 0x007d, XF: 0x00e0, BOUNDSHEET: 0x0085,
  EMPTY_FILLER: 0x0000,
  // Record types these helpers do NOT know how to keep consistent.
  SST: 0x00fc, LABELSST: 0x00fd, ROW: 0x0208, INDEX: 0x020b, DBCELL: 0x00d7,
  RK: 0x027e, MULRK: 0x00bd, BLANK: 0x0201, MULBLANK: 0x00be, FORMULA: 0x0006,
  CONTINUE: 0x003c, MERGEDCELLS: 0x00e5, SELECTION: 0x001d,
} as const;

export interface Rec { type: number; body: Buffer }

export function parseRecords(stream: Buffer): Rec[] {
  const out: Rec[] = [];
  let off = 0;
  while (off + 4 <= stream.length) {
    const type = stream.readUInt16LE(off);
    const len = stream.readUInt16LE(off + 2);
    out.push({ type, body: Buffer.from(stream.subarray(off + 4, off + 4 + len)) });
    off += 4 + len;
  }
  if (off !== stream.length) throw new Error('Stream does not end on a record boundary.');
  return out;
}

export function serialize(records: Rec[]): Buffer {
  return Buffer.concat(records.map((r) => {
    const head = Buffer.alloc(4);
    head.writeUInt16LE(r.type, 0);
    head.writeUInt16LE(r.body.length, 2);
    return Buffer.concat([head, r.body]);
  }));
}

/** `SURNAME, FIRSTNAME M` the way a bio device prints it. */
export function deviceName(e: { lastName: string; firstName: string; middleName: string | null }): string {
  const last = e.lastName?.trim();
  const first = [e.firstName?.trim(), e.middleName?.trim()].filter(Boolean).join(' ');
  return (last && first ? `${last}, ${first}` : last || first || 'UNNAMED').toUpperCase();
}

/** `<folder>/<YYYY-MM-DD HHMM> template excel hrisense.xls` when given a folder. */
export function resolveOutput(outPath: string): string {
  if (!(existsSync(outPath) && statSync(outPath).isDirectory())) return outPath;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
  return join(outPath, `${stamp} template excel hrisense.xls`);
}

export interface Biff5Workbook {
  /** The raw file, whose container header and directory are reused on write. */
  source: Buffer;
  /** Directory entries, for checking the rebuilt container matches. */
  entries: string;
  records: Rec[];
  /** Index of the worksheet's BOF record; everything before it is the globals. */
  sheetStart: number;
}

/**
 * Loads a Mustard export, refusing anything whose structure these helpers have
 * not been verified against.
 */
export function readBiff5(path: string): Biff5Workbook {
  const source = readFileSync(path);
  const cfb = XLSX.CFB.read(source, { type: 'buffer' });
  const streams = (cfb.FileIndex as CfbEntry[]).filter((f) => f.type === 2);
  if (streams.length !== 1 || streams[0].name !== 'BOOK') {
    throw new Error('Expected a single BIFF5 "BOOK" stream - this is not the export format these tools know.');
  }
  const records = parseRecords(Buffer.from(streams[0].content as Uint8Array));
  if (records[0].type !== REC.BOF || records[0].body.readUInt16LE(0) !== 0x0500) throw new Error('Not a BIFF5 workbook.');
  const bofs = records.map((r, i) => (r.type === REC.BOF ? i : -1)).filter((i) => i >= 0);
  if (bofs.length !== 2) throw new Error(`Expected globals plus one sheet, found ${bofs.length} substreams.`);
  const sheetStart = bofs[1];
  const forbidden: number[] = [REC.SST, REC.LABELSST, REC.ROW, REC.INDEX, REC.DBCELL, REC.RK, REC.MULRK,
    REC.BLANK, REC.MULBLANK, REC.FORMULA, REC.CONTINUE, REC.MERGEDCELLS, REC.SELECTION];
  const seen = records.slice(sheetStart).find((r) => forbidden.includes(r.type));
  if (seen) throw new Error(`Sheet contains record 0x${seen.type.toString(16)}, which these tools do not handle.`);
  for (const r of records) {
    if (r.type === REC.LABEL && r.body.length !== 8 + r.body.readUInt16LE(6)) throw new Error('Unexpected LABEL layout.');
  }
  return {
    source,
    entries: (cfb.FileIndex as CfbEntry[]).map((f) => `${f.name}:${f.type}`).join(', '),
    records,
    sheetStart,
  };
}

export const cell = {
  row: (r: Rec) => r.body.readUInt16LE(0),
  col: (r: Rec) => r.body.readUInt16LE(2),
  xf: (r: Rec) => r.body.readUInt16LE(4),
  text: (r: Rec) => r.body.subarray(8, 8 + r.body.readUInt16LE(6)).toString('latin1'),
  number: (r: Rec) => r.body.readDoubleLE(6),
};

export function labelRecord(row: number, col: number, xf: number, text: string): Rec {
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error(`Non-ASCII text cannot be written safely: ${JSON.stringify(text)}`);
  const bytes = Buffer.from(text, 'latin1');
  const body = Buffer.alloc(8 + bytes.length);
  body.writeUInt16LE(row, 0); body.writeUInt16LE(col, 2); body.writeUInt16LE(xf, 4);
  body.writeUInt16LE(bytes.length, 6); bytes.copy(body, 8);
  return { type: REC.LABEL, body };
}

export function numberRecord(row: number, col: number, xf: number, value: number): Rec {
  const body = Buffer.alloc(14);
  body.writeUInt16LE(row, 0); body.writeUInt16LE(col, 2); body.writeUInt16LE(xf, 4);
  body.writeDoubleLE(value, 6);
  return { type: REC.NUMBER, body };
}

export interface FixReport { namedSheet: boolean; fillersDropped: number; widened: boolean }

/**
 * Applies the three fixes described at the top of this file, in place, and
 * re-points BOUNDSHEET at the sheet (the globals may have grown). With
 * `asExported` only the re-pointing happens.
 */
export function applyExportFixes(out: Rec[], asExported: boolean): FixReport {
  const report: FixReport = { namedSheet: false, fillersDropped: 0, widened: false };
  const sheetAt = () => out.findIndex((r, i) => i > 0 && r.type === REC.BOF);

  if (!asExported) {
    // 2. Empty filler records - only type 0x0000 AND zero bytes, never anything with content.
    for (let i = out.length - 1; i > sheetAt(); i--) {
      if (out[i].type === REC.EMPTY_FILLER && out[i].body.length === 0) { out.splice(i, 1); report.fillersDropped++; }
    }

    // 3. Widen column A, straight after DEFCOLWIDTH where Excel expects it.
    const start = sheetAt();
    if (out.slice(start).some((r) => r.type === REC.COLINFO)) {
      throw new Error('Source already sets column widths; refusing to guess how to widen column A.');
    }
    const xf = out.slice(0, start).filter((r) => r.type === REC.XF)[DEFAULT_CELL_XF];
    if (!xf || (xf.body.readUInt16LE(4) & 0x0004) !== 0) throw new Error(`XF ${DEFAULT_CELL_XF} is not a cell format in this file.`);
    const at = out.findIndex((r, i) => i >= start && r.type === REC.DEFCOLWIDTH);
    if (at < 0) throw new Error('No DEFCOLWIDTH record to anchor the column width to.');
    // COLINFO is 12 bytes in BIFF3-BIFF8: the last two are unused but required.
    const body = Buffer.alloc(12);
    body.writeUInt16LE(0, 0);                        // first column: A
    body.writeUInt16LE(0, 2);                        // last column:  A
    body.writeUInt16LE(DATE_COLUMN_CHARS * 256, 4);  // width, 1/256 of a character
    body.writeUInt16LE(DEFAULT_CELL_XF, 6);          // default format for empty cells
    out.splice(at + 1, 0, { type: REC.COLINFO, body });
    report.widened = true;

    // 1. Name the sheet - only an EMPTY name is ever replaced.
    const bs = out.findIndex((r) => r.type === REC.BOUNDSHEET);
    if (bs < 0) throw new Error('No BOUNDSHEET record.');
    if (out[bs].body[6] === 0) {
      const name = Buffer.from(SHEET_NAME, 'latin1');
      const nb = Buffer.alloc(7 + name.length);
      out[bs].body.copy(nb, 0, 0, 6); // stream position + visibility flags
      nb[6] = name.length;
      name.copy(nb, 7);
      out[bs] = { type: REC.BOUNDSHEET, body: nb };
      report.namedSheet = true;
    }
  }

  // BOUNDSHEET holds the byte offset of the sheet's BOF; recompute it.
  let off = 0, bofs = 0, pos = -1;
  for (const r of out) { if (r.type === REC.BOF && bofs++ === 1) pos = off; off += 4 + r.body.length; }
  const bsRec = out.find((r) => r.type === REC.BOUNDSHEET);
  if (!bsRec || pos < 0) throw new Error('Could not locate the sheet to point BOUNDSHEET at.');
  bsRec.body.writeUInt32LE(pos, 0);
  return report;
}

/**
 * A compound file holding one stream, rebuilt from the SOURCE container's own
 * header, directory and mini-FAT sectors. Only the sector map, the FAT and the
 * stream's start/size change - no marker streams are added.
 */
export function writeContainer(source: Buffer, stream: Buffer): Buffer {
  const SECTOR = 512;
  const FREE = 0xffffffff, END = 0xfffffffe, FATSECT = 0xfffffffd;
  const sectorAt = (n: number) => source.subarray(SECTOR + n * SECTOR, SECTOR + (n + 1) * SECTOR);

  if (source.readUInt16LE(30) !== 9) throw new Error('Only 512-byte-sector containers are supported.');
  if (source.readUInt32LE(72) !== 0) throw new Error('Containers with DIFAT sectors are not supported.');
  const srcDir = Buffer.from(sectorAt(source.readUInt32LE(48)));
  const numMiniFat = source.readUInt32LE(64);
  const srcMiniFat = numMiniFat ? Buffer.from(sectorAt(source.readUInt32LE(60))) : null;

  const dataSectors = Math.ceil(stream.length / SECTOR);
  const fixed = 1 + (srcMiniFat ? 1 : 0); // directory + mini-FAT
  let fatSectors = 1;
  while (fatSectors * 128 < fatSectors + fixed + dataSectors) fatSectors++;
  if (fatSectors > 109) throw new Error('Stream too large for a DIFAT-free container.');

  // Layout: [FAT...][directory][mini-FAT][stream data...]
  const dirAt = fatSectors;
  const miniAt = srcMiniFat ? fatSectors + 1 : END;
  const dataAt = fatSectors + fixed;
  const total = dataAt + dataSectors;

  const fat = Buffer.alloc(fatSectors * SECTOR, 0xff);
  for (let i = 0; i < fatSectors; i++) fat.writeUInt32LE(FATSECT, i * 4);
  fat.writeUInt32LE(END, dirAt * 4);
  if (srcMiniFat) fat.writeUInt32LE(END, (miniAt as number) * 4);
  for (let i = 0; i < dataSectors; i++) {
    fat.writeUInt32LE(i === dataSectors - 1 ? END : dataAt + i + 1, (dataAt + i) * 4);
  }

  const header = Buffer.from(source.subarray(0, SECTOR));
  header.writeUInt32LE(fatSectors, 44);
  header.writeUInt32LE(dirAt, 48);
  if (srcMiniFat) header.writeUInt32LE(miniAt as number, 60);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i < fatSectors ? i : FREE, 76 + i * 4);

  let patched = 0;
  for (let i = 0; i < 4; i++) {
    const e = i * 128;
    if (srcDir[e + 66] === 2) {
      srcDir.writeUInt32LE(dataAt, e + 116);
      srcDir.writeUInt32LE(stream.length, e + 120);
      patched++;
    }
  }
  if (patched !== 1) throw new Error(`Expected exactly one stream entry, found ${patched}.`);

  const data = Buffer.alloc(dataSectors * SECTOR); // zero padding: nothing left behind
  stream.copy(data);
  const out = Buffer.concat([header, fat, srcDir, ...(srcMiniFat ? [srcMiniFat] : []), data]);
  if (out.length !== SECTOR + total * SECTOR) throw new Error('Container size mismatch.');
  return out;
}

/** Directory entries of a written file, to compare against the source's. */
export function containerEntries(file: Buffer): string {
  return (XLSX.CFB.read(file, { type: 'buffer' }).FileIndex as CfbEntry[]).map((f) => `${f.name}:${f.type}`).join(', ');
}
