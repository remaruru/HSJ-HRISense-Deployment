import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BRAND, drawBrandBand, drawTable, stampFooters } from '../../../lib/pdf-brand';
import type { ChartPayload } from '../charts/chart-schema';

/**
 * PDF and Excel exports of AI Assistance output — an answer (with its charts
 * and tables), a quick-analytics view, or HR's workforce summary.
 *
 * An export carries only the AI's output and when it was exported: the stored
 * answer text, the server-built charts and their data. Nothing is recomputed or
 * rewritten. The band and footer of the PDF still label it as AI Assistance.
 */

export type ExportBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

export interface ExportDocument {
  /** Big title on the first page, only where the output needs one. Never the question the user typed. */
  title?: string;
  /** Small label in the brand band, e.g. "AI Assistance". */
  label: string;
  /** "Exported Nov 5, 2026, 10:44 PM" */
  meta: string[];
  sections: Array<{ heading?: string; blocks: ExportBlock[]; charts?: Array<ChartPayload & { caption?: string }> }>;
  links?: Array<{ label: string; path: string }>;
  notes?: string[];
}

// ── the answer's text → blocks ───────────────────────────────────────────────

const stripBold = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');

/** Splits the assistant's allowed formatting (paragraphs, lists, pipe tables, ### headings) into blocks. */
export function answerToBlocks(text: string): ExportBlock[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ExportBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: stripBold(para.join(' ').trim()) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flush(); continue; }
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push({ kind: 'heading', text: stripBold(heading[1]) }); continue; }
    if (/^\|.*\|$/.test(line)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => stripBold(c.trim()));
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      if (rows.length) blocks.push({ kind: 'table', header: rows[0], rows: rows.slice(1) });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? 'bullets' : 'numbered';
      const last = blocks[blocks.length - 1];
      const item = stripBold((bullet ?? numbered)![1]);
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] } as ExportBlock);
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

// ── shared ───────────────────────────────────────────────────────────────────

const PALETTE = ['#148281', '#d29b1f', '#7c5cc4', '#2f9e63', '#d64552', '#475569'];
/** pdfkit's standard fonts are WinAnsi: keep what they can draw. */
const pdfSafe = (t: string) =>
  String(t ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[→]/g, '->')
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ–—•…·]/g, '');
const show = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : v === null || v === undefined ? '—' : String(v));

export function chartTable(chart: ChartPayload): { header: string[]; rows: string[][] } {
  const cols = [...chart.series, ...(chart.details ?? [])];
  return {
    header: [chart.xLabel || 'Item', ...cols.map((c) => (chart.unit && chart.series.includes(c as any) ? `${c.label} (${chart.unit})` : c.label))],
    rows: chart.data.map((row) => [String(row[chart.xKey] ?? '—'), ...cols.map((c) => show(row[c.key]))]),
  };
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export function exportToPdf(docSpec: ExportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true, info: { Title: pdfSafe(`HSJ HRISense — ${docSpec.title ?? docSpec.label}`).slice(0, 200) } });
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
      const text = (t: string, y: number, opts: { font?: string; size?: number; color?: string; indent?: number; gap?: number } = {}) => {
        doc.font(opts.font ?? 'Helvetica').fontSize(opts.size ?? 10);
        const w = width - (opts.indent ?? 0);
        const h = doc.heightOfString(pdfSafe(t), { width: w });
        y = ensure(Math.min(h, 200), y);
        doc.fillColor(opts.color ?? BRAND.body).text(pdfSafe(t), left + (opts.indent ?? 0), y, { width: w });
        return doc.y + (opts.gap ?? 4);
      };

      let y = drawBrandBand(doc, docSpec.label);
      if (docSpec.title) {
        doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND.ink).text(pdfSafe(docSpec.title), left, y, { width });
        y = doc.y + 4;
      }
      for (const m of docSpec.meta) {
        doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.muted).text(pdfSafe(m), left, y, { width });
        y = doc.y + 1;
      }
      y += 10;

      for (const section of docSpec.sections) {
        if (section.heading) {
          y = ensure(30, y);
          y = text(section.heading, y, { font: 'Helvetica-Bold', size: 11.5, color: BRAND.tealDark, gap: 5 });
        }
        for (const b of section.blocks) {
          if (b.kind === 'heading') y = text(b.text, y + 2, { font: 'Helvetica-Bold', size: 10.5, color: BRAND.ink, gap: 4 });
          else if (b.kind === 'paragraph') y = text(b.text, y, { gap: 6 });
          else if (b.kind === 'bullets' || b.kind === 'numbered') {
            b.items.forEach((item, i) => {
              doc.font('Helvetica').fontSize(10);
              const h = doc.heightOfString(pdfSafe(item), { width: width - 16 });
              y = ensure(Math.min(h, 200), y);
              if (b.kind === 'bullets') doc.save().circle(left + 4, y + 5.5, 1.8).fill(BRAND.teal).restore();
              else doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND.tealDark).text(`${i + 1}.`, left, y, { width: 14, lineBreak: false });
              doc.font('Helvetica').fontSize(10).fillColor(BRAND.body).text(pdfSafe(item), left + 16, y, { width: width - 16 });
              y = doc.y + 3;
            });
            y += 3;
          } else if (b.kind === 'table') {
            y = ensure(50, y + 2);
            const cols = b.header.map((h) => ({ label: pdfSafe(h) }));
            const rows = b.rows.map((r) => b.header.map((_, i) => pdfSafe(r[i] ?? '')));
            y = drawTable(doc, cols, rows, { x: left, y, width }) + 10;
          }
        }
        for (const chart of section.charts ?? []) y = drawChart(doc, chart, left, ensure(230, y + 4), width) + 12;
        y += 4;
      }

      if (docSpec.links?.length) {
        y = ensure(40, y);
        y = text('Open in HSJ HRISense', y, { font: 'Helvetica-Bold', size: 10, color: BRAND.tealDark, gap: 3 });
        for (const l of docSpec.links) y = text(`•  ${l.label}  —  ${l.path}`, y, { size: 8.5, color: BRAND.muted, gap: 1 });
        y += 6;
      }
      if (docSpec.notes?.length) {
        y = ensure(40, y + 4);
        doc.save().roundedRect(left, y, width, 4, 2).fill(BRAND.tealLight).restore();
        y += 10;
        for (const n of docSpec.notes) y = text(n, y, { size: 8, color: BRAND.muted, gap: 2 });
      }

      stampFooters(doc, pdfSafe(`HSJ HRISense · ${docSpec.label}`));
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Draws one chart (bar, line/area or pie) with its data table. Returns the y below it. */
function drawChart(doc: PDFKit.PDFDocument, chart: ChartPayload & { caption?: string }, x: number, y: number, width: number): number {
  const title = pdfSafe(chart.title);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BRAND.ink).text(title, x, y, { width });
  y = doc.y + 2;
  if (chart.caption) {
    doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(pdfSafe(chart.caption), x, y, { width });
    y = doc.y + 2;
  }
  const series = chart.series;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const plotH = 150;
  const top = y + 6;

  if (chart.type === 'pie') {
    const s = series[0];
    const total = chart.data.reduce((a, r) => a + Math.max(0, num(r[s.key])), 0) || 1;
    const cx = x + 80;
    const cy = top + plotH / 2;
    const r = 62;
    let angle = -Math.PI / 2;
    chart.data.forEach((row, i) => {
      const v = Math.max(0, num(row[s.key]));
      const sweep = (v / total) * Math.PI * 2;
      if (sweep > 0) {
        const end = angle + sweep;
        doc.save();
        doc.moveTo(cx, cy)
          .lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        // arc as short segments (pdfkit has no arc-to)
        for (let a = angle; a < end; a += 0.05) doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        doc.lineTo(cx + r * Math.cos(end), cy + r * Math.sin(end)).closePath().fill(PALETTE[i % PALETTE.length]);
        doc.restore();
      }
      angle += sweep;
    });
    let ly = top + 6;
    chart.data.slice(0, 12).forEach((row, i) => {
      doc.save().rect(x + 170, ly + 1, 8, 8).fill(PALETTE[i % PALETTE.length]).restore();
      const v = num(row[s.key]);
      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.body)
        .text(pdfSafe(`${row[chart.xKey]}: ${show(v)} (${Math.round((v / total) * 1000) / 10}%)`), x + 184, ly, { width: width - 190, lineBreak: false, ellipsis: true });
      ly += 12;
    });
    y = Math.max(top + plotH, ly) + 8;
  } else if (chart.type === 'bar') {
    // Horizontal grouped bars: easy to read with long names.
    const rows = chart.data.slice(0, 30);
    const labelW = Math.min(170, width * 0.32);
    const barMax = width - labelW - 70;
    const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => num(r[s.key]))));
    const rowH = Math.max(12, series.length * 9 + 5);
    let by = top;
    rows.forEach((row) => {
      if (by + rowH > doc.page.height - 50) { doc.addPage(); by = 40; }
      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.body)
        .text(pdfSafe(String(row[chart.xKey] ?? '—')), x, by + 1, { width: labelW - 6, lineBreak: false, ellipsis: true });
      series.forEach((s, k) => {
        const v = num(row[s.key]);
        const bw = Math.max(1.5, (v / max) * barMax);
        doc.save().roundedRect(x + labelW, by + k * 9, bw, 7.5, 2).fill(PALETTE[k % PALETTE.length]).restore();
        doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.ink)
          .text(row[s.key] === null ? '—' : show(v), x + labelW + bw + 4, by + k * 9, { width: 60, lineBreak: false });
      });
      by += rowH;
    });
    y = by + 4;
  } else {
    // line / area: a simple plot with min/max labels.
    const rows = chart.data;
    const plotX = x + 34;
    const plotW = width - 44;
    const values = rows.flatMap((r) => series.map((s) => num(r[s.key])));
    const max = Math.max(1, ...values);
    doc.save().moveTo(plotX, top).lineTo(plotX, top + plotH).lineTo(plotX + plotW, top + plotH).lineWidth(0.6).strokeColor(BRAND.line).stroke().restore();
    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted).text(show(max), x, top - 3, { width: 30, align: 'right' }).text('0', x, top + plotH - 4, { width: 30, align: 'right' });
    const px = (i: number) => plotX + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
    const py = (v: number) => top + plotH - (v / max) * plotH;
    series.forEach((s, k) => {
      doc.save();
      rows.forEach((r, i) => (i === 0 ? doc.moveTo(px(i), py(num(r[s.key]))) : doc.lineTo(px(i), py(num(r[s.key])))));
      doc.lineWidth(1.6).strokeColor(PALETTE[k % PALETTE.length]).stroke();
      doc.restore();
    });
    const first = String(rows[0]?.[chart.xKey] ?? '');
    const last = String(rows[rows.length - 1]?.[chart.xKey] ?? '');
    doc.font('Helvetica').fontSize(7).fillColor(BRAND.muted)
      .text(pdfSafe(first), plotX, top + plotH + 3, { width: 120, lineBreak: false })
      .text(pdfSafe(last), plotX + plotW - 120, top + plotH + 3, { width: 120, align: 'right', lineBreak: false });
    let lx = plotX;
    series.forEach((s, k) => {
      doc.save().rect(lx, top + plotH + 15, 8, 8).fill(PALETTE[k % PALETTE.length]).restore();
      doc.font('Helvetica').fontSize(8).fillColor(BRAND.body).text(pdfSafe(s.label), lx + 11, top + plotH + 14, { lineBreak: false });
      lx += 24 + doc.widthOfString(pdfSafe(s.label));
    });
    y = top + plotH + 30;
  }

  // The chart's numbers, as in the app's "View data" table.
  const t = chartTable(chart);
  if (y + 40 > doc.page.height - 44) { doc.addPage(); y = 40; }
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(BRAND.muted).text('Chart data', x, y, { width });
  y = doc.y + 2;
  return drawTable(doc, t.header.map((h, i) => ({ label: pdfSafe(h), align: i === 0 ? 'left' : 'right' })), t.rows.map((r) => r.map(pdfSafe)), { x, y, width, size: 8 });
}

// ── Excel ────────────────────────────────────────────────────────────────────

const XL = { teal: 'FF148281', tealLight: 'FFE6F5F4', line: 'FFD5DEDE', muted: 'FF6B7280' };
const thin = { style: 'thin' as const, color: { argb: XL.line } };

function addTable(ws: ExcelJS.Worksheet, header: string[], rows: Array<Array<string | number | null>>) {
  const h = ws.addRow(header);
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.teal } };
    c.border = { top: thin, left: thin, bottom: thin, right: thin };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  for (const r of rows) {
    const row = ws.addRow(r);
    row.eachCell((c) => {
      c.border = { top: thin, left: thin, bottom: thin, right: thin };
      c.alignment = { vertical: 'top', wrapText: true };
    });
  }
}

/** Numbers stay numbers in Excel ("1,234" → 1234) so the sheet can be worked with. */
const cellValue = (v: string): string | number => {
  const n = v.replace(/,/g, '').trim();
  return /^-?\d+(\.\d+)?$/.test(n) ? Number(n) : v;
};

export async function exportToExcel(docSpec: ExportDocument): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HSJ HRISense';
  wb.created = new Date();

  const ws = wb.addWorksheet('Answer', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 110 }];
  if (docSpec.title) {
    const title = ws.addRow([docSpec.title]);
    title.font = { bold: true, size: 14, color: { argb: 'FF0D4F4E' } };
    title.alignment = { wrapText: true };
  }
  for (const m of docSpec.meta) ws.addRow([m]).font = { size: 9, color: { argb: XL.muted } };
  ws.addRow([]);
  for (const section of docSpec.sections) {
    if (section.heading) {
      const r = ws.addRow([section.heading]);
      r.font = { bold: true, size: 11.5, color: { argb: 'FF0D4F4E' } };
    }
    for (const b of section.blocks) {
      if (b.kind === 'heading') ws.addRow([b.text]).font = { bold: true };
      else if (b.kind === 'paragraph') ws.addRow([b.text]).alignment = { wrapText: true, vertical: 'top' };
      else if (b.kind === 'bullets' || b.kind === 'numbered') b.items.forEach((it, i) => (ws.addRow([`${b.kind === 'bullets' ? '•' : `${i + 1}.`} ${it}`]).alignment = { wrapText: true, indent: 1 }));
      else if (b.kind === 'table') ws.addRow([`Table: ${b.header.join(' | ')} — see the "Table" sheets`]).font = { italic: true, color: { argb: XL.muted } };
    }
    ws.addRow([]);
  }
  if (docSpec.links?.length) {
    ws.addRow(['Open in HSJ HRISense']).font = { bold: true, color: { argb: 'FF0D4F4E' } };
    for (const l of docSpec.links) ws.addRow([`${l.label} — ${l.path}`]).font = { color: { argb: XL.muted } };
    ws.addRow([]);
  }
  for (const n of docSpec.notes ?? []) {
    const r = ws.addRow([n]);
    r.font = { italic: true, size: 9, color: { argb: XL.muted } };
    r.alignment = { wrapText: true };
  }

  // Every table and every chart's data gets its own sheet, ready to sort and filter.
  let t = 0;
  let c = 0;
  const sheetName = (base: string) => base.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  for (const section of docSpec.sections) {
    for (const b of section.blocks) {
      if (b.kind !== 'table') continue;
      t += 1;
      const s = wb.addWorksheet(sheetName(`Table ${t}`));
      addTable(s, b.header, b.rows.map((r) => b.header.map((_, i) => cellValue(r[i] ?? ''))));
      s.columns.forEach((col) => (col.width = 24));
      s.views = [{ state: 'frozen', ySplit: 1 }];
    }
    for (const chart of section.charts ?? []) {
      c += 1;
      const s = wb.addWorksheet(sheetName(`Chart ${c} - ${chart.title}`));
      const head = s.addRow([chart.title]);
      head.font = { bold: true, size: 12, color: { argb: 'FF0D4F4E' } };
      if (chart.caption) s.addRow([chart.caption]).font = { size: 9, color: { argb: XL.muted } };
      s.addRow([]);
      const tbl = chartTable(chart);
      addTable(s, tbl.header, chart.data.map((row) => [String(row[chart.xKey] ?? '—'), ...[...chart.series, ...(chart.details ?? [])].map((col) => (typeof row[col.key] === 'number' ? (row[col.key] as number) : row[col.key] === null ? null : String(row[col.key])))]));
      s.columns.forEach((col, i) => (col.width = i === 0 ? 34 : 22));
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
