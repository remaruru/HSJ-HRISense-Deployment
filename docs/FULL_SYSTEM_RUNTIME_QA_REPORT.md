# HSJ HRISense — Full System Runtime QA Report

> **SUPERSEDED IN PART — 2026-09-09.**
> A repair + QA-completion pass has since fixed **all 17** defects recorded below (two as
> documented deferrals) and exercised **every** phase listed in section 54 as untested.
> For current status read **`docs/FULL_SYSTEM_RUNTIME_QA_REPAIR_REPORT.md`**.
> This document is retained as the record of the 2026-09-08 baseline QA run.
>
> | | 2026-09-08 (this report) | 2026-09-09 (after repair) |
> |---|---|---|
> | Final status | SYSTEM RUNTIME QA FOUND BLOCKING ISSUES | **SYSTEM RUNTIME QA PASSED WITH NON-BLOCKING ISSUES** |
> | Open CRITICAL / HIGH | 1 / 6 | **0 / 0** |
> | Untested phases | 10 | **0** |
> | Dark mode | broken (KPI 1.05:1) | **fixed (16.28:1)** |
> | Border utilities | none worked | **all work** |
> | Session refresh | always failed | **works** |
> | Mobile shell | every page overflowed | **0 overflow, 375-1440** |

**Date**: 2026-09-08
**Repository**: `C:\xampp\htdocs\HRISense` · branch `main`
**HEAD at start and at end**: `7648345b4c08ec74387ee2b8f67136395c5549b8` (unchanged)
**Method**: live API + live web app + real browser + direct database inspection
**Evidence detail**: `docs/FULL_SYSTEM_RUNTIME_QA_PROGRESS.md` (1,267 lines)

Every result below was produced by exercising the running system. Nothing is marked PASS on the
strength of a successful compile.

---

## 1–5. Test totals

| | |
|---|---|
| **1. Total test cases** | **300** |
| **2. PASS** | **288** |
| **3. FAIL** | **10** |
| **4. BLOCKED** | **1** (API ESLint — flat-config migration, pre-existing) |
| **5. UNVERIFIED** | **1** (profile-photo rendering — no employee in the database has a photo) |

## 6–30. Coverage answers

| # | Question | Answer |
|---|---|---|
| 6 | Browser/runtime tests actually executed? | **YES** — Chromium, real login, real form submission, real modals |
| 7 | FULL role tested? | **YES** (`hr@gmail.com` HR Officer + `hrassistant@gmail.com` HR Assistant) |
| 8 | SUPERVISOR role tested? | **YES** (two supervisors with separate subordinates) |
| 9 | STANDARD role tested? | **YES** (three employees incl. the newly onboarded one) |
| 10 | Public careers tested? | **YES** (unauthenticated) |
| 11 | Authorization boundary tested? | **YES** — direct API calls, not just hidden UI |
| 12 | Employee onboarding tested end-to-end? | **YES** — all 7 steps, real employee created (HSJ-0017) |
| 13 | Credential PDF regression tested? | **YES** — PASS |
| 14 | Documents regression tested? | **YES** — PASS |
| 15 | Schedule overlap runtime tested? | **YES** — PASS |
| 16 | Leave concurrency tested? | **YES** — 5-way parallel on 4 transitions |
| 17 | Training→Compliance retry tested? | **YES** — PASS |
| 18 | Evaluation retry tested? | **YES** — finalize PASS, submit FAIL |
| 19 | AI/Report/Tally consistency tested? | **YES** — three-way agreement |
| 20 | Attendance date round-trip tested? | **YES** — 4 boundary dates |
| 21 | Reports exports tested? | **YES** — 21/21 files opened and validated |
| 22 | Recruitment tested? | **YES** incl. HR-Officer-only authority |
| 23 | Applicant public flow tested? | **YES** |
| 24 | Applicant conversion tested? | **YES** incl. 5-way concurrent retry |
| 25 | Health privacy tested? | **YES** — supervisors denied even for own subordinates |
| 26 | Notifications tested? | **PARTIAL** — duplication verified via workflows; UI unread/mark-read not exercised |
| 27 | Audit redaction tested? | **YES** — PASS |
| 28 | Help Center tested? | **YES** — 79 guides, multi-role |
| 29 | Dark mode tested? | **YES** — found BUG-002 |
| 30 | Mobile/responsive tested? | **YES** — 1440 / 1280 / 1024 / 768 / 375 |

## 31–35. Problems found

**31. Browser console errors** — 2 (both from a deliberately bad URL I typed, `/employees/onboarding`
→ 404). **Zero** console errors across all 17 profile tabs, the redesigned pages, the Help Center,
and the onboarding wizard. Zero unhandled promise rejections.

**32. Server errors** — recurring `[Error]` log entries where routine authorization denials and
not-found conditions are logged as errors and returned as HTTP 500 (BUG-005), plus the crashes from
BUG-013 before it was fixed.

**33. Database-integrity problems** — **none**. All 15 post-QA integrity checks returned 0 after
heavy concurrency testing.

**34. Authorization failures** — **none**. No test breached a boundary. The only authorization
finding is a wrong *status code* (BUG-005), not a wrong *decision*.

**35. UX problems** — 5: dark-mode token failure (BUG-002), the global border override (BUG-003),
the responsive layout overflow (BUG-015), the Training header overflow (BUG-016), and a blank
supervisor field on the onboarding review screen (BUG-007).

## 36–39. Bug counts by severity

| Severity | Count | IDs |
|---|---|---|
| **36. CRITICAL** | **1** | BUG-013 *(fixed — it blocked required testing)* |
| **37. HIGH** | **5** | BUG-002, BUG-003, BUG-004, BUG-008, BUG-011, BUG-015 |
| **38. MEDIUM** | **5** | BUG-005, BUG-009, BUG-012, BUG-014, BUG-016, BUG-017 |
| **39. LOW / COSMETIC** | **4** | BUG-001, BUG-006, BUG-007, BUG-010 |

*(HIGH lists 6 and MEDIUM 6 because BUG-015 and BUG-016/017 are counted in their own rows; total
distinct defects = **17**.)*

## 40–42. QA records

**40. Created** (all clearly QA-tagged):

| Record | Table |
|---|---|
| Employee **HSJ-0017 "QATest Onboarding"** + its user account | `employees`, `users` |
| 3 weekly schedules (Sep 1 / Sep 15 / Oct 1) + day & shift rows | `employee_weekly_schedules` (+2 child tables) |
| 1 legacy schedule assignment | `employee_schedule_assignments` |
| 4 attendance records `qa-att-0001..0004` (`QA_ATT_TEST` remarks) | `attendance_records` |
| 4 documents (`QA_DOC_TEST` notes) + files on disk | `employee_documents` |
| 2 leave balances (VACATION 10, SICK 10) for DEV-GSS-002 | `leave_balances` |
| 3 leave requests (`QA_LEAVE_TEST` reasons) — APPROVED / REJECTED / CANCELLED | `leave_requests` |
| Compliance requirement `QA_COMPLIANCE_TEST BLS Certification` + scope | `compliance_requirements_new`, `compliance_requirement_scopes` |
| Training activity `QA_TRAINING_TEST Basic Life Support Refresher` + 1 participant | `training_activities`, `training_participants` |
| Auto-generated compliance record `TRN-D2C27713` | `employee_compliance_records` |
| Evaluation template + 2 criteria, cycle + scope + 1 assignment + 2 responses (`QA_EVAL_TEST`) | 6 evaluation tables |
| 11 notifications and 67 audit rows produced as side effects | `notifications`, `audit_logs` |

**41. Removed / reverted**

- `driver@gmail.com` — password hash restored from snapshot, `failedLoginAttempts=0`,
  `lockedUntil=NULL`, `mustChangePassword=0`, reset-token rows deleted. Re-login verified.
- Application `HSJ-APP-2026-799532` — status restored **HIRED → FOR_REQUIREMENTS**, the QA-created
  onboarding draft deleted, the QA status-history row removed. `applicants` 4,
  `job_applications` 4, `onboarding_drafts` 2 — all back to baseline.

**42. Intentionally retained** — everything in the table above. All rows carry a `QA_`-prefixed
name, note, reason or remark, or belong to employee `HSJ-0017`, so they are trivially findable.
They were kept so you can inspect the evidence yourself. **Nothing pre-existing was deleted.**

## 43–50. Environment and build

| # | Item | Result |
|---|---|---|
| **43** | Database backup | `hrisense_db_backup_pre_full_system_qa_20260908_065608.sql` (617,684 bytes; 76 CREATE TABLE, 41 INSERT). 13 pre-existing backups untouched |
| **44** | Git write operations | **NONE.** Only `status` / `diff` / `branch --show-current` / `rev-parse` / `log -1` were run. Nothing staged |
| **45** | Current HEAD | `7648345b4c08ec74387ee2b8f67136395c5549b8` — **unchanged** |
| **46** | API build (`tsc --noEmit`) | **PASS** |
| **47** | Web build (`tsc -b` + `vite build`) | **PASS** |
| **48** | `prisma validate` | **PASS** |
| **49** | `prisma migrate status` | 14 migrations · **Database schema is up to date** |
| **50** | Help Center validator | **PASS** — 79 guides, all READY, 17 categories, 0 defects |

**Email safety**: the API was restarted under QA control with process-level overrides
(`ENABLE_TRANSACTIONAL_EMAILS=false`, `RECRUITMENT_EMAIL_SEND_ENABLED=false`,
`RECRUITMENT_EMAIL_PROVIDER=DEVELOPMENT`, auto-email flags off). `apps/api/.env` was **not**
modified. Proven at runtime by the log line
`[BREVO_TRANSACTIONAL] Simulation mode: "Welcome to HRISense — Your Login Credentials" to
qa.onboarding.personal@example.com was NOT sent.` **No real email left the machine.**
**No OpenAI request was made** — `/ai/analyze` and `/ai/ask` were deliberately never called.

---

## 51. TOP 10 issues

| # | ID | Severity | Issue |
|---|---|---|---|
| 1 | **BUG-013** | CRITICAL *(fixed)* | `validate()` wiped `req.params`, 500-ing `PUT /attendance/:id`, `POST /employees/:employeeId/documents` and `PUT /documents/:documentId`. **HR could not correct any attendance record and no document could be uploaded.** |
| 2 | **BUG-003** | HIGH | An unlayered `*{border-color:var(--border)}` beats every Tailwind border utility. `border-red-500` computes to `#334155`. This is the direct cause of the "too many dark outlined boxes" complaint, and it silently neutralised the `--border-soft` token. **One-line fix.** |
| 3 | **BUG-002** | HIGH | Dark mode: every `--color-*` token resolves to its LIGHT value. Dashboard KPI numbers render at **1.05:1 contrast** — effectively invisible. Token-styled panels stay white in dark mode. |
| 4 | **BUG-008** | HIGH | Every **active** schedule template has **zero** day rows; the 6 templates that have days are all deactivated. **All 63 employees** resolve to "Needs Setup". |
| 5 | **BUG-011** | HIGH | Evaluation rating-method enum mismatch: the UI offers NUMERIC / LIKERT_5 / SATISFACTION_4 / DESCRIPTIVE; the database accepts only NUMERIC / LABELED. **3 of 4 advertised options cannot be saved.** |
| 6 | **BUG-004** | HIGH | `user_sessions.refreshToken` is `varchar(191)` but the JWT is 192 chars — silently truncated, so **token refresh always fails**. Sessions die at the 8-hour access-token expiry. |
| 7 | **BUG-015** | HIGH | Responsive: `main` keeps a 260px left offset after the sidebar hides. At 375px every page overflows (dashboard +138px, evaluations +737px, training +1116px, employees +1140px). |
| 8 | **BUG-005** | MEDIUM | Every recruitment error returns **HTTP 500** instead of 403/404 — including on the public careers endpoint. Denials are correct; only the status code is wrong. |
| 9 | **BUG-009** | MEDIUM | Raw Prisma errors — absolute file paths, source excerpts, query internals, record ids — are returned to API clients. |
| 10 | **BUG-012** | MEDIUM | Evaluation **submit** is not a guarded transition: 5 concurrent submits all returned 200 and wrote 5 audit rows. (Finalize is correctly guarded: 1×200 / 4×409.) |

Also found: BUG-014 (AI reports "available" on a placeholder key), BUG-016 (Training header
overflows at desktop — a regression from the recent UI redesign), BUG-017 (conditional React hook
in `WorkSchedulePage`), BUG-001/006/007/010 (low).

## 52. Must fix before the capstone presentation

1. **BUG-003** — one line (`@layer base { … }`). Fixes the system-wide "dark boxes" look instantly.
2. **BUG-002** — dark mode is visibly broken on the first screen a panel sees. If a full token
   refactor is too risky now, at minimum give the dashboard KPI numbers an explicit `dark:` colour.
3. **BUG-013** — already fixed, but **verify it yourself**: attendance correction and document
   upload were completely dead before it.
4. **BUG-008** — a demo where every employee's schedule says "Needs Setup" undercuts the
   scheduling story. Likely a data fix (attach day rows to the active templates).
5. **BUG-011** — do not demo template creation with LIKERT_5/SATISFACTION_4/DESCRIPTIVE; they fail.
   Either align the enum or hide the three unsupported options.
6. **BUG-016** — the Training page's primary button is off-screen at 1280px. Small CSS fix.

## 53. Can wait

BUG-004 (needs a migration; login still works), BUG-005 and BUG-009 (correct behaviour, wrong
status code / verbose errors), BUG-012 (audit noise only, no data corruption), BUG-014,
BUG-015 (only if you will not demo on a phone), BUG-001, BUG-006, BUG-007, BUG-010, BUG-017.

## 54. Still unverified, and why

| Area | Why |
|---|---|
| **Profile photo rendering** (regression 4) | No employee has a `photoUrl` and there is no photos upload directory. The underlying protected-asset fetch with session-only tokens **was** verified (200, correct blob) |
| **Phase 5 Account management** | Activate / deactivate / lock / unlock / force-reset were not exercised — they change real login state and time ran to other priorities |
| **Phase 6 Org hierarchy** | Org chart loads (200 for all roles); cycle protection and manual override were not exercised |
| **Phase 8 Holidays** | Not exercised |
| **Phase 13 Compliance workflow** | The live compliance table was empty; only the QA requirement and the training-generated record were exercised. Derived status transitions (EXPIRING_SOON / EXPIRED) not aged |
| **Phase 14 Medical/Psychological CRUD** | **Privacy was fully tested** (supervisors denied, self-access allowed, HR allowed). Record creation/update/review was not — both tables are empty |
| **Phase 18 Announcements** | Publish/audience/read-receipt not exercised |
| **Phase 19 Notifications UI** | Duplication was verified through workflows; unread count, mark-read and deep-link permission were not |
| **Phase 23 Settings** | Only the theme toggle was used |
| **Phase 26 Error states** | Malformed input and 400/401/403/404/409 were exercised throughout, but the API was never stopped to test offline error/retry panels |
| **Attendance import apply engine** | Correctly unreachable — no Mustard normalizer. Process Import remains disabled; schema, provenance columns and classification enums exist. Nothing was faked |

## 55. Confidence by module

| Module | Confidence | Basis |
|---|---|---|
| Authentication & session | **HIGH** | 30 tests; lockout, reset, forgery, storage all correct. Refresh is broken (BUG-004) |
| Authorization / RBAC | **HIGH** | 40 direct API tests; **no boundary breached**, scoping intersects rather than trusts input |
| Leave workflow & balances | **HIGH** | Full lifecycle + 4 concurrency storms; balances exact, 0 drift |
| Employee onboarding | **HIGH** | End-to-end in the browser; correct writes, personal-email welcome, PDF regression clean |
| Documents | **HIGH** | Upload/visibility/preview/download matrix fully correct once BUG-013 was fixed |
| Work schedules (new weekly) | **HIGH** | Effective-dating exactly right; 0 overlaps system-wide |
| Training → Compliance | **HIGH** | Idempotency holds under 5-way parallel retry |
| Reports & exports | **HIGH** | 21/21 exports valid; three-way attendance agreement |
| AI fact sheet & payload safety | **HIGH** | Aggregates only, zero PII; availability reporting is wrong (BUG-014) |
| Audit & redaction | **HIGH** | HR-only, filters work, no secrets in payload |
| Public careers & status links | **HIGH** | Stateless HMAC, tamper-resistant, minimal payload |
| Recruitment authority | **HIGH** | HR-Officer-only conversion enforced beyond permission tier |
| Attendance (records, dates, corrections) | **MEDIUM** | Round-trip and provenance correct, but only 24 records exist and the correction path was dead until fixed |
| Evaluations | **MEDIUM** | Workflow and finalize guard correct; enum mismatch and unguarded submit |
| Help Center | **MEDIUM** | 79 guides validate and render; screenshots still deferred |
| Scheduling (legacy templates) | **LOW** | Every active template has no day rows; all 63 employees unresolved |
| Dark mode / theming | **LOW** | Token system does not work in dark mode; no border utility works anywhere |
| Responsive / mobile | **LOW** | Every page overflows horizontally below ~1024px |
| Announcements, Notifications UI, Settings, Holidays, Org hierarchy, Account management | **LOW** | Not exercised |

---

## Production code changed during QA

Exactly one file, to unblock explicitly-required testing:

**`apps/api/src/middleware/validate.ts`** — guard the three assignments so a schema that does not
declare `params` / `query` no longer erases them:

```ts
if (parsed.body !== undefined) req.body = parsed.body;
if (parsed.query !== undefined) req.query = parsed.query;
if (parsed.params !== undefined) req.params = parsed.params;
```

Nothing else in the application was modified. All other defects were recorded and left in place for
your review, as instructed.

---

# FINAL STATUS

## SYSTEM RUNTIME QA FOUND BLOCKING ISSUES

The core business logic is genuinely strong — authorization held under direct API attack,
concurrency guards held under parallel load, balances and dates stayed exact, the database is
completely clean after the whole pass, and the AI payload carries no personal data. Those are the
hardest things to get right, and they are right.

But this cannot be called passed:

- one **CRITICAL** defect made attendance correction and document upload impossible until it was
  fixed during this pass;
- **dark mode does not work** and **no border colour in the application has any effect**;
- **every employee** resolves to an unusable schedule;
- **three of four** advertised evaluation rating methods cannot be saved;
- **session refresh never succeeds**;
- **every page overflows horizontally on a phone**.

Ten of the twenty-nine phases were also never exercised (section 54), so overall coverage is
substantial but not complete.
