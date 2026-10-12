import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Edit2, LayoutGrid, User, Phone, Briefcase, Landmark, Siren, FileText, CalendarClock, Clock, CalendarDays,
  ClipboardCheck, GraduationCap, BookOpen, ShieldCheck, Stethoscope, Brain, KeyRound, History, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoSection, InfoGrid, InfoField, InfoEmpty } from '@/components/ui/info-section';
import { SectionNav, type SectionNavGroup } from '@/components/ui/section-nav';
import { MetricBreakdownDialog } from '@/components/shared/MetricBreakdown';
import { profileCompletionSpec } from '@/components/shared/profileCompletionSpec';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { EMPLOYMENT_STATE_LABELS, employmentDuration, formatEmploymentDate, hasEnded, type EmploymentState } from '@/lib/employment';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { useAuth } from '@/providers/AuthProvider';
import { formatAge } from '@/lib/age';
import { EmployeeScheduleProfileTab } from '@/pages/Employees/components/EmployeeScheduleProfileTab';
import { EmployeeAttendanceProfileTab } from '@/pages/Employees/components/EmployeeAttendanceProfileTab';
import { EmployeeComplianceProfileTab } from '@/pages/Employees/components/EmployeeComplianceProfileTab';
import { EmployeeMedicalProfileTab } from '@/pages/Employees/components/EmployeeMedicalProfileTab';
import { EmployeePsychologicalProfileTab } from '@/pages/Employees/components/EmployeePsychologicalProfileTab';
import { EmployeeEvaluationProfileTab } from '@/pages/Employees/components/EmployeeEvaluationProfileTab';
import { EmployeeTrainingProfileTab } from '@/pages/Employees/components/EmployeeTrainingProfileTab';
import { LeaveBalancePanel } from '@/pages/Leave/components/LeaveBalancePanel';
import { ProfileHero } from './components/ProfileHero';
import { ProfileDocumentsSection } from './components/ProfileDocumentsSection';
import { EditMyProfileDialog } from './components/EditMyProfileDialog';
import { NOT_PROVIDED, formatDate, formatDateTime, formatEnumLabel, fullNameOf } from './profileFormat';
import { PersonalRecordFields, ResidenceFields, EducationLicensesSections } from '@/pages/Employees/components/EmployeeRecordSections';

/**
 * My Profile (`/profile`) — "I am viewing myself", for every signed-in account
 * (HR, Sister, supervisors, heads, coordinators, employees).
 *
 * The record comes from `GET /employees/me`, the person's own record. Every
 * section below is something the API already lets a person read about
 * themselves; each module still applies its own rule (medical and
 * psychological records keep their confidentiality — the employee sees what
 * those modules show an employee).
 *
 * There are no administrative actions here — not even for HR or Sister on their
 * own record. Archive, account, organisation and HR-managed fields belong to
 * Employee Management.
 */

const SECTIONS: Array<{ label: string; items: Array<{ id: string; label: string; icon: React.ReactNode }> }> = [
  {
    label: 'My Profile',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutGrid /> },
      { id: 'personal', label: 'Personal', icon: <User /> },
      { id: 'contact', label: 'Contact', icon: <Phone /> },
      { id: 'employment', label: 'Employment', icon: <Briefcase /> },
      { id: 'government', label: 'Government', icon: <Landmark /> },
      { id: 'education', label: 'Education & Licenses', icon: <BookOpen /> },
      { id: 'emergency', label: 'Emergency', icon: <Siren /> },
      { id: 'documents', label: 'Documents', icon: <FileText /> },
    ],
  },
  {
    label: 'Work',
    items: [
      { id: 'schedule', label: 'Schedule', icon: <CalendarClock /> },
      { id: 'attendance', label: 'Attendance', icon: <Clock /> },
      { id: 'leave', label: 'Leave', icon: <CalendarDays /> },
      { id: 'evaluations', label: 'Evaluations', icon: <ClipboardCheck /> },
      { id: 'training', label: 'Training', icon: <GraduationCap /> },
    ],
  },
  {
    label: 'Health & Compliance',
    items: [
      { id: 'compliance', label: 'Compliance', icon: <ShieldCheck /> },
      { id: 'medical', label: 'Medical', icon: <Stethoscope /> },
      { id: 'psychological', label: 'Psychological', icon: <Brain /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'account', label: 'Account & Security', icon: <KeyRound /> },
      { id: 'history', label: 'Record History', icon: <History /> },
    ],
  },
];

/** Completion groups (the API's criteria table) → the section showing those fields. */
const COMPLETION_GROUP_TO_SECTION: Record<string, string> = {
  Personal: 'personal',
  Contact: 'contact',
  Employment: 'employment',
  'Government IDs': 'government',
  'Emergency Contact': 'emergency',
  Documents: 'documents',
};

const TIER_LABEL: Record<string, string> = {
  FULL: 'Full access (HR)',
  SUPERVISOR: 'Supervisor — your own records and your direct reports',
  STANDARD: 'Employee — your own records',
};

export default function MyProfilePage() {
  const { user, fetchCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/employees/me');
      setEmployee(res.data?.data ?? null);
      setLoadError(null);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Your profile could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The record history is fetched when its section is first opened.
  useEffect(() => {
    if (section !== 'history' || !employee?.id || timeline !== null) return;
    api
      .get(`/employees/${employee.id}/timeline`)
      .then((res) => setTimeline(res.data?.data ?? []))
      .catch((err) => {
        setTimeline([]);
        setTimelineError(getApiErrorMessage(err, 'Your record history could not be loaded.'));
      });
  }, [section, employee?.id, timeline]);

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading your profile…</div>;
  if (loadError || !employee) {
    return <div className="p-10 text-center text-status-danger-foreground">{loadError ?? 'Your profile could not be loaded.'}</div>;
  }

  const missingIds = new Set<string>(employee.missingFieldIds ?? []);
  const isMissing = (id: string) => missingIds.has(id);
  const missingBySection: Record<string, number> = {};
  for (const { group, items } of (employee.missingFieldGroups ?? []) as Array<{ group: string; items: string[] }>) {
    const s = COMPLETION_GROUP_TO_SECTION[group];
    if (s) missingBySection[s] = (missingBySection[s] ?? 0) + items.length;
  }
  const completionSections = new Set(Object.values(COMPLETION_GROUP_TO_SECTION));
  const navGroups: SectionNavGroup[] = SECTIONS.map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({
      ...i,
      missing: missingBySection[i.id],
      complete: completionSections.has(i.id) && !missingBySection[i.id],
    })),
  }));

  const completionSpec = profileCompletionSpec(employee.profileCompletion ?? 0, employee.profileCompletionBreakdown, fullNameOf(employee));
  const ended = hasEnded(employee.employmentState);
  const endDateMissing = ended && !employee.separationDate;
  const service = endDateMissing ? null : employmentDuration(employee.hireDate, ended ? employee.separationDate : null);
  const stateLabel = EMPLOYMENT_STATE_LABELS[employee.employmentState as EmploymentState] ?? formatEnumLabel(employee.employmentState);
  const supervisorText = employee.immediateSupervisor
    ? `${employee.immediateSupervisor.firstName} ${employee.immediateSupervisor.lastName}${employee.immediateSupervisor.jobRole?.title ? ` · ${employee.immediateSupervisor.jobRole.title}` : ''}`
    : employee.noSupervisorRequired && employee.supervisorAssignmentStatus !== 'PENDING'
      ? `Not required — ${employee.jobRole?.title ?? 'this'} is a top-level role`
      : employee.supervisorAssignmentStatus === 'PENDING'
        ? 'Being reviewed by HR'
        : 'None assigned';

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-screen-xl mx-auto">
      <motion.div variants={staggerItem}>
        <ProfileHero
          employee={employee}
          context="self"
          completion={employee.profileCompletion ?? 0}
          onViewBreakdown={completionSpec ? () => setBreakdownOpen(true) : undefined}
          // The top bar shows the photo too, so refresh the signed-in user as well.
          onImagesChanged={async () => {
            await Promise.all([load(), fetchCurrentUser().catch(() => null)]);
          }}
          actions={
            <Button variant="update" leftIcon={<Edit2 className="h-4 w-4" />} onClick={() => setEditOpen(true)} className="w-full sm:w-auto">
              Edit My Profile
            </Button>
          }
        />
      </motion.div>

      <MetricBreakdownDialog open={breakdownOpen} onOpenChange={setBreakdownOpen} spec={completionSpec} />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
        <motion.div variants={staggerItem} className="min-w-0">
          <SectionNav aria-label="My profile sections" groups={navGroups} value={section} onChange={setSection} />
        </motion.div>

        <motion.div variants={staggerItem} role="tabpanel" id={`section-${section}`} className="space-y-5 min-w-0">
          {section === 'overview' && (
            <>
              <InfoSection title="At a glance" description="Your work details as HR has them on file.">
                <InfoGrid columns={3}>
                  <InfoField label="Job Role" value={employee.jobRole?.title} />
                  <InfoField label="Unit" value={employee.unit?.name} />
                  <InfoField label="Department" value={employee.department?.name} />
                  <InfoField label="Immediate Supervisor" value={supervisorText} />
                  <InfoField label="Employment Type" value={formatEnumLabel(employee.employmentStatus)} />
                  <InfoField label="Employee Status" value={stateLabel} />
                  <InfoField label="Start Date" value={formatEmploymentDate(employee.hireDate)} />
                  <InfoField label="Length of Service" value={service?.text} />
                  <InfoField label="Mobile Number" value={employee.mobilePhone} />
                </InfoGrid>
              </InfoSection>
              <InfoSection title="Keeping your profile current" description="What you can change yourself, and what HR keeps.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border-soft bg-muted/20 p-3.5">
                    <p className="font-semibold text-foreground">You can update</p>
                    <p className="mt-1 text-muted-foreground">Mobile number, home phone, present and permanent address, emergency contacts (up to three) and religion — with <span className="font-semibold text-foreground">Edit My Profile</span>. Your profile photo and banner — with the camera button on each.</p>
                  </div>
                  <div className="rounded-xl border border-border-soft bg-muted/20 p-3.5">
                    <p className="font-semibold text-foreground">HR keeps</p>
                    <p className="mt-1 text-muted-foreground">Your name, personal email (your sign-in), birth details, employment details, job role, unit, supervisor and government IDs. Ask HR to correct any of these.</p>
                  </div>
                </div>
              </InfoSection>
            </>
          )}

          {section === 'personal' && (
            <InfoSection title="Personal Details" missingCount={missingBySection.personal}>
              <InfoGrid columns={3}>
                <InfoField label="Full Name" value={fullNameOf(employee)} missing={isMissing('fullName')} />
                <InfoField label="Sex" value={formatEnumLabel(employee.gender)} missing={isMissing('gender')} />
                <InfoField label="Civil Status" value={formatEnumLabel(employee.civilStatus)} missing={isMissing('civilStatus')} />
                <InfoField label="Date of Birth" value={formatDate(employee.dateOfBirth)} missing={isMissing('dateOfBirth')} />
                {/* Worked out from the date of birth each time — never stored. */}
                <InfoField label="Age" value={formatAge(employee.dateOfBirth) ?? undefined} />
                <InfoField label="Place of Birth" value={employee.placeOfBirth} />
                <InfoField label="Nationality" value={employee.nationality} />
                <InfoField label="Religion" value={employee.religion} />
                <PersonalRecordFields employee={employee} />
              </InfoGrid>
            </InfoSection>
          )}

          {section === 'contact' && (
            <>
              <InfoSection title="Contact Details" missingCount={missingBySection.contact}>
                <InfoGrid columns={3}>
                  <InfoField label="Mobile Number" value={employee.mobilePhone} missing={isMissing('mobilePhone')} />
                  <InfoField label="Home Phone" value={employee.homePhone} />
                  <InfoField label="Telephone Number" value={employee.telephoneNumber} />
                  <InfoField label="Personal Email (your sign-in)" value={employee.personalEmail} missing={isMissing('email')} span />
                </InfoGrid>
              </InfoSection>
              <InfoSection title="Addresses">
                <InfoGrid>
                  <InfoField label="Present Address" value={employee.presentAddress} missing={isMissing('presentAddress')} />
                  <InfoField label="Permanent / Provincial Address" value={employee.permanentAddress} />
                  <ResidenceFields employee={employee} />
                </InfoGrid>
              </InfoSection>
            </>
          )}

          {section === 'employment' && (
            <>
              <InfoSection title="Employment" description="Kept by HR." missingCount={missingBySection.employment}>
                <InfoGrid columns={3}>
                  <InfoField label="Employment Type" value={formatEnumLabel(employee.employmentStatus)} />
                  <InfoField label="Employee Status" value={stateLabel} />
                  <InfoField label="Start Date" value={formatEmploymentDate(employee.hireDate)} missing={isMissing('hireDate')} />
                  <InfoField
                    label="End Date"
                    value={ended ? (employee.separationDate ? formatEmploymentDate(employee.separationDate) : 'Not recorded') : 'Present — currently employed'}
                  />
                  <InfoField
                    label="Length of Service"
                    value={service ? service.text : endDateMissing ? 'Cannot be calculated — no end date recorded' : undefined}
                  />
                  <InfoField label="Probation Date" value={formatDate(employee.probationDate)} />
                  <InfoField label="Regularization Date" value={formatDate(employee.regularizationDate)} />
                  <InfoField label="Unit" value={employee.unit?.name} missing={isMissing('unit')} />
                  <InfoField label="Department" value={employee.department?.name} missing={isMissing('department')} />
                  <InfoField label="Job Role" value={employee.jobRole?.title} missing={isMissing('jobRole')} />
                  <InfoField label="Professional Role" value={employee.professionalRole || 'Not applicable'} />
                  <InfoField
                    label="Leave Eligibility (set by HR)"
                    value={[employee.paternityLeaveEligible && 'Paternity Leave', employee.soloParentLeaveEligible && 'Solo Parent Leave'].filter(Boolean).join(', ') || 'Not marked for Paternity or Solo Parent Leave'}
                  />
                </InfoGrid>
              </InfoSection>
              <InfoSection title="Immediate Supervisor">
                <InfoGrid>
                  <InfoField label="Reports to" value={supervisorText} span />
                </InfoGrid>
              </InfoSection>
            </>
          )}

          {section === 'education' && (
            // Kept by HR — shown here read-only.
            <EducationLicensesSections employee={employee} />
          )}

          {section === 'government' && (
            <InfoSection title="Government Information" description="Kept by HR." missingCount={missingBySection.government}>
              <InfoGrid>
                <InfoField label="SSS Number" value={employee.sssNumber} missing={isMissing('sssNumber')} />
                <InfoField label="PhilHealth Number" value={employee.philhealthNumber} missing={isMissing('philhealthNumber')} />
                <InfoField label="Pag-IBIG Number" value={employee.pagibigNumber} missing={isMissing('pagibigNumber')} />
                <InfoField label="TIN" value={employee.tinNumber} missing={isMissing('tinNumber')} />
                <InfoField
                  label="Other Government IDs"
                  span
                  value={
                    employee.governmentIds?.length ? (
                      <ul className="space-y-0.5">
                        {employee.governmentIds.map((g: any) => (
                          <li key={g.id}><span className="text-muted-foreground">{g.idType}:</span> {g.idNumber}</li>
                        ))}
                      </ul>
                    ) : employee.otherGovernmentIds ? (
                      <span className="whitespace-pre-line">{employee.otherGovernmentIds}</span>
                    ) : (
                      'None recorded'
                    )
                  }
                />
              </InfoGrid>
            </InfoSection>
          )}

          {section === 'emergency' && (
            <InfoSection
              title="Emergency Contacts"
              description="Up to three people HR can call for you."
              missingCount={missingBySection.emergency}
              action={<Button size="sm" variant="update" leftIcon={<Edit2 />} onClick={() => setEditOpen(true)}>Edit</Button>}
            >
              {employee.emergencyContacts?.length ? (
                <div className="space-y-4">
                  {employee.emergencyContacts.map((c: any) => (
                    <div key={c.id}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact {c.position}</p>
                      <InfoGrid columns={3}>
                        <InfoField label="Contact Person" value={c.contactName} />
                        <InfoField label="Relationship" value={c.relationship} />
                        <InfoField label="Mobile Number" value={c.mobilePhone} />
                      </InfoGrid>
                    </div>
                  ))}
                </div>
              ) : employee.emergencyContactName || employee.emergencyContactPhone || isMissing('emergencyContactName') || isMissing('emergencyContactPhone') ? (
                <InfoGrid columns={3}>
                  <InfoField label="Contact Person" value={employee.emergencyContactName} missing={isMissing('emergencyContactName')} />
                  <InfoField label="Relationship" value={employee.emergencyContactRel} />
                  <InfoField label="Mobile Number" value={employee.emergencyContactPhone} missing={isMissing('emergencyContactPhone')} />
                </InfoGrid>
              ) : (
                <InfoEmpty>No emergency contact recorded.</InfoEmpty>
              )}
            </InfoSection>
          )}

          {section === 'documents' && (
            <ProfileDocumentsSection employeeId={employee.id} description="Your documents on file that HR has made visible to you." />
          )}

          {section === 'schedule' && (
            <EmployeeScheduleProfileTab employeeId={employee.id} employeeName={fullNameOf(employee)} readOnly />
          )}

          {section === 'attendance' && <EmployeeAttendanceProfileTab employeeId={employee.id} />}

          {section === 'leave' && (
            <>
              <LeaveBalancePanel employeeId={employee.id} canManage={false} />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="review" className="w-full sm:w-auto" onClick={() => navigate({ to: '/leave/requests' })}>
                  My leave requests <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="create" className="w-full sm:w-auto" onClick={() => navigate({ to: '/leave/new' })}>
                  File a leave request <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {section === 'evaluations' && <EmployeeEvaluationProfileTab employeeId={employee.id} selfView />}

          {section === 'training' && <EmployeeTrainingProfileTab employeeId={employee.id} />}

          {section === 'compliance' && <EmployeeComplianceProfileTab employeeId={employee.id} selfView />}

          {section === 'medical' && <EmployeeMedicalProfileTab employeeId={employee.id} selfView />}

          {section === 'psychological' && <EmployeePsychologicalProfileTab employeeId={employee.id} selfView />}

          {section === 'account' && (
            <InfoSection
              title="Account & Security"
              description="How you sign in to HRISense."
              action={
                <Button size="sm" variant="review" onClick={() => navigate({ to: '/settings' })}>
                  Change password <ChevronRight className="h-4 w-4" />
                </Button>
              }
            >
              <InfoGrid>
                <InfoField label="Sign-in Email" value={employee.user?.email ?? user?.email} />
                <InfoField label="Account" value={employee.user ? (employee.user.isActive ? 'Active' : 'Deactivated') : 'No account linked'} />
                <InfoField label="Last Sign-in" value={formatDateTime(employee.user?.lastLoginAt) || NOT_PROVIDED} />
                <InfoField label="Access Level" value={TIER_LABEL[user?.permissionTier ?? ''] ?? formatEnumLabel(user?.permissionTier)} />
              </InfoGrid>
            </InfoSection>
          )}

          {section === 'history' && (
            <InfoSection title="Record History" description="Recorded activity on your employee record.">
              {timeline === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : timelineError ? (
                <p className="text-sm text-status-danger-foreground">{timelineError}</p>
              ) : timeline.length === 0 ? (
                <InfoEmpty>No activity recorded on your record yet.</InfoEmpty>
              ) : (
                <ol className="relative border-l-2 border-primary-200 dark:border-primary-900 ml-3 space-y-4 pb-1">
                  {timeline.map((log: any) => (
                    <li key={log.id} className="relative pl-6">
                      <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-surface border-2 border-primary-500" aria-hidden="true" />
                      <div className="rounded-xl border border-border-soft bg-muted/30 p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{formatEnumLabel(log.action)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                        </div>
                        {log.actor?.name && <p className="mt-1 text-xs text-muted-foreground">By {log.actor.name}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </InfoSection>
          )}
        </motion.div>
      </div>

      <EditMyProfileDialog isOpen={editOpen} onClose={() => setEditOpen(false)} employee={employee} onSaved={load} />
    </motion.div>
  );
}
