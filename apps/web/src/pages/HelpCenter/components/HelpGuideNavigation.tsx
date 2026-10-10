import React from 'react';
import { ListOrdered } from 'lucide-react';
import type { HelpGuideStep } from '../helpCenter.types';

interface HelpGuideNavigationProps {
  steps: HelpGuideStep[];
  activeStep?: number;
  onStepClick: (stepNumber: number) => void;
}

export const HelpGuideNavigation: React.FC<HelpGuideNavigationProps> = ({
  steps,
  activeStep,
  onStepClick,
}) => {
  if (!steps || steps.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Guide Steps Navigation"
      className="p-4 rounded-2xl bg-surface border-2 border-border/80 shadow-xs space-y-3 sticky top-6 max-h-[85vh] overflow-y-auto"
    >
      <div className="flex items-center gap-2 border-b border-border pb-2.5">
        <ListOrdered className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        <h4 className="text-xs font-bold font-heading uppercase tracking-wider text-muted-foreground">
          In this guide ({steps.length} steps)
        </h4>
      </div>

      <ol className="space-y-1 text-xs">
        {steps.map((step) => {
          const isActive = activeStep === step.stepNumber;
          return (
            <li key={step.stepNumber}>
              <button
                type="button"
                onClick={() => onStepClick(step.stepNumber)}
                className={`w-full text-left py-2 px-2.5 rounded-xl transition-colors flex items-start gap-2 ${
                  isActive
                    ? 'bg-primary-50 text-primary-900 font-bold dark:bg-primary-950/60 dark:text-primary-200'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {step.stepNumber}
                </span>
                <span className="line-clamp-2 leading-tight">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
