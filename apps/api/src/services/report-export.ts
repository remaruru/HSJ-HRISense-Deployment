import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BRAND, TONE, calendarDate, drawBrandBand, drawTable, phDateTime, stampFooters, type Tone } from '../lib/pdf-brand';
import type { ReportChart, ReportResult } from './report.service';

/**
 * Report exports: PDF (to read and print), Excel (to work with) and CSV (raw).
 * All three carry exactly the report on screen — the same totals, findings,
 * charts and rows — so an export never says something the page does not.
 */

const MAX_PDF_ROWS = 500;

const CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const humanizeCode = (v: string) => v.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * How each column should be shown in an export. Status / type codes read as words
 * ("PENDING" → "Pending") and plain dates read as dates; names, units and
 * employee numbers are left exactly as stored.
 */
function columnKinds(report: ReportResult): Array<'code' | 'date' | 'plain'> {
  return report.columns.map((c) => {
    const values = report.rows.map((r) => r[c.key]).filter((v): v is string => typeof v === 'string' && v !== '');
    if (!values.length) return 'plain';
    if (values.every((v) => ISO_DAY.test(v))) return 'date';
    if (/status|type|stage|state|decision|category/i.test(`${c.key} ${c.label}`) && values.every((v) => CODE.test(v))) return 'code';
    return 'plain';
  });
}
/** A summary label or chart label that is a bare code ("PENDING", "FOR_REVIEW") reads as words. */
const label = (v: string) => (CODE.test(v) && v.length > 3 ? humanizeCode(v) : v);

/** 1053 → "1,053"; text stays as it is. */
const show = (v: unknown): string => (typeof v === 'number' ? v.toLocaleString('en-PH') : v === null || v === undefined ? '' : String(v));

const periodText = (report: ReportResult): string | null =>
  report.period.from || report.period.to
    ? `${report.period.from ? calendarDate(report.period.from) : 'Start'} – ${report.period.to ? calendarDate(report.period.to) : 'Today'}`
    : null;

/** A column is numeric when every filled cell is a number; numbers align right. */
const numericColumns = (report: ReportResult): boolean[] =>
  report.columns.map((c) => {
    const values = report.rows.map((r) => r[c.key]).filter((v) => v !== null && v !== undefined && v !== '');
    return values.length > 0 && values.every((v) => typeof v === 'number');
  });

/** Bar colour for one slice: status charts use the status colours, the rest one teal. */
function sliceColor(chart: ReportChart, index: number, tone?: Tone): string {
  if (chart.encoding === 'status') return TONE[tone ?? 'neutral'].bar;
  if (chart.encoding === 'ordinal') {
    const shades = ['#9fd6d4', '#6cc5c3', '#3fa9a7', '#148281', '#0f6766', '#0d4f4e', '#093b3a'];
    return shades[Math.min(index, shades.length - 1)];
  }
  return BRAND.teal;
}

export function reportToPdf(report: ReportResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape', bufferPages: true, info: { Title: `HSJ HRISense — ${report.title}` } });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 36;
      const width = doc.page.width - 72;
      const bottom = () => doc.page.height - 44;
      const ensure = (needed: number, y: number) => {
        if (y + needed <= bottom()) return y;
        doc.addPage();
        return 40;
      };

      // ── Title block ──
      let y = drawBrandBand(doc, 'Report');
      doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND.ink).text(report.title, left, y, { width });
      y = doc.y + 3;
      doc.font('Helvetica').fontSize(10).fillColor(BRAND.muted).text(report.description, left, y, { width });
      y = doc.y + 8;
      const meta = [periodText(report) && `Period: ${periodText(report)}`, `Generated: ${phDateTime()}`, `${report.rows.length} row${report.rows.length === 1 ? '' : 's'}`]
        .filter(Boolean)
        .join('     ·     ');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.tealDark).text(meta, left, y, { width });
      y = doc.y + 14;

      // ── Summary tiles ──
      if (report.totals.length) {
        const perRow = Math.min(report.totals.length, 6);
        const gap = 10;
        const tw = (width - gap * (perRow - 1)) / perRow;
        for (let i = 0; i < report.totals.length; i += perRow) {
          const rowTiles = report.totals.slice(i, i + perRow);
          doc.font('Helvetica').fontSize(8.5);
          const th = 30 + Math.max(...rowTiles.map((t) => doc.heightOfString(label(t.label), { width: tw - 20 }))) + 10;
          y = ensure(th, y);
          rowTiles.forEach((t, k) => {
            const x = left + k * (tw + gap);
            const tone = TONE[(t.tone as Tone) ?? 'neutral'];
            doc.save();
            doc.roundedRect(x, y, tw, th, 6).fill(tone.fill);
            doc.rect(x, y, 4, th).fill(tone.bar);
            doc.restore();
            doc.font('Helvetica-Bold').fontSize(17).fillColor(tone.text).text(show(t.value), x + 12, y + 8, { width: tw - 20, lineBreak: false, ellipsis: true });
            doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.body).text(label(t.label), x + 12, y + 30, { width: tw - 20 });
          });
          y += th + 10;
        }
        y += 4;
      }

      // ── Key findings ──
      if (report.summary.length) {
        y = ensure(40, y);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.tealDark).text('Key findings', left, y);
        y = doc.y + 4;
        for (const line of report.summary) {
          doc.font('Helvetica').fontSize(9.5);
          const h = doc.heightOfString(line, { width: width - 16 });
          y = ensure(h + 4, y);
          doc.save().circle(left + 4, y + 5, 2).fill(BRAND.teal).restore();
          doc.fillColor(BRAND.body).text(line, left + 14, y, { width: width - 16 });
          y = doc.y + 3;
        }
        y += 10;
      }

      // ── Charts, two per row ──
      const charts = report.charts.filter((c) => c.slices.length || c.emptyMessage);
      if (charts.length) {
        y = ensure(30, y);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.tealDark).text('At a glance', left, y);
        y = doc.y + 6;
        const gap = 16;
        const cw = (width - gap) / 2;
        for (let i = 0; i < charts.length; i += 2) {
          const pair = charts.slice(i, i + 2);
          const heights = pair.map((c) => 46 + Math.max(1, Math.min(c.slices.length, 8)) * 19 + 8);
          const ch = Math.max(...heights);
          y = ensure(ch, y);
          pair.forEach((chart, k) => {
            const x = left + k * (cw + gap);
            doc.save();
            doc.roundedRect(x, y, cw, ch, 6).lineWidth(0.8).strokeColor(BRAND.line).stroke();
            doc.restore();
            doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.ink).text(chart.title, x + 12, y + 10, { width: cw - 24, lineBreak: false, ellipsis: true });
            if (chart.subtitle) doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(chart.subtitle, x + 12, y + 24, { width: cw - 24, lineBreak: false, ellipsis: true });
            const slices = chart.slices.slice(0, 8);
            if (!slices.length) {
              doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.muted).text(chart.emptyMessage ?? 'Nothing to show.', x + 12, y + 46, { width: cw - 24 });
              return;
            }
            const labelW = cw * 0.34;
            const valueW = 70;
            const barMax = cw - 24 - labelW - valueW - 8;
            const max = Math.max(...slices.map((s) => s.value), 1);
            slices.forEach((s, j) => {
              const by = y + 44 + j * 19;
              doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.body).text(label(s.label), x + 12, by + 2, { width: labelW - 6, lineBreak: false, ellipsis: true });
              const bw = Math.max(2, (s.value / max) * barMax);
              doc.save();
              doc.roundedRect(x + 12 + labelW, by, bw, 12, 3).fill(sliceColor(chart, j, s.tone as Tone));
              doc.restore();
              const share = chart.total ? ` (${Math.round((s.value / chart.total) * 1000) / 10}%)` : '';
              doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.ink).text(`${show(s.value)}${share}`, x + 12 + labelW + bw + 6, by + 2, { width: valueW + 20, lineBreak: false });
            });
          });
          y += ch + 12;
        }
      }

      // ── Data table ──
      y = ensure(60, y + 4);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.tealDark).text('Details', left, y);
      y = doc.y + 6;
      if (!report.rows.length) {
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(BRAND.muted).text('No records for this report and period.', left, y);
        y = doc.y + 10;
      } else {
        const numeric = numericColumns(report);
        const kinds = columnKinds(report);
        const rows = report.rows.slice(0, MAX_PDF_ROWS).map((r) =>
          report.columns.map((c, i) => {
            const v = r[c.key];
            if (typeof v === 'string' && kinds[i] === 'code') return humanizeCode(v);
            if (typeof v === 'string' && kinds[i] === 'date') return calendarDate(v);
            return show(v);
          })
        );
        y = drawTable(doc, report.columns.map((c, i) => ({ label: c.label, align: numeric[i] ? 'right' : 'left' })), rows, { x: left, y, width });
        if (report.rows.length > MAX_PDF_ROWS) {
          y = ensure(20, y + 6);
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(BRAND.muted)
            .text(`Showing the first ${MAX_PDF_ROWS} of ${report.rows.length} rows. The Excel export has all of them.`, left, y, { width });
          y = doc.y;
        }
        y += 12;
      }

      // ── Notes ──
      if (report.notes.length) {
        y = ensure(30, y);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND.tealDark).text('Notes', left, y);
        y = doc.y + 3;
        for (const note of report.notes) {
          doc.font('Helvetica').fontSize(8.5);
          y = ensure(doc.heightOfString(note, { width: width - 14 }) + 3, y);
          doc.fillColor(BRAND.muted).text(`•  ${note}`, left, y, { width });
          y = doc.y + 2;
        }
      }

      stampFooters(doc, `HSJ HRISense · ${report.title} report · Generated ${phDateTime()}`);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const XL = {
  teal: 'FF148281',
  tealDark: 'FF0D4F4E',
  tealLight: 'FFE6F5F4',
  zebra: 'FFF6F9F9',
  line: 'FFD5DEDE',
  muted: 'FF6B7280',
};
const XL_TONE: Record<Tone, { fill: string; text: string }> = {
  good: { fill: 'FFDEF2E7', text: 'FF1F6F43' },
  warning: { fill: 'FFF7ECD5', text: 'FF8A5A00' },
  critical: { fill: 'FFFFF1F2', text: 'FFB42335' },
  review: { fill: 'FFF2EDFD', text: 'FF5B3FA3' },
  neutral: { fill: 'FFF1F5F9', text: 'FF475569' },
};
const thin = { style: 'thin' as const, color: { argb: XL.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

export async function reportToExcel(report: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HSJ HRISense';
  wb.created = new Date();
  const ws = wb.addWorksheet(report.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: `&L&8HSJ HRISense — ${report.title}&R&8Page &P of &N` },
  });
  const cols = Math.max(report.columns.length, 4);
  const numeric = numericColumns(report);
  const kinds = columnKinds(report);

  const banner = (rowNo: number, text: string, style: Partial<ExcelJS.Style>, height?: number) => {
    ws.mergeCells(rowNo, 1, rowNo, cols);
    const cell = ws.getCell(rowNo, 1);
    cell.value = text;
    Object.assign(cell, style);
    if (height) ws.getRow(rowNo).height = height;
  };

  let r = 1;
  banner(r++, `HSJ HRISense — ${report.title}`, {
    font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.teal } },
    alignment: { vertical: 'middle', indent: 1 },
  }, 30);
  banner(r++, report.description, { font: { italic: true, color: { argb: XL.muted } }, alignment: { indent: 1, wrapText: true } }, 18);
  const meta = [periodText(report) && `Period: ${periodText(report)}`, `Generated: ${phDateTime()}`].filter(Boolean).join('    ·    ');
  banner(r++, meta, { font: { bold: true, size: 9, color: { argb: XL.tealDark } }, alignment: { indent: 1 } });
  r++;

  if (report.totals.length) {
    banner(r++, 'Summary', { font: { bold: true, size: 12, color: { argb: XL.tealDark } } });
    for (const t of report.totals) {
      const tone = XL_TONE[(t.tone as Tone) ?? 'neutral'];
      const labelCell = ws.getCell(r, 1);
      labelCell.value = label(t.label);
      labelCell.font = { color: { argb: 'FF1F2937' } };
      labelCell.border = box;
      ws.mergeCells(r, 1, r, Math.max(1, Math.min(2, cols - 1)));
      const value = ws.getCell(r, Math.min(3, cols));
      value.value = typeof t.value === 'number' ? t.value : String(t.value);
      value.font = { bold: true, color: { argb: tone.text } };
      value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
      value.alignment = { horizontal: 'right' };
      if (typeof t.value === 'number') value.numFmt = '#,##0';
      value.border = box;
      r++;
    }
    r++;
  }

  if (report.summary.length) {
    banner(r++, 'Key findings', { font: { bold: true, size: 12, color: { argb: XL.tealDark } } });
    for (const line of report.summary) banner(r++, `•  ${line}`, { alignment: { wrapText: true, indent: 1 } });
    r++;
  }

  // Table
  const headerRow = r;
  report.columns.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.teal } };
    cell.alignment = { vertical: 'middle', horizontal: numeric[i] ? 'right' : 'left', wrapText: true };
    cell.border = box;
  });
  ws.getRow(r).height = 22;
  r++;
  report.rows.forEach((row, ri) => {
    report.columns.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      const v = row[c.key];
      if (typeof v === 'string' && kinds[i] === 'code') cell.value = humanizeCode(v);
      else if (typeof v === 'string' && kinds[i] === 'date') {
        cell.value = new Date(`${v}T00:00:00Z`);
        cell.numFmt = 'mmm d, yyyy';
      } else cell.value = v === null || v === undefined ? '' : v;
      cell.border = box;
      cell.alignment = { vertical: 'top', horizontal: numeric[i] ? 'right' : 'left', wrapText: true };
      if (numeric[i]) cell.numFmt = '#,##0.##';
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } };
    });
    r++;
  });
  if (!report.rows.length) {
    banner(r++, 'No records for this report and period.', { font: { italic: true, color: { argb: XL.muted } } });
  } else {
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: report.columns.length } };
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  // Column widths from the content (header and rows), within sensible bounds.
  report.columns.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...report.rows.slice(0, 500).map((row) => String(row[c.key] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 3, numeric[i] ? 10 : 14), 48);
  });

  if (report.notes.length) {
    r++;
    banner(r++, 'Notes', { font: { bold: true, color: { argb: XL.tealDark } } });
    for (const note of report.notes) banner(r++, `•  ${note}`, { font: { italic: true, color: { argb: XL.muted } }, alignment: { wrapText: true } });
  }

  // Second sheet: the numbers behind each chart.
  const charts = report.charts.filter((c) => c.slices.length);
  if (charts.length) {
    const cs = wb.addWorksheet('Breakdowns', { views: [{ showGridLines: false }] });
    cs.getColumn(1).width = 42;
    cs.getColumn(2).width = 12;
    cs.getColumn(3).width = 12;
    let y = 1;
    for (const chart of charts) {
      const title = cs.getCell(y, 1);
      title.value = chart.title;
      title.font = { bold: true, size: 12, color: { argb: XL.tealDark } };
      y++;
      if (chart.subtitle) {
        cs.getCell(y, 1).value = chart.subtitle;
        cs.getCell(y, 1).font = { italic: true, color: { argb: XL.muted } };
        y++;
      }
      ['Item', 'Count', 'Share'].forEach((h, i) => {
        const cell = cs.getCell(y, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.teal } };
        cell.alignment = { horizontal: i ? 'right' : 'left' };
        cell.border = box;
      });
      y++;
      chart.slices.forEach((s, j) => {
        const cells = [cs.getCell(y, 1), cs.getCell(y, 2), cs.getCell(y, 3)];
        cells[0].value = label(s.label);
        cells[1].value = s.value;
        cells[1].numFmt = '#,##0';
        cells[2].value = chart.total ? s.value / chart.total : null;
        cells[2].numFmt = '0.0%';
        cells.forEach((cell, i) => {
          cell.border = box;
          cell.alignment = { horizontal: i ? 'right' : 'left' };
          if (j % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.zebra } };
        });
        y++;
      });
      y++;
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Plain rows for other tools. A byte-order mark makes Excel read accents (ñ, é) correctly. */
export function reportToCsv(report: ReportResult): string {
  const escape = (value: unknown) => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    report.columns.map((c) => escape(c.label)).join(','),
    ...report.rows.map((row) => report.columns.map((c) => escape(row[c.key])).join(',')),
  ];
  return '﻿' + lines.join('\r\n');
}
