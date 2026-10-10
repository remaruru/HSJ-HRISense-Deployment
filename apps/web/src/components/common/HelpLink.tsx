import { HelpCircle } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/AuthProvider';
import { getGuideBySlug } from '@/pages/HelpCenter/helpCenter.search';
import type { HelpRole } from '@/pages/HelpCenter/helpCenter.types';
import { cn } from '@/lib/utils';

interface HelpLinkProps {
  /** Slug of the guide to open, e.g. `onboard-new-employee`. */
  slug: string;
  /** Overrides the default "Help" label. */
  label?: string;
  className?: string;
}

/**
 * Contextual link from a workflow page to the guide that explains it.
 *
 * It renders nothing when the guide does not exist or the signed-in role may not
 * read it, so a page can never offer a link that leads to "not available for your
 * account". Used at page level, not on individual cards.
 */
export function HelpLink({ slug, label = 'Help', className }: HelpLinkProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const role: HelpRole =
    user?.permissionTier === 'FULL'
      ? 'FULL'
      : user?.permissionTier === 'SUPERVISOR'
        ? 'SUPERVISOR'
        : 'STANDARD';

  const guide = getGuideBySlug(slug, role);
  if (!guide || guide.contentStatus !== 'READY') return null;

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/help-center/$guideSlug', params: { guideSlug: slug } })}
      title={guide.title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 h-9',
        'text-sm font-semibold text-muted-foreground transition-colors',
        'hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
    >
      <HelpCircle className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
