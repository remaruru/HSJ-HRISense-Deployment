import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggerItem } from "@/lib/motion";
import type { StatCardTone } from "@/components/ui/stat-card";

/**
 * Dashboard KPI tile.
 *
 * `tone` carries the meaning of the number (see StatCardTone) and paints the
 * card from the shared status tokens, so "absent today" on the dashboard and
 * "expired" in Medical use the same red. `iconBg` is the older per-call-site
 * escape hatch and is only consulted when no tone is given.
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  /** @deprecated Ignored: the card no longer shows a percentage/trend chip. */
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  tone?: StatCardTone;
  iconBg?: string;
  className?: string;
  suffix?: string;
  href?: string;
}

const TONE_SURFACE: Record<StatCardTone, string> = {
  total: "bg-status-total-surface border-status-total-border",
  success: "bg-status-success-surface border-status-success-border",
  warning: "bg-status-warning-surface border-status-warning-border",
  danger: "bg-status-danger-surface border-status-danger-border",
  info: "bg-status-info-surface border-status-info-border",
  accent: "bg-status-accent-surface border-status-accent-border",
  neutral: "bg-surface border-border-soft",
};

const TONE_CHIP: Record<StatCardTone, string> = {
  total: "bg-status-total-foreground/10 text-status-total-foreground",
  success: "bg-status-success-foreground/10 text-status-success-foreground",
  warning: "bg-status-warning-foreground/10 text-status-warning-foreground",
  danger: "bg-status-danger-foreground/10 text-status-danger-foreground",
  info: "bg-status-info-foreground/10 text-status-info-foreground",
  accent: "bg-status-accent-foreground/10 text-status-accent-foreground",
  neutral: "bg-status-neutral-foreground/10 text-status-neutral-foreground",
};

const TONE_VALUE: Record<StatCardTone, string> = {
  total: "text-status-total-foreground",
  success: "text-status-success-foreground",
  warning: "text-status-warning-foreground",
  danger: "text-status-danger-foreground",
  info: "text-status-info-foreground",
  accent: "text-status-accent-foreground",
  neutral: "text-foreground",
};

export function MetricCard({
  title,
  value,
  changeLabel,
  icon,
  tone,
  iconBg = "bg-primary-100 dark:bg-primary-900/60",
  className,
  suffix,
}: MetricCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }}
      className={cn(
        // Soft tinted panel instead of the hard 2px border + offset shadow.
        "rounded-2xl border p-5 shadow-card transition-shadow hover:shadow-card-hover",
        tone ? TONE_SURFACE[tone] : "bg-surface border-border-soft",
        "cursor-pointer group",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 [&_svg]:size-5",
          "transition-transform duration-300 group-hover:scale-110",
          tone ? TONE_CHIP[tone] : iconBg
        )}>
          {icon}
        </div>

      </div>

      <div className="mt-4">
        <p className={cn(
          "text-4xl font-bold font-heading tracking-tight tabular-nums",
          tone ? TONE_VALUE[tone] : "text-foreground"
        )}>
          {value}
          {suffix && <span className="text-lg text-muted-foreground ml-1">{suffix}</span>}
        </p>
        <p className="text-sm text-foreground/80 mt-1 font-semibold">{title}</p>
        {changeLabel && (
          // 70% of the card's own text colour: ≥5.5:1 on every Hospicio fill,
          // where grey muted text measured 3.2:1.
          <p className="text-xs text-foreground/70 mt-0.5">{changeLabel}</p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Welcome Banner ─────────────────────────────────────────────── */
interface WelcomeBannerProps {
  name: string;
  role: string;
  date?: Date;
}

export function WelcomeBanner({ name, role, date = new Date() }: WelcomeBannerProps) {
  const hour = date.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";

  const dayName = date.toLocaleDateString("en-PH", { weekday: "long" });
  const fullDate = date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-900",
        "bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800",
        "px-6 py-5 text-white"
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-surface/5 blur-2xl" />
      <div className="absolute -right-4 -bottom-6 h-32 w-32 rounded-full bg-primary-400/20" />
      <div className="absolute top-4 right-16 h-6 w-6 rounded-full bg-surface/10 animate-float" />
      <div className="absolute bottom-4 right-8 h-4 w-4 rounded-full bg-primary-300/40 animate-float-slow" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl" role="img" aria-label={greeting}>{emoji}</span>
            <p className="text-sm font-medium text-primary-100">{greeting}</p>
          </div>
          <h2 className="text-xl font-bold font-heading">
            Welcome back, {name}!
          </h2>
          <p className="text-sm text-primary-200 mt-0.5">{role} · Hospicio de San Jose</p>
        </div>

        <div className="text-right sm:text-right shrink-0">
          <p className="text-2xl font-bold font-heading">{dayName}</p>
          <p className="text-sm text-primary-200">{fullDate}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Quick Action Card ──────────────────────────────────────────── */
interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  color?: string;
}

export function QuickAction({ label, icon, onClick, color = "bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300" }: QuickActionProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2, transition: { type: "spring", stiffness: 400, damping: 20 } }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-border bg-surface",
        "hover:border-primary-400 hover:shadow-card transition-all duration-200",
        "text-center cursor-pointer"
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-foreground">{label}</p>
    </motion.button>
  );
}
