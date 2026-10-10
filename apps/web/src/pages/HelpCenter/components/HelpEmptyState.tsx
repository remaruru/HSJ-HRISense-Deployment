import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiMascot } from '@/components/ai/AiMascot';

interface HelpEmptyStateProps {
  title?: string;
  description?: string;
  query?: string;
  onClearSearch?: () => void;
}

export const HelpEmptyState: React.FC<HelpEmptyStateProps> = ({
  title = 'No guides found',
  description,
  query,
  onClearSearch,
}) => {
  return (
    <div className="py-12 px-4 text-center max-w-md mx-auto space-y-4">
      <div className="flex justify-center">
        <AiMascot variant="full" state="thinking" size={96} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold font-heading text-foreground">
          {query ? `No guides found for "${query}"` : title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description ||
            'Try checking for spelling errors, using simpler keywords, or browsing by category below.'}
        </p>
      </div>
      {onClearSearch && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Clear Search
          </Button>
        </div>
      )}
    </div>
  );
};
