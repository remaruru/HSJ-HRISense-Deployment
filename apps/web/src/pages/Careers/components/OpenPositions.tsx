import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertCircle, Briefcase, CalendarDays, RefreshCw, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicRecruitmentService, type PublicOpenPositions } from '@/services/public-recruitment.service';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/**
 * The public Careers list: ONLY the vacancies accepting applications now —
 * Job Openings that are OPEN and within their dates (the API decides; drafts,
 * closed, filled and archived openings are never sent). Search and the unit /
 * employment-type filters work over those openings only. Job roles without an
 * opening are not listed.
 */

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

const employmentLabel = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function OpenPositions() {
  const [data, setData] = useState<PublicOpenPositions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState('');
  const [type, setType] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await PublicRecruitmentService.getOpenPositions());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const units = useMemo(() => [...new Set((data?.openings ?? []).map((o) => o.unit))].sort((a, b) => a.localeCompare(b)), [data]);
  const types = useMemo(() => [...new Set((data?.openings ?? []).map((o) => o.employmentType))].sort(), [data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.openings ?? []).filter((o) => {
      if (unit && o.unit !== unit) return false;
      if (type && o.employmentType !== type) return false;
      if (!q) return true;
      return [o.title, o.position, o.unit, o.department].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, search, unit, type]);

  const filtered = !!(search.trim() || unit || type);
  const clear = () => {
    setSearch('');
    setUnit('');
    setType('');
  };
  const count = data?.counts.open ?? 0;

  return (
    <section id="open-positions" className="py-16 sm:py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold font-heading text-foreground mb-3">Open Positions</h2>
            <p className="text-muted-foreground text-lg">The positions at Hospicio de San Jose accepting applications right now.</p>
          </div>
          {data && (
            <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 min-w-[9rem] dark:border-primary-800 dark:bg-primary-900/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-800 dark:text-primary-300">Open now</p>
              <p className="text-2xl font-extrabold text-primary-700 tabular-nums dark:text-primary-200">{count}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-surface border border-border rounded-2xl">
            <div className="h-10 w-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin mb-6 dark:border-primary-900" />
            <p className="text-lg font-medium text-foreground">Loading open positions…</p>
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center justify-center py-16 bg-surface border-2 border-status-danger-surface dark:border-status-danger-foreground/30 rounded-2xl text-center px-4 max-w-2xl mx-auto">
            <div className="h-14 w-14 bg-status-danger-surface dark:bg-status-danger-foreground/20 text-danger rounded-2xl flex items-center justify-center mb-5">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Unable to load open positions</h3>
            <p className="text-muted-foreground mb-6 max-w-md" role="alert">{error ?? 'Please check your connection and try again.'}</p>
            <Button onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        ) : count === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-14 text-center">
            <Briefcase className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-lg font-semibold text-foreground">There are no open positions right now</p>
            <p className="mt-1 text-sm text-muted-foreground">New vacancies appear here as soon as Hospicio HR publishes them. Please check back soon.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Search open positions</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search open positions…"
                  className="w-full h-11 rounded-xl border border-input bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500"
                />
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select aria-label="Filter by unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-11 min-w-0 rounded-xl border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25">
                  <option value="">All open positions</option>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {types.length > 1 && (
                  <select aria-label="Filter by employment type" value={type} onChange={(e) => setType(e.target.value)} className="h-11 min-w-0 rounded-xl border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25">
                    <option value="">All employment types</option>
                    {types.map((t) => <option key={t} value={t}>{employmentLabel(t)}</option>)}
                  </select>
                )}
              </div>
            </div>

            {filtered && (
              <p className="mb-4 text-sm text-muted-foreground">
                Showing {shown.length} of {count} open position{count === 1 ? '' : 's'}.{' '}
                <button type="button" onClick={clear} className="font-semibold text-primary-700 hover:underline dark:text-primary-300">Clear filters</button>
              </p>
            )}

            {shown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-12 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 font-semibold text-foreground">No open positions match your search</p>
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={clear}><X className="h-4 w-4" /> Show all open positions</Button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-stretch gap-4 sm:gap-5">
                {shown.map((o) => (
                  <li key={o.slug} className="flex flex-col rounded-2xl border border-primary-200 bg-surface p-5 shadow-card min-w-0 dark:border-primary-800">
                    <h3 className="text-lg font-bold text-foreground break-words">{o.title}</h3>
                    {o.position !== o.title && <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">{o.position}</p>}
                    <p className="text-sm text-muted-foreground break-words">{o.unit}{o.department ? ` · ${o.department}` : ''}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {employmentLabel(o.employmentType)}</span>
                      {o.vacancies ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {o.vacancies} vacanc{o.vacancies === 1 ? 'y' : 'ies'}</span> : null}
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Closes {formatDate(o.closingDate)}</span>
                    </div>
                    <div className="mt-auto pt-4 flex flex-col gap-2 sm:flex-row">
                      <Link to={`/careers/${o.slug}` as any} className="flex-1"><Button variant="outline" size="sm" className="w-full">View Opening</Button></Link>
                      <Link to={`/careers/${o.slug}/apply` as any} className="flex-1"><Button size="sm" className="w-full">Apply Now</Button></Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
