# HSJ HRISense — Complete System Reference

> **Status:** reflects the source code as of **10 October 2026**. Since the
> 1 October edition (AI Assistance rebuilt as a role-aware assistant, §20 and
> `HRISENSE_AI_ARCHITECTURE.md`) it also covers Google sign-in and the "I'm not a
> robot" check (§4.1), the rebuilt audit log (§4.7), Standard and Weighted
> Multi-Rater evaluations (§13), Additional Oversight (§6.9), Awards &
> Recognition and Yearly Achievements (§13.5–§13.6), the vacancy-only Careers
> site and new positions (§17), and the updated Help Center (§21). Built by
> reading the current code, not older documentation. The API table, the data
> model and the status lists (Appendices A–C) were **regenerated directly from
> the source on 10 October 2026** and cannot drift from it at the time of
> writing.

---

## 0. How to use this document (read this first if you are an AI)

This file describes **everything HRISense does**: every module, every screen, what
every button does, who may use it, what it changes in the database, what it
notifies, and what it records in the audit log.

**How it is organised**

| Part | What it answers |
|---|---|
| §1 System overview | What HRISense is, who it is for, how it is built |
| §2 Users, roles and permissions | Who can see and do what — the single most important section for answering "can this user…?" |
| §3 Navigation map | Every URL, which module owns it, and who can reach it |
| §4 Shared features | Things on every screen: login, the top bar, search, notifications, quick actions, uploads, the audit log, email |
| §5–§22 Modules | One section per module, always in the same shape (below) |
| Appendix A | Every API endpoint, with who may call it (generated) |
| Appendix B | Every database table and field (generated) |
| Appendix C | Every status value and what it means (generated) |
| Appendix D | Glossary of HR and system terms |
| Appendix E | Known limitations and things the system deliberately does not do |

**Every module section uses the same headings**, so you can jump straight to the
one you need:

- **Purpose** — what problem it solves for Hospicio de San Jose.
- **Who can use it** — per role (HR / Supervisor / Employee).
- **Where** — the URL(s) and the sidebar location.
- **Screens and actions** — each screen, and for each button or control: *what happens when it is pressed*.
- **Rules the system enforces** — validations and business rules, quoted from the error messages the system actually shows.
- **Statuses and lifecycle** — the states a record moves through.
- **Side effects** — notifications sent, audit entries written, emails sent.
- **Related modules** — what it reads from or feeds into.

**Conventions**

- **HR** means a user with permission tier **FULL** (HR Officers). **Supervisor**
  means tier **SUPERVISOR**. **Employee** means tier **STANDARD**. See §2.
- Quoted messages in *italics* are the exact text the system shows the user.
- API paths are written as `/api/v1/...`. The web app lives on port 3000, the API
  on port 5000.
- The business timezone is **Asia/Manila (UTC+8, no daylight saving)**. A "date"
  in HRISense is a calendar date in Manila.
- HRISense is **not a payroll system**. It records attendance, leave and HR data;
  it does not compute pay. (See Appendix E.)

---

## Contents

- [1. System overview](#1-system-overview)
  - [1.1 What HRISense is](#11-what-hrisense-is)
  - [1.2 Who uses it](#12-who-uses-it)
  - [1.3 The organisation as the system models it](#13-the-organisation-as-the-system-models-it)
  - [1.4 Tech stack](#14-tech-stack)
  - [1.5 Design principles you will see throughout](#15-design-principles-you-will-see-throughout)
- [2. Users, roles and permissions](#2-users-roles-and-permissions)
  - [2.1 Accounts](#21-accounts)
  - [2.2 The three permission tiers](#22-the-three-permission-tiers)
  - [2.3 Fine-grained permissions](#23-fine-grained-permissions)
  - [2.4 Reporting lines — who supervises whom](#24-reporting-lines-who-supervises-whom)
  - [2.5 What each tier sees in the sidebar](#25-what-each-tier-sees-in-the-sidebar)
- [3. Navigation map — every screen](#3-navigation-map-every-screen)
  - [3.1 Signed-out screens](#31-signed-out-screens)
  - [3.2 Signed-in screens](#32-signed-in-screens)
  - [3.3 Retired and alias URLs](#33-retired-and-alias-urls)
- [4. Shared features (on every screen)](#4-shared-features-on-every-screen)
  - [4.1 Signing in, sessions and passwords](#41-signing-in-sessions-and-passwords)
  - [4.2 Account administration (HR)](#42-account-administration-hr)
  - [4.3 The app shell: sidebar and top bar](#43-the-app-shell-sidebar-and-top-bar)
  - [4.4 Global search](#44-global-search)
  - [4.5 Quick actions](#45-quick-actions)
  - [4.6 Notifications](#46-notifications)
  - [4.7 The audit log](#47-the-audit-log)
  - [4.8 Files and uploads](#48-files-and-uploads)
  - [4.9 Email](#49-email)
  - [4.10 Settings (`/settings`)](#410-settings-settings)
  - [4.11 Automatic behaviour — there are no background jobs](#411-automatic-behaviour-there-are-no-background-jobs)
  - [4.12 Dates and times](#412-dates-and-times)
  - [4.13 Percentages and their breakdowns](#413-percentages-and-their-breakdowns)
  - [4.14 Rate limits](#414-rate-limits)
  - [4.15 Errors and failed requests](#415-errors-and-failed-requests)
- [5. Dashboard](#5-dashboard)
  - [5.1 HR dashboard](#51-hr-dashboard)
  - [5.2 Supervisor dashboard](#52-supervisor-dashboard)
  - [5.3 Employee dashboard](#53-employee-dashboard)
  - [5.4 Shared on every dashboard](#54-shared-on-every-dashboard)
- [6. Employees](#6-employees)
  - [6.1 Employee Directory (`/employees`, HR)](#61-employee-directory-employees-hr)
  - [6.2 Add Employee — the onboarding wizard (`/employees/onboard`, HR only)](#62-add-employee-the-onboarding-wizard-employeesonboard-hr-only)
  - [6.3 Draft Employees (`/employees/drafts`, HR only)](#63-draft-employees-employeesdrafts-hr-only)
  - [6.4 The employee profile in Employee Management (`/employees/$employeeId`, HR)](#64-the-employee-profile-in-employee-management-employeesemployeeid-hr)
  - [6.5 Edit Profile](#65-edit-profile)
  - [6.6 Archiving and restoring](#66-archiving-and-restoring)
  - [6.7 Reporting line and supervisor override](#67-reporting-line-and-supervisor-override)
  - [6.8 Documents](#68-documents)
  - [6.9 Org Chart (`/employees/org-chart`)](#69-org-chart-employeesorg-chart)
  - [6.10 Organisation structure (units, departments, job roles)](#610-organisation-structure-units-departments-job-roles)
  - [6.11 My Profile (`/profile`, everyone)](#611-my-profile-profile-everyone)
  - [6.12 My Team (`/my-team`, supervisors)](#612-my-team-my-team-supervisors)
- [7. Attendance — Daily Monitoring](#7-attendance-daily-monitoring)
  - [7.1 What each tier sees](#71-what-each-tier-sees)
  - [7.2 Calendar tab](#72-calendar-tab)
  - [7.3 Import tab (HR)](#73-import-tab-hr)
- [8. Attendance import (Mustard Seedtime export)](#8-attendance-import-mustard-seedtime-export)
  - [8.1 The file](#81-the-file)
  - [8.2 The flow](#82-the-flow)
  - [8.3 Review flags — what is caught, and what holds a row](#83-review-flags-what-is-caught-and-what-holds-a-row)
  - [8.4 Matching codes to people, and catching the wrong person](#84-matching-codes-to-people-and-catching-the-wrong-person)
  - [8.5 Test files](#85-test-files)
- [9. Attendance Tally](#9-attendance-tally)
- [10. Holiday & Work Calendar](#10-holiday-work-calendar)
- [11. Work schedules](#11-work-schedules)
  - [11.1 How a day's schedule is decided](#111-how-a-days-schedule-is-decided)
  - [11.2 Screens (Schedule Management)](#112-screens-schedule-management)
  - [11.3 Setting someone's weekly schedule (profile → Schedule)](#113-setting-someones-weekly-schedule-profile-schedule)
- [12. Leave management](#12-leave-management)
  - [12.1 The approval chain](#121-the-approval-chain)
  - [12.2 Leave Requests (`/leave/requests`)](#122-leave-requests-leaverequests)
  - [12.3 New Request (`/leave/new`)](#123-new-request-leavenew)
  - [12.4 Leave Calendar (`/leave/calendar`)](#124-leave-calendar-leavecalendar)
  - [12.5 Leave balances](#125-leave-balances)
  - [12.6 Where approved leave appears — and where it does not](#126-where-approved-leave-appears-and-where-it-does-not)
- [13. Performance evaluations](#13-performance-evaluations)
  - [13.1 Concepts](#131-concepts)
  - [13.2 Screens](#132-screens)
  - [13.3 Filling in an evaluation](#133-filling-in-an-evaluation)
  - [13.4 Hospicio's official evaluation templates](#134-hospicios-official-evaluation-templates)
  - [13.5 Awards & Recognition (`/awards`)](#135-awards--recognition-awards)
  - [13.6 Yearly Achievements (`/achievements`)](#136-yearly-achievements-achievements)
- [14. Training & Seminars](#14-training-seminars)
  - [14.1 The list](#141-the-list)
  - [14.2 Creating or editing an activity (HR)](#142-creating-or-editing-an-activity-hr)
  - [14.3 Managing an activity (the detail view)](#143-managing-an-activity-the-detail-view)
  - [14.4 Where training appears](#144-where-training-appears)
- [15. Compliance](#15-compliance)
  - [15.1 Concepts](#151-concepts)
  - [15.2 The Compliance page (HR)](#152-the-compliance-page-hr)
  - [15.3 Other ways records arrive](#153-other-ways-records-arrive)
  - [15.4 Where compliance shows up](#154-where-compliance-shows-up)
- [16. Medical and psychological records](#16-medical-and-psychological-records)
  - [16.1 Privacy rules (enforced by the API)](#161-privacy-rules-enforced-by-the-api)
  - [16.2 The pages](#162-the-pages)
  - [16.3 Actions (HR)](#163-actions-hr)
  - [16.4 How they feed compliance](#164-how-they-feed-compliance)
- [17. Recruitment and the public Careers site](#17-recruitment-and-the-public-careers-site)
  - [17.1 Lifecycles](#171-lifecycles)
  - [17.2 Recruitment Overview (`/recruitment`)](#172-recruitment-overview-recruitment)
  - [17.3 Job Openings](#173-job-openings)
  - [17.4 Applicants](#174-applicants)
  - [17.5 The public Careers site (no account)](#175-the-public-careers-site-no-account)
  - [17.6 Automatic applicant emails](#176-automatic-applicant-emails)
- [18. Announcements](#18-announcements)
  - [18.1 Lifecycle](#181-lifecycle)
  - [18.2 HR: managing announcements](#182-hr-managing-announcements)
  - [18.3 Everyone: reading](#183-everyone-reading)
- [19. Reports & Analytics](#19-reports-analytics)
- [20. AI Assistance](#20-ai-assistance)
  - [20.1 What each person can ask about](#201-what-each-person-can-ask-about)
  - [20.2 How an answer is produced](#202-how-an-answer-is-produced)
  - [20.3 The page and the chat](#203-the-page-and-the-chat)
- [21. Help Center](#21-help-center)
- [22. Public landing page (`/`)](#22-public-landing-page)
- [Appendix A — API endpoint reference (generated)](#appendix-a-api-endpoint-reference-generated)
- [Appendix B — Data model (generated)](#appendix-b-data-model-generated)
- [Appendix C — Status and option values (generated)](#appendix-c-status-and-option-values-generated)
- [Appendix D — Glossary](#appendix-d-glossary)
- [Appendix E — Known limitations, gaps and findings](#appendix-e-known-limitations-gaps-and-findings)
  - [E.1 Defects](#e1-defects)
  - [E.2 Privacy and security observations](#e2-privacy-and-security-observations)
  - [E.3 Built in the data or API, but not reachable from a screen](#e3-built-in-the-data-or-api-but-not-reachable-from-a-screen)
  - [E.4 Behaviour to be aware of](#e4-behaviour-to-be-aware-of)
  - [E.5 Out of scope by design](#e5-out-of-scope-by-design)
  - [E.6 Tables no code uses](#e6-tables-no-code-uses)
  - [E.7 Found and handled while preparing AI Assistance (1 October 2026)](#e7-found-and-handled-while-preparing-ai-assistance-1-october-2026)
  - [E.8 Found and fixed in the percentage audit (1 October 2026)](#e8-found-and-fixed-in-the-percentage-audit-1-october-2026)
  - [E.9 Hospicio-confirmed HR logic (1 October 2026) — what could not be completed exactly](#e9-hospicio-confirmed-hr-logic-1-october-2026-what-could-not-be-completed-exactly)
  - [E.10 Found and fixed in the My Profile / My Team authorization audit (2 October 2026)](#e10-found-and-fixed-in-the-my-profile-my-team-authorization-audit-2-october-2026)
  - [E.11 Found and fixed in the error-handling sweep (5 October 2026)](#e11-found-and-fixed-in-the-error-handling-sweep-5-october-2026)

---

## 1. System overview

### 1.1 What HRISense is

**HSJ HRISense** is the workforce administration system of **Hospicio de San Jose
(HSJ)**, a charitable care institution in the Philippines. It is a capstone
project built for HSJ's Human Resource Department. Its full name is *"An
AI-Assisted Workforce Administration System with Compliance Decision for
Hospicio de San Jose."*

It replaces paper forms and spreadsheets for:

- keeping one **employee record** per staff member (personal, employment,
  government IDs, documents, licenses);
- **attendance**, imported from the Mustard Seedtime biometric timekeeping device
  and reviewed day by day;
- **work schedules**, **holidays** and **leave** (filing, supervisor endorsement,
  HR approval, balances);
- **performance evaluations**, **training and seminars**;
- **compliance requirements** (e.g. licenses, certificates), **medical** and
  **psychological** records, with expiry tracking;
- **recruitment**, from a public careers site through to converting a hired
  applicant into an employee;
- **announcements**, **notifications**, **reports and analytics**, an **audit log**,
  and **AI Assistance** — a read-only, role-aware assistant for every user.

### 1.2 Who uses it

| Audience | What they do in HRISense |
|---|---|
| **HR Officers** (tier FULL) | Run everything: employee records, onboarding, imports, approvals, compliance, recruitment, reports, settings, audit |
| **Supervisors** — section heads and coordinators (tier SUPERVISOR) | Their own records, plus their team: endorse leave, view team attendance and schedules, evaluations |
| **Employees** — all other staff (tier STANDARD) | Their own profile, attendance, schedule, leave filing, training, announcements |
| **Job applicants** (the public, no account) | Browse openings on the careers site, apply with documents, check their application status by private link |

### 1.3 The organisation as the system models it

- **Units** are the top-level divisions. There are 8: Administrative Services,
  Auxiliary Services, Finance, General Support Services, Health Services, Human
  Resource Department, Pastoral Care / Homelife Services, Social Services.
- **Job roles** belong to one unit. There are 46 in the database. Each job role
  carries a **permission tier** (FULL / SUPERVISOR / STANDARD), which decides
  what everyone holding that role can see and do. There are 2 FULL roles,
  13 SUPERVISOR roles and 31 STANDARD roles.
- **Employees** hold one job role in one unit. There are 49 active and 15 archived.
- **Departments** exist in the data model but currently hold no rows. The
  working hierarchy is **Unit → Job Role → Employee**.
- The **reporting line** (who supervises whom) is worked out automatically from
  the job-role hierarchy. See §2.4.

### 1.4 Tech stack

HRISense is written in **TypeScript end to end**: a React single-page web app,
an Express REST API (`/api/v1`) and a MariaDB database reached through Prisma,
kept together in one npm-workspaces monorepo. Versions are the ones
**installed** (checked 5 October 2026), not just the ranges in `package.json`.

```
                      ┌──────────────── HRISense ────────────────┐
Browser ──HTTP/JSON──►│ Web app (React + Vite)        :3000      │
                      │        │ REST /api/v1, SSE               │
                      │        ▼                                 │
                      │ API (Node.js + Express)       :5000      │──► Brevo        (email)
                      │        │ Prisma ORM                      │──► OpenAI / Anthropic (AI Assistance)
                      │        ▼                                 │──► Nager.Date   (PH public holidays)
                      │ MariaDB (XAMPP)               :3306      │──► Google       (sign-in, reCAPTCHA)
                      └──────────────────────────────────────────┘
```

#### 1.4.1 At a glance

| Layer | Stack |
|---|---|
| **Frontend** | React 19.2 · TypeScript 6.0 · Vite 8.1 · Tailwind CSS 4.3 · TanStack Router 1.170 · axios 1.18 · Radix UI · Recharts 3.9 · framer-motion 12.42 · Sonner 2.0 · lucide-react 1.24 |
| **Backend** | Node.js 22.19 · TypeScript 5.9 · Express 4.22 · Zod 3.25 · Prisma 5.22 |
| **Database** | MariaDB 10.4.32 (the MySQL server bundled with XAMPP) |
| **Authentication and security** | JWT access and refresh tokens · bcryptjs · Helmet · CORS · express-rate-limit · per-browser wrong-password lock · Google Sign-In (ID token, `google-auth-library`) · Google reCAPTCHA v2 |
| **Files, imports and exports** | Multer · file-type · adm-zip · SheetJS (xlsx) · ExcelJS · PDFKit · jsPDF |
| **AI Assistance** | OpenAI (`gpt-4o-mini` by default) or Anthropic (Claude), behind one provider layer |
| **Email** | Brevo transactional email API |
| **External data** | Nager.Date public-holiday API (Philippine holidays) |
| **Live updates** | Server-Sent Events |
| **Testing** | Node's built-in test runner (`node:test`) run through `tsx` — 391 API tests (all passing on 9 October 2026) |
| **Tooling** | npm workspaces · concurrently · nodemon · tsx · Prettier · oxlint · Git with Git LFS |
| **Environment** | Windows · XAMPP (MariaDB) · Node.js 22.19 · npm 11.9 |

#### 1.4.2 Frontend — `apps/web` (port 3000)

**Core**

| Technology | Version | Used for |
|---|---|---|
| React + React DOM | 19.2 | the whole user interface, as a single-page app (`src/main.tsx`) |
| TypeScript | 6.0 | all web code |
| Vite | 8.1 | development server with hot reload, and the production build (`tsc -b && vite build` → `apps/web/dist`) |
| `@vitejs/plugin-react` | 6.0 | React support in Vite |

**Routing, data and state**

| Technology | Version | Used for |
|---|---|---|
| TanStack Router | 1.170 | every page and URL, defined in code (`src/routeTree.tsx`); sign-in guards, a router-level error page and *Page not found* |
| axios | 1.18 | every API call, through one client (`src/services/api.ts`): attaches the access token, refreshes it on 401, request timeouts, the rate-limit toast, readable errors for downloads (§4.15) |
| React context + hooks | — | session (`AuthProvider`), theme (`ThemeProvider`), page data (`useState` / `useEffect` per screen, shared hooks such as `useDashboardOverview`) |
| TanStack Query | 5.101 | provider mounted in `main.tsx`; **no screen uses it yet** |
| TanStack Table | 8.21 | the Employee Directory table |

**User interface and styling**

| Technology | Version | Used for |
|---|---|---|
| Tailwind CSS (+ `@tailwindcss/vite`) | 4.3 | all styling; colours are design tokens in `src/index.css`, redefined for dark mode |
| HRISense component set (`src/components/ui`) | — | buttons, inputs, badges, stat cards, dialogs, tabs, empty and error states — shadcn-style |
| Radix UI — dialog, dropdown menu, tooltip | 1.1 / 2.1 / 1.2 | accessible dialogs, menus and tooltips under those components |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7 / 2.1 / 3.6 | component variants and class merging (`cn()`) |
| lucide-react | 1.24 | icons |
| Google Fonts — **Outfit**, **Plus Jakarta Sans**, **JetBrains Mono** | — | headings, body text, monospace |
| Light / dark theme | — | per account in the app, per visitor on public pages; a script in `index.html` applies it before the first paint |

**Feedback, charts and motion**

| Technology | Version | Used for |
|---|---|---|
| Sonner | 2.0 | toasts (success, warning, error), with a close button |
| Recharts | 3.9 | the HR dashboard trend, Reports, AI Assistance charts, the landing page mock-up |
| framer-motion | 12.42 | page and card transitions, the landing page and the AI companion |

**Validation, dates and documents**

| Technology | Version | Used for |
|---|---|---|
| Zod | 4.4 | client-side validation |
| date-fns | 2.30 | date formatting and arithmetic |
| jsPDF | 4.2 | the onboarding credential sheet, generated in the browser |

**Browser features relied on**

| Feature | Used for |
|---|---|
| `localStorage` / `sessionStorage` | the session (**Keep me signed in** → `localStorage`, otherwise `sessionStorage`), theme, sidebar and AI-companion preferences |
| Streaming `fetch` | the live notification stream (Server-Sent Events with an `Authorization` header, which `EventSource` cannot send) |
| `IntersectionObserver`, `matchMedia` | the landing page companion; the responsive sidebar and theme |
| Clipboard API | **Copy Credentials**, copying a temporary password, an application reference number or a Help Center link |

**Build and quality**

| Technology | Version | Used for |
|---|---|---|
| oxlint | 1.74 | linting (`npm run lint`) |
| TypeScript compiler | 6.0 | `npm run typecheck` |

#### 1.4.3 Backend — `apps/api` (port 5000)

**Core**

| Technology | Version | Used for |
|---|---|---|
| Node.js | 22.19 | runtime |
| TypeScript | 5.9 | all API code; `npm run build` compiles to `dist/`, `npm start` runs it |
| Express | 4.22 | the REST API under `/api/v1`, one error handler and one response envelope (§4.15) |
| Zod | 3.25 | request bodies, queries and parameters (`validate` middleware) and the environment settings (`src/config/env.ts`) |
| dotenv | 16.6 | loading `.env` / `.env.local` |
| Node built-ins | — | `crypto` (tokens, request references, file names), `fs` / `path` (stored files), `node:test` (tests) |

**Data**

| Technology | Version | Used for |
|---|---|---|
| Prisma ORM (`@prisma/client`, `prisma` CLI) | 5.22 | all database access, transactions and migrations; schema in `apps/api/prisma/schema.prisma` (82 models), seed in `prisma/seed.ts` |

**Authentication and security** (§4.1, §4.14)

| Technology | Version | Used for |
|---|---|---|
| `jsonwebtoken` | 9.0 | access tokens (15 minutes) and refresh tokens (7 days), each refresh recorded as a session row |
| `bcryptjs` | 2.4 | password hashing |
| `google-auth-library` | 10.9 | **Continue with Google**: verifies the Google ID token's signature, that it was issued for HRISense (`GOOGLE_CLIENT_ID`) and that the email is verified; it then signs in the existing account with that email (§4.1) |
| Account rules | — | wrong passwords make the failing browser wait (15 s, 30 s, 1 min, then 15 min) and never lock the account; a temporary password must be changed before anything else; reset links expire |
| Helmet | 7.2 | security headers |
| `cors` | 2.8 | only the web app's origin (`CLIENT_URL`) may call the API |
| `express-rate-limit` | 7.5 | per-IP, per-user and per-email limits by request type, kept in memory |
| Role-based access | — | three permission tiers plus module permissions, enforced in the API (`authorize` middleware and record-level checks, §2) |

**Files, imports and exports**

| Technology | Version | Used for |
|---|---|---|
| Multer | 1.4.5 | uploads to disk with random file names; never served as public URLs (§4.8) |
| `file-type` | 16.5 | checks an upload's real content, not just its name |
| `adm-zip` | 0.6 | checks that a DOCX really is a Word document |
| SheetJS (`xlsx`) | 0.20.3 | reading the Mustard Seedtime attendance export (§8) |
| ExcelJS | 4.4 | Excel exports |
| PDFKit | 0.19 | PDF exports |

**Integrations**

| Service | How | Used for |
|---|---|---|
| **OpenAI** | `openai` SDK 4.104; model `gpt-4o-mini` by default | AI Assistance (the default provider) |
| **Anthropic** | Messages API over HTTPS; model `claude-sonnet-5-5` by default | AI Assistance, when `AI_PROVIDER=anthropic` |
| **Brevo** | transactional email API over HTTPS | welcome credentials, password resets and applicant emails; off unless `ENABLE_TRANSACTIONAL_EMAILS` is set (§4.9) |
| **Nager.Date** | public-holiday API over HTTPS (`axios`) | suggested Philippine holidays for the Holiday & Work Calendar (§10) |
| **Google Identity Services** | Google's sign-in button script in the browser; the API verifies the ID token | **Continue with Google** on `/login`, for existing accounts only; on when `GOOGLE_CLIENT_ID` is set (§4.1) |
| **Google reCAPTCHA v2** | the "I'm not a robot" checkbox in the browser; the API checks each token with Google (`siteverify`) using the secret key | every sign-in, every Forgot password request and every public application; on when `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are both set (§4.1, §17.5) |

**Live updates and automation**

| Technology | Used for |
|---|---|
| Server-Sent Events | `/notifications/stream` pushes the unread count; the web app reconnects with back-off and polls as a fallback (§4.6) |
| No background jobs | nothing runs on a timer; automatic behaviour happens when someone uses the system (§4.11) |

**Development and tests**

| Technology | Version | Used for |
|---|---|---|
| tsx | 4.23 | runs TypeScript directly in development, scripts and tests |
| nodemon | 3.1 | restarts the API when a file in `src` changes |
| `node:test` (via `tsx --test`) | — | `npm test` — 327 tests |
| `cross-env` | 10.1 | the migration script's database URL |

#### 1.4.4 Database

| | |
|---|---|
| Engine | **MariaDB 10.4.32** — the MySQL server bundled with **XAMPP**, port 3306 |
| Databases | `hrisense_db` — the system (**93 tables** in the schema, plus Prisma's `_prisma_migrations`); `hrisense_migration_dev_db` — a scratch copy for preparing schema changes and running integration tests |
| Access | only through Prisma; no raw SQL in the application code |
| Schema changes | Prisma migrations (`apps/api/prisma/migrations`): `npm run db:migrate:create` against the scratch database, `db:migrate:deploy` to apply |
| Deletion | soft delete (`deletedAt`) for employees and most records (§1.5) |

#### 1.4.5 AI Assistance

| Part | What it is |
|---|---|
| Provider layer | `services/ai/provider` — OpenAI or Anthropic behind one interface, chosen by `AI_PROVIDER` |
| Tools | role-scoped tools (`services/ai/tools`: self, team, person, HR, knowledge) that read HRISense data **as the asking user**, so the AI never sees more than that person may |
| Knowledge | a bundle built from the Help Center guides and this reference (`npm run ai:knowledge` → `knowledge.generated.json`; rebuilt automatically before `dev` and `build`) |
| Guardrails | input guard (out-of-scope and role-play requests), confidential fields never sent (medical `hrNotes`, psychological `hrConfidentialNotes`), per-user hourly limit (`AI_RATE_LIMIT_PER_HOUR`) |
| Keys | only in the git-ignored `apps/api/.env.local` |

Full design: `docs/HRISENSE_AI_ARCHITECTURE.md` and §20.

#### 1.4.6 Monorepo, tooling and environment

| | |
|---|---|
| Workspaces | npm workspaces: `apps/web`, `apps/api`, `packages/shared` (shared Zod types — present, but neither app imports it today) |
| Running it | XAMPP MySQL first, then `npm run dev` at the root: a pre-flight check that port 5000 is free, then **concurrently** starts the web app and the API |
| Building | `npm run build` — web then API |
| Formatting | Prettier 3.9 (`npm run format`) |
| Configuration | `apps/api/.env` and the git-ignored `.env.local` (secrets, AI keys), validated at start-up; `apps/web` reads `VITE_API_URL` (default `http://localhost:5000/api/v1`) |
| Version control | Git, with **Git LFS** for binary files (images, PDFs, Office documents, archives, SQL dumps) |
| Development machine | Windows, XAMPP, Node.js 22.19, npm 11.9 |

#### 1.4.7 Notes on the dependency lists

- **Installed but not used.** `nodemailer`, `fast-csv`, `uuid` (API) and
  `react-hook-form`, `@hookform/resolvers`, `cmdk`, `vaul` and the `@radix-ui/*`
  packages other than dialog, dropdown menu and tooltip (web) are listed in
  `package.json` but imported nowhere.
- **Used but not declared.** The API's holiday service imports `axios`, which is
  not in `apps/api/package.json`; it resolves only because the web app's copy is
  hoisted to the root `node_modules`.
- **ESLint** is what the API's `lint` script calls, but it is not installed.

### 1.5 Design principles you will see throughout

These recur in every module and explain many behaviours:

1. **The server decides; the browser only asks.** Every permission and rule is
   enforced by the API, whatever the screen shows. Hiding a button is a
   convenience, not the security.
2. **Nothing is inferred that the data does not say.** For example, a day with
   no attendance record is *"No imported record"*, never "Absent". AI Assistance
   may not invent figures.
3. **Soft delete, not destruction.** Employees are *archived* (their `deletedAt`
   is set), not erased. Most records keep their history.
4. **Every consequential action is audited** (see §4.6).
5. **Sensitive records are separated.** Medical `hrNotes` and psychological
   `hrConfidentialNotes` are HR-only and are never sent to AI Assistance —
   not even when HR is the one asking.

---

## 2. Users, roles and permissions

### 2.1 Accounts

- A **User** is a login account (email + password). Most users are linked to one
  **Employee** record; the link is what makes "my" data mean anything.
- A user's powers come from the **job role** of their employee record. Changing an
  employee's job role changes what they can do the next time they sign in.
- There are 64 user accounts. That includes accounts of archived employees; an
  archived employee cannot sign in.

### 2.2 The three permission tiers

Every job role has exactly one tier. The tier is the main switch for access.

| Tier | Who | Data scope |
|---|---|---|
| **FULL** | HR Officer, HR Assistant/Staff, **Sister** | All data for all employees. Passes every permission check automatically. |
| **SUPERVISOR** | Section heads and coordinators | Their own data, plus their direct reports' attendance, schedules and leave (for endorsing). |
| **STANDARD** | All other staff | Their own data only. |

**Sister** is an official Hospicio job role on the **FULL** tier (added 1 Oct
2026). It is organisation-wide — it belongs to no single unit, so it can be
chosen in any unit at onboarding, and its holder keeps their own unit. Its
access comes from the FULL tier alone; no screen or API checks the title
"Sister". Like the HR Officer, a Sister is a **top-level role: no supervisor is
required** — the record is *assigned* with no supervisor, never *pending*, and
no placeholder supervisor is created (§2.4). A Sister
also holds the HR Officer's **final recruitment authority** (publishing openings,
final hire / reject, acceptance and rejection emails, converting a hired
applicant to onboarding) — the one place that authority is decided is the
`FINAL_HR_AUTHORITY_ROLE_CODES` list in the recruitment policy (HR Officer,
Sister). HR Assistant / Staff keep screening and administrative work only.

### 2.3 Fine-grained permissions

Beneath the tiers, each job role is granted permission strings in the form
**`module.action.scope`**. The scope is **OWN**, **SUBORDINATES** or **ALL**.
These are the grants actually stored in the database today:

| Tier | Granted permissions |
|---|---|
| **FULL** | Everything (FULL bypasses permission checks). Includes `employee.*`, `attendance.*`, `leave.*`, `compliance.*`, `medical.*`, `psychological.*`, `performance.*`, `training.*`, `announcement.*`, `reports.read/export`, `audit.read`, `ai.read/create`, `settings.manage`, `users.manage` |
| **SUPERVISOR** | `attendance.read.OWN`, `attendance.read.SUBORDINATES`, `attendance_log.read/update.SUBORDINATES`, `leave.create/cancel/read.OWN`, `training.read.OWN`, `psychological.read.OWN`, `profile.read/update.OWN`, `announcement.read.OWN`, `notification.read/update.OWN`, `activity.read.OWN/SUBORDINATES`, `payslip.read.OWN` |
| **STANDARD** | `attendance.read.OWN`, `leave.create/cancel/read.OWN`, `training.read.OWN`, `psychological.read.OWN`, `profile.read/update.OWN`, `announcement.read.OWN`, `notification.read/update.OWN`, `activity.read.OWN`, `payslip.read.OWN` |

**How the API enforces them** — two kinds of guard (`apps/api/src/middleware/authorize.ts`):

1. **Tier list**, e.g. `authorize(['FULL'])` or `authorize(['SUPERVISOR','FULL'])`.
   Only the listed tiers get through; everyone else gets *"You don't have
   permission to do that. If you need access, contact HR."* (403, code
   `FORBIDDEN`).
2. **Module permission**, e.g. `authorize('employee','read')`. FULL always passes;
   other users must hold a matching permission on their job role.

Many services add a **third, record-level check**: for example, a supervisor may
endorse leave only for their own team — *"You can only endorse leave requests
from your own team members."*

**How the web app uses them** — `hasPermission(module, action)` hides sidebar
items and buttons. It ignores scope, so `training.read.OWN` makes Training
visible. The API still limits the data to the user's own scope.

> `payslip.*` permissions exist in the data but there is no payslip feature:
> `/payroll` and `/payslips` redirect to the dashboard (Appendix E).

### 2.4 Reporting lines — who supervises whom

Each employee has an **immediate supervisor**, worked out automatically by the
supervisor resolver (`services/supervisor-resolver.service.ts`) in this order:

1. If the employee's job role is still marked *pending confirmation* in the
   hierarchy, the assignment stays **PENDING** (reason `UNCLEAR_HIERARCHY`).
2. **Job-role chain** — walk up the role's *parent job role* until a role that
   someone actually holds is found. Result `AUTO_JOB_ROLE`.
3. Otherwise the **department head** role. Result `AUTO_DEPARTMENT_HEAD`.
4. Otherwise the **unit head** role. Result `AUTO_UNIT_HEAD`.
5. If none resolves to exactly one active person, the assignment is **PENDING**
   with a reason: `MISSING_PARENT_ROLE`, `NO_ACTIVE_SUPERVISOR`,
   `UNCLEAR_HIERARCHY` or `MISSING_HEAD_CONFIGURATION`.
6. HR can override the result by hand: `MANUAL_OVERRIDE`.

Before any of this, **top-level roles need no supervisor**: an HR Officer or a
Sister is saved as *assigned* with no supervisor (diagnostic
`NO_SUPERVISOR_REQUIRED`). The list is `NO_SUPERVISOR_REQUIRED_ROLE_CODES` in
the resolver; onboarding preview, the profile, the edit-form preview, the
Directory and the org chart all show *"No supervisor required"* / *"Not
required (top-level role)"* for them. Their leave goes straight to HR.

A supervisor's **team** is the set of employees whose immediate supervisor is
that supervisor (direct reports, active records). Every supervisor-scoped screen
and API uses that set and nothing wider — **My Team** and team member profiles,
team attendance, schedules, leave endorsement, documents, compliance, training,
search and the org chart. A coordinator's staff belong to the coordinator's
team, not to the head above the coordinator; sharing a unit does not make
someone a team member (`OrgHierarchyService.getTeamScopeIds`,
`canAccessEmployeeRecord`).

### 2.5 What each tier sees in the sidebar

| Sidebar item | HR (FULL) | Supervisor | Employee |
|---|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ |
| **My Profile** (your own record, §6.11) | ✅ | ✅ | ✅ |
| **My Team** (your direct reports, §6.12) | — | ✅ | — |
| Employees (All, Add, Drafts, Archived, Org Chart) | ✅ | — | — |
| Recruitment (Overview, Openings, Applicants) | ✅ | — | — |
| Attendance (Daily Monitoring, Tally, Holiday Calendar, Work Schedule) | ✅ | ✅ | ✅ |
| Leave Management (Requests, Calendar, New Request) | ✅ | ✅ | ✅ |
| Evaluations | ✅ | ✅ | ✅ |
| Training & Seminars | ✅ | ✅ | ✅ |
| Awards & Recognition (HR also runs the awards, §13.5) | ✅ | ✅ | ✅ |
| Yearly Achievements (HR also edits, §13.6) | ✅ | ✅ | ✅ |
| Compliance | ✅ | — | — |
| Medical Records | ✅ | — | — |
| Psychological | ✅ | ✅ | ✅ |
| AI Assistance | ✅ | ✅ | ✅ |
| Reports & Analytics | ✅ | — | — |
| Announcements, Notifications | ✅ | ✅ | ✅ |
| Audit Logs | ✅ | — | — |
| Settings, Help Center | ✅ | ✅ | ✅ |

What a visible item shows still depends on the tier. For example, a Supervisor
opening Daily Monitoring sees *My Attendance* and *Team Attendance*; an Employee
sees only their own.

HR-only screens are also guarded at the URL. Employee Management
(`/employees`, `/employees/onboard`, `/employees/drafts`, `/employees/archived`
and `/employees/$employeeId`) is HR's: anyone else opening it lands on their own
equivalent — **your own record → My Profile**, a **supervisor → My Team** (a
person's page → `/my-team/$employeeId`), an **employee → My Profile**. `/audit`
redirects to `/dashboard`. The API applies the same rules to every request, so
changing a URL or an ID never reaches a record the screen would not show.

---

## 3. Navigation map — every screen

### 3.1 Signed-out screens

| URL | Screen | Section |
|---|---|---|
| `/` | Public landing page | §22 |
| `/careers` | Public careers site — only the positions open now | §17 |
| `/careers/$openingSlug` | One job opening's details | §17 |
| `/careers/$openingSlug/apply` | Application form | §17 |
| `/careers/application-success` | Confirmation after applying | §17 |
| `/careers/application-status/$statusToken` | Applicant checks their status by private link | §17 |
| `/login` | Sign in | §4.1 |
| `/forgot-password` | Request a password-reset email | §4.1 |
| `/reset-password` | Set a new password from the emailed link | §4.1 |
| `/change-password` | Forced password change (signed in, but required) | §4.1 |

### 3.2 Signed-in screens

All of these require being signed in. Going to any of them while signed out
sends you to `/login`.

| URL | Screen | Who | Section |
|---|---|---|---|
| `/dashboard` | Dashboard (differs per tier) | All | §5 |
| `/profile` | **My Profile** — your own record, Edit My Profile | All | §6.11 |
| `/my-team` | **My Team** — your direct reports | Supervisors (HR → `/employees`; employees → `/profile`) | §6.12 |
| `/my-team/$employeeId` | **Team Member Profile** — one direct report's work profile | Supervisors, for their direct reports (the API refuses anyone else) | §6.12 |
| `/employees` | Employee directory (Employee Management) | HR only — supervisors redirected to My Team, employees to My Profile | §6 |
| `/employees/onboard` | Add Employee (onboarding wizard) | HR only — others redirected (as above) | §6 |
| `/employees/drafts` | Draft (unfinished) onboardings | HR only | §6 |
| `/employees/archived` | Archived employees | HR only | §6 |
| `/employees/org-chart` | Organisation chart | All (the route, the API and its Help Center guide are open to every tier; the sidebar lists it under Employees, which only HR sees) | §6 |
| `/employees/$employeeId` | Employee profile in Employee Management | HR only — your own ID opens My Profile; a supervisor's report opens in My Team | §6.4 |
| `/attendance/daily` | Daily Monitoring, with the **Import** tab for HR | All (scope by tier) | §7 |
| `/attendance/import` | The attendance import on its own page (kept for old links; the same content is a tab in Daily Monitoring) | HR | §8 |
| `/attendance/tally` | Attendance tally and exports | All (scope by tier) | §9 |
| `/attendance/holiday-calendar` | Holiday and organisation calendar | All (HR edits) | §10 |
| `/attendance/schedule` | Work schedules: shift catalog, weekly schedules, coverage, history | All (HR edits) | §11 |
| `/leave/requests` | Leave requests list and decisions | All (scope by tier) | §12 |
| `/leave/new` | File a leave request | All | §12 |
| `/leave/calendar` | Leave calendar | All (scope by tier) | §12 |
| `/evaluations` | Performance evaluations | All (scope by tier) | §13 |
| `/training` | Training and seminars | All (HR manages) | §14 |
| `/awards` | Awards & Recognition — My Awards for everyone; Manage Awards, Voting Groups and Hall of Fame for HR | All (HR tabs for HR) | §13.5 |
| `/achievements` | Yearly Achievements — one page per year | All (published years; HR also sees drafts and edits) | §13.6 |
| `/achievements/$pageId` | One year's achievements | All for a published year; a draft opens for HR only (others get *not found*) | §13.6 |
| `/compliance` | Compliance requirements and records | HR | §15 |
| `/medical` | Medical records | HR | §16 |
| `/psychological` | Psychological records | All (own records for non-HR) | §16 |
| `/recruitment` | Recruitment overview | HR | §17 |
| `/recruitment/openings` (`/new`, `/$id`, `/$id/edit`) | Job openings | HR | §17 |
| `/recruitment/applicants` (`/$applicationId`) | Applicants and one application | HR | §17 |
| `/announcements` | Announcements | All (HR publishes) | §18 |
| `/notifications` | Notifications list | All | §4.6 |
| `/reports` | Reports & Analytics | HR | §19 |
| `/ai-assistance` | AI Assistance (assistant for all; Workforce summary tab for HR) | All (answers scoped by tier) | §20 |
| `/audit` | Audit logs | HR only — others redirected to the dashboard | §4.7 |
| `/settings` | Settings | All | §4.10 |
| `/help-center`, `/help-center/$guideSlug` | Help Center and its guides | All | §21 |

### 3.3 Retired and alias URLs

These URLs exist only so old links keep working:

| URL | Goes to | Why |
|---|---|---|
| `/attendance` | `/attendance/daily` | Module landing |
| `/leave` | `/leave/requests` | Module landing |
| `/performance` | `/evaluations` | Old name |
| `/ai`, `/ai-intelligence` | `/ai-assistance` | Old names |
| `/help` | `/help-center` | Old name |
| `/payroll`, `/payslips` | `/dashboard` | **Payroll is not part of HRISense** (Appendix E) |

---

## 4. Shared features (on every screen)

### 4.1 Signing in, sessions and passwords

**Sign in (`/login`)** — email and password.

- **Wrong passwords never lock the account.** Locking accounts would let anyone
  who knows an email keep its owner out on purpose. Instead the **browser that
  is failing** waits (`services/sign-in-lock.ts`): the sign-in page sends a
  random browser id (`X-Browser-Id`, kept in local storage), and each wrong
  sign-in from that browser on that network locks it for longer — **15 seconds,
  30 seconds, 1 minute, then 15 minutes** for every further one. The response
  carries `Retry-After`, and the button counts down (*"Try again in 15s"*).
  While the wait runs, every attempt is refused before anything else is checked
  (429, `SIGN_IN_LOCKED`, *"Too many wrong sign-in attempts. Please try again in
  N seconds/minutes."*). A successful sign-in clears that browser's failures;
  otherwise they are forgotten an hour after the last one. Another browser — the
  owner's — is unaffected. Requests with no valid browser id share one wait per
  network. The waits are kept in memory, like the rate limiters, so an API
  restart clears them. The account's failed-attempt count is still kept for
  HR's account panel, but never locks it.
- An account HR locked on purpose (**Lock**, §4.2) is refused: *"Account is
  temporarily locked. Try again in N minute(s)."*
- A deactivated account is refused: *"Your account has been deactivated. Contact HR."*
- A wrong email or password shows the same message for both, *"Invalid email or
  password"*, and both start the same wait, so the screen does not reveal which
  accounts exist.
- A successful sign-in resets the failure count and creates a **session**.
- Every attempt is audited: `LOGIN_SUCCESS` or `LOGIN_FAILED`.
- **"I'm not a robot" on every sign-in** (reCAPTCHA v2 checkbox, when
  `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are set in
  `apps/api/.env.local`). The checkbox is on the sign-in page from the start, and
  the button reads **Please finish the CAPTCHA** and cannot be pressed until it is
  ticked. A token works once, so the box clears after every failed attempt. The
  API refuses a sign-in without a valid token before checking the password
  (*"Please tick "I'm not a robot" to continue."*, `CAPTCHA_REQUIRED`; an expired
  or rejected one is `CAPTCHA_FAILED`). The same checkbox is required on
  **Forgot password** and on the public job application. The server checks each
  token with Google (`siteverify`) using the secret key, which never leaves the
  server; if Google cannot be reached the request is refused, not waved through
  (`CAPTCHA_UNAVAILABLE`). Google sign-in has no checkbox (Google checks for bots
  itself). `GET /api/v1/auth/captcha-config` gives pages only
  `{ enabled, siteKey }`.

**Continue with Google (optional)** — below the form, when the server has a
Google Client ID (`GOOGLE_CLIENT_ID` in `apps/api/.env.local`). It is an extra way
into an **existing** account, never a way to create one:

- Google's button returns a signed **ID token**; the browser posts only that to
  `POST /api/v1/auth/google` (with `X-Requested-With: XMLHttpRequest`). The API
  verifies it with **Google's public keys** (signature, issuer, audience = our
  Client ID, expiry) and requires **`email_verified`**. An email sent by the
  browser is never used. No Client Secret is involved and Google issues HRISense
  no access or refresh token.
- The verified Google email must equal the account's **personal (login) email**
  (case does not matter). Otherwise the page warns: *"No HRISense account is
  registered with this Google email. HRISense is only for Hospicio de San Jose
  employees — if you are not one, please do not sign in: repeated sign-ins with
  unregistered emails from this network will be blocked. Employees: please
  contact HR."* An archived account gets the same answer, so nothing more is
  revealed. Audited as `GOOGLE_LOGIN_UNREGISTERED` (with the attempted email and
  IP, for HR's security review).
- **The block is real:** after **5** Google sign-ins with unregistered emails from
  one IP within **30 minutes**, Google sign-in from that IP is refused until the
  window ends (*"Google sign-in is blocked on this network for a while…"*) —
  employees on the same network included, so they use email and password
  meanwhile. Audited once per block as `GOOGLE_LOGIN_BLOCKED`. Adjustable with
  `RATE_LIMIT_GOOGLE_UNREGISTERED_MAX` / `_WINDOW_MINUTES`.
- Every rule of a password sign-in still applies: a **locked** or **deactivated**
  account is refused (same messages); the **permission tier** comes from the
  HRISense job role, never from Google; a **temporary password must still be
  changed first** (the API enforces it as above); **Keep me signed in** works the
  same way. When the server rejects a Google token it logs only the reason
  (e.g. *No pem found for envelope*), never the token or the email.
- HRISense then issues its **own normal session** (same tokens, same refresh,
  same sign-out). Audited as `GOOGLE_LOGIN_SUCCESS`, or `GOOGLE_LOGIN_FAILED` with
  the reason (`ACCOUNT_LOCKED` / `ACCOUNT_DEACTIVATED`) — never a token.
- It counts against the same per-IP sign-in rate limit as passwords.
- Closing Google's popup does nothing; a failure shows a message and the form
  stays usable. If Google's script cannot load, the page says so and password
  sign-in carries on.
- Google Cloud (local development): **Authorized JavaScript origins**
  `http://localhost:3000` and `http://localhost`; **no redirect URI**. While the
  OAuth consent screen is in *Testing*, only its listed test users can sign in.

**Sessions** — the web app holds a short-lived **access token (15 minutes)** and a
**refresh token (7 days)** stored as a session row. When the access token expires,
the app quietly swaps the refresh token for a new one (`POST /auth/refresh`).
**Log out** deletes the session (`LOGOUT` audited). Deactivating, locking or
resetting an account ends its sessions. Every API request also re-reads the
account, so a **deactivated account is refused on its very next request**, not
when its access token expires.

**Forced password change (temporary passwords)** — a new account, or one HR has
reset or flagged, must change its temporary password first. Signing in still
works, but goes straight to *Change Your Temporary Password* (`/change-password`,
showing the registered email masked, e.g. `m***@gmail.com`), and:

- every other screen redirects back there — typing `/dashboard`, `/employees`,
  `/settings` or any other address does not get past it;
- **the API itself refuses** every other request with **403**
  `PASSWORD_CHANGE_REQUIRED` — only `POST /auth/change-password`,
  `GET /auth/me` and `POST /auth/logout` are allowed — so the rule cannot be
  bypassed by calling the API directly;
- **Sign out** is available on the screen.

Once the new password is saved, the flag clears and HRISense opens; the same
session keeps working. Email verification codes (OTP) for password changes are
**not yet in place** — planned once email delivery is set up beyond local
development.

**Forgot password (`/forgot-password`)** — enter an email and tick *"I'm not a
robot"* (when reCAPTCHA is on; the button reads **Please finish the CAPTCHA**
until then). If an account exists,
a reset link valid for **60 minutes** is emailed (`PASSWORD_RESET_REQUESTED`
audited). The screen responds the same way whether or not the email exists.

**Reset password (`/reset-password`)** — opened from the emailed link. Sets a new
password, invalidates the link and ends all sessions (`PASSWORD_RESET`). An
expired or used link: *"This password reset link is invalid or has expired.
Request a new one."*

**Change password** (Settings → Security, or the forced screen) — needs the
current password and a new one of at least **8 characters** that differs from
the old, so a signed-in browser cannot change a password with its token alone.
Rules: *"The current password you entered is incorrect."*, *"Your new password
must be different from your current password."* On success the password is
replaced, the temporary-password flag is cleared, and **every other session of
the account is signed out** (other browsers and devices must sign in with the new
password); the session that made the change stays signed in. Audited as
`PASSWORD_CHANGED` (whether a temporary password was replaced, how many other
sessions were signed out); a wrong current password is audited as
`PASSWORD_CHANGE_FAILED`. No password or token is ever written to the audit log.
At most 5 attempts per 15 minutes (§4.14).

### 4.2 Account administration (HR)

On an employee's profile, HR manages that person's login account
(`/api/v1/employees/:id/account/...`):

| Action | What happens |
|---|---|
| **Activate** | The account can sign in again (`ACTIVATE_USER`) |
| **Deactivate** | Blocks sign-in and ends their sessions (`DEACTIVATE_USER`). *"You cannot deactivate your own account."* |
| **Lock / Unlock** | Temporarily blocks or restores sign-in (`ACCOUNT_LOCKED` / `ACCOUNT_UNLOCKED`). *"You cannot lock your own account."* |
| **Force password change** | They must change their password at next sign-in; emails them (`FORCE_PASSWORD_CHANGE`) |
| **Reset password** | Issues new temporary credentials by email and forces a change at next sign-in (`RESET_PASSWORD`) |

An employee without a login shows: *"This employee does not have a HRISense
login account."* Accounts are created during onboarding (§6), which sends a
welcome email with credentials.

### 4.3 The app shell: sidebar and top bar

**Sidebar** — the grouped menu from §2.5. Badges show live counts: **Draft
Employees** (unfinished onboardings, HR), **Archived Employees** (HR),
**Announcements** (unread) and **Notifications** (unread, "99+" above 99).

- **Desktop (1024 px and wider)** — the collapse button in the sidebar header
  shrinks it to a 72 px icon rail and back; the choice is remembered on this
  device. Collapsing or expanding **never changes the page**. In the rail every
  item is a 40 × 40 icon with a tooltip; a group (Employees, Recruitment,
  Attendance, Leave Management) opens a small menu of its pages to the right.
- **Phones and tablets (below 1024 px)** — ☰ opens the sidebar as a drawer. The
  drawer is always the full menu (it never collapses) and has a **Close** (✕)
  button. It closes when you pick a page, tap outside it, press **Esc**, or
  widen the window to desktop size.
- **Search menu** filters the menu by page name.

**Top bar**, left to right:

| Control | What it does |
|---|---|
| ☰ menu (small screens) | Opens the sidebar as a drawer |
| AI status indicator | Shows whether AI Assistance is configured on this server |
| ☀/☾ theme toggle | Switches light/dark mode; remembered on this device |
| 🔔 bell (with unread count) | Opens the latest notifications. Clicking one marks it read and opens the page it links to. **View all** opens `/notifications` |
| Profile menu | **My Profile** (`/profile`, your self-profile — for HR and Sister too), **Settings**, **Sign Out** |

### 4.4 Global search

The search box looks up people by name, employee number, email, job role or
unit (`GET /api/v1/search?q=`). What it can return depends on the tier:

| Tier | Results |
|---|---|
| HR | Active employees, archived employees, and draft onboardings |
| Supervisor | Themselves and their direct reports only |
| Employee | Themselves only |

### 4.5 Quick actions

A **Quick actions** menu offers shortcuts matched to the tier:

- **HR:** Add Employee, Leave Requests (review and decide), Compliance, Attendance
  (Daily Monitoring), Training, Reports, Announcements, AI Assistance.
- **Supervisor:** My Team, Leave Requests (endorse your team's leave), Team
  Attendance, Schedules, Evaluations, Training, Announcements, AI Assistance.
- **Employee:** File Leave Request, My Profile, My Schedule, Training & Seminars,
  Announcements, AI Assistance.

### 4.6 Notifications

A notification is a short message to **one user**, with an optional link to the
relevant page.

**Delivery** — stored in the database and pushed **live**: the web app keeps a
stream open (`GET /notifications/stream`) that sends the unread count
whenever it changes, so the bell updates without refreshing. The token travels
in a header, never in the URL.

**Notifications page (`/notifications`)** — the full list with **All / Unread**
filters, **Refresh**, **Mark all read**, and paging. Clicking an item marks it
read and follows its link.

**What actually raises a notification today:**

| Type | Raised when | Goes to |
|---|---|---|
| `LEAVE_FILED` | A leave request is filed, or a supervisor endorses one | The approver in the chain (supervisor, then HR) |
| `LEAVE_APPROVED` | HR approves a leave request | The employee |
| `LEAVE_REJECTED` | A supervisor or HR rejects a leave request | The employee |
| `BIRTHDAY_REMINDER` | An employee's birthday is within the next **7 days** | HR and that person's supervisor |
| `ANNOUNCEMENT` | Someone shares a calendar note with others | The recipients |
| `SYSTEM` | An automatic recruitment email fails to send | HR |

`EVALUATION_ASSIGNED`, `EVALUATION_SUBMITTED`, `COMPLIANCE_ALERT`,
`ATTENDANCE_ALERT`, `TRAINING_REMINDER`, `AI_INSIGHT` and `PAYSLIP_RELEASED`
exist as types but **nothing in the system raises them yet** (Appendix E).
Announcements have their own separate unread mechanism (§18).

### 4.7 The audit log

Every consequential action writes an **audit entry**: who did it (user, and the
employee affected where relevant), **when**, the **action**, the **record type
and id**, the **values before and after**, the **IP address** and the **browser**.

Audited areas: sign-in and passwords; accounts; employees, documents,
supervisors, additional oversight, job roles and onboarding drafts; attendance
edits and imports; leave (filed, endorsed, approved, declined, cancelled, filed
on someone's behalf) and balances; evaluations and evaluation forms; training;
compliance; medical and psychological records; recruitment; announcements and
calendar notes; awards and Yearly Achievements; and data-maintenance scripts.
Schedule templates, weekly schedules and the holiday calendar keep their own
history (`schedule_history_logs`), which the Audit Logs screen shows alongside.

**Audit Logs screen (`/audit`, HR only — page and API)**

- **Tabs**, each with a count: **All Changes** (opens by default), Employees,
  Attendance & Schedules, Leave, Evaluations, Training & Compliance, Recruitment,
  Announcements & Communication, Awards & Achievements, System & Settings, and
  **Security & Authentication**. A tab appears only when it has events.
- **All Changes** is every event except Security & Authentication. Sign-ins and
  sign-outs (password or Google), failed sign-ins, password and account changes
  (lock, unlock, activate, deactivate, temporary passwords), opening applicant
  documents and AI-assistant record look-ups are kept under **Security &
  Authentication** — retained, but not mixed into the change history.
- **Filters**: module, action type (Create, Update, Delete / remove, Archive,
  Restore, Approve / endorse, Reject / decline, Finalize / close, Publish,
  Assign, Upload, Import, Status change, Submit, Review, Send, and the sign-in
  types — only those that occur), performed by (or *System*), target / record,
  result (successful / failed, where failures exist) and a date range in
  Philippine days. **Search** covers people's names, action words, modules,
  record titles and references. Filtering and paging run on the server.
- Each row is a **sentence**, e.g. *"Human Resource Officer approved the leave
  request “Vacation leave, Dec 1, 2026 – Dec 2, 2026” of Juan Dela Cruz."*
- **Detail panel**: performed by, date and time, module, action, the employee or
  applicant, the record, and the **before / after values the entry recorded** —
  nothing is filled in. Values recorded on one side only are listed as recorded,
  not as a change. Passwords, tokens, one-time codes and confidential notes are
  never shown; government ID numbers show only that they changed; **medical and
  psychological** entries show that a record changed, never its contents. IDs,
  the event code and the IP address sit under *Technical reference*.
- Employee profile edits record the **fields that changed** with their before
  and after values (since 9 Oct 2026; earlier entries show the submitted values).
- On phones the tabs scroll, the filters open from a **Filters** button, and rows
  become cards.

Audit entries cannot be edited or deleted from the app.

### 4.8 Files and uploads

- Allowed types are **PDF, JPG, PNG, WEBP, DOC and DOCX**. Executables and
  scripts (`.exe .sh .bat .cmd .js .ts .php .py .msi`) are refused by
  extension, whatever their claimed type. The size limit is **5 MB** unless a
  feature says otherwise.
- Stored files get a **random name**, so a stored file's name reveals nothing
  about it. The original name is kept separately for display.
- Files are **never served as public URLs**. Every download goes through a
  signed-in API endpoint that checks the caller may see that record.
- A file over the limit is refused with **413** (`FILE_TOO_LARGE`) and a message
  naming the limit where the uploader declares one (*"This file is larger than
  the 5 MB limit. Choose a smaller file."*). If the database work after an
  upload fails, the stored file is removed; a cleanup that fails is logged,
  never hidden.
- A download that arrives **empty** is refused by the web app (*"The file came
  back empty, so nothing was saved."*) — no export or document is saved as a
  blank file and reported as done.

### 4.9 Email

Sent through **Brevo** only when `ENABLE_TRANSACTIONAL_EMAILS` is on (by default
only in production). Otherwise a development provider logs the email instead of
sending it. The emails HRISense sends:

- **Welcome, with login credentials** — when onboarding creates an account.
- **Reset credentials** — when HR resets someone's password.
- **Password-reset link** — from Forgot Password.
- **Recruitment messages to applicants** — from templates (§17); a failure is
  audited (`AUTOMATIC_EMAIL_FAILED`) and HR is notified.

### 4.10 Settings (`/settings`)

Five cards:

- **My Profile** — *Open* goes to your own employee record.
- **Security** — **Change password** (§4.1). Mismatched new passwords: *"The two
  new passwords do not match."* Success: *"Your password has been updated."*
- **Appearance** — light or dark theme, remembered on this device.
- **HRISense buddy** — **Show buddy** / **Hide buddy** for the AI helper at the
  edge of the screen, remembered on this device.
- **Notifications** — opens your notifications.

### 4.11 Automatic behaviour — there are no background jobs

HRISense deliberately runs **no cron jobs or background schedulers**. Everything
time-based is worked out when someone looks:

- **Birthday reminders** are raised when a dashboard loads. An event key makes
  them idempotent — one notification per person per birthday.
- **Announcement status** (scheduled, published, expired) is derived on every
  read from its publish and expiry times (§18).
- **Compliance expiry** (expiring soon, expired) is computed from dates when
  records are read (§15).

### 4.12 Dates and times

The business timezone is **Asia/Manila (UTC+8, no daylight saving)**. Punch times
are stored as true instants and displayed in Manila time. A "date" is a Manila
calendar date, so an event late at night UTC is counted on the correct Manila
day.

### 4.13 Percentages and their breakdowns

Every percentage HRISense shows follows one set of rules (`lib/percent.ts` in both
the API and the web app):

- A rate is **part ÷ whole × 100**, shown to at most one decimal place (profile
  completion is shown as a whole number).
- When the whole is zero there is **no percentage**: the screen says *No data* or
  *Not applicable*, never 0%, NaN or 100%.
- The parts of one whole (read/unread, a report's categories, completion
  criteria) are rounded by the largest-remainder method, so the parts shown add
  up to exactly the total shown. The counts themselves are never changed.
- Unrelated rates are never added together.

Wherever a percentage is a headline figure there is a **View breakdown** button
(or, on charts, **View data**). It opens a panel with the formula filled in with
the real numbers, every item that went into it, with status shown as text and
colour, a TOTAL row, and notes on anything left out and why. The panels on each
screen:

| Screen | Figure | What the breakdown shows |
|---|---|---|
| Employee profile, Employee Directory | Profile completion | Each criterion: Complete / Partly complete / Missing / Not applicable, points earned of its weight, its share of the 100% (§6.4) |
| HR dashboard | Attendance trend | Per month: presence records (present, late, half day), explicit absent records, other records, the rate |
| Employee dashboard | Leave balances | Allotted, used, pending, forfeited, available, available ÷ allotted |
| Announcement detail (HR) | Read / unread | Read and unread recipients, both shares, total 100% |
| Evaluation (finalized) | Overall score | Each criterion's rating, weight and contribution; the total equals the stored score |
| AI Assistance — workforce summary | Records showing presence, training completion | Counts per attendance status / training outcome, which are in the numerator and denominator, and what is excluded |
| Draft employees | Draft completion | The 15 tracked onboarding fields, filled or not |
| Reports & Analytics | Every chart | **View data**: category, count, share of the total, TOTAL row |
| Training | Capacity | Assigned ÷ capacity (may exceed 100% — the bar stops at full, the text does not) |

Figures that are **not** shares of a whole are labelled so they are not read as
percentages: the import's identity check shows a **name similarity 0–100**
score (§8), the password bar is *N of 5 requirements met*, onboarding shows
*N of M steps done*, and uploads show bytes sent.

### 4.14 Rate limits

HRISense limits how fast requests may arrive, **on the server** (the web app
only shows the message). Limits stop floods, password guessing, spam and
runaway automation; they never grant or replace a permission — a refused
request is still refused when its limit resets.

When a limit is reached the API answers **429 Too Many Requests** with a
`Retry-After` header and *"Too many requests. Please try again shortly."* (or a
more specific line for sign-in, uploads, exports and applications). The web app
shows that as a single message. No addresses, counters or internals are sent.

| Category | Example endpoints | Limit (production) | Counted per | Window |
|---|---|---|---|---|
| Global API | every `/api/v1` request (not the notification stream) | 5,000 | IP | 15 min |
| Sign-in | `POST /auth/login` | 10 per email + 100 overall | IP + email, and IP | 15 min |
| Google sign-in | `POST /auth/google` | 100 overall (the sign-in limit) + **5 attempts with a Google email that has no account** — past that, Google sign-in from that address is refused (password sign-in still works) | IP | 15 min; 30 min |
| Password recovery | `POST /auth/forgot-password`, `POST /auth/reset-password` | 10 | IP | 15 min |
| Token refresh | `POST /auth/refresh` | 600 | IP | 15 min |
| Password change | `POST /auth/change-password` | 5 | signed-in user | 15 min |
| Authenticated reads | any other `GET` | 1,500 | signed-in user | 5 min |
| Database writes | any `POST` / `PUT` / `PATCH` / `DELETE` (employees, leave, evaluations, training, compliance, medical/psych, recruitment, job openings, announcements, schedules, holidays, accounts, bulk actions) | 300 | signed-in user | 5 min |
| Search | `GET /search`, any list with `search=` | 120 | signed-in user | 1 min |
| Uploads | any file upload (documents, compliance / medical / psych files, attachments, onboarding) | 40 | signed-in user | 10 min |
| Imports | `POST /attendance/imports…` (upload and decisions) | 20 | signed-in user | 10 min |
| Reports | `GET /reports/:key` | 120 | signed-in user | 10 min |
| Exports | any `…/export…` (Excel, PDF, CSV) | 20 | signed-in user | 10 min |
| AI | `/ai/assistant/*` questions | `AI_RATE_LIMIT_PER_HOUR` (60) | signed-in user | 1 hour |
| Public reads | job openings, one opening, application-status link | 60 | IP | 1 min |
| Public application | `POST /public/recruitment/openings/:id/apply` | 20 per IP **and** 5 per email | IP; email | 1 hour |

Notes:

- **Every value is configurable** in `apps/api/src/config/rate-limits.ts` and
  through `RATE_LIMIT_<CATEGORY>_MAX` / `RATE_LIMIT_<CATEGORY>_WINDOW_MINUTES`
  (for example `RATE_LIMIT_EXPORT_MAX`). Development uses ten times the
  production numbers so local work is never blocked. The older
  `PUBLIC_CAREERS_RATE_LIMIT_*` and `PUBLIC_APPLICATION_RATE_LIMIT_*` settings
  still apply when set.
- **Shared networks.** Staff may all reach HRISense from one office IP, so the
  IP-wide limits are generous and the per-person limits are counted by user.
  Sign-in counts IP + email, so one person's typos never block the office.
  Applications are layered: a wide per-IP limit (checked before the upload is
  read, so a flood never writes files), a per-email limit (refused uploads are
  deleted) and the existing one-application-per-opening rule.
- **The wrong-password browser lock is separate** (§4.1): each wrong sign-in
  makes the failing browser wait 15 seconds, 30 seconds, 1 minute, then 15
  minutes, whatever the rate limits allow. Accounts are never locked by wrong
  passwords, and *"I'm not a robot"* is required on every sign-in.
- **The Google unregistered-email limit is 5 in development too** (not ten
  times higher), so the block can be seen locally.
- **Bulk actions** are one request each, so batches are capped instead: at most
  500 employees per bulk restore, 10,000 rows per import decision.
- **Not limited:** the live notification stream (`/notifications/stream`) and
  static files (pages, scripts, images).
- **Searches in the web app wait for typing to pause** (Employee Directory,
  global search, Attendance Tally, Archived Employees, Medical, Psychological,
  Audit, Applicants) instead of sending a request per keystroke.
- **Storage.** Counters are kept in the API process's memory. That is correct
  for one server; with several API instances each would count separately — use
  a shared store (for example Redis) before scaling out. A restart clears them.
- **Client address.** Limits use the address Express resolves. Forwarded
  headers are trusted only when `TRUST_PROXY` is set to the number of proxy hops
  in front of the API — set it when deploying behind a reverse proxy, never to
  `true`.

### 4.15 Errors and failed requests

**One error path in the API.** Every failure — a service rule, validation,
upload, request body, database or anything unexpected — leaves through one
handler (`apps/api/src/middleware/errorHandler.ts`) in one envelope:

```
{ "success": false, "error": "<sentence>", "message": "<same sentence>",
  "code": "<CODE>", "fields": { "<field>": "<message>" }, "requestId": "3F9A1C2B" }
```

`error` and `message` carry the same sentence, written for a person. `code` is
HRISense's own vocabulary — never a Prisma, SQL or driver code. `fields` comes
with a validation error; `requestId` with an unexpected one.

| Status | When | Example code | What the person sees |
|---|---|---|---|
| 400 | Bad input; validation | `VALIDATION_ERROR`, `INVALID_JSON` | The first problem, and how many more (*"First name is required. 2 more fields need attention."*); forms mark each field |
| 401 | Not signed in; session over | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `ACCOUNT_INACTIVE` | *"Your session has expired. Please sign in again."* — the web app refreshes the session first |
| 403 | Not allowed | `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED` | What is not allowed (*"You can only view your own leave requests."*) |
| 404 | Not found | `NOT_FOUND`, `RECORD_NOT_FOUND`, `ROUTE_NOT_FOUND` | *"… could not be found. It may have been removed."* |
| 409 | Duplicate or state conflict | `DUPLICATE_APPLICATION`, `DUPLICATE_EMAIL`, `DUPLICATE_BIOMETRIC_CODE`, `OPENING_NOT_ACCEPTING`, `WRITE_CONFLICT` | The rule that was hit |
| 413 | File or request too large | `FILE_TOO_LARGE`, `PAYLOAD_TOO_LARGE` | The limit |
| 429 | Rate limit (§4.14) | `RATE_LIMITED` | How long to wait (*"Please try again in 2 minutes."*) |
| 500 | Anything unexpected | `INTERNAL_ERROR` | *"Something went wrong on our side. Please try again. Reference: 3F9A1C2B"* |
| 503 | Database or provider unavailable | `DATABASE_UNAVAILABLE`, `SERVICE_UNAVAILABLE` | That the service is temporarily unavailable |

- **422 is not used**; validation answers 400.
- **Database errors are translated.** A unique-constraint clash names the real
  duplicate where the schema says what it means (user email, work email,
  employee number, biometric code, unit or department name, leave balance,
  training participant, calendar entry, shift, weekly schedule, official
  template); any other duplicate is the generic `DUPLICATE_RECORD`. A missing
  record is 404, a database that cannot be reached 503. Prisma text, SQL,
  constraint names, file paths and stack traces never reach a response.
- **Reference.** Every request gets a random 8-character reference
  (`X-Request-Id`). The log line for a failure starts with it, followed by the
  method, path (without its query string), user id, status and code. Unexpected
  failures log their stack; expected ones one line. Password, token, OTP and
  key values are redacted.
- **Async handlers.** Express 4 does not pass a rejected promise to the error
  handler, so every route handler either catches and calls `next(err)` or is
  wrapped in `asyncHandler`. A side effect after the main write (an email, an
  audit line) is caught and logged, never turned into a failure of work that
  was saved.

**The web app.**

- **One translator**, `getApiErrorMessage(err, fallback)` in
  `apps/web/src/utils/error-handler.util.ts`, is used by every screen. It shows
  the server's sentence; words what the server cannot say — *"Unable to connect
  to HRISense. Check your connection and try again."*, *"The request took too
  long. Please try again."*, the 429 wait, the 500 reference — and never shows
  raw library text such as *Network Error* or *Request failed with status code
  500*.
- **Timeouts.** No request waits forever: 30 seconds normally; 2 minutes for
  uploads, downloads, exports and reports; 3 minutes for AI Assistance; 5
  minutes for attendance imports.
- **Loading always ends.** Every save resets its button in a `finally`, so a
  failure leaves the form usable, with what was typed or attached kept.
  Buttons that write are disabled while their request is in flight, and the
  public application form also ignores a second submit made before the
  button re-renders.
- **Failed is not empty.** A list, card or chart that could not load says so,
  with **Try Again** (reads only — a write is never retried automatically). It
  never shows *"No records yet"* or a **0** for a failed load; summary cards
  show **—**.
- **Toasts.** Success only after the server confirms; an error toast for a
  failure; a warning when part of an action worked (*"Medical record created,
  but the document was not attached: …"*). Never a success and an error for the
  same action. Every toast has a close button. Requests refused for rate limits
  share one toast.
- **Crashes.** A page that fails to render shows *"Something went wrong — We
  couldn't display this section."* with **Try Again** and **Return Home**
  (public pages) or **Return to Dashboard**; no error text or stack. An unknown
  address shows **Page not found**.
- **Live notifications** reconnect quietly with back-off and fall back to
  polling; a dropped stream never shows an error.

---

## 5. Dashboard

**Purpose** — the first screen after signing in: a summary of what needs attention
today, a personal calendar, and your recent actions.

**Who** — everyone. **Three different dashboards** are shown depending on the tier.

**Where** — `/dashboard` (sidebar: *Dashboard*). APIs: `/api/v1/dashboard/stats`,
`/overview`, `/activity`, `/calendar`, and `/api/v1/calendar-notes`.

### 5.1 HR dashboard

- **Total Employees** — the active headcount.
- **Compliance: Action Required** — organisation-wide compliance records that are
  missing, expired or expiring.
- **Compliance: Needs Review** — records submitted and waiting for HR to review.
- **Awaiting HR Decision** — leave requests waiting for HR approval.
- **Attendance Trend** — a chart of the month's attendance rate, the number of
  imported records, and how many employees have **no imported record today**
  (never counted as absent). The rate is **(present + late + half day) ÷
  (present + late + half day + absent)** for active employees; on-leave, holiday,
  rest-day and suspended records are outside it, and a day with no record is
  never an absence. **View breakdown** lists each month's counts.

HR's dashboard deliberately has **no to-do list**; it was removed at HSJ's
request because HR works from the module pages.

### 5.2 Supervisor dashboard

- **Team Count** — the number of direct reports.
- **Team Compliance: Action Required / Needs Review** — the same figures, for
  the team only.
- **Late Today** — team members recorded late today.
- **Team Presence Today** — who in the team has an attendance record today.
- **Late & Tardiness Log Monitoring** — recent late arrivals in the team.
  **View All Records** opens Daily Monitoring.

### 5.3 Employee dashboard

- **Your Leave Balances** — days **available** per leave type: allotted − used −
  pending − forfeited (the same figure as the Leave Balance panel). **View
  breakdown** shows each component.
- **Weekly Work Schedule** — this week's shifts from your assigned schedule.
- **My Requirements: Action Required / Expiring Soon / Awaiting HR Review** —
  your own compliance items.
- Upcoming trainings and recent announcements.

### 5.4 Shared on every dashboard

**Welcome header** — a greeting with your name.

**My Calendar** — a month calendar combining, for what you are allowed to see:

| Entry | Shows |
|---|---|
| Holiday | Approved entries from the holiday calendar (§10) |
| Leave | *"My … leave"*, or a team member's leave (supervisors and HR) |
| Training | Training activities you are part of |
| Deadline | *"Evaluations due — (cycle)"*, *"Evaluate (person)"*, *"(requirement) expires"* |
| Interview | *"Interview — (applicant)"* (HR) |
| Birthday | HR sees everyone's; a supervisor sees their team's |
| Note | Your notes, and notes posted to you |

**Calendar notes** (buttons in the calendar):

| Button | What happens |
|---|---|
| **Add Note** | Saves a private note on the chosen date, visible only to you (*"Note added."*). An empty title is refused: *"Please enter a title for the note."* |
| **Edit → Save** | Updates the note (*"Note updated."*) |
| 🗑 **Delete** | Removes the note |
| **Post to employees** (HR only) | Opens *"Post a note to employees"*: choose **All employees** or **Selected employees** (searchable), then post (*"Note posted to …"*). Each recipient receives an `ANNOUNCEMENT` notification |

Rules: *"Only HR can post notes to other employees."*, *"Choose at least one
employee for this note."* Only a note's author can edit or delete it; anyone
else gets *"Note not found."* Posting is audited: `PERSONAL_NOTE_CREATED` or
`CALENDAR_NOTE_POSTED`.

**Recent Activity** — a feed of **your own actions**, taken from the audit log
(routine noise is filtered out). **Show activity as of a date** jumps back in
time; **Load older activity** pages further back.

**Side effect of opening the dashboard** — loading a dashboard raises any
**birthday reminders** due in the next 7 days for HR and supervisors (§4.11).
It never duplicates them.

---

## 6. Employees

**Purpose** — the master record of every staff member, and everything built on
it: onboarding new hires, the directory, each person's profile and documents,
reporting lines, the org chart, and archiving leavers.

**Who** — three separate screens, never one screen with buttons hidden:

| Screen | Who | What it is |
|---|---|---|
| **Employee Management** (`/employees…`, §6.1–6.10) | HR (FULL): HR Officer, Sister | Administering Hospicio's employee records |
| **My Profile** (`/profile`, §6.11) | Everyone | *"I am viewing myself"* |
| **My Team** (`/my-team`, §6.12) | Supervisors, heads, coordinators | *"I am viewing the employees I am responsible for"* |

Supervisors and employees cannot open Employee Management (no `employee.read`
permission; the routes redirect them and the API refuses its administrative
calls).

**Where** — sidebar *Employees* → All Employees (`/employees`), Add Employee
(`/employees/onboard`), Draft Employees (`/employees/drafts`), Archived Employees
(`/employees/archived`), Org Chart (`/employees/org-chart`); a profile is
`/employees/$employeeId`. APIs: `/api/v1/employees/*`, `/api/v1/onboarding-drafts/*`,
`/api/v1/employees/:id/documents`, `/api/v1/documents/:id`.

### 6.1 Employee Directory (`/employees`, HR)

A table of all active employees with search, **Advanced Directory Filters**
(unit, department, job role, status) and paging.

**On phones (below 768 px)** the table becomes one card per employee — photo,
name, employee ID, job role, unit, immediate supervisor, status and profile
completion, with **View Employee** (and **Review** for a pending supervisor) —
so nothing needs sideways scrolling. **Select page** and per-card checkboxes keep
the bulk actions, and a **Sort** menu replaces the column headers (name A–Z / Z–A,
job role, unit, newest hires, longest serving, lowest completion). **Columns** is
a table control, so it shows from 768 px up. Search, the state filters, **Pending
Supervisor**, **More Filters** and **Export Reports** work the same at every size.

| Control | What happens |
|---|---|
| **View** / **Edit** on a row | Opens that person's profile |
| **Columns** | Chooses which table columns are shown |
| **Export Reports** → **Export Excel** / **Export PDF** | Downloads the directory (or the selected rows) as a spreadsheet or PDF (`POST /employees/export/excel|pdf`, HR and supervisors). *"Generating … report…"*, then *"… report exported successfully."* |
| Tick rows → **Archive Selected** | Asks to confirm, then archives each one (see §6.6). *"N employee(s) archived."* |
| Tick rows → **Restore Selected** | Brings archived people back (`POST /employees/bulk-restore`). *"N employee(s) restored."* HR only: *"Only HR can perform bulk restore"* |
| Tick rows → **Activate Accounts** / **Deactivate Accounts** | Turns sign-in on or off for each selected person who has a login; people without one are skipped and counted: *"N account(s) deactivated. M employee(s) skipped — no login account."* |
| **Review** | Opens the confirmation for the chosen bulk action |
| **Retry** | Reloads the list after a loading error |

### 6.2 Add Employee — the onboarding wizard (`/employees/onboard`, HR only)

Eight steps, with **Back**, **Next Step** and **Save as Draft** on each:

1. **Personal Information** — name (first, middle, last, suffix), sex, civil
   status, date and place of birth, nationality, religion, profile photo, and
   the optional **blood type**, **number of children** and — when civil status
   is not Single — **spouse name**.
2. **Contact Information** — mobile, telephone, **personal email (the login
   email)**, present and **permanent / provincial** address, and the optional
   **HSJ residence** and **unit / dorm** (only for staff who live at Hospicio —
   not their work unit). There is no work email.
3. **Employment Information** — unit, job role (it must belong to the chosen
   unit, or be an organisation-wide role such as Sister), employment type,
   dates, a **live preview of the automatically resolved supervisor**
   (`POST /employees/resolve-supervisor`) — or its *pending* reason — with
   **Change Supervisor** to pick another active employee (a reason is
   required), and the HR-managed **leave eligibility** ticks (Paternity, Solo
   Parent; §12.5).
4. **Government Numbers** — SSS, PhilHealth, Pag-IBIG, TIN, and **Other
   Government IDs** as rows (ID type + ID number; **+ Add Government ID**,
   **Remove**; any type — Passport, UMID … — no fixed list).
5. **Emergency Contacts** — up to **three** (contact person, relationship,
   mobile number). The first is required; **+ Add Emergency Contact** stops at
   three; extra contacts can be removed.
6. **Education & Licenses** — all optional: **PRC** license number and
   profession, with **issued** and **valid until** dates once a number is
   entered; **TESDA national certificate** (e.g. NC II) number, qualification
   and, if the certificate states one, valid-until date; **education** —
   primary, secondary and tertiary school, course, **graduated** (Yes / No /
   not recorded), diploma and vocational qualification.
7. **Document Uploads** — contracts, IDs, clearances, certificates (copies of
   licenses, NC certificates and diplomas go here as *Certificate*).
8. **Review & Confirm** — everything on one page, then **Submit**.

**Optional record fields** (blood type, spouse, children, HSJ residence, PRC
dates, NC, education) are never required and never filled with placeholders:
blank is stored as *not provided*. Rules, checked on the step and again by the
API (`lib/employee-record-fields.ts`): blood type is one of A+, A−, B+, B−, AB+,
AB−, O+, O−; number of children is a whole number 0–30 (0 is a real answer,
blank means not provided); PRC dates need the PRC number, and valid-until cannot
be before issued; the NC valid-until date needs the certificate number; spouse
name only when civil status is not Single (choosing Single clears it). **Age**
and **length of service** are computed, never stored. None of these fields is
part of profile completion, so a field that does not apply never lowers anyone's
percentage.

**Leaving mid-way** warns: *"You have unsaved changes. Are you sure you want to
leave?"* **Save as Draft** stores progress (*"Draft saved"* / *"Draft updated"*)
so it can be resumed from Draft Employees. A missing required field blocks the
next step: *"Please complete: …"*.

**On Submit** (`POST /employees`), in one transaction:

- the **employee record** is created with a generated **employee number**
  (format `HSJ-NNNN`, retried automatically if it collides);
- a **login account** is created **for the personal email** with a random
  **temporary password**, flagged to be changed at first sign-in;
- the **supervisor** is resolved (§2.4) — unless HR chose **Change Supervisor**,
  which saves a manual override with its reason (`SUPERVISOR_OVERRIDE_APPLIED`,
  noting the automatic result it replaced). If nothing resolves and HR did not
  override, the employee is saved as *pending supervisor assignment*;
- emergency contacts and other government IDs are saved as rows;
- the **completed-years leave entitlement** is applied (§12.5);
- uploaded **documents and photo** are stored;
- a **welcome email** with the credentials is sent (when email is enabled);
- the draft, if any, is marked completed;
- audited: `EMPLOYEE_CREATED`, `USER_ACCOUNT_CREATED`, `COMPLETE_DRAFT`.

Rules: the personal email must be valid and not already another account's login
or another employee's email (*"This email address is already the login of another
HRISense account."*); *"Emergency contact N is missing: …"*; *"Other government ID
N needs both the ID type and the ID number."*; *"The selected Job Role does not
exist."*, *"The selected Job Role does not belong to the selected Unit."*

**Drafts saved before these changes** open in the new shape: the single
emergency contact becomes contact 1, "Label: number" lines become ID rows (a line
without a label keeps its number with the type left blank for HR), and a draft
that only had a work email keeps it as the personal email. Empty values stored
as `null` open as blank fields, new optional fields open blank, and a draft
without a sex or civil status (every draft converted from a hired applicant)
opens on **Select…** for HR to choose — never pre-set to Male or Single.

The **Onboarding Complete** screen shows the temporary credentials once: **Copy
Credentials** (to clipboard), a **credential sheet PDF** download, and **Go to
Directory**. If the PDF fails: *"The credential PDF could not be generated. Use
Copy Credentials instead."*

### 6.3 Draft Employees (`/employees/drafts`, HR only)

Unfinished onboardings (status `DRAFT`); the sidebar shows their count.

| Button | What happens |
|---|---|
| **Summary** | Shows what has been filled in so far |
| **Resume** / **Resume Draft** | Reopens the wizard at that draft |
| **Discard** | Asks *"Discard Onboarding Draft?"*, then deletes it (`DELETE_DRAFT`). *"Draft discarded successfully"* |
| **Refresh** | Reloads the list |

### 6.4 The employee profile in Employee Management (`/employees/$employeeId`, HR)

**Header** — name, photo, employee number, unit, job role, status badge. A
**profile completion** percentage (shown to HR and to the person themselves)
lists what is missing. It is a weighted score: full name 8, unit 7, department
6, job role 6, date hired 6, mobile 5, email 5, present address 5, emergency
contact name 5 and number 5, photo 5, uploaded documents 10 (two documents earn
the full 10, one earns 5; the photo is not counted as a document), DOB 4, sex 4,
civil status 4, and 3.75 each for SSS, PhilHealth, Pag-IBIG and TIN — 100 in all.

**Completion = points earned ÷ points that apply × 100**, rounded to a whole
number. *Department* applies only when the employee's unit or job role belongs to
a department (or the employee already has one); otherwise it is **Not
applicable** and leaves the denominator, so a profile can reach 100% while no
departments exist. **View breakdown** (profile header, or the percentage in the
Employee Directory) lists every criterion as Complete, Partly complete, Missing
or Not applicable, with its points and its share; the earned shares add up to
exactly the percentage shown. Directory, exports and the profile use the same
calculation (`services/profile-completion.ts`).

Only HR opens this screen (§2.5). It is labelled **Employee Management**; when
HR opens their **own** record here, a note points to **My Profile** for the
self-service view.

**Header buttons (HR only — the API refuses archive, restore and account calls
from anyone else):**

| Button | What happens |
|---|---|
| **Edit Profile** | Opens the edit form (§6.5) |
| **Archive** | *"Are you sure you want to archive this employee? They will not be able to log in."* Then archives (§6.6) |
| **Restore Access** | On an archived person: restores the record and their account |

**Sections** — a side navigation in four groups, **Profile**, **Work**,
**Records** and **Access** (all shown — only HR opens this screen; what a person
sees of themselves is My Profile, §6.11). Sections with missing completion items
carry a red count:

| Group | Section | Contents |
|---|---|---|
| Profile | Overview | Employee summary — the details HR needs most often |
| Profile | Personal | Name, sex, civil status, birth date and **age**, place of birth, nationality, religion, blood type, spouse name (*Not applicable* when Single), number of children |
| Profile | Contact | Phones, emails, present and permanent / provincial address, HSJ residence, unit / dorm |
| Profile | Employment | Employment status and type, dates, **length of employment**, probation and regularization dates, professional role, **Immediate Supervisor** (HR: **Override Supervisor**), **Additional Overseers (Sub-Supervisors)** — display only (§6.9), **System Account** (linked login, permission tier) |
| Profile | Government | SSS, PhilHealth, Pag-IBIG, TIN, other numbers. HR: **Edit Government Information** |
| Profile | Education | **Professional License (PRC)** — number, profession, issued, valid until and **Validity** (*Valid*, *Expires in N days* within 90 days, *Expired* — worked out from the date, never stored); **National Certificate (TESDA)** — number, qualification, valid until; **Education** — schools, course, graduated, diploma, vocational qualification. No license or certificate reads *Not applicable* |
| Profile | Emergency | Emergency contact |
| Work | Schedule | The person's weekly schedule and schedule history. HR can **Set / Edit Weekly Schedule** here (§11) |
| Work | Attendance | Their attendance for Today / This Week / This Month / Previous Month / Custom Range, **Export**, and **View in Attendance Tally** |
| Work | Leave Balances | Balance per leave type; HR can adjust (§12) |
| Work | Evaluations | Their evaluations (§13) |
| Work | Training | Their training history and certificates (§14) |
| Records | Documents | Uploaded documents: **Preview**, **Download**; HR: **Upload File**, **Edit**, **Replace**, **Delete** |
| Records | Compliance | Their compliance requirements and status. HR: **Record Compliance Fulfillment** (§15) |
| Records | Medical | Their medical records (§16) |
| Records | Psychological | Their psychological records (§16) |
| Records | Timeline | Every audit entry about this person or their account |
| Access | Account Management | The login controls from §4.2 |

### 6.5 Edit Profile

**HR can edit everything**: name and suffix, sex, civil status, birth details,
nationality, religion, phones, the **personal email — which is also the login,
so changing it changes how the employee signs in** (`ACCOUNT_LOGIN_EMAIL_CHANGED`),
both addresses, the emergency contacts (up to three), the **leave eligibility**
ticks (`EMPLOYEE_LEAVE_ELIGIBILITY_UPDATED`),
unit / job role, employment type, start date, probation end, regularization
date, employee status and end date, the optional record fields (blood type,
spouse name, number of children, HSJ residence, unit / dorm) and an **Education &
Licenses** section (PRC number, profession and dates; NC certificate; education),
and the **timekeeping code** (the number the attendance device uses; §8). Changing
unit or job role shows the **supervisor now** and the **supervisor after
saving**.

**An employee editing their own record** does it from **My Profile → Edit My
Profile** (§6.11), never from this form. The API's self-edit list
(`EmployeeService.update`) is the rule: mobile phone, home phone, present
address, permanent address, emergency contacts (up to three) and religion. The
list also accepts a photo address, but HRISense has no self-service photo upload
(photos are filed at onboarding), so the photo stays read-only. The personal
email is the login, so HR changes it. Anything else sent by a non-HR user is
dropped, and editing anyone else's record is refused: *"You can only update
your own profile"* — supervisors included.

Rules: *"That employment type is not one of the available options."*,
*"Timekeeping code N is already assigned to employee HSJ-…"* (each code belongs
to one person), *"One of the dates could not be read."*, *"Job role does not
belong to the selected unit"*. Changes to organisation fields are audited as
`EMPLOYEE_ORGANIZATION_UPDATED`; other edits as `UPDATE_EMPLOYEE`.

**Edit Government Information** (HR) — the four statutory numbers and the
**Other Government IDs** rows. Text recorded before IDs became rows is kept as
written and shown read-only until HR uses **Copy into rows**.
*"Government information updated."*

**Login email** — accounts created before 1 Oct 2026 signed in with the old work
email. Where that differs from the personal email, the profile says so and
**Account Management → Use personal email as login** switches it, explicitly
(`ACCOUNT_LOGIN_EMAIL_CHANGED`). The migration changed nobody's login on its own;
it only copied the work email into an empty personal email (all of those were
the login address already). The old work email is kept in the database but is
no longer collected or shown.

**Length of service** — Employment shows **Start Date**, **End Date** ("Present —
currently employed" while employed) and **Length of Service** in years, months
and days, counted on the calendar (never days ÷ 365). An ended employment with
no recorded end date shows *"Cannot be calculated — no end date recorded"*
instead of counting to today.

### 6.6 Archiving and restoring

**Archive** does not delete anything. It sets the employee's *archived* date,
**deactivates their login** and ends their sessions (`EMPLOYEE_ARCHIVED`). The
person disappears from the directory, pickers and headcounts but keeps all
history.

**Archived Employees (`/employees/archived`, HR only)** lists them with their
**service period** (start → end date, employee status and length of service —
*"End date not recorded"* where there is none, never counted to today),
**Profile** and **Restore**. Restore asks *"Restore Employee Record?"*, then
brings back the record and reactivates the account (`EMPLOYEE_RESTORED`,
`ACTIVATE_USER`): *"Employee … restored to active directory"*.

### 6.7 Reporting line and supervisor override

Each profile shows the **immediate supervisor**, how it was assigned
(automatic from the job role, department head or unit head, or a manual
override) and whether it is **ASSIGNED** or **PENDING** (§2.4). An HR Officer
or Sister shows *"No supervisor required — … is a top-level role."*

**Override Supervisor** (HR) opens *"Manual Supervisor Override"*: pick a new
supervisor and give a **reason** (required: *"Please provide a reason for this
manual override."*). **Apply Override** saves it (`SUPERVISOR_OVERRIDE_APPLIED`).
**Remove Override** asks for confirmation, then recalculates the supervisor from
the hierarchy (`SUPERVISOR_OVERRIDE_REMOVED`). Rule: *"An employee cannot be
their own supervisor"*.

### 6.8 Documents

Categories: Resume, Employment Contract, Government ID, Medical Clearance,
Certificate, Other. Files follow the upload rules in §4.8 (5 MB,
PDF/images/Word).

| Button | What happens |
|---|---|
| **Upload File** (HR) | *"Upload Document"*: choose a file (**Browse Files**), a category and details, then upload (`DOCUMENT_UPLOADED`). Over 5 MB: *"File size must be less than 5MB"* |
| **Preview** / **Download** | Opens or saves the file through the API |
| **Edit** (HR) | Changes the title, category and **visibility to the employee** (`DOCUMENT_METADATA_UPDATED`, `DOCUMENT_VISIBILITY_CHANGED`) |
| **Replace** (HR) | Uploads a new file in place of the old one (`DOCUMENT_REPLACED`) |
| **Delete** (HR) | Confirms, then removes it (`DOCUMENT_DELETED`) |

Who can see which documents: HR sees all of them. An employee sees their own
documents marked *visible to employee*. A supervisor sees a **direct report's**
documents marked *visible to supervisor* — Medical Clearance and Other documents
are never visible to supervisors — and is refused for anyone else (*"Unauthorized.
Employee is not a direct subordinate."*).

### 6.9 Org Chart (`/employees/org-chart`)

The organisation as a tree: **Hospicio de San Jose** at the top, then units,
job roles and the people in them. Controls: **Expand All**, **Collapse All**,
**Zoom In / Zoom Out** (10% steps), **Reset Zoom (100%)**, **Fit Screen**,
**Refresh**, a full-screen workspace (**Exit Fullscreen**), and filters by unit
and department. It reads `GET /employees/org-chart` and changes nothing.
What the chart contains depends on the tier: HR sees everyone; a supervisor
sees themselves and their direct reports; an employee sees themselves, the
supervisors above them and anyone reporting to them.

**Additional oversight** (a secondary, cross-branch relationship). Hospicio has
people who also oversee employees outside their normal branch — e.g. Sister
also oversees the Kitchen Supervisor. The tree above stays the primary
hierarchy: the employee stays in their own branch and keeps their **immediate
supervisor**; additional oversight is drawn on top of it.

- **Show Additional Oversight — OFF / ON** (toolbar and fullscreen workspace;
  **OFF by default**). OFF shows the normal chart exactly as before. ON adds:
  **dashed teal lines with an arrow** from the overseer to each person they also
  oversee (primary reporting lines stay **solid grey**; a legend says which is
  which); an **Additional Oversight: n** badge on each card involved, opening to
  **Immediate supervisor** (primary — unchanged), **Also overseen by** and **Also
  oversees**; and an **Additional Oversight** list grouped by overseer. Hovering a
  badge or a list entry highlights that person's lines. Switching does not reset
  the zoom, position or what is expanded. In the fullscreen workspace the lines
  follow **zoom, pan and Fit Screen** and keep their on-screen thickness; on the
  page, a card scrolled out of its unit's horizontal scroll area gets no line
  (its badge still names it). On small screens the lines are hidden and the
  cards and the list carry the relationships, with no page-wide horizontal scroll.
- **Manage Additional Oversight** (HR / FULL only): choose the **additional
  overseer** — an actual employee (e.g. the specific Sister, never "every
  Sister") — and what they **oversee**: **one employee**, or **everyone in a job
  role** (whoever holds it, now and later). **Add**; the **Current Additional
  Oversight** list shows each relationship and who it covers today, with
  **Remove**. Refused: overseeing oneself; someone who already reports to the
  overseer (*"…is already …'s immediate supervisor — that is the primary
  reporting line, not additional oversight"*), likewise a job role whose holders
  all already report to the overseer; duplicates. Audited
  (`ADDITIONAL_OVERSIGHT_ADDED` / `_REMOVED`). API: `GET / POST
  /employees/additional-oversight`, `DELETE /employees/additional-oversight/:id`
  (FULL); the chart's lines come with `GET /employees/org-chart`.
- **Display only — no access.** Additional oversight does **not** change leave
  approval, evaluation assignment, attendance access, schedule authority, My
  Team, employee editing, archiving, compliance or medical / psychological
  access. Who sees which lines: HR sees all; anyone else only lines between
  people already on their chart, plus their own (who also oversees them, whom
  they also oversee).
- **Initial relationships** (from Hospicio's reference, 8 Oct 2026, added only
  where the label is a current job role; `src/scripts/seed_additional_oversight.ts`):
  Sister → Janitorial Supervisor, Maintenance Supervisor, Laundry Staff, IGP
  Coordinator, Kitchen Supervisor, PMO Staff; Assistant Administrator → Liaison
  Officer, Head SSD, Head Pastoral Care/Homelife Services. **Not added:** labels
  that are not current roles — *Finance Staff*, *Administrator*, *Admin Staff*,
  *IT Staff*, *HRD Officer*, *CYWDP Coordinator*, *IGP Staff Institutional*
  (not assumed to be Accounting Staff, Human Resource Officer, CY Coordinator or
  IGP Coordinator); *Health Services Sister-in-Charge* → Clinic Staff, PT
  Coordinator (HR chooses which Sister); and relationships that are already the
  primary hierarchy (Receptionists already report to the Assistant
  Administrator; PSN, CIP and OP Coordinators and Chapel Staff to the Head of
  Pastoral Care / Homelife Services). No job role was created or renamed.

**Additional overseers on the Employee Profile (HR).** *Employment → Additional
Overseers (Sub-Supervisors)* shows the **Immediate supervisor (primary)** beside
the **Additional overseer(s)**, and whom this employee also oversees. **Add
additional overseer** — choose the actual person (another Head, Sister,
Supervisor or Coordinator). When the employee has direct reports, HR is asked
whether to include them: **No — only this employee**, or **Yes** with a tick
list of the people who report to them now; a **tree preview** shows exactly who
will be included before **Confirm**. Each included person gets their own
relationship; anyone already covered is reported, not duplicated, and only
current direct reports are accepted (checked by the API). Nothing else
changes — immediate supervisor, branch, unit, job role, department, and every
module's access. The same relationships are the dashed lines of the Org Chart's
*Show Additional Oversight* (§6.9). API `GET / POST /employees/:id/additional-oversight` (FULL).

**HR administering their own record.** HR and Sister are employees too. Through
*Employees → their own profile* (Employee Management, with the notice *"This is
your own record"*) they have the same administrative actions as for anyone else
— edit, documents, compliance (**Record Fulfillment**), medical and
psychological records, leave balances, supervisor override. **My Profile**
stays the self-service view without those controls. The only actions refused on
one's own record are the ones that would lock the HR user out or let them judge
themselves: **archive** (it deactivates the account — *"You cannot archive your
own record — another HR administrator must."*), deactivating or locking their
own account, and finalising an evaluation they are part of. Another HR
administrator or Sister does those. STANDARD and SUPERVISOR access is unchanged.

### 6.10 Organisation structure (units, departments, job roles)

Units, departments and job roles have full create/edit/delete APIs, HR only
(`/api/v1/units`, `/departments`, `/job-roles`). The only screen that changes
them is **+ New position** on the job-opening form (§17.3), which adds a job
role. Creating a job role always goes through the duplicate-title check and
never creates a full-access (HR) role; editing and deleting roles, and units
and departments, are maintained through the API or seed data (Appendix E). A job
role carries its **unit** (none for an organisation-wide role such as Sister),
**parent job role** (which drives the reporting line), whether it is a **head** or **supervisor** role, its **permission
tier**, and whether its place in the hierarchy is **confirmed**.

### 6.11 My Profile (`/profile`, everyone)

*"I am viewing myself."* Every account — HR, Sister, heads, coordinators,
supervisors and employees — has **My Profile** in the sidebar (under
Dashboard), in the profile menu and in Settings. It reads the person's own
record (`GET /employees/me`) and carries **no administrative actions**: no
archive, restore, account, organisation, job-role or supervisor controls, even
for HR and Sister on their own record (those stay in Employee Management).

**Header** — photo, full name, job role, unit and department, employee ID,
employment type, employee status, and **Profile completion** with **View
breakdown** (the same weighted calculation as everywhere, §6.4 and §4.13).
Sections with missing completion items carry a red count in the navigation.

**Sections** (each is something the API already lets a person read about
themselves; each module applies its own rule):

| Group | Sections |
|---|---|
| My Profile | Overview, Personal (with **age**), Contact, Employment (kept by HR; includes the immediate supervisor — *"Not required"* for top-level roles), Government (kept by HR), **Education & Licenses** (kept by HR, read-only), Emergency, Documents (those HR made visible to them) |
| Work | Schedule (read-only), Attendance, Leave (balances, plus **My leave requests** and **File a leave request**), Evaluations (their visible evaluations), Training |
| Health & Compliance | Compliance, Medical, Psychological — what those modules show an employee about themselves; confidentiality rules unchanged |
| Account | **Account & Security** (sign-in email, account status, last sign-in, access level, **Change password** → Settings), **Record History** (activity on their own record) |

**Edit My Profile** — a short form with only the fields a person may change on
their own record (the API's self-edit list): **mobile number**, **home phone**,
**present address**, **permanent address**, **religion** and **emergency
contacts** (up to three; the first is required). Mobile number and present
address are required. **Review changes** lists exactly what changed (old →
new) before **Save changes**; saving sends only the changed fields
(`PUT /employees/:id` on the person's own record, audited as
`UPDATE_EMPLOYEE`). Fields HR keeps — name, personal email (the sign-in), birth
details, employment, job role, unit, supervisor, government IDs and the profile
photo — are shown on the profile, never as disabled fields in the form.

### 6.12 My Team (`/my-team`, supervisors)

*"I am a supervisor viewing the employees I am responsible for."* Supervisors
(heads, coordinators and supervisors — tier SUPERVISOR) have **My Team** in the
sidebar and in Quick actions. HR uses Employee Management instead; employees
are sent to My Profile.

**Who is on it** — the employees whose immediate supervisor
(`Employee.immediateSupervisorId`) is the signed-in supervisor, active records
only (`GET /employees/subordinates`). Not the whole unit, not a coordinator's
staff below them, not archived records, not other supervisors' teams.

**The list** — header *My Team · N Employees*; search (name, employee ID, job
role) and filters (job role, status). Desktop shows a table — Employee, Job
Role, Unit, Status, Profile Completion (the percentage opens **View breakdown**),
**View**; phones and small tablets show one card per person.

**Team Member Profile** (`/my-team/$employeeId`) — breadcrumb *My Team →
Name*, labelled **Team Member Profile**. It shows the **work profile** the API
returns to a supervisor — employee ID, job role, unit, department, employment
type and status, dates, length of service, professional role, reporting line,
profile completion — and the sections each module already opens to a direct
report's supervisor:

| Section | What the supervisor can do |
|---|---|
| Overview, Employment | Read the work profile |
| Schedule | Read; **Set / Edit Weekly Schedule** (a supervisor sets their direct reports' schedules, §11.3) |
| Attendance | Read, export, **View in Attendance Tally** |
| Leave Requests | Read type, dates, days and status; **Open Leave Requests** to endorse |
| Training | Read their training history |
| Compliance | Read their requirements and fulfilment records |
| Documents | Preview / download those marked *visible to supervisor* |

Not shown, because no supervisor permission covers them: personal details,
contact details, addresses, government IDs, emergency contacts, account
details, record history, leave balances, evaluation history, medical and
psychological records. There is **no Edit, Archive, Restore or account
control**, and the API refuses those calls from a supervisor. Opening anyone
who is not a direct report — by link, search or a changed URL — shows *"This
employee is not on your team"* (the API answers 403).

---

## 7. Attendance — Daily Monitoring

**Purpose** — see who attended which day, as recorded by the timekeeping device,
and (for HR) bring that data in. Attendance in HRISense **comes from the Mustard
Seedtime biometric device's export**; staff do not clock in inside HRISense.

**Who** — everyone, with scope by tier. **Where** — `/attendance/daily`
(sidebar: *Attendance → Daily Monitoring*). APIs: `/api/v1/attendance/calendar`,
`/api/v1/attendance`, `/api/v1/attendance/imports/*`.

### 7.1 What each tier sees

| Tier | Tabs | Scope |
|---|---|---|
| HR | **Calendar** and **Import** | The whole organisation, with filters |
| Supervisor | **My Attendance** and **Team Attendance** | Themselves; their direct reports |
| Employee | none | Themselves |

The page title is *Daily Monitoring* for HR, *Attendance Monitoring* for
supervisors and *My Attendance* for employees.

### 7.2 Calendar tab

- **Last-import strip (HR)** — the latest import's file name, the period it
  covered, how many days it recorded, how many rows matched nobody, and
  **Open import**. With nothing imported yet: *"Nothing has been imported yet.
  This calendar fills in once an attendance export has been uploaded and
  confirmed."* with **Import an export**.
- **Filters (HR)** — unit, department, employee, work schedule, *imported or
  not*, and attendance status; **Clear** resets them.
- **Attendance summary** — cards for **Present, Late, Absent, On leave** for
  today, or for the day clicked; plus an *Also on this day* strip for half day,
  holiday, rest day, suspended and *no imported record*.
- **Month calendar** — each day shows coloured chips. For HR and team views the
  chips are counts per status (P, L, A, LV, HD, HOL, RD, SUS; holidays show
  their name). For one person, the chip is that day's status. Month arrows move
  between months.
- **Click a day** → a side drawer (closes with ✕ or Escape) with one card per
  employee: status, the organisation-calendar entry if any, their **schedule**
  that day (shift times, *Day off*, *Not configured* or *No schedule assigned*),
  **remarks**, **time in / time out**, and — for imported days — **every
  recorded punch pair** (*"not closed"* when a clock-out is missing), the
  device's own **hours** (worked, overtime, undertime) and any **review flags**.

**Statuses:** Present, Absent, Late, Half Day, On Leave, Holiday, Rest Day,
Suspended, and **No imported record**. The last means *no data exists* for that
employee-day. **It is never treated as an absence** anywhere in HRISense.

Rules: calendar requests are limited to 6 months; day lists to 31 days.

### 7.3 Import tab (HR)

The full attendance import, described in §8, embedded as a tab so importing
happens where the data is monitored. `/attendance/import` shows the same
content on its own page for old links.

---

## 8. Attendance import (Mustard Seedtime export)

**Purpose** — turn the timekeeping device's Excel export into attendance
records **without ever writing something wrong silently**. Every questionable
row waits for HR.

**Who** — HR only. **Where** — Daily Monitoring → **Import**. API
`/api/v1/attendance/imports` (list, upload, preview, decisions, apply, cancel,
map-code).

### 8.1 The file

The Mustard Seedtime **"TIMESHEET REPORT"** export is a legacy **Excel 5.0/95
(`.xls`)** file. One block per employee: a line *"Employee: NAME (CODE)"*, a
header row (Date, In 1 … Out 6, Hrs Required, Tot Hrs Break, Hrs Worked,
Hrs OT, Hrs UT), one row per day, then *Total:* and *Days Present / Days
Absent*. The report period is in the header (*"From September 01, 2026 to
September 23, 2026"*).

- **Identity = the CODE in brackets**, matched against each employee's
  **timekeeping code** (`biometricCode`). The name is **never** used to decide
  who a row belongs to.
- The file must really be an Excel workbook; the bytes are checked, not the
  extension: *"This file is not an Excel workbook…"*
- The export lists **every date** of the period for every person, including
  days with no punches. Those days carry no fact and are **never imported**.

### 8.2 The flow

**1. Upload** — **Upload export** stores the file and creates an import batch.
**Uploading writes no attendance.** Uploading a file that was already applied
warns rather than blocks.

**2. Read and classify** — each employee-day becomes a *candidate* and is
compared with what HRISense already holds:

| Classification | Meaning | Default decision |
|---|---|---|
| `NEW` | Nothing on file for that employee-day | **Apply** — unless the row carries a holding flag (§8.3) |
| `EXACT_DUPLICATE` | Same as what is on file | **Skip**; writes nothing, not even a timestamp |
| `ENRICHMENT` | Only fills blanks (e.g. a missing time-out) | **Pending** — HR decides |
| `CONFLICT` | Differs from the record on file | **Pending** — HR decides |
| `CONFLICT_MANUAL` | Differs from a record **HR corrected by hand** | **Keep record** — HR must override deliberately |
| `DUPLICATE_IN_FILE` | The same employee-day appears twice in the file | **Skip**; only the first is used |
| `UNKNOWN_EMPLOYEE` | The code matches nobody | **Skip** until the code is mapped |
| `INVALID` | The row could not be read (e.g. a bad date) | **Skip** |

A day with no punches and no hours is **skipped**: *"The export lists this date
but recorded no punches and no hours, so there is nothing to import. The day is
left with no record rather than marked present or absent."*

**3. Review** — a paged list of every candidate with its classification,
reason and flags, filterable by classification. On each row HR presses **Use
file** (decision `USE_UPLOADED`) or **Keep record** (`KEEP_EXISTING`); the API
also accepts `SKIP`. Decisions are
recorded with who made them and when. The API accepts an optional reason, but
the screen does not ask for one — not even when overriding a hand-corrected
record.

**4. Apply import** — applies all rows set to *Use file*. **Refused while any
row that could write is still Pending**: *"N record(s) still need a decision
before this import can be applied."* Each write re-checks that the existing
record has not changed since the preview; a stale decision is refused rather
than executed. Written records are stamped with source **IMPORT** and the batch
id. Audited: `ATTENDANCE_IMPORT_UPLOADED`, `ATTENDANCE_IMPORT_APPLIED`,
`ATTENDANCE_IMPORT_CANCELLED`.

**Cancel** abandons a batch before it is applied.

**Batch statuses:** Uploaded → Parsing → Validated (awaiting decisions) →
Applying → Completed, or Partially applied / Cancelled / Failed.

### 8.3 Review flags — what is caught, and what holds a row

Flags are facts about a row, never verdicts. A **holding** flag forces the row
to Pending and blocks confirmation until HR decides; an **informational** flag
is only shown.

| Flag | Holds? | Meaning |
|---|:-:|---|
| `INCOMPLETE_PUNCH` | ✅ | Clocked in, never clocked out |
| `OUT_WITHOUT_IN` | ✅ | A clock-out with no clock-in |
| `NON_SEQUENTIAL_PUNCHES` | ✅ | Clock-out earlier than clock-in |
| `HOURS_WITHOUT_PUNCHES` | ✅ | Hours reported, no punches to support them |
| `PUNCHES_WITHOUT_HOURS` | ✅ | Punches, but zero hours reported |
| `HOURS_DISAGREE_WITH_PUNCHES` | ✅ | Worked + overtime differs from the punch span by more than 1 hour |
| `IMPLAUSIBLE_DURATION` | ✅ | More than 16 hours in a day — usually a missed clock-out |
| `FUTURE_DATE` | ✅ | The date has not happened yet |
| `IDENTITY_NAME_MISMATCH` | ✅ | The name beside the code does not match the mapped employee (§8.4) |
| `ARCHIVED_EMPLOYEE` | ✅ | Attendance for an archived employee |
| `WORKED_ON_SCHEDULED_DAY_OFF` | ✅ | Punches on the employee's scheduled rest day |
| `ATTENDANCE_DURING_APPROVED_LEAVE` | ✅ | Punches during approved leave |
| `WORKED_ON_HOLIDAY` | ✅ | Punches on an approved holiday |
| `PUNCH_OUTSIDE_SCHEDULE` | ✅ | First punch more than **2 hours** outside every scheduled shift |
| `MULTIPLE_SESSIONS` | — | More than one in/out pair (e.g. a lunch punch-out) |
| `SCHEDULE_NOT_CONFIGURED` | — | No schedule for that day (most employees have none yet, so holding on this would hold everything) |
| `NO_PUNCHES`, `ON_LEAVE_NO_PUNCH`, `HOLIDAY_NO_PUNCH`, `DAY_OFF_NO_PUNCH` | — | Nothing to write anyway |

**Status on import.** The device gives no status, so an imported day with
punches is recorded as **PRESENT**. The flags carry everything that needs a
human. HRISense **invents no lateness thresholds** and **never marks a missing
day ABSENT**.

### 8.4 Matching codes to people, and catching the wrong person

- **Unmatched codes** — the **mapping panel** lists every code that matched
  nobody and how many days it holds. Pick the employee and **Map** (`POST
  /attendance/imports/map-code`, `ATTENDANCE_BIOMETRIC_CODE_MAPPED`). Each
  code gets a suggestion — *"The name beside this code looks like …"* — with
  **Use this**. It is a suggestion only; nothing is mapped until HR presses the
  button. Then re-upload the file. The code can also be set on the employee's
  profile (*Timekeeping code*).
- **Reassigned codes** — if the name beside a code no longer matches the
  employee it is mapped to (e.g. the device gave a leaver's number to a new
  hire), those rows are held with `IDENTITY_NAME_MISMATCH`. A red panel shows
  *"These device numbers may belong to someone else now"*, the current mapping,
  and *"It looks more like …"* with **Give the code to them**.
- **How the name check works** — the name is compared only in memory and **never
  stored**; only the verdict (match / mismatch / uncertain), a score and
  HRISense employee ids are kept. A real word (3+ letters) must match before any
  similarity counts, so initials can confirm but never create a match. A
  one-letter first-name difference (ANTONIO / ANTONIA) is flagged, not passed.

### 8.5 Test files

`apps/api/scripts/generate-mustard-timesheet.ts` (fake attendance in the exact
export format), `remap-mustard-export.ts` (a real export with HRISense names) and
`generate-sample-timesheet.ts --apply-codes` (assigns test codes 901+, which can
never collide with the real device's 2–217). The real export's own defects —
an unnamed sheet, empty filler records, a too-narrow date column — are fixed in
generated files so they open cleanly in Excel.

---

## 9. Attendance Tally

**Purpose** — a per-employee summary over a period, for review and export.

**Who** — everyone, scoped by tier. **Where** — `/attendance/tally` (*Attendance →
Attendance Tally*). APIs: `GET /attendance/tally`, `POST /attendance/export/excel|pdf`.

- **Period tabs**: Today, This Week, This Month, Previous Month, Custom Range
  (up to 6 months).
- **Filters**: unit and department.
- **Columns per employee**: employee number, name, unit, job role, and counts of
  **present**, **late**, **absent**, **half day**, **on leave**, and **days
  with an imported record**.
- **Export** → Excel, PDF or CSV. *"Generating … report…"*, then *"… report
  exported successfully."*

The same view for one person is on their profile's **Attendance** tab.

**Manual corrections.** The API lets HR correct a single attendance record
(`PUT /attendance/:id`, audited `UPDATE_ATTENDANCE`). A corrected record is
stamped **MANUAL** with who changed it and when, and later imports will not
overwrite it without an explicit override (`CONFLICT_MANUAL`). **There is
currently no screen for this** (Appendix E).

---

## 10. Holiday & Work Calendar

**Purpose** — the organisation's non-working days, so attendance, schedules and
imports treat them correctly.

**Who** — everyone views; **HR only** changes it (enforced in the controller:
*"Permission denied"*). **Where** — `/attendance/holiday-calendar`
(*Attendance → Holiday Calendar*). API `/api/v1/holidays`.

**Entry types:** Holiday, Special non-working day, Organisation non-working
day, Suspension. **Sources:** fetched Philippine public holidays (from
`nagerholidays.com` for the chosen year), or entered by hand. **Statuses:**
Pending (a fetched suggestion), Approved (in force), Ignored (dismissed or
deactivated).

| Action (HR) | What happens |
|---|---|
| **Fetch suggestions** for a year | Pulls that year's Philippine holidays and adds any new ones as **Pending**: *"Added N new pending holidays."* |
| **Approve / Ignore** a suggestion | Puts it in force, or dismisses it |
| **Add** a manual entry | Created already **Approved** (`MANUAL_HOLIDAY_CREATED`). *"An entry with this date and name already exists."* |
| **Edit entry** | Changes a manual entry (`CALENDAR_ENTRY_UPDATED`) |
| **Delete entry** / deactivate | *"Deactivate this calendar entry? It will no longer apply to attendance, but the record is kept for history."* Never a hard delete (`CALENDAR_ENTRY_DEACTIVATED`) |

**Units that work on the day.** Some groups keep working through a holiday
(Hospicio's example: Pastoral Care / Homelife Services). For any entry, HR
opens **Working units** and ticks the units expected to work
(`PUT /holidays/:id/working-units`, `CALENDAR_ENTRY_WORKING_UNITS_UPDATED`); the
**Who Works** column then reads *"Works: … · All other units observe it"*.
Units, not departments, because HSJ's organisation is recorded in units (no
departments are defined). Nothing is pre-set: every unit observes an entry until
HR marks it.

For an employee in a working unit, the entry does **not** apply to them: their
normal schedule stands, Daily Monitoring does not count them under Holiday /
Suspended and says *"this employee's unit is expected to work today"*, Schedule
Coverage marks them *Unit works this holiday*, and the import raises neither
`WORKED_ON_HOLIDAY` nor `HOLIDAY_NO_PUNCH` for them. Everyone else is unchanged:
punches on a holiday their unit observes still raise `WORKED_ON_HOLIDAY` for
review. No pay rule is applied either way.

Approved entries appear on Daily Monitoring, the dashboard calendar, schedule
coverage, and in import checks (`WORKED_ON_HOLIDAY`). Every change is also
written to the schedule history (§11).

---

## 11. Work schedules

**Purpose** — who is scheduled to work which shifts on which days. Attendance
views, coverage and the import's schedule checks all read it.

**Who** — HR manages; supervisors see their team's; employees see *My Work
Schedule*. Coverage is refused for employees: *"STANDARD users cannot access
schedule coverage."* **Where** — `/attendance/schedule` (*Attendance → Work
Schedule*), and each profile's **Schedule** tab. APIs: `/api/v1/weekly-schedules`,
`/api/v1/schedules`.

### 11.1 How a day's schedule is decided

There is exactly **one authority**, the schedule resolver:

1. An **employee weekly schedule** covering the date → authoritative.
2. Otherwise a **legacy schedule-template assignment** covering it → used, and
   labelled as legacy.
3. Otherwise → **unresolved** (*No schedule assigned*).

The two are never merged. The coarse *work schedule* field on the employee
record is for display only. Each day of a weekly schedule is **Working** (with
one or more shifts), **Day off**, or **Unconfigured**.

### 11.2 Screens (Schedule Management)

| Tab | What it does |
|---|---|
| **Employee Schedules** | Everyone's current weekly schedule, with filters (**Clear Filters**), paging and **Refresh** |
| **Schedule Coverage** | A month calendar showing, per day, who is scheduled, on rest days, unconfigured or on holiday. Select up to **31 days** for a range summary; **View Day Details** per day. Legend: *scheduled to work*, *intentional rest day*, *has a weekly schedule but this day still needs to be configured*, *does not yet have an active weekly schedule*, *organisation holiday* |
| **Shift Catalog** | The reusable shifts (name, start and end time, category **Office** or **Shift**). **Create Shift**, **Edit**, **Deactivate** (*"Shift deactivated."*). *"A shift definition with this name already exists."* Editing an archived shift is refused |
| **History** | Every schedule change: weekly schedule revisions, template changes, assignments, holiday changes |

### 11.3 Setting someone's weekly schedule (profile → Schedule)

**Who:** HR for any employee; a **supervisor for their direct reports only** —
not for themselves (*"You cannot edit your own work schedule. Ask HR."*) and
not for anyone outside their team (*"You can only edit the work schedule of
your own direct reports."*). Employees cannot edit schedules (*"Employees
cannot edit work schedules."*).

**Set Weekly Schedule** / **Edit Schedule** opens *Configure Weekly Schedule*:
choose the usual shift(s) (**Add Another Shift**, **Remove**), then adjust
individual days — **Set as Rest Day**, **Make it a working day**, **Add Shift**.
Saving creates a new **version** effective from its start date, so past days
keep the schedule that applied then (`WEEKLY_SCHEDULE_REVISED`). *"Shift not
found: …"* if a shift was removed meanwhile.

Legacy templates (API only): create, revise (a revision is a new version),
assign to employees. *"A schedule template with this name already exists."*,
*"Cannot assign an archived template"*.

---

## 12. Leave management

**Purpose** — filing, endorsing and approving time off, and tracking each
employee's leave balances.

**Who** — everyone files their own leave. The employee's **head / supervisor /
coordinator** recommends: **endorse**, **propose a change**, or **decline**.
**HR makes the final decision**, can file leave on others' behalf, and manages
balances. This follows Hospicio's paper *Leave Application Form*: employee →
Unit / Department Head recommendation → Administrator / HR Officer approval. **Where** — sidebar *Leave Management* → Leave Requests
(`/leave/requests`), Leave Calendar (`/leave/calendar`), New Request
(`/leave/new`). API `/api/v1/leave`.

**Leave types**, grouped as on the paper form's *Details of Leave*:
**Vacation (VL)**; **Sick / Emergency (SL/EL)** — Sick and Emergency are still
separate types with their own balances, as HR has set them up; **Bereavement
(BL)**; **Paternity / Maternity**; **Leave Without Pay** (uses no leave credits);
**Others / Offset / Solo Parent** — Solo Parent, **Offset**, Study,
Rehabilitation, Special Privilege, Forced and **Other** (the reason says what it
is). Leave Without Pay, Offset and Other were added from the form; none has an
automatic entitlement (§12.5).

### 12.1 The approval chain

```
Employee files ─► PENDING ──(head: Endorse to HR, or Propose a change)──► FOR_REVIEW ──(HR)──► APPROVED
                    │                                                        │      (as requested, the
                    ├──(head or HR: Decline + reason)──► REJECTED ◄───────────┤       proposed change, or
                    └──(employee: Cancel)──► CANCELLED ◄─────────────────────┘       other dates)
   No head in the chain → PENDING goes straight to HR.
```

| Step | Who | What happens |
|---|---|---|
| **File** | The employee (or HR on their behalf) | Status **PENDING**. The days are **reserved** in the balance (*pending*). Notifies the supervisor, *"Leave request awaiting your endorsement"* — or, if the employee has no supervisor, all HR users, *"Leave request awaiting HR decision"*. Audited `LEAVE_FILED` |
| **Endorse to HR** | The employee's head / supervisor / coordinator (direct reports only) | Recommends the request **as filed**, with an optional note to HR (stored as the head's note, with who and when). Status **FOR_REVIEW**; HR and the employee are notified (`LEAVE_ENDORSED`) |
| **Propose a change** | The head | Endorses it to HR **with a proposed change** — other dates or fewer days (**From**, **To**, the days worked out, and a **reason**, required). The request itself is **not** changed: the proposal is kept beside it with who proposed it and when. Status **FOR_REVIEW**; HR and the employee are told what was proposed (`LEAVE_REVISION_PROPOSED`). Same dates as the request are refused |
| **Approve** | **HR only** | Three ways: **as requested**; **Approve proposed change** (the head's dates); or **Approve other dates** (HR's own From / To + reason). Status **APPROVED**, with optional notes. When the approved leave differs, the employee's **original request is kept** (`originalStartDate / originalEndDate / originalTotalDays`) and the request's dates and days become the **final leave**, with the **adjustment reason**; calendars, attendance checks and balances follow the final leave. Reserved days are released and **the FINAL days are charged** to *used* — only where a balance exists; HRISense never invents an entitlement. Revised dates may not overlap the employee's other leave. The employee is notified (`LEAVE_APPROVED` / `LEAVE_APPROVED_WITH_REVISION`) |
| **Decline** | The head (while PENDING, own team) or HR | A real refusal, never turned into a revision. Requires a **reason**. Status **REJECTED** (shown as *Declined*); reserved days are released; the employee is notified (`LEAVE_REJECTED`) |
| **Cancel** | The employee, own request | **Cancel request** in the detail, only while still awaiting a decision. Releases the reserved days (`LEAVE_CANCELLED`) |

Rules: *"You already have a leave request overlapping these dates"* (409),
*"Start date must be before end date"*, *"You can only endorse leave requests from
your own team members."*, *"Cannot approve a leave that is already …"*, *"This
request has already been acted on. Refresh to see its current status."* (two
people deciding at once).

**How days are counted** — `totalDays` is the number of **calendar days from
start to end, inclusive**. Weekends, holidays and rest days are **not**
excluded, because Hospicio's chargeable-day policy has not been confirmed; the
code explicitly refuses to guess (Appendix E).

### 12.2 Leave Requests (`/leave/requests`)

**Tabs:** **My Requests** (everyone), **Team Requests** (supervisors), **All
Requests** (HR). Search employees, filter by status and leave type,
**Refresh**, **New Request**.

Each row shows the stage in plain words — *Waiting for head* (or *Waiting for
HR* when there is no head), *Endorsed — with HR*, *Change proposed — with HR*,
*Approved*, *Approved with changes*, *Declined*, *Cancelled* — and, for a revised
leave, *Revised from …* under the dates.

**View** opens the **Leave Application** — everything on one screen, laid out
like the paper form: a **stage tracker** (Submitted → Head review → HR decision →
result; only the steps this request goes through); **Employee information**
(name, position, unit / department, date employed, completed years of service);
**Details of leave** (type, total number of leave applied, From – To, reason,
address during leave, contact number, date filed) — titled **Original request**
when the approval changed it, with **Final approved leave** (dates, days,
adjustment) beside it; the **change proposed** by the head, if any; the **Leave
record** for that type and year (**Total available**, **Less: this leave**,
**Balance after**, and the balance if the proposed change is approved — or
*Leave without pay uses no leave credits* / *no credits on record*); the head's
note, notes and the decline reason; and the **History** — only what actually
happened, from the audit trail (submitted, endorsed, change proposed, approved,
approved with changes, declined by the head / by HR, cancelled), with who and
when. Below it, only the actions this viewer may take now.

### 12.3 New Request (`/leave/new`)

Laid out like the paper form, in HRISense's style:

1. **Employee Information** — name, position, date employed (with completed
   years) and unit / department, read from the employee's record; never typed.
2. **Leave type** — grouped as on the form (VL · SL/EL · BL · Paternity /
   Maternity · Leave Without Pay · Others / Offset / Solo Parent).
3. **Leave details** — **From** and **To**; **Total Number of Leave Applied** is
   worked out (calendar days, see §12.1), never typed; **reason**; **Address
   During Leave** and **Contact Number** (prefilled with the mobile on record,
   changeable). Address and contact are optional.
4. **Leave record** for the chosen type — **Total Available**, **Less: This
   Leave**, **Balance After Leave** — before submitting. Asking for more than
   is available shows a warning but does not block filing: no Hospicio rule
   says it must, and the head or HR may approve fewer days.
5. **Submit** — the page says where it goes next: to the head first, then HR,
   or straight to HR when the employee has no head. There is **no attachment
upload**: the API accepts a link to a supporting document, but the form does not
offer one (Appendix E).

**HR can file for other people** (`POST /leave/batch`): an **employee selection
panel** (search, **Select This Page**, **Clear**) lets HR file the same leave for
several employees at once, or organisation-wide. Each is audited as
`LEAVE_REQUEST_CREATED_ON_BEHALF`. If some fail, *"Leave Creation Completed with
Some Issues"* lists the **Failed Employees** and why. After success: **View
Requests** or **File Another**. Non-HR users filing for others are refused:
*"You can only create leave for yourself."*; *"Organization-wide leave creation
requires FULL access tier."*

### 12.4 Leave Calendar (`/leave/calendar`)

A month calendar of leave. **Tabs:** **My Leave**, **Team Leave** (supervisors),
**Organization Calendar** (HR). Filters for status, leave type, unit and
department. Select dates to see who is off (**Clear Selection**); **Upcoming
Approved Leave** lists what is coming; **Create Leave** starts a request.
Ranges are limited to 6 months.

### 12.5 Leave balances

Per employee, per **year** and **leave type**: **allotted**, **used**,
**pending** (reserved by requests awaiting a decision), **forfeited**, and
**available** (allotted − used − pending − forfeited). They are shown on the
employee dashboard and on the profile's **Leave Balances** tab.

**Automatic entitlement by completed years of service** (Hospicio-confirmed).
Completed years count anniversaries of the start date on the calendar — not
days ÷ 365. Hired 15 June 2025: 0 completed years until 14 June 2026, 1 from
15 June 2026. (A 29 February start reaches its anniversary on 28 February in a
common year, the same way the profile counts length of service.)

| Leave type | < 1 year | 1 to < 3 years | 3 years or more |
|---|---|---|---|
| Vacation | 0 | 10 | 15 |
| Sick | 0 | 7 | 7 |
| Bereavement | 0 | 5 | 5 |
| Paternity | 0 | 7 only if HR marked the employee eligible | 7 only if eligible |
| Solo Parent | 0 | 7 only if HR marked the employee eligible | 7 only if eligible |

Paternity and Solo Parent eligibility are **HR-managed ticks** on the employee
(onboarding and Edit Profile). They are never inferred from sex, civil status,
children, name or role.

How it fits the balances — nothing already recorded is lost:

- A balance HR entered is **Manual** and HRISense never changes it. The
  **Entitlement by completed years** table beside the balances shows the policy
  figure, and where they differ HR can choose **Use policy (N)**
  (`LEAVE_BALANCE_SWITCHED_TO_AUTOMATIC`).
- An **Automatic** balance follows the policy: only its allotment moves (on an
  anniversary, or when HR changes the start date or an eligibility tick —
  `LEAVE_ENTITLEMENT_UPDATED`). Used, pending and forfeited days never change.
- When there is no balance yet and the policy gives more than zero days, an
  Automatic balance is created for the current year, with *used* and *pending*
  taken from the employee's existing approved and pending requests of that type
  and year (`LEAVE_ENTITLEMENT_APPLIED`).
- Balances stay per calendar year as before; nothing carries over and no reset
  rule was added (none has been defined). There are no background jobs: the
  entitlement is brought up to date when balances are opened, when leave is
  filed, on the dashboard, and when the start date or eligibility changes.
  **Update leave entitlements** (Leave page, HR) does every active employee at
  once (`POST /leave/entitlements/sync`). Separated and archived employees are
  never granted anything new.
- Every other leave type (Emergency, Maternity, Study, Offset …) has no confirmed
  entitlement and is set by HR (*"Leave balance saved."*; `PUT /leave/balances`,
  HR only), which marks that balance Manual. **Leave Without Pay** and **Other**
  use no leave credits.

If releasing reserved days would push *pending* below zero, the system records a
`LEAVE_BALANCE_PENDING_ANOMALY` audit entry rather than silently clamping it.

### 12.6 Where approved leave appears — and where it does not

Approved leave appears on the **Leave Calendar**, the **dashboard calendar**
(*"My … leave"* / team members' leave), in dashboard figures, and in the
attendance import's checks: punches during approved leave are held as
`ATTENDANCE_DURING_APPROVED_LEAVE`.

It does **not** automatically appear as *On leave* in Daily Monitoring or the
Attendance Tally. Those count *On leave* only from attendance records with that
status, and neither imports nor approvals create such records (Appendix E).

---

## 13. Performance evaluations

**Purpose** — structured performance reviews in Hospicio's workflow. Every cycle
runs as one of **two evaluation types**, chosen by HR when the cycle is created
(it cannot change afterwards — the two have different assignments):

**Standard Evaluation** — the head alone rates:
1. HR creates / distributes the evaluation (a cycle);
2. the assigned **head / supervisor / coordinator** evaluates the employee — the
   average of each review area, the overall result and its percentage are
   calculated automatically;
3. the head **discusses the evaluation with the employee** and records it;
4. **HR reviews and finalises**.
There is **no self rating, no peer rating and no 20 / 20 / 60** in a Standard
Evaluation.

**Weighted Multi-Rater Evaluation** — self 20% + peer 20% + head 60%:
1. HR creates / distributes the evaluation;
2. the **employee completes a self rating**;
3. **peer evaluators** selected by HR complete peer ratings;
4. the assigned **head / supervisor / coordinator** completes the evaluator rating;
5. the server computes the **final weighted result** (§13.4);
6. the head **discusses the result with the employee** and records it;
7. **HR reviews and finalises**.

Either way the result becomes visible to the employee according to HR's choice.

**Who** — **HR** runs templates and cycles, chooses the evaluation type, heads
and peers, monitors progress and finalises — **HR never rates** (enforced by
the API, §13.3). **Sister** (also full access, no supervisor) has the same
administrative authority and the same limits. **Employees** complete their own
self rating and any peer evaluations assigned to them (weighted cycles), and
see their final result once HR has finalised it and made it visible. **Heads /
supervisors / coordinators** complete the evaluations explicitly assigned to
them and record the discussion. **Where** —
`/evaluations` (sidebar *Performance → Evaluations*); the profile's
**Evaluations** tab. API `/api/v1/evaluations`.

### 13.1 Concepts

- **Template** — a reusable evaluation form: a name and description, a
  **rating method** (**Numeric** scale, or **Labeled** levels) with a min–max
  score, optional **weighting** (criterion weights must total 100%), and one
  or more **criteria**. A labelled scale is scored through the **value of each
  label** stored with the template (Forms 1–4: Unsatisfactory 1 … Excellent 5;
  4-point satisfaction: Poor 1 … Highly Satisfactory 4). Evaluators pick the
  label; the server looks up its value — the browser never supplies it. A
  template's labels all carry values or none do; a **written / descriptive**
  template has no score and can be used in a **Standard** Evaluation only.
- **Template per job role** — a template can be marked *Used for job roles*; a
  job role has at most one. In a new cycle, employees in those roles are
  evaluated with that template and everyone else with the cycle's template. This
  is how separate forms for separate groups are supported (Hospicio's official
  forms: §13.4).
- **Cycle** — a review period: its **evaluation type** (Standard, or Weighted
  Multi-Rater), a name, one active template, a **start date** and a **due
  date**, the **target employees**, and how the head evaluator is first chosen.
  Status **Active → Closed** (or Archived).
- **Assignment** — one rater's rating of one employee in one cycle. Each has a
  **rating type**: **Head / supervisor / coordinator evaluation** (both types),
  and — in a weighted cycle only — **Self rating** and **Peer evaluation**. Each
  rater's rating stays on its own assignment; a weighted cycle combines them
  into the final result only by the 20 / 20 / 60 rule.
  Status **Not started → In progress → Submitted → Finalized**. The head
  evaluation also carries the **discussion** (date, notes) and HR's finalisation.

### 13.2 Screens

**Tabs:** HR sees **Evaluation Cycles**, **Evaluation Templates** and **My
Evaluations**; everyone else sees only **My Evaluations**, which lists what
**they** must complete — their self rating, peer evaluations assigned to them,
head evaluations assigned to them (with **Record Discussion** once submitted) —
plus their own finalised, visible result. Each tab has a keyword and status
filter (**Clear Filters**) and **Refresh**.

**Evaluation Templates (HR)**

| Button | What happens |
|---|---|
| **New Template** / **Create Evaluation Template** | A 4-step form: name and summary → rating scale and whether to weight → criteria (**Add Criterion**) → review → save. *"A template must have at least one criterion."*, *"Criterion weights must total 100% when weighting is enabled."* (`EVALUATION_TEMPLATE_CREATED`) |
| ✏ **Edit template** | The same form; saving replaces the criteria (`EVALUATION_TEMPLATE_UPDATED`) |
| **Deactivate template** | *"Deactivate Evaluation Template?"* — it can no longer be chosen for new cycles (`EVALUATION_TEMPLATE_DEACTIVATED`) |

**Evaluation Cycles (HR)**

| Button | What happens |
|---|---|
| **New Evaluation Cycle** | A 3-step form. (1) **Evaluation type** — two cards, **Standard Evaluation** (*head / supervisor / coordinator evaluates the employee*) or **Weighted Multi-Rater Evaluation** (*20% Self · 20% Peer · 60% Head*), the chosen one marked *Selected*; it is required (*"Choose the evaluation type"*). Then *Set up the evaluation period* — name, active template (in a weighted cycle a written-answers template cannot be chosen), start and due dates (*"Due date cannot be earlier than start date"*). (2) *Who will be evaluated?* — filter by unit and job role, **Select Matches**, **Clear**. (3) *Who is the head / supervisor / coordinator evaluator?* — **Immediate Supervisor**, **One Evaluator** (the *Designated Evaluator* list leaves out HR and other full-access administrators), or **Manual Assignment**; and **Templates that will be used** — how many
employees get each template (their job role's, or the cycle's), with **Show each
employee's template** (`POST /evaluations/cycles/preview`). Saving creates the cycle with a head evaluation wherever a head could be determined, and — **weighted cycles only** — a **self rating** for every employee (`EVALUATION_CYCLE_CREATED`, with the evaluation type) |
| Open a cycle | The **evaluation type** card (Standard, or Weighted with *Self 20% + Peer 20% + Head 60%*), then one row per employee: in a weighted cycle **Self rating** (Completed / Pending) and **Peer evaluations** (*x of y completed*, with names); in both, **Head / supervisor / coordinator** (who, and Completed / In progress / Pending, or *Not assigned*), **Discussion** (Completed with date / Pending), **HR finalization** (Completed / Ready to finalize / Pending, with what is still missing) and the result so far (Standard: *overall / 5 (%)*; Weighted: the weighted result). Counts are per employee evaluated, not per rater |
| **Evaluators** (per employee) | HR chooses the **head / supervisor / coordinator** (not only the automatic supervisor; cannot be changed once that evaluation is submitted; `EVALUATION_HEAD_EVALUATOR_ASSIGNED` / `_CHANGED`) and, in a weighted cycle, **peer evaluators**, picked **from a unit** HR selects or **individually** — only the people HR ticks are added; choosing a unit never adds the whole unit (`EVALUATION_PEERS_ASSIGNED`). A peer who has not submitted can be removed (`EVALUATION_PEER_REMOVED`). Only people the API accepts are offered (§13.3); a Standard cycle has no peers (*"A Standard Evaluation has no peer rating"*) |
| **Close evaluation cycle** | *"Close Evaluation Cycle?"* — status **Closed** (`EVALUATION_CYCLE_CLOSED`) |

Employees with no head evaluator (Manual Assignment, or no supervisor) show *Not
assigned* until HR assigns one (in a weighted cycle they still get their self
rating).

Cycles created before evaluation types existed (6 Oct 2026) were kept as they
were: those that combined self, peer and head ratings are **Weighted
Multi-Rater** cycles with the percentages they were created with; the rest are
**Standard** cycles.

### 13.3 Filling in an evaluation

Opening an assignment shows the form titled by its rating type — *Self rating*,
*Peer evaluation* or *Head / supervisor / coordinator evaluation* — each criterion
with its rating (and weight), then the summary and recommendations.

| Button | Who | What happens |
|---|---|---|
| **Save draft** | **The assigned evaluator only** | Saves progress; status **In progress** (`EVALUATION_DRAFT_SAVED`) |
| **Submit** | **The assigned evaluator only** | Every criterion must be rated within range. Status **Submitted** (`EVALUATION_SUBMITTED`). A submitted rating can be **reopened** by its evaluator until HR finalises — for the head evaluation, only until the discussion is recorded |
| **Mark discussion completed** | The assigned head / supervisor / coordinator, after submitting | Discussion **date** (not in the future) and **notes**, both required (`EVALUATION_DISCUSSION_COMPLETED`). After this the head's ratings are locked |
| **Finalize** | **HR only** (or Sister), from the head evaluation | **Standard:** allowed once the head evaluation is submitted **and** the discussion is recorded. **Weighted:** also the self rating and every selected peer evaluation (at least one peer). Otherwise the screen lists what is missing (*"This evaluation cannot be finalised yet: …"*). HR decides whether the employee may see the result (the switch starts **off**). HR finalises the ratings as given — it cannot enter or change a rating. The self and peer ratings are closed with it; peer ratings are never shown to the employee (`EVALUATION_FINALIZED`) |

**Results shown.** *Standard:* **Result — Standard Evaluation** — each review
area's **average** (*Knowledge & Skills 4.25 / 5*), the **overall** (*4.13 / 5*)
and its **percentage** (*82.6%*), all calculated by the server from the head's
ratings. *Weighted:* **Final rating** — Self, Peer (count, peer average) and Head,
each with its average, percentage and weighted contribution, then the final and
its equivalent percentage (§13.4). Wherever a finalised weighted evaluation's
score is shown (lists, profile, AI assistant) it is the **final weighted
result**, never the head's own score.

**HR never rates — enforced by the API:**
- Only the **assigned evaluator** may save, submit or record the discussion:
  *"HR administers evaluations but does not rate them. Only the assigned
  evaluator can enter ratings."*
- HR cannot **assign themselves** in any way (designated evaluator, head, peer),
  nor choose the evaluators of **their own** evaluation.
- **Full-access administrators (HR, Sister) are never a rating source because of
  their tier:** never a peer, never the designated evaluator, and a head only of
  their **own direct reports** (the org structure: e.g. the HR Officer is the
  head of the HR Assistant who reports to them). Being FULL never makes anyone an
  evaluator.
- HR cannot finalise an evaluation it is **part of** — its own, or one it rated:
  *"You are one of the evaluators of this evaluation, so another HR
  administrator must finalize it."* Another HR administrator or Sister does.

HR sees, on the head evaluation, every component of the employee's evaluation
(each rater's status and score separately) and can step to each one with **View**.

**Who can read an evaluation:** HR (all); the assigned evaluator (their own
assignment only — a peer sees only the peer evaluation assigned to them, a head
only the head evaluation assigned to them); and the **employee being evaluated —
only their head evaluation, once it is Finalized *and* marked visible to them**
(*"Evaluation is not yet finalized or visible"*). An employee's history is on
their profile's **Evaluations** tab. Nobody may view another person's history
without the right: *"Cannot view another employee evaluation history"*.

**Deadlines on the dashboard calendar:** *"Evaluations due — (cycle)"*, *"Complete
your self rating"*, *"Peer evaluation — (person)"* and *"Evaluate (person)"*.

Evaluations finalised before 1 Oct 2026 keep their result; their discussion
shows *"Not recorded (finalized before this step existed)"*.

**No notifications are sent** for evaluations: the `EVALUATION_ASSIGNED` and
`EVALUATION_SUBMITTED` types exist but nothing raises them (Appendix E).


### 13.4 Hospicio's official evaluation templates

Five templates come from the Word forms Hospicio de San Jose supplied (installed
by `src/scripts/seed_official_evaluation_templates.ts`, checked against the
documents by `scripts/evaluation/verify_official_forms.ts`):

| Template | Source document | Review areas · statements | Scale | Overall score |
|---|---|---|---|---|
| Eval Form 1 | EVAL FORM 1.docx (EPRForm1) | 10 · 39 | 1 Unsatisfactory · 2 Fair · 3 Good · 4 Very Good · 5 Excellent | Σ area average × area weight |
| Eval Form 2 | EVAL FORM 2.docx (EPRForm2) | 10 · 41 | same | same |
| Eval Form 3 | EVAL FORM 3.docx (EPRForm3) | 10 · 37 | same | same |
| Eval Form 4 | EVAL FORM 4.docx (EPRForm4) | 10 · 30 | same | same |
| Simplified Evaluation for Coordinators, Supervisors, and Heads | SIMPLIFIED EVALUATIONfor Coordinators.docx | 10 · 30 | 1 Unsatisfactory · 2 Improvement Needed · 3 Satisfactory · 4 Very Satisfactory · 5 Exceptional | the form's rule: factor total ÷ 3, then Σ averages ÷ 10 |

- **Read-only.** Official templates are marked *Official · Hospicio de San Jose*;
  they can be viewed, used in cycles and **duplicated as custom** — never edited
  or deactivated (API: 409). Which job roles use one can be changed (configuration).
- **Weights.** The paper Forms 1–4 print no weights; HRISense starts them at an
  equal split (10% per area), labelled as an HRISense calculation. A custom copy
  can change them. Weights are checked in hundredths of a percent: they must
  total exactly 100. **Auto-Distribute to 100%** splits equally, the last item
  taking the rounding (3 → 33.33 / 33.33 / 33.34).
- **Written sections** follow each form: Comments per statement, *Additional
  Comments*, *Goals and Objectives* (Forms 1–4); one *Comments* box (Simplified).
  The employee acknowledgment text is shown at the discussion step; recording
  the discussion does not mean the employee agrees.
- **Job-role mappings** were made only where the role clearly is the group
  Hospicio named; Houseparents (Form 2), "Information" and "Office Staff" beyond
  the secretaries, Clinic Staff, and the HR Officer are left for HR to map.
- **Either evaluation type** can use any of these templates (a weighted cycle
  needs a scored one — all five are).
- **Weighted Multi-Rater final result — Hospicio's official weighting: self 20% +
  peer 20% + head / supervisor / coordinator 60% = 100%** (confirmed by
  Hospicio, 2 Oct 2026; set once as `HOSPICIO_SOURCE_WEIGHTS` in
  `evaluation-weights.ts`, served by `GET /evaluations/config`). Every weighted
  cycle uses it; it is not configurable (*"A Weighted Multi-Rater Evaluation
  always uses Hospicio's weighting"*). Peers share the one peer percentage: their
  overall scores are averaged first (4 decimals: 4.20, 4.00, 4.30 → 4.1667) — 20%
  is never multiplied by the number of peers. The server computes contribution =
  average × weight ÷ 100 (2 decimals), final = Σ contributions, and the
  equivalent % = final ÷ 5 × 100 — e.g. 4.00 × 20% + 4.1667 × 20% + 4.50 × 60% =
  0.80 + 0.83 + 2.70 = **4.33 / 5 = 86.6%**. Nothing is re-weighted when a
  component is missing: the result stays incomplete, and a peer must be
  assigned. HR finalises only after every rating and the discussion; the result
  and its breakdown are then frozen on the head assignment. The AI never sets a
  score; it reports this final result (*4.33 / 5*), not the head's score.

---

### 13.5 Awards & Recognition (`/awards`)

Hospicio's recognition awards — separate from evaluations: **no evaluation
score is used to pick a winner**, and the AI assistant never nominates, votes,
counts or decides. The system identifies who is eligible and tallies the votes;
**people review, verify and declare the final results** (Human Decision
Support). Sidebar *Performance → Awards & Recognition*; API `/api/v1/awards`.

**Everyone** sees *My Awards*: open nominations, their ballots (with votes used
/ remaining, and *Ballot submitted* once sent), final results (awardees and
placement — vote totals stay with HR) and their own award history (including
Hall of Fame). **HR / FULL** also has *Manage Awards*, *Voting Groups*, *Hall of
Fame* and *Award History*.

**Stages** (only those an award uses): Draft → Nomination open → Nomination
closed → Voting open → Voting closed → **Review** (the automatic tally is frozen)
→ **Verified** → **Final**. In review the committee records **Confirm** (with a
placement) or **Not awarded** for each shortlisted result, with a note;
*Verify results* is refused while any is undecided; *Declare final results*
makes them permanent and visible to employees. Only a draft with no nominations
or votes can be deleted — finalised results never. Each period is its own record
(*Employee of the Quarter — Q1 2027*, *Special Awards — CY 2027*), so earlier
years keep their titles and results.

**Voting rules for every award:** each voter has one ballot per award, submitted
once — a refresh, a second tab or a double click cannot add votes (one ballot
row per voter per award, created in the same transaction as the votes). Votes in
a category always go to **different** nominees. **Self-voting is allowed.**
Every nominee starts at **0 votes**. Nobody — not even HR — is shown who voted
for whom; HR sees turnout while voting is open and the tally after it closes.
Ties at the last shortlisted place are kept whole and marked *Tie at cutoff* for
the committee; nominees without a vote are not results. Years of service are
completed anniversary years (not days ÷ 365), counted as of the award's
eligibility date.

| Award (official) | Nominees | Votes per voter | Result |
|---|---|---|---|
| **Employee of the Quarter** | Nominated by any employee, from the category's group. **Not eligible as nominees** (they still vote): Assistant Administrator, Human Resource Officer, Head Pastoral Care/Homelife Services, Head SSD and every Supervisor and Coordinator (editable per period) | Only the category's own group votes: **Social Worker of the Quarter 1 · Homelife Staff of the Quarter 2 · Health Staff of the Quarter 1 · Admin Services Staff of the Quarter 2** | Ranked per category; the committee decides |
| **Vincentian Service Award** | **3 or more** completed years, by group; Hall of Fame excluded | Everyone: **1 each for Admin, SSD, Pastoral, Health = 4** | **Top 15** overall → review |
| **Louisian Service Award** | **3 or less** completed years (exactly 3 is in **both**); Hall of Fame excluded | Everyone: **1** | **Top 15** → review |
| **Special Awards** | Organisation-wide; Hall of Fame excluded | Everyone: **1 per award × 5** (Most Friendly, Most Responsible, Most Courteous, Most Available, Most Well Groomed) | **Top 5 per award** → review |
| **Longevity Awards** | Recommended at **5 / 10 / 15 / 20** completed years, unless that milestone was already confirmed | No voting | **HR confirms** each recommendation |

The year's ballot is therefore Vincentian 4 + Louisian 1 + Special Awards 5 =
**10 votes** (Hospicio's message said 9 counting four Special Awards; all five
named titles are kept). Special Award titles can be renamed in a draft; a new
period starts from the latest titles, and earlier periods keep theirs.

**Voting Groups.** Hospicio's four groups — *Admin Services*, *Social Services*,
*Pastoral Care & Homelife Services*, *Health Services* — are mapped by HR to
current job roles, units or employees (never new job roles). HRISense mapped
only words that clearly name a current role: Social Workers, ECCD Teacher;
Clinic Staff, PT Staff, PT Coordinator; Accounting, PMO, Maintenance (Staff and
Supervisor), Janitorial (Staff and Supervisor), Kitchen (Staff and Supervisor),
Canteen, Bakery, Chapel, Stockroom and Laundry Staff. **Not matched — HR maps
them:** *Secretary* (Social Services), *Houseparents / Caregivers* (Pastoral —
so that group is empty until HR maps it), *Health Staff*, *Motorpool*, *Admin /
HR*, *Information*. A group with nothing mapped cannot open nomination or voting.

**Hall of Fame** is a record HR keeps (employee, award year, title, date
conferred, notes) — no formula decides it. Awardees are not nominees for the
Vincentian, Louisian or Special Awards, and they still vote.

**Custom awards** (*Create award → Custom award*): title, description, year (and
quarter), whether nomination and/or voting is used, whether HR review is
required, result mode (per category / one ranking) and Top N, optional years of
service limits, Hall of Fame exclusion, and categories with their votes, nominee
group and voter group. Marked **Custom**; the official awards' rules are not
editable.

Audited: `AWARD_CREATED / _UPDATED / _STATUS_CHANGED / _FINALIZED`,
`AWARD_RESULT_DECIDED`, `AWARD_SHORTLIST_CONFIRMED`, `AWARD_NOMINATION_SUBMITTED`,
`AWARD_BALLOT_SUBMITTED` (that a ballot was cast — never the choices),
`AWARD_GROUP_*`, `HALL_OF_FAME_RECORDED / _REMOVED`.

### 13.6 Yearly Achievements (`/achievements`)

Hospicio's institutional achievements, **one page per year** — not performance
evaluations. Sidebar *Performance → Yearly Achievements*; API
`/api/v1/achievements`.

- **Everyone signed in** sees the **published** years as cards (newest first)
  and opens a year to read its introduction and achievements (with an image or
  a PDF where one was attached).
- **HR (FULL)** selects **New year** (any year — nothing is built in; one page
  per year), then on the page: **Edit page** (title, introduction, year), **Add
  achievement** (title, description, optional JPG / PNG / WEBP image or PDF up to
  5 MB), edit / move up / move down / remove each achievement, **Publish** /
  **Unpublish**, and **Delete**. A page starts as a **Draft**, visible to HR only
  (its files too). Audited (`YEARLY_ACHIEVEMENTS_*`, `YEARLY_ACHIEVEMENT_*`).
- **Five sample pages (2022–2026)** were added on 8 Oct 2026 to show the layout
  (`src/scripts/seed_sample_yearly_achievements.ts`). They are marked **Sample
  content**, describe no real event, award or person, and are ordinary records
  for HR to rewrite or delete.

## 14. Training & Seminars

**Purpose** — organise training activities, record who attended and completed
them, keep certificates, and — where a training fulfils a compliance
requirement — record that fulfilment automatically.

**Who** — **HR** creates and manages activities (all write endpoints are
HR-only). Everyone can open the page and view activities. **Where** —
`/training` (sidebar *Performance → Training & Seminars*); the profile's
**Training** tab. API `/api/v1/training`.

**Activity types:** Training, Seminar, Workshop, Orientation, Conference,
Other. **Activity status:** Draft, Scheduled, Completed, Cancelled.
**Participant outcome:** Assigned, Completed, Did not attend, Excused, Cancelled.

### 14.1 The list

Summary cards (**Total Activities**, **Upcoming / Scheduled**, **Completed
Activities**, **Enrolled Participants**), a keyword **Search**, filters by
activity type and status, **Clear Filters**, **Refresh**. HR has **Create
Training / Seminar**.

### 14.2 Creating or editing an activity (HR)

A 4-step form:

1. *What activity are you creating?* — title, type, provider/facilitator, venue.
2. *When will it happen?* — start and end dates and times, **hours credit**,
   **capacity**, and an optional **linked compliance requirement**.
3. *Who should attend?* — filter employees, **Select Matches**, **Clear**; this
   builds the participant roster.
4. *Review* — then save. *"Training activity created with N participants."*

Rules: *"Activity title is required"*, *"Provider / Facilitator is required"*,
*"Venue / Location is required"*, *"End date cannot be earlier than start
date"*, *"Linked compliance requirement not found"*.

### 14.3 Managing an activity (the detail view)

| Control | What happens |
|---|---|
| **Add Participants** | Pick more employees and add them (*"Added N participants…"*). *"No employees specified to add"* |
| A participant's **status** | *"Update Participant Outcome"* — set Completed / Did not attend / Excused / Cancelled, with a completion date, a **valid until** date and notes |
| Select several → bulk update | *"Update N Selected Participants"* — the same, for many at once |
| **Upload certificate** / **Replace** | Attach a participant's certificate (HR only; `TRAINING_CERTIFICATE_UPLOADED`) |
| **Download Certificate** | Downloads it — for HR, or the participant themselves |
| **Upload Activity Document** | Attach materials to the activity (HR only; `TRAINING_DOCUMENT_UPLOADED`) |
| Download a document | HR only: *"Only FULL HR can access activity documents."* |
| **Cancel Training Activity?** | Status **Cancelled** (*"Training activity cancelled."*) |

**Completion → compliance.** When a participant is marked **Completed** and the
activity is **linked to a compliance requirement**, HRISense automatically
creates that employee's **compliance record** for the requirement, already
**Accepted**, expiring on the *valid until* date. The training then counts
toward their compliance status (§15).

### 14.4 Where training appears

The profile's **Training** tab (HR or the person), the employee dashboard's
upcoming trainings, and the dashboard calendar.

> **Roster privacy:** HR sees every participant. Everyone else sees the list of
> activities and their **aggregate** counts, but only **their own** participant
> row — not who else was assigned or who did not attend. A person's training
> history (profile → Training) is readable by HR, the person, and their
> supervisors (the same rule as the profile). Certificates and activity documents
> are protected. Training raises no notifications (`TRAINING_REMINDER` is unused).

---

## 15. Compliance

**Purpose** — define the requirements staff must meet (licenses, certificates,
clearances, trainings, government registrations), record each person's
fulfilment, and track what is missing, expiring or expired.

**Who** — **HR only** for the Compliance page and all management. Employees and
supervisors see their own (supervisors: their direct reports') compliance on
profiles and dashboards (*"Unauthorized. Not a direct subordinate."* for
anyone else). **Where** — `/compliance` (sidebar *Health & Compliance →
Compliance*); the profile's **Compliance** tab. API `/api/v1/compliance`.

### 15.1 Concepts

- **Requirement** — a name, a **category** (Medical, Psychological,
  Certification, **Professional License**, Training, Document, Other), whether it
  **tracks expiry**, and a **reminder window** in days. Lifecycle **Active** or
  **Inactive**. Expiry is always HR's choice per requirement — no renewal period
  is built in for any type.
- **Hospicio requirement types** — the create form offers them as starting
  points: *Psychological Assessment / Examination* (fulfilled through the
  Psychological records module), *Medical Exam* (through the Medical records
  module), *NCII Certificate — Caregiving*, *Professional License* (for Physical
  Therapist, Nurse, Midwife, Social Worker and Teacher roles) and *Other* (any
  other requirement, by name). Choosing one only fills the name and category, and
  for the two role-specific ones switches the scope to job roles; nobody is
  assigned until HR picks who it applies to. For Professional License the form
  points out job roles whose titles name one of those professions; anything else
  HR ticks. No requirement rows were created automatically.
- **Scope** — who must meet it: **All** employees, a **Unit**, a **Department**,
  one or more **Job Roles**, or one specific **Employee**. A requirement can have
  several scopes.
- **Record** — one employee's fulfilment: completed date, **expiry date**,
  notes, documents, and a **review status** (Pending review, Accepted, Needs
  correction).

**Status per employee per requirement** — computed whenever it is read (there is
no background job):

| Status | When |
|---|---|
| **Missing** | No record on file |
| **Needs review** | The latest record is *Pending review* or *Needs correction* |
| **Expired** | The expiry date has passed |
| **Expiring soon** | It expires within the requirement's reminder window |
| **Valid** | Accepted and not near expiry, or no expiry |

*Needs attention* lists them in this order: Expired, Missing, Expiring soon,
Needs review.

### 15.2 The Compliance page (HR)

**Compliance Monitoring** shows organisation-wide summary figures, then:

- **Items Needing Attention** — each problem (person × requirement) with **Add
  Record**, plus **View Medical** / **View Psych** shortcuts for health items.
- **Requirements** — the list, with **Create Requirement** and **Deactivate**
  per requirement (*"Deactivate this requirement? It will no longer be evaluated
  as an active requirement. Existing employee records and history will
  remain."* → *"Requirement deactivated"*, `COMPLIANCE_REQUIREMENT_ARCHIVED`).
- **Employees** — each employee's compliance count; **Details** opens their
  breakdown.
- Filters (**Clear Filters**) and **Refresh**.

**Create Requirement** — a 4-step form: *What requirement are you adding?* (name
and category; *"Please enter a requirement name"*) → *Who needs this
requirement?* (all, unit, department, job role, or **Choose Specific Employee**)
→ *Does this requirement expire?* (expiry tracking and reminder window) →
*Review* → create (*"Compliance requirement created successfully"*;
`COMPLIANCE_REQUIREMENT_CREATED`, `COMPLIANCE_SCOPE_ADDED`).

**Record Compliance Fulfillment** (from *Add Record*, or a profile's Compliance
tab) — choose the requirement, the completion and expiry dates, add notes and
documents, and submit (*"Compliance record submitted successfully"*;
`COMPLIANCE_RECORD_CREATED`). The record is saved as **Pending review**.

### 15.3 Other ways records arrive

- **Training completion** creates an **Accepted** record automatically when the
  training is linked to the requirement (§14).
- **Medical** and **psychological** records have their own pages and their own
  review workflow (§16).

### 15.4 Where compliance shows up

HR dashboard (*Compliance: Action Required*, *Needs Review*), supervisor
dashboard (team figures), employee dashboard (*My Requirements*), the profile's
Compliance tab, and the dashboard calendar (*"(requirement) expires"*).

> **Two defects found during this review (Appendix E):**
> 1. **Employee-scoped requirements apply to everyone.** The scope check returns
>    "applies" for any requirement scoped to *a* specific employee without
>    checking *which* one. The database holds one such requirement (a QA test,
>    *"QA_COMPLIANCE_TEST BLS Certification"*), so it is currently counted as
>    **missing for 48 other employees**, inflating the Action Required figures.
> 2. **Nothing reviews general compliance records.** Records from *Record
>    Compliance Fulfillment* are saved as *Pending review*, and the review
>    endpoint (`PATCH /compliance/records/:id/review`) exists, but no screen
>    calls it, so those records stay **Needs review** indefinitely.

---

## 16. Medical and psychological records

**Purpose** — keep employees' medical examinations and psychological
assessments, with strict privacy, review by HR, expiry tracking, and a link to
compliance requirements.

**Where** — `/medical` (*Health & Compliance → Medical Records*) and
`/psychological` (*Psychological*); the profile's **Medical** and
**Psychological** tabs (HR or the person themselves). APIs `/api/v1/medical`,
`/api/v1/psychological`.

### 16.1 Privacy rules (enforced by the API)

| | HR | The employee (own records) | Supervisor |
|---|---|---|---|
| Organisation-wide list | ✅ | — *"Only HR personnel can access organization-wide … records."* | — |
| Medical record | Full, **including HR notes** | Read-only, **without HR notes** | **Not permitted** for subordinates |
| Medical documents | ✅ | — *"Medical documents require FULL tier access."* | — |
| Psychological record | Full, **including confidential notes** | Read-only: the **employee-visible summary** only | **Not permitted** for subordinates |
| Psychological documents | All | Only those marked **Employee visible** | — |

A non-HR user who opens **someone else's** record gets the same *"… record not
found"* (404) as for a record that does not exist, so the answer never reveals
that a confidential record exists.

Psychological records use a **two-zone** model: an *employee-visible summary*
the person may read, and *HR confidential notes* that are never shown to the
employee or any supervisor. Documents are either **Employee visible** or **HR
only**. Medical `hrNotes` and psychological `hrConfidentialNotes` are also never
given to AI Assistance.

### 16.2 The pages

**HR** sees the full page: summary cards (**Total Records**, **Needs Review**,
**Expiring Soon**, **Expired**), filters (employee, exam or assessment type,
status; **Clear Filters**) and the list. **Non-HR users**: Medical is hidden from
the sidebar, and opening it shows *"Medical & Health Records Access
Restricted"*. The Psychological page shows them only **their own** results
(*"Personal assessment records and authorized wellness summaries."*).

### 16.3 Actions (HR)

| Button | What happens |
|---|---|
| **Add Medical Record** | A 4-step form: *Who is this record for?* → *Enter examination details* (exam type, date, clinician or clinic) → *Add record information* (optional **compliance link**, **valid until**, notes, a report attachment) → *Review*. Saved as **Pending review** (`MEDICAL_RECORD_CREATED`). *"Please select an employee"*, *"Please provide an examination date"*. If the attachment fails: *"Record created, but initial document upload failed."* |
| **Add Psychological Record** | A 5-step form: employee → *assessment details* (type, date, psychologist or clinic) → *Does this assessment relate to a requirement?* (compliance link, expiry) → *What information should be recorded?* (**employee-visible summary**, **confidential notes**, document visibility) → *Review*. Saved as **Pending review** (`PSYCH_RECORD_CREATED`) |
| **Edit** | *Edit Medical / Psychological Record* (`…_RECORD_UPDATED`) |
| **Administrative Review** | Mark **Accepted** or **Needs Correction**, with a reason: *"Record marked as Accepted"* (`…_RECORD_REVIEWED`) |
| **Upload document** | *Upload Medical / Psychological Document* (`…_DOCUMENT_UPLOADED`) |
| **Download document** / **Delete document** | *"Delete this document?"* (`…_DOCUMENT_DELETED`) |
| **Delete record** | *"Are you sure you want to delete this … record? This action cannot be undone."* — a soft delete (`…_RECORD_DELETED`) |

### 16.4 How they feed compliance

A compliance requirement in the **Medical** or **Psychological** category is
fulfilled by the employee's latest linked medical or psychological record. Its
review status and expiry drive the compliance status: pending or needs
correction → *Needs review*; accepted → *Valid*, *Expiring soon* or *Expired*
by date (§15). This is why the Compliance page offers **View Medical** and
**View Psych**.

---

## 17. Recruitment and the public Careers site

**Purpose** — publish job openings, receive applications from the public, move
applicants through screening and interviews, communicate with them, and turn a
hired applicant into an employee.

**Who** — **HR only** inside HRISense. Final decisions — publishing an opening,
marking an applicant Hired or Rejected, acceptance / rejection / free-text
emails, and converting to onboarding — belong to the **HR Officer and the
Sister**; HR Assistant / Staff screen applicants, schedule interviews and send
process emails. **The public** uses the Careers site with no account. **Where** — sidebar *Recruitment* → Overview (`/recruitment`), Job
Openings (`/recruitment/openings`), Applicants (`/recruitment/applicants`); public
site `/careers`. APIs `/api/v1/recruitment/*` and `/api/v1/public/recruitment/*`.

### 17.1 Lifecycles

**Job opening:** **Draft** → **Open** (published) → **Closed** / **Filled** →
**Archived**.

**Application:** **Submitted** → **Under review** → **For interview** →
**For requirements** → **Hired**, or **Rejected** / **Withdrawn** at any point.
(*Shortlisted* and *Interviewed* are kept for older records but are no longer
used for new actions.) **Hired is final**: *"Cannot revert status from HIRED.
Cancel the onboarding draft instead."* Every change is kept in the **status
history**.

**Interview:** **Scheduled** → **Completed** / **Cancelled** / **No show**, or
**Rescheduled**. Types: Initial, Technical, Panel, Final, Other.

### 17.2 Recruitment Overview (`/recruitment`)

Cards: **Active Openings**, **Total Applications**, **Under Review**, **For
Interview**, **Rejected / Withdrawn**.

### 17.3 Job Openings

**List** — **New Opening** / **Create Opening**, **Refresh**, paging.

**Create / edit** (`/recruitment/openings/new`, `/$id/edit`) — three parts,
with a live **Careers preview** beside them:

- **Position** — **Job Role / Position** (required) lists Hospicio's current job
  roles, grouped by unit. Choosing one fills in its **unit** and
  **department** and the **Posting title** — what applicants see; it starts as
  the role's title and stays editable. For an organisation-wide role (no unit)
  the form asks for the unit, but the API currently refuses that combination
  (Appendix E.12, #66). **+ New position** is for a role that does not exist
  yet: title, unit, optional department, *Reports to* (optional — *"Not set
  yet — HR confirms the reporting line later"*) and level **Staff** or
  **Supervisory (has direct reports)**. A title that matches an existing role
  once case, spacing, punctuation and a plural "s" are ignored is refused —
  the dialog offers **Use "…"** instead, and the API answers *"“…” already
  exists — choose it instead of creating a new position."* (409). Similar
  titles are listed to pick from. The code is generated; full (HR) access is
  never granted from this form. Audited as `JOB_ROLE_CREATED`.
- **Vacancy** — employment type, number of vacancies, opening and closing dates.
- **Posting content** — description, responsibilities, qualifications,
  **required documents** (optional).

**Save as Draft** (or **Save Changes** when editing) saves it
(`JOB_OPENING_CREATED` / `JOB_OPENING_UPDATED`); **Save & Publish** — shown
when creating, or editing a draft — saves it and then asks to publish (below).
Rules: *"Choose the position (job role) for this opening."*, *"Please fill in
all required fields"*, *"Closing date must be after or equal to opening date"*,
*"Vacancies must be a positive number"*, *"Job Role does not belong to the
specified Unit"*.

**Publish** — *"Are you sure you want to publish this opening? It will become
publicly visible on the Careers portal if the dates are valid."* Status **Open**.
It shows on the Careers site while its opening and closing dates cover today.

**Detail** (`/recruitment/openings/$id`) — description, responsibilities,
qualifications, required documents, job details, a timeline, and a status
control (*"Status changed to …"*).

### 17.4 Applicants

**List** (`/recruitment/applicants`) — every application, with filters,
**Refresh**, **View**, and paging.

**One application** (`/recruitment/applicants/$id`) — Position Details,
Personal Information, **Internal Notes**, **Status History**, and tabs:

| Control | What happens |
|---|---|
| **Update Status / Hire** → *Update Application Status* → **Confirm Status Change** | Moves the application; writes the status history; sends the matching **automatic email** (§17.6) |
| **Internal Notes** | Adds a private HR note (`APPLICANT_NOTE_ADDED`) |
| **Documents** tab | **Preview** (*Document Preview*) and **Download File Securely** — both audited (`APPLICANT_DOCUMENT_PREVIEWED` / `APPLICANT_DOCUMENT_ACCESSED`) |
| **Schedule Interview** | Date and time, type, location or link, interviewers → **Scheduled** (`INTERVIEW_SCHEDULED`) and an invitation email. ✏ edit to **reschedule** (`INTERVIEW_RESCHEDULED`) or change the outcome |
| **Compose Email** | Write a message, **Preview & Send** → *Confirm Send* |
| **Email Communications** | Every email sent or attempted, with its status. A failed one has **Retry** (*"Are you sure you want to retry sending this failed email?"*; only failed ones can be retried) |
| **Hiring & Onboarding** → **Convert to Onboarding** | For a **Hired** application only: creates an **onboarding draft** prefilled from the application (`APPLICANT_CONVERTED_TO_ONBOARDING`) with only what the applicant gave — name, suffix, email (as the personal / login email), mobile, address, and religion and sex **only if provided** — plus the opening's **unit, department, job role** (by their ids, never by name) and employment type, which HR can still change. Civil status is left blank for HR (applicants are never asked); government numbers, emergency contacts, education, licenses and every other employee-only field are completed by HR during onboarding. HR finishes it in the onboarding wizard (§6.2); completing it links the application to the new employee (`APPLICATION_LINKED_TO_EMPLOYEE`). *"Only HIRED applications can be converted…"*, *"This application has already been converted…"* |

### 17.5 The public Careers site (no account)

| Page | What the visitor can do |
|---|---|
| **Careers** (`/careers`) | A hero, then **Open Positions**: **only the Job Openings accepting applications now** — one card per opening (posting title, the position, unit and department, employment type, vacancies, closing date, **View Opening**, **Apply Now**) with an *Open now* count. **Search** covers only those openings; filters: **All open positions / a unit**, and the **employment type** when there is more than one. Job roles without an opening are **not** listed (changed 8 Oct 2026 — the earlier "every job role" directory was withdrawn). With nothing open: *"There are no open positions right now"*. Then the *Application Process*. |
| **Opening** (`/careers/$slug`) | Overview, key responsibilities, qualifications, required documents, **Apply Now**, **Back to Careers**. An opening that is not accepting applications (see below) or is unknown shows *"Opening Unavailable"* |
| **Apply** (`/careers/$slug/apply`) | *Submit Application*: **Personal Information** (first, middle and last name, suffix; email; mobile number; present address; **sex** and **religion**, both **optional** — *Sex
(optional)* defaults to *Not specified*, *Religion (optional)* can stay blank,
and the server stores a blank as no value; HR sees *"Not provided"*, and
onboarding from the applicant leaves those fields for HR to fill), **Documents** (**resume required**, cover letter optional; PDF, DOC or DOCX only), **Additional Information** (how they heard of the job, a message), and a **privacy consent** tick (required) |
| **Success** (`/careers/application-success`) | *"Application Submitted Successfully"*, a **reference number** (**Copy Reference Number**), **View my application status** |
| **Status** (`/careers/application-status/$token`) | A **private link** showing the reference, position, service unit, dates submitted and last updated, and the current status. A wrong link: *"This status link is not valid"* |

**Currently hiring — one rule.** An opening accepts applications only when its
status is **OPEN** and today is between its opening and closing dates (the
closing day included). The Careers list, the opening page and the application
endpoint all use this one rule (`acceptingApplicationsWhere` /
`isAcceptingApplications` in `job-opening.service.ts`), so a **DRAFT, CLOSED,
FILLED or ARCHIVED** opening — or an OPEN one past its closing date — never shows
as hiring, cannot be opened by its link, and refuses applications. A Job Role is
a *position*; only an opening HR created and published can be applied for —
there is no role-only application. The list comes from
`GET /api/v1/public/recruitment/positions`, which returns only the accepting
openings (slug, posting title, position title, employment type, vacancies,
dates, unit and department name) — no ids, codes, hierarchy, supervisors,
permissions or headcounts, and no job role without an opening.

**Rules on applying.** Required: first and last name, a valid email address,
a mobile number (digits, with optional spaces, dashes, brackets or a leading
**+**, 7–15 digits — *"Enter a valid mobile number using digits only, like
09171234567."*), a résumé (PDF, DOC or DOCX, at most 5 MB, checked by its
content as well as its name) and privacy consent. The form checks these itself
and marks each field; the API checks them again (400, `VALIDATION_ERROR`, with
each field's message).

**No duplicates — per opening.** An application is refused when the **same
opening** already has an application that is not *Rejected* or *Withdrawn*
with the **same email address or the same mobile number** (409,
`DUPLICATE_APPLICATION`): *"An application for this position has already been
submitted using this email address or mobile number."* The form shows it as
**Application already submitted**, directly above the Submit button, and adds
*"If you already applied, please use the application status link in your
confirmation email instead of submitting another application."* Applying to a
**different** opening with the same details is allowed. An opening that is
closed, filled, archived, still a draft or past its closing date answers 409
`OPENING_NOT_ACCEPTING` (*"This job opening is no longer accepting
applications."*), an unknown one 404.

**Nothing is lost on a failure.** The form keeps everything typed and attached;
the message says what happened and what to do; uploaded files of a refused
application are deleted. Once an application is saved, a failure of the
confirmation email is recorded on the applicant's communications and never
reported to the applicant as a failed application. If the request times out,
the form says the application *may* have been received and to check for the
confirmation email before trying again.

Public pages are **rate-limited** (§4.14): browsing and the status link, 60
requests a minute per IP; applying, 20 an hour per IP — checked *before* any
file is accepted — and 5 an hour per email address, whose refused uploads are
deleted. The status page shows *"This status link is not valid"* only for a
link the server does not recognise; a connection or server problem says
*"We couldn't check your application"* with **Try Again**.

**"I'm not a robot" on the application form.** When reCAPTCHA is configured
(see §4.1), every public application must tick the checkbox. The token travels
in the `X-Captcha-Token` header and is checked with Google **before the upload
is read**, so a bot's files are never written; a missing or expired tick is
refused (*"Please tick "I'm not a robot" to continue."* / *"The robot check
expired or was not accepted…"*) and the form keeps everything typed and
attached. The checkbox resets after any failed submission (a token works once).

### 17.6 Automatic applicant emails

| Event | Email |
|---|---|
| Application submitted | *Application received* (with the status link) |
| → Under review | *Application under review* |
| → For interview | *Interview process update* |
| Interview scheduled / rescheduled / cancelled | *Interview invitation* / *rescheduled* / *cancelled* |
| → For requirements | *Additional requirements* |
| → Hired | *Application accepted* |
| → Rejected | *Application not selected* |
| → Withdrawn | *Withdrawal confirmation* |

Emails are **really sent only when `RECRUITMENT_EMAIL_SEND_ENABLED` is on**.
Otherwise each is recorded as **Simulated**, with nothing sent. A failed send is
recorded as **Failed** (`AUTOMATIC_EMAIL_FAILED`), and HR receives a **SYSTEM**
notification so it can be retried.

---

## 18. Announcements

**Purpose** — official notices from HR to all staff or to chosen groups, with
scheduling, expiry, attachments and **read receipts**.

**Who** — **HR** writes and manages them. **Everyone** reads the ones addressed to
them. **Where** — `/announcements` (sidebar *Communication → Announcements*, with
an **unread badge**); recent ones also appear on dashboards. API
`/api/v1/announcements`.

### 18.1 Lifecycle

Stored state is **Draft**, **Active** or **Archived**. What people see is
worked out on every read, against the current time (no background job):

| Shown as | When |
|---|---|
| **Draft** | Not yet published — invisible to recipients |
| **Scheduled** | Active, publish time still in the future |
| **Published** | Active, publish time reached, not yet expired |
| **Past notice** | Active, but its end time has passed |
| **Archived** | Removed from everyone's feed by HR; data kept |

**Priority:** Normal, Important, Urgent. An announcement can be **pinned**
(*Pinned Announcement* at the top).

**Audience:** **All** active employees, or any combination of **Unit**,
**Department**, **Job Role** and specific **Employee** groups.

### 18.2 HR: managing announcements

HR switches between **Manage** and their own **recipient** view.

**Manage** — summary cards and tabs **Published / Scheduled / Drafts / Past
Notices**, a table fitted to the page with each notice's **read ratio** (read
/ recipients), **Refresh**, and per-row **View announcement**, **Edit
Announcement**, **Archive — removes it from everyone**, and **Delete** (drafts
only).

**Create / edit** — a 4-step wizard (**Back**, **Next Step**):

1. **Announcement Details** — title, message, priority, pin, and attachments
   (PDF, JPG, PNG, WEBP, DOC or DOCX, **up to 10 MB each**: *"… is too large.
   Maximum file size is 10 MB."*).
2. **Target Audience** — add one or more groups (*"This audience group is
   already added."*); **Audience Preview** shows exactly who would receive it.
3. **Publishing Schedule & Expiry** — publish now or at a future time, and an
   optional end time.
4. **Review Announcement** — then **Publish** (*"Announcement published
   successfully!"*), **Schedule** (*"Announcement scheduled for …"*), or **Save as
   draft** (*"Announcement saved as draft."*).

**On publish or schedule** the recipient list is **frozen** — a snapshot of
exactly who was addressed at that moment. That list drives read receipts and
the unread badges.

**Rules:** *"Please enter an announcement title."*, *"Please write an announcement
message."*, *"Please choose who should receive this announcement."*, *"Publish
time must be in the future."*, *"The end time must be after the publish time."*,
*"The audience can no longer be changed after publication."*, *"The publish time
cannot be changed after publication."*, *"Archived announcements cannot be
edited."*, *"Attachments can only be changed before the announcement is
published."*, *"A published announcement must be archived before it can be
deleted."*

**Detail view (HR)** — **Recipient Read Statistics**, the message, the target
audience, attachments (**Download**, **Remove** while still a draft),
**Announcement Recipients** (who has and has not read it), **Archive this
announcement?**, **Delete this draft?**

Audited: `ANNOUNCEMENT_CREATED`, `_UPDATED`, `_SCHEDULED`, `_ACTIVATED`,
`_ARCHIVED`, `_ATTACHMENT_UPLOADED`, `_ATTACHMENT_REMOVED`.

### 18.3 Everyone: reading

The feed shows **published** announcements addressed to you, pinned first.
**Open Notice** opens it and **marks it read** (`POST /announcements/:id/read`),
which updates your unread badge and HR's read statistics. Attachments download
through the API; *"This attachment is no longer available."* if it was removed.
Opening one not addressed to you: *"You do not have permission to view this
announcement."*

Announcements use their **own unread count**, separate from notifications (§4.6).

---

## 19. Reports & Analytics

**Purpose** — ready-made workforce reports with charts, a plain-language summary
and exports, for HR planning and for reporting upward.

**Who** — **HR only** (`/api/v1/reports/*` requires FULL). **Where** — `/reports`
(sidebar *AI & Analytics → Reports & Analytics*).

**Seven reports:**

| Report | What it shows | Charts |
|---|---|---|
| **Headcount** | Active employees by unit, department and employment status; hires and separations in the period | *Where people work*, *Employment status* |
| **Attendance** | Per-employee attendance facts for the period: present, late, absent, on leave, half day, days with a record, **no imported record** | *What the records say*, *Data coverage* |
| **Leave Requests** | Requests filed in the period by status and type | *Where requests stand*, *Why leave was taken* |
| **Compliance Standing** | Per-employee compliance status across active requirements | *Compliance standing*, *Where attention is needed* |
| **Training & Seminars** | Activities and participation outcomes | *Participation outcomes*, *Largest activities* |
| **Evaluations** | Assignment progress in active cycles | *How far the cycle has got*, *Assignments per unit* |
| **Recruitment Pipeline** | Openings and applications by stage | *Pipeline*, *Which roles draw applicants* |

**On the page:** a report picker; period and unit filters (**Clear filters**);
**Refresh**; stat tiles; an **About this report** box with a short summary
written *for that specific report* from its own figures; horizontal bar charts
showing counts **and percentages**, with status legends that use icons as well
as colour; and the data table. **Export** → **CSV**, **Excel** or **PDF**
(*"Report exported."*).

Reports follow the same honesty rules as the rest of the system: *no imported
record* is its own category, never counted as absent.

---

## 20. AI Assistance

**Purpose** — the **HSJ HRISense assistant**: answers questions about HRISense
and about the records the signed-in person is allowed to see, in plain
language, with charts where they help. For HR it is organisation-wide decision
support. **It is read-only and advisory: every decision stays with people.**

**Who** — **everyone signed in** (HR, supervisors, employees), each within their
own access. **Where** — `/ai-assistance` (sidebar *AI & Analytics → AI
Assistance*, with an *AI* badge), and the **Ask AI** bubble in the lower-right
corner of every page. HR's page also has a **Workforce summary** tab.

Full technical design: [`docs/HRISENSE_AI_ARCHITECTURE.md`](HRISENSE_AI_ARCHITECTURE.md).

### 20.1 What each person can ask about

| | Employee | Supervisor | HR |
|---|---|---|---|
| How HRISense works (Help Center guides and this reference, filtered to what their role may read) | ✅ | ✅ | ✅ |
| Own profile (work details only), schedule, attendance, leave and balances, training, visible evaluations, compliance, own medical record metadata, own employee-visible psychological summary, announcements, notifications, calendar, "my day" | ✅ | ✅ | ✅ |
| Direct reports (employees whose **immediate supervisor** is them — not the whole unit): profile, attendance, schedules, leave requests (no reasons), compliance (**without** medical/psychological requirements), training | — | ✅ | ✅ (own reports) |
| Any employee's work records; organisation figures: headcount, attendance coverage and trends, no-record-today lists, leave awaiting HR, compliance standing and expiries within N days, training completion by unit, evaluation progress, recruitment pipeline, announcement read rates, unconfigured schedules, supervisor-assignment issues, import history, audit activity counts, the Reports & Analytics reports | — | — | ✅ |
| Other people's leave balances, evaluations, medical or psychological records | — | — | ✅ (metadata and statuses only) |

**Never available to the assistant, for anyone:** passwords, tokens, keys,
dates of birth, addresses, phone numbers, personal e-mail, emergency contacts,
government ID numbers, licence numbers, photos, **medical HR notes**,
**psychological confidential notes**, document contents, evaluator comments, and
free-text notes written about another person. Payroll does not exist in HRISense
(Appendix E.5).

### 20.2 How an answer is produced

1. The server works out **who is asking** from the signed-in account — tier,
   employee record and direct reports are re-read from the database on every
   question. Nothing in the request, the token's claims or the chat text can
   change them.
2. A **deterministic guard** refuses, without calling any AI, requests for
   credentials or secrets, SQL or code, attempts to override instructions or
   claim a role the person does not hold, payroll questions, and clearly
   unrelated requests.
3. The AI may only call **narrow lookup tools** offered to that tier (39 in all,
   e.g. `get_attendance`, `get_team_overview`, `get_compliance_overview`,
   `search_help_center`). Each tool re-checks the person's access before
   reading anything. There is no general query, SQL or table access, and no
   tool that changes data.
4. All figures (counts, rates, balances, coverage, completion) are **computed by
   the server**. Charts are drawn from those server-computed datasets; the AI
   can only choose which dataset to show and as what chart type.
5. The answer is checked: code and HTML are removed, credential-shaped text and
   government ID numbers are redacted, links are kept only if they point to a
   page that person can open.
6. The question, the answer, the tools used and whose records were read are
   **audited** (`ai_request_logs`; plus an `AI_ASSISTANT_DATA_ACCESS` entry in
   the Audit Log when another employee's records were read).

**Rules it follows:** a day with **no attendance record is never an absence**;
**UNCONFIGURED** schedule days are neither working days nor days off; leave
statuses mean what §12.1 says; employees see evaluations only when finalized and
made visible; it never predicts attrition or performance, never judges an
applicant, and never recommends a decision about a specific person. Anything
outside HRISense gets exactly: *"I'm the HSJ HRISense assistant, so I can help
with HRISense, your authorized workforce information, and Hospicio de San Jose
HR workflows."*

### 20.3 The page and the chat

- **Assistant** (everyone) — the access strip (*"Answers use your access:
  Employee / Supervisor / HR · read-only"*), suggested questions for the tier,
  the conversation, and **Your conversations** (only the person's own; **New**,
  remove from list). Each answer may carry a label — *Outside your access*, *No
  data found*, *Outside HRISense*, *Can't help with that*, *AI not configured*,
  *Couldn't answer* — charts with **View data** (the exact figures as a table),
  links to the relevant pages, and follow-up suggestions. Questions are limited
  to 2,000 characters and, by default, 60 per person per hour.
- **Workforce summary** (HR) — the deterministic **workforce fact sheet** for the
  last N days (7–180, default 30: headcount, attendance, leave, compliance,
  training, evaluations, recruitment; `GET /ai/facts`, always available) and
  **Generate summary** (`POST /ai/analyze`), which writes observations, areas for
  review and data gaps from the fact sheet only. Under each observation, **Based
  on** lists the fact-sheet sections it used as clickable chips that open the page
  holding those records (e.g. *Compliance standing* → Compliance, *Leave requests by
  status* → Leave Requests), with a chart of that section drawn from the same fact
  sheet — never from the AI's numbers. Sections with nothing to plot get the link
  only.
- **Quick analytics** (everyone; the chart button beside the question box and
  the chips on a new chat) — fixed views calculated directly from HRISense with
  **no AI involved**: e.g. *My attendance — last 6 months*, *My leave balances*,
  *My team's attendance — this month*, *Attendance by unit — this month*,
  *Most "No imported record" days*, *Compliance standing*, *Recruitment
  pipeline*. Each gives the figures and a chart; the server fixes what each view
  reads, so it cannot be pointed at anyone else.
- **Ask AI bubble** — the same assistant from any page, with **Open full page**.
  On phones it is a compact round button in the lower-right corner, and the
  HRISense buddy waits, mostly tucked away, in the lower-left corner instead of
  roaming over the page. Every signed-in page ends with clear space so the last
  content (pagination, buttons) can always scroll above both.

**How attendance is measured** (every attendance answer and chart): *presence*
= Present + Late + Half-day records; an *absence* is only an explicit Absent
record; a day with **no record is never an absence**. **Attendance rate** =
presence ÷ (presence + recorded absences). **Record coverage** = scheduled
workdays (WORKING in the schedule, not approved leave, not a holiday) that have
a record ÷ scheduled workdays — it cannot be calculated without a configured
weekly schedule. Months with no imported data are shown as *no data*, never 0%.

**When no AI provider is configured**, typed questions get a clear notice and
the matching Help Center guides; **Quick analytics**, HR's workforce fact sheet
and every other part of HRISense work normally.

**Configuration** (`apps/api/.env.local` — git-ignored; `.env.local` overrides `apps/api/.env`, which is tracked by git and must not hold keys): `AI_PROVIDER` (`openai` default, or
`anthropic`), `OPENAI_API_KEY` / `OPENAI_MODEL` (default `gpt-4o-mini`) /
optional `OPENAI_BASE_URL`, or `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`; optional
`AI_ENABLED`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_TOOL_ROUNDS`,
`AI_REQUEST_TIMEOUT_MS`, `AI_HISTORY_MESSAGES`, `AI_RATE_LIMIT_PER_HOUR`,
`AI_TEMPERATURE`.

---

## 21. Help Center

**Purpose** — step-by-step, role-aware instructions for every common task.

**Who** — everyone; each guide is tagged with the roles it applies to, and users
see only the guides for their role (*"Guide Not Available for Your Account"*
otherwise). **Where** — `/help-center` and `/help-center/$guideSlug` (sidebar
*Administration → Help Center*). Many pages also have a **Help** link that
opens the guide for that page.

**The page** — *"What do you need help with?"* search, **Common Tasks**, **Browse
by Category** (grouped like the sidebar). Each guide shows **Step-by-Step
Instructions**, **What happens next?** and **Helpful Tips**, with **Back to Help
Center**, **Copy Link**, **Print Guide** and — on most guides — **Open …**, which
goes straight to the screen the guide describes (e.g. *Open Leave Requests*).

**Search** matches titles, keywords, modules and summaries; a query of several
words also matches when every word appears (so *file leave*, *my attendance* or
*peer rating* find their guides), and a keyword equal to the whole query ranks
first. Search only ever returns guides for the reader's role.

**90 guides in 18 categories**, reviewed against the screens on 9 Oct 2026
(source: `apps/web/src/pages/HelpCenter/guides/*.guides.ts`; the registry
validator checks ids, slugs, roles, related guides and page links):

| Category | Guides |
|---|---|
| Getting started & security | sign in, sign in with Google, keep me signed in, first-time password, change password, forgot password, reset password, sign out |
| Dashboard | HR, supervisor and employee dashboards, My Calendar and notes, posting a calendar note (HR) |
| Employee management | search and filter (HR), onboard, drafts, read a profile, My Profile, Edit My Profile, My Team (supervisors), edit details, override supervisor, additional overseers (HR), manage account, issue credentials, upload / preview / manage documents, archive and restore, org chart |
| Recruitment & careers | create opening, publish / close / fill / archive, applicants and status changes, applicant documents, interviews, applicant emails, hired → onboarding; public Careers, applying, application status |
| Time & attendance | daily monitoring, tally, export, my attendance, shift catalog, weekly schedules, holiday calendar, maintaining the holiday calendar (HR), attendance import |
| Leave | file, check my requests, cancel, balances, manage balances, endorse, approve / revise / decline, calendar |
| Evaluations | templates, cycles (Standard / Weighted Multi-Rater), completing an evaluation, finalising, reading my evaluation |
| Training & seminars | create activity, add participants, outcomes and certificates, my training |
| Awards & achievements | nominate and vote, run awards (HR), read Yearly Achievements, manage Yearly Achievements (HR) |
| Health & compliance | create requirement, needs attention, record compliance, my compliance, medical records, psychological records, health-record privacy |
| Communication | write and publish, audience, read receipts, reading announcements, notifications, marking read |
| Administration | audit logs, AI Assistance (everyone; HR decision support), reports, export, settings, using the Help Center |

Guides are role-aware by **permission tier** (HR / FULL, Supervisor, Employee):
HR-only steps live in HR-only guides, so an employee never reads administration
instructions. Not documented because not implemented: payroll and payslips, an
OTP code for password changes, a screen for HR to correct a single attendance
record, a screen to accept general (non-medical) compliance records.

> **For AI preparation:** these guides are already a role-tagged, task-level
> knowledge base, a natural companion to this reference.

---

## 22. Public landing page (`/`)

The public front page. It presents the system by its own name and never calls
itself a capstone.

**Hero** — *Hospicio de San Jose*, the title **HSJ HRISense**, the official title
*An AI-Assisted Workforce Administration System with Compliance Decision*, a
short description of what it covers, and **Explore HRISense** (to the next
section) and **View Careers** (`/careers`). Beside it (below it on phones) is the
HRISense mascot — the same character as the Ask AI button.

**The mascot** — press it (click, tap, Enter or Space) for a short quick fact;
**Next fact** shows another, ✕ or **Esc** closes. The facts are a fixed,
approved list (`LANDING_FACTS`) — never generated from HRISense data (no
employee records, counts, names, IDs, statistics or assignments) and never from
an AI call. Two kinds: **Hospicio de San Jose** facts, each stated by an official
source (Hospicio's own website and the National Historical Commission's
historic-site registry, checked 5 October 2026 — the founding year is left out
because the two give different years); and high-level **HRISense** facts (what it
is for, what it covers, that people make the final HR decisions, that each
person uses the functions for their role). They follow the section being read. Once the hero mascot has scrolled out of view, a smaller copy follows
the visitor in the lower-right corner; it goes away again at the hero and over
the footer, so only one is ever on screen. Motion stops under *reduce motion*.

**Sections**: **HSJ HRISense** (what the system is, and that its AI Assistance
summarizes while authorized Hospicio personnel decide); **What HRISense covers**
(employee records; attendance, schedules and leave; evaluations and training;
compliance; recruitment and careers; AI Assistance and reports); **Different
access for different roles** (HR Personnel, Supervisor, Employee); **How HRISense
Works** (manage workforce information → handle HR processes → use AI Assistance →
human review and decision); **AI that informs HR. People decide.**; **Join Our
Team** (to the Careers site); *Already part of Hospicio de San Jose?* (to sign in);
the footer with the support contacts.

Buttons: **Sign In** / **Sign In to HRISense** (`/login`), **View Job Positions**
/ **Explore Careers** / **View Careers** (`/careers`), **Explore HRISense**, and a
mobile menu toggle. The landing page reads no private data.

**Sign-in page** (`/login`): *Sign in to your account* with **Personal email**,
**Password**, **Keep me signed in** and **Forgot password?**. The branding side
(desktop) shows *HSJ HRISense*, the official title and the mascot; phones show
the name and a smaller mascot above the form. No technical security wording is
shown — only that the page is for authorized Hospicio personnel.

---

## Appendix A — API endpoint reference (generated)

Generated from `apps/api/src/routes`. **Access** is the route-level guard. **Own checks in handler** = the
handler or its service applies further permission logic (record ownership, team scope, or HR-only rules);
the module sections state the effective access. All paths are prefixed `/api/v1`.

_306 endpoints, generated from `apps/api/src/routes`._

| Method | Path | Access (route guard) | Own checks in handler | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | PUBLIC |  | `AuthController.login` |
| GET | `/api/v1/auth/google/config` | PUBLIC |  | `AuthController.googleConfig` |
| GET | `/api/v1/auth/captcha-config` | PUBLIC |  | `AuthController.captchaConfig` |
| POST | `/api/v1/auth/google` | PUBLIC |  | `AuthController.googleLogin` |
| POST | `/api/v1/auth/refresh` | PUBLIC |  | `AuthController.refresh` |
| POST | `/api/v1/auth/logout` | any signed-in user |  | `AuthController.logout` |
| POST | `/api/v1/auth/forgot-password` | PUBLIC |  | `AuthController.forgotPassword` |
| POST | `/api/v1/auth/reset-password` | PUBLIC |  | `AuthController.resetPassword` |
| GET | `/api/v1/auth/me` | any signed-in user | yes | `AuthController.getMe` |
| POST | `/api/v1/auth/change-password` | any signed-in user |  | `AuthController.changePassword` |
| GET | `/api/v1/public/recruitment/openings` | PUBLIC |  | `PublicRecruitmentController.listOpenings` |
| GET | `/api/v1/public/recruitment/positions` | PUBLIC |  | `PublicRecruitmentController.listPositions` |
| GET | `/api/v1/public/recruitment/openings/:slug` | PUBLIC |  | `PublicRecruitmentController.getOpeningBySlug` |
| GET | `/api/v1/public/recruitment/application-status/:token` | PUBLIC |  | `PublicRecruitmentController.getApplicationStatus` |
| POST | `/api/v1/public/recruitment/openings/:openingId/apply` | PUBLIC + file upload |  | `inline handler in route file` |
| GET | `/api/v1/dashboard/stats` | any signed-in user | yes | `DashboardController.getStats` |
| GET | `/api/v1/dashboard/overview` | any signed-in user | yes | `inline handler in route file` |
| GET | `/api/v1/dashboard/activity` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/dashboard/calendar` | any signed-in user | yes | `inline handler in route file` |
| GET | `/api/v1/employees/org-chart` | any signed-in user | yes | `EmployeeController.getOrgChart` |
| GET | `/api/v1/employees/additional-oversight` | signed in; tier FULL | yes | `EmployeeController.listAdditionalOversight` |
| POST | `/api/v1/employees/additional-oversight` | signed in; tier FULL | yes | `EmployeeController.addAdditionalOversight` |
| DELETE | `/api/v1/employees/additional-oversight/:oversightId` | signed in; tier FULL | yes | `EmployeeController.removeAdditionalOversight` |
| GET | `/api/v1/employees/units` | any signed-in user |  | `EmployeeController.getUnits` |
| GET | `/api/v1/employees/job-roles` | any signed-in user | yes | `EmployeeController.getJobRoles` |
| GET | `/api/v1/employees/eligible-supervisors` | signed in; tier FULL |  | `EmployeeController.getEligibleSupervisors` |
| POST | `/api/v1/employees/resolve-supervisor` | signed in; tier FULL |  | `EmployeeController.resolveSupervisor` |
| POST | `/api/v1/employees/bulk-restore` | signed in; tier FULL | yes | `EmployeeController.bulkRestore` |
| GET | `/api/v1/employees/export/excel` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.exportExcel` |
| POST | `/api/v1/employees/export/excel` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.exportExcel` |
| GET | `/api/v1/employees/export/pdf` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.exportPDF` |
| POST | `/api/v1/employees/export/pdf` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.exportPDF` |
| GET | `/api/v1/employees/me` | any signed-in user | yes | `EmployeeController.getMe` |
| GET | `/api/v1/employees/subordinates` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.getSubordinates` |
| GET | `/api/v1/employees` | signed in; tier FULL,SUPERVISOR | yes | `EmployeeController.list` |
| POST | `/api/v1/employees` | signed in; tier FULL |  | `EmployeeController.create` |
| GET | `/api/v1/employees/:id/additional-oversight` | signed in; tier FULL |  | `EmployeeController.employeeAdditionalOversight` |
| POST | `/api/v1/employees/:id/additional-oversight` | signed in; tier FULL |  | `EmployeeController.addEmployeeAdditionalOversight` |
| GET | `/api/v1/employees/:id` | any signed-in user | yes | `EmployeeController.getById` |
| PUT | `/api/v1/employees/:id` | any signed-in user | yes | `EmployeeController.update` |
| DELETE | `/api/v1/employees/:id` | signed in; tier FULL |  | `EmployeeController.remove` |
| PATCH | `/api/v1/employees/:id/archive` | signed in; tier FULL |  | `EmployeeController.remove` |
| PATCH | `/api/v1/employees/:id/restore` | signed in; tier FULL | yes | `EmployeeController.bulkRestore` |
| POST | `/api/v1/employees/:id/supervisor-override` | signed in; tier FULL |  | `EmployeeController.overrideSupervisor` |
| DELETE | `/api/v1/employees/:id/supervisor-override` | signed in; tier FULL |  | `EmployeeController.removeSupervisorOverride` |
| GET | `/api/v1/employees/:id/timeline` | any signed-in user | yes | `EmployeeController.getTimeline` |
| GET | `/api/v1/employees/:id/profile-completion` | any signed-in user | yes | `EmployeeController.getProfileCompletion` |
| GET | `/api/v1/employees/:id/account` | signed in; tier FULL |  | `AccountController.getAccount` |
| POST | `/api/v1/employees/:id/account/activate` | signed in; tier FULL |  | `AccountController.activate` |
| POST | `/api/v1/employees/:id/account/use-personal-email` | signed in; tier FULL |  | `AccountController.usePersonalEmail` |
| POST | `/api/v1/employees/:id/account/deactivate` | signed in; tier FULL |  | `AccountController.deactivate` |
| POST | `/api/v1/employees/:id/account/lock` | signed in; tier FULL |  | `AccountController.lock` |
| POST | `/api/v1/employees/:id/account/unlock` | signed in; tier FULL |  | `AccountController.unlock` |
| POST | `/api/v1/employees/:id/account/force-password-change` | signed in; tier FULL |  | `AccountController.forcePasswordChange` |
| POST | `/api/v1/employees/:id/account/reset-password` | signed in; tier FULL |  | `AccountController.resetPassword` |
| POST | `/api/v1/employees/:employeeId/documents` | signed in; tier FULL + file upload | yes | `DocumentController.upload` |
| GET | `/api/v1/employees/:employeeId/documents` | any signed-in user | yes | `DocumentController.listByEmployee` |
| GET | `/api/v1/documents/:documentId/preview` | any signed-in user | yes | `DocumentController.preview` |
| GET | `/api/v1/documents/:documentId/download` | any signed-in user | yes | `DocumentController.download` |
| PUT | `/api/v1/documents/:documentId` | signed in; tier FULL |  | `DocumentController.updateMetadata` |
| DELETE | `/api/v1/documents/:documentId` | signed in; tier FULL |  | `DocumentController.delete` |
| PUT | `/api/v1/documents/:documentId/file` | signed in; tier FULL + file upload |  | `DocumentController.replace` |
| GET | `/api/v1/departments` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `DepartmentController.getDepartments` |
| GET | `/api/v1/departments/:id` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `DepartmentController.getDepartmentById` |
| POST | `/api/v1/departments` | signed in; tier FULL |  | `DepartmentController.createDepartment` |
| PATCH | `/api/v1/departments/:id` | signed in; tier FULL |  | `DepartmentController.updateDepartment` |
| DELETE | `/api/v1/departments/:id` | signed in; tier FULL |  | `DepartmentController.deleteDepartment` |
| GET | `/api/v1/units` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `UnitController.getUnits` |
| GET | `/api/v1/units/:id` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `UnitController.getUnitById` |
| POST | `/api/v1/units` | signed in; tier FULL |  | `UnitController.createUnit` |
| PATCH | `/api/v1/units/:id` | signed in; tier FULL |  | `UnitController.updateUnit` |
| DELETE | `/api/v1/units/:id` | signed in; tier FULL |  | `UnitController.deleteUnit` |
| GET | `/api/v1/job-roles` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `JobRoleController.getJobRoles` |
| GET | `/api/v1/job-roles/:id` | signed in; tier FULL,SUPERVISOR,STANDARD |  | `JobRoleController.getJobRoleById` |
| POST | `/api/v1/job-roles` | signed in; tier FULL | yes | `JobRoleController.createJobRole` |
| PATCH | `/api/v1/job-roles/:id` | signed in; tier FULL |  | `JobRoleController.updateJobRole` |
| DELETE | `/api/v1/job-roles/:id` | signed in; tier FULL |  | `JobRoleController.deleteJobRole` |
| POST | `/api/v1/onboarding-drafts` | signed in; tier FULL |  | `DraftController.create` |
| GET | `/api/v1/onboarding-drafts` | signed in; tier FULL | yes | `DraftController.list` |
| GET | `/api/v1/onboarding-drafts/:id` | signed in; tier FULL | yes | `DraftController.getById` |
| PUT | `/api/v1/onboarding-drafts/:id` | signed in; tier FULL | yes | `DraftController.update` |
| DELETE | `/api/v1/onboarding-drafts/:id` | signed in; tier FULL | yes | `DraftController.delete` |
| GET | `/api/v1/leave/balances` | any signed-in user | yes | `LeaveController.getBalances` |
| PUT | `/api/v1/leave/balances` | signed in; tier FULL |  | `LeaveController.upsertBalance` |
| GET | `/api/v1/leave/entitlements` | any signed-in user | yes | `LeaveController.getEntitlements` |
| POST | `/api/v1/leave/entitlements/sync` | signed in; tier FULL |  | `LeaveController.syncEntitlements` |
| POST | `/api/v1/leave/entitlements/:employeeId/apply` | signed in; tier FULL |  | `LeaveController.applyEntitlement` |
| GET | `/api/v1/leave/calendar` | any signed-in user | yes | `LeaveController.getCalendar` |
| GET | `/api/v1/leave` | any signed-in user | yes | `LeaveController.list` |
| POST | `/api/v1/leave` | any signed-in user |  | `LeaveController.create` |
| POST | `/api/v1/leave/batch` | any signed-in user | yes | `LeaveController.createBatch` |
| GET | `/api/v1/leave/:id` | any signed-in user | yes | `LeaveController.getById` |
| PATCH | `/api/v1/leave/:id/endorse` | signed in; tier SUPERVISOR,FULL | yes | `LeaveController.endorse` |
| PATCH | `/api/v1/leave/:id/approve` | signed in; tier FULL |  | `LeaveController.approve` |
| PATCH | `/api/v1/leave/:id/reject` | signed in; tier SUPERVISOR,FULL | yes | `LeaveController.reject` |
| PATCH | `/api/v1/leave/:id/cancel` | any signed-in user | yes | `LeaveController.cancel` |
| GET | `/api/v1/attendance/imports` | signed in; tier FULL |  | `AttendanceImportController.list` |
| POST | `/api/v1/attendance/imports` | signed in; tier FULL + file upload |  | `AttendanceImportController.upload` |
| GET | `/api/v1/attendance/imports/:id/preview` | signed in; tier FULL |  | `AttendanceImportController.preview` |
| POST | `/api/v1/attendance/imports/:id/decisions` | signed in; tier FULL |  | `AttendanceImportController.decide` |
| POST | `/api/v1/attendance/imports/:id/apply` | signed in; tier FULL |  | `AttendanceImportController.apply` |
| POST | `/api/v1/attendance/imports/:id/cancel` | signed in; tier FULL |  | `AttendanceImportController.cancel` |
| POST | `/api/v1/attendance/imports/map-code` | signed in; tier FULL |  | `AttendanceImportController.mapCode` |
| GET | `/api/v1/attendance/summary/today` | signed in; tier FULL |  | `AttendanceController.getTodaySummary` |
| GET | `/api/v1/attendance/calendar` | any signed-in user | yes | `AttendanceController.getCalendar` |
| GET | `/api/v1/attendance/schedule` | any signed-in user | yes | `AttendanceController.getSchedules` |
| GET | `/api/v1/attendance/tally` | any signed-in user | yes | `AttendanceController.getTally` |
| GET | `/api/v1/attendance/logs` | signed in; tier FULL,SUPERVISOR | yes | `AttendanceController.getLogs` |
| GET | `/api/v1/attendance` | any signed-in user | yes | `AttendanceController.list` |
| PUT | `/api/v1/attendance/:id` | signed in; tier FULL |  | `AttendanceController.update` |
| POST | `/api/v1/attendance/export/excel` | any signed-in user | yes | `AttendanceController.exportExcel` |
| POST | `/api/v1/attendance/export/pdf` | any signed-in user | yes | `AttendanceController.exportPDF` |
| GET | `/api/v1/training` | any signed-in user | yes | `TrainingController.listActivities` |
| GET | `/api/v1/training/:id` | any signed-in user | yes | `TrainingController.getActivity` |
| POST | `/api/v1/training` | signed in; tier FULL | yes | `TrainingController.createActivity` |
| PUT | `/api/v1/training/:id` | signed in; tier FULL | yes | `TrainingController.updateActivity` |
| POST | `/api/v1/training/:id/cancel` | signed in; tier FULL | yes | `TrainingController.cancelActivity` |
| POST | `/api/v1/training/:id/documents` | signed in; tier FULL + file upload | yes | `TrainingController.uploadActivityDocument` |
| GET | `/api/v1/training/:id/documents/:documentId` | signed in; tier FULL | yes | `TrainingController.streamActivityDocument` |
| POST | `/api/v1/training/:id/participants` | signed in; tier FULL | yes | `TrainingController.addParticipants` |
| PUT | `/api/v1/training/:id/participants/:employeeId` | signed in; tier FULL |  | `TrainingController.updateParticipantStatus` |
| POST | `/api/v1/training/:id/participants/bulk-status` | signed in; tier FULL | yes | `TrainingController.bulkUpdateParticipantStatus` |
| POST | `/api/v1/training/:id/participants/:employeeId/certificate` | signed in; tier FULL + file upload | yes | `TrainingController.uploadParticipantCertificate` |
| GET | `/api/v1/training/:id/participants/:employeeId/certificate` | any signed-in user | yes | `TrainingController.streamParticipantCertificate` |
| GET | `/api/v1/training/employees/:employeeId/history` | any signed-in user | yes | `TrainingController.listEmployeeHistory` |
| POST | `/api/v1/announcements/audience-preview` | signed in; tier FULL |  | `AnnouncementController.previewAudience` |
| GET | `/api/v1/announcements/hr` | signed in; tier FULL |  | `AnnouncementController.listForHR` |
| GET | `/api/v1/announcements/stats` | signed in; tier FULL |  | `AnnouncementController.getSummaryStats` |
| GET | `/api/v1/announcements/dashboard` | any signed-in user | yes | `AnnouncementController.getDashboard` |
| GET | `/api/v1/announcements/unread-count` | any signed-in user |  | `AnnouncementController.getUnreadCount` |
| GET | `/api/v1/announcements` | any signed-in user |  | `AnnouncementController.listForRecipient` |
| POST | `/api/v1/announcements` | signed in; tier FULL & FULL + file upload |  | `AnnouncementController.createDraft` |
| POST | `/api/v1/announcements/:id/attachments` | signed in; tier FULL + file upload |  | `AnnouncementController.uploadAttachment` |
| GET | `/api/v1/announcements/:id/attachments` | any signed-in user |  | `AnnouncementController.listAttachments` |
| GET | `/api/v1/announcements/:id/attachments/:attachmentId` | any signed-in user | yes | `AnnouncementController.streamAttachment` |
| DELETE | `/api/v1/announcements/:id/attachments/:attachmentId` | signed in; tier FULL |  | `AnnouncementController.deleteAttachment` |
| GET | `/api/v1/announcements/:id` | any signed-in user | yes | `AnnouncementController.getById` |
| PUT | `/api/v1/announcements/:id` | signed in; tier FULL |  | `AnnouncementController.updateAnnouncement` |
| POST | `/api/v1/announcements/:id/activate` | signed in; tier FULL |  | `AnnouncementController.activate` |
| POST | `/api/v1/announcements/:id/schedule` | signed in; tier FULL |  | `AnnouncementController.schedule` |
| POST | `/api/v1/announcements/:id/archive` | signed in; tier FULL |  | `AnnouncementController.archive` |
| DELETE | `/api/v1/announcements/:id` | signed in; tier FULL |  | `AnnouncementController.deleteDraft` |
| POST | `/api/v1/announcements/:id/read` | any signed-in user | yes | `AnnouncementController.markRead` |
| GET | `/api/v1/announcements/:id/recipients` | signed in; tier FULL |  | `AnnouncementController.listRecipients` |
| GET | `/api/v1/announcements/:id/recipients/stats` | signed in; tier FULL |  | `AnnouncementController.getRecipientStats` |
| GET | `/api/v1/notifications` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/notifications/unread-count` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/notifications/stream` | any signed-in user |  | `inline handler in route file` |
| PATCH | `/api/v1/notifications/read-all` | any signed-in user |  | `inline handler in route file` |
| PATCH | `/api/v1/notifications/:id/read` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/search` | any signed-in user | yes | `SearchController.search` |
| GET | `/api/v1/recruitment/overview` | any signed-in user | yes | `JobOpeningController.overview` |
| GET | `/api/v1/recruitment/openings` | any signed-in user | yes | `JobOpeningController.list` |
| POST | `/api/v1/recruitment/openings` | any signed-in user | yes | `JobOpeningController.create` |
| GET | `/api/v1/recruitment/openings/:id` | any signed-in user | yes | `JobOpeningController.getById` |
| PATCH | `/api/v1/recruitment/openings/:id` | any signed-in user | yes | `JobOpeningController.update` |
| PATCH | `/api/v1/recruitment/openings/:id/status` | any signed-in user | yes | `JobOpeningController.changeStatus` |
| GET | `/api/v1/recruitment/applications` | any signed-in user | yes | `JobApplicationController.listApplications` |
| GET | `/api/v1/recruitment/applications/:id` | any signed-in user | yes | `JobApplicationController.getApplicationById` |
| PATCH | `/api/v1/recruitment/applications/:id/status` | any signed-in user | yes | `JobApplicationController.changeStatus` |
| POST | `/api/v1/recruitment/applications/:id/notes` | any signed-in user | yes | `JobApplicationController.addNote` |
| GET | `/api/v1/recruitment/applications/:id/documents/:documentId/download` | any signed-in user | yes | `JobApplicationController.downloadDocument` |
| GET | `/api/v1/recruitment/applications/:id/documents/:documentId/preview` | any signed-in user | yes | `JobApplicationController.previewDocument` |
| POST | `/api/v1/recruitment/applications/:id/interviews` | any signed-in user | yes | `JobApplicationController.scheduleInterview` |
| PATCH | `/api/v1/recruitment/applications/:id/interviews/:interviewId` | any signed-in user | yes | `JobApplicationController.updateInterview` |
| PATCH | `/api/v1/recruitment/applications/:id/interviews/:interviewId/reschedule` | any signed-in user | yes | `JobApplicationController.rescheduleInterview` |
| GET | `/api/v1/recruitment/applications/:id/communications` | any signed-in user | yes | `JobApplicationController.listCommunications` |
| POST | `/api/v1/recruitment/applications/:id/communications` | any signed-in user | yes | `JobApplicationController.sendEmail` |
| POST | `/api/v1/recruitment/applications/:id/communications/preview` | any signed-in user | yes | `JobApplicationController.previewEmail` |
| POST | `/api/v1/recruitment/applications/:id/communications/:communicationId/retry` | any signed-in user | yes | `JobApplicationController.retryCommunication` |
| POST | `/api/v1/recruitment/applications/:id/convert` | any signed-in user | yes | `JobApplicationController.convertToOnboarding` |
| POST | `/api/v1/holidays/suggestions/fetch` | any signed-in user | yes | `HolidayController.fetchSuggestions` |
| PATCH | `/api/v1/holidays/suggestions/:id/status` | any signed-in user | yes | `HolidayController.updateSuggestionStatus` |
| POST | `/api/v1/holidays/manual` | any signed-in user | yes | `HolidayController.createManualEntry` |
| PATCH | `/api/v1/holidays/manual/:id` | any signed-in user | yes | `HolidayController.updateManualEntry` |
| PUT | `/api/v1/holidays/:id/working-units` | any signed-in user | yes | `HolidayController.setWorkingUnits` |
| POST | `/api/v1/holidays/manual/:id/deactivate` | any signed-in user | yes | `HolidayController.deactivateEntry` |
| DELETE | `/api/v1/holidays/manual/:id` | any signed-in user | yes | `HolidayController.deactivateEntry` |
| GET | `/api/v1/holidays` | any signed-in user |  | `HolidayController.list` |
| POST | `/api/v1/schedules/templates` | any signed-in user | yes | `ScheduleController.createTemplate` |
| PUT | `/api/v1/schedules/templates/:id` | any signed-in user | yes | `ScheduleController.updateTemplate` |
| GET | `/api/v1/schedules/templates` | any signed-in user |  | `ScheduleController.listTemplates` |
| GET | `/api/v1/schedules/employees` | any signed-in user | yes | `ScheduleController.getEmployeeSchedules` |
| GET | `/api/v1/schedules/coverage` | any signed-in user | yes | `ScheduleController.getCoverage` |
| POST | `/api/v1/schedules/assignments` | any signed-in user | yes | `ScheduleController.assignSchedule` |
| GET | `/api/v1/schedules/history` | any signed-in user | yes | `ScheduleController.listHistory` |
| GET | `/api/v1/weekly-schedules/shifts` | any signed-in user |  | `WeeklyScheduleController.listShifts` |
| POST | `/api/v1/weekly-schedules/shifts` | any signed-in user | yes | `WeeklyScheduleController.createShift` |
| PUT | `/api/v1/weekly-schedules/shifts/:id` | any signed-in user | yes | `WeeklyScheduleController.updateShift` |
| DELETE | `/api/v1/weekly-schedules/shifts/:id` | any signed-in user | yes | `WeeklyScheduleController.deactivateShift` |
| GET | `/api/v1/weekly-schedules/employees/:employeeId` | any signed-in user | yes | `WeeklyScheduleController.getEmployeeWeeklySchedule` |
| POST | `/api/v1/weekly-schedules/employees/:employeeId` | any signed-in user | yes | `WeeklyScheduleController.saveEmployeeWeeklySchedule` |
| GET | `/api/v1/compliance/summary` | signed in; tier FULL |  | `ComplianceController.getOrgSummary` |
| GET | `/api/v1/compliance/needs-attention` | signed in; tier FULL |  | `ComplianceController.getNeedsAttention` |
| GET | `/api/v1/compliance/employees-list` | signed in; tier FULL |  | `ComplianceController.getEmployeesComplianceList` |
| GET | `/api/v1/compliance/employees/:employeeId/summary` | any signed-in user | yes | `ComplianceController.getEmployeeSummary` |
| GET | `/api/v1/compliance/requirements` | signed in; tier FULL |  | `ComplianceController.listRequirements` |
| GET | `/api/v1/compliance/requirements/:id` | signed in; tier FULL |  | `ComplianceController.getRequirement` |
| POST | `/api/v1/compliance/requirements` | signed in; tier FULL |  | `ComplianceController.createRequirement` |
| PATCH | `/api/v1/compliance/requirements/:id` | signed in; tier FULL |  | `ComplianceController.updateRequirement` |
| DELETE | `/api/v1/compliance/requirements/:id` | signed in; tier FULL |  | `ComplianceController.archiveRequirement` |
| POST | `/api/v1/compliance/requirements/:id/scopes` | signed in; tier FULL |  | `ComplianceController.addScope` |
| DELETE | `/api/v1/compliance/scopes/:scopeId` | signed in; tier FULL |  | `ComplianceController.deleteScope` |
| GET | `/api/v1/compliance/employees/:employeeId/records` | any signed-in user | yes | `ComplianceController.listEmployeeRecords` |
| POST | `/api/v1/compliance/employees/:employeeId/records` | signed in; tier FULL |  | `ComplianceController.createEmployeeRecord` |
| POST | `/api/v1/compliance/records` | signed in; tier FULL |  | `ComplianceController.createEmployeeRecord` |
| PATCH | `/api/v1/compliance/records/:recordId/review` | signed in; tier FULL |  | `ComplianceController.reviewRecord` |
| DELETE | `/api/v1/compliance/records/:recordId` | signed in; tier FULL |  | `ComplianceController.deleteRecord` |
| GET | `/api/v1/medical/records` | signed in; tier FULL | yes | `MedicalController.listAllRecords` |
| GET | `/api/v1/medical/summary` | signed in; tier FULL | yes | `MedicalController.getSummary` |
| POST | `/api/v1/medical/records` | signed in; tier FULL |  | `MedicalController.createRecord` |
| GET | `/api/v1/medical/employees/:employeeId/records` | any signed-in user | yes | `MedicalController.listRecords` |
| POST | `/api/v1/medical/employees/:employeeId/records` | signed in; tier FULL |  | `MedicalController.createRecord` |
| GET | `/api/v1/medical/records/:recordId` | any signed-in user | yes | `MedicalController.getRecord` |
| PATCH | `/api/v1/medical/records/:recordId` | signed in; tier FULL |  | `MedicalController.updateRecord` |
| PATCH | `/api/v1/medical/records/:recordId/review` | signed in; tier FULL |  | `MedicalController.reviewRecord` |
| DELETE | `/api/v1/medical/records/:recordId` | signed in; tier FULL |  | `MedicalController.deleteRecord` |
| POST | `/api/v1/medical/records/:recordId/documents` | signed in; tier FULL + file upload |  | `MedicalController.uploadDocument` |
| GET | `/api/v1/medical/documents/:documentId/stream` | any signed-in user | yes | `MedicalController.streamDocument` |
| DELETE | `/api/v1/medical/documents/:documentId` | signed in; tier FULL |  | `MedicalController.deleteDocument` |
| GET | `/api/v1/psychological/records` | signed in; tier FULL | yes | `PsychologicalController.listAllRecords` |
| GET | `/api/v1/psychological/summary` | signed in; tier FULL | yes | `PsychologicalController.getSummary` |
| POST | `/api/v1/psychological/records` | signed in; tier FULL |  | `PsychologicalController.createRecord` |
| GET | `/api/v1/psychological/employees/:employeeId/records` | any signed-in user | yes | `PsychologicalController.listRecords` |
| POST | `/api/v1/psychological/employees/:employeeId/records` | signed in; tier FULL |  | `PsychologicalController.createRecord` |
| GET | `/api/v1/psychological/records/:recordId` | any signed-in user | yes | `PsychologicalController.getRecord` |
| PATCH | `/api/v1/psychological/records/:recordId` | signed in; tier FULL |  | `PsychologicalController.updateRecord` |
| PATCH | `/api/v1/psychological/records/:recordId/review` | signed in; tier FULL |  | `PsychologicalController.reviewRecord` |
| DELETE | `/api/v1/psychological/records/:recordId` | signed in; tier FULL |  | `PsychologicalController.deleteRecord` |
| POST | `/api/v1/psychological/records/:recordId/documents` | signed in; tier FULL + file upload |  | `PsychologicalController.uploadDocument` |
| GET | `/api/v1/psychological/documents/:documentId/stream` | any signed-in user | yes | `PsychologicalController.streamDocument` |
| DELETE | `/api/v1/psychological/documents/:documentId` | signed in; tier FULL |  | `PsychologicalController.deleteDocument` |
| GET | `/api/v1/evaluations/templates` | signed in; tier FULL |  | `EvaluationController.listTemplates` |
| GET | `/api/v1/evaluations/templates/:id` | signed in; tier FULL |  | `EvaluationController.getTemplate` |
| POST | `/api/v1/evaluations/templates` | signed in; tier FULL |  | `EvaluationController.createTemplate` |
| PUT | `/api/v1/evaluations/templates/:id` | signed in; tier FULL |  | `EvaluationController.updateTemplate` |
| POST | `/api/v1/evaluations/templates/:id/deactivate` | signed in; tier FULL |  | `EvaluationController.deactivateTemplate` |
| POST | `/api/v1/evaluations/templates/:id/duplicate` | signed in; tier FULL |  | `EvaluationController.duplicateTemplate` |
| PUT | `/api/v1/evaluations/templates/:id/job-roles` | signed in; tier FULL |  | `EvaluationController.setTemplateJobRoles` |
| GET | `/api/v1/evaluations/config` | signed in; tier FULL |  | `EvaluationController.getConfig` |
| GET | `/api/v1/evaluations/cycles` | signed in; tier FULL |  | `EvaluationController.listCycles` |
| GET | `/api/v1/evaluations/cycles/:id` | signed in; tier FULL |  | `EvaluationController.getCycle` |
| POST | `/api/v1/evaluations/cycles/preview` | signed in; tier FULL |  | `EvaluationController.previewCycle` |
| POST | `/api/v1/evaluations/cycles` | signed in; tier FULL | yes | `EvaluationController.createCycle` |
| GET | `/api/v1/evaluations/designated-evaluators` | signed in; tier FULL | yes | `EvaluationController.designatedEvaluators` |
| POST | `/api/v1/evaluations/cycles/:id/close` | signed in; tier FULL |  | `EvaluationController.closeCycle` |
| GET | `/api/v1/evaluations/cycles/:cycleId/employees/:employeeId/candidates` | signed in; tier FULL | yes | `EvaluationController.evaluatorCandidates` |
| PUT | `/api/v1/evaluations/cycles/:cycleId/employees/:employeeId/head` | signed in; tier FULL |  | `EvaluationController.setHeadEvaluator` |
| POST | `/api/v1/evaluations/cycles/:cycleId/employees/:employeeId/peers` | signed in; tier FULL |  | `EvaluationController.addPeers` |
| DELETE | `/api/v1/evaluations/assignments/:id/peer` | signed in; tier FULL |  | `EvaluationController.removePeer` |
| GET | `/api/v1/evaluations/assignments` | any signed-in user | yes | `EvaluationController.listAssignments` |
| GET | `/api/v1/evaluations/assignments/:id` | any signed-in user | yes | `EvaluationController.getAssignment` |
| POST | `/api/v1/evaluations/assignments/:id/draft` | any signed-in user | yes | `EvaluationController.saveDraft` |
| POST | `/api/v1/evaluations/assignments/:id/submit` | any signed-in user | yes | `EvaluationController.submitEvaluation` |
| POST | `/api/v1/evaluations/assignments/:id/discussion` | any signed-in user | yes | `EvaluationController.recordDiscussion` |
| POST | `/api/v1/evaluations/assignments/:id/finalize` | signed in; tier FULL | yes | `EvaluationController.finalizeEvaluation` |
| GET | `/api/v1/evaluations/employees/:employeeId/history` | any signed-in user | yes | `EvaluationController.listEmployeeHistory` |
| GET | `/api/v1/awards/my` | any signed-in user |  | `AwardController.my` |
| POST | `/api/v1/awards/categories/:categoryId/nominations` | any signed-in user | yes | `AwardController.nominate` |
| POST | `/api/v1/awards/:id/ballot` | any signed-in user | yes | `AwardController.vote` |
| GET | `/api/v1/awards/history` | signed in; tier FULL |  | `AwardController.history` |
| GET | `/api/v1/awards/groups` | signed in; tier FULL |  | `AwardController.groups` |
| POST | `/api/v1/awards/groups` | signed in; tier FULL |  | `AwardController.saveGroup` |
| PUT | `/api/v1/awards/groups/:groupId` | signed in; tier FULL |  | `AwardController.saveGroup` |
| DELETE | `/api/v1/awards/groups/:groupId` | signed in; tier FULL |  | `AwardController.deleteGroup` |
| GET | `/api/v1/awards/hall-of-fame` | signed in; tier FULL |  | `AwardController.hallOfFame` |
| POST | `/api/v1/awards/hall-of-fame` | signed in; tier FULL |  | `AwardController.recordHallOfFame` |
| DELETE | `/api/v1/awards/hall-of-fame/:recordId` | signed in; tier FULL |  | `AwardController.removeHallOfFame` |
| POST | `/api/v1/awards/recognition-year` | signed in; tier FULL |  | `AwardController.createRecognitionYear` |
| PATCH | `/api/v1/awards/results/:resultId` | signed in; tier FULL |  | `AwardController.decide` |
| GET | `/api/v1/awards` | signed in; tier FULL |  | `AwardController.list` |
| POST | `/api/v1/awards` | signed in; tier FULL |  | `AwardController.create` |
| GET | `/api/v1/awards/:id` | signed in; tier FULL |  | `AwardController.get` |
| PATCH | `/api/v1/awards/:id` | signed in; tier FULL |  | `AwardController.update` |
| DELETE | `/api/v1/awards/:id` | signed in; tier FULL |  | `AwardController.remove` |
| POST | `/api/v1/awards/:id/transition` | signed in; tier FULL |  | `AwardController.transition` |
| POST | `/api/v1/awards/:id/confirm-shortlist` | signed in; tier FULL |  | `AwardController.confirmShortlist` |
| GET | `/api/v1/achievements` | any signed-in user | yes | `inline handler in route file` |
| GET | `/api/v1/achievements/entries/:entryId/attachment` | any signed-in user | yes | `inline handler in route file` |
| GET | `/api/v1/achievements/:id` | any signed-in user | yes | `inline handler in route file` |
| POST | `/api/v1/achievements` | signed in; tier FULL |  | `inline handler in route file` |
| PATCH | `/api/v1/achievements/:id` | signed in; tier FULL |  | `inline handler in route file` |
| DELETE | `/api/v1/achievements/:id` | signed in; tier FULL |  | `inline handler in route file` |
| POST | `/api/v1/achievements/:id/entries` | signed in; tier FULL + file upload |  | `inline handler in route file` |
| PATCH | `/api/v1/achievements/entries/:entryId` | signed in; tier FULL + file upload |  | `inline handler in route file` |
| POST | `/api/v1/achievements/entries/:entryId/move` | signed in; tier FULL |  | `inline handler in route file` |
| DELETE | `/api/v1/achievements/entries/:entryId` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/audit/options` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/audit` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/ai/status` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/ai/assistant/context` | any signed-in user |  | `inline handler in route file` |
| POST | `/api/v1/ai/assistant/messages` | any signed-in user |  | `inline handler in route file` |
| POST | `/api/v1/ai/assistant/quick-views/:viewId` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/ai/assistant/conversations` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/ai/assistant/conversations/:id` | any signed-in user |  | `inline handler in route file` |
| DELETE | `/api/v1/ai/assistant/conversations/:id` | any signed-in user |  | `inline handler in route file` |
| GET | `/api/v1/ai/facts` | signed in; tier FULL |  | `inline handler in route file` |
| POST | `/api/v1/ai/analyze` | signed in; tier FULL |  | `inline handler in route file` |
| POST | `/api/v1/ai/ask` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/reports/catalog` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/reports/:key` | signed in; tier FULL |  | `inline handler in route file` |
| POST | `/api/v1/reports/:key/export` | signed in; tier FULL |  | `inline handler in route file` |
| GET | `/api/v1/calendar-notes` | any signed-in user |  | `inline handler in route file` |
| POST | `/api/v1/calendar-notes` | any signed-in user | yes | `inline handler in route file` |
| PATCH | `/api/v1/calendar-notes/:id` | any signed-in user | yes | `inline handler in route file` |
| DELETE | `/api/v1/calendar-notes/:id` | any signed-in user |  | `inline handler in route file` |

---

## Appendix B — Data model (generated)

Generated from `apps/api/prisma/schema.prisma`: every table (database name in brackets), its fields, keys and
the schema's own documentation. Tables not used by any code are listed in Appendix E.6.

_93 models, generated from `apps/api/prisma/schema.prisma`._

#### Department (`departments`)
Represents the 7 service units under Hospicio de San Jose (Administrative Services, Finance, General Support Services, Auxiliary Services,  Social Services, Pastoral Care/Homelife Services, Health Services)

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` | unique |  |
| code | `String` | unique |  |
| description | `String?` |  |  |
| isActive | `Boolean` | default true |  |
| headJobRoleId | `String?` |  |  |
| parentDepartmentId | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| headJobRole | `JobRole?` | relation |  |
| parentDepartment | `Department?` | relation |  |
| childDepartments | `Department[]` | relation |  |
| units | `Unit[]` |  |  |
| employees | `Employee[]` |  |  |
| jobRoles | `JobRole[]` |  |  |
| jobOpenings | `JobOpening[]` |  |  |
| complianceScopes | `ComplianceRequirementScope[]` |  |  |
| evaluationCycleScopes | `EvaluationCycleScope[]` |  |  |
| announcementScopes | `AnnouncementAudienceScope[]` |  |  |

Indexes / constraints: index(code); index(parentDepartmentId); index(headJobRoleId)

#### Unit (`units`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` | unique |  |
| code | `String` | unique | ADM / FIN / GSS / AUX / SOC / PCH / HLT |
| departmentId | `String?` |  |  |
| department | `Department?` | relation |  |
| description | `String?` |  |  |
| isActive | `Boolean` | default true |  |
| headJobRoleId | `String?` |  |  |
| parentUnitId | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| headJobRole | `JobRole?` | relation |  |
| parentUnit | `Unit?` | relation |  |
| childUnits | `Unit[]` | relation |  |
| jobRoles | `JobRole[]` |  |  |
| employees | `Employee[]` |  |  |
| jobOpenings | `JobOpening[]` |  |  |
| complianceScopes | `ComplianceRequirementScope[]` |  |  |
| evaluationCycleScopes | `EvaluationCycleScope[]` |  |  |
| announcementScopes | `AnnouncementAudienceScope[]` |  |  |
| calendarWorkingDays | `OrganizationCalendarWorkingUnit[]` |  |  |

Indexes / constraints: index(code); index(parentUnitId); index(headJobRoleId)

#### JobRole (`job_roles`)
All 48 distinct job roles from the Job Roles spreadsheet Each role belongs to one unit and has a permission tier

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  | Exact title as written in spreadsheet |
| code | `String` | unique | Slug: e.g. HR_OFFICER, KITCHEN_SUPERVISOR |
| unitId | `String?` |  | The unit the role belongs to. Null for an organisation-wide role that is not part of one unit (e.g. SISTER); its holders still have their own unit. |
| unit | `Unit?` | relation |  |
| departmentId | `String?` |  |  |
| parentJobRoleId | `String?` |  |  |
| isHead | `Boolean` | default false |  |
| isSupervisor | `Boolean` | default false |  |
| hierarchyStatus | `HierarchyConfigurationStatus` | default PENDING_CONFIRMATION |  |
| permissionTier | `PermissionTier` |  | FULL / SUPERVISOR / STANDARD |
| isActive | `Boolean` | default true |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| department | `Department?` | relation |  |
| parentJobRole | `JobRole?` | relation |  |
| childJobRoles | `JobRole[]` | relation |  |
| departmentHeadFor | `Department[]` | relation |  |
| unitHeadFor | `Unit[]` | relation |  |
| employees | `Employee[]` |  |  |
| rolePermissions | `RolePermission[]` |  |  |
| jobOpenings | `JobOpening[]` |  |  |
| complianceScopes | `ComplianceRequirementScope[]` |  |  |
| evaluationCycleScopes | `EvaluationCycleScope[]` |  |  |
| announcementScopes | `AnnouncementAudienceScope[]` |  |  |
| evaluationTemplate | `EvaluationTemplateJobRole?` |  |  |
| additionalOversights | `AdditionalOversight[]` |  |  |

Indexes / constraints: index(unitId); index(permissionTier); index(parentJobRoleId); index(departmentId); index(hierarchyStatus)

#### Permission (`permissions`)
Granular permission registry Each record represents one specific action on one module with one scope

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| module | `String` |  | employees / leave / attendance / payslip / training / psychological / ai / reports / announcements / compliance / users / audit / settings / profile / activity |
| action | `String` |  | read / create / update / delete / approve / reject / export / import / manage |
| scope | `String` |  | OWN / SUBORDINATES / ALL |
| description | `String` |  |  |
| rolePermissions | `RolePermission[]` |  |  |

Indexes / constraints: unique(module,action,scope); index(module)

#### RolePermission (`role_permissions`)
Join table linking JobRoles to Permissions

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| jobRoleId | `String` |  |  |
| jobRole | `JobRole` | relation |  |
| permissionId | `String` |  |  |
| permission | `Permission` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(jobRoleId,permissionId); index(jobRoleId); index(permissionId)

#### User (`users`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| email | `String` | unique |  |
| passwordHash | `String` |  |  |
| employeeId | `String?` | unique |  |
| employee | `Employee?` | relation |  |
| isActive | `Boolean` | default true |  |
| isEmailVerified | `Boolean` | default false |  |
| failedLoginAttempts | `Int` | default 0 |  |
| lockedUntil | `DateTime?` |  |  |
| lastLoginAt | `DateTime?` |  |  |
| lastLoginIp | `String?` |  |  |
| mustChangePassword | `Boolean` | default false |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| sessions | `UserSession[]` |  |  |
| passwordResets | `PasswordResetToken[]` |  |  |
| emailVerifications | `EmailVerificationToken[]` |  |  |
| auditLogs | `AuditLog[]` | relation |  |
| activityLogs | `ActivityLog[]` |  |  |
| supervisorOverrides | `Employee[]` | relation |  |
| notifications | `Notification[]` |  |  |
| sentApplicantCommunications | `ApplicantCommunication[]` |  |  |
| scheduleHistoryActions | `ScheduleHistoryLog[]` | relation |  |
| createdAnnouncements | `Announcement[]` | relation |  |
| uploadedAnnouncementAttachments | `AnnouncementAttachment[]` | relation |  |
| attendanceManualEdits | `AttendanceRecord[]` | relation |  |
| attendanceImportsUploaded | `AttendanceImportBatch[]` | relation |  |
| attendanceImportsConfirmed | `AttendanceImportBatch[]` | relation |  |
| attendanceImportDecisions | `AttendanceImportCandidate[]` | relation |  |
| calendarNotes | `CalendarNote[]` |  |  |

Indexes / constraints: index(email)

#### CalendarNote (`calendar_notes`)
A plan, task or notice on the dashboard calendar. PERSONAL notes are private to their author. HR can also post a note to ALL employees or to SELECTED ones; recipients see it read-only. Only the author can change or delete a note. Deleted with the author's account.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| user | `User` | relation |  |
| date | `DateTime` |  |  |
| title | `String` |  |  |
| details | `String?` |  |  |
| isDone | `Boolean` | default false |  |
| audience | `CalendarNoteAudience` | default PERSONAL |  |
| recipients | `CalendarNoteRecipient[]` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(userId,date); index(audience,date)

#### CalendarNoteRecipient (`calendar_note_recipients`)
One employee a SELECTED calendar note is addressed to.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| noteId | `String` |  |  |
| note | `CalendarNote` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(noteId,employeeId); index(employeeId)

#### UserSession (`user_sessions`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| user | `User` | relation |  |
| refreshToken | `String` | unique |  |
| deviceInfo | `String?` |  |  |
| ipAddress | `String?` |  |  |
| expiresAt | `DateTime` |  |  |
| isRevoked | `Boolean` | default false |  |
| createdAt | `DateTime` | default now() |  |
| lastUsedAt | `DateTime` | default now() |  |

Indexes / constraints: index(userId); index(refreshToken)

#### PasswordResetToken (`password_reset_tokens`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| user | `User` | relation |  |
| token | `String` | unique |  |
| expiresAt | `DateTime` |  |  |
| usedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(token)

#### EmailVerificationToken (`email_verification_tokens`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| user | `User` | relation |  |
| token | `String` | unique |  |
| expiresAt | `DateTime` |  |  |
| usedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(token)

#### Employee (`employees`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeNumber | `String` | unique |  |
| firstName | `String` |  |  |
| middleName | `String?` |  |  |
| lastName | `String` |  |  |
| suffix | `String?` |  |  |
| gender | `Gender` |  |  |
| dateOfBirth | `DateTime` |  |  |
| placeOfBirth | `String?` |  |  |
| civilStatus | `CivilStatus` |  |  |
| nationality | `String` | default "Filipino" |  |
| religion | `String?` |  |  |
| bloodType | `String?` |  | ABO and Rh, e.g. "O+" (one of the eight standard groups). |
| spouseName | `String?` |  | Only when civil status is not Single. |
| numberOfChildren | `Int?` |  | Null = not provided; 0 is a real answer. |
| personalEmail | `String?` |  | The employee's email AND their HRISense login address (users.email). One source: onboarding creates the account with it and HR edits keep the two in step. |
| workEmail | `String?` | unique | Legacy — no longer collected or shown. Kept so old values are not lost; existing accounts that signed in with it still do (see users.email). |
| mobilePhone | `String` |  |  |
| telephoneNumber | `String?` |  |  |
| homePhone | `String?` |  |  |
| presentAddress | `String` |  |  |
| permanentAddress | `String?` |  | The home / provincial address ("Provincial Address" on the HSJ record). |
| hsjResidence | `String?` |  |  |
| residenceDorm | `String?` |  | "Unit / Dorm" where they stay. Not the organisational unit (unitId). |
| emergencyContactName | `String` |  |  |
| emergencyContactRel | `String` |  |  |
| emergencyContactPhone | `String` |  |  |
| departmentId | `String?` |  |  |
| department | `Department?` | relation |  |
| unitId | `String` |  |  |
| unit | `Unit` | relation |  |
| jobRoleId | `String` |  |  |
| jobRole | `JobRole` | relation |  |
| employmentStatus | `EmploymentStatus` | default REGULAR |  |
| employmentState | `EmploymentState` | default ACTIVE |  |
| workSchedule | `WorkSchedule` | default REGULAR_DAY_SHIFT |  |
| hireDate | `DateTime` |  |  |
| probationDate | `DateTime?` |  |  |
| regularizationDate | `DateTime?` |  |  |
| separationDate | `DateTime?` |  |  |
| separationReason | `String?` |  |  |
| prcLicenseNumber | `String?` |  |  |
| professionalRole | `String?` |  |  |
| prcIssuedDate | `DateTime?` |  | PRC licence dates — only with a licence number. Valid / expiring / expired is derived from prcValidUntil, never stored. |
| prcValidUntil | `DateTime?` |  |  |
| ncCertificateNumber | `String?` |  |  |
| ncQualification | `String?` |  | The qualification certified, e.g. "Caregiving NC II". |
| ncValidUntil | `DateTime?` |  | Only when the certificate states a validity. |
| primarySchool | `String?` |  |  |
| secondarySchool | `String?` |  |  |
| tertiarySchool | `String?` |  |  |
| tertiaryCourse | `String?` |  |  |
| tertiaryGraduated | `Boolean?` |  | Graduated from the tertiary course: true / false, or null when not recorded. |
| diploma | `String?` |  |  |
| vocationalQualification | `String?` |  |  |
| sssNumber | `String?` |  |  |
| philhealthNumber | `String?` |  |  |
| pagibigNumber | `String?` |  |  |
| tinNumber | `String?` |  |  |
| otherGovernmentIds | `String?` |  | Legacy free text ("Label: number" per line), from before other government IDs became rows (EmployeeGovernmentId). Kept and shown read-only; no longer written by the app. |
| paternityLeaveEligible | `Boolean` | default false | HR-managed eligibility for automatic leave entitlement. Never inferred from sex, civil status, children or any other profile field. |
| soloParentLeaveEligible | `Boolean` | default false |  |
| biometricCode | `String?` | unique | The employee's number in the biometric/timekeeping system, as it appears in the Mustard Seedtime export (the value in parentheses on an employee line). Unrelated to `employeeNumber`, which is HRISense's own HSJ-XXXX identity. Unique and nullable: attendance rows are matched on this and NEVER on name. |
| immediateSupervisorId | `String?` |  |  |
| supervisorAssignmentSource | `SupervisorAssignmentSource?` |  |  |
| supervisorAssignmentStatus | `SupervisorAssignmentStatus?` |  |  |
| supervisorPendingReason | `SupervisorPendingReason?` |  |  |
| supervisorOverrideReason | `String?` |  |  |
| supervisorOverrideById | `String?` |  |  |
| supervisorOverrideAt | `DateTime?` |  |  |
| photoUrl | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| user | `User?` |  |  |
| immediateSupervisor | `Employee?` | relation |  |
| directReports | `Employee[]` | relation |  |
| supervisorOverrideBy | `User?` | relation |  |
| supervisorLinks | `SupervisionLink[]` | relation |  |
| subordinateLinks | `SupervisionLink[]` | relation |  |
| additionalOversights | `AdditionalOversight[]` | relation |  |
| additionallyOverseenBy | `AdditionalOversight[]` | relation |  |
| awardNominationsReceived | `AwardNomination[]` | relation |  |
| awardNominationsMade | `AwardNomination[]` | relation |  |
| awardBallots | `AwardBallot[]` |  |  |
| awardVotesReceived | `AwardVote[]` |  |  |
| awardResults | `AwardResult[]` |  |  |
| hallOfFameRecords | `HallOfFameRecord[]` |  |  |
| attendanceRecords | `AttendanceRecord[]` |  |  |
| attendanceLogs | `AttendanceLog[]` |  |  |
| leaveRequests | `LeaveRequest[]` | relation |  |
| leaveApprovals | `LeaveRequest[]` | relation |  |
| leaveEndorsements | `LeaveRequest[]` | relation |  |
| leaveRevisionProposals | `LeaveRequest[]` | relation |  |
| leaveBalances | `LeaveBalance[]` |  |  |
| evaluationsAsSubject | `PerformanceEvaluation[]` | relation |  |
| evaluationsAsEvaluator | `PerformanceEvaluation[]` | relation |  |
| trainingAttendances | `TrainingAttendee[]` |  |  |
| activityAttendances | `ActivityAttendance[]` |  |  |
| evaluationAssignmentsAsSubject | `EvaluationAssignment[]` | relation |  |
| evaluationAssignmentsAsEvaluator | `EvaluationAssignment[]` | relation |  |
| evaluationCyclesDefaultEvaluator | `EvaluationCycle[]` | relation |  |
| evaluationCycleScopes | `EvaluationCycleScope[]` | relation |  |
| trainingParticipations | `TrainingParticipant[]` | relation |  |
| legacyMedicalRecords | `LegacyMedicalRecord[]` |  |  |
| legacyPsychologicalRecords | `LegacyPsychologicalRecord[]` |  |  |
| medicalRecords | `MedicalRecord[]` |  |  |
| psychologicalRecords | `PsychologicalRecord[]` |  |  |
| complianceRecords | `EmployeeComplianceRecord[]` |  |  |
| complianceRequirementScopes | `ComplianceRequirementScope[]` |  |  |
| payslips | `Payslip[]` |  |  |
| documents | `EmployeeDocument[]` |  |  |
| aiInsightsAbout | `AIInsight[]` |  |  |
| announcementAudienceScopes | `AnnouncementAudienceScope[]` |  |  |
| announcementRecipients | `AnnouncementRecipient[]` |  |  |
| scheduleAssignments | `EmployeeScheduleAssignment[]` |  |  |
| weeklySchedules | `EmployeeWeeklySchedule[]` |  |  |
| attendanceImportCandidates | `AttendanceImportCandidate[]` | relation |  |
| attendanceImportSuggestions | `AttendanceImportCandidate[]` | relation |  |
| scheduleHistoryTarget | `ScheduleHistoryLog[]` | relation |  |
| emergencyContacts | `EmployeeEmergencyContact[]` |  |  |
| governmentIds | `EmployeeGovernmentId[]` |  |  |
| calendarNoteRecipients | `CalendarNoteRecipient[]` |  |  |

Indexes / constraints: index(employeeNumber); index(departmentId); index(unitId); index(jobRoleId); index(employmentStatus); index(workEmail); index(immediateSupervisorId); index(supervisorAssignmentStatus); index(supervisorAssignmentSource)

#### EmployeeEmergencyContact (`employee_emergency_contacts`)
Up to three emergency contacts per employee (position 1-3). Position 1 is required and is mirrored into employees.emergencyContact*.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| position | `Int` |  |  |
| contactName | `String` |  |  |
| relationship | `String` |  |  |
| mobilePhone | `String` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(employeeId,position); index(employeeId)

#### EmployeeGovernmentId (`employee_government_ids`)
Government IDs beyond SSS, PhilHealth, Pag-IBIG and TIN. The type is free text (Passport, UMID, PhilSys ...) — no fixed list.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| position | `Int` | default 1 |  |
| idType | `String` |  |  |
| idNumber | `String` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId)

#### YearlyAchievementPage (`yearly_achievement_pages`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| year | `Int` |  |  |
| title | `String` |  |  |
| summary | `String?` |  |  |
| status | `YearlyAchievementStatus` | default DRAFT |  |
| isSample | `Boolean` | default false | Example content created to show the feature — marked on the page, for HR to edit or delete. |
| createdById | `String?` |  |  |
| updatedById | `String?` |  |  |
| publishedAt | `DateTime?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| entries | `YearlyAchievementEntry[]` |  |  |

Indexes / constraints: index(year)

#### YearlyAchievementEntry (`yearly_achievement_entries`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| pageId | `String` |  |  |
| page | `YearlyAchievementPage` | relation |  |
| title | `String` |  |  |
| description | `String` |  |  |
| displayOrder | `Int` | default 1 |  |
| attachmentPath | `String?` |  | Optional image or PDF, stored under uploads/achievements and streamed by an authenticated route. |
| attachmentName | `String?` |  |  |
| attachmentMime | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(pageId)

#### AwardGroup (`award_groups`)
An organisational group for awards: Hospicio's grouping terms ("Admin Services", "Health Services") mapped by HR to CURRENT units, departments, job roles and employees. Never a job role of its own.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` | unique |  |
| description | `String?` |  |  |
| isOfficial | `Boolean` | default false | One of Hospicio's four Employee of the Quarter / Vincentian groups. |
| unitIds | `Json` |  |  |
| departmentIds | `Json` |  |  |
| jobRoleIds | `Json` |  |  |
| employeeIds | `Json` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| nomineeCategories | `AwardCategory[]` | relation |  |
| voterCategories | `AwardCategory[]` | relation |  |

#### Award (`awards`)
One award in one period (Employee of the Quarter Q1 2027, Special Awards CY 2027). A new period is a new row, so earlier periods, their titles and their results stay exactly as they were.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| type | `AwardType` |  |  |
| isOfficial | `Boolean` | default false | Hospicio's official awards; HR-created ones are custom. |
| title | `String` |  |  |
| description | `String?` |  |  |
| year | `Int` |  |  |
| quarter | `Int?` |  |  |
| periodLabel | `String` |  |  |
| status | `AwardStatus` | default DRAFT |  |
| usesNomination | `Boolean` |  |  |
| usesVoting | `Boolean` |  |  |
| requiresConfirmation | `Boolean` | default true |  |
| resultMode | `AwardResultMode` | default PER_CATEGORY |  |
| shortlistCount | `Int?` |  | Top N (per category, or overall when COMBINED); null = every nominee with a vote. |
| eligibilityDate | `DateTime` |  | Completed years of service are counted as of this date. |
| minYears | `Int?` |  | Nominee rule in completed years (Vincentian: at least 3; Louisian: at most 3). |
| maxYears | `Int?` |  |  |
| excludeHallOfFame | `Boolean` | default false |  |
| excludedJobRoleIds | `Json?` |  | Job roles that cannot be nominees (Employee of the Quarter: leadership). |
| nominationOpenedAt | `DateTime?` |  |  |
| nominationClosedAt | `DateTime?` |  |  |
| votingOpenedAt | `DateTime?` |  |  |
| votingClosedAt | `DateTime?` |  |  |
| reviewStartedAt | `DateTime?` |  |  |
| verifiedAt | `DateTime?` |  |  |
| verifiedById | `String?` |  |  |
| finalizedAt | `DateTime?` |  |  |
| finalizedById | `String?` |  |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| categories | `AwardCategory[]` |  |  |
| ballots | `AwardBallot[]` |  |  |
| results | `AwardResult[]` |  |  |

Indexes / constraints: index(type,year); index(status)

#### AwardCategory (`award_categories`)
A category of an award: an Employee of the Quarter group, a Vincentian group, a Special Award title (editable per period) or a Longevity milestone.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| awardId | `String` |  |  |
| award | `Award` | relation |  |
| title | `String` |  |  |
| description | `String?` |  |  |
| displayOrder | `Int` | default 1 |  |
| votesPerVoter | `Int` | default 1 | Votes each voter may give here, always to DIFFERENT nominees. |
| nomineeGroupId | `String?` |  | Null = organisation-wide. |
| nomineeGroup | `AwardGroup?` | relation |  |
| voterGroupId | `String?` |  | Null = every active employee may vote. |
| voterGroup | `AwardGroup?` | relation |  |
| milestoneYears | `Int?` |  | Longevity milestone (5, 10, 15, 20 years). |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| nominations | `AwardNomination[]` |  |  |
| votes | `AwardVote[]` |  |  |
| results | `AwardResult[]` |  |  |

Indexes / constraints: index(awardId)

#### AwardNomination (`award_nominations`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| categoryId | `String` |  |  |
| category | `AwardCategory` | relation |  |
| nomineeId | `String` |  |  |
| nominee | `Employee` | relation |  |
| nominatedById | `String` |  |  |
| nominatedBy | `Employee` | relation |  |
| reason | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(categoryId,nomineeId,nominatedById); index(nomineeId)

#### AwardBallot (`award_ballots`)
One per voter per award, created first in the same transaction as the votes, so a second submission (refresh, another tab, double click) adds no votes.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| awardId | `String` |  |  |
| award | `Award` | relation |  |
| voterId | `String` |  |  |
| voter | `Employee` | relation |  |
| submittedAt | `DateTime` | default now() |  |
| votes | `AwardVote[]` |  |  |

Indexes / constraints: unique(awardId,voterId)

#### AwardVote (`award_votes`)
A single vote. Who voted for whom is never returned by the API.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| ballotId | `String` |  |  |
| ballot | `AwardBallot` | relation |  |
| categoryId | `String` |  |  |
| category | `AwardCategory` | relation |  |
| nomineeId | `String` |  |  |
| nominee | `Employee` | relation |  |
| slot | `Int` |  |  |

Indexes / constraints: unique(ballotId,categoryId,slot); unique(ballotId,categoryId,nomineeId); index(categoryId,nomineeId)

#### AwardResult (`award_results`)
The tally frozen when HR starts the review, and the committee's decisions on it.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| awardId | `String` |  |  |
| award | `Award` | relation |  |
| categoryId | `String?` |  |  |
| category | `AwardCategory?` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| voteCount | `Int` | default 0 |  |
| rank | `Int?` |  |  |
| shortlisted | `Boolean` | default false |  |
| tiedAtCutoff | `Boolean` | default false | Tied with the last shortlisted place: the committee decides. |
| completedYears | `Int?` |  | Longevity: completed years when recommended. |
| decision | `AwardResultDecision` | default PENDING |  |
| placement | `Int?` |  |  |
| note | `String?` |  |  |
| decidedById | `String?` |  |  |
| decidedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(awardId); index(employeeId)

#### HallOfFameRecord (`hall_of_fame_records`)
Hall of Fame awardees, recorded by HR as conferred (no formula decides it). They cannot be nominees for the Vincentian, Louisian or Special Awards, but they still vote.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| awardYear | `Int` |  |  |
| title | `String` | default "Hall of Fame Award" |  |
| conferredOn | `DateTime?` |  |  |
| notes | `String?` |  |  |
| recordedById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(employeeId)

#### AdditionalOversight (`additional_oversights`)
Additional (secondary, cross-branch) oversight shown on the Org Chart: an actual employee who also oversees another employee — or everyone currently holding a job role — outside their normal branch. It never changes who the employee reports to (`Employee.immediateSupervisorId` stays the primary hierarchy) and grants NO access by itself: leave, evaluations, attendance, schedules, My Team and every other module keep their own rules.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| overseerId | `String` |  |  |
| overseer | `Employee` | relation |  |
| overseenEmployeeId | `String?` |  | Exactly one target: one employee, or everyone holding a job role. |
| overseenEmployee | `Employee?` | relation |  |
| overseenJobRoleId | `String?` |  |  |
| overseenJobRole | `JobRole?` | relation |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(overseerId,overseenEmployeeId); unique(overseerId,overseenJobRoleId); index(overseenEmployeeId); index(overseenJobRoleId)

#### SupervisionLink (`supervision_links`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| supervisorId | `String` |  |  |
| supervisor | `Employee` | relation |  |
| subordinateId | `String` |  |  |
| subordinate | `Employee` | relation |  |
| isActive | `Boolean` | default true |  |
| assignedAt | `DateTime` | default now() |  |

Indexes / constraints: unique(supervisorId,subordinateId); index(supervisorId); index(subordinateId)

#### AttendanceRecord (`attendance_records`)
Daily attendance summary record per employee

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| date | `DateTime` |  |  |
| timeIn | `DateTime?` |  |  |
| timeOut | `DateTime?` |  |  |
| status | `AttendanceStatus` |  |  |
| hoursWorked | `Float?` |  |  |
| overtimeHours | `Float?` |  |  |
| remarks | `String?` |  |  |
| verifiedById | `String?` |  | PRE-EXISTING and currently unused by any code path. Its meaning is "verified", which is NOT the same as "source" — deliberately not repurposed for provenance. Flagged for a later cleanup decision. |
| sourceType | `AttendanceRecordSource` | default LEGACY | Where this record's current values came from. Existing rows default to LEGACY: their true origin is unknown and claiming IMPORT would be a lie. |
| lastImportBatchId | `String?` |  | The import batch that last wrote this record, when one did. |
| lastImportBatch | `AttendanceImportBatch?` | relation |  |
| manuallyModifiedAt | `DateTime?` |  | Set when HR corrects the record by hand. Non-null means a future import MUST ask before replacing it — this is the manual-correction guard. |
| manuallyModifiedById | `String?` |  |  |
| manuallyModifiedBy | `User?` | relation |  |
| recordVersion | `Int` | default 0 | Incremented on every write. Used for optimistic drift detection between an import preview and its apply. |
| sessions | `Json?` |  | Every punch pair the source reported: [{ "in": "06:02", "out": "14:27" }, …]. A pair with a missing side keeps the side that exists and nulls the other — a missing punch is never invented. |
| sourceHours | `Json?` |  | The source's own hour columns, verbatim and uncalculated: { "required": 9, "break": 0, "worked": 6.45, "overtime": 1.97, "undertime": 2.55 }. |
| reviewFlags | `Json?` |  | Conditions HR may need to look at for this day — attendance on a scheduled day off, punches during approved leave, an unclosed punch pair, and so on. Facts, not verdicts: nothing here changes the status. |
| logs | `AttendanceLog[]` |  |  |
| candidates | `AttendanceImportCandidate[]` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(employeeId,date); index(employeeId); index(date); index(status); index(sourceType); index(lastImportBatchId)

#### AttendanceLog (`attendance_logs`)
Granular tardiness/undertime/excuse slip logs Supervisors can view these for their subordinates (per spreadsheet permission)

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| attendanceId | `String?` |  |  |
| attendance | `AttendanceRecord?` | relation |  |
| logType | `String` |  | LATE / UNDERTIME / EXCUSE_SLIP / OVERTIME / ABSENT_UNEXCUSED |
| logDate | `DateTime` |  |  |
| minutesLate | `Int?` |  |  |
| excuseSlipUrl | `String?` |  |  |
| notes | `String?` |  |  |
| acknowledgedBy | `String?` |  |  |
| acknowledgedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId); index(logDate)

#### LeaveBalance (`leave_balances`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| year | `Int` |  |  |
| leaveType | `LeaveType` |  |  |
| totalAllotted | `Float` |  |  |
| used | `Float` | default 0 |  |
| pending | `Float` | default 0 |  |
| forfeited | `Float` | default 0 |  |
| allotmentSource | `LeaveAllotmentSource` | default MANUAL | AUTOMATIC: totalAllotted follows the completed-years entitlement (lib/leave-entitlement). MANUAL: HR entered it and HRISense never changes it. |
| entitlementCompletedYears | `Int?` |  | Completed years of service the automatic allotment was based on. |
| entitlementAppliedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(employeeId,year,leaveType); index(employeeId)

#### LeaveRequest (`leave_requests`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| leaveType | `LeaveType` |  |  |
| startDate | `DateTime` |  |  |
| endDate | `DateTime` |  |  |
| totalDays | `Float` |  |  |
| reason | `String` |  |  |
| supportingDocUrl | `String?` |  |  |
| status | `LeaveStatus` | default PENDING |  |
| approvedById | `String?` |  |  |
| approvedBy | `Employee?` | relation |  |
| approvedAt | `DateTime?` |  |  |
| rejectionReason | `String?` |  |  |
| hrNotes | `String?` |  |  |
| addressDuringLeave | `String?` |  | Where the employee can be reached during the leave (Hospicio form). |
| contactNumber | `String?` |  | Contact number during the leave; prefilled from the employee's mobile. |
| endorsedById | `String?` |  |  |
| endorsedBy | `Employee?` | relation |  |
| endorsedAt | `DateTime?` |  |  |
| endorsementNote | `String?` |  |  |
| proposedStartDate | `DateTime?` |  |  |
| proposedEndDate | `DateTime?` |  |  |
| proposedTotalDays | `Float?` |  |  |
| proposalReason | `String?` |  |  |
| proposedById | `String?` |  |  |
| proposedBy | `Employee?` | relation |  |
| proposedAt | `DateTime?` |  |  |
| originalStartDate | `DateTime?` |  | Set only when HR approved different dates or days: the employee's ORIGINAL request. startDate / endDate / totalDays then hold the final approved leave, which every calendar, attendance and balance figure uses. |
| originalEndDate | `DateTime?` |  |  |
| originalTotalDays | `Float?` |  |  |
| adjustmentReason | `String?` |  | Why the approved leave differs from the request. |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId); index(status); index(startDate,endDate)

#### PerformanceEvaluation (`performance_evaluations`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| evaluatorId | `String` |  |  |
| evaluator | `Employee` | relation |  |
| period | `String` |  | e.g. "Q1 2026", "Annual 2025" |
| year | `Int` |  |  |
| quarter | `Int?` |  | 1-4, null for annual evaluations |
| dimensionScores | `Json` |  | [{dimension: "Attendance", score: 4.5, weight: 0.20}, ...] |
| overallScore | `Float` |  |  |
| overallRating | `String` |  | Outstanding / Very Satisfactory / Satisfactory / Unsatisfactory / Poor |
| comments | `String?` |  |  |
| status | `EvaluationStatus` | default DRAFT |  |
| finalizedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId); index(year,quarter); index(status)

#### EvaluationTemplate (`evaluation_templates`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| ratingMethod | `EvaluationRatingMethod` | default NUMERIC |  |
| minScore | `Float?` | default 1 |  |
| maxScore | `Float?` | default 5 |  |
| scoreLabels | `Json?` |  |  |
| useWeighting | `Boolean` | default false |  |
| scoringMethod | `EvaluationScoringMethod` | default CRITERIA | How the overall score is reached (see EvaluationScoringMethod). |
| isOfficial | `Boolean` | default false | Hospicio de San Jose's official forms (seeded from the Word documents HR supplied). Their content is read-only: HR duplicates one to customise it. |
| officialCode | `String?` | unique |  |
| sourceDocument | `String?` |  |  |
| formLayout | `Json?` |  | The form's written sections and wording: instructions, appraisal type options, comments / goals labels, the employee acknowledgment, and where the weights came from. Null for templates that predate it. |
| isActive | `Boolean` | default true |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| criteria | `EvaluationCriterion[]` |  |  |
| groups | `EvaluationCriterionGroup[]` |  |  |
| cycles | `EvaluationCycle[]` |  |  |
| assignments | `EvaluationAssignment[]` |  |  |
| jobRoles | `EvaluationTemplateJobRole[]` |  |  |

#### EvaluationCriterionGroup (`evaluation_criterion_groups`)
A review area / performance factor. On an area template the area carries the weight; its statements (EvaluationCriterion rows) are the items rated.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| templateId | `String` |  |  |
| template | `EvaluationTemplate` | relation |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| displayOrder | `Int` | default 1 |  |
| weight | `Float?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| criteria | `EvaluationCriterion[]` |  |  |

Indexes / constraints: index(templateId)

#### EvaluationTemplateJobRole (`evaluation_template_job_roles`)
Which template a job role is evaluated with. A role has at most one; a cycle uses it for that role's employees and its own template for everyone else.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| templateId | `String` |  |  |
| template | `EvaluationTemplate` | relation |  |
| jobRoleId | `String` | unique |  |
| jobRole | `JobRole` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(templateId)

#### EvaluationCriterion (`evaluation_criteria`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| templateId | `String` |  |  |
| template | `EvaluationTemplate` | relation |  |
| groupId | `String?` |  | The review area this statement belongs to (area templates only). |
| group | `EvaluationCriterionGroup?` | relation |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| displayOrder | `Int` | default 1 |  |
| isRatingRequired | `Boolean` | default true |  |
| isCommentRequired | `Boolean` | default false |  |
| weight | `Float?` |  |  |
| isActive | `Boolean` | default true |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(templateId); index(groupId)

#### EvaluationCycle (`evaluation_cycles`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| templateId | `String` |  |  |
| template | `EvaluationTemplate` | relation |  |
| startDate | `DateTime` |  |  |
| dueDate | `DateTime` |  |  |
| status | `EvaluationCycleStatus` | default ACTIVE |  |
| evaluatorAssignmentMethod | `String` | default "MANUAL" |  |
| appraisalType | `String?` |  | The paper form's "Nature of Appraisal" / "Type of Evaluation" for this cycle. |
| evaluationMode | `EvaluationMode` | default STANDARD | Chosen when the cycle is created and never changed: its assignments differ. |
| selfWeight | `Float?` |  | Weighted multi-rater cycles: the self / peer / head percentages the cycle runs with — Hospicio's 20 / 20 / 60 for every new cycle (older cycles keep the percentages they were created with). Null for standard cycles. |
| peerWeight | `Float?` |  |  |
| headWeight | `Float?` |  |  |
| defaultEvaluatorId | `String?` |  |  |
| defaultEvaluator | `Employee?` | relation |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| scopes | `EvaluationCycleScope[]` |  |  |
| assignments | `EvaluationAssignment[]` |  |  |

Indexes / constraints: index(templateId); index(status); index(defaultEvaluatorId)

#### EvaluationCycleScope (`evaluation_cycle_scopes`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| cycleId | `String` |  |  |
| cycle | `EvaluationCycle` | relation |  |
| scopeType | `RequirementScopeType` |  |  |
| targetUnitId | `String?` |  |  |
| targetUnit | `Unit?` | relation |  |
| targetDepartmentId | `String?` |  |  |
| targetDepartment | `Department?` | relation |  |
| targetJobRoleId | `String?` |  |  |
| targetJobRole | `JobRole?` | relation |  |
| targetEmployeeId | `String?` |  |  |
| targetEmployee | `Employee?` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(cycleId); index(scopeType)

#### EvaluationAssignment (`evaluation_assignments`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| cycleId | `String` |  |  |
| cycle | `EvaluationCycle` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| evaluatorId | `String` |  |  |
| evaluator | `Employee` | relation |  |
| templateId | `String` |  |  |
| template | `EvaluationTemplate` | relation |  |
| templateSnapshot | `Json?` |  |  |
| raterType | `EvaluationRaterType` | default HEAD | Whose rating this is: the employee's SELF rating, a PEER's, or the assigned HEAD / supervisor / coordinator's. The HEAD assignment carries the discussion and HR finalisation for the employee's evaluation in the cycle. |
| dueDate | `DateTime` |  |  |
| status | `EvaluationAssignmentStatus` | default NOT_STARTED |  |
| startedAt | `DateTime?` |  |  |
| submittedAt | `DateTime?` |  |  |
| finalizedAt | `DateTime?` |  |  |
| finalizedById | `String?` |  |  |
| overallScore | `Float?` |  |  |
| overallRating | `String?` |  |  |
| evaluatorSummary | `String?` |  |  |
| developmentRecommendations | `String?` |  |  |
| isEmployeeVisible | `Boolean` | default false |  |
| discussionCompletedAt | `DateTime?` |  | Discussion with the evaluated employee (HEAD assignment only), recorded by the assigned evaluator after submitting and required before finalisation. |
| discussionDate | `DateTime?` |  |  |
| discussionNotes | `String?` |  |  |
| discussionRecordedById | `String?` |  |  |
| combinedScore | `Float?` |  | Final weighted rating (HEAD row, weighted multi-rater cycles) frozen at HR finalisation, with the breakdown that produced it. |
| combinedBreakdown | `Json?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| responses | `EvaluationResponse[]` |  |  |

Indexes / constraints: unique(cycleId,employeeId,raterType,evaluatorId); index(cycleId); index(employeeId); index(evaluatorId); index(status); index(templateId)

#### EvaluationResponse (`evaluation_responses`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| assignmentId | `String` |  |  |
| assignment | `EvaluationAssignment` | relation |  |
| criterionId | `String` |  |  |
| criterionName | `String` |  |  |
| criterionDescription | `String?` |  |  |
| criterionWeight | `Float?` |  |  |
| ratingNumeric | `Float?` |  |  |
| ratingLabel | `String?` |  |  |
| comment | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(assignmentId,criterionId); index(assignmentId)

#### LegacyComplianceRequirement (`compliance_requirements`)
@deprecated Legacy stub — table preserved for safety. Use ComplianceRequirement instead.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  |  |
| description | `String` |  |  |
| category | `ComplianceCategory` |  |  |
| dueDate | `DateTime` |  |  |
| status | `ComplianceStatus` | default PENDING |  |
| responsibleUnitId | `String?` |  |  |
| aiRiskScore | `Float?` |  |  |
| reminderSentAt | `DateTime?` |  |  |
| completedAt | `DateTime?` |  |  |
| completionNotes | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| documents | `LegacyComplianceDocument[]` |  |  |

#### LegacyComplianceDocument (`compliance_documents`)
@deprecated Legacy stub — table preserved for safety.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| requirementId | `String` |  |  |
| requirement | `LegacyComplianceRequirement` | relation |  |
| fileName | `String` |  |  |
| fileUrl | `String` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(requirementId)

#### LegacyMedicalRecord (`medical_records`)
@deprecated Legacy stub — table preserved for safety. Use MedicalRecord instead.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| date | `DateTime` |  |  |
| type | `String` |  |  |
| findings | `String` |  |  |
| recommendations | `String?` |  |  |
| attachments | `Json?` |  |  |
| recordedById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId)

#### LegacyPsychologicalRecord (`psychological_records`)
@deprecated Legacy stub — table preserved for safety. Use PsychologicalRecord instead.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| date | `DateTime` |  |  |
| sessionType | `String` |  |  |
| summary | `String` |  |  |
| recommendations | `String?` |  |  |
| attachments | `Json?` |  |  |
| conductedById | `String?` |  |  |
| isConfidential | `Boolean` | default true |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId)

#### ComplianceRequirement (`compliance_requirements_new`)
HR-defined compliance requirement template. Applicability determined dynamically via ComplianceRequirementScope entries.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  |  |
| description | `String?` |  |  |
| category | `RequirementCategory` |  |  |
| tracksExpiry | `Boolean` | default false | Whether expiry tracking applies for this requirement |
| reminderDays | `Int?` |  | Days before expiry to trigger EXPIRING_SOON status (null = disabled) |
| lifecycle | `RequirementLifecycle` | default ACTIVE |  |
| deletedAt | `DateTime?` |  |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| scopes | `ComplianceRequirementScope[]` |  |  |
| medicalRecords | `MedicalRecord[]` |  |  |
| psychRecords | `PsychologicalRecord[]` |  |  |
| complianceRecords | `EmployeeComplianceRecord[]` |  |  |
| trainingActivities | `TrainingActivity[]` |  |  |

Indexes / constraints: index(lifecycle); index(category)

#### ComplianceRequirementScope (`compliance_requirement_scopes`)
Defines which employees a ComplianceRequirement applies to. Resolved dynamically at query time using current employee organizational data.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| requirementId | `String` |  |  |
| requirement | `ComplianceRequirement` | relation |  |
| scopeType | `RequirementScopeType` |  |  |
| targetUnitId | `String?` |  | Populated when scopeType = UNIT |
| targetUnit | `Unit?` | relation |  |
| targetDepartmentId | `String?` |  | Populated when scopeType = DEPARTMENT |
| targetDepartment | `Department?` | relation |  |
| targetJobRoleId | `String?` |  | Populated when scopeType = JOB_ROLE |
| targetJobRole | `JobRole?` | relation |  |
| targetEmployeeId | `String?` |  | Populated when scopeType = EMPLOYEE |
| targetEmployee | `Employee?` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(requirementId); index(scopeType)

#### MedicalRecord (`medical_records_new`)
Full lifecycle medical examination record. HR-only access. Sensitive fields (hrNotes) never exposed through compliance or employee-facing endpoints.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| requirementId | `String?` |  | Optional link to the compliance requirement this record fulfills |
| requirement | `ComplianceRequirement?` | relation |  |
| examType | `String` |  | Type of medical examination PRE_EMPLOYMENT / ANNUAL / OCCUPATIONAL / SPECIAL |
| examDate | `DateTime` |  |  |
| examinedBy | `String?` |  | Name of physician/clinic |
| hrNotes | `String?` |  | HR-internal administrative notes — NEVER returned to employee view |
| expiresAt | `DateTime?` |  | Optional expiry date as entered by HR from source document |
| reviewStatus | `RecordReviewStatus` | default PENDING_REVIEW |  |
| reviewedById | `String?` |  |  |
| reviewedAt | `DateTime?` |  |  |
| reviewReason | `String?` |  |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| documents | `MedicalRecordDocument[]` |  |  |

Indexes / constraints: index(employeeId); index(requirementId); index(reviewStatus); index(examDate); index(expiresAt)

#### MedicalRecordDocument (`medical_record_documents`)
Protected document attachment for a MedicalRecord.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| medicalRecordId | `String` |  |  |
| medicalRecord | `MedicalRecord` | relation |  |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| notes | `String?` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(medicalRecordId)

#### PsychologicalRecord (`psychological_records_new`)
Full lifecycle psychological assessment record. Two structural zones: employee-visible and HR-confidential. Employee self-view ONLY returns employeeVisibleSummary and EMPLOYEE_VISIBLE documents.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| requirementId | `String?` |  | Optional link to the compliance requirement this record fulfills |
| requirement | `ComplianceRequirement?` | relation |  |
| assessmentType | `String` |  | PRE_EMPLOYMENT / ANNUAL / COUNSELING / FOLLOW_UP / SPECIAL |
| assessmentDate | `DateTime` |  |  |
| conductedBy | `String?` |  | Name of psychologist/assessor |
| employeeVisibleSummary | `String?` |  | EMPLOYEE-VISIBLE zone: summary HR chooses to share with the employee |
| hrConfidentialNotes | `String?` |  | HR-CONFIDENTIAL zone: NEVER returned to employee or supervisor views |
| expiresAt | `DateTime?` |  | Optional expiry date as entered by HR from source document |
| reviewStatus | `RecordReviewStatus` | default PENDING_REVIEW |  |
| reviewedById | `String?` |  |  |
| reviewedAt | `DateTime?` |  |  |
| reviewReason | `String?` |  |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| documents | `PsychologicalRecordDocument[]` |  |  |

Indexes / constraints: index(employeeId); index(requirementId); index(reviewStatus); index(assessmentDate); index(expiresAt)

#### PsychologicalRecordDocument (`psychological_record_documents`)
Protected document for a PsychologicalRecord. visibility field enforced at service layer — HR_ONLY docs never streamed to employee.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| psychologicalRecordId | `String` |  |  |
| psychologicalRecord | `PsychologicalRecord` | relation |  |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| visibility | `PsychologicalDocumentVisibility` | default HR_ONLY | HR_ONLY documents are never streamed to employee self-view |
| notes | `String?` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(psychologicalRecordId); index(visibility)

#### EmployeeComplianceRecord (`employee_compliance_records`)
Fulfillment record for CERTIFICATION, TRAINING, DOCUMENT, OTHER requirements. Medical and Psychological requirements use their own dedicated record models.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| requirementId | `String` |  |  |
| requirement | `ComplianceRequirement` | relation |  |
| recordTitle | `String` |  | Human-readable title for this record (e.g. "BLS Certificate 2026") |
| referenceNumber | `String?` |  | Optional reference/certificate number |
| completedAt | `DateTime` |  | Date the certificate/document was issued or training was completed |
| expiresAt | `DateTime?` |  | Optional validity expiry date as entered by HR from source document |
| notes | `String?` |  |  |
| reviewStatus | `RecordReviewStatus` | default PENDING_REVIEW |  |
| reviewedById | `String?` |  |  |
| reviewedAt | `DateTime?` |  |  |
| reviewReason | `String?` |  |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| generatedFromTrainingParticipantId | `String?` | unique | SOURCE-EVENT IDEMPOTENCY KEY. Set when this record was generated automatically by a training completion. Unique, so retrying the same completion cannot create a second compliance record. Deliberately NOT a uniqueness rule over (employee, requirement) — recurring requirements legitimately produce several records over time. |
| generatedFromTrainingParticipant | `TrainingParticipant?` | relation |  |
| documents | `EmployeeComplianceDocument[]` |  |  |
| trainingParticipants | `TrainingParticipant[]` | relation |  |

Indexes / constraints: index(employeeId); index(requirementId); index(reviewStatus); index(expiresAt)

#### EmployeeComplianceDocument (`employee_compliance_documents`)
Protected document attachment for a generic EmployeeComplianceRecord.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| complianceRecordId | `String` |  |  |
| complianceRecord | `EmployeeComplianceRecord` | relation |  |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| visibility | `ComplianceDocumentVisibility` | default VISIBLE |  |
| notes | `String?` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(complianceRecordId)

#### Training (`trainings`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  |  |
| description | `String?` |  |  |
| type | `String` |  | SEMINAR / WORKSHOP / CERTIFICATION / ORIENTATION / DRILL / RECERTIFICATION |
| facilitator | `String` |  |  |
| venue | `String` |  |  |
| startDate | `DateTime` |  |  |
| endDate | `DateTime` |  |  |
| hoursCredit | `Float` |  |  |
| maxParticipants | `Int?` |  |  |
| status | `TrainingStatus` | default UPCOMING |  |
| materialsUrl | `String?` |  |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| attendees | `TrainingAttendee[]` |  |  |

Indexes / constraints: index(status); index(startDate)

#### TrainingActivity (`training_activities`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  |  |
| type | `TrainingActivityType` | default TRAINING |  |
| description | `String?` |  |  |
| provider | `String` |  |  |
| venue | `String` |  |  |
| startDate | `DateTime` |  |  |
| startTime | `String?` |  |  |
| endDate | `DateTime` |  |  |
| endTime | `String?` |  |  |
| hoursCredit | `Float?` |  |  |
| maxParticipants | `Int?` |  |  |
| status | `TrainingActivityStatus` | default SCHEDULED |  |
| complianceRequirementId | `String?` |  |  |
| complianceRequirement | `ComplianceRequirement?` | relation |  |
| materialsUrl | `String?` |  |  |
| createdById | `String?` |  |  |
| deletedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| participants | `TrainingParticipant[]` |  |  |
| documents | `TrainingActivityDocument[]` |  |  |

Indexes / constraints: index(status); index(startDate); index(complianceRequirementId)

#### TrainingParticipant (`training_participants`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| trainingActivityId | `String` |  |  |
| trainingActivity | `TrainingActivity` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| participationStatus | `TrainingParticipationStatus` | default ASSIGNED |  |
| assignedAt | `DateTime` | default now() |  |
| completedAt | `DateTime?` |  |  |
| validUntil | `DateTime?` |  |  |
| notes | `String?` |  |  |
| certificateOriginalFilename | `String?` |  |  |
| certificateStoredFilename | `String?` | unique |  |
| certificateMimeType | `String?` |  |  |
| certificateSizeBytes | `Int?` |  |  |
| complianceRecordId | `String?` |  |  |
| complianceRecord | `EmployeeComplianceRecord?` | relation |  |
| generatedComplianceRecord | `EmployeeComplianceRecord?` | relation | Back-reference for the compliance record auto-generated by THIS completion. Distinct from `complianceRecord`, which may point at a record HR created by hand. Enforces one generated record per completion event. |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(trainingActivityId,employeeId); index(trainingActivityId); index(employeeId); index(participationStatus); index(complianceRecordId)

#### TrainingActivityDocument (`training_activity_documents`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| trainingActivityId | `String` |  |  |
| trainingActivity | `TrainingActivity` | relation |  |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| notes | `String?` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(trainingActivityId)

#### TrainingAttendee (`training_attendees`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| trainingId | `String` |  |  |
| training | `Training` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| registeredAt | `DateTime` | default now() |  |
| attended | `Boolean` | default false |  |
| completedAt | `DateTime?` |  |  |
| certificateUrl | `String?` |  |  |
| score | `Float?` |  |  |
| notes | `String?` |  |  |

Indexes / constraints: unique(trainingId,employeeId); index(trainingId); index(employeeId)

#### ActivityAttendance (`activity_attendances`)
Tracks employee attendance at events/activities (separate from formal training) Supervisors can view this for their subordinates per spreadsheet: "ACTIVITIES ATTENDANCES"

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| activityName | `String` |  |  |
| activityDate | `DateTime` |  |  |
| isPresent | `Boolean` | default false |  |
| notes | `String?` |  |  |
| recordedById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(employeeId); index(activityDate)

#### Payslip (`payslips`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| period | `String` |  | e.g. "June 2026 - 1st Half" |
| periodStart | `DateTime` |  |  |
| periodEnd | `DateTime` |  |  |
| grossPay | `Float` |  |  |
| deductions | `Json` |  | {sss: 0, philhealth: 0, pagibig: 0, tax: 0, absences: 0, loans: 0, others: 0} |
| netPay | `Float` |  |  |
| isReleased | `Boolean` | default false |  |
| releasedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId); index(period); index(isReleased)

#### EmployeeDocument (`employee_documents`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| category | `DocumentCategory` |  |  |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| isVisibleToEmployee | `Boolean` | default true |  |
| isVisibleToSupervisor | `Boolean` | default false |  |
| expiresAt | `DateTime?` |  |  |
| replacedAt | `DateTime?` |  |  |
| deletedAt | `DateTime?` |  |  |
| notes | `String?` |  |  |
| uploadedById | `String?` |  |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(employeeId); index(category)

#### UploadedFile (`uploaded_files`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| fileName | `String` |  |  |
| originalName | `String` |  |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| fileUrl | `String` |  |  |
| uploadedById | `String?` |  |  |
| purpose | `String?` |  | PROFILE_PHOTO / DOCUMENT / COMPLIANCE / EXCUSE_SLIP / ANNOUNCEMENT / OTHER |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(uploadedById)

#### Announcement (`announcements`)
Full-lifecycle Announcement model. state + publishAt + expiresAt drive derived user-facing statuses at query time. No cron job required to transition between Draft / Scheduled / Published / Expired.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| title | `String` |  |  |
| content | `String` |  | @deprecated Use body instead. Preserved for migration safety. |
| body | `String?` |  | Authoritative full message body. Populated via: UPDATE announcements SET body = content. |
| priority | `AnnouncementPriority` | default NORMAL |  |
| state | `AnnouncementState` | default DRAFT |  |
| isPinned | `Boolean` | default false |  |
| publishAt | `DateTime?` |  | When the announcement becomes visible to recipients. For DRAFT: null. For SCHEDULED/PUBLISHED: set at activation time. |
| expiresAt | `DateTime?` |  | When the announcement is no longer CURRENT (but history is preserved). |
| archivedAt | `DateTime?` |  | Set when HR archives this announcement. |
| audience | `AnnouncementAudience` | default ALL | @deprecated Legacy audience enum column. New targeting uses AnnouncementAudienceScope. |
| targetUnitId | `String?` |  | @deprecated Legacy unit target. Use AnnouncementAudienceScope instead. |
| targetJobRoleId | `String?` |  | @deprecated Legacy job role target. Use AnnouncementAudienceScope instead. |
| targetEmployeeId | `String?` |  | @deprecated Legacy employee target. Use AnnouncementAudienceScope instead. |
| authorId | `String?` |  | @deprecated Legacy author employee FK. Use createdByUserId instead. |
| createdByUserId | `String?` |  | FK to users.id — the authenticated HR user who created this announcement. Nullable to allow existing seed rows without a valid User FK. |
| createdBy | `User?` | relation |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| audienceScopes | `AnnouncementAudienceScope[]` |  |  |
| recipients | `AnnouncementRecipient[]` |  |  |
| attachments | `AnnouncementAttachment[]` |  |  |

Indexes / constraints: index(state); index(isPinned); index(publishAt); index(expiresAt); index(createdByUserId)

#### AnnouncementAudienceScope (`announcement_audience_scopes`)
Defines one audience-targeting scope for an Announcement. Multiple scopes are additive — backend resolves and deduplicates. Mirrors the pattern used by ComplianceRequirementScope and EvaluationCycleScope but intentionally separate (Announcements ≠ Compliance domain).

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| announcementId | `String` |  |  |
| announcement | `Announcement` | relation |  |
| scopeType | `AnnouncementScopeType` |  |  |
| targetUnitId | `String?` |  | Populated when scopeType = UNIT |
| targetUnit | `Unit?` | relation |  |
| targetDepartmentId | `String?` |  | Populated when scopeType = DEPARTMENT |
| targetDepartment | `Department?` | relation |  |
| targetJobRoleId | `String?` |  | Populated when scopeType = JOB_ROLE |
| targetJobRole | `JobRole?` | relation |  |
| targetEmployeeId | `String?` |  | Populated when scopeType = EMPLOYEE |
| targetEmployee | `Employee?` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(announcementId); index(scopeType)

#### AnnouncementRecipient (`announcement_recipients`)
Recipient snapshot — one row per resolved employee per announcement. Created atomically when an announcement is published or scheduled. NEVER created by employee read actions (read marks only UPDATE existing rows).

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| announcementId | `String` |  |  |
| announcement | `Announcement` | relation |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| readAt | `DateTime?` |  | Set when the recipient opens the announcement detail view. Never reset by HR edits. |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(announcementId,employeeId); index(announcementId); index(employeeId); index(readAt)

#### AnnouncementAttachment (`announcement_attachments`)
Protected announcement attachment with secure stored-filename metadata. Mirrors the pattern of MedicalRecordDocument / TrainingActivityDocument.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| announcementId | `String` |  |  |
| announcement | `Announcement` | relation |  |
| fileName | `String` |  | @deprecated Use originalFilename instead. |
| fileUrl | `String` |  | @deprecated Use storedFilename instead. Public URL pattern is insecure. |
| originalFilename | `String?` |  | Original filename as provided by uploader (display only). |
| storedFilename | `String?` | unique | Random server-side filename (crypto.randomBytes). UNIQUE across all attachments. |
| mimeType | `String?` |  | MIME type validated at upload time. |
| sizeBytes | `Int?` |  | File size in bytes. |
| uploadedByUserId | `String?` |  | FK to users.id — HR user who uploaded this attachment. |
| uploadedBy | `User?` | relation |  |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(announcementId)

#### Notification (`notifications`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| user | `User` | relation |  |
| type | `NotificationType` |  |  |
| title | `String` |  |  |
| message | `String` |  |  |
| link | `String?` |  |  |
| isRead | `Boolean` | default false |  |
| readAt | `DateTime?` |  |  |
| eventId | `String?` | unique | Idempotency key for the business event that produced this notification, e.g. `leave-approved:<leaveRequestId>:<userId>`. Nullable, because plenty of notifications are one-off and have no natural event key. When present it is unique, so a retried request cannot create a second copy. Mirrors the pattern already proven by ApplicantCommunication.eventId. |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(userId); index(isRead); index(createdAt)

#### AuditLog (`audit_logs`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| actorUserId | `String?` |  |  |
| actorUser | `User?` | relation |  |
| targetEmployeeId | `String?` |  |  |
| action | `String` |  | LOGIN / CREATE / UPDATE / etc. |
| entityType | `String?` |  | EMPLOYEE / DRAFT / LEAVE_REQUEST / etc. |
| entityId | `String?` |  |  |
| metadata | `Json?` |  |  |
| oldValue | `Json?` |  |  |
| newValue | `Json?` |  |  |
| ipAddress | `String?` |  |  |
| userAgent | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(actorUserId); index(targetEmployeeId); index(entityType); index(createdAt)

#### OnboardingDraft (`onboarding_drafts`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| data | `Json` |  |  |
| status | `OnboardingDraftStatus` | default DRAFT |  |
| createdById | `String` |  |  |
| lastUpdatedById | `String` |  |  |
| assignedToId | `String?` |  |  |
| createdEmployeeId | `String?` | unique |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| completedAt | `DateTime?` |  |  |

Indexes / constraints: index(createdById); index(assignedToId); index(status)

#### ActivityLog (`activity_logs`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String?` |  |  |
| user | `User?` | relation |  |
| action | `String` |  |  |
| metadata | `Json?` |  |  |
| ipAddress | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(userId); index(createdAt)

#### AIInsight (`ai_insights`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| type | `AIInsightType` |  |  |
| title | `String` |  |  |
| content | `String` |  |  |
| confidenceScore | `Float` |  |  |
| module | `String` |  |  |
| targetEmployeeId | `String?` |  |  |
| targetEmployee | `Employee?` | relation |  |
| isActionable | `Boolean` | default false |  |
| suggestedActions | `Json?` |  | [{label: "View Analytics", action: "/reports/attendance"}, ...] |
| isRead | `Boolean` | default false |  |
| expiresAt | `DateTime?` |  |  |
| generatedAt | `DateTime` | default now() |  |

Indexes / constraints: index(type); index(generatedAt); index(isRead)

#### AIRequestLog (`ai_request_logs`)
One row per AI request, for auditing. Holds the question, a truncated answer and WHICH tools ran — never tool output, keys, tokens or other secrets.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| requestedById | `String?` |  |  |
| prompt | `String` |  | The user's question (secret-like strings redacted), or the analysis label. |
| response | `String?` |  | The final answer shown to the user, truncated. |
| model | `String` |  | configurable from env — never hardcoded |
| tokensUsed | `Int?` |  |  |
| promptTokens | `Int?` |  |  |
| completionTokens | `Int?` |  |  |
| status | `AIRequestStatus` | default PENDING |  |
| durationMs | `Int?` |  |  |
| error | `String?` |  | Error message only — never request headers or bodies. |
| channel | `String?` |  | ASSISTANT (the role-aware chat) / ANALYSIS (HR's workforce fact-sheet analysis). |
| conversationId | `String?` |  |  |
| actorTier | `PermissionTier?` |  | Tier resolved on the server for this request. Never taken from the browser. |
| provider | `String?` |  |  |
| outcome | `String?` |  | ANSWERED / NO_DATA / NOT_AUTHORIZED / OUT_OF_SCOPE / REFUSED / AI_UNAVAILABLE / ERROR |
| toolCalls | `Json?` |  | Tools the assistant used: [{ name, ok, code?, targetEmployeeId?, rows?, ms }]. Records WHAT was accessed, never the data returned. |
| toolRounds | `Int?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(requestedById); index(status); index(createdAt); index(conversationId)

#### AIConversation (`ai_conversations`)
A user's conversation with the AI assistant. Only the owner can read it. Messages hold the user's text and the assistant's final answer (with any chart it drew) — never raw tool results.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| userId | `String` |  |  |
| title | `String?` |  |  |
| messages | `Json` |  | [{ id, role: "user"/"assistant", content, status?, charts?, links?, createdAt }] |
| model | `String` |  |  |
| isArchived | `Boolean` | default false |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(userId); index(userId,isArchived,updatedAt)

#### SystemSetting (`system_settings`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| key | `String` | unique |  |
| value | `String` |  |  |
| description | `String?` |  |  |
| updatedById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(key)

#### JobOpening (`job_openings`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| referenceNumber | `String` | unique |  |
| slug | `String` | unique |  |
| title | `String` |  |  |
| unitId | `String` |  |  |
| unit | `Unit` | relation |  |
| departmentId | `String?` |  |  |
| department | `Department?` | relation |  |
| jobRoleId | `String` |  |  |
| jobRole | `JobRole` | relation |  |
| employmentType | `EmploymentStatus` |  |  |
| vacancies | `Int?` |  |  |
| description | `String` |  |  |
| responsibilities | `String` |  |  |
| qualifications | `String` |  |  |
| requiredDocuments | `String?` |  |  |
| openingDate | `DateTime` |  |  |
| closingDate | `DateTime` |  |  |
| status | `JobOpeningStatus` | default DRAFT |  |
| createdById | `String` |  |  |
| updatedById | `String` |  |  |
| publishedAt | `DateTime?` |  |  |
| closedAt | `DateTime?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| applications | `JobApplication[]` |  |  |

Indexes / constraints: index(status); index(closingDate)

#### Applicant (`applicants`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| firstName | `String` |  |  |
| middleName | `String?` |  |  |
| lastName | `String` |  |  |
| suffix | `String?` |  |  |
| email | `String` |  |  |
| mobile | `String` |  |  |
| address | `String?` |  |  |
| religion | `String?` |  | Free text: the applicant picks from a list or types their own under "Others". |
| gender | `Gender?` |  | Optional on the public form: an applicant is not obliged to state it, and PREFER_NOT_TO_SAY is a real answer rather than a missing one. |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| applications | `JobApplication[]` |  |  |

Indexes / constraints: index(email); index(mobile)

#### JobApplication (`job_applications`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| referenceNumber | `String` | unique |  |
| applicantId | `String` |  |  |
| applicant | `Applicant` | relation |  |
| jobOpeningId | `String` |  |  |
| jobOpening | `JobOpening` | relation |  |
| applicationDate | `DateTime` | default now() |  |
| status | `JobApplicationStatus` | default SUBMITTED |  |
| source | `String?` |  |  |
| applicantMessage | `String?` |  |  |
| privacyConsent | `Boolean` |  |  |
| consentTimestamp | `DateTime` |  |  |
| onboardingDraftId | `String?` | unique |  |
| employeeId | `String?` | unique |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| documents | `ApplicantDocument[]` |  |  |
| interviews | `ApplicantInterview[]` |  |  |
| statusHistory | `ApplicationStatusHistory[]` |  |  |
| notes | `ApplicantNote[]` |  |  |
| communications | `ApplicantCommunication[]` |  |  |

Indexes / constraints: index(status); index(jobOpeningId); index(applicantId)

#### ApplicantDocument (`applicant_documents`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| applicationId | `String` |  |  |
| application | `JobApplication` | relation |  |
| documentType | `String` |  | RESUME / COVER_LETTER / OTHER |
| originalFilename | `String` |  |  |
| storedFilename | `String` | unique |  |
| mimeType | `String` |  |  |
| sizeBytes | `Int` |  |  |
| storagePath | `String` |  |  |
| uploadedBy | `String?` |  | nullable for public |
| uploadedAt | `DateTime` | default now() |  |

Indexes / constraints: index(applicationId)

#### ApplicantInterview (`applicant_interviews`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| applicationId | `String` |  |  |
| application | `JobApplication` | relation |  |
| scheduledAt | `DateTime` |  |  |
| interviewType | `InterviewType` |  |  |
| locationDetails | `String?` |  |  |
| interviewer | `String?` |  |  |
| notes | `String?` |  |  |
| recommendation | `String?` |  |  |
| status | `InterviewStatus` | default SCHEDULED |  |
| createdById | `String` |  |  |
| updatedById | `String` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(applicationId); index(scheduledAt)

#### ApplicationStatusHistory (`application_status_history`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| applicationId | `String` |  |  |
| application | `JobApplication` | relation |  |
| previousStatus | `JobApplicationStatus?` |  |  |
| newStatus | `JobApplicationStatus` |  |  |
| reason | `String?` |  |  |
| changedById | `String` |  |  |
| changedAt | `DateTime` | default now() |  |

Indexes / constraints: index(applicationId)

#### ApplicantNote (`applicant_notes`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| applicationId | `String` |  |  |
| application | `JobApplication` | relation |  |
| note | `String` |  |  |
| createdById | `String` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(applicationId)

#### ApplicantCommunication (`applicant_communications`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| jobApplicationId | `String` |  |  |
| application | `JobApplication` | relation |  |
| communicationType | `RecruitmentCommunicationType` |  |  |
| source | `RecruitmentCommunicationSource` | default MANUAL_HR |  |
| eventId | `String?` | unique |  |
| triggerType | `String?` |  |  |
| relatedEntityId | `String?` |  |  |
| channel | `CommunicationChannel` |  |  |
| recipientEmail | `String` |  |  |
| recipientName | `String` |  |  |
| subjectSnapshot | `String` |  |  |
| bodySnapshot | `String` |  |  |
| provider | `String` |  |  |
| providerMessageId | `String?` |  |  |
| sendStatus | `CommunicationSendStatus` |  |  |
| initiatedBy | `CommunicationInitiator` | default USER |  |
| sentByUserId | `String?` |  |  |
| sentByUser | `User?` | relation |  |
| sentAt | `DateTime?` |  |  |
| failedAt | `DateTime?` |  |  |
| failureCode | `String?` |  |  |
| failureReason | `String?` |  |  |
| retryOfCommunicationId | `String?` |  |  |
| retryOf | `ApplicantCommunication?` | relation |  |
| retries | `ApplicantCommunication[]` | relation |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(jobApplicationId); index(communicationType); index(sendStatus); index(sentAt); index(sentByUserId)

#### OrganizationCalendarEntry (`organization_calendar_entries`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| date | `DateTime` |  |  |
| name | `String` |  |  |
| type | `OrganizationCalendarType` |  |  |
| source | `OrganizationCalendarSource` | default MANUAL |  |
| status | `OrganizationCalendarStatus` | default APPROVED |  |
| notes | `String?` |  |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| workingUnits | `OrganizationCalendarWorkingUnit[]` |  | Units expected to work on this date. Every other unit observes the entry. |

Indexes / constraints: unique(date,name); index(date); index(status)

#### ScheduleTemplate (`schedule_templates`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| isActive | `Boolean` | default true |  |
| version | `Int` | default 1 |  |
| isArchived | `Boolean` | default false |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| days | `ScheduleTemplateDay[]` |  |  |
| assignments | `EmployeeScheduleAssignment[]` |  |  |

Indexes / constraints: unique(name,version)

#### ScheduleTemplateDay (`schedule_template_days`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| templateId | `String` |  |  |
| template | `ScheduleTemplate` | relation |  |
| dayOfWeek | `Weekday` |  |  |
| isWorking | `Boolean` | default true |  |
| startTime | `String?` |  | Format "08:00:00" |
| endTime | `String?` |  | Format "17:00:00" |

Indexes / constraints: unique(templateId,dayOfWeek)

#### EmployeeScheduleAssignment (`employee_schedule_assignments`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| scheduleTemplateId | `String` |  |  |
| scheduleTemplate | `ScheduleTemplate` | relation |  |
| effectiveFrom | `DateTime` |  |  |
| effectiveTo | `DateTime?` |  |  |
| assignedByUserId | `String?` |  |  |
| bulkBatchId | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(employeeId); index(effectiveFrom,effectiveTo)

#### ScheduleHistoryLog (`schedule_history_logs`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| targetEmployeeId | `String?` |  |  |
| employee | `Employee?` | relation |  |
| actorUserId | `String` |  |  |
| user | `User` | relation |  |
| action | `String` |  | TEMPLATE_ASSIGNED, OVERRIDE_CREATED, HOLIDAY_APPROVED, etc. |
| previousValue | `Json?` |  |  |
| newValue | `Json?` |  |  |
| remarks | `String?` |  |  |
| bulkBatchId | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: index(targetEmployeeId); index(actorUserId); index(bulkBatchId)

#### ShiftDefinition (`shift_definitions`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| name | `String` |  |  |
| description | `String?` |  |  |
| category | `ShiftCategory` | default SHIFT |  |
| startTime | `String` |  | Format "08:00:00" |
| endTime | `String` |  | Format "17:00:00" |
| isActive | `Boolean` | default true |  |
| version | `Int` | default 1 |  |
| isArchived | `Boolean` | default false |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| weeklyShifts | `EmployeeWeeklyScheduleShift[]` |  |  |

Indexes / constraints: unique(name,version)

#### EmployeeWeeklySchedule (`employee_weekly_schedules`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| employeeId | `String` |  |  |
| employee | `Employee` | relation |  |
| effectiveFrom | `DateTime` |  |  |
| effectiveTo | `DateTime?` |  |  |
| createdByUserId | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |
| days | `EmployeeWeeklyScheduleDay[]` |  |  |

Indexes / constraints: unique(employeeId,effectiveFrom); index(employeeId,effectiveFrom,effectiveTo)

#### EmployeeWeeklyScheduleDay (`employee_weekly_schedule_days`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| weeklyScheduleId | `String` |  |  |
| weeklySchedule | `EmployeeWeeklySchedule` | relation |  |
| dayOfWeek | `Weekday` |  |  |
| status | `DayConfigurationStatus` | default UNCONFIGURED |  |
| shifts | `EmployeeWeeklyScheduleShift[]` |  |  |

Indexes / constraints: unique(weeklyScheduleId,dayOfWeek)

#### EmployeeWeeklyScheduleShift (`employee_weekly_schedule_shifts`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| scheduleDayId | `String` |  |  |
| scheduleDay | `EmployeeWeeklyScheduleDay` | relation |  |
| shiftId | `String` |  |  |
| shift | `ShiftDefinition` | relation |  |
| sequence | `Int` | default 1 |  |

#### AttendanceImportBatch (`attendance_import_batches`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| fileHash | `String` |  | SHA-256 of the uploaded file. INDEXED, NOT UNIQUE — the same file may legitimately be uploaded again after a cancelled or failed import, so a hash match warns rather than blocks. |
| originalFilename | `String` |  |  |
| storedFilename | `String?` | unique | Randomised name under protected storage. Null when file retention is off. |
| fileSizeBytes | `Int` |  |  |
| uploadedByUserId | `String` |  |  |
| uploadedByUser | `User` | relation |  |
| uploadedAt | `DateTime` | default now() |  |
| status | `AttendanceImportStatus` | default UPLOADED |  |
| detectedPeriodStart | `DateTime?` |  | Derived from the parsed rows, never from the filename. |
| detectedPeriodEnd | `DateTime?` |  |  |
| totalSourceRows | `Int` | default 0 |  |
| countNew | `Int` | default 0 |  |
| countExactDuplicate | `Int` | default 0 |  |
| countEnrichment | `Int` | default 0 |  |
| countConflict | `Int` | default 0 |  |
| countConflictManual | `Int` | default 0 |  |
| countDuplicateInFile | `Int` | default 0 |  |
| countUnknownEmployee | `Int` | default 0 |  |
| countInvalid | `Int` | default 0 |  |
| countIdentityFlagged | `Int` | default 0 | Rows whose device code no longer matches the name beside it in the file. |
| countApplied | `Int` | default 0 |  |
| countSkipped | `Int` | default 0 |  |
| countFailed | `Int` | default 0 |  |
| confirmedByUserId | `String?` |  |  |
| confirmedByUser | `User?` | relation |  |
| confirmedAt | `DateTime?` |  |  |
| completedAt | `DateTime?` |  |  |
| failureReason | `String?` |  |  |
| normalizerVersion | `String?` |  | Which normalizer produced the candidates. Lets a later rule correction find the batches that need re-parsing. |
| rawRows | `AttendanceImportRawRow[]` |  |  |
| candidates | `AttendanceImportCandidate[]` |  |  |
| attendanceRecords | `AttendanceRecord[]` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: index(status); index(uploadedAt); index(fileHash); index(detectedPeriodStart,detectedPeriodEnd)

#### AttendanceImportRawRow (`attendance_import_raw_rows`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| batchId | `String` |  |  |
| batch | `AttendanceImportBatch` | relation |  |
| sourceRowNumber | `Int` |  | 1-based position in the source sheet, so a problem can be reported as "row 47" in terms the person holding the spreadsheet recognises. |
| sourceSheetName | `String?` |  |  |
| rawPayload | `Json` |  | The source row exactly as read. NOT interpreted — no column meaning is assumed anywhere in this model. |
| rawRowHash | `String` |  | Hash of rawPayload, for detecting identical rows within one file. |
| candidateId | `String?` |  | The normalized employee-day this row contributed to, once a normalizer has run. Many raw rows may share one candidate (multi-punch formats). |
| candidate | `AttendanceImportCandidate?` | relation |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(batchId,sourceRowNumber); index(batchId); index(batchId,rawRowHash); index(candidateId)

#### AttendanceImportCandidate (`attendance_import_candidates`)
| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| batchId | `String` |  |  |
| batch | `AttendanceImportBatch` | relation |  |
| employeeId | `String?` |  | Null when the source identifier matched no employee (UNKNOWN_EMPLOYEE). |
| employee | `Employee?` | relation |  |
| date | `DateTime?` |  | The business date this candidate describes. Null only for INVALID rows. |
| timeIn | `DateTime?` |  |  |
| timeOut | `DateTime?` |  |  |
| status | `AttendanceStatus?` |  |  |
| hoursWorked | `Float?` |  |  |
| overtimeHours | `Float?` |  |  |
| sourceEmployeeCode | `String?` |  | The identifier exactly as the file carried it, kept even when it matched nobody — that is the whole point of the UNKNOWN_EMPLOYEE report. |
| sessions | `Json?` |  | See AttendanceRecord.sessions / .sourceHours / .reviewFlags. |
| sourceHours | `Json?` |  |  |
| reviewFlags | `Json?` |  |  |
| classification | `AttendanceImportClassification` | default INVALID |  |
| classificationReason | `String?` |  |  |
| identityVerdict | `AttendanceImportIdentityVerdict?` |  | Whether the name printed beside this device code in the file still matches the employee the code is mapped to.  The name ITSELF is never stored - only the verdict and how close it was. Matching remains by `biometricCode` alone; this exists so a device number quietly reassigned to a different person is caught instead of silently filing one person's attendance under another's. |
| identityScore | `Int?` |  | 0-100 similarity against the mapped employee. Null when there was nothing to compare (no name in the file, or the code matched nobody). |
| suggestedEmployeeId | `String?` |  | The employee the source name most resembles, offered to HR for one-click confirmation. An HRISense id, never text copied out of the file. NEVER applied automatically - a suggestion may raise a question, never settle one. |
| suggestedEmployee | `Employee?` | relation |  |
| suggestedScore | `Int?` |  |  |
| existingRecordId | `String?` |  | The record this candidate collides with, when one exists. |
| existingRecord | `AttendanceRecord?` | relation |  |
| existingSnapshot | `Json?` |  | The existing values AT CLASSIFICATION TIME. Compared again at apply so a decision made against a stale preview is never executed. |
| existingRecordVersion | `Int?` |  | `recordVersion` observed at classification time — cheap drift check. |
| hrDecision | `AttendanceImportDecision` | default PENDING |  |
| hrDecisionByUserId | `String?` |  |  |
| hrDecisionByUser | `User?` | relation |  |
| hrDecisionAt | `DateTime?` |  |  |
| hrDecisionReason | `String?` |  |  |
| appliedAt | `DateTime?` |  | Stamped ONLY after the AttendanceRecord write committed. Makes resume after a partial failure exact rather than a guess. |
| applyError | `String?` |  |  |
| rawRows | `AttendanceImportRawRow[]` |  |  |
| createdAt | `DateTime` | default now() |  |
| updatedAt | `DateTime` |  |  |

Indexes / constraints: unique(batchId,employeeId,date); index(batchId,classification); index(employeeId,date); index(batchId,hrDecision); index(batchId,identityVerdict)

#### OrganizationCalendarWorkingUnit (`organization_calendar_working_units`)
A unit that is expected to work on an organisation calendar entry (holiday, non-working day, suspension). Units not listed observe the entry as usual.

| Field | Type | Keys / default | Notes |
|---|---|---|---|
| id | `String` | PK, default uuid() |  |
| entryId | `String` |  |  |
| entry | `OrganizationCalendarEntry` | relation |  |
| unitId | `String` |  |  |
| unit | `Unit` | relation |  |
| createdById | `String?` |  |  |
| createdAt | `DateTime` | default now() |  |

Indexes / constraints: unique(entryId,unitId); index(unitId)

---

## Appendix C — Status and option values (generated)

Every enum in the schema: the values a status or option can take, with the schema's notes.

_69 enums, generated from `apps/api/prisma/schema.prisma`._

#### SupervisorAssignmentSource
- `AUTO_JOB_ROLE`
- `AUTO_DEPARTMENT_HEAD`
- `AUTO_UNIT_HEAD`
- `MANUAL_OVERRIDE`

#### SupervisorAssignmentStatus
- `ASSIGNED`
- `PENDING`
- `OVERRIDDEN`

#### SupervisorPendingReason
- `MISSING_PARENT_ROLE`
- `NO_ACTIVE_SUPERVISOR`
- `UNCLEAR_HIERARCHY`
- `MISSING_HEAD_CONFIGURATION`

#### HierarchyConfigurationStatus
- `CONFIRMED`
- `PENDING_CONFIRMATION`

#### OnboardingDraftStatus
- `DRAFT`
- `IN_PROGRESS`
- `READY_FOR_REVIEW`
- `COMPLETED`
- `CANCELLED`

#### PermissionTier
- `FULL` — HR Officers — access ALL data for ALL employees
- `SUPERVISOR` — Section heads/coordinators — own data + subordinate attendance logs
- `STANDARD` — All other staff — own data only

#### EmploymentState
- `ACTIVE`
- `ON_LEAVE`
- `RESIGNED`
- `TERMINATED`
- `RETIRED`
- `AWOL` — Absent without official leave.
- `OTHERS` — Employment ended for a reason outside the list; the detail goes in separationReason.

#### EmploymentStatus
- `REGULAR`
- `PROBATIONARY`
- `CONTRACTUAL`
- `CASUAL`
- `PART_TIME`

#### WorkSchedule
- `REGULAR_DAY_SHIFT` — 8:00 AM - 5:00 PM
- `FLEXIBLE_SHIFT`
- `NIGHT_SHIFT` — 10:00 PM - 6:00 AM
- `ROTATING_SHIFT`
- `PART_TIME_MORNING`
- `PART_TIME_AFTERNOON`

#### Gender
- `MALE`
- `FEMALE`
- `PREFER_NOT_TO_SAY`

#### CivilStatus
- `SINGLE`
- `MARRIED`
- `WIDOWED`
- `SEPARATED`
- `LEGALLY_SEPARATED`

#### AttendanceStatus
- `PRESENT`
- `ABSENT`
- `LATE`
- `HALF_DAY`
- `ON_LEAVE`
- `HOLIDAY`
- `REST_DAY`
- `SUSPENDED`

#### LeaveAllotmentSource
- `MANUAL`
- `AUTOMATIC`

#### LeaveType
- `SICK`
- `VACATION`
- `EMERGENCY`
- `MATERNITY`
- `PATERNITY`
- `SOLO_PARENT`
- `STUDY`
- `REHABILITATION`
- `SPECIAL_PRIVILEGE`
- `BEREAVEMENT`
- `FORCED`
- `LEAVE_WITHOUT_PAY` — Hospicio form "Leave Without Pay" — uses no leave credits.
- `OFFSET` — Hospicio form "Others / Offset" — time off in place of extra time worked.
- `OTHER` — Hospicio form "Others" — the reason says what the leave is for.

#### LeaveStatus
- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `FOR_REVIEW`

#### EvaluationStatus
- `DRAFT`
- `SUBMITTED`
- `REVIEWED`
- `FINALIZED`

#### EvaluationRatingMethod
- `NUMERIC`
- `LABELED`

#### EvaluationScoringMethod
How an evaluation's overall score is reached.   CRITERIA       — flat criteria: weighted sum, or plain average (useWeighting)   AREA_WEIGHTED  — review areas: each area's average × the area's weight ÷ 100   AREA_AVERAGE   — review areas: each area's average, then the average of those                    (the Simplified form's own rule: total ÷ 3, then sum ÷ 10)

- `CRITERIA`
- `AREA_WEIGHTED`
- `AREA_AVERAGE`

#### EvaluationCycleStatus
- `ACTIVE`
- `CLOSED`
- `ARCHIVED`

#### EvaluationMode
How a cycle's employees are evaluated. STANDARD: the assigned head / supervisor / coordinator evaluates the employee (no self or peer rating). WEIGHTED_MULTI_RATER: self 20% + peer 20% + head 60% (Hospicio's weighting).

- `STANDARD`
- `WEIGHTED_MULTI_RATER`

#### EvaluationRaterType
- `SELF`
- `PEER`
- `HEAD`

#### EvaluationAssignmentStatus
- `NOT_STARTED`
- `IN_PROGRESS`
- `SUBMITTED`
- `FINALIZED`

#### TrainingStatus
- `UPCOMING`
- `ONGOING`
- `COMPLETED`
- `CANCELLED`
- `POSTPONED`

#### TrainingActivityType
- `TRAINING`
- `SEMINAR`
- `WORKSHOP`
- `ORIENTATION`
- `CONFERENCE`
- `OTHER`

#### TrainingActivityStatus
- `DRAFT`
- `SCHEDULED`
- `COMPLETED`
- `CANCELLED`

#### TrainingParticipationStatus
- `ASSIGNED`
- `COMPLETED`
- `DID_NOT_ATTEND`
- `EXCUSED`
- `CANCELLED`

#### ComplianceStatus
- `COMPLIANT`
- `NON_COMPLIANT`
- `AT_RISK`
- `PENDING`
- `EXEMPTED`

#### ComplianceCategory
- `REGULATORY`
- `LICENSING`
- `TRAINING`
- `HEALTH`
- `SAFETY`
- `DOCUMENTATION`
- `BIR`
- `SSS`
- `PHILHEALTH`
- `PAGIBIG`

#### RequirementCategory
Category of a compliance requirement

- `MEDICAL`
- `PSYCHOLOGICAL`
- `CERTIFICATION`
- `PROFESSIONAL_LICENSE`
- `TRAINING`
- `DOCUMENT`
- `OTHER`

#### RequirementLifecycle
Lifecycle of a compliance requirement definition

- `ACTIVE`
- `INACTIVE`

#### RequirementScopeType
How applicability scope is defined for a requirement

- `ALL`
- `UNIT`
- `DEPARTMENT`
- `JOB_ROLE`
- `EMPLOYEE`

#### RecordReviewStatus
Administrative review result for any compliance/medical/psychological record

- `PENDING_REVIEW`
- `ACCEPTED`
- `NEEDS_CORRECTION`

#### EmployeeComplianceStatus
Derived compliance status for a given employee × requirement pair

- `MISSING`
- `NEEDS_REVIEW`
- `VALID`
- `EXPIRING_SOON`
- `EXPIRED`

#### PsychologicalDocumentVisibility
Document visibility for psychological record attachments

- `EMPLOYEE_VISIBLE`
- `HR_ONLY`

#### ComplianceDocumentVisibility
Document visibility for generic compliance record attachments

- `VISIBLE`
- `HR_ONLY`

#### AnnouncementPriority
- `NORMAL`
- `IMPORTANT`
- `URGENT`

#### AnnouncementAudience
@deprecated Legacy audience enum — kept to avoid destructive enum migration. New audience targeting is handled by AnnouncementAudienceScope model.

- `ALL`
- `UNIT`
- `ROLE`
- `INDIVIDUAL`

#### AnnouncementState
Lifecycle state for the full Announcement workflow.

- `DRAFT` — Not visible to recipients
- `ACTIVE` — Scheduled (publishAt > now) or Published (publishAt <= now)
- `ARCHIVED` — HR-archived; removed from recipient feed; data preserved

#### AnnouncementScopeType
Scope targeting type for AnnouncementAudienceScope. Separate from RequirementScopeType — Announcements and Compliance are independent domains.

- `ALL` — All active employees
- `UNIT` — Employees in a specific Unit
- `DEPARTMENT` — Employees in a specific Department
- `JOB_ROLE` — Employees with a specific Job Role
- `EMPLOYEE` — A specific individual employee

#### NotificationType
- `LEAVE_FILED`
- `LEAVE_APPROVED`
- `LEAVE_REJECTED`
- `EVALUATION_ASSIGNED`
- `EVALUATION_SUBMITTED`
- `ANNOUNCEMENT`
- `COMPLIANCE_ALERT`
- `AI_INSIGHT`
- `ATTENDANCE_ALERT`
- `TRAINING_REMINDER`
- `BIRTHDAY_REMINDER` — An employee's birthday is coming up — raised for HR and the person's supervisor.
- `SYSTEM`
- `PAYSLIP_RELEASED`

#### AIInsightType
- `WORKFORCE_TREND`
- `ATTRITION_RISK`
- `COMPLIANCE_RISK`
- `ATTENDANCE_ANOMALY`
- `PERFORMANCE_INSIGHT`
- `RECOMMENDATION`
- `STAFFING_GAP`
- `SUMMARY`

#### AIRequestStatus
- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

#### JobOpeningStatus
- `DRAFT`
- `OPEN`
- `CLOSED`
- `FILLED`
- `ARCHIVED`

#### JobApplicationStatus
- `SUBMITTED`
- `UNDER_REVIEW`
- `SHORTLISTED`
- `FOR_INTERVIEW`
- `INTERVIEWED`
- `FOR_REQUIREMENTS`
- `HIRED`
- `REJECTED`
- `WITHDRAWN`

#### InterviewType
- `INITIAL`
- `TECHNICAL`
- `PANEL`
- `FINAL`
- `OTHER`

#### InterviewStatus
- `SCHEDULED`
- `COMPLETED`
- `CANCELLED`
- `RESCHEDULED`
- `NO_SHOW`

#### CalendarNoteAudience
Who can see a dashboard calendar note.

- `PERSONAL` — only the author
- `ALL` — every employee — an HR note for the whole organisation
- `SELECTED` — only the employees listed in calendar_note_recipients

#### YearlyAchievementStatus
Tracks supervisor → subordinate relationships Required for the "UNDER HER SUPERVISION" permission scope in the spreadsheet

- `DRAFT`
- `PUBLISHED`

#### AwardType
- `EMPLOYEE_OF_THE_QUARTER`
- `VINCENTIAN`
- `LOUISIAN`
- `SPECIAL`
- `LONGEVITY`
- `CUSTOM`

#### AwardStatus
Not every award uses every stage (Longevity has no nomination or voting).

- `DRAFT`
- `NOMINATION_OPEN`
- `NOMINATION_CLOSED`
- `VOTING_OPEN`
- `VOTING_CLOSED`
- `DELIBERATION`
- `VERIFIED`
- `FINALIZED`

#### AwardResultMode
PER_CATEGORY: each category ranked on its own (Special Awards: Top 5 each). COMBINED: one ranking across the award's categories (Vincentian: Top 15).

- `PER_CATEGORY`
- `COMBINED`

#### AwardResultDecision
- `PENDING`
- `CONFIRMED`
- `NOT_AWARDED`

#### DocumentCategory
- `RESUME`
- `EMPLOYMENT_CONTRACT`
- `GOVERNMENT_ID`
- `MEDICAL_CLEARANCE`
- `CERTIFICATE`
- `OTHER`

#### RecruitmentCommunicationType
- `APPLICATION_RECEIVED`
- `APPLICATION_UNDER_REVIEW`
- `SHORTLISTED`
- `INTERVIEW_PROCESS_UPDATE`
- `INTERVIEW_INVITATION`
- `INTERVIEW_RESCHEDULED`
- `INTERVIEW_CANCELLED`
- `ADDITIONAL_REQUIREMENTS`
- `APPLICATION_ACCEPTED`
- `APPLICATION_NOT_SELECTED`
- `APPLICATION_WITHDRAWN_CONFIRMATION`
- `CUSTOM_MESSAGE`

#### RecruitmentCommunicationSource
- `AUTOMATIC_SYSTEM`
- `MANUAL_HR`

#### CommunicationChannel
- `EMAIL`

#### CommunicationSendStatus
- `DRAFT`
- `SENDING`
- `SENT`
- `FAILED`
- `SIMULATED`

#### CommunicationInitiator
- `SYSTEM`
- `USER`

#### OrganizationCalendarType
- `HOLIDAY`
- `SPECIAL_NON_WORKING`
- `ORGANIZATION_NON_WORKING`
- `SUSPENSION`

#### OrganizationCalendarSource
- `HOLIDAY_API`
- `MANUAL`

#### OrganizationCalendarStatus
- `PENDING`
- `APPROVED`
- `IGNORED`

#### Weekday
- `MONDAY`
- `TUESDAY`
- `WEDNESDAY`
- `THURSDAY`
- `FRIDAY`
- `SATURDAY`
- `SUNDAY`

#### ShiftCategory
- `OFFICE`
- `SHIFT`

#### DayConfigurationStatus
- `UNCONFIGURED`
- `DAY_OFF`
- `WORKING`

#### AttendanceImportStatus
Lifecycle of one attendance import. Transitions are guarded server-side; the move into APPLYING is conditional so a batch cannot be applied twice.

- `UPLOADED`
- `PARSING`
- `VALIDATED`
- `APPLYING`
- `COMPLETED`
- `PARTIALLY_APPLIED`
- `CANCELLED`
- `FAILED`

#### AttendanceImportClassification
How one normalized employee-day compares with what HRISense already holds.

- `NEW`
- `EXACT_DUPLICATE`
- `ENRICHMENT`
- `CONFLICT`
- `CONFLICT_MANUAL`
- `DUPLICATE_IN_FILE`
- `UNKNOWN_EMPLOYEE`
- `INVALID`

#### AttendanceImportIdentityVerdict
Whether the name beside a device code still matches the employee it maps to. Never used to ASSIGN attendance - only to decide whether to ask HR about it.

- `MATCH`
- `MISMATCH`
- `UNCERTAIN`
- `NO_NAME_IN_SOURCE`
- `NO_EMPLOYEE_TO_CHECK`

#### AttendanceImportDecision
HR's decision for a candidate that cannot be applied automatically.

- `PENDING`
- `KEEP_EXISTING`
- `USE_UPLOADED`
- `SKIP`

#### AttendanceRecordSource
What last wrote an AttendanceRecord. LEGACY is the default for rows that pre-date provenance tracking: their real origin is unknown, and labelling them IMPORT would assert something false.

- `LEGACY`
- `IMPORT`
- `MANUAL`
- `SYSTEM`

---

## Appendix D — Glossary

| Term | Meaning in HRISense |
|---|---|
| **HSJ** | Hospicio de San Jose, the institution HRISense serves |
| **HR / FULL** | HR Officers; permission tier FULL — full access |
| **Supervisor / SUPERVISOR** | Section heads and coordinators; own data plus direct reports |
| **Employee / STANDARD** | All other staff; own data only |
| **Unit** | A top-level division of HSJ (8 exist) |
| **Job role** | A position within a unit; carries the permission tier and the place in the reporting line |
| **Immediate supervisor** | The person an employee reports to, resolved from the job-role hierarchy or set by HR override |
| **Direct reports / team** | Employees whose immediate supervisor is a given supervisor |
| **Employee number** | HSJ-assigned ID, e.g. `HSJ-0016` (development accounts use `DEV-…`) |
| **Timekeeping code / biometric code** | The number the Mustard device uses for a person; the only thing attendance imports match on |
| **201 file** | Philippine HR term for an employee's personnel file — here, their uploaded documents |
| **SSS, PhilHealth, Pag-IBIG, TIN** | Philippine social security, health insurance, housing fund and tax identification numbers |
| **PRC license** | Professional Regulation Commission license (licensed professions, e.g. nurses) |
| **Regularization** | The end of probation, when an employee becomes regular |
| **Mustard Seedtime / Bio-office** | The biometric timekeeping device and software; its *Timesheet Report* `.xls` is the attendance source |
| **Punch / session** | One clock-in and its clock-out; a day may have several sessions |
| **Hrs Required / Worked / OT / UT** | The device's own hours: required for the day, worked **inside** the shift, overtime **outside** it, undertime (required minus worked) |
| **No imported record** | No attendance data exists for that employee-day. **Not** an absence |
| **Import batch / candidate** | One uploaded file / one employee-day read from it |
| **Classification** | How a candidate compares with what HRISense already holds (NEW, CONFLICT, …) |
| **Review flag / holding flag** | A fact about a row; a holding flag makes HR decide before it is written |
| **Weekly schedule** | An employee's authoritative week of shifts and rest days, versioned by effective date |
| **Legacy schedule template** | The older schedule mechanism, used only where no weekly schedule exists |
| **Endorse** | A supervisor recommending a leave request to HR |
| **Evaluation cycle / assignment** | A review period / one employee reviewed by one evaluator in it |
| **Compliance requirement / scope / record** | What must be met / who must meet it / one person's fulfilment |
| **Recipient snapshot** | The frozen list of who an announcement was sent to, taken when it is published |
| **Workforce fact sheet** | The aggregated, non-identifying organisation figures on HR's *Workforce summary* tab |
| **AI tool** | One narrow, read-only lookup the AI assistant may call (e.g. *get_attendance*); each checks the asker's access itself |
| **Soft delete / archive** | Marking a record inactive while keeping it (`deletedAt`) |

---

## Appendix E — Known limitations, gaps and findings

Everything below was **verified in the source code or database** during this
review (30 September 2026), with the status of each as of 1 October 2026. It is
grouped by kind so it can be acted on.

### E.1 Defects

| # | Area | Finding | Effect today |
|---|---|---|---|
| 1 | Compliance | **Fixed 1 Oct 2026.** The scope check treated a requirement scoped to **one specific employee** as applying to **everyone**. It now compares the employee id (`complianceRequirementApplies`), and a department scope with no target matches nobody | Previously the one such requirement (*QA_COMPLIANCE_TEST BLS Certification*) counted as missing for 48 other employees |
| 2 | Compliance | Records from *Record Compliance Fulfillment* are saved as *Pending review*, and **no screen calls** the review endpoint (`PATCH /compliance/records/:id/review`) | Those records stay **Needs review** indefinitely |
| 3 | Evaluations | **Fixed 1 Oct 2026.** There was no way to assign or change an evaluator after a cycle was created. HR now assigns the head evaluator and peers per employee; every employee gets a self rating | — |
| 4 | Employees | **Fixed 1 Oct 2026.** Profile completion gave 6 points for *department* while no departments exist, so no profile could pass 94%. Department is now *Not applicable* (out of the denominator) when the employee's unit and job role have no department. The profile photo was also counted a second time as a document; it no longer is, so some employees' percentages changed | Profiles can reach 100%; the breakdown shows why |

### E.2 Privacy and security observations

| # | Finding |
|---|---|
| 5 | **Fixed 1 Oct 2026.** Training rosters were visible to everyone. Non-HR users now receive only their own participant row (aggregate counts remain), and `GET /training/employees/:id/history` — which had no check at all — now uses the profile's access rule |
| 6 | **Fixed 1 Oct 2026.** Any signed-in user could create an onboarding draft through the API. The whole `/onboarding-drafts` API is now HR-only |
| 7 | For an AI reader of Appendix A: the *Access* column is the **route guard**. Record-level rules (own / team scope) and several HR-only checks live **inside handlers**; the *Own checks in handler* column marks them. The module sections give the effective access |

### E.3 Built in the data or API, but not reachable from a screen

| # | Finding |
|---|---|
| 8 | **Manual attendance correction** — `PUT /attendance/:id` (HR) works and protects the record from imports, but no screen offers it |
| 9 | **Organisation structure** — units, departments and job roles have full create/edit/delete APIs. The only screen is **+ New position** on the job-opening form, which adds a job role (§17.3); editing or deleting roles, and units and departments, have no screen; departments are empty |
| 10 | **Legacy schedule templates** — creatable and assignable only through the API |
| 11 | **Leave supporting documents** — the API accepts a link, the form offers no upload |
| 12 | **Reason for overriding a hand-corrected attendance record** — the API accepts one, the import screen does not ask |

### E.4 Behaviour to be aware of

| # | Finding |
|---|---|
| 13 | **Approved leave is not shown as *On leave* in Daily Monitoring or the Attendance Tally.** Those count only attendance records with status ON_LEAVE, which nothing creates. Leave appears in the Leave Calendar, dashboards and import checks |
| 14 | **Leave days are calendar days**, weekends and holidays included, because HSJ's chargeable-day policy is unconfirmed; the code refuses to guess |
| 15 | **Notifications:** only 5 of 13 types are ever raised (leave ×3, birthday, calendar note, recruitment email failure). Evaluation, compliance, attendance, training, AI and payslip notifications do not exist yet. The Notifications page subtitle mentions evaluation and training updates that never arrive |
| 16 | **Imported attendance is recorded as PRESENT** when it has punches. HRISense computes no lateness and never infers absence |
| 17 | **Mustard hours:** the rule *worked = inside the shift, overtime = outside* matches about 79% of real days; the rest follow an internal device rule not reproduced here |
| 18 | **Recruitment and transactional emails** are only really sent when `RECRUITMENT_EMAIL_SEND_ENABLED` / `ENABLE_TRANSACTIONAL_EMAILS` are on; otherwise recruitment emails are recorded as *Simulated* |
| 19 | **No background jobs** — birthday reminders are raised when a dashboard is loaded; nothing time-based happens while nobody is using the system |

### E.5 Out of scope by design

- **Payroll and payslips.** `/payroll` and `/payslips` redirect to the dashboard.
  A `Payslip` table (45 rows) and `payslip.*` permissions exist from earlier work
  but no code uses them.
- **Clocking in inside HRISense.** Attendance comes only from the biometric
  device's export.
- **Attrition or performance prediction.** AI Assistance is forbidden from it.

### E.6 Tables no code uses

Present in the schema, not read or written by any code: `LegacyComplianceRequirement`,
`LegacyComplianceDocument`, `LegacyMedicalRecord`, `LegacyPsychologicalRecord`,
`PerformanceEvaluation`, `Training` (3 rows), `TrainingAttendee` (12 rows),
`ActivityAttendance`, `Payslip` (45 rows), `SupervisionLink` (5 rows),
`SystemSetting` (8 rows), `UploadedFile`, `ActivityLog`, `EmailVerificationToken`.
(`AIConversation` is now used by AI Assistance.) They are superseded by the models described in the
module sections.

### E.7 Found and handled while preparing AI Assistance (1 October 2026)

| # | Finding | Status |
|---|---|---|
| 20 | `ai_request_logs.prompt`, `response` and `error` were `VARCHAR(191)`, but the analysis endpoint writes answers of up to 8,000 characters — the first real AI call would have failed to log | **Fixed** — migration `20260930175006_ai_assistant_audit` makes them `TEXT` and adds audit columns |
| 21 | Two screens compute remaining leave differently: *New Request* shows **allotted − used**; the *Leave Balance* panel shows **allotted − used − pending − forfeited** | **Fixed** — every screen and the assistant use one API figure, *available* = allotted − used − pending − forfeited (`lib/leave-balance.ts`) |
| 22 | The Help Center guide *Where Attendance Data Comes From* still said importing was switched off | **Fixed** — rewritten for the working import |
| 23 | Both AI Help Center guides described the old HR-only page | **Fixed** — rewritten; *How to Use AI Assistance* is for every tier |
| 24 | This reference labelled weekly-schedule editing as HR-only; the API also lets a supervisor edit **their direct reports'** schedules (not their own) | **Corrected** in §11.3 |
| 25 | The navigation map said the org chart was HR-only; its route, API and guide are open to every tier | **Corrected** in §3.2 |
| 26 | Supervisors may open a direct or indirect report's profile through the API (`canAccessEmployeeRecord` uses the whole reporting tree), while §3.2 says others see only themselves; the page shows reduced tabs | **Fixed** (2 October 2026, §E.10) — direct reports only, through My Team, as the work profile |
| 27 | The Import screen's row buttons are **Use file** / **Keep record**; this reference called them *Use uploaded* / *Keep existing* | **Corrected** in §8.2 |
| 28 | "Attendance rate" was ambiguous: the assistant's tools divided days with a record by calendar days (days off, holidays and leave counted against it), and the fact sheet's *Attendance present rate* left half days out of presence and counted leave/holiday records against it | **Fixed** — one rule everywhere (§20.3): presence ÷ (presence + explicit absences), plus record coverage over scheduled workdays; the tile is now *Records showing presence* |
| 29 | Only 2 of 49 active employees have a weekly schedule; the rest have legacy templates, which do not say which days are workdays | **Open** — record coverage cannot be calculated for them; the assistant says so |

### E.8 Found and fixed in the percentage audit (1 October 2026)

| # | Finding | Status |
|---|---|---|
| 30 | The HR dashboard's attendance rate was (present + late) ÷ all records, including leave/holiday records and archived employees; the AI fact sheet and AI tools each used a different formula | **Fixed** — one function, `attendanceRateFromCounts` (§4.13, §5.1) |
| 31 | Announcement read and unread percentages were rounded separately and could total 99% or 101% | **Fixed** — apportioned to total exactly 100 |
| 32 | Report chart labels rounded each slice on its own, so slices could total 99–101% | **Fixed** — apportioned when the slices make up the total; **View data** table added |
| 33 | The evaluation overall score could not be explained on screen | **Fixed** — breakdown from the same scoring function used at submission (`evaluation-score.ts`) |
| 34 | Training capacity was capped at 100% in the text, hiding over-capacity activities | **Fixed** — the bar stops at full, the text shows the true figure and *over capacity* |
| 35 | Onboarding's stepper said *40% completed* on step 2 of 5, when one step was done | **Fixed** — *N of M steps done* |
| 36 | The import identity check showed *84% similar*, which reads like a share of records | **Fixed** — *name similarity 84/100* with an explanation |
| 37 | The landing-page animation shows sample figures (96.4%, 99.2%) that are not live data | **Labelled** *Illustration · sample figures* |

### E.9 Hospicio-confirmed HR logic (1 October 2026) — what could not be completed exactly

| # | Requirement | Why it is not fully done | What exists now |
|---|---|---|---|
| 38 | Sister role | **Resolved 2 Oct 2026** — Sister is a top-level role on the HR side | No supervisor required (same rule as HR Officer, `NO_SUPERVISOR_REQUIRED_ROLE_CODES`); organisation-wide, no unit of its own |
| 39 | Sister = "same authority as HR" in Recruitment | **Resolved 1 Oct 2026** — confirmed that Sister is on the HR role | Sister now holds the HR Officer's final recruitment authority (`FINAL_HR_AUTHORITY_ROLE_CODES`) |
| 40 | HR must not rate | The HR Officer is the resolved supervisor of the HR Assistant. Whether an HR employee may act as **head** evaluator for HR staff is not confirmed | HR can never rate through administration and cannot assign themselves; an HR employee explicitly assigned by another HR user (or by the supervisor method) can rate as head |
| 41 | Professional License scope | No job role is titled Nurse, Midwife or Physical Therapist; *PT Staff / PT Coordinator* may mean physical therapy, but "PT" also means part-time in *Part-Time Psychologist* | HR picks the job roles; *Social Workers* and *ECCD Teacher* are suggested by title |
| 42 | NCII Certificate — Caregiving | No job role is titled as a caregiving role | HR chooses the roles when creating the requirement |
| 43 | The four evaluation forms | Their content (criteria, questions, weights, scales) has not been supplied | Templates can be assigned per job role; no forms were created |
| 44 | Login email for existing accounts | 28 active accounts sign in with a work email that differs from their personal email | Not changed automatically; HR switches each from Account Management |
| 45 | Leave reset / carry-over | No annual reset or carry-over rule is defined | Balances remain per calendar year; only the allotment of automatic balances follows completed years |

### E.10 Found and fixed in the My Profile / My Team authorization audit (2 October 2026)

Tested by calling the API directly as an employee, two supervisors (one whose
coordinators have their own teams), HR and Sister — not by looking at screens.

| # | Finding | Status |
|---|---|---|
| 46 | A head could open the full record, timeline, completion and training of a **coordinator's staff** (an indirect report): `canAccessEmployeeRecord` used the whole reporting tree | **Fixed** — direct reports only (`isDirectSubordinate`), like every other module; indirect, unrelated and archived records answer 403 |
| 47 | `GET /compliance/employees/:id/summary` refused only employees, so any supervisor could read **anyone's** compliance summary | **Fixed** — a supervisor gets their own and their direct reports' only (*"Unauthorized. Not a direct subordinate."*), the same rule as the records list |
| 48 | A supervisor received a direct report's **personal record** — birth date, civil status, addresses, phones, personal email, emergency contacts, government IDs — from the profile, directory and subordinates endpoints, although no supervisor permission covers it | **Fixed** — supervisors get the work view (`EmployeeService.toTeamMemberView`, an allow-list); HR and the person keep the full record |
| 49 | A supervisor could read a direct report's record **timeline** (audit history) without any audit permission | **Fixed** — HR and the person only |
| 50 | The org chart gave a supervisor their whole branch, including login emails of people below their coordinators | **Fixed** — themselves and their direct reports |
| 51 | The profile screen showed **Archive** / **Restore** to supervisors on a direct report, and **Edit Profile** on their own record opened the HR form full of *"Managed by HR"* fields | **Fixed** — Employee Management is HR-only at the route; supervisors use My Team; everyone edits themselves through Edit My Profile. The API already refused archive, restore, account and edit calls (403) — re-tested |
| 52 | The schedule tab offered a supervisor **Set Weekly Schedule** on their own record, which the API refuses | **Fixed** — only on direct reports; never on My Profile |
| 53 | This reference said supervisors see a report's documents marked *visible to employee*; the code uses *visible to supervisor* | **Corrected** in §6.8 |
| 54 | `GET /attendance?employeeId=` with someone outside the caller's scope ignores the filter and returns the caller's own scope (their team) instead of refusing | **Open** — no data outside the team is returned (re-tested); screens only ask for people in scope |

### E.11 Found and fixed in the error-handling sweep (5 October 2026)

| # | Finding | Status |
|---|---|---|
| 55 | **A duplicate public application appeared to do nothing.** The API correctly refused it (409), and the form set its message — but drew it at the **top** of the form, about 1,000 px above the Submit button, without scrolling, focus or a live region | **Fixed** — the answer appears above the button, gets focus and is announced; *Application already submitted* with what to do next (§17.5) |
| 56 | The API sent its message in `error` while about 80 screens read `message`, so every specific reason (insufficient balance, weights not 100 %, duplicates) collapsed into a generic *"Failed to …"* | **Fixed** — the envelope carries both, and every screen uses `getApiErrorMessage` (§4.15) |
| 57 | Many lists, cards and panels showed *"No records yet"* or **0** when their request had **failed** (dashboards, announcements, applicants, job openings, compliance, medical, psychological, import history, employee picker, email history) | **Fixed** — a failed load says so, with Try Again; cards show — |
| 58 | Once an application was saved, a failure while recording its confirmation email made the applicant see an error **and deleted the résumé** the saved application points to | **Fixed** — the email is a side effect; the files are kept |
| 59 | A non-HR user opening someone else's medical or psychological record got 403, but 404 for a missing one — revealing which records exist | **Fixed** — both answer 404 *record not found* |
| 60 | The employee profile said *"Employee not found"* for any failure; the application status page said *"This status link is not valid"* for any failure; a closed job opening said *"no longer accepting applications"* when offline | **Fixed** — only a 404 says not found; other failures say what happened, with Try Again |
| 61 | Saving an announcement **draft** with an attachment that failed to upload reported *"saved as draft"*; creating a medical/psychological record whose document failed showed an error **and** a success toast | **Fixed** — one warning naming what was not attached |
| 62 | No request timeout, no page-level error boundary (a render error blanked the screen) and no "Page not found" page | **Fixed** (§4.15) |
| 63 | The public application accepted any text as a mobile number (e.g. *"ewqeqwe"*) | **Fixed** — a loose phone-number check on both sides; existing records were not changed |
| 64 | `alert()` pop-ups and silent `.catch(() => {})` handlers in Recruitment, Employees, Attendance and Leave | **Fixed** — toasts and visible errors; a few deliberate silent catches remain, each commented (browser storage unavailable, sign-out, a background mark-as-read) |
| 65 | `RecruitmentError` subclasses for email failures declare status 500 but are not used anywhere | **Open** — harmless; a 500 is always reported as unexpected |

### E.12 Found while updating this reference (10 October 2026)

| # | Finding | Status |
|---|---|---|
| 66 | **A job opening for an organisation-wide role cannot be saved.** For a job role with no unit (such as Sister's), the job-opening form asks HR to choose the unit (§17.3), but the API compares the role's unit (none) with the chosen unit and refuses with *"Job Role does not belong to the specified Unit"* (`JobOpeningService.validateOrgStructure`) | **Open** — found by reading the code, not reproduced in the running app |
