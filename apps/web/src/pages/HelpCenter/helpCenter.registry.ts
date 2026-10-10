import type { HelpCategory, HelpCategoryCode, HelpGuideDefinition } from './helpCenter.types';
import { AUTH_GUIDES } from './guides/auth.guides';
import { DASHBOARD_GUIDES } from './guides/dashboard.guides';
import { EMPLOYEE_GUIDES } from './guides/employees.guides';
import { RECRUITMENT_GUIDES } from './guides/recruitment.guides';
import { ATTENDANCE_GUIDES } from './guides/attendance.guides';
import { LEAVE_GUIDES } from './guides/leave.guides';
import { PERFORMANCE_GUIDES } from './guides/performance.guides';
import { COMPLIANCE_GUIDES } from './guides/compliance.guides';
import { COMMUNICATION_GUIDES } from './guides/communication.guides';
import { ADMINISTRATION_GUIDES } from './guides/administration.guides';

/**
 * Help Center registry.
 *
 * Guides live in `./guides/*.guides.ts`, one file per area of the system, and
 * are gathered here. Categories are declared once, below; the counts shown in
 * the UI are derived from the guides themselves, never written down by hand.
 */
export const HELP_CATEGORIES: HelpCategory[] = [
  {
    code: 'AUTH',
    name: 'Getting Started & Security',
    shortDescription: 'Signing in, passwords, and ending your session safely.',
    iconName: 'KeyRound',
    order: 1,
  },
  {
    code: 'DASHBOARD',
    name: 'Dashboard',
    shortDescription: 'Reading the dashboard for your role.',
    iconName: 'LayoutDashboard',
    order: 2,
  },
  {
    code: 'EMPLOYEES',
    name: 'Employee Management',
    shortDescription: 'The directory, onboarding, 201 profiles, documents and accounts.',
    iconName: 'Users',
    order: 3,
  },
  {
    code: 'RECRUITMENT',
    name: 'Recruitment & Hiring',
    shortDescription: 'Job openings, applicants, interviews and conversion to onboarding.',
    iconName: 'UserPlus',
    order: 4,
  },
  {
    code: 'PUBLIC_RECRUITMENT',
    name: 'Careers & Applications',
    shortDescription: 'The public Careers pages and the application status link.',
    iconName: 'Globe',
    order: 5,
  },
  {
    code: 'ATTENDANCE',
    name: 'Time & Attendance',
    shortDescription: 'Daily monitoring, tallies, shifts, weekly schedules and holidays.',
    iconName: 'Clock',
    order: 6,
  },
  {
    code: 'LEAVE',
    name: 'Leave Management',
    shortDescription: 'Filing, endorsing and deciding leave, and leave balances.',
    iconName: 'CalendarDays',
    order: 7,
  },
  {
    code: 'EVALUATIONS',
    name: 'Performance & Evaluations',
    shortDescription: 'Templates, cycles, conducting evaluations and finalising them.',
    iconName: 'BarChart3',
    order: 8,
  },
  {
    code: 'TRAINING',
    name: 'Training & Seminars',
    shortDescription: 'Activities, participants, certificates and training history.',
    iconName: 'BookOpen',
    order: 9,
  },
  {
    code: 'RECOGNITION',
    name: 'Awards & Achievements',
    shortDescription: 'Nominating and voting for awards, running them (HR), and Yearly Achievements.',
    iconName: 'Trophy',
    order: 9.5,
  },
  {
    code: 'COMPLIANCE',
    name: 'Health & Compliance',
    shortDescription: 'Requirements, employee standing, medical and psychological records.',
    iconName: 'ShieldCheck',
    order: 10,
  },
  {
    code: 'ANNOUNCEMENTS',
    name: 'Announcements',
    shortDescription: 'Writing, targeting and reading hospital notices.',
    iconName: 'Megaphone',
    order: 11,
  },
  {
    code: 'NOTIFICATIONS',
    name: 'Notifications',
    shortDescription: 'The notification centre and keeping it under control.',
    iconName: 'Bell',
    order: 12,
  },
  {
    code: 'AUDIT',
    name: 'Audit Logs',
    shortDescription: 'Reviewing what was done in HRISense, by whom and when.',
    iconName: 'FileClock',
    order: 13,
  },
  {
    code: 'AI_ASSISTANCE',
    name: 'AI Assistance',
    shortDescription: 'Advisory workforce summaries built from your own figures.',
    iconName: 'Sparkles',
    order: 14,
  },
  {
    code: 'REPORTS',
    name: 'Reports',
    shortDescription: 'Generating and exporting workforce reports.',
    iconName: 'TrendingUp',
    order: 15,
  },
  {
    code: 'SETTINGS',
    name: 'Settings',
    shortDescription: 'Your password, your appearance choice and your own profile.',
    iconName: 'Settings',
    order: 16,
  },
  {
    code: 'HELP',
    name: 'Using the Help Center',
    shortDescription: 'Finding, reading and printing the guides.',
    iconName: 'HelpCircle',
    order: 17,
  },
];

/**
 * The Help Center's topic filters. They use the same groups as the sidebar, so
 * a guide is filed where its screen is in the menu. A category that is not
 * listed here still shows, under "Other".
 */
export const HELP_AREAS: { id: string; name: string; categories: HelpCategoryCode[] }[] = [
  { id: 'getting-started', name: 'Getting Started', categories: ['AUTH', 'DASHBOARD', 'HELP'] },
  { id: 'people', name: 'People & Organization', categories: ['EMPLOYEES', 'RECRUITMENT', 'PUBLIC_RECRUITMENT'] },
  { id: 'time', name: 'Time & Attendance', categories: ['ATTENDANCE', 'LEAVE'] },
  { id: 'performance', name: 'Performance', categories: ['EVALUATIONS', 'TRAINING', 'RECOGNITION'] },
  { id: 'health', name: 'Health & Compliance', categories: ['COMPLIANCE'] },
  { id: 'ai', name: 'AI & Analytics', categories: ['AI_ASSISTANCE', 'REPORTS'] },
  { id: 'communication', name: 'Communication', categories: ['ANNOUNCEMENTS', 'NOTIFICATIONS'] },
  { id: 'administration', name: 'Administration', categories: ['AUDIT', 'SETTINGS'] },
];

export const HELP_GUIDES: HelpGuideDefinition[] = [
  ...AUTH_GUIDES,
  ...DASHBOARD_GUIDES,
  ...EMPLOYEE_GUIDES,
  ...RECRUITMENT_GUIDES,
  ...ATTENDANCE_GUIDES,
  ...LEAVE_GUIDES,
  ...PERFORMANCE_GUIDES,
  ...COMPLIANCE_GUIDES,
  ...COMMUNICATION_GUIDES,
  ...ADMINISTRATION_GUIDES,
];
