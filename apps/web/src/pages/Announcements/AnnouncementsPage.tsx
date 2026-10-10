import { useState, useEffect, useCallback } from 'react';
import { HelpLink } from '@/components/common/HelpLink';
import {
  Megaphone,
  Plus,
  Search,
  Pin,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Inbox,
  Paperclip,
  Bookmark,
  Archive,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Announcement,
  RecipientAnnouncement,
  AnnouncementService,
  AnnouncementStats,
  PaginationMetadata,
  AnnouncementDerivedStatus,
  AnnouncementPriority,
} from '@/services/announcement.service';
import { AnnouncementWizardModal } from './components/AnnouncementWizardModal';
import { AnnouncementDetailModal } from './components/AnnouncementDetailModal';
import { AnnouncementRecipientDetailModal } from './components/AnnouncementRecipientDetailModal';
import { useAnnouncementUnread } from '@/hooks/useAnnouncementUnread';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { format, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from '@/components/shared/LoadError';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isHR = user?.permissionTier === 'FULL';
  const { unreadCount: globalUnreadCount, refreshUnreadCount } = useAnnouncementUnread();

  // ── Top-level View for FULL users ('MANAGE' | 'RECIPIENT') ──
  const [activeMainView, setActiveMainView] = useState<'MANAGE' | 'RECIPIENT'>('MANAGE');

  // ══════════════════════════════════════════════════════════════
  // 1. HR MANAGEMENT WORKSPACE STATE
  // ══════════════════════════════════════════════════════════════
  const [hrStats, setHrStats] = useState<AnnouncementStats>({
    published: 0,
    scheduled: 0,
    drafts: 0,
    expired: 0,
    archived: 0,
  });

  const [hrAnnouncements, setHrAnnouncements] = useState<Announcement[]>([]);
  const [hrPagination, setHrPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [hrActiveTab, setHrActiveTab] = useState<string>('ALL');
  const [hrSelectedPriority, setHrSelectedPriority] = useState<string>('ALL');
  const [hrSearchQuery, setHrSearchQuery] = useState<string>('');
  const [hrLoading, setHrLoading] = useState<boolean>(true);
  const [hrStatsLoading, setHrStatsLoading] = useState<boolean>(true);
  const [hrStatsError, setHrStatsError] = useState<string | null>(null);
  const [hrError, setHrError] = useState<string | null>(null);

  // Modals (HR)
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [hrDetailModalOpen, setHrDetailModalOpen] = useState<boolean>(false);
  const [hrDetailAnnouncementId, setHrDetailAnnouncementId] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════════════
  // 2. RECIPIENT FEED STATE (Employee / Supervisor / My Announcements)
  // ══════════════════════════════════════════════════════════════
  const [recipientTab, setRecipientTab] = useState<'CURRENT' | 'UNREAD' | 'PAST'>('CURRENT');
  const [recipientAnnouncements, setRecipientAnnouncements] = useState<RecipientAnnouncement[]>([]);
  const [recipientPagination, setRecipientPagination] = useState<PaginationMetadata>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [recipientLoading, setRecipientLoading] = useState<boolean>(true);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Modals (Recipient)
  const [recipientDetailModalOpen, setRecipientDetailModalOpen] = useState<boolean>(false);
  const [recipientDetailAnnouncementId, setRecipientDetailAnnouncementId] = useState<string | null>(null);

  // ── HR Fetch Functions ──
  const fetchHrStats = async () => {
    try {
      setHrStatsLoading(true);
      setHrStatsError(null);
      const data = await AnnouncementService.getStats();
      setHrStats(data);
    } catch (err) {
      setHrStatsError(getApiErrorMessage(err, 'The announcement totals could not be loaded.'));
    } finally {
      setHrStatsLoading(false);
    }
  };

  const fetchHrAnnouncements = useCallback(
    async (pageToLoad = 1, tab = hrActiveTab, priority = hrSelectedPriority, search = hrSearchQuery) => {
      setHrLoading(true);
      setHrError(null);
      try {
        const res = await AnnouncementService.listForHR({
          status: tab !== 'ALL' ? tab : undefined,
          priority: priority !== 'ALL' ? priority : undefined,
          search: search.trim() || undefined,
          page: pageToLoad,
          limit: 10,
        });
        setHrAnnouncements(res.data);
        setHrPagination(res.pagination);
      } catch (err: any) {
        console.error('Failed to load HR announcements', err);
        setHrError(getApiErrorMessage(err, 'Unable to load announcements. Please try again.'));
      } finally {
        setHrLoading(false);
      }
    },
    [hrActiveTab, hrSelectedPriority, hrSearchQuery]
  );

  // ── Recipient Fetch Function ──
  const fetchRecipientAnnouncements = useCallback(
    async (pageToLoad = 1, tab = recipientTab) => {
      setRecipientLoading(true);
      setRecipientError(null);
      try {
        const filter = tab === 'PAST' ? 'past' : 'current';
        const unreadOnly = tab === 'UNREAD';

        const res = await AnnouncementService.listForRecipient({
          filter,
          unreadOnly,
          page: pageToLoad,
          limit: 10,
        });
        setRecipientAnnouncements(res.data);
        setRecipientPagination(res.pagination);
      } catch (err: any) {
        console.error('Failed to load recipient announcements', err);
        setRecipientError(
          getApiErrorMessage(err, 'Unable to load announcements for you right now.')
        );
      } finally {
        setRecipientLoading(false);
      }
    },
    [recipientTab]
  );

  // Trigger initial loads
  useEffect(() => {
    if (isHR) {
      fetchHrStats();
      fetchHrAnnouncements(1, hrActiveTab, hrSelectedPriority, hrSearchQuery);
    }
    // Also load recipient announcements if not HR or if HR switches to My Announcements
    fetchRecipientAnnouncements(1, recipientTab);
  }, [isHR]);

  const handleRecipientTabChange = (newTab: 'CURRENT' | 'UNREAD' | 'PAST') => {
    setRecipientTab(newTab);
    fetchRecipientAnnouncements(1, newTab);
  };

  const handleRecipientPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= recipientPagination.totalPages) {
      fetchRecipientAnnouncements(newPage, recipientTab);
    }
  };

  const handleOpenRecipientDetail = (announcementId: string) => {
    setRecipientDetailAnnouncementId(announcementId);
    setRecipientDetailModalOpen(true);
  };

  const handleRecipientReadSuccess = (announcementId: string) => {
    // Update local recipient feed state (mark as read)
    setRecipientAnnouncements((prev) =>
      prev.map((a) =>
        a.id === announcementId ? { ...a, isRead: true, readAt: new Date().toISOString() } : a
      )
    );
    refreshUnreadCount();
  };

  const handleRefreshAll = () => {
    refreshUnreadCount();
    if (isHR && activeMainView === 'MANAGE') {
      fetchHrStats();
      fetchHrAnnouncements(hrPagination.page, hrActiveTab, hrSelectedPriority, hrSearchQuery);
    } else {
      fetchRecipientAnnouncements(recipientPagination.page, recipientTab);
    }
  };

  /**
   * Row actions for a published announcement. Archiving pulls it from every
   * recipient's feed but keeps the record; only then can it be deleted, and
   * deleting takes its read receipts with it.
   */
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  const handleArchiveRow = async (a: Announcement) => {
    setRowActionId(a.id);
    try {
      await AnnouncementService.archiveAnnouncement(a.id);
      toast.success('Announcement archived.');
      fetchHrStats();
      fetchHrAnnouncements(hrPagination.page, hrActiveTab, hrSelectedPriority, hrSearchQuery);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'The announcement could not be archived.'));
    } finally {
      setRowActionId(null);
    }
  };

  const handleDeleteRow = async () => {
    if (!pendingDelete) return;
    setRowActionId(pendingDelete.id);
    try {
      await AnnouncementService.deleteAnnouncement(pendingDelete.id);
      toast.success('Announcement deleted.');
      setPendingDelete(null);
      fetchHrStats();
      fetchHrAnnouncements(hrPagination.page, hrActiveTab, hrSelectedPriority, hrSearchQuery);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'The announcement could not be deleted.'));
    } finally {
      setRowActionId(null);
    }
  };

  // Helper formatting for HR audience string
  const formatAudienceSummary = (announcement: Announcement): string => {
    const scopes = announcement.audienceScopes || [];
    if (scopes.length === 0) return '—';
    if (scopes.some((s) => s.scopeType === 'ALL')) return 'All Active Employees';

    if (scopes.length === 1) {
      const s = scopes[0];
      if (s.scopeType === 'DEPARTMENT') return `${s.targetDepartment?.name || 'Department'} Department`;
      if (s.scopeType === 'UNIT') return `${s.targetUnit?.name || 'Unit'} Unit`;
      if (s.scopeType === 'JOB_ROLE') return s.targetJobRole?.title || 'Job Role';
      if (s.scopeType === 'EMPLOYEE') {
        return s.targetEmployee
          ? `${s.targetEmployee.firstName} ${s.targetEmployee.lastName}`
          : 'Individual Staff';
      }
    }

    const firstScope = scopes[0];
    let firstLabel = 'Group';
    if (firstScope.scopeType === 'DEPARTMENT') firstLabel = firstScope.targetDepartment?.name || 'Dept';
    else if (firstScope.scopeType === 'UNIT') firstLabel = firstScope.targetUnit?.name || 'Unit';
    else if (firstScope.scopeType === 'JOB_ROLE') firstLabel = firstScope.targetJobRole?.title || 'Role';
    else if (firstScope.scopeType === 'EMPLOYEE') firstLabel = firstScope.targetEmployee?.firstName || 'Staff';

    return `${firstLabel} + ${scopes.length - 1} more`;
  };

  const renderStatusBadge = (status: AnnouncementDerivedStatus) => {
    const config = {
      DRAFT: {
        label: 'Draft',
        className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-border-soft',
      },
      SCHEDULED: {
        label: 'Scheduled',
        // Awaiting its publish date — that is "pending", not merely informational.
        className: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
      },
      PUBLISHED: {
        label: 'Published',
        className: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
      },
      EXPIRED: {
        label: 'Past',
        className: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
      },
      ARCHIVED: {
        label: 'Archived',
        className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
      },
    }[status] || {
      label: status,
      className: 'bg-slate-100 text-slate-700 dark:bg-surface-2 dark:text-secondary-foreground',
    };

    return (
      <Badge variant="outline" className={cn('font-semibold text-xs py-0.5 px-2.5', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const renderPriorityBadge = (priority: AnnouncementPriority) => {
    const config = {
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
        className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      },
    }[priority] || { label: priority, className: 'bg-slate-100 text-slate-600 dark:bg-surface-2 dark:text-secondary-foreground' };

    return (
      <Badge variant="outline" className={cn('text-xs font-semibold py-0.5 px-2', config.className)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            Announcements
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
            {isHR && activeMainView === 'MANAGE'
              ? 'Share important updates with employees and track who has read them.'
              : 'Important updates and notices for you.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <HelpLink slug={isHR ? 'create-publish-announcement' : 'read-announcements'} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="h-10 text-xs font-semibold gap-1.5"
            title="Refresh announcements"
          >
            <RefreshCw
              className={cn(
                'w-3.5 h-3.5',
                (hrLoading || recipientLoading) && 'animate-spin'
              )}
            />
            Refresh
          </Button>

          {isHR && activeMainView === 'MANAGE' && (
            <Button variant="create"
              onClick={() => {
                setEditingAnnouncement(null);
                setWizardOpen(true);
              }}
              className="font-semibold text-sm h-10 px-5 gap-2 shadow-xs cursor-pointer">
              <Plus className="w-4 h-4" />
              Create Announcement
            </Button>
          )}
        </div>
      </div>

      {/* ── Top-level Segmented Control for FULL HR (Manage vs My Announcements) ── */}
      {isHR && (
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveMainView('MANAGE')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer',
              activeMainView === 'MANAGE'
                ? 'bg-surface dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            Manage Announcements
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMainView('RECIPIENT');
              fetchRecipientAnnouncements(1, recipientTab);
            }}
            className={cn(
              'px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2',
              activeMainView === 'RECIPIENT'
                ? 'bg-surface dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <span>My Announcements</span>
            {globalUnreadCount > 0 && (
              <Badge variant="outline" className="bg-teal-700 text-white border-teal-600 text-[10px] font-bold py-0 px-1.5">
                {globalUnreadCount}
              </Badge>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VIEW 1: HR MANAGEMENT WORKSPACE (FULL ONLY)
         ══════════════════════════════════════════════════════════════ */}
      {isHR && activeMainView === 'MANAGE' ? (
        <div className="space-y-6">
          {/* Summary Cards — the shared StatCard, so these read the same as the
              dashboard tiles instead of being a second, paler design. Tones follow
              the system colour code: live is positive, scheduled is pending,
              drafts need finishing, past notices are neutral history. */}
          {hrStatsError && <LoadError compact message={hrStatsError} onRetry={fetchHrStats} />}
          <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4", hrStatsError && "opacity-50")} aria-hidden={hrStatsError ? true : undefined}>
            <StatCard
              tone="total"
              icon={<Megaphone />}
              label="Published"
              value={hrStats.published}
              hint="Currently visible to staff"
              loading={hrStatsLoading}
              selected={hrActiveTab === 'PUBLISHED'}
              onClick={() => {
                setHrActiveTab('PUBLISHED');
                fetchHrAnnouncements(1, 'PUBLISHED', hrSelectedPriority, hrSearchQuery);
              }}
            />
            <StatCard
              tone="warning"
              icon={<Clock />}
              label="Scheduled"
              value={hrStats.scheduled}
              hint="Planned for future dates"
              loading={hrStatsLoading}
              selected={hrActiveTab === 'SCHEDULED'}
              onClick={() => {
                setHrActiveTab('SCHEDULED');
                fetchHrAnnouncements(1, 'SCHEDULED', hrSelectedPriority, hrSearchQuery);
              }}
            />
            <StatCard
              tone="accent"
              icon={<FileText />}
              label="Drafts"
              value={hrStats.drafts}
              hint="Unfinished notices"
              loading={hrStatsLoading}
              selected={hrActiveTab === 'DRAFT'}
              onClick={() => {
                setHrActiveTab('DRAFT');
                fetchHrAnnouncements(1, 'DRAFT', hrSelectedPriority, hrSearchQuery);
              }}
            />
            <StatCard
              tone="neutral"
              icon={<Inbox />}
              label="Past Notices"
              value={hrStats.expired}
              hint="Expired notice history"
              loading={hrStatsLoading}
              selected={hrActiveTab === 'PAST'}
              onClick={() => {
                setHrActiveTab('PAST');
                fetchHrAnnouncements(1, 'PAST', hrSelectedPriority, hrSearchQuery);
              }}
            />
          </div>

          {/* Filters Bar */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { key: 'ALL', label: 'All Announcements' },
                  { key: 'PUBLISHED', label: 'Published' },
                  { key: 'SCHEDULED', label: 'Scheduled' },
                  { key: 'DRAFT', label: 'Drafts' },
                  { key: 'EXPIRED', label: 'Past' },
                  { key: 'ARCHIVED', label: 'Archived' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setHrActiveTab(t.key);
                      fetchHrAnnouncements(1, t.key, hrSelectedPriority, hrSearchQuery);
                    }}
                    className={cn(
                      'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer',
                      hrActiveTab === t.key
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search notices..."
                    value={hrSearchQuery}
                    onChange={(e) => {
                      setHrSearchQuery(e.target.value);
                      fetchHrAnnouncements(1, hrActiveTab, hrSelectedPriority, e.target.value);
                    }}
                    className="pl-9 h-9 text-xs sm:text-sm bg-surface dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                </div>

                <div className="shrink-0">
                  <select
                    value={hrSelectedPriority}
                    onChange={(e) => {
                      setHrSelectedPriority(e.target.value);
                      fetchHrAnnouncements(1, hrActiveTab, e.target.value, hrSearchQuery);
                    }}
                    className="h-9 rounded-xl px-3 text-xs sm:text-sm font-medium bg-surface dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANT">Important</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            {/* HR Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface dark:bg-slate-900 overflow-hidden shadow-xs">
              {hrError ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-8 h-8 text-status-danger-foreground mx-auto mb-2" />
                  <p className="font-semibold text-status-danger-foreground">{hrError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchHrAnnouncements(1)}
                    className="mt-3"
                  >
                    Retry
                  </Button>
                </div>
              ) : hrLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : hrAnnouncements.length === 0 ? (
                <div className="p-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
                  <Megaphone className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                  <div>
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                      {hrActiveTab === 'DRAFT'
                        ? 'No drafts found'
                        : hrActiveTab === 'SCHEDULED'
                        ? 'No scheduled announcements'
                        : hrActiveTab === 'EXPIRED'
                        ? 'No past announcements'
                        : hrActiveTab === 'ARCHIVED'
                        ? 'No archived announcements'
                        : 'No announcements yet'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto dark:text-muted-foreground">
                      {hrSearchQuery
                        ? 'No announcements match your search query.'
                        : 'Share important updates with employees and track who has read them.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* table-fixed: with auto layout the longest announcement title set the
                      column width and pushed Actions off the edge. Fixed widths mean the
                      table always fits and long text truncates instead. */}
                  <table className="w-full table-fixed text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 w-[26%]">Announcement</th>
                        <th className="py-3.5 px-3 w-[15%] hidden lg:table-cell">Audience</th>
                        <th className="py-3.5 px-3 w-[12%]">Publish Date</th>
                        <th className="py-3.5 px-3 w-[9%]">Priority</th>
                        <th className="py-3.5 px-3 w-[8%] hidden xl:table-cell">Recipients</th>
                        <th className="py-3.5 px-3 w-[8%] hidden xl:table-cell whitespace-nowrap">Read</th>
                        <th className="py-3.5 px-3 w-[10%]">Status</th>
                        <th className="py-3.5 px-4 w-[12%] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {hrAnnouncements.map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-start gap-2">
                              {a.isPinned && (
                                <span title="Pinned Announcement" className="shrink-0 mt-0.5">
                                  <Pin className="w-4 h-4 text-teal-600 dark:text-primary-300" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHrDetailAnnouncementId(a.id);
                                    setHrDetailModalOpen(true);
                                  }}
                                  className="font-bold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 text-left transition-colors truncate block w-full cursor-pointer"
                                >
                                  {a.title}
                                </button>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {a.body || a.content || '—'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 hidden lg:table-cell truncate">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{formatAudienceSummary(a)}</span>
                            </div>
                          </td>

                          <td className="py-4 px-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {a.publishAt ? format(new Date(a.publishAt), 'MMM d, yyyy') : '—'}
                            {a.publishAt && (
                              <span className="block text-[11px] text-muted-foreground">
                                {format(new Date(a.publishAt), 'h:mm a')}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-3 whitespace-nowrap">
                            {renderPriorityBadge(a.priority)}
                          </td>

                          <td className="py-4 px-3 font-semibold text-xs text-slate-800 dark:text-slate-200 hidden xl:table-cell">
                            {a.derivedStatus === 'DRAFT' ? '—' : a._count?.recipients ?? 0}
                          </td>

                          <td className="py-4 px-3 text-xs hidden xl:table-cell">
                            {a.derivedStatus === 'DRAFT' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex items-center gap-1.5 font-semibold text-status-success-foreground whitespace-nowrap">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-status-success-foreground" />
                                <span className="tabular-nums">
                                  {a._count?.recipients ? `0 / ${a._count.recipients}` : '0 / 0'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-3 whitespace-nowrap">
                            {renderStatusBadge(a.derivedStatus)}
                          </td>

                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="review"
                                size="sm"
                                onClick={() => {
                                  setHrDetailAnnouncementId(a.id);
                                  setHrDetailModalOpen(true);
                                }}
                                title="View announcement"
                                className="h-8 w-8 2xl:w-auto p-0 2xl:px-2.5 text-xs font-semibold">
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden 2xl:inline">View</span>
                              </Button>

                              {a.derivedStatus !== 'ARCHIVED' && (
                                <Button
                                  variant="update"
                                  size="sm"
                                  onClick={() => {
                                    setEditingAnnouncement(a);
                                    setWizardOpen(true);
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Edit Announcement">
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {/* Still in front of staff: archive first. */}
                              {a.derivedStatus !== 'ARCHIVED' && a.derivedStatus !== 'DRAFT' && (
                                <Button
                                  variant="delete"
                                  size="sm"
                                  disabled={rowActionId === a.id}
                                  onClick={() => handleArchiveRow(a)}
                                  className="h-8 w-8 p-0"
                                  title="Archive — removes it from everyone's feed">
                                  <Archive className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {/* Finished with: an unsent draft, or an archived
                                  notice nobody sees any more. */}
                              {(a.derivedStatus === 'ARCHIVED' || a.derivedStatus === 'DRAFT') && (
                                <Button
                                  variant="delete"
                                  size="sm"
                                  disabled={rowActionId === a.id}
                                  onClick={() => setPendingDelete(a)}
                                  className="h-8 w-8 p-0"
                                  title={a.derivedStatus === 'DRAFT' ? 'Delete draft' : 'Delete permanently'}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!hrLoading && hrAnnouncements.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    Showing {(hrPagination.page - 1) * hrPagination.limit + 1} to{' '}
                    {Math.min(hrPagination.page * hrPagination.limit, hrPagination.total)} of{' '}
                    {hrPagination.total} notices
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={hrPagination.page <= 1 || hrLoading}
                      onClick={() =>
                        fetchHrAnnouncements(
                          hrPagination.page - 1,
                          hrActiveTab,
                          hrSelectedPriority,
                          hrSearchQuery
                        )
                      }
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </Button>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 px-1">
                      Page {hrPagination.page} of {hrPagination.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={hrPagination.page >= hrPagination.totalPages || hrLoading}
                      onClick={() =>
                        fetchHrAnnouncements(
                          hrPagination.page + 1,
                          hrActiveTab,
                          hrSelectedPriority,
                          hrSearchQuery
                        )
                      }
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
           VIEW 2: RECIPIENT FEED (STANDARD / SUPERVISOR / FULL MY ANNOUNCEMENTS)
          ══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Recipient Tabs (Current, Unread, Past) */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => handleRecipientTabChange('CURRENT')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer',
                recipientTab === 'CURRENT'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              Current Notices
            </button>

            <button
              type="button"
              onClick={() => handleRecipientTabChange('UNREAD')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2',
                recipientTab === 'UNREAD'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <span>Unread</span>
              {globalUnreadCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-bold py-0 px-1.5',
                    recipientTab === 'UNREAD'
                      ? 'bg-surface text-teal-700 border-white dark:text-primary-300'
                      : 'bg-teal-700 text-white border-teal-600'
                  )}
                >
                  {globalUnreadCount}
                </Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleRecipientTabChange('PAST')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer',
                recipientTab === 'PAST'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              Past Announcements
            </button>
          </div>

          {/* Recipient Feed List */}
          <div className="space-y-3.5">
            {recipientError ? (
              <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface dark:bg-slate-900">
                <AlertCircle className="w-8 h-8 text-status-danger-foreground mx-auto mb-2" />
                <p className="font-semibold text-status-danger-foreground">{recipientError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchRecipientAnnouncements(1, recipientTab)}
                  className="mt-3"
                >
                  Retry
                </Button>
              </div>
            ) : recipientLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : recipientAnnouncements.length === 0 ? (
              <div className="p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface dark:bg-slate-900 space-y-3">
                <Inbox className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
                    {recipientTab === 'CURRENT'
                      ? 'No announcements right now.'
                      : recipientTab === 'UNREAD'
                      ? "You're all caught up."
                      : 'No past announcements.'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto dark:text-muted-foreground">
                    {recipientTab === 'CURRENT'
                      ? 'New HR announcements will appear here.'
                      : recipientTab === 'UNREAD'
                      ? 'You have no unread announcements.'
                      : 'Older announcements will appear here after they are no longer current.'}
                  </p>
                </div>
              </div>
            ) : (
              recipientAnnouncements.map((a) => {
                const isUpdated =
                  a.publishAt && a.updatedAt && isAfter(new Date(a.updatedAt), new Date(a.publishAt));
                const hasAttachments = (a._count?.attachments ?? 0) > 0;

                return (
                  <div
                    key={a.id}
                    onClick={() => handleOpenRecipientDetail(a.id)}
                    className={cn(
                      'p-5 sm:p-6 rounded-2xl border transition-all cursor-pointer group shadow-xs',
                      !a.isRead
                        ? 'border-teal-300 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 hover:bg-teal-50/60 dark:hover:bg-primary-900/40'
                        : 'border-slate-200 dark:border-slate-800 bg-surface dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left info */}
                      <div className="space-y-2 min-w-0 flex-1">
                        {/* Badges strip */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderPriorityBadge(a.priority)}

                          {a.isPinned && (
                            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs gap-1 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
                              <Pin className="w-3 h-3 text-teal-600 dark:text-primary-300" />
                              Pinned
                            </Badge>
                          )}

                          {!a.isRead && (
                            <Badge variant="outline" className="bg-teal-700 text-white border-teal-600 text-xs font-bold">
                              Unread
                            </Badge>
                          )}

                          {isUpdated && (
                            <span className="text-[11px] text-status-warning-foreground font-medium">
                              • Updated
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3
                          className={cn(
                            'text-base sm:text-lg font-bold group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors',
                            !a.isRead
                              ? 'text-slate-900 dark:text-slate-100 font-extrabold'
                              : 'text-slate-800 dark:text-slate-200'
                          )}
                        >
                          {a.title}
                        </h3>

                        {/* Snippet */}
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {a.body || a.content || '—'}
                        </p>

                        {/* Timing and Attachments footer info */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {a.publishAt
                              ? format(new Date(a.publishAt), 'MMMM d, yyyy · h:mm a')
                              : 'Recently'}
                          </span>

                          {hasAttachments && (
                            <span className="flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-300">
                              <Paperclip className="w-3.5 h-3.5" />
                              {a._count?.attachments}{' '}
                              {a._count?.attachments === 1 ? 'attachment' : 'attachments'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right button */}
                      <div className="sm:self-center shrink-0">
                        <Button
                          variant="review"
                          size="sm"
                          className="text-xs font-semibold">
                          Open Notice
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Recipient Pagination */}
            {!recipientLoading && recipientAnnouncements.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3.5 bg-surface dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 mt-4">
                <div>
                  Showing {(recipientPagination.page - 1) * recipientPagination.limit + 1} to{' '}
                  {Math.min(
                    recipientPagination.page * recipientPagination.limit,
                    recipientPagination.total
                  )}{' '}
                  of {recipientPagination.total} notices
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={recipientPagination.page <= 1 || recipientLoading}
                    onClick={() => handleRecipientPageChange(recipientPagination.page - 1)}
                    className="h-8 px-2.5 text-xs gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </Button>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 px-1">
                    Page {recipientPagination.page} of {recipientPagination.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      recipientPagination.page >= recipientPagination.totalPages || recipientLoading
                    }
                    onClick={() => handleRecipientPageChange(recipientPagination.page + 1)}
                    className="h-8 px-2.5 text-xs gap-1"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HR Create / Edit Wizard Modal ── */}
      {isHR && (
        <AnnouncementWizardModal
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          announcementToEdit={editingAnnouncement}
          onSuccess={handleRefreshAll}
        />
      )}

      {/* ── HR Detail Modal (Management Context — Does NOT mark read) ── */}
      {isHR && (
        <AnnouncementDetailModal
          open={hrDetailModalOpen}
          onOpenChange={setHrDetailModalOpen}
          announcementId={hrDetailAnnouncementId}
          onEdit={(a) => {
            setHrDetailModalOpen(false);
            setEditingAnnouncement(a);
            setWizardOpen(true);
          }}
          onRefresh={handleRefreshAll}
        />
      )}

      {/* ── Recipient Detail Modal (Recipient Context — Auto marks read) ── */}
      <AnnouncementRecipientDetailModal
        open={recipientDetailModalOpen}
        onOpenChange={setRecipientDetailModalOpen}
        announcementId={recipientDetailAnnouncementId}
        onReadSuccess={handleRecipientReadSuccess}
      />

      {/* ── Delete confirmation (row action) ── */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-status-danger-surface text-status-danger-foreground flex items-center justify-center shrink-0 border border-status-danger-border">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">
                Delete &ldquo;{pendingDelete?.title}&rdquo;?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingDelete?.derivedStatus === 'DRAFT'
                  ? 'This draft and its attachments will be permanently removed.'
                  : 'This archived announcement, its attachments and its read receipts will be permanently removed. The audit log keeps a record of the deletion.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-border-soft">
            <Button variant="outline" size="sm" disabled={!!rowActionId} onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="delete" size="sm" disabled={!!rowActionId} onClick={handleDeleteRow}>
              <Trash2 className="w-3.5 h-3.5" />
              {rowActionId ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
