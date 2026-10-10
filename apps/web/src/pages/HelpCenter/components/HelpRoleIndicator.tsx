import React from 'react';
import { Globe, Shield, User, Users } from 'lucide-react';
import type { HelpRole } from '../helpCenter.types';

interface HelpRoleIndicatorProps {
  role: HelpRole;
}

export const HelpRoleIndicator: React.FC<HelpRoleIndicatorProps> = ({ role }) => {
  const config = {
    FULL: {
      label: 'Guides for HR Personnel',
      icon: <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
      bg: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60',
    },
    SUPERVISOR: {
      label: 'Guides for Supervisor',
      icon: <Users className="h-4 w-4 text-status-success-foreground" />,
      bg: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
    },
    STANDARD: {
      label: 'Guides for Employee',
      icon: <User className="h-4 w-4 text-status-info-foreground" />,
      bg: 'bg-status-info-surface text-status-info-foreground border-status-info-border',
    },
    // Only reachable if a public visitor is ever shown the Help Center; the
    // Help Center itself currently requires a sign-in.
    PUBLIC: {
      label: 'Guides for Applicants',
      icon: <Globe className="h-4 w-4 text-slate-600 dark:text-slate-400" />,
      bg: 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700/60',
    },
  }[role];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all ${config.bg}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
