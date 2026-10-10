import { personName } from '@/lib/attendanceDisplay';
import { useState } from 'react';
import { UserX, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { AttendanceImportService, NAME_SIMILARITY_HELP } from '@/services/attendance-import.service';

/**
 * Device numbers that DID match an employee, but whose name in the file no
 * longer agrees with that employee.
 *
 * This is the case a code-only match cannot see. When somebody leaves and the
 * timekeeping device hands their number to a new hire, every row still resolves
 * perfectly — to the wrong person. HRISense compares the name beside the number
 * against the employee it is mapped to, purely as a CHECK, and parks the
 * disagreements here rather than filing one person's attendance under another's.
 *
 * Nothing on this panel is applied automatically. The name from the file is not
 * stored anywhere; what is kept is how close it was and who it resembles.
 */

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobRole?: { title: string } | null;
  unit?: { name: string } | null;
}

export interface IdentityIssue {
  code: string | null;
  days: number;
  verdict: 'MISMATCH' | 'UNCERTAIN' | null;
  score: number | null;
  mappedTo: Person | null;
  suggestedEmployee?: Person | null;
  suggestedScore?: number | null;
}

const name = (p: Person) => personName(p);

export function IdentityIssuesPanel({
  issues,
  onReassigned,
}: {
  issues: IdentityIssue[];
  /** Called after a code is reassigned so the batch can be re-read. */
  onReassigned: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  if (!issues.length) return null;

  const reassign = async (code: string, employeeId: string, label: string) => {
    setSaving(code);
    try {
      await AttendanceImportService.mapCode(employeeId, code);
      setDone((prev) => ({ ...prev, [code]: label }));
      toast.success(`Code ${code} now belongs to ${label}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'That code could not be reassigned.'));
    } finally {
      setSaving(null);
    }
  };

  const remaining = issues.filter((i) => i.code && !done[i.code]);

  return (
    <section className="rounded-2xl border border-status-danger-border bg-status-danger-surface/40 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserX className="h-4 w-4" />
            These device numbers may belong to someone else now
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            The number matched an employee, but the name printed next to it in the file is not theirs.
            That usually means the timekeeping device reassigned the number after somebody left. These
            days are being held rather than recorded against the employee shown, because doing that
            would put one person&rsquo;s attendance on another person&rsquo;s record.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {remaining.length} to check
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        {remaining.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground italic">
            Every mismatch has been dealt with. Refresh the import to re-check the rows.
          </p>
        ) : (
          remaining.map((issue) => {
            const code = issue.code as string;
            const suggestion = issue.suggestedEmployee;

            return (
              <div key={code} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-28 shrink-0">
                    <p className="font-mono font-bold text-sm text-foreground">{code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {issue.days} day{issue.days === 1 ? '' : 's'} held
                    </p>
                  </div>

                  <div className="flex-1 min-w-[16rem] text-sm">
                    <p className="text-foreground">
                      Currently mapped to{' '}
                      <span className="font-semibold">
                        {issue.mappedTo ? name(issue.mappedTo) : 'an employee who no longer exists'}
                      </span>
                      {issue.mappedTo && (
                        <span className="text-muted-foreground"> · {issue.mappedTo.employeeNumber}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {issue.verdict === 'UNCERTAIN'
                        ? 'The name in the file is close, but not close enough to be sure.'
                        : 'The name in the file does not match this employee.'}
                      {typeof issue.score === 'number' ? (
                        <span title={NAME_SIMILARITY_HELP}> (name similarity {issue.score}/100)</span>
                      ) : ''}
                    </p>
                  </div>
                </div>

                {suggestion ? (
                  <div className="ml-28 flex flex-wrap items-center gap-2 rounded-lg border border-status-accent-border bg-status-accent-surface/50 px-3 py-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">It looks more like</span>
                    <span className="text-xs font-semibold text-foreground">{name(suggestion)}</span>
                    <span className="text-[11px] text-muted-foreground" title={NAME_SIMILARITY_HELP}>
                      {suggestion.employeeNumber}
                      {typeof issue.suggestedScore === 'number'
                        ? ` · name similarity ${issue.suggestedScore}/100`
                        : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      disabled={saving === code}
                      onClick={() => reassign(code, suggestion.id, name(suggestion))}
                    >
                      {saving === code ? 'Saving…' : (
                        <>
                          Give the code to them <ArrowRight className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="ml-28 text-xs text-muted-foreground">
                    Nobody in HRISense resembles the name in the file closely enough to suggest. Open the
                    spreadsheet to see whose name sits beside this number, then correct the timekeeping
                    code on that employee&rsquo;s profile.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Reassigning a code updates the employee&rsquo;s profile and is recorded in the audit log. Upload the
        file again afterwards so the held days attach to the right person.
      </p>

      {Object.keys(done).length > 0 && (
        <Button variant="outline" size="sm" onClick={onReassigned}>
          Refresh this import
        </Button>
      )}
    </section>
  );
}
