import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, User, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { useAuth } from '@/hooks/useAuth';
import { leaveApi } from '@/services/api/leave';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EmployeeSelectionPanel } from './components/EmployeeSelectionPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from '@/components/shared/LoadError';
import { api } from '@/services/api';
import { employmentDuration, formatEmploymentDate } from '@/lib/employment';
import {
  HOSPICIO_LEAVE_GROUPS, LEAVE_TYPE_LABELS, NO_CREDIT_LEAVE_TYPES, daysText, leaveCalendarDays,
} from '@/lib/leaveTypes';

// Date safety: parse "YYYY-MM-DD" → local midnight (no UTC shift)
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function NewLeaveRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isHR = user?.permissionTier === 'FULL';
  const isSupervisor = user?.permissionTier === 'SUPERVISOR';
  const isStandard = user?.permissionTier === 'STANDARD';

  const hasEmployee = !!user?.employee?.id;
  const employeeName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : '';
  const employeeNumber = user?.employee?.employeeNumber ?? '';

  const searchParams = useSearch({ strict: false }) as any;
  const initialStartDate = typeof searchParams.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.startDate) 
    ? searchParams.startDate : '';
  let initialEndDate = typeof searchParams.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.endDate) 
    ? searchParams.endDate : '';
  
  if (initialStartDate && initialEndDate && initialEndDate < initialStartDate) {
    initialEndDate = initialStartDate; // normalize safely
  }

  // Form State
  const [requestFor, setRequestFor] = useState<'self' | 'one' | 'multiple' | 'all'>('self');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<any[]>([]);
  
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [reason, setReason] = useState('');
  // Hospicio form: where the employee can be reached, and on what number.
  const [addressDuringLeave, setAddressDuringLeave] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  // The employee's own record — the form's Name / Position / Date Employed /
  // Unit-Dept come from here and are never typed.
  const [me, setMe] = useState<any | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);
  // Balances are shown for guidance; the server checks the real balance on submit.
  const [balancesError, setBalancesError] = useState<string | null>(null);
  
  // Modals & Batch results
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [batchResult, setBatchResult] = useState<{ created: any[], failed: any[], summary: any } | null>(null);

  // Total Number of Leave Applied — computed, never typed (inclusive calendar
  // days, the rule the server applies).
  const calculatedDays = leaveCalendarDays(startDate, endDate);

  // The signed-in employee's record, for the information block.
  useEffect(() => {
    if (!hasEmployee) return;
    api.get('/employees/me')
      .then((res) => {
        const record = res.data?.data ?? null;
        setMe(record);
        // Prefilled with the mobile on record; the employee may give another.
        setContactNumber((current) => current || record?.mobilePhone || '');
      })
      .catch((err) => setMeError(getApiErrorMessage(err, 'Your employee details could not be loaded.')));
  }, [hasEmployee]);

  // Fetch leave balances for the context employee
  useEffect(() => {
    setBalancesError(null);
    const balancesFailed = (err: unknown) => {
      setBalances([]);
      setBalancesError(
        getApiErrorMessage(err, 'Leave balances could not be loaded.') +
          ' You can still submit — the balance is checked when the request is filed.'
      );
    };
    if (requestFor === 'self' && hasEmployee) {
      leaveApi.getBalances().then((res) => {
        setBalances(res.data ?? []);
      }).catch(balancesFailed);
    } else if (requestFor === 'one' && selectedEmployees.size === 1) {
      const targetId = Array.from(selectedEmployees)[0];
      leaveApi.getBalances(targetId).then((res) => {
        setBalances(res.data ?? []);
      }).catch(balancesFailed);
    } else {
      setBalances([]); // Don't show confusing aggregate balances for multiple/all
    }
  }, [requestFor, selectedEmployees.size, hasEmployee]);

  const selectedBalance = balances.find((b) => b.leaveType === leaveType);

  const executeSubmission = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (requestFor === 'self') {
        await leaveApi.create({
          leaveType, startDate, endDate, reason: reason.trim(),
          addressDuringLeave: addressDuringLeave.trim() || undefined,
          contactNumber: contactNumber.trim() || undefined,
        });
        setSuccess(true);
      } else {
        const payload: any = { leaveType, startDate, endDate, reason: reason.trim() };
        if (requestFor === 'all') {
          payload.targetMode = 'all';
        } else {
          payload.targetMode = 'employees';
          payload.targetEmployeeIds = Array.from(selectedEmployees);
        }
        
        const res = await leaveApi.createBatch(payload);
        
        if (res.status === 201) {
          setSuccess(true); // Full success
        } else if (res.status === 207) {
          setBatchResult(res.data); // Partial success
        } else if (res.status === 400 && res.data?.failed) {
          setBatchResult(res.data); // All failed from batch
        } else {
          setError('Failed to submit leave request.');
        }
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to submit leave request. Please try again.'));
    } finally {
      setIsSubmitting(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEmployee) return;
    
    if (requestFor === 'one' || requestFor === 'multiple') {
      if (selectedEmployees.size === 0) {
        setError('Please select at least one employee.');
        return;
      }
    }

    if (!leaveType || !startDate || !endDate || !reason.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (parseLocalDate(endDate) < parseLocalDate(startDate)) {
      setError('End date must be on or after start date.');
      return;
    }

    if (requestFor === 'all' || requestFor === 'multiple') {
      setIsConfirmModalOpen(true);
    } else {
      executeSubmission();
    }
  };

  // No employee linked
  if (!hasEmployee) {
    return (
      <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 max-w-screen-md mx-auto">
        <motion.div variants={staggerItem}>
          <PageHeader
            icon={<CalendarDays className="h-5 w-5" />}
            title="New Leave Request"
            subtitle="Submit your leave request for review."
            badgeText="Leave"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="mt-8">
          <div className="rounded-2xl border-2 border-border bg-surface p-12 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" aria-hidden="true" />
            <p className="font-bold text-foreground mb-1">No employee profile is linked to this account.</p>
            <p className="text-sm text-muted-foreground">You cannot file a personal leave request without an associated Employee record.</p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Batch Result Partial/Failed view
  if (batchResult) {
    return (
      <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 max-w-screen-md mx-auto">
        <motion.div variants={staggerItem} className="rounded-2xl border-2 border-border bg-surface p-8">
          <h2 className="text-xl font-bold mb-2">Leave Creation Completed with Some Issues</h2>
          <p className="text-muted-foreground mb-6">
            Created: <span className="font-bold text-success-600">{batchResult.summary?.created}</span> | 
            Failed: <span className="font-bold text-danger-600">{batchResult.summary?.failed}</span>
          </p>
          
          {batchResult.failed?.length > 0 && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6 max-h-[300px] overflow-y-auto">
              <h3 className="font-bold text-danger-900 mb-2">Failed Employees</h3>
              <ul className="space-y-2 text-sm text-danger-800">
                {batchResult.failed.map((f: any, i: number) => {
                  const emp = selectedEmployeeData.find(e => e.id === f.employeeId);
                  const label = emp ? `${emp.firstName} ${emp.lastName}` : `Employee ID: ${f.employeeId}`;
                  return (
                    <li key={i}><strong>{label}</strong> — {f.reason}</li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="review"  onClick={() => navigate({ to: '/leave/requests' })}>
              View Leave Requests
            </Button>
            <Button variant="outline" onClick={() => { setBatchResult(null); setSuccess(false); }}>
              Back to Form
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Full Success state
  if (success) {
    return (
      <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 max-w-screen-md mx-auto">
        <motion.div variants={staggerItem} className="rounded-2xl border-2 border-success/30 bg-success-light p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-success-600 mx-auto mb-4" aria-hidden="true" />
          <p className="font-bold text-success-dark text-lg mb-2">Leave Request{requestFor === 'self' || requestFor === 'one' ? '' : 's'} Submitted</p>
          <p className="text-sm text-success-dark/80 mb-6">
            {requestFor === 'self'
              ? me && !me.immediateSupervisorId
                ? 'It goes to HR for the decision (you have no assigned head). You can follow it under My Requests.'
                : 'It goes to your head for endorsement first, then to HR for the final decision. You can follow it under My Requests.'
              : 'The leave request(s) have been successfully submitted.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="review"  onClick={() => navigate({ to: '/leave/requests' })}>
              View Requests
            </Button>
            <Button variant="outline" onClick={() => { setSuccess(false); setLeaveType(''); setStartDate(''); setEndDate(''); setReason(''); setAddressDuringLeave(''); }}>
              File Another
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-6 space-y-6 max-w-screen-md mx-auto">
      {/* Header */}
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title="New Leave Request"
          subtitle="Submit your leave request for review."
          badgeText="Leave"
          actions={<HelpLink slug="file-leave-request" />}
        />
      </motion.div>

      {/* Request For Modes (HR/Supervisor only) */}
      {!isStandard && (
        <motion.div variants={staggerItem} className="bg-surface rounded-2xl border-2 border-border p-4 shadow-sm flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Request For</label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={requestFor === 'self' ? 'primary' : 'outline'} 
              onClick={() => { setRequestFor('self'); setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
              className="text-sm"
            >
              Myself
            </Button>
            {isHR && (
              <Button 
                variant={requestFor === 'one' ? 'primary' : 'outline'} 
                onClick={() => { setRequestFor('one'); setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
                className="text-sm"
              >
                One Employee
              </Button>
            )}
            {isSupervisor && !isHR && (
              <Button 
                variant={requestFor === 'multiple' ? 'primary' : 'outline'} 
                onClick={() => { setRequestFor('multiple'); setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
                className="text-sm"
              >
                Team Member(s)
              </Button>
            )}
            {isHR && (
              <Button 
                variant={requestFor === 'multiple' ? 'primary' : 'outline'} 
                onClick={() => { setRequestFor('multiple'); setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
                className="text-sm"
              >
                Multiple Employees
              </Button>
            )}
            {isHR && (
              <Button 
                variant={requestFor === 'all' ? 'primary' : 'outline'} 
                onClick={() => { setRequestFor('all'); setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
                className="text-sm"
              >
                All Employees
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Employee Identity / Selector */}
      <motion.div variants={staggerItem}>
        {requestFor === 'self' && (
          // The form's Name / Position / Date Employed / Unit-Dept, from the record.
          <div className="rounded-2xl border-2 border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Employee Information</p>
              <span className="text-xs text-muted-foreground italic">From your employee record</span>
            </div>
            {meError && <LoadError compact message={meError} className="mb-3" />}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Name</dt><dd className="font-bold text-foreground">{employeeName} <span className="font-normal text-muted-foreground">· {employeeNumber}</span></dd></div>
              <div><dt className="text-xs text-muted-foreground">Position</dt><dd className="font-semibold text-foreground">{me?.jobRole?.title ?? '…'}</dd></div>
              <div>
                <dt className="text-xs text-muted-foreground">Date Employed</dt>
                <dd className="font-semibold text-foreground">
                  {me ? formatEmploymentDate(me.hireDate) : '…'}
                  {me?.hireDate && (() => {
                    const years = employmentDuration(me.hireDate)?.years;
                    return years === undefined ? null : <span className="font-normal text-muted-foreground"> · {years} completed year{years === 1 ? '' : 's'}</span>;
                  })()}
                </dd>
              </div>
              <div><dt className="text-xs text-muted-foreground">Unit / Department</dt><dd className="font-semibold text-foreground">{me ? [me.unit?.name, me.department?.name].filter(Boolean).join(' · ') || '—' : '…'}</dd></div>
            </dl>
          </div>
        )}

        {requestFor === 'all' && (
          <div className="rounded-2xl border-2 border-primary-200 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-900/40">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-primary-600 mt-0.5 shrink-0 dark:text-primary-300" />
              <div>
                <p className="font-bold text-primary-900 dark:text-primary-300">All Eligible Active Employees</p>
                <p className="text-sm text-primary-700/80 mt-1 dark:text-primary-300/80">
                  This request will dynamically target all active organization members.
                </p>
              </div>
            </div>
          </div>
        )}

        {(requestFor === 'one' || requestFor === 'multiple') && (
          <EmployeeSelectionPanel 
            mode={requestFor === 'one' ? 'one' : 'multiple'}
            isSupervisor={isSupervisor && !isHR}
            selectedIds={selectedEmployees}
            onSelectionChange={(ids, data) => { setSelectedEmployees(ids); setSelectedEmployeeData(data); }}
            onClearSelection={() => { setSelectedEmployees(new Set()); setSelectedEmployeeData([]); }}
          />
        )}
      </motion.div>

      {/* Leave Balance (if available) */}
      {balancesError && (requestFor === 'self' || requestFor === 'one') && (
        <motion.div variants={staggerItem}>
          <LoadError compact message={balancesError} />
        </motion.div>
      )}
      {balances.length > 0 && (requestFor === 'self' || requestFor === 'one') && (
        <motion.div variants={staggerItem}>
          <div className="rounded-2xl border-2 border-border bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Leave Balances ({new Date().getFullYear()})</p>
            <div className="flex flex-wrap gap-2">
              {balances.map((b) => (
                <div
                  key={b.leaveType}
                  className={cn(
                    'rounded-xl px-3 py-2 border text-xs font-medium cursor-pointer transition-all',
                    leaveType === b.leaveType
                      ? 'bg-primary-100 border-primary-400 text-primary-800 dark:bg-primary-900/60 dark:text-primary-300'
                      : 'bg-muted/30 border-border text-foreground hover:border-primary-300 dark:hover:border-primary-900'
                  )}
                  onClick={() => setLeaveType(b.leaveType)}
                >
                  <p className="font-bold">{LEAVE_TYPE_LABELS[b.leaveType] ?? b.leaveType}</p>
                  <p className="text-muted-foreground">
                    {b.available ?? b.totalAllotted - b.used - b.pending - b.forfeited} of {b.totalAllotted} days available
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Form */}
      <motion.div variants={staggerItem}>
        <form onSubmit={handleSubmitClick} className="bg-surface rounded-2xl border-2 border-border p-6 space-y-5 shadow-sm">
          {/* Leave Type */}
          <div>
            <label htmlFor="leaveType" className="block text-sm font-bold text-foreground mb-1.5">
              Leave Type <span className="text-danger-500">*</span>
            </label>
            <select
              id="leaveType"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Select leave type...</option>
              {/* Grouped as on Hospicio's Leave Application Form. */}
              {HOSPICIO_LEAVE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.types.map((t) => (
                    <option key={t} value={t}>{LEAVE_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {(requestFor === 'multiple' || requestFor === 'all') && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                Individual leave balances vary by employee.
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-bold text-foreground mb-1.5">
                Start Date <span className="text-danger-500">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
                className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-bold text-foreground mb-1.5">
                End Date <span className="text-danger-500">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Duration Preview */}
          {calculatedDays !== null && (
            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 px-4 py-3">
              <p className="text-sm font-bold text-primary-700 dark:text-primary-300">
                Total Number of Leave Applied: <span className="text-primary-900 dark:text-primary-100">{daysText(calculatedDays)}</span>
              </p>
              <p className="text-xs text-primary-600/80 dark:text-primary-400/80 mt-0.5">
                Counted as calendar days from the first to the last day. Hospicio has not yet confirmed whether rest days and holidays are excluded.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-bold text-foreground mb-1.5">
              Reason <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={4}
              placeholder="Please explain the reason for the leave..."
              className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {/* Hospicio form: Address during Leave + Contact Number (own request) */}
          {requestFor === 'self' && (
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_14rem] gap-4">
              <div>
                <label htmlFor="addressDuringLeave" className="block text-sm font-bold text-foreground mb-1.5">Address During Leave</label>
                <input id="addressDuringLeave" value={addressDuringLeave} onChange={(e) => setAddressDuringLeave(e.target.value)} maxLength={255}
                  placeholder="Where you can be reached" className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label htmlFor="contactNumber" className="block text-sm font-bold text-foreground mb-1.5">Contact Number</label>
                <input id="contactNumber" type="tel" inputMode="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} maxLength={40}
                  className="w-full h-10 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>
          )}

          {/* Leave record — the form's Total Available / Less: This Leave / Balance */}
          {leaveType && (requestFor === 'self' || requestFor === 'one') && (
            <div className="rounded-xl border-2 border-border p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Leave Record · {LEAVE_TYPE_LABELS[leaveType] ?? leaveType}</p>
              {selectedBalance ? (() => {
                const available = selectedBalance.available ?? selectedBalance.totalAllotted - selectedBalance.used - selectedBalance.pending - selectedBalance.forfeited;
                const after = calculatedDays === null ? null : Math.round((available - calculatedDays) * 100) / 100;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Total Available', available],
                        ['Less: This Leave', calculatedDays ?? '—'],
                        ['Balance After Leave', after ?? '—'],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-lg border border-border bg-muted/20 px-2 py-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                          <p className={cn('text-xl font-extrabold tabular-nums', typeof value === 'number' && value < 0 ? 'text-status-danger-foreground' : 'text-foreground')}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {after !== null && after < 0 ? (
                      <p className="mt-2 text-xs font-medium text-status-warning-foreground">
                        This is {Math.abs(after)} day{Math.abs(after) === 1 ? '' : 's'} more than your available balance. You can still submit — your head and HR will decide, and may approve fewer days.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Of {selectedBalance.totalAllotted} days allotted for {selectedBalance.year}. Days are reserved when you submit and charged only when HR approves.</p>
                    )}
                  </>
                );
              })() : (
                <p className="text-sm text-muted-foreground">
                  {NO_CREDIT_LEAVE_TYPES.has(leaveType)
                    ? 'Leave without pay uses no leave credits.'
                    : `There are no ${(LEAVE_TYPE_LABELS[leaveType] ?? leaveType).toLowerCase()} credits on record for this year. You can still submit — HR decides on it.`}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-light border border-danger/30 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-danger-600 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-danger-dark">{error}</p>
            </div>
          )}

          {requestFor === 'self' && me && (
            <p className="text-xs text-muted-foreground">
              {me.immediateSupervisorId
                ? 'This goes to your head / supervisor first for endorsement, then to HR for the final decision.'
                : 'You have no assigned head, so this goes straight to HR for the decision.'}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold flex-1 sm:flex-none sm:px-8"
              id="submit-leave-request-btn"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: '/leave/requests' })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Leave Creation</DialogTitle>
            <DialogDescription>
              {requestFor === 'all' 
                ? 'This action will create an individual Leave Request for all eligible active employees.'
                : `This action will create a Leave Request for ${selectedEmployees.size} selected employees.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm border">
            <p><strong>Leave Type:</strong> {LEAVE_TYPE_LABELS[leaveType] ?? leaveType}</p>
            <p><strong>Dates:</strong> {startDate} to {endDate}</p>
            <p><strong>Reason:</strong> {reason}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={executeSubmission} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Confirm Leave Creation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
