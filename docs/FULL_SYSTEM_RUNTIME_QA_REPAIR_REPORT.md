# HSJ HRISense — Runtime QA Bug Repair + QA Completion Report

**Date**: 2026-09-09
**Repository**: `C:\xampp\htdocs\HRISense` · branch `main`
**HEAD at start and at end**: `7648345b4c08ec74387ee2b8f67136395c5549b8` — **unchanged**
**Git write operations**: **NONE** (read-only `status` / `diff` / `rev-parse` / `branch` only; nothing staged)
**Source of truth**: `docs/FULL_SYSTEM_RUNTIME_QA_REPORT.md` + `docs/FULL_SYSTEM_RUNTIME_QA_PROGRESS.md`

Every "FIXED" below was re-tested against the running system. Nothing is marked fixed on the
strength of a compile.

---

## 1. Repair summary

| BUG | Severity | Verdict |
|---|---|---|
| BUG-001 | LOW | **FIXED** |
| BUG-002 | HIGH | **FIXED** |
| BUG-003 | HIGH | **FIXED** |
| BUG-004 | HIGH | **FIXED** (schema migration) |
| BUG-005 | MEDIUM | **FIXED** |
| BUG-006 | LOW | **FIXED** (idempotency keys); enum label **DEFERRED** with reason |
| BUG-007 | LOW | **FIXED** |
| BUG-008 | HIGH | **PARTIALLY FIXED** — source logic fixed; existing data is **CLIENT POLICY REQUIRED** |
| BUG-009 | MEDIUM | **FIXED** |
| BUG-010 | LOW | **FIXED** |
| BUG-011 | HIGH | **FIXED** |
| BUG-012 | MEDIUM | **FIXED** |
| BUG-013 | CRITICAL | **FIXED** in the QA pass — **re-verified here** |
| BUG-014 | MEDIUM | **FIXED** |
| BUG-015 | HIGH | **FIXED** |
| BUG-016 | MEDIUM | **FIXED** |
| BUG-017 | MEDIUM | **FIXED** |

Two additional defects were **found and fixed** during this pass (see §3): **BUG-018**
(identical refresh tokens inside one second) and **BUG-019** (hard-coded white surfaces
exposed by the theme repair). One new **LOW** finding and one **CLIENT POLICY REQUIRED**
item are recorded but not changed.

---

## 2. Bug-by-bug detail

### BUG-001 — `confirmPassword` accepted but never validated · **FIXED**
**Root cause** `changePasswordSchema` (`apps/api/src/controllers/auth.controller.ts`) never
declared `confirmPassword`, so zod stripped it and a mismatched confirmation still changed the
password.
**Fix** Added the field as optional with a `.refine()` that enforces equality whenever it is
supplied — existing clients that omit it keep working.
**Runtime retest**

```
mismatch  -> HTTP 400  {"field":"confirmPassword","message":"The new password and its confirmation do not match."}
old password still works afterwards -> login 200   (password was NOT changed)
matching confirmation -> HTTP 200                  (normal path intact)
```

### BUG-002 — Dark mode: every `--color-*` token resolved to its LIGHT value · **FIXED**
**Root cause** Two separate faults in `apps/web/src/index.css`:
1. `@theme { --color-surface: var(--surface) }` is emitted on `:root`. A CSS custom property
   substitutes at its point of **definition**, so the alias froze to `:root`'s light value and
   every element inherited that resolved colour. Redefining `--surface` deeper could never
   change what `bg-surface` painted.
2. The selector `html.dark :root` **can never match** — `:root` *is* `<html>`, and an element
   cannot be its own descendant, so public pages had no dark values at all.

**Fix** Added a *Semantic Token Bridge* re-declaring the aliases on `:root, .authenticated-app`
so each alias resolves against that scope's own value, and corrected `html.dark :root` →
`html.dark`. Colour values are still defined exactly once.
**Runtime retest** (dark mode, inside `.authenticated-app`)

| token | before | after |
|---|---|---|
| `--color-foreground` | `#0f172a` | **`#f8fafc`** |
| `--color-background` | `#f8fafc` | **`#080f1d`** |
| `--color-surface` | `#ffffff` | **`#111c30`** |
| `--color-border` | `#334155` | **`#475569`** |
| `--color-border-soft` | `#e2e8f0` | **`#24324a`** |
| `--color-muted-foreground` | `#64748b` | **`#94a3b8`** |

**Dashboard KPI contrast: 1.05:1 → 16.28:1.** All **45/45** `.text-foreground` elements now
render light (previously 0/45). The login page also renders dark correctly for the first time.

### BUG-003 — A global unlayered `*` rule defeated every border-colour utility · **FIXED**
**Root cause** `*{border-color:var(--border)}` sat **outside** any cascade layer. Tailwind v4
emits utilities inside `@layer utilities`, and an unlayered declaration beats a layered one
regardless of specificity.
**Fix** Wrapped the reset (and the `html`/`body` base rules) in `@layer base { … }`. No
`!important`, no per-element overrides.
**Runtime retest** — every border utility now paints its own colour:

| probe | before | after |
|---|---|---|
| `border-border-soft` | `#475569` (the heavy border) | **`rgb(36,50,74)`** = the soft token |
| `border-danger` | `#475569` | **`rgb(220,38,38)`** |
| `border-primary-200` | `#475569` | **`rgb(151,214,212)`** |
| `border-emerald-200` | `#475569` | **oklch emerald** |
| `border-transparent` | `#475569` | **`rgba(0,0,0,0)`** |

*(The original report's `border-red-500` probe was invalid — that class appears nowhere in the
source, so Tailwind's JIT never generated it. The classes above are all really used.)*

### BUG-004 — Refresh token silently truncated; refresh always failed · **FIXED**
**Root cause** `user_sessions.refreshToken` was `varchar(191)` (Prisma's default for an indexed
MySQL String) while the JWT is 192 characters. This MySQL runs without `STRICT_TRANS_TABLES`,
so every insert truncated by one character and the lookup by full token never matched.
**Preflight** all **113** existing rows measured at exactly 191 chars; table is InnoDB `DYNAMIC`
(3072-byte index limit), so `varchar(512)` (2048 bytes) is safe for both indexes.
**Fix** `refreshToken String @unique @db.VarChar(512)` +
migration `20260909181500_widen_user_session_refresh_token`.

Migration discipline: fresh backup taken first; the generated `migrate diff` again contained
**pre-existing drift** (1 dropped FK, 6 `DROP INDEX`, ~12 no-op `MODIFY … JSON`) which was
**hand-excluded** with a documented scope note — the migration contains exactly one statement.
Tested on a **rebuilt** `hrisense_migration_dev_db` (all 15 applied cleanly) before
`migrate deploy` on `hrisense_db`. `migrate dev` / `db push` / `reset` / seed were never run
against main.

**Runtime retest — the full cycle, not just the column width**

```
1. login              -> issued refreshToken length = 192
2. stored length      -> 192          (was 191 — truncation gone)
3. POST /auth/refresh -> HTTP 200     (was 401)
4. GET /auth/me with the NEW access token -> HTTP 200
```

**Access-token lifetime reconciled**: `JWT_EXPIRES_IN=8h` in `apps/api/.env`, and the issued
token's `exp - iat` measured **28800 s = 8 h**. The QA report and the configuration agree; no
discrepancy.

### BUG-005 — Every recruitment error returned HTTP 500 · **FIXED**
**Root cause** Two layers. `errorHandler` read `statusCode` only for `AppError`, so
`RecruitmentError` (which declares its own 403/404) collapsed to 500; and 22 call sites threw a
bare `new Error(...)` carrying no status at all.
**Fix** `errorHandler` now duck-types any error declaring a numeric `statusCode`, and the 22
bare throws across `job-application`, `applicant-conversion`, `applicant-communication` and
`job-opening` services were retyped to `AppError` with the status their meaning implies
(not-found → 404, conflict → 409, otherwise 400). Messages are unchanged.
**Runtime retest**

| request | expected | before | after |
|---|---|---|---|
| `/recruitment/openings` as SUPERVISOR | 403 | 500 | **403** |
| `/recruitment/applications` as SUPERVISOR | 403 | 500 | **403** |
| `/recruitment/openings/<missing>` as HR | 404 | 500 | **404** |
| `/recruitment/applications/<missing>` as HR | 404 | 500 | **404** |
| public opening by bad slug (unauthenticated) | 404 | 500 | **404** |
| convert a non-HIRED application | 409 | 500 | **409** |

Responses now carry a safe application code, e.g. `{"error":"You are not authorized to perform
this recruitment action.","code":"RECRUITMENT_FORBIDDEN"}`.
**Authorization itself was not weakened** — re-verified: HR Assistant (FULL tier, not HR
Officer) attempting a conversion still gets **403** "Only HR Officers can convert applicants to
onboarding drafts."

### BUG-006 — Leave notifications had no idempotency key · **FIXED** (label deferred)
**Fix** Added source-event keys to the four notifications that lacked them:
`leave-filed-supervisor:`, `leave-filed-hr:`, `leave-endorsed-hr:`, `leave-endorsed-employee:`
(`notifyMany` already scopes a key per recipient, so the unique constraint holds for
multi-recipient sends).
**Runtime retest** — a freshly filed leave produced
`eventId = leave-filed-supervisor:604e0cb1-…:ce1fec77-…` (previously `NULL`).
**DEFERRED, with reason**: the notifications are still typed `LEAVE_FILED` for endorsement
events because `NotificationType` has no `LEAVE_ENDORSED` member. Adding one is a schema
migration for a display label only; the title already distinguishes the events, and the
correctness-relevant half (the key) is fixed.

### BUG-007 — Blank "Immediate Supervisor" on the onboarding Review screen · **FIXED**
**Root cause** The review step read `supervisorPreview.supervisorName`, a property the
resolve endpoint never returns. The employment step reads the nested `supervisor` object.
**Fix** Review now uses the same shape, with the PENDING and "no supervisor required" branches
handled explicitly.

### BUG-008 — Active schedule templates have zero day rows · **PARTIALLY FIXED**
**Investigation (as instructed, before changing anything).** The catalogue is two distinct
generations, not one broken set:

| group | created | isActive | isArchived | day rows | assignments |
|---|---|---|---|---|---|
| A v1 (Regular Day Shift, Night Shift, …) | 2026-08-09 | 1 | 1 | **0** | 61 + 1 |
| A v2 (same six names) | 2026-08-09 | 0 | 1 | **7** | 61 + 1 |
| B (Office 8AM–12NN, Shift 10PM–6AM, …) | 2026-08-15 | 1 | 0 | **0** | 2 |

Group B — the set the onboarding wizard offers — **never had day rows created**. Its names
encode a *shift time*, not a *working-day pattern*, and the shift times already exist in the new
`shift_definitions` table. **Which days a person works cannot be derived from a template name**,
so no days were attached.

**Canonical authority is already correct and was preserved.**
`ScheduleResolverService` resolves `WEEKLY → LEGACY_TEMPLATE → UNRESOLVED` and deliberately
returns `status: 'UNCONFIGURED'` for the legacy branch, with the comment *"the legacy track does
not model per-day working/rest state in a form this resolver can trust, so it must not claim
one."* The "Needs Setup" display is therefore **correct behaviour**, not a resolution bug.

**Source-logic fix applied** `ScheduleService.createTemplate` accepted `days: []` silently
(`data.days.map` on an empty array), which is how empty templates came to exist. It now rejects
any template that does not define all seven weekdays.
**Runtime retest**

```
POST /schedules/templates {"days":[]}                  -> 400 "must define all seven days … Missing: MONDAY, …, SUNDAY."
POST /schedules/templates {"days":[MONDAY only]}       -> 400 "… Missing: TUESDAY, …, SUNDAY."
templates created by those probes                      -> 0
```

**CLIENT POLICY REQUIRED — existing data.** Current schedule-resolution census:

| resolution | count |
|---|---|
| active employees (total) | **49** |
| **WEEKLY** (canonical `EmployeeWeeklySchedule`) | **2** |
| **LEGACY_TEMPLATE** only → reports UNCONFIGURED | **47** |
| **UNCONFIGURED** with no schedule at all | **0** |
| schedule templates that can never yield a working week | **12** |

**47 active employees need a weekly schedule configured by HSJ.** HRISense must not invent one.
(Measured at the end of the pass, after the two QA employees HSJ-0017 and HSJ-0018 were added;
the pre-pass figure was 46 of 48.)

### BUG-009 — Raw Prisma errors returned to clients · **FIXED**
**Fix** `errorHandler` now translates Prisma exceptions into safe messages with correct statuses
(P2002 → 409, P2025 → 404, P2003 → 400, validation → 400, init/panic → 503) and returns a
generic message for any other unexpected fault. Full detail still goes to the server log, with
secret-looking values (`password`, `token`, `secret`, `apiKey`, `authorization`, …) redacted
before logging.
**Runtime retest** — malformed weekly-schedule payload, previously a multi-line dump containing
the absolute source path and a code excerpt:

```
HTTP 400  {"error":"Some submitted values are not valid for this operation. …","code":"INVALID_REQUEST_SHAPE"}
absolute file path  clean       source excerpt  clean
prisma internals    clean       stack trace     clean       record id  clean
```

### BUG-010 — Unknown fields silently ignored, still 200 · **FIXED**
**Fix** `TrainingService.updateParticipantStatus` now rejects a missing or invalid
`participationStatus` instead of falling through and reporting success.
**Runtime retest** `{"status":"COMPLETED"}` (wrong field name) → **400** "`participationStatus`
is required and must be one of: ASSIGNED, COMPLETED, DID_NOT_ATTEND, EXCUSED, CANCELLED."
(previously **200** "Participant status updated" while changing nothing).

### BUG-011 — Evaluation rating-method mismatch · **FIXED**
**Investigation** confirmed the interpretation the brief suggested: `EvaluationTemplate` already
has a `scoreLabels Json?` column the backend persists and returns but the UI never sent, and the
service branches `NUMERIC` (numeric range) vs **everything else** (label or comment). LIKERT_5 /
SATISFACTION_4 / DESCRIPTIVE are therefore **presets over the canonical `LABELED` method**, not
database values. **No new Prisma enum was created.**

**Fix** Added a `RATING_PRESETS` registry to the frontend service. Each preset declares its
canonical `ratingMethod` plus its scale, serialised into `scoreLabels` as
`{presetId, options}`; `resolveRatingPreset()` recovers the preset for display and for
re-selecting the card when editing. The template builder, the evaluations list, the template
detail dialog, the employee evaluation history tab and `formatEvaluationResult` were all moved
onto the preset. The evaluator form now renders the preset's **labels** for LABELED templates
and validates `ratingLabel` instead of `ratingNumeric`.

**Runtime retest — every option HR can see now saves:**

| preset chosen in the UI | stored `ratingMethod` | stored `scoreLabels.presetId` | options | HTTP |
|---|---|---|---|---|
| Numeric Scale | `NUMERIC` | — | — | **201** |
| 5-Point Scale | `LABELED` | `LIKERT_5` | 5 | **201** |
| 4-Point Satisfaction | `LABELED` | `SATISFACTION_4` | 4 | **201** |
| Written / Descriptive | `LABELED` | `DESCRIPTIVE` | 0 | **201** |

**End-to-end on a LABELED template**: cycle created → evaluator draft (200) → submit stored
`ratingLabel = VERY_SATISFACTORY` → finalize (200). Previously 3 of the 4 failed outright.
0 templates in the database hold an invalid `ratingMethod`.

### BUG-012 — Evaluation submit was not a guarded transition · **FIXED**
**Root cause** The claim predicate was `status: { not: FINALIZED }`, which an already
`SUBMITTED` row also satisfies — so all five concurrent submits matched a row and each wrote an
audit entry.
**Fix** The claim now names the legal source states, `status: { in: [NOT_STARTED, IN_PROGRESS] }`.
Amending a submitted evaluation still works because saving a draft returns it to `IN_PROGRESS`.
**Runtime retest** — 5 simultaneous submits:

| | before | after |
|---|---|---|
| HTTP responses | 5 × 200 | **1 × 200, 4 × 409** |
| `EVALUATION_SUBMITTED` audit rows | **5** | **1** |
| response rows | 1 per criterion | 1 per criterion (unchanged) |

Finalize regression re-checked: **1 × 200, 4 × 409**, one audit row.

### BUG-013 — `validate()` wiped `req.params` · **RE-VERIFIED (not reverted)**
The QA-pass fix in `apps/api/src/middleware/validate.ts` is present and unchanged.
**Runtime retest of all three affected routes:**

```
PUT  /attendance/:id (valid)               -> 200   (provenance intact: sourceType=MANUAL, recordVersion=4)
PUT  /attendance/:id (unknown field)       -> 400
PUT  /attendance/:id (empty body)          -> 400
POST /employees/:employeeId/documents      -> 201
PUT  /documents/:documentId (metadata)     -> 200   (stored notes updated)
GET  /documents/:documentId/download       -> 200
GET  /documents/:documentId/preview        -> 200
```

### BUG-014 — AI reported itself available on a placeholder key · **FIXED**
**Fix** `AiService.availability()` now validates the key's *shape* (rejects empty,
`your…`/`placeholder`/`api-key-here`, and anything not matching `sk-…`) and returns an explicit
`status: 'CONFIGURED' | 'NOT_CONFIGURED'`. It makes **no network call**, so it never claims
reachability. The hard-coded **"AI Active" badge in `TopNav`** — which advertised working AI
unconditionally — now renders only when `/ai/status` reports configured, and only for FULL-tier
users (the endpoint is HR-only). No key material is exposed.
**Runtime retest**

```
GET /ai/status -> {"available":false,"status":"NOT_CONFIGURED",
                   "reason":"… the provider API key is a placeholder rather than a real key.
                             The workforce figures below are calculated directly from HRISense data
                             and remain accurate."}
```

The deterministic fact sheet remains fully usable without OpenAI. **No paid AI call was made
during this pass.**

### BUG-015 — Global responsive shell offset · **FIXED**
**Root cause** `AppShell` applied a hard-coded `marginLeft: 260` (and `header left: 260`) at
**every** width, while the sidebar itself is `hidden lg:flex`. Below 1024 px the sidebar was gone
but the content stayed pushed 260 px right.
**Fix** The offset now tracks the same `(min-width: 1024px)` breakpoint via `matchMedia`, and is
`0` when the sidebar is off-screen; `min-w-0` added so flex children can shrink.
**Runtime retest at 375 px**

| page | before (overflow) | after |
|---|---|---|
| /dashboard | +138 px | **0** |
| /evaluations | +737 px | **0** |
| /training | +1116 px | **0** |
| /employees | +1140 px | **0** |

`main` now starts at `left: 0` with the full 375 px width; sidebar collapses to a hamburger.
Verified 0 overflow at **1440 / 1280 / 1024 / 768 / 375**.

### BUG-016 — Training header CTA off-screen at desktop width · **FIXED**
**Root cause** `PageHeader`'s action slot was `flex-wrap sm:flex-nowrap` — from `sm` up it could
not wrap, so the long "Create Training / Seminar" button was pushed past the viewport
(right edge 1466 px at a 1280 px viewport, +225 px page overflow).
**Fix** Wrapping is allowed at every width (`flex-wrap justify-end min-w-0`); items still sit on
one row whenever they fit.
**Runtime retest** `/training` at 1280 px: **overflow 0 px, primary CTA on screen**. Evaluations,
which passed before, still passes. Verified at all five widths.

### BUG-017 — Conditional React hook · **FIXED**
**Root cause** `WorkSchedulePage` called `useState` **after** the STANDARD-employee early
return, so the hook count varied with the caller's role.
**Fix** The hook was moved above the early return.
**Runtime retest** `oxlint` on that file: the `react-hooks(rules-of-hooks)` **error is gone**
(only a pre-existing unused-import warning remains). Web lint now reports **0 errors**
project-wide (was 1).

---

## 3. Defects found *during* this repair pass

### BUG-018 — Two logins in the same second minted an identical refresh token · **FIXED**
Surfaced once BUG-005/009 mapped Prisma errors correctly: a rapid second login returned
**409 "That record already exists"** (P2002 on the unique `refreshToken`). The refresh payload
was only `{userId, iat, exp}`, and `iat`/`exp` have one-second resolution — so two logins inside
the same second produced byte-identical tokens. This predates the repair pass; the old handler
merely hid it behind a generic 500.
**Fix** `signRefreshToken` now includes a `jti: randomUUID()`.
**Runtime retest** 5 sequential logins → **5 × 200**; 5 *simultaneous* logins → **5 × 200**.
Token length is now 252 chars — which also confirms the `varchar(512)` width was the right call,
not merely 192-plus-one.

### BUG-019 — Hard-coded white surfaces exposed by the theme repair · **FIXED**
While `--color-foreground` was frozen light, a hard-coded `bg-white` looked fine in dark mode
because the text on it was (wrongly) dark too. With BUG-002 fixed, those surfaces rendered
**light-on-white — measured 1.05:1** on the Employees directory.
**Fix** 54 `bg-white` occurrences replaced with the `bg-surface` token across 8 **authenticated**
files (Employees, Recruitment ×3, Announcements, OrgSelector, WorkflowModal, EvaluationTemplateModal).
Public always-light pages (Careers, Landing) were deliberately left alone, as was the one
`focus:bg-white` that already has a `dark:` counterpart.
**Runtime retest** `/employees` dark mode: **0 remaining white surfaces**; worst body-text
contrast recovered.

### NEW-LOW — Avatar initials at 1.67:1
`white` initials on the amber avatar chip (`rgb(251,191,36)`) measure **1.67:1**. Pre-existing,
decorative (the full name sits beside it), and fixing it is a palette decision rather than a
repair. **Recorded, not changed.**

### CLIENT POLICY REQUIRED — leave filed against a year with no balance row
A leave request for **2027-01-05** was accepted while the employee has only a **2026** balance
row, so nothing was reserved (`balance_row_exists = 0`). Whether HRISense should block filing
until HR configures that year's balance, auto-create a zero balance, or keep allowing it is a
Hospicio policy decision. **No behaviour was invented.**

---

## 4. Completion of previously untested QA phases

| Phase | Result | Key runtime evidence |
|---|---|---|
| **Account management** | **PASS** | deactivate → login **403**; activate → restored; lock → login **403**; unlock → cleared; force-password-change 200; reset-password 200 with **simulated** email; **HR deactivating their own account → 400**; SUPERVISOR → **403** |
| **Org hierarchy** | **PASS** | org chart **48 nodes = 48 active employees**; **0** archived in payload (15 excluded); **0** dangling supervisor refs; **0** self-supervision; **0** A→B→A cycles; 36 ASSIGNED / 12 PENDING; 0 active employees supervised by an archived one |
| **Holidays** | **PASS** | create 200; deactivate 200 → row **preserved** with `status = IGNORED` (not deleted); SUPERVISOR create → **403** |
| **Compliance workflow** | **PASS** | all five derived statuses proven by controlling only the record's own dates — **MISSING → NEEDS_REVIEW → VALID → EXPIRING_SOON → EXPIRED**; Needs-Attention worklist picked it up as EXPIRED; org summary arithmetic consistent (47 missing + 1 expired = 48). **System clock never changed.** |
| **Medical CRUD** | **PASS** | create 201, HR read/update/review 200; SUPERVISOR read **403** and list **403**; **employee self-view contains no `hrNotes`** |
| **Psychological CRUD** | **PASS** | create 201, HR read/update 200; SUPERVISOR **403**; employee sees `employeeVisibleSummary` ("Cleared for duty") and **`hrConfidentialNotes` is absent** |
| **Announcements** | **PASS** | draft 201; audience preview **48**; publish → **48 recipient rows**; **5 parallel re-publishes → all refused, still 48 rows, 0 duplicates**; read receipt 200 → 1 of 48 read; stats endpoint 200 |
| **Notifications UI** | **PASS** | list 200; unread-count **3**; mark-one-read 200; mark-all-read 200 → unread **0**; **0 duplicate eventIds** |
| **Settings** | **PASS** | profile shortcut, change-password entry, Light/Dark toggle, notifications shortcut — and truthful wording: *"HRISense notifies you in the app. There are no email notification preferences to configure yet."* |
| **Offline / error states** | **PASS** | API stopped: `/evaluations`, `/training`, `/employees`, `/reports` all rendered, **0 crash banners, 0 JS errors, 0 unhandled rejections**, each showed an error and a retry. Training showed `role="alert"` → "Couldn't load training activities … Try Again". API restarted → **Try Again recovered the page in place** (table repopulated, no reload) |
| **Profile photo** | **PASS — feature exists** | It is implemented (multipart `profilePicture` on employee create, stored as a protected `EmployeeDocument`, `photoUrl` → `/documents/:id/preview`). A QA employee (**HSJ-0018**) was onboarded with a real 8×8 PNG. Image rendered from a blob with `naturalWidth/Height = 8` and **0 broken images** with Keep Me Signed In **ON** (localStorage) *and* **OFF** (sessionStorage) |

---

## 5. Targeted concurrency retest

| Scenario | Result |
|---|---|
| Evaluation **submit** — 5 parallel | **1 × 200, 4 × 409**; 1 audit row |
| Evaluation **finalize** — 5 parallel | **1 × 200, 4 × 409**; 1 audit row |
| **Leave approve** — 5 parallel | **1 × 200**; status APPROVED; `used` 3 → 5 (exactly +2 for a 2-day request); `pending` → 0; **1** audit row |
| **Training completion** — 5 parallel | 5 × 200; generated compliance records **stayed at 1** |
| **Applicant conversion** — 5 parallel | 5 × 409 (correctly refused); `onboarding_drafts` unchanged |
| **Announcement publish** — 5 parallel | all refused; recipients stayed 48; **0** duplicates |
| **Login** — 5 parallel, same user, same second | **5 × 200** (was 409 — BUG-018) |

---

## 6. UI regression sweep

Dark **and** light, at **1440 / 1280 / 1024 / 768 / 375**, across `/dashboard`, `/employees`,
`/evaluations`, `/training`, `/reports`, `/help-center`, `/attendance`, `/leave/requests`,
`/recruitment`:

| check | result |
|---|---|
| Whole-page horizontal overflow | **0 px on every page at every width**, both themes |
| `border-border-soft` resolves to the soft token | **true on every page** |
| Any border utility still forced to `--border` | **none** |
| Primary CTA on screen | **yes** on every page checked |
| Worst body-text contrast, dark | **6.64:1** |
| Worst body-text contrast, light | **4.55:1** (above WCAG AA) |
| Dashboard KPI contrast | **16.28:1** (was 1.05:1) |
| Modals usable | Weekly Schedule modal 820 × 634 inside a 1280 × 720 viewport, sticky footer, inner scroll |

Two measurement corrections worth noting, so the numbers are not misread: an early contrast
probe reported **1.36:1** on a link that is genuinely **9.14:1** — the metric could not parse
`oklch()` colours and was rewritten to resolve any CSS colour via canvas. A reported **1.05:1**
in light mode was the "🌙" **emoji** glyph, not text.

---

## 7. Files changed in this repair pass

**API (9)**
`middleware/errorHandler.ts` · `controllers/auth.controller.ts` · `services/evaluation.service.ts` ·
`services/training.service.ts` · `services/schedule.service.ts` · `services/leave.service.ts` ·
`services/ai/ai.service.ts` · `lib/jwt.ts` · `prisma/schema.prisma`
plus retyped throws in `services/job-application.service.ts`,
`services/applicant-conversion.service.ts`, `services/applicant-communication.service.ts`,
`services/job-opening.service.ts`

**Migration (1)** `prisma/migrations/20260909181500_widen_user_session_refresh_token/`

**Web (14)**
`index.css` · `components/layout/AppShell.tsx` · `components/layout/PageHeader.tsx` ·
`components/layout/TopNav.tsx` · `services/evaluation.service.ts` ·
`pages/Evaluations/EvaluationsPage.tsx` · `pages/Evaluations/components/EvaluationTemplateModal.tsx` ·
`pages/Evaluations/components/EvaluationFormModal.tsx` ·
`pages/Employees/components/EmployeeEvaluationProfileTab.tsx` ·
`pages/Employees/EmployeeOnboardingPage.tsx` · `pages/Attendance/WorkSchedulePage.tsx` ·
`pages/Employees/EmployeesPage.tsx` · `pages/Announcements/AnnouncementsPage.tsx` ·
`pages/Recruitment/*` , `components/common/OrgSelector.tsx`, `components/shared/WorkflowModal.tsx`
(the `bg-white` → `bg-surface` token pass)

**`apps/api/.env` was NOT modified.** Email safety came from process-level overrides only.

---

## 8. Final validation

| Check | Result |
|---|---|
| API build (`tsc --noEmit`) | **PASS** |
| Web typecheck (`tsc -b --force`) | **PASS** |
| Web build (`vite build`) | **PASS** — built in 1.31 s |
| `prisma validate` | **PASS** |
| `prisma migrate status` | **15 migrations · Database schema is up to date** |
| `prisma generate` | **PASS** (run after the schema change) |
| Help Center validator | **PASS** — 79 guides, 79 READY, 17 categories, 0 defects |
| Web lint (`oxlint`) | **0 errors** (was 1), 242 warnings — unchanged project baseline |
| Browser console | no new errors; the 63 buffered entries are all `ERR_CONNECTION_REFUSED` from the deliberate offline test |
| Server errors | routine denials no longer logged as `[Error]` 500s |

### Post-repair database integrity — 17 checks

All **17 clean**, including the two added for this pass (`truncated refresh tokens`,
`evaluation templates with an invalid ratingMethod`).

Two initially non-zero results were **flaws in the check queries, not the data**, and are
recorded for honesty: the "leave pending mismatch" compared a 2026 balance against a 2027
request (0 mismatches once year-scoped), and the single 191-char token row was created
**before** the migration ran (length distribution today: 1 × 191 pre-migration, 13 × 192,
15 × 252 post-`jti`).

---

## 9. QA records

**Created in this pass** (all QA-tagged, tracked):

| Record | Table |
|---|---|
| Employee **HSJ-0018 "QAPhoto Tester"** + user + profile photo document | `employees`, `users`, `employee_documents` |
| 4 evaluation templates `QA_PRESET_TEST *` (one per rating preset) + criteria | `evaluation_templates`, `evaluation_criteria` |
| Evaluation cycle `QA_EVAL_RETEST Labeled Cycle` + assignment + response | `evaluation_cycles`, `evaluation_assignments`, `evaluation_responses` |
| Leave requests `QA_LEAVE_TEST repair-pass concurrency` (APPROVED) and `… notification eventId proof` (PENDING, 2027) | `leave_requests` |
| 2 documents `QA_DOC_TEST repair-pass` | `employee_documents` |
| Medical record `QA_MEDICAL_TEST Annual Physical` | `medical_records` |
| Psychological records `QA_PSYCH_TEST *` (×2) | `psychological_records` |
| Announcement `QA_ANNOUNCE_TEST All-Staff Notice` + 48 recipients | `announcements`, `announcement_recipients` |
| Holiday `QA_HOLIDAY_TEST Foundation Day` (deactivated) | `organization_calendar_entries` |
| Compliance record `qa-comp-001` (left EXPIRED to demonstrate the state) | `employee_compliance_records` |

**Removed / restored**: `QA_EMPTY_TEMPLATE_PROBE` and `QA_PARTIAL_PROBE` deleted;
`driver@gmail.com` password hash restored from snapshot and re-verified by login (200).
Everything created in the earlier QA pass was reused rather than duplicated.

**Backups** — new, prior preserved:
`hrisense_db_backup_pre_refresh_token_fix_20260909_181227.sql` (663,520 bytes)
`hrisense_db_backup_pre_full_system_qa_20260908_065608.sql` (untouched)

**Mustard import** — untouched: no normalizer, no invented columns or punch rules, Process
Import still disabled.
