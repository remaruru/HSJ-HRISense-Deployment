import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ReportChart, ReportStat, type ReportChartSpec } from './ReportChart';
import { BarChart3, Download, FileSpreadsheet, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from 'sonner';

/**
 * Reports.
 *
 * Every figure is queried from HRISense data. No sample charts, no invented
 * departments, no turnover formula (the formula and reporting period have not
 * been confirmed by Hospicio de San Jose), and nothing payroll-related.
 */

interface CatalogEntry {
  key: string;
  title: string;
  description: string;
}

interface ReportColumn {
  key: string;
  label: string;
}

interface ReportResult {
  key: string;
  title: string;
  description: string;
  period: { from: string | null; to: string | null };
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals: Array<{ label: string; value: string | number }>;
  /** What this run found, generated from its own numbers. */
  summary: string[];
  charts: ReportChartSpec[];
  /** Standing caveats about how the figures are built. */
  notes: string[];
}

const MAX_PREVIEW_ROWS = 100;

export default function ReportsPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [activeKey, setActiveKey] = useState<string>('headcount');
  const [report, setReport] = useState<ReportResult | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    api.get('/reports/catalog')
      .then((res) => setCatalog(res.data?.data ?? []))
      .catch(() => setCatalog([]));

    api.get('/units')
      .then((res) => setUnits(res.data?.data ?? []))
      .catch(() => setUnits([]));
  }, []);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/${activeKey}`, {
        params: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          unitId: unitId || undefined,
        },
      });
      setReport(res.data?.data ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'This report could not be generated.'));
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeKey, dateFrom, dateTo, unitId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    setIsExporting(true);
    try {
      const res = await api.post(
        `/reports/${activeKey}/export`,
        { format, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, unitId: unitId || undefined },
        { responseType: 'blob' }
      );

      const ext = format === 'excel' ? 'xlsx' : format;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `HRISense_${report?.title.replace(/[^A-Za-z0-9]+/g, '_') ?? activeKey}_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The report could not be exported.'));
    } finally {
      setIsExporting(false);
    }
  };

  const needsDateRange = activeKey === 'attendance';
  const rowsToShow = report?.rows.slice(0, MAX_PREVIEW_ROWS) ?? [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports & Analytics"
          subtitle="Workforce reports generated from HRISense data."
          badgeText={report ? `${report.rows.length} row${report.rows.length === 1 ? '' : 's'}` : undefined}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <HelpLink slug="generate-report" />
              <Button variant="outline" size="sm" onClick={loadReport} disabled={isLoading}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={isExporting || !report?.rows.length}>
                <FileText className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={isExporting || !report?.rows.length}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button size="sm" onClick={() => handleExport('pdf')} disabled={isExporting || !report?.rows.length}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Report picker */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {catalog.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setActiveKey(entry.key)}
            title={entry.description}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-colors',
              activeKey === entry.key
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-surface text-foreground border-border hover:border-primary-300 dark:hover:border-primary-900'
            )}
          >
            {entry.title}
          </button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            From {needsDateRange && <span className="text-danger">*</span>}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            To {needsDateRange && <span className="text-danger">*</span>}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Unit</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="h-9 px-3 rounded-xl border-2 border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        {(dateFrom || dateTo || unitId) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDateFrom(''); setDateTo(''); setUnitId(''); }}
          >
            Clear filters
          </Button>
        )}
      </motion.div>

      {/* Body */}
      {error ? (
        <motion.div variants={staggerItem} className="p-10 text-center border-2 border-border rounded-2xl">
          <p className="text-sm text-danger-dark">{error}</p>
        </motion.div>
      ) : isLoading ? (
        <motion.div variants={staggerItem} className="p-10 text-center border-2 border-border rounded-2xl text-sm text-muted-foreground">
          Generating report...
        </motion.div>
      ) : report ? (
        <>
          {/* What this run found — the first thing on the page, because a
              sentence answers "so what?" faster than a grid of numbers. */}
          {report.summary.length > 0 && (
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border border-border bg-nav-selected-surface/25 p-5"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                About this report
              </p>
              <ul className="space-y-1.5">
                {report.summary.map((line, i) => (
                  <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                    <span aria-hidden="true" className="text-primary-600 dark:text-primary-300 shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Headline figures */}
          {report.totals.length > 0 && (
            <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {report.totals.map((t, i) => (
                <ReportStat key={t.label} label={t.label.replace(/_/g, ' ')} value={t.value} emphasis={i === 0} />
              ))}
            </motion.div>
          )}

          {/* Breakdowns — same rows as the table, read visually */}
          {report.charts.length > 0 && (
            <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {report.charts.map((chart) => (
                <ReportChart key={chart.id} spec={chart} />
              ))}
            </motion.div>
          )}

          {/* Table */}
          <motion.div variants={staggerItem} className="bg-surface border-2 border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b-2 border-border bg-muted/30">
              <h3 className="font-bold font-heading text-foreground">{report.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
            </div>

            {report.rows.length === 0 ? (
              <div className="p-14 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h4 className="text-lg font-bold font-heading text-foreground">No data for this report</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a wider date range, or check that the underlying records exist in HRISense.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 border-b-2 border-border">
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.key} className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rowsToShow.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        {report.columns.map((c) => (
                          <td key={c.key} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                            {row[c.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.rows.length > MAX_PREVIEW_ROWS && (
              <div className="px-5 py-3 border-t-2 border-border bg-muted/20 text-xs text-muted-foreground">
                Showing the first {MAX_PREVIEW_ROWS} of {report.rows.length} rows. Export to see them all.
              </div>
            )}
          </motion.div>

          {report.notes.length > 0 && (
            <motion.div variants={staggerItem} className="rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                How these figures are built
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {report.notes.map((note, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">{note}</li>
                ))}
              </ul>
            </motion.div>
          )}
        </>
      ) : null}
    </motion.div>
  );
}
