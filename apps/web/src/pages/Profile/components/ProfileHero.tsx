import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { BreakdownButton } from '@/components/shared/MetricBreakdown';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { EMPLOYMENT_STATE_LABELS, hasEnded, type EmploymentState } from '@/lib/employment';
import { cn } from '@/lib/utils';
import { formatEnumLabel, fullNameOf } from '../profileFormat';

/**
 * The header of a person's profile: photo, name, job role, unit, employee ID,
 * status and profile completion. Used by My Profile ("I am viewing myself") and
 * by the My Team member profile ("a supervisor viewing someone on their team") —
 * the eyebrow line says which, so the two are never confused.
 *
 * It carries no administrative actions: archive, restore, account and
 * organisation changes live only in Employee Management.
 */
export function ProfileHero({
  employee,
  context,
  completion,
  onViewBreakdown,
  actions,
}: {
  employee: any;
  context: 'self' | 'team';
  completion: number | null;
  onViewBreakdown?: () => void;
  actions?: React.ReactNode;
}) {
  const name = fullNameOf(employee);
  const pct = Math.max(0, Math.min(100, Number(completion ?? 0)));
  const ended = hasEnded(employee?.employmentState);
  const stateLabel =
    EMPLOYMENT_STATE_LABELS[employee?.employmentState as EmploymentState] ?? formatEnumLabel(employee?.employmentState);
  const place = [employee?.unit?.name, employee?.department?.name].filter(Boolean).join(' · ');
  const professional = employee?.isProfessional ?? !!(employee?.prcLicenseNumber && String(employee.prcLicenseNumber).trim());

  return (
    <section className="rounded-2xl border border-border-soft bg-surface shadow-card overflow-hidden">
      <div className="h-20 sm:h-24 bg-gradient-to-r from-primary-600 to-primary-400" aria-hidden="true" />
      <div className="px-4 sm:px-6 pb-5 -mt-12 sm:-mt-14 flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5 min-w-0 flex-1">
          <Avatar
            name={name}
            src={employee?.photoUrl || undefined}
            size="2xl"
            className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-surface shadow-md bg-surface"
          />
          <div className="min-w-0 sm:pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
              {context === 'self' ? 'My Profile' : 'Team Member Profile'}
            </p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-bold font-heading text-foreground break-words">{name || 'Employee'}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground break-words">
              <span className="font-semibold text-foreground">{employee?.jobRole?.title ?? 'No job role'}</span>
              {place ? <> · {place}</> : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`border font-mono ${STATUS_TONE_CHIP.neutral}`}>{employee?.employeeNumber}</Badge>
              {employee?.employmentStatus && (
                <Badge className={`border ${employee.employmentStatus === 'PROBATIONARY' ? STATUS_TONE_CHIP.warning : STATUS_TONE_CHIP.total}`}>
                  {formatEnumLabel(employee.employmentStatus)}
                </Badge>
              )}
              {employee?.deletedAt ? (
                <Badge className={`border ${STATUS_TONE_CHIP.danger}`}>Archived</Badge>
              ) : ended ? (
                <Badge className={`border ${STATUS_TONE_CHIP.danger}`}>{stateLabel}</Badge>
              ) : employee?.employmentState === 'ON_LEAVE' ? (
                <Badge className={`border ${STATUS_TONE_CHIP.warning}`}>On Leave</Badge>
              ) : employee?.employmentState === 'ACTIVE' ? (
                <Badge className={`border ${STATUS_TONE_CHIP.success}`}>Active</Badge>
              ) : null}
              {professional && (
                <Badge className={`border ${STATUS_TONE_CHIP.info}`}>
                  Professional{employee?.professionalRole ? ` · ${employee.professionalRole}` : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[260px] lg:items-end">
          <div className="w-full rounded-xl border border-border-soft bg-surface p-3.5 shadow-card">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile completion</span>
              <span className={cn('text-lg font-bold tabular-nums', pct >= 100 ? 'text-status-success-foreground' : 'text-primary-600 dark:text-primary-300')}>
                {completion === null ? '—' : `${pct}%`}
              </span>
            </div>
            <div
              className="w-full bg-surface-2 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion"
            >
              <div className={cn('h-2 rounded-full transition-all', pct >= 100 ? 'bg-status-success-foreground' : 'bg-primary-500')} style={{ width: `${pct}%` }} />
            </div>
            {onViewBreakdown && <BreakdownButton onClick={onViewBreakdown} className="mt-2" />}
          </div>
          {actions && <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:justify-end">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
