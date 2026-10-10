import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CalendarDays, RefreshCw, Eye, CalendarPlus, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { scheduleApi, EmployeeScheduleData, ScheduleTemplate } from '@/services/api/schedule';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { OrgSelector } from '@/components/common/OrgSelector';
import { EmployeeScheduleProfileTab } from '../../Employees/components/EmployeeScheduleProfileTab';
import { getApiErrorMessage } from '@/utils/error-handler.util';

export function EmployeeSchedulesTab({ isHR }: { isHR: boolean }) {
  const [employees, setEmployees] = useState<EmployeeScheduleData[]>([]);

  // Pagination & Total
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [configFilter, setConfigFilter] = useState('');
  const [applicableDate, setApplicableDate] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [jobRoleFilter, setJobRoleFilter] = useState('');

  const [viewDetailsEmployeeId, setViewDetailsEmployeeId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const empData = await scheduleApi.getEmployeeSchedules({
        search: searchQuery,
        configurationStatus: configFilter,
        applicableDate: applicableDate,
        unitId: unitFilter,
        departmentId: departmentFilter,
        jobRoleId: jobRoleFilter,
        page,
        limit,
      });
      setEmployees(empData.data);
      setTotal(empData.total);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load schedule data.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, configFilter, applicableDate, unitFilter, departmentFilter, jobRoleFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchData();
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setConfigFilter('');
    setApplicableDate('');
    setUnitFilter('');
    setDepartmentFilter('');
    setJobRoleFilter('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  // Friendly status labels
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIGURED': return 'Configured';
      case 'PARTIALLY_CONFIGURED': return 'Needs Setup';
      case 'NO_SCHEDULE': return 'Not Set';
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'CONFIGURED':
        return 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300';
      case 'PARTIALLY_CONFIGURED':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300';
      case 'NO_SCHEDULE':
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case 'CONFIGURED': return 'View Schedule';
      case 'PARTIALLY_CONFIGURED': return 'Continue Setup';
      case 'NO_SCHEDULE': return 'Set Schedule';
      default: return 'View Schedule';
    }
  };

  // Extract a friendly shift name (no version)
  const getUsualShiftName = (emp: EmployeeScheduleData) => {
    if (emp.currentTemplate) {
      // Remove version suffix if present
      const name = emp.currentTemplate.name;
      return name || 'None';
    }
    return '—';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        {/* Row 1 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Date</label>
            <input
              type="date"
              className="h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground"
              value={applicableDate}
              onChange={(e) => { setApplicableDate(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading} title="Refresh" aria-label="Refresh">
            <RefreshCw className={isLoading ? 'animate-spin' : undefined} />
          </Button>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Schedule Status</label>
            <select
              className="h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground flex-1 min-w-[150px]"
              value={configFilter}
              onChange={(e) => { setConfigFilter(e.target.value); setPage(1); }}
            >
              <option value="">Any Status</option>
              <option value="CONFIGURED">Configured</option>
              <option value="PARTIALLY_CONFIGURED">Needs Setup</option>
              <option value="NO_SCHEDULE">Not Set</option>
            </select>
          </div>
          
          {(searchQuery || configFilter || applicableDate || unitFilter || departmentFilter || jobRoleFilter) && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-10 text-xs">
              <X className="h-4 w-4" /> Clear Filters
            </Button>
          )}
        </div>

        {/* Row 3: Org Selector */}
        <div className="w-full mt-2">
          <OrgSelector
            unitId={unitFilter}
            departmentId={departmentFilter}
            jobRoleId={jobRoleFilter}
            onChange={({ unitId, departmentId, jobRoleId }) => {
              setUnitFilter(unitId);
              setDepartmentFilter(departmentId);
              setJobRoleFilter(jobRoleId);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="p-12 text-center text-danger">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-bold">{error}</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="font-bold">No employees found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30 text-muted-foreground font-bold uppercase text-xs tracking-wider">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role / Unit</th>
                  <th className="px-4 py-3">Usual Shift(s)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Effective From</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} size="sm" />
                        <div>
                          <p className="font-bold text-foreground">{emp.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{emp.employeeNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold">{emp.jobRole}</p>
                      <p className="text-xs text-muted-foreground">{emp.unit?.name || 'No Unit'} {emp.department ? `· ${emp.department.name}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {getUsualShiftName(emp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${getStatusStyle(emp.configurationStatus)}`}>
                        {getStatusLabel(emp.configurationStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium">
                      {emp.effectiveFrom ? format(new Date(emp.effectiveFrom), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewDetailsEmployeeId(emp.id)} className="text-primary hover:text-primary/80">
                        {getActionLabel(emp.configurationStatus)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {!isLoading && !error && employees.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t-2 border-border bg-muted/20">
            <p className="text-sm text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-bold text-foreground">{Math.min(page * limit, total)}</span> of <span className="font-bold text-foreground">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-bold text-foreground px-4 py-1.5 rounded-lg bg-surface border-2 border-border">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Details Drawer */}
      <AnimatePresence>
        {viewDetailsEmployeeId && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-surface w-full max-w-4xl h-full border-l-2 border-border shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border bg-muted/30">
                <h3 className="font-bold text-lg">Work Schedule</h3>
                <button onClick={() => setViewDetailsEmployeeId(null)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-surface">
                <EmployeeScheduleProfileTab employeeId={viewDetailsEmployeeId} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
