import bundle from './knowledge.generated.json';
import type { KnowledgeBundle, KnowledgeEntry, KnowledgeRole } from './knowledge.types';

/**
 * HRISense knowledge for the assistant: the Help Center guides (what the user
 * sees at /help-center) and the system reference, compiled into
 * `knowledge.generated.json` by `scripts/ai/build-knowledge.ts`.
 *
 * There is one source of truth for instructions — the guides and the reference
 * document. Nothing here restates them.
 *
 * Every lookup filters by the asker's tier FIRST, so an employee's question can
 * never retrieve an HR-only guide, even by exact slug.
 */

const KNOWLEDGE = bundle as KnowledgeBundle;

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how i if in is it me my of on or so that the this to what when where which who why will with you your hrisense please'.split(' ')
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Light stemming so "requests" matches "request" and "approving" matches "approve". */
function stem(token: string): string {
  let t = token;
  if (t.length > 4 && t.endsWith('ies')) t = `${t.slice(0, -3)}y`;
  else if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 4 && /(ss|x|ch|sh)es$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t.length > 3 && t.endsWith('e') ? t.slice(0, -1) : t;
}

interface IndexedEntry {
  entry: KnowledgeEntry;
  title: Set<string>;
  keywords: Set<string>;
  textCounts: Map<string, number>;
  length: number;
}

const INDEX: IndexedEntry[] = KNOWLEDGE.entries.map((entry) => {
  const textTokens = tokenize(entry.text).map(stem);
  const counts = new Map<string, number>();
  for (const t of textTokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return {
    entry,
    title: new Set(tokenize(entry.title).map(stem)),
    keywords: new Set(entry.keywords.flatMap((k) => tokenize(k)).map(stem)),
    textCounts: counts,
    length: textTokens.length || 1,
  };
});

const DOC_FREQ = new Map<string, number>();
for (const e of INDEX) {
  const seen = new Set([...e.title, ...e.keywords, ...e.textCounts.keys()]);
  for (const t of seen) DOC_FREQ.set(t, (DOC_FREQ.get(t) ?? 0) + 1);
}
const AVG_LENGTH = INDEX.reduce((n, e) => n + e.length, 0) / Math.max(1, INDEX.length);

export function entriesForRole(role: KnowledgeRole): KnowledgeEntry[] {
  return KNOWLEDGE.entries.filter((e) => e.roles.includes(role));
}

export function guideVisibleTo(slug: string, role: KnowledgeRole): boolean {
  return KNOWLEDGE.entries.some((e) => e.kind === 'guide' && e.slug === slug && e.roles.includes(role));
}

export function getGuide(slug: string, role: KnowledgeRole): KnowledgeEntry | null {
  return KNOWLEDGE.entries.find((e) => e.kind === 'guide' && e.slug === slug && e.roles.includes(role)) ?? null;
}

export interface KnowledgeHit {
  entry: KnowledgeEntry;
  score: number;
}

/**
 * BM25-style ranking over role-visible entries. Title and keyword matches are
 * boosted; guides get a small boost because they are the user-facing source.
 */
export function searchKnowledge(query: string, role: KnowledgeRole, limit = 5): KnowledgeHit[] {
  const terms = [...new Set(tokenize(query).map(stem))];
  if (!terms.length) return [];
  const N = INDEX.length;
  const k1 = 1.4;
  const b = 0.75;

  const hits: KnowledgeHit[] = [];
  for (const e of INDEX) {
    if (!e.entry.roles.includes(role)) continue;
    let score = 0;
    for (const t of terms) {
      const df = DOC_FREQ.get(t) ?? 0;
      if (!df) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const tf = e.textCounts.get(t) ?? 0;
      const textScore = (tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * e.length) / AVG_LENGTH));
      score += idf * (textScore + (e.title.has(t) ? 2.5 : 0) + (e.keywords.has(t) ? 1.5 : 0));
    }
    if (score > 0) hits.push({ entry: e.entry, score: e.entry.kind === 'guide' ? score * 1.15 : score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function knowledgeStats(): { entries: number; guides: number; referenceSections: number } {
  return {
    entries: KNOWLEDGE.entries.length,
    guides: KNOWLEDGE.entries.filter((e) => e.kind === 'guide').length,
    referenceSections: KNOWLEDGE.entries.filter((e) => e.kind === 'reference').length,
  };
}
