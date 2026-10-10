import { CheckCircle2, Circle, Clock, Eye, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import type { EvaluationAssignmentStatus, SubjectProgress } from '@/services/evaluation.service';

/**
 * One row per employee evaluated, one column per workflow step. Weighted
 * multi-rater: Self rating → Peer evaluations (x of y) → Head / supervisor /
 * coordinator → Discussion → HR finalisation. Standard: Head / supervisor /
 * coordinator → Discussion → HR finalisation. Counts are the actual
 * participants; every state is written out, never shown by colour alone.
 */

const done = (s?: EvaluationAssignmentStatus) => s === 'SUBMITTED' || s === 'FINALIZED';

function Step({ ok, label, tone }: { ok: boolean | null; label: string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const toneClass = ok ? STATUS_TONE_CHIP.success : tone === 'danger' ? STATUS_TONE_CHIP.danger : tone === 'warning' ? STATUS_TONE_CHIP.warning : STATUS_TONE_CHIP.neutral;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', toneClass)}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : ok === null ? <Circle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}
    </span>
  );
}

const STAGE_LABEL: Record<SubjectProgress['stage'], string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  DISCUSSION_PENDING: 'Discussion pending',
  READY_TO_FINALIZE: 'Ready for HR',
  FINALIZED: 'Finalized',
};

export function CycleWorkflowTable({
  subjects,
  weighted,
  cycleActive,
  onOpenAssignment,
  onManageParticipants,
}: {
  subjects: SubjectProgress[];
  /** Weighted multi-rater cycle (self + peer + head); otherwise a standard one. */
  weighted: boolean;
  cycleActive: boolean;
  onOpenAssignment: (assignmentId: string) => void;
  onManageParticipants: (subject: SubjectProgress) => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Evaluation workflow per employee</caption>
        <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold uppercase tracking-wider">
          <tr>
            <th scope="col" className="px-3 py-2.5">Employee</th>
            {weighted && <th scope="col" className="px-3 py-2.5">Self rating</th>}
            {weighted && <th scope="col" className="px-3 py-2.5">Peer evaluations</th>}
            <th scope="col" className="px-3 py-2.5">Head / supervisor / coordinator</th>
            <th scope="col" className="px-3 py-2.5">Discussion</th>
            <th scope="col" className="px-3 py-2.5">HR finalization</th>
            <th scope="col" className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {subjects.map((s) => (
            <tr key={s.employeeId} className="align-top hover:bg-muted/30 transition-colors">
              <td className="px-3 py-3">
                <p className="font-bold text-foreground">{s.employee?.firstName} {s.employee?.lastName}</p>
                <p className="text-[11px] text-muted-foreground">{s.employee?.employeeNumber} · {s.employee?.jobRole?.title || 'No job role'}</p>
                {s.templateName && <p className="text-[11px] text-muted-foreground">Form: {s.templateName}</p>}
                <p className="mt-1 text-[11px] font-semibold text-foreground">{STAGE_LABEL[s.stage]}</p>
              </td>
              {weighted && (
              <td className="px-3 py-3">
                {s.self ? <Step ok={done(s.self.status)} label={done(s.self.status) ? 'Completed' : 'Pending'} /> : <span className="text-muted-foreground">Not part of this cycle</span>}
              </td>
              )}
              {weighted && (
              <td className="px-3 py-3 space-y-1">
                {s.peers.total === 0 ? (
                  <span className="text-muted-foreground">None selected</span>
                ) : (
                  <>
                    <Step ok={s.peers.submitted === s.peers.total} label={`${s.peers.submitted} of ${s.peers.total} completed`} />
                    <ul className="text-[11px] text-muted-foreground">
                      {s.peers.items.map((p) => (
                        <li key={p.assignmentId}>{p.evaluator ? `${p.evaluator.firstName} ${p.evaluator.lastName}` : '—'} — {done(p.status) ? 'completed' : 'pending'}</li>
                      ))}
                    </ul>
                  </>
                )}
              </td>
              )}
              <td className="px-3 py-3 space-y-1">
                {s.head ? (
                  <>
                    <p className="font-medium text-foreground">{s.head.evaluator ? `${s.head.evaluator.firstName} ${s.head.evaluator.lastName}` : '—'}</p>
                    <Step ok={done(s.head.status)} label={done(s.head.status) ? 'Completed' : s.head.status === 'IN_PROGRESS' ? 'In progress' : 'Pending'} />
                  </>
                ) : (
                  <Step ok={false} tone="danger" label="Not assigned" />
                )}
              </td>
              <td className="px-3 py-3">
                {s.discussion.completed ? (
                  <Step ok label={`Completed${s.discussion.date ? ` · ${new Date(s.discussion.date).toLocaleDateString()}` : ''}`} />
                ) : s.finalization.finalized ? (
                  <span className="text-muted-foreground">Not recorded (finalized earlier)</span>
                ) : (
                  <Step ok={false} tone={s.head && done(s.head.status) ? 'warning' : 'neutral'} label="Pending" />
                )}
              </td>
              <td className="px-3 py-3">
                {s.finalization.finalized ? (
                  <Step ok label={`Completed${s.finalization.isEmployeeVisible ? ' · visible to employee' : ' · hidden from employee'}`} />
                ) : (
                  <>
                    <Step ok={false} tone={s.stage === 'READY_TO_FINALIZE' ? 'warning' : 'neutral'} label={s.stage === 'READY_TO_FINALIZE' ? 'Ready to finalize' : 'Pending'} />
                    {s.blockers.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                        {s.blockers.map((b) => <li key={b}>{b}</li>)}
                      </ul>
                    )}
                  </>
                )}
                {s.standardResult && s.standardResult.overall !== null && (
                  <p className="mt-1 text-[11px] text-foreground">
                    {s.standardResult.finalized ? 'Final result' : 'Head evaluation'}:{' '}
                    <span className="font-semibold">
                      {s.standardResult.overall.toFixed(2)}{s.standardResult.maxScore ? ` / ${s.standardResult.maxScore}` : ''}
                      {s.standardResult.percent !== null ? ` (${s.standardResult.percent}%)` : ''}
                    </span>
                  </p>
                )}
                {s.combined && (
                  <p className="mt-1 text-[11px] text-foreground">
                    {s.combined.finalized ? 'Final rating' : 'Calculated so far'}:{' '}
                    <span className="font-semibold">
                      {s.combined.final === null ? 'incomplete' : `${s.combined.final.toFixed(2)}${s.combined.maxScore ? ` / ${s.combined.maxScore}` : ''}${s.combined.finalPercent !== null && s.combined.finalPercent !== undefined ? ` (${s.combined.finalPercent}%)` : ''}`}
                    </span>
                    {s.combined.final === null && s.combined.missing.length > 0 && (
                      <span className="block text-muted-foreground">{s.combined.missing.join('; ')}</span>
                    )}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-right space-y-1.5">
                {cycleActive && !s.finalization.finalized && (
                  <Button variant="outline" size="xs" className="gap-1 w-full justify-center" onClick={() => onManageParticipants(s)}>
                    <Users className="h-3 w-3" /> Evaluators
                  </Button>
                )}
                {s.head && (
                  <Button variant="review" size="xs" className="gap-1 w-full justify-center" onClick={() => onOpenAssignment(s.head!.assignmentId)}>
                    <Eye className="h-3 w-3" /> {s.stage === 'READY_TO_FINALIZE' ? 'Review & finalize' : 'Head evaluation'}
                  </Button>
                )}
                {weighted && s.self && (
                  <Button variant="ghost" size="xs" className="gap-1 w-full justify-center" onClick={() => onOpenAssignment(s.self!.assignmentId)}>
                    <Eye className="h-3 w-3" /> Self rating
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
