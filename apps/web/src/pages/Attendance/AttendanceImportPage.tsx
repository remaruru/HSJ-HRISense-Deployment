import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud, FileSpreadsheet, RefreshCw, CheckCircle2, AlertTriangle,
  Info, Users, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { CodeMappingPanel } from './components/CodeMappingPanel';
import { IdentityIssuesPanel } from './components/IdentityIssuesPanel';
import {
  AttendanceImportService, CLASSIFICATION_LABELS, FLAG_LABELS,
  type ImportBatch, type ImportCandidate, type ImportClassification, type ImportPreview,
} from '@/services/attendance-import.service';
import { LoadError } from '@/components/shared/LoadError';

/**
 * Attendance import.
 *
 * The flow is deliberately two-step: uploading a file produces a PREVIEW and
 * writes no attendance at all. Nothing reaches an employee's record until HR
 * reads the summary and presses Apply.
 */

const TONE: Record<ImportClassification, keyof typeof STATUS_TONE_CHIP> = {
  NEW: 'success',
  EXACT_DUPLICATE: 'neutral',
  ENRICHMENT: 'info',
  CONFLICT: 'warning',
  CONFLICT_MANUAL: 'danger',
  DUPLICATE_IN_FILE: 'neutral',
  UNKNOWN_EMPLOYEE: 'accent',
  INVALID: 'danger',
};

/** Flags that mean "two true facts collide", as opposed to a data problem. */
const OVERLAP_FLAGS = new Set([
  'WORKED_ON_SCHEDULED_DAY_OFF',
  'ATTENDANCE_DURING_APPROVED_LEAVE',
  'WORKED_ON_HOLIDAY',
]);

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtBytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * The import screen as its own route.
 *
 * The work itself lives in `AttendanceImportPanel` so Daily Monitoring can host
 * the same thing as a tab without either copy drifting from the other. This
 * route is kept so existing links and bookmarks still land somewhere real.
 */
export default function AttendanceImportPage() {
  return <AttendanceImportPanel />;
}

export function AttendanceImportPanel({ embedded = false }: { embedded?: boolean }) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filter, setFilter] = useState<ImportClassification | ''>('');
  const [page, setPage] = useState(1);
  const [applying, setApplying] = useState(false);

  // A failed history load is not "nothing imported yet".
  const [historyError, setHistoryError] = useState<string | null>(null);
  const loadBatches = useCallback(async () => {
    setLoading(true);
    setHistoryError(null);
    try {
      const data = await AttendanceImportService.list();
      setBatches(data.rows);
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, 'The import history could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async (batchId: string, cls: ImportClassification | '', p: number) => {
    try {
      setPreview(await AttendanceImportService.preview(batchId, { classification: cls || undefined, page: p }));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The preview could not be loaded.'));
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { if (activeId) loadPreview(activeId, filter, page); }, [activeId, filter, page, loadPreview]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { batch, previouslyApplied } = await AttendanceImportService.upload(file);
      if (previouslyApplied) {
        toast.warning(`This file was already imported on ${fmtDate(previouslyApplied.at)}. Review the preview before applying it again.`);
      }
      toast.success('File read. Nothing has been written yet — review the preview below.');
      setActiveId(batch.id);
      setFilter('');
      setPage(1);
      loadBatches();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The file could not be imported.'));
    } finally {
      setUploading(false);
    }
  };

  const handleApply = async () => {
    if (!activeId) return;
    setApplying(true);
    try {
      const batch = await AttendanceImportService.apply(activeId);
      toast.success(`Applied ${batch.countApplied} record${batch.countApplied === 1 ? '' : 's'}.`);
      loadBatches();
      loadPreview(activeId, filter, page);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The import could not be applied.'));
    } finally {
      setApplying(false);
    }
  };

  const decide = async (ids: string[], decision: 'USE_UPLOADED' | 'KEEP_EXISTING' | 'SKIP') => {
    if (!activeId) return;
    try {
      await AttendanceImportService.decide(activeId, ids, decision);
      loadPreview(activeId, filter, page);
      loadBatches();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The decision could not be saved.'));
    }
  };

  const batch = preview?.batch;
  const needsDecision =
    (batch?.countConflict ?? 0) + (batch?.countConflictManual ?? 0) + (batch?.countEnrichment ?? 0);

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={loadBatches} disabled={loading} aria-label="Refresh imports">
                <RefreshCw className={cn(loading && 'animate-spin')} /> Refresh
              </Button>
              <label>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
                />
                <span className={cn(
                  'inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 text-[0.9375rem] font-semibold cursor-pointer',
                  'bg-status-success-surface text-status-success-foreground border-status-success-border hover:brightness-95',
                  uploading && 'pointer-events-none opacity-50'
                )}>
                  <UploadCloud className="h-[1.125rem] w-[1.125rem]" />
                  {uploading ? 'Reading…' : 'Upload export'}
                </span>
              </label>
    </div>
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={cn('space-y-6', !embedded && 'p-6 max-w-screen-2xl mx-auto')}
    >
      {/*
        Embedded, the surrounding page already carries the title — repeating it
        would give the screen two headings. Only the controls come across.
      */}
      <motion.div variants={staggerItem} className={cn(embedded && 'flex justify-end')}>
        {embedded ? actions : (
          <PageHeader
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Attendance Import"
            subtitle="Read the timekeeping export, review what it would change, then apply it."
            actions={actions}
          />
        )}
      </motion.div>

      {/* Nothing is written on upload — say so before HR wonders. */}
      <motion.div variants={staggerItem} className="flex items-start gap-3 p-4 rounded-2xl bg-status-info-surface border border-status-info-border">
        <Info className="h-5 w-5 text-status-info-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-status-info-foreground">
          <p className="font-bold">Uploading changes nothing on its own.</p>
          <p className="mt-0.5">
            The file is read and compared against what HRISense already holds. Attendance records are written
            only when you press Apply, and only for the rows you have accepted. A day the file does not mention
            is left as it is — it never becomes an absence.
          </p>
        </div>
      </motion.div>

      {/* ── History ─────────────────────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">Import history</h2>
          <Badge variant="outline" className="text-xs">{batches.length}</Badge>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : historyError ? (
          <div className="p-5"><LoadError compact message={historyError} onRetry={loadBatches} /></div>
        ) : batches.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground italic">No attendance file has been imported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-surface-2 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">File</th>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Rows</th>
                  <th className="px-5 py-3 font-semibold">Applied</th>
                  <th className="px-5 py-3 font-semibold">Uploaded by</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className={cn('border-b border-border last:border-0', activeId === b.id && 'bg-nav-selected-surface/40')}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{b.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">{fmtBytes(b.fileSizeBytes)} · {fmtDate(b.uploadedAt)}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {b.detectedPeriodStart ? `${fmtDate(b.detectedPeriodStart)} – ${fmtDate(b.detectedPeriodEnd)}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={cn('text-xs', b.status === 'COMPLETED' ? STATUS_TONE_CHIP.success : b.status === 'FAILED' ? STATUS_TONE_CHIP.danger : STATUS_TONE_CHIP.warning)}>
                        {b.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{b.totalSourceRows}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{b.countApplied}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.uploadedByUser?.email ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="review" size="xs" onClick={() => { setActiveId(b.id); setFilter(''); setPage(1); }}>
                          Review
                        </Button>
                        {(b.status === 'VALIDATED' || b.status === 'UPLOADED' || b.status === 'FAILED') && (
                          <Button
                            variant="delete"
                            size="xs"
                            title="Cancel this import"
                            onClick={async () => {
                              try {
                                await AttendanceImportService.cancel(b.id);
                                toast.success('Import cancelled.');
                                if (activeId === b.id) { setActiveId(null); setPreview(null); }
                                loadBatches();
                              } catch (err) {
                                toast.error(getApiErrorMessage(err, 'The import could not be cancelled.'));
                              }
                            }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Preview ─────────────────────────────────────────────────────── */}
      {batch && (
        <motion.div variants={staggerItem} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {([
              ['NEW', batch.countNew],
              ['EXACT_DUPLICATE', batch.countExactDuplicate],
              ['ENRICHMENT', batch.countEnrichment],
              ['CONFLICT', batch.countConflict],
              ['CONFLICT_MANUAL', batch.countConflictManual],
              ['DUPLICATE_IN_FILE', batch.countDuplicateInFile],
              ['UNKNOWN_EMPLOYEE', batch.countUnknownEmployee],
              ['INVALID', batch.countInvalid],
            ] as Array<[ImportClassification, number]>).map(([cls, n]) => (
              <button
                key={cls}
                type="button"
                onClick={() => { setFilter(filter === cls ? '' : cls); setPage(1); }}
                className={cn(
                  'p-3 rounded-xl border text-left transition-colors',
                  STATUS_TONE_CHIP[TONE[cls]],
                  filter === cls && 'ring-2 ring-ring'
                )}
              >
                <p className="text-xl font-bold tabular-nums">{n}</p>
                <p className="text-[11px] font-semibold leading-tight mt-0.5">{CLASSIFICATION_LABELS[cls]}</p>
              </button>
            ))}
          </div>

          {/*
            Shown above the unmapped codes: a number that matched the WRONG
            person is more dangerous than one that matched nobody, because it
            would otherwise have gone in unnoticed.
          */}
          {preview && preview.identityIssues?.length > 0 && (
            <IdentityIssuesPanel issues={preview.identityIssues} onReassigned={() => { loadPreview(batch.id, filter, page); loadBatches(); }} />
          )}

          {batch.countUnknownEmployee > 0 && preview && preview.unmatchedCodes.length > 0 && (
            <CodeMappingPanel
              codes={preview.unmatchedCodes}
              onMapped={() => { loadPreview(batch.id, filter, page); loadBatches(); }}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {needsDecision > 0
                ? `${needsDecision} record${needsDecision === 1 ? '' : 's'} need a decision before this import can be applied.`
                : 'Every record has a decision.'}
            </p>
            <div className="flex items-center gap-2">
              {filter && <Button variant="outline" size="sm" onClick={() => { setFilter(''); setPage(1); }}>Clear filter</Button>}
              <Button
                variant="solid"
                onClick={handleApply}
                disabled={applying || batch.status !== 'VALIDATED' || needsDecision > 0}
                title={needsDecision > 0 ? 'Decide on every conflict first' : undefined}
              >
                <CheckCircle2 /> {applying ? 'Applying…' : 'Apply import'}
              </Button>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-surface-2 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Employee</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Punches</th>
                    <th className="px-5 py-3 font-semibold">Source hours</th>
                    <th className="px-5 py-3 font-semibold">What happens</th>
                    <th className="px-5 py-3 font-semibold text-right">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {preview?.rows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground italic">Nothing in this category.</td></tr>
                  )}
                  {preview?.rows.map((row) => <PreviewRow key={row.id} row={row} onDecide={decide} />)}
                </tbody>
              </table>
            </div>

            {preview && preview.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                <span>Page {preview.pagination.page} of {preview.pagination.totalPages} · {preview.pagination.total} rows</span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                  <Button variant="outline" size="xs" disabled={page >= preview.pagination.totalPages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function PreviewRow({
  row,
  onDecide,
}: {
  row: ImportCandidate;
  onDecide: (ids: string[], decision: 'USE_UPLOADED' | 'KEEP_EXISTING' | 'SKIP') => void;
}) {
  const flags = row.reviewFlags ?? [];
  const overlaps = flags.filter((f) => OVERLAP_FLAGS.has(f));
  const others = flags.filter((f) => !OVERLAP_FLAGS.has(f));
  const decidable = ['CONFLICT', 'CONFLICT_MANUAL', 'ENRICHMENT'].includes(row.classification);

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-5 py-3">
        {row.employee ? (
          <>
            <p className="font-semibold text-foreground">{row.employee.firstName} {row.employee.lastName}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.employee.employeeNumber}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Unmatched code <span className="font-mono not-italic font-semibold">{row.sourceEmployeeCode ?? '—'}</span>
          </p>
        )}
      </td>
      <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(row.date)}</td>
      <td className="px-5 py-3">
        {row.sessions?.length ? (
          <ul className="space-y-0.5">
            {row.sessions.map((s, i) => (
              <li key={i} className="font-mono text-xs text-foreground">
                {s.in ?? '—'} → {s.out ?? <span className="text-status-warning-foreground font-semibold">not closed</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-muted-foreground italic">No punches</span>
        )}
      </td>
      <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {row.sourceHours ? (
          <>
            <div>worked {row.sourceHours.worked ?? 0}</div>
            <div>OT {row.sourceHours.overtime ?? 0} · UT {row.sourceHours.undertime ?? 0}</div>
          </>
        ) : '—'}
      </td>
      <td className="px-5 py-3 max-w-md">
        <Badge variant="outline" className={cn('text-xs', STATUS_TONE_CHIP[TONE[row.classification]])}>
          {CLASSIFICATION_LABELS[row.classification]}
        </Badge>
        {row.classificationReason && (
          <p className="text-xs text-muted-foreground mt-1">{row.classificationReason}</p>
        )}
        {/* Two true facts colliding — shown loudly, resolved by nobody but HR. */}
        {overlaps.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {overlaps.map((f) => (
              <p key={f} className="flex items-start gap-1.5 text-xs font-semibold text-status-warning-foreground">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" /> {FLAG_LABELS[f] ?? f}
              </p>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{others.map((f) => FLAG_LABELS[f] ?? f).join(' · ')}</p>
        )}
        {row.applyError && <p className="text-xs text-status-danger-foreground mt-1">{row.applyError}</p>}
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {row.appliedAt ? (
          <Badge variant="outline" className={cn('text-xs', STATUS_TONE_CHIP.success)}>Applied</Badge>
        ) : decidable ? (
          <div className="flex justify-end gap-1.5">
            <Button
              variant={row.hrDecision === 'USE_UPLOADED' ? 'create' : 'outline'}
              size="xs"
              onClick={() => onDecide([row.id], 'USE_UPLOADED')}
            >
              Use file
            </Button>
            <Button
              variant={row.hrDecision === 'KEEP_EXISTING' ? 'review' : 'outline'}
              size="xs"
              onClick={() => onDecide([row.id], 'KEEP_EXISTING')}
            >
              Keep record
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{row.hrDecision.replace(/_/g, ' ').toLowerCase()}</span>
        )}
      </td>
    </tr>
  );
}
