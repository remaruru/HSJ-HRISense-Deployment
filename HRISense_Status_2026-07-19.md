# HRISense — Precise Project Status
**Date**: 2026-07-19
**Organization**: Hospicio de San Jose (HSJ)
**Repo**: https://github.com/remaruru/HRISense
**Stack**: Monorepo — `apps/api` (Node/Express/TypeScript/Prisma/MySQL) + `apps/web` (React/Vite/TypeScript) + `packages/shared`

---

## Monorepo Root

| File | Notes |
|---|---|
| `package.json` | Workspace root — references `apps/*` and `packages/*` |
| `package-lock.json` | Lockfile |
| `.gitignore` | Ignores `node_modules`, `dist`, `.env`, `.next`, `coverage`, `build` |
| `PROGRESS.md` | High-level progress log (55% overall, laptop-authored) |
| `REMAINING_CHECKLIST.md` | Prioritized TODO list (laptop-authored) |
| `implementation_planv2.md` | 1,369-line detailed design doc (laptop-authored) |
| `ANTIGRAVITY_MEMORY.md` | AI memory handoff file (desktop-authored) |
| `JOB ROLES.xlsx` | Source of truth — 58 exact job roles and 7 units for Hospicio de San Jose |

---

## `apps/api` — Backend

### Entry Point
- **`src/index.ts`** — Express app setup. Has: `helmet`, `cors`, `express-rate-limit` (200 req/15 min), JSON body parsing (10MB limit), health check at `GET /health`, mounts all routes at `/api/v1`, global error handler.

### Config (`src/config/`)
| File | What it does |
|---|---|
| `env.ts` | Loads and validates environment variables |
| `prisma.ts` | Exports the PrismaClient singleton |

### Lib (`src/lib/`)
| File | What it does |
|---|---|
| `jwt.ts` | Signs and verifies JWT access tokens (15 min) and refresh tokens (7 days) |
| `password.ts` | bcrypt hash and compare helpers |
| `audit.ts` | Creates `AuditLog` entries — called by controllers after mutations |

### Middleware (`src/middleware/`)
| File | What it does |
|---|---|
| `authenticate.ts` | Verifies JWT from `Authorization: Bearer` header, attaches `req.user` |
| `authorize.ts` | RBAC tier checks — compares `req.user.permissionTier` against required tiers (FULL / SUPERVISOR / STANDARD). Also handles scope-based access (own vs. subordinates vs. all) |
| `errorHandler.ts` | Global Express error handler — formats error responses as `{ success: false, error }` |
| `validate.ts` | Zod schema validation middleware for request bodies |

### Controllers (`src/controllers/`) — 7 files
| File | Endpoints it handles |
|---|---|
| `auth.controller.ts` | login, refresh, logout, me |
| `employee.controller.ts` | list, get one, create, update, soft-delete, photo upload |
| `attendance.controller.ts` | list records, get logs, create/update record |
| `leave.controller.ts` | list, get one, file leave, approve, reject, get balances |
| `payslip.controller.ts` | list own payslips, list all (HR), get one, release |
| `training.controller.ts` | list trainings, get one, create, enroll, mark attendance |
| `dashboard.controller.ts` | aggregated stats for dashboard |

### Services (`src/services/`) — 7 files
| File | Size | Responsibility |
|---|---|---|
| `auth.service.ts` | 9.5 KB | Login (with lockout), refresh, logout, me — full session management |
| `employee.service.ts` | 10.8 KB | Full employee CRUD, supervision links, filtering by unit/role/status |
| `leave.service.ts` | 7.7 KB | File leave, approve/reject (with balance deduction), balance queries |
| `dashboard.service.ts` | 7.6 KB | Aggregates headcount, leave stats, attendance stats, training stats per user tier |
| `attendance.service.ts` | 6.0 KB | Attendance records + logs CRUD, summary queries |
| `training.service.ts` | 4.8 KB | Training CRUD, enrollment, attendance marking |
| `payslip.service.ts` | 4.5 KB | Payslip queries (own/all), release payslip |

### Routes (`src/routes/`) — 10 files
| File | Mounted at | Status |
|---|---|---|
| `index.ts` | `/api/v1` | Registers all sub-routers |
| `auth.routes.ts` | `/auth` | ✅ login, refresh, logout, me |
| `employee.routes.ts` | `/employees` | ✅ CRUD + photo |
| `attendance.routes.ts` | `/attendance` | ✅ records + logs |
| `leave.routes.ts` | `/leave` | ✅ file + approve/reject + balances |
| `payslip.routes.ts` | `/payslips` | ✅ own + all + release |
| `training.routes.ts` | `/training` | ✅ list + enroll + attendance |
| `dashboard.routes.ts` | `/dashboard` | ✅ stats |
| `announcement.routes.ts` | `/announcements` | ✅ CRUD + audience filtering (inline handlers, no separate controller) |
| `notification.routes.ts` | `/notifications` | ✅ list + mark-read (inline handlers) |

### Database (`prisma/`)
| File | Notes |
|---|---|
| `schema.prisma` | **936 lines** — full schema v2 |
| `seed.ts` | Seeds 7 units + 58 job roles from the HSJ spreadsheet |
| `migrations/20260717092607_init/migration.sql` | Initial migration, applied |

**Schema models (22+)**:
`Unit`, `JobRole`, `Permission`, `RolePermission`, `User`, `UserSession`, `PasswordResetToken`, `EmailVerificationToken`, `Employee`, `SupervisionLink`, `AttendanceRecord`, `AttendanceLog`, `LeaveBalance`, `LeaveRequest`, `PerformanceEvaluation`, `Training`, `TrainingAttendee`, `ActivityAttendance`, `ComplianceRequirement`, `ComplianceDocument`, `MedicalRecord`, `PsychologicalRecord`, `Payslip`, `EmployeeDocument`, `UploadedFile`, `Announcement`, `AnnouncementAttachment`, `Notification`, `AuditLog`, `ActivityLog`, `AIInsight`, `AIRequest`

**Enums**: `PermissionTier` (FULL/SUPERVISOR/STANDARD), `EmploymentStatus`, `EmploymentType`, `Gender`, `CivilStatus`, `AttendanceStatus`, `LeaveType`, `LeaveStatus`, `EvaluationStatus`, `TrainingStatus`, `ComplianceStatus`, `ComplianceCategory`, `AnnouncementPriority`, `AnnouncementAudience`, `NotificationType`, `AIInsightType`, `AIRequestStatus`

### Types (`src/types/`)
- `express.d.ts` — Augments `express.Request` to include `req.user` with employee + jobRole + permissionTier

---

## `apps/web` — Frontend

### Root Files
| File | Notes |
|---|---|
| `index.html` | Vite HTML entry — sets `<title>HRISense</title>` |
| `vite.config.ts` | Vite config |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | TypeScript config |
| `src/main.tsx` | React root — wraps app in `AuthProvider` + router |
| `src/routeTree.tsx` | **All routes registered** — maps every path to its page component |
| `src/index.css` | **15.5 KB** — full design system: CSS custom properties, glassmorphism tokens, color palette, animation utilities, typography (Inter/Outfit from Google Fonts) |
| `src/vite-env.d.ts` | Vite type declarations |

### Layout Components (`src/components/layout/`)
| File | Size | What it does |
|---|---|---|
| `AppShell.tsx` | 3.9 KB | Wrapper that combines Sidebar + TopNav + page content area |
| `Sidebar.tsx` | 18 KB | Full sidebar with role-filtered navigation (HR sees all, Supervisor sees subset, Standard sees own). Has collapse/expand, active state. |
| `TopNav.tsx` | 10.7 KB | Top header bar with user avatar, notification bell, breadcrumbs, logout |

### Shared Components (`src/components/shared/`)
| File | Size | What it does |
|---|---|---|
| `MetricCard.tsx` | 5.9 KB | Reusable dashboard metric card — title, value, trend, icon, glassmorphism style |

### UI Components (`src/components/ui/`)
| File | Size | Notes |
|---|---|---|
| `button.tsx` | 4.2 KB | Styled button with variants (primary, secondary, ghost, danger) and sizes |
| `skeleton.tsx` | 4.2 KB | Loading skeleton component — used on data-loading pages |
| `avatar.tsx` | 2.2 KB | User avatar with fallback initials |
| `badge.tsx` | 2.5 KB | Status badges with color variants |

### Hooks (`src/hooks/`)
| File | What it does |
|---|---|
| `useAuth.ts` | Reads auth state from `AuthProvider` context |
| `usePermission.ts` | Helper to check if current user has a specific permission tier or module access |

### Services (`src/services/`)
| File | Size | What it does |
|---|---|---|
| `api.ts` | 3.2 KB | Axios instance pre-configured with base URL, `Authorization` header injection, and **401 interceptor** (auto-refresh token logic) |
| `auth.service.ts` | 1.9 KB | `login()`, `logout()`, `refreshToken()`, `getMe()` — wraps `api.ts` calls |

### Providers (`src/providers/`)
| File | What it does |
|---|---|
| `AuthProvider.tsx` | React context — stores `user`, `token`, `isAuthenticated`. Exposes `login()`, `logout()` actions. |

### Lib (`src/lib/`)
| File | What it does |
|---|---|
| `utils.ts` | `cn()` utility (className merging with clsx/tailwind-merge) |
| `motion.ts` | Shared Framer Motion animation variants (fade, slide, scale) |

### Pages (`src/pages/`)

| Page File | Size | Status | Data |
|---|---|---|---|
| `Landing/LandingPage.tsx` | 44 KB | ✅ **Production-ready** | Static — hero, features, stats, testimonials, CTA, all animated |
| `Landing/AnimatedDashboardMockup.tsx` | 10.8 KB | ✅ Complete | SVG animation shown on landing page |
| `Landing/CountUp.tsx` | 1.5 KB | ✅ Complete | Animated number counter component |
| `Auth/LoginPage.tsx` | 10.4 KB | ✅ Full UI | Auth service wired — **needs e2e test** |
| `Dashboard/DashboardPage.tsx` | 0.5 KB | ✅ Router only | Reads user role → renders correct dashboard below |
| `Dashboard/HRDashboard.tsx` | 13.4 KB | ✅ Full UI | **Mock data** — not wired to `/dashboard/stats` |
| `Dashboard/SupervisorDashboard.tsx` | 9.2 KB | ✅ Full UI | **Mock data** |
| `Dashboard/EmployeeDashboard.tsx` | 8.6 KB | ✅ Full UI | **Mock data** |
| `Employees/EmployeesPage.tsx` | 9.8 KB | ✅ Full UI | **Mock data** — not wired to `/employees` |
| `AI/AIPage.tsx` | 9.2 KB | ✅ Full UI | **Hardcoded cards** — AI backend doesn't exist yet |
| `Leave/LeavePage.tsx` | 6.4 KB | ⚠️ Partial | **Mock data** — has leave list + balance display, no file form |
| `Attendance/AttendancePage.tsx` | 4.7 KB | ⚠️ Partial | **Mock data** — basic table, no log detail |
| `Reports/ReportsPage.tsx` | 3.7 KB | ⚠️ Partial stub | Basic UI shell, no real data |
| `Compliance/CompliancePage.tsx` | 3.5 KB | ⚠️ Partial stub | Basic UI shell, no real data |
| `Announcements/AnnouncementsPage.tsx` | 2.1 KB | ⚠️ Stub | Near-empty placeholder |
| `Payroll/PayrollPage.tsx` | 1.7 KB | ❌ Stub | Placeholder only |
| `Training/TrainingPage.tsx` | 1.4 KB | ❌ Stub | Placeholder only |
| `Settings/SettingsPage.tsx` | 1.0 KB | ❌ Stub | Placeholder only |
| `Performance/PerformancePage.tsx` | 0.8 KB | ❌ Stub | Placeholder only |

---

## `packages/shared`

| File | Notes |
|---|---|
| `package.json` | Shared package config |
| `src/index.ts` | Shared types/utilities (minimal — not heavily used yet) |

---

## Overall Progress

| Layer | % Done | Notes |
|---|---|---|
| Database schema + migrations | 100% | All 22+ models, all enums, migrated |
| Seed data (7 units, 58 roles) | 100% | From spreadsheet |
| Auth backend | 100% | Login, refresh, logout, me, lockout |
| RBAC middleware | 100% | Tier-based + scope-based |
| Core API routes | 69% (9/13) | 4 missing: performance, compliance, reports, audit |
| Frontend layout | 100% | AppShell, Sidebar, TopNav |
| Design system (CSS) | 100% | Glassmorphism, tokens, animations |
| Frontend pages (full) | ~35% | 5 production-ready, 4 partial, 6 stubs |
| API wiring (mock→real) | 0% | No page is calling the real API yet |
| Auth flow end-to-end | ~80% | UI done, needs e2e test |
| AI backend | 0% | Not started at all |
| **Overall** | **~55%** | |

---

## What's Still Missing (Prioritized)

### 🔴 Priority 1 — Wire Frontend to Real API
None of the data pages call the real backend yet. All use hardcoded arrays.
- `EmployeesPage.tsx` → `GET /api/v1/employees`
- `LeavePage.tsx` → `GET /api/v1/leave` + `GET /api/v1/leave/balances`
- `AttendancePage.tsx` → `GET /api/v1/attendance`
- `HRDashboard.tsx`, `SupervisorDashboard.tsx`, `EmployeeDashboard.tsx` → `GET /api/v1/dashboard/stats`
- `LoginPage.tsx` → end-to-end auth test (token storage, redirect)

### 🔴 Priority 2 — Stub Pages Need Full UI
- `PayrollPage.tsx` — payslip list by period, payslip viewer, download button
- `TrainingPage.tsx` — program list, enroll button, attendance record
- `SettingsPage.tsx` — profile settings (all roles) + system settings (HR only)
- `AnnouncementsPage.tsx` — list + create form (HR only) + detail view
- `PerformancePage.tsx` — evaluation list + form

### 🔴 Priority 3 — Missing Backend Routes (+ service + controller)
- **Performance**: `GET/POST /api/v1/performance`, `GET /api/v1/performance/:id`
- **Compliance**: `GET/POST /api/v1/compliance`, `PATCH /api/v1/compliance/:id`
- **Audit Logs**: `GET /api/v1/audit-logs` (HR only, paginated)
- **Reports**: `GET /api/v1/reports/attendance-summary`, `/leave-summary`, `/headcount`, `/export` (CSV/PDF)

### 🟡 Priority 4 — Missing UI Components (none of these exist yet)
- `components/ui/Modal.tsx` — generic dialog wrapper
- `components/ui/DataTable.tsx` — sortable + paginated table
- `components/ui/FileUpload.tsx` — drag-and-drop upload
- `components/ui/Select.tsx` — styled dropdown
- `components/ui/DatePicker.tsx` — date input
- `components/charts/AreaChart.tsx` — attendance trend
- `components/charts/DonutChart.tsx` — leave distribution
- `components/charts/BarChart.tsx` — unit headcount

### 🟡 Priority 5 — AI Layer (entire folder missing)
Path: `apps/api/src/ai/` — does not exist.
- `interfaces/AIProvider.ts`
- `providers/openai.provider.ts`
- `ai.factory.ts`
- `services/workforce.service.ts`, `compliance.service.ts`, `attendance.service.ts`, `recommendation.service.ts`, `nlq.service.ts`
- `ai.controller.ts` + `ai.routes.ts` → `GET /ai/insights`, `POST /ai/query`

### 🟡 Priority 6 — Auth/RBAC Gaps
- Verify `AuthProvider.tsx` stores tokens correctly (localStorage vs sessionStorage)
- Verify `api.ts` 401 interceptor correctly fires and retries with new token
- Route guards in `routeTree.tsx` — redirect to `/login` if not authenticated
- Permission guards — show 403 or redirect if tier insufficient
- **User Management page** (HR only) — create accounts, reset passwords, deactivate
- `GET /api/v1/users` + `PATCH /api/v1/users/:id`

### 🟢 Priority 7 — Employee Detail Page (doesn't exist)
- `pages/Employees/EmployeeDetailPage.tsx`
  - Tabs: Personal Info, Employment, Leave Balances, Attendance, Training, Documents, Psychological (HR only)

### 🟢 Priority 8 — Polish
- `components/ui/EmptyState.tsx`
- `components/ui/ErrorBoundary.tsx`
- Skeleton loading states on all data pages
- Responsive layout (mobile/tablet)
- Accessibility (ARIA, keyboard nav, focus management)
- Toast notifications for all actions
