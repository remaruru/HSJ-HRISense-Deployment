import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { TabNav } from '@/components/ui/tab-nav';
import { SearchField } from '@/components/ui/toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadError } from '@/components/shared/LoadError';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import {
  auditLogsService,
  type AuditEvent,
  type AuditOptionScope,
  type AuditOptions,
  type AuditPage,
  type AuditTabId,
} from '@/services/audit-logs.service';
import {
  ActiveFilterChips,
  AuditFilterFields,
  EMPTY_FILTERS,
  MobileFilterSheet,
  type ActiveFilter,
  type AuditFilterState,
} from './components/AuditFilters';
import { AuditEventList } from './components/AuditEventList';
import { AuditDetailDrawer } from './components/AuditDetailDrawer';

const PAGE_SIZE = 25;

/** What each tab holds, in one line under the tabs. */
const TAB_HELP: Record<AuditTabId, string> = {
  ALL: 'Changes across HRISense — records created, updated, approved, archived and more. Sign-ins and other security events are under Security & Authentication.',
  EMPLOYEES: 'Employee records, documents, supervisors and additional oversight, job roles and onboarding drafts.',
  ATTENDANCE: 'Attendance corrections and imports, schedule templates, weekly schedules and the holiday calendar.',
  LEAVE: 'Leave requests — filed, endorsed, approved, declined or cancelled — and leave balances.',
  EVALUATIONS: 'Evaluation cycles, evaluator assignments, submissions, finalization and evaluation forms.',
  COMPLIANCE: 'Training, compliance requirements and records, and medical and psychological records (their contents are never shown).',
  RECRUITMENT: 'Job openings and positions, applicant status changes, interviews and applicant messages.',
  COMMUNICATION: 'Announcements and calendar notes.',
  AWARDS: 'Awards, nominations, ballots cast (never the choices), the Hall of Fame and Yearly Achievements.',
  SYSTEM: 'One-off data-maintenance scripts, and any event HRISense cannot place in a module.',
  SECURITY: 'Sign-ins and sign-outs, failed sign-ins, password and account changes, and opening applicant documents or looking up records through the AI assistant. Kept apart from the change history.',
};

const NO_SCOPE: AuditOptionScope = { modules: [], actionTypes: [], hasFailures: false };

/**
 * Audit Logs — HR (FULL) only, here and in the API.
 *
 * Defaults to All Changes: meaningful changes, without sign-in and session
 * events, which live under Security & Authentication. Every row is a sentence
 * the server builds from the real audit entry; filters and search run on the
 * server, so pagination always covers the filtered set.
 */
export default function AuditLogsPage() {
  const { user } = useAuth();
  const isHR = user?.permissionTier === 'FULL';

  const [options, setOptions] = useState<AuditOptions>({ tabs: [], actors: [] });
  const [tab, setTab] = useState<AuditTabId>('ALL');
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const debouncedTarget = useDebounce(filters.target, 400);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<AuditPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    if (!isHR) return;
    auditLogsService
      .options()
      .then(setOptions)
      .catch(() => setOptions({ tabs: [], actors: [] }));
  }, [isHR]);

  const fetchLogs = useCallback(async () => {
    if (!isHR) return;
    const id = ++request.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await auditLogsService.list({
        page,
        limit: PAGE_SIZE,
        tab,
        module: filters.module || undefined,
        actionType: filters.actionType || undefined,
        outcome: filters.outcome || undefined,
        actorUserId: filters.actorUserId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        target: debouncedTarget.trim() || undefined,
        search: debouncedSearch.trim() || undefined,
      });
      if (id === request.current) setResult(data);
    } catch (err) {
      if (id === request.current) setError(getApiErrorMessage(err, 'The audit log could not be loaded.'));
    } finally {
      if (id === request.current) setIsLoading(false);
    }
  }, [isHR, page, tab, filters.module, filters.actionType, filters.outcome, filters.actorUserId, filters.dateFrom, filters.dateTo, debouncedTarget, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Any change to what is being looked at starts again at page 1.
  useEffect(() => {
    setPage(1);
  }, [tab, filters.module, filters.actionType, filters.outcome, filters.actorUserId, filters.dateFrom, filters.dateTo, debouncedTarget, debouncedSearch]);

  const tabOptions = options.tabs.length ? options.tabs : [{ id: 'ALL' as AuditTabId, label: 'All Changes', ...NO_SCOPE }];
  const scope = tabOptions.find((t) => t.id === tab) ?? NO_SCOPE;
  const tabLabels = useMemo(() => Object.fromEntries(options.tabs.map((t) => [t.id, t.label])), [options.tabs]);

  const changeTab = (next: AuditTabId) => {
    if (next === tab) return;
    const nextScope = tabOptions.find((t) => t.id === next) ?? NO_SCOPE;
    // A module belongs to one tab; keep the action type and result only where they still exist.
    setFilters((f) => ({
      ...f,
      module: '',
      actionType: nextScope.actionTypes.some((t) => t.id === f.actionType) ? f.actionType : '',
      outcome: nextScope.hasFailures ? f.outcome : '',
    }));
    setTab(next);
  };

  const patchFilters = (patch: Partial<AuditFilterState>) => setFilters((f) => ({ ...f, ...patch }));

  const active: ActiveFilter[] = useMemo(() => {
    const out: ActiveFilter[] = [];
    const module = scope.modules.find((m) => m.id === filters.module);
    if (module) out.push({ key: 'module', label: `Module: ${module.label}` });
    const type = scope.actionTypes.find((t) => t.id === filters.actionType);
    if (type) out.push({ key: 'actionType', label: `Action: ${type.label}` });
    const actor = options.actors.find((a) => a.id === filters.actorUserId);
    if (actor) out.push({ key: 'actorUserId', label: `By: ${actor.name}` });
    if (filters.target.trim()) out.push({ key: 'target', label: `About: ${filters.target.trim()}` });
    if (filters.outcome) out.push({ key: 'outcome', label: filters.outcome === 'FAILURE' ? 'Failed only' : 'Successful only' });
    if (filters.dateFrom) out.push({ key: 'dateFrom', label: `From ${filters.dateFrom}` });
    if (filters.dateTo) out.push({ key: 'dateTo', label: `To ${filters.dateTo}` });
    return out;
  }, [filters, scope, options.actors]);

  if (!isHR) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-lg font-bold font-heading text-foreground">Audit logs are HR-only</h2>
        <p className="mt-1 text-sm text-muted-foreground">You do not have permission to view system audit history.</p>
      </div>
    );
  }

  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const narrowed = active.length > 0 || !!debouncedSearch.trim();
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
  };
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto min-w-0 max-w-screen-2xl space-y-5 p-4 sm:p-6">
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Audit Logs"
        subtitle="Who changed what in HRISense, to which record, and when."
        actions={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </Button>
        }
      />

      <div className="min-w-0 space-y-2">
        <TabNav
          aria-label="Audit log sections"
          value={tab}
          onChange={changeTab}
          items={tabOptions.map((t) => ({ id: t.id, label: t.label, count: result?.tabCounts?.[t.id] }))}
        />
        <p className="text-sm text-muted-foreground">{TAB_HELP[tab]}</p>
      </div>

      <div className="min-w-0 space-y-3 rounded-2xl border border-border-soft bg-surface p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <SearchField
            label="Search audit events"
            value={search}
            onValueChange={setSearch}
            placeholder="Search people, actions, modules or records"
            containerClassName="sm:w-full md:max-w-xl"
            className="h-10"
          />
          <MobileFilterSheet open={sheetOpen} onOpenChange={setSheetOpen} activeCount={active.length} total={total} onClear={() => setFilters(EMPTY_FILTERS)}>
            <AuditFilterFields value={filters} onChange={patchFilters} scope={scope} tab={tab} tabLabels={tabLabels} actors={options.actors} />
          </MobileFilterSheet>
        </div>
        <AuditFilterFields
          className="hidden md:grid md:grid-cols-3 xl:grid-cols-7"
          value={filters}
          onChange={patchFilters}
          scope={scope}
          tab={tab}
          tabLabels={tabLabels}
          actors={options.actors}
        />
        <ActiveFilterChips items={active} onRemove={(key) => patchFilters({ [key]: '' })} onClearAll={clearAll} />
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {error ? (
          <LoadError message={error} onRetry={fetchLogs} className="m-4" />
        ) : isLoading && !result ? (
          <div className="p-10 text-center text-sm text-muted-foreground" role="status">Loading audit history…</div>
        ) : rows.length === 0 ? (
          narrowed ? (
            <EmptyState
              variant="filtered"
              icon={<FileText className="h-8 w-8" />}
              title="No matching events"
              description="Nothing in this section matches the search and filters. Widen the dates or clear the filters."
              action={<Button variant="outline" size="sm" onClick={clearAll}>Clear search and filters</Button>}
              className="py-12"
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No events recorded here yet"
              description="Actions in this part of HRISense will appear here as they happen."
              className="py-12"
            />
          )
        ) : (
          <AuditEventList rows={rows} onOpen={setSelected} dimmed={isLoading} />
        )}
      </div>

      {total > 0 && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {firstShown}–{lastShown} of {total} event{total === 1 ? '' : 's'}
          </p>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <AuditDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
