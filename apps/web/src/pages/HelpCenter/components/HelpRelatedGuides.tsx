import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { HELP_GUIDES } from '../helpCenter.registry';
import type { HelpRole } from '../helpCenter.types';
import { HelpGuideCard } from './HelpGuideCard';

interface HelpRelatedGuidesProps {
  relatedGuideIds?: string[];
  currentRole: HelpRole;
  onSelectGuide: (slug: string) => void;
}

export const HelpRelatedGuides: React.FC<HelpRelatedGuidesProps> = ({
  relatedGuideIds,
  currentRole,
  onSelectGuide,
}) => {
  if (!relatedGuideIds || relatedGuideIds.length === 0) {
    return null;
  }

  // Filter guides: must exist in registry, be authorized for current role, AND be READY
  const accessibleRelatedGuides = relatedGuideIds
    .map((id) => HELP_GUIDES.find((g) => g.id === id))
    .filter(
      (g): g is NonNullable<typeof g> =>
        g !== undefined &&
        g.roles.includes(currentRole) &&
        g.contentStatus === 'READY'
    )
    .slice(0, 4);

  if (accessibleRelatedGuides.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-6 border-t border-border">
      <div className="flex items-center gap-2 text-foreground">
        <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
          <BookOpen className="h-5 w-5" />
        </div>
        <h3 className="text-lg md:text-xl font-bold font-heading">
          Related guides
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {accessibleRelatedGuides.map((guide) => (
          <HelpGuideCard
            key={guide.id}
            guide={guide}
            onClick={() => onSelectGuide(guide.slug)}
          />
        ))}
      </div>
    </div>
  );
};
