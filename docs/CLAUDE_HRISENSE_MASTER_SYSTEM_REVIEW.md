> **⚠ STATE NOTE (added 2026-09-02).**
>
> This review describes the system **as it was at HEAD `7648345b`, before the
> fix-all repair.** It is preserved unedited as the baseline that repair worked
> from — do not read it as current state.
>
> Nearly every defect it records has since been repaired. See
> **`docs/CLAUDE_FIX_ALL_EXECUTION_REPORT.md`** for the finding-by-finding
> outcome, including three findings that were retracted as incorrect
> (zod version split, the supervisor directory-scope row in §39, and
> `ui/skeleton.tsx`).
>
> Only two classes of finding remain open: the Mustard Seedtime attendance
> import (external input required) and the historical git secret exposure
> (remote action required).

# HSJ HRISense — Master System Review

> **Document type:** Source-grounded system analysis (documentation only).
> **Produced by:** Claude, acting as system analyst / senior full-stack code reviewer / technical documentation analyst.
> **Method:** Static source inspection only. No browser testing, no QA runs, no database access, no migrations, no seeding, no source modifications.
> **Repository reviewed:** `C:\xampp\htdocs\HRISense`
> **Branch / HEAD:** `main` @ `7648345b4c08ec74387ee2b8f67136395c5549b8` — *"chore(repo): mirror complete laptop-ready HRISense workspace"*. Working tree clean.
> **Review date:** 2026-09-01

### Repository-root discrepancy (reported, not corrected)
The task named `C:\xampp\htdocs\HRISense_LAPTOP_FRESH` as the repository root. **That directory does not exist on this machine.** The only HRISense checkout under `C:\xampp\htdocs\` is `C:\xampp\htdocs\HRISense`, and it is the git repository containing `apps/api`, `apps/web`, `packages/shared`, and `docs/`. All findings below come from that checkout.

### Status vocabulary used throughout
| Status | Meaning |
|---|---|
| **IMPLEMENTED** | Frontend + backend + persistence + authorization all present and wired to each other. |
| **PARTIALLY IMPLEMENTED** | A meaningful slice works end-to-end; named sub-features do not. |
| **PLACEHOLDER** | UI exists deliberately as a future entry point; performs no real work, and says so. |
| **FRONTEND-ONLY (MOCK)** | UI renders hardcoded data; no backend behind it. |
| **BACKEND-ONLY** | API/model exists; no UI reaches it. |
| **BROKEN / DISCONNECTED** | Both halves exist but do not connect (wrong path, missing route). |
| **PLANNED / DOCUMENTED ONLY** | Described in docs; no current code. |
| **DEFERRED** | Consciously postponed pending external input. |
| **OUT OF SCOPE** | Excluded from the project by decision. |
| **LEGACY / STALE** | Preserved for history/compatibility; must not be treated as a live feature. |
| **UNREACHABLE / UNUSED** | Code exists but nothing routes to or imports it. |

---

## 1. Executive Summary

**HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision** is a single-tenant, web-based workforce administration system built as a capstone project for **Hospicio de San Jose (HSJ)**, a Philippine charitable care institution. The official title string appears verbatim in `package.json`, `apps/web/index.html` (`<title>` and meta description), `LoginPage.tsx`, and `LandingPage.tsx` — **Constraint 1 verified.**

### Why the system exists
The framing carried by the landing page, the docs, and the schema comments is that HSJ's HR office runs on paper 201 files, spreadsheets, and a separate biometric time system. HRISense centralizes:

- the **201 employee file** (personal, contact, employment, government IDs, emergency, documents) as one auditable record;
- the **organizational hierarchy** (7 service units → departments → 46 seeded job roles) with rule-based supervisor resolution rather than ad-hoc assignment;
- **attendance facts** exported from the biometric chain into one reviewable calendar and tally — explicitly without inventing data for missing days;
- **leave** filing and HR decisioning, with balance tracking;
- **compliance** — the capability the title singles out: HR-defined requirements (medical, psychological, certification, training, document) whose per-employee status (`MISSING / NEEDS_REVIEW / VALID / EXPIRING_SOON / EXPIRED`) is *derived at query time* from real records and HR-entered expiry dates;
- **recruitment**, from a public careers page through applicant tracking to an onboarding draft;
- **announcements** with real recipient snapshots and read receipts.

### Who uses it
Four audiences, three of them authenticated:

| Audience | Permission tier | How they get in |
|---|---|---|
| **HR Personnel** | `FULL` | HR job roles (`HR_OFFICER`, `HR_ASSISTANT`) |
| **Supervisor** | `SUPERVISOR` | 13 seeded head / coordinator job roles |
| **Employee** | `STANDARD` | 31 seeded staff job roles |
| **Public applicant / visitor** | *(none)* | Landing page + `/careers` — **no account, by design** |

### One-line verdict
The **core HRIS spine is real and substantial** — authentication, employees/201, org hierarchy, recruitment, scheduling, leave, compliance/medical/psychological, training, evaluations, and announcements are genuine full-stack modules. But the system's **"AI-Assisted" headline capability is not implemented at all**, Reports is a mock, attendance has no ingestion path, and a cluster of frontend controls calls backend endpoints that do not exist. Details in §2, §40, §42, §43.

---

## 2. Current Development Status

### 2.1 Implemented end-to-end (frontend ↔ API ↔ Prisma ↔ RBAC)
| Module | Notes |
|---|---|
| Authentication & session | Login, JWT access + persisted refresh sessions, lockout, logout, guarded route tree. |
| Employee Management / 201 profile | Directory, filters, onboarding wizard, drafts, archive/restore, org chart, 15 profile tabs. |
| Organizational structure | Units, Departments, Job Roles CRUD + rule-based supervisor resolver with manual override. |
| Recruitment & Hiring | Public careers → application → applicant pipeline → interviews → communications → onboarding draft. |
| Attendance viewing (Daily Monitoring + Tally) | Calendar, day drawer, tally with honest `No Imported Record` semantics, Excel/PDF export. |
| Shift Catalog & Weekly Work Schedule | Versioned shift definitions; per-employee weekly schedule with effective dating. |
| Schedule Templates / Assignments / History | Legacy template track, still live alongside weekly schedules. |
| Holiday & Organization Calendar | Nager.Date suggestions + manual entries, approve/ignore, audit-logged. |
| Leave Management | Filing (self + on-behalf batch), calendar, HR approve/reject, balance deduction. |
| Compliance Monitoring | Requirements + scopes, per-employee derived status, org rollups, needs-attention queue. |
| Medical Records | HR workspace, records, protected documents, review workflow, HR-only notes. |
| Psychological Records | Same, plus a two-zone (employee-visible vs HR-confidential) privacy model. |
| Training & Seminars | Activities, roster targeting, participation outcomes, certificates, compliance auto-fulfilment. |
| Evaluations | Templates → cycles → assignments → responses → submit → HR finalize → employee history. |
| Announcements | Draft/schedule/publish/archive, audience scopes, recipient snapshot, read receipts, protected attachments. |
| Global Search | Employees, onboarding drafts, archived employees, scoped by tier. |
| Document Management | Upload / preview / download / replace / delete with per-document employee & supervisor visibility flags. |

### 2.2 Partially implemented
- **Help Center** — *intentionally* `PARTIALLY IMPLEMENTED — PRESENTATION WRAP-UP IMPLEMENTED`. 13 of 39 registry entries are authored (`READY`); 26 remain `METADATA_ONLY`. Reader, search, categories, role gating, and all three fallback states are complete. Screenshots deferred. See §31.
- **Attendance overall** — reading and reporting are complete; **there is no way to get attendance data into the system** (§15).
- **Audit logging** — writes happen from many services; there is **no read API and no page** (§29).
- **Notifications** — model plus three read/update endpoints exist; **nothing anywhere creates a notification**, and there is no page (§30).

### 2.3 Placeholder (deliberate and self-declaring)
- **Mustard Seedtime Excel import modal** on `/attendance/daily` — the file picker works; `Process Import` is permanently `disabled` with the tooltip *"Processing unavailable — official Mustard Seedtime Excel format not yet configured"*.

### 2.4 Frontend-only mocks — *not* self-declaring; these look real
- **`/ai-assistance`** — every insight, confidence score, the "AI Engine Active · Last processed 3 minutes ago" status bar, "Analyzing 850 employee records across 18 departments", the 6-axis radar and the 85.2 health score are hardcoded literals. **No AI backend exists anywhere in the repository.**
- **`/reports`** — two charts over invented data (`turnoverData`; `deptData` for "Nursing / Radiology / Pharmacy / Lab / HR / Finance"); the `Export` button has no handler.
- **`/settings`** — four non-interactive cards.
- **`/leave`** (legacy route, still reachable by URL) — five fabricated leave requests for fabricated employees.
- **TopNav notification bell** — four hardcoded notifications and a fake unread badge of 3.
- **HR Dashboard "Quick Actions"** — eight buttons rendered without `onClick`; they do nothing.
- **HR Dashboard "6-month attendance trend"** — all six months are assigned the same single 30-day rate.

### 2.5 Deferred (blocked on Hospicio de San Jose input)
- Official **Mustard Seedtime Excel** column mapping and parser.
- Overnight / biometric **punch-pairing** rules.
- Official working weekdays, rest-day patterns, night-shift bounds, flexible/rotating shift rules.
- Help Center **screenshots** and **contextual (in-page) help**.

### 2.6 Out of scope
- **Payroll / E-Payslip / salary / overtime pay / night differential** — removed from the runtime. Remnants catalogued in §41.

---

## 3. Technology Stack

Monorepo: npm workspaces (`apps/web`, `apps/api`, `packages/shared`), orchestrated by `concurrently` after a port-5000 preflight check (`scripts/preflight.js`).

### Frontend — `apps/web` (`@hrisense/web`)
| Concern | Choice | Version |
|---|---|---|
| Framework / language | React + TypeScript | react 19.2.7 · typescript ~6.0.2 |
| Build | Vite | ^8.1.1 (`@vitejs/plugin-react` ^6.0.3) |
| Routing | **TanStack Router** (code-defined tree in `routeTree.tsx`) | ^1.170.18 |
| Server state | TanStack React Query | ^5.101.2 |
| Tables | TanStack React Table | ^8.21.3 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | ^4.3.3 |
| Primitives | Radix UI (18 packages) + `class-variance-authority`, `clsx`, `tailwind-merge` | — |
| Animation | Framer Motion | ^12.42.2 |
| Charts | Recharts | ^3.9.2 |
| Forms / validation | react-hook-form + `@hookform/resolvers` + **zod 4** | ^7.81.0 · ^4.4.3 |
| HTTP | Axios (with refresh interceptor) | ^1.18.1 |
| Toasts | Sonner | ^2.0.7 |
| Icons | lucide-react | ^1.24.0 |
| Other | cmdk (command palette), vaul (drawer), date-fns 2.30, html2pdf.js | — |
| Lint | **oxlint** ^1.71.0 (not ESLint) | — |

> `react-router-dom` is deliberately absent (0 occurrences) — an invariant asserted repeatedly in the progress log; it holds.
> The web app uses **zod v4**; the API and `packages/shared` use **zod v3**.

### Backend — `apps/api` (`@hrisense/api`)
| Concern | Choice | Version |
|---|---|---|
| Runtime / language | Node.js + TypeScript | typescript ^5.6.3 · tsx ^4.19.1 · nodemon ^3.1.14 |
| Framework | Express | ^4.19.2 |
| ORM | Prisma + `@prisma/client` | ^5.22.0 |
| Database | **MySQL** (XAMPP) | — |
| Auth | `jsonwebtoken` ^9.0.2 + `bcryptjs` ^2.4.3 | — |
| Validation | zod ^3.23.8 (`validate` middleware wraps body/query/params) | — |
| Security middleware | `helmet` ^7.1.0 · `cors` ^2.8.5 · `express-rate-limit` ^7.5.1 | — |
| Uploads | `multer` ^1.4.5-lts.1 + `file-type` ^16.5.4 + `adm-zip` ^0.6.0 (DOCX structural check) | — |
| Export | `exceljs` ^4.4.0 · `pdfkit` ^0.19.1 · `fast-csv` ^5.0.7 | — |
| Email | `nodemailer` ^9.0.3 (unused path) + **Brevo REST API via `fetch`** (live path) | — |
| AI SDK | `openai` ^4.67.3 — **declared but never imported anywhere in `src/`** | — |

### Shared — `packages/shared` (`@hrisense/shared`)
384 lines of TypeScript types. **Imported by zero files** in `apps/web` or `apps/api`. Its contents are stale — see §40.

### Development scripts
| Command | Effect |
|---|---|
| `npm run dev` | preflight → `concurrently` WEB + API |
| `npm run dev:web` / `dev:api` | Vite / `nodemon → tsx src/index.ts` |
| `npm run build` | `tsc -b && vite build` (web) then `tsc` (api) |
| `npm run typecheck` / `lint` / `format` | per workspace / prettier |
| API DB | `db:generate`, `db:validate`, `db:migrate:create` (against a separate `hrisense_migration_dev_db`), `db:migrate:deploy`, `db:push`, `db:studio`, `db:seed` |
| API maintenance | `fix-hierarchy`, `cleanup-local-dummies` |

---

## 4. Repository Architecture

```
HRISense/
├── apps/
│   ├── api/                     @hrisense/api — Express + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma            ← 2,261 lines · 72 models · 54 enums
│   │   │   ├── migrations/              ← 13 applied + migration_lock.toml
│   │   │   ├── legacy-migrations-pre-baseline/   ← archived, with README recovery notes
│   │   │   ├── seed.ts (1,022 ln) · seed_hierarchy.ts (339 ln)
│   │   │   └── schema.pre-recruitment-baseline.prisma · schema.temp.prisma
│   │   │       · schema.prisma.recruitment · inspect_46.mjs · query_roles.mjs   ← STALE ARTIFACTS
│   │   ├── src/
│   │   │   ├── index.ts          bootstrap: helmet/cors/rate-limit, mounts, graceful shutdown
│   │   │   ├── config/           env.ts (zod-validated) · prisma.ts · recruitment.config.ts
│   │   │   ├── routes/           24 route files — 210 endpoint handlers
│   │   │   ├── controllers/      24 controllers
│   │   │   ├── services/         32 services + services/email/ (6)
│   │   │   ├── middleware/       authenticate · authorize · validate · errorHandler
│   │   │   ├── policies/         recruitment.policy.ts · scheduling.policy.ts
│   │   │   ├── lib/              jwt · password · passwordGenerator · audit · recruitment.errors
│   │   │   ├── utils/            asyncHandler · schedule-validator.util
│   │   │   ├── types/            express.d.ts · recruitment.types.ts
│   │   │   └── scripts/          org-hierarchy fixes, dev account seeding (7 files)
│   │   ├── uploads/              announcements · compliance · documents · medical
│   │   │                         · psychological · recruitment · training  (never served statically)
│   │   ├── dist/                 committed build output
│   │   └── .env                  ← TRACKED IN GIT (see §35)
│   └── web/                     @hrisense/web — React + Vite
│       ├── src/
│       │   ├── routeTree.tsx     ← single source of frontend routing (49 route definitions)
│       │   ├── main.tsx · index.css · lib/{router,queryClient,motion,utils}
│       │   ├── providers/        AuthProvider · ThemeProvider
│       │   ├── hooks/            useAuth · usePermission · useDebounce · useAnnouncementUnread
│       │   ├── services/         api.ts (axios + refresh) + 11 domain services
│       │   ├── components/       layout/ (AppShell, Sidebar, TopNav, GlobalSearch, PageHeader)
│       │   │                     shared/ (WorkflowModal, EmployeePicker, FileUploadCard,
│       │   │                              MetricCard, AnnouncementsWidget)
│       │   │                     ui/ (button, input, dialog, badge, avatar, skeleton, CalendarGrid)
│       │   │                     common/OrgSelector
│       │   └── pages/            21 feature folders · 99 .tsx files
│       └── dist/                 committed build output
├── packages/shared/             UNUSED (see §40)
├── docs/                        22 markdown documents + docs/checkpoints/ (2)
├── scripts/preflight.js
├── scratch/  ·  apps/api/scratch*  ← 29 + 3 one-off dev scripts (see §40)
├── workspace_snapshot/          file inventory + SHA256 manifest + database/
├── *.sql (10 DB dumps, 0.7–1.2 MB each)  ·  HRISense_FULL_WORKSPACE_20260731.zip (303 MB, tracked)
├── .local/                      dev credential reports — gitignored BUT TRACKED (see §35)
└── ANTIGRAVITY_MEMORY.md · PROGRESS.md · REMAINING_CHECKLIST.md · implementation_plan*.md
    · HRISense_Status_2026-07-19.md · UPDATES_2026-07-25.md · task.md · JOB ROLES.xlsx
```

### Documentation set (`docs/`)
| File | Lines | Role |
|---|---|---|
| `ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` | 1,996 | Primary chronological development log — 40 sections, newest first. |
| `HELP_CENTER_FUNCTION_INVENTORY.md` | 1,259 | Verified-function catalogue backing the Help Center guides. |
| `HELP_CENTER_ARCHITECTURE.md` | 452 | Help Center design, checkpoint history, role counts. |
| `HRISENSE_SYSTEM_PROGRESS_AUDIT.md` | 342 | **Superseded** July audit (see §42). |
| `TIME_ATTENDANCE_LEAVE_IMPLEMENTATION.md` | 323 | Attendance/leave design and the biometric chain. |
| `HELP_CENTER_BROWSER_AUDIT.md` | 267 | Route/UI verification supporting guide authoring. |
| `RECRUITMENT_MODULE_IMPLEMENTATION.md` / `RECRUITMENT_COMPLETION_AUDIT.md` | 247 / 236 | Recruitment design + completion audit. |
| `DEVELOPMENT_SETUP.md` | 147 | Local setup. |
| `HRISENSE_CURRENT_SYSTEM_FEATURE_INVENTORY.md` | 142 | August status matrix (partly superseded). |
| `PUBLIC_RECRUITMENT_UPLOAD_SECURITY_AUDIT.md` | 118 | Upload hardening record. |
| `RECRUITMENT_MANUAL_QA_CHECKLIST.md`, `LAPTOP_FULL_RESTORE_GUIDE.md`, `LEAVE_CALENDAR_UI_AUDIT.md`, `PRISMA_MIGRATION_RECOVERY_REPORT.md`, `FULL_WORKSPACE_TRANSFER_MANIFEST.md`, `MANUAL_QA_PHASE_5_8.md`, `PUBLIC_CAREERS_REPAIR_AUDIT.md`, `RECRUITMENT_BACKEND_RUNTIME_AUDIT.md`, `LANDING_PAGE_COMPLETION_AUDIT.md`, `task.md` | 15–82 | Focused audits and checklists. |
| `checkpoints/HRISENSE_TIME_ATTENDANCE_PROGRESS_2026-08-10.md`, `checkpoints/HRISENSE_DYNAMIC_WEEKLY_SCHEDULE_PROGRESS_2026-08-15.md` | 42 / 32 | Point-in-time checkpoints. |

---

## 5. Application Architecture

### 5.1 Shape
A classic **two-tier SPA + REST API**. No SSR, no BFF, no GraphQL, no websockets, no background jobs or cron.

```
Browser (React SPA, Vite dev :3000)
   │  axios  ─ Authorization: Bearer <access JWT>
   ▼
Express API (:5000)   /health   +   /api/v1/*
   helmet → cors(CLIENT_URL, credentials) → global rate-limit → json/urlencoded(10 MB)
   → router → [authenticate] → [authorize | policy class] → controller → service → Prisma
   → errorHandler → { success:false, error, errors? }
   ▼
MySQL (hrisense_db)   +   apps/api/uploads/**  (streamed only through authenticated routes)
```

### 5.2 Frontend architecture
- **`main.tsx`** mounts `ThemeProvider → AuthProvider → QueryClientProvider → RouterProvider`. Theme is pre-applied by an inline script in `index.html` reading `localStorage['hrisense_theme']`, preventing a flash of the wrong theme.
- **`routeTree.tsx`** is the single routing source. Two *pathless* layout routes carry the guards:
  - `careers-layout` → public `CareersLayout` (header/footer, no auth);
  - `app` → a `beforeLoad` guard plus `AuthenticatedAppShell` (redirect to `/login`, or to `/change-password` when `mustChangePassword`), rendering `AppShell{ sidebar: <Sidebar/>, topNav: <TopNav/> }`.
  - Guards are **doubled** — a router `beforeLoad` (reading `context.auth`) *and* an in-component guard (reading `useAuth()`) — because `beforeLoad` deliberately no-ops while `isInitializing` is true.
- **State**: server state through React Query (`lib/queryClient`) in the newer modules; several older pages still use `useState` + `useEffect` + axios directly. Auth state lives in the `AuthProvider` context.
- **Cross-cutting UI**: `WorkflowModal` (the multi-step guided HR wizard shell), `EmployeePicker`, `FileUploadCard`, `MetricCard`, `CalendarGrid`, `AnnouncementsWidget`.
- **Navigation gating**: `Sidebar.isAllowed()` maps hrefs to `usePermission().hasPermission(module, action)`.

### 5.3 Backend architecture
Layered consistently: **route → (authenticate) → (authorize / policy) → controller → service → Prisma**.
- Two authorization styles coexist: the `authorize()` middleware (tier whitelist *or* module/action lookup) and **policy classes** (`RecruitmentPolicy`, `SchedulingPolicy`) invoked from inside controllers.
- `asyncHandler` wraps some handlers; others use explicit `try/catch → next(err)`. The announcement / medical / psychological / training controllers rely on Express 4 handling of thrown errors inside `async` functions; most are safe because their route handlers await internally, but this is inconsistent.
- **Circular-import workarounds**: `AttendanceService.list` lazily `require('./schedule.service')`; `EmployeeController.create` uses dynamic `import()` for `ScheduleService` and `DraftService`.

### 5.4 File / upload architecture
`apps/api/src/index.ts` carries an explicit comment: uploads are **intentionally not served as static files**. Every protected file is streamed through an authenticated route after a service-level authorization check. Multer writes `crypto.randomBytes(16).toString('hex')` filenames into per-domain folders; the original filename survives only as metadata.

### 5.5 Email architecture
Two independent stacks:
1. **Recruitment** — an abstract `RecruitmentEmailProvider` with `DevelopmentRecruitmentEmailProvider` (simulate / redirect-to-test / mock) and `BrevoRecruitmentEmailProvider`, configured by `config/recruitment.config.ts`.
2. **Transactional** — `BrevoTransactionalEmailProvider` (direct `fetch` to `https://api.brevo.com/v3/smtp/email`), used by `EmployeeEmailService`.
Plus a third, **entirely unused**, `EmailService` built on nodemailer/Ethereal — see §33.

### 5.6 AI architecture
**There is none.** `AIInsight`, `AIRequestLog` and `AIConversation` models exist; `OPENAI_API_KEY` / `OPENAI_MODEL` / `AI_PROVIDER` are declared in `config/env.ts`; the `openai` package is installed. A repository-wide grep for `openai|OpenAI` in `apps/api/src` matches **only `config/env.ts`**. No AI route, controller, service, prompt, or client instantiation exists. See §26.

### 5.7 Public vs authenticated surface
- **Public (no token):** `/`, `/careers*`, `/login`; and API `GET /api/v1/public/recruitment/openings`, `GET .../openings/:slug`, `POST .../openings/:openingId/apply`.
- Everything else under `/api/v1/*` sits behind `authenticate`. Applicants never receive credentials — **Constraint 5 verified.**

---

## 6. Authentication & Session Management

**Files:** `apps/api/src/{routes,controllers,services}/auth.*`, `lib/jwt.ts`, `lib/password.ts`, `middleware/authenticate.ts`; `apps/web/src/providers/AuthProvider.tsx`, `services/api.ts`, `services/auth.service.ts`, `pages/Auth/*`.

### 6.1 Login — `POST /auth/login`
1. zod-validated `{ email, password }`.
2. Look up `User` (including `employee.jobRole`); reject if missing or soft-deleted.
3. **Lockout gate** — if `lockedUntil > now`, 403 stating the remaining minutes.
4. Inactive account → 403 *"Your account has been deactivated. Contact HR."*
5. `bcrypt.compare`. On failure: increment `failedLoginAttempts`; **at 5 attempts set `lockedUntil = now + 15 minutes`** and reset the counter; write a `LOGIN_FAILED` audit row.
6. On success: reset the counter, set `lastLoginAt` / `lastLoginIp`.
7. **A user without a linked `Employee` cannot log in** (`400 User profile configuration is incomplete`).
8. Sign the access JWT `{userId, email, roleCode, permissionTier, employeeId}`; sign the refresh JWT `{userId}`; persist a `UserSession` row with `expiresAt = now + 7 days`.
9. Write `LOGIN_SUCCESS`; return both tokens plus a user payload containing `mustChangePassword`, `permissionTier`, and a flat `permissions[]` array of `module.action.scope` strings.

### 6.2 Tokens
- **Access token** — `JWT_SECRET`, `JWT_EXPIRES_IN` (default `15m`). Stateless; `authenticate` verifies it and populates `req.user`, mapping `TokenExpiredError` / `JsonWebTokenError` to 401.
- **Refresh token** — `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN` (default `7d`); persisted in `UserSession.refreshToken` (unique).
- **`POST /auth/refresh` does not rotate** the refresh token — a deliberate, in-code-documented choice to avoid HMR / multi-tab races. It issues a fresh access token and extends `expiresAt` by another 7 days (sliding window).
- **Reuse handling**: if the presented refresh token has no session, or the session is revoked/expired, **all** of that user's sessions are revoked.

### 6.3 Client-side session handling
- **Storage: `localStorage` only** — `accessToken` and `refreshToken`. `sessionStorage` is only ever *cleared* (legacy cleanup). **There is no "Remember Me" control anywhere in `LoginPage.tsx`** — the session is always persistent.
- The `api.ts` request interceptor attaches the bearer token.
- **401 handling**: single-flight refresh with a `failedQueue` for concurrent 401s; `/auth/login|refresh|logout` are excluded from retry. If the refresh call fails, the interceptor re-checks whether another tab already rotated the token before giving up. On give-up it clears tokens, dispatches a `window` `auth_logout` CustomEvent carrying `isPublic`, and shows one de-duplicated *"Your session has expired"* toast (suppressed on public paths).
- `AuthProvider` listens for `auth_logout`, clears the user and the React Query cache, invalidates the router, and navigates to `/login` unless the current path is public.
- **Restore on load**: if a `refreshToken` exists → `GET /auth/me`. Network or 5xx errors show a **"Server Unavailable / Retry Connection"** screen *without* destroying tokens; a genuine 401 clears the session.
- **Logout**: `POST /auth/logout` (`deleteMany` on the refresh token + `LOGOUT` audit), then full client-side teardown.

### 6.4 First-login password change
`User.mustChangePassword` gates `/change-password`, a **standalone route outside the AppShell**. `ChangePasswordPage` posts to `/auth/change-password`, then calls `fetchCurrentUser()` and navigates to `/dashboard`.

**Two defects in this flow — see §43 R-01, R-02, R-03:**
- `AuthController.getMe` **does not return `mustChangePassword`**, although the frontend `UserPayload` type declares it as required. After any page refresh the flag is `undefined`, so the forced-change gate silently stops applying for that session.
- `ChangePasswordPage` sends `{ currentPassword, newPassword }`; the backend schema and service read **`oldPassword`**. `oldPassword` is therefore always `undefined` and `AuthService.changePassword` **skips old-password verification entirely**.
- The complexity regex in `AuthService.changePassword` is written with `\\d` inside a regex literal, so it demands a literal backslash-`d` in the password. Verified by execution: `"Password1!"` → `false`. **Every ordinary password is rejected.**

### 6.5 Forgot / reset password
`POST /auth/forgot-password` is enumeration-safe, deletes prior tokens, creates a 1-hour `PasswordResetToken`, and **returns the raw token in the JSON response** (explicitly "for convenience in development"). **No email is sent.** `POST /auth/reset-password` hashes the new password, marks the token used, clears `mustChangePassword`, and revokes all sessions.
**There is no UI for either.** `AuthService.forgotPassword` / `resetPassword` exist in `apps/web/src/services/auth.service.ts` but no page imports them, and `LoginPage.tsx` has no "Forgot password?" link. → **BACKEND-ONLY.**

### 6.6 Password rules
- Hashing: `bcryptjs` via `lib/password.ts`.
- `resetPassword` enforces only zod's `min(8)`.
- `changePassword` adds the complexity regex described above (broken).
- `lib/passwordGenerator.ts` provides a crypto-strong 12–16 char generator — **never called by any live code path**.

---

## 7. Roles, Permissions & RBAC

### 7.1 The real role model — **Constraint 2 verified in the access model**
There is exactly one role axis: the Prisma enum **`PermissionTier`**, carried on `JobRole` and copied into the JWT.

| Enum | Schema comment | User-facing name | Seeded job roles |
|---|---|---|---|
| `FULL` | *"HR Officers — access ALL data for ALL employees"* | **HR Personnel** | 2 (`HR_OFFICER`, `HR_ASSISTANT`) |
| `SUPERVISOR` | *"Section heads/coordinators — own data + subordinate attendance logs"* | **Supervisor** | 13 |
| `STANDARD` | *"All other staff — own data only"* | **Employee** | 31 |

There is **no `ADMIN` tier, no `isAdmin` flag, and no admin job role.** `prisma/seed.ts` contains `"Assistant Administrator"` (`ASST_ADMIN`, tier `SUPERVISOR`) and `"Administrative Secretaries"` (`ADMIN_SEC`, tier `STANDARD`) — **HSJ job titles carrying no elevated system rights**, exactly as required. The seed's convenience "HR Administrator" account (`ADMIN-001` / `HR@gmail.com`) is assigned the **`HR_OFFICER`** job role, i.e. it is an HR Personnel account, not a system administrator.

**Three contradictions of Constraint 2 exist in text and comments, not in the access model** (§42 C-01):
1. `LandingPage.tsx:236` publicly advertises a fourth role card — **"Administrator — System & HR Account Management … System Administration, Account Management, Permissions & Roles."**
2. `packages/shared/src/index.ts` declares `UserRole = "SUPER_ADMIN" | "HR_MANAGER" | …` (unused — §40).
3. `RecruitmentPolicy` / `SchedulingPolicy` comments describe the `FULL` tier as *"Admin / system-level FULL tier"*.

### 7.2 Granular permissions (secondary layer)
`Permission(module, action, scope)` × `RolePermission` → `JobRole`. The seed defines **62 permissions** — **45 `ALL` · 13 `OWN` · 4 `SUBORDINATES`** — and assigns them by tier:
- `FULL` → **all 62**;
- `SUPERVISOR` → all `OWN` + all `SUBORDINATES` = **17**;
- `STANDARD` → all `OWN` = **13**.

Modules present: `profile, leave, training, payslip, psychological, medical, attendance, attendance_log, activity, announcement, notification, employee, performance, compliance, ai, reports, users, audit, settings, document`.

> Two consequences. **(a)** There is **no `recruitment` module permission**, so `Sidebar`'s `hasPermission("recruitment","view")` only ever succeeds through the `FULL` short-circuit — Recruitment is HR-only in the navigation, matching the backend policy. **(b)** `payslip.*` permissions are still seeded even though Payroll is out of scope (§41).

### 7.3 How authorization is enforced
| Mechanism | Where | Behaviour |
|---|---|---|
| `authenticate` | `middleware/authenticate.ts` | Bearer JWT → `req.user{userId,email,roleCode,permissionTier,employeeId}`. |
| `authorize([tiers])` | most routes | Whitelist against `req.user.permissionTier`. |
| `authorize(module, action)` | available, **rarely used** | `FULL` passes immediately; others do a `RolePermission` lookup keyed on `jobRole.code`. |
| Policy classes | `RecruitmentPolicy`, `SchedulingPolicy` | Called inside controllers; combine role **code/title** matching with a `FULL`-tier fallback. |
| Service-level scoping | attendance, leave, documents, compliance, medical, psychological, training, evaluation, schedule | Narrow the Prisma `where` to `own / team / all`. |
| Frontend `usePermission()` | `hooks/usePermission.ts` | `FULL` → always true; otherwise parses `permissions[]`. **Cosmetic only.** |

**Policy-class caveat.** `RecruitmentPolicy.isHrOfficer()` vs `isHrStaff()` is intended to separate HR Officer authority (publish, hire, reject, send accept/reject/custom emails, convert to onboarding) from HR Staff. Because **both** `HR_OFFICER` and `HR_ASSISTANT` are seeded as `FULL`, and every policy method ORs in `permissionTier === FULL`, **the distinction currently has no practical effect**. The same applies to `SchedulingPolicy`.

### 7.4 Frontend role → label mapping
`HelpCenterPage` / `HelpGuidePage`: `FULL → 'HR Personnel'`, `SUPERVISOR → 'Supervisors'`, `STANDARD → 'Employees'`. `DashboardPage` switches on `usePermission().tier` to pick `HRDashboard | SupervisorDashboard | EmployeeDashboard`.

---

## 8. Organizational Hierarchy

### 8.1 Entities
- **`Unit`** — the 7 HSJ service units (schema comment: Administrative Services, Finance, General Support Services, Auxiliary Services, Social Services, Pastoral Care/Homelife Services, Health Services), each with a `code`, an optional `parentUnitId` (self-hierarchy) and an optional `headJobRoleId`. The seed also adds an `HRD` unit.
- **`Department`** — an optional layer with `parentDepartmentId` and `headJobRoleId`; belongs to a Unit.
- **`JobRole`** — belongs to a Unit, optionally a Department; carries `permissionTier`, `isHead`, `isSupervisor`, `parentJobRoleId`, and **`hierarchyStatus ∈ {CONFIRMED, PENDING_CONFIRMATION}`** (default `PENDING_CONFIRMATION`). The schema comment says "48 distinct job roles"; the seed defines **46**.
- **`Employee`** — `unitId` (required), `departmentId` (optional), `jobRoleId` (required).

### 8.2 Supervisor resolution — `services/supervisor-resolver.service.ts`
Runs on employee creation and on organizational change. Returns `{supervisorId, assignmentSource, assignmentStatus, pendingReason, diagnosticCode}`.

```
1. JOB-ROLE WALK   role → parentJobRole → … (cycle-guarded)
     • any role with hierarchyStatus = PENDING_CONFIRMATION  → PENDING / UNCLEAR_HIERARCHY
     • first ancestor role with isSupervisor = true:
         exactly 1 eligible holder → ASSIGNED / AUTO_JOB_ROLE
         more than 1              → PENDING / UNCLEAR_HIERARCHY (candidate ids returned)
         zero                     → PENDING / NO_ACTIVE_SUPERVISOR
2. DEPARTMENT-HEAD FALLBACK   department.headJobRoleId → same 1 / >1 / 0 rules → AUTO_DEPARTMENT_HEAD
     • no headJobRoleId → PENDING / MISSING_HEAD_CONFIGURATION
3. UNIT-HEAD FALLBACK         unit.headJobRoleId, walking parentUnitId (cycle-guarded) → AUTO_UNIT_HEAD
```
"Eligible" means: same job role, `deletedAt: null`, `employmentState ∉ {RESIGNED, TERMINATED, RETIRED}`, and **not the employee themself** — self-supervision is structurally impossible.

**Top-level / no-supervisor-required behaviour:** the resolver never invents a supervisor. Unresolved employees are stored with `immediateSupervisorId = null` plus an explicit `supervisorAssignmentStatus = PENDING` and a machine-readable `supervisorPendingReason`. The employee directory exposes a **"Pending supervisor"** filter (`supervisorAssignmentStatus=PENDING`) so HR can work the queue.

### 8.3 Manual override
`POST /employees/:id/supervisor-override` (FULL) sets `supervisorAssignmentSource = MANUAL_OVERRIDE` plus `supervisorOverrideReason`, `supervisorOverrideById`, `supervisorOverrideAt`. `DELETE` on the same path reverts to automatic. `EmployeeService.update` strips `immediateSupervisorId` and all supervisor-assignment fields from ordinary edits — supervision can only change through the dedicated override endpoints, or through a re-resolve triggered by an org change (which requires an explicit `overrideDecision` when a manual override is in force).

### 8.4 ⚠ Two unsynchronized supervisor mechanisms — the most significant architectural defect found
| Mechanism | Written by | Read by |
|---|---|---|
| **`Employee.immediateSupervisorId`** | The live application (create, org change, manual override) | `DashboardService`, `EmployeeService.getSubordinates`, `getOrgChartData`, `SearchService`, a commented-out branch in `document.service`, maintenance scripts |
| **`SupervisionLink` join table** | **`prisma/seed.ts` only** — a repository-wide grep finds no `supervisionLink.create/upsert/update/delete` anywhere in `apps/api/src` | `AttendanceService` (calendar, list, logs, tally, schedules), `LeaveService` (list, createBatch), `ScheduleService` + `schedule.controller`, `ComplianceService`, `EvaluationService`, `DocumentService` |

**Consequence:** a supervisor whose reports were assigned *through the application* has an empty `SupervisionLink` set, so their **Team Attendance, team leave visibility, subordinate schedule assignment, and supervisor-scoped document access will all come back empty or 403** — while the **Dashboard team widget, Org Chart and Subordinates list will look correct**, because those read `immediateSupervisorId`. Only seeded demo data exercises both paths. Recorded as §43 R-04.

### 8.5 Org Chart
`GET /employees/org-chart` → `EmployeeService.getOrgChartData(requestingEmployeeId, requestingRole, {unitId, departmentId, supervisorAssignmentStatus, isArchived, search})`, rendered by `pages/Employees/OrgChartPage.tsx` (1,760 lines, with per-unit colour coding).
- `FULL` → the whole organization, optionally including archived employees.
- `SUPERVISOR` → self **plus the transitive closure of everyone below them** (iterative expansion over `immediateSupervisorId`).
- `STANDARD` → self **plus the chain of supervisors above them**.

---

## 9. Frontend Route Map

Source of truth: `apps/web/src/routeTree.tsx` — **49 route definitions**, of which 2 are pathless layouts, leaving **47 addressable paths**. Legend: **HR** = `FULL`, **SUP** = `SUPERVISOR`, **EMP** = `STANDARD`.

### 9.1 Public routes (outside `AppShell`, no token)
| Route | Component | Access | Purpose | Module | Status |
|---|---|---|---|---|---|
| `/` | `Landing/LandingPage` | Public | Marketing/overview: hero, features, roles, how-it-works, about, footer; hash anchors `#features`, `#roles`, `#about` | Public | **IMPLEMENTED** (contains role/AI/reports claims that overstate the build — §42) |
| *(pathless)* `careers-layout` | `Careers/CareersLayout` | Public | Header/footer wrapper for careers | Recruitment | IMPLEMENTED |
| `/careers` | `Careers/CareersPage` | Public | Lists `OPEN` job openings | Recruitment | **IMPLEMENTED** |
| `/careers/application-success` | `Careers/ApplicationSuccessPage` | Public | Shows the application reference number (from router search state) with copy-to-clipboard | Recruitment | **IMPLEMENTED** |
| `/careers/$openingSlug` | `Careers/OpeningDetailPage` | Public | Full opening detail by slug | Recruitment | **IMPLEMENTED** |
| `/careers/$openingSlug/apply` | `Careers/ApplyPage` | Public | Application form + résumé/cover-letter upload + privacy consent | Recruitment | **IMPLEMENTED** |
| `/login` | `Auth/LoginPage` | Public | Sign-in. Redirects authenticated users to `/dashboard` or `/change-password` | Auth | **IMPLEMENTED** (no "Remember Me", no "Forgot password" link) |

### 9.2 Standalone authenticated route (outside `AppShell`)
| Route | Component | Access | Purpose | Status |
|---|---|---|---|---|
| `/change-password` | `Auth/ChangePasswordPage` | Authenticated **with** `mustChangePassword` | Forced first-login password change | **BROKEN** — see §43 R-01/R-02/R-03 |

### 9.3 Authenticated application routes (children of the pathless `app` layout)
| Route | Component | Access | Purpose | Module | Status |
|---|---|---|---|---|---|
| `/dashboard` | `Dashboard/DashboardPage` → HR / Supervisor / Employee | All (tier-switched) | Role overview | Dashboard | **IMPLEMENTED** (mock sub-widgets — §12/§26) |
| `/employees` | `Employees/EmployeesPage` | HR, SUP (`employee.read`) | Directory: search, 8 filters, sorting, pagination, export | Employees | **IMPLEMENTED** |
| `/employees/onboard` | `Employees/EmployeeOnboardingPage` | **HR only** (`beforeLoad` redirect) | 7-step onboarding wizard | Employees | **BROKEN on submit** — §43 R-05 |
| `/employees/drafts` | `Employees/DraftEmployeesPage` | **HR only** | Resume / delete onboarding drafts | Employees | **IMPLEMENTED** |
| `/employees/archived` | `Employees/ArchivedEmployeesPage` | **HR only** | Restore archived employees (single + bulk) | Employees | **IMPLEMENTED** |
| `/employees/org-chart` | `Employees/OrgChartPage` | All (tier-scoped) | Organizational chart | Employees | **IMPLEMENTED** |
| `/employees/$employeeId` | `Employees/EmployeeDetailPage` | All (see §13) | 201 profile, up to 15 tabs | Employees | **IMPLEMENTED** (Timeline + Account Mgmt broken — §43 R-06/R-07) |
| `/attendance` | *(redirect)* | All | → `/attendance/daily` | Attendance | IMPLEMENTED (redirect-only) |
| `/attendance/daily` | `Attendance/DailyMonitoringPage` | All (tier-scoped) | Monthly calendar, KPI cards, day drawer, HR/Team/My tabs, import placeholder | Attendance | **IMPLEMENTED** (+ PLACEHOLDER import) |
| `/attendance/tally` | `Attendance/AttendanceTallyPage` | All (tier-scoped) | Range presets, filters, per-employee totals, drilldown, CSV/Excel/PDF export | Attendance | **IMPLEMENTED** (department filter broken — §43 R-08) |
| `/attendance/holiday-calendar` | `Attendance/HolidayCalendarPage` | All view; HR mutate | Holiday & organization calendar | Attendance | **IMPLEMENTED** |
| `/attendance/schedule` | `Attendance/WorkSchedulePage` (4 tabs) | HR, SUP; EMP own | Employee Schedules · Shift Catalog · Coverage · History | Attendance | **IMPLEMENTED** |
| `/leave` | `Leave/LeavePage` | All | **Legacy mock page** — hardcoded leave requests | Leave | **FRONTEND-ONLY (MOCK)** — §40 |
| `/leave/requests` | `Leave/LeaveRequestsPage` | All (tabs by tier) | My / Team / All leave; HR approve & reject | Leave | **IMPLEMENTED** |
| `/leave/new` | `Leave/NewLeaveRequestPage` | All | File leave (self; on-behalf for SUP/HR). Accepts `?startDate=&endDate=` | Leave | **IMPLEMENTED** |
| `/leave/calendar` | `Leave/LeaveCalendarPage` | All (tier-scoped) | Leave calendar; range select → prefill `/leave/new` | Leave | **IMPLEMENTED** |
| `/evaluations` | `Evaluations/EvaluationsPage` | HR full; SUP/EMP assignments | Templates · Cycles · My Evaluations | Evaluations | **IMPLEMENTED** |
| `/performance` | *(redirect)* | All | → `/evaluations` | Evaluations | Redirect-only; `PerformancePage.tsx` is unreachable dead code |
| `/training` | `Training/TrainingPage` | HR manage; SUP/EMP view | Training & seminar activities, rosters, outcomes | Training | **IMPLEMENTED** |
| `/compliance` | `Compliance/CompliancePage` | HR full | Requirements, scopes, org rollups, needs-attention, employee records | Compliance | **IMPLEMENTED** |
| `/medical` | `Medical/MedicalPage` | HR only | Medical records workspace | Medical | **IMPLEMENTED** |
| `/psychological` | `Psychological/PsychologicalPage` | HR only | Psychological records workspace | Psychological | **IMPLEMENTED** |
| `/payroll` | *(redirect)* | All | → `/dashboard` | — | **OUT OF SCOPE** guard |
| `/payslips` | *(redirect)* | All | → `/dashboard` | — | **OUT OF SCOPE** guard |
| `/ai-assistance` | `AI/AIPage` | All with `ai.read` (HR in practice) | "AI Assistance" | AI | **FRONTEND-ONLY (MOCK)** — §26 |
| `/ai` | *(redirect)* | — | → `/ai-assistance` | AI | Legacy compat |
| `/ai-intelligence` | *(redirect)* | — | → `/ai-assistance` | AI | Legacy compat (only place the word "Intelligence" survives) |
| `/reports` | `Reports/ReportsPage` | `reports.read` (HR) | "Reports & Analytics" | Reports | **FRONTEND-ONLY (MOCK)** — §27 |
| `/announcements` | `Announcements/AnnouncementsPage` | All (HR workspace vs recipient feed) | Announcements | Announcements | **IMPLEMENTED** |
| `/settings` | `Settings/SettingsPage` | All | Settings | Settings | **PLACEHOLDER (non-interactive)** — §28 |
| `/help-center` | `HelpCenter/HelpCenterPage` | All (role-filtered) | Search, Common Tasks, categories, all guides | Help Center | **PARTIALLY IMPLEMENTED** |
| `/help-center/$guideSlug` | `HelpCenter/HelpGuidePage` | All (role-checked) | Guide reader | Help Center | **PARTIALLY IMPLEMENTED** |
| `/help` | *(redirect)* | All | → `/help-center` | Help Center | Legacy compat |
| `/recruitment` | `Recruitment/RecruitmentOverviewPage` | HR | Pipeline KPIs | Recruitment | **IMPLEMENTED** |
| `/recruitment/openings` | `Recruitment/JobOpeningsPage` | HR | Openings list + filters | Recruitment | **IMPLEMENTED** |
| `/recruitment/openings/new` | `Recruitment/JobOpeningFormPage` | HR | Create opening | Recruitment | **IMPLEMENTED** |
| `/recruitment/openings/$openingId/edit` | `Recruitment/JobOpeningFormPage` | HR | Edit opening | Recruitment | **IMPLEMENTED** |
| `/recruitment/openings/$openingId` | `Recruitment/JobOpeningDetailPage` | HR | Opening detail + status actions | Recruitment | **IMPLEMENTED** |
| `/recruitment/applicants` | `Recruitment/ApplicantsPage` | HR | Applicant list, search, stage filters | Recruitment | **IMPLEMENTED** |
| `/recruitment/applicants/$applicationId` | `Recruitment/ApplicantDetailPage` | HR | Overview · Documents · Interviews · Communications · Notes · Hiring & Onboarding | Recruitment | **IMPLEMENTED** |

### 9.4 Routes referenced by the UI that DO NOT EXIST in the route tree
| Link | Where | Result |
|---|---|---|
| `/notifications` | `Sidebar.tsx` — "Notifications" item with a **hardcoded badge of `8`** | **404 / dead link** |
| `/audit` | `Sidebar.tsx` — "Audit Logs" under Administration, gated on `audit.read` (HR sees it) | **404 / dead link** |
| `/settings/profile` | `TopNav.tsx` profile dropdown "My Profile" | Never navigates — rendered as a plain `<button>` with an unused `href` prop |
| `/settings` | `TopNav.tsx` profile dropdown "Settings" | Same — does not navigate |

---

## 10. Backend API Map

Base URL `http://localhost:5000`. `GET /health` is unauthenticated. Everything else is mounted under `/api/v1`, in `apps/api/src/routes/index.ts` (plus 4 direct mounts in `src/index.ts`). **210 endpoint handlers across 24 route files.**

> **Redundant mount:** `department.routes` is mounted **twice** — once as `/api/v1/departments` inside `routes/index.ts` and again directly in `src/index.ts`. Harmless, but duplicated.
> **Root-level mount:** `document.routes` is mounted at `/` under `/api/v1`, which is why its paths read `/api/v1/employees/:employeeId/documents` and `/api/v1/documents/...`.

| # | Base route | Endpoints | Controller | Service(s) | Auth |
|---|---|---|---|---|---|
| 1 | `/auth` | 7 | `AuthController` | `AuthService` | Mixed: login/refresh/forgot/reset public; logout/me/change-password authenticated |
| 2 | `/public/recruitment` | 3 | `PublicRecruitmentController` | `JobApplicationService`, `JobOpeningService`, auto-comm | **Public** + 2 rate limiters + multer |
| 3 | `/dashboard` | 1 (`/stats`) | `DashboardController` | `DashboardService` | authenticate (branches by tier) |
| 4 | `/employees` | 21 | `EmployeeController` | `EmployeeService`, `SupervisorResolverService`, `ExportService` | authenticate + per-route `authorize` |
| 5 | *(root)* documents | 7 | `DocumentController` | `DocumentService` | authenticate; writes `FULL`; reads scoped in service |
| 6 | `/departments` | 5 | `DepartmentController` | `DepartmentService` | Read all tiers; write `FULL` |
| 7 | `/units` | 5 | `UnitController` | `UnitService` | Read all tiers; write `FULL` |
| 8 | `/job-roles` | 5 | `JobRoleController` | `JobRoleService` | Read all tiers; write `FULL` |
| 9 | `/onboarding-drafts` | 5 | `DraftController` | `DraftService` | authenticate; ownership/tier checks in service |
| 10 | `/leave` | 9 | `LeaveController` | `LeaveService` | authenticate; **approve/reject `FULL` only** |
| 11 | `/attendance` | 9 | `AttendanceController` | `AttendanceService` | authenticate; `summary/today` + `PUT /:id` `FULL`; `/logs` `FULL`+`SUPERVISOR` |
| 12 | `/schedules` | 6 | `ScheduleController` | `ScheduleService` | `SchedulingPolicy` in controller + SupervisionLink subordinate check |
| 13 | `/weekly-schedules` | 6 | `WeeklyScheduleController` | `WeeklyScheduleService` | **In-controller tier checks only — no subordinate check (§35)** |
| 14 | `/holidays` | 6 | `HolidayController` | `HolidayService` | `SchedulingPolicy` in controller |
| 15 | `/compliance` | 15 | `ComplianceController` | `ComplianceService` | Mostly `FULL`; employee summary/records scoped in service |
| 16 | `/medical` | 12 | `MedicalController` | `MedicalService` | `FULL` for writes/lists; self-view scoped in service |
| 17 | `/psychological` | 12 | `PsychologicalController` | `PsychologicalService` | Same, plus visibility zones |
| 18 | `/training` | 13 | `TrainingController` | `TrainingService` | Reads authenticated; writes `FULL` |
| 19 | `/evaluations` | 14 | `EvaluationController` | `EvaluationService` | Templates/cycles `FULL`; assignments scoped in service; finalize `FULL` |
| 20 | `/announcements` | 20 | `AnnouncementController` | `AnnouncementService` | HR endpoints `FULL`; recipient endpoints authenticated |
| 21 | `/recruitment` | 22 | `JobOpeningController`, `JobApplicationController` | 8 recruitment services | `RecruitmentPolicy` in controllers |
| 22 | `/notifications` | 3 | *(inline handlers)* | — | authenticate; own-user scoped |
| 23 | `/users` | 2 | `UserController` | `UserService` | `router.use(authorize(['FULL']))` |
| 24 | `/search` | 1 | `SearchController` | `SearchService` | authenticate; tier-scoped |

### 10.1 Notable endpoint groups
**Employees** — `GET /org-chart`, `/units`, `/job-roles`, `/eligible-supervisors`(FULL), `POST /resolve-supervisor`(FULL), `POST /bulk-restore`(FULL), `GET|POST /export/excel`, `/export/pdf`(FULL,SUP), `GET /me`, `GET /subordinates`(FULL,SUP), `GET /`(FULL,SUP), `POST /`(FULL), `GET|PUT /:id`, `DELETE /:id`(FULL), `PATCH /:id/archive`(FULL), `PATCH /:id/restore`(FULL), `POST|DELETE /:id/supervisor-override`(FULL).

**Attendance** — `GET /summary/today`(FULL), `GET /calendar`, `GET /schedule`, `GET /tally`, `GET /logs`(FULL,SUP), `GET /`, `PUT /:id`(FULL), `POST /export/excel`, `POST /export/pdf`. **There is no import endpoint.**

**Recruitment (internal)** — openings: `GET /overview`, `GET|POST /openings`, `GET|PATCH /openings/:id`, `PATCH /openings/:id/status`. Applications: `GET /applications`, `GET /applications/:id`, `PATCH /applications/:id/status`, `POST /applications/:id/notes`, `GET /applications/:id/documents/:documentId/{download,preview}`, `POST /applications/:id/interviews`, `PATCH .../interviews/:interviewId`, `PATCH .../interviews/:interviewId/reschedule`, `GET|POST /applications/:id/communications`, `POST .../communications/preview`, `POST .../communications/:communicationId/retry`, `POST /applications/:id/convert`.

**Announcements** — `POST /audience-preview`(FULL), `GET /hr`(FULL), `GET /stats`(FULL), `GET /dashboard`, `GET /unread-count`, `GET /`(recipient feed), `POST /`(FULL), attachments `POST|GET|GET :attachmentId|DELETE`, `GET|PUT|DELETE /:id`, `POST /:id/{activate,schedule,archive,read}`, `GET /:id/recipients`, `GET /:id/recipients/stats`.

### 10.2 ⚠ Frontend→backend contract mismatches (cross-check result)
Every frontend API path was extracted and compared with the registered routes. Five mismatches:

| Frontend call | Where | Backend reality | Effect |
|---|---|---|---|
| `GET /employees/:id/timeline` | `EmployeeDetailPage.tsx:83` | **No such route** (falls through to the 404 handler) | Swallowed by `.catch()` → the **Timeline tab is permanently empty** |
| `POST /employees/:id/account/reset-password` and `POST /employees/:id/account/{deactivate,activate,lock,unlock,force-password-change,resend-welcome}` | `AccountManagementPanel.tsx` (7 controls) | **No `/account/*` routes exist anywhere** | Every Account Management action **404s** |
| `PATCH /users/:userId` | `EmployeesPage.tsx:315` (activate/deactivate toggle) | Only `PATCH /users/:id/reset-password` and `PATCH /users/:id/status` exist | **404** |
| `GET /employees/departments?unitId=` | `AttendanceTallyPage.tsx:222` | Not registered; matches `GET /:id` with `id="departments"` → 404 | Department filter silently never populates |
| `POST /employees` sent as `multipart/form-data` | `EmployeeOnboardingPage.tsx` | Route has **no multer**; only `express.json`/`urlencoded` are mounted | `req.body` is not parsed → creation fails (§43 R-05) |

---

## 11. Database Model Map

`apps/api/prisma/schema.prisma` — **2,261 lines · 72 models · 54 enums · MySQL**. Every model uses `uuid()` string PKs and `@@map` to snake_case tables.

### 11.1 Organization & RBAC
| Model | Table | Purpose | Key fields / relations | State |
|---|---|---|---|---|
| `Department` | `departments` | Optional org layer | `name`/`code` unique, `headJobRoleId`, self-relation `parentDepartmentId`; → units, employees, jobRoles, jobOpenings, 3 scope tables | Active |
| `Unit` | `units` | 7 HSJ service units | `name`/`code` unique, `departmentId?`, `headJobRoleId`, self-relation `parentUnitId` | Active |
| `JobRole` | `job_roles` | 46 seeded roles | `code` unique, `unitId`, `departmentId?`, `parentJobRoleId`, `isHead`, `isSupervisor`, **`permissionTier`**, `hierarchyStatus` | Active — **the role/permission anchor** |
| `Permission` | `permissions` | Granular registry | `@@unique([module, action, scope])` | Active |
| `RolePermission` | `role_permissions` | JobRole × Permission | `@@unique([jobRoleId, permissionId])`, both **cascade delete** | Active |

### 11.2 Authentication
| Model | Purpose | Notes |
|---|---|---|
| `User` | Login identity | `email` unique, `passwordHash`, `employeeId` **unique + optional** (1:1), `isActive`, `failedLoginAttempts`, `lockedUntil`, `mustChangePassword`, `lastLoginAt/Ip`, `deletedAt` |
| `UserSession` | Refresh sessions | `refreshToken` unique, `expiresAt`, `isRevoked`, `deviceInfo`, `ipAddress`; **cascade on user delete** |
| `PasswordResetToken` | 1-hour reset tokens | `token` unique, `usedAt`; **cascade** |
| `EmailVerificationToken` | Email verification | **UNUSED** — nothing reads or writes it |

### 11.3 Employee (the hub — 40+ relations)
`Employee` / `employees`. Field groups: identity (`employeeNumber` unique, names, `gender`, `dateOfBirth`, `placeOfBirth`, `civilStatus`, `nationality`, `religion`), contact (`personalEmail`, `workEmail` unique, `mobilePhone`, `telephoneNumber`, `homePhone`), address (`presentAddress`, `permanentAddress`), emergency (3 fields, all required), employment (`departmentId?`, `unitId`, `jobRoleId`, `employmentStatus`, `employmentState`, `workSchedule` *(legacy enum, retained)*, `hireDate`, `probationDate`, `regularizationDate`, `separationDate`, `separationReason`), government IDs (`sssNumber`, `philhealthNumber`, `pagibigNumber`, `tinNumber`), supervision (`immediateSupervisorId` self-relation `NoAction/NoAction`, `supervisorAssignmentSource`, `supervisorAssignmentStatus`, `supervisorPendingReason`, `supervisorOverrideReason`, `supervisorOverrideById`, `supervisorOverrideAt`), plus `photoUrl` and `deletedAt` (soft delete). Indexed on `employeeNumber, departmentId, unitId, jobRoleId, employmentStatus, workEmail, immediateSupervisorId, supervisorAssignmentStatus, supervisorAssignmentSource`.

`SupervisionLink` / `supervision_links` — explicit supervisor↔subordinate join with `isActive`, `@@unique([supervisorId, subordinateId])`. **Seed-only writer (§8.4).**

### 11.4 Attendance & Scheduling
| Model | Purpose | Notes |
|---|---|---|
| `AttendanceRecord` | Daily fact per employee | `@@unique([employeeId, date])`, `timeIn/timeOut`, `status: AttendanceStatus`, `hoursWorked`, `overtimeHours`, `remarks`, `verifiedById` — **written only by the seed today** |
| `AttendanceLog` | Tardiness/undertime/excuse | `logType` free string, `minutesLate`, `excuseSlipUrl`, `acknowledgedBy/At`; read by `/attendance/logs`; **no writer** |
| `OrganizationCalendarEntry` | Holidays / suspensions | `@@unique([date,name])`, `type`, `source(HOLIDAY_API|MANUAL)`, `status(PENDING|APPROVED|IGNORED)` |
| `ScheduleTemplate` / `ScheduleTemplateDay` | Legacy template track | `@@unique([name,version])`; day rows exist **only** for `WORKING`/`DAY_OFF` — absence = `UNCONFIGURED` |
| `EmployeeScheduleAssignment` | Template ↔ employee, effective-dated | `effectiveFrom`/`effectiveTo`, `bulkBatchId` |
| `ShiftDefinition` | **Shift Catalog** | `@@unique([name,version])`, `category(OFFICE|SHIFT)`, `startTime`/`endTime` strings, `isActive`, `isArchived` |
| `EmployeeWeeklySchedule` → `…Day` → `…Shift` | Current weekly model | Half-open effective dating; day `status(UNCONFIGURED|DAY_OFF|WORKING)`; multiple shifts per day via `sequence`; **cascade** down the chain |
| `ScheduleHistoryLog` | Scheduling audit | `action`, `previousValue`/`newValue` JSON, `bulkBatchId`, actor + optional target employee |

### 11.5 Leave
`LeaveBalance` — `@@unique([employeeId, year, leaveType])`, `totalAllotted`, `used`, `pending`, `forfeited`.
`LeaveRequest` — `leaveType`, `startDate`/`endDate`, `totalDays`, `reason`, `supportingDocUrl`, `status: LeaveStatus`, `approvedById` (→ `Employee`), `approvedAt`, `rejectionReason`, `hrNotes`, `deletedAt`.

### 11.6 Evaluations
`EvaluationTemplate` → `EvaluationCriterion` (cascade) → `EvaluationCycle` → `EvaluationCycleScope` (cascade) → `EvaluationAssignment` (`@@unique([cycleId, employeeId])`, carries a `templateSnapshot` JSON and `isEmployeeVisible`) → `EvaluationResponse` (`@@unique([assignmentId, criterionId])`, cascade).
`PerformanceEvaluation` — the **older, parallel** evaluation model (`dimensionScores` JSON, `overallScore`, `overallRating`). Still related to `Employee`; **no current service writes it** → LEGACY.

### 11.7 Compliance / Medical / Psychological
| Model | Purpose |
|---|---|
| `ComplianceRequirement` (`compliance_requirements_new`) | HR-defined requirement: `category`, `tracksExpiry`, `reminderDays`, `lifecycle`, `deletedAt` |
| `ComplianceRequirementScope` | Applicability: `ALL / UNIT / DEPARTMENT / JOB_ROLE / EMPLOYEE` (cascade) |
| `MedicalRecord` (`medical_records_new`) + `MedicalRecordDocument` | `examType`, `examDate`, `examinedBy`, **`hrNotes` (never exposed to employees)**, `expiresAt`, `reviewStatus/By/At/Reason` |
| `PsychologicalRecord` (`psychological_records_new`) + `PsychologicalRecordDocument` | Two zones: `employeeVisibleSummary` vs `hrConfidentialNotes`; documents carry `visibility: EMPLOYEE_VISIBLE | HR_ONLY` |
| `EmployeeComplianceRecord` + `EmployeeComplianceDocument` | Generic fulfilment for CERTIFICATION / TRAINING / DOCUMENT / OTHER; `recordTitle`, `referenceNumber`, `completedAt`, `expiresAt`, review fields; documents carry `visibility: VISIBLE | HR_ONLY` |

**Legacy stubs preserved by design (do not use):** `LegacyComplianceRequirement` → `compliance_requirements`, `LegacyComplianceDocument` → `compliance_documents`, `LegacyMedicalRecord` → `medical_records`, `LegacyPsychologicalRecord` → `psychological_records`. All are explicitly `@deprecated` in the schema; the new models take the `_new` table names.

### 11.8 Training
`TrainingActivity` (current) → `TrainingParticipant` (`@@unique([trainingActivityId, employeeId])`; certificate metadata stored on the row; optional `complianceRecordId` link) and `TrainingActivityDocument`. `TrainingActivity.complianceRequirementId` links an activity to a `TRAINING`-category requirement.
**Legacy:** `Training` → `TrainingAttendee` (still read by `DashboardService`), and `ActivityAttendance` (no reader/writer).

### 11.9 Documents & Files
`EmployeeDocument` — `category: DocumentCategory`, `storedFilename` unique, `mimeType`, `sizeBytes`, **`isVisibleToEmployee`** (default `true`), **`isVisibleToSupervisor`** (default `false`), `expiresAt`, `replacedAt`, `deletedAt`, `notes`.
`UploadedFile` — generic registry with a `purpose` string. **UNUSED.**

### 11.10 Communication
`Announcement` — `title`, **`body` (Text, authoritative)**, deprecated `content` (VarChar 191), `priority`, `state(DRAFT|ACTIVE|ARCHIVED)`, `isPinned`, `publishAt`, `expiresAt`, `archivedAt`, `createdByUserId`; deprecated legacy targeting columns (`audience`, `targetUnitId`, `targetJobRoleId`, `targetEmployeeId`, `authorId`) retained to avoid a destructive migration.
`AnnouncementAudienceScope` — additive `ALL/UNIT/DEPARTMENT/JOB_ROLE/EMPLOYEE` targeting (cascade).
`AnnouncementRecipient` — the **snapshot**: `@@unique([announcementId, employeeId])`, `readAt`; created only at publish/schedule time, never by a read action.
`AnnouncementAttachment` — new secure columns (`originalFilename`, `storedFilename` unique, `mimeType`, `sizeBytes`, `uploadedByUserId`) alongside deprecated `fileName`/`fileUrl`.
`Notification` — `type: NotificationType`, `title`, `message`, `link`, `isRead`, `readAt`. **Never created (§30).**

### 11.11 Recruitment
`JobOpening` (`referenceNumber` + `slug` unique, `unitId`/`departmentId?`/`jobRoleId`, `employmentType`, `vacancies`, `description`/`responsibilities`/`qualifications`/`requiredDocuments` Text, `openingDate`/`closingDate`, `status`) → `JobApplication` (`referenceNumber` unique, `applicantId`, `jobOpeningId`, `status`, `applicantMessage`, `privacyConsent` + `consentTimestamp`, **`onboardingDraftId` unique**, **`employeeId` unique**) → `ApplicantDocument` (`storedFilename` unique, `storagePath`, nullable `uploadedBy` for public submissions), `ApplicantInterview`, `ApplicationStatusHistory`, `ApplicantNote`, `ApplicantCommunication`.
`Applicant` — the person; can hold multiple applications; **no credentials, no account link.**
`ApplicantCommunication` — full audit: `communicationType`, `source(AUTOMATIC_SYSTEM|MANUAL_HR)`, **`eventId` unique (idempotency key)**, `triggerType`, `channel`, `recipientEmail/Name`, `subjectSnapshot`, `bodySnapshot`, `provider`, `providerMessageId`, `sendStatus(DRAFT|SENDING|SENT|FAILED|SIMULATED)`, `initiatedBy`, `sentByUserId`, failure fields, and a self-relation `retryOfCommunicationId` → `retries[]`.

### 11.12 Audit, drafts, AI, system
`AuditLog` — `actorUserId?`, `targetEmployeeId?`, `action`, `entityType`, `entityId`, `metadata`/`oldValue`/`newValue` JSON, `ipAddress`, `userAgent`. Written from ~15 services. **No read API.**
`ActivityLog` — a second, simpler log. **No writer.**
`OnboardingDraft` — `data` JSON, `status: OnboardingDraftStatus`, `createdById`, `lastUpdatedById`, `assignedToId?`, `createdEmployeeId?` unique, `completedAt`.
`AIInsight` / `AIRequestLog` / `AIConversation` — **read by the dashboard; written only by the seed.** No AI code exists.
`SystemSetting` — `key` unique / `value` / `description`. Seeded (including a `payroll_periods_per_month` entry). **No read or write API.**
`Payslip` — **OUT OF SCOPE**; the model and its `Employee.payslips` relation remain, and `seed.ts` still seeds rows (§41).

### 11.13 Enum inventory (54)
`SupervisorAssignmentSource · SupervisorAssignmentStatus · SupervisorPendingReason · HierarchyConfigurationStatus · OnboardingDraftStatus · PermissionTier · EmploymentState · EmploymentStatus · WorkSchedule · Gender · CivilStatus · AttendanceStatus · LeaveType · LeaveStatus · EvaluationStatus · EvaluationRatingMethod · EvaluationCycleStatus · EvaluationAssignmentStatus · TrainingStatus · TrainingActivityType · TrainingActivityStatus · TrainingParticipationStatus · ComplianceStatus* · ComplianceCategory* · RequirementCategory · RequirementLifecycle · RequirementScopeType · RecordReviewStatus · EmployeeComplianceStatus · PsychologicalDocumentVisibility · ComplianceDocumentVisibility · AnnouncementPriority · AnnouncementAudience* · AnnouncementState · AnnouncementScopeType · NotificationType · AIInsightType · AIRequestStatus · JobOpeningStatus · JobApplicationStatus · InterviewType · InterviewStatus · DocumentCategory · RecruitmentCommunicationType · RecruitmentCommunicationSource · CommunicationChannel · CommunicationSendStatus · CommunicationInitiator · OrganizationCalendarType · OrganizationCalendarSource · OrganizationCalendarStatus · Weekday · ShiftCategory · DayConfigurationStatus`
`*` = explicitly marked legacy in the schema.

Enum values worth calling out:
- `AttendanceStatus` = `PRESENT · ABSENT · LATE · HALF_DAY · ON_LEAVE · HOLIDAY · REST_DAY · SUSPENDED`. **`NO_RECORD` is *not* an enum value** — it is a runtime-only string produced by `AttendanceService.list` for virtual (missing) rows (§15).
- `LeaveStatus.FOR_REVIEW` exists in the enum but **is never set or read** by any service (§19).
- `NotificationType.PAYSLIP_RELEASED` and `Permission` module `payslip` are out-of-scope remnants (§41).

### 11.14 Relationship map (as actually implemented)
```
Unit ──1:N── Department? ──1:N── JobRole ──1:N── Employee ──1:1── User ──1:N── UserSession
  │              │                  │                │                        └─ PasswordResetToken / EmailVerificationToken(unused)
  └─ headJobRole ┘                  ├─ parentJobRole (self)
     parentUnit (self) / parentDepartment (self)
                                    └─ RolePermission ──N:1── Permission

Employee ─ self ─ immediateSupervisorId ──▶ directReports          (written by app)
Employee ─ SupervisionLink ─ supervisor / subordinate              (written by SEED ONLY)

Employee ──1:N── AttendanceRecord ──1:N── AttendanceLog
Employee ──1:N── EmployeeWeeklySchedule ──1:N── …Day ──1:N── …Shift ──N:1── ShiftDefinition
Employee ──1:N── EmployeeScheduleAssignment ──N:1── ScheduleTemplate ──1:N── ScheduleTemplateDay
Employee ──1:N── LeaveRequest (employee) │ LeaveRequest (approvedBy) │ LeaveBalance
Employee ──1:N── EvaluationAssignment (subject | evaluator) ──1:N── EvaluationResponse
              └─ EvaluationCycle ──N:1── EvaluationTemplate ──1:N── EvaluationCriterion
              └─ EvaluationCycleScope ▶ Unit | Department | JobRole | Employee
Employee ──1:N── TrainingParticipant ──N:1── TrainingActivity ──N:1── ComplianceRequirement?
                                   └──N:1── EmployeeComplianceRecord?   (auto-fulfilment link)
Employee ──1:N── MedicalRecord ──1:N── MedicalRecordDocument
Employee ──1:N── PsychologicalRecord ──1:N── PsychologicalRecordDocument
Employee ──1:N── EmployeeComplianceRecord ──1:N── EmployeeComplianceDocument
ComplianceRequirement ──1:N── ComplianceRequirementScope ▶ Unit | Department | JobRole | Employee
Employee ──1:N── EmployeeDocument
Employee ──1:N── AnnouncementRecipient ──N:1── Announcement ──1:N── AnnouncementAudienceScope
                                                            └──1:N── AnnouncementAttachment
JobOpening ──1:N── JobApplication ──N:1── Applicant
JobApplication ──1:N── ApplicantDocument | ApplicantInterview | ApplicationStatusHistory
                     | ApplicantNote | ApplicantCommunication ─ self ─ retryOf/retries
JobApplication ──0:1── OnboardingDraft (onboardingDraftId, unique)
JobApplication ──0:1── Employee        (employeeId, unique)   ← FK-less pointer, never populated (§14)
User ──1:N── AuditLog | ActivityLog | Notification | ScheduleHistoryLog | Announcement(created)
```

**Cascade behaviour worth knowing:** `onDelete: Cascade` is set on `RolePermission`, `UserSession`, `PasswordResetToken`, `EmailVerificationToken`, `EvaluationCriterion`, `EvaluationCycleScope`, `EvaluationResponse`, `ComplianceRequirementScope`, `MedicalRecordDocument`, `PsychologicalRecordDocument`, `EmployeeComplianceDocument`, `TrainingParticipant`, `TrainingActivityDocument`, `AnnouncementAudienceScope`, `AnnouncementRecipient`, `AnnouncementAttachment`, `EmployeeWeeklyScheduleDay`, `EmployeeWeeklyScheduleShift`. `Employee.immediateSupervisor` is deliberately `NoAction / NoAction` to avoid MySQL self-referential cascade problems. Employees, leave requests, most records, and announcements use **`deletedAt` soft deletes** rather than hard deletes.

---

## 12. Employee Management

**Key files:** `pages/Employees/*` (6 pages + 10 components) · `routes/employee.routes.ts` · `controllers/employee.controller.ts` · `services/employee.service.ts` (1,189 ln) · `services/supervisor-resolver.service.ts` · `services/draft.service.ts` · `services/document.service.ts` · `services/export.service.ts` (unused) · models `Employee`, `User`, `OnboardingDraft`, `EmployeeDocument`, `SupervisionLink`, `AuditLog`.

### 12.1 Employee Directory — `/employees` — **IMPLEMENTED**
1,207 lines, TanStack Table. All state is mirrored into the URL search params so views are shareable.
- **Search** — debounced 400 ms; backend matches `firstName`, `middleName`, `lastName`, `employeeNumber`, `personalEmail`, `workEmail`, job role title, unit name.
- **Filters** — `employmentState`, `unitId`, `departmentId`, `jobRoleId`, `accountStatus`, `hireDateFrom`/`hireDateTo`, `isArchived`, and **`supervisorAssignmentStatus=PENDING`** ("needs a supervisor" queue).
- **Sorting / pagination** — server-driven (`sortBy`, `sortOrder`, `page`, `limit`, default 25).
- **Export** — `GET|POST /employees/export/excel` and `/export/pdf` (FULL, SUPERVISOR) via ExcelJS / PDFKit.
- **Row actions** — open profile; HR-only account activate/deactivate toggle → `PATCH /users/:userId` **which does not exist (§10.2)**.
- **Scope** — `authorize(['FULL','SUPERVISOR'])`; `STANDARD` cannot list employees at all.

### 12.2 Employee Onboarding — `/employees/onboard` — **BROKEN ON SUBMIT**
7 steps: *Personal Information → Contact & Address → Employment Details → Government Numbers → Emergency Contact → Document Uploads → Review & Confirm*, with a live supervisor preview (`POST /employees/resolve-supervisor`) that reacts to unit/department/job-role changes and shows the resolution status or pending reason.
- **Save Draft** at any step → `POST/PUT /onboarding-drafts` with the whole form as JSON. This part works.
- **Submit** → `POST /employees` as `multipart/form-data` including `profilePicture`, `resume`, `contract`, `governmentIds[]`, `otherDocuments[]`, and `draftId`.
- **Three independent defects on this path (§43 R-05):**
  1. The route has **no multer**, and only `express.json()`/`express.urlencoded()` are mounted — a multipart body is not parsed, so `req.body` is not populated.
  2. **`employeeNumber` is never collected by the form and never generated by the server**, yet it is `String @unique`, required. There is **no employee-number generator anywhere in the repository**.
  3. `EmployeeService.create` **never creates a `User`, never generates a temporary password, and never sends a welcome email** — but the success screen renders `createdEmployee.tempPassword`, offers "Copy Credentials", and produces a `Credentials_<employeeNumber>.pdf` via html2pdf. The heading *"Onboarding Complete — The employee account has been successfully created"* is therefore **not true**: no login account exists.
- Related dead code: `lib/passwordGenerator.generateSecurePassword()`, `lib/password.generateTemporaryPassword()`, `EmployeeEmailService.sendWelcomeEmail()`, `EmailService.sendWelcomeEmail()` — **none are called by any live path.**

### 12.3 Draft Employees — `/employees/drafts` — **IMPLEMENTED** (HR only)
`OnboardingDraft` CRUD (`DraftService`): create, list (filterable by status), get, update (data/status/assignee), delete. `DraftService.markCompleted` sets `status=COMPLETED`, `completedAt`, and `createdEmployeeId` — but it is invoked from `EmployeeController.create` **after** the create call, so it is unreachable while §12.2 remains broken. The Sidebar shows a live draft-count badge from `GET /onboarding-drafts?status=DRAFT`.

### 12.4 Archive & Restore — **IMPLEMENTED** (HR only)
- **Archive** — `DELETE /employees/:id` or `PATCH /employees/:id/archive` with a `reason`; `EmployeeService.archive` sets `deletedAt` and writes an audit entry. Soft delete only.
- **Restore** — `/employees/archived` supports single (`PATCH /employees/:id/restore`) and bulk (`POST /employees/bulk-restore`). `bulkRestore` clears `deletedAt` in a transaction and writes one `EMPLOYEE_RESTORED` audit row per employee, recording `previousAccountStatus` (`ACTIVE | INACTIVE | NO_ACCOUNT`).
- **Gap:** the restore dialog asks *"Do you also want to reactivate their user account?"* and sends `restoreAccountAccess`, but `bulkRestore` **ignores that flag** — the `User.isActive` state is never changed.

### 12.5 Assign / Override Supervisor — **IMPLEMENTED** (HR only)
`SupervisorAssignmentDialog.tsx` + `GET /employees/eligible-supervisors?excludeId=` + `POST|DELETE /employees/:id/supervisor-override`. Records reason, actor and timestamp; `DELETE` reverts to automatic resolution. **Caveat:** this writes only `immediateSupervisorId`, never a `SupervisionLink` (§8.4).

### 12.6 Employee Documents — **IMPLEMENTED**
| Action | Endpoint | Who |
|---|---|---|
| Upload | `POST /employees/:employeeId/documents` (multer, 5 MB, PDF/JPEG/PNG/WEBP/DOC/DOCX, explicit executable-extension blocklist) | **FULL** |
| List | `GET /employees/:employeeId/documents` | Scoped in service (§34) |
| Preview / Download | `GET /documents/:documentId/preview` · `/download` | Scoped in service |
| Edit metadata | `PUT /documents/:documentId` | **FULL** |
| Replace file | `PUT /documents/:documentId/file` | **FULL** |
| Delete | `DELETE /documents/:documentId` | **FULL** |
Categories: `RESUME · EMPLOYMENT_CONTRACT · GOVERNMENT_ID · MEDICAL_CLEARANCE · CERTIFICATE · OTHER`. Per-document `isVisibleToEmployee` / `isVisibleToSupervisor` flags drive access. UI: `DocumentUploadDialog`, `DocumentEditMetadataDialog`, `DocumentReplaceDialog`, `DocumentDeleteDialog`.

### 12.7 Account Management — **BROKEN**
`AccountManagementPanel.tsx` (HR-only tab) renders account status, activation, lock/unlock, force password change, password reset (with temp-password reveal), and "resend welcome email". **All seven controls call `/employees/:id/account/*`, which does not exist in the backend.** The only real account endpoints are `PATCH /users/:id/reset-password` and `PATCH /users/:id/status`, and nothing calls them correctly. The panel also uses native `alert()` / `confirm()` / `prompt()` rather than the app's toast/dialog system.

### 12.8 Organizational Chart — `/employees/org-chart` — **IMPLEMENTED**
See §8.5.

### 12.9 Global Search — **IMPLEMENTED**
`GlobalSearch.tsx` → `GET /search?q=`. Minimum 2 characters, 6 results per group. `FULL` gets employees + archived employees + onboarding drafts; lower tiers get a narrowed employee set. Selecting a result navigates to the profile, or to `/employees/onboard?draftId=…` for a draft.

---

## 13. Employee 201 Profile

**File:** `pages/Employees/EmployeeDetailPage.tsx` (519 ln) + 8 tab components. Data: `GET /employees/:id`.

### 13.1 Tabs and who sees them
`isFullHR = permissionTier === 'FULL'`, `isSelf = user.employee.id === employeeId`.

| Tab | HR (any employee) | Supervisor (other) | Employee (own) | Component / source |
|---|---|---|---|---|
| Overview | ✅ | ✅ | ✅ | inline |
| Personal | ✅ | ✅ | ✅ | inline |
| Contact | ✅ | ✅ | ✅ | inline |
| Employment | ✅ | ✅ | ✅ | inline |
| Schedule | ✅ | ✅ | ✅ | `EmployeeScheduleProfileTab` |
| Attendance | ✅ | ✅ | ✅ | `EmployeeAttendanceProfileTab` |
| **Government** | ✅ | ✅ | ✅ | inline — **SSS / PhilHealth / Pag-IBIG / TIN are shown to every viewer** |
| Emergency | ✅ | ✅ | ✅ | inline |
| Documents | ✅ | ✅ | ✅ | `EmployeeDocument*` (backend narrows the rows) |
| Compliance | ✅ | ✅ | ✅ | `EmployeeComplianceProfileTab` |
| Evaluations | ✅ | ❌ | ✅ (own) | `EmployeeEvaluationProfileTab` |
| Training | ✅ | ❌ | ✅ (own) | `EmployeeTrainingProfileTab` |
| **Medical** | ✅ | ❌ | ✅ (own) | `EmployeeMedicalProfileTab` |
| **Psychological** | ✅ | ❌ | ✅ (own) | `EmployeePsychologicalProfileTab` |
| Timeline | ✅ | ✅ | ✅ | `GET /employees/:id/timeline` — **route does not exist → always empty** |
| **Account Management** | ✅ | ❌ | ❌ | `AccountManagementPanel` — **all actions 404** |

### 13.2 Management controls on the profile
HR-only: **Edit Details** (`EmployeeEditForm` → `PUT /employees/:id`), **Assign Supervisor**, **Upload Document**, **Archive**. A `Development Account` badge appears for HR when `employeeNumber` starts with `DEV-`.

### 13.3 Own-profile vs directory-profile routing
There is **one** profile route, `/employees/$employeeId`. An employee reaches their own profile by navigating to their own id; `GET /employees/me` exists in the API but no page calls it. Because `/employees` is `FULL`/`SUPERVISOR`-only, `STANDARD` users have no in-app link to any profile — the tab still renders correctly if they land on their own id.

### 13.4 ⚠ Profile privacy gap
`GET /employees/:id` carries **no authorization check whatsoever** — no `authorize()` on the route, and `EmployeeService.getById(id)` takes only an id. **Any authenticated user, including `STANDARD`, can fetch any employee's full record** — government IDs, date and place of birth, home address, personal email, emergency contacts, and the linked user account's email/active state. The Medical/Psychological/Evaluations tab gating is **frontend-only** for the *profile shell*; those tabs' own data endpoints are separately protected, but the base record is not. Recorded as §35 / §43 R-09.

---

## 14. Recruitment & Hiring

**Key files:** `pages/Recruitment/*` (6 pages + 6 components) · `pages/Careers/*` (5) · `routes/{recruitment,public-recruitment}.routes.ts` · `controllers/{job-opening,job-application,public-recruitment}.controller.ts` · `services/{job-opening,job-application,interview,applicant-note,applicant-document,applicant-communication,applicant-conversion,recruitment-automatic-communication}.service.ts` · `services/email/*` · `policies/recruitment.policy.ts` · `config/recruitment.config.ts` · models `JobOpening`, `Applicant`, `JobApplication`, `ApplicantDocument`, `ApplicantInterview`, `ApplicationStatusHistory`, `ApplicantNote`, `ApplicantCommunication`, `OnboardingDraft`.

### 14.1 Public careers — **IMPLEMENTED**
| Page | Endpoint | Behaviour |
|---|---|---|
| `/careers` | `GET /public/recruitment/openings` | Only `OPEN` openings; browsing rate limit (default 60/min/IP) |
| `/careers/$openingSlug` | `GET /public/recruitment/openings/:slug` | Full description, responsibilities, qualifications, required documents, dates |
| `/careers/$openingSlug/apply` | `POST /public/recruitment/openings/:openingId/apply` | Applicant details, message, résumé (required) + cover letter (optional), **explicit privacy consent captured with a timestamp** |
| `/careers/application-success` | — | Displays the generated application reference with copy-to-clipboard |

**Applicant accounts: none.** No login, no password, no session, no self-service status page. The reference number is for the applicant's own records; HRISense provides no way to look it up. A `20260804224319_add_applicant_status_tokens` migration once added status tokens and `20260804233351_remove_application_status_tokens` **removed them** — the retreat from applicant self-service is recorded in the migration history. **Constraint 5 verified.**

### 14.2 Upload hardening on the public endpoint
Rate limiter runs **before** multer (deliberate). Limits: 5 MB/file, max 2 files, 20 fields, 25 parts. MIME allowlist PDF/DOC/DOCX; extension normalised; random 16-byte filenames; storage under `uploads/recruitment/documents` which is **never served statically**. `adm-zip` is used to walk DOCX archives in memory and confirm genuine Office Open XML relationships, rejecting renamed generic ZIPs. Multer errors are translated into applicant-friendly messages.

### 14.3 Job Opening lifecycle — **IMPLEMENTED**
`DRAFT → OPEN → CLOSED | FILLED → ARCHIVED` (`JobOpeningStatus`). `POST /recruitment/openings` auto-generates a unique `referenceNumber` and a slug from the title. `PATCH /recruitment/openings/:id` edits; `PATCH /recruitment/openings/:id/status` transitions and stamps `publishedAt` / `closedAt`. Fields: title, unit (required), department (optional), job role (required), employment type (`EmploymentStatus`), vacancies, description / responsibilities / qualifications / required documents, opening & closing dates. **Public visibility = `status === OPEN` only.** Publishing (`→ OPEN`) requires `canPublishJobOpening`; other management requires `canManageJobOpenings` (§7.3 caveat applies).

### 14.4 Applicant management — **IMPLEMENTED**
`/recruitment/applicants` lists applications with search (applicant name, reference number, opening) and stage filters. The pipeline is `JobApplicationStatus`: `SUBMITTED → UNDER_REVIEW → SHORTLISTED → FOR_INTERVIEW → INTERVIEWED → FOR_REQUIREMENTS → HIRED | REJECTED | WITHDRAWN`. **The list is a table with filters, not a drag-and-drop Kanban board.**

`ApplicantDetailPage` sections:
| Section | Capability |
|---|---|
| **Overview** | Applicant + opening details, current stage, `PATCH /applications/:id/status` with a reason; every change writes `ApplicationStatusHistory` |
| **Documents** | `ApplicantDocumentsTab` — inline **preview** (`/documents/:documentId/preview`) and **download** (`/download`), both authenticated |
| **Interviews** | `ApplicantInterviewsSection` + `InterviewFormDialog` — schedule (`type`, `scheduledAt`, `locationDetails`, `interviewer`), update (notes, **recommendation**, status), reschedule; `InterviewStatus` = `SCHEDULED · COMPLETED · CANCELLED · RESCHEDULED · NO_SHOW` |
| **Communications** | `ApplicantCommunicationsSection` + `CommunicationComposerDialog` — full history, preview, send, retry |
| **Notes & History** | `POST /applications/:id/notes` + the status-history timeline |
| **Hiring & Onboarding** | `ApplicantOnboardingSection` + `OnboardingConversionDialog` — `POST /applications/:id/convert` |

**Requirements stage:** `FOR_REQUIREMENTS` is a pipeline status with a matching `ADDITIONAL_REQUIREMENTS` email template. There is **no structured requirements checklist model** — it is a status plus a message.

### 14.5 Applicant → Employee conversion — **IMPLEMENTED (one hop)**
`ApplicantConversionService.convertToOnboarding` requires `status === 'HIRED'`, refuses double conversion, and in one transaction creates an `OnboardingDraft` pre-filled with the applicant's names, personal email, mobile, address plus the opening's `departmentId`/`unitId`/`jobRoleId`/`employmentType`, then stores `JobApplication.onboardingDraftId` and writes an `APPLICANT_CONVERTED_TO_ONBOARDING` audit row.
**Chain gap:** `JobApplication.employeeId` exists and is unique but **no code ever sets it**, because the draft→employee step (§12.2) is broken. The applicant→employee identity link is therefore never completed today.

### 14.6 Recruitment communications — **IMPLEMENTED**
- **Templates** — `RecruitmentTemplateService` renders 12 types: `APPLICATION_RECEIVED · APPLICATION_UNDER_REVIEW · INTERVIEW_PROCESS_UPDATE · INTERVIEW_INVITATION · INTERVIEW_RESCHEDULED · INTERVIEW_CANCELLED · ADDITIONAL_REQUIREMENTS · APPLICATION_ACCEPTED · APPLICATION_NOT_SELECTED · APPLICATION_WITHDRAWN_CONFIRMATION · SHORTLISTED · CUSTOM_MESSAGE`, each with subject, HTML and text bodies from a `TemplateContext`.
- **Automatic** — `RecruitmentAutomaticCommunicationService` fires **after** the primary transaction commits, with **idempotency via a unique `eventId`** (`application-submitted:<id>`, `application-status-changed:<statusHistoryId>`, `interview-scheduled:<id>`, `interview-rescheduled:<id>:<ts>`, `interview-cancelled:<id>:<ts>`). Failures mark the row `FAILED` with a reason and write an `AUTOMATIC_EMAIL_FAILED` audit entry **without rolling back the HR action**.
- **Manual** — `POST /applications/:id/communications` (send), `.../communications/preview` (render before sending), `.../communications/:communicationId/retry`. Restricted types (`APPLICATION_ACCEPTED`, `APPLICATION_NOT_SELECTED`, `CUSTOM_MESSAGE`) require HR Officer authority.
- **Provider abstraction** — `RecruitmentEmailProvider` with `DEVELOPMENT` and `BREVO` implementations selected by `RECRUITMENT_EMAIL_PROVIDER`. In DEVELOPMENT: if `RECRUITMENT_EMAIL_SEND_ENABLED !== 'true'` → `SIMULATED` (logged, not sent); if enabled with a `RECRUITMENT_EMAIL_TEST_RECIPIENT` → recorded as a redirect to the test address; otherwise mocked. **Every attempt is persisted** with subject/body snapshots, provider, message id, status, initiator and actor.
- **Application-received email** is the automatic `APPLICATION_RECEIVED` message triggered on submission. **There is no status-link email** — status tokens were deliberately removed (§14.1).

---

## 15. Attendance

**Key files:** `pages/Attendance/DailyMonitoringPage.tsx` (782 ln) · `AttendanceTallyPage.tsx` (644 ln) · `components/ui/CalendarGrid.tsx` · `routes/attendance.routes.ts` · `controllers/attendance.controller.ts` · `services/attendance.service.ts` (879 ln) · `services/schedule.service.ts` (`resolveScheduleForDate`) · models `AttendanceRecord`, `AttendanceLog`, `OrganizationCalendarEntry`, weekly-schedule models.

### 15.1 The real-world workflow — **Constraint 6 verified as documented intent**
```
Biometric device  →  Mustard Seedtime  →  HR exports Excel  →  [ import into HRISense ]  →  AttendanceRecord
                                                                        ▲
                                                              NOT IMPLEMENTED
```
The chain is stated in `docs/TIME_ATTENDANCE_LEAVE_IMPLEMENTATION.md` and mirrored in the in-app modal copy. Everything to the left of the bracket happens outside HRISense; the bracketed step does not exist yet.

### 15.2 Attendance import — **PLACEHOLDER; Constraints 6 & 7 verified**
- **UI present.** `/attendance/daily` has an HR-visible **"Import Attendance Excel"** button opening a modal titled *"Import Attendance Excel — Mustard Seedtime attendance data import"*.
- **Processing disabled.** The modal shows a warning banner (*"Awaiting Official Excel Format … The official Hospicio de San Jose attendance export from Mustard Seedtime has not yet been received. Once the sample file is provided, the column mapping and import parser will be finalized."*), a list of what the finished import will do, a file picker labelled **"(preview only)"** accepting `.xlsx/.xls/.csv`, the footer note *"Import mapping pending official Mustard Seedtime sample."*, and a permanently `disabled` **Process Import** button with the tooltip *"Processing unavailable — official Mustard Seedtime Excel format not yet configured"*.
- **Backend: none.** There is no import route, no parser, no `AttendanceImport` model, no staging table. `exceljs` is used only for **export**. The selected `File` lives in React state and is discarded on close.
- **No invented columns or punch-pairing.** No Excel column names and no punch-pairing logic exist anywhere in the source. **Constraint 7 verified — the official format is still pending.**
- **Where records actually come from today:** `prisma.attendanceRecord.upsert` appears **only in `prisma/seed.ts`**. In a non-seeded database the attendance module has no data.
- **Documentation contradiction:** the progress log states the placeholder component was *deleted*. The modal is present in `DailyMonitoringPage.tsx` (inline, not a separate component file) — see §42 C-04.

### 15.3 Attendance status semantics — **Constraint 8 verified in the attendance module**
| Value | Kind | How produced |
|---|---|---|
| `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE` | **Stored fact** | `AttendanceRecord.status`, from imported/seeded data. **Never derived.** |
| `HOLIDAY` | **Derived (organization context)** | An `APPROVED` `OrganizationCalendarEntry` of type `HOLIDAY`, `SPECIAL_NON_WORKING`, or `ORGANIZATION_NON_WORKING` on that date. Also a legal enum value on `AttendanceRecord`. |
| `SUSPENDED` | **Derived (organization context)** | An `APPROVED` calendar entry of type `SUSPENSION`. |
| `REST_DAY` / Day Off | **Derived (schedule context)** | `effectiveEmployeeSchedule.isWorkingDay === false` **and** `type !== 'UNCONFIGURED'`. |
| **`NO_RECORD`** | **Runtime-only marker — not a Prisma enum value** | Emitted by `AttendanceService.list` for a virtualised employee × date pair with no `AttendanceRecord`. Displayed as **"No Imported Rec."** |
| `UNCONFIGURED` | **Derived (schedule context)** | No `ScheduleTemplateDay` / weekly-schedule day exists → the system explicitly declines to guess. |

**Manual adjustment:** `PUT /attendance/:id` (`FULL` only) can change `timeIn`, `timeOut`, `status`, `overtimeHours`, `remarks`. **No frontend calls it** → BACKEND-ONLY.

### 15.4 The "no record ≠ absent" rule — **Constraint 8 verified, with one dashboard exception**
`AttendanceService.getTally` carries the rule in its own doc comment: *"NO automatic Absent inference. noImportedRecord ≠ Absent."* Concretely:
- `list()` emits `status: 'NO_RECORD'`, never `ABSENT`, for missing days.
- `getTally()` computes `noImportedRecord = totalCalendarDays − (distinct dates that have at least one record)`, deliberately using **distinct dates** so duplicate import rows cannot shrink the figure.
- `AttendanceTallyPage` renders `Absent` and `No Record` as **separate columns** and prints the explanation *"**No Imported Record** means no attendance data was received from the attendance system for that date."*
- `DailyMonitoringPage` labels the state **"No Imported Rec."**

**⚠ One violation — `DashboardService.getHRStats`:**
```ts
absentToday: totalEmployees - presentToday - onLeaveToday
```
This is exactly the inference the rest of the system refuses to make: every employee without a `PRESENT` record today (rest day, holiday, unimported, night shift, newly hired) is counted as **Absent** on the HR Dashboard. Recorded as §42 C-02 / §43 R-10.

### 15.5 Daily Monitoring — `/attendance/daily` — **IMPLEMENTED**
- **Calendar grid** (`CalendarGrid.tsx`) over `GET /attendance/calendar` (max 186 days) — per-day aggregate counts plus injected `organizationEvents` from the calendar.
- **Summary cards** — Present, Late, Absent, On Leave always; Half Day, Holiday, Rest Day, Suspended shown only when their count > 0.
- **Filters** — HR: Unit → Department → Employee → Status (cascading). Supervisor: **My Attendance** and **Team Attendance** tabs. Employee: **My Attendance** only.
- **Day details drawer** — `GET /attendance` for the selected date, returning per-employee rows with `attendanceFact` (status, `timeIn`, `timeOut`, `overtimeHours`, `remarks`, logs), `organizationContext`, `scheduleAssignment`, `templateDay`, and `effectiveEmployeeSchedule`.
- **Scope enforcement** — `AttendanceService.resolveScope`: `STANDARD` may only request `self`; `SUPERVISOR` may request `self` or `team`; `FULL` may request `self`, `team`, or `all`. Anything else is a 403. Team membership resolves through `SupervisionLink` (§8.4 caveat).
- **Virtualisation** — `list()` expands employees × dates in memory, capped at **31 days** per request; filters for `status`, `scheduleTemplateId` and `recordAvailability (with_record | no_record)` are applied after expansion.

### 15.6 Attendance Tally — `/attendance/tally` — **IMPLEMENTED**
Date presets plus a custom range (max 186 days); filters for unit, department, employee and free-text search. Columns: **Present · Late · Absent · On Leave · Half Day · Imported (with distinct-day sub-count) · No Record**, alongside employee number, name, unit and job role. A per-employee drilldown drawer breaks the numbers down. Export: client-side **CSV**, plus server-generated **Excel** (`POST /attendance/export/excel`, two sheets: Attendance Summary + details) and **PDF** (`POST /attendance/export/pdf`). **No payroll figures anywhere** — no rates, deductions, pay, or monetary values.
**Known break:** the Department filter calls `GET /employees/departments?unitId=` which is not a registered route (§10.2) — the dropdown stays empty.

### 15.7 Attendance logs — **BACKEND-ONLY**
`GET /attendance/logs` (FULL, SUPERVISOR) reads `AttendanceLog` with employee scoping. **Nothing writes `AttendanceLog`**, and the only consumer is `DashboardService`'s supervisor `teamLogs` widget. The tardiness-acknowledgement permissions (`attendance_log.update.SUBORDINATES`) exist in the permission registry but no endpoint implements acknowledgement.

---

## 16. Shift Catalog

**Key files:** `pages/Attendance/components/ShiftCatalogTab.tsx` · `routes/weekly-schedule.routes.ts` · `controllers/weekly-schedule.controller.ts` · `services/weekly-schedule.service.ts` · model `ShiftDefinition`.

| Aspect | Behaviour |
|---|---|
| Where | A tab inside `/attendance/schedule` (Work Schedule page) |
| Fields | `name`, `description`, **`category ∈ {OFFICE, SHIFT}`**, `startTime`, `endTime` (both stored as `"HH:mm:ss"` strings), `isActive`, `version`, `isArchived` |
| List | `GET /weekly-schedules/shifts` → active, non-archived, ordered by category then name |
| Create | `POST /weekly-schedules/shifts` — rejects a duplicate `name`; `FULL` only (checked in the controller) |
| **Edit — versioned** | `PUT /weekly-schedules/shifts/:id`: if the shift has **never been used** (`_count.weeklyShifts === 0`) it is mutated in place; otherwise a **new row at `version + 1`** is created and the old row is archived (`isArchived: true, isActive: false`). Historical schedules keep pointing at the exact shift definition they were built with. |
| Deactivate | `DELETE /weekly-schedules/shifts/:id` → `isActive: false` (soft) |
| Relationship to Work Schedule | `EmployeeWeeklyScheduleShift.shiftId` → `ShiftDefinition`; a schedule day can hold **multiple ordered shifts** via `sequence` |
| Role access | View: any authenticated user. Create/edit/deactivate: **`FULL` only** |

**Status: IMPLEMENTED.** No shift times are hardcoded — the catalog is entirely HR-defined, consistent with the unresolved-policy note (§19/§44).

---

## 17. Work Schedule

**Key files:** `pages/Attendance/WorkSchedulePage.tsx` + `components/{EmployeeSchedulesTab, ScheduleCoverageTab, ScheduleHistoryTab, ShiftCatalogTab}.tsx` · `pages/Employees/components/EmployeeScheduleProfileTab.tsx` · `services/api/{schedule,weekly-schedule}.ts` · `routes/{schedule,weekly-schedule}.routes.ts` · `services/{schedule,weekly-schedule}.service.ts` · `policies/scheduling.policy.ts` · `utils/schedule-validator.util.ts`.

### 17.1 Two coexisting scheduling models
| Track | Models | Role today |
|---|---|---|
| **Weekly Schedule (current)** | `EmployeeWeeklySchedule` → `Day` → `Shift` → `ShiftDefinition` | The "Hospicio official schedule architecture"; what HR edits |
| **Schedule Templates (legacy but live)** | `ScheduleTemplate` → `ScheduleTemplateDay`; `EmployeeScheduleAssignment` | Still created, assigned, revised, and read by `resolveScheduleForDate`; the `scheduleTemplateId` field on the onboarding form targets this track |

Both remain wired. `AttendanceService` consumes `ScheduleService.resolveScheduleForDate`, which composes organization calendar + assignment + template day + effective schedule.

### 17.2 Weekly scheduling behaviour
- **Effective dating** — `EmployeeWeeklySchedule` has `effectiveFrom` / `effectiveTo`; saving a new schedule closes the previous one in a transaction to keep a **contiguous half-open timeline** (per the service comment).
- **Three-state day** — `DayConfigurationStatus = UNCONFIGURED | DAY_OFF | WORKING`. **`UNCONFIGURED` is preserved as a real state** — the system never assumes a day off, matching the corrective migration `20260809091948_correct_legacy_schedule_assumptions`, which deleted fabricated Monday–Friday rows.
- **Multiple shifts per day** — supported via `EmployeeWeeklyScheduleShift.sequence`.
- **Validation** — `utils/schedule-validator.util.ts`.
- **Endpoints** — `GET /weekly-schedules/employees/:employeeId?applicableDate=` and `POST /weekly-schedules/employees/:employeeId`.

### 17.3 Template track behaviour
`POST /schedules/templates` (create), `PUT /schedules/templates/:id` (**revise with a required `effectiveDate`**, preserving history), `GET /schedules/templates` (with assignment counts), `GET /schedules/employees`, `GET /schedules/coverage`, `POST /schedules/assignments` (bulk assign with a `bulkBatchId`), `GET /schedules/history`.
A `ScheduleTemplateDay` row exists **only** for `WORKING` or `DAY_OFF`; its absence *is* `UNCONFIGURED`.

### 17.4 Role access
| Action | HR (`FULL`) | Supervisor | Employee |
|---|---|---|---|
| View own schedule | ✅ | ✅ | ✅ |
| View others' schedules | ✅ all | ✅ (see caveat) | ❌ |
| Assign schedule (template track) | ✅ | ✅ **active direct subordinates only** — enforced in `schedule.controller` via `SupervisionLink` | ❌ |
| Create/revise/archive templates | ✅ | ❌ (`SchedulingPolicy`) | ❌ |
| Manage Shift Catalog | ✅ | ❌ | ❌ |
| Save weekly schedule | ✅ | ⚠ **any employee** — see below | ❌ (403) |

**⚠ Access-control gap.** `WeeklyScheduleController.saveEmployeeWeeklySchedule` blocks only `STANDARD`; the source carries the comment *"Supervisor logic would typically check if the employeeId is their subordinate. Assuming the user is either FULL or SUPERVISOR, we proceed."* **Any supervisor can therefore write any employee's weekly schedule**, and `getEmployeeWeeklySchedule` likewise lets any supervisor read any employee's schedule. The template track does enforce the subordinate check; the weekly track does not. Recorded as §35 / §43 R-11.

### 17.5 Schedule history
`ScheduleHistoryLog` records `action`, `previousValue`/`newValue` JSON, `remarks`, actor user, optional target employee and `bulkBatchId`, surfaced by the **History** tab and by `GET /schedules/history`. **Status: IMPLEMENTED.**

### 17.6 Removed by decision
`ARCHITECTURAL CHANGE (AUGUST 2026)` in the progress log records that **Employee Schedule Overrides (custom hours / one-day overrides) were permanently removed from scope**; migration `20260809200155_remove_schedule_overrides` dropped the table. No override code remains.

---

## 18. Holiday Calendar

**Key files:** `pages/Attendance/HolidayCalendarPage.tsx` (347 ln) · `routes/holiday.routes.ts` · `controllers/holiday.controller.ts` · `services/holiday.service.ts` (185 ln) · model `OrganizationCalendarEntry`.

| Aspect | Behaviour |
|---|---|
| Types | `OrganizationCalendarType = HOLIDAY · SPECIAL_NON_WORKING · ORGANIZATION_NON_WORKING · SUSPENSION` |
| Sources | `OrganizationCalendarSource = HOLIDAY_API · MANUAL` |
| Status | `OrganizationCalendarStatus = PENDING · APPROVED · IGNORED` |
| External suggestions | `POST /holidays/suggestions/fetch` pulls from the **Nager.Date** API and stores entries as **`PENDING`** (never auto-approved). Switched from HolidayAPI to Nager.Date to allow free future-year queries. |
| Approve / ignore | `PATCH /holidays/suggestions/:id/status` |
| Manual entries | `POST /holidays/manual` — saved directly as `APPROVED`. `PATCH /holidays/manual/:id` edits. **`DELETE /holidays/manual/:id` is mapped to the same update handler** (an acknowledged in-code shortcut, with a comment) — deletion is really a status change, not a row delete. |
| List | `GET /holidays?year=&status=&source=` |
| Uniqueness | `@@unique([date, name])` |
| Audit | Every mutation writes a `ScheduleHistoryLog` with the authenticated `actorUserId` |
| Role access | **View: all tiers.** Mutations: `SchedulingPolicy.canManageOrganizationCalendar` → HR role codes/titles or `FULL` tier. Only they see *Load API Suggestions*, *Add Calendar Entry*, *Approve*, *Ignore*. |

### Relationship to attendance — real, and implemented
`AttendanceService.getCalendar` merges `APPROVED` calendar entries into the day aggregates (adding `organizationEvents`, incrementing the `HOLIDAY` or `SUSPENDED` counters), and `ScheduleService.resolveScheduleForDate` returns the entry as `organizationContext` for the day-details drawer and the `HOLIDAY` / `SUSPENDED` filters. **It does not create or mutate `AttendanceRecord` rows** — the calendar is contextual, not generative. **Status: IMPLEMENTED.**

---

## 19. Leave Management

**Key files:** `pages/Leave/{LeaveRequestsPage, NewLeaveRequestPage, LeaveCalendarPage, LeavePage(legacy)}.tsx` + `components/EmployeeSelectionPanel.tsx` · `services/api/leave.ts` · `routes/leave.routes.ts` · `controllers/leave.controller.ts` · `services/leave.service.ts` (617 ln) · models `LeaveRequest`, `LeaveBalance`.

### 19.1 Leave types & balances
`LeaveType` (11): `SICK · VACATION · EMERGENCY · MATERNITY · PATERNITY · SOLO_PARENT · STUDY · REHABILITATION · SPECIAL_PRIVILEGE · BEREAVEMENT · FORCED`.
`LeaveBalance` is keyed `@@unique([employeeId, year, leaveType])` with `totalAllotted`, `used`, `pending`, `forfeited`. `GET /leave/balances` returns the current year; a non-`FULL` user requesting someone else's balances gets 403.
**There is no balance-management UI or endpoint** — no way to set `totalAllotted`, grant credits, or forfeit. Balances only exist if seeded or auto-created (see §19.5).

### 19.2 Filing a request — **IMPLEMENTED**
`POST /leave` is **always for the authenticated employee**. It validates `start ≤ end`, computes `totalDays` as **inclusive calendar days**, and rejects overlaps against existing `PENDING`/`APPROVED` requests (409). Status starts at `PENDING`.
The service carries an explicit policy note: *"Hospicio-specific chargeable leave-day rules (weekends, holidays, rest days) have NOT been confirmed. Using plain calendar-day count only. Do NOT apply Mon-Sat, holiday, or rest-day exclusions without Hospicio policy confirmation."* — an accurate, honest statement of a deferred rule.
`NewLeaveRequestPage` collects type, start/end date, duration preview, reason, and an optional supporting document URL, and accepts `?startDate=&endDate=` prefill from the leave calendar.

### 19.3 Filing on behalf — **IMPLEMENTED**
`POST /leave/batch` with `targetMode: 'self' | 'employees' | 'all'`:
- `all` → **`FULL` only**;
- `employees` → `FULL` (any active employee) or `SUPERVISOR` (**active direct subordinates only**, resolved through `SupervisionLink`);
- `STANDARD` → `self` only.
Per-employee authorization and overlap checks; each success writes a `LEAVE_REQUEST_CREATED_ON_BEHALF` audit row carrying a shared `batchReference`. Returns `{created, failed, summary}` with HTTP **201 / 207 / 400** for full / partial / total failure. UI: `EmployeeSelectionPanel.tsx`.

### 19.4 ⚠ The approval flow — **single-step, HR-only**
```
Employee (or Supervisor/HR on behalf)
        │  POST /leave  |  POST /leave/batch
        ▼
    PENDING ──────────────────────────────────────────────┐
        │                                                 │
        │ PATCH /leave/:id/approve   authorize(['FULL'])   │ PATCH /leave/:id/cancel
        │ PATCH /leave/:id/reject    authorize(['FULL'])   │   (own request, PENDING only)
        ▼                                                 ▼
   APPROVED / REJECTED                                CANCELLED
```
**There is no supervisor endorsement or review step.** Both `/approve` and `/reject` are guarded by `authorize(['FULL'])`, and the UI matches: `LeaveRequestsPage` sets `canApprove={isFull && !isTeamReadOnly && …}`, and a supervisor's **Team** tab is explicitly `isTeamReadOnly`. `LeaveStatus.FOR_REVIEW` exists in the enum but is **never set or read**.
This contradicts several documents that describe supervisor endorsement (§42 C-03). Reported, not changed.

### 19.5 State transitions and side effects
| Action | Guard | Effects |
|---|---|---|
| **Approve** | `FULL`; request must be `PENDING` | `status=APPROVED`, `approvedById`, `approvedAt`, optional `hrNotes`; **upserts `LeaveBalance`**: `used += totalDays`, `pending -= totalDays` |
| **Reject** | `FULL`; must be `PENDING`; **`rejectionReason` required** | `status=REJECTED`, `rejectionReason` stored and shown in the UI |
| **Cancel** | The **owner only**, and only while `PENDING` | `status=CANCELLED`. **HR cannot cancel someone else's request.** |

**Two defects (§43 R-12, R-13):**
1. **`pending` is never incremented on filing**, but approval decrements it — so `LeaveBalance.pending` drifts negative for every approval.
2. The `create` branch of the approval upsert hardcodes **`totalAllotted: 15`** with the comment *"default; HR can adjust"*. When no balance row exists, approving a leave silently invents a 15-day entitlement. This is exactly the kind of policy the project says must not be invented, and there is no UI to correct it.

### 19.6 Leave Calendar — **IMPLEMENTED**
`GET /leave/calendar?start&end&scope&unitId&departmentId&employeeId&status&leaveType`, tier-scoped like attendance. Supports range selection that navigates to `/leave/new?startDate=&endDate=`.

### 19.7 Leave ≠ Day Off — **Constraint 9 verified**
The two concepts are structurally separate and never conflated:
| Leave | Day Off / Rest Day |
|---|---|
| Model: `LeaveRequest` + `LeaveBalance` | Model: `EmployeeWeeklyScheduleDay.status = DAY_OFF` (or an absent/`isWorking:false` `ScheduleTemplateDay`) |
| A requested, approved, balance-consuming absence from a scheduled working day | A structural non-working day in the employee's recurring schedule |
| Surfaces as `AttendanceStatus.ON_LEAVE` (a stored fact) | Surfaces as the derived `REST_DAY` filter via `effectiveEmployeeSchedule.isWorkingDay === false` |
| Module: Leave Management (`/leave/*`) | Module: Work Schedule (`/attendance/schedule`) |
No code path converts one into the other, and no leave logic reads schedule day-off state (which is also why §19.2's calendar-day counting is flagged as an open policy question rather than a bug).

### 19.8 Legacy `/leave`
`LeavePage.tsx` is a pre-integration mock with five hardcoded requests for fabricated employees ("Ana Cruz — Pharmacy", "Marco Villanueva — Nursing", …) and hardcoded stat tiles (5 / 23 / 4 / 18). It is **not linked from the sidebar** but **is still routed** and reachable at `/leave`. See §40.

---

## 20. Evaluations

**Key files:** `pages/Evaluations/EvaluationsPage.tsx` (1,512 ln) + `components/{EvaluationTemplateModal, EvaluationCycleModal, EvaluationFormModal}.tsx` · `pages/Employees/components/EmployeeEvaluationProfileTab.tsx` · `services/evaluation.service.ts` (frontend) · `routes/evaluation.routes.ts` · `controllers/evaluation.controller.ts` · `services/evaluation.service.ts` (1,164 ln) · models `EvaluationTemplate`, `EvaluationCriterion`, `EvaluationCycle`, `EvaluationCycleScope`, `EvaluationAssignment`, `EvaluationResponse`.

### 20.1 Templates — **IMPLEMENTED** (`FULL` only)
`EvaluationTemplate`: name, description, **`ratingMethod`** (`NUMERIC` / `LABELED`; the UI additionally offers 5-point, 4-point satisfaction, and descriptive presets), `minScore`/`maxScore`, `scoreLabels` JSON, `useWeighting`, `isActive`.
`EvaluationCriterion`: name, description, `displayOrder`, `isRatingRequired`, `isCommentRequired`, `weight`, `isActive`. The builder supports add / remove / reorder and a total-weight counter.
Endpoints: `GET|POST /evaluations/templates`, `GET|PUT /evaluations/templates/:id`, `POST /evaluations/templates/:id/deactivate` (safe deactivate, not delete).

### 20.2 Cycles (evaluation periods) — **IMPLEMENTED** (`FULL` only)
`EvaluationCycle`: name, description, `templateId`, `startDate`, `dueDate` (validated `dueDate ≥ startDate`), `status ∈ {ACTIVE, CLOSED, ARCHIVED}`, `evaluatorAssignmentMethod`, `defaultEvaluatorId`.
**Scoping** — `EvaluationCycleScope` with `ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE`, resolved and de-duplicated by `resolveTargetEmployees`, with a live estimated-target count in the modal.
**Evaluator assignment methods (3):**
| Method | Behaviour |
|---|---|
| `SUPERVISOR` | Looks up **`SupervisionLink`** rows to map each subject to their supervisor (⚠ §8.4 — this is the seed-only table) |
| `ONE_EVALUATOR` | One designated evaluator for the whole cycle |
| `MANUAL` | Explicit assignment, with a fallback evaluator |
`POST /evaluations/cycles` resolves employees, snapshots the template into each assignment, and generates all assignments in **one transaction**. `POST /evaluations/cycles/:id/close` closes a cycle without mutating completed work.

### 20.3 Assignments, responses and the workflow — **IMPLEMENTED**
`EvaluationAssignment` is `@@unique([cycleId, employeeId])` and stores a **`templateSnapshot`** so historical evaluations render exactly as they were authored, plus `dueDate`, `status`, timestamps, `overallScore`, `overallRating`, `evaluatorSummary`, `developmentRecommendations`, and **`isEmployeeVisible`**.

```
NOT_STARTED ──POST /assignments/:id/draft──▶ IN_PROGRESS ──POST /assignments/:id/submit──▶ SUBMITTED
                                                                                             │
                                                     POST /assignments/:id/finalize  (FULL)  ▼
                                                                                         FINALIZED
```
- **Draft** — partial ratings and comments persist at any time.
- **Submit** — client-side and server-side validation of required ratings/comments; the assignment locks to `SUBMITTED` ("Awaiting Finalization").
- **Finalize** — **`FULL` only**. The finalize dialog carries an explicit **"Employee Access"** checkbox that defaults to **`false`** (conservative): `isEmployeeVisible` is not force-set to true.
- `EvaluationResponse` stores per-criterion `ratingNumeric` / `ratingLabel` / `comment`, plus a snapshot of the criterion name, description and weight.

### 20.4 Visibility by role
| Role | Sees |
|---|---|
| **`FULL`** | Everything: all templates, cycles, assignments; reviews and finalizes; sees an employee-visibility badge in the profile history |
| **`SUPERVISOR`** | Only assignments **where they are the evaluator** (`where.evaluatorId = own employeeId`); no templates or cycles |
| **`STANDARD`** | Only their own assignments that are **`FINALIZED` *and* `isEmployeeVisible = true`** — a genuine double gate |

### 20.5 Employee profile history
`GET /evaluations/employees/:employeeId/history` powers `EmployeeEvaluationProfileTab`, which reuses `EvaluationFormModal` with `readOnlyForce={true}` so no mutation controls appear from the profile.

### 20.6 Legacy
`PerformanceEvaluation` (the older single-table model with `dimensionScores` JSON) is still in the schema and still related to `Employee`, but **no current service reads or writes it**. `/performance` redirects to `/evaluations`; `PerformancePage.tsx` is unreachable dead code containing three fabricated period cards.

---

## 21. Training & Seminars

**Key files:** `pages/Training/TrainingPage.tsx` (431 ln) + `components/{TrainingActivityModal, TrainingDetailModal}.tsx` · `pages/Employees/components/EmployeeTrainingProfileTab.tsx` · `services/training.service.ts` (frontend) · `routes/training.routes.ts` · `controllers/training.controller.ts` · `services/training.service.ts` (911 ln) · models `TrainingActivity`, `TrainingParticipant`, `TrainingActivityDocument`, `EmployeeComplianceRecord`.

### 21.1 Activities — **IMPLEMENTED** (`FULL` manages)
`TrainingActivity`: title, **`type ∈ {TRAINING, SEMINAR, WORKSHOP, ORIENTATION, CONFERENCE, OTHER}`**, description, provider, venue, `startDate`/`startTime`/`endDate`/`endTime` (chronologically validated), `hoursCredit`, `maxParticipants`, **`status ∈ {DRAFT, SCHEDULED, COMPLETED, CANCELLED}`**, optional `complianceRequirementId`, `materialsUrl`, `deletedAt`.
Workspace metrics: Total Activities · Scheduled/Upcoming · Completed · Total Enrolled. Search by title/facilitator/venue; filter by type and status. Endpoints: `GET /training`, `GET /training/:id`, `POST /training`, `PUT /training/:id`, `POST /training/:id/cancel` (preserves completion history).

### 21.2 Participant rosters — **IMPLEMENTED**
Targeting on creation: **All Active Employees · Unit · Department · Job Role · Specific Staff** (searchable multi-select), resolved and de-duplicated (`@@unique([trainingActivityId, employeeId])`) and validated against `maxParticipants`.
`POST /training/:id/participants` adds more later without creating duplicates.
Outcomes: **`TrainingParticipationStatus = ASSIGNED · COMPLETED · DID_NOT_ATTEND · EXCUSED · CANCELLED`**, set individually (`PUT /training/:id/participants/:employeeId`) or in bulk (`POST /training/:id/participants/bulk-status`) with a date and notes. The detail modal offers multi-select, search, status filter, and a floating bulk toolbar.

### 21.3 Certificates & documents — **IMPLEMENTED**
- **Participant certificate** — `POST /training/:id/participants/:employeeId/certificate` (multer) stores `certificateOriginalFilename`, `certificateStoredFilename` (unique), `certificateMimeType`, `certificateSizeBytes` **on the participant row**. `GET .../certificate` streams it through an authenticated route (available to the owning employee and HR).
- **Activity documents** — `POST /training/:id/documents` (FULL) and `GET /training/:id/documents/:documentId` (FULL) via `TrainingActivityDocument`.
Files live under `uploads/training` and are never served statically.

### 21.4 Compliance auto-fulfilment — **IMPLEMENTED**
When a participant is marked `COMPLETED` **and** the activity is linked to a `ComplianceRequirement`, `TrainingService.updateParticipantStatus` creates one `EmployeeComplianceRecord` with `recordTitle` = the activity title, `referenceNumber = "TRN-<first 8 of activity id, uppercased>"`, `reviewStatus = ACCEPTED`, a note explaining the provenance, and `expiresAt` **only if HR supplied a `validUntil`** — the code comments *"Expiry calculation handled manually per requirement, no auto validityMonths"*. The new record's id is written back to `TrainingParticipant.complianceRecordId`, and the guard `if (!complianceRecordId)` prevents duplicates. **No training expiration period is invented.**

### 21.5 Expiry
`TrainingParticipant.validUntil` is optional and **entered by HR**; nothing computes it. Consistent with the no-invented-policy rule.

### 21.6 Role access & employee history
Reads are authenticated; every mutation is `authorize(['FULL'])`. `TrainingPage` shows management buttons only to `FULL`. `GET /training/employees/:employeeId/history` powers `EmployeeTrainingProfileTab` (schedule, provider, status, completed date, compliance-fulfilment badge), visible to HR and to the employee themself.

### 21.7 Legacy
`Training` / `TrainingAttendee` / `ActivityAttendance` remain in the schema. `DashboardService` still queries **`TrainingAttendee`** for "upcoming trainings", so the dashboard training widget is fed by the **legacy** table and will be empty for anything created in the current module (§43 R-14).

---

## 22. Compliance Monitoring

**Key files:** `pages/Compliance/CompliancePage.tsx` (1,863 ln) · `pages/Employees/components/EmployeeComplianceProfileTab.tsx` · `services/compliance.service.ts` (frontend) · `routes/compliance.routes.ts` · `controllers/compliance.controller.ts` · `services/compliance.service.ts` (739 ln) · models `ComplianceRequirement`, `ComplianceRequirementScope`, `EmployeeComplianceRecord`, `EmployeeComplianceDocument`, `MedicalRecord`, `PsychologicalRecord`.

### 22.1 What counts as compliance
An HR-authored **`ComplianceRequirement`** with `category ∈ {MEDICAL, PSYCHOLOGICAL, CERTIFICATION, TRAINING, DOCUMENT, OTHER}`, `tracksExpiry`, an optional `reminderDays` window, and `lifecycle ∈ {ACTIVE, INACTIVE}`. Nothing is hardcoded — annual physicals, PRC licences, BLS certificates and so on are all just rows HR creates.

### 22.2 Applicability — dynamic, never denormalised
`ComplianceRequirementScope` rows target `ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE`. `ComplianceService._isApplicable(scopes, employee)` evaluates them **at query time against the employee's current organizational data**, so a transfer automatically changes what applies. Scopes are added (`POST /compliance/requirements/:id/scopes`) and removed (`DELETE /compliance/scopes/:scopeId`) individually.

### 22.3 Derived status — the "Compliance Decision" of the system title
`getEmployeeComplianceSummary(employeeId)` loads every `ACTIVE`, non-deleted requirement with that employee's records, filters by applicability, picks the **latest** fulfilling record (medical → `MedicalRecord.examDate`; psychological → `PsychologicalRecord.assessmentDate`; everything else → `EmployeeComplianceRecord.completedAt`), then decides:
```
no record                                              → MISSING
reviewStatus ∈ {PENDING_REVIEW, NEEDS_CORRECTION}      → NEEDS_REVIEW
expiresAt < now                                        → EXPIRED
expiresAt ≤ now + reminderDays days                    → EXPIRING_SOON
otherwise                                              → VALID
```
Returns the requirement, the status, `latestRecordDate`, `expiresAt`, and `recordId`.
**All five statuses are computed on read — nothing is stored, and no expiry period is invented.** `expiresAt` is always HR-entered from the source document; `EXPIRING_SOON` is only possible when HR configured `reminderDays`.

### 22.4 Organization views
- `GET /compliance/summary` — org-wide rollup across all active employees.
- `GET /compliance/needs-attention` — the `MISSING` / `EXPIRED` / `EXPIRING_SOON` / `NEEDS_REVIEW` queue.
- `GET /compliance/employees-list` — per-employee compliance standing.
- `GET /compliance/employees/:employeeId/summary` — the per-employee matrix (also used by the profile tab).

### 22.5 Records & review
`EmployeeComplianceRecord` (for `CERTIFICATION` / `TRAINING` / `DOCUMENT` / `OTHER`): `recordTitle`, `referenceNumber`, `completedAt`, `expiresAt`, `notes`, and a review workflow `PENDING_REVIEW → ACCEPTED | NEEDS_CORRECTION` (`PATCH /compliance/records/:recordId/review`, HR only, with a `reviewReason`). `EmployeeComplianceDocument` attachments carry `visibility ∈ {VISIBLE, HR_ONLY}` and are streamed only through authenticated routes. Soft delete via `deletedAt`.

### 22.6 "Alerts"
There are **no notifications, emails, or scheduled reminders**. "Alerts" means the derived `EXPIRING_SOON` / `EXPIRED` statuses and the Needs-Attention list, surfaced when a user opens the page. Nothing is pushed. The landing page's *"expiration alerts"* claim overstates this (§42 C-05).

### 22.7 Cross-module relationships (all real)
- **Medical / Psychological → Compliance** — `MedicalRecord.requirementId` / `PsychologicalRecord.requirementId` let a health record satisfy a `MEDICAL`/`PSYCHOLOGICAL` requirement directly.
- **Training → Compliance** — §21.4 auto-fulfilment.
- **Employee → Compliance** — applicability is derived from unit/department/job role.

### 22.8 Role access
Requirement CRUD, scopes, org summaries, record creation, review and delete are all `authorize(['FULL'])`. `GET /compliance/employees/:employeeId/summary` and `/records` are authenticated and scoped inside the service (self, subordinate via `SupervisionLink`, or HR). **Status: IMPLEMENTED.**

---

## 23. Medical Records

**Key files:** `pages/Medical/MedicalPage.tsx` (1,879 ln) · `pages/Employees/components/EmployeeMedicalProfileTab.tsx` · `services/medical.service.ts` (frontend) · `routes/medical.routes.ts` · `controllers/medical.controller.ts` · `services/medical.service.ts` (470 ln) · models `MedicalRecord`, `MedicalRecordDocument`.

| Aspect | Detail |
|---|---|
| Record | `examType` (`PRE_EMPLOYMENT` / `ANNUAL` / `OCCUPATIONAL` / `SPECIAL` per the schema comment — stored as a free string), `examDate`, `examinedBy` (physician/clinic name), optional `requirementId`, HR-entered `expiresAt`, `hrNotes`, review fields, `createdById`, `deletedAt` |
| Result / status | Two distinct axes: the **administrative review status** `RecordReviewStatus = PENDING_REVIEW → ACCEPTED \| NEEDS_CORRECTION`, and the **derived compliance status** from §22.3. There is no clinical "fit / unfit" verdict field. |
| Documents | `MedicalRecordDocument` — `originalFilename`, unique `storedFilename`, `mimeType`, `sizeBytes`, `notes`, `uploadedById`. Stored in `uploads/medical`, streamed via `GET /medical/documents/:documentId/stream` |
| Expiry | **HR-entered only.** No default validity period is computed anywhere. |
| Endpoints | `GET /medical/records` (FULL) · `GET /medical/summary` (FULL) · `POST /medical/records` (FULL) · `GET /medical/employees/:employeeId/records` (scoped) · `POST /medical/employees/:employeeId/records` (FULL) · `GET /medical/records/:recordId` (scoped) · `PATCH /medical/records/:recordId` (FULL) · `PATCH .../review` (FULL) · `DELETE .../:recordId` (FULL) · `POST /medical/records/:recordId/documents` (FULL, multer) · `GET /medical/documents/:documentId/stream` (scoped) · `DELETE /medical/documents/:documentId` (FULL) |
| **HR access** | Full: create, edit, review, delete, upload/stream/delete documents, org summary metrics |
| **Supervisor access** | **None.** The Medical tab is hidden unless `isFullHR || isSelf`, and the org-level routes are `FULL`-only. |
| **Employee access** | Own records only. `hrNotes` is **never** returned to an employee view — enforced in `MedicalService`, and documented in the schema comment. |

**Privacy design:** medical data is the strictest-scoped domain in the system — HR or self, with an HR-only notes field, no static file exposure, and no supervisor visibility. **Status: IMPLEMENTED.**

---

## 24. Psychological Records

**Key files:** `pages/Psychological/PsychologicalPage.tsx` (2,129 ln — the largest page) · `pages/Employees/components/EmployeePsychologicalProfileTab.tsx` · `services/psychological.service.ts` (frontend) · `routes/psychological.routes.ts` · `controllers/psychological.controller.ts` · `services/psychological.service.ts` (514 ln) · models `PsychologicalRecord`, `PsychologicalRecordDocument`.

Structurally parallel to Medical, with **one additional privacy mechanism — a two-zone record**:

| Zone | Field | Exposure |
|---|---|---|
| **Employee-visible** | `employeeVisibleSummary` | The only narrative an employee ever sees; HR chooses what to write here |
| **HR-confidential** | `hrConfidentialNotes` | The schema states it is *"NEVER returned to employee or supervisor views"*; enforced in the service |

Documents carry **`PsychologicalDocumentVisibility = EMPLOYEE_VISIBLE | HR_ONLY`**, defaulting to **`HR_ONLY`** (conservative). The schema comment is explicit: *"Employee self-view ONLY returns employeeVisibleSummary and EMPLOYEE_VISIBLE documents."* The upload workflow presents document-visibility choice cards so HR makes the decision consciously.

Other fields: `assessmentType` (`PRE_EMPLOYMENT` / `ANNUAL` / `COUNSELING` / `FOLLOW_UP` / `SPECIAL` per the comment), `assessmentDate`, `conductedBy`, optional `requirementId`, HR-entered `expiresAt`, the same `RecordReviewStatus` workflow, `createdById`, `deletedAt`.

Endpoints mirror Medical exactly (`/psychological/...`). **Supervisor access: none. Employee access: own record, employee-visible zone only. Assessment frequency: not defined anywhere in code — HR decides.** **Status: IMPLEMENTED.**

---

## 25. Announcements

**Key files:** `pages/Announcements/AnnouncementsPage.tsx` (1,059 ln) + 5 modal components · `components/shared/AnnouncementsWidget.tsx` · `hooks/useAnnouncementUnread.ts` · `services/announcement.service.ts` (frontend) · `routes/announcement.routes.ts` · `controllers/announcement.controller.ts` · `services/announcement.service.ts` (1,679 ln — the largest service) · models `Announcement`, `AnnouncementAudienceScope`, `AnnouncementRecipient`, `AnnouncementAttachment`.

### 25.1 Lifecycle — no cron needed
Stored `state ∈ {DRAFT, ACTIVE, ARCHIVED}` combines with `publishAt` and `expiresAt` to yield a **derived status computed at query time**:
```
state=DRAFT                                   → DRAFT
state=ACTIVE  &  publishAt >  now             → SCHEDULED
state=ACTIVE  &  publishAt <= now  &  (no expiresAt | expiresAt > now)  → PUBLISHED
state=ACTIVE  &  expiresAt <= now             → EXPIRED
state=ARCHIVED                                → ARCHIVED
```
The schema comment states this explicitly: *"No cron job required to transition between Draft / Scheduled / Published / Expired."*

### 25.2 Create → publish workflow
`POST /announcements` creates a `DRAFT`. `PUT /announcements/:id` edits it. **Publish (`POST /:id/activate`) validates before acting**: a non-empty title, a non-empty body, **at least one audience scope**, at least one resolved active employee, and `expiresAt > publishAt`. It then runs a transaction that re-checks the derived state (guarding against double-activation, 409), writes the recipient snapshot, sets `state=ACTIVE, publishAt=now`, and writes an `ANNOUNCEMENT_ACTIVATED` audit row with the recipient count.
`POST /:id/schedule` does the same for a future `publishAt` (**recipients are snapshotted at scheduling time**). `POST /:id/archive` removes it from the recipient feed while preserving data. `DELETE /:id` only removes drafts.

### 25.3 Audience targeting and recipient resolution
`AnnouncementAudienceScope` supports `ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE`; multiple scopes are **additive and de-duplicated**. `POST /announcements/audience-preview` (FULL) shows exactly who would receive it before publishing (`AudiencePreviewModal`). Resolution produces one **`AnnouncementRecipient`** row per employee — a genuine snapshot, so later org changes do not retroactively alter who received an announcement. The schema states recipients are **"NEVER created by employee read actions"**; reads only `UPDATE` an existing row.

### 25.4 Attachments — protected
`POST /:id/attachments` (FULL, multer) stores `originalFilename`, a unique random `storedFilename`, `mimeType`, `sizeBytes`, `uploadedByUserId` under `uploads/announcements`. `GET /:id/attachments` lists; `GET /:id/attachments/:attachmentId` **streams after verifying the caller is a recipient or HR**; `DELETE` (FULL) removes the row and the file. Write access is gated by `_assertAttachmentWriteAllowed`. Legacy `fileName` / `fileUrl` columns are retained but unused (the old public-URL pattern is annotated as insecure).

### 25.5 Recipient experience
- `GET /announcements` — the recipient feed (published, non-expired, non-archived, addressed to the caller), pinned first.
- `GET /announcements/:id` — detail.
- `POST /announcements/:id/read` — **read-on-open**: sets `readAt` if null; **never reset by later HR edits**.
- `GET /announcements/unread-count` — drives the sidebar badge.
- `GET /announcements/dashboard` — the dashboard widget feed.
`useAnnouncementUnread` keeps a module-level count with a listener set so the Sidebar, Dashboard and feed all update together, with `decrementUnreadCount()` on open.

### 25.6 HR analytics
`GET /announcements/hr` (filtered workspace list), `GET /announcements/stats` (summary tiles), `GET /:id/recipients` (paged list with read state — `RecipientListModal`), `GET /:id/recipients/stats` (read-rate metrics). All `FULL`.

### 25.7 Role behaviour
| Role | Behaviour |
|---|---|
| **`FULL`** | Full workspace: create, edit, schedule, publish, archive, delete drafts, attachments, audience preview, recipient analytics; **also receives** announcements addressed to them |
| **`SUPERVISOR` / `STANDARD`** | Recipient feed, detail, read-on-open, unread badge, attachment download (recipients only) |

**Status: IMPLEMENTED — the most complete and carefully-built module in the system.**

---

## 26. AI Assistance

### 26.1 Naming — **Constraint 4 verified**
The user-facing name is **"AI Assistance"** at `/ai-assistance`, with the subtitle *"AI-assisted workforce summaries and HR decision support."* The sidebar group is "AI & Analytics" with the item "AI Assistance". The word **"Intelligence" appears nowhere in user-facing text** — the only two occurrences in `apps/web/src` are the identifier `aiIntelligenceLegacyRoute` and its `/ai-intelligence` → `/ai-assistance` back-compat redirect.

### 26.2 What is actually implemented — **NOTHING**
| Layer | Reality |
|---|---|
| Backend route | **None.** `routes/index.ts` registers no AI router; there is no `ai.routes.ts`. |
| Controller / service | **None.** No AI controller or service file exists. |
| LLM client | **None.** `openai@4.67.3` is installed; a repo-wide grep for `openai\|OpenAI` in `apps/api/src` matches only `config/env.ts`. |
| Prompts | **None anywhere in the repository.** |
| Data reads | **None.** No code aggregates attendance, leave, compliance, training or tardiness data for AI purposes. |
| Prisma models | `AIInsight`, `AIRequestLog`, `AIConversation` exist. Only `AIInsight` is **read** (dashboard, `take: 2`/`3`, `.catch(() => [])`). All three are **written only by `prisma/seed.ts`**. |
| Config | `OPENAI_API_KEY` (optional), `OPENAI_MODEL` (default `gpt-4o-mini`), `AI_PROVIDER` (default `openai`) — declared, never consumed. |

### 26.3 What the page shows — **FRONTEND-ONLY (MOCK)**
`AIPage.tsx` (171 lines) renders entirely from two module-level constant arrays:
- A status bar asserting **"AI Engine Active · Last processed 3 minutes ago"** and **"Analyzing 850 employee records across 18 departments"** — both hardcoded strings; HSJ has 7 units, not 18 departments.
- Static metrics **Insights 14 · Confidence 91% · Alerts 3**.
- Four fabricated insights with invented confidence scores: *"High Attrition Risk — Nursing Services"* (mentioning **salary benchmarking and compensation review** — payroll-adjacent, and out of scope), *"Night Shift Understaffing — Nursing"*, *"Compliance Renewal Window Approaching — PRC license renewals for 12 clinical staff"* claiming *"Automated reminder sent"* (no reminder system exists), *"Q2 Performance Summary Available"* with invented departmental scores.
- A "Workforce Health Score" radar of six hardcoded values and a fixed **85.2** overall score.
- **Refresh Insights**, **Ask AI**, and every insight action button have **no `onClick`**; the "Ask the AI" textarea is not wired to anything.

### 26.4 AI safety assessment — **Constraint 10 verified in the only sense available**
The system **does not make HR decisions automatically** — trivially so, because it performs no AI work at all. There is no autonomous action, no auto-approval, no auto-flagging, no scoring of real people. The framing in the landing page ("Support Human Decision-Making — HR reviews the insights. Final decisions always remain with authorized personnel.") is the correct design intent.

**The risk here is the inverse of the usual one:** the page *presents fabricated analysis as live output about real staff*, including an attrition-risk claim about a named service unit. Anyone demonstrating the system could reasonably believe those numbers are real. Recorded as §43 R-15.

### 26.5 Classification
| Capability | Status |
|---|---|
| Attendance anomaly detection | **NOT IMPLEMENTED** (mock card only) |
| Leave pattern analysis | **NOT IMPLEMENTED** |
| Medical / psychological expiry insight | **NOT IMPLEMENTED** as AI — a *non-AI* deterministic equivalent exists in Compliance (§22.3) |
| Training gap analysis | **NOT IMPLEMENTED** |
| Tardiness insight | **NOT IMPLEMENTED** |
| Compliance risk | **NOT IMPLEMENTED** as AI — Needs-Attention is the rule-based equivalent |
| Workforce summaries | **NOT IMPLEMENTED** |
| Natural-language Q&A | **NOT IMPLEMENTED** (inert textarea) |

**Overall: PLANNED / DOCUMENTED ONLY, fronted by a FRONTEND-ONLY MOCK.** This is the single largest gap between the system's official title and its implementation.

---

## 27. Reports

**File:** `pages/Reports/ReportsPage.tsx` — **41 lines**, opening with the comment *"Shared placeholder layout for remaining HRIS modules"*.

| Element | Reality |
|---|---|
| "Monthly Turnover Rate" area chart | `turnoverData` — 7 hardcoded month/rate pairs |
| "Headcount by Department" bar chart | `deptData` — 6 hardcoded rows for **"Nursing, Radiology, Pharmacy, Lab, HR, Finance"**, which are not HSJ's seeded units |
| `Export` button | Rendered with **no `onClick`** |
| Backend | **No reports route, controller, or service exists** |
| Permission | `reports.read.ALL` / `reports.export.ALL` are seeded, and the sidebar gates on them, so HR sees the link |

**Status: FRONTEND-ONLY (MOCK) / PLACEHOLDER.** No real report exists.

**Note:** genuine reporting capability *does* exist elsewhere, just not here — `POST /attendance/export/excel` and `/export/pdf` (multi-sheet ExcelJS + PDFKit), `GET|POST /employees/export/excel` and `/export/pdf`, and the client-side CSV export on the Attendance Tally page.

---

## 28. Settings

**File:** `pages/Settings/SettingsPage.tsx` — **20 lines**. Renders four non-interactive `<div>` cards: *Profile*, *Security*, *Appearance*, *Notifications*. They have `cursor-pointer` and hover styling but **no click handlers, no routes, and no state**.

- **Backend:** the `SystemSetting` model exists and is seeded (including `payroll_periods_per_month`), but **no route, controller, or service reads or writes it**.
- **Permission:** `settings.manage.ALL` is seeded; the sidebar always shows Settings (`isAllowed` returns `true` unconditionally for `/settings`).
- The one setting that genuinely works — **theme** — is handled by `ThemeProvider` + `localStorage['hrisense_theme']` and toggled from the TopNav, not from this page.

**Status: PLACEHOLDER.**

---

## 29. Audit Logs & Timeline

### 29.1 Audit writing — **IMPLEMENTED (write-only)**
`lib/audit.ts::createAuditLog` accepts both a legacy shape (`userId`, `resource`, `resourceId`) and the current shape (`actorUserId`, `entityType`, `entityId`), plus `targetEmployeeId`, `metadata`/`oldValue`/`newValue`, `ipAddress`, `userAgent`, and an optional `tx` for transactional writes. It **swallows errors** (logs and continues) unless a transaction client was supplied, so audit failures never break business operations.

Actions written today include: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `EMPLOYEE_CREATED`, `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `EMPLOYEE_RESTORED`, employee archive, supervisor override/removal, `RESET_PASSWORD`, `ACTIVATE_USER`, `DEACTIVATE_USER`, `LEAVE_FILED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`, `LEAVE_REQUEST_CREATED_ON_BEHALF`, `APPLICANT_CONVERTED_TO_ONBOARDING`, `AUTOMATIC_EMAIL_FAILED`, plus announcement, compliance, medical, psychological, training and evaluation lifecycle events.

### 29.2 Audit reading — **MISSING**
| Piece | State |
|---|---|
| Backend read endpoint | **None.** No `/audit` route is registered. |
| Frontend page | **None.** No `Audit` page component exists. |
| Sidebar entry | **Present** — "Audit Logs" → `/audit`, gated on `audit.read` (so HR sees it) |
| Route | **Not in `routeTree.tsx`** → the link 404s |
The only place audit rows surface is the HR Dashboard's "Recent Activity" card, which reads the five newest `AuditLog` rows through `/dashboard/stats`.

### 29.3 Employee Timeline — **BROKEN**
`EmployeeDetailPage` has a Timeline tab that calls `GET /employees/:employeeId/timeline`. **That route does not exist**; the call is wrapped in `.catch(() => ({data:{data:[]}}))`, so the tab silently shows *"No timeline events recorded yet."* forever. The intended rendering (action name, actor, timestamp, JSON metadata) is fully written and ready — only the endpoint is missing. `AuditLog.targetEmployeeId` exists specifically to support this query.

### 29.4 `ScheduleHistoryLog` — the one audit trail with a UI
Scheduling changes are logged separately and **are** readable, through `GET /schedules/history` and the History tab on `/attendance/schedule`. **IMPLEMENTED.**

### 29.5 `ActivityLog`
A second, simpler log model with a `User` relation. **No writer, no reader.** Dead.

---

## 30. Notifications

Distinct from Announcements. Verified end to end:

| Piece | State |
|---|---|
| Prisma model `Notification` | **Exists** — `userId`, `type: NotificationType` (12 values incl. the out-of-scope `PAYSLIP_RELEASED`), `title`, `message`, `link`, `isRead`, `readAt` |
| Backend routes | **Exist** — `GET /notifications` (paged, `unreadOnly`, returns `unreadCount`), `PATCH /notifications/:id/read` (ownership-checked), `PATCH /notifications/read-all`. All defined as inline handlers in `notification.routes.ts`; there is no notification controller or service. |
| **Notification creation** | ⚠ **NONE.** `grep -rn "notification\.create\|notification\.createMany" apps/api/src` returns **no matches**. Not one notification is ever produced by leave, evaluations, announcements, compliance, training, or recruitment. `RecruitmentAutomaticCommunicationService` even carries the comment *"TODO: Internal HR Notification could be created here if a Notification system existed."* |
| Frontend page | **None.** No notifications page component exists. |
| Frontend route | **None** in `routeTree.tsx`. |
| Sidebar entry | **Present** — "Notifications" → `/notifications` with a **hardcoded badge of `8`**; `isAllowed` returns `true` for it unconditionally. **Dead link.** |
| TopNav bell | **Mock** — four hardcoded notifications, a computed-from-mock unread badge of 3, and a "View all notifications" button with no handler. |
| Permissions | `notification.read.OWN` / `notification.update.OWN` are seeded. |

**Is the announcement unread badge used instead?** Partly — yes for the **Announcements** sidebar item (real, from `GET /announcements/unread-count`), no for the Notifications item (hardcoded `8`) and no for the TopNav bell (mock array).

**Status: BACKEND-ONLY, and inert — the endpoints will always return an empty list because nothing writes to the table.**

---

## 31. Help Center

**Key files:** `pages/HelpCenter/{HelpCenterPage,HelpGuidePage}.tsx` · `helpCenter.registry.ts` (1,298 ln) · `helpCenter.search.ts` (227 ln) · `helpCenter.types.ts` (86 ln) · `devGuideFixture.ts` (77 ln) · `components/` (18 components) · docs `HELP_CENTER_ARCHITECTURE.md`, `HELP_CENTER_FUNCTION_INVENTORY.md`, `HELP_CENTER_BROWSER_AUDIT.md`.

**Declared status: `PARTIALLY IMPLEMENTED — PRESENTATION WRAP-UP IMPLEMENTED`.** Confirmed accurate.

### 31.1 Architecture
Pure frontend, config-driven: guides are strongly-typed TypeScript objects in `helpCenter.registry.ts` — **0 database tables, 0 CMS, 0 external search**. Role filtering happens **before** search and browsing.

### 31.2 Content status model
| Status | Visible in UI? | Searchable? | Counts toward category totals? | Direct URL |
|---|---|---|---|---|
| `READY` | ✅ | ✅ | ✅ | Full guide reader |
| `DRAFT` | ❌ | ❌ | ❌ | "Guide not available yet" fallback |
| `METADATA_ONLY` | ❌ | ❌ | ❌ | "Guide not available yet" fallback |
`getReadyGuidesForRole()` and `searchHelpGuides()` both filter to `roles.includes(role) && contentStatus === 'READY'`; `getCategoriesForRole()` counts only `READY` guides and **hides categories with a zero count**.

### 31.3 Actual registry counts — computed from `helpCenter.registry.ts` at this HEAD, not from the docs
| Metric | Count |
|---|---|
| **Total registry entries** | **39** |
| `READY` | **13** |
| `DRAFT` | **0** |
| `METADATA_ONLY` | **26** |
| Entries permitting `FULL` | **36** |
| Entries permitting `SUPERVISOR` | **19** |
| Entries permitting `STANDARD` | **13** |
| **`READY` visible to `FULL`** | **13** |
| **`READY` visible to `SUPERVISOR`** | **5** |
| **`READY` visible to `STANDARD`** | **2** |
| Categories with ≥1 `READY` guide — `FULL` | **5** (`AUTH`, `DASHBOARD`, `EMPLOYEES`, `RECRUITMENT`, `ATTENDANCE`) |
| Categories with ≥1 `READY` guide — `SUPERVISOR` | **3** (`AUTH`, `EMPLOYEES`, `ATTENDANCE`) |
| Categories with ≥1 `READY` guide — `STANDARD` | **1** (`AUTH`) |
| Category codes defined | 10 (`AUTH · DASHBOARD · EMPLOYEES · RECRUITMENT · ATTENDANCE · LEAVE · EVALUATIONS · TRAINING · COMPLIANCE · ANNOUNCEMENTS`) |

**The 13 `READY` guides:** `AUTH_LOGIN`, `AUTH_CHANGE_PASSWORD`, `DASHBOARD_VIEW_HR`, `EMPLOYEE_SEARCH_FILTER`, `EMPLOYEE_ONBOARD_NEW`, `EMPLOYEE_DRAFT_MANAGE`, `EMPLOYEE_VIEW_PROFILE`, `EMPLOYEE_ARCHIVE_RESTORE`, `RECRUITMENT_MANAGE_OPENINGS`, `RECRUITMENT_TRACK_APPLICANTS`, `ATTENDANCE_DAILY_MONITORING`, `ATTENDANCE_TALLY`, `ATTENDANCE_SHIFT_CATALOG`.

**⚠ Registry defect: `AUTH_LOGOUT` has `roles: []`.** Because every accessor uses `guide.roles.includes(role)`, this entry is invisible to **every** role — it can never be listed, searched, or opened, even once authored. Recorded as §43 R-16.

**⚠ Stale validator:** `validateHelpRegistry()` still asserts `38` total / `35` FULL / `18` SUPERVISOR / `12` STANDARD, so it would now report `isValid: false` with four errors. It is **never called** by any component, so it has no runtime effect — but it is misleading. Recorded as §43 R-17.

### 31.4 Guide reader capabilities — all IMPLEMENTED
Every element of the reader exists and renders: **Purpose / When To Use** (`HelpInfo`), **Before You Start** (`HelpPrerequisites`), numbered **Steps** with instruction, explanation, `uiPath`, per-step tip/warning/info, and **What You Should See** (`HelpExpectedResult`), **Tips** (`HelpTip`), **Warnings** (`HelpWarning`), **What Happens Next**, **Troubleshooting** (problem/solution/note — `HelpTroubleshooting`), **Related Guides** (`HelpRelatedGuides`), **step navigation** with smooth scroll (`HelpGuideNavigation`), **breadcrumbs**, a **role indicator**, **Print** (`window.print()`), and **Copy link**.

### 31.5 The three fallbacks — all IMPLEMENTED
| Case | Screen |
|---|---|
| Unknown slug | **"Guide Not Found"** + *Back to Help Center* |
| Slug exists but the role is not permitted | **"Guide Not Available for Your Account"** — *"This guide describes features available to other roles…"* |
| Slug exists, role permitted, but `contentStatus !== 'READY'` | **"Guide not available yet"** — *"This step-by-step guide is still being prepared. More guides will be published as documentation continues."* |
No internal tokens (`METADATA_ONLY`, `DRAFT`, `Function ID`, registry metadata) leak into any user-facing screen.

### 31.6 Screenshots — architecture present, capture DEFERRED
The `HelpScreenshot` type carries `src`, `alt`, optional `caption`, `sensitive`, `highlightDescription`. `HelpScreenshot.tsx` **returns `null` when no source is present**, so no broken image frames appear; `HelpScreenshotModal.tsx` provides the enlarged viewer. All of it is retained and unused pending capture. **No screenshots were generated during this review.**

### 31.7 Presentation wrap-up
`/help-center` shows an informational banner: *"Help Center is being expanded — The guides currently available have been verified and are ready to use. More step-by-step guides will be added as additional HRISense features are documented."* If a role has zero `READY` guides, the page instead shows a full-page *"Step-by-step guides are being prepared"* state. **`STANDARD` users currently see only 2 guides (both `AUTH`) — a thin but non-empty experience.**

### 31.8 Dev fixture
`DEV_READER_FIXTURE` (slug `preview-guide-reader`) is served **only when `import.meta.env.DEV`**; in a production build the slug falls through to "Guide Not Found". Correctly guarded.

### 31.9 Remaining Help Center work
26 `METADATA_ONLY` guides to author (Leave ×3, Evaluations ×3, Training ×2, Compliance/Medical/Psychological ×3, Announcements ×3, Employees ×7, Dashboard ×2, Attendance ×2, Auth ×1). The recorded continuation point is **"HELP CENTER CHECKPOINT 3B-2 — HR PERSONNEL GUIDE AUTHORING: WORK SCHEDULE + HOLIDAY + LEAVE"**. Contextual (in-page) help: **NOT STARTED**.

---

## 32. Public-Facing Features

Everything reachable without a token, verified against `routeTree.tsx` and `routes/public-recruitment.routes.ts`:

| # | Path | Page | What it does | Status |
|---|---|---|---|---|
| 1 | `/` | `LandingPage` (556 ln) | Hero with the official title · Overview · **6 feature cards** (Employee Management, Attendance & Leave, Training & Compliance, Public Careers, **AI Workforce Assistance**, **Reports & Insights**) · **4 role cards** · 4-step "How It Works" · About · Footer. Hash anchors `#features`, `#roles`, `#about` work cross-route via `CareersLayout`. | IMPLEMENTED — **but see §42 C-01/C-05: it advertises an "Administrator" role, AI assistance, expiration alerts, and reports that are not built** |
| 2 | `/careers` | `CareersPage` | Lists `OPEN` job openings | IMPLEMENTED |
| 3 | `/careers/$openingSlug` | `OpeningDetailPage` | Full opening detail | IMPLEMENTED |
| 4 | `/careers/$openingSlug/apply` | `ApplyPage` | Application form + résumé/cover letter + privacy consent | IMPLEMENTED |
| 5 | `/careers/application-success` | `ApplicationSuccessPage` | Reference number + copy button | IMPLEMENTED |
| 6 | `/login` | `LoginPage` | Sign-in; redirects an already-authenticated user | IMPLEMENTED |

**Public API surface (3 endpoints):** `GET /api/v1/public/recruitment/openings`, `GET /api/v1/public/recruitment/openings/:slug`, `POST /api/v1/public/recruitment/openings/:openingId/apply`.

**Not public (verified absent):** applicant login, applicant portal, application status lookup, public employee directory, public registration/self-signup, password-reset UI.

---

## 33. Email & Communications

### 33.1 Three email stacks, two live
| Stack | File(s) | Transport | Used by | State |
|---|---|---|---|---|
| **Recruitment provider abstraction** | `services/email/{recruitment-email.provider, dev.provider, brevo.provider, recruitment-template.service}.ts` | Brevo REST or simulation | All recruitment communications (manual + automatic) | **LIVE** |
| **Transactional** | `services/email/brevo-transactional.provider.ts` | `fetch` → `https://api.brevo.com/v3/smtp/email`, 10 s `AbortController` timeout | `EmployeeEmailService.sendWelcomeEmail` | **Provider live; its only caller is never invoked** |
| **Nodemailer/Ethereal** | `services/email.service.ts` (153 ln) | SMTP or an auto-created Ethereal test account | — | **UNUSED — imported by nothing** |

### 33.2 Configuration (names only — no values reproduced)
| Variable | Purpose |
|---|---|
| `RECRUITMENT_EMAIL_PROVIDER` | `DEVELOPMENT` \| `BREVO` |
| `RECRUITMENT_EMAIL_SEND_ENABLED` | `'true'` actually sends; anything else simulates |
| `RECRUITMENT_EMAIL_TEST_RECIPIENT` | Redirect target in development |
| `RECRUITMENT_FROM_EMAIL` / `RECRUITMENT_FROM_NAME` / `RECRUITMENT_REPLY_TO_EMAIL` | Sender identity |
| `BREVO_API_KEY` | Brevo credential |
| `ENABLE_TRANSACTIONAL_EMAILS`, `TEST_EMAIL_RECIPIENT`, `DEFAULT_FROM_NAME`, `DEFAULT_FROM_EMAIL` | Transactional provider (read via `process.env`, **not declared in `config/env.ts`**) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Read by the unused `EmailService` only; **not declared in `config/env.ts` or `.env`** |

### 33.3 Development safety
Three independent guards, which is genuinely careful:
1. **`DevelopmentRecruitmentEmailProvider`** — with sending disabled, logs and records `SIMULATED`; with sending enabled and a test recipient, records a redirect; otherwise mocks.
2. **`BrevoTransactionalEmailProvider`** — honours `ENABLE_TRANSACTIONAL_EMAILS !== 'false'` and rewrites the recipient to `TEST_EMAIL_RECIPIENT`, prefixing the display name with `[TEST REDIRECT]`.
3. **`EmailService.isDevSeededAccount()`** — five-way check (employee number prefixed `DEV-`, `@hrisense.local` domain, and three database lookups) that suppresses outbound mail to seeded accounts entirely. *(In the unused stack, so currently decorative.)*

### 33.4 What email is actually sent today
| Flow | Trigger | Status |
|---|---|---|
| **Application received** | Public application submitted → `APPLICATION_RECEIVED` | **IMPLEMENTED (automatic)** |
| **Status changed** | `PATCH /applications/:id/status` → type mapped from the new status | **IMPLEMENTED (automatic, idempotent)** |
| **Interview scheduled / rescheduled / cancelled** | Interview mutations | **IMPLEMENTED (automatic)** |
| **Manual applicant email** | HR composes from 12 templates, with preview and retry | **IMPLEMENTED** |
| **Welcome credentials email** | Should follow employee onboarding | **NOT SENT** — `EmployeeEmailService.sendWelcomeEmail` and `EmailService.sendWelcomeEmail` are **never called** (§12.2) |
| **Password reset email** | Should follow `/auth/forgot-password` | **NOT SENT** — the raw token is returned in the API response instead (§6.5) |
| **Announcement email** | — | **NOT IMPLEMENTED** — announcements are in-app only, by design |
| **Any notification email** | — | **NOT IMPLEMENTED** (§30) |

### 33.5 Error handling
Providers never throw on send failure; they return a typed result. Every recruitment attempt is persisted in `ApplicantCommunication` with `sendStatus` and `failureCode`/`failureReason`, is retryable from the UI, and a failure writes an `AUTOMATIC_EMAIL_FAILED` audit row **without rolling back the HR action that triggered it**.

---

## 34. File & Document Management

### 34.1 Storage layout
All uploads live under `apps/api/uploads/` in seven domain folders — `announcements`, `compliance`, `documents`, `medical`, `psychological`, `recruitment/documents`, `training`. **`apps/api/src/index.ts` deliberately serves none of them statically**, with an explicit comment stating that all protected documents stream exclusively through authenticated API routes to prevent URL enumeration.

### 34.2 Path & metadata pattern
Filenames on disk are `crypto.randomBytes(16).toString('hex')` + the original extension. The database keeps `originalFilename` (display only), a **unique** `storedFilename`, `mimeType`, `sizeBytes`, `uploadedById`/`uploadedAt`, and per-domain extras (`notes`, `visibility`, `category`, expiry). **Full paths are not stored** except `ApplicantDocument.storagePath`.

### 34.3 Upload constraints by domain
| Domain | Size | Types | Extra |
|---|---|---|---|
| Employee documents | 5 MB | PDF, JPEG, PNG, WEBP, DOC, DOCX | Explicit blocklist of `.exe .sh .bat .cmd .js .ts .php .py .msi` |
| Public recruitment | 5 MB/file, **max 2 files**, 20 fields, 25 parts | PDF, DOC, DOCX | `adm-zip` structural DOCX validation; rate limiter runs **before** multer; cleanup on failure |
| Medical / Psychological / Training / Compliance / Announcements | Per-route multer config | Per-route MIME allowlists | Random stored filenames; streamed only |
Global body limit: `express.json`/`urlencoded` at **10 MB**; `MAX_FILE_SIZE` env defaults to 10 MB.

### 34.4 Download authorization
| Resource | Endpoint | Rule |
|---|---|---|
| Employee document | `GET /documents/:id/preview` · `/download` | `STANDARD`: own **and** `isVisibleToEmployee`. `SUPERVISOR`: own (visible-to-employee) or an active `SupervisionLink` subordinate **and** `isVisibleToSupervisor`. `FULL`: all. Missing physical file → 404 *"File physically missing from storage"*. |
| Applicant document | `GET /recruitment/applications/:id/documents/:documentId/{download,preview}` | `RecruitmentPolicy.canViewRecruitment` |
| Medical document | `GET /medical/documents/:id/stream` | HR, or the owning employee |
| Psychological document | `GET /psychological/documents/:id/stream` | HR; employee only if `visibility === EMPLOYEE_VISIBLE` |
| Compliance document | via compliance routes | `visibility ∈ {VISIBLE, HR_ONLY}` |
| Training certificate | `GET /training/:id/participants/:employeeId/certificate` | Authenticated; owner or HR |
| Training activity document | `GET /training/:id/documents/:documentId` | `FULL` only |
| Announcement attachment | `GET /announcements/:id/attachments/:attachmentId` | Recipient of that announcement, or HR |

### 34.5 Previews
Employee documents and applicant résumés support **inline preview** (streamed with the stored `mimeType`); everything else downloads. There is no in-app PDF viewer component — the browser renders the streamed response.

### 34.6 Known gaps
- **`UploadedFile`** — a generic file registry model with a `purpose` field. **No reader, no writer.** Dead.
- **Orphan files** — deleting a record removes the row and, in the announcement/training paths, the file; other domains soft-delete the row, so files can accumulate on disk.
- **Employee photos** — `Employee.photoUrl` is a string field; the onboarding form collects a `profilePicture` file, but there is no photo upload endpoint, so it is never populated.
- **No antivirus scanning** (documented as requiring a third-party integration).

---

## 35. Security Architecture

*Read-only structural review. No penetration testing was performed.*

### 35.1 What is done well
| Area | Implementation |
|---|---|
| Password storage | `bcryptjs` hashing; hashes never returned by any endpoint |
| Brute force | 5 failed attempts → 15-minute lock; counter reset on success; both outcomes audited |
| Token design | Short-lived access JWT (15 m default) + DB-backed refresh sessions with revocation; refresh reuse revokes **all** of a user's sessions |
| Account state | `isActive`, `deletedAt`, and `lockedUntil` are all checked at login |
| Protected files | **No static serving**; every file streams through an authenticated, authorization-checked route with random stored filenames |
| Upload validation | MIME allowlists, size/field/part limits, an executable-extension blocklist, `file-type` magic-byte checking, and `adm-zip` DOCX structural validation on the public endpoint |
| Public rate limiting | Browsing 60/min/IP (configurable); applications 5/hr/IP in production, 30/hr in local dev; **the limiter runs before multer** so oversized uploads are rejected early |
| Global rate limiting | 200 requests / 15 min in production (2,000 in dev, and skipped entirely in dev) |
| Security headers | `helmet()` with defaults |
| CORS | Locked to `CLIENT_URL` with `credentials: true` |
| Input validation | zod on auth and document routes; typed DTOs and manual validation elsewhere |
| Enumeration | `/auth/forgot-password` returns a uniform response |
| Sensitive-data zoning | `MedicalRecord.hrNotes` and `PsychologicalRecord.hrConfidentialNotes` are never returned to employee views; psychological documents default to `HR_ONLY` |
| Error shape | Consistent `{success:false, error, errors?}`; stack traces are logged server-side only |
| Idempotency | Unique `eventId` on automatic recruitment emails prevents duplicate sends |

### 35.2 ⚠ Findings (ordered by severity)

**S-1 — CRITICAL · Secrets committed to the repository.**
`git ls-files` shows **`apps/api/.env` is tracked**, and so is `node_modules/@hrisense/api/.env` (the materialised workspace link). It defines `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `OPENAI_API_KEY`, `BREVO_API_KEY`, and `HOLIDAY_API_KEY` with real (non-placeholder-length) values. `.gitignore` covers only `.env.*.local` variants, not `.env`. **Any JWT/refresh secret in git allows forging tokens for any user, including `FULL`.** *(No values are reproduced in this document.)*

**S-2 — HIGH · Credential reports committed.**
`.local/` is listed in `.gitignore`, but the files were tracked **before** the rule was added, so `.gitignore` has no effect on them. Still in the index: `.local/dev_credentials_report.json`, `.local/dev_credentials_report.txt`, `.local/simple_local_accounts.json`, `.local/simple_local_accounts.txt`. `apps/api/src/scripts/update_seeded_dev_accounts.js` shows these reports are written with plaintext temporary passwords (pattern `Hrisense#2026!<ROLE_CODE>`).

**S-3 — HIGH · Broken object-level authorization on the employee record.**
`GET /employees/:id` has no `authorize()` middleware and `EmployeeService.getById(id)` performs no caller check. **Any authenticated user — including `STANDARD` — can read any employee's full 201 record**: SSS / PhilHealth / Pag-IBIG / TIN, date and place of birth, home address, personal email, emergency contacts, and the linked user's email and active state. IDs are UUIDs (not enumerable), but `/search` and the org chart expose them. Compare `PUT /employees/:id`, which *does* enforce self-only editing with a field allowlist.

**S-4 — HIGH · Missing subordinate check on weekly schedules.**
`WeeklyScheduleController.saveEmployeeWeeklySchedule` blocks only `STANDARD`, with the in-code comment *"Supervisor logic would typically check if the employeeId is their subordinate… we proceed."* Any `SUPERVISOR` can therefore **write** any employee's weekly schedule; `getEmployeeWeeklySchedule` likewise lets any supervisor **read** any schedule. The parallel template track (`schedule.controller`) does enforce the check.

**S-5 — HIGH · Change-password verification is effectively absent.**
The old password is never checked (field-name mismatch, §6.4), and the complexity regex rejects every ordinary password (§6.4). Together these make the forced-first-login flow both unsafe in principle and unusable in practice.

**S-6 — MEDIUM · Weak temporary-password generation.**
`UserService.forcePasswordReset` uses `Math.random().toString(36).slice(-8)` — a non-cryptographic PRNG producing ~8 lowercase-alphanumeric characters. The repository already contains a crypto-strong `generateSecurePassword()` that is never used.

**S-7 — MEDIUM · Reset token returned in the HTTP response.**
`/auth/forgot-password` returns the raw reset token to the caller. Combined with the enumeration-safe response, **anyone who can guess an email address can obtain a working reset token.** Marked "for development" in-code, but there is no environment guard.

**S-8 — MEDIUM · Seeded HR account with a 2-character password.**
`prisma/seed.ts` creates `HR@gmail.com` with the password `"hr"` and prints the credentials to the console. If a seeded database is ever deployed, this is a full-`FULL`-tier account.

**S-9 — MEDIUM · Rate limiting disabled in development, and no `trust proxy`.**
The global limiter is skipped entirely when `NODE_ENV === 'development'`. `app.set('trust proxy', …)` is never called, so behind a reverse proxy `req.ip` will be the proxy's address and per-IP limits will collapse to one shared bucket.

**S-10 — LOW/MEDIUM · Helmet defaults only.**
`helmet()` is called with no options: no custom CSP, no HSTS `maxAge`/`preload` tuning, no CORP/COEP configuration.

**S-11 — LOW · Repository hygiene.**
Ten `*.sql` database dumps (0.7–1.2 MB each) at the repository root plus a **303 MB** `HRISense_FULL_WORKSPACE_20260731.zip` are tracked, despite `.gitignore` containing `*.sql`. Built `dist/` output for both apps is committed. These dumps may contain production-shaped personal data.

**S-12 — LOW · No CSRF token.**
Not currently exploitable — the API is bearer-token-only and reads no cookies — but it is worth stating explicitly.

---

## 36. Major End-to-End Workflows

*Text maps of actual code paths. `⚠` marks a step that is broken today.*

### 36.1 Authentication
```
/login → POST /auth/login → lockout? active? bcrypt.compare
  → reset counters, stamp lastLoginAt/Ip
  → sign access JWT + refresh JWT → persist UserSession (7d)
  → AuditLog LOGIN_SUCCESS
  → client stores both tokens in localStorage
  → mustChangePassword ? /change-password : /dashboard
Access token expires (15m) → axios 401 interceptor → POST /auth/refresh
  → session valid? → new access token, expiry extended (refresh NOT rotated) → retry original request
  → session invalid → clear tokens → auth_logout event → toast → /login
Logout → POST /auth/logout → delete session + AuditLog LOGOUT → clear tokens + React Query cache → /login
```

### 36.2 Employee onboarding
```
HR → /employees/onboard
  → Step 1 Personal → 2 Contact & Address → 3 Employment (live supervisor preview via
      POST /employees/resolve-supervisor) → 4 Government Numbers → 5 Emergency Contact
      → 6 Document Uploads → 7 Review & Confirm
  → [Save Draft at any point] → POST/PUT /onboarding-drafts   ✅ works
  → Submit → POST /employees (multipart/form-data)
      ⚠ route has no multer → body not parsed
      ⚠ employeeNumber never collected and never generated (required + unique)
      ⚠ no User created, no temporary password, no welcome email
  → (intended) DraftService.markCompleted → ScheduleService.assignSchedule → AuditLog
  → Success screen shows employee number, login email and "Temporary Password"
      ⚠ tempPassword is undefined — copy/PDF produce "Password: undefined"
  → Employee appears in the directory (only if the create succeeds)
```

### 36.3 Employee archive / restore
```
Archive:  HR → profile → Archive (reason required)
  → PATCH /employees/:id/archive → deletedAt = now → AuditLog
  → row leaves the default directory; appears under /employees/archived
Restore:  HR → /employees/archived → select one or many → Restore
  → PATCH /employees/:id/restore | POST /employees/bulk-restore
  → transaction: deletedAt = null; one EMPLOYEE_RESTORED audit row per employee
      recording previousAccountStatus (ACTIVE | INACTIVE | NO_ACCOUNT)
  ⚠ the "reactivate their user account?" answer (restoreAccountAccess) is ignored
```

### 36.4 Recruitment → hiring
```
HR → /recruitment/openings/new → DRAFT (auto referenceNumber + slug)
  → PATCH /openings/:id/status → OPEN (publish authority required) → visible on /careers
Applicant → /careers → opening → Apply → résumé (+ cover letter) + privacy consent
  → POST /public/recruitment/openings/:id/apply  [rate limit → multer → magic bytes → DOCX zip check]
  → Applicant + JobApplication (referenceNumber) + ApplicantDocument
  → AUTOMATIC EMAIL: APPLICATION_RECEIVED  (eventId application-submitted:<id>)
  → /careers/application-success shows the reference number
HR → /recruitment/applicants → detail
  → status transitions (each writes ApplicationStatusHistory + fires the mapped automatic email)
      SUBMITTED → UNDER_REVIEW → SHORTLISTED → FOR_INTERVIEW → INTERVIEWED
                → FOR_REQUIREMENTS → HIRED | REJECTED | WITHDRAWN
  → schedule interview → AUTOMATIC EMAIL: INTERVIEW_INVITATION
      → reschedule / cancel → their own automatic emails
      → record notes, recommendation, InterviewStatus
  → manual emails from 12 templates (preview → send → retry), all persisted
  → notes + full status history timeline
```

### 36.5 Applicant → Employee conversion
```
Application status = HIRED  (HR Officer authority)
  → POST /recruitment/applications/:id/convert
  → transaction: create OnboardingDraft prefilled with
       applicant names / personal email / mobile / address
       + opening's unitId, departmentId, jobRoleId, employmentType
     and set JobApplication.onboardingDraftId
  → AuditLog APPLICANT_CONVERTED_TO_ONBOARDING
  → HR opens /employees/drafts → Resume → /employees/onboard?draftId=…
  → completes the wizard → ⚠ blocked by §36.2
  → (intended) JobApplication.employeeId is set — ⚠ no code sets it today
```

### 36.6 Attendance
```
Biometric device → Mustard Seedtime → HR exports Excel
  ⚠ → [ import into HRISense ]  — PLACEHOLDER; the Process Import button is disabled
       → AttendanceRecord rows are created today only by prisma/seed.ts
HR/Supervisor/Employee → /attendance/daily
  → GET /attendance/calendar (aggregates + APPROVED calendar entries)
  → click a day → GET /attendance (employee × date virtualisation, ≤31 days)
       each row = attendanceFact (or NO_RECORD)
                + organizationContext (holiday/suspension)
                + scheduleAssignment + templateDay + effectiveEmployeeSchedule
  → scope resolved from tier: own | team (SupervisionLink) | all
→ /attendance/tally → GET /attendance/tally
  → per-employee Present/Late/Absent/On Leave/Half Day/Imported/No Record over the range
  → noImportedRecord = calendar days − distinct days with a record    (never "Absent")
  → export CSV (client) | Excel | PDF (server)
```

### 36.7 Work schedule
```
HR → /attendance/schedule
  ├─ Shift Catalog → create/edit shift definitions (edit = version + archive when already used)
  ├─ Employee Schedules → pick employee → set each weekday
  │     UNCONFIGURED | DAY_OFF | WORKING(+ one or more shifts, ordered)
  │     → POST /weekly-schedules/employees/:employeeId with effectiveFrom
  │     → previous schedule is closed in the same transaction (contiguous half-open timeline)
  ├─ Coverage → GET /schedules/coverage over a date range
  └─ History → GET /schedules/history (ScheduleHistoryLog)
Supervisor → may assign template schedules to active direct subordinates (SupervisionLink-checked)
             ⚠ but may write ANY employee's weekly schedule (missing check, §35 S-4)
Employee   → views own schedule (profile Schedule tab)
Attendance reads it through ScheduleService.resolveScheduleForDate
```

### 36.8 Leave request → decision
```
Employee → /leave/new → type, dates, reason, optional supporting doc
  → POST /leave → totalDays = inclusive calendar days
                → overlap check against PENDING/APPROVED (409)
                → status PENDING → AuditLog LEAVE_FILED
Supervisor/HR on behalf → POST /leave/batch (self | employees | all)
                → per-employee authorization + overlap check
                → 201 / 207 / 400 → AuditLog LEAVE_REQUEST_CREATED_ON_BEHALF (shared batchReference)
HR → /leave/requests
  ├─ Approve → PATCH /leave/:id/approve (FULL only)
  │     → APPROVED + approvedById/At + hrNotes
  │     → LeaveBalance upsert: used += totalDays, pending -= totalDays
  │       ⚠ pending was never incremented on filing → drifts negative
  │       ⚠ if no balance row exists, one is created with totalAllotted = 15 (invented policy)
  │     → AuditLog LEAVE_APPROVED
  └─ Reject → PATCH /leave/:id/reject (FULL only, reason required) → AuditLog LEAVE_REJECTED
Owner → PATCH /leave/:id/cancel (own, PENDING only) → CANCELLED
⚠ There is NO supervisor endorsement step. The supervisor Team tab is read-only.
```

### 36.9 Evaluation
```
HR → Templates → create (rating method, min/max, criteria with weight & required flags)
HR → Cycles → create: template + startDate + dueDate
            + scope (ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE)
            + evaluator method (SUPERVISOR via SupervisionLink ⚠ | ONE_EVALUATOR | MANUAL)
  → one transaction: resolve employees → snapshot template → generate EvaluationAssignments
Evaluator (Supervisor or HR) → My Evaluations
  → Start → NOT_STARTED → IN_PROGRESS (POST /assignments/:id/draft, saved at any time)
  → Submit → validation → SUBMITTED ("Awaiting Finalization")
HR → review responses and computed score
  → Finalize (POST /assignments/:id/finalize) with an explicit
    "Employee Access" checkbox defaulting to FALSE → FINALIZED
Employee → sees it only if FINALIZED AND isEmployeeVisible = true
Profile → Evaluations tab → read-only history (EvaluationFormModal readOnlyForce)
```

### 36.10 Training
```
HR → /training → Create Activity
  → details, schedule (chronologically validated), provider, venue, hours, capacity
  → optional Compliance Requirement (filtered to ACTIVE, category = TRAINING)
  → roster targeting: All Active | Unit | Department | Job Role | Specific Staff
  → resolve + dedupe + capacity check → TrainingParticipant rows (ASSIGNED)
HR → detail modal → record outcomes individually or in bulk
  → COMPLETED | DID_NOT_ATTEND | EXCUSED | reset to ASSIGNED (with date + notes)
  → on COMPLETED + linked requirement:
        create EmployeeComplianceRecord (reviewStatus ACCEPTED,
        referenceNumber "TRN-XXXXXXXX", expiresAt only if HR supplied validUntil)
        and store its id on the participant (guarded against duplicates)
HR → upload a per-participant certificate → stored + streamed on demand
Employee/HR → profile Training tab → GET /training/employees/:employeeId/history
```

### 36.11 Compliance
```
HR → /compliance → Create Requirement
  → title, description, category, tracksExpiry, reminderDays, lifecycle
  → add scopes: ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE
Fulfilment arrives from three directions:
  • MedicalRecord.requirementId          (Medical module)
  • PsychologicalRecord.requirementId    (Psychological module)
  • EmployeeComplianceRecord             (manual entry, or auto from Training)
HR → review a record: PENDING_REVIEW → ACCEPTED | NEEDS_CORRECTION (+ reviewReason)
Any read (org summary, needs-attention, employee summary, profile tab):
  for each ACTIVE requirement applicable to this employee (evaluated live against
  their current unit/department/job role), take the latest record and derive
      MISSING → NEEDS_REVIEW → EXPIRED → EXPIRING_SOON → VALID
  Nothing is stored. No expiry period is invented. No notification is sent.
```

### 36.12 Medical
```
HR → /medical → New Record
  → employee, examType, examDate, examinedBy, optional requirement link,
    optional expiresAt (HR-entered), hrNotes (HR-only)
  → upload documents → uploads/medical, random stored filename
  → review: PENDING_REVIEW → ACCEPTED | NEEDS_CORRECTION
  → feeds the employee's MEDICAL compliance status
Employee → own profile Medical tab → own records, WITHOUT hrNotes
Supervisor → no access at all
```

### 36.13 Psychological
```
HR → /psychological → New Assessment
  → employee, assessmentType, assessmentDate, conductedBy, optional requirement link,
    optional expiresAt (HR-entered)
  → employeeVisibleSummary  (what the employee may read)
  → hrConfidentialNotes     (never returned to employee or supervisor)
  → documents with an explicit visibility choice, default HR_ONLY
  → review workflow → feeds the PSYCHOLOGICAL compliance status
Employee → own profile tab → employeeVisibleSummary + EMPLOYEE_VISIBLE documents only
Supervisor → no access at all
```

### 36.14 Announcements
```
HR → /announcements → Create (Wizard)
  → title, body, priority, isPinned, optional expiresAt
  → audience scopes (additive): ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE
  → [Preview Audience] → POST /audience-preview → exact recipient list
  → attachments → uploads/announcements (random stored filename)
  → Publish now (POST /:id/activate)  |  Schedule (POST /:id/schedule, future publishAt)
      validate: title, body, ≥1 scope, ≥1 resolved employee, expiresAt > publishAt
      transaction: re-check derived state (409 on double-activate)
                 → write AnnouncementRecipient snapshot (one row per employee)
                 → state = ACTIVE, publishAt set
                 → AuditLog ANNOUNCEMENT_ACTIVATED (with recipientCount)
Recipient → sidebar badge (GET /unread-count) + dashboard widget (GET /dashboard)
  → /announcements feed (pinned first) → open detail
  → POST /:id/read → readAt set once, never reset by later HR edits
  → download attachments (recipients only)
HR → recipient list + read-rate statistics
HR → Archive (POST /:id/archive) → leaves the feed, data preserved
```

### 36.15 AI Assistance
```
User → /ai-assistance
  → AIPage.tsx renders two hardcoded constant arrays
  → no API call, no AI request, no database read, no LLM
  → "Refresh Insights", "Ask AI", and every action button have no handler
⚠ There is no AI workflow. This is a static mock.
```

---

## 37. Module Dependency Map

Only dependencies that exist in code are listed.

```
Units / Departments / Job Roles
  └─▶ Employee (unitId, departmentId, jobRoleId)
        ├─▶ JobRole.permissionTier ──▶ JWT ──▶ every authorization decision
        ├─▶ SupervisorResolverService ──▶ Employee.immediateSupervisorId
        └─▶ RolePermission ──▶ permissions[] in the JWT ──▶ Sidebar visibility

Recruitment
  JobOpening ──▶ JobApplication ──▶ ApplicantConversionService ──▶ OnboardingDraft
                                                                       └─▶ Employee ⚠ (§36.2)
  JobApplication ──▶ ApplicantCommunication ──▶ Brevo / DEV provider
  JobOpening.unitId / departmentId / jobRoleId ──▶ prefill the onboarding draft

Scheduling
  ShiftDefinition ──▶ EmployeeWeeklyScheduleShift ──▶ …Day ──▶ EmployeeWeeklySchedule
  ScheduleTemplate ──▶ ScheduleTemplateDay ──▶ EmployeeScheduleAssignment
  OrganizationCalendarEntry ──┐
  both schedule tracks ───────┴─▶ ScheduleService.resolveScheduleForDate
                                    └─▶ AttendanceService (list, calendar, day drawer, filters)

Compliance hub (the densest dependency in the system)
  ComplianceRequirement + ComplianceRequirementScope
     ◀── Employee (unit / department / job role decide applicability, live)
     ◀── MedicalRecord.requirementId
     ◀── PsychologicalRecord.requirementId
     ◀── EmployeeComplianceRecord
     ◀── TrainingActivity.complianceRequirementId
            └─▶ participant COMPLETED ──▶ auto-created EmployeeComplianceRecord
     └─▶ derived status ──▶ Compliance page · Needs Attention · profile Compliance tab

Evaluations
  EvaluationTemplate ──▶ EvaluationCycle ──▶ EvaluationCycleScope (Unit/Dept/JobRole/Employee)
                                          └─▶ EvaluationAssignment ──▶ EvaluationResponse
  SupervisionLink ──▶ evaluator resolution when method = SUPERVISOR  ⚠ (§8.4)

Announcements
  Unit / Department / JobRole / Employee ──▶ AnnouncementAudienceScope
     └─▶ AnnouncementRecipient snapshot ──▶ recipient feed · sidebar badge · dashboard widget

Documents
  Employee ──▶ EmployeeDocument ──▶ profile Documents tab (visibility flags gate the rows)

Audit
  ~15 services ──▶ AuditLog ──▶ HR Dashboard "Recent Activity" only
                            ⚠ ──▶ profile Timeline tab (endpoint missing)
                            ⚠ ──▶ /audit page (does not exist)
Scheduling mutations ──▶ ScheduleHistoryLog ──▶ Work Schedule History tab ✅

Dashboard (reads across modules)
  Employee · AttendanceRecord · LeaveRequest · Announcement · AuditLog · AIInsight(seed-only)
  · Training/TrainingAttendee (LEGACY tables) · LeaveBalance · SupervisionLink-free team lookup
```

**Dependencies that are claimed but absent:** AI → any module (§26); Notifications → any module (§30); Compliance → email/notification reminders (§22.6); Reports → any module (§27).

---

## 38. Complete Feature / Function Inventory

Legend: **✅** implemented · **⚠** broken or disconnected · **▢** placeholder / mock · **◻** backend-only (no UI)

### Authentication & session
✅ Sign in · ✅ Account-lockout enforcement (5 attempts / 15 min) · ✅ Deactivated-account rejection · ✅ Auto-refresh access token · ✅ Session-expiry toast + forced logout · ✅ Server-unavailable retry screen · ✅ Sign out · ✅ Theme toggle (light/dark, persisted) · ⚠ Change password on first login · ◻ Request password reset · ◻ Reset password with token · ❌ Remember Me (does not exist) · ❌ Forgot-password UI (does not exist)

### Dashboard
✅ View HR dashboard · ✅ View Supervisor dashboard · ✅ View Employee dashboard · ✅ Announcements widget · ✅ Pending-leave list (HR) · ✅ Unit headcount chart · ✅ Leave-type distribution chart · ✅ Recent activity (audit) · ▢ Quick Actions (no handlers) · ▢ 6-month attendance trend (fabricated) · ▢ AI insights strip (seed-only data) · ⚠ Upcoming trainings (reads the legacy table)

### Employee management
✅ Search employees (debounced) · ✅ Filter by employment state / unit / department / job role / account status / hire-date range / archived / pending-supervisor · ✅ Sort · ✅ Paginate · ✅ Export directory to Excel · ✅ Export directory to PDF · ✅ Open 201 profile · ✅ Save onboarding draft · ✅ List / resume / delete drafts · ✅ Assign or override supervisor · ✅ Remove supervisor override · ✅ Preview supervisor resolution live · ✅ Edit employee details (HR) · ✅ Edit own limited fields (self) · ✅ Archive employee (with reason) · ✅ Restore employee · ✅ Bulk restore · ✅ View org chart (tier-scoped) · ✅ Global search (employees / drafts / archived) · ✅ Upload employee document · ✅ Preview document · ✅ Download document · ✅ Edit document metadata · ✅ Replace document file · ✅ Delete document · ⚠ **Create employee (submit)** · ⚠ Toggle account active/inactive from the directory · ⚠ Reset employee password · ⚠ Activate / deactivate / lock / unlock account · ⚠ Force password change · ⚠ Resend welcome email · ⚠ View employee timeline

### Recruitment
✅ Browse public openings · ✅ View public opening detail · ✅ Submit an application with documents · ✅ Give privacy consent · ✅ Receive a reference number · ✅ Receive an automatic acknowledgement email · ✅ View recruitment overview KPIs · ✅ Create job opening (draft) · ✅ Edit job opening · ✅ Publish opening · ✅ Close / mark filled / archive opening · ✅ List and search applicants · ✅ Filter by pipeline stage · ✅ View applicant detail · ✅ Preview résumé · ✅ Download applicant document · ✅ Change application status (with reason) · ✅ View status history · ✅ Add applicant note · ✅ Schedule interview · ✅ Update interview (notes, recommendation, status) · ✅ Reschedule interview · ✅ Preview an applicant email · ✅ Send a manual applicant email · ✅ Retry a failed email · ✅ View communication history · ✅ Convert a hired applicant to an onboarding draft · ❌ Applicant login / status lookup (out of scope, verified absent)

### Attendance
✅ View attendance calendar · ✅ View KPI summary cards · ✅ Open day-details drawer · ✅ Filter by unit / department / employee / status · ✅ Switch My / Team / All (tier-gated) · ✅ View attendance tally · ✅ Use date presets or a custom range · ✅ Drill into an employee's tally · ✅ Export tally to CSV · ✅ Export attendance to Excel · ✅ Export attendance to PDF · ✅ See "No Imported Record" distinguished from Absent · ▢ Open the Excel import modal · ▢ Select a file (preview only) · ❌ Process import (disabled) · ◻ Edit an attendance record · ◻ View attendance logs · ⚠ Filter tally by department

### Scheduling
✅ View Shift Catalog · ✅ Create shift · ✅ Edit shift (auto-versioning) · ✅ Deactivate shift · ✅ View employee schedules · ✅ Set weekly schedule (Unconfigured / Day Off / Working + shifts) · ✅ Assign a schedule template · ✅ Bulk assign · ✅ Create schedule template · ✅ Revise template with an effective date · ✅ View schedule coverage · ✅ View schedule history · ✅ View own schedule (profile tab)

### Holiday calendar
✅ View calendar entries · ✅ Filter by year / status / source · ✅ Load Nager.Date suggestions (saved as PENDING) · ✅ Approve suggestion · ✅ Ignore suggestion · ✅ Add manual entry (saved APPROVED) · ✅ Edit manual entry · ✅ Deactivate manual entry

### Leave
✅ View leave balances · ✅ File own leave request · ✅ Prefill dates from the calendar · ✅ Attach a supporting document URL · ✅ File on behalf of subordinates (Supervisor) · ✅ File on behalf of anyone / everyone (HR) · ✅ View My / Team / All leave · ✅ Filter by status / type / unit / department / year · ✅ Approve leave with HR notes (HR) · ✅ Reject leave with a required reason (HR) · ✅ Cancel own pending request · ✅ View leave calendar · ✅ Select a range on the calendar → new request · ❌ Supervisor endorsement (does not exist) · ❌ Manage leave allotments (does not exist)

### Evaluations
✅ Create / edit / deactivate template · ✅ Build criteria (add, remove, reorder, weights, required flags) · ✅ Create cycle with scope + evaluator method · ✅ View cycle details and KPIs · ✅ Close cycle · ✅ View My Evaluations · ✅ Start evaluation · ✅ Save draft · ✅ Submit evaluation · ✅ HR review of a submitted evaluation · ✅ Finalize with an explicit employee-visibility choice · ✅ View finalized evaluation (employee, when visible) · ✅ View evaluation history on the profile (read-only)

### Training
✅ View activities + metrics · ✅ Search / filter by type and status · ✅ Create activity with roster targeting · ✅ Edit activity · ✅ Cancel activity · ✅ Add participants later · ✅ Update participation status individually · ✅ Bulk update participation status · ✅ Upload participant certificate · ✅ Download participant certificate · ✅ Upload activity document · ✅ Download activity document · ✅ Link an activity to a compliance requirement · ✅ Auto-fulfil compliance on completion · ✅ View employee training history

### Compliance
✅ Create requirement · ✅ Edit requirement · ✅ Archive requirement · ✅ Add scope · ✅ Remove scope · ✅ View org compliance summary · ✅ View needs-attention queue · ✅ View all-employee compliance list · ✅ View per-employee compliance matrix · ✅ Create an employee compliance record · ✅ Upload compliance document · ✅ Review a record (Accept / Needs Correction) · ✅ Delete a record · ✅ View compliance on the employee profile

### Medical
✅ View all medical records (HR) · ✅ View summary metrics · ✅ Create record · ✅ Edit record · ✅ Review record · ✅ Delete record · ✅ Upload document · ✅ Stream document · ✅ Delete document · ✅ View own medical records (employee)

### Psychological
✅ All of the above under `/psychological` · ✅ Write an employee-visible summary · ✅ Keep HR-confidential notes · ✅ Set per-document visibility (default HR-only) · ✅ View own employee-visible zone (employee)

### Announcements
✅ Create draft · ✅ Edit draft · ✅ Add audience scopes · ✅ Preview audience · ✅ Upload attachment · ✅ Delete attachment · ✅ Publish now · ✅ Schedule for later · ✅ Archive · ✅ Delete draft · ✅ View HR workspace with filters · ✅ View summary statistics · ✅ View recipient list · ✅ View read-rate statistics · ✅ View recipient feed · ✅ Open detail (marks read) · ✅ See the unread badge · ✅ See the dashboard widget · ✅ Download attachment (recipients)

### Help Center
✅ Open Help Center · ✅ Search guides (READY, role-filtered) · ✅ Browse categories · ✅ Filter by category · ✅ View Common Tasks · ✅ Open a guide · ✅ Follow steps with expected results · ✅ Read tips / warnings / info · ✅ Read troubleshooting · ✅ Open related guides · ✅ Navigate between steps · ✅ Print a guide · ✅ Copy a guide link · ✅ See the not-found / unauthorized / not-yet-available fallbacks · ▢ View screenshots (architecture ready, none captured)

### Not implemented at all
❌ AI insight generation · ❌ Ask-AI Q&A · ❌ Any real report · ❌ Any settings action · ❌ Notifications page · ❌ Notification creation · ❌ Audit log page · ❌ Attendance import processing · ❌ Payroll / payslips (out of scope)

---

## 39. Role Access Matrix

**Full** = complete access · **Team** = own + direct subordinates · **Own** = own record only · **View** = read-only · **No** = no access · **Public** = no login required.
*(Reflects backend enforcement, which is authoritative. Frontend gating that is merely cosmetic is noted.)*

| Module / feature | HR Personnel (`FULL`) | Supervisor (`SUPERVISOR`) | Employee (`STANDARD`) | Public |
|---|---|---|---|---|
| Landing page | Full | Full | Full | **Public** |
| Careers / apply | Full | Full | Full | **Public** |
| Login | Full | Full | Full | **Public** |
| Dashboard | Full (HR view) | Team (Supervisor view) | Own (Employee view) | No |
| Employee directory | Full | View (all employees) | **No** | No |
| Employee 201 profile | Full | View — **and see §35 S-3: `GET /employees/:id` is unguarded, so `STANDARD` can also fetch any record** | Own (intended) | No |
| Government IDs tab | Full | View | Own | No |
| Medical tab on the profile | Full | **No** | Own | No |
| Psychological tab | Full | **No** | Own | No |
| Evaluations tab | Full | **No** | Own | No |
| Account Management tab | Full (⚠ all actions 404) | No | No | No |
| Create employee | Full (⚠ broken) | No | No | No |
| Edit employee | Full | Own limited fields | Own limited fields | No |
| Archive / restore | Full | No | No | No |
| Onboarding drafts | Full | No | No | No |
| Assign supervisor | Full | No | No | No |
| Org chart | Full | Team (self + all below) | Own chain upward | No |
| Employee documents | Full | Subordinates, `isVisibleToSupervisor` only | Own, `isVisibleToEmployee` only | No |
| Global search | Full | Limited | Limited | No |
| **Recruitment (all)** | Full | **No** | **No** | No |
| Attendance calendar / list | Full (all) | Own + Team | Own | No |
| Attendance tally | Full (all) | Own + Team | Own | No |
| Attendance logs | Full | Team | **No (403)** | No |
| Edit attendance record | Full (◻ no UI) | No | No | No |
| Attendance export | Full | Team | Own | No |
| Attendance import | ▢ placeholder | No | No | No |
| Shift Catalog | Full | View | View | No |
| Weekly schedule | Full | ⚠ **write any employee** (§35 S-4) | Own (view) | No |
| Schedule templates | Full | View | View | No |
| Assign schedule (template) | Full | Direct subordinates only | No | No |
| Schedule history | Full | Team | Own | No |
| Holiday calendar | Full (manage) | View | View | No |
| File own leave | Full | Full | Full | No |
| File on behalf | Full (any / all) | Direct subordinates | No | No |
| View leave requests | Full (all) | Own + Team (**read-only**) | Own | No |
| **Approve / reject leave** | **Full** | **No** | **No** | No |
| Cancel leave | Own only | Own only | Own only | No |
| Leave balances | Full (any employee) | Own | Own | No |
| Leave calendar | Full | Team | Own | No |
| Evaluation templates | Full | No | No | No |
| Evaluation cycles | Full | No | No | No |
| Evaluation assignments | Full | Where they are the evaluator | Own, `FINALIZED` + `isEmployeeVisible` only | No |
| Finalize evaluation | Full | No | No | No |
| Training activities | Full (manage) | View | View | No |
| Training participation | Full | View | Own history | No |
| Training certificates | Full | No | Own | No |
| Compliance requirements | Full | No | No | No |
| Compliance org views | Full | No | No | No |
| Compliance per-employee | Full | Subordinates | Own | No |
| **Medical records** | Full | **No** | Own (no `hrNotes`) | No |
| **Psychological records** | Full | **No** | Own (employee-visible zone only) | No |
| Announcements — create/publish | Full | No | No | No |
| Announcements — analytics | Full | No | No | No |
| Announcements — receive/read | Full | Full | Full | No |
| Announcement attachments | Full | Recipients | Recipients | No |
| AI Assistance page | View (▢ mock) | No (sidebar-gated) | No (sidebar-gated) | No |
| Reports page | View (▢ mock) | No | No | No |
| Settings page | View (▢) | View (▢) | View (▢) | No |
| Help Center | 13 READY guides | 5 READY guides | 2 READY guides | No |
| Audit logs | ⚠ sidebar link only, page does not exist | No | No | No |
| Notifications | ⚠ sidebar link only, page does not exist | ⚠ same | ⚠ same | No |
| User account management | Full (◻ endpoints exist, UI calls wrong paths) | No | No | No |
| Units / Departments / Job Roles | Full CRUD | View | View | No |

---

## 40. Placeholder / Dead / Legacy Features

*Identified only. Nothing was deleted or modified.*

### 40.1 Frontend — unreachable or mock pages
| Item | Location | Nature |
|---|---|---|
| `LeavePage.tsx` | routed at `/leave`, not in the sidebar | **Legacy mock** — hardcoded leave requests and stat tiles; still reachable by URL |
| `PerformancePage.tsx` | route redirects to `/evaluations` | **Unreachable dead code** with three fabricated period cards |
| `AIPage.tsx` | `/ai-assistance` | **Mock** — all content hardcoded (§26.3) |
| `ReportsPage.tsx` | `/reports` | **Mock** — hardcoded charts, dead Export button |
| `SettingsPage.tsx` | `/settings` | **Placeholder** — four inert cards |
| TopNav notification dropdown | `TopNav.tsx:26–33` | **Mock** — 4 hardcoded notifications, fake badge, dead "View all" |
| TopNav profile menu | `TopNav.tsx:203–204` | Items carry an `href` but render as `<button>`; **they never navigate** |
| HR Dashboard Quick Actions | `HRDashboard.tsx` | 8 buttons with **no `onClick`** |
| HR Dashboard attendance trend | `DashboardService` | **Fabricated** — six months share one rate |
| Attendance import modal | `DailyMonitoringPage.tsx:~660–785` | **Deliberate placeholder**, clearly labelled |
| `components/ui/skeleton.tsx` | — | **Unreferenced** component (the only unreferenced `.tsx` in `apps/web/src`) |
| `HSJ_DEPARTMENTS` + `HsjDepartment` | `lib/utils.ts:184–202` | **Unused hardcoded placeholder** — 15 generic hospital departments ("Nursing Services", "Radiology", "Pharmacy", "Administration"…) that do **not** match HSJ's 7 seeded service units. Self-labelled *"placeholder — replace with DB data"*. It is the likely origin of the invented department names in the Reports and AI mocks. |

### 40.2 Frontend — dead links in the sidebar
`/notifications` (with a hardcoded badge of `8`) and `/audit` — neither route exists (§9.4).

### 40.3 Backend — unreferenced services
| File | Note |
|---|---|
| `services/email.service.ts` (153 ln) | Nodemailer/Ethereal stack; imported by nothing |
| `services/email/employee-email.service.ts` | `sendWelcomeEmail` — never called |
| `services/export.service.ts` (126 ln) | Superseded by the export methods on `EmployeeService`/`AttendanceService` |
| `services/applicant-document.service.ts` | Superseded by inline logic in the recruitment controllers |
| `lib/passwordGenerator.ts` | Crypto-strong generator — never called |
| `lib/password.generateTemporaryPassword()` | Never called |

### 40.4 Backend — endpoints with no consumer
`PUT /attendance/:id` · `GET /attendance/logs` (except the dashboard widget) · `GET /employees/me` · `PATCH /users/:id/reset-password` · `PATCH /users/:id/status` · `POST /auth/forgot-password` · `POST /auth/reset-password` · all three `/notifications` endpoints.

### 40.5 Database — legacy / unused models
| Model | Nature |
|---|---|
| `LegacyComplianceRequirement`, `LegacyComplianceDocument`, `LegacyMedicalRecord`, `LegacyPsychologicalRecord` | **Deliberately preserved** stubs; explicitly `@deprecated`; superseded by the `_new` tables |
| `PerformanceEvaluation` | Old evaluation model; no reader/writer |
| `Training`, `TrainingAttendee` | Legacy training; **still read by `DashboardService`** |
| `ActivityAttendance` | No reader, no writer |
| `UploadedFile` | No reader, no writer |
| `EmailVerificationToken` | No reader, no writer |
| `ActivityLog` | No reader, no writer |
| `Notification` | Readable, but nothing ever writes to it |
| `AIInsight`, `AIRequestLog`, `AIConversation` | Read by the dashboard; written only by the seed |
| `SystemSetting` | Seeded; no API |
| **`Payslip`** | **Out of scope**; still in the schema and still seeded (§41) |
| Deprecated columns | `Announcement.content`, `.audience`, `.targetUnitId`, `.targetJobRoleId`, `.targetEmployeeId`, `.authorId`; `AnnouncementAttachment.fileName`, `.fileUrl`; `Employee.workSchedule` — all documented as retained to avoid destructive migrations |

### 40.6 `packages/shared` — unused and contradictory
384 lines, imported by **zero** files. It declares a **superseded role model** — `UserRole = "SUPER_ADMIN" | "HR_MANAGER" | "HR_STAFF" | "DEPARTMENT_HEAD" | "NURSE" | "DOCTOR" | "PHARMACIST" | "FINANCE_OFFICER" | "ADMIN_STAFF" | "EMPLOYEE"` — plus stale enum shapes (`EmploymentStatus` with `"ACTIVE"`, `CivilStatus` with `"DIVORCED"`, an `AttendanceStatus` without `SUSPENDED`, a `LeaveType` without `BEREAVEMENT`/`FORCED`, a 3-value `AnnouncementAudience`) and a `JobPosition` model that does not exist. It is the second source of the phantom "Admin" role (§42 C-01).

### 40.7 Repository-level clutter
`scratch/` (29 one-off scripts + `dummy.pdf` + `schedule_backup.json`) · `apps/api/scratch_revise.ts`, `scratch_verify.ts`, `scratch/` · `apps/api/prisma/{schema.pre-recruitment-baseline.prisma, schema.temp.prisma, schema.prisma.recruitment, inspect_46.mjs, query_roles.mjs, migrate_supervisor_assignments.ts}` · `apps/api/src/scripts/*` (7 maintenance/dev scripts) · committed `dist/` for both apps · 10 root `*.sql` dumps · a 303 MB workspace zip · root-level status markdown superseded by `docs/`.

### 40.8 Second-pass sweep — everything else checked and found clean
A full re-sweep of route registration, the sidebar, every Prisma model, every backend route file, the Help Center registry, the docs, and every `.tsx`/`.ts` in `apps/web/src` and `apps/api/src` produced no further undiscovered modules. Specifically confirmed:
- **Exactly one unreferenced frontend component** (`ui/skeleton.tsx`) and **four unreferenced backend services** (§40.3) across the whole codebase.
- **Every `.tsx` page in `apps/web/src/pages` is reachable** from `routeTree.tsx` except `Performance/PerformancePage.tsx` (§40.1).
- **All training and evaluation frontend service calls match registered backend routes exactly** — the only frontend↔backend mismatches in the entire application are the five listed in §10.2.
- **`TODO` / `FIXME` markers in the whole source tree: one** — `recruitment-automatic-communication.service.ts:116`, *"TODO: Internal HR Notification could be created here if a Notification system existed."*
- **Stale in-code comment:** `attendance.service.ts:421` — *"Date-specific work schedule management is NOT implemented in this phase"* — describing `getSchedules`, which reads the legacy `Employee.workSchedule` enum. Date-specific scheduling **is** now implemented (§17); this endpoint is the older, superseded reader.
- `utils/error-handler.util.ts` correctly normalises network / 5xx / 4xx errors and is used by `AuthProvider`.
- `types/express.d.ts` augments `Express.Request` with the `user` payload — the only global type augmentation.
- `apps/api/src/scripts/` holds 7 maintenance/dev scripts (`cleanup_local_dummy_accounts`, `fix_org_hierarchy`, `migrate_to_shift_definitions`, `resolve_all_supervisors`, `seed_dev_accounts`, `update_seeded_dev_accounts`, `verify-recruitment`) — none are imported by the running application.

### 40.9 Stale wording that survived the branding pass
`aiIntelligenceLegacyRoute` / `/ai-intelligence` (intentional back-compat) · `Permission` descriptions *"View AI workforce intelligence insights"* and *"View own e-payslips"* in `seed.ts` · `Permission.module` comment in the schema still listing `payslip` · the schema comment claiming 48 job roles when 46 are seeded · `HELP_CENTER_ARCHITECTURE.md` describing supervisor *"leave request endorsements"*.

---

## 41. Scope Exclusions

### 41.1 Payroll / E-Payslip — **OUT OF SCOPE, confirmed**
The removal was deliberate and is recorded in commit `b4a28c3a refactor(scope): remove payroll and update HRISense branding` and in the progress log's *"Strict Project Scope Cleanup"* section.

**Verified removed from the runtime:**
- `apps/web/src/pages/Payroll/PayrollPage.tsx` — deleted (no Payroll page directory exists).
- Sidebar Payroll section and E-Payslips link — gone.
- `EmployeeDashboard` payslip state, quick action, and "Recent Payslips" card — gone.
- `payslipRouter` — not registered in `routes/index.ts`; no payslip controller or service exists.
- `dashboard.service.ts` — no payslip queries.
- **Zero occurrences of `payroll`/`payslip` (case-insensitive) in `apps/web/src`** except the two out-of-scope redirect route definitions.
- **Zero occurrences in `apps/api/src`** except one comment in `announcement.service.ts` clarifying that announcements are *"NOT payroll"*.
- **Zero salary, wage, rate, deduction, overtime-pay, or night-differential-pay computations anywhere.** `AttendanceRecord.overtimeHours` records hours only, never money.

**Remnants that still exist (all inert — classified, not removed):**
| Remnant | Location | Classification |
|---|---|---|
| `/payroll` → `/dashboard`, `/payslips` → `/dashboard` | `routeTree.tsx` | **Intentional redirect guards** |
| `Payslip` model + `Employee.payslips` relation + `payslips` table | `schema.prisma`, baseline migration | **Legacy schema, out of scope** |
| `seedPayslips()` — creates 3 months of payslips per seeded employee | `prisma/seed.ts:697–720`, called from `main()` | **Live dead code in the seed** — it still writes gross pay, deductions and net pay rows |
| 4 `payslip.*` permissions incl. *"View own e-payslips"* | `prisma/seed.ts:111, 142–144` | **Out-of-scope permission remnants** |
| `NotificationType.PAYSLIP_RELEASED` | `schema.prisma` | Enum remnant |
| `Permission.module` comment listing `payslip` | `schema.prisma:477` | Comment remnant |
| `SystemSetting` key `payroll_periods_per_month` | `prisma/seed.ts:909` | Seeded setting remnant |
| Mock AI insight referencing *"salary benchmarking"* / *"compensation review"* | `AIPage.tsx` | Mock text touching an out-of-scope domain |

**None of these constitute an active system feature.** The only one that *executes* is `seedPayslips()`, and only when someone runs `npm run db:seed`.

### 41.2 Other exclusions verified absent
- **Applicant accounts / portal / status lookup** — deliberately removed (§14.1); no login, no tokens, no status route.
- **Schedule overrides** — permanently removed from scope; table dropped by migration `20260809200155`.
- **CAPTCHA and antivirus scanning** on public uploads — documented as requiring third-party integrations.
- **Biometric device integration** — HRISense never talks to a device; the Excel hand-off is the boundary.

---

## 42. Source / Documentation Contradictions

Reported, not reconciled. Source priority applied: current code > current schema > migrations > docs.

**C-01 — The public landing page advertises an "Administrator" role that does not exist.**
`LandingPage.tsx:236` presents a role card titled *"Administrator — System & HR Account Management"* with modules *"System Administration, Account Management, Permissions & Roles"*, alongside HR Personnel, Supervisor and Employee. **`PermissionTier` has exactly three values and there is no admin job role.** Reinforced by `packages/shared`'s `SUPER_ADMIN`/`HR_MANAGER`/`DEPARTMENT_HEAD` role union (unused) and by `RecruitmentPolicy`/`SchedulingPolicy` comments calling the `FULL` tier *"Admin / system-level"*. **Directly contradicts Constraint 2.**
*Priority resolution: the code is right (3 tiers); the landing page and the shared package are wrong.*

**C-02 — The HR Dashboard infers "Absent" from missing records.**
`DashboardService.getHRStats` computes `absentToday = totalEmployees − presentToday − onLeaveToday`, while `AttendanceService.getTally` documents and enforces the opposite rule (*"NO automatic Absent inference"*) and the tally UI explains the distinction to users. **Contradicts Constraint 8** in exactly one place — the most visible screen in the system.

**C-03 — Documents describe a supervisor leave-endorsement step that does not exist.**
`HELP_CENTER_ARCHITECTURE.md` lists *"leave request endorsements"* under Supervisor scope; `LandingPage.tsx:238` says the Supervisor *"reviews leave requests"*. **Code:** `PATCH /leave/:id/approve|reject` are both `authorize(['FULL'])`, the supervisor Team tab is `isTeamReadOnly`, and `LeaveStatus.FOR_REVIEW` is never used. The real flow is Employee → HR, single step.

**C-04 — The progress log says the attendance import placeholder was deleted; it is present.**
*"Removed the fake `AttendanceImportPlaceholder` from `DailyMonitoringPage.tsx` … Deleted the unused `AttendanceImportPlaceholder.tsx` component safely."* The standalone component file is indeed gone, but an equivalent modal was re-implemented **inline** in `DailyMonitoringPage.tsx` and is live today. (The current implementation is honest and clearly disabled, so this is a documentation drift, not a functional problem.)

**C-05 — The landing page claims capabilities that are not built.**
*"Training & Compliance — Automated tracking … with expiration alerts"* (no alerting exists — §22.6); *"AI Workforce Assistance — Analyzes centralized data to provide actionable workforce summaries"* (no AI exists — §26); *"Reports & Insights — Role-specific analytics"* (Reports is a mock — §27); *"Generate AI-Assisted Summaries"* in the How-It-Works section.

**C-06 — `HRISENSE_SYSTEM_PROGRESS_AUDIT.md` is badly out of date.**
It states *"The Attendance module is completely mocked on the frontend, with no real connection to the backend"* and lists Medical/Psychological/Audit as *"Disconnected"*. Attendance is now genuinely backend-connected (only ingestion is missing), and Medical/Psychological are fully implemented modules. This July document predates several major phases; it should be marked superseded.

**C-07 — `HRISENSE_CURRENT_SYSTEM_FEATURE_INVENTORY.md` overstates the first-login flow.**
It records *"First-Login Password Change — IMPLEMENTED — None [missing]"*. The flow is broken by three independent defects (§6.4).

**C-08 — `validateHelpRegistry()` asserts stale counts.**
It expects 38 / 35 / 18 / 12; the registry now holds 39 / 36 / 19 / 13. `HELP_CENTER_ARCHITECTURE.md` §2 already documents the newer numbers, so the validator alone is stale. It is never called, so there is no runtime effect.

**C-09 — The schema comment claims 48 job roles; the seed defines 46.**
`schema.prisma:432` — *"All 48 distinct job roles from the Job Roles spreadsheet"*. `seed.ts` `JOB_ROLES` contains 46 (2 `FULL`, 13 `SUPERVISOR`, 31 `STANDARD`). The authoritative `JOB ROLES.xlsx` was not parsed for this review.

**C-10 — Documented HR Officer vs HR Staff separation has no practical effect.**
`RecruitmentPolicy` distinguishes the two for publishing, hiring, rejecting, sensitive emails and onboarding conversion. Because both `HR_OFFICER` and `HR_ASSISTANT` are seeded as `FULL`, and every method ORs in `permissionTier === FULL`, both roles pass every check.

**C-11 — Onboarding is documented as complete; the submit path is broken.**
Multiple documents describe employee onboarding, welcome emails and temporary credentials as working. The code shows no multipart parser on the route, no `employeeNumber` source, and no user/credential creation (§12.2).

### Constraint verification summary
| # | Constraint | Verdict |
|---|---|---|
| 1 | Formal title `HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision` | ✅ **VERIFIED** — verbatim in `package.json`, `index.html`, `LoginPage`, `LandingPage` |
| 2 | No generic system Admin role | ✅ **VERIFIED in the access model** · ⚠ **CONTRADICTED in landing-page copy, `packages/shared`, and policy comments** (C-01) |
| 3 | Payroll/Payslip permanently out of scope | ✅ **VERIFIED** — removed from the runtime; inert schema/seed remnants catalogued (§41) |
| 4 | AI user-facing name is "AI Assistance" | ✅ **VERIFIED** — "Intelligence" survives only in a legacy redirect identifier |
| 5 | Applicants have no HRISense login | ✅ **VERIFIED** — no account, no portal, no status page; status tokens were added then removed by migration |
| 6 | Attendance source: Biometric → Mustard Seedtime → Excel → HRISense | ✅ **VERIFIED as documented intent**; the final hop is not implemented |
| 7 | Official Mustard Seedtime Excel format still pending | ✅ **VERIFIED** — stated in the UI; no columns or parser invented |
| 8 | No AttendanceRecord ≠ Absent | ✅ **VERIFIED in the Attendance module** (`NO_RECORD`, distinct-date tally, explanatory UI copy) · ⚠ **VIOLATED in `DashboardService.getHRStats`** (C-02) |
| 9 | Leave ≠ Day Off | ✅ **VERIFIED** — structurally separate models, modules and semantics |
| 10 | AI assists, never decides | ✅ **VERIFIED** — but only because no AI exists at all; the page presents fabricated analysis as live output (§26.4) |

---

## 43. Known Risks / Technical Debt

Ordered by impact. Severity is my assessment; the evidence is source-based.

| ID | Severity | Risk | Evidence |
|---|---|---|---|
| **R-05** | **CRITICAL** | **Employee creation is broken end-to-end.** `POST /employees` receives `multipart/form-data`, but the route has no multer and only `express.json()`/`urlencoded()` are mounted; `employeeNumber` is neither collected by the form nor generated by the server despite being required+unique; and no `User`, temporary password, or welcome email is created — yet the success screen claims *"The employee account has been successfully created"* and renders an undefined `tempPassword`. This also blocks draft completion, initial schedule assignment, and the applicant→employee link. | `employee.routes.ts:31`, `EmployeeOnboardingPage.tsx` `handleSubmit`, `EmployeeService.create` |
| **S-1** | **CRITICAL** | **`apps/api/.env` is committed to git** with `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `DATABASE_URL`, `BREVO_API_KEY`, `OPENAI_API_KEY`, `HOLIDAY_API_KEY`. Anyone with repository access can forge tokens for any user. | `git ls-files` |
| **R-03** | **HIGH** | **Change-password complexity regex is unsatisfiable.** `/…(?=.*\\d)…/` in a regex literal requires a literal backslash-`d`. Verified by execution: `"Password1!"` → `false`. Every ordinary password is rejected with a misleading message. | `auth.service.ts:347` |
| **R-02** | **HIGH** | **Old-password verification is skipped.** The page sends `currentPassword`; the API reads `oldPassword`. `oldPassword` is always `undefined`, so the `if (oldPassword)` guard never runs. | `ChangePasswordPage.tsx` vs `auth.controller.ts` / `auth.service.ts` |
| **R-01** | **HIGH** | **`mustChangePassword` is lost after a page refresh.** `getMe` omits the field although `UserPayload` declares it, so the forced-change gate stops applying. | `auth.controller.ts::getMe` vs `services/auth.service.ts` (frontend) |
| **R-04** | **HIGH** | **Two unsynchronized supervisor mechanisms.** The app writes `Employee.immediateSupervisorId`; attendance, leave, schedules, compliance, evaluations and documents read `SupervisionLink`, which only the seed populates. App-assigned supervisors get empty teams in half the system. | §8.4 |
| **S-3** | **HIGH** | **`GET /employees/:id` has no authorization.** Any authenticated user can read any employee's government IDs, DOB, address and emergency contacts. | `employee.routes.ts:34`, `EmployeeService.getById` |
| **S-4** | **HIGH** | **Any supervisor can read and write any employee's weekly schedule** — the subordinate check is explicitly noted as missing. | `weekly-schedule.controller.ts` |
| **R-06** | **HIGH** | **Account Management is entirely non-functional** — all 7 controls call `/employees/:id/account/*`, which does not exist. | `AccountManagementPanel.tsx` |
| **R-15** | **HIGH** | **`/ai-assistance` presents fabricated analysis as live output**, including an attrition-risk claim about a named service unit and an "Automated reminder sent" claim. Demo/audience risk. | `AIPage.tsx` |
| **S-2** | **HIGH** | **`.local/` credential reports are tracked in git** despite the `.gitignore` rule (added after the files were committed). | `git ls-files .local` |
| **R-13** | **MEDIUM-HIGH** | **Leave approval invents a 15-day entitlement** when no balance row exists (`totalAllotted: 15`), with no UI to correct it. | `leave.service.ts` approve upsert |
| **R-12** | **MEDIUM** | **`LeaveBalance.pending` drifts negative** — filing never increments it; approval decrements it. | `leave.service.ts` create vs approve |
| **R-10** | **MEDIUM** | **HR Dashboard infers "Absent"** from missing records, contradicting the system-wide rule. | `dashboard.service.ts` |
| **R-07** | **MEDIUM** | **Employee Timeline is permanently empty** — `GET /employees/:id/timeline` does not exist; the error is swallowed. | `EmployeeDetailPage.tsx:83` |
| **R-08** | **MEDIUM** | **Attendance Tally department filter never populates** — `GET /employees/departments` is not a route. | `AttendanceTallyPage.tsx:222` |
| **R-14** | **MEDIUM** | **Dashboard "upcoming trainings" reads the legacy `TrainingAttendee` table**, so nothing from the current Training module appears. | `dashboard.service.ts` |
| **S-6** | **MEDIUM** | **Weak temporary-password generation** (`Math.random()`), while a crypto-strong generator sits unused. | `user.service.ts` |
| **S-7** | **MEDIUM** | **Password-reset token returned in the API response**, with no environment guard. | `auth.service.ts::forgotPassword` |
| **S-8** | **MEDIUM** | **Seeded `FULL`-tier account with the password `"hr"`**, printed to the console. | `prisma/seed.ts::seedHRAdministrator` |
| **R-09** | **MEDIUM** | **Dead sidebar links** — `/notifications` (hardcoded badge `8`) and `/audit` both 404. | `Sidebar.tsx` |
| **R-11** | **MEDIUM** | **Notifications are inert** — endpoints exist, nothing writes them; the TopNav bell is a mock. | §30 |
| **S-9** | **MEDIUM** | **No `trust proxy`**; global rate limiting is skipped entirely in development. | `apps/api/src/index.ts` |
| **R-16** | **LOW-MEDIUM** | **`AUTH_LOGOUT` help guide has `roles: []`** — permanently invisible to every role. | `helpCenter.registry.ts:214` |
| **R-17** | **LOW** | **`validateHelpRegistry()` asserts stale counts** (38/35/18/12 vs 39/36/19/13); never called. | `helpCenter.search.ts` |
| **S-11** | **LOW** | **Repo hygiene** — 10 SQL dumps, a 303 MB zip, and both `dist/` folders are committed. | `git ls-files` |
| **R-18** | **LOW** | **Restore ignores `restoreAccountAccess`** — the user account is never reactivated. | `EmployeeService.bulkRestore` |
| **R-19** | **LOW** | **`packages/shared` is unused and contradictory** — a stale role model that reintroduces `SUPER_ADMIN`. | §40.6 |
| **R-20** | **LOW** | **Mixed UI conventions** — `AccountManagementPanel` and parts of Employees/Attendance use native `alert()`/`confirm()`/`prompt()` instead of the app's toast/dialog system. | multiple |
| **R-21** | **LOW** | **Two live scheduling models** (templates + weekly) increase the chance of divergent behaviour. | §17.1 |
| **R-22** | **LOW** | **zod v3 (API) vs zod v4 (web)** — schemas cannot be shared across the boundary. | `package.json` × 2 |
| **R-23** | **LOW** | **Legacy `/leave` mock is still routable**, showing fabricated employees to anyone who types the URL. | `routeTree.tsx` |

---

## 44. What Still Needs Development

Grouped by the reason the work exists, not by module.

### A. Fix what is broken (highest value — these are regressions in otherwise finished modules)
1. **Employee creation** (R-05) — add multer to `POST /employees`, decide and implement an `employeeNumber` source (generator or form field), create the `User` + temporary password + welcome email, and return `tempPassword` so the success screen stops lying.
2. **Change-password flow** (R-01/R-02/R-03) — fix the regex, align the field name, and return `mustChangePassword` from `getMe`.
3. **Supervisor mechanism unification** (R-04) — pick one (`SupervisionLink` or `immediateSupervisorId`) and make every writer and reader agree. This is a prerequisite for supervisors being useful anywhere.
4. **Account Management** (R-06) — implement the seven `/employees/:id/account/*` endpoints, or repoint the UI at the existing `/users/:id/*` routes.
5. **Employee Timeline** (R-07) — add `GET /employees/:id/timeline` over `AuditLog` filtered by `targetEmployeeId`/`entityId`.
6. **Attendance Tally department filter** (R-08) — point it at `GET /departments?unitId=`.
7. **Leave balance arithmetic** (R-12/R-13) — increment `pending` on filing, and stop inventing `totalAllotted: 15`; add a balance-management screen or require an existing row.
8. **Dashboard honesty** (R-10/R-14) — remove the `absentToday` inference and the fabricated trend; read the current training tables.

### B. Close the security gaps (§35)
Rotate every secret and untrack `apps/api/.env` + `.local/**` (S-1, S-2); add authorization to `GET /employees/:id` (S-3); add the subordinate check to the weekly-schedule controller (S-4); replace `Math.random()` password generation (S-6); gate the reset-token response behind a non-production check (S-7); remove or randomise the seeded `"hr"` password (S-8); set `trust proxy` and keep a floor on dev rate limits (S-9).

### C. Build what the title promises
9. **AI Assistance** — the single largest gap. Needs a backend route/controller/service, a provider client, prompt construction over real attendance/leave/compliance/training data, persistence to `AIInsight`/`AIRequestLog`, and a frontend rewrite that renders real output. Until then, the mock page should be labelled as a preview.
10. **Reports** — replace the mock with real queries; the export infrastructure (ExcelJS + PDFKit) already exists to build on.

### D. Complete the deferred work
11. **Attendance import** — blocked on the official Mustard Seedtime Excel sample. Once received: column mapping, employee matching, duplicate/unmatched handling, punch pairing, and an import-batch model.
12. **Help Center** — 26 guides to author (continuation point: **CP3B-2 — Work Schedule + Holiday + Leave**), then screenshots, then contextual help.
13. **Hospicio policy confirmation** — working weekdays, rest-day patterns, night-shift bounds, flexible/rotating shift rules, chargeable leave-day rules, and leave entitlements. Several code comments explicitly wait on these.

### E. Finish the half-built
14. **Notifications** — either implement creation across leave/evaluation/announcement/compliance events plus a page, or remove the sidebar link and the mock bell.
15. **Audit Logs page** — a read endpoint plus a page; the write side is already comprehensive.
16. **Settings** — implement, or clearly label as coming soon.
17. **Attendance record editing** — a UI for the existing `PUT /attendance/:id`.
18. **Attendance logs** — a writer and an acknowledgement endpoint, or retire the model.
19. **Forgot-password UI** — the backend exists; add the two screens (and fix S-7 first).

### F. Cleanup (safe, low-risk)
20. Correct the landing page (remove the Administrator card; soften the AI/alerts/reports claims).
21. Redirect or remove the legacy `/leave` mock and the unreachable `PerformancePage`.
22. Delete or repopulate `packages/shared`; remove `seedPayslips()` and the `payslip.*` permissions.
23. Untrack `dist/`, the SQL dumps, and the 303 MB zip; move `scratch/` out of the repository.
24. Fix `AUTH_LOGOUT`'s empty `roles` array and refresh `validateHelpRegistry()`'s expected counts.
25. Mark `HRISENSE_SYSTEM_PROGRESS_AUDIT.md` as superseded.

---

## 45. What Still Needs Manual Testing

*No testing was performed for this review. These are the specific things to exercise, ordered by risk.*

### Must verify first — the failure modes predicted by source inspection
1. **Add Employee → Submit.** Expect a failure (empty body / missing `employeeNumber`). Capture the exact API error and confirm whether any employee row is created.
2. **First-login password change.** Log in as a user with `mustChangePassword = true` and try `Hospicio1!`. Expect the complexity error. Then confirm that refreshing the page lets you reach `/dashboard` without changing the password.
3. **Every Account Management button** on a 201 profile — expect 404s.
4. **Employee directory account activate/deactivate toggle** — expect a 404.
5. **Profile → Timeline tab** — expect a permanently empty list.
6. **Attendance Tally → Department filter** — expect an empty dropdown.
7. **Sidebar → Notifications and Audit Logs** — expect dead links.
8. **Log in as a `STANDARD` employee and request `/api/v1/employees/<someone-else's-id>`** — expect the full record, confirming S-3.
9. **Log in as a `SUPERVISOR` and save a weekly schedule for a non-subordinate** — expect it to succeed, confirming S-4.

### Supervisor scope (the R-04 blast radius)
10. Assign a supervisor **through the app** (not the seed), then check as that supervisor: Team Attendance, Team tab on Leave Requests, team schedule assignment, subordinate documents, subordinate compliance, and an evaluation cycle using the `SUPERVISOR` evaluator method. Compare against the Dashboard team widget and the Org Chart, which use the other mechanism.

### Core happy paths (should work; confirm)
11. Login / refresh (leave a tab idle past 15 minutes) / logout / multi-tab behaviour / lockout after 5 failures.
12. Employee directory: search, all 8 filters, sorting, pagination, Excel and PDF export.
13. Org chart as each of the three tiers.
14. Documents: upload, preview, download, edit metadata, replace, delete; verify visibility flags as employee and as supervisor.
15. Recruitment end-to-end: create → publish → apply publicly → acknowledgement email → status transitions → interview scheduling/reschedule/cancel → manual email preview/send/retry → notes → convert to onboarding draft.
16. Public upload hardening: >5 MB file, a `.exe` renamed to `.pdf`, a generic ZIP renamed to `.docx`, three uploads, and the application rate limit.
17. Attendance: calendar, day drawer, all filters, tally with presets, CSV/Excel/PDF export; confirm **No Record** never renders as **Absent** in Daily Monitoring or Tally (and note that the HR Dashboard *does* — R-10).
18. Scheduling: create a shift, edit an **unused** shift (expect in-place mutation), edit a **used** shift (expect version + archive), set a weekly schedule with multiple shifts, verify effective-date continuity, check Coverage and History.
19. Holidays: load Nager.Date suggestions (expect `PENDING`), approve, ignore, add/edit/deactivate a manual entry.
20. Leave: file, overlap rejection, cancel, HR approve (watch `LeaveBalance.pending` go negative — R-12), HR reject without a reason (expect rejection), approve for an employee with **no** balance row (watch `totalAllotted: 15` appear — R-13), batch on behalf as supervisor and as HR.
21. Evaluations: template with weights → cycle with each of the three evaluator methods → draft → submit → finalize with employee access **off** then **on** → confirm the employee sees it only when both `FINALIZED` and visible.
22. Training: create with each of the five targeting modes, capacity enforcement, bulk outcomes, certificate upload/download, and **compliance auto-fulfilment** on completion of a requirement-linked activity.
23. Compliance: create requirements with each scope type; verify status transitions `MISSING → NEEDS_REVIEW → VALID → EXPIRING_SOON → EXPIRED` by moving `expiresAt` and `reminderDays`; confirm applicability changes when an employee's unit/department/job role changes.
24. Medical & Psychological: create, review, upload documents; confirm as an **employee** that `hrNotes` and `hrConfidentialNotes` never appear and that `HR_ONLY` documents cannot be streamed; confirm a **supervisor** has no access at all.
25. Announcements: draft → audience preview → publish → recipient snapshot correctness → read-on-open → unread badge decrement → attachment access as a recipient and as a non-recipient → schedule → archive → read-rate statistics.
26. Help Center as each tier: expect 13 / 5 / 2 `READY` guides and 5 / 3 / 1 categories; open a `METADATA_ONLY` slug directly (expect "Guide not available yet"); open another role's guide (expect "not available for your account"); open a nonsense slug (expect "Guide Not Found"); test Print.

### Environment
27. Email: with `RECRUITMENT_EMAIL_SEND_ENABLED=false` confirm `SIMULATED` rows; with a test recipient confirm redirect; with Brevo enabled confirm real delivery and `providerMessageId`.
28. Confirm no `uploads/**` file is reachable by direct URL.
29. Confirm the global rate limit behaves as expected with `NODE_ENV=production`.

---

## 46. Recommended Continuation Order

**Phase 0 — Secrets (do before anything else).** Rotate `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `BREVO_API_KEY`, `OPENAI_API_KEY`, `HOLIDAY_API_KEY` and the database password; `git rm --cached apps/api/.env` and `.local/**`; add `.env` to `.gitignore`. *(S-1, S-2)*

**Phase 1 — Unbreak the core (nothing else matters until this works).** R-05 employee creation → R-01/R-02/R-03 change-password → R-04 supervisor unification. These three together restore onboarding, first login, and every supervisor-scoped feature.

**Phase 2 — Close the access-control gaps.** S-3 (`GET /employees/:id`), S-4 (weekly schedule), S-6/S-7/S-8 (password handling), S-9 (`trust proxy`).

**Phase 3 — Reconnect the disconnected UI.** R-06 Account Management, R-07 Timeline, R-08 department filter, R-18 restore-account-access, R-09 dead sidebar links.

**Phase 4 — Data honesty.** R-10 dashboard absent inference, R-12/R-13 leave balances, R-14 legacy training read, and the fabricated attendance trend. Then correct the landing-page claims (C-01, C-05).

**Phase 5 — Finish the Help Center.** Continue from **CP3B-2 (Work Schedule + Holiday + Leave)**; fix `AUTH_LOGOUT`'s roles and the stale validator. This is well-scoped, low-risk, and directly improves the demo.

**Phase 6 — Build AI Assistance.** The largest remaining feature and the one the title names. Start read-only and deterministic: summarise real compliance/attendance/leave data, persist to `AIInsight`, and keep every output advisory. Rewrite `AIPage` against the real endpoint.

**Phase 7 — Reports.** Reuse the existing ExcelJS/PDFKit infrastructure; replace the mock.

**Phase 8 — Notifications and Audit Logs.** Either implement both properly or remove their entry points. Both are half-built and currently misleading.

**Phase 9 — Attendance import.** Gated on the Mustard Seedtime sample. Have the import-batch design ready so this is fast when the file arrives.

**Phase 10 — Cleanup.** Legacy `/leave`, `PerformancePage`, `packages/shared`, `seedPayslips()`, `payslip.*` permissions, `dist/`, SQL dumps, the 303 MB zip, `scratch/`, and the superseded audit document.

**Ongoing — Hospicio policy confirmation.** Working weekdays, rest days, night shift, flexible/rotating rules, chargeable leave days, leave entitlements. Several modules are deliberately parked on these answers; nothing should be invented to fill the gap.

---

## 47. Key Files Reference

### Cross-cutting
| Concern | Files |
|---|---|
| Frontend routing | `apps/web/src/routeTree.tsx` · `lib/router.ts` · `main.tsx` |
| Frontend shell | `components/layout/{AppShell,Sidebar,TopNav,GlobalSearch,PageHeader}.tsx` |
| Frontend auth | `providers/AuthProvider.tsx` · `services/api.ts` · `services/auth.service.ts` · `hooks/{useAuth,usePermission}.ts` |
| Backend bootstrap | `apps/api/src/index.ts` · `routes/index.ts` · `config/{env,prisma}.ts` |
| Backend auth/authz | `middleware/{authenticate,authorize,validate,errorHandler}.ts` · `lib/{jwt,password,passwordGenerator}.ts` · `policies/{recruitment,scheduling}.policy.ts` |
| Audit | `lib/audit.ts` · model `AuditLog` |
| Schema & data | `prisma/schema.prisma` · `prisma/migrations/**` · `prisma/seed.ts` · `prisma/seed_hierarchy.ts` |

### Authentication
`pages/Auth/{LoginPage,ChangePasswordPage}.tsx` · `routes/auth.routes.ts` · `controllers/auth.controller.ts` · `services/auth.service.ts` · models `User`, `UserSession`, `PasswordResetToken`, `EmailVerificationToken`

### Dashboards
`pages/Dashboard/{DashboardPage,HRDashboard,SupervisorDashboard,EmployeeDashboard}.tsx` · `components/shared/{MetricCard,AnnouncementsWidget}.tsx` · `routes/dashboard.routes.ts` · `controllers/dashboard.controller.ts` · `services/dashboard.service.ts`

### Employee Management & 201 Profile
`pages/Employees/{EmployeesPage,EmployeeDetailPage,EmployeeOnboardingPage,DraftEmployeesPage,ArchivedEmployeesPage,OrgChartPage}.tsx` · `pages/Employees/components/{AccountManagementPanel,EmployeeEditForm,SupervisorAssignmentDialog,DocumentUploadDialog,DocumentEditMetadataDialog,DocumentReplaceDialog,DocumentDeleteDialog,EmployeeAttendanceProfileTab,EmployeeScheduleProfileTab,EmployeeComplianceProfileTab,EmployeeEvaluationProfileTab,EmployeeTrainingProfileTab,EmployeeMedicalProfileTab,EmployeePsychologicalProfileTab}.tsx` · `routes/{employee,draft,document}.routes.ts` · `controllers/{employee,draft,document}.controller.ts` · `services/{employee,draft,document,supervisor-resolver,search,user,export}.service.ts` · models `Employee`, `User`, `OnboardingDraft`, `EmployeeDocument`, `SupervisionLink`, `AuditLog`

### Organization structure
`components/common/OrgSelector.tsx` · `routes/{unit,department,job-role}.routes.ts` · `controllers/{unit,department,job-role}.controller.ts` · `services/{unit,department,job-role,supervisor-resolver}.service.ts` · `scripts/{fix_org_hierarchy.ts,resolve_all_supervisors.js}` · models `Unit`, `Department`, `JobRole`, `Permission`, `RolePermission`

### Recruitment
`pages/Recruitment/{RecruitmentOverviewPage,JobOpeningsPage,JobOpeningFormPage,JobOpeningDetailPage,ApplicantsPage,ApplicantDetailPage}.tsx` + `components/{ApplicantDocumentsTab,ApplicantInterviewsSection,ApplicantCommunicationsSection,ApplicantOnboardingSection,CommunicationComposerDialog,InterviewFormDialog,OnboardingConversionDialog}.tsx` · `pages/Careers/{CareersLayout,CareersPage,OpeningDetailPage,ApplyPage,ApplicationSuccessPage}.tsx` · `services/{recruitment,public-recruitment}.service.ts` (frontend) · `routes/{recruitment,public-recruitment}.routes.ts` · `controllers/{job-opening,job-application,public-recruitment}.controller.ts` · `services/{job-opening,job-application,interview,applicant-note,applicant-document,applicant-communication,applicant-conversion,recruitment-automatic-communication}.service.ts` · `services/email/*` · `config/recruitment.config.ts` · `policies/recruitment.policy.ts` · `types/recruitment.types.ts` · `lib/recruitment.errors.ts` · models `JobOpening`, `Applicant`, `JobApplication`, `ApplicantDocument`, `ApplicantInterview`, `ApplicationStatusHistory`, `ApplicantNote`, `ApplicantCommunication`

### Attendance
`pages/Attendance/{DailyMonitoringPage,AttendanceTallyPage}.tsx` · `components/ui/CalendarGrid.tsx` · `routes/attendance.routes.ts` · `controllers/attendance.controller.ts` · `services/attendance.service.ts` · models `AttendanceRecord`, `AttendanceLog`, `OrganizationCalendarEntry`

### Shift Catalog & Work Schedule
`pages/Attendance/WorkSchedulePage.tsx` + `components/{ShiftCatalogTab,EmployeeSchedulesTab,ScheduleCoverageTab,ScheduleHistoryTab}.tsx` · `services/api/{schedule,weekly-schedule}.ts` · `routes/{schedule,weekly-schedule}.routes.ts` · `controllers/{schedule,weekly-schedule}.controller.ts` · `services/{schedule,weekly-schedule}.service.ts` · `utils/schedule-validator.util.ts` · `policies/scheduling.policy.ts` · `scripts/migrate_to_shift_definitions.ts` · models `ShiftDefinition`, `EmployeeWeeklySchedule(+Day,+Shift)`, `ScheduleTemplate(+Day)`, `EmployeeScheduleAssignment`, `ScheduleHistoryLog`

### Holiday calendar
`pages/Attendance/HolidayCalendarPage.tsx` · `routes/holiday.routes.ts` · `controllers/holiday.controller.ts` · `services/holiday.service.ts` · model `OrganizationCalendarEntry`

### Leave
`pages/Leave/{LeaveRequestsPage,NewLeaveRequestPage,LeaveCalendarPage,LeavePage(legacy)}.tsx` + `components/EmployeeSelectionPanel.tsx` · `services/api/leave.ts` · `routes/leave.routes.ts` · `controllers/leave.controller.ts` · `services/leave.service.ts` · models `LeaveRequest`, `LeaveBalance`

### Evaluations
`pages/Evaluations/EvaluationsPage.tsx` + `components/{EvaluationTemplateModal,EvaluationCycleModal,EvaluationFormModal}.tsx` · `pages/Employees/components/EmployeeEvaluationProfileTab.tsx` · `services/evaluation.service.ts` (frontend) · `routes/evaluation.routes.ts` · `controllers/evaluation.controller.ts` · `services/evaluation.service.ts` · models `EvaluationTemplate`, `EvaluationCriterion`, `EvaluationCycle`, `EvaluationCycleScope`, `EvaluationAssignment`, `EvaluationResponse`

### Training
`pages/Training/TrainingPage.tsx` + `components/{TrainingActivityModal,TrainingDetailModal}.tsx` · `pages/Employees/components/EmployeeTrainingProfileTab.tsx` · `services/training.service.ts` (frontend) · `routes/training.routes.ts` · `controllers/training.controller.ts` · `services/training.service.ts` · models `TrainingActivity`, `TrainingParticipant`, `TrainingActivityDocument`

### Compliance / Medical / Psychological
`pages/Compliance/CompliancePage.tsx` · `pages/Medical/MedicalPage.tsx` · `pages/Psychological/PsychologicalPage.tsx` · the three matching profile tabs · `services/{compliance,medical,psychological}.service.ts` (frontend) · `routes/{compliance,medical,psychological}.routes.ts` · `controllers/{compliance,medical,psychological}.controller.ts` · `services/{compliance,medical,psychological}.service.ts` · `scratch/test_compliance_medical_psych.ts` · models `ComplianceRequirement`, `ComplianceRequirementScope`, `EmployeeComplianceRecord(+Document)`, `MedicalRecord(+Document)`, `PsychologicalRecord(+Document)`

### Announcements
`pages/Announcements/AnnouncementsPage.tsx` + `components/{AnnouncementWizardModal,AnnouncementDetailModal,AnnouncementRecipientDetailModal,AudiencePreviewModal,RecipientListModal}.tsx` · `components/shared/AnnouncementsWidget.tsx` · `hooks/useAnnouncementUnread.ts` · `services/announcement.service.ts` (frontend) · `routes/announcement.routes.ts` · `controllers/announcement.controller.ts` · `services/announcement.service.ts` · models `Announcement`, `AnnouncementAudienceScope`, `AnnouncementRecipient`, `AnnouncementAttachment`

### Help Center
`pages/HelpCenter/{HelpCenterPage,HelpGuidePage}.tsx` · `helpCenter.registry.ts` · `helpCenter.search.ts` · `helpCenter.types.ts` · `devGuideFixture.ts` · `components/Help*.tsx` (18) · docs `HELP_CENTER_ARCHITECTURE.md`, `HELP_CENTER_FUNCTION_INVENTORY.md`, `HELP_CENTER_BROWSER_AUDIT.md`

### AI / Reports / Settings (mock or placeholder)
`pages/AI/AIPage.tsx` · `pages/Reports/ReportsPage.tsx` · `pages/Settings/SettingsPage.tsx` · `pages/Performance/PerformancePage.tsx` (unreachable) — **no backend counterparts exist**

### Public landing
`pages/Landing/{LandingPage,AnimatedDashboardMockup,CountUp}.tsx` · `apps/web/index.html`

### Notifications (inert)
`routes/notification.routes.ts` (inline handlers, no controller/service) · model `Notification` · `Sidebar.tsx` (dead link) · `TopNav.tsx` (mock dropdown)

---

*End of master review. Documentation only — no application source, configuration, or database was modified in producing this document.*
