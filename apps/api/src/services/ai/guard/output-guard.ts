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

/** Follow-up suggestions: short, plain, no markup. */
export function cleanFollowUps(items: string[] | undefined): string[] {
  return (items ?? [])
    .map((s) => redactSecrets(String(s).replace(/[<>`*_#[\]]/g, '').replace(/\s+/g, ' ').trim()).text.slice(0, 140))
    .filter((s) => s.length >= 3)
    .slice(0, 3);
}
