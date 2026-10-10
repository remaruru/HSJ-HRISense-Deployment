import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Additional oversight on the Org Chart — a SECONDARY relationship. An actual
 * employee also oversees someone outside their branch; the employee stays in
 * their real branch and their immediate supervisor is unchanged. It is display
 * information only: no access follows from it (API: additional-oversight.service).
 *
 * Primary reporting lines are solid; additional oversight is a dashed teal line
 * with an arrow to the person overseen, drawn only while "Show Additional
 * Oversight" is on. On small screens the lines are hidden and the same
 * relationships are read from the cards and the summary list instead.
 */

export interface OversightLink {
  relationshipId: string;
  overseerId: string;
  overseenId: string;
  /** Set when the relationship covers everyone holding a job role. */
  viaJobRoleTitle: string | null;
}

export interface OversightPerson {
  id: string;
  fullName: string;
  jobRoleTitle: string;
  unitName: string;
}

export interface OversightData {
  links: OversightLink[];
  /** People in a link who are not on the current chart (name, role, unit only). */
  people: Record<string, OversightPerson>;
}

interface OversightContextValue {
  show: boolean;
  links: OversightLink[];
  personOf: (id: string) => OversightPerson | null;
  /** Registers a card so lines can be drawn to it (one map per chart surface). */
  register: (id: string, el: HTMLElement | null) => void;
  anchors: React.MutableRefObject<Map<string, HTMLElement>>;
  focusId: string | null;
  setFocusId: (id: string | null) => void;
}

const OversightContext = createContext<OversightContextValue | null>(null);

export const useOversight = () => useContext(OversightContext);

/**
 * One provider per chart surface (the page, the fullscreen workspace): both may
 * render the same employee, so each keeps its own card anchors.
 */
export function OversightProvider({
  show,
  data,
  people,
  children,
}: {
  show: boolean;
  data: OversightData;
  /** People on the chart (the chart's own nodes). */
  people: Map<string, OversightPerson>;
  children: React.ReactNode;
}) {
  const anchors = useRef<Map<string, HTMLElement>>(new Map());
  const [focusId, setFocusId] = useState<string | null>(null);
  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el);
    else if (anchors.current.get(id) && !anchors.current.get(id)!.isConnected) anchors.current.delete(id);
  }, []);
  const personOf = useCallback((id: string) => people.get(id) ?? data.people[id] ?? null, [people, data.people]);
  const value = useMemo(
    () => ({ show, links: data.links, personOf, register, anchors, focusId, setFocusId }),
    [show, data.links, personOf, register, focusId]
  );
  return <OversightContext.Provider value={value}>{children}</OversightContext.Provider>;
}

/** The line legend: primary reporting vs additional oversight. */
export function OversightLegend({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", dark ? "text-slate-300" : "text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="#94a3b8" strokeWidth="2" /></svg>
        Immediate / primary supervisor
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke={dark ? "var(--color-primary-300)" : "var(--color-primary-500)"} strokeWidth="2" strokeDasharray="5 4" /></svg>
        Additional oversight
      </span>
    </span>
  );
}

/**
 * The card's oversight summary: "Additional Oversight: 3", opening to "Also
 * oversees" / "Also overseen by". Hovering it highlights that card's lines.
 */
export function OversightCardBadge({
  nodeId,
  immediateSupervisorId = null,
  dark = false,
}: {
  nodeId: string;
  /** Shown beside "Also overseen by" so the primary line stays clear. */
  immediateSupervisorId?: string | null;
  dark?: boolean;
}) {
  const ctx = useOversight();
  const [open, setOpen] = useState(false);
  if (!ctx?.show) return null;
  const oversees = ctx.links.filter((l) => l.overseerId === nodeId);
  const overseenBy = ctx.links.filter((l) => l.overseenId === nodeId);
  const total = oversees.length + overseenBy.length;
  if (!total) return null;

  const row = (id: string, via: string | null) => {
    const p = ctx.personOf(id);
    return (
      <li key={id} className="leading-snug">
        <span className={cn("font-semibold", dark ? "text-slate-100" : "text-foreground")}>{p?.fullName ?? "Unknown"}</span>
        <span className={dark ? "text-slate-400" : "text-muted-foreground"}>
          {" "}— {p?.jobRoleTitle ?? ""}{p?.unitName ? ` · ${p.unitName}` : ""}{via ? ` (via job role ${via})` : ""}
        </span>
      </li>
    );
  };

  return (
    <div
      className={cn(
        "no-pan mt-2 rounded-lg border border-dashed px-2 py-1 text-[10px]",
        dark ? "border-primary-300/60 bg-primary-900/30" : "border-primary-400 bg-primary-50/60 dark:border-primary-700 dark:bg-primary-900/20"
      )}
      onMouseEnter={() => ctx.setFocusId(nodeId)}
      onMouseLeave={() => ctx.setFocusId(null)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("no-pan flex w-full items-center justify-between gap-1 font-semibold", dark ? "text-primary-200" : "text-primary-700 dark:text-primary-300")}
      >
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden="true" /> Additional Oversight: {total}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 pb-0.5">
          {overseenBy.length > 0 && (
            <div>
              <p className={cn("font-bold uppercase tracking-wide", dark ? "text-slate-300" : "text-muted-foreground")}>Immediate supervisor</p>
              <p className={cn("mb-1", dark ? "text-slate-100" : "text-foreground")}>
                {immediateSupervisorId ? ctx.personOf(immediateSupervisorId)?.fullName ?? "On another chart" : "None assigned"}
                <span className={dark ? "text-slate-400" : "text-muted-foreground"}> (primary — unchanged)</span>
              </p>
              <p className={cn("font-bold uppercase tracking-wide", dark ? "text-slate-300" : "text-muted-foreground")}>Also overseen by</p>
              <ul>{overseenBy.map((l) => row(l.overseerId, l.viaJobRoleTitle))}</ul>
            </div>
          )}
          {oversees.length > 0 && (
            <div>
              <p className={cn("font-bold uppercase tracking-wide", dark ? "text-slate-300" : "text-muted-foreground")}>Also oversees</p>
              <ul>{oversees.map((l) => row(l.overseenId, l.viaJobRoleTitle))}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Position of an element inside `ancestor`, unaffected by CSS transforms (zoom). */
function unscaledOffset(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let curr: HTMLElement | null = el;
  while (curr && curr !== ancestor) {
    x += curr.offsetLeft;
    y += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

type Box = { x: number; y: number; w: number; h: number };

/** A curved path from the overseer's card edge to the overseen card's edge. */
function pathBetween(a: Box, b: Box) {
  const amid = a.y + a.h / 2;
  const bmid = b.y + b.h / 2;
  if (b.x >= a.x + a.w || b.x + b.w <= a.x) {
    const right = b.x >= a.x + a.w;
    const sx = right ? a.x + a.w : a.x;
    const ex = right ? b.x : b.x + b.w;
    const d = Math.max(40, Math.abs(ex - sx) / 2) * (right ? 1 : -1);
    return `M ${sx} ${amid} C ${sx + d} ${amid}, ${ex - d} ${bmid}, ${ex} ${bmid}`;
  }
  const down = b.y > a.y;
  const sx = a.x + a.w / 2;
  const ex = b.x + b.w / 2;
  const sy = down ? a.y + a.h : a.y;
  const ey = down ? b.y : b.y + b.h;
  const d = Math.max(40, Math.abs(ey - sy) / 2) * (down ? 1 : -1);
  return `M ${sx} ${sy} C ${sx} ${sy + d}, ${ex} ${ey - d}, ${ex} ${ey}`;
}

/**
 * The dashed oversight lines over a chart surface.
 *  · "canvas" (fullscreen workspace): positions inside the zoomed canvas, so
 *    zoom, pan and Fit Screen move the lines with the cards.
 *  · "page": positions on the page; a card scrolled out of its unit's
 *    horizontal scroll area (or in a collapsed unit) gets no line — its card
 *    and the summary list still name the relationship.
 * Hidden below md: on small screens the cards and the list carry it.
 */
export function OversightLines({
  containerRef,
  mode,
  stroke,
  layoutKey,
  scale = 1,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  mode: "canvas" | "page";
  stroke: string;
  /** Changes whenever the chart's layout may have changed (expand / collapse, filters). */
  layoutKey: string;
  /** Canvas zoom: lines keep the same on-screen thickness at any zoom. */
  scale?: number;
}) {
  const ctx = useOversight();
  const markerId = useId().replace(/:/g, "");
  const [paths, setPaths] = useState<Array<{ key: string; d: string; overseerId: string; overseenId: string }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const recalc = useCallback(() => {
    const c = containerRef.current;
    if (!ctx?.show || !c) {
      setPaths([]);
      return;
    }
    const cRect = c.getBoundingClientRect();
    const boxOf = (el: HTMLElement): Box | null => {
      if (!el.isConnected || !c.contains(el) || el.offsetWidth === 0) return null;
      if (mode === "canvas") return unscaledOffset(el, c);
      const r = el.getBoundingClientRect();
      const clip = el.closest("[data-oversight-clip]") as HTMLElement | null;
      if (clip) {
        const k = clip.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        if (cx < k.left || cx > k.right) return null;
      }
      return { x: r.left - cRect.left, y: r.top - cRect.top, w: r.width, h: r.height };
    };
    const next: typeof paths = [];
    for (const l of ctx.links) {
      const a = ctx.anchors.current.get(l.overseerId);
      const b = ctx.anchors.current.get(l.overseenId);
      const ba = a && boxOf(a);
      const bb = b && boxOf(b);
      if (!ba || !bb) continue;
      next.push({ key: `${l.overseerId}>${l.overseenId}`, d: pathBetween(ba, bb), overseerId: l.overseerId, overseenId: l.overseenId });
    }
    setPaths(next);
    setSize(mode === "canvas" ? { w: c.offsetWidth, h: c.offsetHeight } : { w: c.clientWidth, h: c.clientHeight });
  }, [ctx?.show, ctx?.links, ctx?.anchors, containerRef, mode]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(recalc);
    const timer = setTimeout(recalc, 120);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [recalc, layoutKey]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c || !ctx?.show) return;
    const observer = new ResizeObserver(() => recalc());
    observer.observe(c);
    // Horizontal scrolling inside a unit moves its cards (scroll does not bubble).
    const onScroll = () => recalc();
    if (mode === "page") c.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      c.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [recalc, containerRef, mode, ctx?.show]);

  if (!ctx?.show || paths.length === 0) return null;
  const focus = ctx.focusId;
  const k = 1 / Math.max(0.1, scale);
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-20 overflow-visible hidden md:block"
      style={{ width: size.w || "100%", height: size.h || "100%" }}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      {paths.map((p) => {
        const touched = focus !== null && (p.overseerId === focus || p.overseenId === focus);
        return (
          <path
            key={p.key}
            d={p.d}
            stroke={stroke}
            strokeWidth={(touched ? 2.75 : 2) * k}
            strokeDasharray={`${7 * k} ${5 * k}`}
            strokeLinecap="round"
            fill="none"
            markerEnd={`url(#${markerId})`}
            opacity={focus === null ? 0.8 : touched ? 1 : 0.12}
          />
        );
      })}
    </svg>
  );
}

/**
 * Every additional-oversight relationship on the chart, grouped by overseer —
 * the readable view on any screen size (and the only one on a phone).
 */
export function OversightSummary({ className }: { className?: string }) {
  const ctx = useOversight();
  if (!ctx?.show) return null;
  const byOverseer = new Map<string, OversightLink[]>();
  for (const l of ctx.links) byOverseer.set(l.overseerId, [...(byOverseer.get(l.overseerId) ?? []), l]);
  return (
    <section aria-labelledby="oversight-summary-heading" className={cn("rounded-xl border border-dashed border-primary-400 bg-surface p-4 shadow-sm dark:border-primary-800", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="oversight-summary-heading" className="text-sm font-bold text-foreground font-heading">
          Additional Oversight ({ctx.links.length})
        </h3>
        <OversightLegend />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        A second line of oversight across branches. Each person stays in their own branch with their immediate supervisor unchanged, and no extra access comes with it.
      </p>
      {byOverseer.size === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No additional oversight on this chart.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {[...byOverseer.entries()].map(([overseerId, links]) => {
            const o = ctx.personOf(overseerId);
            return (
              <li
                key={overseerId}
                className="rounded-lg border border-border p-2.5 text-xs"
                onMouseEnter={() => ctx.setFocusId(overseerId)}
                onMouseLeave={() => ctx.setFocusId(null)}
              >
                <p className="font-semibold text-foreground">
                  {o?.fullName ?? "Unknown"} <span className="font-normal text-muted-foreground">— {o?.jobRoleTitle} · {o?.unitName}</span>
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Also oversees</p>
                <ul className="mt-0.5 flex flex-wrap gap-1.5">
                  {links.map((l) => {
                    const p = ctx.personOf(l.overseenId);
                    return (
                      <li key={l.overseenId} className="rounded-md border border-dashed border-primary-300 bg-primary-50/60 px-1.5 py-0.5 text-[11px] text-foreground dark:border-primary-800 dark:bg-primary-900/20">
                        {p?.fullName ?? "Unknown"} <span className="text-muted-foreground">· {p?.unitName}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
