# HSJ HRISense — Fix-All Execution Progress

> **Task:** Repair every locally-fixable finding in `docs/CLAUDE_HRISENSE_MASTER_SYSTEM_REVIEW.md`.
> **Repository:** `C:\xampp\htdocs\HRISense`
> **Starting HEAD:** `7648345b4c08ec74387ee2b8f67136395c5549b8` (`main`)
> **Git freeze:** ACTIVE — no commits, no remote operations of any kind.
> **Database:** `hrisense_db` must receive `prisma migrate deploy` only, after a reviewed migration authored against `hrisense_migration_dev_db`.
> **Started:** 2026-09-01

---

## Status legend
`COMPLETE` · `PARTIAL` · `IN PROGRESS` · `BLOCKED` · `DEFERRED (EXTERNAL)` · `NOT STARTED`

---

## Phase board

| # | Phase | Priority | Status |
|---|---|---|---|
| 0 | Fix progress tracker | — | COMPLETE |
| 1 | Employee onboarding end-to-end | P0 | NOT STARTED |
| 2 | Authentication correctness | P0 | NOT STARTED |
| 3 | Supervisor relationship unification | P0 | NOT STARTED |
| 4 | Object-level authorization sweep | P0 | NOT STARTED |
| 5 | Employee self-profile + TopNav | P0 | NOT STARTED |
| 6 | Account Management panel | P0 | NOT STARTED |
| 7 | Timeline + Audit Logs | P1 | NOT STARTED |
| 8 | Notifications | P2 | NOT STARTED |
| 9 | Leave workflow + balances | P1 | NOT STARTED |
| 10 | Attendance data honesty | P1 | NOT STARTED |
| 11 | Restore account access | P1 | NOT STARTED |
| 12 | Holiday calendar delete semantics | P1 | NOT STARTED |
| 13 | Recruitment authority | P2 | NOT STARTED |
| 14 | Recruitment email control | P2 | NOT STARTED |
| 15 | Public application status link | P2 | NOT STARTED |
| 16 | Real AI Assistance | P3 | NOT STARTED |
| 17 | Real Reports | P3 | NOT STARTED |
| 18 | Real Settings | P3 | NOT STARTED |
| 19 | Landing page truthfulness | P4 | NOT STARTED |
| 20 | Legacy mock routes | P4 | NOT STARTED |
| 21 | Help Center defects | P4 | NOT STARTED |
| 22 | Payroll runtime remnants | P5 | NOT STARTED |
| 23 | Shared types / dead services | P5 | NOT STARTED |
| 24 | Duplicate / broken routes | P2 | NOT STARTED |
| 25 | Local security structure | P5 | NOT STARTED |
| 26 | Reset token security | P0 | NOT STARTED |
| 27 | Trust proxy / headers | P5 | NOT STARTED |
| 28 | Repository cleanup | P5 | NOT STARTED |
| 29 | Documentation reconciliation | P5 | NOT STARTED |
| 30 | Final source-wide re-audit | P5 | NOT STARTED |

---

## Issue backlog (from the Master System Review)

| ID | Severity | Issue | Phase | Status |
|---|---|---|---|---|
| R-05 | CRITICAL | Employee creation broken end-to-end (no multer, no employeeNumber, no User/temp password/email) | 1 | NOT STARTED |
| S-1 | CRITICAL | `apps/api/.env` + `.local/**` tracked in git | 25 | NOT STARTED |
| R-03 | HIGH | change-password complexity regex unsatisfiable (`\\d`) | 2 | NOT STARTED |
| R-02 | HIGH | `currentPassword` vs `oldPassword` mismatch → old password never verified | 2 | NOT STARTED |
| R-01 | HIGH | `getMe` omits `mustChangePassword` | 2 | NOT STARTED |
| R-04 | HIGH | Two unsynchronized supervisor mechanisms | 3 | NOT STARTED |
| S-3 | HIGH | `GET /employees/:id` has no authorization | 4 | NOT STARTED |
| S-4 | HIGH | Weekly schedule: any supervisor can read/write any employee | 4 | NOT STARTED |
| R-06 | HIGH | Account Management: 7 controls call non-existent endpoints | 6 | NOT STARTED |
| R-15 | HIGH | `/ai-assistance` fabricated analysis presented as live | 16 | NOT STARTED |
| S-2 | HIGH | `.local/` credential reports tracked | 25 | NOT STARTED |
| R-13 | MED-HIGH | Leave approval invents `totalAllotted: 15` | 9 | NOT STARTED |
| R-12 | MEDIUM | `LeaveBalance.pending` drifts negative | 9 | NOT STARTED |
| R-10 | MEDIUM | HR Dashboard infers Absent from missing records | 10 | NOT STARTED |
| R-07 | MEDIUM | Employee Timeline endpoint missing | 7 | NOT STARTED |
| R-08 | MEDIUM | Attendance Tally department filter calls wrong endpoint | 10 | NOT STARTED |
| R-14 | MEDIUM | Dashboard reads legacy `TrainingAttendee` | 10 | NOT STARTED |
| S-6 | MEDIUM | `Math.random()` temp password generation | 2 | NOT STARTED |
| S-7 | MEDIUM | Reset token returned in API response | 26 | NOT STARTED |
| S-8 | MEDIUM | Seeded `FULL` account with password `"hr"` | 2 | NOT STARTED |
| R-09 | MEDIUM | Dead sidebar links `/notifications`, `/audit` | 7, 8 | NOT STARTED |
| R-11 | MEDIUM | Notifications inert (nothing writes) + mock TopNav bell | 8 | NOT STARTED |
| S-9 | MEDIUM | No `trust proxy`; rate limiting skipped in dev | 27 | NOT STARTED |
| R-16 | LOW-MED | `AUTH_LOGOUT` help guide `roles: []` | 21 | NOT STARTED |
| R-17 | LOW | `validateHelpRegistry()` stale counts | 21 | NOT STARTED |
| S-11 | LOW | Repo hygiene (dumps, zip, dist) | 25, 28 | NOT STARTED |
| R-18 | LOW | Restore ignores `restoreAccountAccess` | 11 | NOT STARTED |
| R-19 | LOW | `packages/shared` unused + contradictory | 23 | NOT STARTED |
| R-20 | LOW | Native `alert/confirm/prompt` in Account Management | 6 | NOT STARTED |
| R-21 | LOW | Two live scheduling models | 17 (doc) | NOT STARTED |
| R-22 | LOW | zod v3 (api) vs v4 (web) | 23 | NOT STARTED |
| R-23 | LOW | Legacy `/leave` mock routable | 20 | NOT STARTED |
| C-01 | — | Landing page advertises "Administrator" role | 19 | NOT STARTED |
| C-02 | — | Dashboard Absent inference | 10 | NOT STARTED |
| C-03 | — | Docs claim supervisor leave endorsement | 9, 29 | NOT STARTED |
| C-04 | — | Progress log says import placeholder deleted | 29 | NOT STARTED |
| C-05 | — | Landing page overstates AI/alerts/reports | 19 | NOT STARTED |
| C-06 | — | `HRISENSE_SYSTEM_PROGRESS_AUDIT.md` stale | 29 | NOT STARTED |
| C-07 | — | Feature inventory overstates first-login flow | 29 | NOT STARTED |
| C-08 | — | Help registry validator stale | 21 | NOT STARTED |
| C-09 | — | Schema comment says 48 job roles, seed has 46 | 19 | NOT STARTED |
| C-10 | — | HR Officer vs HR Staff separation has no effect | 13 | NOT STARTED |
| C-11 | — | Onboarding documented complete but broken | 1, 29 | NOT STARTED |
| §10.2-a | — | `GET /employees/:id/timeline` missing | 7 | NOT STARTED |
| §10.2-b | — | `/employees/:id/account/*` missing (7 controls) | 6 | NOT STARTED |
| §10.2-c | — | `PATCH /users/:id` missing | 6 | NOT STARTED |
| §10.2-d | — | `GET /employees/departments` wrong path | 10 | NOT STARTED |
| §10.2-e | — | `POST /employees` multipart unparsed | 1 | NOT STARTED |
| §40.x | — | Dead/mock code (skeleton, HSJ_DEPARTMENTS, dead services) | 20, 23, 28 | NOT STARTED |
| §41 | — | `seedPayslips()`, payslip permissions, payroll setting | 22 | NOT STARTED |
| — | — | Mustard Seedtime import | 10E | DEFERRED (EXTERNAL) |

---

## Change log

### Phase 0 — Progress tracker · COMPLETE
- Created `docs/CLAUDE_FIX_ALL_PROGRESS.md`.

### Phase 1 — Employee onboarding end-to-end · COMPLETE (source/build verified)
**NEW ROOT CAUSE FOUND DURING IMPLEMENTATION (not in the original review):**
Step 1 of the wizard ("Contact & Address") rendered a *duplicate of the Document
Uploads step*. The contact fields were never rendered, so `workEmail`,
`personalEmail`, `mobilePhone`, `presentAddress` were always empty — and
`mobilePhone`/`presentAddress` are NOT NULL in Prisma. Even with multer fixed,
creation would have failed. Step 1 now renders the real contact form.

- `middleware/upload.ts` (NEW) — one authoritative multer factory: random stored
  filenames, MIME allowlist, executable-extension blocklist, size/count limits,
  `cleanupUploadedFiles`, `flattenMulterFields`.
- `lib/employeeNumber.ts` (NEW) — collision-safe `HSJ-XXXX` generation with
  candidate list + P2002 retry. HR no longer supplies employee numbers.
- `lib/password.ts` — `generateTemporaryPassword` now delegates to the crypto
  generator (single authoritative implementation); added `PASSWORD_POLICY` and
  `validatePasswordComplexity`.
- `routes/employee.routes.ts` — `POST /employees` now parses multipart with the
  exact frontend field names (`profilePicture`, `resume`, `contract`,
  `governmentIds`, `otherDocuments`).
- `services/employee.service.ts` — `create()` rewritten: required-field
  validation, uniqueness pre-checks, org consistency, supervisor resolution, then
  ONE transaction creating Employee + User + all EmployeeDocument rows + audit.
  Returns `{employee, temporaryPassword, accountCreated, accountEmail,
  documentsSaved, warnings}`.
- `controllers/employee.controller.ts` — orphaned-file cleanup on failure; then
  non-fatal post-steps: schedule assignment, draft completion, **JobApplication →
  employeeId link (recruitment chain completed)**, welcome email with honest
  `emailSent`/`emailMessage`.
- `services/email/employee-email.service.ts` — rewritten; returns
  `{sent, simulated, message}`; added `sendResetCredentialsEmail` and
  `sendPasswordResetLink`.
- `services/email/brevo-transactional.provider.ts` — development is now
  **opt-in** (`ENABLE_TRANSACTIONAL_EMAILS=true`) so a dev machine with a real key
  cannot email real people; simulation now reports `sent:false, simulated:true`
  instead of pretending success.
- `EmployeeOnboardingPage.tsx` — real Contact & Address step; success screen shows
  the actual returned temporary password (never `undefined`), documents saved,
  honest email status, and a warnings panel; review step shows mobile/address and
  explains auto-generated employee number.
- `hooks/useProtectedImageUrl.ts` + `components/ui/ProtectedImage.tsx` (NEW) —
  profile photos are stored as protected documents; these resolve the
  authenticated stream to an object URL so `<img>` actually renders. Wired into
  `Avatar`, `Sidebar`, `OrgChartPage` (2 sites).

### Phase 2 — Authentication · PARTIAL (backend complete; frontend pending)
- `controllers/auth.controller.ts` — `getMe` now returns `mustChangePassword`
  (and rejects deactivated accounts); `changePassword` accepts canonical
  `currentPassword` with `oldPassword` as a legacy alias.
- `services/auth.service.ts` — **broken `\\d` regex removed**; complexity now via
  `validatePasswordComplexity`; current password ALWAYS verified; new password
  must differ; `forgotPassword` no longer returns the raw token and now emails a
  crypto-random link (`crypto.randomBytes(32)`), response stays enumeration-safe;
  `resetPassword` enforces complexity.
- `services/user.service.ts` — rewritten: crypto temp passwords (no
  `Math.random`), session revocation on reset/deactivate/lock/force-change, plus
  `lockAccount`, `unlockAccount`, `forcePasswordChangeFlag`,
  `getAccountForEmployee`.
- **Still to do in Phase 2:** frontend Remember Me, Forgot/Reset password pages,
  ChangePasswordPage field rename, seed weak-password removal.

### Phase 2 (frontend) — COMPLETE (source/build verified)
- `lib/passwordPolicy.ts` (NEW) — client mirror of the server policy (5 rules).
- `lib/tokenStorage.ts` (NEW) — single Remember Me aware token store:
  `localStorage` when remembered, `sessionStorage` otherwise, never both;
  also exports `isPublicPath` so the public-route list is defined once.
- `services/api.ts` + `providers/AuthProvider.tsx` — both now use `tokenStorage`;
  `login()` takes `rememberMe` and records it BEFORE storing tokens.
- `LoginPage.tsx` — **"Keep me signed in" checkbox** (defaults to the previous
  choice) and a **"Forgot password?"** link.
- `ChangePasswordPage.tsx` — canonical `currentPassword`; live per-rule checklist;
  submit disabled until the policy is met and the passwords match; blocks reusing
  the current password.
- `ForgotPasswordPage.tsx` + `ResetPasswordPage.tsx` (NEW) — registered at
  `/forgot-password` and `/reset-password?token=`; the reset page handles a
  missing/expired token honestly.
- `services/auth.service.ts` — `rememberMe` stripped before POST;
  `ForgotPasswordResponse` no longer claims to carry a token.

### Phase 22 (seed portion) + S-8 — COMPLETE
- `prisma/seed.ts`: removed the hardcoded `"hr"` password (now
  `SEED_HR_PASSWORD` or a crypto-generated one printed once); `DEFAULT_PASSWORD`
  likewise via `SEED_DEFAULT_PASSWORD`; **deleted `seedPayslips()`**, the 4
  `payslip.*` permissions and the `payroll_periods_per_month` setting;
  **deleted `seedAIInsights()`** (it wrote fabricated attrition/staffing insights
  with invented confidence scores straight into the table the dashboard reads).
- **Two pre-existing seed bugs found and fixed while here:**
  `EmploymentType` was imported but is not exported by `@prisma/client`; and
  `seedCompliance()` wrote legacy `ComplianceCategory` values into the current
  `ComplianceRequirement` model, so every row was rejected and swallowed by
  `.catch(() => {})`. It now seeds valid `RequirementCategory` rows with an `ALL`
  scope, `tracksExpiry: false` and no invented reminder window.
- Seed now typechecks cleanly (it is outside `tsconfig.include`, so it was never
  covered by the build).

### Phase 3 — Supervisor unification · COMPLETE (source/build verified)
- `services/org-hierarchy.service.ts` (NEW) — canonical resolution on
  `Employee.immediateSupervisorId`: `getDirectSubordinateIds`, `getTeamScopeIds`,
  `isDirectSubordinate`, `getSubordinateTreeIds`, `isInSubordinateTree`,
  `getSupervisorChainIds`, `canAccessEmployeeRecord`, `getVisibleEmployeeIds`.
- Migrated every runtime reader off the seed-only `SupervisionLink` table:
  `attendance.service` (5 sites), `leave.service` (4), `schedule.service` (3),
  `schedule.controller` (1), `compliance.service` (1), `document.service` (2),
  `evaluation.service` (1, SUPERVISOR evaluator resolution).
- **`grep -rn "supervisionLink" apps/api/src` now returns nothing.** The table
  remains in the schema as legacy history only.

### Phase 4 — Object-level authorization · PARTIAL
- `GET /employees/:id` now enforces `OrgHierarchyService.canAccessEmployeeRecord`
  (was completely unguarded).
- **Still to do:** directory list scope, weekly-schedule read/write subordinate
  check, full sweep of `employeeId`/`documentId`/`recordId` routes.

### Phase 6 / 7 — Account Management + Timeline · PARTIAL
- `controllers/account.controller.ts` (NEW) — the seven real account actions,
  employee-centric, all audited: `getAccount`, `activate`, `deactivate`, `lock`,
  `unlock`, `forcePasswordChange`, `resetPassword` (issues a NEW password and
  optionally emails it).
- `GET /employees/:id/timeline` implemented over `AuditLog` with the same
  object-level authorization plus metadata redaction
  (`redactTimelineMetadata` strips password/token/hrNotes-like keys).
- **Still to do:** frontend panel rewrite, `/users` route consolidation, Audit
  Logs page.

### Phase 5 / 6 / 7 / 8 / 9 / 11 / 24 — COMPLETE (source/build verified)

**Phase 6 — Account Management (was: every control 404'd)**
- `controllers/account.controller.ts` + 7 routes under `/employees/:id/account/*`.
- `AccountManagementPanel.tsx` fully rewritten: real endpoints, in-app confirm
  dialog (no `alert`/`confirm`/`prompt`), self-action guards, honest email status.
- **"Resend Welcome" removed** — HRISense never stores plaintext, so it was
  impossible. Replaced by **"Reset & send new credentials"**, which is what
  actually happens.
- `/users` router + controller **deleted** — one authoritative account surface.
  `EmployeesPage` bulk activate/deactivate repointed to it and now reports how
  many employees were skipped for having no account.

**Phase 11 — restore account access (R-18)**
- `bulkRestore` now honours `restoreAccountAccess`, reactivates the linked user,
  clears lock/failed attempts, and audits it. UI offers "Restore & reactivate
  account" vs "Restore only" instead of a `confirm()`.

**Phase 7 — Timeline + Audit Logs**
- `GET /employees/:id/timeline` live; `EmployeeDetailPage` renders real events as
  labelled fields (no raw JSON dump) and surfaces errors instead of swallowing them.
- `services/audit.service.ts` + `routes/audit.routes.ts` (NEW) — `GET /audit`
  (FULL only) with search, action, entity-type and date-range filters, plus
  `/audit/options`. Server-side redaction of credential-like and clinical keys.
- `pages/Audit/AuditLogsPage.tsx` (NEW) at `/audit` — table, filters, pagination,
  detail drawer, empty state. **The dead sidebar link is now a real page.**

**Phase 8 — Notifications (was: nothing ever created one)**
- `services/notification.service.ts` (NEW) — `notify`, `notifyMany`,
  `userIdForEmployee`, `hrUserIds`, list/unread-count/markRead/markAllRead.
  Creation is always best-effort and never rolls back the triggering action.
- `routes/notification.routes.ts` rewritten; added `GET /notifications/unread-count`.
- `hooks/useNotifications.ts` (NEW) — shared state for bell, badge and page.
- `pages/Notifications/NotificationsPage.tsx` (NEW) at `/notifications`.
- **TopNav bell mock deleted** (4 hardcoded notifications + fake badge) and
  **sidebar hardcoded badge `8` replaced** with the real unread count.

**Phase 9 — Leave workflow**
- Two-stage flow implemented on the existing enum:
  `PENDING → (supervisor endorses) FOR_REVIEW → (HR decides) APPROVED/REJECTED`.
  `PATCH /leave/:id/endorse` (SUPERVISOR/FULL, direct reports only).
  Supervisors may also reject their own team's PENDING request; **final approval
  stays HR-only**. Employees with no supervisor route straight to HR — no
  supervisor is fabricated.
- **`totalAllotted: 15` deleted.** Approval no longer creates a balance row; it
  only updates one HR has configured.
- **`pending` now incremented on filing** and released on reject/cancel, clamped
  at zero, all inside transactions.
- `PUT /leave/balances` (FULL) + `LeaveService.upsertBalance` — HR enters
  entitlements explicitly; nothing is defaulted.
- Chargeable days remain plain inclusive calendar days (unchanged, still labelled
  as pending Hospicio confirmation).
- Notifications raised on file / endorse / approve / reject.
- `LeaveRequestsPage` — endorsement UI, `FOR_REVIEW` status, "With HR" tile,
  status filter option, `alert()` replaced with toasts.

**Phase 5 — self-profile + TopNav**
- TopNav "My Profile" and "Settings" now actually navigate (they were `<button>`s
  with an unused `href`). My Profile resolves to the signed-in employee's own record.

**Phase 24 (partial) — routing anomalies**
- Duplicate `/api/v1/departments` mount removed; `units`, `job-roles` and
  `onboarding-drafts` moved into the single central router.

### Phase 4 (complete) / 10 / 12 / 13 / 14 — COMPLETE (source/build verified)

**Phase 4 — object-level authorization**
- `GET /employees/:id` and `/timeline` gated by `canAccessEmployeeRecord`.
- `WeeklyScheduleController.assertScheduleAccess` (NEW) — supervisors may now
  read/write ONLY their own direct reports' schedules; a supervisor cannot edit
  their own; STANDARD is read-only self. **The missing subordinate check is closed.**
- **REVIEW FINDING PARTIALLY RETRACTED (§4B / §39):** the review's role matrix said
  a Supervisor sees "all employees" in the directory. `EmployeeService.list`
  already scopes the SUPERVISOR branch to
  `OR[{id: self}, {immediateSupervisorId: self}]`. The list was correct; only the
  matrix row was wrong. No code change was needed.

**Phase 10 — attendance data honesty**
- **`absentToday = total − present − onLeave` DELETED.** `absentToday` now counts
  only real `status: 'ABSENT'` records; a new `noRecordToday` is reported
  separately and never folded in.
- **Fake 6-month trend replaced** with per-month figures computed from each
  month's own records; months with no data return `rate: null`, the chart uses
  `connectNulls={false}`, and an empty trend shows "No attendance data yet"
  instead of a flat 100% line.
- `attendanceRate` returns `null` (not 0) when there is nothing to measure.
- Dashboard training widgets moved from legacy `Training`/`TrainingAttendee` to
  `TrainingActivity`/`TrainingParticipant`.
- Employee dashboard announcements now come from the recipient snapshot, so an
  employee sees only announcements actually addressed to them.
- `schedule: []` hardcode replaced with the employee's real active
  `EmployeeWeeklySchedule`.
- HR Dashboard: "Unit Headcount" tile replaced with **Absent Today (+ no-record
  count)**; "Pending Approvals" → "Awaiting HR Decision" (PENDING + FOR_REVIEW);
  **all 8 Quick Actions now navigate** (they had no `onClick`).
- Attendance Tally department filter repointed from the non-existent
  `/employees/departments` to `GET /departments?unitId=`.
- **Attendance import left deliberately deferred** — no parser, no invented
  columns, no punch-pairing.

**Phase 12 — holiday calendar**
- `HolidayService.deactivateEntry` + `HolidayController.deactivateEntry` (NEW).
  `DELETE /holidays/manual/:id` no longer routes to the generic update handler;
  both `DELETE` and the new `POST /manual/:id/deactivate` perform a real, named,
  separately-audited (`CALENDAR_ENTRY_DEACTIVATED`) deactivation. Entries are
  never hard-deleted because attendance history is read against them, and the UI
  now says so.

**Phase 13 — recruitment authority (C-10)**
- `permissionTier === FULL` no longer ORs into every check. FULL grants module
  access; **HR Officer authority is now genuinely required** for publish, hire,
  reject, sensitive applicant emails and onboarding conversion. HR Staff /
  Assistant keep screening and administrative actions.
- `describeCapabilities()` added and returned from `/recruitment/overview` so the
  UI can hide controls instead of failing with a 403.

**Phase 14 — recruitment email control**
- `recruitmentAutoEmailPolicy` (NEW): application-received stays automatic;
  **status-change and interview emails are OFF by default**
  (`RECRUITMENT_AUTO_EMAIL_STATUS_CHANGES`,
  `RECRUITMENT_AUTO_EMAIL_INTERVIEW_EVENTS`). HR sends those deliberately with
  preview. Every attempt is still persisted; suppression is logged, never
  reported as "sent".

---

## Files modified
- `apps/api/src/lib/password.ts`
- `apps/api/src/routes/employee.routes.ts`
- `apps/api/src/controllers/employee.controller.ts`
- `apps/api/src/controllers/auth.controller.ts`
- `apps/api/src/controllers/schedule.controller.ts`
- `apps/api/src/services/employee.service.ts`
- `apps/api/src/services/auth.service.ts`
- `apps/api/src/services/user.service.ts`
- `apps/api/src/services/attendance.service.ts`
- `apps/api/src/services/leave.service.ts`
- `apps/api/src/services/schedule.service.ts`
- `apps/api/src/services/compliance.service.ts`
- `apps/api/src/services/document.service.ts`
- `apps/api/src/services/evaluation.service.ts`
- `apps/api/src/services/email/employee-email.service.ts`
- `apps/api/src/services/email/brevo-transactional.provider.ts`
- `apps/web/src/pages/Employees/EmployeeOnboardingPage.tsx`
- `apps/web/src/pages/Employees/OrgChartPage.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/ui/avatar.tsx`

## Files created
- `docs/CLAUDE_FIX_ALL_PROGRESS.md`
- `apps/api/src/middleware/upload.ts`
- `apps/api/src/lib/employeeNumber.ts`
- `apps/api/src/services/org-hierarchy.service.ts`
- `apps/api/src/controllers/account.controller.ts`
- `apps/web/src/hooks/useProtectedImageUrl.ts`
- `apps/web/src/components/ui/ProtectedImage.tsx`

## Files removed
*(none yet)*

## Schema / migration state
- Prisma schema changed: **NO**
- Migration created: **NO**
- Applied to `hrisense_db`: **NO**

## Build state
- API build (`tsc`): **PASS**
- Web build (`tsc -b && vite build`): **PASS**

## Known blockers
- Mustard Seedtime Excel format — external, deferred by instruction.
- Remote git history secret exposure — GitHub frozen by instruction.

---

# FINAL STATE — 2026-09-02

**All 30 phases complete.** Full itemised outcome:
`docs/CLAUDE_FIX_ALL_EXECUTION_REPORT.md`.

| Check | Result |
|---|---|
| API build (`tsc`) | PASS — 0 errors |
| Web build (`tsc -b && vite build`) | PASS — 0 errors |
| `prisma validate` / `generate` | PASS |
| Prisma schema changed | NO |
| Migration created / applied | NO |
| Git commits | NONE — HEAD still `7648345b` |
| Browser testing / live emails / paid AI calls | NONE |

**Remaining open (both external):**
1. Mustard Seedtime attendance import — awaiting the official Excel sample.
2. Historical git secret exposure — see `docs/EXTERNAL_SECRET_ROTATION_REQUIRED.md`.

**Status: COMPLETE LOCAL REPAIR — MANUAL USER QA REQUIRED.**

---

## Superseded next action
Finish **Phase 2 frontend** (`ChangePasswordPage.tsx` field rename + policy hints,
Remember Me in `LoginPage.tsx`/`AuthProvider`/`api.ts`, new Forgot/Reset password
pages + routes), then **Phase 6 frontend** (`AccountManagementPanel.tsx` rewrite
against `/employees/:id/account/*`), then continue Phase 4 sweep.

---

## POST-QA REPAIR PASS — 2026-09-02

User manually tested onboarding after the fix-all pass and reported four runtime
issues. Continuation checkpoint for this pass:

| Step | Item | State |
|------|------|-------|
| 1 | Welcome email delivered to `personalEmail` | DONE |
| 2 | Onboarding credential PDF / frozen UI | DONE |
| 3 | Employee Documents `.replace` crash | DONE |
| 4 | Remaining profile tab contract mismatches | DONE |
| 5 | Weekly Schedule modal UX redesign | DONE |
| 6 | API build / Web build after repairs | PASS / PASS |
| 7 | Help Center re-audit + authoring | DONE |
| 8 | Contextual Help links | DONE |
| 9 | Documentation + post-QA report | DONE |

### Post-QA outcome

| Item | Result |
|---|---|
| Welcome email recipient | Employee `personalEmail`; test-redirect removed from the credential provider |
| Onboarding credential PDF | Written directly with jsPDF — no DOM clone, no leftover overlay, `try`/`finally` |
| Employee Documents crash | Root cause: `GET /employees/:id` returned documents as `{ id }` only. Profile now reads `GET /employees/:employeeId/documents` |
| Profile tab audit | 6 further contract mismatches fixed; 1 latent React hook crash fixed in the org chart |
| Weekly Schedule modal | Redesigned UX only — no scheduling business rule changed |
| Help Center | 39 entries / 13 READY / 10 categories → **79 entries, 79 READY, 17 categories** |
| Contextual Help | 10 workflow pages |
| Screenshots | None captured, none fabricated — architecture preserved |
| Mustard Seedtime import | Still deferred; no format invented |
| API build / Web build | PASS / PASS |
| `prisma validate` / `migrate status` | PASS / 13 migrations, schema up to date |
| Schema changed / migration created | NO / NO |
| Git commits or remote operations | NONE — HEAD still `7648345b` |

Full detail: `docs/CLAUDE_POST_QA_REPAIR_REPORT.md`.

**Status: POST-QA REPAIRS IMPLEMENTED — HELP CENTER TEXTUAL AUTHORING COMPLETE —
CONTEXTUAL HELP IMPLEMENTED — SCREENSHOT CAPTURE DEFERRED — MANUAL USER QA REQUIRED.**


---

## LOGIC & DATA-INTEGRITY REPAIR PASS — 2026-09-07

Third repair pass. Fixed the confirmed defects from
`docs/ATTENDANCE_IMPORT_OVERLAP_DESIGN_REVIEW.md` §24 and built the
format-independent attendance import foundation.

| Area | Result |
|---|---|
| SW-01 weekly schedule `effectiveTo` | FIXED — code + 2 live rows repaired |
| SW-02 leave double-approval | FIXED — guarded transitions on all 4 methods |
| SW-03 leave pending clamp | FIXED — atomic decrement, anomaly audited not clamped |
| SW-04 training → compliance | FIXED — one transaction + source-event idempotency key |
| SW-05 AI attendance population | FIXED — shared `workforceScope.ts` |
| SW-06 weekly schedule constraint | ADDED — 0 violating rows confirmed first |
| SW-07 scheduling authority | RESOLVED — `ScheduleResolverService` |
| SW-09 attendance `oldValue` | FIXED |
| SW-10 attendance validation | FIXED — zod |
| SW-11 date-only handling | VERIFIED + centralised, 13/13 checks pass |
| SW-14 evaluation double-submit | FIXED |
| SW-15 notification idempotency | FIXED — `eventId` unique |
| SW-16 document orphan files | FIXED |
| Attendance import foundation | Batch → RawRow → Candidate → Record, all provenance LEGACY |
| Real Mustard normalizer | NOT built — sample required, registry fails closed |
| Schema / migration | 1 additive migration, deployed, 0 destructive statements |
| Builds | API PASS · Web PASS · prisma validate PASS · migrate status clean |
| Git | No commits, no remote operations. HEAD still `7648345b`. |

Full detail: `docs/LOGIC_DATA_INTEGRITY_REPAIR_REPORT.md`
Tracker: `docs/CLAUDE_LOGIC_INTEGRITY_FIX_PROGRESS.md`

**Status: CURRENT LOGIC/DATA-INTEGRITY REPAIRS COMPLETE — ATTENDANCE IMPORT
FOUNDATION COMPLETE — REAL MUSTARD NORMALIZER DEFERRED — MANUAL USER QA REQUIRED.**
