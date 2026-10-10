import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface HelpBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const HelpBreadcrumbs: React.FC<HelpBreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb navigation" className="flex items-center space-x-2 text-xs md:text-sm text-muted-foreground mb-4 overflow-hidden">
      <button
        type="button"
        onClick={items[0]?.onClick}
        className="inline-flex items-center gap-1.5 hover:text-foreground font-semibold transition-colors focus:outline-hidden focus:underline shrink-0"
      >
        <Home className="h-4 w-4" />
        <span>Help Center</span>
      </button>

      {items.slice(1).map((item, idx) => {
        const isLast = idx === items.length - 2;
        return (
          <React.Fragment key={item.label}>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            {isLast || !item.onClick ? (
              <span className="font-bold text-foreground truncate max-w-[200px] md:max-w-md">
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-foreground font-medium transition-colors truncate max-w-[140px] md:max-w-xs focus:outline-hidden focus:underline shrink-0"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
