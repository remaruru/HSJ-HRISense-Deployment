/**
 * Static Help Center registry check.
 *
 * Run with:  npx tsx scripts/validate-help-registry.ts
 *
 * It reports the real counts (never hard-coded totals) and fails on genuine
 * defects: duplicate ids or slugs, a READY guide with no content, a guide no
 * role can reach, an unknown category, missing search keywords, and related-guide
 * links that are broken, not READY, or unreachable for that guide's own readers.
 */
import { HELP_CATEGORIES, HELP_GUIDES } from '../src/pages/HelpCenter/helpCenter.registry';
import { validateHelpRegistry } from '../src/pages/HelpCenter/helpCenter.search';
import type { HelpCategoryCode, HelpRole } from '../src/pages/HelpCenter/helpCenter.types';

const result = validateHelpRegistry();

const byCategory = new Map<HelpCategoryCode, number>();
for (const guide of HELP_GUIDES) {
  byCategory.set(guide.category, (byCategory.get(guide.category) ?? 0) + 1);
}

const roleCount = (role: HelpRole) =>
  HELP_GUIDES.filter((g) => g.roles.includes(role)).length;

console.log('HRISense Help Center — registry check');
console.log('─'.repeat(60));
console.log(`Total guides        : ${result.stats.total}`);
console.log(`  READY             : ${result.stats.ready}`);
console.log(`  DRAFT             : ${result.stats.draft}`);
console.log(`  METADATA_ONLY     : ${result.stats.metadataOnly}`);
console.log(`Categories declared : ${HELP_CATEGORIES.length}`);
console.log('─'.repeat(60));
console.log(`HR Personnel (FULL) : ${roleCount('FULL')}`);
console.log(`Supervisor          : ${roleCount('SUPERVISOR')}`);
console.log(`Employee (STANDARD) : ${roleCount('STANDARD')}`);
console.log(`Public              : ${roleCount('PUBLIC')}`);
console.log('─'.repeat(60));
for (const category of [...HELP_CATEGORIES].sort((a, b) => a.order - b.order)) {
  console.log(`${category.code.padEnd(20)} ${byCategory.get(category.code) ?? 0}`);
}
console.log('─'.repeat(60));

if (result.isValid) {
  console.log('PASS — no registry defects found.');
  process.exit(0);
}

console.error(`FAIL — ${result.errors.length} problem(s):`);
for (const error of result.errors) console.error(`  • ${error}`);
process.exit(1);
