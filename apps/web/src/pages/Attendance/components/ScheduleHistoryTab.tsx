import { personName } from '@/lib/attendanceDisplay';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileClock, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { scheduleApi, ScheduleHistoryLog } from '@/services/api/schedule';
import { format } from 'date-fns';
import { getApiErrorMessage } from '@/utils/error-handler.util';

export function ScheduleHistoryTab({ isHR }: { isHR: boolean }) {
  const [history, setHistory] = useState<ScheduleHistoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await scheduleApi.getHistory();
      setHistory(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load history.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatAction = (action: string) => {
    switch (action) {
      case 'TEMPLATE_ASSIGNED': return 'Schedule Assigned (Legacy)';
      case 'TEMPLATE_REVISED': return 'Schedule Updated (Legacy)';
      case 'TEMPLATE_CREATED': return 'Shift Created';
      case 'TEMPLATE_DEACTIVATED': return 'Shift Deactivated';
      case 'SCHEDULE_CONFIGURED': return 'Weekly Schedule Set';
      case 'SCHEDULE_UPDATED': return 'Weekly Schedule Updated';
      case 'SHIFT_CREATED': return 'Shift Created';
      case 'SHIFT_UPDATED': return 'Shift Updated';
      case 'SHIFT_DEACTIVATED': return 'Shift Deactivated';
      default: return action.replace(/_/g, ' ');
    }
  };

  const filteredHistory = history.filter(log => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      const empMatch = log.employee ? `${log.employee.firstName} ${log.employee.lastName}`.toLowerCase().includes(sq) : false;
      const actMatch = log.user?.employee ? `${log.user.employee.firstName} ${log.user.employee.lastName}`.toLowerCase().includes(sq) : false;
      if (!empMatch && !actMatch) return false;
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(history.map(h => h.action))).sort();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-2xl border-2 border-border shadow-sm">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search employee or actor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-64 h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary"
          />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{formatAction(a)}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold">{error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileClock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="font-bold">No history logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30 text-muted-foreground font-bold uppercase text-xs tracking-wider">
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Employee Affected</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details / Remarks</th>
                  <th className="px-4 py-3">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistory.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {log.employee ? personName(log.employee) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-muted rounded text-xs font-bold uppercase">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground max-w-sm whitespace-normal leading-relaxed">
                        {log.remarks ? log.remarks : 'Schedule updated.'}
                        {log.newValue?.effectiveDate && (
                          <span className="block mt-1 font-semibold text-foreground">
                            Effective: {format(new Date(log.newValue.effectiveDate), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={log.user?.employee ? `${log.user.employee.firstName} ${log.user.employee.lastName}` : log.user?.email || 'System'} size="sm" />
                        <div>
                          <p className="font-bold text-foreground text-xs">
                            {log.user?.employee ? `${log.user.employee.firstName} ${log.user.employee.lastName}` : log.user?.email || 'System'}
                          </p>
                          {log.user?.employee?.jobRole && (
                            <p className="text-[10px] text-muted-foreground">{log.user.employee.jobRole.title}</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
