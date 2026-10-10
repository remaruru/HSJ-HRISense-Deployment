import React, { useState } from 'react';
import { ChevronDown, HelpCircle, LifeBuoy } from 'lucide-react';
import type { HelpTroubleshootingItem } from '../helpCenter.types';

interface HelpTroubleshootingProps {
  items?: HelpTroubleshootingItem[];
}

export const HelpTroubleshooting: React.FC<HelpTroubleshootingProps> = ({ items }) => {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  if (!items || items.length === 0) {
    return null;
  }

  const toggleIndex = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 text-foreground">
        <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <h3 className="text-lg md:text-xl font-bold font-heading">
          Having trouble?
        </h3>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndices.includes(index);
          return (
            <div
              key={index}
              className="rounded-2xl border-2 border-border/80 bg-surface overflow-hidden transition-all shadow-xs"
            >
              <button
                type="button"
                onClick={() => toggleIndex(index)}
                aria-expanded={isOpen}
                className="w-full p-4 md:p-5 text-left flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors focus:outline-hidden focus:ring-4 focus:ring-primary-500/10"
              >
                <span className="text-sm md:text-base font-bold font-heading text-foreground">
                  {item.problem}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary-600 dark:text-primary-300' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 md:px-5 pb-5 pt-1 space-y-3 border-t border-border/60 bg-muted/20">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-400">
                      Try this:
                    </span>
                    <p className="text-sm md:text-base text-foreground/90 leading-relaxed">
                      {item.solution}
                    </p>
                  </div>

                  {item.note && (
                    <p className="text-xs text-muted-foreground italic bg-surface p-2.5 rounded-xl border border-border/80">
                      Note: {item.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
