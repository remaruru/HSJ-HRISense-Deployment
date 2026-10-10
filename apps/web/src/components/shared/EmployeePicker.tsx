import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, User, CheckCircle2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PickerEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  unit?: { id?: string; name: string } | null;
  department?: { id?: string; name: string } | null;
  jobRole?: { id?: string; title: string } | null;
}

interface EmployeePickerProps {
  employees: PickerEmployee[];
  selectedEmployee: PickerEmployee | null;
  onSelect: (employee: PickerEmployee | null) => void;
  label?: string;
  required?: boolean;
  accentColor?: 'teal' | 'purple' | 'blue';
  placeholder?: string;
  disabled?: boolean;
  variant?: 'dropdown' | 'workspace';
  className?: string;
}

export function EmployeePicker({
  employees,
  selectedEmployee,
  onSelect,
  label = 'Employee',
  required = true,
  accentColor = 'teal',
  placeholder = 'Search employee by name, ID, or job role...',
  disabled = false,
  variant = 'dropdown',
  className,
}: EmployeePickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return employees.slice(0, variant === 'workspace' ? 40 : 10);
    }
    return employees
      .filter((e) => {
        const full = `${e.firstName} ${e.lastName}`.toLowerCase();
        const num = (e.employeeNumber || '').toLowerCase();
        const role = (e.jobRole?.title || '').toLowerCase();
        const unit = (e.unit?.name || '').toLowerCase();
        const dept = (e.department?.name || '').toLowerCase();
        return (
          full.includes(q) ||
          num.includes(q) ||
          role.includes(q) ||
          unit.includes(q) ||
          dept.includes(q)
        );
      })
      .slice(0, variant === 'workspace' ? 50 : 8);
  }, [employees, search, variant]);

  const colorStyles = {
    teal: {
      card: 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/80',
      avatar: 'bg-teal-700 text-white',
      hover: 'hover:bg-teal-50 dark:hover:bg-teal-950/60',
      tag: 'text-teal-800 dark:text-teal-200 bg-teal-100/80 dark:bg-teal-900/60',
      badge: 'border-teal-300 text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 dark:border-primary-900',
      button: 'text-teal-700 dark:text-teal-300 hover:text-teal-800 border-teal-300 hover:bg-teal-100/60 dark:hover:text-primary-300 dark:border-primary-900 dark:hover:bg-primary-900/60',
    },
    purple: {
      card: 'bg-status-accent-surface/70 dark:bg-status-accent-foreground/40 border-status-accent-border dark:border-status-accent-foreground/80',
      avatar: 'bg-accent text-white',
      hover: 'hover:bg-status-accent-surface dark:hover:bg-status-accent-foreground/60',
      tag: 'text-status-accent-foreground dark:text-status-accent-border bg-status-accent-surface/80 dark:bg-status-accent-foreground/60',
      badge: 'border-status-accent-border text-status-accent-foreground dark:text-status-accent-border bg-status-accent-surface dark:bg-status-accent-foreground/50 dark:border-status-accent-border',
      button: 'text-status-accent-foreground dark:text-status-accent-border hover:text-status-accent-foreground border-status-accent-border hover:bg-status-accent-surface/60 dark:hover:text-status-accent-foreground dark:border-status-accent-border dark:hover:bg-status-accent-surface/60',
    },
    blue: {
      card: 'bg-status-neutral-surface/70 dark:bg-status-neutral-surface/40 border-status-neutral-border dark:border-status-neutral-border/80',
      avatar: 'bg-slate-600 text-white',
      hover: 'hover:bg-status-neutral-surface dark:hover:bg-status-neutral-surface/60',
      tag: 'text-status-neutral-foreground dark:text-status-neutral-foreground bg-status-neutral-surface/80 dark:bg-status-neutral-surface/60',
      badge: 'border-status-neutral-border text-status-neutral-foreground dark:text-status-neutral-foreground bg-status-neutral-surface dark:bg-status-neutral-surface/50 dark:border-status-info-border',
      button: 'text-status-neutral-foreground dark:text-status-neutral-foreground hover:text-status-neutral-foreground border-status-neutral-border hover:bg-status-neutral-surface/60 dark:hover:text-status-info-foreground dark:border-status-info-border dark:hover:bg-status-info-surface/60',
    },
  }[accentColor];

  // ── WORKSPACE (EXPANDED) VARIANT FOR STEP 1 ──
  if (variant === 'workspace') {
    if (selectedEmployee) {
      return (
        <div className={cn("space-y-4", className)}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Selected Employee
            </span>
            <span className="text-sm text-status-success-foreground dark:text-status-success-border font-semibold flex items-center gap-1.5 bg-status-success-surface dark:bg-status-success-foreground/40 px-2.5 py-1 rounded-lg border border-status-success-border dark:border-status-success-foreground">
              <CheckCircle2 className="w-4 h-4 text-success dark:text-success" /> Confirmed
            </span>
          </div>

          <div
            className={cn(
              'p-5 sm:p-6 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm',
              colorStyles.card
            )}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl font-bold text-lg flex items-center justify-center shrink-0 shadow-sm',
                  colorStyles.avatar
                )}
              >
                {selectedEmployee.firstName?.[0]}
                {selectedEmployee.lastName?.[0]}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </h3>
                  <span className="font-mono text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200">
                    #{selectedEmployee.employeeNumber}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 font-medium">
                  {selectedEmployee.jobRole?.title || 'Staff Member'} · {selectedEmployee.unit?.name || selectedEmployee.department?.name || 'Hospicio de San Jose'}
                </p>
              </div>
            </div>

            {!disabled && (
              <Button
                type="button"
                variant="update"
                size="sm"
                onClick={() => {
                  onSelect(null);
                  setSearch('');
                }}
                className="text-sm h-10 px-4 shrink-0">
                <RefreshCw className="w-4 h-4" />
                Change Employee
              </Button>
            )}
          </div>

          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Employee confirmed. Click <strong className="text-slate-900 dark:text-slate-100 font-bold">Next</strong> to proceed to the next step.
          </p>
        </div>
      );
    }

    return (
      <div className={cn("space-y-3.5", className)}>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={placeholder}
            value={search}
            disabled={disabled}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 pr-10 text-sm sm:text-base font-medium h-12 bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 shadow-xs placeholder:text-slate-400 placeholder:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600 dark:hover:text-secondary-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Inline Scrollable Employee List */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 shadow-xs">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
              <User className="w-7 h-7 opacity-40 text-muted-foreground" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">No matching employees found</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Try searching by first name, last name, or employee ID number</p>
            </div>
          ) : (
            filtered.map((emp) => (
              <div
                key={emp.id}
                onClick={() => onSelect(emp)}
                className={cn(
                  'p-3.5 cursor-pointer flex items-center justify-between text-sm transition-colors',
                  colorStyles.hover
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 shadow-xs',
                      colorStyles.avatar
                    )}
                  >
                    {emp.firstName?.[0]}
                    {emp.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 block truncate">
                      {emp.firstName} {emp.lastName}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 block truncate">
                      {emp.jobRole?.title || 'Staff'} · {emp.unit?.name || emp.department?.name || 'General'}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200 shrink-0 font-semibold">
                  #{emp.employeeNumber}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── DROPDOWN VARIANT FOR EMBEDDED / COMPACT USE ──
  return (
    <div className={cn("space-y-1.5 relative", className)} ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {label} {required && <span className="text-danger font-bold">*</span>}
        </label>
      </div>

      {selectedEmployee ? (
        <div
          className={cn(
            'flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all',
            colorStyles.card
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-xs',
                colorStyles.avatar
              )}
            >
              {selectedEmployee.firstName?.[0]}
              {selectedEmployee.lastName?.[0]}
            </div>
            <div className="min-w-0 flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedEmployee.firstName} {selectedEmployee.lastName}
              </span>
              <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
                ({selectedEmployee.jobRole?.title || 'Staff'} ·{' '}
                {selectedEmployee.unit?.name || selectedEmployee.department?.name || 'General'})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="font-mono text-xs bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
              #{selectedEmployee.employeeNumber}
            </span>
            {!disabled && (
              <Button
                type="button"
                variant="update"
                size="sm"
                onClick={() => {
                  onSelect(null);
                  setSearch('');
                  setIsOpen(true);
                }}
                className="h-7 px-2.5 text-xs font-semibold">
                Change
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={placeholder}
              value={search}
              disabled={disabled}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
              }}
              className="pl-10 pr-9 text-sm font-medium h-11 bg-slate-50/80 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 placeholder:text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600 dark:hover:text-secondary-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isOpen && !disabled && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-2xl">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm font-medium text-slate-500 flex flex-col items-center gap-1.5 dark:text-muted-foreground">
                  <User className="w-5 h-5 opacity-40" />
                  <span>No employees match your search</span>
                </div>
              ) : (
                filtered.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => {
                      onSelect(emp);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'p-3 cursor-pointer flex items-center justify-between text-sm transition-colors',
                      colorStyles.hover
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate text-sm">
                        {emp.firstName} {emp.lastName}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block truncate">
                        {emp.jobRole?.title || 'Staff'} ·{' '}
                        {emp.unit?.name || emp.department?.name || 'General'}
                      </span>
                    </div>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 shrink-0 font-semibold border border-slate-200 dark:border-slate-700">
                      #{emp.employeeNumber}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
