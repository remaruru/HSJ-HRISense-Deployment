import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, Calendar, ChevronRight, ExternalLink, Download, FileSpreadsheet, FileType, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { format } from 'date-fns';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/AuthProvider';
import { getApiErrorMessage } from '@/utils/error-handler.util';

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

const PRESETS = [
  { id: 'today',      label: 'Today' },
  { id: 'this_week',  label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Previous Month' },
  { id: 'custom',     label: 'Custom Range' },
];

const STATUS_CONFIG: Record<string, { label: string; chipClass: string }> = {
  PRESENT:   { label: 'Present',          chipClass: 'bg-success-50 text-success-700 border-success-200' },
  LATE:      { label: 'Late',             chipClass: 'bg-warning-50 text-warning-700 border-warning-200' },
  ABSENT:    { label: 'Absent',           chipClass: 'bg-danger-50 text-danger-700 border-danger-200' },
  ON_LEAVE:  { label: 'On Leave',         chipClass: 'bg-info-50 text-info-700 border-info-200' },
  HALF_DAY:  { label: 'Half Day',         chipClass: 'bg-status-accent-surface text-status-accent-foreground border-status-accent-border' },
  NO_RECORD: { label: 'No Imported Rec.', chipClass: 'bg-muted text-muted-foreground border-border' },
};

function getStatusBadge(status: string) {
  const conf = STATUS_CONFIG[status] || { label: status, chipClass: 'bg-gray-100 text-gray-800 dark:bg-surface-2 dark:text-foreground' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider', conf.chipClass)}>
      {conf.label}
    </span>
  );
}

export function EmployeeAttendanceProfileTab({ employeeId }: { employeeId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('this_month');
  const [startDate, setStartDate] = useState(() => getPresetRange('this_month').start);
  const [endDate, setEndDate] = useState(() => getPresetRange('this_month').end);

  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNavigateToTally = user?.permissionTier === 'FULL' || user?.permissionTier === 'SUPERVISOR';

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
      const exportParams: Record<string, string> = { startDate, endDate, employeeId };

      if (format === 'csv') {
        // Front-end CSV generation
        const csvContent = [
          ['Date', 'Schedule', 'Status', 'Time In', 'Time Out', 'Remarks'].join(','),
          ...records.map((r: any) => {
            const isDayOff = !r.effectiveEmployeeSchedule?.isWorkingDay;
            const schedStr = isDayOff ? 'Day Off' : (r.effectiveEmployeeSchedule?.startTime ? `${r.effectiveEmployeeSchedule.startTime}-${r.effectiveEmployeeSchedule.endTime}` : '—');
            const timeIn = r.attendanceFact?.timeIn ? new Date(r.attendanceFact.timeIn).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
            const timeOut = r.attendanceFact?.timeOut ? new Date(r.attendanceFact.timeOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
            const remarks = [r.attendanceFact?.remarks, r.organizationContext?.name].filter(Boolean).join(' | ') || '—';
            return [
              r.date,
              `"${schedStr}"`,
              r.attendanceFact?.status || 'No Imported Record',
              `"${timeIn}"`,
              `"${timeOut}"`,
              `"${remarks}"`
            ].join(',');
          })
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `My_Attendance_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("CSV export downloaded.");
        return;
      }

      // Backend Excel or PDF download
      // An empty file is rejected by the API client (EmptyDownloadError).
      const response = await api.post(`/attendance/export/${format}`, exportParams, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `My_Attendance_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report exported successfully.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Failed to export ${format.toUpperCase()} report.`));
    }
  };


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tallyRes = await api.get('/attendance/tally', {
        params: { employeeId, startDate, endDate, limit: 1 },
      });
      const tallyData = tallyRes.data.data?.[0];
      setSummary(tallyData || null);

      const listRes = await api.get('/attendance', {
        params: { employeeId, startDate, endDate, limit: 500 },
      });
      setRecords(listRes.data.data ?? []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load attendance information.'));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, startDate, endDate]);

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [fetchData, employeeId]);

  const handlePreset = (p: string) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = getPresetRange(p);
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  const fmtTime = (t: string | null | undefined) => {
    if (!t) return '—';
    try { return new Date(t).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const renderSummaryCard = (label: string, value: number | string, colorClass: string) => (
    <div className={cn('p-4 rounded-xl border flex flex-col justify-center', colorClass)}>
      <span className="text-xs font-bold uppercase mb-1 opacity-80">{label}</span>
      <span className="text-2xl font-black font-heading">{value}</span>
    </div>
  );

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6">
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Attendance Records
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Review imported attendance facts and schedule variations.</p>
        </div>
        <div className="flex items-center gap-2">
        {canNavigateToTally && (
          <Button 
            variant="review" 
            size="sm" 
            onClick={() => navigate({ to: '/attendance/tally', search: { employeeId } })}>
            <ExternalLink className="h-4 w-4" />
            View in Attendance Tally
          </Button>
        )}

        {/* Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <Button variant="outline" size="sm" className="gap-2 bg-surface" onClick={() => setShowExportMenu(!showExportMenu)}>
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
                <FileText className="h-4 w-4 text-info-600" /> CSV (Detailed Only)
              </button>
            </div>
          )}
        </div>
  
        </div>
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
              <label className="text-xs font-bold uppercase text-muted-foreground">Start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">End</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary-500" />
            </div>
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="p-12 text-center text-danger">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-bold">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          {summary ? (
            <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {renderSummaryCard('Present', summary.present, 'bg-success-50 border-success-200 text-success-800')}
              {renderSummaryCard('Late', summary.late, 'bg-warning-50 border-warning-200 text-warning-800')}
              {renderSummaryCard('Absent', summary.absent, 'bg-danger-50 border-danger-200 text-danger-800')}
              {renderSummaryCard('On Leave', summary.onLeave, 'bg-info-50 border-info-200 text-info-800')}
              {renderSummaryCard('Half Day', summary.halfDay, 'bg-status-accent-surface border-status-accent-border text-status-accent-foreground')}
              {renderSummaryCard('Imported', summary.importedRecords, 'bg-primary-50 border-primary-200 text-primary-800 dark:bg-primary-900/40 dark:border-primary-900 dark:text-primary-300')}
              {renderSummaryCard('No Record', summary.noImportedRecord, 'bg-muted border-border text-muted-foreground')}
            </motion.div>
          ) : (
             <div className="p-6 bg-surface border border-border rounded-xl text-center text-muted-foreground">
               No summary available for this period.
             </div>
          )}

          {/* Daily Records Table */}
          <motion.div variants={staggerItem} className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground font-bold uppercase text-xs">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                    <th className="px-4 py-3">Remarks / Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.length > 0 ? records.map((record) => {
                    const status = record.attendanceFact?.status || 'NO_RECORD';
                    const isDayOff = !record.effectiveEmployeeSchedule?.isWorkingDay;
                    const schedStart = record.effectiveEmployeeSchedule?.startTime;
                    const schedEnd = record.effectiveEmployeeSchedule?.endTime;
                    // Not a holiday for someone whose unit HR marked as working that day.
                    const isHoliday = record.organizationContext?.type === 'HOLIDAY' && record.organizationContext?.appliesToEmployee !== false;
                    const isSuspension = record.organizationContext?.type === 'WORK_SUSPENSION';
                    
                    return (
                      <tr key={record.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold">{format(new Date(record.date), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(record.date), 'EEEE')}</td>
                        <td className="px-4 py-3">
                          {isDayOff ? (
                            <span className="text-status-warning-foreground font-medium">Day Off</span>
                          ) : schedStart && schedEnd ? (
                            <span>Working · {schedStart}–{schedEnd}</span>
                          ) : (
                            <span className="text-muted-foreground italic">No Schedule</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(status)}
                        </td>
                        <td className="px-4 py-3 font-mono">{fmtTime(record.attendanceFact?.timeIn)}</td>
                        <td className="px-4 py-3 font-mono">{fmtTime(record.attendanceFact?.timeOut)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[250px] truncate">
                          {record.attendanceFact?.remarks ? (
                            <span className="mr-2 text-foreground">{record.attendanceFact.remarks}</span>
                          ) : null}
                          {isHoliday && <span className="text-success-600 font-bold">★ {record.organizationContext?.name} (Holiday)</span>}
                          {isSuspension && <span className="text-danger-600 font-bold">⚠ {record.organizationContext?.name} (Suspended)</span>}
                          {!record.attendanceFact?.remarks && !isHoliday && !isSuspension && '—'}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No records found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
