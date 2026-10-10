import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import type { StatCardTone } from '@/components/ui/stat-card';

/**
 * A wide side panel for "everyone on this day" lists.
 *
 * The previous panels stacked one tall card per person in a narrow drawer, so a
 * day with 49 employees meant scrolling through 49 cards to see who was where.
 * Here the people are grouped by what matters (status), each group can be
 * collapsed, the counts are chips that filter, a search box narrows by name,
 * and each person is one compact row that expands only when its detail is
 * wanted.
 */
export function RosterPanel({
  title,
  subtitle,
  onClose,
  toolbar,
  children,
  widthClass = 'max-w-5xl',
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  toolbar?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}) {
  // Escape closes it, as every other overlay does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog" aria-label={title}>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className={cn('relative z-10 flex h-full w-full flex-col border-l border-border-soft bg-surface shadow-2xl', widthClass)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-soft bg-surface-2/60 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">{title}</p>
            {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {toolbar && <div className="space-y-2.5 border-b border-border-soft px-5 py-3">{toolbar}</div>}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </motion.div>
    </div>
  );
}

export interface RosterGroupSummary {
  key: string;
  label: string;
  tone: StatCardTone;
  count: number;
}

/** "All · 49" plus one chip per group; selecting a chip shows only that group. */
export function RosterChips({
  groups,
  total,
  active,
  onChange,
}: {
  groups: RosterGroupSummary[];
  total: number;
  active: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show only">
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => onChange(null)}
        className={cn(
          'rounded-full border px-2.5 py-1 text-xs font-semibold transition-shadow',
          STATUS_TONE_CHIP.total,
          active === null && 'ring-2 ring-primary-500/50'
        )}
      >
        All · {total}
      </button>
      {groups.filter((g) => g.count > 0).map((g) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={active === g.key}
          onClick={() => onChange(active === g.key ? null : g.key)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold transition-shadow',
            STATUS_TONE_CHIP[g.tone],
            active === g.key && 'ring-2 ring-primary-500/50'
          )}
        >
          {g.label} · {g.count}
        </button>
      ))}
    </div>
  );
}

export function RosterSearch({ value, onChange, placeholder = 'Search name or employee number' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-input bg-surface pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      />
    </div>
  );
}

/** One collapsible group: a header with its count, then compact rows. */
export function RosterSection({
  label,
  tone,
  count,
  hint,
  defaultCollapsed = false,
  forceOpen = false,
  children,
}: {
  label: string;
  tone: StatCardTone;
  count: number;
  hint?: string;
  defaultCollapsed?: boolean;
  /** Open regardless (a search or filter is active). */
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const open = forceOpen || !collapsed;
  return (
    <section className="mb-4 last:mb-0">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold', STATUS_TONE_CHIP[tone])}>{label}</span>
        <span className="text-xs font-semibold text-foreground">{count}</span>
        {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
        {!open && <span className="ml-auto text-[11px] text-muted-foreground">Show</span>}
      </button>
      {open && <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">{children}</div>}
    </section>
  );
}

/** A compact one-line row; `detail` (if any) opens beneath it on click. */
export function RosterRow({
  primary,
  secondary,
  cells,
  badge,
  detail,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  cells?: ReactNode;
  badge?: ReactNode;
  detail?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(detail);
  const Wrapper = expandable ? 'button' : 'div';
  return (
    <div className="rounded-xl border border-border-soft bg-surface">
      <Wrapper
        {...(expandable ? { type: 'button' as const, onClick: () => setOpen((o) => !o), 'aria-expanded': open } : {})}
        className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', expandable && 'hover:bg-surface-2/60')}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{primary}</p>
          {secondary && <p className="truncate text-[11px] text-muted-foreground">{secondary}</p>}
        </div>
        {cells && <div className="hidden shrink-0 items-center gap-3 text-xs tabular-nums text-foreground sm:flex">{cells}</div>}
        {badge && <div className="shrink-0">{badge}</div>}
        {expandable && (open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />)}
      </Wrapper>
      {cells && <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pb-2 text-xs tabular-nums text-foreground sm:hidden">{cells}</div>}
      {open && detail && <div className="border-t border-border-soft px-3 py-2.5 text-xs">{detail}</div>}
    </div>
  );
}
