import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
  Navigate,
} from '@tanstack/react-router';
import LandingPage from '@/pages/Landing/LandingPage';
import LoginPage from '@/pages/Auth/LoginPage';
import ChangePasswordPage from '@/pages/Auth/ChangePasswordPage';
import ForgotPasswordPage from '@/pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/Auth/ResetPasswordPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import EmployeesPage from '@/pages/Employees/EmployeesPage';
import EmployeeDetailPage from '@/pages/Employees/EmployeeDetailPage';
import EmployeeOnboardingPage from '@/pages/Employees/EmployeeOnboardingPage';
import DraftEmployeesPage from '@/pages/Employees/DraftEmployeesPage';
import ArchivedEmployeesPage from '@/pages/Employees/ArchivedEmployeesPage';
import OrgChartPage from '@/pages/Employees/OrgChartPage';
import MyProfilePage from '@/pages/Profile/MyProfilePage';
import MyTeamPage from '@/pages/MyTeam/MyTeamPage';
import TeamMemberProfilePage from '@/pages/MyTeam/TeamMemberProfilePage';

import DailyMonitoringPage from '@/pages/Attendance/DailyMonitoringPage';
import WorkSchedulePage from '@/pages/Attendance/WorkSchedulePage';
import { HolidayCalendarPage } from '@/pages/Attendance/HolidayCalendarPage';
import AttendanceTallyPage from '@/pages/Attendance/AttendanceTallyPage';
import AttendanceImportPage from '@/pages/Attendance/AttendanceImportPage';
import LeaveRequestsPage from '@/pages/Leave/LeaveRequestsPage';
import NewLeaveRequestPage from '@/pages/Leave/NewLeaveRequestPage';
import LeaveCalendarPage from '@/pages/Leave/LeaveCalendarPage';
import EvaluationsPage from '@/pages/Evaluations/EvaluationsPage';
import AwardsPage from '@/pages/Awards/AwardsPage';
import YearlyAchievementsPage from '@/pages/Achievements/YearlyAchievementsPage';
import YearlyAchievementDetailPage from '@/pages/Achievements/YearlyAchievementDetailPage';
import TrainingPage from '@/pages/Training/TrainingPage';
import CompliancePage from '@/pages/Compliance/CompliancePage';
import MedicalPage from '@/pages/Medical/MedicalPage';
import PsychologicalPage from '@/pages/Psychological/PsychologicalPage';
import AIPage from '@/pages/AI/AIPage';
import ReportsPage from '@/pages/Reports/ReportsPage';
import AnnouncementsPage from '@/pages/Announcements/AnnouncementsPage';
import NotificationsPage from '@/pages/Notifications/NotificationsPage';
import AuditLogsPage from '@/pages/Audit/AuditLogsPage';
import HelpCenterPage from '@/pages/HelpCenter/HelpCenterPage';
import HelpGuidePage from '@/pages/HelpCenter/HelpGuidePage';
import SettingsPage from '@/pages/Settings/SettingsPage';
import RecruitmentOverviewPage from '@/pages/Recruitment/RecruitmentOverviewPage';
import JobOpeningsPage from '@/pages/Recruitment/JobOpeningsPage';
import JobOpeningFormPage from '@/pages/Recruitment/JobOpeningFormPage';
import JobOpeningDetailPage from '@/pages/Recruitment/JobOpeningDetailPage';
import ApplicantsPage from '@/pages/Recruitment/ApplicantsPage';
import ApplicantDetailPage from '@/pages/Recruitment/ApplicantDetailPage';
import { CareersLayout } from '@/pages/Careers/CareersLayout';
import CareersPage from '@/pages/Careers/CareersPage';
import OpeningDetailPage from '@/pages/Careers/OpeningDetailPage';
import ApplyPage from '@/pages/Careers/ApplyPage';
import ApplicationSuccessPage from '@/pages/Careers/ApplicationSuccessPage';
import ApplicationStatusPage from '@/pages/Careers/ApplicationStatusPage';
import { AppShell } from '@/components/layout/AppShell';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useAuth } from '@/providers/AuthProvider';
import { useThemeScope } from '@/providers/ThemeProvider';
import type { RouterContext } from '@/lib/router';

/* ─── Theme scopes ───────────────────────────────────────────────── */
/**
 * Public pages follow the visitor's own light/dark choice (the switch on the
 * landing page); the signed-in app follows the account's (see AppShell).
 */
function GuestThemed({ children }: { children: React.ReactNode }) {
  useThemeScope('guest');
  return <>{children}</>;
}

function AccountThemed({ children }: { children: React.ReactNode }) {
  useThemeScope('account');
  return <>{children}</>;
}

/* ─── Root Route ─────────────────────────────────────────────────── */
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

/* ─── Landing Route ──────────────────────────────────────────────── */
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <GuestThemed><LandingPage /></GuestThemed>,
});

/* ─── Public Careers Routes ──────────────────────────────────────── */
const careersLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'careers-layout',
  component: () => <GuestThemed><CareersLayout /></GuestThemed>,
});

const careersListRoute = createRoute({
  getParentRoute: () => careersLayoutRoute,
  path: '/careers',
  component: CareersPage,
});

const careerSuccessRoute = createRoute({
  getParentRoute: () => careersLayoutRoute,
  path: '/careers/application-success',
  component: ApplicationSuccessPage,
});

/**
 * Login-free application status. Declared BEFORE the `$openingSlug` route so the
 * literal segment wins over the dynamic one.
 */
const careerStatusRoute = createRoute({
  getParentRoute: () => careersLayoutRoute,
  path: '/careers/application-status/$statusToken',
  component: ApplicationStatusPage,
});

const careerDetailRoute = createRoute({
  getParentRoute: () => careersLayoutRoute,
  path: '/careers/$openingSlug',
  component: OpeningDetailPage,
});

const careerApplyRoute = createRoute({
  getParentRoute: () => careersLayoutRoute,
  path: '/careers/$openingSlug/apply',
  component: ApplyPage,
});

/* ─── Login Component Guard ──────────────────────────────────────── */
function PublicLoginRoute() {
  const { isAuthenticated, user, isInitializing } = useAuth();

  if (isInitializing) return null;

  if (isAuthenticated && user) {
    if (user.mustChangePassword) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <GuestThemed><LoginPage /></GuestThemed>;
}

/* ─── Login Route ────────────────────────────────────────────────── */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    const { isAuthenticated, user, isInitializing } = context.auth;

    if (isInitializing) return;

    if (isAuthenticated && user) {
      if (user.mustChangePassword) {
        throw redirect({ to: '/change-password', replace: true });
      }
      throw redirect({ to: '/dashboard', replace: true });
    }
  },
  component: PublicLoginRoute,
});

/* ─── Forgot / Reset Password (public, no session required) ─────── */
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: () => <GuestThemed><ForgotPasswordPage /></GuestThemed>,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: () => <GuestThemed><ResetPasswordPage /></GuestThemed>,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
});

/* ─── Change-Password Component Guard ────────────────────────────── */
function ChangePasswordRouteGuard() {
  const { isAuthenticated, user, isInitializing } = useAuth();

  if (isInitializing) return null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AccountThemed><ChangePasswordPage /></AccountThemed>;
}

/* ─── Change-Password Route (standalone, no AppShell) ───────────── */
const changePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  beforeLoad: ({ context }) => {
    const { isAuthenticated, user, isInitializing } = context.auth;

    if (isInitializing) return;

    if (!isAuthenticated || !user) {
      throw redirect({ to: '/login', replace: true });
    }

    if (!user.mustChangePassword) {
      throw redirect({ to: '/dashboard', replace: true });
    }
  },
  component: ChangePasswordRouteGuard,
});

/* ─── Authenticated Layout Guard ─────────────────────────────────── */
function AuthenticatedAppShell() {
  const { isAuthenticated, user, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <AppShell sidebar={<Sidebar />} topNav={<TopNav />}>
      <Outlet />
    </AppShell>
  );
}

/* ─── App Layout Route (authenticated) ──────────────────────────── */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ context }) => {
    const { isAuthenticated, user, isInitializing } = context.auth;

    if (isInitializing) return;

    if (!isAuthenticated || !user) {
      throw redirect({ to: '/login', replace: true });
    }

    if (user.mustChangePassword) {
      throw redirect({ to: '/change-password', replace: true });
    }
  },
  component: AuthenticatedAppShell,
});

/* ─── Dashboard ──────────────────────────────────────────────────── */
const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  component: DashboardPage,
});

/* ─── Who opens which person screen ─────────────────────────────────
 * Three different screens, never one screen with buttons hidden:
 *   My Profile          /profile               everyone, their own record
 *   My Team             /my-team(/$employeeId) supervisors, their direct reports
 *   Employee Management /employees(/…)         HR (FULL) only
 * A link into Employee Management from someone else lands on their own
 * equivalent. The API enforces the same rules on every request.
 */
type GuardUser = RouterContext['auth']['user'];

function requireEmployeeManagement(user: GuardUser, employeeId?: string) {
  if (!user || user.permissionTier === 'FULL') return;
  if (employeeId && employeeId === user.employee?.id) throw redirect({ to: '/profile', replace: true });
  if (user.permissionTier === 'SUPERVISOR') {
    if (employeeId) throw redirect({ to: '/my-team/$employeeId', params: { employeeId }, replace: true });
    throw redirect({ to: '/my-team', replace: true });
  }
  throw redirect({ to: '/profile', replace: true });
}

/* ─── My Profile ─────────────────────────────────────────────────── */
const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: MyProfilePage,
});

/* ─── My Team (supervisors) ──────────────────────────────────────── */
const myTeamRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/my-team',
  beforeLoad: ({ context }) => {
    const user = context.auth.user;
    if (!user) return;
    if (user.permissionTier === 'FULL') throw redirect({ to: '/employees', replace: true });
    if (user.permissionTier !== 'SUPERVISOR') throw redirect({ to: '/profile', replace: true });
  },
  component: MyTeamPage,
});

const teamMemberRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/my-team/$employeeId',
  beforeLoad: ({ context, params }) => {
    const user = context.auth.user;
    if (!user) return;
    if (params.employeeId === user.employee?.id) throw redirect({ to: '/profile', replace: true });
    if (user.permissionTier === 'FULL') {
      throw redirect({ to: '/employees/$employeeId', params: { employeeId: params.employeeId }, replace: true });
    }
    if (user.permissionTier !== 'SUPERVISOR') throw redirect({ to: '/profile', replace: true });
  },
  component: TeamMemberProfilePage,
});

/* ─── Employees Directory ───────────────────────────────────────── */
const employeesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees',
  beforeLoad: ({ context }) => requireEmployeeManagement(context.auth.user),
  component: EmployeesPage,
});

/* ─── Employee Onboarding ────────────────────────────────────────── */
const employeeOnboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees/onboard',
  beforeLoad: ({ context }) => requireEmployeeManagement(context.auth.user),
  component: EmployeeOnboardingPage,
});

/* ─── Draft Employees ───────────────────────────────────────────── */
const draftEmployeesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees/drafts',
  beforeLoad: ({ context }) => requireEmployeeManagement(context.auth.user),
  component: DraftEmployeesPage,
});

/* ─── Archived Employees ────────────────────────────────────────── */
const archivedEmployeesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees/archived',
  beforeLoad: ({ context }) => requireEmployeeManagement(context.auth.user),
  component: ArchivedEmployeesPage,
});

/* ─── Organizational Chart ───────────────────────────────────────── */
const employeeOrgChartRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees/org-chart',
  component: OrgChartPage,
});

/* ─── Employee Detail (Profile) ──────────────────────────────────── */
const employeeDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/employees/$employeeId',
  beforeLoad: ({ context, params }) => requireEmployeeManagement(context.auth.user, params.employeeId),
  component: EmployeeDetailPage,
});

/* ─── Attendance (redirect to Daily Monitoring) ─────────────────────────── */
const attendanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance',
  beforeLoad: () => {
    throw redirect({ to: '/attendance/daily', replace: true });
  },
  component: () => null,
});

/* ─── Daily Monitoring ───────────────────────────────────────────── */
const dailyMonitoringRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance/daily',
  component: DailyMonitoringPage,
});

/* ─── Holiday Calendar ───────────────────────────────────────────── */
const holidayCalendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance/holiday-calendar',
  component: HolidayCalendarPage,
});

/* ─── Work Schedule ──────────────────────────────────────────────── */
const workScheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance/schedule',
  component: WorkSchedulePage,
});

/* ─── Attendance Import ───────────────────────────────────────────── */
const attendanceImportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance/import',
  component: AttendanceImportPage,
});

/* ─── Attendance Tally ────────────────────────────────────────────── */
const attendanceTallyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/attendance/tally',
  component: AttendanceTallyPage,
});

/* ─── Leave (legacy path → real workspace) ───────────────────────── */
// `/leave` previously rendered a mock page full of fabricated leave requests for
// people who do not exist. It now redirects to the real Leave workspace.
const leaveRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/leave',
  beforeLoad: () => {
    throw redirect({ to: '/leave/requests', replace: true });
  },
  component: () => null,
});

/* ─── Leave Requests ─────────────────────────────────────────────── */
const leaveRequestsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/leave/requests',
  component: LeaveRequestsPage,
});

/* ─── New Leave Request ────────────────────────────────────────────── */
const newLeaveRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/leave/new',
  component: NewLeaveRequestPage,
  validateSearch: (search: Record<string, unknown>): { startDate?: string; endDate?: string } => {
    return {
      startDate: typeof search.startDate === 'string' ? search.startDate : undefined,
      endDate: typeof search.endDate === 'string' ? search.endDate : undefined,
    };
  },
});

/* ─── Leave Calendar ─────────────────────────────────────────────── */
const leaveCalendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/leave/calendar',
  component: LeaveCalendarPage,
});

/* ─── Evaluations / Performance ──────────────────────────────────── */
const evaluationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/evaluations',
  component: EvaluationsPage,
});

/* Yearly Achievements — everyone reads published years; HR manages. */
const achievementsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/achievements',
  component: YearlyAchievementsPage,
});

const achievementDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/achievements/$pageId',
  component: YearlyAchievementDetailPage,
});

/* Awards & Recognition — every employee; HR tabs inside the page. */
const awardsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/awards',
  component: AwardsPage,
});

const performanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/performance',
  beforeLoad: () => {
    throw redirect({ to: '/evaluations', replace: true });
  },
  component: () => null,
});

/* ─── Training ───────────────────────────────────────────────────── */
const trainingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/training',
  component: TrainingPage,
});

/* ─── Compliance ─────────────────────────────────────────────────── */
const complianceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/compliance',
  component: CompliancePage,
});

/* ─── Medical Records ────────────────────────────────────────────── */
const medicalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/medical',
  component: MedicalPage,
});

/* ─── Psychological Records ──────────────────────────────────────── */
const psychologicalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/psychological',
  component: PsychologicalPage,
});

/* ─── Payroll (Out of scope — Redirect to Dashboard) ────────────── */
const payrollRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/payroll',
  component: () => <Navigate to="/dashboard" replace />,
});

const payslipsRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/payslips',
  component: () => <Navigate to="/dashboard" replace />,
});

/* ─── AI Assistance ──────────────────────────────────────────────── */
const aiAssistanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ai-assistance',
  component: AIPage,
});

const aiLegacyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ai',
  component: () => <Navigate to="/ai-assistance" replace />,
});

const aiIntelligenceLegacyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ai-intelligence',
  component: () => <Navigate to="/ai-assistance" replace />,
});

/* ─── Reports ────────────────────────────────────────────────────── */
const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/reports',
  component: ReportsPage,
});

/* ─── Announcements ──────────────────────────────────────────────── */
const announcementsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/announcements',
  component: AnnouncementsPage,
});

/* ─── Notifications ──────────────────────────────────────────────── */
const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  component: NotificationsPage,
});

/* ─── Audit Logs (HR only) ───────────────────────────────────────── */
const auditLogsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/audit',
  beforeLoad: ({ context }) => {
    if (context.auth.user && context.auth.user.permissionTier !== 'FULL') {
      throw redirect({ to: '/dashboard', replace: true });
    }
  },
  component: AuditLogsPage,
});

/* ─── Settings ───────────────────────────────────────────────────── */
const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
});

/* ─── Help Center ────────────────────────────────────────────────── */
const helpCenterRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/help-center',
  component: HelpCenterPage,
});

const helpGuideRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/help-center/$guideSlug',
  component: HelpGuidePage,
});

const helpRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/help',
  component: () => <Navigate to="/help-center" replace />,
});

/* ─── Recruitment ────────────────────────────────────────────────── */
const recruitmentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment',
  component: RecruitmentOverviewPage,
});

const jobOpeningsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/openings',
  component: JobOpeningsPage,
});

const createJobOpeningRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/openings/new',
  component: JobOpeningFormPage,
});

const editJobOpeningRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/openings/$openingId/edit',
  component: JobOpeningFormPage,
});

const jobOpeningDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/openings/$openingId',
  component: JobOpeningDetailPage,
});

const applicantsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/applicants',
  component: ApplicantsPage,
});

const applicantDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/recruitment/applicants/$applicationId',
  component: ApplicantDetailPage,
});

/* ─── Route Tree ─────────────────────────────────────────────────── */
careersLayoutRoute.addChildren([
  careersListRoute,
  careerSuccessRoute,
  careerStatusRoute,
  careerDetailRoute,
  careerApplyRoute,
]);

export const routeTree = rootRoute.addChildren([
  landingRoute,
  careersLayoutRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  changePasswordRoute,
  appRoute.addChildren([
    dashboardRoute,
    profileRoute,
    myTeamRoute,
    teamMemberRoute,
    employeesRoute,
    employeeOnboardRoute,
    draftEmployeesRoute,
    archivedEmployeesRoute,
    employeeOrgChartRoute,
    employeeDetailRoute,
    attendanceRoute,
    dailyMonitoringRoute,
    attendanceImportRoute,
    attendanceTallyRoute,
    holidayCalendarRoute,
    workScheduleRoute,
    leaveRoute,
    leaveRequestsRoute,
    newLeaveRoute,
    leaveCalendarRoute,
    evaluationsRoute,
    awardsRoute,
    achievementsRoute,
    achievementDetailRoute,
    performanceRoute,
    trainingRoute,
    complianceRoute,
    medicalRoute,
    psychologicalRoute,
    payrollRedirectRoute,
    payslipsRedirectRoute,
    aiAssistanceRoute,
    aiLegacyRoute,
    aiIntelligenceLegacyRoute,
    reportsRoute,
    announcementsRoute,
    notificationsRoute,
    auditLogsRoute,
    settingsRoute,
    helpCenterRoute,
    helpGuideRoute,
    helpRedirectRoute,
    recruitmentRoute,
    jobOpeningsRoute,
    createJobOpeningRoute,
    editJobOpeningRoute,
    jobOpeningDetailRoute,
    applicantsRoute,
    applicantDetailRoute,
  ]),
]);
