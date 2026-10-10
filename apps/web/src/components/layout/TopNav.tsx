import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Bell, Search, Sun, Moon, Menu, Sparkles,
  Settings, LogOut, User, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppShell } from "./AppShell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { dropdownVariants } from "@/lib/motion";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useTheme } from "@/providers/ThemeProvider";
import { useNotifications, formatUnreadCount } from "@/hooks/useNotifications";
import { GlobalSearch } from "./GlobalSearch";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { api } from "@/services/api";

export function TopNav() {
  const navigate = useNavigate();
  const { setMobileSidebarOpen } = useAppShell();
  const { user, logout } = useAuth();
  const { roleCode } = usePermission();
  const { isDark, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Real notifications — see hooks/useNotifications.ts. Nothing here is mocked.
  const { unreadCount, notifications, isLoading, loadNotifications, markRead } = useNotifications();

  // The count is pushed live (see useNotifications). When it goes UP, ring the
  // bell once and, if the dropdown is open, refresh the list under it.
  const reduceMotion = useReducedMotion();
  const [ring, setRing] = useState(0);
  const lastUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > lastUnread.current) {
      setRing((n) => n + 1);
      if (showNotifications) loadNotifications({ limit: 8 });
    }
    lastUnread.current = unreadCount;
  }, [unreadCount, showNotifications, loadNotifications]);

  /**
   * The "AI Active" badge used to be hard-coded, so HRISense advertised working
   * AI even on a server whose provider key was a placeholder. It now reflects
   * the real configuration state. `/ai/status` is HR-only, so the badge is only
   * fetched (and only shown) for FULL-tier users.
   */
  const isFullTier = user?.permissionTier === "FULL";
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    if (!isFullTier) {
      setAiConfigured(false);
      return;
    }
    let cancelled = false;
    api
      .get("/ai/status")
      .then((res) => {
        if (!cancelled) setAiConfigured(res.data?.data?.available === true);
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isFullTier]);

  const openNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    setShowProfile(false);
    if (next) loadNotifications({ limit: 8 });
  };

  const handleNotificationClick = (notification: { id: string; isRead: boolean; link: string | null }) => {
    if (!notification.isRead) markRead(notification.id);
    setShowNotifications(false);
    if (notification.link) navigate({ to: notification.link as any });
  };

  return (
    <div className="w-full flex items-center justify-between px-4 lg:px-6 gap-4">
      {/* Mobile Menu */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Global Search Bar */}
      <GlobalSearch />

      {/* Right Actions */}
      <div className="flex items-center gap-1 ml-auto">
        {/* AI Badge — shown only when AI Assistance is actually configured */}
        {aiConfigured && (
          <div
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold"
            title="AI Assistance is configured on this server"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            AI Active
          </div>
        )}

        {/* Theme Toggle */}
        <motion.button
          onClick={toggleTheme}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <Sun className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                <Moon className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Quick Actions — the role's shortcuts, on every page */}
        <QuickActionsMenu />

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openNotifications}
            className="relative h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          >
            <motion.span
              key={ring}
              className="inline-flex origin-top"
              animate={ring > 0 && !reduceMotion ? { rotate: [0, -18, 14, -10, 6, 0] } : undefined}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              <Bell className="h-5 w-5" />
            </motion.span>
            {/* Same rule as the sidebar badge: hidden at zero, capped at 99+. */}
            {formatUnreadCount(unreadCount) && (
              <motion.span
                key={unreadCount}
                initial={reduceMotion ? false : { scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="pointer-events-none absolute top-0.5 right-0.5 translate-x-1/3 -translate-y-1/3 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] leading-none font-bold tabular-nums flex items-center justify-center ring-2 ring-topbar-background"
              >
                {formatUnreadCount(unreadCount)}
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  // Phones: pinned under the header with 16px gutters, so it never
                  // runs off the left edge. From `sm` up: anchored to the bell.
                  "fixed left-4 right-4 top-16 z-50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80",
                  "bg-surface border border-border rounded-2xl shadow-card-hover",
                  "overflow-hidden"
                )}
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="font-bold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="primary" size="sm">{unreadCount} new</Badge>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {isLoading ? (
                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</p>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-foreground">You are all caught up</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        New notifications will appear here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted cursor-pointer transition-colors border-b border-border last:border-0",
                          !notif.isRead && "bg-primary-50/50 dark:bg-primary-950/20"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-muted">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-2" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-border text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      navigate({ to: '/notifications' });
                    }}
                    className="text-sm text-primary-600 font-semibold hover:underline dark:text-primary-300"
                  >
                    View all notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowProfile((p) => !p);
              setShowNotifications(false);
            }}
            className={cn(
              "flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl",
              "hover:bg-muted transition-colors cursor-pointer"
            )}
          >
            <Avatar 
              name={user ? `${user.employee.firstName} ${user.employee.lastName}` : "User"} 
              src={user?.employee.photoUrl || undefined}
              size="sm" 
            />
            <div className="hidden md:block text-left min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none truncate max-w-24">
                {user ? user.employee.firstName : "User"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate capitalize">
                {roleCode.replace(/_/g, ' ').toLowerCase()}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
          </motion.button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  "absolute right-0 top-12 w-52 z-50",
                  "bg-surface border border-border rounded-2xl shadow-card-hover",
                  "overflow-hidden p-1"
                )}
              >
                {/* My Profile is everyone's own self-profile (/profile) — not
                    the Employee Management record. */}
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate({ to: '/profile' });
                  }}
                  disabled={!user?.employee?.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-muted-foreground"><User className="h-4 w-4" /></span>
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate({ to: '/settings' });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-foreground"
                >
                  <span className="text-muted-foreground"><Settings className="h-4 w-4" /></span>
                  Settings
                </button>
                <div className="border-t border-border my-1" />
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-danger-light transition-colors text-danger-dark"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
