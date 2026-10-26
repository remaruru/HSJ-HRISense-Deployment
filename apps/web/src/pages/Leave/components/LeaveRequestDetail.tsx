import { confirmAction } from '@/components/shared/ConfirmProvider';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, X, FileText, CalendarRange, Ban, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { LoadError } from '@/components/shared/LoadError';
import { cn, formatDate } from '@/lib/utils';
import { formatEmploymentDate } from '@/lib/employment';
import { leaveApi } from '@/services/api/leave';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { NO_CREDIT_LEAVE_TYPES, daysText, leaveCalendarDays, leaveStage, leaveTypeLabel } from '@/lib/leaveTypes';
import { toast } from 'sonner';

/**
 * One leave request, the way Hospicio's Leave Application Form reads — the
 * employee, the details of leave, the head's recommendation, the HR decision and
 * the leave record — plus the history of what actually happened.
 *
 *  Employee → Head / Supervisor / Coordinator (endorse, propose a change, or
 *  decline) → HR (approve as requested, approve the proposed change, approve
 *  other dates, or decline).
 *
 * A proposed change never alters the request; when HR approves something
 * different, the original request stays visible beside the final leave.
 */

const day = (v?: string | null) => (v ? formatEmploymentDate(v) : '—');
// createdAt is the moment of filing, not a calendar date: read in local time, or a request filed
// before 8 AM in Manila shows the previous (UTC) day
const filedOn = (v?: string | null) => (v ? formatDate(v) : '—');
const period = (s?: string | null, e?: string | null) => (s && e && s.slice(0, 10) !== e.slice(0, 10) ? `${day(s)} – ${day(e)}` : day(s));

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-muted/20 p-3.5', className)}>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value, span }: { label: string; value: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn('min-w-0', span && 'col-span-2')}>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground break-words">{value ?? '—'}</p>
    </div>
  );
}

/** Submitted → head → HR → result, with only the steps this request goes through. */
function StageTracker({ leave }: { leave: any }) {
  const viaHead = leave.routedTo !== 'HR';
  const decided = ['APPROVED', 'REJECTED', 'CANCELLED'].includes(leave.status);
  const endorsed = leave.status === 'FOR_REVIEW' || !!leave.endorsedAt;
  // Declined at the head stage: it never reached HR.
  const headDeclined = viaHead && !endorsed && leave.status === 'REJECTED';
  const result = leaveStage(leave);
  type State = 'done' | 'current' | 'upcoming' | 'skipped';
  const steps: Array<{ label: string; state: State }> = [
    { label: 'Submitted', state: 'done' },
    ...(viaHead
      ? [{
          label: leave.proposedStartDate ? 'Head proposed a change' : endorsed ? 'Endorsed by head' : headDeclined ? 'Declined by head' : 'Head review',
          state: (endorsed || headDeclined ? 'done' : decided ? 'skipped' : 'current') as State,
        }]
      : []),
    {
      label: 'HR decision',
      state: headDeclined || (leave.status === 'CANCELLED') ? 'skipped' : decided ? 'done' : endorsed || !viaHead ? 'current' : 'upcoming',
    },
    { label: decided ? result.label : 'Result', state: decided ? ('done' as const) : ('upcoming' as const) },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs" aria-label="Request stage">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold',
              s.state === 'done' && 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-900/40 dark:text-primary-200',
              s.state === 'current' && 'border-status-warning-border bg-status-warning-surface text-status-warning-foreground',
              (s.state === 'upcoming' || s.state === 'skipped') && 'border-border text-muted-foreground'
            )}
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            {s.state === 'done' && <Check className="h-3 w-3" aria-hidden="true" />}
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

/** Other dates (or fewer days) with a reason — used by the head and by HR. */
function ChangeForm({
  leave,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  leave: any;
  submitLabel: string;
  busy: boolean;
  onSubmit: (change: { startDate: string; endDate: string; reason: string }) => void;
  onCancel: () => void;
}) {
  const [startDate, setStartDate] = useState(String(leave.startDate).slice(0, 10));
  const [endDate, setEndDate] = useState(String(leave.endDate).slice(0, 10));
  const [reason, setReason] = useState('');
  const days = leaveCalendarDays(startDate, endDate);
  const same = startDate === String(leave.startDate).slice(0, 10) && endDate === String(leave.endDate).slice(0, 10);
  const control = 'w-full h-9 px-3 rounded-xl border-2 border-border bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400';
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-foreground">
          From
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className={cn(control, 'mt-1')} />
        </label>
        <label className="text-xs font-semibold text-foreground">
          To
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={cn(control, 'mt-1')} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {days ? <>Total: <strong className="text-foreground">{daysText(days)}</strong> instead of {daysText(leave.totalDays)} requested</> : 'Choose a valid period.'}
      </p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for the change (required) — e.g. staffing coverage"
        aria-label="Reason for the change"
        className="w-full px-3 py-2 rounded-xl border-2 border-border bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="update" disabled={busy || !days || same || !reason.trim()} onClick={() => onSubmit({ startDate, endDate, reason: reason.trim() })}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="h-3.5 w-3.5" />} {submitLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>Back</Button>
      </div>
      {same && <p className="text-xs text-muted-foreground">Change the dates, or use the plain action instead.</p>}
    </div>
  );
}

export function LeaveRequestDetail({
  leaveId,
  onClose,
  onChanged,
  isHR,
  isTeamHead,
  viewerEmployeeId,
}: {
  leaveId: string;
  onClose: () => void;
  /** Called after any action that changed the request. */
  onChanged: () => void;
  /** HR — final decision. */
  isHR: boolean;
  /** Viewing from the head's Team tab — the endorsement stage. */
  isTeamHead: boolean;
  viewerEmployeeId?: string;
}) {
  const [leave, setLeave] = useState<any | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'decline' | 'propose' | 'revise'>('none');
  const [note, setNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await leaveApi.getById(leaveId);
      setLeave(res.data);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'This leave request could not be loaded.'));
    }
  };
  useEffect(() => {
    void load();
  }, [leaveId]);

  const act = async (fn: () => Promise<any>, success: string) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res?.message || success);
      if (res?.data?.balanceWarning) toast.warning(res.data.balanceWarning);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const own = !!leave && leave.employeeId === viewerEmployeeId;
  const open = !!leave && ['PENDING', 'FOR_REVIEW'].includes(leave.status);
  const canHead = !!leave && isTeamHead && !own && leave.status === 'PENDING';
  const canHR = !!leave && isHR && open;
  const canCancel = own && open;
  const stage = leaveStage(leave);
  const record = leave?.leaveRecord;
  const revised = !!leave?.originalStartDate;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog" aria-label="Leave application">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-2 border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b-2 border-border bg-muted/30 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">Leave Application</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-5">
          {loadError && <LoadError message={loadError} onRetry={load} />}
          {!leave && !loadError && (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary-500" aria-label="Loading" /></div>
          )}

          {leave && (
            <>
              <div className="space-y-2.5">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold', STATUS_TONE_CHIP[stage.tone])}>{stage.label}</span>
                <StageTracker leave={leave} />
              </div>

              {/* Employee information — from the record, never typed */}
              <Section title="Employee information">
                <div className="mb-3 flex items-center gap-3">
                  <Avatar name={`${leave.employee?.firstName} ${leave.employee?.lastName}`} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{leave.employee?.firstName} {leave.employee?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{leave.employee?.employeeNumber}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Position" value={leave.employee?.jobRole?.title} />
                  <Field label="Unit / Department" value={[leave.employee?.unit?.name, leave.employee?.department?.name].filter(Boolean).join(' · ') || '—'} />
                  <Field label="Date employed" value={day(leave.employee?.hireDate)} />
                  <Field label="Years of service" value={leave.completedYearsOfService === null ? '—' : `${leave.completedYearsOfService} completed year${leave.completedYearsOfService === 1 ? '' : 's'}`} />
                </div>
              </Section>

              {/* Details of leave — the ORIGINAL request when the approval changed it */}
              <Section title={revised ? 'Original request' : 'Details of leave'}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Leave type" value={leaveTypeLabel(leave.leaveType)} />
                  <Field label="Total number of leave applied" value={daysText(revised ? leave.originalTotalDays : leave.totalDays)} />
                  <Field label="From – To" value={revised ? period(leave.originalStartDate, leave.originalEndDate) : period(leave.startDate, leave.endDate)} span />
                  <Field label="Reason for leave" value={leave.reason} span />
                  <Field label="Address during leave" value={leave.addressDuringLeave || 'Not given'} span />
                  <Field label="Contact number" value={leave.contactNumber || 'Not given'} />
                  <Field label="Date filed" value={filedOn(leave.createdAt)} />
                </div>
              </Section>

              {revised && (
                <Section title="Final approved leave" className="border-status-success-border bg-status-success-surface/40">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From – To" value={period(leave.startDate, leave.endDate)} />
                    <Field label="Days" value={daysText(leave.totalDays)} />
                    <Field label="Adjustment" value={leave.adjustmentReason} span />
                  </div>
                </Section>
              )}

              {leave.proposedStartDate && (
                <Section title={`Change proposed by ${leave.proposedBy ? `${leave.proposedBy.firstName} ${leave.proposedBy.lastName}` : 'the head'}`} className="border-status-info-border bg-status-info-surface/40">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Proposed From – To" value={period(leave.proposedStartDate, leave.proposedEndDate)} />
                    <Field label="Days" value={daysText(leave.proposedTotalDays)} />
                    <Field label="Reason" value={leave.proposalReason} span />
                  </div>
                </Section>
              )}

              {/* Leave record — the form's "Total Available / Less: This Leave / Balance to Date" */}
              <Section title={`Leave record${record ? ` · ${record.year}` : ''}`}>
                {record ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Total available', record.totalAvailable],
                        [leave.status === 'APPROVED' ? 'Less: approved' : 'Less: this leave', record.lessThisLeave],
                        ['Balance after', record.balanceAfter],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-lg border border-border bg-surface px-2 py-2">
                          <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                          <p className={cn('text-lg font-extrabold tabular-nums', Number(value) < 0 ? 'text-status-danger-foreground' : 'text-foreground')}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {record.proposedBalanceAfter !== null && leave.status === 'FOR_REVIEW' && (
                      <p className="mt-2 text-xs text-muted-foreground">If the proposed change is approved: less {daysText(leave.proposedTotalDays)} → balance after <strong className="text-foreground">{record.proposedBalanceAfter}</strong>.</p>
                    )}
                    {!record.counted && <p className="mt-2 text-xs text-muted-foreground">This request is not deducted from the balance ({stage.label.toLowerCase()}).</p>}
                    {record.balanceAfter < 0 && record.counted && (
                      <p className="mt-2 text-xs font-medium text-status-warning-foreground">This is more than the available balance — HR decides how to handle the difference.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {NO_CREDIT_LEAVE_TYPES.has(leave.leaveType)
                      ? 'Leave without pay uses no leave credits.'
                      : `No ${leaveTypeLabel(leave.leaveType).toLowerCase()} credits are on record for this employee this year.`}
                  </p>
                )}
              </Section>

              {(leave.endorsementNote || leave.hrNotes || leave.rejectionReason) && (
                <div className="space-y-2">
                  {leave.endorsementNote && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Head's note{leave.endorsedBy ? ` · ${leave.endorsedBy.firstName} ${leave.endorsedBy.lastName}` : ''}</p>
                      <p className="mt-1 text-sm text-foreground">{leave.endorsementNote}</p>
                    </div>
                  )}
                  {leave.hrNotes && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes</p>
                      <p className="mt-1 text-sm text-foreground">{leave.hrNotes}</p>
                    </div>
                  )}
                  {leave.status === 'REJECTED' && leave.rejectionReason && (
                    <div className={cn('rounded-xl border p-3', STATUS_TONE_CHIP.danger)}>
                      <p className="text-[11px] font-bold uppercase tracking-wide">Reason declined</p>
                      <p className="mt-1 text-sm">{leave.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {leave.history?.length > 0 && (
                <Section title="History">
                  <ol className="space-y-2.5">
                    {leave.history.map((h: any, i: number) => (
                      <li key={i} className="relative pl-4">
                        <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary-500" aria-hidden="true" />
                        <p className="text-sm font-semibold text-foreground">{h.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                          {h.by ? ` · ${h.by}${h.byRole ? `, ${h.byRole}` : ''}` : ''}
                        </p>
                        {h.detail && <p className="mt-0.5 text-xs text-foreground/80">{h.detail}</p>}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </>
          )}
        </div>

        {/* Actions — only the ones this viewer may take at this stage */}
        {leave && (canHead || canHR || canCancel) && (
          <div className="space-y-3 border-t-2 border-border p-4">
            {mode === 'decline' ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Reason for declining (required)"
                  aria-label="Reason for declining"
                  className="w-full px-3 py-2 rounded-xl border-2 border-danger/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-danger-400 resize-none"
                />
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" disabled={busy || !declineReason.trim()} onClick={() => act(() => leaveApi.reject(leave.id, declineReason.trim()), 'Leave request declined.')}>
                    Confirm Decline
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setMode('none')} disabled={busy}>Back</Button>
                </div>
              </div>
            ) : mode === 'propose' ? (
              <ChangeForm leave={leave} busy={busy} submitLabel="Endorse with this change" onCancel={() => setMode('none')}
                onSubmit={(change) => act(() => leaveApi.endorse(leave.id, note || undefined, change), 'Endorsed to HR with your proposed change.')} />
            ) : mode === 'revise' ? (
              <ChangeForm leave={leave} busy={busy} submitLabel="Approve these dates" onCancel={() => setMode('none')}
                onSubmit={(change) => act(() => leaveApi.approve(leave.id, note || undefined, change), 'Approved with the revised dates.')} />
            ) : (
              <>
                {(canHead || canHR) && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={canHR ? 'Notes (optional)' : 'Note to HR (optional)'}
                    aria-label={canHR ? 'Notes' : 'Note to HR'}
                    className="w-full h-9 px-3 rounded-xl border-2 border-border bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {canHead && (
                    <>
                      <Button variant="review" disabled={busy} onClick={() => act(() => leaveApi.endorse(leave.id, note || undefined), 'Endorsed to HR.')} title="Recommend this request to HR as filed. HR makes the final decision.">
                        <FileText /> Endorse to HR
                      </Button>
                      <Button variant="update" disabled={busy} onClick={() => setMode('propose')} title="Recommend other dates or fewer days to HR">
                        <CalendarRange /> Propose a change
                      </Button>
                    </>
                  )}
                  {canHR && (
                    <>
                      <Button variant="create" disabled={busy} onClick={() => act(() => leaveApi.approve(leave.id, note || undefined), 'Leave request approved.')}>
                        <CheckCircle2 /> {leave.proposedStartDate ? 'Approve as requested' : 'Approve'}
                      </Button>
                      {leave.proposedStartDate && (
                        <Button variant="create" disabled={busy} onClick={() => act(() => leaveApi.approve(leave.id, note || undefined, { useProposal: true }), 'Approved with the proposed change.')}>
                          <CheckCircle2 /> Approve proposed change
                        </Button>
                      )}
                      <Button variant="update" disabled={busy} onClick={() => setMode('revise')} title="Approve other dates or fewer days">
                        <CalendarRange /> Approve other dates
                      </Button>
                    </>
                  )}
                  {(canHead || canHR) && (
                    <Button variant="delete" disabled={busy} onClick={() => setMode('decline')}>
                      <XCircle /> Decline
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: 'Cancel this leave request?',
                          message: 'It will be withdrawn and its days released.',
                          confirmLabel: 'Cancel request',
                          cancelLabel: 'Keep it',
                          danger: true,
                        });
                        if (ok) void act(() => leaveApi.cancel(leave.id), 'Leave request cancelled.');
                      }}
                    >
                      <Ban /> Cancel request
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
