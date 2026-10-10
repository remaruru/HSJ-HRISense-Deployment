# HRISense — Remaining Work Checklist
**Last updated**: 2026-07-17 18:27

---

## 🔴 PRIORITY 1 — Wire Frontend to Real API
> Pages exist but still use hardcoded mock data. Replace with live API calls.

- [ ] `EmployeesPage.tsx` — fetch from `GET /api/v1/employees` (HR) or `/me` (others)
- [ ] `LeavePage.tsx` — fetch from `GET /api/v1/leave` + `GET /api/v1/leave/balances`
- [ ] `AttendancePage.tsx` — fetch from `GET /api/v1/attendance` + `/logs`
- [ ] `AIPage.tsx` — fetch from `GET /api/v1/ai/insights` (currently hardcoded cards)
- [ ] `HRDashboard.tsx` — fetch from `GET /api/v1/dashboard/stats`
- [ ] `SupervisorDashboard.tsx` — fetch from `GET /api/v1/dashboard/stats`
- [ ] `EmployeeDashboard.tsx` — fetch from `GET /api/v1/dashboard/stats`
- [ ] `LoginPage.tsx` — verify auth flow end-to-end (token storage, redirect to `/dashboard`)

---

## 🔴 PRIORITY 2 — Missing Frontend Pages
> These pages have routes registered in `routeTree.tsx` but no page file exists.

- [ ] `pages/Announcements/AnnouncementsPage.tsx` — list + view + create (HR only)
- [ ] `pages/Performance/PerformancePage.tsx` — evaluation list + form
- [ ] `pages/Reports/ReportsPage.tsx` — HR-only analytics + export
- [ ] `pages/Compliance/CompliancePage.tsx` — compliance items + status tracking

---

## 🔴 PRIORITY 3 — Frontend Stub Pages (Need Full UI)
> Files exist but are placeholder stubs (< 2KB, no real content).

- [ ] `pages/Payroll/PayrollPage.tsx` — payslip viewer, list by period, download
- [ ] `pages/Training/TrainingPage.tsx` — training list, enroll button, attendance record
- [ ] `pages/Settings/SettingsPage.tsx` — system settings (HR only), profile settings (all)

---

## 🟡 PRIORITY 4 — Missing UI Components
> Required by the pages above. None of these exist yet.

- [ ] `components/ui/Modal.tsx` — generic modal/dialog wrapper (used by leave form, add employee, etc.)
- [ ] `components/ui/DataTable.tsx` — sortable, paginated table (used by employee list, attendance, leave list)
- [ ] `components/ui/FileUpload.tsx` — drag-and-drop upload (used by documents, excuse slips, psychological attachments)
- [ ] `components/ui/Select.tsx` — styled dropdown (used by forms — unit, job role, leave type)
- [ ] `components/ui/DatePicker.tsx` — date input (used by leave form, attendance filter)
- [ ] `components/charts/AreaChart.tsx` — attendance trend (HR dashboard)
- [ ] `components/charts/DonutChart.tsx` — leave distribution (HR dashboard)
- [ ] `components/charts/BarChart.tsx` — unit headcount (HR dashboard)

---

## 🟡 PRIORITY 5 — Missing Backend Routes
> Backend API layer. Services/controllers still need to be built for these.

- [ ] `performance.service.ts` + `performance.controller.ts` + `performance.routes.ts`
  - `GET /api/v1/performance` — list evaluations
  - `POST /api/v1/performance` — create evaluation (HR only)
  - `GET /api/v1/performance/:id`
- [ ] `compliance.service.ts` + `compliance.controller.ts` + `compliance.routes.ts`
  - `GET /api/v1/compliance` — list compliance items (HR only)
  - `POST /api/v1/compliance` — create item
  - `PATCH /api/v1/compliance/:id` — update status
- [ ] `audit.routes.ts`
  - `GET /api/v1/audit-logs` — paginated audit log (HR only)
- [ ] `reports.routes.ts`
  - `GET /api/v1/reports/attendance-summary`
  - `GET /api/v1/reports/leave-summary`
  - `GET /api/v1/reports/headcount`
  - `GET /api/v1/reports/export` — CSV/PDF generation

---

## 🟡 PRIORITY 6 — AI Integration Layer
> The entire `apps/api/src/ai/` folder is missing.

- [ ] `ai/interfaces/AIProvider.ts` — common interface all providers implement
- [ ] `ai/providers/openai.provider.ts` — OpenAI SDK implementation
- [ ] `ai/ai.factory.ts` — reads `AI_PROVIDER` env var, returns correct provider
- [ ] `ai/services/workforce.service.ts` — workforce trend analysis prompts
- [ ] `ai/services/compliance.service.ts` — compliance risk scoring
- [ ] `ai/services/attendance.service.ts` — anomaly detection
- [ ] `ai/services/recommendation.service.ts` — HR action recommendations
- [ ] `ai/services/nlq.service.ts` — natural language HR queries
- [ ] `ai.controller.ts` + `ai.routes.ts` — `GET /ai/insights`, `POST /ai/query`

---

## 🟡 PRIORITY 7 — Auth & RBAC Completion
> Minor gaps in the auth/permission flow.

- [ ] Verify `AuthProvider.tsx` correctly stores tokens in `localStorage` / `sessionStorage`
- [ ] Verify `api.ts` refresh interceptor works (auto-refresh on 401)
- [ ] Add route guards in `routeTree.tsx` — redirect to `/login` if not authenticated
- [ ] Add permission guards — redirect/403 if user tries to access restricted page
- [ ] User Management page (HR only) — create user accounts, reset passwords, toggle active status
- [ ] `GET /api/v1/users` + `PATCH /api/v1/users/:id` — user management API

---

## 🟢 PRIORITY 8 — Employee Profile Detail Page
> Currently the employee list exists but clicking an employee has no detail view.

- [ ] `pages/Employees/EmployeeDetailPage.tsx` — full profile view
  - Personal info, contact, government IDs
  - Employment history
  - Leave balance summary
  - Attendance summary
  - Training history
  - Documents tab
  - Psychological record (HR only)

---

## 🟢 PRIORITY 9 — Polish & Production Readiness

- [ ] `components/ui/EmptyState.tsx` — empty state illustrations for tables/lists
- [ ] `components/ui/ErrorBoundary.tsx` — React error boundary
- [ ] Add skeleton loading states to all data-fetching pages
- [ ] Responsive layout testing — mobile/tablet breakpoints
- [ ] Accessibility (a11y) audit — keyboard nav, ARIA labels, focus management
- [ ] Toast notifications wired for all actions (leave filed, approved, etc.)
- [ ] `OPENAI_API_KEY` configured in `.env` for AI features to work

---

## 📊 Progress Snapshot

| Layer | Done | Remaining | % |
|-------|------|-----------|---|
| Database (schema + seed) | ✅ | — | 100% |
| Auth backend | ✅ | — | 100% |
| Core API routes | ✅ 9/13 | 4 missing | 69% |
| AI backend | ❌ | All | 0% |
| UI components | ✅ 4/12 | 8 missing | 33% |
| Layout components | ✅ 3/3 | — | 100% |
| Frontend pages (full) | ✅ 5/15 | 10 remaining | 33% |
| API wiring (mock→real) | ❌ | 8 pages | 0% |
| Auth flow (end-to-end) | ⚠️ | Needs testing | ~80% |
| **Overall** | | | **~52%** |
