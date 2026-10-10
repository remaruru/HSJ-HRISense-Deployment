import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { HelpRole } from '../helpCenter.types';

interface HelpSearchBarProps {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  role: HelpRole;
}

export const HelpSearchBar: React.FC<HelpSearchBarProps> = ({
  query,
  onChange,
  onClear,
  role,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Role-safe suggestions: every term maps to at least one verified READY guide for that role
  // (suggestions will be hidden dynamically when no READY guides exist yet)
  const roleSuggestions: Record<HelpRole, string[]> = {
    FULL: ['Onboard Employee', 'Weekly Schedule', 'Leave Approval', 'Reports', 'Audit Logs'],
    SUPERVISOR: ['Endorse Leave', 'Team Attendance', 'Weekly Schedule', 'Conduct Evaluation', 'Notifications'],
    STANDARD: ['File Leave', 'Holiday Calendar', 'My Attendance', 'Notifications'],
    PUBLIC: ['Apply for a Position', 'Application Status'],
  };

  const suggestions = roleSuggestions[role] || roleSuggestions.STANDARD;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClear();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <div className="relative flex items-center shadow-sm rounded-2xl">
        <label htmlFor="help-search-input" className="sr-only">
          Search for a feature or task
        </label>
        <div className="absolute left-4.5 pointer-events-none text-muted-foreground">
          <Search className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <input
          id="help-search-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a feature or task..."
          aria-label="Search for a feature or task"
          className="w-full h-14 md:h-15 pl-13 md:pl-14 pr-13 rounded-2xl bg-surface border-2 border-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 text-base md:text-lg font-medium text-foreground placeholder:text-muted-foreground transition-all outline-hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search query"
            className="absolute right-3.5 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {!query && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs md:text-sm text-muted-foreground">
          <span className="font-semibold text-foreground/80">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(suggestion)}
              className="px-3 py-1 rounded-full bg-surface border border-border hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
