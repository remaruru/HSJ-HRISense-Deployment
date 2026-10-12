import { BreakdownButton, MetricBreakdownDialog, ratioSpec, type MetricBreakdownSpec } from '@/components/shared/MetricBreakdown';
import { formatPct } from '@/lib/percent';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowUpRight, Info, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { AssistantChart } from '@/components/ai/AssistantChart';
import { chartSchema, type AssistantChartData } from '@/services/ai-chart.schema';

/**
 * HR's workforce summary (AI Assistance page → "Workforce summary" tab).
 *
 * Everything here comes from the API. There are no hardcoded insights,
 * confidence scores, health scores, alert counts, employee counts or timestamps.
 *
 * The deterministic fact sheet (`/ai/facts`) is always shown, because it is plain
 * database aggregation. The AI narrative (`/ai/analyze`) is optional and requires
 * a configured provider; when none is configured the panel says so rather than
 * inventing content. Free-form questions now go to the assistant tab, which
 * answers for every access level with the same data rules.
 */

/**
 * Where an observation's figures came from: the HRISense page holding the
 * records, and a chart the server built from the same fact sheet the AI read.
 */
interface SourceRef {
  key: string;
  label: string;
  path: string;
  chart: unknown;
}

interface Observation {
  title: string;
  detail: string;
  basis: string;
  sources?: SourceRef[];
}

interface Analysis {
  summary: string;
  observations: Observation[];
  areasForReview: Observation[];
  dataGaps: string[];
}

interface Facts {
  generatedAt: string;
  periodDays: number;
  headcount: {
    totalActive: number;
    byUnit: Array<{ unit: string; count: number }>;
    byEmploymentStatus: Array<{ status: string; count: number }>;
    newHiresInPeriod: number;
    separationsInPeriod: number;
    pendingSupervisorAssignment: number;
  };
  attendance: {
    hasData: boolean;
    recordCount: number;
    byStatus?: Array<{ status: string; count: number }>;
    presentRate: number | null;
    presenceRecords?: number;
    recordedAbsentRecords?: number;
    lateCount: number;
    daysWithNoImportedRecord: number;
  };
  leave: { totalRequestsInPeriod: number; awaitingDecision: number };
  compliance: {
    activeRequirements: number;
    expiringSoon: number;
    expired: number;
    missing: number;
    needsReview: number;
  };
  training: {
    activitiesInPeriod: number;
    participantsAssigned: number;
    participantsCompleted: number;
    participantsDidNotAttend?: number;
    completionRate: number | null;
  };
  evaluations: { activeCycles: number; assignmentsTotal: number; overdue: number };
  recruitment: { openOpenings: number; applicationsInPeriod: number };
}

/** Turns a status code (FOR_REVIEW) into words; an already-written label is kept as it is. */
function humanise(value: string): string {
  if (!value.includes('_') && value !== value.toUpperCase()) return value;
  return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function WorkforceSummaryPanel() {
  const [status, setStatus] = useState<{ available: boolean; reason?: string; model?: string } | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [factSpec, setFactSpec] = useState<MetricBreakdownSpec | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [factsError, setFactsError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);


  const loadFacts = useCallback(async () => {
    setIsLoadingFacts(true);
    setFactsError(null);
    try {
      const [statusRes, factsRes] = await Promise.all([
        api.get('/ai/status'),
        api.get('/ai/facts'),
      ]);
      setStatus(statusRes.data?.data ?? null);
      setFacts(factsRes.data?.data ?? null);
    } catch (err) {
      setFactsError(getApiErrorMessage(err, 'Workforce data could not be loaded.'));
    } finally {
      setIsLoadingFacts(false);
    }
  }, []);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  const runAnalysis = async () => {
    setIsAnalysing(true);
    setAnalysisError(null);
    try {
      const res = await api.post('/ai/analyze', {});
      setAnalysis(res.data?.data?.analysis ?? null);
      if (res.data?.data?.facts) setFacts(res.data.data.facts);
    } catch (err) {
      setAnalysisError(getApiErrorMessage(err, 'AI Assistance could not generate a summary.'));
    } finally {
      setIsAnalysing(false);
    }
  };

  const aiAvailable = status?.available === true;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={loadFacts} disabled={isLoadingFacts}>
          <RefreshCw className={isLoadingFacts ? 'animate-spin' : undefined} /> Refresh data
        </Button>
        <Button
          variant="ai"
          onClick={runAnalysis}
          disabled={!aiAvailable || isAnalysing || isLoadingFacts}
          title={aiAvailable ? undefined : status?.reason}
        >
          {isAnalysing ? (
            <><Loader2 className="animate-spin" /> Analysing...</>
          ) : (
            <><Sparkles /> Generate summary</>
          )}
        </Button>
      </motion.div>

      {/* Advisory notice — HRISense AI never decides */}
      <motion.div
        variants={staggerItem}
        className="flex items-start gap-3 p-4 rounded-2xl bg-info-50/70 dark:bg-info-950/30 border border-info-200 dark:border-info-800/60"
      >
        <Info className="h-5 w-5 text-info-700 dark:text-info-300 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-info-950 dark:text-info-100">AI Assistance is advisory</p>
          <p className="text-info-800/90 dark:text-info-200/80 leading-relaxed mt-0.5">
            It summarises the figures already in HRISense and points out what may be worth reviewing.
            It does not approve leave, hire or reject applicants, change records, or make any HR
            decision. Every figure below is calculated from your own data.
          </p>
        </div>
      </motion.div>

      {/* AI unavailable notice */}
      {!isLoadingFacts && !aiAvailable && (
        <motion.div
          variants={staggerItem}
          className="flex items-start gap-3 p-4 rounded-2xl bg-warning-light border border-warning/40"
        >
          <AlertTriangle className="h-5 w-5 text-warning-dark shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-warning-dark">AI Assistance is currently unavailable</p>
            <p className="text-warning-dark/90 leading-relaxed mt-0.5">
              {status?.reason ?? 'No AI provider is configured on this server.'} The workforce
              figures below are still fully available — they are calculated directly from HRISense
              data and do not need AI.
            </p>
          </div>
        </motion.div>
      )}

      {/* Workforce figures */}
      {factsError ? (
        <motion.div variants={staggerItem} className="p-10 text-center text-sm text-danger-dark border-2 border-border rounded-2xl">
          {factsError}
        </motion.div>
      ) : isLoadingFacts ? (
        <motion.div variants={staggerItem} className="p-10 text-center text-sm text-muted-foreground border-2 border-border rounded-2xl">
          Loading workforce data...
        </motion.div>
      ) : facts ? (
        <>
          <motion.div variants={staggerItem}>
            <h2 className="text-sm font-bold text-foreground mb-3">
              Workforce figures · last {facts.periodDays} days
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FactTile label="Active employees" value={facts.headcount.totalActive} sub={`${facts.headcount.newHiresInPeriod} new in period`} />
              <FactTile
                label="Records showing presence"
                value={formatPct(facts.attendance.presentRate, '—')}
                onBreakdown={() => setFactSpec(presenceSpec(facts))}
                sub={
                  facts.attendance.hasData
                    ? `Of imported present/absent records · ${facts.attendance.recordCount} records · ${facts.attendance.lateCount} late. Days with no record are excluded.`
                    : 'No attendance data imported'
                }
              />
              <FactTile label="Leave awaiting decision" value={facts.leave.awaitingDecision} sub={`${facts.leave.totalRequestsInPeriod} filed in period`} />
              <FactTile
                label="Compliance needing action"
                value={facts.compliance.missing + facts.compliance.expired + facts.compliance.expiringSoon + facts.compliance.needsReview}
                sub={`${facts.compliance.activeRequirements} active requirement(s)`}
              />
            </div>
          </motion.div>

          <motion.div variants={staggerContainer} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <motion.div variants={staggerItem} className="hrisense-surface p-5">
              <h3 className="font-bold font-heading text-foreground mb-3">Headcount by unit</h3>
              {facts.headcount.byUnit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {facts.headcount.byUnit.map((u) => (
                    <li key={u.unit} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate pr-3">{u.unit}</span>
                      <span className="font-bold text-foreground">{u.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            <motion.div variants={staggerItem} className="hrisense-surface p-5">
              <h3 className="font-bold font-heading text-foreground mb-3">Compliance standing</h3>
              <ul className="space-y-2 text-sm">
                <FactRow label="Missing" value={facts.compliance.missing} tone="danger" />
                <FactRow label="Needs review" value={facts.compliance.needsReview} tone="accent" />
                <FactRow label="Expiring soon" value={facts.compliance.expiringSoon} tone="warning" />
                <FactRow label="Expired" value={facts.compliance.expired} tone="danger" />
              </ul>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                "Expiring soon" only applies where HR has configured a reminder window on the
                requirement.
              </p>
            </motion.div>

            <motion.div variants={staggerItem} className="hrisense-surface p-5">
              <h3 className="font-bold font-heading text-foreground mb-3">Activity in period</h3>
              <ul className="space-y-2 text-sm">
                <FactRow label="Training activities" value={facts.training.activitiesInPeriod} />
                <FactRow
                  label="Training completion"
                  value={formatPct(facts.training.completionRate, '—')}
                  tone="success"
                  onBreakdown={() => setFactSpec(trainingSpec(facts))}
                />
                <FactRow label="Active evaluation cycles" value={facts.evaluations.activeCycles} />
                <FactRow label="Evaluations overdue" value={facts.evaluations.overdue} />
                <FactRow label="Job Openings" value={facts.recruitment.openOpenings} />
                <FactRow label="Applications received" value={facts.recruitment.applicationsInPeriod} />
                <FactRow label="Pending supervisor assignment" value={facts.headcount.pendingSupervisorAssignment} />
              </ul>
            </motion.div>
          </motion.div>

          {facts.attendance.daysWithNoImportedRecord > 0 && (
            <motion.div variants={staggerItem} className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-semibold text-foreground mb-0.5">Attendance data coverage</p>
              <p className="text-muted-foreground leading-relaxed">
                {facts.attendance.daysWithNoImportedRecord.toLocaleString()} employee-day(s) in this
                period have no imported attendance record. This means attendance data has not been
                imported for those days — it does <strong>not</strong> mean anyone was absent.
              </p>
            </motion.div>
          )}
        </>
      ) : null}

      {/* AI narrative */}
      <motion.div variants={staggerItem} className="hrisense-surface p-5">
        <h3 className="font-bold font-heading text-foreground flex items-center gap-2 mb-1">
          <Sparkles className="h-4.5 w-4.5 text-accent" /> AI summary
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Generated from the figures above. Nothing here is a decision.
        </p>

        {analysisError ? (
          <p className="text-sm text-danger-dark">{analysisError}</p>
        ) : isAnalysing ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading your workforce figures...
          </p>
        ) : analysis ? (
          <AnalysisView analysis={analysis} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {aiAvailable
              ? 'Select "Generate summary" to have AI Assistance read the figures above.'
              : 'AI summaries are unavailable on this server. The figures above remain accurate and complete.'}
          </p>
        )}
      </motion.div>

      {facts && (
        <motion.p variants={staggerItem} className="text-xs text-muted-foreground text-center">
          Figures generated {new Date(facts.generatedAt).toLocaleString()}
          {status?.model ? ` · AI model: ${status.model}` : ''}
        </motion.p>
      )}
      <MetricBreakdownDialog open={factSpec !== null} onOpenChange={(o) => !o && setFactSpec(null)} spec={factSpec} />
    </motion.div>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-5">
      {analysis.summary && (
        <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
      )}

      {analysis.observations.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            What the data shows
          </h4>
          <div className="space-y-2">
            {analysis.observations.map((o, i) => (
              <ObservationCard key={i} observation={o} />
            ))}
          </div>
        </div>
      )}

      {analysis.areasForReview.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Suggested for HR review
          </h4>
          <div className="space-y-2">
            {analysis.areasForReview.map((o, i) => (
              <ObservationCard key={i} observation={o} suggestion />
            ))}
          </div>
        </div>
      )}

      {analysis.dataGaps.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            What HRISense cannot tell you yet
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {analysis.dataGaps.map((gap, i) => (
              <li key={i} className="text-sm text-muted-foreground">{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const SAFE_PATH = /^\/[a-z0-9\-/]*$/i;

function ObservationCard({ observation, suggestion }: { observation: Observation; suggestion?: boolean }) {
  const navigate = useNavigate();
  // Links only to internal pages; charts only if they pass the shared chart schema.
  const sources = (observation.sources ?? []).filter((src) => SAFE_PATH.test(src.path));
  const charts = sources
    .map((src) => {
      const parsed = chartSchema.safeParse(src.chart);
      return parsed.success ? { key: src.key, label: src.label, chart: parsed.data as AssistantChartData } : null;
    })
    .filter(Boolean) as Array<{ key: string; label: string; chart: AssistantChartData }>;
  const [selected, setSelected] = useState(0);
  const shown = charts[Math.min(selected, charts.length - 1)];

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 ${
        suggestion ? 'border-warning/30 bg-warning-light/40' : 'border-border bg-muted/30'
      }`}
    >
      <div>
        <p className="text-sm font-bold text-foreground">{observation.title}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{observation.detail}</p>
      </div>

      {shown && (
        <div className="space-y-1.5">
          {charts.length > 1 && (
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Charts for this observation">
              {charts.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={c === shown}
                  onClick={() => setSelected(i)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                    c === shown ? 'border-status-accent-border bg-status-accent-surface text-status-accent-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <AssistantChart chart={shown.chart} compact />
        </div>
      )}

      {(sources.length > 0 || observation.basis) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground/80 italic">Based on:</span>
          {sources.length > 0
            ? sources.map((src) => (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => navigate({ to: src.path as any })}
                  title={observation.basis ? `Fields: ${observation.basis}` : `Open ${src.label}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground hover:border-primary-500/40 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  {src.label} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </button>
              ))
            : <span className="text-xs text-muted-foreground/80 italic">{observation.basis}</span>}
        </div>
      )}
    </div>
  );
}

function FactTile({ label, value, sub, onBreakdown }: { label: string; value: string | number; sub?: string; onBreakdown?: () => void }) {
  return (
    <div className="hrisense-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold font-heading text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {onBreakdown && <BreakdownButton className="mt-2" onClick={onBreakdown} />}
    </div>
  );
}

/** Records showing presence: the fact sheet's own counts, by the shared attendance rule. */
function presenceSpec(f: Facts): MetricBreakdownSpec {
  const presence = f.attendance.presenceRecords ?? 0;
  const absent = f.attendance.recordedAbsentRecords ?? 0;
  const byStatus = f.attendance.byStatus ?? [];
  const inNumerator = new Set(['PRESENT', 'LATE', 'HALF_DAY']);
  return {
    ...ratioSpec({
      title: `Records showing presence — last ${f.periodDays} days`,
      value: f.attendance.presentRate,
      numeratorLabel: 'Presence records (Present + Late + Half day)',
      numerator: presence,
      denominatorLabel: 'Presence + explicit Absent records',
      denominator: presence + absent,
      parts: byStatus.map((b) => ({
        label: b.status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
        count: b.count,
        included: inNumerator.has(b.status) || b.status === 'ABSENT',
        inNumerator: inNumerator.has(b.status),
      })),
      notes: [
        `Employee-days with no imported record (${f.attendance.daysWithNoImportedRecord}) are not absences and are not in this calculation.`,
        'On leave, holiday, rest-day and suspended records are neither presence nor absence, so they are excluded.',
      ],
    }),
  };
}

function trainingSpec(f: Facts): MetricBreakdownSpec {
  return ratioSpec({
    title: `Training completion — activities in the last ${f.periodDays} days`,
    value: f.training.completionRate,
    numeratorLabel: 'Participants who completed',
    numerator: f.training.participantsCompleted,
    denominatorLabel: 'Participants assigned (all outcomes)',
    denominator: f.training.participantsAssigned,
    parts: [
      { label: 'Completed', count: f.training.participantsCompleted, included: true, inNumerator: true },
      ...(f.training.participantsDidNotAttend !== undefined
        ? [{ label: 'Did not attend', count: f.training.participantsDidNotAttend, included: true }]
        : []),
      {
        label: 'Other outcomes (assigned, excused, cancelled)',
        count: Math.max(0, f.training.participantsAssigned - f.training.participantsCompleted - (f.training.participantsDidNotAttend ?? 0)),
        included: true,
      },
    ],
  });
}

/** The value takes the same status colour as the summary cards elsewhere. */
const FACT_TONE = {
  success: 'text-status-success-foreground',
  warning: 'text-status-warning-foreground',
  danger: 'text-status-danger-foreground',
  accent: 'text-status-accent-foreground',
} as const;

function FactRow({
  label,
  value,
  onBreakdown,
  tone,
}: {
  label: string;
  value: string | number;
  onBreakdown?: () => void;
  tone?: keyof typeof FACT_TONE;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{humanise(label)}</span>
      <span className="flex items-center gap-2">
        {onBreakdown && <BreakdownButton label="Breakdown" onClick={onBreakdown} />}
        <span className={`font-bold ${tone ? FACT_TONE[tone] : 'text-foreground'}`}>{value}</span>
      </span>
    </li>
  );
}
