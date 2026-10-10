import { useState, useEffect } from 'react';
import { Search, Users, X, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { OrgSelector } from '@/components/common/OrgSelector';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from '@/components/shared/LoadError';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string };
  department?: { name: string };
  unit?: { name: string };
}

interface EmployeeSelectionPanelProps {
  mode: 'one' | 'multiple';
  isSupervisor: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>, employees: Employee[]) => void;
  onClearSelection: () => void;
}

export function EmployeeSelectionPanel({
  mode,
  isSupervisor,
  selectedIds,
  onSelectionChange,
  onClearSelection
}: EmployeeSelectionPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // HR Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [jobRoleFilter, setJobRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Selected Employee Details caching
  const [selectedEmployeesCache, setSelectedEmployeesCache] = useState<Map<string, Employee>>(new Map());

  const fetchEmployees = async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      if (isSupervisor) {
        // Supervisor simply fetches their active team once
        const res = await api.get('/employees/subordinates');
        setEmployees(res.data.data || []);
      } else {
        // HR fetches paginated global active employees
        const res = await api.get('/employees', {
          params: {
            page,
            limit,
            search: searchQuery,
            unitId: unitFilter,
            departmentId: departmentFilter,
            jobRoleId: jobRoleFilter,
            employmentState: 'ACTIVE',
            isArchived: 'false'
          }
        });
        setEmployees(res.data.data || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      setEmployees([]);
      setLoadError(getApiErrorMessage(err, 'The employee list could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search for HR mode
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchEmployees();
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch when filters or page changes (for HR mode)
  useEffect(() => {
    if (!isSupervisor) {
      fetchEmployees();
    }
  }, [page, unitFilter, departmentFilter, jobRoleFilter]);

  // Fetch once for Supervisor mode
  useEffect(() => {
    if (isSupervisor) {
      fetchEmployees();
    }
  }, [isSupervisor]);

  const toggleSelect = (emp: Employee) => {
    const next = new Set(selectedIds);
    const newCache = new Map(selectedEmployeesCache);

    if (mode === 'one') {
      next.clear();
      newCache.clear();
      if (!selectedIds.has(emp.id)) {
        next.add(emp.id);
        newCache.set(emp.id, emp);
      }
    } else {
      if (next.has(emp.id)) {
        next.delete(emp.id);
        newCache.delete(emp.id);
      } else {
        next.add(emp.id);
        newCache.set(emp.id, emp);
      }
    }
    setSelectedEmployeesCache(newCache);
    onSelectionChange(next, Array.from(newCache.values()));
  };

  const selectThisPage = () => {
    const next = new Set(selectedIds);
    const newCache = new Map(selectedEmployeesCache);
    employees.forEach(emp => {
      next.add(emp.id);
      newCache.set(emp.id, emp);
    });
    setSelectedEmployeesCache(newCache);
    onSelectionChange(next, Array.from(newCache.values()));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setUnitFilter('');
    setDepartmentFilter('');
    setJobRoleFilter('');
    setPage(1);
  };

  return (
    <div className="bg-surface border-2 border-border rounded-2xl p-4 flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {isSupervisor ? 'Team Members' : 'Employee Directory'}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-primary-100 text-primary-800 px-2 py-1 rounded dark:bg-primary-900/60 dark:text-primary-300">
              {selectedIds.size} Selected
            </span>
            {selectedIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedEmployeesCache(new Map());
                onClearSelection();
              }} className="h-7 text-xs">
                Clear Selection
              </Button>
            )}
            {mode === 'multiple' && employees.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectThisPage} className="h-7 text-xs">
                Select This Page
              </Button>
            )}
          </div>
        </div>

        {/* HR Filters */}
        {!isSupervisor && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {(searchQuery || unitFilter || departmentFilter || jobRoleFilter) && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 text-xs">
                  <X className="w-3 h-3" /> Clear
                </Button>
              )}
            </div>
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
        )}
      </div>

      {/* Employee List */}
      <div className="border-2 border-border rounded-xl bg-muted/20 p-2 max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading employees...
          </div>
        ) : loadError ? (
          <LoadError compact message={loadError} onRetry={fetchEmployees} />
        ) : employees.length === 0 ? (
          <div className="text-center p-8 text-sm text-muted-foreground">
            No employees found.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {employees.map(emp => {
              const isSelected = selectedIds.has(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleSelect(emp)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border-2",
                    isSelected 
                      ? "bg-primary-50 border-primary text-primary-900 dark:bg-primary-900/40 dark:text-primary-300" 
                      : "bg-surface border-transparent hover:border-border text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    mode === 'one' ? "rounded-full" : "rounded-sm",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <CheckIcon />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-bold truncate">
                      {emp.firstName} {emp.lastName} <span className="text-muted-foreground font-normal ml-1">#{emp.employeeNumber}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {emp.jobRole?.title || 'No Role'} • {emp.unit?.name || emp.department?.name || 'No Unit'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination (HR only) */}
      {!isSupervisor && total > limit && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="h-7 px-2"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="h-7 px-2"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
