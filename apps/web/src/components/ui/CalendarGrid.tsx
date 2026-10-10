import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  title: string;
  subtitle?: string; // e.g. leave type
  status: 'APPROVED' | 'PENDING' | string;
  employeeId?: string;
  colorClass?: string;
  dotClass?: string;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  isLoading?: boolean;
  error?: string | null;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date, dateStr: string, events: CalendarEvent[]) => void;
  onMonthChange?: (year: number, month: number) => void;
  className?: string;
  selectedStart?: string | null;
  selectedEnd?: string | null;
  /**
   * Footer legend. Defaults to the leave legend (Approved / Pending) the Leave
   * Calendar has always shown; pass your own, or `false` for none.
   */
  legend?: React.ReactNode | false;
}

// ─── Date Utilities (date-only safe — no UTC shifting) ─────────────────────
function parseLocalDate(dateStr: string): Date {
  // "2026-08-15" → local Date at midnight
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = date.getTime();
  return d >= start.getTime() && d <= end.getTime();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MAX_VISIBLE_EVENTS = 2;

// ─── Status Styling ─────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-primary-100 text-primary-800 border border-primary-200 dark:bg-primary-900/40 dark:text-primary-200 dark:border-primary-700',
  PENDING: 'bg-status-warning-surface text-status-warning-foreground border border-status-warning-border',
};

const STATUS_DOT: Record<string, string> = {
  APPROVED: 'bg-primary-500',
  PENDING: 'bg-warning',
};

const DEFAULT_EVENT_STYLE = 'bg-muted/50 text-foreground border border-border';
const DEFAULT_EVENT_DOT = 'bg-muted-foreground';

// ─── Event Chip ─────────────────────────────────────────────────────────────
function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] leading-4 font-medium',
        'flex items-center gap-1 min-w-0 cursor-pointer',
        'hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-primary-400',
        event.colorClass || STATUS_STYLES[event.status] || DEFAULT_EVENT_STYLE
      )}
      aria-label={`${event.title} — ${event.status}`}
    >
      <span className={cn('shrink-0 h-1.5 w-1.5 rounded-full', event.dotClass || STATUS_DOT[event.status] || DEFAULT_EVENT_DOT)} aria-hidden="true" />
      <span className="truncate">{event.title}</span>
    </button>
  );
}

// ─── Main CalendarGrid Component ─────────────────────────────────────────────
export function CalendarGrid({
  events,
  isLoading = false,
  error = null,
  onEventClick,
  onDayClick,
  onMonthChange,
  className,
  selectedStart,
  selectedEnd,
  legend,
}: CalendarGridProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  // Build calendar cells
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Total cells needed (support up to 6 weeks)
  const totalCells = Math.ceil((startDayOfWeek + totalDaysInMonth) / 7) * 7;

  const navigate = useCallback((delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newMonth < 0) { newMonth = 11; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }, [month, year, onMonthChange]);

  const goToToday = useCallback(() => {
    setMonth(today.getMonth());
    setYear(today.getFullYear());
    onMonthChange?.(today.getFullYear(), today.getMonth());
  }, [today, onMonthChange]);

  // Get events for a specific calendar date
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return events.filter((ev) => {
      const start = parseLocalDate(ev.startDate);
      const end = parseLocalDate(ev.endDate);
      return isDateInRange(date, start, end);
    });
  }, [events]);

  // Render
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDayOfWeek;
    const date = new Date(year, month, 1 + dayOffset);
    const isCurrentMonth = date.getMonth() === month;
    const isToday = isSameDay(date, today);
    const dayEvents = isCurrentMonth ? getEventsForDate(date) : [];
    const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
    const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;

    const dateStr = toLocalDateStr(date);
    
    // Selection logic
    let isSelectedStart = false;
    let isSelectedEnd = false;
    let inRange = false;
    if (isCurrentMonth && selectedStart) {
      if (selectedStart === dateStr) isSelectedStart = true;
      if (selectedEnd === dateStr) isSelectedEnd = true;
      if (selectedEnd) {
        const min = selectedStart < selectedEnd ? selectedStart : selectedEnd;
        const max = selectedStart > selectedEnd ? selectedStart : selectedEnd;
        if (dateStr >= min && dateStr <= max) inRange = true;
      } else {
        if (selectedStart === dateStr) inRange = true;
      }
    }

    cells.push(
      <div
        key={i}
        className={cn(
          'min-h-[88px] p-1.5 border-b border-r border-border-soft flex flex-col',
          'transition-colors relative',
          isCurrentMonth
            ? inRange 
                ? 'bg-primary-50/70 dark:bg-primary-900/20 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30'
                : 'bg-surface cursor-pointer hover:bg-primary-50/40 dark:hover:bg-primary-900/10'
            : 'bg-muted/20 cursor-default',
          isSelectedStart && 'ring-2 ring-inset ring-primary-500',
          isSelectedEnd && 'ring-2 ring-inset ring-primary-500'
        )}
        onClick={() => {
          if (isCurrentMonth) {
            onDayClick?.(date, dateStr, dayEvents);
          }
        }}
        role={isCurrentMonth ? 'button' : undefined}
        tabIndex={isCurrentMonth ? 0 : undefined}
        aria-label={isCurrentMonth ? `${MONTH_NAMES[month]} ${date.getDate()}, ${year}` : undefined}
        aria-current={isToday ? 'date' : undefined}
        onKeyDown={(e) => {
          if (isCurrentMonth && (e.key === 'Enter' || e.key === ' ')) {
            onDayClick?.(date, dateStr, dayEvents);
          }
        }}
      >
        {/* Day number */}
        <div className="flex justify-end mb-1">
          <span
            className={cn(
              'text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full',
              isToday
                ? 'bg-primary-600 text-white font-bold'
                : isCurrentMonth
                  ? 'text-foreground'
                  : 'text-muted-foreground/40',
            )}
          >
            {date.getDate()}
          </span>
        </div>

        {/* Events */}
        <div className="flex flex-col gap-0.5 flex-1">
          {visibleEvents.map((ev) => (
            <EventChip
              key={ev.id}
              event={ev}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick?.(ev);
              }}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold px-1.5 hover:underline text-left focus:outline-none focus:underline"
              onClick={(e) => {
                e.stopPropagation();
                onDayClick?.(date, dateStr, dayEvents);
              }}
              aria-label={`Show ${hiddenCount} more events on ${date.getDate()}`}
            >
              +{hiddenCount} more
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── States ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={cn('rounded-2xl border border-border-soft bg-surface p-12 text-center', className)}>
        <p className="text-status-danger-foreground font-semibold text-sm mb-1">Unable to load the calendar.</p>
        <p className="text-muted-foreground text-xs mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-border-soft bg-surface overflow-hidden shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft bg-surface-2/60">
        <h2 className="font-bold text-foreground text-base font-heading">
          {MONTH_NAMES[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="text-xs px-2.5"
            aria-label="Go to today"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(1)}
            className="h-8 w-8 p-0"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-soft">
        {DAY_LABELS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border-soft last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[88px] border-b border-r border-border-soft p-1.5">
              <div className="flex justify-end mb-1">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 border-l border-border-soft">
          {cells}
        </div>
      )}

      {/* Legend */}
      {legend !== false && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-border-soft bg-surface-2/40">
          {legend ?? (
            <>
              <span className="text-xs font-medium text-muted-foreground">Legend:</span>
              {[
                { status: 'APPROVED', label: 'Approved' },
                { status: 'PENDING', label: 'Pending' },
              ].map(({ status, label }) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
