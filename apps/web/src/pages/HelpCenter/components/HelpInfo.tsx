import React from 'react';
import { Info } from 'lucide-react';

interface HelpInfoProps {
  text: string;
  title?: string;
}

export const HelpInfo: React.FC<HelpInfoProps> = ({
  text,
  title = 'Good to know',
}) => {
  if (!text) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-status-info-surface/80 border-2 border-status-info-border text-status-info-foreground shadow-xs">
      <div className="p-1 rounded-lg bg-status-info-surface text-status-info-foreground shrink-0 mt-0.5">
        <Info className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <h5 className="text-sm font-bold font-heading text-status-info-foreground tracking-tight">
          {title}
        </h5>
        <p className="text-sm leading-relaxed text-status-info-foreground/90">
          {text}
        </p>
      </div>
    </div>
  );
};
