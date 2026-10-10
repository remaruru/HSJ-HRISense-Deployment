import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Megaphone, Pin, ArrowRight } from 'lucide-react';
import {
  RecipientAnnouncement,
  AnnouncementService,
} from '@/services/announcement.service';
import { AnnouncementRecipientDetailModal } from '@/pages/Announcements/components/AnnouncementRecipientDetailModal';
import { useAnnouncementUnread } from '@/hooks/useAnnouncementUnread';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from '@/components/shared/LoadError';

/**
 * Dashboard notice board — sits at the very top of every dashboard so an
 * announcement is the first thing a person sees.
 *
 * Priority uses the Hospicio colour code: URGENT is the red "needs attention"
 * tone, IMPORTANT the amber "moderate" tone, NORMAL stays neutral.
 */
const PRIORITY_TONE: Record<string, string> = {
  URGENT: STATUS_TONE_CHIP.danger,
  IMPORTANT: STATUS_TONE_CHIP.warning,
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgent',
  IMPORTANT: 'Important',
  NORMAL: 'Notice',
};

export function AnnouncementsWidget() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<RecipientAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const { refreshUnreadCount } = useAnnouncementUnread();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await AnnouncementService.getDashboardAnnouncements();
      setAnnouncements(res.announcements || []);
      setUnreadCount(res.unreadCurrentCount || 0);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Announcements could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleOpenAnnouncement = (id: string) => {
    setSelectedAnnouncementId(id);
    setDetailOpen(true);
  };

  const handleReadSuccess = (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true, readAt: new Date().toISOString() } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    refreshUnreadCount();
  };

  // Unread first, then pinned, then newest — the board shows what still needs reading.
  const ordered = [...announcements].sort((a, b) =>
    Number(a.isRead) - Number(b.isRead) ||
    Number(!!b.isPinned) - Number(!!a.isPinned) ||
    new Date(b.publishAt ?? 0).getTime() - new Date(a.publishAt ?? 0).getTime()
  );

  return (
    <>
      <section
        aria-label="Announcements"
        className="rounded-2xl border border-border-soft bg-surface shadow-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300 flex items-center justify-center">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold font-heading text-foreground">Announcements</h2>
            {unreadCount > 0 && (
              <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold', STATUS_TONE_CHIP.danger)}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/announcements' })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline underline-offset-2"
          >
            View all <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}
          </div>
        ) : loadError ? (
          <LoadError compact message={loadError} onRetry={fetchDashboardData} />
        ) : ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No announcements right now. New notices from HR will appear here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ordered.slice(0, 3).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleOpenAnnouncement(a.id)}
                className={cn(
                  'text-left rounded-xl border p-3.5 transition-shadow hover:shadow-card-hover min-w-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  PRIORITY_TONE[a.priority] ?? 'bg-surface-2 border-border-soft text-foreground'
                )}
              >
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold uppercase tracking-wide">
                  <span>{PRIORITY_LABEL[a.priority] ?? a.priority}</span>
                  {a.isPinned && (
                    <span className="inline-flex items-center gap-0.5 normal-case tracking-normal font-semibold">
                      · <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
                    </span>
                  )}
                  {!a.isRead && (
                    <span className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal">
                      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" /> New
                    </span>
                  )}
                </div>
                <p className={cn('mt-1.5 text-sm text-foreground line-clamp-2', !a.isRead && 'font-bold')}>
                  {a.title}
                </p>
                <p className="mt-1 text-xs text-foreground/65">
                  {a.publishAt ? format(new Date(a.publishAt), 'MMM d, yyyy') : 'Recently'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <AnnouncementRecipientDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        announcementId={selectedAnnouncementId}
        onReadSuccess={handleReadSuccess}
      />
    </>
  );
}
