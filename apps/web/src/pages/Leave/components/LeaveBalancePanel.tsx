import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leaveApi } from '@/services/api/leave';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';
import { LEAVE_TYPE_LABELS } from '@/lib/leaveTypes';

/** Types HR can hold credits for. Leave Without Pay and Other use none. */
const LEAVE_TYPES = [
  'SICK', 'VACATION', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'SOLO_PARENT',
  'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'BEREAVEMENT', 'FORCED', 'OFFSET',
] as const;

interface LeaveBalance {
  id: string;
  year: number;
  leaveType: string;
  totalAllotted: number;
  used: number;
  pending: number;
  forfeited: number;
  allotmentSource?: 'MANUAL' | 'AUTOMATIC';
  entitlementCompletedYears?: number | null;
}

interface EntitlementItem {
  leaveType: string;
  label: string;
  completedYears: number;
  eligible: boolean;
  requiresEligibility: boolean;
  days: number;
  reason: string;
  next: { fromYears: number; days: number } | null;
  nextDate: string | null;
  balance: { totalAllotted: number; allotmentSource: 'MANUAL' | 'AUTOMATIC' } | null;
  status: 'AUTOMATIC' | 'MANUAL_MATCHES_POLICY' | 'MANUAL_DIFFERS_FROM_POLICY' | 'NOT_YET_CREATED' | 'NO_ENTITLEMENT';
}

interface Entitlements {
  year: number;
  asOf: string;
  startDate: string | null;
  active: boolean;
  completedYears: number;
  servicePeriod: { years: number; months: number; days: number } | null;
  items: EntitlementItem[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Leave balances for one employee.
 *
 * Vacation, Sick, Bereavement, Paternity and Solo Parent leave follow the
 * Hospicio-confirmed entitlement by COMPLETED years of service (Paternity and
 * Solo Parent only when HR marked the employee eligible). Those balances are
 * AUTOMATIC. Anything HR enters here is MANUAL and is never overridden; where a
 * manual figure differs from the policy, HR can switch it to the policy.
 */
export function LeaveBalancePanel({
  employeeId,
  canManage,
}: {
  employeeId: string;
  /** HR Personnel only. Everyone else sees a read-only view. */
  canManage: boolean;
}) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    leaveType: 'VACATION',
    totalAllotted: '',
    forfeited: '',
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await leaveApi.getBalances(employeeId);
      setBalances(res?.data ?? []);
      // The explanation is secondary — the balances still show if it fails.
      try {
        const ent = await leaveApi.getEntitlements(employeeId);
        setEntitlements(ent?.data ?? null);
      } catch {
        setEntitlements(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Leave balances could not be loaded.'));
      setBalances([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const applyPolicy = async (leaveType: string) => {
    setApplying(leaveType);
    try {
      await leaveApi.applyEntitlement(employeeId, leaveType);
      toast.success('The balance now follows the completed-years entitlement.');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The entitlement could not be applied.'));
    } finally {
      setApplying(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(form.totalAllotted);
    if (!Number.isFinite(total) || total < 0) {
      toast.error('Enter the total number of days HR is granting (zero or more).');
      return;
    }

    setIsSaving(true);
    try {
      await leaveApi.upsertBalance({
        employeeId,
        year: Number(form.year),
        leaveType: form.leaveType,
        totalAllotted: total,
        forfeited: form.forfeited === '' ? undefined : Number(form.forfeited),
      });
      toast.success('Leave balance saved.');
      setShowForm(false);
      setForm({ year: new Date().getFullYear(), leaveType: 'VACATION', totalAllotted: '', forfeited: '' });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The leave balance could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface border-2 border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b-2 border-border bg-muted/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4.5 w-4.5 text-primary-600 dark:text-primary-300" />
          <div>
            <h3 className="font-bold font-heading text-foreground">Leave Balances</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vacation, Sick, Bereavement, Paternity and Solo Parent leave follow completed years of service. Other
              balances are entered by HR, and a figure HR enters is never overridden.
            </p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" variant="create" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Set balance'}
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleSave} className="px-5 py-4 border-b-2 border-border bg-muted/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Year</label>
              <input
                type="number"
                value={form.year}
                min={2000}
                max={2100}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="w-full h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Leave type</label>
              <select
                value={form.leaveType}
                onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Total days *</label>
              <input
                type="number"
                required
                min={0}
                step="0.5"
                value={form.totalAllotted}
                onChange={(e) => setForm((f) => ({ ...f, totalAllotted: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Forfeited</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={form.forfeited}
                onChange={(e) => setForm((f) => ({ ...f, forfeited: e.target.value }))}
                placeholder="0"
                className="w-full h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Saving an existing year and leave type updates it and marks it as entered by HR (manual): the
              automatic entitlement will not change it. Used and pending days are not changed.
            </p>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save balance'}
            </Button>
          </div>
        </form>
      )}

      {entitlements && (
        <div className="px-5 py-4 border-b-2 border-border space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-foreground">Entitlement by completed years of service</p>
            <p className="text-xs text-muted-foreground">
              {entitlements.startDate
                ? <>Start date {new Date(`${entitlements.startDate}T00:00:00`).toLocaleDateString()} · as of {new Date(`${entitlements.asOf}T00:00:00`).toLocaleDateString()}: <strong className="text-foreground">{plural(entitlements.completedYears, 'completed year')}</strong>
                  {entitlements.servicePeriod ? ` (${plural(entitlements.servicePeriod.years, 'year')}, ${plural(entitlements.servicePeriod.months, 'month')}, ${plural(entitlements.servicePeriod.days, 'day')})` : ''}</>
                : 'No start date recorded'}
            </p>
          </div>
          {!entitlements.active && (
            <p className="text-xs text-muted-foreground">This employee is not active, so no new entitlement is applied. Existing balances are kept as they are.</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Leave type</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Policy ({entitlements.year})</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Balance held</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Next change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entitlements.items.map((it) => (
                  <tr key={it.leaveType}>
                    <td className="px-3 py-2 font-medium text-foreground">{it.label}</td>
                    <td className="px-3 py-2 text-foreground">
                      <strong>{plural(it.days, 'day')}</strong>
                      <span className="block text-muted-foreground">{it.reason}</span>
                    </td>
                    <td className="px-3 py-2">
                      {it.status === 'AUTOMATIC' && <span className="text-foreground">{it.balance?.totalAllotted} — <span className="font-semibold text-status-success-foreground">Automatic</span></span>}
                      {it.status === 'MANUAL_MATCHES_POLICY' && <span className="text-foreground">{it.balance?.totalAllotted} — entered by HR (matches the policy)</span>}
                      {it.status === 'MANUAL_DIFFERS_FROM_POLICY' && (
                        <span className="text-foreground">
                          {it.balance?.totalAllotted} — <span className="font-semibold text-status-warning-foreground">entered by HR, differs from the policy</span>
                          {canManage && (
                            <Button size="xs" variant="outline" className="ml-2" disabled={applying === it.leaveType} onClick={() => applyPolicy(it.leaveType)}>
                              {applying === it.leaveType ? 'Applying…' : `Use policy (${it.days})`}
                            </Button>
                          )}
                        </span>
                      )}
                      {it.status === 'NOT_YET_CREATED' && <span className="text-muted-foreground">Created when balances are next opened</span>}
                      {it.status === 'NO_ENTITLEMENT' && <span className="text-muted-foreground">No balance{it.requiresEligibility && !it.eligible ? ' — not marked eligible by HR' : ''}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {it.next && it.nextDate && it.eligible
                        ? `${plural(it.next.days, 'day')} from ${new Date(`${it.nextDate}T00:00:00`).toLocaleDateString()} (${plural(it.next.fromYears, 'completed year')})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Completed years count anniversaries of the start date on the calendar (not days ÷ 365). Balances are kept per
            calendar year; only the allotment of an automatic balance changes — used, pending and forfeited days never do.
          </p>
        </div>
      )}

      {error ? (
        <p className="p-6 text-sm text-danger-dark">{error}</p>
      ) : isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading leave balances...</p>
      ) : balances.length === 0 ? (
        <div className="p-10 text-center">
          <CalendarDays className="h-9 w-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-foreground">No leave balances yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {canManage
              ? 'Automatic balances start once the employee completes a year of service. Use "Set balance" for any other leave type.'
              : 'Automatic leave balances start after your first completed year of service. You can still file a leave request.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b-2 border-border">
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Year</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Leave type</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground text-center">Total</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground text-center">Used</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground text-center">Pending</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground text-center">Forfeited</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground text-center" title="Total − Used − Pending − Forfeited">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {balances.map((b) => {
                // From the API (lib/leave-balance) — the one formula every screen uses.
                const remaining = (b as any).available ?? b.totalAllotted - b.used - b.pending - b.forfeited;
                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground">{b.year}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {LEAVE_TYPE_LABELS[b.leaveType] ?? b.leaveType}
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">{b.totalAllotted}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {b.allotmentSource === 'AUTOMATIC'
                        ? `Automatic${b.entitlementCompletedYears !== null && b.entitlementCompletedYears !== undefined ? ` · ${plural(b.entitlementCompletedYears, 'completed year')}` : ''}`
                        : 'Entered by HR'}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{b.used}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{b.pending}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{b.forfeited}</td>
                    <td className={`px-4 py-3 text-center font-bold ${remaining < 0 ? 'text-danger-dark' : 'text-foreground'}`}>
                      {remaining}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
