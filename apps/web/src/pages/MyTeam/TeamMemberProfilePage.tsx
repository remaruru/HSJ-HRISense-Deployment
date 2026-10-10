import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  ChevronRight, LayoutGrid, Briefcase, CalendarClock, Clock, CalendarDays, GraduationCap, ShieldCheck, FileText, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoSection, InfoGrid, InfoField, InfoEmpty } from '@/components/ui/info-section';
import { SectionNav, type SectionNavGroup } from '@/components/ui/section-nav';
import { STATUS_TONE_CHIP } from '@/components/ui/status-tone';
import { MetricBreakdownDialog, type MetricBreakdownSpec } from '@/components/shared/MetricBreakdown';
import { profileCompletionSpec } from '@/components/shared/profileCompletionSpec';
import { EMPLOYMENT_STATE_LABELS, employmentDuration, formatEmploymentDate, hasEnded, type EmploymentState } from '@/lib/employment';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { EmployeeScheduleProfileTab } from '@/pages/Employees/components/EmployeeScheduleProfileTab';
import { EmployeeAttendanceProfileTab } from '@/pages/Employees/components/EmployeeAttendanceProfileTab';
import { EmployeeComplianceProfileTab } from '@/pages/Employees/components/EmployeeComplianceProfileTab';
import { EmployeeTrainingProfileTab } from '@/pages/Employees/components/EmployeeTrainingProfileTab';
import { ProfileHero } from '@/pages/Profile/components/ProfileHero';
import { ProfileDocumentsSection } from '@/pages/Profile/components/ProfileDocumentsSection';
import { formatDate, formatEnumLabel, fullNameOf } from '@/pages/Profile/profileFormat';

/**
 * Team Member Profile (`/my-team/$employeeId`) — a supervisor viewing someone
 * who reports directly to them.
 *
 * `GET /employees/:id` answers a supervisor only for their own direct reports
 * (403 for anyone else, whatever the URL says), and answers with the WORK
 * profile: no personal details, contacts, addresses, government IDs, emergency
 * contacts or account details — those stay with HR and the employee.
 *
 * Sections are the ones each module already opens to a direct report's
 * supervisor: schedule (a supervisor may set their reports' weekly schedule),
 * attendance, leave requests, training, compliance and documents. Leave
 * balances, evaluation history, medical and psychological records are not
 * among them, so they are not here. There is no Edit, Archive, Restore or
 * account control: supervisors do not administer employee records.
 */

const SECTIONS: Array<{ label: string; items: Array<{ id: string; label: string; icon: React.ReactNode }> }> = [
  {
    label: 'Team Member',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutGrid /> },
      { id: 'employment', label: 'Employment', icon: <Briefcase /> },
    ],
  },
  {
    label: 'Work',
    items: [
      { id: 'schedule', label: 'Schedule', icon: <CalendarClock /> },
      { id: 'attendance', label: 'Attendance', icon: <Clock /> },
      { id: 'leave', label: 'Leave Requests', icon: <CalendarDays /> },
      { id: 'training', label: 'Training', icon: <GraduationCap /> },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'compliance', label: 'Compliance', icon: <ShieldCheck /> },
      { id: 'documents', label: 'Documents', icon: <FileText /> },
    ],
  },
];

const LEAVE_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Pending', tone: STATUS_TONE_CHIP.warning },
  FOR_REVIEW: { label: 'Endorsed — awaiting HR', tone: STATUS_TONE_CHIP.info },
  APPROVED: { label: 'Approved', tone: STATUS_TONE_CHIP.success },
  REJECTED: { label: 'Rejected', tone: STATUS_TONE_CHIP.danger },
  CANCELLED: { label: 'Cancelled', tone: STATUS_TONE_CHIP.neutral },
};

const dateOnly = (v: string) => {
  const [y, m, d] = String(v).split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** The report's leave requests — the same records the supervisor already sees on Leave Requests. */
function TeamMemberLeave({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/leave', { params: { scope: 'team', employeeId, limit: 50 } })
      // The API narrows to this person when they are on the team; filtering again
      // here means nobody else's request can ever appear on this page.
      .then((res) => setRows((res.data?.data ?? []).filter((r: any) => r.employeeId === employeeId)))
      .catch((err) => {
        setRows([]);
        setError(getApiErrorMessage(err, 'Leave requests could not be loaded.'));
      });
  }, [employeeId]);

  return (
    <InfoSection
      title="Leave Requests"
      description="Their recent requests. Endorse pending requests to HR from Leave Requests."
      action={
        <Button size="sm" variant="review" onClick={() => navigate({ to: '/leave/requests' })}>
          Open Leave Requests <ChevronRight className="h-4 w-4" />
        </Button>
      }
    >
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-status-danger-foreground">{error}</p>
      ) : rows.length === 0 ? (
        <InfoEmpty>No leave requests on file.</InfoEmpty>
      ) : (
        <ul className="divide-y divide-border-soft rounded-xl border border-border-soft">
          {rows.map((r) => {
            const st = LEAVE_STATUS[r.status] ?? { label: formatEnumLabel(r.status), tone: STATUS_TONE_CHIP.neutral };
            return (
              <li key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{formatEnumLabel(r.leaveType)} Leave</p>
                  <p className="text-xs text-muted-foreground">
                    {dateOnly(r.startDate)}{r.endDate && r.endDate !== r.startDate ? ` – ${dateOnly(r.endDate)}` : ''} · {r.totalDays} day{Number(r.totalDays) === 1 ? '' : 's'}
                  </p>
                </div>
                <Badge className={`border self-start sm:self-auto ${st.tone}`}>{st.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </InfoSection>
  );
}

export default function TeamMemberProfilePage() {
  const { employeeId } = useParams({ strict: false }) as { employeeId: string };
  const navigate = useNavigate();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [section, setSection] = useState('overview');
  const [spec, setSpec] = useState<MetricBreakdownSpec | null>(null);
  const [specOpen, setSpecOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSection('overview');
    api
      .get(`/employees/${employeeId}`)
      .then((res) => {
        setMember(res.data?.data ?? null);
        setError(null);
      })
      .catch((err) => {
        setMember(null);
        setError({ status: err?.response?.status, message: getApiErrorMessage(err, 'This profile could not be loaded.') });
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  const openBreakdown = async () => {
    try {
      const res = await api.get(`/employees/${employeeId}/profile-completion`);
      const d = res.data?.data;
      setSpec(profileCompletionSpec(d?.percentage ?? 0, d?.breakdown, d?.name));
      setSpecOpen(true);
    } catch (err) {
      setSpec(null);
      setError({ message: getApiErrorMessage(err, 'The breakdown could not be loaded.') });
    }
  };

  const crumb = (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link to="/my-team" className="font-medium text-primary-700 hover:underline dark:text-primary-300">My Team</Link>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
      <span className="font-semibold text-foreground break-words" aria-current="page">
        {member ? fullNameOf(member) : 'Team member'}
      </span>
    </nav>
  );

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  if (!member) {
    return (
      <div className="p-4 sm:p-6 max-w-screen-md mx-auto space-y-4">
        {crumb}
        <div className="rounded-2xl border border-border-soft bg-surface p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold text-foreground">
            {error?.status === 403 ? 'This employee is not on your team' : 'This profile could not be loaded'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error?.status === 403
              ? 'You can open the profiles of employees who report directly to you.'
              : error?.message}
          </p>
          <Button variant="review" className="mt-4" onClick={() => navigate({ to: '/my-team' })}>Back to My Team</Button>
        </div>
      </div>
    );
  }

  const ended = hasEnded(member.employmentState);
  const service = ended && !member.separationDate ? null : employmentDuration(member.hireDate, ended ? member.separationDate : null);
  const stateLabel = EMPLOYMENT_STATE_LABELS[member.employmentState as EmploymentState] ?? formatEnumLabel(member.employmentState);
  const navGroups: SectionNavGroup[] = SECTIONS;

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-screen-xl mx-auto">
      <motion.div variants={staggerItem}>{crumb}</motion.div>

      <motion.div variants={staggerItem}>
        <ProfileHero employee={member} context="team" completion={member.profileCompletion ?? null} onViewBreakdown={openBreakdown} />
      </motion.div>

      <MetricBreakdownDialog open={specOpen} onOpenChange={setSpecOpen} spec={spec} />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
        <motion.div variants={staggerItem} className="min-w-0">
          <SectionNav aria-label="Team member sections" groups={navGroups} value={section} onChange={setSection} />
        </motion.div>

        <motion.div variants={staggerItem} role="tabpanel" id={`section-${section}`} className="space-y-5 min-w-0">
          {section === 'overview' && (
            <>
              <InfoSection title="Work Profile">
                <InfoGrid columns={3}>
                  <InfoField label="Employee ID" value={member.employeeNumber} />
                  <InfoField label="Job Role" value={member.jobRole?.title} />
                  <InfoField label="Unit" value={member.unit?.name} />
                  <InfoField label="Department" value={member.department?.name} />
                  <InfoField label="Employee Status" value={stateLabel} />
                  <InfoField label="Employment Type" value={formatEnumLabel(member.employmentStatus)} />
                </InfoGrid>
              </InfoSection>
              <p className="rounded-xl border border-border-soft bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Personal details, contact information, addresses, government IDs and emergency contacts are kept between
                HR and the employee. Evaluations you are asked to give are under <Link to="/evaluations" className="font-semibold text-primary-700 hover:underline dark:text-primary-300">Evaluations</Link>.
              </p>
            </>
          )}

          {section === 'employment' && (
            <InfoSection title="Employment" description="Kept by HR.">
              <InfoGrid columns={3}>
                <InfoField label="Employment Type" value={formatEnumLabel(member.employmentStatus)} />
                <InfoField label="Employee Status" value={stateLabel} />
                <InfoField label="Start Date" value={formatEmploymentDate(member.hireDate)} />
                <InfoField label="Length of Service" value={service?.text} />
                <InfoField label="Probation Date" value={formatDate(member.probationDate)} />
                <InfoField label="Regularization Date" value={formatDate(member.regularizationDate)} />
                <InfoField label="Professional Role" value={member.professionalRole || 'Not applicable'} />
                <InfoField
                  label="Immediate Supervisor"
                  value={member.immediateSupervisor ? `${member.immediateSupervisor.firstName} ${member.immediateSupervisor.lastName} (you)` : undefined}
                />
              </InfoGrid>
            </InfoSection>
          )}

          {section === 'schedule' && <EmployeeScheduleProfileTab employeeId={member.id} employeeName={fullNameOf(member)} />}
          {section === 'attendance' && <EmployeeAttendanceProfileTab employeeId={member.id} />}
          {section === 'leave' && <TeamMemberLeave employeeId={member.id} />}
          {section === 'training' && <EmployeeTrainingProfileTab employeeId={member.id} />}
          {section === 'compliance' && <EmployeeComplianceProfileTab employeeId={member.id} />}
          {section === 'documents' && (
            <ProfileDocumentsSection employeeId={member.id} description="Their documents that HR has marked visible to their supervisor. Medical clearances are never shown here." />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
