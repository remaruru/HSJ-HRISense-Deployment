import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface HelpWarningProps {
  text: string;
  title?: string;
}

export const HelpWarning: React.FC<HelpWarningProps> = ({
  text,
  title = 'Important',
}) => {
  if (!text) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-status-danger-surface/80 border-2 border-status-danger-border text-status-danger-foreground shadow-xs">
      <div className="p-1 rounded-lg bg-status-danger-surface text-status-danger-foreground shrink-0 mt-0.5">
        <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <h5 className="text-sm font-bold font-heading text-status-danger-foreground tracking-tight">
          {title}
        </h5>
        <p className="text-sm leading-relaxed text-status-danger-foreground/90">
          {text}
        </p>
      </div>
    </div>
  );
};
