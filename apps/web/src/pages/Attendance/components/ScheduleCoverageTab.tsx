import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, Eye, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { scheduleApi, ScheduleCoverageResult, EmployeeCoverage, DailyScheduleCoverage, ScheduleTemplate } from '@/services/api/schedule';
import { format, isSameDay, addMonths, subMonths, isAfter, isBefore, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RosterChips, RosterPanel, RosterRow, RosterSearch, RosterSection } from '@/components/shared/RosterPanel';
import { scheduleSummary } from '@/lib/attendanceDisplay';
import { getApiErrorMessage } from '@/utils/error-handler.util';

// Utilities
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12h(timeStr: string | undefined) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

export function ScheduleCoverageTab({ isHR }: { isHR: boolean }) {
  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  
  // Selection State
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Data State
  const [coverageData, setCoverageData] = useState<ScheduleCoverageResult | null>(null);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters (Backend)
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');

  // Drawers / Modals
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);
  const [rangeDetailsOpen, setRangeDetailsOpen] = useState(false);

  // 1. Resolve logical fetch range (1st to end of month based on currentMonthDate)
  const fetchRange = useMemo(() => {
    const y = currentMonthDate.getFullYear();
    const m = currentMonthDate.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // Last day
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
    };
  }, [currentMonthDate]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [covData, tempData] = await Promise.all([
        scheduleApi.getCoverage({
          startDate: fetchRange.startDate,
          endDate: fetchRange.endDate,
          search: searchQuery,
          templateId: templateFilter
        }),
        scheduleApi.getTemplates()
      ]);
      setCoverageData(covData);
      setTemplates(tempData.filter(t => t.isActive));
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load coverage data.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchRange, templateFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Aggregate daily counts for the calendar view
  const getDailyAggregates = useCallback((date: Date) => {
    if (!coverageData) return null;
    const dStr = format(date, 'yyyy-MM-dd');
    let working = 0;
    let dayOff = 0;
    let unconfigured = 0;
    let noSchedule = 0;
    let orgEvents: any[] = [];

    let hasData = false;

    coverageData.coverage.forEach(emp => {
      const dayData = emp.dailySchedules.find(d => d.date === dStr);
      if (dayData) {
        hasData = true;
        if (dayData.status === 'WORKING') working++;
        else if (dayData.status === 'DAY_OFF') dayOff++;
        else if (dayData.status === 'UNCONFIGURED') unconfigured++;
        else if (dayData.status === 'NO_SCHEDULE') noSchedule++;

        if (dayData.orgEvents && dayData.orgEvents.length > 0) {
          orgEvents = dayData.orgEvents;
        }
      }
    });

    if (!hasData) return null;
    return { working, dayOff, unconfigured, noSchedule, orgEvents, total: working + dayOff + unconfigured + noSchedule };
  }, [coverageData]);

  // Calendar Interactions
  const handleDayClick = (date: Date) => {
    // If no start, set start
    if (!selectionStart) {
      setSelectionStart(date);
      setSelectionEnd(null);
    } else if (selectionStart && !selectionEnd) {
      // If setting end
      let start = selectionStart;
      let end = date;
      if (isBefore(date, selectionStart)) {
        start = date;
        end = selectionStart;
      }
      
      const diff = differenceInDays(end, start);
      if (diff > 31) {
        toast.error('Date range cannot exceed 31 days.');
        setSelectionStart(date); // Reset to new single click
        setSelectionEnd(null);
      } else if (isSameDay(start, end)) {
        // Double clicked same day, treat as single day view
        setSelectionStart(start);
        setSelectionEnd(start);
        setDrawerDate(start);
      } else {
        setSelectionStart(start);
        setSelectionEnd(end);
        setRangeDetailsOpen(true);
      }
    } else {
      // Reset to new start
      setSelectionStart(date);
      setSelectionEnd(null);
      setRangeDetailsOpen(false);
      setDrawerDate(null);
    }
  };

  const handleOpenDrawer = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrawerDate(date);
    setSelectionStart(date);
    setSelectionEnd(date);
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setDrawerDate(null);
    setRangeDetailsOpen(false);
  };

  // Build calendar cells
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDaysInMonth = lastDayOfMonth.getDate();
  const totalCells = Math.ceil((startDayOfWeek + totalDaysInMonth) / 7) * 7;
  const today = new Date();

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDayOfWeek;
    const date = new Date(year, month, 1 + dayOffset);
    const isCurrentMonth = date.getMonth() === month;
    const isToday = isSameDay(date, today);
    
    // Range logic
    const isStart = selectionStart ? isSameDay(date, selectionStart) : false;
    const isEnd = selectionEnd ? isSameDay(date, selectionEnd) : false;
    const isHover = hoverDate ? isSameDay(date, hoverDate) : false;

    const isBuildingRange = !!(hoverDate && selectionStart && !selectionEnd && !isSameDay(hoverDate, selectionStart));
    const isHoverStart = isBuildingRange && isBefore(hoverDate!, selectionStart!) && isHover;
    const isHoverEnd = isBuildingRange && isAfter(hoverDate!, selectionStart!) && isHover;
    
    const isEffectiveStart = isStart || isHoverStart;
    const isEffectiveEnd = isEnd || isHoverEnd;
    const isEndpoint = isEffectiveStart || isEffectiveEnd;
    
    const isSingleSelection = isStart && !selectionEnd && !isBuildingRange;

    const isInRange = selectionStart && selectionEnd && isAfter(date, selectionStart) && isBefore(date, selectionEnd);
    const isInHoverRange = isBuildingRange && (
      (isAfter(date, selectionStart!) && isBefore(date, hoverDate!)) ||
      (isBefore(date, selectionStart!) && isAfter(date, hoverDate!))
    );
    
    const isSelected = isEndpoint || isInRange || isInHoverRange;

    const aggregates = isCurrentMonth ? getDailyAggregates(date) : null;

    // Background Class
    let cellBg = '';
    if (isCurrentMonth) {
      if (isSingleSelection) {
        cellBg = 'bg-primary-50 dark:bg-primary-900/30 ring-2 ring-inset ring-primary-500 z-10 cursor-pointer';
      } else if (isEndpoint) {
        cellBg = 'bg-primary-100 dark:bg-primary-900/50 z-10 cursor-pointer';
      } else if (isInRange) {
        cellBg = 'bg-primary-50 dark:bg-primary-900/20 cursor-pointer';
      } else if (isInHoverRange) {
        cellBg = 'bg-primary-50/50 dark:bg-primary-900/10 cursor-pointer';
      } else {
        cellBg = 'bg-surface hover:bg-muted/40 cursor-pointer';
      }
    } else {
      cellBg = 'bg-muted/30 opacity-50 cursor-default';
    }

    // Date Number Class
    let dateNumClass = 'text-foreground';
    if (isEndpoint || isSingleSelection) {
      dateNumClass = 'bg-primary-600 text-white shadow-sm';
    } else if (isToday) {
      dateNumClass = 'bg-primary-600 text-white';
    } else if (isSelected) {
      dateNumClass = 'text-primary-800 dark:text-primary-300 font-extrabold';
    }

    cells.push(
      <div
        key={i}
        className={cn(
          'min-h-[100px] p-2 flex flex-col border-r border-b border-border transition-colors relative',
          cellBg
        )}
        onClick={() => isCurrentMonth && handleDayClick(date)}
        onMouseEnter={() => isCurrentMonth && setHoverDate(date)}
        onMouseLeave={() => setHoverDate(null)}
      >
        <div className="flex justify-between items-start mb-1 z-10 relative pointer-events-none">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors',
              dateNumClass
            )}>
              {date.getDate()}
            </span>
            {isEffectiveStart && !isSingleSelection && <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider">Start</span>}
            {isEffectiveEnd && !isSingleSelection && <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider">End</span>}
          </div>
          {aggregates && (
            <Button 
              variant="review" 
              size="sm" 
              className="h-6 w-6 p-0 rounded-full pointer-events-auto transition-colors" 
              onClick={(e) => handleOpenDrawer(date, e)} 
              title="View Day Details">
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Aggregate Data */}
        {aggregates && (
          <div className="flex flex-col gap-1 z-10 relative mt-1 pointer-events-none">
            {aggregates.orgEvents.length > 0 && (
              <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-info-surface text-status-info-foreground truncate border border-status-info-border">
                Holiday: {aggregates.orgEvents[0].name}
              </div>
            )}
            {aggregates.working > 0 && (
              <div className="flex justify-between px-1.5 py-0.5 rounded text-[10px] font-medium bg-success-50/50 text-success-700 dark:bg-success-900/10 dark:text-success-300">
                <span>Working</span> <span className="font-bold">{aggregates.working}</span>
              </div>
            )}
            {aggregates.dayOff > 0 && (
              <div className="flex justify-between px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/20 text-muted-foreground">
                <span>Day Off</span> <span className="font-bold">{aggregates.dayOff}</span>
              </div>
            )}
            {aggregates.unconfigured > 0 && (
              <div className="flex justify-between px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-50/50 text-warning-700 dark:bg-warning-900/10 dark:text-warning-300">
                <span>Needs Setup</span> <span className="font-bold">{aggregates.unconfigured}</span>
              </div>
            )}
            {aggregates.noSchedule > 0 && (
              <div className="flex justify-between px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-50/50 text-danger-700 dark:bg-danger-900/10 dark:text-danger-300">
                <span>Not Set</span> <span className="font-bold">{aggregates.noSchedule}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Generate range summary data if valid range selected
  const rangeSummary = useMemo(() => {
    if (!selectionStart || !selectionEnd || !coverageData) return null;
    if (isSameDay(selectionStart, selectionEnd)) return null; // Handle in drawer instead

    const start = selectionStart;
    const end = selectionEnd;
    
    // Filter out coverage based on selected range across all employees
    return coverageData.coverage.map(emp => {
      let working = 0;
      let dayOff = 0;
      let unconfigured = 0;
      let noSchedule = 0;
      let templatesEncountered = new Set<string>();

      emp.dailySchedules.forEach(ds => {
        const d = new Date(ds.date);
        if ((isAfter(d, start) || isSameDay(d, start)) && (isBefore(d, end) || isSameDay(d, end))) {
          if (ds.status === 'WORKING') working++;
          else if (ds.status === 'DAY_OFF') dayOff++;
          else if (ds.status === 'UNCONFIGURED') unconfigured++;
          else noSchedule++;

          if (ds.template) {
            templatesEncountered.add(ds.template.name);
          }
        }
      });

      return {
        ...emp,
        rangeSummary: { working, dayOff, unconfigured, noSchedule, templates: Array.from(templatesEncountered) }
      };
    }).filter(emp => emp.rangeSummary.working + emp.rangeSummary.dayOff + emp.rangeSummary.unconfigured + emp.rangeSummary.noSchedule > 0);
  }, [selectionStart, selectionEnd, coverageData]);


  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 relative">
      
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-2xl border-2 border-border shadow-sm">
        
        {/* Calendar Nav */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-bold text-lg w-32 text-center text-foreground">
            {format(currentMonthDate, 'MMMM yyyy')}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonthDate(new Date())} className="text-xs font-bold">
            Today
          </Button>
        </div>

        {/* Selection Indication */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          {!selectionStart ? (
            <span className="text-sm text-muted-foreground font-medium">Click a date to select range</span>
          ) : !selectionEnd ? (
            <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-1.5 shadow-sm">
              <span className="text-sm font-bold text-primary-800 dark:text-primary-300">
                Selected: {format(selectionStart, 'MMM d, yyyy')} <span className="animate-pulse ml-2 text-primary-600/70 dark:text-primary-400/70 font-medium">(Select end date...)</span>
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary hover:bg-primary/20 rounded-full" onClick={clearSelection} title="Clear Selection">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg px-4 py-1.5 shadow-sm">
              <span className="text-sm font-bold text-primary-800 dark:text-primary-300">
                Selected: {format(selectionStart, 'MMM d, yyyy')} {isSameDay(selectionStart, selectionEnd) ? '' : `– ${format(selectionEnd, 'MMM d, yyyy')}`}
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary hover:bg-primary/20 rounded-full" onClick={clearSelection} title="Clear Selection">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground"
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
          >
            <option value="">All Shifts</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-2 py-1 text-xs">
        <div className="flex items-center gap-1.5" title="Employee is scheduled to work"><span className="h-2.5 w-2.5 rounded-sm bg-success-500" /> <span className="font-medium text-muted-foreground">Working</span></div>
        <div className="flex items-center gap-1.5" title="Intentional rest day"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground" /> <span className="font-medium text-muted-foreground">Day Off</span></div>
        <div className="flex items-center gap-1.5" title="Employee has a weekly schedule, but this day still needs to be configured"><span className="h-2.5 w-2.5 rounded-sm bg-warning-500" /> <span className="font-medium text-muted-foreground">Needs Setup</span></div>
        <div className="flex items-center gap-1.5" title="Employee does not yet have an active weekly schedule"><span className="h-2.5 w-2.5 rounded-sm bg-danger-500" /> <span className="font-medium text-muted-foreground">Not Set</span></div>
        <div className="flex items-center gap-1.5" title="Organization holiday"><span className="h-2.5 w-2.5 rounded-sm bg-slate-500" /> <span className="font-medium text-muted-foreground">Holiday</span></div>
      </div>

      {/* Main Grid */}
      <div className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        {error ? (
           <div className="p-12 text-center text-danger">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold">{error}</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 border-b-2 border-border bg-muted/30">
              {DAY_LABELS.map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-border relative">
              {isLoading && (
                <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm z-20 flex items-center justify-center">
                  <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                </div>
              )}
              {cells}
            </div>
          </div>
        )}
      </div>

      {/* Range Details Table (shown when valid range selected) */}
      <AnimatePresence>
        {rangeSummary && rangeDetailsOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm mt-4"
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-border bg-muted/20">
              <h3 className="font-bold text-foreground">Range Coverage Summary: {format(selectionStart!, 'MMM d')} → {format(selectionEnd!, 'MMM d, yyyy')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setRangeDetailsOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-x-auto p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-muted-foreground font-bold uppercase text-xs tracking-wider">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Applicable Shifts</th>
                    <th className="px-4 py-3 text-center">Working Days</th>
                    <th className="px-4 py-3 text-center">Days Off</th>
                    <th className="px-4 py-3 text-center">Needs Setup</th>
                    <th className="px-4 py-3 text-center">Not Set</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rangeSummary.map(emp => (
                    <tr key={emp.employee.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.employee.name} size="sm" />
                          <div>
                            <p className="font-bold text-foreground">{emp.employee.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{emp.employee.unit?.name || 'No Unit'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {emp.rangeSummary.templates.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {emp.rangeSummary.templates.map(t => <span key={t} className="text-xs font-semibold">{t}</span>)}
                          </div>
                        ) : <span className="text-muted-foreground">None</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-success-600">{emp.rangeSummary.working}</td>
                      <td className="px-4 py-3 text-center font-bold text-muted-foreground">{emp.rangeSummary.dayOff}</td>
                      <td className="px-4 py-3 text-center font-bold text-warning-600">{emp.rangeSummary.unconfigured > 0 ? emp.rangeSummary.unconfigured : '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-danger-600">{emp.rangeSummary.noSchedule > 0 ? emp.rangeSummary.noSchedule : '-'}</td>
                    </tr>
                  ))}
                  {rangeSummary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">No employee coverage found for this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Day Drawer */}
      <AnimatePresence>
        {drawerDate && coverageData && (
          <DayCoverageDrawer 
            date={drawerDate}
            data={coverageData}
            onClose={() => { setDrawerDate(null); clearSelection(); }}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// ─── Single Day Drawer ────────────────────────────────────────────────────────
function DayCoverageDrawer({ date, data, onClose }: { date: Date, data: ScheduleCoverageResult, onClose: () => void }) {
  const dStr = format(date, 'yyyy-MM-dd');
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Everyone with a schedule entry for this day.
  const employeesForDay = useMemo(() => {
    return data.coverage.map(emp => {
      const daily = emp.dailySchedules.find(d => d.date === dStr);
      if (daily) return { employee: emp.employee, daily };
      return null;
    }).filter(Boolean) as { employee: EmployeeCoverage['employee'], daily: DailyScheduleCoverage }[];
  }, [dStr, data]);

  const orgEvents = employeesForDay.find(e => e.daily.orgEvents.length > 0)?.daily.orgEvents || [];

  const GROUPS: Array<{ key: string; label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = [
    { key: 'WORKING', label: 'Working', tone: 'success' },
    { key: 'UNCONFIGURED', label: 'Needs setup', tone: 'warning' },
    { key: 'NO_SCHEDULE', label: 'No schedule', tone: 'danger' },
    { key: 'DAY_OFF', label: 'Day off', tone: 'neutral' },
  ];
  const groupOf = (status: string) => (GROUPS.some((g) => g.key === status) ? status : 'NO_SCHEDULE');
  const q = query.trim().toLowerCase();
  const matches = (e: { employee: EmployeeCoverage['employee'] }) =>
    !q || e.employee.name.toLowerCase().includes(q) || String(e.employee.employeeNumber ?? '').toLowerCase().includes(q);
  const byGroup = new Map<string, typeof employeesForDay>();
  for (const e of employeesForDay) {
    const g = groupOf(e.daily.status);
    byGroup.set(g, [...(byGroup.get(g) ?? []), e]);
  }
  const summaries = GROUPS.map((g) => ({ ...g, count: byGroup.get(g.key)?.length ?? 0 }));
  const visible = GROUPS.filter((g) => (active === null || active === g.key) && (byGroup.get(g.key)?.some(matches) ?? false));

  return (
    <RosterPanel
      title={format(date, 'EEEE, MMM d, yyyy')}
      subtitle={`${employeesForDay.length} employee${employeesForDay.length === 1 ? '' : 's'} with a schedule entry`}
      onClose={onClose}
      toolbar={employeesForDay.length > 0 ? (
        <>
          {orgEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-status-info-border bg-status-info-surface px-3 py-1.5 text-xs text-status-info-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              {orgEvents.map((e: any) => (
                <span key={e.id}>
                  <strong>{e.name}</strong> ({String(e.type).replace(/_/g, ' ').toLowerCase()})
                  {e.workingUnits?.length ? ` — works this day: ${e.workingUnits.join(', ')}` : ''}
                </span>
              ))}
            </div>
          )}
          <RosterChips groups={summaries} total={employeesForDay.length} active={active} onChange={setActive} />
          <RosterSearch value={query} onChange={setQuery} />
        </>
      ) : undefined}
    >
      {employeesForDay.length === 0 ? (
        <div className="text-center py-12 px-4">
          <UserX className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-bold text-foreground">No Schedule Data</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nobody matches “{query}”.</p>
      ) : (
        visible.map((g) => {
          const rows = (byGroup.get(g.key) ?? []).filter(matches).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
          return (
            <RosterSection
              key={g.key}
              label={g.label}
              tone={g.tone}
              count={rows.length}
              defaultCollapsed={g.key === 'DAY_OFF' && rows.length > 6 && visible.length > 1}
              forceOpen={active === g.key || Boolean(q)}
            >
              {rows.map(({ employee, daily }) => {
                const sched = scheduleSummary(daily);
                const unitWorks = daily.orgEvents?.some((e: any) => e.appliesToEmployee === false);
                const observes = daily.orgEvents?.some((e: any) => e.appliesToEmployee !== false);
                return (
                  <RosterRow
                    key={employee.id}
                    primary={employee.name}
                    secondary={`${employee.employeeNumber} · ${employee.unit?.name || 'No unit'}${daily.template ? ` · ${daily.template.name}` : ''}`}
                    cells={sched.times ? <span>{sched.times}</span> : undefined}
                    badge={
                      unitWorks ? (
                        <span className="rounded-full border border-status-info-border bg-status-info-surface px-2 py-0.5 text-[10px] font-bold uppercase text-status-info-foreground">Unit works this holiday</span>
                      ) : observes ? (
                        <span className="rounded-full border border-status-neutral-border bg-status-neutral-surface px-2 py-0.5 text-[10px] font-bold uppercase text-status-neutral-foreground">Observes holiday</span>
                      ) : undefined
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
