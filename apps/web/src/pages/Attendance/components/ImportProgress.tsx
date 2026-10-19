import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImportProgressState =
  | { phase: 'uploading'; fileName: string; percent: number }
  | { phase: 'reading'; fileName: string }
  | { phase: 'applying'; done: number; total: number | null };

/**
 * The slow parts of an attendance import — sending the file, reading and
 * checking it, writing the records — shown as a window the person cannot click
 * past, with a real bar where the progress is known and a clock where it isn't.
 */
export function ImportProgress({ state }: { state: ImportProgressState | null }) {
  const reduceMotion = useReducedMotion();
  const job = state ? (state.phase === 'applying' ? 'apply' : 'upload') : null;
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!job) return;
    setStartedAt(Date.now());
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [job]);

  if (!state) return null;

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const percent =
    state.phase === 'uploading'
      ? Math.round(state.percent)
      : state.phase === 'applying' && state.total
        ? Math.min(100, Math.round((state.done / state.total) * 100))
        : null;

  const steps =
    state.phase === 'applying'
      ? [{ label: 'Writing attendance records', done: false }]
      : [
          { label: 'Sending the file', done: state.phase === 'reading' },
          { label: 'Reading and checking every row', done: false },
        ];
  const current = steps.findIndex((s) => !s.done);

  const title = state.phase === 'applying' ? 'Applying the import…' : 'Uploading the attendance file…';
  const detail =
    state.phase === 'uploading'
      ? `${percent}% of ${state.fileName} sent.`
      : state.phase === 'reading'
        ? 'Matching every row to an employee and comparing it with the records on file. A month of attendance can take a minute.'
        : state.total
          ? `${state.done.toLocaleString()} of ${state.total.toLocaleString()} days written.`
          : 'Getting started…';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="import-progress-title"
      aria-describedby="import-progress-detail"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </span>
          <h2 id="import-progress-title" className="text-base font-bold text-foreground">{title}</h2>
        </div>

        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  s.done
                    ? 'border-status-success-border bg-status-success-surface text-status-success-foreground'
                    : i === current
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : 'border-border text-muted-foreground'
                )}
                aria-hidden="true"
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn(i === current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            </li>
          ))}
        </ol>

        <div
          className="relative h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-label={title}
        >
          {percent !== null ? (
            <div className="h-full rounded-full bg-primary-500 transition-[width] duration-500" style={{ width: `${Math.max(percent, 3)}%` }} />
          ) : reduceMotion ? (
            <div className="h-full w-full rounded-full bg-primary-500/60" />
          ) : (
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full bg-primary-500"
              initial={{ left: '-33%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
            />
          )}
        </div>

        <p id="import-progress-detail" className="text-sm text-muted-foreground" aria-live="polite">{detail}</p>

        <p className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>Please keep this page open.</span>
          <span>Time so far: <span className="font-semibold tabular-nums text-foreground">{clock}</span></span>
        </p>
      </div>
    </div>,
    document.body
  );
}
