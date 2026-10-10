import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Users, Search, ChevronRight, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { MetricBreakdownDialog, type MetricBreakdownSpec } from '@/components/shared/MetricBreakdown';
import { profileCompletionSpec } from '@/components/shared/profileCompletionSpec';
import { EMPLOYMENT_STATE_LABELS, type EmploymentState } from '@/lib/employment';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { formatEnumLabel } from '@/pages/Profile/profileFormat';

/**
 * My Team (`/my-team`) — "I am a supervisor viewing the employees I am
 * responsible for."
 *
 * The list is `GET /employees/subordinates`: employees whose immediate
 * supervisor (`Employee.immediateSupervisorId`) is the signed-in supervisor,
 * active records only. Not the unit, not a coordinator's staff below them, not
 * archived records. Each row is the API's work view — no personal details.
 */

interface TeamMember {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  photoUrl?: string | null;
  jobRole?: { title?: string | null } | null;
  unit?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
  employmentStatus?: string | null;
  employmentState?: string | null;
  profileCompletion?: number | null;
  isProfessional?: boolean;
  professionalRole?: string | null;
}

const stateLabel = (s?: string | null) => (s ? EMPLOYMENT_STATE_LABELS[s as EmploymentState] ?? formatEnumLabel(s) : 'Not provided');
const stateTone = (s?: string | null) =>
  s === 'ACTIVE' ? STATUS_TONE_CHIP.success : s === 'ON_LEAVE' ? STATUS_TONE_CHIP.warning : s ? STATUS_TONE_CHIP.danger : STATUS_TONE_CHIP.neutral;

function CompletionCell({ pct, onClick, name }: { pct: number; onClick: () => void; name: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={cn('h-full rounded-full', pct >= 80 ? 'bg-primary-500' : 'bg-warning')} style={{ width: `${pct}%` }} />
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        title="View how this percentage is calculated"
        aria-label={`${name}: profile completion ${pct}% — view breakdown`}
        className="text-xs font-semibold font-mono text-foreground underline decoration-dotted underline-offset-2 hover:text-primary-700 dark:hover:text-primary-300"
      >
        {pct}%
      </button>
    </div>
  );
}

export default function MyTeamPage() {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');
  const [spec, setSpec] = useState<MetricBreakdownSpec | null>(null);
  const [specOpen, setSpecOpen] = useState(false);

  useEffect(() => {
    api
      .get('/employees/subordinates')
      .then((res) => setTeam(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Your team could not be loaded.')))
      .finally(() => setLoading(false));
  }, []);

  const roles = useMemo(
    () => Array.from(new Set(team.map((m) => m.jobRole?.title).filter(Boolean) as string[])).sort(),
    [team]
  );
  const states = useMemo(() => Array.from(new Set(team.map((m) => m.employmentState).filter(Boolean) as string[])), [team]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.filter((m) => {
      if (role && m.jobRole?.title !== role) return false;
      if (state && m.employmentState !== state) return false;
      if (!q) return true;
      return [m.firstName, m.middleName, m.lastName, m.employeeNumber, m.jobRole?.title, m.unit?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [team, search, role, state]);

  const openBreakdown = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/employees/${id}/profile-completion`);
      const d = res.data?.data;
      setSpec(profileCompletionSpec(d?.percentage ?? 0, d?.breakdown, d?.name));
      setSpecOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The profile completion breakdown could not be loaded.'));
    }
  }, []);

  const open = (id: string) => navigate({ to: '/my-team/$employeeId', params: { employeeId: id } });
  const nameOf = (m: TeamMember) => `${m.firstName} ${m.middleName ? `${m.middleName[0]}. ` : ''}${m.lastName}`;
  const filtered = !!(search.trim() || role || state);

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-4 sm:p-6 space-y-5 max-w-screen-xl mx-auto">
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<Users className="h-5 w-5" />}
          title="My Team"
          subtitle="The employees who report directly to you."
          badgeText={loading ? undefined : `${team.length} Employee${team.length === 1 ? '' : 's'}`}
        />
      </motion.div>

      {team.length > 0 && (
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row gap-2 md:items-center">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Search your team</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee ID or job role"
              className="w-full h-10 rounded-xl border border-input bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <select
              aria-label="Filter by job role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 min-w-0 rounded-xl border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            >
              <option value="">All job roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              aria-label="Filter by status"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-10 min-w-0 rounded-xl border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            >
              <option value="">All statuses</option>
              {states.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
            </select>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        {loading ? (
          <p className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-sm text-muted-foreground">Loading your team…</p>
        ) : error ? (
          <p className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-sm text-status-danger-foreground">{error}</p>
        ) : team.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <UserRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 font-semibold text-foreground">No one reports to you yet</p>
            <p className="mt-1 text-sm text-muted-foreground">My Team lists employees whose immediate supervisor is you. HR sets reporting lines.</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-sm text-muted-foreground">
            No one on your team matches {filtered ? 'these filters' : 'this search'}.
          </p>
        ) : (
          <>
            {/* Phones and small tablets: cards, never a sideways-scrolling table. */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {shown.map((m) => {
                const pct = Math.round(Number(m.profileCompletion ?? 0));
                return (
                  <li key={m.id} className="rounded-2xl border border-border-soft bg-surface p-4 shadow-card min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar size="md" src={m.photoUrl || undefined} name={`${m.firstName} ${m.lastName}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground break-words">{nameOf(m)}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.employeeNumber}</p>
                        <p className="mt-1 text-sm text-foreground break-words">{m.jobRole?.title ?? 'No job role'}</p>
                        {m.unit?.name && <p className="text-xs text-muted-foreground break-words">{m.unit.name}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge className={`border ${stateTone(m.employmentState)}`}>{stateLabel(m.employmentState)}</Badge>
                      {m.employmentStatus && <Badge className={`border ${STATUS_TONE_CHIP.total}`}>{formatEnumLabel(m.employmentStatus)}</Badge>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">Profile</span>
                      <div className="flex-1 min-w-0"><CompletionCell pct={pct} name={nameOf(m)} onClick={() => openBreakdown(m.id)} /></div>
                    </div>
                    <Button variant="review" size="sm" className="mt-3 w-full" onClick={() => open(m.id)}>
                      View profile <ChevronRight className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-primary-50/50 border-b border-border dark:bg-primary-900/40">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Job Role</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Profile Completion</th>
                    <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => open(m.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <Avatar size="sm" src={m.photoUrl || undefined} name={`${m.firstName} ${m.lastName}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-tight">{nameOf(m)}</p>
                            <p className="text-xs text-muted-foreground font-mono">{m.employeeNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{m.jobRole?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.unit?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={`border ${stateTone(m.employmentState)}`}>{stateLabel(m.employmentState)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <CompletionCell pct={Math.round(Number(m.profileCompletion ?? 0))} name={nameOf(m)} onClick={() => openBreakdown(m.id)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="review" onClick={(e) => { e.stopPropagation(); open(m.id); }}>View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <MetricBreakdownDialog open={specOpen} onOpenChange={setSpecOpen} spec={spec} />
    </motion.div>
  );
}
