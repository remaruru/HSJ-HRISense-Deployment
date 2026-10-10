import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays, ShieldCheck, ClipboardCheck, UserPlus, GraduationCap,
  X, Activity, RotateCcw, ListTodo, StickyNote, MessagesSquare, FileHeart,
  CalendarHeart, FilePen, Network, CalendarClock,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityItem, OverviewTone, TodoItem } from "@/hooks/useDashboardOverview";

/**
 * Right-hand dashboard rail: "To Do" (things waiting on this person) above
 * "Recent Activity" (what just happened) — laid out like the Canvas To Do list:
 * icon · linked title · context · date · ✕.
 *
 * Below `xl` the sections are ordinary cards in the page flow; from `xl` the
 * rail is its own full-height column (see DashboardLayout), so the sections
 * go flat and are divided by rules instead of boxed.
 *
 * Recent Activity lists only what the signed-in person did (the server never
 * sends anyone else's actions) as one history grouped under Today, Yesterday
 * and dated headings, with "See all" for the full, paged history.
 *
 * ✕ hides an item for this person on this browser. It never changes the
 * underlying record: a hidden leave request is still pending, so hidden items
 * can always be brought back with "Show hidden".
 */

const KIND_ICON: Record<TodoItem["kind"], React.ReactNode> = {
  leave: <CalendarDays />,
  compliance: <ShieldCheck />,
  evaluation: <ClipboardCheck />,
  application: <UserPlus />,
  training: <GraduationCap />,
  note: <StickyNote />,
  interview: <MessagesSquare />,
  record: <FileHeart />,
  holiday: <CalendarHeart />,
  onboarding: <FilePen />,
  supervisor: <Network />,
};

/** Hospicio colour code, by meaning. */
const TONE_CHIP: Record<OverviewTone, string> = {
  danger: "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
  warning: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
  review: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
  positive: "bg-status-success-surface text-status-success-foreground border-status-success-border",
  neutral: "bg-surface-2 text-muted-foreground border-border-soft",
};

function useDismissed(list: "todo" | "activity") {
  const { user } = useAuth();
  const key = `hrisense:dashboard-hidden:${list}:${user?.id ?? "anon"}`;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setHidden(new Set(JSON.parse(localStorage.getItem(key) ?? "[]")));
    } catch {
      setHidden(new Set());
    }
  }, [key]);

  const persist = (next: Set<string>) => {
    setHidden(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      /* private mode / blocked storage — hiding just lasts for this visit */
    }
  };

  return {
    hidden,
    hide: (id: string) => persist(new Set(hidden).add(id)),
    restore: () => persist(new Set()),
  };
}

function RailSection({
  title,
  icon,
  count,
  action,
  children,
  footer,
  flush,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  /** Right-aligned header control, e.g. "See all". */
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** No inner padding — for lists that draw their own edge-to-edge rows. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border-soft bg-surface shadow-card",
        "xl:rounded-none xl:border-0 xl:border-b xl:shadow-none xl:bg-transparent xl:last:border-b-0"
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border-soft xl:px-5 xl:pt-5">
        <span className="text-primary-600 dark:text-primary-300 [&_svg]:size-5" aria-hidden="true">{icon}</span>
        <h2 className="text-base font-bold font-heading text-foreground">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="ml-auto rounded-full bg-surface-2 border border-border-soft px-2 py-0.5 text-xs font-bold text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
        {action}
      </div>
      <div className={flush ? "" : "p-2 xl:px-3"}>{children}</div>
      {footer && <div className="px-4 pb-3 xl:px-5">{footer}</div>}
    </section>
  );
}

function RailItem({
  icon,
  iconClass,
  title,
  lines,
  onOpen,
  onDismiss,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  lines: string[];
  onOpen?: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2 transition-colors">
      <span
        aria-hidden="true"
        className={cn("mt-0.5 h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center [&_svg]:size-4", iconClass)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="max-w-full line-clamp-2 break-words text-left text-sm font-semibold text-primary-700 dark:text-primary-300 underline underline-offset-2 decoration-primary-300/60 hover:decoration-primary-600"
            title={title}
          >
            {title}
          </button>
        ) : (
          <p className="line-clamp-2 break-words text-sm font-semibold text-foreground" title={title}>{title}</p>
        )}
        {lines.filter(Boolean).map((line, i) => (
          <p key={i} className={cn("text-xs leading-snug", i === 0 ? "text-foreground/80 font-medium mt-0.5 line-clamp-2" : "text-muted-foreground mt-0.5")}>
            {line}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Hide "${title}"`}
        title="Hide"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

function HiddenFooter({ count, onRestore }: { count: number; onRestore: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onRestore}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Show {count} hidden
    </button>
  );
}

// ── Recent Activity: your own history, grouped by day ───────────────────────
//
// One continuous list, newest first, under "Today", "Yesterday" and dated
// headings (Sep 19, 2026) — each entry shows its time above what you did.

/** Entries shown in the rail; the header's "See all" opens the full history. */
const RAIL_ACTIVITY_LIMIT = 8;
const HISTORY_PAGE = 30;

const phtDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
const phtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const shiftDay = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const longDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

function groupByDay(items: ActivityItem[], today: string) {
  const yesterday = shiftDay(today, -1);
  const groups: Array<{ day: string; label: string; items: ActivityItem[] }> = [];
  for (const item of items) {
    const day = phtDay(new Date(item.at));
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, label: day === today ? "Today" : day === yesterday ? "Yesterday" : longDay(day), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** A grey band with the day, spanning the list's full width. */
function DayHeading({ label, sticky }: { label: string; sticky?: boolean }) {
  return (
    <div
      className={cn(
        "bg-surface-2 px-4 py-2 text-sm font-bold font-heading text-foreground border-y border-border-soft",
        sticky && "sticky top-0 z-10"
      )}
    >
      {label}
    </div>
  );
}

/** Time on top, what you did underneath — like a transaction history. */
function ActivityRow({
  item,
  onOpen,
  onDismiss,
}: {
  item: ActivityItem;
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  const body = (
    <>
      <span className="block text-xs font-medium text-muted-foreground tabular-nums">{phtTime(item.at)}</span>
      <span className="mt-0.5 block text-sm font-semibold text-foreground break-words">{item.title}</span>
      {item.context && <span className="mt-0.5 block text-xs text-muted-foreground break-words">{item.context}</span>}
    </>
  );
  return (
    <li className="group relative border-b border-border-soft last:border-b-0">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full px-4 py-3 pr-10 text-left hover:bg-surface-2/70 transition-colors" title="Open">
          {body}
        </button>
      ) : (
        <div className="px-4 py-3 pr-10">{body}</div>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Hide "${item.title}"`}
          title="Hide"
          // Quiet but always present: hover-only controls cannot be reached by
          // touch, and this is the only way to dismiss a row.
          className="absolute right-2 top-3 rounded-lg p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-surface focus-visible:text-foreground transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function GroupedActivity({
  items,
  today,
  stickyHeadings,
  onOpen,
  onDismiss,
}: {
  items: ActivityItem[];
  today: string;
  stickyHeadings?: boolean;
  onOpen: (item: ActivityItem) => (() => void) | undefined;
  onDismiss?: (item: ActivityItem) => void;
}) {
  return (
    <div>
      {groupByDay(items, today).map((group) => (
        <section key={group.day} aria-label={group.label}>
          <DayHeading label={group.label} sticky={stickyHeadings} />
          <ul>
            {group.items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                onOpen={onOpen(item)}
                onDismiss={onDismiss ? () => onDismiss(item) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** "See all": your whole history, a page at a time, optionally from a chosen date back. */
function ActivityHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const today = phtDay(new Date());
  const [asOf, setAsOf] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback(async (params: Record<string, string>, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/dashboard/activity", { params: { limit: HISTORY_PAGE, ...params } });
      const page = res.data?.data ?? { items: [], nextBefore: null };
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextBefore(page.nextBefore);
    } catch {
      setError("Your activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  // A fresh first page every time the window opens or the "as of" date changes.
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setNextBefore(null);
    fetchPage(asOf ? { asOf } : {}, false);
  }, [open, asOf, fetchPage]);
  useEffect(() => { if (!open) setAsOf(null); }, [open]);

  const openPicker = () => {
    const input = picker.current;
    if (!input) return;
    try { input.showPicker(); } catch { input.focus(); input.click(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl bg-surface border-border-soft p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 font-heading">
            <span className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 flex items-center justify-center">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            Your activity
          </DialogTitle>
          <DialogDescription>Everything you did in HRISense, newest first. Only you see this list.</DialogDescription>
        </DialogHeader>

        <div className="relative flex items-center justify-between gap-3 border-t border-border-soft px-5 py-3">
          <p className="text-sm font-bold font-heading text-foreground">
            As of {longDay(asOf ?? today)}
            {asOf && (
              <button type="button" onClick={() => setAsOf(null)} className="ml-2 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline">
                Back to today
              </button>
            )}
          </p>
          <button
            type="button"
            onClick={openPicker}
            aria-label="Show activity as of a date"
            title="Show activity as of a date"
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <CalendarClock className="h-5 w-5" />
          </button>
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-label="Show activity as of a date"
            max={today}
            value={asOf ?? ""}
            onChange={(e) => setAsOf(e.target.value || null)}
            className="pointer-events-none absolute right-5 bottom-1 h-px w-px opacity-0"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto no-scrollbar border-t border-border-soft">
          {error ? (
            <p className="px-5 py-4 text-sm text-status-danger-foreground">{error}</p>
          ) : items.length === 0 && loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground italic">
              {asOf ? "No activity on or before this date." : "You haven't done anything yet."}
            </p>
          ) : (
            <>
              <GroupedActivity
                items={items}
                today={today}
                stickyHeadings
                onOpen={(item) => item.link ? () => { onOpenChange(false); navigate({ to: item.link as any }); } : undefined}
              />
              <div className="px-5 py-4 text-center">
                {nextBefore ? (
                  <Button variant="outline" size="sm" onClick={() => fetchPage({ before: nextBefore }, true)} isLoading={loading} disabled={loading}>
                    Load older activity
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">That's everything.</p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecentActivitySection({ activity, isLoading }: { activity: ActivityItem[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const hidden = useDismissed("activity");
  const [allOpen, setAllOpen] = useState(false);
  const today = phtDay(new Date());

  const visible = activity.filter((a) => !hidden.hidden.has(a.id));
  const shown = visible.slice(0, RAIL_ACTIVITY_LIMIT);

  return (
    <>
      <RailSection
        title="Recent Activity"
        icon={<Activity />}
        action={
          <button type="button" onClick={() => setAllOpen(true)}
            className="ml-auto text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline underline-offset-2">
            See all
          </button>
        }
        footer={<HiddenFooter count={activity.length - visible.length} onRestore={hidden.restore} />}
        flush
      >
        <p className="px-4 pt-2.5 pb-2 text-xs font-semibold text-muted-foreground">As of {longDay(today)}</p>
        {isLoading ? (
          <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground italic">Nothing yet — what you do in HRISense shows up here.</p>
        ) : (
          <GroupedActivity
            items={shown}
            today={today}
            onOpen={(item) => item.link ? () => navigate({ to: item.link as any }) : undefined}
            onDismiss={(item) => hidden.hide(item.id)}
          />
        )}
      </RailSection>
      <ActivityHistoryDialog open={allOpen} onOpenChange={setAllOpen} />
    </>
  );
}

export function DashboardSidebar({
  todo,
  activity,
  isLoading,
  error,
  showTodo = true,
}: {
  todo: TodoItem[];
  activity: ActivityItem[];
  isLoading: boolean;
  error: string | null;
  /** HR's dashboard has no To Do list. */
  showTodo?: boolean;
}) {
  const navigate = useNavigate();
  const todoHidden = useDismissed("todo");

  const visibleTodo = todo.filter((t) => !todoHidden.hidden.has(t.id));
  const hiddenTodoCount = todo.length - visibleTodo.length;

  const skeleton = (
    <div className="space-y-2 p-2">
      {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-5 xl:space-y-0">
      {showTodo && (
      <RailSection
        title="To Do"
        icon={<ListTodo />}
        count={visibleTodo.length}
        footer={<HiddenFooter count={hiddenTodoCount} onRestore={todoHidden.restore} />}
      >
        {isLoading ? skeleton : error ? (
          <p className="px-2 py-3 text-sm text-status-danger-foreground">{error}</p>
        ) : visibleTodo.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground italic">Nothing waiting on you. 🎉</p>
        ) : (
          <ul>
            {visibleTodo.map((item) => (
              <RailItem
                key={item.id}
                icon={KIND_ICON[item.kind]}
                iconClass={TONE_CHIP[item.tone]}
                title={item.title}
                lines={[item.context, item.date ? format(new Date(item.date), "MMM d, yyyy") : ""]}
                onOpen={() => navigate({ to: item.link as any })}
                onDismiss={() => todoHidden.hide(item.id)}
              />
            ))}
          </ul>
        )}
      </RailSection>
      )}

      <RecentActivitySection activity={activity} isLoading={isLoading} />
    </div>
  );
}
