import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/services/api';
import { useProtectedImageUrl } from '@/hooks/useProtectedImageUrl';
import { getApiErrorMessage } from '@/utils/error-handler.util';
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
 *
 * On My Profile (`onImagesChanged` given) the person changes their own photo
 * and banner here: a camera button appears on hover (always shown on touch
 * screens). Anyone who can open the profile sees them.
 */
/** A person's own banner image over the default gradient (nothing when they have none). */
export function ProfileBannerImage({ src }: { src?: string | null }) {
  const url = useProtectedImageUrl(src);
  return url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** The same limit the API enforces. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Hidden until hover or keyboard focus on pointer screens; always visible on touch screens. */
const REVEAL = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

export function ProfileHero({
  employee,
  context,
  completion,
  onViewBreakdown,
  actions,
  onImagesChanged,
}: {
  employee: any;
  context: 'self' | 'team';
  completion: number | null;
  onViewBreakdown?: () => void;
  actions?: React.ReactNode;
  /** My Profile only: lets the person change their photo and banner, then reloads. */
  onImagesChanged?: () => void | Promise<void>;
}) {
  const editable = context === 'self' && !!onImagesChanged;
  const photoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'photo' | 'banner' | null>(null);

  const upload = async (kind: 'photo' | 'banner', file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return void toast.error('Choose a JPG, PNG or WEBP image.');
    if (file.size > MAX_IMAGE_BYTES) return void toast.error('Choose an image of 5 MB or less.');
    setBusy(kind);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/employees/me/${kind}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(kind === 'photo' ? 'Profile photo updated' : 'Banner updated');
      await onImagesChanged?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, kind === 'photo' ? 'Your photo could not be uploaded.' : 'Your banner could not be uploaded.'));
    } finally {
      setBusy(null);
    }
  };

  const removeBanner = async () => {
    setBusy('banner');
    try {
      await api.delete('/employees/me/banner');
      toast.success('Banner removed');
      await onImagesChanged?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Your banner could not be removed.'));
    } finally {
      setBusy(null);
    }
  };
  const name = fullNameOf(employee);
  const pct = Math.max(0, Math.min(100, Number(completion ?? 0)));
  const ended = hasEnded(employee?.employmentState);
  const stateLabel =
    EMPLOYMENT_STATE_LABELS[employee?.employmentState as EmploymentState] ?? formatEnumLabel(employee?.employmentState);
  const place = [employee?.unit?.name, employee?.department?.name].filter(Boolean).join(' · ');
  const professional = employee?.isProfessional ?? !!(employee?.prcLicenseNumber && String(employee.prcLicenseNumber).trim());

  return (
    <section className="rounded-2xl border border-border-soft bg-surface shadow-card overflow-hidden">
      <div className="group relative h-20 sm:h-24 bg-gradient-to-r from-primary-600 to-primary-400">
        <ProfileBannerImage src={employee?.bannerUrl} />
        {editable && (
          <div className={cn('absolute right-3 top-3 z-10 flex gap-2 transition-opacity', REVEAL, busy === 'banner' && 'opacity-100')}>
            <button
              type="button"
              onClick={() => bannerInput.current?.click()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
            >
              {busy === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {employee?.bannerUrl ? 'Change banner' : 'Add banner'}
            </button>
            {employee?.bannerUrl && (
              <button
                type="button"
                onClick={removeBanner}
                disabled={busy !== null}
                aria-label="Remove banner"
                className="inline-flex items-center rounded-lg bg-black/55 px-2 py-1.5 text-white backdrop-blur-sm hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <input
              ref={bannerInput}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                void upload('banner', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>
      <div className="px-4 sm:px-6 pb-5 -mt-12 sm:-mt-14 flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5 min-w-0 flex-1">
          <div className="group relative w-fit shrink-0 rounded-full">
            {/* No background override: without a photo the avatar keeps its own
                colour, so the white initials stay readable in light mode. */}
            <Avatar
              name={name}
              src={employee?.photoUrl || undefined}
              size="2xl"
              className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-surface shadow-md text-3xl"
            />
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={busy !== null}
                  aria-label="Change profile photo"
                  className={cn(
                    'absolute inset-1 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    REVEAL,
                    busy === 'photo' && 'opacity-100'
                  )}
                >
                  {busy === 'photo' ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
                </button>
                <input
                  ref={photoInput}
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    void upload('photo', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
          {/* sm:mt-14 matches the -mt-14 above, so the text always starts below
              the banner instead of sitting on its edge. */}
          <div className="min-w-0 sm:mt-14 sm:pb-1">
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
