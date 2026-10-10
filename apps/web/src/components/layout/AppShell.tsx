import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { sidebarVariants } from "@/lib/motion";
import { useAuth } from "@/hooks/useAuth";
import { useThemeScope } from "@/providers/ThemeProvider";
import { AiChatbot } from "./AiChatbot";
import { AiBuddy } from "@/components/ai/AiBuddy";

interface AppShellContextValue {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  /** Left edge of the page content in px (the sidebar's width on desktop, 0 below it). */
  contentOffset: number;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * Which copy of the sidebar is rendering: the desktop `rail` (which can be
 * collapsed to icons) or the phone/tablet `drawer` (always full, never
 * collapsed). The drawer used to share the desktop collapse state: collapsing
 * inside it kept the 260px drawer open but hid every label, leaving full-width
 * invisible link rows under the menu control — the first of which, once the
 * grouped items vanished, was Evaluations.
 */
export type SidebarVariant = "rail" | "drawer";
const SidebarVariantContext = createContext<SidebarVariant>("rail");
export const useSidebarVariant = () => useContext(SidebarVariantContext);

const COLLAPSE_KEY = "hrisense.sidebarCollapsed";

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used within AppShell");
  return ctx;
}

interface AppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  topNav: React.ReactNode;
}

/** Matches the `lg:` breakpoint that shows/hides the desktop sidebar. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function AppShell({ children, sidebar, topNav }: AppShellProps) {
  // Remembered per browser; storage can be unavailable, so it never throws.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  /**
   * The desktop sidebar is `hidden lg:flex`, but the content offset below was a
   * hard-coded 260px applied at EVERY width. Under 1024px the sidebar was gone
   * while the content stayed pushed 260px right, so every authenticated page
   * scrolled horizontally on tablet and phone. The offset now tracks the same
   * breakpoint that governs the sidebar itself.
   */
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // The drawer closes whenever the route changes (a link was followed), when the
  // screen becomes wide enough for the rail, and on Escape.
  useEffect(() => { setMobileSidebarOpen(false); }, [location.pathname]);
  useEffect(() => { if (isDesktop) setMobileSidebarOpen(false); }, [isDesktop]);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? "1" : "0"); } catch { /* storage unavailable */ }
  }, [sidebarCollapsed]);

  /** 0 when the sidebar is not on screen, so the content can use full width. */
  const contentOffset = isDesktop ? (sidebarCollapsed ? 72 : 260) : 0;

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), []);
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), []);

  const { user } = useAuth();

  // Dark mode exists only inside the signed-in app; public pages stay light.
  useThemeScope("account");

  useEffect(() => {
    document.body.classList.add("authenticated-app");
    return () => document.body.classList.remove("authenticated-app");
  }, []);

  return (
    <AppShellContext.Provider
      value={{
        sidebarOpen: !sidebarCollapsed,
        sidebarCollapsed,
        toggleSidebar,
        collapseSidebar,
        expandSidebar,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        contentOffset,
      }}
    >
      <div className="authenticated-app min-h-screen w-full bg-background text-foreground flex">
        {/* Desktop Sidebar */}
        <motion.aside
          variants={sidebarVariants}
          animate={sidebarCollapsed ? "collapsed" : "expanded"}
          className={cn(
            "fixed left-0 top-0 z-30 h-full",
            "hidden lg:flex flex-col",
            "bg-sidebar-background border-r border-border",
            "overflow-hidden"
          )}
        >
          <SidebarVariantContext.Provider value="rail">{sidebar}</SidebarVariantContext.Provider>
        </motion.aside>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                role="dialog"
                aria-modal="true"
                aria-label="Main menu"
                className={cn(
                  "fixed left-0 top-0 z-50 h-full w-[280px] max-w-[85vw]",
                  "flex flex-col",
                  "bg-sidebar-background border-r border-border",
                  "lg:hidden"
                )}
              >
                <SidebarVariantContext.Provider value="drawer">{sidebar}</SidebarVariantContext.Provider>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <motion.div
          className="flex-1 flex flex-col min-h-screen min-w-0"
          animate={{ marginLeft: contentOffset }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ marginLeft: contentOffset }}
        >
          {/* Top Nav */}
          <header
            className={cn(
              "fixed top-0 right-0 z-20 h-16",
              "bg-topbar-background/90 backdrop-blur-md border-b border-border",
              "flex items-center",
              "transition-all duration-300"
            )}
            style={{ left: contentOffset }}
          >
            {topNav}
          </header>

          {/* Page Content */}
          {/* pr/pb leave room for the panel shadow: main scrolls, so a panel flush
              with its edge would have its offset block clipped. */}
          {/* pb-24: the last content can always scroll clear of the floating Ask AI button and the buddy. */}
          <main className="flex-1 pt-16 pr-1 pb-24 overflow-auto min-w-0">
            {children}
          </main>
        </motion.div>

        {/* AI Assistance chat — every signed-in user. The server decides what
            each person may ask about from their own account. */}
        {user && <AiBuddy />}
        {user && <AiChatbot />}
      </div>
    </AppShellContext.Provider>
  );
}
