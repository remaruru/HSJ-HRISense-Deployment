import React, { useState } from 'react';
import {
  KeyRound,
  LayoutDashboard,
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  BarChart3,
  BookOpen,
  ShieldCheck,
  Megaphone,
  Bell,
  FileClock,
  Sparkles,
  TrendingUp,
  Settings,
  Globe,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Star,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HelpCategory, HelpGuideDefinition } from '../helpCenter.types';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  KeyRound,
  LayoutDashboard,
  Users,
  UserPlus,
  Clock,
  CalendarDays,
  BarChart3,
  BookOpen,
  ShieldCheck,
  Megaphone,
  Bell,
  FileClock,
  Sparkles,
  TrendingUp,
  Settings,
  Globe,
  HelpCircle,
  Trophy,
};

interface HelpCategoryPanelProps {
  category: HelpCategory;
  guides: HelpGuideDefinition[];
  /** How many guides show before "Show all"; omit to show every guide. */
  previewCount?: number;
  onGuideClick: (slug: string) => void;
}

/**
 * One Help Center category as a container: its name, what it covers, and its
 * guides as a compact list. Long lists show the first few (common tasks first)
 * and expand in place.
 */
export const HelpCategoryPanel: React.FC<HelpCategoryPanelProps> = ({
  category,
  guides,
  previewCount,
  onGuideClick,
}) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[category.iconName] ?? BookOpen;
  // Common tasks first; otherwise the registry's order.
  const ordered = [...guides].sort((a, b) => Number(!!b.isRecommended) - Number(!!a.isRecommended));
  const limit = previewCount ?? ordered.length;
  const shown = expanded ? ordered : ordered.slice(0, limit);
  const hidden = ordered.length - shown.length;
  const listId = `help-category-${category.code}`;

  return (
    <section
      aria-labelledby={`${listId}-title`}
      className="flex flex-col rounded-2xl border border-border bg-surface shadow-xs overflow-hidden"
    >
      <header className="flex items-start gap-3 p-4 border-b border-border bg-muted/30">
        <span className="shrink-0 p-2 rounded-xl bg-primary-100/70 dark:bg-primary-950/70 border border-primary-200/80 dark:border-primary-800/50">
          <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${listId}-title`} className="text-base font-bold font-heading text-foreground leading-tight">
            {category.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{category.shortDescription}</p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface text-foreground/80 border border-border">
          {guides.length} {guides.length === 1 ? 'guide' : 'guides'}
        </span>
      </header>

      <ul id={listId} className="divide-y divide-border/70">
        {shown.map((guide) => (
          <li key={guide.id}>
            <button
              type="button"
              onClick={() => onGuideClick(guide.slug)}
              className="group w-full min-h-12 flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary-50/60 dark:hover:bg-primary-950/30 focus-visible:outline-none focus-visible:bg-primary-50/60 dark:focus-visible:bg-primary-950/30 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {guide.isRecommended && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-current text-status-warning-foreground" aria-label="Common task" />
                  )}
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary-700 dark:group-hover:text-primary-300 leading-snug">
                    {guide.title}
                  </span>
                </span>
                <span className="hidden sm:block text-xs text-muted-foreground mt-0.5 line-clamp-1">{guide.shortDescription}</span>
              </span>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                {guide.estimatedSteps} {guide.estimatedSteps === 1 ? 'step' : 'steps'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary-600 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {(hidden > 0 || expanded) && ordered.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={listId}
          className="mt-auto flex items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-muted/50 transition-colors"
        >
          {expanded ? 'Show fewer' : `Show all ${ordered.length} guides`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    </section>
  );
};
