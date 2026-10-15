import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import {
  AttendanceImportService, CLASSIFICATION_LABELS, CORRECTION_STATUSES, FLAG_LABELS,
  type CorrectionStatus, type ImportCandidate,
} from '@/services/attendance-import.service';

/**
 * Every record an import still needs a decision on, in one window.
 *
 * Opened from "Apply import" (and the "need a decision" line) when the batch is
 * not ready, so HR does not have to page through every row of the preview to
 * find the few that are holding it up. Records are grouped by why they are
 * held; each group can be decided at once, or each record on its own — or
 * fixed first ("Fix": correct the punches and status, with a reason), which
 * imports the day with HR's correction. When none are left, the import can be
 * applied from here.
 */

/** Flags that describe the day but never hold it, so they never name a group. */
const INFORMATIONAL = new Set([
  'MULTIPLE_SESSIONS', 'NO_PUNCHES', 'SCHEDULE_NOT_CONFIGURED',
  'ON_LEAVE_NO_PUNCH', 'HOLIDAY_NO_PUNCH', 'DAY_OFF_NO_PUNCH',
]);

const isConflict = (row: ImportCandidate) => row.classification !== 'NEW';

/** Why this record is waiting, as the group it belongs to. */
function reasonOf(row: ImportCandidate): string {
  if (isConflict(row)) return CLASSIFICATION_LABELS[row.classification];
  const flag = (row.reviewFlags ?? []).find((f) => !INFORMATIONAL.has(f));
  return flag ? FLAG_LABELS[flag] ?? flag : 'Needs a check';
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

type Choice = 'accept' | 'reject';

export function ImportDecisionsDialog({
  batchId,
  open,
  onOpenChange,
  onChanged,
  onApply,
}: {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Something was decided — the page refreshes its counts and table. */
  onChanged: () => void;
  /** Applies the import (the page's own apply, so its messages are shared). */
  onApply: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<string>('');

  /** Every pending record, a page of 200 at a time. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all: ImportCandidate[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await AttendanceImportService.preview(batchId, { needsDecision: true, page, limit: 200 });
        all.push(...res.rows);
        if (page >= res.pagination.totalPages) break;
      }
      setRows(all);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The records that need a decision could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (open) {
      setGroup('');
      load();
    }
  }, [open, load]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(reasonOf(r), (counts.get(reasonOf(r)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const visible = useMemo(() => (group ? rows.filter((r) => reasonOf(r) === group) : rows), [rows, group]);

  /**
   * "Accept" writes the file's version (Import / Use file). "Reject" leaves the
   * record as it is: Skip for a new day, Keep record for a conflict.
   */
  const decide = async (targets: ImportCandidate[], choice: Choice) => {
    if (!targets.length) return;
    setBusy(true);
    try {
      if (choice === 'accept') {
        await AttendanceImportService.decide(batchId, targets.map((r) => r.id), 'USE_UPLOADED');
      } else {
        const fresh = targets.filter((r) => !isConflict(r)).map((r) => r.id);
        const conflicts = targets.filter(isConflict).map((r) => r.id);
        if (fresh.length) await AttendanceImportService.decide(batchId, fresh, 'SKIP');
        if (conflicts.length) await AttendanceImportService.decide(batchId, conflicts, 'KEEP_EXISTING');
      }
      const done = new Set(targets.map((r) => r.id));
      const left = rows.filter((r) => !done.has(r.id));
      setRows(left);
      if (group && !left.some((r) => reasonOf(r) === group)) setGroup('');
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The decision could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  /** Saves HR's correction; the day is then decided (imported with the fix). */
  const fix = async (row: ImportCandidate, body: FixBody) => {
    setBusy(true);
    try {
      await AttendanceImportService.correct(batchId, row.id, body);
      const left = rows.filter((r) => r.id !== row.id);
      setRows(left);
      if (group && !left.some((r) => reasonOf(r) === group)) setGroup('');
      toast.success('Corrected — this day will be imported with your fix.');
      onChanged();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The correction could not be saved.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const allNew = visible.length > 0 && visible.every((r) => !isConflict(r));
  const allConflicts = visible.length > 0 && visible.every(isConflict);
  const acceptLabel = allNew ? 'Import' : allConflicts ? 'Use file' : 'Import / use file';
  const rejectLabel = allNew ? 'Skip' : allConflicts ? 'Keep records' : 'Skip / keep records';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
          <DialogTitle className="pr-10">Review before applying</DialogTitle>
          <DialogDescription>
            {loading
              ? 'Finding the records that need a decision…'
              : rows.length
                ? `${rows.length} record${rows.length === 1 ? '' : 's'} need${rows.length === 1 ? 's' : ''} your decision. Nothing is written until you apply the import.`
                : 'Every record has a decision.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-status-success-foreground" />
            <p className="text-sm font-semibold text-foreground">Nothing is waiting any more.</p>
            <p className="text-sm text-muted-foreground">Apply the import to write the records.</p>
            <Button
              variant="solid"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onApply();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <CheckCircle2 /> Apply import
            </Button>
          </div>
        ) : (
          <>
            {/* Why records are waiting — pick one to decide that group at once. */}
            <div className="px-5 py-3 border-b border-border space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <GroupChip label="All" count={rows.length} active={!group} onClick={() => setGroup('')} />
                {groups.map(([label, count]) => (
                  <GroupChip key={label} label={label} count={count} active={group === label} onClick={() => setGroup(label)} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">
                  {group ? `"${group}"` : 'All records'} ({visible.length}):
                </span>
                <Button size="sm" variant="create" disabled={busy} onClick={() => decide(visible, 'accept')}>
                  {acceptLabel} all {visible.length}
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(visible, 'reject')}>
                  {rejectLabel} for all {visible.length}
                </Button>
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto divide-y divide-border">
              {visible.map((row) => (
                <DecisionRow
                  key={row.id}
                  row={row}
                  busy={busy}
                  onDecide={(choice) => decide([row], choice)}
                  onFix={(body) => fix(row, body)}
                />
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-primary-500 bg-primary-600 text-white'
          : 'border-border bg-surface text-foreground hover:bg-surface-2'
      )}
    >
      {label} <span className="tabular-nums opacity-80">({count})</span>
    </button>
  );
}

type FixBody = { sessions: Array<{ in: string; out: string }>; status: CorrectionStatus; reason: string };

function DecisionRow({
  row,
  busy,
  onDecide,
  onFix,
}: {
  row: ImportCandidate;
  busy: boolean;
  onDecide: (choice: Choice) => void;
  onFix: (body: FixBody) => Promise<boolean>;
}) {
  const conflict = isConflict(row);
  const flags = (row.reviewFlags ?? []).filter((f) => !INFORMATIONAL.has(f));
  const [editing, setEditing] = useState(false);
  return (
    <li className="px-5 py-3 space-y-3">
     <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : `Code ${row.sourceEmployeeCode ?? '—'}`}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{fmtDate(row.date)}</span>
        </p>
        <p className="font-mono text-xs text-foreground">
          {row.sessions?.length
            ? row.sessions.map((s, i) => (
                <span key={i} className="mr-3">
                  {s.in ?? '—'} → {s.out ?? <span className="text-status-warning-foreground font-semibold">not closed</span>}
                </span>
              ))
            : <span className="italic text-muted-foreground">No punches</span>}
        </p>
        {conflict && row.classificationReason && <p className="text-xs text-muted-foreground">{row.classificationReason}</p>}
        {flags.map((f) => (
          <p key={f} className="flex items-start gap-1.5 text-xs font-semibold text-status-warning-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" /> {FLAG_LABELS[f] ?? f}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 shrink-0">
        <Button size="xs" variant="create" disabled={busy || editing} onClick={() => onDecide('accept')}>
          {conflict ? 'Use file' : 'Import'}
        </Button>
        <Button size="xs" variant="outline" disabled={busy || editing} onClick={() => onDecide('reject')}>
          {conflict ? 'Keep record' : 'Skip'}
        </Button>
        {row.employee && (
          <Button size="xs" variant="update" disabled={busy || editing} onClick={() => setEditing(true)}>
            <Pencil /> Fix
          </Button>
        )}
      </div>
     </div>
      {editing && (
        <FixEditor
          row={row}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            if (await onFix(body)) setEditing(false);
          }}
        />
      )}
    </li>
  );
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const NO_PUNCH_STATUSES: ReadonlySet<string> = new Set(['ABSENT', 'ON_LEAVE']);

/**
 * Corrects one day before it is imported: the clock-in/clock-out pairs, the
 * status, and a reason (kept on the record and in the audit log). The device's
 * own punches stay on file beside the correction.
 */
function FixEditor({
  row,
  busy,
  onSave,
  onCancel,
}: {
  row: ImportCandidate;
  busy: boolean;
  onSave: (body: FixBody) => void;
  onCancel: () => void;
}) {
  const [pairs, setPairs] = useState<Array<{ in: string; out: string }>>(() =>
    row.sessions?.length ? row.sessions.map((s) => ({ in: s.in ?? '', out: s.out ?? '' })) : [{ in: '', out: '' }]
  );
  const [status, setStatus] = useState<CorrectionStatus>(
    (CORRECTION_STATUSES.find((s) => s.value === row.status)?.value ?? 'PRESENT') as CorrectionStatus
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noPunches = NO_PUNCH_STATUSES.has(status);

  const setPair = (i: number, side: 'in' | 'out', value: string) => {
    setPairs((prev) => prev.map((p, k) => (k === i ? { ...p, [side]: value } : p)));
    setError(null);
  };

  const save = () => {
    if (!noPunches) {
      let previousOut = -1;
      for (const [i, p] of pairs.entries()) {
        if (!p.in || !p.out) return setError(`Pair ${i + 1}: enter both the clock-in and the clock-out.`);
        if (toMinutes(p.out) <= toMinutes(p.in)) return setError(`Pair ${i + 1}: the clock-out must be later than the clock-in.`);
        if (toMinutes(p.in) < previousOut) return setError(`Pair ${i + 1} starts before the previous pair ends.`);
        previousOut = toMinutes(p.out);
      }
    }
    if (reason.trim().length < 3) return setError('Say why this day was corrected — it is kept with the record.');
    onSave({ sessions: noPunches ? [] : pairs, status, reason: reason.trim() });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Clock-in and clock-out</p>
          {noPunches ? (
            <p className="text-xs text-muted-foreground">No punches are saved for this status.</p>
          ) : (
            <>
              {pairs.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground">Pair {i + 1}</span>
                  <input
                    type="time"
                    aria-label={`Pair ${i + 1} clock-in`}
                    value={p.in}
                    onChange={(e) => setPair(i, 'in', e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="time"
                    aria-label={`Pair ${i + 1} clock-out`}
                    value={p.out}
                    onChange={(e) => setPair(i, 'out', e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                  />
                  {pairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPairs((prev) => prev.filter((_, k) => k !== i))}
                      aria-label={`Remove pair ${i + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {pairs.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPairs((prev) => [...prev, { in: '', out: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a pair
                </button>
              )}
            </>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as CorrectionStatus); setError(null); }}
            className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
          >
            {CORRECTION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-foreground">Reason for the correction</span>
        <input
          type="text"
          value={reason}
          maxLength={500}
          onChange={(e) => { setReason(e.target.value); setError(null); }}
          placeholder="e.g. Forgot to clock out; supervisor confirmed 2:00 PM"
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </label>
      {error && <p role="alert" className="text-xs font-semibold text-status-danger-foreground">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="create" disabled={busy} onClick={save}>Save fix &amp; import</Button>
      </div>
    </div>
  );
}
