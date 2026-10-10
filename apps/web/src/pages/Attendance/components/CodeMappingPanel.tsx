import { personName } from '@/lib/attendanceDisplay';
import { useEffect, useMemo, useState } from 'react';
import { Link2, Check, AlertTriangle, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { AttendanceImportService, NAME_SIMILARITY_HELP } from '@/services/attendance-import.service';

/**
 * Maps the timekeeping codes an import could not match to HRISense employees.
 *
 * This is the step that makes an import useful. Matching is on the code alone —
 * never a name — so until a code is mapped, its rows are held back rather than
 * attached to whoever looks closest. This panel is how HR does that mapping
 * once, for the whole batch, instead of one employee profile at a time.
 */

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  biometricCode?: string | null;
  unit?: { name: string } | null;
  jobRole?: { title: string } | null;
}

/**
 * The employee the file's name most resembles. A proposal only — it is never
 * applied without HR pressing the button.
 */
interface SuggestedEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string } | null;
  unit?: { name: string } | null;
}

export interface UnmatchedCode {
  code: string | null;
  days: number;
  suggestedEmployee?: SuggestedEmployee | null;
  suggestedScore?: number | null;
}

export function CodeMappingPanel({
  codes,
  onMapped,
}: {
  codes: UnmatchedCode[];
  /** Called after a successful mapping so the batch can be re-read. */
  onMapped: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/employees?limit=500&isArchived=false');
        setEmployees(res.data?.data ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'The employee list could not be loaded.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Codes already spoken for in this session, so one person can't take two. */
  const takenIds = useMemo(() => new Set(Object.values(done)), [done]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => !e.biometricCode && !takenIds.has(e.id))
      .filter((e) =>
        !q ||
        `${e.firstName} ${e.lastName} ${e.employeeNumber} ${e.jobRole?.title ?? ''} ${e.unit?.name ?? ''}`
          .toLowerCase()
          .includes(q)
      )
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [employees, takenIds, search]);

  const handleMap = async (code: string) => {
    const employeeId = assignments[code];
    if (!employeeId) return;
    setSaving(code);
    try {
      await AttendanceImportService.mapCode(employeeId, code);
      setDone((prev) => ({ ...prev, [code]: employeeId }));
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
      toast.success(`Code ${code} mapped.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'That code could not be mapped.'));
    } finally {
      setSaving(null);
    }
  };

  const mappedCount = Object.keys(done).length;
  const remaining = codes.filter((c) => c.code && !done[c.code]);

  return (
    <section className="rounded-2xl border border-status-accent-border bg-status-accent-surface/40 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Match timekeeping codes to employees
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            The export identifies people by a number from the timekeeping device. HRISense matches on that
            number and never on a name, so these rows are held back until you say who each code belongs to.
            Map them here, then upload the file again — the same rows will import normally.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {mappedCount} of {codes.length} mapped
        </Badge>
      </div>

      {mappedCount > 0 && (
        <p className="flex items-center gap-2 text-xs font-semibold text-status-success-foreground">
          <Check className="h-3.5 w-3.5" />
          {mappedCount} code{mappedCount === 1 ? '' : 's'} mapped. Upload the file again to import their attendance.
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter the employee list by name, number, role or unit…"
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-input bg-surface text-sm text-foreground"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : available.length === 0 && remaining.length > 0 ? (
        <p className="flex items-start gap-2 text-sm text-status-warning-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Every employee already has a timekeeping code. If a code here is still unmatched, it may belong to
          somebody who has left, or the code on their profile may be wrong.
        </p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-border bg-surface divide-y divide-border">
          {remaining.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground italic">Every code in this file is mapped.</p>
          ) : (
            remaining.map(({ code, days, suggestedEmployee, suggestedScore }) => {
              const chosen = assignments[code as string] ?? '';
              // Offering someone who already holds a code would only produce an
              // error on save, so the proposal is dropped rather than shown.
              const proposal =
                suggestedEmployee && available.some((e) => e.id === suggestedEmployee.id)
                  ? suggestedEmployee
                  : null;

              return (
                <div key={code} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-28 shrink-0">
                      <p className="font-mono font-bold text-sm text-foreground">{code}</p>
                      <p className="text-[11px] text-muted-foreground">{days} day{days === 1 ? '' : 's'}</p>
                    </div>

                    <select
                      value={chosen}
                      onChange={(e) => setAssignments((prev) => ({ ...prev, [code as string]: e.target.value }))}
                      className="flex-1 min-w-[16rem] h-10 px-3 rounded-xl border border-input bg-surface text-sm text-foreground"
                      aria-label={`Employee for code ${code}`}
                    >
                      <option value="">Select the employee this code belongs to…</option>
                      {available.map((e) => (
                        <option key={e.id} value={e.id}>
                          {personName(e)} — {e.employeeNumber}
                          {e.jobRole?.title ? ` · ${e.jobRole.title}` : ''}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="create"
                      size="sm"
                      className="shrink-0"
                      disabled={!chosen || saving === code}
                      onClick={() => handleMap(code as string)}
                    >
                      {saving === code ? 'Saving…' : 'Map'}
                    </Button>
                  </div>

                  {/*
                    The closest name in the file to somebody in HRISense. Shown so
                    HR does not have to open the spreadsheet and read down 49
                    blocks to work out who code 146 is — but it stays a question:
                    the row is only assigned when HR presses the button.
                  */}
                  {proposal && chosen !== proposal.id && (
                    <div className="ml-28 flex flex-wrap items-center gap-2 rounded-lg border border-status-accent-border bg-status-accent-surface/50 px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        The name beside this code looks like
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {personName(proposal)}
                      </span>
                      <span className="text-[11px] text-muted-foreground" title={NAME_SIMILARITY_HELP}>
                        {proposal.employeeNumber}
                        {typeof suggestedScore === 'number' ? ` · name similarity ${suggestedScore}/100` : ''}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setAssignments((prev) => ({ ...prev, [code as string]: proposal.id }))
                        }
                      >
                        Use this
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A code can belong to only one employee. Mapping is recorded in the audit log.
      </p>

      {mappedCount > 0 && (
        <Button variant="outline" size="sm" onClick={onMapped}>
          Refresh this import
        </Button>
      )}
    </section>
  );
}
