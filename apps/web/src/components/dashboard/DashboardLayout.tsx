import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { AnnouncementsWidget } from "@/components/shared/AnnouncementsWidget";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { CalendarNotes } from "./CalendarNotes";
import type { DashboardOverview } from "@/hooks/useDashboardOverview";

/**
 * One layout for the HR, Supervisor and Employee dashboards, top to bottom:
 *
 *   1. Announcements — the first thing on the page
 *   2. Welcome container: greeting, PHT clock in the corner, and the role's
 *      summary cards inside it (Quick Actions live in the top bar, ⚡)
 *   3. The role's own content, then My Calendar
 *
 * To Do + Recent Activity (HR: Recent Activity only) is its own column pinned
 * to the right from `xl`: a rounded container with a small gap above and to its
 * right, ending just above the Ask AI launcher so the launcher never sits on
 * the last row. The page reserves that width, so everything else narrows to
 * make room. Below `xl` the same rail sits in the flow right under the welcome
 * container.
 *
 * The rail is `position: fixed`, which only works while no ancestor has a
 * transform — `staggerContainer` animates opacity only, so it is safe here.
 */
export function DashboardLayout({
  name,
  role,
  kpis,
  overview,
  overviewLoading,
  overviewError,
  onActivityChange,
  showTodo = true,
  children,
}: {
  name: string;
  role: string;
  kpis: React.ReactNode;
  overview: DashboardOverview | null;
  overviewLoading: boolean;
  overviewError: string | null;
  /** Called after the calendar changes something, so the rail can refresh. */
  onActivityChange?: () => void;
  showTodo?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-4 sm:p-6 space-y-5 xl:pr-[336px] 2xl:pr-[376px]"
    >
      <motion.div variants={staggerItem}>
        <AnnouncementsWidget />
      </motion.div>

      <motion.div variants={staggerItem}>
        <DashboardHeader name={name} role={role}>
          {kpis}
        </DashboardHeader>
      </motion.div>

      <motion.aside
        variants={staggerItem}
        aria-label={showTodo ? "To do and recent activity" : "Recent activity"}
        className="min-w-0 xl:fixed xl:right-3 xl:top-[76px] xl:bottom-[88px] xl:z-10 xl:my-0 xl:w-[300px] 2xl:w-[340px] xl:overflow-y-auto no-scrollbar xl:rounded-2xl xl:border xl:border-border-soft xl:bg-surface xl:shadow-card xl:pb-2"
      >
        <DashboardSidebar
          todo={overview?.todo ?? []}
          activity={overview?.activity ?? []}
          isLoading={overviewLoading}
          error={overviewError}
          showTodo={showTodo}
        />
      </motion.aside>

      <motion.div variants={staggerItem} className="space-y-5 min-w-0">
        {children}
        <CalendarNotes onChange={onActivityChange} />
      </motion.div>
    </motion.div>
  );
}
