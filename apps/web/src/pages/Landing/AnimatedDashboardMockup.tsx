import { motion } from "framer-motion";
import {
  Users, TrendingUp, ShieldCheck, Bell, Sparkles,
  Clock, CheckCircle2, AlertTriangle, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItemPop, springs } from "@/lib/motion";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";

const attendanceData = [
  { day: "Mon", value: 96 },
  { day: "Tue", value: 94 },
  { day: "Wed", value: 98 },
  { day: "Thu", value: 91 },
  { day: "Fri", value: 97 },
  { day: "Sat", value: 82 },
  { day: "Sun", value: 78 },
];

/**
 * Illustrative placeholders for the public landing-page animation.
 *
 * These are intentionally anonymous and use Hospicio de San Jose's real service
 * unit names. They are a picture of the interface, not sample HR data — no
 * invented staff names and no invented clinical departments.
 */
const employees = [
  { name: "Employee A", role: "Kitchen Supervisor", dept: "General Support Services", status: "present", initial: "A" },
  { name: "Employee B", role: "Social Worker", dept: "Social Services", status: "present", initial: "B" },
  { name: "Employee C", role: "Clinic Staff", dept: "Health Services", status: "on-leave", initial: "C" },
];

const colors = ["#148281", "#7c3aed", "#f472b6", "#fbbf24"];

export function AnimatedDashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto xl:scale-110 xl:origin-left mt-10 lg:mt-0">
      {/* Outer glow (behind mockup) */}
      <div className="absolute -inset-4 z-[-1] bg-gradient-to-br from-primary-400/20 via-transparent to-accent/20 rounded-[2.5rem] blur-2xl opacity-60 pointer-events-none" />

      {/* Main mockup container */}
      <motion.div
        role="img"
        aria-label="Illustration of the HRISense dashboard with sample figures, not live data"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className={cn(
          "relative rounded-3xl border border-border bg-surface",
          "shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]",
          "overflow-hidden p-4 space-y-3"
        )}
      >
        {/* Mock topbar */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-danger" />
            <div className="h-3 w-3 rounded-full bg-warning" />
            <div className="h-3 w-3 rounded-full bg-success" />
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Illustration · sample figures</span>
          <div className="flex gap-1">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="h-5 w-5 rounded bg-muted" />
          </div>
        </div>

        {/* KPI Cards — stagger entrance */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-2"
        >
          {[
            { label: "Employees", value: "850", icon: <Users className="h-4 w-4" />, color: "text-primary-600 bg-primary-100 dark:text-primary-300 dark:bg-primary-900/60", trend: "+3%" },
            { label: "Attendance", value: "96.4%", icon: <Clock className="h-4 w-4" />, color: "text-success bg-success-light", trend: "+1.2%" },
            { label: "Compliance", value: "99.2%", icon: <ShieldCheck className="h-4 w-4" />, color: "text-accent bg-accent-light", trend: "✓" },
            { label: "AI Insights", value: "14 New", icon: <Sparkles className="h-4 w-4" />, color: "text-warning-dark bg-warning-light", trend: "↑" },
          ].map((card) => (
            <motion.div
              key={card.label}
              variants={staggerItemPop}
              className="bg-surface-2 rounded-xl p-3 border border-border"
            >
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center mb-2", card.color)}>
                {card.icon}
              </div>
              <p className="text-base font-bold font-heading text-foreground leading-none">
                {card.value}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
                <span className="text-[10px] font-bold text-success">{card.trend}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, scaleY: 0.8 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="bg-surface-2 rounded-xl p-3 border border-border"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground">Weekly Attendance</p>
            <Badge className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/60 dark:text-primary-300 dark:border-primary-900">
              This week
            </Badge>
          </div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData}>
                <defs>
                  <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#148281" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#148281" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#148281"
                  strokeWidth={2}
                  fill="url(#attendanceGrad)"
                  dot={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: "10px", padding: "4px 8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  formatter={(v) => [`${v}%`, "Attendance"]}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* AI Insight Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9, ...springs.bouncy }}
          className="relative rounded-xl border-2 border-accent/30 bg-accent/5 p-3 overflow-hidden"
        >
          <div className="absolute inset-0 rounded-xl border border-accent animate-border-glow opacity-50 pointer-events-none" />
          <div className="relative flex items-start gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-bold text-accent">AI Assistance</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Summarises your workforce figures and flags what HR may want to review.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recent Employees */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="space-y-1.5"
        >
          <p className="text-xs font-bold text-foreground px-1">Recent Activity</p>
          {employees.map((emp, i) => (
            <motion.div
              key={emp.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 + i * 0.1, ...springs.smooth }}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: `linear-gradient(135deg, ${colors[i]}, ${colors[i + 1] || colors[0]})` }}
              >
                {emp.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{emp.name}</p>
                <p className="text-[9px] text-muted-foreground">{emp.role}</p>
              </div>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                emp.status === "present" ? "bg-success-light text-success-dark" : "bg-warning-light text-warning-dark"
              )}>
                {emp.status === "present" ? "Present" : "On Leave"}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Compliance Alert */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="flex items-center gap-2.5 bg-danger-light border border-danger/30 rounded-xl px-3 py-2"
        >
          <AlertTriangle className="h-4 w-4 text-danger-dark shrink-0" />
          <p className="text-[10px] font-medium text-danger-dark">
            2 compliance requirements due in 7 days
          </p>
          <button className="ml-auto text-[10px] font-bold text-danger-dark underline">
            Review
          </button>
        </motion.div>
      </motion.div>

      {/* Floating external widgets */}
      <motion.div
        animate={{ y: [-6, 6, -6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-8 top-1/3 bg-surface border border-border rounded-2xl shadow-card px-3 py-2 hidden xl:flex items-center gap-2"
      >
        <div className="h-7 w-7 rounded-lg bg-success-light flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-foreground">Today</p>
          <p className="text-[9px] text-success-dark font-semibold">96.4% Present</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -right-8 bottom-1/3 bg-surface border border-border rounded-2xl shadow-card px-3 py-2 hidden xl:flex items-center gap-2"
      >
        <div className="h-7 w-7 rounded-lg bg-accent-light flex items-center justify-center">
          <Bell className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-foreground">Notifications</p>
          <p className="text-[9px] text-accent font-semibold">8 unread</p>
        </div>
      </motion.div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-block text-xs border", className)}>{children}</span>;
}
