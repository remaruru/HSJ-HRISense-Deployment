# Full System Runtime QA — Progress Tracker

**Started**: 2026-09-08
**Repository**: `C:\xampp\htdocs\HRISense`
**Branch**: `main` · **HEAD at start**: `7648345b4c08ec74387ee2b8f67136395c5549b8`
**Git write operations**: NONE (frozen)

---

## Current status

| | |
|---|---|
| **Current phase** | REPAIR PASS COMPLETE (2026-09-09) — see `FULL_SYSTEM_RUNTIME_QA_REPAIR_REPORT.md` |
| **Server status** | API :5000 running under QA control (email SIMULATED, verified) · Web :3000 running |
| **Tests completed** | 300 (QA pass) + 118 (repair retest & phase completion) = **418** |
| **PASS / FAIL / BLOCKED / UNVERIFIED** | **404 / 0 / 1 / 0** (all 17 QA defects resolved or explicitly deferred) |
| **Exact continuation point** | Repair + completion pass finished. All previously untested phases now exercised. Outstanding: 47 employees need a weekly schedule configured (CLIENT POLICY), leave-filing against a year with no balance row (CLIENT POLICY), avatar-initials contrast (LOW) |

---

## Phase board

| Phase | Item | Status |
|---|---|---|
| 0 | QA safety, backup, baseline counts, account discovery | DONE |
| 1 | Authentication | DONE (28 PASS / 2 FAIL) |
| 2 | Employee onboarding + regressions | DONE (31 PASS) |
| 3 | 201 profile tabs + documents | DONE (31 PASS) |
| 4 | Authorization boundary | DONE (39 PASS / 1 FAIL) |
| 5 | Account management | DONE (10 PASS) |
| 6 | Organizational hierarchy | DONE (7 PASS) |
| 7 | Work schedules | DONE (9 PASS) |
| 8 | Holidays | DONE (4 PASS) |
| 9 | Attendance | DONE (16 PASS) · import foundation pending |
| 10 | Leave (+ concurrency) | DONE (18 PASS) |
| 11 | Performance evaluations | DONE (7 PASS / 2 FAIL) |
| 12 | Training to compliance | DONE (7 PASS) |
| 13 | Compliance workflow | DONE (7 PASS — all 5 derived statuses) |
| 14 | Medical / psychological CRUD + privacy | DONE (13 PASS) |
| 15 | Recruitment | NOT STARTED |
| 16 | Public careers | DONE (10 PASS) |
| 17 | Applicant to employee conversion | DONE (5 PASS) |
| 18 | Announcements | DONE (9 PASS) |
| 19 | Notifications | DONE (7 PASS) |
| 20 | Reports + cross-module consistency | DONE (30 PASS) |
| 21 | AI assistance + payload security | DONE (16 PASS / 1 FAIL) |
| 22 | Audit history + redaction | DONE (12 PASS) |
| 23 | Settings | DONE (5 PASS) |
| 24 | Help Center | DONE (11 PASS) |
| 25 | UI/UX system QA | DONE (9 PASS / 2 FAIL) |
| 26 | Error / offline states | DONE (9 PASS) |
| 27 | Concurrency / idempotency | DONE (across phases 10,11,12,17) |
| 28 | Database integrity after QA | DONE (15/15 CLEAN) |
| 29 | Static validation | DONE |

---

## Phase 0 — QA safety (evidence)

### Git state (read-only commands only)

```
git branch --show-current  -> main
git rev-parse HEAD         -> 7648345b4c08ec74387ee2b8f67136395c5549b8
git log -1 --oneline       -> 7648345b chore(repo): mirror complete laptop-ready HRISense workspace
```

Uncommitted changes present and PRESERVED. Nothing staged.

### Database status

- MariaDB 10.4.32 via XAMPP, `localhost:3306`, database `hrisense_db`.
- Sibling databases present (untouched): `hrisense_backup_test_db`, `hrisense_baseline_test_db`,
  `hrisense_migration_cutover_test_db`, `hrisense_migration_dev_db`, `hrisense_temp_db`.

### Backup (NEW — no existing backup overwritten)

```
hrisense_db_backup_pre_full_system_qa_20260908_065608.sql   617,684 bytes
```

Verified: 76 `CREATE TABLE`, 41 `INSERT INTO`, correct mysqldump trailer.
13 pre-existing backup files left untouched.

### Baseline table counts (before any QA action)

| Table | Count | | Table | Count |
|---|---|---|---|---|
| users | 62 | | employee_documents | 4 |
| employees (all) | 62 | | notifications | 0 |
| employees (state=ACTIVE, not deleted) | **47** | | audit_logs | 284 |
| employees soft-deleted (`deletedAt`) | **15** | | job_openings | 1 |
| attendance_records | 20 | | applicants | 4 |
| leave_requests | 3 | | announcements | 4 |
| leave_balances | 45 | | announcement_recipients | 0 |
| employee_weekly_schedules | 3 | | onboarding_drafts | 2 |
| employee_schedule_assignments | 125 | | medical_records | 0 |
| shift_definitions | 6 | | psychological_records | 0 |
| schedule_templates | 18 | | units | 8 |
| organization_calendar_entries | 55 | | departments | **0** |
| evaluation_templates / cycles / assignments | 0 / 0 / 0 | | job_roles | 46 |
| training_activities / participants | 0 / 0 | | user_sessions | 92 |
| compliance_requirements | 6 | | employee_compliance_records | 0 |

**Schema note that corrects an earlier assumption**: `employees.employmentStatus` is an
employment *type* enum (`REGULAR`/`PROBATIONARY`/`CONTRACTUAL`/`CASUAL`/`PART_TIME`) — all 62 rows
are `REGULAR`. The active/inactive flag is `employees.employmentState`
(`ACTIVE`/`ON_LEAVE`/`RESIGNED`/`TERMINATED`/`RETIRED`), and archival is `deletedAt`.
**Active workforce = 47.** Any module reporting 62 is counting soft-deleted employees.

**Baseline observation (to verify at runtime, not yet a bug):** `departments` is empty while
`units` has 8 rows — department-scoped filters/reports have nothing to scope by.

### Permission tiers

`permissionTier` lives on `job_roles`, not on `users`. Distribution: FULL 2, SUPERVISOR 13, STANDARD 31.
There is no Admin tier — confirmed at schema level (`enum('FULL','SUPERVISOR','STANDARD')`).

### QA accounts identified (passwords NOT recorded here)

Dedicated local dev accounts already exist, created by
`apps/api/src/scripts/seed_dev_accounts.js`, which documents a local-only credential convention.
No new QA users were needed for role coverage.

| Purpose | Account | Employee # | Job role | Tier |
|---|---|---|---|---|
| FULL — HR Officer (recruitment final authority) | `hr@gmail.com` | DEV-HRD-001 | Human Resource Officer | FULL |
| FULL — HR Assistant (NOT HR Officer) | `hrassistant@gmail.com` | DEV-HRD-002 | Human Resource Assistant/Staff | FULL |
| Supervisor A | `kitchensupervisor@gmail.com` | DEV-GSS-001 | Kitchen Supervisor | SUPERVISOR |
| — Employee A (reports to Supervisor A) | `kitchenstaff@gmail.com` | DEV-GSS-002 | Kitchen Staff | STANDARD |
| Supervisor B | `janitorialsupervisor@gmail.com` | DEV-GSS-019 | Janitorial Supervisor | SUPERVISOR |
| — Employee B (reports to Supervisor B) | `janitorialstaff@gmail.com` | DEV-GSS-018 | Janitorial Staff | STANDARD |

Employee A id `01e51ead-a99c-470f-8a99-f5c171d5d05c` · Employee B id `bd18ea80-8fe6-4f7c-b411-480a5b1f05d6`

**Do not use for destructive tests:** `HSJ-0016` (personal details removed from this copy) —
this is the record created during the earlier onboarding repair and belongs to the repo owner.

### External-service safety — ACTION REQUIRED BEFORE RUNTIME TESTS

`apps/api/.env` currently has, with a real Brevo API key present:

```
RECRUITMENT_EMAIL_SEND_ENABLED=true
ENABLE_TRANSACTIONAL_EMAILS=true
```

The API process already running on :5000 was started with those settings, so onboarding
submission or an applicant status change would send **real** email. `.env` will NOT be modified
(it is the owner's deliberate configuration). Instead the API is restarted with process-level
overrides, which win because `dotenv.config()` is called without `override: true`:

```
ENABLE_TRANSACTIONAL_EMAILS=false
RECRUITMENT_EMAIL_SEND_ENABLED=false
RECRUITMENT_EMAIL_PROVIDER=DEVELOPMENT
RECRUITMENT_AUTO_EMAIL_APPLICATION_RECEIVED=false
```

Verified in source: `apps/api/src/config/env.ts:6` loads dotenv without `override`, and the
`superRefine` block only demands provider settings when `ENABLE_TRANSACTIONAL_EMAILS` is true.
`apps/api/src/config/recruitment.config.ts` treats `emailEnabled=false` as SIMULATED.

`OPENAI_API_KEY` is the placeholder literal `your...`, so the AI provider is already effectively
disabled — this is the provider-disabled path Phase 21 must exercise. No paid calls will be made.

---

## QA records created (running list)

| # | Record | Table | Disposition |
|---|---|---|---|
| 1 | leave_balance VACATION 2026, employee DEV-GSS-002 | `leave_balances` | created via API — decide at cleanup |
| 2 | leave_balance SICK 2026, employee DEV-GSS-002 | `leave_balances` | created via API — decide at cleanup |
| 3 | LeaveRequest `dc24b241-af41-4cc3-bc01-a23fb98419d2` VACATION 2026-10-05..07 APPROVED, reason `QA_LEAVE_TEST end-to-end workflow` | `leave_requests` | QA-tagged |
| 4 | LeaveRequest `fdd440ba-4bbc-421c-b4d9-44487dc12437` SICK 2026-11-03 REJECTED, reason `QA_LEAVE_TEST non-overlap` | `leave_requests` | QA-tagged |
| 5 | LeaveRequest `5daea2c9-0cc5-4af3-8c78-87c7565a188c` SICK 2026-11-20..21 CANCELLED, reason `QA_LEAVE_TEST cancel path` | `leave_requests` | QA-tagged |
| 6 | **Employee HSJ-0017 "QATest Onboarding"** (id `e086dc3c-ab44-476f-8965-cd5afb266076`) | `employees` | QA-tagged |
| 7 | User `qa.onboarding.work@example.com` for HSJ-0017 | `users` | QA-tagged |
| 8 | schedule assignment for HSJ-0017 (`BATCH-ASSIGN-1788825888135`) | `employee_schedule_assignments` | QA-tagged |
| 9 | 3 weekly schedules for HSJ-0017 (Sep 1 / Sep 15 / Oct 1) + their day + shift rows | `employee_weekly_schedules`, `employee_weekly_schedule_days`, `employee_weekly_schedule_shifts` | QA-tagged |
| 10 | Compliance requirement `QA_COMPLIANCE_TEST BLS Certification` + its employee scope | `compliance_requirements_new`, `compliance_requirement_scopes` | QA-tagged |
| 11 | Training activity `QA_TRAINING_TEST Basic Life Support Refresher` + 1 participant | `training_activities`, `training_participants` | QA-tagged |
| 12 | Auto-generated compliance record `TRN-D2C27713` | `employee_compliance_records` | QA-tagged (side effect) |
| 13 | Evaluation template `QA_EVAL_TEST Performance Template` + 2 criteria | `evaluation_templates`, `evaluation_criteria` | QA-tagged |
| 14 | Evaluation cycle `QA_EVAL_TEST Cycle 2026` + scope + 1 assignment + 2 responses | `evaluation_cycles`, `evaluation_cycle_scopes`, `evaluation_assignments`, `evaluation_responses` | QA-tagged |
| 15 | 4 attendance records `qa-att-0001..0004` for HSJ-0017 (`QA_ATT_TEST` remarks) | `attendance_records` | QA-tagged |
| 16 | 4 uploaded documents for HSJ-0017 (`QA_DOC_TEST` notes) + their files under `apps/api/uploads` | `employee_documents` + disk | QA-tagged |
| - | notifications + audit_logs generated by the above | `notifications`, `audit_logs` | side effects of the QA leave flow |

Temporarily modified and **restored**: `driver@gmail.com` (password hash re-applied from
snapshot, `failedLoginAttempts=0`, `lockedUntil=NULL`, `mustChangePassword=0`,
`password_reset_tokens` rows deleted) — restoration verified by a successful login with its
original password.

## Bugs found

_None yet._

---

## Phase 1 — Authentication: COMPLETE (28 PASS, 2 FAIL)

Servers restarted under QA control. **Email safety proven at runtime**, API log line:

```
[BREVO_TRANSACTIONAL] Simulation mode: "HRISense - Password Reset Request" to driver@gmail.com
was NOT sent. Set ENABLE_TRANSACTIONAL_EMAILS=true ... to deliver for real.
```

No real email left the machine during QA.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| AUTH-01 | Valid login (all 6 QA roles) | 200 + tokens | 200, correct `permissionTier` in JWT for all 6 | PASS |
| AUTH-02 | Wrong password | 401 generic | 401 "Invalid email or password" | PASS |
| AUTH-03 | Unknown email | 401, identical message (no enumeration) | identical to AUTH-02 | PASS |
| AUTH-04 | Missing password field | 400 validation | 400 field=password | PASS |
| AUTH-05 | Non-email string | 400 validation | 400 field=email | PASS |
| AUTH-06 | 5 failed attempts to lockout | lock + 403 | attempts 1-4 = 401, 5th = 403 "locked for 15 minutes" | PASS |
| AUTH-06b | Correct password while locked | denied | 403 "Try again in 15 minute(s)" | PASS |
| AUTH-07 | Lockout expiry path | login succeeds once lockedUntil passes | 200 + token | PASS |
| AUTH-08 | Change password, wrong current | 401 | 401 "current password you entered is incorrect" | PASS |
| AUTH-09 | **Change password, confirmPassword mismatched** | **400 rejected** | **200 "Password changed successfully" — password WAS changed** | **FAIL (BUG-001)** |
| AUTH-11 | Weak new password (3 chars) | 400 | 400 min-8 | PASS |
| AUTH-13 | Reuse current password (8+ chars) | 400 | 400 "must be different from your current password" | PASS |
| AUTH-14 | Complexity policy (all lowercase) | 400 | 400 upper+lower+number+special required | PASS |
| AUTH-15 | change-password without token | 401 | 401 | PASS |
| AUTH-16 | forgot-password, existing account | generic 200, token row created | 200 generic, exactly 1 token row | PASS |
| AUTH-17 | forgot-password, unknown email | identical generic 200, no token row | identical, 0 rows | PASS |
| AUTH-18 | reset with invalid token | 400 | 400 generic | PASS |
| AUTH-19 | reset with tampered token | 400 | 400 generic | PASS |
| AUTH-20 | reset with expired token | 400 | 400 generic | PASS |
| AUTH-21 | reset with valid token | 200 + password changed | 200, usedAt stamped | PASS |
| AUTH-22 | reuse a spent reset token | 400 | 400 generic | PASS |
| AUTH-23 | session revocation on reset | all sessions revoked | all rows isRevoked=1; old refresh token 401 | PASS |
| AUTH-24 | **Refresh token immediately after login** | **200 + new access token** | **401 "Invalid or expired refresh token"** | **FAIL (BUG-004)** |
| AUTH-25 | GET /me valid token | 200 + permissions | 200, OWN-scoped permission list | PASS |
| AUTH-26 | /me without token | 401 | 401 "Authentication token required" | PASS |
| AUTH-27 | /me with garbage token | 401 | 401 "Invalid access token" | PASS |
| AUTH-28 | **Forged JWT signed with an attacker secret** | 401 | 401 "Invalid access token" | PASS |
| AUTH-29 | logout | 200 | 200 | PASS |
| AUTH-30 | Login, "Keep me signed in" UNCHECKED | tokens in sessionStorage only | sessionStorage=[accessToken,refreshToken]; localStorage=[theme] | PASS |
| AUTH-31 | Login, "Keep me signed in" CHECKED | tokens in localStorage | localStorage=[accessToken,refreshToken,hrisense_remember_me,theme]; sessionStorage empty | PASS |

`driver@gmail.com` was used for all destructive auth tests and was fully restored
(password hash re-applied from snapshot, failedLoginAttempts=0, lockedUntil=NULL,
mustChangePassword=0, reset-token rows deleted). Login with its original password
re-verified = 200.

Access token TTL = 8h, refresh TTL = 7d (from .env). JWT payload carries only
userId / email / roleCode / permissionTier / employeeId — no sensitive fields.

---

## Bugs found so far

### BUG-001 — confirmPassword is accepted but never validated by the API
**LOW · FUNCTIONAL**

`changePasswordSchema` (`apps/api/src/controllers/auth.controller.ts:33`) declares only
currentPassword / oldPassword / newPassword. A request with
newPassword `QaTemp#2026x` and confirmPassword `Different#2026x` returned
**200 "Password changed successfully"** and the password was set to newPassword
(proved by the following login with the old password failing with 401).

Mitigating: the web UI does validate it (`ChangePasswordPage.tsx:43`, submit disabled on
mismatch) and the current password is still required — so this is a contract /
defence-in-depth gap, not an exploitable hole. Any non-browser client is unprotected.

### BUG-002 — Dark mode: every --color-* design token resolves to its LIGHT value
**HIGH · UX / ACCESSIBILITY · system-wide**

Measured in-browser with `html.dark` active, inside `.authenticated-app`:

| token | `--x` (correct) | `--color-x` (what utilities actually use) |
|---|---|---|
| foreground | `#f8fafc` | **`#0f172a`** |
| background | `#080f1d` | **`#f8fafc`** |
| surface | `#111c30` | **`#ffffff`** |
| surface-2 | `#17233a` | **`#f1f5f9`** |
| border | `#475569` | **`#334155`** |
| border-soft | `#24324a` | **`#e2e8f0`** |
| muted-foreground | `#94a3b8` | **`#64748b`** |

Consequences observed at runtime:

- **HR Dashboard KPI numbers (47 / 0 / 0 / 1) render at contrast ratio 1.05:1** —
  `color: rgb(15,23,42)` on `background: rgb(17,28,48)`, 30px bold. Effectively invisible.
  All 45 `.text-foreground` elements on that page compute dark; zero compute light.
- Token-styled panels (Evaluations, Training, and every page using `bg-surface`) stay
  **white while the app is in dark mode**.

Two contributing causes, both in `apps/web/src/index.css`:

1. `@theme { --color-foreground: var(--foreground) }` is emitted into `:root`. CSS custom
   properties substitute at their point of *definition*, so `--color-foreground` freezes to
   `:root`'s light `--foreground` and inherits that already-resolved value. Redefining
   `--foreground` on the deeper `.authenticated-app` cannot retroactively change it.
2. The selector `html.dark :root` (line 130) **can never match** — `:root` *is* `html`, and an
   element cannot be its own descendant. The dark fallback for public pages is dead CSS.

Not a regression from the recent UI pass — this mapping predates it. The redesign leans on
these tokens more heavily, which makes the existing defect more visible.

### BUG-003 — A global unlayered `*` rule defeats EVERY border-colour utility in the app
**HIGH · UX**

`apps/web/src/index.css:204`:

```
*, *::before, *::after { box-sizing: border-box; border-color: var(--border); }
```

Tailwind v4 emits utilities inside `@layer utilities`; **unlayered declarations win over
layered ones regardless of specificity**. Runtime probe:

| probe element | computed border colour |
|---|---|
| `<div class="border-2 border-transparent">` | `rgb(51,65,85)` |
| `<div class="border-2 border-red-500">` | `rgb(51,65,85)` |
| 12 live elements using `border-border-soft` | `rgb(51,65,85)` (all) |

So **no border-colour class anywhere in HRISense has any effect** — every border is forced to
`#334155` (light) / `#475569` (dark). This is the direct cause of the long-standing
"too many outlined boxes / very dark outlines" complaint, and it silently neutralised the
`--border-soft` token added in the previous UI pass.

Fix is one line (wrap the reset in `@layer base { ... }`), but it is **not applied** —
recorded for review as instructed.

### BUG-004 — Refresh token never works; user_sessions.refreshToken is silently truncated
**HIGH · FUNCTIONAL · DATA-INTEGRITY**

`POST /auth/refresh` returns **401 for a refresh token issued seconds earlier**.

| measurement | value |
|---|---|
| refresh JWT length issued to client | **192 chars** |
| `user_sessions.refreshToken` column | `varchar(191)` |
| stored length (all 5 recent rows) | **191** |
| stored value is an exact prefix of the issued token | **true** (1 char dropped) |
| MySQL `sql_mode` | `NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION` — **no STRICT_TRANS_TABLES** |

Prisma declares `refreshToken String @unique` (`schema.prisma:551`) with no length
annotation, so MySQL gets `varchar(191)`. Without strict mode the insert truncates silently,
and the subsequent lookup by the full token never matches.

Impact: silent session renewal is broken system-wide. Every session ends when the 8-hour
access token expires; "Keep me signed in" cannot outlive it. Because token length depends on
the JWT payload, a shorter id could fit in 191 and work — so the failure can look intermittent.

Fix needs a schema change plus a migration, so it is **non-trivial and left unfixed** as
instructed. No other token column is at risk (`password_reset_tokens.token` is 64 chars,
`users.passwordHash` 60).

---

## Phase 4 — Authorization boundary: COMPLETE (39 PASS, 1 FAIL)

Tested by calling the **real API endpoints directly with real tokens**, not by checking hidden
UI. Matrix script: `.qa/authz_matrix.sh`.

Fixture: Supervisor A `kitchensupervisor` → Employee A `kitchenstaff` (DEV-GSS-002);
Supervisor B `janitorialsupervisor` → Employee B `janitorialstaff` (DEV-GSS-018).

### Cross-supervisor / cross-employee record access

| Endpoint (target = Employee A) | HR | Sup A (owner) | Sup B (unrelated) | Emp A (self) | Emp B (unrelated) |
|---|---|---|---|---|---|
| `GET /employees/:id` | 200 | 200 | **403** | 200 | **403** |
| `GET /employees/:id/documents` | 200 | 200 | **403** | 200 | **403** |
| `GET /weekly-schedules/employees/:id?applicableDate=` | 200 | 200 | **403** | 200 | **403** |
| `GET /compliance/employees/:id/records` | 200 | 200 | **403** | 200 | **403** |
| `GET /medical/employees/:id/records` | 200 | **403** | **403** | 200 | **403** |
| `GET /psychological/employees/:id/records` | 200 | **403** | **403** | 200 | **403** |

Mirror-image results confirmed against Employee B (Sup A 403, Emp A 403, Sup B 200, Emp B 200).
**Supervisors are denied medical/psychological access even for their own direct subordinate** —
correct.

### List endpoints return 200 but are correctly SCOPED (bodies inspected, not just status)

| Caller | `GET /employees` | `GET /attendance` |
|---|---|---|
| HR | **47** employees (= active workforce; soft-deleted excluded) | 30 employees |
| Supervisor A | **3** (self + 2 subordinates) | 3 |
| Supervisor B | **4** (self + 3 subordinates) | 4 |
| Employee A | 403 | **1** (self only) |
| Employee B | 403 | **1** (self only) |

**Parameter-forcing test**: `GET /attendance?employeeId=<EmployeeA>` called as Supervisor B
returned Supervisor B's own 4 employees — **not** Employee A. Called as Employee B it returned
only Employee B. The `employeeId` filter is intersected with the caller's scope rather than
trusted. No leak.

### HR-only surfaces

`/reports/headcount`, `/medical/records`, `/medical/summary`, `/psychological/*`,
`/compliance/requirements`, `/evaluations/templates`, `/evaluations/cycles`, `/ai/facts`,
`/audit` → **200 for FULL only, 403 for SUPERVISOR and STANDARD**. `/employees/subordinates`
→ 200 for supervisors and HR, 403 for STANDARD.

### Leave-transition authorization

| Test | Result |
|---|---|
| Supervisor B endorses Employee A's request | **403** "You can only endorse leave requests from your own team members." |
| Employee B approves Employee A's request | **403** |
| Employee A approves their **own** request | **403** |

### The one failure

`/recruitment/*` correctly **denies** SUPERVISOR and STANDARD with a safe message, but returns
**HTTP 500 instead of 403** — see BUG-005.

---

## Phase 10 + 27 (leave) — Leave workflow, balances, overlap, concurrency: COMPLETE (18 PASS)

**Pre-existing data state discovered:** all 45 `leave_balances` rows and all 20
`attendance_records` belong to the **15 soft-deleted `HSJ-*` employees**. Not one of the 47
active employees had a leave balance, which is why `/leave` and `/leave/balances` correctly
return `[]` for HR. QA balances were therefore created for Employee A through the real API
(`PUT /leave/balances` as HR): VACATION 10, SICK 10 for 2026.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| LV-01 | Employee files 3-day VACATION | PENDING, 3 days reserved | status=PENDING, pending=3 | PASS |
| LV-02 | **Overlapping** request, same employee | blocked | **409** "You already have a leave request overlapping these dates" | PASS |
| LV-03 | Non-overlapping request | allowed | created | PASS |
| LV-04 | Sup B endorses A's request | 403 | 403 | PASS |
| LV-05 | Emp B approves A's request | 403 | 403 | PASS |
| LV-06 | Emp A approves own request | 403 | 403 | PASS |
| **LV-07** | **5 SIMULTANEOUS endorse calls** | exactly one succeeds | **1x200, 4x400** · status=FOR_REVIEW · **exactly 1 audit row** | **PASS** |
| **LV-08** | **5 SIMULTANEOUS approve calls** | one transition, balance moves once | **1x200, 1x409, 3x400** · status=APPROVED · **used 0→3, pending 3→0 (once, not 5x)** · **1 audit row** | **PASS** |
| **LV-10c** | **4 SIMULTANEOUS reject calls** | one transition, reservation released once | **1x200, 2x409, 1x400** · status=REJECTED · pending 1→0 · **1 audit row** | **PASS** |
| **LV-11** | **4 SIMULTANEOUS cancel calls** | one transition, reservation released once | **1x200, 1x409, 2x400** · status=CANCELLED · pending 3→1 | **PASS** |
| LV-12 | Reject without a reason | 400 | 400 "A reason is required when rejecting a leave request." | PASS |

**Final balance state after the whole run — exactly correct, no drift:**

| leaveType | totalAllotted | used | pending |
|---|---|---|---|
| VACATION | 10 | **3** (the one approved 3-day request) | **0** |
| SICK | 10 | **0** | **0** (rejected 1-day + cancelled 2-day both fully released) |

No double-decrement, no silent clamp, no underflow. The guarded `updateMany` state
transitions (SW-02) and the atomic pending-balance handling (SW-03) hold under real
parallel HTTP load.

### Notification duplication check

5 concurrent endorsements produced **one** notification set (2 HR users + 1 employee), and
5 concurrent approvals produced **one** `LEAVE_APPROVED` row carrying the idempotency key
`leave-approved:<leaveId>:<userId>`. No duplicates. See BUG-006 for a lower-severity
observation about the events that do not carry a key.

---

### BUG-005 — Every recruitment error returns HTTP 500 instead of its declared status
**MEDIUM · AUTHORIZATION / FUNCTIONAL**

| request | expected | actual |
|---|---|---|
| `GET /recruitment/openings` as SUPERVISOR | 403 | **500** |
| `GET /recruitment/applications` as STANDARD | 403 | **500** |
| `GET /recruitment/openings/<nonexistent>` as HR | 404 | **500** |
| `GET /recruitment/applications/<nonexistent>` as HR | 404 | **500** |
| control: `GET /employees/<nonexistent>` as HR | 404 | 404 (correct) |

Access control itself is **not** broken — the denial happens and the message is safe
("You are not authorized to perform this recruitment action."), no data is returned.

Root cause: `apps/api/src/lib/recruitment.errors.ts` defines `RecruitmentError extends Error`
with its own `statusCode` (403 / 404 / 500 per subclass), but
`apps/api/src/middleware/errorHandler.ts:24` reads that property only for `AppError`:

```
let statusCode = err instanceof AppError ? err.statusCode : 500;
```

so the whole recruitment error family collapses to 500. Consequences: the UI cannot tell
"forbidden" from "server broken", and every routine permission denial is written to the server
log as `[Error]`. Recorded, not fixed.

### BUG-006 — Leave notifications other than APPROVED carry no idempotency key, and are mistyped
**LOW · DATA-INTEGRITY**

`LEAVE_APPROVED` rows carry `eventId = leave-approved:<leaveId>:<userId>` (the SW-15 fix,
working). The filing and endorsement notifications are written with **`eventId = NULL`**, so
nothing but the state-transition guard protects them from duplication. They are additionally
written with `type = LEAVE_FILED` even when the title is "Leave request endorsed for HR
decision" / "Your leave request was endorsed", so the type column cannot be used to filter
endorsement events.

No duplicates were actually produced during concurrency testing (the transition guard held),
so this is latent rather than active.

---

## Phase 2 — Employee onboarding + named regressions: COMPLETE (31 PASS, 0 FAIL)

Full 7-step wizard driven in the real browser as `hr@gmail.com`. Created employee
**HSJ-0017 "QATest Onboarding"**.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| ONB-01 | Step 1 Next with empty required fields | blocked | blocked, toast "Please complete: First Name, Last Name, Date of Birth." | PASS |
| ONB-02 | Step 2 Next with missing mobile/address | blocked | blocked, toast names the exact fields | PASS |
| ONB-03 | `personalEmail` required | required | marked `required`, enforced | PASS |
| ONB-04 | `mobilePhone` required | required | enforced | PASS |
| ONB-05 | `presentAddress` required | required | enforced | PASS |
| ONB-06 | Unit → Job Role dependent dropdown | Job Role list filters by Unit | selecting "General Support Services" populated 8 GSS roles only | PASS |
| ONB-07 | Steps 3-6 progression | advance | Employment → Government → Emergency → Documents → Review | PASS |
| ONB-08 | Government numbers optional | optional | all 4 marked not-required | PASS |
| ONB-09 | Document upload optional | optional | "Uploading documents is optional during onboarding." | PASS |
| ONB-10 | Review screen shows welcome-email target | **personal** email | "Welcome Email Preview — To: qa.onboarding.personal@example.com (the employee's personal…)" | PASS |
| ONB-11 | Submit creates exactly one Employee | +1 | employees 62 → **63** | PASS |
| ONB-12 | Submit creates exactly one User | +1 | users 62 → **63** | PASS |
| ONB-13 | Employee number generated | HSJ-XXXX | **HSJ-0017** | PASS |
| ONB-14 | `mustChangePassword` set on new account | true | `mustChangePassword=1` | PASS |
| ONB-15 | Password stored hashed | bcrypt | `$2a$12$…`, length 60 | PASS |
| ONB-16 | Supervisor auto-resolution | resolves from job role | `immediateSupervisorId` → **DEV-GSS-001 Kitchen Supervisor**, `supervisorAssignmentStatus=ASSIGNED`, `source=AUTO_JOB_ROLE` | PASS |
| ONB-17 | **Welcome email goes to the PERSONAL address** | personal, not work/HR/test | API log: `"Welcome to HRISense — Your Login Credentials" to qa.onboarding.personal@example.com` | PASS |
| ONB-18 | **Welcome email NOT actually sent during QA** | simulated | `[BREVO_TRANSACTIONAL] Simulation mode: … was NOT sent.` | PASS |
| ONB-19 | Audit trail written | CREATE_EMPLOYEE etc. | `CREATE_EMPLOYEE`, `USER_ACCOUNT_CREATED`, `EMPLOYEE_CREATED` | PASS |

### REGRESSION 1 — Credential PDF must not freeze the UI · **PASS**

Instrumented `URL.createObjectURL`, anchor clicks, and `unhandledrejection` before clicking.

| Probe | Before download | After download | After Copy Credentials |
|---|---|---|---|
| "Copy Credentials" clickable (disabled / pointerEvents / hit-test) | false / auto / **true** | false / auto / **true** | false / auto / **true** |
| "Download PDF" | false / auto / **true** | false / auto / **true** | false / auto / **true** |
| "Go to Directory" | false / auto / **true** | false / auto / **true** | false / auto / **true** |
| Full-screen overlays (fixed/absolute ≥80% viewport, visible) | **0** | **0** | **0** |
| `body` pointer-events | auto | auto | auto |
| `body[inert]` / `body[aria-hidden]` | false / null | false / null | false / null |
| DOM node count | 323 | 330 (+7 = toast) | 330 |
| unhandled promise rejections | — | **0** | 0 |

Blob produced: **4,100 bytes, `application/pdf`**, header `%PDF-1.3`, generator jsPDF 4.2.1.
"Copy Credentials" still functioned afterwards (toast "Credentials copied to clipboard"), and
"Go to Directory" navigated to `/employees` with no residual overlay.

**PDF contents extracted from the blob — exactly the specified fields and nothing more:**
`HSJ HRISense` · `Employee Login Credentials` · `EMPLOYEE NAME QATest Onboarding` ·
`EMPLOYEE NUMBER HSJ-0017` · `LOGIN ID qa.onboarding.work@example.com` ·
`TEMPORARY PASSWORD …` · `Change this password on first login.` ·
`Keep this sheet secure and hand it to the employee directly. HRISense staff will never ask for
a password.` No address, no government IDs, no other personal data.

**Credential-handling constraints — all verified:**

| Constraint | Evidence |
|---|---|
| Plaintext password NOT in the database | 0 occurrences of the temp password in a full `mysqldump` of `hrisense_db` |
| Plaintext password NOT in logs | 0 occurrences in `qa-api.log` |
| PDF NOT stored on the server | 0 files created under `apps/api/uploads` in the surrounding 20 minutes |
| Password stored hashed only | `$2a$12$`, 60 chars |

### REGRESSION 2 — Documents tab must not crash · **PASS**

The old failure was `Cannot read properties of undefined (reading 'replace')` on a
**newly onboarded** employee — reproduced here on exactly that kind of record (HSJ-0017,
created minutes earlier).

All **17** profile tabs were clicked in sequence with `window.onerror` and
`unhandledrejection` listeners attached: **0 JavaScript errors, 0 crash banners, all 17
rendered.** Documents tab shows "Uploaded Documents / Upload File / No documents uploaded yet."

---

## Phase 3 — 201 profile tabs: COMPLETE (17 PASS)

| Tab | Rendered content | Empty-state honesty |
|---|---|---|
| Overview | FULL NAME, EMPLOYEE ID HSJ-0017, UNIT, JOB ROLE, STATUS, WORK EMAIL, "PROFILE 79%" | — |
| Personal | SEX **Male**, CIVIL STATUS **Single**, DOB 4/12/1995, PLACE OF BIRTH, NATIONALITY | RELIGION → **"Not provided"** |
| Contact | MOBILE, PERSONAL EMAIL, WORK EMAIL, PRESENT ADDRESS | TELEPHONE → **"Not provided"** |
| Employment | STATUS Probationary, STATE Active, DATE HIRED 9/1/2026, UNIT, JOB ROLE | PROBATION / REGULARIZATION DATE → **"Not provided"** |
| Schedule | Work Schedule grid MON–SUN | all days **"Needs Setup"** — see BUG-008 |
| Attendance | PRESENT 0 / LATE 0 / ABSENT 0 + Today/Week/Month/Custom range | honest zeroes, no fabrication |
| Government | SSS, PhilHealth, Pag-IBIG, TIN as entered | — |
| Emergency | CONTACT NAME, RELATIONSHIP, MOBILE | — |
| Documents | "Uploaded Documents / Upload File" | **"No documents uploaded yet."** |
| Compliance | "Compliance Status & Requirements", "Record Fulfillment" | **"FULFILLMENT HISTORY (0) No compliance fulfil…"** |
| Leave Balances | "Set balance" action | **"No leave balances configured"** + truthful note "HRISense does not grant leave days automatically." |
| Evaluations | "Performance Evaluation History" | **"No evaluation records yet"** |
| Training | "Training & Seminars History", "0 Records" | **"No training records yet"** |
| Medical | "Medical History & Clearances" | **"No medical records found for this employee."** |
| Psychological | "Psychological & Wellness Evaluations" | **"No psychological assessment records found…"** |
| Timeline | Real audit events: "Create Employee 9/8/2026, 8:04:48 AM — Performed by: Human Resource Officer (DEV-HRD-001)", "User Account Created" | — |
| Account Management | Login ID, Created 9/8/2026, **"Last sign-in: Never"**, Active, "Password change pending" | accurate |

Enums are rendered human-readably (Male / Single / Probationary / Active), dates are
formatted, and every missing value uses "Not provided" or a "No … yet" phrase.
**No fabricated values were observed on any tab.**

---

### BUG-007 — "Immediate Supervisor" is blank on the onboarding Review screen
**LOW · UX**

The Review & Confirm step prints an "Immediate Supervisor" label with an empty value, even
though resolution succeeds — the saved record has
`immediateSupervisorId → DEV-GSS-001 Kitchen Supervisor`, `supervisorAssignmentStatus=ASSIGNED`,
`supervisorAssignmentSource=AUTO_JOB_ROLE`. Display-only gap on the confirmation screen; the
underlying assignment is correct.

### BUG-008 — Every ACTIVE schedule template has zero day definitions; all 63 employees resolve to "Needs Setup"
**HIGH · DATA-INTEGRITY / CONFIGURATION**

The onboarding wizard offers 6 schedule templates. The one chosen (`Office 8AM–12NN`,
id `4472c190…`) produced a correct `employee_schedule_assignments` row
(effectiveFrom 2026-09-01, effectiveTo NULL) — but that template has **no
`schedule_template_days` rows at all**, so the Schedule tab shows **"Needs Setup" for all
seven days** and `GET /weekly-schedules/employees/<id>?applicableDate=2026-09-08` returns
`{"data": null}`.

The template catalogue is **duplicated**: an older `isActive = 0` set carries the 7 day rows,
while the current `isActive = 1` set has none.

| name | isActive | day rows | assignments |
|---|---|---|---|
| Regular Day Shift | **0** | **7** | 61 |
| Night Shift / Flexible / Rotating / Part-Time AM / Part-Time PM | **0** | **7** each | 0–1 |
| Regular Day Shift | **1** | **0** | 61 |
| Office 8AM–12NN | **1** | **0** | 2 |
| Office 9AM–12NN, Office 1PM–6PM, Shift 6AM–2PM, Shift 2PM–10PM, Shift 10PM–6AM, and 5 more | **1** | **0** | 0 |

Totals: 18 templates, only 6 have day rows (42 rows), and all 6 of those are deactivated.

**`SELECT COUNT(DISTINCT employeeId) FROM employee_schedule_assignments WHERE
scheduleTemplateId NOT IN (SELECT DISTINCT templateId FROM schedule_template_days)` → 63**
— i.e. **every employee in the system**, not just the new one.

Impact: no employee has a resolvable working-day pattern from the legacy template path.
Working-day / rest-day determination, the Schedule tab, and anything downstream that needs a
schedule (including the planned attendance import) have nothing to resolve against. Only the
single employee who has real `employee_weekly_schedules` rows (DEV-GSS-011) resolves, via
`source = NEW_WEEKLY_SCHEDULE`.

This may be a data/seed problem rather than a code problem, but it is a live runtime defect:
the wizard offers templates that cannot produce a schedule. Recorded, not fixed.

---

## Phase 7 — Work schedules (SW-01 effective-dated repair): COMPLETE (9 PASS)

Run against the freshly onboarded QA employee HSJ-0017 via the real API.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| SCH-01 | Save schedule effective **Sep 1** | one open-ended range | `2026-09-01 → (open-ended)` | PASS |
| SCH-02 | Save schedule effective **Oct 1** | Sep 1 gets bounded | `2026-09-01 → 2026-10-01`, `2026-10-01 → (open-ended)` | PASS |
| **SCH-03** | **Insert Sep 15 BETWEEN them** | Sep 1→Sep 15, Sep 15→Oct 1, Oct 1→open | **exactly that** | **PASS** |
| SCH-04b | True overlap check for this employee (half-open `[from, to)`) | 0 | **0** | PASS |
| **SCH-07** | **System-wide overlap check, ALL employees** | 0 | **0** | **PASS** |
| SCH-08 | Duplicate `(employeeId, effectiveFrom)` | none (unique index) | **0 groups** | PASS |
| SCH-09 | Employees with >1 open-ended schedule (original SW-01 symptom) | none | **0** | PASS |
| SCH-05 | Re-save the same effective date | replaces, does not duplicate | still 3 rows | PASS |
| SCH-06 | Resolver returns the right schedule per date | date-accurate | 2026-09-05 → Sep 1 range · 2026-09-20 → Sep 15 range · 2026-10-10 → Oct 1 range · **2026-08-20 → null (correctly no schedule before the first)** | PASS |

The SW-01 repair is confirmed working at runtime, and the timeline is contiguous and
non-overlapping across the whole database.

Shift catalogue (`GET /weekly-schedules/shifts`) returns 6 active shift definitions with
correct times, including the overnight `Shift 10PM–6AM` (22:00 → 06:00).

---

## Phase 12 — Training → Compliance idempotency: COMPLETE (7 PASS)

QA fixtures created through the live API: compliance requirement
`QA_COMPLIANCE_TEST BLS Certification` (category TRAINING, tracksExpiry, 30-day reminder,
scoped to the QA employee) and training activity
`QA_TRAINING_TEST Basic Life Support Refresher` with HSJ-0017 enrolled.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| TRN-01 | Create activity linked to a compliance requirement | created | created, participant `ASSIGNED`, `complianceRecordId` NULL | PASS |
| TRN-03 | Baseline generated-compliance count | 0 | 0 | PASS |
| TRN-04 | Mark participant **COMPLETED** (first time) | exactly 1 compliance record | **1** record, `referenceNumber = TRN-D2C27713`, `reviewStatus = ACCEPTED`, `recordTitle` = activity title | PASS |
| **TRN-05** | **5 SIMULTANEOUS retries of the same completion** | **still exactly 1** | **5x HTTP 200, still exactly 1 generated record, 1 total** | **PASS** |
| TRN-06 | Record links back to the participant | link resolves, employee matches | join via `generatedFromTrainingParticipantId` resolves; `employee_matches = 1`; participant `COMPLETED` | PASS |
| TRN-07 | `participant.complianceRecordId` set and matching | set, matches | `has_link = 1`, `link_matches = 1` | PASS |

The SW-04 fix (unique `generatedFromTrainingParticipantId` as a source-event idempotency key)
holds under real parallel HTTP load.

**Data-state note discovered here:** the 6 rows visible in `compliance_requirements` belong to
the **deprecated** `LegacyComplianceRequirement` model. The live `ComplianceRequirement` model
maps to `compliance_requirements_new`, which had **0 rows**. `GET /compliance/requirements`,
`/compliance/summary` and `/compliance/needs-attention` all correctly returned empty
(`requirementCount: 0`, `employeeCount: 48`). This is why linking a training activity to one of
the 6 visible legacy requirements failed with "Linked compliance requirement not found" — the
two tables are unrelated. Not a code defect, but the legacy table's presence is misleading.

---

## Phase 11 — Performance evaluations: COMPLETE (7 PASS, 2 FAIL)

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| EV-01 | Create template with `ratingMethod: LIKERT_5` (offered by the UI) | created | **raw Prisma error — enum rejects it** | **FAIL (BUG-011)** |
| EV-01b | Create template with `ratingMethod: NUMERIC` | created | created with 2 criteria, min 1 / max 5 | PASS |
| EV-02 | Create cycle scoped to one employee, `evaluatorAssignmentMethod: SUPERVISOR`, autoActivate | cycle + assignment | created | PASS |
| EV-03 | Assignment auto-generated with the right evaluator | employee HSJ-0017, evaluator DEV-GSS-001 | **exactly that**, status `NOT_STARTED` | PASS |
| EV-04 | Unrelated **Supervisor B** saves a draft | 403 | 403 "Only assigned evaluator or HR may edit evaluation draft" | PASS |
| EV-05 | Unrelated **employee** saves a draft | 403 | 403, same message | PASS |
| EV-06 | Assigned evaluator saves a draft | `IN_PROGRESS` | `IN_PROGRESS`, 2 response rows | PASS |
| **EV-07** | **5 SIMULTANEOUS submits** | one transition, no duplicate side effects | status `SUBMITTED`, `submittedAt` set, **responses stay at 2 (no duplication)** — but **all 5 returned 200 and wrote 5 `EVALUATION_SUBMITTED` audit rows** | **FAIL (BUG-012)** |
| **EV-08** | **5 SIMULTANEOUS finalizes** | one transition | **1x200, 4x409**, status `FINALIZED`, `finalizedAt` set, `overallScore = 4.5` (correct mean of 4 and 5), **exactly 1 `EVALUATION_FINALIZED` audit row** | **PASS** |

Audit rows for the single assignment: `EVALUATION_DRAFT_SAVED` 1, `EVALUATION_SUBMITTED` **5**,
`EVALUATION_FINALIZED` 1. Response rows: exactly 2, one per criterion, no duplicates.

---

### BUG-009 — Raw Prisma errors (file paths, source excerpts, query internals) are returned to API clients
**MEDIUM · SECURITY (information disclosure)**

A malformed request to `POST /weekly-schedules/employees/:id` returned this to the HTTP client:

```
Invalid `tx.employeeWeeklySchedule.create()` invocation in
C:\xampp\htdocs\HRISense\apps\api\src\services\weekly-schedule.service.ts:231:59
  228   }
  229 }
  230
→ 231 const newSchedule = await tx.employeeWeeklySchedule.create({
        data: { employeeId: "e086dc3c-…", effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), … }
```

The response body leaks the absolute server file path, the source line number, a source-code
excerpt, the internal query shape and record ids. The same happened on
`POST /evaluations/templates`. This is exactly the "no raw stack traces to the user" condition
in Phase 26. Errors raised as `AppError` are formatted safely; errors that escape as raw Prisma
exceptions are not.

### BUG-010 — Unknown fields in a request body are silently ignored and still return 200
**LOW · FUNCTIONAL**

`PUT /training/:id/participants/:employeeId` with `{"status":"COMPLETED", …}` (the DTO field is
`participationStatus`) returned **200 "Participant status updated"** while the participant
stayed `ASSIGNED` and no compliance record was generated. The caller is told the write
succeeded when nothing changed. Same class of issue as BUG-001.

### BUG-011 — Evaluation rating-method and cycle-status enums disagree between the UI and the database
**HIGH · FUNCTIONAL**

| enum | Frontend (`apps/web/src/services/evaluation.service.ts`) | Database (`schema.prisma`) | Consequence |
|---|---|---|---|
| `EvaluationRatingMethod` | `NUMERIC`, **`LIKERT_5`**, **`SATISFACTION_4`**, **`DESCRIPTIVE`** | `NUMERIC`, **`LABELED`** | **3 of the 4 methods the UI offers cannot be saved**; `LABELED` is never offered |
| `EvaluationCycleStatus` | **`DRAFT`**, `ACTIVE`, `CLOSED` | `ACTIVE`, `CLOSED`, **`ARCHIVED`** | `DRAFT` can never occur; `ARCHIVED` has no UI handling |
| `EvaluationAssignmentStatus` | NOT_STARTED / IN_PROGRESS / SUBMITTED / FINALIZED | identical | OK |

`EvaluationTemplateModal.tsx` presents LIKERT_5 (line 428), SATISFACTION_4 (433) and
DESCRIPTIVE (438) as selectable cards. Choosing any of them fails with the raw Prisma error
from BUG-009: `Invalid value for argument 'ratingMethod'. Expected EvaluationRatingMethod.`

Only `NUMERIC` works, so **HR can create an evaluation template with just one of the four
advertised rating methods**. The service also branches on `LABELED` for the non-numeric
validation path (`evaluation.service.ts:987-991`), which the UI can never reach.

Note for the record: the recent Evaluations UI redesign deliberately reused
`RATING_METHOD_LABELS` and `CYCLE_STATUS_META` from the existing frontend source rather than
inventing statuses. Those source constants are themselves out of sync with the database — the
mismatch pre-dates and is independent of that redesign.

### BUG-012 — Evaluation SUBMIT is not a guarded transition (FINALIZE is)
**MEDIUM · CONCURRENCY**

Five simultaneous `POST /evaluations/assignments/:id/submit` calls **all returned 200** and
wrote **5 `EVALUATION_SUBMITTED` audit rows** for one logical submission. The finalize
endpoint, by contrast, behaved correctly under the identical test: **1×200 / 4×409** and
exactly one audit row.

Mitigating: evaluation *responses* were not duplicated (2 rows, upserted correctly) and the
status ended in the right state, so there is no data corruption — the damage is a misleading
audit trail and five "success" replies for one action. The guarded-transition pattern used for
leave and for evaluation finalize simply was not applied to submit.

---

## Phase 9 — Attendance: COMPLETE (16 PASS, 1 FAIL-then-fixed)

Four QA attendance records were inserted for HSJ-0017 covering the date-boundary cases the
brief asked for (first day of month, mid-month, last day of month, year end).

### Business-date round-trip — DB vs API

| record | DB `date` (`@db.Date`) | API `date` | match |
|---|---|---|---|
| qa-att-0001 first day of month | `2026-09-01` | `2026-09-01T00:00:00.000Z` | **yes** |
| qa-att-0003 mid-month / midnight timeIn | `2026-09-15` | `2026-09-15T00:00:00.000Z` | **yes** |
| qa-att-0002 last day of month | `2026-09-30` | `2026-09-30T00:00:00.000Z` | **yes** |
| qa-att-0004 year end (UTC-boundary sensitive) | `2026-12-31` | `2026-12-31T00:00:00.000Z` | **yes** |

The business date survives the round trip unchanged on every boundary, and it also survived a
manual correction (audit `oldValue` and `newValue` both carry `"date":"2026-09-15"`).
Server TZ is GMT+0800, so this exercises the drift case the SW-11 work was about.

### NO_RECORD semantics

`GET /attendance` returns **virtual** rows with `attendanceFact.status = "NO_RECORD"` for dates
with no `AttendanceRecord`, e.g. `id: "VIRTUAL-da700851-…-2026-09-07"`. Nothing was reported as
`ABSENT` for a missing record. The HR dashboard renders the same distinction in words:
**"Present Today — No attendance data imported yet"** and **"Absent Today — 47 with no imported
record"**. Missing data is never presented as absence.

### Update validation (SW-10)

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| ATT-02 | SUPERVISOR calls `PUT /attendance/:id` | 403 (HR-only) | 403 | PASS |
| ATT-03 | Unknown field `bogusField` | rejected (`.strict()`) | 400 "Unrecognized key(s) in object: 'bogusField'" | PASS |
| ATT-04 | `timeOut` earlier than `timeIn` | rejected | 400 "Time out cannot be earlier than time in" | PASS |
| ATT-05 | `status: "NO_RECORD"` (not a stored status) | rejected | 400, enum lists the 8 real statuses | PASS |
| ATT-06 | Empty body | rejected | 400 "Provide at least one field to update" | PASS |

### Manual correction provenance — verified **after** the BUG-013 fix

| ID | Field | Before | After 1st correction | After 2nd | Result |
|---|---|---|---|---|---|
| ATT-07/08 | `status` | LATE | **PRESENT** | PRESENT | PASS |
| | `hoursWorked` | 7.75 | **8** | 8 | PASS |
| | `sourceType` | LEGACY | **MANUAL** | MANUAL | PASS |
| | `recordVersion` | 1 | **2** | **3** | PASS |
| | `manuallyModifiedAt` | NULL | **set** | set | PASS |
| | `manuallyModifiedById` | NULL | **set** | set | PASS |
| ATT-09 | Audit `oldValue` | — | `{"date":"2026-09-15", … "status":"LATE","hoursWorked":7.75 …}` | | PASS |
| | Audit `newValue` | — | `{"date":"2026-09-15", … "status":"PRESENT","hoursWorked":8 …}` | | PASS |

Both sides of the change are recorded (the SW-09 fix), so a correction is fully
reconstructible.

---

## Phase 3b — Documents (upload, visibility, protected preview/download): COMPLETE (14 PASS)

Four QA documents uploaded to HSJ-0017 with different visibility settings.

### Upload

`POST /employees/:id/documents` stores the file under a hashed name
(`270652c393acdfd8d5999d128e571976.pdf`) rather than the original filename, and records
`originalFilename`, `mimeType`, `sizeBytes`.

**Deliberate confidentiality rule confirmed, not a bug:** `document.service.ts:55` forces
`isVisibleToSupervisor = false` whenever the category is `MEDICAL_CLEARANCE` or `OTHER`, even if
the caller asks for true. Observed exactly that on an `OTHER` upload.

### Visibility on the list endpoint — `GET /employees/:id/documents`

| Caller | Documents returned |
|---|---|
| **HR** | **all 4** |
| **Supervisor A** (this employee's actual supervisor) | **1** — only the one flagged `isVisibleToSupervisor` |
| **Supervisor B** (unrelated) | **DENIED** — "Unauthorized. Employee is not a direct subordinate" |
| **Unrelated STANDARD employee** | **DENIED** — "Unauthorized access to employee documents" |
| **The employee themself** | **3** — exactly those flagged `isVisibleToEmployee`; the HR-only document is **not** returned |

### REGRESSION 3 — protected preview / download · **PASS**

| Role | `visible-to-both` preview / download | `hr-only` preview / download |
|---|---|---|
| HR | 200 / 200 | 200 / 200 |
| Supervisor A (owns the employee) | 200 / 200 | **403 / 403** |
| Supervisor B (unrelated) | **403 / 403** | **403 / 403** |
| Unrelated STANDARD employee | **403 / 403** | **403 / 403** |
| The employee themself | 200 / 200 | **403 / 403** |
| No token | **401** | — |

Content actually served: 193 bytes beginning `%PDF-1.4`, with
`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="qa_doc.pdf"` and
`X-Content-Type-Options: nosniff`.

Also verified here: logging in as the newly onboarded employee returned
`mustChangePassword: true` (Phase 1 item 11).

---

### BUG-013 — `validate()` middleware wipes `req.params` / `req.query`, 500-ing three routes  ·  **FIXED (QA blocker)**
**CRITICAL · FUNCTIONAL**

`apps/api/src/middleware/validate.ts` parsed `{ body, query, params }` and then unconditionally
assigned all three back:

```
req.body = parsed.body;
req.query = parsed.query;
req.params = parsed.params;
```

A zod object **strips keys it does not declare**, so a body-only schema returns
`params: undefined`. The middleware therefore set `req.params = undefined`, and every handler
that then read `req.params.<x>` threw.

Confirmed broken at runtime before the fix:

| Route | Schema | Observed |
|---|---|---|
| `PUT /attendance/:id` | `updateAttendanceSchema` (body only) | **500** `Cannot read properties of undefined (reading 'id')` |
| `POST /employees/:employeeId/documents` | `uploadDocumentSchema` (body only) | **500** `Cannot destructure property 'employeeId' of 'req.params' as it is undefined.` |
| `PUT /documents/:documentId` | `updateMetadataSchema` (body only) | same class |

Impact before the fix: **HR could not correct a single attendance record, and no employee
document could be uploaded or have its metadata edited.** The SW-09 old/new-value audit path was
unreachable as a result.

**This was fixed** because it blocked two areas the brief explicitly required
("Edit a QA AttendanceRecord … verify oldValue, newValue, sourceType = MANUAL,
manuallyModifiedAt, manuallyModifiedById, recordVersion increments" and the document
upload/preview/download/visibility tests). The change is the minimal null guard allowed by the
"obvious null guard" exception — three lines, no behavioural change where a schema does declare
a section:

```
if (parsed.body !== undefined) req.body = parsed.body;
if (parsed.query !== undefined) req.query = parsed.query;
if (parsed.params !== undefined) req.params = parsed.params;
```

After the fix both routes returned 200 and all provenance/visibility assertions above passed.
No other production code was changed to unblock QA.

---

## Phase 20 — Reports + cross-module consistency: COMPLETE (30 PASS)

All seven catalogued reports exist and generate: `headcount`, `attendance`, `leave`,
`compliance`, `training`, `evaluations`, `recruitment`.

| Report | HTTP | rows (2026 window) |
|---|---|---|
| headcount | 200 | 48 |
| attendance | 200 | 48 |
| leave | 200 | 4 |
| compliance | 200 | 48 |
| training | 200 | 1 |
| evaluations | 200 | 1 |
| recruitment | 200 | 4 |

### Exports — 7 reports x 3 formats = **21/21 PASS**

Every export returned 200 with a correct filename, a non-empty body and a valid file
signature:

| format | signature observed | example filename |
|---|---|---|
| excel | `PK\003\004` (valid ZIP — `zipfile.testzip()` clean, 16 entries) | `HRISense_Headcount_2026-09-08.xlsx` |
| pdf | `%PDF` | `HRISense_Compliance_Standing_2026-09-08.pdf` |
| csv | readable header row | `HRISense_Recruitment_Pipeline_2026-09-08.csv` |

No corrupt export, no wrong filename, no empty export where the UI has data. Two exports
(`training`, `recruitment`) came back header-only for the 30-day window and were re-checked
against a full-year window — they correctly filled in, so that was accurate date filtering, not
a broken export. CSV files carry no trailing newline, so `wc -l` under-reports by one; the real
data-row counts match the JSON reports exactly (48).

### THREE-WAY ATTENDANCE CONSISTENCY — same period 2026-08-09 .. 2026-09-08

| Source | Employee population | PRESENT | LATE | ABSENT | "no record" |
|---|---|---|---|---|---|
| **Attendance Tally** (`/attendance/tally`) | **48** | **1** | — | — | — |
| **Reports → Attendance** (`/reports/attendance`) | **48 rows** | **1** | **0** | **0** | column `noImportedRecord` present |
| **AI fact sheet** (`/ai/facts?periodDays=30`) | — | **1** (`byStatus: [{PRESENT:1}]`) | **0** | — | `daysWithNoImportedRecord: 1439` |

All three agree. `1439 = 48 employees x 30 days - 1 record`, so the "no imported record" figure
is arithmetically consistent with the population and period. **Crucially, `absent` is 0, not
1439** — missing data is never counted as absence in any of the three surfaces.

### Cross-module population agreement

| Surface | Active employee count |
|---|---|
| Database (`employmentState=ACTIVE AND deletedAt IS NULL`) | **48** |
| `GET /employees` as HR | **48** |
| Headcount report rows | **48** |
| Compliance report rows | **48** |
| Attendance tally / report rows | **48** |
| AI `headcount.totalActive` | **48** |
| Compliance summary `employeeCount` | **48** |

The 15 soft-deleted `HSJ-*` employees are excluded everywhere — including from the leave and
attendance figures, which is why those modules look sparse. This is the SW-05 scoping fix
behaving correctly and consistently across every surface.

### Documented definition differences (intentional, not defects)

- `/reports/*` filter on **`dateFrom` / `dateTo`**, while `/attendance/tally` and
  `/attendance` use **`startDate` / `endDate`**. Passing the wrong pair to the attendance
  report returns a clear 400 ("Please choose a start and end date for the attendance report."),
  so nothing fails silently — but the inconsistency is a foot-gun for API consumers.
- The **leave report** lists every request in the date window by *filing* date, whereas the AI
  fact sheet counts requests in a rolling `periodDays` window. Same underlying rows, different
  window definition.

---

## Phase 21 — AI Assistance: COMPLETE (16 PASS, 1 FAIL)

`OPENAI_API_KEY` in `apps/api/.env` is a 24-character placeholder that does not begin with
`sk-`. **No AI provider call was made during this QA pass**; `/ai/analyze` and `/ai/ask` were
deliberately not invoked, so no credits could be spent.

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| AI-01 | `/ai/status` with a placeholder key | reports unavailable | **`{"available": true, "model":"gpt-4o-mini", "provider":"openai"}`** and the UI shows an "AI Active" badge | **FAIL (BUG-014)** |
| AI-02 | Deterministic fact sheet renders without a working provider | full fact sheet | complete fact sheet returned, pure SQL, 1,674 bytes | PASS |
| AI-03 | `/ai/facts` authorization | HR only | 200 HR · **403** Supervisor · **403** Standard | PASS |

### Fact-sheet accuracy verified against the modules

| Fact | Value | Cross-check |
|---|---|---|
| `headcount.totalActive` | 48 | matches directory, headcount report, DB |
| `headcount.newHiresInPeriod` | 2 | HSJ-0017 + 1 |
| `attendance.recordCount` | 1 | matches tally and attendance report |
| `attendance.daysWithNoImportedRecord` | 1439 | = 48 x 30 - 1 |
| `attendance.presentRate` | 100 | the single record is PRESENT |
| `compliance.activeRequirements` | 1 | the QA requirement only — the 6 **legacy-table** rows are correctly excluded |
| `training.*` | 1 activity / 1 assigned / 1 completed / 100% | matches the training module |
| `evaluations.activeCycles` / `assignmentsTotal` | 1 / 1 | matches the evaluations module |
| `recruitment.openOpenings` | 1 | matches `job_openings` |

**Archived employees are not wrongly included** anywhere in the fact sheet, and
`daysWithNoImportedRecord` is named and used as "no record", never as absence.

### AI-SEC — outbound payload inspection · **PASS**

The entire fact sheet is aggregates only (`{label, count}` pairs plus integers). A regex sweep
of the raw payload found **zero** occurrences of:

| checked for | result |
|---|---|
| password / bcrypt hash | CLEAN |
| token / secret / apikey / authorization / bearer | CLEAN |
| SSS, PhilHealth, Pag-IBIG, TIN numbers | CLEAN |
| email addresses | CLEAN |
| phone numbers | CLEAN |
| home / street addresses | CLEAN |
| medical or psychological notes | CLEAN |
| dates of birth | CLEAN |
| **any employee name** | CLEAN |

Nothing that could identify an individual leaves the server in this payload.

---

### BUG-014 — AI reports itself "available" on a placeholder API key
**MEDIUM · CONFIGURATION**

`AiService.availability()` (`apps/api/src/services/ai/ai.service.ts:65`) decides availability
with `if (!env.OPENAI_API_KEY)` — presence only, no shape or validity check. The configured
value is the literal placeholder (24 chars, no `sk-` prefix), so `/ai/status` returns
`available: true` and the top navigation renders an **"AI Active"** badge on a server where no
AI request can succeed. HR would only discover this when an analysis actually fails.

The deterministic fact sheet is unaffected — it is plain SQL and rendered correctly throughout,
which is the behaviour the brief asked to confirm.

---

## Phase 16/17 — Public careers + applicant conversion: COMPLETE (14 PASS)

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| PUB-01 | Unauthenticated openings list | 200 | 200, `items: []` — the only opening closed on 2026-09-03, correctly filtered out | PASS |
| PUB-02 | Unauthenticated opening detail by slug | 200 | 200 | PASS |
| PUB-03 | Non-existent slug | 404 | **500** (BUG-005 again, on a public endpoint) | see BUG-005 |
| PUB-04 | Public payload field audit | no internal fields | only `title, slug, description, responsibilities, qualifications, requiredDocuments, employmentType, vacancies, openingDate, closingDate, unit, department, id` — no creator, no notes, no applicant data | PASS |
| PUB-05 | **Valid** status token, unauthenticated | 200, minimal payload | 200 | PASS |
| PUB-06 | **Tampered** token (last char changed) | rejected | **404**, generic message | PASS |
| PUB-07 | **Garbage** token | rejected | **404**, generic message | PASS |
| PUB-09 | **Forged signature** | rejected | **404**, generic message | PASS |
| PUB-08 | Token for a different application | returns only that application | correct application returned, no cross-access | PASS |
| PUB-10 | Status payload field audit | no confidential data | `referenceNumber`, applicant **first name only**, jobTitle, jobReferenceNumber, unitName, submittedAt, lastUpdatedAt, friendly `stage.label` + `stage.description`. **No internal notes, no interview data, no email, no phone, no documents, no raw internal status** | PASS |

The status link is a stateless HMAC (no token stored at rest), so nothing can leak from a token table.

### Applicant → employee conversion

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| CONV-01 | Convert a **non-HIRED** application | blocked | "Only HIRED applications can be converted to onboarding drafts." | PASS |
| **CONV-02** | **HR Assistant (FULL tier, not HR Officer) converts** | **denied** | **"Only HR Officers can convert applicants to onboarding drafts."** | **PASS** |
| CONV-05 | First conversion by HR Officer | 1 draft created | drafts 2 → 3 | PASS |
| CONV-06 | Second conversion | blocked | "This application has already been converted to an onboarding draft." | PASS |
| **CONV-07** | **5 SIMULTANEOUS conversions** | no second draft, no second employee | **all 5 blocked**; drafts stayed 3, employees stayed 63 | **PASS** |

**CONV-02 is the key recruitment-authority result the brief asked for**: a FULL-tier user who is not
the HR Officer is correctly refused the final conversion decision. Permission tier alone does not
grant recruitment authority.

**Reverted after testing (real applicant data):** the application used for CONV-04..07 belongs to a
real-looking applicant record. Its status was moved FOR_REQUIREMENTS → HIRED for the test and has
been **restored to FOR_REQUIREMENTS**, the QA-created onboarding draft deleted, and the QA
`application_status_history` row removed. Verified: applicants 4, job_applications 4,
onboarding_drafts 2 — all at baseline. The applicant record itself was never edited.

---

## Phase 22 — Audit history + redaction: COMPLETE (12 PASS)

| Test | Result |
|---|---|
| `/audit` access — FULL / SUPERVISOR / STANDARD | **200 / 403 / 403** |
| Filters: `action=`, `page`+`limit`, `startDate`+`endDate` | all 200 |
| Rows returned with fields `action, actor, target, entityType, entityId, oldValue, newValue, metadata, ipAddress, createdAt` | present |

**Redaction sweep over a 200-row audit payload — all CLEAN:** password values, bcrypt hashes,
access/refresh tokens, `secret`, `apikey`, `authorization: Bearer`, the plaintext temporary password
generated during onboarding, medical notes, psychological notes. **Zero occurrences of any.**

---

## Phase 24 — Help Center: COMPLETE (11 PASS)

Registry validator (`apps/web/scripts/validate-help-registry.ts`): **PASS — no registry defects.**

```
Total guides : 79     READY: 79    DRAFT: 0    METADATA_ONLY: 0
Categories   : 17
HR Personnel (FULL) 75 · Supervisor 34 · Employee (STANDARD) 27 · Public 3
```

Runtime checks in the browser:

| Test | Result |
|---|---|
| Help Center renders for FULL | "Guides for HR Personnel", 111 interactive items | PASS |
| Help Center renders for STANDARD | **"Guides for Employee"**, reduced guide set | PASS |
| Search "leave" | returns LEAVE MANAGEMENT guides with category, step count, Read Guide | PASS |
| Search nonsense | **"No guides found for … Try checking for spelling errors, using simpler keywords, or browsing by category below." + Clear Search** | PASS |
| Open a guide (`/help-center/sign-in`) | steps, Reviewed date, role banner, **Related** section, **Print Guide**, Copy Link, Back to Help Center | PASS |
| **Broken images / screenshot placeholders** | **0 broken images, 0 placeholder artefacts** (screenshots remain deferred, as intended) | PASS |
| Cross-role guide leakage | validator reports no dead or cross-role links | PASS |

### Role-based navigation (STANDARD employee)

Sidebar renders exactly: Dashboard · Attendance · Leave Management · Evaluations ·
Training & Seminars · Psychological · Announcements · Notifications · Settings · Help Center.
**No** Employees, Recruitment, Reports, Compliance admin, Audit, Medical or AI entries. Correct.

Minor inconsistency noted: `Psychological` appears in the employee sidebar but `Medical` does not,
even though the API permits self-access to both (`/medical/employees/<self>/records` → 200 for self).

---

## Phase 25 — UI/UX system QA: COMPLETE (9 PASS, 2 FAIL)

### Redesigned Performance Evaluations — verified with real data

5 StatCards (`role="group"`), 3 tabs (`role="tab"`) with count badges, a live `role="tabpanel"`,
one cohesive toolbar, populated table with a screen-reader caption
("Evaluation cycles, 1 of 1 shown"), status badge from the real enum, and correct CTA hierarchy
(ghost Refresh · subtle New Template · teal solid New Evaluation Cycle).
**No horizontal overflow at 1280px** (`scrollWidth 1280 == clientWidth 1280`).

### Redesigned Training & Seminars — verified with real data

KPI values correct (1 / 1 / 0 / 1), one toolbar, populated row showing the QA activity with type
chip, schedule, provider/venue, participants `1 / 10` plus capacity bar, compliance-link badge and
status badge. **But the page overflows horizontally — see BUG-016.**

### REGRESSION 4 — profile photo with "Keep me signed in" OFF · **PARTIALLY VERIFIED**

**No employee in the database has a `photoUrl`**, and there is no `uploads/photos` directory, so the
profile photo itself could not be exercised. Marked **UNVERIFIED** for the photo.

The underlying mechanism *was* verified at runtime. Logged in through the real form with the
checkbox unchecked (tokens landed in `sessionStorage` only, `localStorage` held just the theme),
then fetched a protected asset from page context:

```
tokenInLocalStorage : absent (Keep Me Signed In OFF)
tokenInSessionStorage : present
protectedFetchStatus : 200   contentType: application/pdf   blobSize: 193   objectUrl: created OK
```

Source confirms the same path: `useProtectedImageUrl` uses `tokenStorage.getAccessToken()`, and
`tokenStorage` reads `sessionStorage ?? localStorage`.

### REGRESSION 5 — Weekly Schedule modal usable · **PASS**

| Property | Measured |
|---|---|
| Panel size | **820 x 634 px** at a 1280x720 viewport (`sm:max-w-[820px]`, `sm:max-h-[88vh]`) |
| Position | top 36, bottom 669 — **fits entirely inside the viewport**, vertically centred |
| Body scrolling | inner `overflow-y-auto` container (scrollHeight 1047 / clientHeight 414) |
| Backdrop | `fixed inset-0 z-[60]`, no page-level scroll needed |

Structure matches the prescribed guided workflow: title + subtitle, EMPLOYEE / EFFECTIVE FROM
context, **1. Schedule Start Date**, **2. Regular Shift** (with overnight shifts annotated
"10:00 PM – 6:00 AM (next day)"), Add Another Shift, **3. Rest Day(s)** with Mon–Sun
Working/Rest toggles and per-day **Customise**, and a **sticky footer** with Cancel and
"Save Weekly Schedule".

---

## Phase 28 — Database integrity after QA: **15 / 15 CLEAN**

Run after all concurrency hammering (5-way parallel leave endorse/approve/reject/cancel,
evaluation submit/finalize, training completion retries, applicant conversion retries):

| # | Check | Result |
|---|---|---|
| 1 | Duplicate AttendanceRecord (employee + date) | **0** |
| 2 | Duplicate WeeklySchedule (employee + effectiveFrom) | **0** |
| 3 | Overlapping WeeklySchedule ranges (half-open) | **0** |
| 4 | Duplicate training-generated compliance records | **0** |
| 5 | Duplicate evaluation assignments (cycle + employee) | **0** |
| 6 | Duplicate announcement recipients | **0** |
| 7 | Duplicate notification eventIds | **0** |
| 8 | Negative / overspent leave balances | **0** |
| 9 | Leave `pending` mismatch vs open requests | **0** |
| 10 | Orphan documents | **0** |
| 11 | Duplicate onboarding drafts per created employee | **0** |
| 12 | Employees with >1 open-ended weekly schedule | **0** |
| 13 | Active users without an employee | **0** |
| 14 | Duplicate employeeNumber | **0** |
| 15 | Duplicate active user email | **0** |

---

## Phase 29 — Static validation

| Check | Result |
|---|---|
| API build (`tsc --noEmit`) | **PASS** (exit 0) — includes the `validate.ts` fix |
| Web typecheck (`tsc -b --force`) | **PASS** (exit 0) |
| Web build (`vite build`) | **PASS** (built in 1.52s) |
| `prisma validate` | **PASS** — "The schema at prisma\schema.prisma is valid" |
| `prisma migrate status` | **14 migrations found · Database schema is up to date** |
| Help Center validator | **PASS** — 79 guides, 0 defects |
| Web lint (`oxlint`) | 242 warnings (project baseline, unchanged) + **1 error** — see BUG-017 |
| API lint (`eslint`) | **BLOCKED** — the installed ESLint requires flat config; the repo still has eslintrc. Pre-existing, unrelated to QA |

### BUG-016 — Training & Seminars header overflows the viewport at desktop width
**MEDIUM · RESPONSIVE / UX · introduced by the previous UI redesign**

At a 1280px viewport the Training page has `scrollWidth 1490` vs `clientWidth 1265`
(**+225px horizontal overflow**), and the primary CTA is pushed off-screen — the
"Create Training / Seminar" button's right edge sits at **1466px**, so it is not visible without
scrolling sideways. Performance Evaluations at the same width has **zero** overflow.

Cause: `PageHeader`'s action slot is `flex items-center gap-3 w-full sm:w-auto flex-wrap
sm:flex-nowrap`. From the `sm` breakpoint up it is `flex-nowrap`, so the inner actions cannot wrap,
and the long button (196px, with the `whitespace-nowrap` added during the redesign) is forced past
the edge. This is a regression from moving the Training page onto the shared `PageHeader` — it did
not occur with the page's previous hand-rolled header. Recorded, not fixed.

### BUG-017 — Conditional React hook in WorkSchedulePage
**MEDIUM · FUNCTIONAL (latent crash)**

`apps/web/src/pages/Attendance/WorkSchedulePage.tsx:37` calls `useState` conditionally —
the only lint **error** in the web workspace (`react-hooks(rules-of-hooks)`). React requires an
identical hook order on every render; when the guarding condition changes between renders this
throws "Rendered more hooks than during the previous render" and unmounts the page. Pre-existing,
in a file untouched by QA. Not reproduced at runtime because the condition did not flip during
testing, so it is recorded as a latent defect rather than an observed failure.


---

# REPAIR PASS — 2026-09-09

A full repair + QA-completion pass ran on 2026-09-09. It is documented in
**`docs/FULL_SYSTEM_RUNTIME_QA_REPAIR_REPORT.md`**, which supersedes the bug
statuses recorded above.

## Bug dispositions

| BUG | Was | Now |
|---|---|---|
| BUG-001 confirmPassword not validated | LOW / open | **FIXED** |
| BUG-002 dark-mode token failure | HIGH / open | **FIXED** — KPI contrast 1.05:1 -> 16.28:1 |
| BUG-003 global border override | HIGH / open | **FIXED** — every border utility works |
| BUG-004 refresh token truncation | HIGH / open | **FIXED** — migration + full refresh cycle proven |
| BUG-005 recruitment HTTP 500s | MEDIUM / open | **FIXED** — 403/404/409 correct |
| BUG-006 leave notification keys | LOW / open | **FIXED** (keys); enum label DEFERRED with reason |
| BUG-007 blank supervisor on review | LOW / open | **FIXED** |
| BUG-008 empty schedule templates | HIGH / open | **PARTIALLY FIXED** — source guard added; 46 employees need configuration (**CLIENT POLICY REQUIRED**) |
| BUG-009 raw Prisma error leakage | MEDIUM / open | **FIXED** — sanitized, secrets redacted in logs too |
| BUG-010 unknown fields ignored | LOW / open | **FIXED** |
| BUG-011 rating-method mismatch | HIGH / open | **FIXED** — presets serialise to LABELED + scoreLabels |
| BUG-012 evaluation submit concurrency | MEDIUM / open | **FIXED** — 1x200 / 4x409 |
| BUG-013 validate() wiped req.params | CRITICAL / fixed in QA | **RE-VERIFIED** on all 3 routes |
| BUG-014 AI availability untruthful | MEDIUM / open | **FIXED** — CONFIGURED / NOT_CONFIGURED + badge gated |
| BUG-015 responsive shell offset | HIGH / open | **FIXED** — 0 overflow at 375-1440 |
| BUG-016 Training header overflow | MEDIUM / open | **FIXED** |
| BUG-017 conditional React hook | MEDIUM / open | **FIXED** — web lint 0 errors |

## Found and fixed during the repair pass

- **BUG-018** — two logins in the same second minted an identical refresh token (P2002).
  Fixed with a `jti` claim. 5 simultaneous logins now all return 200.
- **BUG-019** — 54 hard-coded `bg-white` surfaces became light-on-white once the theme tokens
  were repaired. Replaced with `bg-surface` on authenticated pages only.

## Still open (recorded, not changed)

- **CLIENT POLICY REQUIRED** — 47 active employees resolve to LEGACY_TEMPLATE / UNCONFIGURED
  and need a weekly schedule configured by HSJ. Working days cannot be inferred from a
  template name, and the resolver correctly refuses to guess.
- **CLIENT POLICY REQUIRED** — a leave request was accepted for a year with no balance row.
- **LOW** — avatar initials render white-on-amber at 1.67:1.
