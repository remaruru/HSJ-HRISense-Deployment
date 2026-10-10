# HSJ HRISense — System State Review

**Prepared for**: an independent AI reviewer
**Prepared on**: 2026-09-07
**Repository**: `C:\xampp\htdocs\HRISense`
**Branch / HEAD**: `main` @ `7648345b4c08ec74387ee2b8f67136395c5549b8`
**Working tree**: ~171 uncommitted changes (excluding build output). Nothing has been committed since the last repair pass.

---

> [!IMPORTANT]
> **UPDATE 2026-09-07 — several findings in this document have since been FIXED.**
>
> A logic & data-integrity repair pass addressed SW-01 through SW-16. See
> `docs/LOGIC_DATA_INTEGRITY_REPAIR_REPORT.md` for what changed.
>
> | Finding | Status now |
> |---|---|
> | SW-01 weekly schedule overlapping ranges | **FIXED** (code + 2 live rows repaired) |
> | SW-02 leave double-approval | **FIXED** (guarded transitions, all 4 methods) |
> | SW-03 leave pending clamp | **FIXED** (atomic decrement, anomaly surfaced) |
> | SW-04 training → compliance duplication | **FIXED** (transaction + source-event key) |
> | SW-05 AI attendance population | **FIXED** (shared `workforceScope.ts`) |
> | SW-06 weekly schedule constraint | **ADDED** |
> | SW-07 scheduling authority | **RESOLVED** (`ScheduleResolverService`) |
> | SW-09 attendance `oldValue` audit | **FIXED** |
> | SW-10 attendance update validation | **FIXED** (zod) |
> | SW-11 date-only handling | **VERIFIED + centralised** (`businessDate.ts`) |
> | SW-14 evaluation double-submit | **FIXED** |
> | SW-15 notification idempotency | **FIXED** (`eventId` unique) |
> | SW-16 document orphan files | **FIXED** |
>
> Still open as stated below: **no automated tests** (§4.1), legacy scheduling data
> migration for 62 employees (§4.2), dead models (§4.3), bundle size (§4.5).
> The attendance import foundation now exists; the Mustard normalizer does not.

---

## 0. How to read this document

This is a **state review**, not a sales sheet. It says what is implemented, what is partially implemented, and what is deliberately absent. Two distinctions matter throughout:

| Term | Meaning here |
|---|---|
| **Verified** | Confirmed by reading current source, running the compiler, or running a static validator on 2026-09-07. |
| **Unverified** | Believed correct from the code, but **never exercised in a running browser or against live data**. |

> **The single most important caveat: nothing in this system has automated tests, and the most recent round of repairs has not been manually tested by a human.** Build success is not runtime success. Treat every "complete" below as *source-complete and build-clean*, not *proven working*.

---

## 1. What the system is

**HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision** — an HR information system for Hospicio de San Jose, a Philippine charitable hospital / care institution.

### Stack (verified)

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces — `apps/web`, `apps/api`, `packages/shared` |
| Frontend | React 19, TypeScript, Vite 8, TanStack Router (code-defined route tree), TanStack Query/Table, Tailwind v4, Radix UI, Framer Motion, Recharts, react-hook-form + zod v4, Axios, Sonner, lucide-react, oxlint |
| Backend | Node + TypeScript 5.6, Express 4, Prisma 5.22, MySQL, jsonwebtoken + bcryptjs, zod v3, helmet, cors, express-rate-limit, multer + file-type, exceljs + pdfkit + fast-csv, Brevo REST (via `fetch`), openai SDK |
| Auth | Access JWT (15 min) + DB-backed refresh sessions (`UserSession`, 7-day sliding). Lockout after 5 failures / 15 min. `mustChangePassword` gate. Permission tier carried in the token. |

### Scale (verified 2026-09-07)

| Measure | Count |
|---|---|
| Prisma models | 72 |
| Prisma enums | 54 |
| Applied migrations | 13 (schema reported up to date by `prisma migrate status`) |
| API route declarations | ~230 across 26 routers |
| API services | 41 |
| Frontend page components | 103 |
| Frontend routes | 54 |
| Help Center guides | 79 (all authored) |

---

## 2. Locked project rules — do not propose changes that violate these

These are decisions made with the client, not open design questions. A reviewer proposing to "add" any of these would be proposing a regression.

1. **Exactly three permission tiers.** `FULL` → HR Personnel, `SUPERVISOR` → Supervisor, `STANDARD` → Employee. **There is no Administrator role.** A job title containing "Administrator" does not create an administrative tier.
2. **Payroll is permanently out of scope.** No payslips, e-payslips, salary processing, deductions, overtime *pay*, or night-differential *pay*. Attendance may record time and overtime **hours**; it must never compute **pay**.
3. **The AI feature is named "AI Assistance"** in all user-facing text. Never "AI Workforce Intelligence".
4. **The AI must not decide.** It may not approve/reject leave, hire/reject applicants, discipline employees, alter compliance records, alter evaluation scores, change schedules, or make any final HR decision.
5. **Attendance ingestion chain**: Biometric device → Mustard Seedtime → HR Excel export → HRISense. **The export format has never been supplied.** Do not invent columns, sheet names, punch-pairing rules, biometric rules, lateness formulas, half-day formulas, night-shift calculation, or absence derivation.
6. **No AttendanceRecord ≠ Absent.** These are distinct states and must stay distinct.
7. **Leave ≠ Day Off.** A rest day is schedule; leave is a filed request.
8. **No invented leave policy.** No default entitlement (e.g. "15 days"), no automatic weekend/holiday/rest-day exclusion, no quotas. Balances are exactly what HR records.
9. **Applicants never receive HRISense accounts.** A secure, read-only, login-free application-status link is the correct and implemented substitute.
10. **The HR Officer is the final recruitment authority.** The generic `FULL` tier must not silently override role-specific recruitment authority.

---

## 3. Module-by-module status

Legend: **✅ Complete** (source-complete, build-clean) · **◐ Partial** (works, with a named limitation) · **⛔ Deferred** (intentionally not built) · **✗ Absent**

### 3.1 Authentication & session — ✅ Complete

| Capability | Status | Notes |
|---|---|---|
| Email + password sign-in | ✅ | |
| "Keep me signed in" | ✅ | Chooses `localStorage` vs `sessionStorage`; single shared `tokenStorage` module |
| Forced first password change | ✅ | `mustChangePassword` gate |
| Change password (self-service) | ✅ | Current password always verified; reuse rejected |
| Forgot password → emailed link | ✅ | Crypto token, generic response, token never returned by the API |
| Reset password from link | ✅ | Complexity enforced |
| Sign out | ✅ | Clears both stores |
| Account lockout | ✅ | 5 failures / 15 min, automatic |

**Known weakness**: refresh sessions are **not rotated** on use. A stolen refresh token remains valid for its full 7-day sliding window. This is a deliberate simplification, not an oversight, but a reviewer should flag it if the deployment context warrants rotation.

### 3.2 Employee directory & 201 profile — ✅ Complete

- Directory with search + unit/status filters; **scoping applied in the query**, not the UI (supervisors see self + direct reports only).
- 201 profile tabs: Overview, Personal, Contact, Employment, Schedule, Attendance, Government, Emergency, Documents, Compliance, Leave Balances, Timeline, plus HR-only Evaluations, Training, Medical, Psychological, Account Management.
- Object-level authorization on `GET /employees/:id` via `OrgHierarchyService.canAccessEmployeeRecord` (self / direct subordinate / FULL).
- Profile completion percentage **and** a `missingFields` list.
- Archive / restore, with restore-account-access as a separate decision.

**Recently repaired (2026-09-02, unverified in browser)**: the Documents tab previously crashed the entire profile because `GET /employees/:id` returns documents as `{ id }` only. It now loads from `GET /employees/:employeeId/documents`, which applies per-viewer visibility. Also fixed in the same pass: unauthenticated document download links, protected images failing when "Keep me signed in" was unticked, and four field-contract mismatches (`employmentType`, `permissionTier === 'HR'`, hardcoded probation date, `homePhone` vs `telephoneNumber`).

### 3.3 Employee onboarding — ✅ Complete

- Seven-step wizard with per-step validation.
- Employee + User + document rows created in **one `$transaction`**, with employee-number retry on collision.
- `HSJ-XXXX` generated server-side.
- Supervisor auto-resolved from the job-role hierarchy; PENDING flag when unresolvable (non-blocking).
- Temporary password crypto-generated, hashed before storage, returned exactly once.
- Client-side credential PDF (jsPDF, no DOM rasterisation).
- Draft save/resume; draft closed only after the employee genuinely exists.
- `JobApplication.employeeId` populated on conversion, completing the recruitment chain.

**◐ Limitation**: the welcome email is addressed to the employee's `personalEmail` and reports delivery honestly, **but transactional email is switched off in the local environment** (see §5.2). In its current configuration it will always report "not sent".

### 3.4 Account management (HR) — ✅ Complete

Activate, deactivate, lock, unlock, force password change, reset-and-send-new-credentials. Self-action guards. All audited. Reads real account state (`lockedUntil`, `lastLoginAt`, `mustChangePassword`, `createdAt`).

### 3.5 Organizational chart — ✅ Complete

Draws from `Employee.immediateSupervisorId` — the same field that governs access scoping. Cycle guard present. Manual-override and unconfirmed-supervisor states surfaced.

### 3.6 Recruitment (internal) — ✅ Complete

Job openings (create / edit / publish / close / mark filled / archive), applicant pipeline with stage transitions, applicant documents, interview scheduling + reschedule + cancel + outcome, internal notes, applicant communications with preview, convert-hired-to-onboarding-draft.

**Design decision worth noting**: automatic applicant email is **off by default** for status changes and interview events. Only the application-received acknowledgement is automatic. This is deliberate — an applicant is never emailed as a side effect of an internal pipeline move. Idempotency is enforced by a unique `eventId` per communication.

### 3.7 Public careers & application status — ✅ Complete

- `/careers`, opening detail, application form with uploads — no account required.
- Rate-limited (`PUBLIC_CAREERS_*`, `PUBLIC_APPLICATION_*` env vars).
- **Application status link**: stateless HMAC token (`v1.<b64url(id)>.<hmac>`), constant-time verification, read-only, **no schema change and nothing stored**. Rotating `APPLICATION_STATUS_TOKEN_SECRET` (or its `JWT_SECRET` fallback) invalidates all outstanding links.
- This is the only router without `router.use(authenticate)` — correct and intentional.

### 3.8 Time & attendance — ◐ Partial (by design)

| Capability | Status |
|---|---|
| Daily monitoring, calendar, day detail drawer | ✅ |
| HR organisation filters / supervisor team tabs | ✅ |
| Attendance tally with per-employee totals + drilldown | ✅ |
| Export Excel / PDF / CSV | ✅ |
| `NO_RECORD` kept distinct from absence | ✅ |
| **Excel import processing** | **⛔ Deferred** |

The import modal exists and is honest: it states the official Mustard Seedtime format has not been received and leaves **Process Import** disabled. `NO_RECORD` is a **runtime-only marker**, not a Prisma enum value — worth verifying that this is handled consistently wherever attendance is aggregated.

**Also noted**: `AttendanceService.getSchedules` carries an explicit comment that *"Date-specific work schedule management is NOT implemented in this phase."* It reads the legacy `Employee.workSchedule` enum. See §4.2.

### 3.9 Work schedules & shifts — ✅ Complete (with data-model debt)

- Shift Catalog (create / edit / deactivate), shared across all schedules.
- Effective-dated weekly schedules with three-state days: `UNCONFIGURED` / `DAY_OFF` / `WORKING`.
- Multiple shifts per day, per-day customisation, overlap validation shared between the live problem list and save.
- Schedule history log.
- The editor modal was redesigned on 2026-09-02 (UX only — no business-rule change).

**See §4.2 for the three-parallel-scheduling-models problem.**

### 3.10 Holiday calendar — ✅ Complete

Shared calendar; HR adds and deactivates (named deactivation, not deletion). Visible to all tiers.

### 3.11 Leave management — ✅ Complete

Two-stage workflow, fully implemented:

```
PENDING ──(supervisor endorses)──> FOR_REVIEW ──(HR decides)──> APPROVED / REJECTED
   │                                    │
   └──────── CANCELLED (by filer) ──────┘
```

Route-level authorization verified: `endorse` = `['SUPERVISOR','FULL']`, `approve` = `['FULL']` only, `reject` = `['SUPERVISOR','FULL']`, `cancel` = any authenticated (service-scoped), `PUT /leave/balances` = `['FULL']`.

Balance accounting: filing reserves days as *pending*; approval converts to *used*; cancel/reject releases. **No default entitlement is assumed** — balances are only what HR records.

### 3.12 Evaluations — ✅ Complete

Templates with weighted criteria → cycles with scope → per-employee assignments routed along the reporting line → evaluator drafts and submits → HR finalises → employee sees the finalised result. Status progression: Not Started / In Progress / Submitted / Completed.

### 3.13 Training & seminars — ✅ Complete

Activities, participant rosters, participation status (Completed / Did Not Attend / Excused), certificate upload, optional link to a compliance requirement, employee-facing training history.

### 3.14 Compliance — ✅ Complete

Requirements with category and scope (all / unit / department / role / named employees), optional expiry tracking with reminder windows, per-employee records with attached evidence and a review step, and a Needs Attention worklist.

**Architecturally notable**: compliance status (`MISSING` / `NEEDS_REVIEW` / `VALID` / `EXPIRING_SOON` / `EXPIRED`) is **derived at query time**, not stored. This is a deliberate correctness choice — an expiry can never be stale because a scheduled job failed. A reviewer should sanity-check the cost of this at scale.

### 3.15 Medical & psychological records — ✅ Complete

HR-managed. Employee sees their own records and the summary written for them. **Supervisors have no access at all.** Confidential HR notes are separated from employee-visible summaries. Documents stream through authenticated routes only. Access is audited.

### 3.16 Announcements — ✅ Complete

Draft → audience targeting (hospital / unit / department / role) → audience preview → attachments → publish now or scheduled. **Recipient snapshot is taken at publish time**, so read tracking always refers to the people actually addressed. Read receipts and recipient statistics.

### 3.17 Notifications — ✅ Complete

Real notification service; unread counts are genuine; deep-links to the referenced record; mark-read and mark-all-read. Creation never throws (a failed notification cannot roll back the business action that caused it).

### 3.18 Reports — ✅ Complete

Seven reports: headcount, attendance, leave requests, compliance standing, training, evaluations, recruitment pipeline. Date-range and organisation filters. Excel / PDF / CSV export.

**Deliberately excluded**: turnover. The formula and period were never confirmed, and the service header documents that omission rather than guessing.

### 3.19 AI Assistance — ✅ Complete

Two-layer design worth understanding before reviewing:

1. **`workforce-facts.service.ts`** builds a deterministic fact sheet by SQL aggregation — headcount, attendance, leave, compliance, training, evaluations, recruitment. It carries an explicit doc block listing what is *not* included.
2. **`ai.service.ts`** passes that fact sheet to the model with a strict system prompt: *"You are ADVISORY"*, *"Never predict attrition"*, *"Never discuss salary, payroll, payslips, or compensation"*, and an explicit instruction that `daysWithNoImportedRecord` does **not** mean anyone was absent.

The figures render **before and independently of** any AI call, so the page is fully useful with the AI provider switched off. `OPENAI_API_KEY` is optional in the env schema. FULL tier only.

### 3.20 Activity history (audit) — ✅ Complete

FULL only, at both route and UI level. Filters by action, actor, date range. `redactAuditJson` strips password / token / secret / apikey / authorization / hrnotes / hrconfidentialnotes / confidential / diagnosis / findings, and summarises nested objects. Per-employee view available on the profile Timeline tab.

### 3.21 Settings — ✅ Complete

Deliberately minimal: profile shortcut, change password, light/dark (per-device), notifications shortcut. Honest text stating there are no email notification preferences to configure.

### 3.22 Help Center — ◐ Partial (text complete, assets deferred)

Verified by running `apps/web/scripts/validate-help-registry.ts` on 2026-09-07:

```
Total guides: 79   READY: 79   DRAFT: 0   METADATA_ONLY: 0
Categories: 17
FULL: 75   SUPERVISOR: 34   STANDARD: 27   PUBLIC: 3
PASS — no registry defects found.
```

- Role filtering applied **before** search; a user never sees a guide for a page they cannot open.
- Registry validator rejects: duplicate ids/slugs, roleless guides, READY-without-content, unknown categories, missing keywords, and related-guide links that are broken, not READY, or unreachable for the linking guide's own audience.
- 10 contextual **Help** links on workflow pages; each renders nothing when the role cannot read the target.
- Print support.

**⛔ Deferred**: screenshot assets. None captured, none fabricated, none referenced. The screenshot architecture (`HelpScreenshot`, `HelpScreenshotModal`, zoom viewer, metadata types) is intact and unused; guides render cleanly without images — no broken frames, no "coming soon" placeholders.

---

## 4. Cross-cutting findings — where a reviewer should focus

### 4.1 ✗ No automated tests whatsoever — **highest-priority gap**

Verified: **zero** test files, and **no test script** in any of the three `package.json` files. No unit tests, no integration tests, no E2E, no fixtures, no CI configuration.

Every claim of correctness in this document rests on reading source and compiling it. The consequences:

- The two-stage leave state machine and its balance accounting have never been asserted by a test.
- Authorization scoping (the security boundary of the whole system) is enforced in service `where` clauses and policy classes with **no test proving a supervisor cannot read a non-subordinate's record**.
- Derived compliance status, attendance aggregation, and the seven report builders are pure functions over data — ideal test targets, entirely untested.

**Recommendation for the reviewer**: this is where to start. Suggest a minimal harness (Vitest for both workspaces) plus authorization-boundary tests first, then leave-state and compliance-derivation tests.

### 4.2 Three parallel scheduling representations — structural debt

Verified to coexist in the schema and in code:

| Representation | Models | Runtime usage |
|---|---|---|
| Legacy enum | `Employee.workSchedule` (`WorkSchedule` enum) | Read by `AttendanceService.getSchedules` |
| Legacy template system | `ScheduleTemplate`, `ScheduleTemplateDay`, `EmployeeScheduleAssignment` | 2 files / 1 file |
| **Current system** | `ShiftDefinition`, `EmployeeWeeklySchedule`, `EmployeeWeeklyScheduleDay`, `EmployeeWeeklyScheduleShift` | 3 files |

All three are live in the schema; onboarding still writes a `scheduleTemplateId`, while the profile editor writes weekly schedules. **This is the most likely source of a future correctness bug** — two sources of truth for "what days does this person work". Consolidation was identified but deferred because it needs a migration and a data-backfill decision from the client.

### 4.3 13 schema models with no runtime usage

Verified to have **zero** `prisma.<model>` references anywhere in `apps/api/src`:

`SupervisionLink` · `Payslip` · `LegacyMedicalRecord` · `LegacyPsychologicalRecord` · `LegacyComplianceRequirement` · `LegacyComplianceDocument` · `Training` · `TrainingAttendee` · `ActivityAttendance` · `AIConversation` · `ActivityLog` · `UploadedFile` · `EmailVerificationToken`

Context: `SupervisionLink` is superseded by `Employee.immediateSupervisorId`; the `Legacy*` models predate the current compliance/health design; `Training`/`TrainingAttendee` predate `TrainingActivity`/`TrainingParticipant`; `Payslip` is the residue of the removed payroll scope. They were retained rather than dropped because removing them requires a migration against a database holding real data.

**A reviewer should decide**: keep as historical ballast, or plan a cleanup migration. Note that `Payslip` remaining in the schema is arguably a scope-boundary risk — it is the one table that could be mistaken for payroll capability.

### 4.4 Security posture — verified good, with named residual risks

**Verified in place**: `helmet`, `cors` bound to `CLIENT_URL`, `express-rate-limit` (with a dev ceiling rather than a bypass), env-driven `TRUST_PROXY` (explicitly *not* blind `true`), 10 MB JSON limit, `authenticate` on every router except the intentionally public one, `authorize()` used at 15 route sites, bcrypt hashing, crypto-random password and token generation, multer with MIME allowlist + forbidden-extension list + random stored filenames, audit redaction.

**Residual risks a reviewer should weigh**:

| Risk | Detail |
|---|---|
| **Secrets in git history** | `.env` was committed at some point in the repository's history. `.gitignore` has been hardened and `docs/EXTERNAL_SECRET_ROTATION_REQUIRED.md` lists the variable **names** requiring rotation. **This cannot be fixed locally** — it needs history rewriting and provider-side key rotation, and GitHub access is frozen for this project. |
| Refresh tokens not rotated | §3.1 |
| Object-level authz is per-handler | `canAccessEmployeeRecord` is called explicitly in handlers rather than enforced by a global middleware. Correct today; a new handler could forget it. Worth a lint rule or a shared guard. |
| Derived-status cost | Compliance status is computed per request across all in-scope employees (§3.14). Correct, but unprofiled. |

### 4.5 Frontend bundle — 2.78 MB single chunk

Verified from `apps/web/dist`. No code-splitting; every route ships on first load. Vite warns on every build. There is also a lazily-imported 190 KB `html2canvas` chunk pulled in by jsPDF's optional `.html()` path — it is never called by application code, so it does not load at runtime.

For a hospital LAN this may be acceptable; on constrained connections it is not. Route-level `lazy()` on the TanStack route tree is the obvious first move.

### 4.6 Environment configuration

`apps/api/src/config/env.ts` validates a required core with zod and exits on failure: `DATABASE_URL`, `JWT_SECRET` (min 8), `REFRESH_TOKEN_SECRET` (min 8), plus defaulted `PORT`, `NODE_ENV`, `CLIENT_URL`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `UPLOAD_DIR`, `MAX_FILE_SIZE`, `OPENAI_MODEL`, `AI_PROVIDER`. `OPENAI_API_KEY` is optional.

A second tier of variables is read directly from `process.env` without validation: `ENABLE_TRANSACTIONAL_EMAILS`, `BREVO_API_KEY`, `DEFAULT_FROM_NAME`, `DEFAULT_FROM_EMAIL`, `TRUST_PROXY`, `APPLICATION_STATUS_TOKEN_SECRET`, the `RECRUITMENT_*` family, the `PUBLIC_*_RATE_LIMIT_*` family, `ALLOW_LOCAL_CLEANUP`.

**Minor inconsistency worth flagging**: two configuration mechanisms for the same concern. Folding the second tier into the zod schema would make misconfiguration fail loudly at boot instead of silently at use.

---

## 5. Known-incomplete, ranked

### 5.1 ⛔ Attendance import processing — external input required

The single largest functional gap. Blocked on the hospital supplying one real Mustard Seedtime export file. **Do not let a reviewer "solve" this by inventing a format** — a wrong guess silently mis-pairs punches or marks present staff absent, which is worse than the current honest placeholder.

### 5.2 ◐ Transactional email is not enabled locally

`apps/api/.env` has no `ENABLE_TRANSACTIONAL_EMAILS` entry and no `DEFAULT_FROM_EMAIL`. Development defaults to **off**, so every send is simulated and reported as "not sent". `BREVO_API_KEY` is present.

To enable: set `ENABLE_TRANSACTIONAL_EMAILS=true` and a `DEFAULT_FROM_EMAIL` that is **verified in the Brevo account** (an unverified sender is rejected by the provider). The code path itself is complete and reports delivery honestly.

Note: the "redirect all mail to a test address" switch was **deliberately removed** from the credential-email provider. Redirecting a credential message means the system reports "sent" while the employee receives nothing and the password lands in another inbox. Do not let a reviewer reinstate it.

### 5.3 ⛔ Help Center screenshots

Text authoring is complete; no images captured. Guides are designed to read correctly without them.

### 5.4 ✗ No manual QA of the most recent repairs

Four user-reported runtime bugs were fixed on 2026-09-02 (welcome-email recipient, credential-PDF UI freeze, Documents-tab crash, weekly-schedule modal UX), along with eight further defects found while tracing them. **None of this has been exercised in a browser since.** It compiles and passes static validation; that is all.

### 5.5 Open questions requiring client confirmation

| Question | Impact |
|---|---|
| Job-role count: system has 46, the source spreadsheet reportedly lists 48 | Org hierarchy completeness; needs `JOB ROLES.xlsx` |
| Chargeable leave-day rule | Currently **inclusive calendar days**. Weekends, holidays and rest days are *not* excluded, pending Hospicio confirmation. Deliberately not guessed. |
| Scheduling-model consolidation | §4.2 — needs a migration and a backfill decision |

### 5.6 ⛔ External / non-local

| Item | Why it cannot be done here |
|---|---|
| Secret rotation + git history rewrite | Requires provider consoles and GitHub access; both frozen for this project |
| `prisma generate` refresh | Last attempt failed with `EPERM` renaming the Windows query engine — the file is locked by the running dev server. Not a schema problem; the existing client is current and the API compiles against it. Re-run after stopping the dev server. |

---

## 6. Verification status as of 2026-09-07

| Check | Result | Date |
|---|---|---|
| `apps/api` build (`tsc`) | **PASS** | 2026-09-07 |
| `apps/web` typecheck (`tsc --noEmit`) | **PASS** | 2026-09-07 |
| `apps/web` build (`tsc -b && vite build`) | **PASS** | 2026-09-02 |
| `prisma validate` | **PASS** | 2026-09-02 |
| `prisma migrate status` | 13 migrations, schema up to date | 2026-09-02 |
| `prisma generate` | **BLOCKED** — Windows file lock | 2026-09-02 |
| Help Center registry validator | **PASS** — 79 guides, 17 categories, 0 defects | 2026-09-07 |
| `oxlint` on edited areas | Warnings only; 0 errors | 2026-09-02 |
| Automated test suite | **DOES NOT EXIST** | — |
| Browser / E2E testing | **NEVER PERFORMED** | — |
| Live email delivery | **NEVER PERFORMED** | — |
| Paid AI provider call | **NEVER PERFORMED** | — |

---

## 7. Suggested focus for the reviewing AI

Ranked by expected value:

1. **Authorization boundary audit.** Every service that returns employee-scoped data — confirm the `where` clause genuinely constrains a `SUPERVISOR` to `immediateSupervisorId = self`, and a `STANDARD` to self. This is the system's security perimeter and it has no tests.
2. **Propose a minimal test harness**, then authorization tests, then leave-state-machine and compliance-derivation tests.
3. **Adjudicate the scheduling-model overlap** (§4.2). Which representation is authoritative, and what is the migration path?
4. **Attendance aggregation consistency** — `NO_RECORD` is a runtime marker, not a database enum. Verify it is handled identically in daily monitoring, tally, dashboard and reports.
5. **Transaction boundaries.** `EmployeeService.create` is correctly atomic. Check whether other multi-write flows (recruitment conversion, evaluation cycle creation, announcement publish + recipient snapshot) need the same treatment.
6. **N+1 and cost review** on derived compliance status and the report builders.
7. **Bundle splitting** (§4.5).
8. **Dead-model cleanup plan** (§4.3), with `Payslip` prioritised as a scope-boundary concern.

### What *not* to spend review effort on

- Proposing payroll, an Admin role, AI decision-making, or an invented attendance format — all are locked decisions (§2).
- Reinstating a test-email redirect on credential mail (§5.2).
- "Fixing" derived compliance status by caching it — that would reintroduce the staleness the current design exists to prevent. Optimise it if profiling justifies it, but keep the derivation authoritative.
- Rewriting the Help Center registry structure. It is validated, split per domain, and enforced by a script.

---

## 8. Companion documents in `docs/`

| File | Contents |
|---|---|
| `CLAUDE_HRISENSE_MASTER_SYSTEM_REVIEW.md` | Pre-repair baseline audit, 47 sections. Historical — carries a state banner. |
| `CLAUDE_FIX_ALL_EXECUTION_REPORT.md` | Finding-by-finding repair table, including the post-QA addendum (PQ-1 … PQ-12). |
| `CLAUDE_FIX_ALL_PROGRESS.md` | Phase board and continuation checkpoints. |
| `CLAUDE_POST_QA_REPAIR_REPORT.md` | The four user-reported bugs, root causes and fixes, in detail. |
| `HELP_CENTER_FUNCTION_INVENTORY.md` | Function-to-guide coverage map; registry listing generated from the live registry. |
| `HELP_CENTER_ARCHITECTURE.md` | Help Center technical architecture. |
| `HELP_CENTER_BROWSER_AUDIT.md` | Historical browser audit (2026-08-26), superseded — carries a status banner. |
| `EXTERNAL_SECRET_ROTATION_REQUIRED.md` | Variable **names** requiring rotation, and the sequence. No values. |
| `ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` | Full development history, with superseded counts marked. |

---

## 9. One-paragraph summary

HRISense is a source-complete, build-clean HR system covering authentication, employee records and onboarding, organisational hierarchy, recruitment including a public applicant channel, attendance monitoring, effective-dated scheduling, a two-stage leave workflow, evaluations, training, compliance with derived status, health records with an enforced privacy boundary, announcements, notifications, reports, an advisory-only AI layer, an audit trail, and a 79-guide role-aware Help Center. Its distinguishing characteristic is a consistent refusal to fabricate: missing attendance is reported as missing rather than as absence, no leave entitlement is assumed, the attendance import stays disabled rather than guessing a file format, and the AI is structurally prevented from deciding anything. Its three material weaknesses are the complete absence of automated tests, three coexisting scheduling representations, and the fact that the most recent round of repairs has never been exercised in a browser.

---

*Prepared by reading the current source on 2026-09-07. No code was modified in producing this review.*
