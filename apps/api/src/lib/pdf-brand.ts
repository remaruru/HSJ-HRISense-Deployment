/**
 * The look shared by HRISense's PDF exports (reports, employee profiles): a
 * brand band at the top of the first page, page numbers in the footer, and the
 * same status colours the web app uses (positive green, pending amber, urgent
 * red, review violet, neutral slate).
 */
type Doc = PDFKit.PDFDocument;

export const BRAND = {
  teal: '#148281',
  tealDark: '#0d4f4e',
  tealLight: '#e6f5f4',
  ink: '#111827',
  body: '#1f2937',
  muted: '#6b7280',
  line: '#d5dede',
  zebra: '#f6f9f9',
};

export type Tone = 'good' | 'warning' | 'critical' | 'review' | 'neutral';

export const TONE: Record<Tone, { fill: string; text: string; bar: string }> = {
  good: { fill: '#def2e7', text: '#1f6f43', bar: '#2f9e63' },
  warning: { fill: '#f7ecd5', text: '#8a5a00', bar: '#d29b1f' },
  critical: { fill: '#fff1f2', text: '#b42335', bar: '#d64552' },
  review: { fill: '#f2edfd', text: '#5b3fa3', bar: '#7c5cc4' },
  neutral: { fill: '#f1f5f9', text: '#475569', bar: '#94a3b8' },
};

/** "Oct 20, 2026, 8:02 AM" in Philippine time, whatever the server's zone. */
export const phDateTime = (d = new Date()) =>
  d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** A calendar date ("Sep 30, 2026") from an ISO string or Date, read as the day it names. */
export const calendarDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const iso = typeof value === 'string' ? value : value.toISOString();
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
};

/** "ON_LEAVE" → "On leave". */
export const humanize = (value: string | null | undefined): string =>
  value ? value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';

/** Top band of the first page: system name on the left, a document label on the right. Returns the y below it. */
export function drawBrandBand(doc: Doc, rightLabel: string): number {
  const { width } = doc.page;
  doc.save();
  doc.rect(0, 0, width, 54).fill(BRAND.teal);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text('HSJ HRISense', 36, 15, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#d7efee').text('Hospicio de San Jose', 36, 33, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
    .text(rightLabel.toUpperCase(), 36, 23, { width: width - 72, align: 'right', characterSpacing: 0.6, lineBreak: false });
  doc.restore();
  return 74;
}

/** Writes "label · Page X of Y" on every page. Needs `bufferPages: true` on the document. */
export function stampFooters(doc: Doc, left: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const { width, height, margins } = doc.page;
    // Writing below the bottom margin would start a new page, so lift it while drawing.
    const bottom = margins.bottom;
    margins.bottom = 0;
    doc.save();
    doc.moveTo(36, height - 30).lineTo(width - 36, height - 30).lineWidth(0.5).strokeColor(BRAND.line).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted);
    doc.text(left, 36, height - 24, { width: (width - 72) * 0.75, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, 36, height - 24, { width: width - 72, align: 'right', lineBreak: false });
    doc.restore();
    margins.bottom = bottom;
  }
}

/** A rounded pill (status badge). Returns its width. */
export function drawPill(doc: Doc, x: number, y: number, text: string, tone: Tone, size = 7.5): number {
  doc.font('Helvetica-Bold').fontSize(size);
  const w = doc.widthOfString(text) + 12;
  doc.save();
  doc.roundedRect(x, y, w, size + 7, (size + 7) / 2).fill(TONE[tone].fill);
  doc.fillColor(TONE[tone].text).text(text, x + 6, y + 3.5, { lineBreak: false });
  doc.restore();
  return w;
}

export interface TableColumn {
  label: string;
  /** Natural width before fitting; computed from the content when omitted. */
  width?: number;
  align?: 'left' | 'right';
}

/**
 * Draws a table that wraps long cells, repeats its header row on every new page,
 * and shades alternate rows. Returns the y below it.
 */
export function drawTable(
  doc: Doc,
  columns: TableColumn[],
  rows: string[][],
  opts: { x: number; y: number; width: number; size?: number; onNewPage?: () => number; tones?: Array<Array<Tone | null>> }
): number {
  const size = opts.size ?? 8.5;
  const pad = 5;
  // Natural widths from the content, then fitted to the available width.
  doc.font('Helvetica-Bold').fontSize(size);
  const natural = columns.map((c, i) => {
    if (c.width) return c.width;
    let w = doc.widthOfString(c.label);
    doc.font('Helvetica').fontSize(size);
    for (const r of rows.slice(0, 300)) w = Math.max(w, Math.min(doc.widthOfString(r[i] ?? ''), 230));
    doc.font('Helvetica-Bold').fontSize(size);
    return w + pad * 2 + 2;
  });
  const total = natural.reduce((a, b) => a + b, 0);
  const widths = total <= opts.width
    ? natural.map((w) => w + ((opts.width - total) * w) / total)
    : (() => {
        // Shrink the wide columns first; nothing below 44pt.
        const min = 44;
        const scaled = natural.map((w) => Math.max(min, (w * opts.width) / total));
        const over = scaled.reduce((a, b) => a + b, 0) - opts.width;
        const shrinkable = scaled.map((w) => w - min);
        const room = shrinkable.reduce((a, b) => a + b, 0) || 1;
        return scaled.map((w, i) => w - (over * shrinkable[i]) / room);
      })();

  const bottomLimit = () => doc.page.height - 44;
  const header = (y: number) => {
    doc.font('Helvetica-Bold').fontSize(size);
    const h = Math.max(...columns.map((c, i) => doc.heightOfString(c.label, { width: widths[i] - pad * 2 }))) + pad * 2;
    doc.save();
    doc.rect(opts.x, y, opts.width, h).fill(BRAND.teal);
    doc.restore();
    let x = opts.x;
    columns.forEach((c, i) => {
      doc.fillColor('#ffffff').text(c.label, x + pad, y + pad, { width: widths[i] - pad * 2, align: c.align ?? 'left' });
      x += widths[i];
    });
    return y + h;
  };

  let y = header(opts.y);
  rows.forEach((row, ri) => {
    doc.font('Helvetica').fontSize(size);
    const h = Math.max(...row.map((cell, i) => doc.heightOfString(cell || ' ', { width: widths[i] - pad * 2 }))) + pad * 2;
    if (y + h > bottomLimit()) {
      doc.addPage();
      y = header(opts.onNewPage ? opts.onNewPage() : 40);
      doc.font('Helvetica').fontSize(size);
    }
    if (ri % 2 === 1) {
      doc.save();
      doc.rect(opts.x, y, opts.width, h).fill(BRAND.zebra);
      doc.restore();
    }
    let x = opts.x;
    row.forEach((cell, i) => {
      const tone = opts.tones?.[ri]?.[i];
      if (tone) {
        drawPill(doc, x + pad, y + pad - 1.5, cell, tone, size - 1);
      } else {
        doc.font('Helvetica').fontSize(size).fillColor(BRAND.body)
          .text(cell || '—', x + pad, y + pad, { width: widths[i] - pad * 2, align: columns[i].align ?? 'left' });
      }
      x += widths[i];
    });
    doc.save();
    doc.moveTo(opts.x, y + h).lineTo(opts.x + opts.width, y + h).lineWidth(0.5).strokeColor(BRAND.line).stroke();
    doc.restore();
    y += h;
  });
  return y;
}
