import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ChevronRight, Info, Star } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { AiMascot } from '@/components/ai/AiMascot';
import type { HelpGuideDefinition, HelpRole } from './helpCenter.types';
import { HELP_AREAS } from './helpCenter.registry';
import {
  getCategoriesForRole,
  getReadyGuidesForRole,
  searchHelpGuides,
} from './helpCenter.search';
import { HelpRoleIndicator } from './components/HelpRoleIndicator';
import { HelpSearchBar } from './components/HelpSearchBar';
import { HelpCategoryPanel } from './components/HelpCategoryPanel';
import { HelpEmptyState } from './components/HelpEmptyState';
import { staggerContainer, staggerItem } from '@/lib/motion';

/** Guides shown per category before "Show all": fewer on the all-topics view. */
const PREVIEW_ALL = 3;
const PREVIEW_AREA = 6;

export default function HelpCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role: HelpRole =
    user?.permissionTier === 'FULL'
      ? 'FULL'
      : user?.permissionTier === 'SUPERVISOR'
      ? 'SUPERVISOR'
      : 'STANDARD';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  // ─── READY-only data for production UI ─────────────────────────────────────
  const categories = useMemo(() => getCategoriesForRole(role), [role]);
  const readyGuides = useMemo(() => getReadyGuidesForRole(role), [role]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchHelpGuides(searchQuery, role);
  }, [searchQuery, role]);

  const recommendedGuides = useMemo(() => readyGuides.filter((g) => g.isRecommended), [readyGuides]);

  /**
   * Topic areas (the sidebar's groups) holding the categories this role can
   * see. A category missing from HELP_AREAS lands in "Other", so no guide is
   * ever hidden by the grouping.
   */
  const areas = useMemo(() => {
    const placed = new Set(HELP_AREAS.flatMap((a) => a.categories));
    const list = [
      ...HELP_AREAS,
      { id: 'other', name: 'Other', categories: categories.map((c) => c.code).filter((c) => !placed.has(c)) },
    ];
    return list
      .map((area) => {
        const cats = categories.filter((c) => area.categories.includes(c.code));
        return { ...area, cats, guideCount: cats.reduce((n, c) => n + c.guideCount, 0) };
      })
      .filter((area) => area.cats.length > 0);
  }, [categories]);

  const guidesByCategory = (guides: HelpGuideDefinition[], code: string) => guides.filter((g) => g.category === code);

  const handleGuideClick = (slug: string) => {
    navigate({ to: '/help-center/$guideSlug', params: { guideSlug: slug } });
  };

  const searching = searchQuery.trim().length > 0;
  const visibleAreas = selectedArea === 'ALL' ? areas : areas.filter((a) => a.id === selectedArea);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto"
    >
      {/* ─── Hero: the mascot asks, the search answers ─────────────────── */}
      <motion.section
        variants={staggerItem}
        className="rounded-3xl border border-border bg-surface p-5 md:p-8 shadow-xs"
      >
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <AiMascot variant="full" size={132} className="h-28 w-auto md:h-[132px]" />
          <div className="min-w-0 flex-1 text-center md:text-left space-y-3">
            <div className="flex justify-center md:justify-start">
              <HelpRoleIndicator role={role} />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold font-heading text-foreground tracking-tight">
              Help Center
            </h1>
            {/* Speech bubble: the tail points up at the mascot on phones, left beside it from md. */}
            <div className="relative inline-block max-w-xl rounded-2xl border border-status-accent-border bg-status-accent-surface px-4 py-3 text-left">
              <span
                aria-hidden="true"
                className="absolute h-3 w-3 rotate-45 border-status-accent-border bg-status-accent-surface left-1/2 -top-1.5 -translate-x-1/2 border-l border-t md:left-0 md:top-6 md:-translate-x-1/2 md:border-t-0 md:border-b"
              />
              <h2 className="text-base md:text-lg font-bold font-heading text-status-accent-foreground">
                What do you need help with?
              </h2>
              <p className="text-sm text-foreground/80 leading-relaxed mt-0.5">
                Find simple step-by-step guides for the HRISense features available to your account. Search for a task, or pick a topic below.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <HelpSearchBar
            query={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            role={role}
          />
        </div>
      </motion.section>

      {readyGuides.length === 0 && !searching ? (
        /* ─── No READY guides yet: preparation notice ─────────────────── */
        <motion.section variants={staggerItem} className="max-w-2xl mx-auto text-center py-6">
          <div className="p-8 rounded-3xl bg-surface border-2 border-border space-y-4 shadow-xs">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-info-100 dark:bg-info-950/60 text-info-600 dark:text-info-400">
                <Info className="h-8 w-8" />
              </div>
            </div>
            <h3 className="text-xl font-bold font-heading text-foreground">
              Step-by-step guides are being prepared
            </h3>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              The Help Center is currently being expanded. More step-by-step guides for HRISense features will become available here shortly.
            </p>
          </div>
        </motion.section>
      ) : searching ? (
        /* ─── Search results, grouped by category ─────────────────────── */
        <motion.section variants={staggerItem} className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-border pb-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold font-heading text-foreground">Search Results</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {searchResults.length} {searchResults.length === 1 ? 'guide found' : 'guides found'} for "{searchQuery}"
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Clear Search
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {categories.map((cat) => {
                const matches = guidesByCategory(searchResults.map((r) => r.guide), cat.code);
                if (matches.length === 0) return null;
                return (
                  <HelpCategoryPanel key={cat.code} category={cat} guides={matches} onGuideClick={handleGuideClick} />
                );
              })}
            </div>
          ) : (
            <HelpEmptyState query={searchQuery} onClearSearch={() => setSearchQuery('')} />
          )}
        </motion.section>
      ) : (
        /* ─── Browse: topic filters and category containers ───────────── */
        <>
          <motion.section variants={staggerItem} aria-label="Filter guides by topic">
            <div className="-mx-4 md:mx-0 px-4 md:px-0 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap pb-1">
              {[{ id: 'ALL', name: 'All topics', guideCount: readyGuides.length }, ...areas].map((area) => {
                const active = selectedArea === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedArea(area.id)}
                    aria-pressed={active}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-600'
                        : 'border-border bg-surface text-foreground hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-primary-950/30'
                    )}
                  >
                    {area.name}
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                        active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {area.guideCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* Common tasks — only on the all-topics view. */}
          {selectedArea === 'ALL' && recommendedGuides.length > 0 && (
            <motion.section
              variants={staggerItem}
              aria-labelledby="help-common-tasks"
              className="rounded-2xl border border-status-warning-border bg-status-warning-surface/40 p-4 md:p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1 rounded-md bg-status-warning-surface text-status-warning-foreground">
                  <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
                <h2 id="help-common-tasks" className="text-base md:text-lg font-bold font-heading text-foreground">
                  Common Tasks
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {recommendedGuides.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => handleGuideClick(guide.slug)}
                    className="group flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-primary-400 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground group-hover:text-primary-700 dark:group-hover:text-primary-300 leading-snug">
                        {guide.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{guide.module}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary-600" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {visibleAreas.map((area) => (
            <motion.section key={area.id} variants={staggerItem} aria-labelledby={`help-area-${area.id}`} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 id={`help-area-${area.id}`} className="text-lg md:text-xl font-bold font-heading text-foreground">
                  {area.name}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  {area.guideCount} {area.guideCount === 1 ? 'guide' : 'guides'}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {area.cats.map((cat) => (
                  <HelpCategoryPanel
                    key={cat.code}
                    category={cat}
                    guides={guidesByCategory(readyGuides, cat.code)}
                    previewCount={selectedArea === 'ALL' ? PREVIEW_ALL : PREVIEW_AREA}
                    onGuideClick={handleGuideClick}
                  />
                ))}
              </div>
            </motion.section>
          ))}

          {/* ─── Expansion notice ───────────────────────────────────────── */}
          <motion.section variants={staggerItem}>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-info-50/70 dark:bg-info-950/30 border border-info-200 dark:border-info-800/60">
              <Info className="h-5 w-5 shrink-0 mt-0.5 text-info-700 dark:text-info-300" aria-hidden="true" />
              <p className="text-xs md:text-sm text-info-800/90 dark:text-info-200/80 leading-relaxed">
                <span className="font-bold text-info-950 dark:text-info-100">Help Center is being expanded. </span>
                The guides currently available have been verified and are ready to use. More step-by-step guides will be added as additional HRISense features are documented.
              </p>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
