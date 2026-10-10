/**
 * Shape of `knowledge.generated.json`, produced by
 * `apps/api/scripts/ai/build-knowledge.ts`. Do not edit the JSON by hand: edit
 * the Help Center guides or docs/HRISENSE_SYSTEM_REFERENCE.md and rebuild.
 */
export type KnowledgeRole = 'FULL' | 'SUPERVISOR' | 'STANDARD';

export interface KnowledgeEntry {
  /** `guide:<slug>` or `ref:<section>`. */
  id: string;
  kind: 'guide' | 'reference';
  title: string;
  /** Module / area, for display. */
  module: string;
  /** Tiers allowed to read this entry. Filtering happens BEFORE search. */
  roles: KnowledgeRole[];
  keywords: string[];
  /** Plain text of the guide steps or reference section. */
  text: string;
  /** Help Center guides only. */
  slug?: string;
  /** In-app link for guides: `/help-center/<slug>`. */
  link?: string;
}

export interface KnowledgeBundle {
  /** SHA-256 of each source file, so a test can prove the bundle is current. */
  sources: Record<string, string>;
  entries: KnowledgeEntry[];
}
