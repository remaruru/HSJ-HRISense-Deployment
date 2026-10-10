import { useState, useEffect } from 'react';
import {
  Megaphone,
  Pin,
  Calendar,
  Clock,
  FileText,
  Download,
  X,
  AlertCircle,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RecipientAnnouncement,
  AnnouncementService,
  AnnouncementAttachment,
} from '@/services/announcement.service';
import { useAnnouncementUnread } from '@/hooks/useAnnouncementUnread';
import { toast } from 'sonner';
import { format, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface AnnouncementRecipientDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcementId: string | null;
  onReadSuccess?: (announcementId: string) => void;
}

export function AnnouncementRecipientDetailModal({
  open,
  onOpenChange,
  announcementId,
  onReadSuccess,
}: AnnouncementRecipientDetailModalProps) {
  const [announcement, setAnnouncement] = useState<RecipientAnnouncement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUnreadCount } = useAnnouncementUnread();

  useEffect(() => {
    if (!open || !announcementId) {
      setAnnouncement(null);
      setError(null);
      return;
    }

    let isMounted = true;

    const loadAndMarkRead = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch authorized announcement detail for recipient
        const data = await AnnouncementService.getRecipientAnnouncement(announcementId);
        if (!isMounted) return;
        setAnnouncement(data);

        // 2. Auto mark-as-read if successfully loaded
        try {
          const markRes = await AnnouncementService.markRead(announcementId);
          if (!markRes.alreadyRead) {
            onReadSuccess?.(announcementId);
            refreshUnreadCount();
          }
        } catch (markErr) {
          console.warn('Auto mark-read failed or not applicable', markErr);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to load recipient announcement', err);
        setError(getApiErrorMessage(err, 'Unable to open this announcement.'));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAndMarkRead();

    return () => {
      isMounted = false;
    };
  }, [open, announcementId, onReadSuccess, refreshUnreadCount]);

  const handleDownloadAttachment = async (attachment: AnnouncementAttachment) => {
    if (!announcement) return;
    try {
      toast.info(`Downloading ${attachment.originalFilename}...`);
      await AnnouncementService.downloadAttachment(
        announcement.id,
        attachment.id,
        attachment.originalFilename
      );
    } catch (err: any) {
      console.error('Download failed', err);
      toast.error(getApiErrorMessage(err, 'This attachment is no longer available.'));
    }
  };

  if (!open) return null;

  const priorityBadge = {
    URGENT: {
      label: 'Urgent',
      className: 'bg-status-danger-surface text-status-danger-foreground border-status-danger-border',
    },
    IMPORTANT: {
      label: 'Important',
      className: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
    },
    NORMAL: {
      label: 'Normal',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    },
  }[announcement?.priority || 'NORMAL'];

  const isUpdated =
    announcement?.publishAt &&
    announcement?.updatedAt &&
    isAfter(new Date(announcement.updatedAt), new Date(announcement.publishAt));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(880px,calc(100vw-32px))] sm:max-w-[min(880px,calc(100vw-32px))]',
          'h-[min(720px,calc(100vh-48px))] max-h-[min(720px,calc(100vh-48px))] min-h-[440px]',
          'flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 sm:px-8 py-4.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {announcement?.title || 'Notice'}
                </h2>
                {announcement?.isPinned && (
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 gap-1 text-xs dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
                    <Pin className="w-3 h-3 text-teal-600 dark:text-primary-300" />
                    Pinned
                  </Badge>
                )}
                <Badge variant="outline" className={cn('text-xs', priorityBadge.className)}>
                  {priorityBadge.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hospital Notice
              </p>
            </div>
          </div>

          {/* DialogContent renders the close button; a second one showed as two ✕. */}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 min-h-0">
          {loading ? (
            <div className="space-y-4">
              <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse w-2/3" />
              <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse w-1/2" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-status-danger-foreground mx-auto mb-2" />
              <p className="font-semibold text-status-danger-foreground">{error}</p>
            </div>
          ) : announcement ? (
            <>
              {/* Publication Date & Notice Metadata Strip */}
              <div className="flex flex-wrap items-center gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>
                    Published on{' '}
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      {announcement.publishAt
                        ? format(new Date(announcement.publishAt), 'MMMM d, yyyy · h:mm a')
                        : 'Recently'}
                    </strong>
                  </span>
                </div>

                {isUpdated && (
                  <div className="flex items-center gap-1.5 text-status-warning-foreground font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Updated recently</span>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed shadow-xs">
                  {announcement.body || announcement.content || '—'}
                </div>
              </div>

              {/* Attachments Section */}
              {announcement.attachments && announcement.attachments.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Attachments ({announcement.attachments.length})
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {announcement.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 flex items-center justify-center shrink-0 dark:text-primary-300">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {att.originalFilename}
                            </p>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : 'Document'}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAttachment(att)}
                          className="h-8 px-3 text-xs font-semibold text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end px-6 sm:px-8 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs sm:text-sm font-semibold h-9 px-5"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
