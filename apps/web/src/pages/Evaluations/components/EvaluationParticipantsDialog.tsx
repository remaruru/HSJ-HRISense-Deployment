import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { EvaluationService, type EvaluationCandidate, type EvaluationCycle, type EvaluationMode, type SubjectProgress } from '@/services/evaluation.service';

/**
 * HR decides who evaluates one employee:
 *  · the head / supervisor / coordinator (explicitly chosen — not only the
 *    automatic immediate supervisor), and
 *  · in a weighted multi-rater cycle, peer evaluators, picked from a unit HR
 *    selects or individually.
 * Nobody is added unless HR ticks them. Only people the API would accept are
 * offered: HR cannot pick themselves, and full-access administrators are never
 * peers, and heads only of their own direct reports.
 */
export function EvaluationParticipantsDialog({
  open,
  onOpenChange,
  cycleId,
  evaluationMode,
  subject,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  evaluationMode: EvaluationMode;
  subject: SubjectProgress | null;
  onChanged: (cycle: EvaluationCycle) => void;
}) {
  const [candidates, setCandidates] = useState<EvaluationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [headId, setHeadId] = useState('');
  const [mode, setMode] = useState<'unit' | 'individual'>('unit');
  const [unitId, setUnitId] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !subject) return;
    setHeadId(subject.head?.evaluator?.id ?? '');
    setPicked([]);
    setSearch('');
    setUnitId('');
    setLoading(true);
    EvaluationService.listEvaluatorCandidates(cycleId, subject.employeeId)
      .then(setCandidates)
      .catch((err) => toast.error(getApiErrorMessage(err, 'Could not load employees.')))
      .finally(() => setLoading(false));
  }, [open, subject, cycleId]);

  const headLocked = subject?.head && (subject.head.status === 'SUBMITTED' || subject.head.status === 'FINALIZED');
  const peerIds = new Set(subject?.peers.items.map((p) => p.evaluator?.id).filter(Boolean) as string[]);
  const units = useMemo(() => {
    const map = new Map<string, string>();
    candidates.forEach((c) => c.unit && map.set(c.unit.id, c.unit.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [candidates]);
  const weighted = evaluationMode === 'WEIGHTED_MULTI_RATER';
  const pickable = candidates.filter((c) => c.canBePeer && !peerIds.has(c.id) && c.id !== subject?.head?.evaluator?.id);
  const shown =
    mode === 'unit'
      ? (unitId ? pickable.filter((c) => c.unit?.id === unitId) : [])
      : pickable.filter((c) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          return `${c.firstName} ${c.lastName} ${c.employeeNumber} ${c.jobRole?.title ?? ''}`.toLowerCase().includes(q);
        });

  const run = async (fn: () => Promise<EvaluationCycle>, message: string) => {
    setBusy(true);
    try {
      const cycle = await fn();
      onChanged(cycle);
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The change could not be saved.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!subject) return null;
  const name = `${subject.employee?.firstName ?? ''} ${subject.employee?.lastName ?? ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Evaluators for {name}</DialogTitle>
          <DialogDescription>
            HR chooses who evaluates this employee. HR administers the evaluation but does not rate it.
            {!weighted && ' This is a Standard Evaluation: the head / supervisor / coordinator is the only evaluator.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading employees…</p>
        ) : (
          <div className="space-y-6 text-sm">
            {/* Head / supervisor / coordinator */}
            <section className="space-y-2">
              <h4 className="font-bold text-foreground">Head / Supervisor / Coordinator</h4>
              <p className="text-xs text-muted-foreground">
                {subject.head?.evaluator
                  ? `Currently: ${subject.head.evaluator.firstName} ${subject.head.evaluator.lastName}${headLocked ? ' — already submitted, cannot be changed' : ''}.`
                  : 'Not assigned yet. This evaluation cannot be completed until a head evaluator is assigned.'}
              </p>
              {!headLocked && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="Head / supervisor / coordinator evaluator"
                    value={headId}
                    onChange={(e) => setHeadId(e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="">Select an employee…</option>
                    {candidates.filter((c) => c.canBeHead && !peerIds.has(c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.lastName}, {c.firstName} — {c.jobRole?.title ?? 'No job role'}{c.unit ? ` · ${c.unit.name}` : ''}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={busy || !headId || headId === subject.head?.evaluator?.id}
                    onClick={() => run(() => EvaluationService.setHeadEvaluator(cycleId, subject.employeeId, headId), 'Head evaluator saved.')}
                    className="gap-1"
                  >
                    <UserCheck className="h-4 w-4" /> {subject.head ? 'Change' : 'Assign'}
                  </Button>
                </div>
              )}
            </section>

            {/* Peers (weighted multi-rater cycles only) */}
            {weighted && (
            <section className="space-y-2">
              <h4 className="font-bold text-foreground">Peer evaluators ({subject.peers.total})</h4>
              {subject.peers.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No peer evaluators selected.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {subject.peers.items.map((p) => {
                    const submitted = p.status === 'SUBMITTED' || p.status === 'FINALIZED';
                    return (
                      <li key={p.assignmentId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-foreground">
                          {p.evaluator ? `${p.evaluator.firstName} ${p.evaluator.lastName}` : '—'}
                          <span className="ml-2 text-xs text-muted-foreground">{submitted ? 'Completed' : 'Pending'}</span>
                        </span>
                        {!submitted && (
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            className="gap-1 text-status-danger-foreground"
                            onClick={() => {
                              if (!confirm('Remove this peer evaluator? Their unsubmitted rating is discarded.')) return;
                              void run(() => EvaluationService.removePeer(p.assignmentId), 'Peer evaluator removed.');
                            }}
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">Add peers:</span>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="peer-mode" checked={mode === 'unit'} onChange={() => { setMode('unit'); setPicked([]); }} /> From a unit
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="peer-mode" checked={mode === 'individual'} onChange={() => { setMode('individual'); setPicked([]); }} /> Individually
                  </label>
                </div>
                {mode === 'unit' ? (
                  <select aria-label="Unit" value={unitId} onChange={(e) => { setUnitId(e.target.value); setPicked([]); }} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                    <option value="">Choose a unit to see its employees…</option>
                    {units.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  </select>
                ) : (
                  <input aria-label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number or job role" className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                )}
                {(mode === 'individual' || unitId) && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {shown.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No one to add here.</p>
                    ) : (
                      shown.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={picked.includes(c.id)}
                            onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                          />
                          <span className="text-foreground">{c.lastName}, {c.firstName}</span>
                          <span className="text-xs text-muted-foreground">{c.jobRole?.title ?? ''}{mode === 'individual' && c.unit ? ` · ${c.unit.name}` : ''}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Only the employees you tick evaluate this employee — choosing a unit does not add the whole unit.</p>
                <Button
                  size="sm"
                  disabled={busy || picked.length === 0}
                  onClick={async () => {
                    const ok = await run(() => EvaluationService.addPeers(cycleId, subject.employeeId, picked), `${picked.length} peer evaluator${picked.length === 1 ? '' : 's'} added.`);
                    if (ok) setPicked([]);
                  }}
                >
                  Add {picked.length || ''} selected
                </Button>
              </div>
            </section>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
