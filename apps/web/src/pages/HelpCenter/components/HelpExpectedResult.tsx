import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface HelpExpectedResultProps {
  text: string;
}

export const HelpExpectedResult: React.FC<HelpExpectedResultProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-status-success-surface/80 border-2 border-status-success-border text-status-success-foreground shadow-xs">
      <div className="p-1 rounded-lg bg-status-success-surface text-status-success-foreground shrink-0 mt-0.5">
        <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <h5 className="text-sm font-bold font-heading text-status-success-foreground tracking-tight">
          What you should see
        </h5>
        <p className="text-sm leading-relaxed text-status-success-foreground/90">
          {text}
        </p>
      </div>
    </div>
  );
};
