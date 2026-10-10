/**
 * Builds the AI assistant's knowledge bundle.
 *
 *   npm run ai:knowledge           rebuild src/services/ai/knowledge/knowledge.generated.json
 *   npm run ai:knowledge -- --check   exit 1 if the bundle is out of date (CI / tests)
 *
 * Sources (the ONLY places HRISense instructions are written):
 *   • apps/web/src/pages/HelpCenter/guides/*.guides.ts — the Help Center guides,
 *     with the roles each guide is published to;
 *   • docs/HRISENSE_SYSTEM_REFERENCE.md — the system reference, split by section
 *     and tagged with the tiers each section is relevant to.
 *
 * The generated appendices of the reference (API table, data model, enum
 * lists) are left out: they describe internals, not how to use HRISense.
 *
 * Runs automatically before `npm run dev` and `npm run build` in apps/api.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HELP_GUIDES } from '../../../web/src/pages/HelpCenter/helpCenter.registry';
import type { HelpGuideDefinition } from '../../../web/src/pages/HelpCenter/helpCenter.types';
import type { KnowledgeBundle, KnowledgeEntry, KnowledgeRole } from '../../src/services/ai/knowledge/knowledge.types';

const API_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const GUIDES_DIR = path.join(REPO_ROOT, 'apps', 'web', 'src', 'pages', 'HelpCenter', 'guides');
const REGISTRY = path.join(REPO_ROOT, 'apps', 'web', 'src', 'pages', 'HelpCenter', 'helpCenter.registry.ts');
const REFERENCE = path.join(REPO_ROOT, 'docs', 'HRISENSE_SYSTEM_REFERENCE.md');
export const OUTPUT = path.join(API_ROOT, 'src', 'services', 'ai', 'knowledge', 'knowledge.generated.json');

const ALL: KnowledgeRole[] = ['FULL', 'SUPERVISOR', 'STANDARD'];
const HR: KnowledgeRole[] = ['FULL'];
const HR_SUPERVISOR: KnowledgeRole[] = ['FULL', 'SUPERVISOR'];

/**
 * Reference sections that concern only HR (or HR and supervisors). Anything not
 * listed is general knowledge about using HRISense and is visible to everyone.
 * A key matches its own section and every sub-section ("8" covers 8.1–8.5).
 */
const SECTION_ROLES: Record<string, KnowledgeRole[]> = {
  '4.2': HR, // account administration
  '4.7': HR, // audit log
  '5.1': HR, // HR dashboard
  '5.2': HR_SUPERVISOR, // supervisor dashboard
  '6.1': HR,
  '6.2': HR,
  '6.3': HR,
  '6.5': HR,
  '6.6': HR,
  '6.7': HR,
  '6.10': HR,
  '7.3': HR, // import tab
  '8': HR, // attendance import
  '11.3': HR_SUPERVISOR, // setting weekly schedules (supervisors: direct reports only)
  '14.2': HR,
  '14.3': HR,
  '15.2': HR,
  '15.3': HR,
  '16.3': HR,
  '17': HR, // recruitment
  '18.2': HR,
  '19': HR, // reports
  'E.1': HR, // defects
  'E.2': HR, // security observations
  'E.3': HR, // API-only features
  'E.6': HR, // unused tables
};

/** Top-level sections left out entirely. */
const SKIP_SECTIONS = new Set(['0', 'Contents', 'A', 'B', 'C']);

function rolesForSection(id: string): KnowledgeRole[] {
  if (SECTION_ROLES[id]) return SECTION_ROLES[id];
  const major = id.split('.')[0];
  return SECTION_ROLES[major] ?? ALL;
}

const sha = (text: string) => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const clean = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim();

function guideText(g: HelpGuideDefinition): string {
  const c = g.content;
  const parts: string[] = [clean(g.shortDescription)];
  if (c) {
    parts.push(`Purpose: ${clean(c.purpose)}`);
    if (c.whenToUse) parts.push(`When to use: ${clean(c.whenToUse)}`);
    if (c.prerequisites?.length) parts.push(`Before you start: ${c.prerequisites.map(clean).join('; ')}`);
    for (const s of c.steps ?? []) {
      const extras = [s.uiPath && `Where: ${clean(s.uiPath)}`, s.explanation, s.tip && `Tip: ${clean(s.tip)}`, s.warning && `Warning: ${clean(s.warning)}`, s.info, s.expectedResult && `Result: ${clean(s.expectedResult)}`]
        .filter(Boolean)
        .map((x) => clean(x as string));
      parts.push(`Step ${s.stepNumber}. ${clean(s.title)}: ${clean(s.instruction)}${extras.length ? ` (${extras.join('. ')})` : ''}`);
    }
    if (c.whatHappensNext) parts.push(`What happens next: ${clean(c.whatHappensNext)}`);
    for (const t of c.troubleshooting ?? []) parts.push(`Problem: ${clean(t.problem)} — Solution: ${clean(t.solution)}${t.note ? ` (${clean(t.note)})` : ''}`);
    for (const tip of c.tips ?? []) parts.push(`Tip: ${clean(tip)}`);
  }
  return parts.filter(Boolean).join('\n');
}

function guideEntries(): KnowledgeEntry[] {
  return HELP_GUIDES.filter((g) => g.contentStatus === 'READY').map((g) => ({
    id: `guide:${g.slug}`,
    kind: 'guide' as const,
    title: g.title,
    module: g.module,
    roles: g.roles.filter((r): r is KnowledgeRole => r !== 'PUBLIC'),
    keywords: g.keywords,
    text: guideText(g),
    slug: g.slug,
    link: `/help-center/${g.slug}`,
  }));
}

function referenceEntries(markdown: string): KnowledgeEntry[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const entries: KnowledgeEntry[] = [];
  let major: { id: string; title: string } | null = null;
  let current: { id: string; title: string; body: string[] } | null = null;
  let inFence = false;

  const flush = () => {
    if (!current || !major || SKIP_SECTIONS.has(major.id)) return;
    const text = current.body.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.replace(/[-|\s]/g, '').length < 40) return;
    entries.push({
      id: `ref:${current.id}`,
      kind: 'reference',
      title: current.title,
      module: major.title,
      roles: rolesForSection(current.id),
      keywords: [],
      text: text.slice(0, 7000),
    });
  };

  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    const h2 = !inFence && /^## (.+)$/.exec(line);
    const h3 = !inFence && /^### (.+)$/.exec(line);
    if (h2) {
      flush();
      const title = h2[1].trim();
      const num = /^(\d+)\.\s/.exec(title)?.[1] ?? /^Appendix ([A-Z])\b/.exec(title)?.[1] ?? title;
      major = { id: num, title };
      current = { id: num, title, body: [] };
    } else if (h3 && major) {
      flush();
      const title = h3[1].trim();
      const sub = /^(\d+\.\d+|[A-Z]\.\d+)\s/.exec(title)?.[1] ?? `${major.id}.${title}`;
      current = { id: sub, title: `${major.title} — ${title}`, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return entries;
}

export function sourceHashes(): Record<string, string> {
  const files = [
    REGISTRY,
    ...fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.guides.ts')).sort().map((f) => path.join(GUIDES_DIR, f)),
    REFERENCE,
  ];
  return Object.fromEntries(files.map((f) => [path.relative(REPO_ROOT, f).replace(/\\/g, '/'), sha(fs.readFileSync(f, 'utf8'))]));
}

export function buildBundle(): KnowledgeBundle {
  const reference = fs.readFileSync(REFERENCE, 'utf8');
  return { sources: sourceHashes(), entries: [...guideEntries(), ...referenceEntries(reference)] };
}

function main() {
  const check = process.argv.includes('--check');
  const bundle = buildBundle();
  const next = `${JSON.stringify(bundle, null, 1)}\n`;
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';

  if (check) {
    if (current !== next) {
      console.error('AI knowledge bundle is out of date. Run: npm run ai:knowledge --workspace=apps/api');
      process.exit(1);
    }
    console.log('AI knowledge bundle is up to date.');
    return;
  }
  if (current === next) {
    console.log(`AI knowledge bundle unchanged (${bundle.entries.length} entries).`);
    return;
  }
  fs.writeFileSync(OUTPUT, next);
  const guides = bundle.entries.filter((e) => e.kind === 'guide').length;
  console.log(`AI knowledge bundle written: ${guides} guides, ${bundle.entries.length - guides} reference sections.`);
}

if (require.main === module) main();
