import React from 'react';
import { CheckCircle, ClipboardList } from 'lucide-react';

interface HelpPrerequisitesProps {
  prerequisites?: string[];
}

export const HelpPrerequisites: React.FC<HelpPrerequisitesProps> = ({ prerequisites }) => {
  if (!prerequisites || prerequisites.length === 0) {
    return null;
  }

  return (
    <div className="p-5 md:p-6 rounded-2xl bg-surface border-2 border-border/90 shadow-xs space-y-3.5">
      <div className="flex items-center gap-2 text-foreground">
        <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
          <ClipboardList className="h-5 w-5" />
        </div>
        <h3 className="text-base md:text-lg font-bold font-heading">
          Before you start
        </h3>
      </div>

      <ul className="space-y-2.5 pt-1">
        {prerequisites.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5 text-sm md:text-base text-foreground/90 leading-relaxed">
            <CheckCircle className="h-4.5 w-4.5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
