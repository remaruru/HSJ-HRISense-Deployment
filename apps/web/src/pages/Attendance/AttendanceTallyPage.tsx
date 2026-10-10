import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight,
  Filter, RefreshCw, Search, Users, X, FileWarning, Download, FileSpreadsheet, FileType, FileText,
  AlertCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { personProfilePath } from '@/lib/profileLinks';
import { api } from '@/services/api';
import { Link } from '@tanstack/react-router';
import { personName, scheduleSummary } from '@/lib/attendanceDisplay';
import { getApiErrorMessage } from '@/utils/error-handler.util';

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPresetRange(preset: string): { start: string; end: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const day = today.getDay();

  if (preset === 'today') {
    const s = toLocalDateStr(today);
    return { start: s, end: s };
  }
  if (preset === 'this_week') {
    const monday = new Date(y, m, d - (day === 0 ? 6 : day - 1));
    const sunday = new Date(y, m, d + (day === 0 ? 0 : 7 - day));
    return { start: toLocalDateStr(monday), end: toLocalDateStr(sunday) };
  }
  if (preset === 'this_month') {
    return {
      start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      end: toLocalDateStr(new Date(y, m + 1, 0)),
    };
  }
  if (preset === 'prev_month') {
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    return {
      start: `${py}-${String(pm + 1).padStart(2, '0')}-01`,
      end: toLocalDateStr(new Date(py, pm + 1, 0)),
    };
  }
  return { start: toLocalDateStr(today), end: toLocalDateStr(today) };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TallyRow {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    unit?: { name: string };
    department?: { name: string };
    jobRole?: { title: string };
  };
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  importedRecords: number;
  distinctImportedDays: number;
  noImportedRecord: number;
  totalCalendarDays: number;
}

interface DrillRecord {
  id: string;
  date: string;
  attendanceFact?: {
    status: string;
    timeIn: string | null;
    timeOut: string | null;
    remarks: string | null;
  };
  effectiveEmployeeSchedule?: {
    isWorkingDay: boolean;
    type: string;
    startTime?: string;
    endTime?: string;
  };
  organizationContext?: { name?: string; type?: string };
}

const STATUS_CONFIG: Record<string, { label: string; chipClass: string }> = {
  PRESENT:   { label: 'Present',          chipClass: 'bg-success-50 text-success-700 border-success-200' },
  LATE:      { label: 'Late',             chipClass: 'bg-warning-50 text-warning-700 border-warning-200' },
  ABSENT:    { label: 'Absent',           chipClass: 'bg-danger-50 text-danger-700 border-danger-200' },
  ON_LEAVE:  { label: 'On Leave',         chipClass: 'bg-info-50 text-info-700 border-info-200' },
  HALF_DAY:  { label: 'Half Day',         chipClass: 'bg-status-accent-surface text-status-accent-foreground border-status-accent-border' },
  NO_RECORD: { label: 'No Imported Rec.', chipClass: 'bg-muted text-muted-foreground border-border' },
};

const PRESETS = [
  { id: 'today',      label: 'Today' },
  { id: 'this_week',  label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: 'custom',     label: 'Custom Range' },
];

const LIMIT = 50;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AttendanceTallyPage() {
  const { user } = useAuth();
  const isFull = user?.permissionTier === 'FULL';

  const [preset, setPreset] = useState('this_month');
  const [startDate, setStartDate] = useState(() => getPresetRange('this_month').start);
  const [endDate, setEndDate] = useState(() => getPresetRange('this_month').end);

  const [search, setSearch] = useState('');
  // One request after typing pauses, not one per keystroke.
  const debouncedSearch = useDebounce(search, 350);
  const [unitFilter, setUnitFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [units, setUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [rows, setRows] = useState<TallyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalCalendarDays, setTotalCalendarDays] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    setShowExportMenu(false);
    try {
      toast.info(`Generating ${format.toUpperCase()} report...`);
      const exportParams: Record<string, string> = { startDate, endDate };
      if (search.trim()) exportParams.search = search.trim();
      if (isFull && unitFilter) exportParams.unitId = unitFilter;
      if (isFull && departmentFilter) exportParams.departmentId = departmentFilter;

      if (format === 'csv') {
        // Front-end CSV generation
        const res = await api.get('/attendance/tally', { params: { ...exportParams, page: 1, limit: 5000 } });
        const allRows = res.data.data || [];
        const csvContent = [
          ['Emp No', 'Last Name', 'First Name', 'Unit', 'Job Role', 'Present', 'Late', 'Absent', 'On Leave', 'Half Day', 'Imported', 'No Record'].join(','),
          ...allRows.map((r: any) => [
            r.employee.employeeNumber,
            `"${r.employee.lastName}"`,
            `"${r.employee.firstName}"`,
            `"${r.employee.unit?.name || ''}"`,
            `"${r.employee.jobRole?.title || ''}"`,
            r.present, r.late, r.absent, r.onLeave, r.halfDay, r.importedRecords, r.noImportedRecord
          ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Attendance_Summary_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("CSV export downloaded.");
        return;
      }

      // Backend Excel or PDF download
      const response = await api.post(`/attendance/export/${format}`, exportParams, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Attendance_Report_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report exported successfully.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Failed to export ${format.toUpperCase()} report.`));
    }
  };


  const [drillEmployee, setDrillEmployee] = useState<TallyRow | null>(null);
  const [drillRecords, setDrillRecords] = useState<DrillRecord[]>([]);
  const [isDrillLoading, setIsDrillLoading] = useState(false);

  useEffect(() => {
    if (isFull) {
      api.get('/employees/units').then(r => setUnits(r.data.data ?? [])).catch((err) => toast.error(getApiErrorMessage(err, 'The unit filter options could not be loaded.'), { id: 'tally-units' }));
    }
  }, [isFull]);

  useEffect(() => {
    if (isFull && unitFilter) {
      // Departments come from the Departments API. This previously called
      // /employees/departments, which is not a registered route, so the dropdown
      // silently stayed empty.
      api.get('/departments', { params: { unitId: unitFilter } })
        .then(r => setDepartments(r.data.data ?? []))
        .catch(() => setDepartments([]));
    } else {
      setDepartments([]);
      setDepartmentFilter('');
    }
  }, [isFull, unitFilter]);

  const fetchTally = useCallback(async (p = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        startDate,
        endDate,
        page: String(p),
        limit: String(LIMIT),
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (isFull && unitFilter) params.unitId = unitFilter;
      if (isFull && departmentFilter) params.departmentId = departmentFilter;

      const res = await api.get('/attendance/tally', { params });
      setRows(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
      setTotalCalendarDays(res.data.totalCalendarDays ?? 0);
      setPage(p);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load attendance tally.'));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, debouncedSearch, unitFilter, departmentFilter, isFull]);

  useEffect(() => { fetchTally(1); }, [fetchTally]);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = getPresetRange(p);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  const openDrill = async (row: TallyRow) => {
    setDrillEmployee(row);
    setIsDrillLoading(true);
    setDrillRecords([]);
    try {
      const res = await api.get('/attendance', {
        params: { employeeId: row.employee.id, startDate, endDate, limit: 500 },
      });
      setDrillRecords(res.data.data ?? []);
    } catch { setDrillRecords([]); }
    finally { setIsDrillLoading(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const fmt = (t: string | null | undefined) => {
    if (!t) return '—';
    try { return new Date(t).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <motion.div variants={staggerItem}>
        <div className="relative">

      {/* Export Dropdown */}
      <div className="absolute right-6 top-6" ref={exportMenuRef}>
        <Button variant="outline" className="gap-2 bg-surface" onClick={() => setShowExportMenu(!showExportMenu)}>
          <Download className="h-4 w-4" /> Export
        </Button>
        {showExportMenu && (
          <div className="absolute right-0 mt-2 w-56 bg-surface rounded-xl shadow-xl border border-border z-20 p-2 space-y-1">
            <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg text-foreground transition-colors text-left">
              <FileSpreadsheet className="h-4 w-4 text-success-600" /> Excel (Summary & Details)
            </button>
            <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg text-foreground transition-colors text-left">
              <FileType className="h-4 w-4 text-danger-600" /> PDF (Summary Only)
            </button>
            <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-lg text-foreground transition-colors text-left">
              <FileText className="h-4 w-4 text-info-600" /> CSV (Summary Only)
            </button>
          </div>
        )}
      </div>
  
</div>
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Attendance Tally"
          subtitle="Per-employee attendance summary for a selected period."
          badgeText="Tally"
        />
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-start gap-3 rounded-xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700 px-5 py-3">
        <Info className="h-4 w-4 text-info-600 dark:text-info-400 shrink-0 mt-0.5" />
        <p className="text-sm text-info-800 dark:text-info-200">
          <strong>No Imported Record</strong> means no attendance data was received from the attendance system for that date.
          It does <strong>not</strong> indicate Absent. Open Details to see schedule context and organization events per date.
        </p>
      </motion.div>

      {/* Period presets */}
      <motion.div variants={staggerItem} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => handlePreset(p.id)}
              className={cn('px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
                preset === p.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-surface border-border text-muted-foreground hover:border-primary-400 hover:text-foreground'
              )}>
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/20 rounded-xl border-2 border-border">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-foreground">From</label>
              <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-foreground">To</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground" />
            </div>
            <Button size="sm" onClick={() => fetchTally(1)} className="h-9">Apply</Button>
          </div>
        )}

        {totalCalendarDays > 0 && (
          <p className="text-xs text-muted-foreground font-medium">
            Period: <strong>{startDate}</strong> → <strong>{endDate}</strong> ({totalCalendarDays} calendar day{totalCalendarDays !== 1 ? 's' : ''})
          </p>
        )}
      </motion.div>

      {/* Search + Filters */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search name or employee ID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-9 rounded-lg border-2 border-border bg-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {isFull && (
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showFilters && 'rotate-180')} />
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => fetchTally(1)} disabled={isLoading} className="gap-1.5 text-xs">
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{total} employee{total !== 1 ? 's' : ''}</span>
      </motion.div>

      <AnimatePresence>
        {showFilters && isFull && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap gap-3 p-4 bg-muted/20 border-2 border-border rounded-xl">
              <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground">
                <option value="">All Units</option>
                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {departments.length > 0 && (
                <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground">
                  <option value="">All Departments</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setUnitFilter(''); setDepartmentFilter(''); }} className="text-xs">
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div variants={staggerItem} className="bg-surface rounded-2xl border-2 border-border shadow-sm overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-danger-500 mx-auto mb-3" />
            <p className="font-bold text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchTally(1)} className="mt-4">Retry</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[860px]">
              <thead>
                <tr className="border-b-2 border-border bg-muted/60 text-muted-foreground font-bold">
                  <th className="px-4 py-3 text-xs uppercase tracking-wider min-w-[200px]">Employee</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider">Unit / Dept</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center text-success-700">Present</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center text-warning-700">Late</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center text-danger-700">Absent</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center text-info-700">On Leave</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center text-status-accent-foreground">½ Day</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center">Imported</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider text-center">No Record</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-muted/40 animate-pulse" style={{ width: j === 0 ? '140px' : '36px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="font-bold text-foreground text-sm">No employees found</p>
                    <p className="text-xs text-muted-foreground mt-1">Adjust the filters or date range.</p>
                  </td></tr>
                ) : rows.map(row => (
                  <tr key={row.employee.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.employee.firstName} size="sm" />
                        <div>
                          <p className="font-semibold text-foreground text-sm leading-tight">
                            {personName(row.employee)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{row.employee.employeeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-foreground">{row.employee.unit?.name ?? '—'}</p>
                      <p className="text-[11px] text-muted-foreground">{row.employee.department?.name ?? ''}</p>
                    </td>
                    <td className="px-3 py-3 text-center"><SCell v={row.present} c="success" /></td>
                    <td className="px-3 py-3 text-center"><SCell v={row.late} c="warning" /></td>
                    <td className="px-3 py-3 text-center"><SCell v={row.absent} c="danger" /></td>
                    <td className="px-3 py-3 text-center"><SCell v={row.onLeave} c="info" /></td>
                    <td className="px-3 py-3 text-center"><SCell v={row.halfDay} c="purple" /></td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold text-foreground">{row.importedRecords}</span>
                      <p className="text-[10px] text-muted-foreground">{row.distinctImportedDays}d</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-bold', row.noImportedRecord > 0 ? 'text-muted-foreground' : 'text-success-600')}>
                        {row.noImportedRecord}
                      </span>
                      <p className="text-[10px] text-muted-foreground">/ {row.totalCalendarDays}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Button variant="review" size="sm" onClick={() => openDrill(row)} className="text-xs h-7 px-2.5">Details</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t-2 border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages} — {total} total</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchTally(page - 1)} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchTally(page + 1)} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {drillEmployee && (
          <DrillDrawer
            row={drillEmployee}
            records={drillRecords}
            isLoading={isDrillLoading}
            startDate={startDate}
            endDate={endDate}
            onClose={() => setDrillEmployee(null)}
            fmt={fmt}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SCell({ v, c }: { v: number; c: string }) {
  const cm: Record<string, string> = {
    success: 'text-success-700 bg-success-50', warning: 'text-warning-700 bg-warning-50',
    danger: 'text-danger-700 bg-danger-50', info: 'text-info-700 bg-info-50', purple: 'text-status-accent-foreground bg-status-accent-surface',
  };
  if (v === 0) return <span className="text-sm text-muted-foreground/40">—</span>;
  return <span className={cn('inline-block rounded-lg px-2 py-0.5 text-sm font-bold', cm[c])}>{v}</span>;
}

function DrillDrawer({ row, records, isLoading, startDate, endDate, onClose, fmt }: {
  row: TallyRow; records: DrillRecord[]; isLoading: boolean;
  startDate: string; endDate: string; onClose: () => void;
  fmt: (t: string | null | undefined) => string;
}) {
  const emp = row.employee;
  const { user } = useAuth();
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        className="relative z-10 bg-surface w-full max-w-4xl h-full shadow-2xl border-l-2 border-border flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={emp.firstName} size="sm" />
            <div>
              <p className="font-bold text-foreground text-sm">{personName(emp)}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{emp.employeeNumber} · {emp.unit?.name ?? '—'}</span>
                <Link 
                  // @ts-ignore
                  to={personProfilePath(user, emp.id)} 
                  className="text-primary-600 hover:underline font-semibold ml-1 dark:text-primary-300"
                >
                  View Profile
                </Link>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border bg-muted/10 shrink-0">
          <p className="text-[11px] text-muted-foreground mb-2">{startDate} → {endDate} ({row.totalCalendarDays} days)</p>
          <div className="flex flex-wrap gap-4">
            {[
              ['Present', row.present, 'text-success-700'],
              ['Late', row.late, 'text-warning-700'],
              ['Absent', row.absent, 'text-danger-700'],
              ['On Leave', row.onLeave, 'text-info-700'],
              ['Half Day', row.halfDay, 'text-status-accent-foreground'],
              ['No Record', row.noImportedRecord, 'text-muted-foreground'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="text-center">
                <p className={cn('text-lg font-black', color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* One compact row per day — a month fits on screen instead of 31 cards. */}
        {!isLoading && records.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-2.5 shrink-0" role="group" aria-label="Show only">
            {[null, ...Object.keys(STATUS_CONFIG)].map((key) => {
              const count = key === null ? records.length : records.filter((r) => (r.attendanceFact?.status ?? 'NO_RECORD') === key).length;
              if (key !== null && count === 0) return null;
              const label = key === null ? 'All' : STATUS_CONFIG[key].label;
              return (
                <button
                  key={key ?? 'ALL'}
                  type="button"
                  aria-pressed={dayFilter === key}
                  onClick={() => setDayFilter(dayFilter === key ? null : key)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    key === null ? 'bg-surface-2 text-foreground border-border' : STATUS_CONFIG[key].chipClass,
                    dayFilter === key && 'ring-2 ring-primary-500/50'
                  )}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-muted/40 animate-pulse border border-border" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FileWarning className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-bold text-foreground text-sm">No records found</p>
              <p className="text-xs text-muted-foreground mt-1">No attendance data was imported for this period.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Attendance day by day</caption>
              <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Schedule</th>
                  <th scope="col" className="px-3 py-2 font-semibold">In</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Out</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records
                  .filter((r) => dayFilter === null || (r.attendanceFact?.status ?? 'NO_RECORD') === dayFilter)
                  .map((r) => {
                    const status = r.attendanceFact?.status ?? 'NO_RECORD';
                    const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.NO_RECORD;
                    const dateLabel = new Date(r.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
                    const sched = scheduleSummary(r.effectiveEmployeeSchedule);
                    const notes = [r.organizationContext?.name, r.attendanceFact?.remarks].filter(Boolean).join(' · ');
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-semibold text-foreground whitespace-nowrap">{dateLabel}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sched.times || sched.label}</td>
                        <td className="px-3 py-2 tabular-nums text-foreground whitespace-nowrap">{fmt(r.attendanceFact?.timeIn)}</td>
                        <td className="px-3 py-2 tabular-nums text-foreground whitespace-nowrap">{fmt(r.attendanceFact?.timeOut)}</td>
                        <td className="px-3 py-2">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide whitespace-nowrap', sc.chipClass)}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{notes || '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
}
