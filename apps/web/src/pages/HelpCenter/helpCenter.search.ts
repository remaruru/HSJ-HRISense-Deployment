import { HELP_CATEGORIES, HELP_GUIDES } from './helpCenter.registry';
import type {
  HelpCategory,
  HelpCategoryCode,
  HelpGuideDefinition,
  HelpRole,
  HelpSearchResult,
} from './helpCenter.types';

/**
 * Normalizes text for search: lowercases, trims, and collapses multiple whitespace characters.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Returns all guides accessible to a specific permission tier / role.
 * ROLE FILTERING OCCURS BEFORE SEARCH.
 */
export function getGuidesForRole(role: HelpRole): HelpGuideDefinition[] {
  return HELP_GUIDES.filter((guide) => guide.roles.includes(role));
}

/**
 * Returns only READY guides accessible to a specific role.
 * Used for production-facing catalog, search, category counts, and common tasks.
 * METADATA_ONLY and DRAFT guides are hidden from the production Help Center UI.
 */
export function getReadyGuidesForRole(role: HelpRole): HelpGuideDefinition[] {
  return HELP_GUIDES.filter(
    (guide) => guide.roles.includes(role) && guide.contentStatus === 'READY'
  );
}

/**
 * Searches READY guides for a specific role with deterministic ranking.
 * Only READY guides are returned — METADATA_ONLY and DRAFT are excluded.
 * Ranking order:
 * 1. EXACT_TITLE (Score: 100)
 * 2. TITLE_MATCH (Score: 75)
 * 3. KEYWORD_MATCH (Score: 50)
 * 4. CATEGORY_MATCH (Score: 30)
 * 5. DESCRIPTION_MATCH (Score: 20)
 */
export function searchHelpGuides(query: string, role: HelpRole): HelpSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  // Only search READY guides accessible to the role
  const accessibleGuides = getReadyGuidesForRole(role);
  const results: HelpSearchResult[] = [];

  for (const guide of accessibleGuides) {
    const normTitle = normalizeSearchText(guide.title);
    const normDesc = normalizeSearchText(guide.shortDescription);
    const normModule = normalizeSearchText(guide.module);
    const normKeywords = guide.keywords.map(normalizeSearchText);

    if (normTitle === normalizedQuery) {
      results.push({ guide, score: 100, matchType: 'EXACT_TITLE' });
      continue;
    }

    if (normTitle.includes(normalizedQuery)) {
      results.push({ guide, score: 75, matchType: 'TITLE_MATCH' });
      continue;
    }

    // A keyword equal to the whole query ranks above a partial one, so
    // "change password" puts the change-password guide first.
    if (normKeywords.includes(normalizedQuery)) {
      results.push({ guide, score: 60, matchType: 'KEYWORD_MATCH' });
      continue;
    }
    const keywordMatch = normKeywords.some(
      (kw) => kw.includes(normalizedQuery) || normalizedQuery.includes(kw)
    );
    if (keywordMatch) {
      results.push({ guide, score: 50, matchType: 'KEYWORD_MATCH' });
      continue;
    }

    if (normModule.includes(normalizedQuery)) {
      results.push({ guide, score: 30, matchType: 'CATEGORY_MATCH' });
      continue;
    }

    if (normDesc.includes(normalizedQuery)) {
      results.push({ guide, score: 20, matchType: 'DESCRIPTION_MATCH' });
      continue;
    }

    // Everyday wording ("file leave", "my attendance"): every word of the query
    // appears somewhere in the title, keywords, module or summary.
    const words = normalizedQuery.split(' ').filter((w) => w.length > 1);
    const haystack = [normTitle, normModule, normDesc, ...normKeywords].join(' ');
    if (words.length > 1 && words.every((w) => haystack.includes(w))) {
      const inTitleOrKeywords = words.every((w) => normTitle.includes(w) || normKeywords.some((k) => k.includes(w)));
      results.push({ guide, score: inTitleOrKeywords ? 40 : 15, matchType: inTitleOrKeywords ? 'KEYWORD_MATCH' : 'DESCRIPTION_MATCH' });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Looks up a guide by its URL slug. If a role is passed, validates role access.
 */
export function getGuideBySlug(slug: string, role?: HelpRole): HelpGuideDefinition | undefined {
  const guide = HELP_GUIDES.find((g) => g.slug === slug);
  if (!guide) return undefined;
  if (role && !guide.roles.includes(role)) {
    return undefined; // unauthorized for this role
  }
  return guide;
}

/**
 * Returns categories for a role with guide counts.
 * Category counts are based on READY guides only (what users actually see in production).
 * Categories with 0 READY guides for the role are automatically hidden.
 * Used for the production Help Center category grid.
 */
export function getCategoriesForRole(
  role: HelpRole
): Array<HelpCategory & { guideCount: number }> {
  // Count only READY guides per category for the current role.
  // Derived from HELP_CATEGORIES rather than a hand-written literal, so adding a
  // category can never leave a stale zero behind.
  const accessibleReadyGuides = getReadyGuidesForRole(role);

  const categoryCounts = {} as Record<HelpCategoryCode, number>;
  for (const category of HELP_CATEGORIES) {
    categoryCounts[category.code] = 0;
  }

  for (const guide of accessibleReadyGuides) {
    categoryCounts[guide.category] = (categoryCounts[guide.category] || 0) + 1;
  }

  return HELP_CATEGORIES.filter((cat) => (categoryCounts[cat.code] || 0) > 0)
    .map((cat) => ({
      ...cat,
      guideCount: categoryCounts[cat.code] || 0,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Returns total metadata entry counts by role (for internal development tracking only).
 * NOT used in the production UI — use getReadyGuidesForRole for user-facing counts.
 */
export function getMetadataCountsByRole(): {
  total: number;
  full: number;
  supervisor: number;
  standard: number;
  public: number;
} {
  let full = 0;
  let supervisor = 0;
  let standard = 0;
  let publicCount = 0;
  for (const guide of HELP_GUIDES) {
    if (guide.roles.includes('FULL')) full++;
    if (guide.roles.includes('SUPERVISOR')) supervisor++;
    if (guide.roles.includes('STANDARD')) standard++;
    if (guide.roles.includes('PUBLIC')) publicCount++;
  }
  return { total: HELP_GUIDES.length, full, supervisor, standard, public: publicCount };
}

/**
 * Validates the Help Center registry for real integrity problems.
 *
 * It deliberately no longer asserts fixed totals (it previously hardcoded
 * 38/35/18/12, which went stale the moment a guide was added and made the
 * validator report failure on a perfectly healthy registry). Counts are derived
 * from the registry itself; only genuine defects are errors.
 */
export function validateHelpRegistry(): {
  isValid: boolean;
  errors: string[];
  stats: {
    total: number;
    full: number;
    supervisor: number;
    standard: number;
    public: number;
    ready: number;
    draft: number;
    metadataOnly: number;
  };
} {
  const errors: string[] = [];
  const idSet = new Set<string>();
  const slugSet = new Set<string>();
  const byId = new Map(HELP_GUIDES.map((g) => [g.id, g]));
  const categoryCodes = new Set(HELP_CATEGORIES.map((c) => c.code));

  let fullCount = 0;
  let supervisorCount = 0;
  let standardCount = 0;
  let publicCount = 0;
  let ready = 0;
  let draft = 0;
  let metadataOnly = 0;

  for (const guide of HELP_GUIDES) {
    if (idSet.has(guide.id)) {
      errors.push(`Duplicate guide ID detected: ${guide.id}`);
    }
    idSet.add(guide.id);

    if (slugSet.has(guide.slug)) {
      errors.push(`Duplicate guide slug detected: ${guide.slug}`);
    }
    slugSet.add(guide.slug);

    // A guide with no roles is unreachable for everyone — always a defect.
    if (guide.roles.length === 0) {
      errors.push(`Guide "${guide.id}" has no roles and is invisible to every user.`);
    }

    // A READY guide with no authored content would render an empty page.
    if (guide.contentStatus === 'READY' && !guide.content) {
      errors.push(`Guide "${guide.id}" is marked READY but has no content.`);
    }

    // A guide pointing at a category that does not exist would never be listed.
    if (!categoryCodes.has(guide.category)) {
      errors.push(`Guide "${guide.id}" uses unknown category "${guide.category}".`);
    }

    // Search only works if a guide carries words people would actually type.
    if (guide.keywords.length === 0) {
      errors.push(`Guide "${guide.id}" has no search keywords.`);
    }

    // A page link must be an in-app path with a label.
    if (guide.appLink && (!guide.appLink.to.startsWith('/') || !guide.appLink.label.trim())) {
      errors.push(`Guide "${guide.id}" has an invalid page link.`);
    }

    // Related guides must exist, be readable, and be reachable by at least one
    // of the roles that can read THIS guide — otherwise the link is a dead end.
    const related = guide.content?.relatedGuideIds ?? guide.relatedGuideIds ?? [];
    for (const relatedId of related) {
      const target = byId.get(relatedId);
      if (!target) {
        errors.push(`Guide "${guide.id}" links to "${relatedId}", which does not exist.`);
        continue;
      }
      if (target.contentStatus !== 'READY') {
        errors.push(`Guide "${guide.id}" links to "${relatedId}", which is not READY.`);
      }
      if (!target.roles.some((role) => guide.roles.includes(role))) {
        errors.push(
          `Guide "${guide.id}" links to "${relatedId}", which none of its own readers can open.`
        );
      }
    }

    if (guide.roles.includes('FULL')) fullCount++;
    if (guide.roles.includes('SUPERVISOR')) supervisorCount++;
    if (guide.roles.includes('STANDARD')) standardCount++;
    if (guide.roles.includes('PUBLIC')) publicCount++;

    if (guide.contentStatus === 'READY') ready++;
    else if (guide.contentStatus === 'DRAFT') draft++;
    else metadataOnly++;
  }

  return {
    isValid: errors.length === 0,
    errors,
    stats: {
      total: HELP_GUIDES.length,
      full: fullCount,
      supervisor: supervisorCount,
      public: publicCount,
      standard: standardCount,
      ready,
      draft,
      metadataOnly,
    },
  };
}
