import { ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import type { AuditEvent } from '@/services/audit-logs.service';

const DAY = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

export const formatAuditDay = (iso: string) => DAY.format(new Date(iso));
export const formatAuditTime = (iso: string) => TIME.format(new Date(iso));

/** The action word; failures read as failures at a glance. */
export function ActionChip({ event, className }: { event: AuditEvent; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold',
        event.outcome === 'FAILURE' ? STATUS_TONE_CHIP.danger : STATUS_TONE_CHIP.neutral,
        className
      )}
    >
      <span className="truncate">{event.actionLabel}</span>
    </span>
  );
}

function RecordLine({ event }: { event: AuditEvent }) {
  const bits = [event.subject?.reference, event.record.label && event.record.label !== event.subject?.name ? event.record.type : null].filter(Boolean);
  if (!bits.length && !event.confidential) return null;
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {event.confidential && <Lock className="h-3 w-3 shrink-0" aria-label="Confidential record" />}
      <span className="truncate">{bits.join(' · ') || 'Confidential record'}</span>
    </p>
  );
}

/**
 * Audit events: a table on wide screens, cards on phones. Each row opens the
 * detail drawer (click, Enter or Space).
 */
export function AuditEventList({ rows, onOpen, dimmed }: { rows: AuditEvent[]; onOpen: (e: AuditEvent) => void; dimmed?: boolean }) {
  const keyOpen = (e: React.KeyboardEvent, row: AuditEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(row);
    }
  };

  return (
    <div className={cn('transition-opacity', dimmed && 'pointer-events-none opacity-60')} aria-busy={dimmed || undefined}>
      {/* Wide screens */}
      <table className="hidden w-full table-fixed text-left md:table">
        <thead className="border-b border-border bg-surface-2/60">
          <tr>
            <th scope="col" className="w-32 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">When</th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What happened</th>
            <th scope="col" className="hidden w-48 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Module</th>
            <th scope="col" className="w-40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
            <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={`${row.source}:${row.id}`}
              tabIndex={0}
              role="button"
              aria-label={`${row.summary} Open details.`}
              onClick={() => onOpen(row)}
              onKeyDown={(e) => keyOpen(e, row)}
              className="cursor-pointer align-top transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <td className="px-4 py-3 text-sm">
                <p className="font-medium text-foreground tabular-nums">{formatAuditDay(row.createdAt)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatAuditTime(row.createdAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="break-words text-sm text-foreground">{row.summary}</p>
                <RecordLine event={row} />
                <p className="mt-1 text-xs text-muted-foreground lg:hidden">{row.moduleLabel}</p>
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">{row.moduleLabel}</td>
              <td className="px-4 py-3"><ActionChip event={row} /></td>
              <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={`${row.source}:${row.id}`}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <ActionChip event={row} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatAuditDay(row.createdAt)} · {formatAuditTime(row.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 break-words text-sm text-foreground">{row.summary}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{row.moduleLabel}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
