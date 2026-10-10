import { RosterChips, RosterPanel, RosterRow, RosterSearch, RosterSection } from '@/components/shared/RosterPanel';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, X, Clock, CheckCircle2, Filter, ChevronDown,
  AlertCircle, Search, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { CalendarGrid, CalendarEvent } from '@/components/ui/CalendarGrid';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { useNavigate } from '@tanstack/react-router';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';
import { LEAVE_TYPE_LABELS } from '@/lib/leaveTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const startStr = s.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const endStr = e.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

const STATUS_CONFIG: Record<string, { label: string; chipClass: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Approved', chipClass: 'bg-success-light text-success-dark border-success', icon: <CheckCircle2 className="h-3 w-3" /> },
  PENDING:  { label: 'Pending',  chipClass: 'bg-warning-light text-warning-dark border-warning',  icon: <Clock className="h-3 w-3" /> },
};

// ─── Day Drawer (events for a specific date) ─────────────────────────────────
function DayDrawer({
  date,
  events,
  isSupervisorScope,
  onClose,
}: {
  date: Date;
  events: CalendarEvent[];
  isSupervisorScope: boolean;
  onClose: () => void;
}) {
  const dateLabel = date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const GROUPS: Array<{ key: string; label: string; tone: 'success' | 'warning' }> = [
    { key: 'APPROVED', label: 'Approved', tone: 'success' },
    { key: 'PENDING', label: 'Pending', tone: 'warning' },
  ];
  const groupOf = (ev: CalendarEvent) => (ev.status === 'APPROVED' ? 'APPROVED' : 'PENDING');
  const q = query.trim().toLowerCase();
  const matches = (ev: CalendarEvent) => !q || String(ev.title ?? '').toLowerCase().includes(q);
  const summaries = GROUPS.map((g) => ({ ...g, count: events.filter((e) => groupOf(e) === g.key).length }));
  const visible = GROUPS.filter((g) => (active === null || active === g.key) && events.some((e) => groupOf(e) === g.key && matches(e)));

  return (
    <RosterPanel
      title={dateLabel}
      subtitle={`${events.length} on leave${isSupervisorScope ? ' · full details are available to HR only' : ''}`}
      onClose={onClose}
      widthClass="max-w-3xl"
      toolbar={events.length > 0 ? (
        <>
          <RosterChips groups={summaries} total={events.length} active={active} onChange={setActive} />
          {events.length > 8 && <RosterSearch value={query} onChange={setQuery} placeholder="Search name" />}
        </>
      ) : undefined}
    >
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nobody is on leave on this day.</p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nobody matches “{query}”.</p>
      ) : (
        visible.map((g) => {
          const rows = events.filter((e) => groupOf(e) === g.key && matches(e));
          return (
            <RosterSection key={g.key} label={g.label} tone={g.tone} count={rows.length} forceOpen={active === g.key || Boolean(q)}>
              {rows.map((ev) => {
                const sc = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG['PENDING'];
                return (
                  <RosterRow
                    key={ev.id}
                    primary={ev.title}
                    secondary={`${ev.subtitle ? `${LEAVE_TYPE_LABELS[ev.subtitle] ?? ev.subtitle} · ` : ''}${formatDateRange(ev.startDate, ev.endDate)}`}
                    badge={
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase', sc.chipClass)}>
                        {sc.icon}{sc.label}
                      </span>
                    }
                  />
                );
              })}
            </RosterSection>
          );
        })
      )}
    </RosterPanel>
  );
}

// ─── Main Leave Calendar Page ─────────────────────────────────────────────────
export default function LeaveCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tier = user?.permissionTier ?? 'STANDARD';
  const isFull = tier === 'FULL';
  const isSupervisor = tier === 'SUPERVISOR';

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Tabs: self / team / all
  const availableTabs = isFull
    ? [{ id: 'self', label: 'My Leave' }, { id: 'all', label: 'Organization Calendar' }]
    : isSupervisor
      ? [{ id: 'self', label: 'My Leave' }, { id: 'team', label: 'Team Leave' }]
      : [{ id: 'self', label: 'My Leave' }];

  const [activeTab, setActiveTab] = useState<'self' | 'team' | 'all'>('self');

  // Filters (HR only)
  const [showFilters, setShowFilters] = useState(false);
  const [unitFilter, setUnitFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Day drawer state
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);
  const [drawerEvents, setDrawerEvents] = useState<CalendarEvent[]>([]);

  // Upcoming leaves sidebar (next 30 days)
  const [upcomingLeaves, setUpcomingLeaves] = useState<any[]>([]);

  // Range selection state
  const [selectionStep, setSelectionStep] = useState<0 | 1 | 2>(0);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);

  // Fetch unit list for HR filters
  useEffect(() => {
    if (isFull) {
      api.get('/employees/units').then((res) => {
        setUnits(res.data.data ?? []);
      }).catch((err) => {
        toast.error(getApiErrorMessage(err, 'The unit filter options could not be loaded.'), { id: 'leave-cal-units' });
      });
    }
  }, [isFull]);

  // Fetch departments when unit changes
  useEffect(() => {
    if (isFull) {
      api.get('/departments', { params: unitFilter ? { unitId: unitFilter } : {} }).then((res) => {
        setDepartments(res.data.data ?? []);
        // Reset dependent filters
        setDepartmentFilter('');
      }).catch((err) => {
        toast.error(getApiErrorMessage(err, 'The department filter options could not be loaded.'), { id: 'leave-cal-depts' });
      });
    }
  }, [unitFilter, isFull]);

  const fetchCalendarEvents = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    setError(null);

    // Build range for the full calendar grid (including leading/trailing days)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Extend range to capture events starting before or ending after the displayed month
    const rangeStart = toLocalDateStr(new Date(year, month - 1, 25));
    const rangeEnd = toLocalDateStr(new Date(year, month + 1, 10));

    const params: Record<string, string> = {
      start: rangeStart,
      end: rangeEnd,
      scope: activeTab,
    };
    if (statusFilter) params.status = statusFilter;
    if (leaveTypeFilter) params.leaveType = leaveTypeFilter;
    if (isFull) {
      if (unitFilter) params.unitId = unitFilter;
      if (departmentFilter) params.departmentId = departmentFilter;
    }

    try {
      const res = await api.get('/leave/calendar', { params });
      const raw: any[] = res.data.data ?? [];

      const calEvents: CalendarEvent[] = raw.map((ev) => ({
        id: ev.id,
        startDate: ev.startDate.split('T')[0],
        endDate: ev.endDate.split('T')[0],
        // Employee name or self label
        title: ev.employee
          ? `${ev.employee.firstName} ${ev.employee.lastName}`
          : 'My Leave',
        subtitle: ev.leaveType, // raw type key
        status: ev.status as 'APPROVED' | 'PENDING',
        employeeId: ev.employeeId,
      }));

      setEvents(calEvents);

      // Upcoming (APPROVED, next 30 days, from full raw data)
      const today = new Date();
      const next30 = new Date(today);
      next30.setDate(next30.getDate() + 30);
      setUpcomingLeaves(
        raw
          .filter((ev) => ev.status === 'APPROVED')
          .filter((ev) => {
            const end = parseLocalDate(ev.endDate);
            return end >= today;
          })
          .slice(0, 6)
      );
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load calendar.'));
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statusFilter, leaveTypeFilter, unitFilter, departmentFilter, isFull]);

  useEffect(() => {
    fetchCalendarEvents(calYear, calMonth);
  }, [calYear, calMonth, fetchCalendarEvents]);

  const handleMonthChange = (year: number, month: number) => {
    setCalYear(year);
    setCalMonth(month);
  };

  const handleDayClick = (date: Date, dateStr: string, dayEvents: CalendarEvent[]) => {
    // Drawer logic
    if (dayEvents.length > 0) {
      setDrawerDate(date);
      setDrawerEvents(dayEvents);
    } else {
      setDrawerDate(null);
      setDrawerEvents([]);
    }

    // Range logic
    if (selectionStep === 0 || selectionStep === 2) {
      setSelectedStart(dateStr);
      setSelectedEnd(dateStr);
      setSelectionStep(1);
    } else if (selectionStep === 1) {
      const min = selectedStart! < dateStr ? selectedStart! : dateStr;
      const max = selectedStart! > dateStr ? selectedStart! : dateStr;
      setSelectedStart(min);
      setSelectedEnd(max);
      setSelectionStep(2);
    }
  };

  const isSupervisorTeamScope = activeTab === 'team' && isSupervisor;

  const title = activeTab === 'all'
    ? 'Organization Leave Calendar'
    : activeTab === 'team'
      ? 'Team Leave Calendar'
      : 'Leave Calendar';

  const subtitle = activeTab === 'all'
    ? 'Approved and pending leave requests across the organization.'
    : activeTab === 'team'
      ? 'Leave requests for employees under your supervision (read-only).'
      : 'View your approved and pending leave requests.';

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    // Assuming employeeName or similar is stored in title
    return ev.title.toLowerCase().includes(lowerQuery);
  });

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title={title}
          subtitle={subtitle}
          badgeText="Calendar"
          actions={
            <Button variant="create"
              className="font-bold"
              onClick={() => navigate({ to: '/leave/new' })}>
              <Plus className="w-4 h-4" />
              Create Leave
            </Button>
          }
        />
      </motion.div>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <motion.div variants={staggerItem} className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit border border-border">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              id={`cal-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* HR Filters */}
      {isFull && activeTab === 'all' && (
        <motion.div variants={staggerItem}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showFilters && 'rotate-180')} />
          </Button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-3 mt-3">
                  <select
                    className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="">Approved + Pending</option>
                    <option value="APPROVED">Approved Only</option>
                    <option value="PENDING">Pending Only</option>
                  </select>
                  <select
                    className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={leaveTypeFilter}
                    onChange={(e) => setLeaveTypeFilter(e.target.value)}
                    aria-label="Filter by leave type"
                  >
                    <option value="">All Types</option>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {isFull && units.length > 0 && (
                    <select
                      className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 max-w-[150px]"
                      value={unitFilter}
                      onChange={(e) => setUnitFilter(e.target.value)}
                      aria-label="Filter by unit"
                    >
                      <option value="">All Units</option>
                      {units.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  )}
                  {isFull && departments.length > 0 && (
                    <select
                      className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 max-w-[150px]"
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      aria-label="Filter by department"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Search employee..." 
                      className="h-9 pl-9 pr-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 max-w-[200px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('');
                      setLeaveTypeFilter('');
                      setUnitFilter('');
                      setSearchQuery('');
                      // departmentFilter will reset via effects
                    }}
                    className="h-9 text-xs"
                  >
                    Clear Filters
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Main Grid Layout */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
        {/* Calendar */}
        <div>
          {error ? (
            <div className="rounded-2xl border-2 border-border bg-surface p-12 text-center">
              <AlertCircle className="h-8 w-8 text-danger-400 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground mb-1">Unable to load calendar</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={() => fetchCalendarEvents(calYear, calMonth)}>
                Try Again
              </Button>
            </div>
          ) : (
            <CalendarGrid
              events={filteredEvents}
              isLoading={isLoading}
              onDayClick={handleDayClick}
              onMonthChange={handleMonthChange}
              selectedStart={selectedStart}
              selectedEnd={selectedEnd}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          
          {/* Selected Range Panel */}
          {selectedStart && (
            <div className="bg-primary-50 dark:bg-primary-900/10 rounded-2xl border-2 border-primary-200 dark:border-primary-800 shadow-sm overflow-hidden p-5 relative">
              <h3 className="font-bold text-sm text-primary-900 dark:text-primary-100 mb-3">Selected Dates</h3>
              
              <div className="bg-white dark:bg-surface rounded-xl border border-primary-200 dark:border-primary-700 p-3 mb-4 text-center">
                <p className="text-sm font-bold text-foreground">
                  {formatDateRange(selectedStart, selectedEnd!)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((parseLocalDate(selectedEnd!).getTime() - parseLocalDate(selectedStart).getTime()) / (1000 * 60 * 60 * 24)) + 1} calendar days
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="create" 
                  className="w-full font-bold"
                  onClick={() => navigate({ to: '/leave/new', search: { startDate: selectedStart, endDate: selectedEnd! } })}>
                  Create Leave
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 hover:bg-primary-100 dark:hover:text-primary-300 dark:hover:bg-primary-900/60"
                  onClick={() => { setSelectedStart(null); setSelectedEnd(null); setSelectionStep(0); }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
          
          <div className="bg-surface rounded-2xl border-2 border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b-2 border-border bg-muted/30">
              <h3 className="font-bold text-sm text-foreground">Upcoming Approved Leave</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Next 30 days</p>
            </div>
            <div className="p-4 space-y-3">
              {upcomingLeaves.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isLoading ? 'Loading...' : 'No upcoming approved leave.'}
                </p>
              ) : (
                upcomingLeaves.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 rounded-xl bg-muted/20 border border-border p-3">
                    {ev.employee && (
                      <Avatar name={`${ev.employee.firstName} ${ev.employee.lastName}`} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      {ev.employee && (
                        <p className="font-bold text-foreground text-xs truncate">
                          {ev.employee.firstName} {ev.employee.lastName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {LEAVE_TYPE_LABELS[ev.leaveType] ?? ev.leaveType}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDateRange(ev.startDate, ev.endDate)}
                      </p>
                      {/* Suppress reason for supervisor team view */}
                      {isSupervisorTeamScope && (
                        <p className="text-[10px] text-muted-foreground italic mt-0.5">HR access only for full details.</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-surface rounded-2xl border-2 border-border p-4 shadow-sm space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p>
            {[
              { status: 'APPROVED', label: 'Approved Leave', color: 'bg-primary-500' },
              { status: 'PENDING',  label: 'Pending Review', color: 'bg-warning' },
            ].map(({ status, label, color }) => (
              <div key={status} className="flex items-center gap-2.5 text-xs text-foreground">
                <span className={cn('h-3 w-3 rounded-sm shrink-0', color)} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Day Drawer */}
      <AnimatePresence>
        {drawerDate && (
          <DayDrawer
            date={drawerDate}
            events={drawerEvents}
            isSupervisorScope={isSupervisorTeamScope}
            onClose={() => { setDrawerDate(null); setDrawerEvents([]); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
