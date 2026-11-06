import { PermissionTier } from '@prisma/client';
import type { AiActor } from '../actor/ai-actor';
import { canAccessEmployee } from '../actor/ai-actor';
import { guideVisibleTo } from '../knowledge/knowledge.service';

/**
 * Links the assistant may put in an answer.
 *
 * The model proposes `{ path, label }`; the server keeps a link only when the
 * path is one of HRISense's own screens that THIS user's tier can open. Any
 * other value — an external URL, `javascript:`, a query string, a screen the
 * user cannot reach, someone else's profile — is dropped. The browser then
 * navigates with the router, never by injecting HTML.
 *
 * Source: the navigation map (docs/HRISENSE_SYSTEM_REFERENCE.md §3.2) and the
 * route guards in apps/web/src/routeTree.tsx.
 */

type TierSet = readonly PermissionTier[];
const ALL: TierSet = [PermissionTier.FULL, PermissionTier.SUPERVISOR, PermissionTier.STANDARD];
const HR: TierSet = [PermissionTier.FULL];
const SUPERVISORS: TierSet = [PermissionTier.SUPERVISOR];

export const APP_PAGES: Array<{ path: string; label: string; tiers: TierSet }> = [
  { path: '/dashboard', label: 'Dashboard', tiers: ALL },
  { path: '/profile', label: 'My Profile', tiers: ALL },
  { path: '/my-team', label: 'My Team', tiers: SUPERVISORS },
  { path: '/attendance/daily', label: 'Daily Monitoring', tiers: ALL },
  { path: '/attendance/tally', label: 'Attendance Tally', tiers: ALL },
  { path: '/attendance/holiday-calendar', label: 'Holiday & Work Calendar', tiers: ALL },
  { path: '/attendance/schedule', label: 'Work Schedules', tiers: ALL },
  { path: '/attendance/import', label: 'Attendance Import', tiers: HR },
  { path: '/leave/requests', label: 'Leave Requests', tiers: ALL },
  { path: '/leave/new', label: 'File a Leave Request', tiers: ALL },
  { path: '/leave/calendar', label: 'Leave Calendar', tiers: ALL },
  { path: '/evaluations', label: 'Evaluations', tiers: ALL },
  { path: '/training', label: 'Training & Seminars', tiers: ALL },
  { path: '/awards', label: 'Awards & Recognition', tiers: ALL },
  { path: '/achievements', label: 'Yearly Achievements', tiers: ALL },
  { path: '/psychological', label: 'Psychological Records', tiers: ALL },
  { path: '/announcements', label: 'Announcements', tiers: ALL },
  { path: '/notifications', label: 'Notifications', tiers: ALL },
  { path: '/settings', label: 'Settings', tiers: ALL },
  { path: '/help-center', label: 'Help Center', tiers: ALL },
  { path: '/ai-assistance', label: 'AI Assistance', tiers: ALL },
  { path: '/employees', label: 'Employee Directory', tiers: HR },
  { path: '/employees/onboard', label: 'Add Employee', tiers: HR },
  { path: '/employees/drafts', label: 'Draft Employees', tiers: HR },
  { path: '/employees/archived', label: 'Archived Employees', tiers: HR },
  { path: '/employees/org-chart', label: 'Org Chart', tiers: ALL },
  { path: '/compliance', label: 'Compliance', tiers: HR },
  { path: '/medical', label: 'Medical Records', tiers: HR },
  { path: '/recruitment', label: 'Recruitment', tiers: HR },
  { path: '/recruitment/openings', label: 'Job Openings', tiers: HR },
  { path: '/recruitment/applicants', label: 'Applicants', tiers: HR },
  { path: '/reports', label: 'Reports & Analytics', tiers: HR },
  { path: '/audit', label: 'Audit Logs', tiers: HR },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pages this tier can open, for the policy prompt. */
export function pagesForTier(tier: PermissionTier): Array<{ path: string; label: string }> {
  return APP_PAGES.filter((p) => p.tiers.includes(tier)).map(({ path, label }) => ({ path, label }));
}

/**
 * Profile links follow the web app's own screens:
 *   own record          → My Profile (`/profile`), for everyone
 *   HR, anyone else     → Employee Management (`/employees/$id`)
 *   supervisor, a direct report → My Team (`/my-team/$id`)
 * Anything else gets no link.
 */
export function profileLinkFor(actor: AiActor, employeeId: string): string | null {
  if (employeeId === actor.employeeId) return '/profile';
  if (actor.tier === PermissionTier.FULL && canAccessEmployee(actor, employeeId)) return `/employees/${employeeId}`;
  if (actor.tier === PermissionTier.SUPERVISOR && canAccessEmployee(actor, employeeId)) return `/my-team/${employeeId}`;
  return null;
}

export interface SafeLink {
  path: string;
  label: string;
}

/** Sections of an employee's record HR can be sent straight to (EmployeeDetailPage). */
export const EMPLOYEE_TABS = [
  'overview', 'personal', 'contact', 'employment', 'schedule', 'attendance', 'education', 'government',
  'emergency', 'documents', 'timeline', 'leave-balances', 'compliance', 'evaluations', 'training',
] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isUuid = (v: string) => UUID.test(v);
type QueryRule = Record<string, (v: string) => boolean>;

/**
 * The query parameters each page understands, and what a value must look like.
 * Anything else is dropped — a link can open a record or a filter, never inject.
 */
const QUERY_RULES: Array<{ path: RegExp; tiers: TierSet; params: QueryRule }> = [
  { path: /^\/employees\/[0-9a-f-]{36}$/i, tiers: HR, params: { tab: (v) => (EMPLOYEE_TABS as readonly string[]).includes(v) } },
  {
    path: /^\/employees$/,
    tiers: HR,
    params: { jobRoleId: isUuid, unitId: isUuid, departmentId: isUuid, hireDateFrom: (v) => DATE.test(v), hireDateTo: (v) => DATE.test(v) },
  },
  { path: /^\/compliance$/, tiers: HR, params: { employee: isUuid, requirement: isUuid } },
  { path: /^\/training$/, tiers: ALL, params: { activity: isUuid } },
  { path: /^\/profile$/, tiers: ALL, params: { section: (v) => /^[a-z-]{2,30}$/.test(v) } },
];

/** Keeps only the query parameters the target page understands, with valid values. */
function safeQuery(actor: AiActor, path: string, query: string): string {
  if (!query) return '';
  const rule = QUERY_RULES.find((r) => r.path.test(path) && r.tiers.includes(actor.tier));
  if (!rule) return '';
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(query)) {
    if (rule.params[k]?.(v) && !kept.has(k)) kept.set(k, v);
  }
  const out = kept.toString();
  return out ? `?${out}` : '';
}

/** Returns the link if this actor may be sent there, otherwise null. */
export function validateLink(actor: AiActor, raw: { path?: unknown; label?: unknown }): SafeLink | null {
  if (typeof raw.path !== 'string' || typeof raw.label !== 'string') return null;
  const [rawPath, ...rest] = raw.path.trim().split('?');
  const query = rest.join('?').split('#')[0];
  const path = rawPath;
  const label = raw.label.replace(/[<>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!label) return null;
  // Internal absolute paths only: no scheme, no protocol-relative, no fragment, no traversal.
  // A query string is allowed only in the forms QUERY_RULES lists (see safeQuery).
  if (!/^\/[a-z0-9\-/]*$/i.test(path) || path.startsWith('//') || path.includes('..')) return null;
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const withQuery = (p: string) => ({ path: `${p}${safeQuery(actor, p, query)}`, label });

  const page = APP_PAGES.find((p) => p.path === clean);
  if (page) return page.tiers.includes(actor.tier) ? withQuery(clean) : null;

  const guide = /^\/help-center\/([a-z0-9-]+)$/.exec(clean);
  if (guide && SLUG.test(guide[1])) return guideVisibleTo(guide[1], actor.tier) ? { path: clean, label } : null;

  // A person's page is always sent as the screen this user opens it on.
  const profile = /^\/(?:employees|my-team)\/([0-9a-f-]{36})$/i.exec(clean);
  if (profile && UUID.test(profile[1])) {
    const link = profileLinkFor(actor, profile[1]);
    return link ? withQuery(link) : null;
  }

  // One job opening or one application (HR — recruitment pages are HR-only).
  const recruitment = /^\/recruitment\/(openings|applicants)\/([0-9a-f-]{36})$/i.exec(clean);
  if (recruitment && UUID.test(recruitment[2])) return actor.tier === PermissionTier.FULL ? { path: clean, label } : null;

  return null;
}
