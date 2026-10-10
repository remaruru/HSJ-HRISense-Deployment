import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { HelpGuideStep as IHelpGuideStep } from '../helpCenter.types';
import { HelpScreenshot } from './HelpScreenshot';
import { HelpExpectedResult } from './HelpExpectedResult';
import { HelpTip } from './HelpTip';
import { HelpWarning } from './HelpWarning';
import { HelpInfo } from './HelpInfo';

interface HelpGuideStepProps {
  step: IHelpGuideStep;
  totalSteps: number;
  onNavigateStep?: (stepNumber: number) => void;
}

/**
 * Formats instruction text: renders bold text (like **Button Name**) with high-contrast UI label styling.
 */
function renderFormattedInstruction(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const label = part.slice(2, -2);
      return (
        <span
          key={index}
          className="font-bold text-foreground bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded-md border border-border/80 tracking-tight"
        >
          {label}
        </span>
      );
    }
    return part;
  });
}

export const HelpGuideStep: React.FC<HelpGuideStepProps> = ({
  step,
  totalSteps,
  onNavigateStep,
}) => {
  return (
    <article
      id={`step-${step.stepNumber}`}
      aria-labelledby={`step-heading-${step.stepNumber}`}
      className="relative pl-14 md:pl-20 pb-12 border-l-3 border-border/80 last:border-l-0 last:pb-2 scroll-mt-24"
    >
      {/* ─── Step Number Badge (44-48px) ────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="absolute -left-[23px] md:-left-[26px] top-0 w-11 md:w-12 h-11 md:h-12 rounded-2xl bg-primary-600 dark:bg-primary-500 text-white font-extrabold font-heading text-lg md:text-xl flex items-center justify-center shadow-md ring-6 ring-background"
      >
        {step.stepNumber}
      </div>

      <div className="space-y-4">
        {/* ─── Step Title & Header ──────────────────────────────────────── */}
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Step {step.stepNumber} of {totalSteps}
          </span>
          <h3
            id={`step-heading-${step.stepNumber}`}
            className="text-xl md:text-2xl font-bold font-heading text-foreground tracking-tight"
          >
            {step.title}
          </h3>
        </div>

        {/* ─── Step Instruction ─────────────────────────────────────────── */}
        <p className="text-base md:text-lg text-foreground/90 leading-relaxed">
          {renderFormattedInstruction(step.instruction)}
        </p>

        {/* ─── Step Explanation (if present) ────────────────────────────── */}
        {step.explanation && (
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/60">
            {step.explanation}
          </p>
        )}

        {/* ─── Screenshot (if present) ──────────────────────────────────── */}
        {step.screenshot && <HelpScreenshot screenshot={step.screenshot} />}

        {/* ─── Expected Result (What you should see) ────────────────────── */}
        {step.expectedResult && (
          <HelpExpectedResult text={step.expectedResult} />
        )}

        {/* ─── Tip Block ────────────────────────────────────────────────── */}
        {step.tip && <HelpTip text={step.tip} />}

        {/* ─── Warning Block ────────────────────────────────────────────── */}
        {step.warning && <HelpWarning text={step.warning} />}

        {/* ─── Info Block (Good to know) ────────────────────────────────── */}
        {step.info && <HelpInfo text={step.info} />}

        {/* ─── Step Progression Navigation ──────────────────────────────── */}
        {onNavigateStep && totalSteps > 1 && (
          <div className="pt-3 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground print:hidden">
            {step.stepNumber > 1 ? (
              <button
                type="button"
                onClick={() => onNavigateStep(step.stepNumber - 1)}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Previous Step ({step.stepNumber - 1})</span>
              </button>
            ) : (
              <div />
            )}

            {step.stepNumber < totalSteps ? (
              <button
                type="button"
                onClick={() => onNavigateStep(step.stepNumber + 1)}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-muted/40 hover:bg-muted text-foreground transition-colors border border-border"
              >
                <span>Next Step ({step.stepNumber + 1})</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Last step of this guide
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
