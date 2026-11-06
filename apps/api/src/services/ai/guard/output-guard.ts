/**
 * Checks on the model's final answer before it is stored or shown.
 *
 * The browser renders answers as TEXT with a tiny formatting subset (it never
 * injects HTML), so this is defence in depth:
 *   • code blocks and HTML/script tags are removed — the assistant never
 *     outputs code;
 *   • anything shaped like a credential (API key, JWT, bcrypt hash) or a
 *     Philippine government ID number is redacted, in case one ever reaches the
 *     model through free text;
 *   • length is capped.
 */

const MAX_ANSWER = 6000;

const REDACTIONS: Array<[RegExp, string]> = [
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{12,}\b/g, '[redacted key]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted token]'],
  [/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{40,}/g, '[redacted hash]'],
  [/\b(password|passwd|pwd|api[\s_-]?key|secret|token)\s*[:=]\s*\S+/gi, '$1: [redacted]'],
  // SSS 00-0000000-0, PhilHealth 00-000000000-0, Pag-IBIG 0000-0000-0000, TIN 000-000-000(-000)
  [/\b\d{2}-\d{7}-\d\b/g, '[redacted ID]'],
  [/\b\d{2}-\d{9}-\d\b/g, '[redacted ID]'],
  [/\b\d{4}-\d{4}-\d{4}\b/g, '[redacted ID]'],
  [/\b\d{3}-\d{3}-\d{3}(?:-\d{3,5})?\b/g, '[redacted ID]'],
];

export interface CleanedText {
  text: string;
  removedCode: boolean;
  redacted: boolean;
}

export function redactSecrets(text: string): { text: string; redacted: boolean } {
  let out = text;
  let redacted = false;
  for (const [re, replacement] of REDACTIONS) {
    const next = out.replace(re, replacement);
    if (next !== out) redacted = true;
    out = next;
  }
  return { text: out, redacted };
}

export function cleanAnswer(raw: string): CleanedText {
  let text = String(raw ?? '');
  const before = text;
  text = text.replace(/```[\s\S]*?(```|$)/g, '');
  text = text.replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '');
  text = text.replace(/<\/?[a-z][^>]*>/gi, '');
  // Links belong in the validated `links` field, not in the text.
  text = text.replace(/\[([^\]]{1,80})\]\((?:[^)\s]{1,300})\)/g, '$1');
  text = text.replace(/\b(?:javascript|data|vbscript):/gi, '');
  const removedCode = text !== before;
  const { text: safe, redacted } = redactSecrets(text);
  const trimmed = safe.replace(/\n{3,}/g, '\n\n').trim();
  return { text: trimmed.length > MAX_ANSWER ? `${trimmed.slice(0, MAX_ANSWER - 1)}…` : trimmed, removedCode, redacted };
}

// ── Identifiers ──────────────────────────────────────────────────────────────

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** An internal record id, with the label/brackets around it ("(ID: …)", "id …"). */
const INTERNAL_ID = new RegExp(`\\s*[([]?\\s*(?:(?:employee|record|staff)\\s*id|id|#)?\\s*[:#=]?\\s*${UUID}\\s*[)\\]]?`, 'gi');

/** Table headers that are only an identifier or a row counter. */
const ID_HEADER =
  /^(?:#|no\.?|nos?\.|id|ids|i\.d\.|(?:employee|emp\.?|staff|personnel|record)\s*(?:id|no\.?|number|num\.?|#|code)|id\s*(?:no\.?|number|#))$/i;

/** A line that only states an identifier ("Employee No.: HSJ-014", "ID: 12"). */
const ID_LINE =
  /^\s*(?:[-*•]\s+|\d+[.)]\s+)?(?:\*\*)?\s*(?:(?:employee|emp\.?|staff|personnel)\s*(?:id|no\.?|number|num\.?|#|code)|id(?:\s*(?:no\.?|number))?|#)\s*(?:\*\*)?\s*[:=-]\s*(?:\*\*)?\s*\S+\s*(?:\*\*)?\s*$/i;

/** A bare employee-number code in brackets after a name: "Ana Cruz (HSJ-014)". */
const BRACKETED_CODE = /\s*[([]\s*#?[A-Z]{2,6}-?\d{2,8}\s*[)\]]/g;

/** An inline mention: "(Employee No. HSJ-014)", ", employee #014". */
const ID_INLINE = /\s*[([,]?\s*(?:employee|emp\.?|staff)\s*(?:id|no\.?|number|num\.?|#)\s*[:#]?\s*[A-Za-z]{0,6}-?\d[\w-]*\s*[)\]]?/gi;

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}

function isSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/** Drops identifier / row-number columns from every pipe table in the text. */
function dropIdColumns(text: string): string {
  const lines = text.split('\n');
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].includes('|') || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(lines[i]).map((c) => c.replace(/\*\*/g, '').trim());
    const drop = new Set(header.map((h, idx) => (ID_HEADER.test(h) ? idx : -1)).filter((idx) => idx >= 0));
    if (!drop.size || drop.size === header.length) continue;
    let j = i;
    while (j < lines.length && lines[j].includes('|')) {
      const cells = splitRow(lines[j]).filter((_, idx) => !drop.has(idx));
      lines[j] = `| ${cells.map((c) => c.trim()).join(' | ')} |`;
      j++;
    }
    i = j - 1;
  }
  return lines.join('\n');
}

/**
 * Removes identifiers from an answer. Internal record ids are never useful to a
 * reader (links carry them), so they go for everyone. A supervisor never sees
 * employee numbers, so ID / "#" / "No." columns and employee-number mentions are
 * removed from a supervisor's answer as well.
 */
export function stripIdentifiers(text: string, opts: { hideEmployeeNumbers: boolean }): { text: string; stripped: boolean } {
  let out = text.replace(INTERNAL_ID, '');
  if (opts.hideEmployeeNumbers) {
    out = dropIdColumns(out)
      .split('\n')
      .filter((line) => !ID_LINE.test(line))
      .join('\n')
      .replace(ID_INLINE, '')
      .replace(BRACKETED_CODE, '');
  }
  out = out.replace(/\(\s*\)|\[\s*\]/g, '').replace(/[ \t]+([,.;:])/g, '$1').replace(/[ \t]{2,}/g, ' ');
  return { text: out, stripped: out !== text };
}

/** Follow-up suggestions: short, plain, no markup. */
export function cleanFollowUps(items: string[] | undefined): string[] {
  return (items ?? [])
    .map((s) => redactSecrets(String(s).replace(/[<>`*_#[\]]/g, '').replace(/\s+/g, ' ').trim()).text.slice(0, 140))
    .filter((s) => s.length >= 3)
    .slice(0, 3);
}
