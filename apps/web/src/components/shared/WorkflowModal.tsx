import React from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── SHARED WORKFLOW MODAL STYLING UTILITIES ──
export const workflowModalStyles = {
  /**
   * Generates consistent, spacious desktop modal container classes.
   * Ensures fixed-feeling height (700-820px / ~75-85vh) and ample width (1000-1200px)
   * with generous typography and breathing room across all resolutions.
   */
  container: (size: 'default' | 'compliance' | 'medical' | 'wide' = 'default') => {
    const widthClass = {
      compliance: 'w-[min(1040px,calc(100vw-32px))] sm:max-w-[min(1040px,calc(100vw-32px))]',
      medical: 'w-[min(1100px,calc(100vw-32px))] sm:max-w-[min(1100px,calc(100vw-32px))]',
      wide: 'w-[min(1180px,calc(100vw-32px))] sm:max-w-[min(1180px,calc(100vw-32px))]',
      default: 'w-[min(1120px,calc(100vw-32px))] sm:max-w-[min(1120px,calc(100vw-32px))]',
    }[size];

    return cn(
      'h-[min(820px,calc(100vh-44px))] max-h-[min(820px,calc(100vh-44px))] min-h-[580px] sm:min-h-[660px]',
      'flex flex-col p-0 overflow-hidden rounded-2xl bg-surface dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl',
      widthClass
    );
  },
  content: 'flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 min-h-0 flex flex-col justify-start text-slate-800 dark:text-slate-200',
  form: 'flex flex-col flex-1 min-h-0 overflow-hidden',
  footer: 'flex-shrink-0 mt-auto',
};

// ── WORKFLOW MODAL HEADER ──
interface WorkflowModalHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  onClose: () => void;
  badge?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
}

export function WorkflowModalHeader({
  icon: Icon,
  title,
  subtitle,
  onClose,
  badge,
  iconColor = 'text-teal-600 dark:text-teal-400',
  iconBg = 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800/80',
}: WorkflowModalHeaderProps) {
  return (
    <div className="sticky top-0 z-30 flex-shrink-0 flex items-center justify-between px-6 sm:px-8 py-4 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs", iconBg, iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-xl text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-3 cursor-pointer"
        aria-label="Close dialog"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ── WORKFLOW MODAL STEPPER ──
export interface WorkflowStep {
  id: number;
  label: string;
  description?: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export function WorkflowStepper({ steps, currentStep, onStepClick }: WorkflowStepperProps) {
  const currentStepObj = steps.find((s) => s.id === currentStep) || steps[0];

  return (
    <div className="flex-shrink-0 px-6 sm:px-8 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
      {/* Mobile/Compact view: Step X of Y */}
      <div className="flex sm:hidden items-center justify-between text-sm">
        <span className="font-semibold text-teal-700 dark:text-teal-300">
          Step {currentStep} of {steps.length}: {currentStepObj?.label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {Math.max(0, currentStep - 1)} of {steps.length} steps done
        </span>
      </div>

      {/* Desktop / Tablet Stepper Bar */}
      <div className="hidden sm:flex items-center gap-2 lg:gap-3 overflow-x-auto no-scrollbar py-0.5">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isClickable = onStepClick && step.id < currentStep;

          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div
                  className={cn(
                    "w-6 lg:w-10 h-[2px] rounded-full transition-colors shrink-0",
                    isCompleted ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-700"
                  )}
                />
              )}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(step.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition-all text-left shrink-0",
                  isCurrent && "bg-teal-700 text-white shadow-xs font-bold ring-1 ring-teal-500",
                  isCompleted && "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-semibold hover:bg-teal-100/80 cursor-pointer dark:hover:bg-primary-900/60",
                  !isCurrent && !isCompleted && "text-slate-600 dark:text-slate-400 font-medium cursor-default"
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isCurrent && "bg-surface/25 text-white",
                    isCompleted && "bg-teal-500 text-white",
                    !isCurrent && !isCompleted && "border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-surface dark:bg-slate-800"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                </span>
                <span className="text-sm font-semibold">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── WORKFLOW MODAL SECTION ──
interface WorkflowSectionProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function WorkflowSection({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
}: WorkflowSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />}
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── WORKFLOW MODAL FOOTER ──
interface WorkflowModalFooterProps {
  onCancel: () => void;
  onBack?: () => void;
  primaryLabel: string;
  isSubmitting?: boolean;
  canProceed?: boolean;
  cancelLabel?: string;
  backLabel?: string;
}

export function WorkflowModalFooter({
  onCancel,
  onBack,
  primaryLabel,
  isSubmitting = false,
  canProceed = true,
  cancelLabel = "Cancel",
  backLabel = "Back",
}: WorkflowModalFooterProps) {
  return (
    <div className="sticky bottom-0 z-30 flex-shrink-0 mt-auto flex items-center justify-between px-6 sm:px-8 py-4 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-sm h-10 sm:h-11 px-5 font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="text-sm h-10 sm:h-11 px-5 font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {backLabel}
          </Button>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !canProceed}
          className="bg-teal-700 hover:bg-teal-800 text-white text-sm h-10 sm:h-11 px-6 gap-2 shadow-sm font-semibold cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            primaryLabel
          )}
        </Button>
      </div>
    </div>
  );
}
