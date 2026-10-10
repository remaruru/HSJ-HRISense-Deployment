# HRISense — Progress Summary
**Organization**: Hospicio de San Jose (HSJ)
**Last updated**: 2026-07-19
**Overall completion**: ~55%

---

## ✅ What's Done

### 🗄️ Database Layer — 100%
The Prisma schema is fully designed and migrated.

- Complete schema covering all 22+ models aligned with the HSJ Job Roles spreadsheet
- All enums defined: `PermissionTier` (FULL / SUPERVISOR / STANDARD), `LeaveType`, `AttendanceStatus`, `ComplianceStatus`, `NotificationType`, `AIInsightType`, and more
- Normalized RBAC: `JobRole` → `RolePermission` → `Permission` (module + action + scope)
- `SupervisionLink` model: tracks supervisor→subordinate relationships for the 'UNDER HER SUPERVISION' permission scope
- All 7 HSJ units seeded: Administrative Services, Finance, General Support Services, Auxiliary Services, Social Services, Pastoral Care/Homelife, Health Services
- 58 exact job roles from the spreadsheet seeded with correct `PermissionTier` assignments
- Migrations generated and applied via `prisma migrate dev`

---

### 🔐 Auth Backend — 100%
Full JWT-based auth with refresh tokens.

- `POST /api/v1/auth/login` — email/password login → returns accessToken + refreshToken
- `POST /api/v1/auth/refresh` — rotates refresh token, issues new access token
- `POST /api/v1/auth/logout` — revokes session
- `GET /api/v1/auth/me` — returns authenticated user + employee + job role + permission tier
- JWT access token (15 min) + refresh token (7 days) stored in `UserSession`
- Failed login attempt tracking + account lockout
- Middleware: `authenticate.ts` (validates JWT), `authorize.ts` (RBAC tier checks)

---

### 🌐 API Routes — 69% (9/13 route groups done)

| Route Group | File | Status |
|---|---|---|
| Auth | auth.routes.ts | ✅ Done |
| Dashboard | dashboard.routes.ts | ✅ Done |
| Employees | employee.routes.ts | ✅ Done |
| Leave | leave.routes.ts | ✅ Done |
| Attendance | attendance.routes.ts | ✅ Done |
| Payslip | payslip.routes.ts | ✅ Done |
| Training | training.routes.ts | ✅ Done |
| Announcements | announcement.routes.ts | ✅ Done |
| Notifications | notification.routes.ts | ✅ Done |
| Performance | — | ❌ Missing |
| Compliance | — | ❌ Missing |
| Reports | — | ❌ Missing |
| Audit Logs | — | ❌ Missing |

Completed endpoints include: full CRUD for employees, leave filing + HR approval, attendance records + logs, payslips (own/all), training enrollment, announcements (HR creates), notifications, dashboard stats.

---

### 🎨 Frontend — Layout & Core — 100%

- AppShell: sidebar + header layout wrapper
- Sidebar: role-filtered navigation (HR sees all, Supervisor sees subset, Standard sees own)
- Header: user avatar, notifications bell, logout
- AuthProvider: React context for auth state
- ProtectedRoute: wrapper for authenticated routes
- Route tree: all routes registered and mapped to pages
- Design system (index.css): CSS custom properties, glassmorphism tokens, color palette, animation utilities
- Landing page (LandingPage.tsx): full hero + features + stats + testimonials + CTA (44KB, fully animated)
- Animated dashboard mockup: live SVG animation on landing page

---

### 📄 Frontend Pages Status

| Page | File | Size | Status |
|---|---|---|---|
| Landing | LandingPage.tsx | 44KB | ✅ Full — production-ready |
| Login | LoginPage.tsx | 10KB | ✅ Full UI — needs e2e test |
| HR Dashboard | HRDashboard.tsx | 13KB | ✅ Full UI — mock data |
| Supervisor Dashboard | SupervisorDashboard.tsx | 9KB | ✅ Full UI — mock data |
| Employee Dashboard | EmployeeDashboard.tsx | 8KB | ✅ Full UI — mock data |
| Employees List | EmployeesPage.tsx | 10KB | ✅ Full UI — mock data |
| AI Insights | AIPage.tsx | 9KB | ✅ Full UI — hardcoded, needs AI backend |
| Leave | LeavePage.tsx | 6KB | ⚠️ Partial — mock data |
| Attendance | AttendancePage.tsx | 4KB | ⚠️ Partial — mock data |
| Reports | ReportsPage.tsx | 3KB | ⚠️ Partial stub |
| Compliance | CompliancePage.tsx | 3KB | ⚠️ Partial stub |
| Announcements | AnnouncementsPage.tsx | 2KB | ⚠️ Stub |
| Payroll | PayrollPage.tsx | 1KB | ❌ Stub only |
| Training | TrainingPage.tsx | 1KB | ❌ Stub only |
| Settings | SettingsPage.tsx | 1KB | ❌ Stub only |
| Performance | PerformancePage.tsx | 0.8KB | ❌ Stub only |
| Employee Detail | — | — | ❌ Missing entirely |

---

## ❌ What's Still Missing

### 🔴 PRIORITY 1 — Wire Frontend to Real API
All data-heavy pages use hardcoded mock data. None connected to the live backend yet.

- [ ] EmployeesPage.tsx → GET /api/v1/employees
- [ ] LeavePage.tsx → GET /api/v1/leave + balances
- [ ] AttendancePage.tsx → GET /api/v1/attendance + logs
- [ ] HRDashboard.tsx → GET /api/v1/dashboard/stats
- [ ] SupervisorDashboard.tsx → same
- [ ] EmployeeDashboard.tsx → same
- [ ] AIPage.tsx → GET /api/v1/ai/insights (once AI backend exists)
- [ ] LoginPage.tsx → end-to-end auth flow test

---

### 🔴 PRIORITY 2 — Stub Pages Need Full UI

- [ ] PayrollPage.tsx — payslip viewer, period selector, download button
- [ ] TrainingPage.tsx — program list, enrollment, attendance record
- [ ] SettingsPage.tsx — profile settings (all), system settings (HR only)
- [ ] AnnouncementsPage.tsx — list + create (HR only) + view detail

---

### 🔴 PRIORITY 3 — Missing Backend Routes

- [ ] performance.service.ts + performance.controller.ts + performance.routes.ts
  - GET /api/v1/performance, POST /api/v1/performance, GET /api/v1/performance/:id
- [ ] compliance.service.ts + compliance.controller.ts + compliance.routes.ts
  - GET/POST /api/v1/compliance, PATCH /api/v1/compliance/:id
- [ ] reports.routes.ts
  - GET /api/v1/reports/attendance-summary
  - GET /api/v1/reports/leave-summary
  - GET /api/v1/reports/headcount
  - GET /api/v1/reports/export (CSV/PDF)
- [ ] audit.routes.ts
  - GET /api/v1/audit-logs (HR only, paginated)

---

### 🟡 PRIORITY 4 — Missing Reusable UI Components

- [ ] components/ui/Modal.tsx — dialog wrapper
- [ ] components/ui/DataTable.tsx — sortable + paginated table
- [ ] components/ui/FileUpload.tsx — drag-and-drop upload
- [ ] components/ui/Select.tsx — styled dropdown
- [ ] components/ui/DatePicker.tsx — date input
- [ ] components/charts/AreaChart.tsx — attendance trend
- [ ] components/charts/DonutChart.tsx — leave distribution
- [ ] components/charts/BarChart.tsx — unit headcount

---

### 🟡 PRIORITY 5 — AI Backend (Entire Layer Missing)

The apps/api/src/ai/ folder doesn't exist at all.

- [ ] ai/interfaces/AIProvider.ts — common interface
- [ ] ai/providers/openai.provider.ts — OpenAI SDK
- [ ] ai/ai.factory.ts — reads AI_PROVIDER env var
- [ ] ai/services/workforce.service.ts — workforce trend analysis
- [ ] ai/services/compliance.service.ts — compliance risk scoring
- [ ] ai/services/attendance.service.ts — anomaly detection
- [ ] ai/services/recommendation.service.ts — HR action recommendations
- [ ] ai/services/nlq.service.ts — natural language HR queries
- [ ] ai.controller.ts + ai.routes.ts

---

### 🟡 PRIORITY 6 — Auth & RBAC Gaps

- [ ] Verify AuthProvider.tsx token storage (localStorage / sessionStorage)
- [ ] Verify auto-refresh on 401 (interceptor in api.ts)
- [ ] Add route guards in routeTree.tsx (redirect → /login if unauthenticated)
- [ ] Add permission guards (redirect / show 403 if insufficient tier)
- [ ] User Management page (HR only) — create/reset/deactivate accounts
- [ ] GET /api/v1/users + PATCH /api/v1/users/:id

---

### 🟢 PRIORITY 7 — Employee Detail Page

- [ ] pages/Employees/EmployeeDetailPage.tsx
  - Personal info, contact, government IDs
  - Employment history
  - Leave balance summary
  - Attendance summary
  - Training history
  - Documents tab
  - Psychological record (HR only)

---

### 🟢 PRIORITY 8 — Polish & Production

- [ ] components/ui/EmptyState.tsx
- [ ] components/ui/ErrorBoundary.tsx
- [ ] Skeleton loading states on all data-fetching pages
- [ ] Responsive layout (mobile/tablet breakpoints)
- [ ] Accessibility audit (keyboard nav, ARIA, focus management)
- [ ] Toast notifications wired for all actions
- [ ] OPENAI_API_KEY in .env for AI features

---

## 📊 Progress Snapshot

| Layer | Status | % |
|---|---|---|
| Database schema + migrations | ✅ Complete | 100% |
| Seed data (units + 58 roles) | ✅ Complete | 100% |
| Auth backend | ✅ Complete | 100% |
| RBAC middleware | ✅ Complete | 100% |
| Core API routes | ✅ 9/13 groups | 69% |
| AI backend | ❌ Not started | 0% |
| Reusable UI components | ⚠️ 4/12 | 33% |
| Layout components | ✅ Complete | 100% |
| Frontend pages (full) | ⚠️ 5/17 full | 29% |
| API wiring (mock→real) | ❌ 0/8 pages | 0% |
| Auth flow end-to-end | ⚠️ Needs testing | ~80% |
| **Overall** | | **~55%** |
