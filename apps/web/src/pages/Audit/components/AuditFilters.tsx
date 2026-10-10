import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AuditActorOption, AuditOptionScope, AuditTabId } from '@/services/audit-logs.service';

export interface AuditFilterState {
  module: string;
  actionType: string;
  outcome: '' | 'SUCCESS' | 'FAILURE';
  actorUserId: string;
  target: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: AuditFilterState = {
  module: '',
  actionType: '',
  outcome: '',
  actorUserId: '',
  target: '',
  dateFrom: '',
  dateTo: '',
};

interface FieldsProps {
  value: AuditFilterState;
  onChange: (patch: Partial<AuditFilterState>) => void;
  scope: AuditOptionScope;
  tab: AuditTabId;
  tabLabels: Record<string, string>;
  actors: AuditActorOption[];
  className?: string;
}

const control = 'h-10 w-full min-w-0 px-3 text-sm text-foreground hrisense-control focus-visible:outline-none';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/** The filter controls; laid out by the caller (a row on desktop, a sheet on phones). */
export function AuditFilterFields({ value, onChange, scope, tab, tabLabels, actors, className }: FieldsProps) {
  // On All Changes the modules are grouped under the tab they belong to.
  const groups = tab === 'ALL'
    ? Array.from(new Set(scope.modules.map((m) => m.tab))).map((t) => ({ tab: t, modules: scope.modules.filter((m) => m.tab === t) }))
    : [{ tab, modules: scope.modules }];

  return (
    <div className={cn('grid gap-3', className)}>
      <Field label="Module" htmlFor="audit-module">
        <select id="audit-module" className={control} value={value.module} onChange={(e) => onChange({ module: e.target.value })}>
          <option value="">All modules</option>
          {groups.length > 1
            ? groups.map((g) => (
                <optgroup key={g.tab} label={tabLabels[g.tab] ?? g.tab}>
                  {g.modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
              ))
            : scope.modules.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
        </select>
      </Field>

      <Field label="Action type" htmlFor="audit-action-type">
        <select id="audit-action-type" className={control} value={value.actionType} onChange={(e) => onChange({ actionType: e.target.value })}>
          <option value="">All action types</option>
          {scope.actionTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Performed by" htmlFor="audit-actor">
        <select id="audit-actor" className={control} value={value.actorUserId} onChange={(e) => onChange({ actorUserId: e.target.value })}>
          <option value="">Anyone</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.employeeNumber ? ` (${a.employeeNumber})` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Target / record" htmlFor="audit-target">
        <input
          id="audit-target"
          type="text"
          className={control}
          value={value.target}
          onChange={(e) => onChange({ target: e.target.value })}
          placeholder="Employee, applicant or record"
          autoComplete="off"
        />
      </Field>

      {scope.hasFailures && (
        <Field label="Result" htmlFor="audit-outcome">
          <select
            id="audit-outcome"
            className={control}
            value={value.outcome}
            onChange={(e) => onChange({ outcome: e.target.value as AuditFilterState['outcome'] })}
          >
            <option value="">Any result</option>
            <option value="SUCCESS">Successful</option>
            <option value="FAILURE">Failed</option>
          </select>
        </Field>
      )}

      <Field label="From" htmlFor="audit-from">
        <input
          id="audit-from"
          type="date"
          className={control}
          value={value.dateFrom}
          max={value.dateTo || undefined}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
        />
      </Field>
      <Field label="To" htmlFor="audit-to">
        <input
          id="audit-to"
          type="date"
          className={control}
          value={value.dateTo}
          min={value.dateFrom || undefined}
          onChange={(e) => onChange({ dateTo: e.target.value })}
        />
      </Field>
    </div>
  );
}

export interface ActiveFilter {
  key: keyof AuditFilterState;
  label: string;
}

/** The filters in effect as removable chips, so a narrowed list never looks like missing data. */
export function ActiveFilterChips({
  items,
  onRemove,
  onClearAll,
}: {
  items: ActiveFilter[];
  onRemove: (key: keyof AuditFilterState) => void;
  onClearAll: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((f) => (
        <span
          key={f.key}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pl-3 pr-1 text-xs font-medium text-foreground"
        >
          <span className="truncate">{f.label}</span>
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="rounded-full p-1 text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove filter: ${f.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
      >
        Clear all
      </button>
    </div>
  );
}

/** Phones: the same filters in a bottom sheet behind a "Filters" button. */
export function MobileFilterSheet({
  open,
  onOpenChange,
  activeCount,
  total,
  onClear,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  total: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 md:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-primary-600 px-1.5 text-[11px] font-bold leading-5 text-white">{activeCount}</span>
          )}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-base font-bold font-heading text-foreground">Filter audit events</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2" aria-label="Close filters">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">Narrow the audit events by module, action, person and date.</DialogPrimitive.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          <div className="flex gap-2 border-t border-border px-4 py-3">
            <Button variant="outline" className="flex-1" onClick={onClear} disabled={activeCount === 0}>
              Clear filters
            </Button>
            <DialogPrimitive.Close asChild>
              <Button variant="primary" className="flex-1">
                Show {total} event{total === 1 ? '' : 's'}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
