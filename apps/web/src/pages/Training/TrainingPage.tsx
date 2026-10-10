import { formatPct, ratio } from '@/lib/percent';
import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Users,
  ShieldCheck,
  AlertCircle,
  SearchX,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  FilterSelect,
} from '@/components/ui/toolbar';
import {
  TrainingService,
  TrainingActivity,
  TrainingActivityType,
  TrainingActivityStatus,
  TRAINING_TYPE_LABELS,
  TRAINING_STATUS_META,
} from '@/services/training.service';
import { TrainingActivityModal } from './components/TrainingActivityModal';
import { TrainingDetailModal } from './components/TrainingDetailModal';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/** Status filter order — most operationally relevant first. */
const STATUS_FILTER_ORDER: TrainingActivityStatus[] = [
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'DRAFT',
];

export default function TrainingPage() {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === 'FULL';

  const [activities, setActivities] = useState<TrainingActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<TrainingActivity | null>(null);
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);

  /**
   * `overrides` exists only so "Clear Filters" can refetch with the cleared
   * values in the same tick. The request shape is otherwise unchanged.
   */
  const fetchActivities = async (overrides?: {
    search?: string;
    type?: string;
    status?: string;
  }) => {
    const effectiveSearch = overrides?.search ?? search;
    const effectiveType = overrides?.type ?? typeFilter;
    const effectiveStatus = overrides?.status ?? statusFilter;

    setLoading(true);
    setError(null);
    try {
      const data = await TrainingService.listActivities({
        type: effectiveType !== 'ALL' ? (effectiveType as TrainingActivityType) : undefined,
        status: effectiveStatus !== 'ALL' ? (effectiveStatus as TrainingActivityStatus) : undefined,
        search: effectiveSearch.trim() || undefined,
      });
      setActivities(data);
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to load training activities.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities();
  };

  const filtersActive = Boolean(search) || typeFilter !== 'ALL' || statusFilter !== 'ALL';

  const handleClearFilters = () => {
    const selectFiltersWereActive = typeFilter !== 'ALL' || statusFilter !== 'ALL';
    setSearch('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    // Resetting the selects re-runs the fetch effect on its own. If only the
    // free-text search was active, nothing in that dependency list changes, so
    // the refetch has to be issued here with the cleared values.
    if (!selectFiltersWereActive) {
      void fetchActivities({ search: '', type: 'ALL', status: 'ALL' });
    }
  };

  const handleOpenCreate = () => {
    setEditingActivity(null);
    setCreateModalOpen(true);
  };

  // Metrics from real activity data
  const metrics = useMemo(() => {
    const total = activities.length;
    const scheduled = activities.filter((a) => a.status === 'SCHEDULED').length;
    const completed = activities.filter((a) => a.status === 'COMPLETED').length;
    const totalEnrolled = activities.reduce(
      (acc, a) => acc + (a.participantStats?.total || 0),
      0
    );
    const totalCompletedParticipants = activities.reduce(
      (acc, a) => acc + (a.participantStats?.completed || 0),
      0
    );

    return {
      total,
      scheduled,
      completed,
      totalEnrolled,
      totalCompletedParticipants,
    };
  }, [activities]);

  const handleOpenDetail = (activityId: string) => {
    setDetailActivityId(activityId);
  };

  const handleOpenEditFromDetail = (act: TrainingActivity) => {
    setEditingActivity(act);
    setCreateModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        icon={<BookOpen className="h-5 w-5" />}
        title="Training & Seminars"
        subtitle="Manage training activities, participants, completion records, and certificates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fetchActivities()}
              disabled={loading}
              aria-label="Refresh training activities"
            >
              <RefreshCw className={cn(loading && 'animate-spin')} />
              Refresh
            </Button>

            {isFullHR && (
              <Button
                variant="create"
                onClick={handleOpenCreate}>
                <Plus />
                Create Training / Seminar
              </Button>
            )}
          </div>
        }
      />

      {/* ── Summary Metrics (real backend data only) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          tone="total"
          label="Total Activities"
          value={metrics.total}
          hint="Programs in the current view"
          loading={loading}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          tone="info"
          label="Upcoming / Scheduled"
          value={metrics.scheduled}
          hint="Active schedules"
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          label="Completed Activities"
          value={metrics.completed}
          hint="Finished and archived"
          loading={loading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          tone="neutral"
          label="Enrolled Participants"
          value={metrics.totalEnrolled}
          hint={`${metrics.totalCompletedParticipants} marked completed`}
          loading={loading}
        />
      </div>

      {/* ── Filter Toolbar ── */}
      <form onSubmit={handleSearchSubmit}>
        <Toolbar>
          <SearchField
            label="Search training activities"
            placeholder="Search by title, facilitator, or venue..."
            value={search}
            onValueChange={setSearch}
          />

          <FilterSelect
            label="Filter by activity type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            {(Object.keys(TRAINING_TYPE_LABELS) as TrainingActivityType[]).map((t) => (
              <option key={t} value={t}>
                {TRAINING_TYPE_LABELS[t]}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            {STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {TRAINING_STATUS_META[s].label}
              </option>
            ))}
          </FilterSelect>

          <ToolbarSpacer />

          <div className="flex items-center gap-2">
            <Button type="submit" variant="subtle" size="sm" disabled={loading}>
              Search
            </Button>
            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </Toolbar>
      </form>

      {/* ── Activities Table ── */}
      <div className="rounded-2xl border border-border-soft bg-surface overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : error ? (
          <EmptyState
            variant="error"
            icon={<AlertCircle className="h-5 w-5" />}
            title="Couldn't load training activities"
            description={error}
            action={
              <Button variant="subtle" size="sm" onClick={() => fetchActivities()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
            }
          />
        ) : activities.length === 0 && filtersActive ? (
          <EmptyState
            variant="filtered"
            icon={<SearchX className="h-5 w-5" />}
            title="No matching training activities"
            description="No activity matches your current search and filters. Try a different keyword, or clear the filters to see everything."
            action={
              <Button variant="subtle" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : activities.length === 0 ? (
          <EmptyState
            variant="onboarding"
            icon={<BookOpen className="h-7 w-7" />}
            title="No training activities yet"
            description="Create an activity to organize participants, track completion, and maintain employee training history."
            action={
              isFullHR ? (
                <Button variant="create" onClick={handleOpenCreate}>
                  <Plus />
                  Create Training / Seminar
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <caption className="sr-only">
                Training and seminar activities, {activities.length} shown
              </caption>
              <thead className="bg-surface-2/70 text-muted-foreground border-b border-border-soft">
                <tr className="text-[11px] font-semibold uppercase tracking-wider">
                  <th scope="col" className="px-5 py-3">Training / Seminar</th>
                  <th scope="col" className="px-5 py-3">Type</th>
                  <th scope="col" className="px-5 py-3">Schedule</th>
                  <th scope="col" className="px-5 py-3">Provider / Venue</th>
                  <th scope="col" className="px-5 py-3">Participants</th>
                  <th scope="col" className="px-5 py-3">Compliance Link</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {activities.map((act) => {
                  const statusMeta = TRAINING_STATUS_META[act.status];
                  // Enrolled ÷ capacity × 100 (shared rule). Can exceed 100% when
                  // more participants are assigned than the cap; the bar is capped,
                  // the text is not.
                  const capacityPct =
                    act.maxParticipants && act.maxParticipants > 0
                      ? ratio(act.participantStats.total, act.maxParticipants)
                      : null;

                  return (
                    <tr
                      key={act.id}
                      onClick={() => handleOpenDetail(act.id)}
                      className="cursor-pointer transition-colors hover:bg-surface-2/60"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-foreground leading-snug">{act.title}</div>
                        {act.hoursCredit ? (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {act.hoursCredit} hours credit
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {TRAINING_TYPE_LABELS[act.type]}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap">
                        <div className="text-xs font-medium text-foreground">
                          {new Date(act.startDate).toLocaleDateString()}
                          {act.startDate !== act.endDate &&
                            ` – ${new Date(act.endDate).toLocaleDateString()}`}
                        </div>
                        {act.startTime && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {act.startTime}
                            {act.endTime && ` – ${act.endTime}`}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="text-xs font-medium text-foreground">{act.provider}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-56">{act.venue}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="text-sm font-semibold text-foreground tabular-nums">
                          {act.participantStats.total}
                          {act.maxParticipants ? (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {' / '}
                              {act.maxParticipants}
                            </span>
                          ) : null}
                        </div>
                        {capacityPct !== null && (
                          <div
                            className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-surface-2"
                            role="img"
                            aria-label={`${formatPct(capacityPct)} of capacity filled`}
                            title={`${act.participantStats.total} assigned ÷ ${act.maxParticipants} capacity × 100 = ${formatPct(capacityPct)}`}
                          >
                            <div
                              className="h-full rounded-full bg-primary-400"
                              style={{ width: `${Math.min(100, capacityPct)}%` }}
                            />
                          </div>
                        )}
                        {capacityPct !== null && (
                          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatPct(capacityPct)} of capacity{capacityPct > 100 ? ' (over capacity)' : ''}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {act.participantStats.completed} completed
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top">
                        {act.complianceRequirement ? (
                          <StatusBadge
                            size="sm"
                            icon={<ShieldCheck className="h-3 w-3" />}
                            label={act.complianceRequirement.title}
                            className="bg-status-success-surface text-status-success-foreground border-status-success-border"
                          />
                        ) : (
                          <span
                            className="text-xs text-muted-foreground/70"
                            title="No compliance requirement linked"
                          >
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
                      </td>

                      <td
                        className="px-5 py-4 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="review"
                          size="sm"
                          onClick={() => handleOpenDetail(act.id)}
                          aria-label={`View details for ${act.title}`}
                          className="gap-1.5 text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Create / Edit Training Activity ── */}
      <TrainingActivityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        activityToEdit={editingActivity}
        onSuccess={fetchActivities}
      />

      {/* ── Modal: Training Details & Participant Roster ── */}
      <TrainingDetailModal
        open={Boolean(detailActivityId)}
        onOpenChange={(open) => !open && setDetailActivityId(null)}
        activityId={detailActivityId}
        onEditActivity={handleOpenEditFromDetail}
        onActivityChanged={fetchActivities}
        isFullHR={isFullHR}
      />
    </div>
  );
}
