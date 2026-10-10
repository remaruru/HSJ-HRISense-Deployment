import React from 'react';
import { Lightbulb } from 'lucide-react';

interface HelpTipProps {
  text: string;
}

export const HelpTip: React.FC<HelpTipProps> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-status-warning-surface/80 border-2 border-status-warning-border text-status-warning-foreground shadow-xs">
      <div className="p-1 rounded-lg bg-status-warning-surface text-status-warning-foreground shrink-0 mt-0.5">
        <Lightbulb className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <h5 className="text-sm font-bold font-heading text-status-warning-foreground tracking-tight">
          Tip
        </h5>
        <p className="text-sm leading-relaxed text-status-warning-foreground/90">
          {text}
        </p>
      </div>
    </div>
  );
};
