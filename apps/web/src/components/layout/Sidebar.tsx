import { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { api } from "@/services/api";
import {
  LayoutDashboard, Users, UserPlus, Clock, CalendarDays,
  BarChart3, BookOpen, ShieldCheck, Heart, Brain,
  TrendingUp, Megaphone, Bell, Settings, FileText, Archive,
  HelpCircle, ChevronRight, Search,
  Activity, Stethoscope, FlaskConical, PanelLeftClose, PanelLeftOpen, X,
  CircleUserRound, UsersRound, Trophy, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProtectedImage } from "@/components/ui/ProtectedImage";
import { useAppShell, useSidebarVariant } from "./AppShell";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useAnnouncementUnread } from "@/hooks/useAnnouncementUnread";
import { useNotifications, formatUnreadCount } from "@/hooks/useNotifications";

/* ─── Navigation Structure Types ──────────────────────────────── */
interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "danger" | "ai";
  children?: NavItem[];
  /** Also active on the pages beneath it (My Team → a team member's profile). */
  matchNested?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* ─── Shared helpers ─────────────────────────────────────────────── */
const isPathActive = (pathname: string, href?: string, nested = false) =>
  href ? pathname === href || (nested && pathname.startsWith(`${href}/`)) : false;
const isGroupActive = (pathname: string, item: NavItem) =>
  item.children?.some((c) => (c.href ? pathname === c.href || pathname.startsWith(`${c.href}/`) : false)) ?? false;

/** Following a link inside the phone/tablet drawer closes it. */
function useCloseDrawerOnNavigate() {
  const { setMobileSidebarOpen } = useAppShell();
  const variant = useSidebarVariant();
  return () => { if (variant === "drawer") setMobileSidebarOpen(false); };
}

/* ─── Full-width item (expanded rail and the drawer) ─────────────────── */
function SidebarItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const closeDrawer = useCloseDrawerOnNavigate();
  const hasChildren = !!item.children?.length;
  const isActive = isPathActive(location.pathname, item.href, item.matchNested);
  const isChildActive = isGroupActive(location.pathname, item);
  // A group opens by itself when the current page is inside it.
  const [isOpen, setIsOpen] = useState(isChildActive);
  useEffect(() => { if (isChildActive) setIsOpen(true); }, [isChildActive]);

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          aria-expanded={isOpen}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
            "transition-colors duration-150",
            "hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300",
            isChildActive ? "text-primary-700 dark:text-primary-300" : "text-foreground"
          )}
        >
          <span className={cn(
            "shrink-0 h-8 w-8 flex items-center justify-center rounded-lg",
            isChildActive ? "bg-primary-100 text-primary-600 dark:bg-primary-900/60 dark:text-primary-300" : "text-muted-foreground"
          )}>
            {item.icon}
          </span>
          <span className="flex-1 text-left font-medium truncate">{item.label}</span>
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden ml-4 pl-3 border-l-2 border-primary-100 mt-0.5 space-y-0.5 dark:border-primary-900"
            >
              {item.children?.map((child) => <SidebarItem key={child.label} item={child} />)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (!item.href) return null;
  return (
    <Link
      to={item.href}
      onClick={closeDrawer}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
        "transition-colors duration-150 group",
        "hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300",
        // Hospicio colour code: #b9e0de for the selected item.
        isActive ? "bg-nav-selected-surface text-nav-selected-foreground font-semibold" : "text-foreground"
      )}
    >
      <span className={cn(
        "shrink-0 h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
        isActive
          ? "bg-white/55 text-nav-selected-foreground dark:bg-white/10"
          : "text-muted-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300"
      )}>
        {item.icon}
      </span>
      <span className="flex-1 truncate font-medium">{item.label}</span>
      {item.badge !== undefined && <BadgeChip badge={item.badge} variant={item.badgeVariant} isActive={isActive} />}
    </Link>
  );
}

/* ─── Collapsed rail item: one 40×40 target per icon, never overlapping ─ */
const RAIL_TARGET =
  "relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

function RailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-[60] rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-card"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function RailBadge({ badge, variant }: { badge: string | number; variant?: "default" | "danger" | "ai" }) {
  if (variant === "ai") return null; // the AI tag is a label, not a count
  return (
    <span
      className={cn(
        "pointer-events-none absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full",
        "text-[10px] font-bold leading-4 text-center ring-2 ring-sidebar-background",
        variant === "danger" ? "bg-danger text-white" : "bg-muted text-muted-foreground"
      )}
    >
      {badge}
    </span>
  );
}

function RailItem({ item }: { item: NavItem }) {
  const location = useLocation();
  const hasChildren = !!item.children?.length;

  if (hasChildren) {
    const active = isGroupActive(location.pathname, item);
    // A group opens a flyout of its pages instead of disappearing.
    return (
      <DropdownMenu.Root modal={false}>
        <RailTooltip label={item.label}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={item.label}
              className={cn(
                RAIL_TARGET,
                active
                  ? "bg-nav-selected-surface text-nav-selected-foreground"
                  : "text-muted-foreground hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300",
                "data-[state=open]:bg-primary-50 data-[state=open]:text-primary-700 dark:data-[state=open]:bg-primary-900/40 dark:data-[state=open]:text-primary-300"
              )}
            >
              {item.icon}
            </button>
          </DropdownMenu.Trigger>
        </RailTooltip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={8}
            className="z-[60] min-w-[200px] rounded-2xl border border-border-soft bg-surface p-1.5 shadow-card-hover"
          >
            <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </DropdownMenu.Label>
            {item.children!.map((child) => {
              const childActive = isPathActive(location.pathname, child.href);
              return (
                <DropdownMenu.Item key={child.label} asChild>
                  <Link
                    to={child.href!}
                    aria-current={childActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium outline-none",
                      "data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700 dark:data-[highlighted]:bg-primary-900/40 dark:data-[highlighted]:text-primary-300",
                      childActive ? "bg-nav-selected-surface text-nav-selected-foreground" : "text-foreground"
                    )}
                  >
                    <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{child.icon}</span>
                    <span className="flex-1 truncate">{child.label}</span>
                    {child.badge !== undefined && <BadgeChip badge={child.badge} variant={child.badgeVariant} isActive={childActive} />}
                  </Link>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  if (!item.href) return null;
  const active = isPathActive(location.pathname, item.href, item.matchNested);
  return (
    <RailTooltip label={item.label}>
      <Link
        to={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          RAIL_TARGET,
          active
            ? "bg-nav-selected-surface text-nav-selected-foreground"
            : "text-muted-foreground hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/40 dark:hover:text-primary-300"
        )}
      >
        {item.icon}
        {item.badge !== undefined && <RailBadge badge={item.badge} variant={item.badgeVariant} />}
      </Link>
    </RailTooltip>
  );
}

function BadgeChip({
  badge,
  variant = "default",
  isActive,
}: {
  badge: string | number;
  variant?: "default" | "danger" | "ai";
  isActive?: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center",
        variant === "danger" && "bg-danger text-white",
        variant === "ai" && "bg-accent text-white",
        variant === "default" && !isActive && "bg-muted text-muted-foreground",
        variant === "default" && isActive && "bg-white/60 text-nav-selected-foreground dark:bg-white/10",
      )}
    >
      {badge}
    </span>
  );
}

/* ─── Main Sidebar ──────────────────────────────────────────────── */
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setMobileSidebarOpen } = useAppShell();
  const variant = useSidebarVariant();
  // Only the desktop rail collapses; the drawer is always the full menu.
  const collapsed = variant === "rail" && sidebarCollapsed;
  const [searchQuery, setSearchQuery] = useState("");
  const [draftCount, setDraftCount] = useState<number>(0);
  const [archivedCount, setArchivedCount] = useState<number>(0);
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const { unreadCount: announcementUnreadCount } = useAnnouncementUnread();
  const { unreadCount: notificationUnreadCount } = useNotifications();

  useEffect(() => {
    if (user?.permissionTier === "FULL") {
      api.get("/onboarding-drafts?status=DRAFT")
        .then((res) => setDraftCount((res.data?.data || []).length))
        .catch(() => setDraftCount(0));

      api.get("/employees?isArchived=true&limit=1")
        .then((res) => setArchivedCount(res.data?.total || 0))
        .catch(() => setArchivedCount(0));
    }
  }, [user]);

  const navigationGroups: NavGroup[] = [
    {
      label: "",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: <LayoutDashboard className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          // Everyone's own record — never through Employee Management.
          label: "My Profile",
          href: "/profile",
          icon: <CircleUserRound className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
      ],
    },
    {
      label: "People & Organization",
      items: [
        {
          // Supervisors: the employees who report directly to them.
          label: "My Team",
          href: "/my-team",
          matchNested: true,
          icon: <UsersRound className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Employees",
          icon: <Users className="h-4.5 w-4.5" strokeWidth={2.5} />,
          children: [
            { label: "All Employees", href: "/employees", icon: <Users className="h-4 w-4" /> },
            { label: "Add Employee", href: "/employees/onboard", icon: <UserPlus className="h-4 w-4" /> },
            { label: "Draft Employees", href: "/employees/drafts", icon: <FileText className="h-4 w-4" />, badge: draftCount > 0 ? draftCount : undefined },
            { label: "Archived Employees", href: "/employees/archived", icon: <Archive className="h-4 w-4" />, badge: archivedCount > 0 ? archivedCount : undefined },
            { label: "Org Chart", href: "/employees/org-chart", icon: <Activity className="h-4 w-4" /> },
          ],
        },
        ...(hasPermission("recruitment", "view") ? [{
          label: "Recruitment",
          icon: <UserPlus className="h-4.5 w-4.5" strokeWidth={2.5} />,
          children: [
            { label: "Overview", href: "/recruitment", icon: <BarChart3 className="h-4 w-4" /> },
            { label: "Job Openings", href: "/recruitment/openings", icon: <FileText className="h-4 w-4" /> },
            { label: "Applicants", href: "/recruitment/applicants", icon: <Users className="h-4 w-4" /> },
          ]
        }] : []),
      ],
    },
    {
      label: "Time & Attendance",
      items: [
        {
          label: "Attendance",
          icon: <Clock className="h-4.5 w-4.5" strokeWidth={2.5} />,
          children: [
            { label: 'Daily Monitoring', href: '/attendance/daily', icon: <Clock className="h-4 w-4" /> },
            { label: 'Attendance Tally', href: '/attendance/tally', icon: <BarChart3 className="h-4 w-4" /> },
            { label: 'Holiday Calendar', href: '/attendance/holiday-calendar', icon: <CalendarDays className="h-4 w-4" /> },
            { label: 'Work Schedule', href: '/attendance/schedule', icon: <CalendarDays className="h-4 w-4" /> },
          ],
        },
        {
          label: "Leave Management",
          icon: <CalendarDays className="h-4.5 w-4.5" strokeWidth={2.5} />,
          children: [
            { label: "Leave Requests", href: "/leave/requests", icon: <CalendarDays className="h-4 w-4" /> },
            { label: "Leave Calendar", href: "/leave/calendar", icon: <CalendarDays className="h-4 w-4" /> },
            { label: "New Request", href: "/leave/new", icon: <CalendarDays className="h-4 w-4" /> },
          ],
        },
      ],
    },

    {
      label: "Performance",
      items: [
        {
          label: "Evaluations",
          href: "/evaluations",
          icon: <BarChart3 className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Training & Seminars",
          href: "/training",
          icon: <BookOpen className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Awards & Recognition",
          href: "/awards",
          icon: <Trophy className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Yearly Achievements",
          href: "/achievements",
          icon: <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
      ],
    },
    {
      label: "Health & Compliance",
      items: [
        {
          label: "Compliance",
          href: "/compliance",
          icon: <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Medical Records",
          href: "/medical",
          icon: <Stethoscope className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Psychological",
          href: "/psychological",
          icon: <Brain className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
      ],
    },
    {
      label: "AI & Analytics",
      items: [
        {
          label: "AI Assistance",
          href: "/ai-assistance",
          icon: <FlaskConical className="h-4.5 w-4.5" strokeWidth={2.5} />,
          badge: "AI",
          badgeVariant: "ai",
        },
        {
          label: "Reports & Analytics",
          href: "/reports",
          icon: <TrendingUp className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
      ],
    },
    {
      label: "Communication",
      items: [
        {
          label: "Announcements",
          href: "/announcements",
          icon: <Megaphone className="h-4.5 w-4.5" strokeWidth={2.5} />,
          badge:
            announcementUnreadCount > 0
              ? announcementUnreadCount > 99
                ? "99+"
                : announcementUnreadCount
              : undefined,
          badgeVariant: "danger",
        },
        {
          label: "Notifications",
          href: "/notifications",
          icon: <Bell className="h-4.5 w-4.5" strokeWidth={2.5} />,
          // Real unread count from GET /notifications/unread-count.
          badge: formatUnreadCount(notificationUnreadCount),
          badgeVariant: "danger",
        },
      ],
    },
    {
      label: "Administration",
      items: [
        {
          label: "Audit Logs",
          href: "/audit",
          icon: <FileText className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Settings",
          href: "/settings",
          icon: <Settings className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
        {
          label: "Help Center",
          href: "/help-center",
          icon: <HelpCircle className="h-4.5 w-4.5" strokeWidth={2.5} />,
        },
      ],
    },
  ];

  const isAllowed = (item: NavItem): boolean => {
    if (item.href === "/my-team") {
      return user?.permissionTier === "SUPERVISOR";
    }
    if (
      item.href === "/dashboard" ||
      item.href === "/profile" ||
      item.href === "/settings" ||
      item.href === "/help" ||
      item.href === "/help-center" ||
      item.href === "/notifications" ||
      item.href === "/announcements"
    ) {
      return true;
    }

    if (item.href) {
      if (
        item.href === "/employees/onboard" ||
        item.href === "/employees/drafts" ||
        item.href === "/employees/archived"
      ) {
        return user?.permissionTier === "FULL";
      }
      if (item.href.startsWith("/employees")) {
        return hasPermission("employee", "read");
      }
      if (item.href.startsWith("/recruitment")) {
        return hasPermission("employee", "read");
      }
      if (item.href === "/attendance/import") {
        // Reading attendance is tiered; importing it is not. An import rewrites
        // records for the whole organisation, so it stays with HR.
        return user?.permissionTier === "FULL";
      }
      if (item.href.startsWith("/attendance")) {
        return hasPermission("attendance", "read") || hasPermission("attendance_log", "read");
      }
      if (item.href.startsWith("/leave")) {
        return hasPermission("leave", "read");
      }
      if (item.href.startsWith("/performance")) {
        return hasPermission("performance", "read") || hasPermission("profile", "read");
      }
      if (item.href.startsWith("/training")) {
        return hasPermission("training", "read");
      }
      if (item.href.startsWith("/compliance")) {
        return hasPermission("compliance", "read");
      }
      if (item.href.startsWith("/medical")) {
        return hasPermission("medical", "read");
      }
      if (item.href.startsWith("/psychological")) {
        return hasPermission("psychological", "read");
      }
      if (item.href.startsWith("/ai")) {
        // The assistant is for everyone; the server scopes every answer to the
        // signed-in user's own access.
        return true;
      }
      if (item.href.startsWith("/reports")) {
        return hasPermission("reports", "read");
      }
      if (item.href.startsWith("/audit")) {
        return hasPermission("audit", "read");
      }
    }

    if (item.children) {
      return item.children.some((child) => isAllowed(child));
    }

    return true;
  };

  const filteredGroups = navigationGroups
    .map((group) => {
      const allowedItems = group.items
        .map((item) => {
          if (item.children) {
            const allowedChildren = item.children.filter((child) => isAllowed(child));
            return { ...item, children: allowedChildren };
          }
          return item;
        })
        .filter((item) => {
          if (item.children && item.children.length === 0) {
            return false;
          }
          return isAllowed(item);
        });

      return { ...group, items: allowedItems };
    })
    .filter((group) => group.items.length > 0);

  const firstName = user?.employee?.firstName || "User";
  const lastName = user?.employee?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const roleTitle = user?.employee?.jobRole?.title || "Employee";
  const initials = `${firstName[0] || "U"}${lastName[0] || ""}`;

  // The search box narrows the menu by page name (groups keep matching children).
  const q = searchQuery.trim().toLowerCase();
  const visibleGroups = !q
    ? filteredGroups
    : filteredGroups
        .map((group) => ({
          ...group,
          items: group.items
            .map((item) =>
              item.children
                ? { ...item, children: item.label.toLowerCase().includes(q) ? item.children : item.children.filter((c) => c.label.toLowerCase().includes(q)) }
                : item
            )
            .filter((item) => (item.children ? item.children.length > 0 : item.label.toLowerCase().includes(q))),
        }))
        .filter((group) => group.items.length > 0);

  const avatar = (
    <ProtectedImage
      src={user?.employee?.photoUrl}
      alt={fullName}
      className="h-8 w-8 rounded-full object-cover shrink-0"
      fallback={(
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
      )}
    />
  );

  // ── Collapsed desktop rail ─────────────────────────────────────────────
  if (collapsed) {
    return (
      <Tooltip.Provider>
        <div className="flex flex-col h-full w-full">
          <div className="flex flex-col items-center gap-2 border-b border-border py-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-pop-color" aria-hidden="true">
              <Heart className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <RailTooltip label="Expand sidebar">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSidebar(); }}
                aria-label="Expand sidebar"
                className={cn(RAIL_TARGET, "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </RailTooltip>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto no-scrollbar py-2">
            {filteredGroups.map((group, gi) => (
              <div key={group.label || `group-${gi}`} className="flex flex-col gap-1">
                {gi > 0 && <div className="mx-auto my-1.5 h-px w-8 bg-border" aria-hidden="true" />}
                {group.items.map((item) => <RailItem key={item.label} item={item} />)}
              </div>
            ))}
          </nav>

          <div className="border-t border-border py-3 flex justify-center shrink-0">
            <RailTooltip label={`${fullName} · ${roleTitle}`}>
              <span className="rounded-full" tabIndex={0} aria-label={`${fullName}, ${roleTitle}`}>{avatar}</span>
            </RailTooltip>
          </div>
        </div>
      </Tooltip.Provider>
    );
  }

  // ── Expanded rail, and the phone/tablet drawer ─────────────────────────
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-pop-color shrink-0" aria-hidden="true">
          <Heart className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-none font-heading truncate">HRISense</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">Hospicio de San Jose</p>
        </div>
        {variant === "drawer" ? (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileSidebarOpen(false); }}
            aria-label="Close menu"
            className="ml-auto shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSidebar(); }}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search the menu"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-8 pr-3 py-2 text-sm rounded-lg",
              "bg-muted border border-border",
              "focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400",
              "text-foreground placeholder:text-muted-foreground"
            )}
          />
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto no-scrollbar px-3 py-2 space-y-1">
        {visibleGroups.map((group, gi) => (
          <div key={group.label || `group-${gi}`} className="space-y-0.5">
            {group.label && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pt-3 pb-1.5">
                {group.label}
              </p>
            )}
            {group.items.map((item) => <SidebarItem key={item.label} item={item} />)}
          </div>
        ))}
        {q && visibleGroups.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">No menu item matches “{searchQuery}”.</p>
        )}
      </nav>

      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-3 p-2 rounded-xl">
          {avatar}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{roleTitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
