import {
  Users, FileText, CheckCircle2, ShieldAlert, FileSearch,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { LoadError } from "@/components/shared/LoadError";
import { STATUS_TONE_CHIP } from "@/components/ui/status-tone";

/** Attendance status → Hospicio colour code. */
const PRESENCE_TONE: Record<string, string> = {
  PRESENT: STATUS_TONE_CHIP.success,
  LATE: STATUS_TONE_CHIP.warning,
  ABSENT: STATUS_TONE_CHIP.danger,
};

export function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.employee?.firstName || "Supervisor";
  const lastName = user?.employee?.lastName || "";
  const roleTitle = user?.employee?.jobRole?.title || "Supervisor";

  const { stats, isLoading, error: statsError, reload: reloadStats } = useDashboardStats();
  const overview = useDashboardOverview();

  const compliance = overview.data?.compliance;

  return (
    <DashboardLayout
      name={`${firstName} ${lastName}`.trim()}
      role={roleTitle}
      overview={overview.data}
      overviewLoading={overview.isLoading}
      overviewError={overview.error}
      onActivityChange={overview.reload}
      kpis={
        <div className="space-y-3">
          {statsError && <LoadError compact message={statsError} onRetry={reloadStats} />}
          <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-4">
            <MetricCard
              title="Team Count"
              tone="total"
              value={isLoading ? "..." : statsError ? "—" : stats?.teamSummary?.totalSubordinates || "0"}
              changeLabel="Employees under supervision"
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Team Compliance: Action Required"
              tone="danger"
              value={overview.isLoading ? "..." : overview.error ? "—" : compliance?.actionRequired ?? 0}
              changeLabel={overview.isLoading || overview.error ? "" : `Missing or expired · ${compliance?.expiringSoon ?? 0} expiring soon`}
              icon={<ShieldAlert className="h-5 w-5" />}
            />
            <MetricCard
              title="Team Compliance: Needs Review"
              tone="accent"
              value={overview.isLoading ? "..." : overview.error ? "—" : compliance?.needsReview ?? 0}
              changeLabel="Waiting for HR review"
              icon={<FileSearch className="h-5 w-5" />}
            />
            <MetricCard
              title="Late Today"
              tone="warning"
              value={isLoading ? "..." : statsError ? "—" : stats?.teamSummary?.lateToday || "0"}
              changeLabel="Requires acknowledgment"
              icon={<FileText className="h-5 w-5" />}
            />
          </div>
        </div>
      }
    >
      {/* Team presence */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-foreground font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-500" />
            Team Presence Today
          </h2>
          <Button variant="review" size="sm" onClick={() => navigate({ to: "/attendance" })}>
            View All Records
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border-soft text-xs uppercase tracking-wider text-muted-foreground font-bold">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Shift Status</th>
                <th className="pb-3">Time In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {isLoading ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Loading team status...</td></tr>
              ) : statsError ? (
                <tr><td colSpan={4} className="py-4"><LoadError compact message={statsError} onRetry={reloadStats} /></td></tr>
              ) : stats?.teamStatus && stats.teamStatus.length > 0 ? (
                stats.teamStatus.map((member: any) => {
                  const record = member.attendanceRecords?.[0];
                  const status = record?.status || "No record";
                  const timeIn = record?.timeIn ? new Date(record.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                  return (
                    <tr key={member.firstName + member.lastName} className="hover:bg-surface-2">
                      <td className="py-3 pr-4 font-semibold text-foreground">{member.firstName} {member.lastName}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{member.jobRole?.title || "Staff"}</td>
                      <td className="py-3 pr-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          PRESENCE_TONE[status] ?? "bg-surface-2 border-border-soft text-muted-foreground"
                        )}>
                          {status === "No record" ? status : status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-foreground">{timeIn}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No team status available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tardiness log */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-card">
        <h2 className="text-base font-bold text-foreground font-heading mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-500" />
          Late & Tardiness Log Monitoring
        </h2>
        <div className="space-y-3">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border-soft rounded-xl">Loading logs...</p>
          ) : statsError ? (
            <LoadError compact message={statsError} onRetry={reloadStats} />
          ) : stats?.teamLogs && stats.teamLogs.length > 0 ? (
            stats.teamLogs.map((log: any) => (
              <div key={log.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-border-soft bg-surface-2/60 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {log.employee?.firstName} {log.employee?.lastName}
                    <span className="ml-1.5 text-xs text-muted-foreground font-medium">({log.employee?.jobRole?.title || "Staff"})</span>
                  </p>
                  <p className="text-xs text-status-danger-foreground font-semibold mt-1">
                    Logged: {log.issue || "Issue"} on {new Date(log.logDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Reason: "{log.reason || "No reason provided"}"</p>
                </div>
                {log.acknowledgedAt == null ? (
                  <span className={cn("self-start md:self-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE_CHIP.warning)}>
                    Awaiting acknowledgment
                  </span>
                ) : (
                  <span className={cn("self-start md:self-center inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE_CHIP.success)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border-soft rounded-xl">
              No pending logs to acknowledge today.
            </p>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
