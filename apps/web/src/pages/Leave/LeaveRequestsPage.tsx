import { leaveApi } from '@/services/api/leave';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Plus, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn, formatDateShort } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { LEAVE_TYPE_LABELS, leaveStage, leaveTypeLabel } from '@/lib/leaveTypes';
import { LeaveRequestDetail } from './components/LeaveRequestDetail';

/**
 * Leave workflow (Hospicio's paper process):
 *   PENDING     — filed; with the head / supervisor / coordinator (or HR
 *                 directly when the employee has no head)
 *   FOR_REVIEW  — endorsed by the head, possibly with a proposed change; with HR
 *   APPROVED (as requested, or with changes) / REJECTED (declined) / CANCELLED
 * The head recommends; HR makes the final decision. See LeaveRequestDetail.
 */

/** A calendar date (the leave's start or end), read as written. The filing timestamp uses formatDateShort. */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tier = user?.permissionTier ?? 'STANDARD';
  const isFull = tier === 'FULL';
  const isSupervisor = tier === 'SUPERVISOR';
  const hasEmployee = !!user?.employee?.id;

  // Tabs available per tier
  const availableTabs = isFull
    ? [{ id: 'self', label: 'My Requests' }, { id: 'all', label: 'All Requests' }]
    : isSupervisor
      ? [{ id: 'self', label: 'My Requests' }, { id: 'team', label: 'Team Requests' }]
      : [{ id: 'self', label: 'My Requests' }];

  const [activeTab, setActiveTab] = useState<'self' | 'team' | 'all'>('self');
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { scope: activeTab, limit: '100' };
      if (statusFilter) params.status = statusFilter;
      if (leaveTypeFilter) params.leaveType = leaveTypeFilter;
      const res = await api.get('/leave', { params });
      setRequests(res.data.data ?? []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to load leave requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, leaveTypeFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filteredRequests = requests.filter((r) => {
    if (!search) return true;
    const name = `${r.employee?.firstName ?? ''} ${r.employee?.lastName ?? ''}`.toLowerCase();
    const num = (r.employee?.employeeNumber ?? '').toLowerCase();
    return name.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
  });

  // Summary counts from full result set
  const counts = {
    pending:  requests.filter((r) => r.status === 'PENDING').length,
    forReview: requests.filter((r) => r.status === 'FOR_REVIEW').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
  };

  // Supervisors act on their own team's requests from the Team tab: they endorse
  // (or reject) while a request is still PENDING. Final approval stays with HR.
  const isSupervisorTeamView = activeTab === 'team' && isSupervisor;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<CalendarDays className="h-5 w-5" />}
          title={activeTab === 'self' ? (isFull || isSupervisor ? 'My Leave Requests' : 'My Leave Requests') : activeTab === 'team' ? 'Team Leave Requests' : 'Leave Requests'}
          subtitle={activeTab === 'team' ? 'Leave requests from the employees who report to you — endorse, propose a change, or decline.' : 'Your leave requests and where each one is.'}
          badgeText="Leave"
          actions={
            <div className="flex flex-wrap gap-2 items-center">
            <HelpLink slug={isFull ? 'approve-reject-leave' : isSupervisor ? 'endorse-leave-request' : 'file-leave-request'} />
            {isFull && (
              <Button
                variant="outline"
                title="Apply the completed-years entitlement to every active employee's automatic balances"
                onClick={async () => {
                  try {
                    const res = await leaveApi.syncEntitlements();
                    const d = res?.data;
                    toast.success(`Leave entitlements checked for ${d?.employeesChecked ?? 0} employees; ${d?.employeesChanged ?? 0} updated.`);
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, 'Leave entitlements could not be updated.'));
                  }
                }}
              >
                Update leave entitlements
              </Button>
            )}
            {hasEmployee ? (
              <Button variant="create"
                leftIcon={<Plus className="h-4 w-4" />}
                className="font-bold"
                onClick={() => navigate({ to: '/leave/new' })}
                id="new-leave-request-btn">
                New Request
              </Button>
            ) : null}
            </div>
          }
        />
      </motion.div>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <motion.div variants={staggerItem} className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit border border-border">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              id={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Summary Cards (own tab only) */}
      {activeTab === 'self' && (
        <motion.div variants={staggerContainer} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pending',  value: counts.pending,  color: 'text-warning-dark bg-warning-light border-2 border-warning/30' },
            { label: 'With HR',  value: counts.forReview, color: 'text-info-dark bg-info-light border-2 border-info/30' },
            { label: 'Approved', value: counts.approved, color: 'text-success-dark bg-success-light border-2 border-success/30' },
            { label: 'Rejected', value: counts.rejected, color: 'text-danger-dark bg-danger-light border-2 border-danger/30' },
          ].map((s) => (
            <motion.div key={s.label} variants={staggerItem} className={cn('rounded-2xl p-4 shadow-sm', s.color)}>
              <p className="text-2xl font-extrabold font-heading">{s.value}</p>
              <p className="text-xs mt-1 font-bold uppercase tracking-wider opacity-80">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-3 items-center">
        {(isFull || (isSupervisor && activeTab === 'team')) && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              className="w-full pl-9 pr-4 h-9 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search employees"
            />
          </div>
        )}
        <select
          className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Waiting for head / HR</option>
          <option value="FOR_REVIEW">Endorsed — with HR</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
          value={leaveTypeFilter}
          onChange={(e) => setLeaveTypeFilter(e.target.value)}
          aria-label="Filter by leave type"
        >
          <option value="">All Types</option>
          {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" className="h-9" onClick={fetchRequests} aria-label="Refresh">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        {isSupervisorTeamView && (
          <span className="text-xs text-muted-foreground ml-auto italic">
            Endorse a request to send it to HR for the final decision.
          </span>
        )}
      </motion.div>

      {/* Table */}
      <motion.div variants={staggerItem} className="bg-surface rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b-2 border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
          </h3>
          {isSupervisorTeamView && (
            <span className="text-xs text-info-dark bg-info-light border border-info/30 px-2 py-0.5 rounded-full font-semibold">
              Endorsement stage
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-6 w-6 animate-spin text-primary-500" aria-label="Loading" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-8 w-8 text-danger-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground mb-1">Unable to load leave requests</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchRequests}>Try Again</Button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground mb-1">No leave requests found.</p>
            <p className="text-xs text-muted-foreground mb-4">
              {activeTab === 'self' ? 'You have no leave requests yet.' : 'No team leave requests match the current filters.'}
            </p>
            {hasEmployee && activeTab === 'self' && (
              <Button variant="create"
                size="sm"
                
                onClick={() => navigate({ to: '/leave/new' })}>
                <Plus className="h-3.5 w-3.5" /> New Request
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/60 text-muted-foreground font-bold">
                  {(isFull || (isSupervisor && activeTab === 'team')) && (
                    <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Employee</th>
                  )}
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Leave Type</th>
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Filed</th>
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map((r, i) => {
                  const stage = leaveStage(r);
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {(isFull || (isSupervisor && activeTab === 'team')) && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={`${r.employee?.firstName} ${r.employee?.lastName}`} size="sm" />
                            <div>
                              <p className="font-bold text-foreground text-sm">{r.employee?.firstName} {r.employee?.lastName}</p>
                              <p className="text-xs text-muted-foreground">{r.employee?.unit?.name}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-sm font-medium text-foreground">
                        {leaveTypeLabel(r.leaveType)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(r.startDate)} – {formatDate(r.endDate)}
                        {/* The final leave; the original request is in the detail. */}
                        {r.originalStartDate && <span className="block text-[11px] font-semibold text-status-info-foreground">Revised from {formatDate(r.originalStartDate)} – {formatDate(r.originalEndDate)}</span>}
                        {!r.originalStartDate && r.proposedStartDate && r.status === 'FOR_REVIEW' && <span className="block text-[11px] font-semibold text-status-info-foreground">Proposed: {formatDate(r.proposedStartDate)} – {formatDate(r.proposedEndDate)}</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-sm text-foreground">{r.totalDays}d</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{formatDateShort(r.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap', STATUS_TONE_CHIP[stage.tone])}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Button
                          size="xs"
                          variant="review"
                          className="text-xs font-semibold"
                          onClick={() => setSelectedLeaveId(r.id)}
                          id={`view-leave-${r.id}`}>
                          View
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Leave Detail Drawer */}
      {selectedLeaveId && (
        <LeaveRequestDetail
          leaveId={selectedLeaveId}
          onClose={() => setSelectedLeaveId(null)}
          onChanged={fetchRequests}
          isHR={isFull}
          isTeamHead={isSupervisorTeamView}
          viewerEmployeeId={user?.employee?.id}
        />
      )}
    </motion.div>
  );
}
