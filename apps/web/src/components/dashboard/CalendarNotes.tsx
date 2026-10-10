import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck2, Pencil, Trash2, Plus, Check, X, CalendarHeart, GraduationCap,
  Plane, MessagesSquare, Hourglass, StickyNote, ArrowUpRight, Megaphone, Search, Users, Lock, UserCheck, Cake,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CalendarGrid, type CalendarEvent } from "@/components/ui/CalendarGrid";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "My Calendar" — the organisation's events that concern this person
 * (holidays, leave, trainings, deadlines, interviews — scoped on the server by
 * `/dashboard/calendar`), their private notes, and calendar notes HR posted to
 * everyone or to them (`/calendar-notes`).
 *
 * Beside the month grid is one panel with three views: the selected Day (with
 * the add-note form), the Week of that day, or the whole Month on screen.
 * The legend is a filter: click a type to hide or show it everywhere.
 *
 * Colours follow the Hospicio code by meaning:
 *   holiday #b9e0de · training #def2e7 · leave #F2EDFD (dashed while pending)
 *   deadline #f7ecd5 (#fff1f2 once overdue) · interview informational blue
 *   HR note: outlined in brand teal · my note: neutral chip with a status dot
 */

type Audience = "PERSONAL" | "ALL" | "SELECTED";

interface Note {
  id: string;
  date: string;
  title: string;
  details: string | null;
  isDone: boolean;
  audience: Audience;
  isOwner: boolean;
  author: string;
  recipientCount: number;
  recipients?: Array<{ id: string; name: string }>;
}

interface OrgEvent {
  id: string;
  type: "holiday" | "leave" | "training" | "deadline" | "interview" | "birthday";
  title: string;
  detail: string | null;
  start: string;
  end: string;
  link: string | null;
  tentative?: boolean;
  overdue?: boolean;
}

type Category = OrgEvent["type"] | "hrnote" | "mynote";

type Item =
  | { kind: "event"; key: string; start: string; end: string; category: Category; event: OrgEvent }
  | { kind: "note"; key: string; start: string; end: string; category: Category; note: Note };

const pad = (n: number) => String(n).padStart(2, "0");
const dayStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const noteDay = (n: Note) => n.date.slice(0, 10);
const parseDay = (s: string) => new Date(`${s}T00:00:00`);

/** Everything a month grid can show, spill-over days included (~7 weeks). */
function gridRange(year: number, month: number) {
  return { from: dayStr(new Date(year, month, 1 - 7)), to: dayStr(new Date(year, month + 1, 14)) };
}

type NoteState = "done" | "overdue" | "pending";
const stateOf = (note: Note, today: string): NoteState =>
  note.isDone ? "done" : noteDay(note) < today ? "overdue" : "pending";

const NOTE_DOT: Record<NoteState, { dot: string; label: string }> = {
  pending: { dot: "bg-status-warning-foreground", label: "Planned" },
  overdue: { dot: "bg-status-danger-foreground", label: "Overdue" },
  done: { dot: "bg-status-success-foreground", label: "Done" },
};

const CATEGORY: Record<Category, { chip: string; dot: string; label: string; icon: React.ReactNode }> = {
  holiday: { chip: "bg-nav-selected-surface text-nav-selected-foreground border-nav-selected-surface", dot: "bg-nav-selected-foreground", label: "Holiday", icon: <CalendarHeart /> },
  training: { chip: "bg-status-total-surface text-status-total-foreground border-status-total-border", dot: "bg-status-total-foreground", label: "Training", icon: <GraduationCap /> },
  leave: { chip: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border", dot: "bg-status-accent-foreground", label: "Leave", icon: <Plane /> },
  interview: { chip: "bg-status-info-surface text-status-info-foreground border-status-info-border", dot: "bg-status-info-foreground", label: "Interview", icon: <MessagesSquare /> },
  deadline: { chip: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border", dot: "bg-status-warning-foreground", label: "Deadline", icon: <Hourglass /> },
  birthday: { chip: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border", dot: "bg-status-accent-foreground", label: "Birthday", icon: <Cake /> },
  hrnote: { chip: "bg-surface text-primary-700 dark:text-primary-200 border-primary-500", dot: "bg-primary-600", label: "HR note", icon: <Megaphone /> },
  mynote: { chip: "bg-surface-2 text-foreground border-border-soft", dot: "bg-status-warning-foreground", label: "My note", icon: <StickyNote /> },
};
const OVERDUE_CHIP = "bg-status-danger-surface text-status-danger-foreground border-status-danger-border";
const CATEGORY_ORDER: Category[] = ["holiday", "birthday", "training", "leave", "interview", "deadline", "hrnote", "mynote"];

const eventChip = (e: OrgEvent) =>
  cn("border", e.overdue ? OVERDUE_CHIP : CATEGORY[e.type].chip, e.tentative && "border-dashed");

const inputClass =
  "w-full rounded-xl border border-input bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500";

const overlaps = (item: { start: string; end: string }, from: string, to: string) => item.start <= to && item.end >= from;

function rangeLabel(start: string, end: string) {
  const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return start === end ? fmt(parseDay(start)) : `${fmt(parseDay(start))} – ${fmt(parseDay(end))}`;
}

function audienceBadge(note: Note) {
  if (note.audience === "PERSONAL") return null;
  if (note.isOwner) return note.audience === "ALL" ? "Posted to all employees" : `Posted to ${note.recipientCount} employee${note.recipientCount === 1 ? "" : "s"}`;
  return note.audience === "ALL" ? `From ${note.author} · everyone` : `From ${note.author} · for you`;
}

// ── employee picker for SELECTED notes (HR only) ──────────────────────────────
function RecipientPicker({
  value,
  onChange,
}: {
  value: Array<{ id: string; name: string }>;
  onChange: (next: Array<{ id: string; name: string }>) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/employees", { params: { search: q || undefined, limit: 20 } });
        setResults((res.data?.data ?? []).map((e: any) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          role: e.jobRole?.title ?? "",
        })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const chosen = new Set(value.map((v) => v.id));
  const toggle = (e: { id: string; name: string }) =>
    onChange(chosen.has(e.id) ? value.filter((v) => v.id !== e.id) : [...value, { id: e.id, name: e.name }]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected employees">
          {value.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 dark:bg-primary-950/40 px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-200 dark:border-primary-900">
              {v.name}
              <button type="button" onClick={() => toggle(v)} aria-label={`Remove ${v.name}`} className="rounded-full hover:bg-primary-100 dark:hover:bg-primary-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees…"
          aria-label="Search employees" className={cn(inputClass, "h-10 pl-9")} />
      </div>
      <ul className="max-h-40 overflow-y-auto rounded-xl border border-border-soft bg-surface divide-y divide-border-soft">
        {loading ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">Searching…</li>
        ) : results.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">No employees found.</li>
        ) : results.map((e) => (
          <li key={e.id}>
            <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-2">
              <input type="checkbox" checked={chosen.has(e.id)} onChange={() => toggle(e)} className="h-4 w-4 accent-primary-600" />
              <span className="min-w-0">
                <span className="block text-sm text-foreground truncate">{e.name}</span>
                {e.role && <span className="block text-[11px] text-muted-foreground truncate">{e.role}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * HR only: posting a calendar note to other people is its own deliberate step,
 * kept apart from the personal "Add a note" form so a note meant for yourself
 * can never go out to everyone by a stray click. Nothing is pre-selected — HR
 * must choose All or Selected — and the button names exactly who receives it.
 */
function PostNoteDialog({
  open,
  onOpenChange,
  defaultDate,
  onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onPosted: (note: Note) => void;
}) {
  const [audience, setAudience] = useState<"ALL" | "SELECTED" | null>(null);
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string }>>([]);
  const [date, setDate] = useState(defaultDate);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Every opening starts clean, on the day picked in the calendar.
  useEffect(() => {
    if (open) {
      setAudience(null); setRecipients([]); setDate(defaultDate); setTitle(""); setDetails("");
    }
  }, [open, defaultDate]);

  const ready = !!audience && !!title.trim() && !!date && (audience === "ALL" || recipients.length > 0);
  const who = audience === "ALL"
    ? "all employees"
    : `${recipients.length} selected employee${recipients.length === 1 ? "" : "s"}`;

  const post = async () => {
    if (!ready || !audience) return;
    setIsPosting(true);
    try {
      const res = await api.post("/calendar-notes", {
        date,
        title: title.trim(),
        details: details.trim() || null,
        audience,
        ...(audience === "SELECTED" ? { recipientIds: recipients.map((r) => r.id) } : {}),
      });
      toast.success(`Note posted to ${who}.`);
      onPosted(res.data.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The note could not be posted."));
    } finally {
      setIsPosting(false);
    }
  };

  const choice = (value: "ALL" | "SELECTED", label: string, hint: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="radio"
      aria-checked={audience === value}
      onClick={() => setAudience(value)}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        audience === value
          ? "border-primary-500 bg-nav-selected-surface text-nav-selected-foreground"
          : "border-border-soft bg-surface hover:border-primary-300 dark:hover:border-primary-700"
      )}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-4" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={cn("block text-xs", audience === value ? "opacity-80" : "text-muted-foreground")}>{hint}</span>
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl bg-surface border-border-soft max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <span className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300 flex items-center justify-center">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </span>
            Post a note to employees
          </DialogTitle>
          <DialogDescription>
            It appears on their calendars and as a notification. Notes just for you are added from the calendar&rsquo;s side panel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Who should see it?</p>
            <div role="radiogroup" aria-label="Who should see this note" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {choice("ALL", "All employees", "Everyone with an active account", <Users />)}
              {choice("SELECTED", "Selected employees", "Only the people you pick", <UserCheck />)}
            </div>
          </div>

          {audience === "SELECTED" && <RecipientPicker value={recipients} onChange={setRecipients} />}

          <div className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "h-11")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                placeholder="e.g. Fire drill at 3:00 PM" className={cn(inputClass, "h-11")} />
            </label>
          </div>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3}
            placeholder="Details (optional)" aria-label="Note details" className={cn(inputClass, "py-2 resize-none")} />

          {audience && (
            <p className="flex items-start gap-2 rounded-xl border border-status-info-border bg-status-info-surface px-3 py-2 text-xs text-status-info-foreground">
              <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Will appear on the calendars of <strong>{who}</strong>
                {date ? ` on ${parseDay(date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}` : ""}.
              </span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPosting}>Cancel</Button>
          <Button variant="create" onClick={post} isLoading={isPosting} disabled={!ready || isPosting}>
            <Megaphone /> {audience ? `Post to ${who}` : "Choose who sees it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarNotes({ onChange }: { onChange?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHr = user?.permissionTier === "FULL";
  const today = dayStr(new Date());
  const [shown, setShown] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const range = useMemo(() => gridRange(shown.year, shown.month), [shown]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(today);
  const [panel, setPanel] = useState<"day" | "week" | "month">("day");
  const [hidden, setHidden] = useState<Set<Category>>(new Set());

  // personal add form (side panel) · HR's separate "post to employees" dialog
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [n, e] = await Promise.allSettled([
      api.get("/calendar-notes", { params: range }),
      api.get("/dashboard/calendar", { params: range }),
    ]);
    if (n.status === "fulfilled") setNotes(n.value.data?.data ?? []);
    if (e.status === "fulfilled") setEvents(e.value.data?.data ?? []);
    if (n.status === "rejected" || e.status === "rejected") {
      const failed = n.status === "rejected" ? n.reason : (e as PromiseRejectedResult).reason;
      setError(getApiErrorMessage(failed, "Part of your calendar could not be loaded."));
    }
    setIsLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // ── one list of everything, then the legend filter ─────────────────────────
  const allItems: Item[] = useMemo(
    () => [
      ...events.map((ev): Item => ({ kind: "event", key: `e:${ev.id}`, start: ev.start, end: ev.end, category: ev.type, event: ev })),
      ...notes.map((n): Item => ({
        kind: "note", key: `n:${n.id}`, start: noteDay(n), end: noteDay(n),
        category: n.audience === "PERSONAL" ? "mynote" : "hrnote", note: n,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start) || (a.kind === "event" ? -1 : 1)),
    [events, notes]
  );
  const items = allItems.filter((it) => !hidden.has(it.category));

  const monthFrom = dayStr(new Date(shown.year, shown.month, 1));
  const monthTo = dayStr(new Date(shown.year, shown.month + 1, 0));
  const monthCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<Category, number>;
    allItems.filter((it) => overlaps(it, monthFrom, monthTo)).forEach((it) => { counts[it.category] += 1; });
    return counts;
  }, [allItems, monthFrom, monthTo]);

  const noteChip = (n: Note) =>
    n.audience === "PERSONAL"
      ? cn("border", CATEGORY.mynote.chip, n.isDone && "line-through opacity-70")
      : cn("border", CATEGORY.hrnote.chip);

  const gridEvents: CalendarEvent[] = items.map((it) =>
    it.kind === "event"
      ? {
          id: it.key, startDate: it.start, endDate: it.end, title: it.event.title, status: it.event.type,
          colorClass: eventChip(it.event),
          dotClass: it.event.overdue ? "bg-status-danger-foreground" : CATEGORY[it.event.type].dot,
        }
      : {
          id: it.key, startDate: it.start, endDate: it.end, title: it.note.title, status: it.category,
          colorClass: noteChip(it.note),
          dotClass: it.note.audience === "PERSONAL" ? NOTE_DOT[stateOf(it.note, today)].dot : CATEGORY.hrnote.dot,
        }
  );

  // ── the side panel's range ─────────────────────────────────────────────────
  const weekFrom = useMemo(() => {
    const d = parseDay(selected);
    return dayStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
  }, [selected]);
  const weekTo = dayStr(new Date(parseDay(weekFrom).getFullYear(), parseDay(weekFrom).getMonth(), parseDay(weekFrom).getDate() + 6));
  const listRange = panel === "week" ? { from: weekFrom, to: weekTo } : panel === "month" ? { from: monthFrom, to: monthTo } : { from: selected, to: selected };
  const panelItems = items.filter((it) => overlaps(it, listRange.from, listRange.to));

  const selectedLabel = parseDay(selected).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const weekLabel = today >= weekFrom && today <= weekTo
    ? "This week"
    : `Week of ${parseDay(weekFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
  const monthLabel = new Date(shown.year, shown.month, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  // ── note actions (every change refreshes Recent Activity) ─────────────────
  const changed = () => onChange?.();

  /** Personal only — shared notes go through PostNoteDialog. */
  const addNote = async () => {
    if (!title.trim()) { toast.error("Please enter a title for the note."); return; }
    setIsSaving(true);
    try {
      const res = await api.post("/calendar-notes", {
        date: selected,
        title: title.trim(),
        details: details.trim() || null,
        audience: "PERSONAL",
      });
      setNotes((prev) => [...prev, res.data.data]);
      setTitle(""); setDetails("");
      toast.success("Note added.");
      changed();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The note could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const patchNote = async (id: string, patch: Partial<Pick<Note, "title" | "details" | "isDone">>) => {
    const before = notes;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    try {
      const res = await api.patch(`/calendar-notes/${id}`, patch);
      setNotes((prev) => prev.map((n) => (n.id === id ? res.data.data : n)));
      changed();
      return true;
    } catch (err) {
      setNotes(before);
      toast.error(getApiErrorMessage(err, "The note could not be updated."));
      return false;
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editTitle.trim()) { toast.error("The title cannot be empty."); return; }
    if (await patchNote(editingId, { title: editTitle.trim(), details: editDetails.trim() || null })) {
      setEditingId(null);
      toast.success("Note updated.");
    }
  };

  const deleteNote = async (note: Note) => {
    const shared = note.audience !== "PERSONAL";
    if (!confirm(shared ? `Remove "${note.title}" from everyone's calendar?` : `Delete "${note.title}"?`)) return;
    const before = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await api.delete(`/calendar-notes/${note.id}`);
      toast.success(shared ? "Note removed from the calendars." : "Note deleted.");
      changed();
    } catch (err) {
      setNotes(before);
      toast.error(getApiErrorMessage(err, "The note could not be deleted."));
    }
  };

  // ── rows ───────────────────────────────────────────────────────────────────
  // Plain render helpers, not components: a component declared in here would be
  // a new type on every render, remounting the row and dropping the edit box's focus.
  const eventRow = (ev: OrgEvent, key: string, showDate: boolean) => (
    <li key={key} className={cn("flex items-start gap-3 rounded-xl border p-3", eventChip(ev))}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4" aria-hidden="true">{CATEGORY[ev.type].icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground break-words">{ev.title}</p>
        <p className="text-xs text-foreground/70 mt-0.5">
          {[showDate || ev.start !== ev.end ? rangeLabel(ev.start, ev.end) : null,
            CATEGORY[ev.type].label, ev.overdue ? "Overdue" : null, ev.detail].filter(Boolean).join(" · ")}
        </p>
      </div>
      {ev.link && (
        <button type="button" onClick={() => navigate({ to: ev.link as any })}
          className="shrink-0 rounded-lg p-1.5 text-foreground/70 hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10"
          aria-label={`Open ${ev.title}`} title="Open">
          <ArrowUpRight className="h-4 w-4" />
        </button>
      )}
    </li>
  );

  const noteRow = (note: Note, key: string, showDate: boolean) => {
    const personal = note.audience === "PERSONAL";
    const s = NOTE_DOT[stateOf(note, today)];
    const badge = audienceBadge(note);
    if (editingId === note.id) {
      return (
        <li key={key} className={cn("rounded-xl border p-3", noteChip(note))}>
          <div className="space-y-2">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} aria-label="Note title" className={cn(inputClass, "h-10")} />
            <textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} maxLength={1000} rows={2} aria-label="Note details" className={cn(inputClass, "py-2 resize-none")} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X /> Cancel</Button>
              <Button size="sm" variant="update" onClick={saveEdit}><Check /> Save</Button>
            </div>
          </div>
        </li>
      );
    }
    return (
      <li key={key} className={cn("rounded-xl border p-3", personal ? cn("border", CATEGORY.mynote.chip) : cn("border", CATEGORY.hrnote.chip))}>
        <div className="flex items-start gap-2.5">
          {personal ? (
            <input type="checkbox" checked={note.isDone} onChange={(e) => patchNote(note.id, { isDone: e.target.checked })}
              aria-label={note.isDone ? `Mark "${note.title}" as not done` : `Mark "${note.title}" as done`}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600 cursor-pointer" />
          ) : (
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-semibold text-foreground break-words", personal && note.isDone && "line-through opacity-70")}>{note.title}</p>
            {note.details && <p className="text-xs text-foreground/75 mt-0.5 break-words whitespace-pre-line">{note.details}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-foreground/70">
              {showDate && <span>{rangeLabel(noteDay(note), noteDay(note))} ·</span>}
              {personal ? (
                <><span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden="true" /> {s.label} · <Lock className="h-3 w-3" aria-hidden="true" /> Only you</>
              ) : (
                <><Users className="h-3 w-3" aria-hidden="true" /> {badge}</>
              )}
            </p>
            {note.isOwner && note.audience === "SELECTED" && note.recipients && note.recipients.length > 0 && (
              <p className="mt-0.5 text-[11px] text-foreground/60 truncate" title={note.recipients.map((r) => r.name).join(", ")}>
                {note.recipients.map((r) => r.name).join(", ")}
              </p>
            )}
          </div>
          {note.isOwner && (
            <div className="flex shrink-0 gap-1">
              <Button size="icon-sm" variant="update" aria-label={`Edit "${note.title}"`}
                onClick={() => { setEditingId(note.id); setEditTitle(note.title); setEditDetails(note.details ?? ""); }}>
                <Pencil />
              </Button>
              <Button size="icon-sm" variant="delete" aria-label={`Delete "${note.title}"`} onClick={() => deleteNote(note)}>
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
      </li>
    );
  };

  // ── legend = filter ────────────────────────────────────────────────────────
  const legend = (
    <>
      <span className="text-xs font-semibold text-muted-foreground mr-1">Show:</span>
      {CATEGORY_ORDER.filter((c) => c !== "hrnote" || isHr || monthCounts.hrnote > 0 || notes.some((n) => n.audience !== "PERSONAL")).map((c) => {
        const off = hidden.has(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={!off}
            onClick={() => setHidden((prev) => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next; })}
            title={off ? `Show ${CATEGORY[c].label.toLowerCase()} items` : `Hide ${CATEGORY[c].label.toLowerCase()} items`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity",
              CATEGORY[c].chip,
              off && "opacity-40 line-through",
              !off && monthCounts[c] === 0 && "opacity-60"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", CATEGORY[c].dot)} aria-hidden="true" />
            {CATEGORY[c].label}
            <span className="tabular-nums opacity-80">{monthCounts[c]}</span>
          </button>
        );
      })}
      {hidden.size > 0 && (
        <button type="button" onClick={() => setHidden(new Set())} className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:underline">
          Show all
        </button>
      )}
    </>
  );

  return (
    <section aria-label="My calendar" className="@container rounded-2xl border border-border-soft bg-surface shadow-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300 flex items-center justify-center">
            <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold font-heading text-foreground">My Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Holidays, leave, trainings, deadlines and notes.
            </p>
          </div>
        </div>
        {isHr && (
          <Button variant="outline" size="sm" onClick={() => setPostOpen(true)}>
            <Megaphone /> Post to employees
          </Button>
        )}
      </div>
      {isHr && (
        <PostNoteDialog
          open={postOpen}
          onOpenChange={setPostOpen}
          defaultDate={selected}
          onPosted={(note) => {
            setNotes((prev) => [...prev, note]);
            setSelected(noteDay(note));
            setPanel("day");
            changed();
          }}
        />
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-status-danger-border bg-status-danger-surface px-3 py-2 text-sm text-status-danger-foreground">
          {error}
        </p>
      )}

      {/* Side by side once the calendar itself is wide enough (it narrows when
          the dashboard's activity column is open), stacked below that. */}
      <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] gap-5 items-start">
        <CalendarGrid
          events={gridEvents}
          isLoading={isLoading}
          onDayClick={(_d, dateStr) => { setSelected(dateStr); setPanel("day"); }}
          onEventClick={(ev) => { setSelected(ev.startDate); setPanel("day"); }}
          onMonthChange={(y, m) => setShown({ year: y, month: m })}
          selectedStart={selected}
          selectedEnd={selected}
          legend={legend}
        />

        {/* ── side panel: Day · Week · Month ── */}
        <div className="min-w-0 rounded-xl border border-border-soft bg-surface-2/60 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 pb-2">
            <div className="min-w-[9rem] flex-1">
              <p className="text-sm font-bold text-foreground truncate">
                {panel === "day" ? selectedLabel : panel === "week" ? weekLabel : monthLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {panel === "day" ? "" : `${rangeLabel(listRange.from, listRange.to)} · `}
                {panelItems.length} item{panelItems.length === 1 ? "" : "s"}
              </p>
            </div>
            <div role="tablist" aria-label="Calendar view" className="inline-flex shrink-0 rounded-xl bg-surface border border-border-soft p-1">
              {(["day", "week", "month"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={panel === v} onClick={() => setPanel(v)}
                  className={cn("rounded-lg px-3 py-1 text-sm font-semibold transition-colors",
                    panel === v ? "bg-nav-selected-surface text-nav-selected-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>

          {/* Only the list scrolls, so opening the recipient picker never squeezes it. */}
          <div className="max-h-[420px] overflow-y-auto no-scrollbar px-3 pb-3">
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}</div>
            ) : panelItems.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground italic">
                {panel === "day" ? "Nothing on this day yet." : panel === "week" ? "Nothing scheduled this week." : "Nothing scheduled this month."}
              </p>
            ) : (
              <ul className="space-y-2">
                {panelItems.map((it) => it.kind === "event"
                  ? eventRow(it.event, it.key, panel !== "day")
                  : noteRow(it.note, it.key, panel !== "day"))}
              </ul>
            )}
          </div>

          {/* add a personal note (on the selected day) — only ever for yourself */}
          <div className="border-t border-border-soft px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="calendar-note-title" className="block text-sm font-medium text-foreground">
                Add a note for {parseDay(selected).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Only you
              </span>
            </div>
            <input id="calendar-note-title" value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} maxLength={120}
              placeholder="e.g. Review compliance submissions"
              className={cn(inputClass, "h-11")} />
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={2}
              placeholder="Details (optional)" aria-label="Note details" className={cn(inputClass, "py-2 resize-none")} />
            <Button variant="create" className="w-full" onClick={addNote} isLoading={isSaving} disabled={isSaving}>
              <Plus /> Add Note
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
