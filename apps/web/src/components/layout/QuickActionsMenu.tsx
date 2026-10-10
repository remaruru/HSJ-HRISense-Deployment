import { useNavigate } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BarChart3, BookOpen, CalendarClock, CalendarDays, ClipboardCheck, Clock,
  GraduationCap, Megaphone, ShieldCheck, Sparkles, User, UserPlus, Users, Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";

interface QuickActionItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  /** Optional one-line explanation shown under the label. */
  hint?: string;
}

const HR_ACTIONS: QuickActionItem[] = [
  { label: "Add Employee", to: "/employees/onboard", icon: <UserPlus />, hint: "Start onboarding" },
  { label: "Leave Requests", to: "/leave/requests", icon: <CalendarDays />, hint: "Review and decide" },
  { label: "Compliance", to: "/compliance", icon: <ShieldCheck />, hint: "Requirements and records" },
  { label: "Attendance", to: "/attendance/daily", icon: <Clock />, hint: "Daily monitoring" },
  { label: "Training", to: "/training", icon: <BookOpen /> },
  { label: "Reports", to: "/reports", icon: <BarChart3 /> },
  { label: "Announcements", to: "/announcements", icon: <Megaphone /> },
  { label: "AI Assistance", to: "/ai-assistance", icon: <Sparkles /> },
];

const SUPERVISOR_ACTIONS: QuickActionItem[] = [
  { label: "My Team", to: "/my-team", icon: <Users />, hint: "Your direct reports" },
  { label: "Leave Requests", to: "/leave/requests", icon: <CalendarDays />, hint: "Endorse your team's leave" },
  { label: "Team Attendance", to: "/attendance", icon: <Clock /> },
  { label: "Schedules", to: "/attendance/schedule", icon: <CalendarClock /> },
  { label: "Evaluations", to: "/evaluations", icon: <ClipboardCheck /> },
  { label: "Training", to: "/training", icon: <GraduationCap /> },
  { label: "Announcements", to: "/announcements", icon: <Megaphone /> },
  { label: "AI Assistance", to: "/ai-assistance", icon: <Sparkles />, hint: "Ask about your team" },
];

function employeeActions(employeeId: string | undefined): QuickActionItem[] {
  return [
    { label: "File Leave Request", to: "/leave/new", icon: <CalendarDays />, hint: "Request time off" },
    ...(employeeId
      ? [{ label: "My Profile", to: "/profile", icon: <User />, hint: "Records and requirements" }]
      : []),
    { label: "My Schedule", to: "/attendance/schedule", icon: <CalendarClock /> },
    { label: "Training & Seminars", to: "/training", icon: <BookOpen /> },
    { label: "Announcements", to: "/announcements", icon: <Megaphone /> },
    { label: "AI Assistance", to: "/ai-assistance", icon: <Sparkles />, hint: "Ask about your records" },
  ];
}

/**
 * Quick Actions — a ⚡ button in the top bar, next to the theme switch and the
 * bell, so the role's shortcuts are one click away on every page rather than
 * only on the dashboard. The list follows the same tiers as the dashboard.
 */
export function QuickActionsMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier } = usePermission();
  const actions =
    tier === "FULL" ? HR_ACTIONS : tier === "SUPERVISOR" ? SUPERVISOR_ACTIONS : employeeActions(user?.employee?.id);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Quick actions"
          title="Quick actions"
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "data-[state=open]:bg-nav-selected-surface data-[state=open]:text-nav-selected-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          )}
        >
          <Zap className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          collisionPadding={16}
          className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-soft bg-surface p-1.5 shadow-card-hover data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DropdownMenu.Label className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Quick actions
          </DropdownMenu.Label>
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action.label}
              onSelect={() => navigate({ to: action.to as any })}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer outline-none",
                "text-sm font-medium text-foreground",
                "data-[highlighted]:bg-nav-selected-surface data-[highlighted]:text-nav-selected-foreground"
              )}
            >
              <span className="h-8 w-8 shrink-0 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 flex items-center justify-center [&_svg]:size-4">
                {action.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{action.label}</span>
                {action.hint && <span className="block text-xs text-muted-foreground truncate">{action.hint}</span>}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
