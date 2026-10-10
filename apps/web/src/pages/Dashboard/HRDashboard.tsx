import { BreakdownButton, MetricBreakdownDialog, type MetricBreakdownSpec } from "@/components/shared/MetricBreakdown";
import { formatPct } from "@/lib/percent";
import {
  Users, FileText, ShieldAlert, FileSearch,
} from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { LoadError } from "@/components/shared/LoadError";

/**
 * HR dashboard.
 *
 * Summary cards follow the Hospicio colour code: total = green, compliance
 * that needs action (missing / expired) = red, compliance awaiting review =
 * lavender, decisions still pending = amber. Present/Absent Today, Leave
 * Distribution and Unit Attendance Today were removed at HSJ's request; AI
 * insights moved to the chat in the lower-right corner.
 */

export function HRDashboard() {
  const { user } = useAuth();
  const firstName = user?.employee?.firstName || "HR";
  // "HR Officer" only when there is no employee name at all; a one-word name
  // (e.g. the Sister account) is shown as-is, not padded with "Officer".
  const lastName = user?.employee?.firstName ? (user.employee.lastName || "") : "Officer";
  const roleTitle = user?.employee?.jobRole?.title || "HR Department";

  const { stats, isLoading, error: statsError, reload: reloadStats } = useDashboardStats();
  const [showTrendBreakdown, setShowTrendBreakdown] = useState(false);
  const overview = useDashboardOverview();

  // True only when at least one month actually has imported attendance records.
  const hasTrendData = Array.isArray(stats?.attendanceTrend)
    && stats.attendanceTrend.some((m: any) => m.rate !== null && m.rate !== undefined);


  const compliance = overview.data?.compliance;
  const complianceLoading = overview.isLoading;

  return (
    <DashboardLayout
      name={`${firstName} ${lastName}`.trim()}
      role={roleTitle}
      overview={overview.data}
      overviewLoading={overview.isLoading}
      overviewError={overview.error}
      onActivityChange={overview.reload}
      showTodo={false}
      kpis={
        <div className="space-y-3">
          {statsError && <LoadError compact message={statsError} onRetry={reloadStats} />}
          <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Employees"
              tone="total"
              value={isLoading ? "..." : statsError ? "—" : stats?.totalEmployees || "0"}
              changeLabel={isLoading || statsError ? "" : `${stats?.newThisMonth || 0} new this month`}
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Compliance: Action Required"
              tone="danger"
              value={complianceLoading ? "..." : overview.error ? "—" : compliance?.actionRequired ?? 0}
              changeLabel={
                complianceLoading || overview.error
                  ? ""
                  : `Missing or expired · ${compliance?.expiringSoon ?? 0} expiring soon`
              }
              icon={<ShieldAlert className="h-5 w-5" />}
            />
            <MetricCard
              title="Compliance: Needs Review"
              tone="accent"
              value={complianceLoading ? "..." : overview.error ? "—" : compliance?.needsReview ?? 0}
              changeLabel="Submitted records awaiting HR"
              icon={<FileSearch className="h-5 w-5" />}
            />
            <MetricCard
              title="Awaiting HR Decision"
              tone="warning"
              value={isLoading ? "..." : statsError ? "—" : stats?.pendingLeaves?.length ?? 0}
              changeLabel="Leave requests"
              icon={<FileText className="h-5 w-5" />}
            />
          </div>
        </div>
      }
    >
      {/* Attendance Trend */}
      <section className="rounded-2xl border border-border-soft bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold font-heading text-foreground">Attendance Trend</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monthly attendance rate, from imported attendance records
            </p>
            {hasTrendData && <BreakdownButton className="mt-1" onClick={() => setShowTrendBreakdown(true)} />}
          </div>
          <Badge variant="primary" size="sm">Last 6 months</Badge>
        </div>
        <div className="h-56">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm border border-dashed border-border-soft rounded-xl">Loading chart...</div>
          ) : statsError ? (
            <LoadError message={statsError} onRetry={reloadStats} className="h-full justify-center" />
          ) : !hasTrendData ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm border border-dashed border-border-soft rounded-xl px-6">
              <p className="font-semibold text-foreground">No attendance data yet</p>
              <p className="text-xs mt-1 max-w-xs">
                This chart appears once attendance records have been imported into HRISense.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.attendanceTrend}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#148281" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#148281" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(v: any, _n: any, item: any) => {
                    const m = item?.payload ?? {};
                    const presence = (m.presentCount ?? 0) + (m.lateCount ?? 0) + (m.halfDayCount ?? 0);
                    const total = presence + (m.absentCount ?? 0);
                    return [v === null || v === undefined ? 'No data' : `${v}% (${presence} of ${total} records)`, 'Attendance rate'];
                  }}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                {/* connectNulls={false} leaves a gap for months with no records
                    instead of drawing a line through invented values. */}
                <Area
                  type="monotone"
                  dataKey="rate"
                  connectNulls={false}
                  stroke="#148281"
                  strokeWidth={2.5}
                  fill="url(#areaGrad)"
                  dot={{ fill: "#148281", r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <MetricBreakdownDialog
        open={showTrendBreakdown}
        onOpenChange={setShowTrendBreakdown}
        spec={stats?.attendanceTrend ? attendanceTrendSpec(stats.attendanceTrend) : null}
      />
    </DashboardLayout>
  );
}

/** Month by month: the counts behind each attendance rate on the chart. */
function attendanceTrendSpec(trend: any[]): MetricBreakdownSpec {
  return {
    title: 'Attendance trend — last 6 months',
    value: 'Monthly attendance rate',
    caption: 'Active employees only. Each month is calculated from that month’s imported records.',
    formula: [
      'Attendance rate = (Present + Late + Half day) ÷ (Present + Late + Half day + Absent) × 100',
      'Days with no imported record are not absences and are not counted. On leave, holiday and rest-day records are listed but not counted.',
    ],
    columns: ['Month', 'Present', 'Late', 'Half day', 'Absent', 'Other records', 'Rate'],
    sections: [
      {
        rows: trend.map((m) => {
          const presence = (m.presentCount ?? 0) + (m.lateCount ?? 0) + (m.halfDayCount ?? 0);
          const total = presence + (m.absentCount ?? 0);
          return {
            label: `${m.month} ${m.year}`,
            muted: m.rate === null,
            note: m.rate === null ? 'No attendance imported for this month' : `${presence} ÷ ${total} × 100`,
            cells: [
              String(m.presentCount ?? 0),
              String(m.lateCount ?? 0),
              String(m.halfDayCount ?? 0),
              String(m.absentCount ?? 0),
              String(m.otherRecordedCount ?? 0),
              formatPct(m.rate),
            ],
          };
        }),
      },
    ],
    notes: ['The months are separate rates; they are not added together.'],
  };
}
