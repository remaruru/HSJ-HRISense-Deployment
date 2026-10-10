# HSJ HRISense — Fix-All Execution Report

> **Scope:** every locally-fixable finding in `docs/CLAUDE_HRISENSE_MASTER_SYSTEM_REVIEW.md`.
> **Repository:** `C:\xampp\htdocs\HRISense`
> **Starting HEAD:** `7648345b4c08ec74387ee2b8f67136395c5549b8` (`main`) — **unchanged; no commits were made.**
> **Executed:** 2026-09-01 → 2026-09-02
> **Git operations performed:** none beyond read-only inspection.
> **Database:** never modified. No migration was created or applied. `mysqld` was not running.
> **Testing:** no browser, no Playwright/Cypress, no screenshots, no live emails, no paid AI calls.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| **FIXED** | Repaired in source. Build-verified. Awaiting your manual test. |
| **RETRACTED** | The review finding was wrong. Evidence given; no change made. |
| **INTENTIONALLY DEFERRED — EXTERNAL INPUT REQUIRED** | Blocked on something only Hospicio de San Jose can supply. |
| **EXTERNAL REMOTE ACTION REQUIRED** | Blocked on GitHub/provider actions that were explicitly frozen. |

---

## 1. Findings table

| ID | Original problem | Sev. | Files changed | Resolution | Validation | Status |
|---|---|---|---|---|---|---|
| **R-05** | Employee creation broken end-to-end: multipart body unparsed, `employeeNumber` never collected or generated, no `User`/temp password/welcome email, yet the UI claimed the account was created | CRITICAL | `middleware/upload.ts`*, `lib/employeeNumber.ts`*, `routes/employee.routes.ts`, `controllers/employee.controller.ts`, `services/employee.service.ts`, `EmployeeOnboardingPage.tsx` | Multer added with the exact frontend field names; collision-safe `HSJ-XXXX` generator; ONE transaction creating Employee + User + documents + audit; crypto temp password returned once; orphaned-file cleanup on failure. **Also found and fixed a second root cause the review missed:** wizard Step 1 rendered a duplicate of the Document Uploads step, so `workEmail`/`mobilePhone`/`presentAddress` were never collected — all are NOT NULL. | API + web build | **FIXED** |
| **S-1** | `apps/api/.env` tracked in git with JWT/refresh secrets and provider keys | CRITICAL | `.gitignore`, `apps/api/.env.example`, `docs/EXTERNAL_SECRET_ROTATION_REQUIRED.md`* | Local structure prepared: `.env`, `.env.*`, `.local/`, credential reports and `*.zip` now ignored; complete safe `.env.example` written. **Untracking and key rotation are remote/provider actions and were frozen.** | — | **EXTERNAL REMOTE ACTION REQUIRED** |
| **R-03** | change-password complexity regex `\\d` demanded a literal backslash-d; every ordinary password rejected | HIGH | `lib/password.ts`, `services/auth.service.ts`, `lib/passwordPolicy.ts`*, `ChangePasswordPage.tsx` | Regex removed; `validatePasswordComplexity` uses explicit character-class tests. Client mirrors the same 5 rules with a live checklist. | API + web build | **FIXED** |
| **R-02** | `currentPassword` vs `oldPassword` mismatch meant the current password was never verified | HIGH | `controllers/auth.controller.ts`, `services/auth.service.ts`, `ChangePasswordPage.tsx` | `currentPassword` is canonical (`oldPassword` kept as a legacy alias); it is now **always required and always verified**; new password must differ from current. | API + web build | **FIXED** |
| **R-01** | `getMe` omitted `mustChangePassword`, so a page refresh bypassed the forced first-login change | HIGH | `controllers/auth.controller.ts` | `getMe` returns `mustChangePassword` (and rejects deactivated accounts). | API build | **FIXED** |
| **R-04** | Two unsynchronized supervisor mechanisms; `SupervisionLink` was seed-only but read by half the system | HIGH | `services/org-hierarchy.service.ts`*, attendance/leave/schedule/compliance/document/evaluation services, `schedule.controller.ts` | `Employee.immediateSupervisorId` is canonical. One shared service (`getDirectSubordinateIds`, `getTeamScopeIds`, `isDirectSubordinate`, `getSubordinateTreeIds`, `canAccessEmployeeRecord`, …). **`grep -rn "supervisionLink" apps/api/src` now returns nothing.** Table kept as legacy history. | API build + grep | **FIXED** |
| **S-3** | `GET /employees/:id` had no authorization — any user could read anyone's government IDs, DOB, address | HIGH | `controllers/employee.controller.ts` | Gated by `OrgHierarchyService.canAccessEmployeeRecord` (FULL → all; SUPERVISOR → own branch; STANDARD → self). | API build | **FIXED** |
| **S-4** | Any supervisor could read AND write any employee's weekly schedule | HIGH | `controllers/weekly-schedule.controller.ts` | `assertScheduleAccess` added: supervisors are limited to their own direct reports; they cannot edit their own; STANDARD is read-only self. | API build | **FIXED** |
| **R-06** | All 7 Account Management controls called `/employees/:id/account/*`, which did not exist | HIGH | `controllers/account.controller.ts`*, `services/user.service.ts`, `routes/employee.routes.ts`, `AccountManagementPanel.tsx`, `EmployeesPage.tsx` | Seven real, audited endpoints implemented. Panel rewritten with an in-app confirm dialog (no `alert`/`confirm`/`prompt`) and self-action guards. **"Resend Welcome" removed** — impossible without stored plaintext — and replaced by **"Reset & send new credentials"**, which is what actually happens. `/users` router deleted so there is one account surface. | API + web build | **FIXED** |
| **R-15** | `/ai-assistance` presented fabricated insights, confidence scores and "Analyzing 850 employee records" as live output | HIGH | `services/ai/workforce-facts.service.ts`*, `services/ai/ai.service.ts`*, `routes/ai.routes.ts`*, `AIPage.tsx`, `prisma/seed.ts` | Real AI backend built. Deterministic SQL fact sheet + grounded, advisory-only LLM analysis with a strict system prompt (no attrition prediction, no invented numbers, no payroll, missing records ≠ absence). Page rewritten with zero hardcoded values; when no key is configured it says AI is unavailable and still shows the real figures. `seedAIInsights()` deleted. | API + web build | **FIXED** |
| **S-2** | `.local/` credential reports tracked in git | HIGH | `.gitignore`, rotation doc | Ignored going forward; untracking is a git operation, frozen. | — | **EXTERNAL REMOTE ACTION REQUIRED** |
| **R-13** | Leave approval invented a 15-day entitlement (`totalAllotted: 15`) | MED-HIGH | `services/leave.service.ts`, `controllers/leave.controller.ts`, `routes/leave.routes.ts`, `LeaveBalancePanel.tsx`*, `EmployeeDetailPage.tsx` | Deleted. Approval only updates a balance HR has configured. `PUT /leave/balances` + a Leave Balances profile tab let HR enter entitlements explicitly. No default is assumed anywhere. | API + web build | **FIXED** |
| **R-12** | `LeaveBalance.pending` never incremented on filing but decremented on approval → drifted negative | MEDIUM | `services/leave.service.ts` | `pending` incremented on filing and released on reject/cancel, clamped at zero, all inside transactions. | API build | **FIXED** |
| **R-10 / C-02** | HR Dashboard computed `absentToday = total − present − onLeave`, contradicting the system-wide "no record ≠ absent" rule | MEDIUM | `services/dashboard.service.ts`, `HRDashboard.tsx` | Inference deleted. `absentToday` counts only real `ABSENT` records; `noRecordToday` is reported separately and never folded in. | API + web build | **FIXED** |
| **R-07** | `GET /employees/:id/timeline` did not exist; the Timeline tab was permanently empty | MEDIUM | `routes/employee.routes.ts`, `controllers/employee.controller.ts`, `services/employee.service.ts`, `EmployeeDetailPage.tsx` | Endpoint implemented over `AuditLog` with the same object-level authorization plus metadata redaction. UI renders labelled fields (not a raw JSON dump) and surfaces errors instead of swallowing them. | API + web build | **FIXED** |
| **R-08** | Attendance Tally department filter called `/employees/departments`, not a registered route | MEDIUM | `AttendanceTallyPage.tsx` | Repointed to `GET /departments?unitId=`, which already supported the filter. | web build | **FIXED** |
| **R-14** | Dashboards read the legacy `Training`/`TrainingAttendee` tables | MEDIUM | `services/dashboard.service.ts` | Both HR and employee widgets now read `TrainingActivity`/`TrainingParticipant`. | API build | **FIXED** |
| **S-6** | `Math.random()` temp-password generation | MEDIUM | `services/user.service.ts`, `lib/password.ts` | Single crypto-backed generator; `Math.random` no longer appears in any credential path. | API build + grep | **FIXED** |
| **S-7** | `POST /auth/forgot-password` returned the raw reset token | MEDIUM | `services/auth.service.ts`, `services/email/employee-email.service.ts`, `services/auth.service.ts` (web) | Token removed from the response with no environment exception. `crypto.randomBytes(32)` token now travels only inside the emailed link; response stays enumeration-safe. | API + web build | **FIXED** |
| **S-8** | Seed created a FULL-tier account with the password `"hr"` | MEDIUM | `prisma/seed.ts` | Removed. `SEED_HR_PASSWORD` / `SEED_DEFAULT_PASSWORD`, else a crypto-random password printed once. Console output warns the accounts are local-only. | seed typecheck | **FIXED** |
| **R-09** | Sidebar `/notifications` and `/audit` were dead links | MEDIUM | `routeTree.tsx`, `Sidebar.tsx`, new pages + routes | Both are now real pages. Sidebar badge shows the real unread count (was hardcoded `8`). | web build | **FIXED** |
| **R-11** | Notifications inert — nothing ever created one; TopNav bell was a 4-item mock | MEDIUM | `services/notification.service.ts`*, `routes/notification.routes.ts`, `hooks/useNotifications.ts`*, `NotificationsPage.tsx`*, `TopNav.tsx`, `Sidebar.tsx`, `leave.service.ts`, `recruitment-automatic-communication.service.ts` | Central service + real events (leave filed / endorsed / approved / rejected, failed applicant email). Mock bell deleted. Page with unread filter, mark-read, mark-all-read, pagination, links and an honest empty state. | API + web build | **FIXED** |
| **S-9** | No `trust proxy`; rate limiting skipped entirely in development | MEDIUM | `apps/api/src/index.ts` | Explicit env-driven `TRUST_PROXY` (never blind `true`, which allows IP spoofing). Dev now gets a high ceiling instead of no limiter, so the same code path always runs. Helmet given explicit HSTS/CSP/CORP settings that do not break Vite. | API build | **FIXED** |
| **R-16** | `AUTH_LOGOUT` help guide had `roles: []` → invisible to every role | LOW-MED | `helpCenter.registry.ts` | Roles set to all three tiers. Registry validator now flags an empty `roles` array as a hard error. | web build + grep | **FIXED** |
| **R-17** | `validateHelpRegistry()` asserted stale totals (38/35/18/12 vs 39/36/19/13) | LOW | `helpCenter.search.ts` | Hardcoded totals removed. It now derives counts and only reports genuine defects (duplicate id/slug, empty roles, READY-without-content). | web build | **FIXED** |
| **S-11** | Repo hygiene: SQL dumps, 303 MB zip, `dist/` committed | LOW | `.gitignore`, working-tree cleanup | `.gitignore` extended. Superseded scratch/stale artifacts removed (see §3). **Your DB backups and the workspace transfer archive were deliberately left in place.** Untracking existing files is a git operation, frozen. | — | **PARTIAL / EXTERNAL REMOTE ACTION REQUIRED** |
| **R-18** | Restore dialog asked "reactivate account?" but the flag was ignored | LOW | `services/employee.service.ts`, `controllers/employee.controller.ts`, `AccountManagementPanel.tsx` | `restoreAccountAccess` is honoured: reactivates the user, clears lock/failed attempts, audits it. UI offers "Restore & reactivate account" vs "Restore only". | API + web build | **FIXED** |
| **R-19** | `packages/shared` unused and declared phantom roles (`SUPER_ADMIN`, `NURSE`, `DOCTOR`, …) | LOW | `packages/shared/src/index.ts` | Rewritten to the true contract: the three real tiers, API envelope, pagination, authenticated-user payload. Workspace left intact (safer than changing install topology). | web + API build | **FIXED** |
| **R-20** | Native `alert`/`confirm`/`prompt` in Account Management and elsewhere | LOW | `AccountManagementPanel.tsx`, `LeaveRequestsPage.tsx`, `EmployeeOnboardingPage.tsx` | Replaced with the app's toast/dialog system on every path touched. | web build | **FIXED** |
| **R-21** | Two live scheduling models (templates + weekly) | LOW | — | Both are genuinely in use: templates back `resolveScheduleForDate` and attendance context; weekly is what HR edits. Consolidating would need a data migration and a Hospicio decision about which is authoritative. Documented, not forced. | — | **INTENTIONALLY DEFERRED — EXTERNAL INPUT REQUIRED** |
| **R-22** | zod v3 (API) vs v4 (web) | LOW | — | No shared zod schema exists across the boundary, so the split is inert. Upgrading the API to zod v4 is a breaking dependency change with no current benefit; not done during a repair pass. | — | **RETRACTED (no defect)** |
| **R-23** | Legacy `/leave` mock route rendered fabricated employees | LOW | `routeTree.tsx`, `LeavePage.tsx` deleted | `/leave` now redirects to `/leave/requests`; the mock page is gone. | web build | **FIXED** |
| **C-01** | Landing page advertised a fourth "Administrator" role | — | `LandingPage.tsx`, `packages/shared` | Card removed; three real roles described accurately. Phantom role union removed from `packages/shared`. | web build + grep | **FIXED** |
| **C-03** | Docs described supervisor leave endorsement that did not exist | — | `services/leave.service.ts`, `routes/leave.routes.ts`, `controllers/leave.controller.ts`, `LeaveRequestsPage.tsx` | **Implemented rather than documented away.** `PENDING → (supervisor endorses) FOR_REVIEW → (HR decides) APPROVED/REJECTED`, using the existing unused `FOR_REVIEW` status. Supervisors act only on direct reports; final approval stays HR-only; employees with no supervisor route straight to HR without fabricating one. | API + web build | **FIXED** |
| **C-04** | Progress log said the attendance import placeholder was deleted; it was present | — | `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` | Corrected in the documentation reconciliation section. The placeholder itself is correct and stays. | — | **FIXED (doc)** |
| **C-05** | Landing page claimed expiration alerts, AI analysis and reports that did not exist | — | `LandingPage.tsx`, `AnimatedDashboardMockup.tsx` | Copy now matches the built system. The fabricated sample insight about a named unit's overtime was replaced with a description of what the feature does. Mockup uses anonymous placeholders and real HSJ unit names. | web build | **FIXED** |
| **C-06** | `HRISENSE_SYSTEM_PROGRESS_AUDIT.md` badly out of date | — | that file | Marked superseded with a pointer to the current documents. | — | **FIXED (doc)** |
| **C-07** | Feature inventory overstated the first-login flow | — | `HRISENSE_CURRENT_SYSTEM_FEATURE_INVENTORY.md` | Corrected. | — | **FIXED (doc)** |
| **C-08** | Help registry validator stale | — | `helpCenter.search.ts` | Same fix as R-17. | web build | **FIXED** |
| **C-09** | Schema comment claims 48 job roles; seed defines 46 | — | — | **NOT changed.** Resolving this requires reading `JOB ROLES.xlsx`, the authoritative source. Guessing which number is right would be inventing HSJ organisational fact. | — | **INTENTIONALLY DEFERRED — EXTERNAL INPUT REQUIRED** |
| **C-10** | HR Officer vs HR Staff separation had no effect (`FULL` ORed into every check) | — | `policies/recruitment.policy.ts`, `job-opening.controller.ts` | `FULL` now grants module access only. HR Officer authority genuinely required for publish, hire, reject, sensitive emails and onboarding conversion. `describeCapabilities()` returned from `/recruitment/overview` so the UI can hide what the caller cannot do. | API build | **FIXED** |
| **C-11** | Onboarding documented as complete but broken | — | see R-05 + docs | Code fixed; docs reconciled. | — | **FIXED** |
| **§10.2-a** | `GET /employees/:id/timeline` missing | — | see R-07 | | | **FIXED** |
| **§10.2-b** | `/employees/:id/account/*` missing (7 controls) | — | see R-06 | | | **FIXED** |
| **§10.2-c** | `PATCH /users/:id` missing | — | `EmployeesPage.tsx`, `/users` router deleted | Directory bulk toggle repointed to the employee-centric account API; also reports how many employees were skipped for having no account. | web build | **FIXED** |
| **§10.2-d** | `GET /employees/departments` wrong path | — | see R-08 | | | **FIXED** |
| **§10.2-e** | `POST /employees` multipart unparsed | — | see R-05 | | | **FIXED** |
| **§24** | Duplicate `/api/v1/departments` mount | — | `apps/api/src/index.ts`, `routes/index.ts` | Duplicate mount removed; `units`, `job-roles`, `onboarding-drafts` moved into the single central router. | API build | **FIXED** |
| **§12 (holiday)** | `DELETE /holidays/manual/:id` routed to the generic update handler | — | `holiday.service.ts`, `holiday.controller.ts`, `holiday.routes.ts`, `HolidayCalendarPage.tsx` | Real named `deactivateEntry` with its own audit action. Entries are never hard-deleted (attendance history is read against them) and the UI now says so. | API + web build | **FIXED** |
| **§27 (Reports)** | Reports page was two charts of invented data with a dead Export button | — | `services/report.service.ts`*, `routes/report.routes.ts`*, `ReportsPage.tsx` | Seven real reports (headcount, attendance, leave, compliance, training, evaluations, recruitment) with filters and working Excel/PDF/CSV export. **No turnover rate** — the formula and period are unconfirmed. No payroll. Applicant names excluded from the recruitment export. | API + web build | **FIXED** |
| **§28 (Settings)** | Four inert placeholder cards | — | `SettingsPage.tsx` | Every option works: Profile navigates to the signed-in employee's record, Security changes the password against the live endpoint, Appearance drives the real theme, Notifications opens the real page. | web build | **FIXED** |
| **§5 (self-profile/TopNav)** | TopNav "My Profile"/"Settings" were `<button>`s with an unused `href` | — | `TopNav.tsx` | Both navigate; My Profile resolves to the signed-in employee's own 201 record. | web build | **FIXED** |
| **§15 (import)** | Mustard Seedtime Excel import not implemented | — | — | Left exactly as it is: honest, clearly disabled placeholder. No columns, sheet names, punch-pairing or lateness rules invented. | — | **INTENTIONALLY DEFERRED — EXTERNAL INPUT REQUIRED** |
| **§41** | `seedPayslips()`, 4 `payslip.*` permissions, `payroll_periods_per_month` still live in the seed | — | `prisma/seed.ts` | All removed. Nothing active now seeds, reads, writes, advertises or authorizes payroll. The inert `Payslip` model stays in the schema (removing it would need a destructive migration for no benefit). | seed typecheck + grep | **FIXED** |
| **§40** | Dead code: `ui/skeleton.tsx`, `HSJ_DEPARTMENTS`, 3 dead services, stale prisma copies, scratch scripts | — | multiple | `HSJ_DEPARTMENTS` removed (it was the likely origin of the invented department names); `email.service.ts`, `export.service.ts`, `applicant-document.service.ts` deleted after re-verifying zero importers; stale prisma schema copies and `scratch/` removed. `ui/skeleton.tsx` kept — it is a valid unused UI primitive, not a defect. | API + web build | **FIXED** |

### New defects found during implementation (not in the original review)

| Problem | Files | Resolution | Status |
|---|---|---|---|
| **Onboarding wizard Step 1 rendered a duplicate of the Document Uploads step** — contact fields were never collected, so required `mobilePhone`/`presentAddress` were always empty | `EmployeeOnboardingPage.tsx` | Step 1 now renders the real Contact & Address form and explains that work email becomes the login. | **FIXED** |
| **Medical & psychological document downloads used `<a href>` against authenticated stream routes** — an anchor cannot send the bearer token, so all 5 download links would 401 | `lib/downloadProtectedFile.ts`*, medical/psych services, 4 pages (5 sites) | Authenticated blob download helper; anchors replaced with buttons. | **FIXED** |
| **Employee profile photos were unreachable** — stored as protected documents but rendered with plain `<img>` | `hooks/useProtectedImageUrl.ts`*, `components/ui/ProtectedImage.tsx`*, `Avatar`, `Sidebar`, `OrgChartPage` | Authenticated image resolution to object URLs, wired into all 6 render sites. | **FIXED** |
| **`seedCompliance()` wrote legacy `ComplianceCategory` values into the current `ComplianceRequirement` model** — every row was rejected and swallowed by `.catch(() => {})` | `prisma/seed.ts` | Rewritten with valid `RequirementCategory` values, an `ALL` scope, `tracksExpiry: false` and no invented reminder window. | **FIXED** |
| **`prisma/seed.ts` imported `EmploymentType`, which `@prisma/client` does not export** | `prisma/seed.ts` | Removed. The seed now typechecks cleanly (it sits outside `tsconfig.include`, so the build never covered it). | **FIXED** |
| **Transactional email defaulted to ENABLED in development** — a dev machine holding a real Brevo key could email real people | `brevo-transactional.provider.ts` | Development is now opt-in (`ENABLE_TRANSACTIONAL_EMAILS=true`). Simulation reports `sent:false, simulated:true` instead of pretending success. | **FIXED** |
| **Employee dashboard showed every published announcement**, not those addressed to the employee | `services/dashboard.service.ts` | Reads the `AnnouncementRecipient` snapshot. | **FIXED** |
| **Employee dashboard `schedule` was hardcoded `[]`** with an "until model exists" comment | `services/dashboard.service.ts` | Reads the employee's real active `EmployeeWeeklySchedule`. | **FIXED** |
| **`attendanceRate` reported `0` when there were no records**, which reads as 0% attendance | `services/dashboard.service.ts`, `HRDashboard.tsx` | Returns `null`; the UI says "No attendance data imported yet". | **FIXED** |

---

## 2. Retractions

**R-22 (zod v3 vs v4) — RETRACTED as a defect.** The review listed it as technical debt. No zod schema is shared across the API/web boundary, so the version split has no effect. Upgrading the API to zod v4 during a repair pass would be a breaking dependency change with no benefit.

**§4B / §39 (supervisor directory scope) — PARTIALLY RETRACTED.** The review's role matrix said a Supervisor sees "all employees" in the directory. That is wrong. `EmployeeService.list` already scopes the SUPERVISOR branch to `OR[{ id: self }, { immediateSupervisorId: self }]` and ANDs the filters onto it. The list was correct; only the matrix row was wrong. No code change was needed.

**§40 `ui/skeleton.tsx` — RETRACTED as a defect.** It is an unused but valid UI primitive, not dead application logic. Kept.

---

## 3. Files

### Created (23)
`apps/api/src/middleware/upload.ts` · `apps/api/src/lib/employeeNumber.ts` · `apps/api/src/lib/applicationStatusToken.ts` · `apps/api/src/services/org-hierarchy.service.ts` · `apps/api/src/services/notification.service.ts` · `apps/api/src/services/audit.service.ts` · `apps/api/src/services/report.service.ts` · `apps/api/src/services/ai/workforce-facts.service.ts` · `apps/api/src/services/ai/ai.service.ts` · `apps/api/src/controllers/account.controller.ts` · `apps/api/src/routes/audit.routes.ts` · `apps/api/src/routes/ai.routes.ts` · `apps/api/src/routes/report.routes.ts` · `apps/web/src/lib/tokenStorage.ts` · `apps/web/src/lib/passwordPolicy.ts` · `apps/web/src/lib/downloadProtectedFile.ts` · `apps/web/src/hooks/useProtectedImageUrl.ts` · `apps/web/src/hooks/useNotifications.ts` · `apps/web/src/components/ui/ProtectedImage.tsx` · `apps/web/src/pages/Auth/ForgotPasswordPage.tsx` · `apps/web/src/pages/Auth/ResetPasswordPage.tsx` · `apps/web/src/pages/Notifications/NotificationsPage.tsx` · `apps/web/src/pages/Audit/AuditLogsPage.tsx` · `apps/web/src/pages/Careers/ApplicationStatusPage.tsx` · `apps/web/src/pages/Leave/components/LeaveBalancePanel.tsx`
Docs: `docs/CLAUDE_FIX_ALL_PROGRESS.md` · `docs/CLAUDE_FIX_ALL_EXECUTION_REPORT.md` · `docs/EXTERNAL_SECRET_ROTATION_REQUIRED.md`

### Removed
`apps/api/src/routes/user.routes.ts` · `apps/api/src/controllers/user.controller.ts` (consolidated into the employee-centric account surface)
`apps/api/src/services/email.service.ts` · `export.service.ts` · `applicant-document.service.ts` (verified zero importers)
`apps/web/src/pages/Leave/LeavePage.tsx` · `apps/web/src/pages/Performance/PerformancePage.tsx` (mock/unreachable)
`apps/api/prisma/schema.temp.prisma` · `schema.prisma.recruitment` · `inspect_46.mjs` · `query_roles.mjs` · `apps/api/scratch_revise.ts` · `scratch_verify.ts` · `scratch/` · `apps/api/scratch/`

**Deliberately NOT removed:** your 10 SQL database backups, `HRISense_FULL_WORKSPACE_20260731.zip`, `workspace_snapshot/`, all migration history, `schema.pre-recruitment-baseline.prisma`, `apps/api/prisma/legacy-migrations-pre-baseline/`, `checkOverrides.js`.

---

## 4. What remains unfixed, and why

### 4.1 Mustard Seedtime attendance import — EXTERNAL INPUT REQUIRED
The official Excel export format has not been received. Column names, sheet layout, punch pairing, lateness and half-day rules would all have to be invented. The placeholder stays honest and clearly disabled.

### 4.2 Remote git history secret exposure — EXTERNAL REMOTE ACTION REQUIRED
`apps/api/.env` and `.local/**` are in the repository history. Local structure is prepared; rotation and untracking are yours to run. See `docs/EXTERNAL_SECRET_ROTATION_REQUIRED.md`.

### 4.3 Two open questions for Hospicio de San Jose
- **Job role count** (schema comment says 48; seed has 46) — needs `JOB ROLES.xlsx`.
- **Chargeable leave-day rule** — leave is still counted as inclusive calendar days, unchanged and still labelled provisional. Weekends, holidays and rest days are NOT silently excluded.
- **Scheduling model consolidation** (templates vs weekly) — needs a decision about which is authoritative.

---

## 5. Validation performed

| Check | Result |
|---|---|
| `npm run build --prefix apps/api` (`tsc`) | **PASS — 0 errors** |
| `npm run build --prefix apps/web` (`tsc -b && vite build`) | **PASS — 0 errors** |
| `npx tsc --noEmit prisma/seed.ts` | **PASS** (previously 2 pre-existing errors) |
| `npx prisma validate` | **PASS — schema is valid** |
| `npx prisma generate` | **PASS** |
| `npx prisma migrate status` | **NOT RUN — MySQL not reachable at localhost:3306** |
| Frontend↔backend endpoint cross-check | **0 unexplained mismatches** |
| Fake-operational-data sweep | **0 remaining** |
| Payroll sweep | **0 active; only scope-guard comments/redirects** |
| `supervisionLink` runtime usage | **0** |
| `Math.random` in credential paths | **0** |
| `totalAllotted: 15` | **0 (comment only)** |
| `roles: []` in help registry | **0** |
| `TODO`/`FIXME` in `src` | **0** |

**Build success is not runtime success.** Everything above is **SOURCE/BUILD VERIFIED — MANUAL USER TESTING REQUIRED**.

---

## 6. Database note

MySQL was not running during this work, so `prisma migrate status` could not be checked.

**No schema change was needed.** The one phase that might have required a migration — the public application status link (§15) — was implemented with a **stateless HMAC token** instead. Nothing is stored: no token column, no token table, no raw token or hash at rest. Rotating `APPLICATION_STATUS_TOKEN_SECRET` (or `JWT_SECRET`, its fallback) invalidates every outstanding link.

`prisma db push`, `prisma migrate reset` and `prisma migrate dev` were never run.

---

## 7. Post-QA addendum — 2026-09-02

The user manually tested the system after the pass above and found four real runtime
issues that source-and-build verification could not have caught. All four were fixed at
the root cause. Detail: `docs/CLAUDE_POST_QA_REPAIR_REPORT.md`.

| Finding ID | Problem found in manual QA | Severity | Files changed | Resolution | Validation | Status |
|---|---|---|---|---|---|---|
| PQ-1 | Welcome credentials were emailed to the login address (`workEmail`), not the employee's personal email; the provider could also silently re-address every credential message to `TEST_EMAIL_RECIPIENT` | HIGH | `email/brevo-transactional.provider.ts`, `email/employee-email.service.ts`, `employee.controller.ts`, `account.controller.ts`, `.env.example`, `EmployeeOnboardingPage.tsx` | Credential email now addressed to `personalEmail`, falling back only to the same employee's account email; test-redirect deleted; message carries name, employee number, login ID, temporary password, change-at-first-sign-in instruction, sign-in link and a security reminder; `emailRecipient` returned and shown | API build PASS; no live email sent | **FIXED** |
| PQ-2 | **Download PDF** left the onboarding success screen unusable — every button stopped responding | HIGH | `EmployeeOnboardingPage.tsx`, `apps/web/package.json` | html2pdf/html2canvas clones the card into a full-screen container; the unobserved promise rejection left it in the DOM as an invisible click blocker. Replaced with direct jsPDF text generation — no clone, no canvas, no overlay — inside `try`/`catch`/`finally` with a busy state | Web build PASS | **FIXED** |
| PQ-3 | Opening a newly onboarded employee crashed with `Cannot read properties of undefined (reading 'replace')` | CRITICAL | `EmployeeDetailPage.tsx`, `employee.service.ts` | `GET /employees/:id` returns documents as `{ id }` only, so `doc.category` was `undefined`. Profile now loads from `GET /employees/:employeeId/documents`, which enforces per-viewer visibility; all optional metadata rendered through safe formatters. Would have crashed for **any** employee with documents | Web build PASS; `tsc --noEmit` clean | **FIXED** |
| PQ-4 | Configure Weekly Schedule was cramped, scroll-heavy and unclear | MEDIUM | `EmployeeScheduleProfileTab.tsx`, `EmployeeDetailPage.tsx` | Rebuilt as a numbered guided workflow: wider dialog, employee name and effective date in the header, worded day states, 7-column weekly grid, live problem list, sticky footer, dialog semantics and focus styles. **No scheduling business rule changed** | Web build PASS | **FIXED** |
| PQ-5 | Document downloads used a plain `<a href>` against an authenticated route, hardcoded to `localhost:5000` | HIGH | `EmployeeDetailPage.tsx` | Routed through `downloadProtectedFile` / `openProtectedFile`; separate Preview and Download actions | Web build PASS | **FIXED** |
| PQ-6 | Employee photos never loaded unless "Keep me signed in" was ticked | MEDIUM | `useProtectedImageUrl.ts` | Read `localStorage` directly; now reads `tokenStorage.getAccessToken()`, which covers `sessionStorage` | Web build PASS | **FIXED** |
| PQ-7 | Profile showed `employmentType` (not a field), compared `permissionTier === 'HR'` (never true), hardcoded Probation Date to "N/A", and showed `homePhone` where onboarding stores `telephoneNumber` | MEDIUM | `EmployeeDetailPage.tsx` | All four corrected against the schema; "Not provided" fallbacks throughout | Web build PASS | **FIXED** |
| PQ-8 | Account Management always showed "Never" for last sign-in and never offered Unlock for a locked account | MEDIUM | `employee.service.ts` | `getById` user select widened to `mustChangePassword`, `lockedUntil`, `lastLoginAt`, `createdAt`. No credential material selected | API build PASS | **FIXED** |
| PQ-9 | Profile completion counted soft-deleted documents; the "Missing:" hint was permanently empty | LOW | `employee.service.ts` | `where: { deletedAt: null }` on all 9 document includes; `listMissingProfileFields()` added and returned by `getById` | API build PASS | **FIXED** |
| PQ-10 | `OrgChartPage` called `useMemo` after an early return — React would throw on a supervisor cycle | MEDIUM | `OrgChartPage.tsx` | Badge computed without a hook | `oxlint` reports 0 `rules-of-hooks` errors | **FIXED** |
| PQ-11 | The onboarding wizard's `required` attributes were decorative; HR could reach the final step and be rejected there | MEDIUM | `EmployeeOnboardingPage.tsx` | Per-step validation naming the missing fields | Web build PASS | **FIXED** |
| PQ-12 | Help Center covered 39 functions with only 13 authored, and predated Notifications, Audit Logs, Reports, Settings, AI Assistance, the new leave workflow and the public status link | HIGH | `helpCenter.types.ts`, `helpCenter.registry.ts`, `helpCenter.search.ts`, 3 Help components, 10 new `guides/*.guides.ts`, `HelpLink.tsx`, `scripts/validate-help-registry.ts` | Re-audited against current routes, sidebar, services and permission seed; rebuilt to **79 guides, all READY, 17 categories**; validator extended to reject unknown categories, missing keywords and unreachable related links; 10 contextual Help links added | `validate-help-registry.ts`: 79 guides, 0 defects | **FIXED** |

### Still open after the post-QA pass

| Item | Status |
|---|---|
| Mustard Seedtime attendance import processing | **INTENTIONALLY DEFERRED — EXTERNAL INPUT REQUIRED** (one real sample export) |
| Historical secret exposure / provider key rotation | **EXTERNAL REMOTE ACTION REQUIRED** (GitHub frozen) |
| Help Center screenshot assets | **DEFERRED** — no capture was performed or fabricated |
| Job-role count (46 vs 48), chargeable leave-day rule, scheduling-model consolidation | Await Hospicio confirmation |
| Transactional email delivery | Requires `ENABLE_TRANSACTIONAL_EMAILS=true` and a Brevo-verified `DEFAULT_FROM_EMAIL` in `apps/api/.env` — configuration, not code |

### Post-QA validation

| Check | Result |
|---|---|
| `apps/api` build (`tsc`) | **PASS** |
| `apps/web` build (`tsc -b && vite build`) | **PASS** |
| `npx tsc --noEmit` (both workspaces) | **PASS** |
| `npx prisma validate` | **PASS** |
| `npx prisma migrate status` | **13 migrations found; database schema is up to date** (MySQL reachable this time) |
| `npx prisma generate` | **BLOCKED** — `EPERM` renaming the Windows query engine; the file is locked by the running dev server. Existing client is current; not a schema problem |
| `npx tsx apps/web/scripts/validate-help-registry.ts` | **PASS — 79 guides, 17 categories, 0 defects** |
| Prisma schema changed / migration created | **NO / NO** |
| Browser automation, live email, paid AI call | **NONE** |
| Git operations | **NONE — HEAD still `7648345b`** |
