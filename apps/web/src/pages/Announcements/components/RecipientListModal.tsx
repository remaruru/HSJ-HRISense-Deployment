import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Building2,
  Briefcase,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AnnouncementService,
  AnnouncementRecipientItem,
  PaginationMetadata,
} from '@/services/announcement.service';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface RecipientListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcementId: string | null;
  announcementTitle?: string;
}

export function RecipientListModal({
  open,
  onOpenChange,
  announcementId,
  announcementTitle,
}: RecipientListModalProps) {
  const [recipients, setRecipients] = useState<AnnouncementRecipientItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchRecipients = useCallback(
    async (pageToLoad = 1, currentSearch = search, currentFilter = readFilter) => {
      if (!announcementId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await AnnouncementService.listRecipients(announcementId, {
          search: currentSearch,
          readFilter: currentFilter,
          page: pageToLoad,
          limit: 15,
        });
        setRecipients(res.data);
        setPagination(res.pagination);
      } catch (err: any) {
        console.error('Failed to load recipients', err);
        setError(getApiErrorMessage(err, 'Unable to load recipients. Please try again.'));
      } finally {
        setLoading(false);
      }
    },
    [announcementId, search, readFilter]
  );

  useEffect(() => {
    if (open && announcementId) {
      setSearch('');
      setReadFilter('all');
      fetchRecipients(1, '', 'all');
    }
  }, [open, announcementId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    fetchRecipients(1, val, readFilter);
  };

  const handleFilterChange = (newFilter: 'all' | 'read' | 'unread') => {
    setReadFilter(newFilter);
    fetchRecipients(1, search, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchRecipients(newPage, search, readFilter);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(960px,calc(100vw-32px))] sm:max-w-[min(960px,calc(100vw-32px))]',
          'h-[min(720px,calc(100vh-48px))] max-h-[min(720px,calc(100vh-48px))] min-h-[480px]',
          'flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  Announcement Recipients
                </h2>
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {pagination.total} total
                </Badge>
              </div>
              {announcementTitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-md">
                  {announcementTitle}
                </p>
              )}
            </div>
          </div>
          {/* DialogContent renders the close button; a second one showed as two ✕. */}
        </div>

        {/* Filters and Search Bar */}
        <div className="flex-shrink-0 px-6 py-3 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or ID number..."
              value={search}
              onChange={handleSearchChange}
              className="pl-9 h-9 text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                readFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-foreground'
              )}
            >
              All Recipients
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('read')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                readFilter === 'read'
                  ? 'bg-white dark:bg-slate-900 text-status-success-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-foreground'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success-foreground" />
              Read
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('unread')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                readFilter === 'unread'
                  ? 'bg-white dark:bg-slate-900 text-status-warning-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-foreground'
              )}
            >
              <Clock className="w-3.5 h-3.5 text-status-warning-foreground" />
              Unread
            </button>
          </div>
        </div>

        {/* Recipients Table Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-status-danger-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-status-danger-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRecipients(1)}
                className="mt-3 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : recipients.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No recipients found</p>
              <p className="text-xs text-slate-500 mt-1 dark:text-muted-foreground">
                {search
                  ? 'No employees match your search query.'
                  : 'No recipient records match the selected filter.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-6">Employee</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Department / Unit</th>
                  <th className="py-3 px-4">Job Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Read At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {recipients.map((r) => (
                  <tr
                    key={r.employeeId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {r.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {r.employeeNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {r.department?.name || r.unit?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{r.jobRole?.title || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {r.isRead ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-success-surface text-status-success-foreground border border-status-success-border">
                          <CheckCircle2 className="w-3 h-3 text-status-success-foreground" />
                          Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
                          <Clock className="w-3 h-3 text-status-warning-foreground" />
                          Unread
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right text-xs text-slate-500 dark:text-slate-400">
                      {r.readAt ? format(new Date(r.readAt), 'MMM d, yyyy · h:mm a') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + (recipients.length > 0 ? 1 : 0)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            recipients
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
            <span className="font-semibold text-slate-800 dark:text-slate-200 px-1">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="h-8 px-2.5 text-xs gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
