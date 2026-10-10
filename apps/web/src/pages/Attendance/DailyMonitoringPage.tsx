import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Calendar as CalendarIcon, CheckCircle2, XCircle, Minus, X,
  AlertCircle, FileSpreadsheet, CalendarDays, Upload, Users, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { StatCard } from '@/components/ui/stat-card';
import { TabNav, type TabNavItem } from '@/components/ui/tab-nav';
import { Toolbar } from '@/components/ui/toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import type { StatCardTone } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { CalendarGrid, CalendarEvent } from '@/components/ui/CalendarGrid';
import { FLAG_LABELS as ATTENDANCE_FLAG_LABELS, AttendanceImportService, type ImportBatch } from '@/services/attendance-import.service';
import { AttendanceImportPanel } from './AttendanceImportPage';
import { RosterChips, RosterPanel, RosterRow, RosterSearch, RosterSection } from '@/components/shared/RosterPanel';
import { personName, scheduleSummary } from '@/lib/attendanceDisplay';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';

/**
 * Daily Monitoring.
 *
 * The attendance the timekeeping export produced, day by day - and, for HR, the
 * import that produces it, on a tab of this same page. The two used to be
 * separate screens with a dead "Import Attendance Excel" button on this one,
 * which meant the obvious place to import was the one place you could not.
 *
 * The page is built from the shared kit (PageHeader, TabNav, StatCard, Toolbar,
 * EmptyState) and the semantic status tones rather than hand-picked colours, so
 * it reads as part of the same system as the rest of the modules.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** `2026-09-01T00:00:00Z` or `2026-09-01` → `Sep 1, 2026`. */
function shortDate(value: string): string {
  const d = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime())
    ? value.slice(0, 10)
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Status presentation ──────────────────────────────────────────────────────
/**
 * One tone per status, taken from the shared scale. Previously each status wrote
 * its own `bg-success-100 … dark:bg-success-900/40` string, which is how this
 * page ended up with greens and blues that appear nowhere else in HRISense.
 */
const STATUS_TONE: Record<string, StatCardTone> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  LATE: 'warning',
  ON_LEAVE: 'info',
  HALF_DAY: 'accent',
  HOLIDAY: 'info',
  REST_DAY: 'neutral',
  SUSPENDED: 'danger',
  NO_RECORD: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  ON_LEAVE: 'On Leave',
  HALF_DAY: 'Half Day',
  HOLIDAY: 'Holiday',
  REST_DAY: 'Rest Day',
  SUSPENDED: 'Suspended',
  NO_RECORD: 'No imported record',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PRESENT: <CheckCircle2 className="h-3 w-3" />,
  ABSENT: <XCircle className="h-3 w-3" />,
  LATE: <Clock className="h-3 w-3" />,
  ON_LEAVE: <Minus className="h-3 w-3" />,
  HALF_DAY: <Minus className="h-3 w-3" />,
  HOLIDAY: <CalendarIcon className="h-3 w-3" />,
  REST_DAY: <Minus className="h-3 w-3" />,
  SUSPENDED: <AlertCircle className="h-3 w-3" />,
  NO_RECORD: <Minus className="h-3 w-3" />,
};

/** Short codes on the calendar chips, where space is tight. */
const STATUS_CODE: Record<string, string> = {
  PRESENT: 'P', LATE: 'L', ABSENT: 'A', ON_LEAVE: 'LV',
  HALF_DAY: 'HD', HOLIDAY: 'HOL', REST_DAY: 'RD', SUSPENDED: 'SUS',
};

const chipFor = (status: string) => STATUS_TONE_CHIP[STATUS_TONE[status] ?? 'neutral'];
/** The calendar wants a solid dot, which the chip classes do not carry. */
const DOT_FOR: Record<string, string> = {
  PRESENT: 'bg-status-success-foreground',
  ABSENT: 'bg-status-danger-foreground',
  LATE: 'bg-status-warning-foreground',
  ON_LEAVE: 'bg-status-info-foreground',
  HALF_DAY: 'bg-status-accent-foreground',
  HOLIDAY: 'bg-status-info-foreground',
  REST_DAY: 'bg-status-neutral-foreground',
  SUSPENDED: 'bg-status-danger-foreground',
  NO_RECORD: 'bg-status-neutral-foreground',
};

const AGGREGATED_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HALF_DAY', 'HOLIDAY', 'REST_DAY', 'SUSPENDED'] as const;

const SELECT_CLASS =
  'h-9 px-3 rounded-xl border border-input bg-surface text-sm text-foreground min-w-[9rem]';

type View = 'monitoring' | 'import' | 'self' | 'team';

// ─── Component ────────────────────────────────────────────────────────────────
export default function DailyMonitoringPage() {
  const { user } = useAuth();
  const tier = user?.permissionTier ?? 'STANDARD';
  const isFull = tier === 'FULL';
  const isSupervisor = tier === 'SUPERVISOR';

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  /**
   * HR gets Calendar and Import on one page. A supervisor gets their own
   * attendance and their team's. Everyone else has a single view and no tabs.
   */
  const tabs: TabNavItem<View>[] = isFull
    ? [
        { id: 'monitoring', label: 'Calendar', icon: <CalendarDays className="h-4 w-4" /> },
        { id: 'import', label: 'Import', icon: <Upload className="h-4 w-4" /> },
      ]
    : isSupervisor
      ? [
          { id: 'self', label: 'My Attendance', icon: <User className="h-4 w-4" /> },
          { id: 'team', label: 'Team Attendance', icon: <Users className="h-4 w-4" /> },
        ]
      : [];

  const [view, setView] = useState<View>(isFull ? 'monitoring' : 'self');

  // Filters (HR only)
  const [unitFilter, setUnitFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scheduleTemplateFilter, setScheduleTemplateFilter] = useState('');
  const [recordAvailFilter, setRecordAvailFilter] = useState(''); // '' | 'with_record' | 'no_record'
  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<{ id: string; name: string }[]>([]);

  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCal, setIsLoadingCal] = useState(false);
  const [errorCal, setErrorCal] = useState<string | null>(null);

  // Day drawer
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);
  const [dayRecords, setDayRecords] = useState<any[]>([]);
  const [isLoadingDay, setIsLoadingDay] = useState(false);

  /**
   * The most recent import, so this page can say where its data came from. With
   * nothing imported the calendar is simply empty, and an empty calendar with no
   * explanation reads as a broken page rather than an unstarted one.
   */
  const [lastImport, setLastImport] = useState<ImportBatch | null>(null);

  const [summary, setSummary] = useState({
    present: 0, late: 0, absent: 0, onLeave: 0,
    halfDay: 0, holiday: 0, restDay: 0, suspended: 0, noRecord: 0,
    title: 'Today',
  });

  const loadLastImport = useCallback(() => {
    if (!isFull) return;
    AttendanceImportService.list(1, 1)
      .then((res) => setLastImport(res.rows?.[0] ?? null))
      // Only the "last imported" hint depends on this; the page works without
      // it, so a failure is logged rather than interrupting HR with a toast.
      .catch((err) => console.warn('[Daily Monitoring] Last import could not be loaded:', getApiErrorMessage(err)));
  }, [isFull]);

  useEffect(() => {
    if (!isFull) return;
    api.get('/employees/units').then((res) => setUnits(res.data.data ?? [])).catch((err) => toast.error(getApiErrorMessage(err, 'The unit filter options could not be loaded.'), { id: 'daily-units' }));
    api.get('/schedules/templates').then((res) => {
      const templates = (res.data.data ?? []).filter((t: any) => !t.isArchived);
      setScheduleTemplates(templates.map((t: any) => ({ id: t.id, name: t.name })));
    }).catch((err) => toast.error(getApiErrorMessage(err, 'The schedule template filter could not be loaded.'), { id: 'daily-templates' }));
    loadLastImport();
  }, [isFull, loadLastImport]);

  useEffect(() => {
    if (!isFull) return;
    api.get('/departments', { params: unitFilter ? { unitId: unitFilter } : {} }).then((res) => {
      setDepartments(res.data.data ?? []);
      setDepartmentFilter('');
      setEmployeeFilter('');
    }).catch((err) => toast.error(getApiErrorMessage(err, 'The department filter options could not be loaded.'), { id: 'daily-depts' }));
  }, [unitFilter, isFull]);

  useEffect(() => {
    if (!isFull) return;
    api.get('/employees', {
      params: {
        limit: '500',
        ...(unitFilter && { unitId: unitFilter }),
        ...(departmentFilter && { departmentId: departmentFilter }),
      },
    }).then((res) => {
      setEmployees(res.data.data ?? []);
      setEmployeeFilter('');
    }).catch((err) => toast.error(getApiErrorMessage(err, 'The employee filter options could not be loaded.'), { id: 'daily-employees' }));
  }, [unitFilter, departmentFilter, isFull]);

  /** HR sees everyone; a supervisor sees whichever tab they are on. */
  const scope = isFull ? 'all' : isSupervisor && view === 'team' ? 'team' : 'self';

  const queryParams = useCallback(() => {
    const params: Record<string, string> = { scope };
    if (statusFilter) params.status = statusFilter;
    if (scheduleTemplateFilter) params.scheduleTemplateId = scheduleTemplateFilter;
    if (recordAvailFilter) params.recordAvailability = recordAvailFilter;
    if (isFull) {
      if (unitFilter) params.unitId = unitFilter;
      if (departmentFilter) params.departmentId = departmentFilter;
      if (employeeFilter) params.employeeId = employeeFilter;
    }
    return params;
  }, [scope, statusFilter, scheduleTemplateFilter, recordAvailFilter, isFull, unitFilter, departmentFilter, employeeFilter]);

  const fetchCalendar = useCallback(async (year: number, month: number) => {
    setIsLoadingCal(true);
    setErrorCal(null);

    const params = {
      ...queryParams(),
      start: toLocalDateStr(new Date(year, month - 1, 25)),
      end: toLocalDateStr(new Date(year, month + 1, 10)),
    };

    try {
      const res = await api.get('/attendance/calendar', { params });
      const raw: any[] = res.data.data ?? [];
      const aggregated = isFull || (isSupervisor && view === 'team');
      const events: CalendarEvent[] = [];

      raw.forEach((agg) => {
        const dateStr = agg.date;

        if (aggregated) {
          for (const status of AGGREGATED_STATUSES) {
            if (!(agg[status] > 0)) continue;

            // A holiday is worth naming; the rest are counts.
            let title = `${STATUS_CODE[status]} ${agg[status]}`;
            if (status === 'HOLIDAY') {
              const first = agg.organizationEvents?.[0]?.name;
              const more = agg.organizationEvents?.length > 1 ? ` (+${agg.organizationEvents.length - 1})` : '';
              if (first) title = `Holiday · ${first}${more}`;
            }

            events.push({
              id: `${dateStr}-${status}`,
              startDate: dateStr,
              endDate: dateStr,
              title,
              status,
              colorClass: chipFor(status),
              dotClass: DOT_FOR[status],
            });
          }
        } else {
          const single = AGGREGATED_STATUSES.find((s) => agg[s] > 0);
          if (single) {
            events.push({
              id: dateStr,
              startDate: dateStr,
              endDate: dateStr,
              title: STATUS_LABEL[single],
              status: single,
              colorClass: chipFor(single),
              dotClass: DOT_FOR[single],
            });
          }
        }
      });

      setCalEvents(events);

      const todayAgg = raw.find((r) => r.date === toLocalDateStr(new Date()));
      setSummary({
        title: 'Today',
        present: todayAgg?.PRESENT || 0,
        late: todayAgg?.LATE || 0,
        absent: todayAgg?.ABSENT || 0,
        onLeave: todayAgg?.ON_LEAVE || 0,
        halfDay: todayAgg?.HALF_DAY || 0,
        holiday: todayAgg?.HOLIDAY || 0,
        restDay: todayAgg?.REST_DAY || 0,
        suspended: todayAgg?.SUSPENDED || 0,
        noRecord: 0,
      });
    } catch (err: any) {
      setErrorCal(getApiErrorMessage(err, 'The attendance calendar could not be loaded.'));
    } finally {
      setIsLoadingCal(false);
    }
  }, [queryParams, isFull, isSupervisor, view]);

  useEffect(() => {
    if (view === 'import') return; // nothing on the calendar tab to refresh
    fetchCalendar(calYear, calMonth);
  }, [calYear, calMonth, fetchCalendar, view]);

  const fetchDayRecords = async (date: Date) => {
    setIsLoadingDay(true);
    setDrawerDate(date);
    const dateStr = toLocalDateStr(date);
    const label = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    setSummary((prev) => ({ ...prev, title: label }));

    try {
      const res = await api.get('/attendance', {
        params: { ...queryParams(), startDate: dateStr, endDate: dateStr, limit: '500' },
      });
      const records = res.data.data ?? [];
      setDayRecords(records);

      const countBy = (status: string) =>
        records.filter((r: any) => r.attendanceFact?.status === status).length;

      setSummary({
        title: label,
        present: countBy('PRESENT'),
        late: countBy('LATE'),
        absent: countBy('ABSENT'),
        onLeave: countBy('ON_LEAVE'),
        halfDay: countBy('HALF_DAY'),
        // A unit HR marked as working that day is on its normal schedule.
        holiday: records.filter((r: any) =>
          r.organizationContext?.appliesToEmployee !== false &&
          (r.organizationContext?.type === 'HOLIDAY' || r.organizationContext?.type === 'SPECIAL_NON_WORKING')).length,
        restDay: records.filter((r: any) =>
          r.effectiveEmployeeSchedule?.isWorkingDay === false &&
          r.effectiveEmployeeSchedule?.type !== 'UNCONFIGURED').length,
        suspended: records.filter((r: any) => r.organizationContext?.appliesToEmployee !== false && r.organizationContext?.type === 'SUSPENSION').length,
        noRecord: records.filter((r: any) => !r.attendanceFact || r.attendanceFact.status === 'NO_RECORD').length,
      });
    } catch {
      setDayRecords([]);
    } finally {
      setIsLoadingDay(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter(''); setUnitFilter(''); setDepartmentFilter('');
    setEmployeeFilter(''); setScheduleTemplateFilter(''); setRecordAvailFilter('');
  };
  const hasFilters = !!(statusFilter || unitFilter || departmentFilter || employeeFilter || scheduleTemplateFilter || recordAvailFilter);

  const title = isFull ? 'Daily Monitoring' : isSupervisor ? 'Attendance Monitoring' : 'My Attendance';
  const subtitle = isFull
    ? 'The attendance recorded from the timekeeping export, day by day — and the import that produces it.'
    : isSupervisor
      ? 'Your attendance, and the attendance of the employees you supervise.'
      : 'Your attendance records.';

  const showSummary = isFull || (isSupervisor && view === 'team');
  const otherStatuses = [
    { label: 'Half day', value: summary.halfDay, status: 'HALF_DAY' },
    { label: 'Holiday', value: summary.holiday, status: 'HOLIDAY' },
    { label: 'Rest day', value: summary.restDay, status: 'REST_DAY' },
    { label: 'Suspended', value: summary.suspended, status: 'SUSPENDED' },
    { label: 'No imported record', value: summary.noRecord, status: 'NO_RECORD' },
  ].filter((s) => s.value > 0);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<Clock className="h-5 w-5" />}
          title={title}
          subtitle={subtitle}
          badgeText="Attendance"
          actions={<HelpLink slug="monitor-daily-attendance" />}
        />
      </motion.div>

      {tabs.length > 0 && (
        <motion.div variants={staggerItem}>
          <TabNav
            items={tabs}
            value={view}
            onChange={(id) => { setView(id); setDrawerDate(null); }}
            aria-label="Attendance views"
          />
        </motion.div>
      )}

      {/* ── Import lives here now, rather than on a page of its own ───────── */}
      {view === 'import' ? (
        <motion.div variants={staggerItem}>
          <AttendanceImportPanel embedded />
        </motion.div>
      ) : (
        <>
          {/*
            Where this page's data came from. It replaced a fixed sentence saying
            attendance "is imported", which never said whether anything actually
            had been - so an empty calendar gave no clue whether the page was
            broken or simply unused.
          */}
          {isFull && (
            <motion.div variants={staggerItem}>
              {lastImport ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border-soft bg-surface p-4 shadow-card">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm text-foreground">
                      <span className="font-semibold">Last import</span> · {lastImport.originalFilename}
                    </span>
                  </span>

                  {lastImport.detectedPeriodStart && lastImport.detectedPeriodEnd && (
                    <span className="text-xs text-muted-foreground">
                      {shortDate(lastImport.detectedPeriodStart)} – {shortDate(lastImport.detectedPeriodEnd)}
                    </span>
                  )}

                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_TONE_CHIP.success)}>
                    {lastImport.countApplied} day{lastImport.countApplied === 1 ? '' : 's'} recorded
                  </span>

                  {lastImport.countUnknownEmployee > 0 && (
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_TONE_CHIP.warning)}>
                      {lastImport.countUnknownEmployee} row{lastImport.countUnknownEmployee === 1 ? '' : 's'} unmatched
                    </span>
                  )}

                  <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={() => setView('import')}>
                    Open import
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-soft bg-surface p-4 shadow-card">
                  <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Nothing has been imported yet.</span>{' '}
                    This calendar fills in once an attendance export has been uploaded and confirmed.
                  </p>
                  <Button variant="outline" size="sm" className="ml-auto h-8 text-xs" onClick={() => setView('import')}>
                    <Upload className="h-3.5 w-3.5" /> Import an export
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {isFull && (
            <motion.div variants={staggerItem}>
              <Toolbar className="sm:flex-wrap">
                <select className={SELECT_CLASS} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} aria-label="Unit">
                  <option value="">All units</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                {departments.length > 0 && (
                  <select className={SELECT_CLASS} value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Department">
                    <option value="">All departments</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}

                {employees.length > 0 && (
                  <select className={SELECT_CLASS} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} aria-label="Employee">
                    <option value="">All employees</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{personName(e)}</option>)}
                  </select>
                )}

                {scheduleTemplates.length > 0 && (
                  <select className={SELECT_CLASS} value={scheduleTemplateFilter} onChange={(e) => setScheduleTemplateFilter(e.target.value)} aria-label="Work schedule">
                    <option value="">All work schedules</option>
                    {scheduleTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}

                <select className={SELECT_CLASS} value={recordAvailFilter} onChange={(e) => setRecordAvailFilter(e.target.value)} aria-label="Import status">
                  <option value="">Imported or not</option>
                  <option value="with_record">With imported record</option>
                  <option value="no_record">No imported record</option>
                </select>

                <select className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Attendance status">
                  <option value="">All statuses</option>
                  {AGGREGATED_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>

                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </Toolbar>
            </motion.div>
          )}

          {showSummary && (
            <motion.div variants={staggerItem} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Attendance summary</h2>
                <span className="rounded-full border border-border-soft bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {summary.title}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard tone="success" icon={STATUS_ICON.PRESENT} label="Present" value={summary.present} loading={isLoadingCal} />
                <StatCard tone="warning" icon={STATUS_ICON.LATE} label="Late" value={summary.late} loading={isLoadingCal} />
                <StatCard tone="danger" icon={STATUS_ICON.ABSENT} label="Absent" value={summary.absent} loading={isLoadingCal} />
                <StatCard tone="info" icon={STATUS_ICON.ON_LEAVE} label="On leave" value={summary.onLeave} loading={isLoadingCal} />
              </div>

              {otherStatuses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-surface p-4 shadow-card">
                  <span className="mr-1 text-xs font-semibold text-muted-foreground">Also on this day</span>
                  {otherStatuses.map((s) => (
                    <span key={s.status} className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', chipFor(s.status))}>
                      {s.label} · {s.value}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          <motion.div variants={staggerItem} className="relative">
            <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-card sm:p-5">
              <CalendarGrid
                events={calEvents}
                isLoading={isLoadingCal}
                error={errorCal}
                onMonthChange={(year, month) => { setCalYear(year); setCalMonth(month); setDrawerDate(null); }}
                onDayClick={fetchDayRecords}
                className="w-full"
              />
            </div>

            {isSupervisor && view === 'team' && !isLoadingCal && calEvents.length === 0 && (
              <div className="mt-4">
                <EmptyState
                  variant="onboarding"
                  icon={<Users className="h-6 w-6" />}
                  title="Nothing to show for your team this month"
                  description="Either no attendance has been imported for this period, or nobody is currently assigned under your supervision."
                />
              </div>
            )}

            <AnimatePresence>
              {drawerDate && (
                <DayDrawer
                  date={drawerDate}
                  records={dayRecords}
                  isLoading={isLoadingDay}
                  onClose={() => setDrawerDate(null)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ─── Day panel ────────────────────────────────────────────────────────────────
/**
 * Everyone on one day, grouped by what HR needs to see first. A day without an
 * imported record is never an absence: it is split into "expected to work" (the
 * one worth checking), a scheduled rest day, a holiday, or no schedule set up.
 */
type DayGroup =
  | 'ABSENT' | 'LATE' | 'EXPECTED_NO_RECORD' | 'HALF_DAY' | 'PRESENT' | 'ON_LEAVE'
  | 'HOLIDAY' | 'SUSPENDED' | 'NO_SCHEDULE' | 'REST_DAY';

const DAY_GROUPS: Array<{ key: DayGroup; label: string; tone: StatCardTone; hint?: string }> = [
  { key: 'ABSENT', label: 'Absent', tone: 'danger', hint: 'Recorded as absent in the import' },
  { key: 'LATE', label: 'Late', tone: 'warning' },
  { key: 'EXPECTED_NO_RECORD', label: 'Expected to work · no record', tone: 'warning', hint: 'Scheduled to work, nothing imported — not an absence' },
  { key: 'HALF_DAY', label: 'Half day', tone: 'accent' },
  { key: 'PRESENT', label: 'Present', tone: 'success' },
  { key: 'ON_LEAVE', label: 'On leave', tone: 'info' },
  { key: 'HOLIDAY', label: 'Holiday', tone: 'info' },
  { key: 'SUSPENDED', label: 'Suspended', tone: 'danger' },
  { key: 'NO_SCHEDULE', label: 'No schedule · no record', tone: 'neutral', hint: 'No schedule set up for this day' },
  { key: 'REST_DAY', label: 'Rest day', tone: 'neutral' },
];

function dayGroupOf(r: any): DayGroup {
  const status: string | undefined = r.attendanceFact?.status;
  if (status && status !== 'NO_RECORD' && DAY_GROUPS.some((g) => g.key === status)) return status as DayGroup;
  const org = r.organizationContext;
  if (org && org.appliesToEmployee !== false) {
    if (org.type === 'SUSPENSION') return 'SUSPENDED';
    if (['HOLIDAY', 'SPECIAL_NON_WORKING', 'ORGANIZATION_NON_WORKING'].includes(org.type)) return 'HOLIDAY';
  }
  const kind = scheduleSummary(r.effectiveEmployeeSchedule).kind;
  if (kind === 'WORKING') return 'EXPECTED_NO_RECORD';
  if (kind === 'DAY_OFF') return 'REST_DAY';
  return 'NO_SCHEDULE';
}

function DayDrawer({
  date, records, isLoading, onClose,
}: {
  date: Date; records: any[]; isLoading: boolean; onClose: () => void;
}) {
  const dateLabel = date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<DayGroup, any[]>();
    for (const r of records) {
      const g = dayGroupOf(r);
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    for (const list of map.values()) list.sort((a, b) => personName(a.employee).localeCompare(personName(b.employee)));
    return map;
  }, [records]);

  const q = query.trim().toLowerCase();
  const matches = (r: any) =>
    !q || personName(r.employee).toLowerCase().includes(q) || String(r.employee?.employeeNumber ?? '').toLowerCase().includes(q);
  const summaries = DAY_GROUPS.map((g) => ({ ...g, count: grouped.get(g.key)?.length ?? 0 }));
  const visible = DAY_GROUPS.filter((g) => (active === null || active === g.key) && (grouped.get(g.key)?.some(matches) ?? false));
  const withRecord = records.filter((r) => r.attendanceFact && r.attendanceFact.status !== 'NO_RECORD').length;

  return (
    <RosterPanel
      title={dateLabel}
      subtitle={`${records.length} employee${records.length === 1 ? '' : 's'} · ${withRecord} with an imported record`}
      onClose={onClose}
      toolbar={!isLoading && records.length > 0 ? (
        <>
          <RosterChips groups={summaries} total={records.length} active={active} onChange={setActive} />
          <RosterSearch value={query} onChange={setQuery} />
        </>
      ) : undefined}
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border border-border-soft bg-surface-2/60" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          variant="onboarding"
          icon={<CalendarDays className="h-6 w-6" />}
          title="No records for this day"
          description="Nothing matches this date with the filters you have set."
        />
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nobody matches “{query}”.</p>
      ) : (
        visible.map((g) => {
          const rows = (grouped.get(g.key) ?? []).filter(matches);
          // Long, low-information groups start folded so the rest fit on screen.
          const fold = (g.key === 'REST_DAY' || g.key === 'NO_SCHEDULE') && rows.length > 6 && visible.length > 1;
          return (
            <RosterSection
              key={g.key}
              label={g.label}
              tone={g.tone}
              count={rows.length}
              hint={g.hint}
              defaultCollapsed={fold}
              forceOpen={active === g.key || Boolean(q)}
            >
              {rows.map((r) => <DayRecordRow key={r.id} record={r} />)}
            </RosterSection>
          );
        })
      )}
    </RosterPanel>
  );
}

function DayRecordRow({ record: r }: { record: any }) {
  const status = r.attendanceFact?.status || 'NO_RECORD';
  const sched = scheduleSummary(r.effectiveEmployeeSchedule);
  const sessions: Array<{ in: string | null; out: string | null }> = r.attendanceFact?.sessions ?? [];
  const flags: string[] = r.attendanceFact?.reviewFlags ?? [];
  const org = r.organizationContext;
  const hasDetail =
    sessions.length > 0 || flags.length > 0 || Boolean(r.attendanceFact?.sourceHours) ||
    Boolean(r.attendanceFact?.remarks) || Boolean(org?.name);

  return (
    <RosterRow
      primary={personName(r.employee)}
      secondary={`${r.employee?.employeeNumber || '—'} · ${r.employee?.unit?.name || 'No unit'} · ${sched.label}${sched.times ? ` ${sched.times}` : ''}`}
      cells={r.attendanceFact && status !== 'NO_RECORD' ? (
        <>
          <span><span className="text-muted-foreground">In </span>{formatTime(r.attendanceFact?.timeIn)}</span>
          <span><span className="text-muted-foreground">Out </span>{formatTime(r.attendanceFact?.timeOut)}</span>
        </>
      ) : undefined}
      badge={
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', chipFor(status))}>
          {STATUS_ICON[status]}{STATUS_LABEL[status]}
          {flags.length > 0 && <span className="normal-case"> · {flags.length} flag{flags.length === 1 ? '' : 's'}</span>}
        </span>
      }
      detail={hasDetail ? (
        <div className="space-y-2">
          {org?.name && (
            <p className="text-foreground">
              <CalendarIcon className="mr-1 inline h-3 w-3" />
              <span className="font-semibold">{org.name}</span>
              <span className="text-muted-foreground">
                {org.appliesToEmployee === false ? " · this employee's unit is expected to work today" : ' · organisation calendar'}
              </span>
            </p>
          )}
          {r.attendanceFact?.remarks && (
            <p className="text-foreground"><span className="text-muted-foreground">Remarks: </span>{r.attendanceFact.remarks}</p>
          )}
          {/* Time in / out are only the first and last punch; every session is here. */}
          {sessions.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">
                Recorded punches{sessions.length > 1 ? ` · ${sessions.length} sessions` : ''}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {sessions.map((sess, i) => (
                  <li key={i} className="rounded-lg border border-border-soft bg-surface-2 px-2 py-0.5 font-mono text-foreground">
                    {sess.in ?? '—'} → {sess.out ?? <span className="font-semibold text-status-warning-foreground">not closed</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.attendanceFact?.sourceHours && (
            <p className="tabular-nums text-muted-foreground">
              Source hours — worked {r.attendanceFact.sourceHours.worked ?? 0} · OT {r.attendanceFact.sourceHours.overtime ?? 0} · UT {r.attendanceFact.sourceHours.undertime ?? 0}
            </p>
          )}
          {flags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {flags.map((flag) => (
                <li key={flag} className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE_CHIP.warning)}>
                  {ATTENDANCE_FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ').toLowerCase()}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : undefined}
    />
  );
}
