import { BreakdownButton, MetricBreakdownDialog, type MetricBreakdownSpec } from "@/components/shared/MetricBreakdown";
import { formatPct } from "@/lib/percent";
import {
  CalendarDays, Clock, ShieldAlert, FileSearch, Hourglass,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/shared/MetricCard";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { LoadError } from "@/components/shared/LoadError";
import { STATUS_TONE_CHIP } from "@/components/ui/status-tone";

export function EmployeeDashboard() {
  const { user } = useAuth();
  const firstName = user?.employee?.firstName || "Employee";
  const lastName = user?.employee?.lastName || "";
  const roleTitle = user?.employee?.jobRole?.title || "Staff";

  const { stats, isLoading, error: statsError, reload: reloadStats } = useDashboardStats();
  const overview = useDashboardOverview();

  const leaveBalances = stats?.leaveBalances || [];
  const [balanceSpec, setBalanceSpec] = useState<MetricBreakdownSpec | null>(null);
  const compliance = overview.data?.compliance;
  const loadingCompliance = overview.isLoading;

  return (
    <DashboardLayout
      name={`${firstName} ${lastName}`.trim()}
      role={roleTitle}
      overview={overview.data}
      overviewLoading={overview.isLoading}
      overviewError={overview.error}
      onActivityChange={overview.reload}
      kpis={
        <div className="grid grid-cols-1 @xl:grid-cols-3 gap-4">
          <MetricCard
            title="My Requirements: Action Required"
            tone="danger"
            value={loadingCompliance ? "..." : overview.error ? "—" : compliance?.actionRequired ?? 0}
            changeLabel="Missing or expired — submit or renew"
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <MetricCard
            title="Expiring Soon"
            tone="warning"
            value={loadingCompliance ? "..." : overview.error ? "—" : compliance?.expiringSoon ?? 0}
            changeLabel="Renew before they lapse"
            icon={<Hourglass className="h-5 w-5" />}
          />
          <MetricCard
            title="Awaiting HR Review"
            tone="accent"
            value={loadingCompliance ? "..." : overview.error ? "—" : compliance?.needsReview ?? 0}
            changeLabel="Submitted, not yet reviewed"
            icon={<FileSearch className="h-5 w-5" />}
          />
        </div>
      }
    >
      <MetricBreakdownDialog open={balanceSpec !== null} onOpenChange={(o) => !o && setBalanceSpec(null)} spec={balanceSpec} />
      {/* Leave Balances */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-card">
        <h2 className="text-base font-bold text-foreground font-heading mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary-500" />
          Your Leave Balances
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="md:col-span-3 text-center py-8 text-sm text-muted-foreground border border-dashed border-border-soft rounded-xl">Loading leave balances...</p>
          ) : statsError ? (
            <LoadError className="md:col-span-3" message={statsError} onRetry={reloadStats} />
          ) : leaveBalances.length === 0 ? (
            <p className="md:col-span-3 text-center py-8 text-sm text-muted-foreground border border-dashed border-border-soft rounded-xl">No leave balances found for current year.</p>
          ) : leaveBalances.map((leave: any) => {
            // `available` and its percentage come from the API (lib/leave-balance),
            // the same figure the Leave Balance panel and New Request page show.
            const remaining = leave.available ?? leave.totalAllotted - leave.used - leave.pending - leave.forfeited;
            const percentage = leave.availablePercent ?? 0;
            return (
              <div key={leave.leaveType} className="rounded-xl border border-status-total-border bg-status-total-surface p-4">
                <p className="text-xs text-status-total-foreground font-bold uppercase tracking-wider mb-1">
                  {leave.leaveType.replace(/_/g, ' ')}
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {remaining} <span className="text-xs font-medium text-foreground/70">of {leave.totalAllotted} days available</span>
                </p>
                <div className="w-full bg-white/60 dark:bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-status-total-foreground h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(0, percentage)}%` }}
                  />
                </div>
                {leave.pending > 0 && (
                  <span className={cn("mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE_CHIP.warning)}>
                    {leave.pending} day(s) in pending requests
                  </span>
                )}
                <div className="mt-2">
                  <BreakdownButton onClick={() => setBalanceSpec(leaveBalanceSpec(leave))} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Schedule */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-card">
        <h2 className="text-base font-bold text-foreground font-heading mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-500" />
          Weekly Work Schedule
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border-soft text-xs uppercase tracking-wider text-muted-foreground font-bold">
                <th className="pb-3 pr-4">Day</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Shift Hours</th>
                <th className="pb-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {isLoading ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Loading schedule...</td></tr>
              ) : statsError ? (
                <tr><td colSpan={4} className="py-4"><LoadError compact message={statsError} onRetry={reloadStats} /></td></tr>
              ) : stats?.schedule && stats.schedule.length > 0 ? (
                stats.schedule.map((row: any) => (
                  <tr key={row.date} className="hover:bg-surface-2">
                    <td className="py-3 pr-4 font-semibold text-foreground">{row.day}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.date}</td>
                    <td className="py-3 pr-4 font-medium text-foreground">{row.shift}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No upcoming shifts scheduled.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

/** How one leave balance's available days are reached. */
function leaveBalanceSpec(b: any): MetricBreakdownSpec {
  const available = b.available ?? b.totalAllotted - b.used - b.pending - b.forfeited;
  return {
    title: `${String(b.leaveType).replace(/_/g, ' ')} leave balance`,
    value: `${available} of ${b.totalAllotted} days available`,
    caption: `Available share: ${formatPct(b.availablePercent)} of the days allotted for ${b.year}.`,
    formula: [
      `Available = allotted − used − pending − forfeited`,
      `${b.totalAllotted} − ${b.used} − ${b.pending} − ${b.forfeited} = ${available} days`,
      b.totalAllotted > 0 ? `${Math.max(0, available)} ÷ ${b.totalAllotted} × 100 = ${formatPct(b.availablePercent)}` : 'Nothing is allotted, so there is no percentage.',
    ],
    columns: ['Part of the allotment', 'Days'],
    sections: [
      {
        rows: [
          { label: 'Used (approved leave taken)', cells: [String(b.used)] },
          { label: 'Pending (reserved by requests awaiting a decision)', cells: [String(b.pending)] },
          { label: 'Forfeited', cells: [String(b.forfeited)] },
          { label: 'Available to file', cells: [String(available)], status: { text: available < 0 ? 'Over-committed' : 'Available', tone: available < 0 ? 'danger' : 'success' } },
        ],
      },
    ],
    total: { label: 'Allotted', cells: [String(b.totalAllotted)] },
    notes: ['Leave days are counted as calendar days from start to end (weekends and holidays included), because the chargeable-day policy has not been confirmed.'],
  };
}
