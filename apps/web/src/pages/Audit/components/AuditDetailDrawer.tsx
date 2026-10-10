import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Lock, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import type { AuditDetailItem, AuditEvent } from '@/services/audit-logs.service';
import { ActionChip } from './AuditEventList';

const FULL = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ItemList({ items }: { items: AuditDetailItem[] }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border bg-surface-2/40">
      {items.map((d, i) => (
        <div key={`${d.label}-${i}`} className="grid gap-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
          <dt className="text-muted-foreground">{d.label}</dt>
          <dd className="break-words font-medium text-foreground">{d.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One audit event in full: who, when, what, to which record — and the
 * before/after values the event actually recorded. Nothing is filled in: a
 * value that was not recorded is not shown.
 */
export function AuditDetailDrawer({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-xl focus:outline-none sm:max-w-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          {event && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionChip event={event} />
                    <span className="text-xs font-medium text-muted-foreground">{event.moduleLabel}</span>
                  </div>
                  <DialogPrimitive.Title className="break-words text-base font-bold font-heading text-foreground">
                    {event.summary}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-muted-foreground">
                    {FULL.format(new Date(event.createdAt))}
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground" aria-label="Close details">
                  <X className="h-5 w-5" />
                </DialogPrimitive.Close>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Performed by">
                    {event.actor ? (
                      <>
                        {event.actor.name}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {event.actor.employeeNumber ?? event.actor.email}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System (no signed-in user)</span>
                    )}
                  </Fact>
                  <Fact label="Date & time">{FULL.format(new Date(event.createdAt))}</Fact>
                  <Fact label="Module">
                    {event.moduleLabel}
                    <span className="block text-xs font-normal text-muted-foreground">{event.tabLabel}</span>
                  </Fact>
                  <Fact label="Action">
                    {event.actionLabel}
                    <span className="block text-xs font-normal text-muted-foreground">{event.actionTypeLabel}</span>
                  </Fact>
                  <Fact label={event.subject?.kind === 'APPLICANT' ? 'Applicant' : 'Employee'}>
                    {event.subject ? (
                      <>
                        {event.subject.name}
                        {event.subject.reference && (
                          <span className="block text-xs font-normal text-muted-foreground">{event.subject.reference}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Fact>
                  <Fact label="Record">
                    {event.record.label ?? <span className="text-muted-foreground">—</span>}
                    <span className="block text-xs font-normal text-muted-foreground">{event.record.type}</span>
                  </Fact>
                  {(event.outcome === 'FAILURE' || event.tab === 'SECURITY') && (
                    <Fact label="Result">
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-1.5 py-0.5 text-xs font-semibold',
                          event.outcome === 'FAILURE' ? STATUS_TONE_CHIP.danger : STATUS_TONE_CHIP.success
                        )}
                      >
                        {event.outcome === 'FAILURE' ? 'Failed' : 'Successful'}
                      </span>
                    </Fact>
                  )}
                </dl>

                {event.confidential && (
                  <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Medical and psychological records are confidential: the audit log shows that a record changed, never its contents.
                  </p>
                )}

                {event.changes.length > 0 && (
                  <Section title="Changes" hint="Only the values this event recorded.">
                    <ul className="space-y-2">
                      {event.changes.map((c) => (
                        <li key={c.field} className="rounded-xl border border-border px-3 py-2.5">
                          <p className="text-sm font-semibold text-foreground">{c.label}</p>
                          {c.hidden ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Lock className="h-3 w-3" aria-hidden="true" /> Changed — the value is not shown in the audit log.
                            </p>
                          ) : (
                            <div className="mt-1.5 grid min-w-0 gap-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before</p>
                                <p className="break-words text-foreground">{c.before}</p>
                              </div>
                              <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:mt-4 sm:block" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">After</p>
                                <p className="break-words font-medium text-foreground">{c.after}</p>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {event.changedFields.length > 0 && (
                  <Section title="Changed fields" hint="This event recorded which fields changed, not their values.">
                    <div className="flex flex-wrap gap-1.5">
                      {event.changedFields.map((f) => (
                        <span key={f} className="rounded-md border border-border bg-surface-2/60 px-2 py-0.5 text-xs font-medium text-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {event.recorded && (
                  <Section title={event.recorded.title}>
                    <ItemList items={event.recorded.items} />
                  </Section>
                )}

                {event.details.length > 0 && (
                  <Section title="Details">
                    <ItemList items={event.details} />
                  </Section>
                )}

                {!event.changes.length && !event.changedFields.length && !event.recorded && !event.details.length && !event.confidential && (
                  <p className="text-sm text-muted-foreground">No further details were recorded for this event.</p>
                )}

                <details className="group rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground">Technical reference</summary>
                  <dl className="mt-2 space-y-1.5">
                    <div className="flex flex-wrap gap-x-2"><dt>Event code:</dt><dd className="break-all font-mono">{event.action}</dd></div>
                    <div className="flex flex-wrap gap-x-2"><dt>Entry ID:</dt><dd className="break-all font-mono">{event.id}</dd></div>
                    {event.record.reference && (
                      <div className="flex flex-wrap gap-x-2"><dt>Record ID:</dt><dd className="break-all font-mono">{event.record.reference}</dd></div>
                    )}
                    {event.source === 'schedule' && (
                      <div className="flex flex-wrap gap-x-2"><dt>Source:</dt><dd>Schedule & holiday history</dd></div>
                    )}
                    {event.ipAddress && (
                      <div className="flex flex-wrap gap-x-2"><dt>IP address:</dt><dd className="font-mono">{event.ipAddress}</dd></div>
                    )}
                  </dl>
                </details>

                <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Passwords, one-time codes, tokens, ID numbers and confidential notes are never shown in the audit log.
                </p>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
