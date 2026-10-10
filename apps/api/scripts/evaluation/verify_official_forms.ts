/**
 * Checks the official evaluation templates stored in the database against
 * Hospicio's Word forms themselves.
 *
 *   npx tsx scripts/evaluation/verify_official_forms.ts "<folder with the .docx files>"
 *
 * Two independent checks per form:
 *   1. Structure — a fresh extraction of the document (extract_official_forms.py)
 *      against the stored template: area count and names, statements per area
 *      and their exact wording, the rating scale, and the written sections.
 *   2. Wording — every stored area name and statement must occur in the
 *      document's raw text (whitespace ignored), so a parsing slip cannot
 *      hide a difference.
 * Exits with code 1 on any mismatch.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { OFFICIAL_SCALES } from '../../src/data/official-evaluation-forms';

const prisma = new PrismaClient();
const folder = process.argv[2];
if (!folder) {
  console.error('Usage: verify_official_forms.ts <folder with the .docx files>');
  process.exit(2);
}
const extractor = path.join(__dirname, 'extract_official_forms.py');
const run = (...extra: string[]) =>
  JSON.parse(execFileSync('python', [extractor, folder, ...extra], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 32 * 1024 * 1024 }));
const squash = (s: string) => s.replace(/[\s`]+/g, '');

async function main() {
  const forms = run();
  const raw: Record<string, string> = run('--raw');
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.log(`   ✗ ${msg}`);
  };

  for (const [code, form] of Object.entries<any>(forms)) {
    const t = await prisma.evaluationTemplate.findUnique({
      where: { officialCode: code },
      include: { groups: { orderBy: { displayOrder: 'asc' } }, criteria: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
    });
    console.log(`\n${code} — ${form.sourceDocument}`);
    if (!t) {
      fail('not installed');
      continue;
    }
    const before = failures;

    // 1. Structure against a fresh extraction
    if (t.groups.length !== form.areas.length) fail(`areas: stored ${t.groups.length}, document ${form.areas.length}`);
    form.areas.forEach((area: any, i: number) => {
      const g = t.groups[i];
      if (!g) return;
      if (g.name !== area.name) fail(`area ${i + 1}: stored "${g.name}", document "${area.name}"`);
      const items = t.criteria.filter((c) => c.groupId === g.id).map((c) => c.name);
      if (items.length !== area.items.length) fail(`area ${i + 1} (${area.name}): stored ${items.length} statements, document ${area.items.length}`);
      area.items.forEach((text: string, j: number) => {
        if (items[j] !== text) fail(`area ${i + 1} statement ${String.fromCharCode(97 + j)}: stored "${items[j]}", document "${text}"`);
      });
    });
    const layout: any = t.formLayout ?? {};
    for (const key of ['generalCommentsLabel', 'goalsLabel', 'goalsPrompt', 'acknowledgment', 'overallLabel', 'appraisalLabel', 'itemComments']) {
      if (JSON.stringify(layout[key] ?? null) !== JSON.stringify(form.layout[key] ?? null)) fail(`${key}: stored ${JSON.stringify(layout[key])}, document ${JSON.stringify(form.layout[key])}`);
    }
    if (JSON.stringify(layout.instructions) !== JSON.stringify(form.layout.instructions)) fail('instructions differ');

    // Scale: Forms 1–4 U/F/G/VG/E; the Simplified form its own five labels.
    const expected = code === 'HSJ_SIMPLIFIED_SUPERVISORY' ? OFFICIAL_SCALES.HSJ_SIMPLIFIED : OFFICIAL_SCALES.HSJ_EPR;
    const stored = ((t.scoreLabels as any)?.options ?? []).map((o: any) => `${o.score} ${o.label}`).join(' | ');
    if (stored !== expected.map((o) => `${o.score} ${o.label}`).join(' | ')) fail(`scale: ${stored}`);
    const doc = raw[code];
    for (const o of expected) {
      if (!squash(doc).toLowerCase().includes(squash(o.label).toLowerCase())) fail(`scale label "${o.label}" is not in the document`);
    }

    // 2. Every stored name and statement occurs in the document's own text
    const body = squash(doc);
    for (const g of t.groups) if (!body.includes(squash(g.name))) fail(`area "${g.name}" not found in the document text`);
    for (const c of t.criteria) if (!body.includes(squash(c.name))) fail(`statement "${c.name}" not found in the document text`);

    const statements = t.criteria.length;
    if (failures === before) {
      console.log(`   ✓ ${t.groups.length} areas, ${statements} statements, scale and written sections match; every statement found in the document text`);
    }
  }

  console.log(failures ? `\n${failures} mismatch(es).` : '\nAll five official templates match their source documents.');
  process.exitCode = failures ? 1 : 0;
}

main().finally(() => prisma.$disconnect());
