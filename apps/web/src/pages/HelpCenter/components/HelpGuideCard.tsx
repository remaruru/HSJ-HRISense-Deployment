import React from 'react';
import { ArrowRight, Layers, Star } from 'lucide-react';
import type { HelpGuideDefinition } from '../helpCenter.types';

interface HelpGuideCardProps {
  guide: HelpGuideDefinition;
  onClick: () => void;
}

export const HelpGuideCard: React.FC<HelpGuideCardProps> = ({ guide, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${guide.title}, ${guide.estimatedSteps} steps`}
      className="group text-left p-5 md:p-6 rounded-2xl bg-surface border-2 border-border hover:border-primary-400 hover:shadow-card dark:hover:border-slate-700 transition-all duration-200 w-full flex flex-col justify-between focus:outline-hidden focus:ring-4 focus:ring-primary-500/20"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-muted text-foreground/80 border border-border">
            {guide.module}
          </span>
          {guide.isRecommended && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
              <Star className="h-3 w-3 fill-current" /> Common Task
            </span>
          )}
        </div>

        <h4 className="text-base md:text-lg font-bold font-heading text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">
          {guide.title}
        </h4>

        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
          {guide.shortDescription}
        </p>
      </div>

      <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-muted-foreground">
          <Layers className="h-4 w-4 text-primary-500" />
          <span>{guide.estimatedSteps} {guide.estimatedSteps === 1 ? 'step' : 'steps'}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform">
          Read Guide <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
};
