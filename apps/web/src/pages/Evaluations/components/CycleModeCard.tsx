import { BadgeCheck, Scale } from 'lucide-react';
import { EVALUATION_MODE_LABEL, type EvaluationCycle } from '@/services/evaluation.service';

/**
 * The cycle's evaluation type, as chosen when it was created (it cannot change:
 * the two types have different assignments). Standard: the head / supervisor /
 * coordinator evaluates. Weighted multi-rater: self + peer + head at the
 * percentages the cycle runs with — Hospicio's 20 / 20 / 60 for every new
 * cycle; an older cycle shows the percentages it was created with.
 */
export function CycleModeCard({ cycle }: { cycle: EvaluationCycle }) {
  const weighted = cycle.evaluationMode === 'WEIGHTED_MULTI_RATER';
  const official = weighted && cycle.selfWeight === 20 && cycle.peerWeight === 20 && cycle.headWeight === 60;
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-xs space-y-1">
      <p className="flex flex-wrap items-center gap-1.5 font-bold text-foreground">
        <Scale className="h-3.5 w-3.5" aria-hidden="true" /> {EVALUATION_MODE_LABEL[cycle.evaluationMode] ?? 'Evaluation'}
        {official && (
          <span className="inline-flex items-center gap-1 rounded-md border border-primary-300 bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-800 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Official weighting
          </span>
        )}
      </p>
      {weighted ? (
        <p className="text-foreground">
          Self {cycle.selfWeight}% + Peer {cycle.peerWeight}% + Head / supervisor / coordinator {cycle.headWeight}% = 100%.
          <span className="text-muted-foreground"> Several peers share the peer percentage (averaged first).</span>
        </p>
      ) : (
        <p className="text-foreground">
          The head / supervisor / coordinator evaluates the employee.
          <span className="text-muted-foreground"> No self rating, no peer rating — the result is the head's evaluation, averaged per review area.</span>
        </p>
      )}
    </div>
  );
}
