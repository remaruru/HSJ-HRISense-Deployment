# HSJ HRISense — Post-QA Repair Report

**Date**: 2026-09-02
**Repository**: `C:\xampp\htdocs\HRISense`
**Branch**: `main` — HEAD unchanged at `7648345b4c08ec74387ee2b8f67136395c5549b8`
**Trigger**: four runtime issues found by the user during manual testing after the fix-all pass
**Git operations performed**: none

---

## 1. Welcome email recipient behaviour

**Before.** The welcome email was addressed to `accountEmail` — the login address,
resolved as `workEmail || personalEmail`. In practice that meant a brand-new hire was
emailed at a hospital mailbox that may not exist yet on their first day.

**After.** The credential email is addressed to the employee's **personal email**.
The login ID is unchanged: the message states the login ID separately from the address
it was sent to, so the two can differ without confusing anyone.

Resolution order, in `EmployeeController.create`:

1. `employee.personalEmail` (trimmed) — the authoritative recipient;
2. `accountEmail` only when no personal email was recorded — still the same
   employee's own address.

It never falls back to an HR mailbox, a generated address, or anyone else's email.
When the fallback is used, HR is told so in the onboarding warnings.

**Test-redirect removed.** `BrevoTransactionalEmailProvider` previously re-addressed
every transactional message to `TEST_EMAIL_RECIPIENT` when that variable was set.
That switch has been deleted, and the variable removed from `.env.example`. Every
message through this provider carries a password or a reset link; redirecting one
means HRISense reports "sent" to HR while the employee receives nothing and the
password lands in someone else's inbox. Applicant recruitment email is a separate
provider, carries no credentials, and keeps its own configuration.

**Email content.** The welcome message now contains: employee name, employee number,
login ID, temporary password, an explicit instruction to change the password at first
sign-in, the HRISense sign-in link when `CLIENT_URL` is configured, and a short
security reminder not to share credentials. The same login link and reminder were
added to the HR-initiated reset message, which now also delivers to the personal
email when one is on file.

**Honesty.** `emailSent` is `true` only when the provider confirms success.
`emailRecipient` is returned alongside it, and the onboarding success screen shows the
address that was actually used. On failure the employee and account still exist and
the screen says the credentials were not delivered.

**Files**: `apps/api/src/services/email/brevo-transactional.provider.ts`,
`apps/api/src/services/email/employee-email.service.ts`,
`apps/api/src/controllers/employee.controller.ts`,
`apps/api/src/controllers/account.controller.ts`, `apps/api/.env.example`,
`apps/web/src/pages/Employees/EmployeeOnboardingPage.tsx`.

### Configuration needed before the email will actually leave the server

This repair makes the delivery correct; it does not switch delivery on. The local
`apps/api/.env` currently has **no** `ENABLE_TRANSACTIONAL_EMAILS` entry and no
`DEFAULT_FROM_EMAIL`, so `transactionalEmailEnabled()` returns false in development and
every send is simulated. That is why the success screen said delivery was switched off.
To send for real, add to `apps/api/.env` (variable names only — no values are recorded
in this repository):

```
ENABLE_TRANSACTIONAL_EMAILS=true
DEFAULT_FROM_NAME=HRISense
DEFAULT_FROM_EMAIL=<a sender address verified in your Brevo account>
```

`BREVO_API_KEY` is already present. The from-address must be verified in Brevo or the
send is rejected by the provider. **No live email was sent during this repair.**

---

## 2. `personalEmail` implementation

| Layer | Change |
|---|---|
| Onboarding form | **Personal Email** is now a required field, labelled `Personal Email *`, with the helper text "The welcome email with the temporary password is sent here." |
| Step guard | Moving off the Contact & Address step now checks work email, personal email, mobile number and present address, and names anything missing. Previously the `required` attributes were decorative — the wizard advanced regardless and the server rejected the submission at the very end. |
| Review step | The welcome-email preview shows the personal email as the recipient, and lists employee number, login ID, the change-at-first-sign-in instruction and the security reminder. |
| Persistence | `Employee.personalEmail` was already stored by `EmployeeService.create`; no schema change was needed. |
| Reset path | HR-initiated `Reset & send new credentials` also delivers to the personal email when one is on file. |

---

## 3. PDF root cause

`handleDownloadPDF` called `html2pdf().set(opt).from(credentialsRef.current).save()`.

`html2pdf.js` runs `html2canvas`, which **clones the target element into a temporary
full-screen container appended to the document** in order to rasterise it. Two
consequences, both present here:

1. `.save()` returns a promise that nothing awaited and nothing caught. Any failure
   inside the clone or rasterise step rejected silently.
2. When that happens, html2canvas never reaches its cleanup, so the temporary
   container stays in the DOM — a fixed-position, full-viewport, high-z-index layer
   over the page.

That layer is what made the UI unusable: **Copy Credentials**, **Download PDF** and
**Go to Directory** were still rendered and still enabled, but every click landed on
the leftover overlay instead of the button. There was no error message because the
rejection was never observed.

---

## 4. PDF fix

The rasterising approach was replaced with direct PDF generation using **jsPDF**
(already present as a transitive dependency of `html2pdf.js`; it is now a declared
dependency and `html2pdf.js` has been removed from `apps/web/package.json`).

The document is written with jsPDF's text API. Nothing is cloned, no canvas is used,
and no element is appended to the page — so there is no overlay that can be left
behind, and no dependency on how the success card happens to be styled.

Contents, exactly as specified:

- `HSJ HRISense` heading and the subtitle "Employee Login Credentials"
- Employee Name
- Employee Number
- Login ID
- Temporary Password
- "Change this password on first login."
- a short note to keep the sheet secure

Nothing else about the employee appears. Filename:
`HRISense_Credentials_HSJ-0016.pdf`, using the real generated employee number.

**Password handling is unchanged**: the plaintext password is never written to the
database, never logged, and no PDF is stored on the server. The document is built and
downloaded entirely in the browser.

---

## 5. PDF UI cleanup behaviour

- The handler is `async` and wrapped in `try` / `catch` / `finally`.
- `isGeneratingPdf` is set true at the start and reset in `finally`, so it is cleared
  whether generation succeeds or throws.
- While generating, the button shows "Preparing PDF..." with a spinner and is disabled.
  The other two buttons stay enabled throughout.
- On failure, a toast appears — "The credential PDF could not be generated. Use Copy
  Credentials instead." — and the UI returns to normal.
- Nothing is left behind: no overlay, no modal backdrop, no `pointer-events: none`, no
  disabled body, no cloned node, no focus trap, no stuck loading state, no unobserved
  promise rejection.

After a download, **Copy Credentials**, **Download PDF** and **Go to Directory** all
remain clickable.

---

## 6. Document crash root cause

The Documents tab rendered `employee.documents`, taken from `GET /employees/:id`.

Every `documents` include in `EmployeeService` — `getById` among them — is
`documents: { select: { id: true } }`. It exists so profile completion can count how
many documents are on file. **It returns the id and nothing else.**

So for every document, `category`, `originalFilename`, `mimeType`, `sizeBytes`,
`uploadedAt` and both visibility flags were `undefined`. Calling
`doc.category.replace(/_/g, ' ')` on `undefined` threw and took the whole profile page
down.

This was never specific to newly onboarded employees. It would have crashed for **any**
employee with at least one document. It surfaced now because the employee the user
created was the first one carrying documents.

---

## 7. Exact undefined field

`doc.category` — at `apps/web/src/pages/Employees/EmployeeDetailPage.tsx:397`
(pre-repair line numbering):

```tsx
<p className="text-xs text-muted-foreground">{doc.category.replace(/_/g, ' ')}</p>
```

`category` is `DocumentCategory` and non-nullable in the database. It was undefined in
the browser purely because the API never sent it.

---

## 8. Backend document contract fix

The id-only include was **kept** and documented, because widening it would have been
the wrong fix: `getById` applies no per-document visibility filtering, so returning
full metadata there would hand a supervisor — or the employee themselves — details of
documents they are not allowed to see.

Instead the profile now loads documents from `GET /employees/:employeeId/documents`,
which already applies the correct rules:

- `STANDARD` — own record only, and only documents marked visible to the employee;
- `SUPERVISOR` — own record, or a direct report's documents marked visible to
  supervisors;
- `FULL` — everything;
- soft-deleted documents excluded, newest first.

Related backend corrections:

| Change | Reason |
|---|---|
| `documents: { where: { deletedAt: null }, select: { id: true } }` (9 call sites) | Soft-deleted documents were still counted towards profile completion |
| `getById` now returns `missingFields` | The profile rendered `employee.missingFields`, which the API never sent, so the "Missing:" hint was permanently empty |
| `getById` user select widened to `mustChangePassword`, `lockedUntil`, `lastLoginAt`, `createdAt` | Account Management read these; with only `{id, email, isActive}` it always showed "Never" for last sign-in, never showed a lock, and mis-stated the forced-password-change state. No credential material is selected. |

Every document created during onboarding already satisfies the full
`EmployeeDocument` contract — `employeeId`, `category`, `originalFilename`,
`storedFilename`, `mimeType`, `sizeBytes`, both visibility flags, `notes`,
`uploadedById` and `uploadedAt` are all written inside the creation transaction. The
onboarding category mapping is unchanged and correct: Resume → `RESUME`,
Employment Contract → `EMPLOYMENT_CONTRACT`, Government IDs → `GOVERNMENT_ID`,
Other Documents → `OTHER`, profile photo → `OTHER` with an explanatory note. **No
partial document rows are written.**

---

## 9. Frontend null-safety fix

An `EmployeeDocument` interface was added to the profile page with optional
metadata fields, and rendering goes through safe formatters:

| Helper | Behaviour |
|---|---|
| `formatDocumentCategory` | `undefined` → "Uncategorised"; otherwise `GOVERNMENT_ID` → "Government Id" |
| `formatFileSize` | Non-numeric or negative → empty string; otherwise B / KB / MB |
| `formatFileType` | Known MIME → PDF/JPG/PNG/WEBP/DOC/DOCX; otherwise the file extension; otherwise empty |
| `formatUploadedAt` | Missing or unparseable → empty string, never "Invalid Date" |
| `formatEnumLabel` | `undefined` → "Not provided"; otherwise `ON_LEAVE` → "On Leave" |
| `formatDate` | Missing or unparseable → "Not provided" |

Required fields are fixed at the source rather than hidden: the fix for `category`
was to send it, not to guard it. The guards exist for genuinely optional data and for
rows that predate a contract.

**Two further defects found and fixed while tracing this one:**

1. The document link was a plain
   `<a href="http://localhost:5000/api/v1/documents/${doc.id}/download">`. The download
   route requires a bearer token, which an anchor cannot send, so every download would
   have returned 401 — and the URL was hardcoded to `localhost:5000`. It now uses
   `downloadProtectedFile` / `openProtectedFile` through the API client, with separate
   **Preview** (PDF and images) and **Download** actions and a per-document busy state.
2. `useProtectedImageUrl` read `localStorage.getItem('accessToken')` directly. With
   "Keep me signed in" unticked — the default — the token lives in `sessionStorage`, so
   employee photos never loaded. It now reads through `tokenStorage.getAccessToken()`.

---

## 9b. Other profile tabs audited for the same class of defect

Every tab of a newly created employee's profile was checked for value-formatting and
contract mismatches:

| Tab | Finding | Action |
|---|---|---|
| Overview | Raw enum shown for Status | Formatted; every value falls back to "Not provided" |
| Personal | `new Date(...).toLocaleDateString()` on possibly-missing dates | Uses `formatDate` |
| Contact | Showed `homePhone` labelled "Telephone Number"; onboarding collects `telephoneNumber`, so it was always empty | Shows `telephoneNumber`, falling back to `homePhone` |
| Employment | Rendered `employee.employmentType`, which does not exist on the model — permanently blank. Probation Date was hardcoded to "N/A" | Shows Employment Status and Current State; Probation Date shows the stored `probationDate` |
| Header badges | Compared `jobRole.permissionTier === 'HR'`; the stored tiers are FULL / SUPERVISOR / STANDARD, so the badge never appeared | Compares `'FULL'` and renders "HR Personnel" |
| Government, Emergency | Bare values | "Not provided" fallbacks |
| Timeline | `log.action.replace(...)` and raw date | Safe formatters |
| Schedule, Attendance, Compliance, Leave Balances, Evaluations, Training, Medical, Psychological | Each loads its own data and renders its own empty state; the enum fields they format are non-nullable in the database and their lists are empty for a new employee | No defect found |
| Account Management | Read account fields the API did not send | Fixed in §8 |

One unrelated latent crash was found and fixed in the same sweep: `OrgChartPage`
called `useMemo` **after** an early `return` used as a supervisor-cycle guard. React
would render a different number of hooks for a cyclic node and throw. The badge is now
computed without a hook. `oxlint` reported this as a `rules-of-hooks` error; it now
reports none.

---

## 10. Weekly Schedule modal redesign

`Configure Weekly Schedule` was rebuilt as a guided, numbered workflow.

| Aspect | Before | After |
|---|---|---|
| Width | `max-w-2xl` (≈672px) | `max-w-[820px]`, full-width below the small breakpoint |
| Height | `max-h-[90vh]` | `max-h-[88vh]`, header and footer fixed, body scrolls |
| Header | Title and one line of subtext | Title, subtext, **Employee** name, **Effective from** date, and a close control |
| Sections | Four unnumbered blocks | **1. Schedule Start Date · 2. Regular Shift · 3. Rest Day(s) · 4. Weekly Preview**, each with a heading and a plain-language helper line |
| Shift selector | `Name (8:00 AM – 5:00 PM)` in a bare select | `Name — 8:00 AM – 5:00 PM (next day)` in a card, with the chosen shift echoed underneath |
| Multiple shifts | "Add Another Shift" always visible | Each shift is a card with its own **Remove**; the add action appears only when every existing row has a shift chosen |
| Rest days | Small chips reading Mon…Sun with a tick | Seven large day cards, each labelled **Rest day** or **Working** in words as well as colour, `aria-pressed`, 4 columns on mobile and 7 on tablet upward |
| Weekly preview | Seven stacked rows | A 7-column grid on desktop, 2 on tablet, 1 on mobile; each day reads **Working** with the shift name and hours, **Rest Day**, or **Needs Setup** |
| Customise | Inline panel opening between rows | One panel below the grid, with the open day ring-highlighted, plus a route back to a working day for a rest day |
| Validation | Errors appeared only on save, as toasts | A live problem list — e.g. "3 working days still need a shift (Wed, Thu, Fri)." — computed from the same rules as save |
| Save | Disabled only when the date was empty | Disabled only when the configuration is genuinely invalid, with the reason printed under the button and repeated in its tooltip |
| Footer | Inside a scrolling column | Sticky within the dialog; Cancel and Save always visible |
| Accessibility | — | `role="dialog"`, `aria-modal`, `aria-labelledby`, labels bound to every control, visible focus rings, large targets, state never signalled by colour alone |

The overlap check was extracted to a shared `findOverlap`, used by both the live
problem list and `handleSave`, so the modal can never report "ready to save" and then
refuse the identical configuration.

---

## 11. Was schedule functionality changed?

**No.** This was a presentation change only. Effective dating, shift selection,
multiple shifts per day, rest-day selection, per-day customisation, the
UNCONFIGURED / DAY_OFF / WORKING three-state model, the weekly preview, the overlap
rule, the save payload and the schedule history are all unchanged. `handleSave` builds
exactly the same `days` array and calls the same
`weeklyScheduleApi.saveEmployeeWeeklySchedule`. No business rule was added, removed or
relaxed; the validation now runs earlier as well as at save.

---

## 12–21. Help Center counts

| # | Measure | Value |
|---|---|---|
| 12 | Registry entries **before** this pass | **39** (13 READY, 26 METADATA_ONLY, 0 DRAFT, 10 categories) |
| 13 | Registry entries **after** | **79** |
| 14 | READY after | **79** |
| 15 | METADATA_ONLY after | **0** |
| 16 | DRAFT after | **0** |
| 17 | Guides readable by HR Personnel | **75** |
| 18 | Guides readable by Supervisor | **34** |
| 19 | Guides readable by Employee | **27** |
| 20 | Guides tagged PUBLIC | **3** |
| 21 | Categories after | **17** (was 10) |

Counts are produced by `npx tsx apps/web/scripts/validate-help-registry.ts`, not typed
by hand. Role columns overlap by design: a guide readable by all three internal tiers
is counted in all three rows.

New categories: `PUBLIC_RECRUITMENT` (Careers & Applications), `NOTIFICATIONS`,
`AUDIT` (Activity History), `AI_ASSISTANCE`, `REPORTS`, `SETTINGS`, `HELP`.

---

## 22. New guides added

**40 new entries**, and every one of the 26 previously METADATA_ONLY entries was
authored to READY. Broken down by area:

- **Authentication (+4)** — Keep Me Signed In, First-Time Password Change, Forgot
  Password, Reset Password (Sign In, Change Password and Sign Out were rewritten).
- **Employees (+2)** — Reset & Send New Credentials, Edit/Replace/Remove a Document.
- **Recruitment (+5)** — Publish/Close/Fill/Archive, Applicant Documents, Schedule
  Interview, Applicant Communications, Convert Hired Applicant.
- **Careers, public (+3)** — Browse Careers, Submit an Application, Check Application
  Status.
- **Attendance (+3)** — Export Attendance, Check Your Own Attendance, Where Attendance
  Data Comes From.
- **Leave (+5)** — Check Your Requests, Cancel a Request, Read Your Balances, Manage
  Balances, Supervisor Endorsement.
- **Evaluations (+2)** — Finalise a Submitted Evaluation, Read Your Own Evaluation.
- **Training (+2)** — Manage the Roster, Your Own Training History.
- **Compliance (+4)** — Needs Attention, Record and Review Compliance, Your Own
  Compliance Standing, Who Can See Health Records.
- **Announcements (+1)** — Choose the Audience.
- **Notifications (+2)**, **Audit (+1)**, **AI Assistance (+2)**, **Reports (+2)**,
  **Settings (+1)**, **Help Center (+1)**.

---

## 23. Existing guides updated

**All 39 previous entries.** The 13 that were READY were rewritten against the current
system; the most significant corrections:

| Guide | Correction |
|---|---|
| `AUTH_LOGIN` | Documents Keep me signed in, Forgot password? and the first-sign-in redirect |
| `EMPLOYEE_ONBOARD_NEW` | Personal Email is required and is the credential recipient; per-step validation; the honest email-delivery result on the success screen |
| `DASHBOARD_VIEW_HR` | Explains that a blank figure means no data rather than zero |
| `ATTENDANCE_DAILY_MONITORING` | "No Imported Rec." explicitly separated from absence |
| `ATTENDANCE_TALLY` | Same distinction applied to the Imported and No Record columns |
| `ATTENDANCE_WORK_SCHEDULE` | Rewritten for the redesigned modal, including the problem list and the disabled-save reason |
| `LEAVE_*` | Rewritten for the two-stage workflow; HR-only approval instructions removed |
| `RECRUITMENT_TRACK_APPLICANTS` | States that a stage change does not email the applicant, and that the HR Officer is the final authority |
| `EMPLOYEE_VIEW_PROFILE` | Current tab list, and the profile completion "Missing" list |
| `ANNOUNCEMENTS_*` | Audience preview, recipient snapshot and read statistics as implemented |

---

## 24. Contextual help links added

**10**, all page-level. `HelpLink` renders nothing when the guide does not exist or
the signed-in role may not read it, so it can never lead to a "not available" page.

| Page | Guide |
|---|---|
| Employee Onboarding | `onboard-new-employee` |
| Leave Requests | role-aware: `approve-reject-leave` / `endorse-leave-request` / `file-leave-request` |
| New Leave Request | `file-leave-request` |
| Work Schedule | `assign-work-schedules` |
| Daily Monitoring | `monitor-daily-attendance` |
| Compliance | `compliance-needs-attention` |
| Announcements | role-aware: `create-publish-announcement` / `read-announcements` |
| Applicant detail | `process-job-applicants` |
| AI Assistance | `use-ai-assistance` |
| Reports & Analytics | `generate-report` |

---

## 25–28. Screenshots and deferred items

| # | Item | Result |
|---|---|---|
| 25 | Screenshot assets created | **NO** — none captured, none fabricated, none referenced |
| 26 | Screenshot architecture preserved | **YES** — `HelpScreenshot`, `HelpScreenshotModal`, the zoom viewer and the metadata types are untouched; guides render cleanly with no broken image, blank frame or "coming soon" placeholder |
| 27 | Mustard Seedtime processing guide created | **NO** |
| 28 | Mustard Seedtime deferred state preserved | **YES** — the Import Attendance Excel window still says the official format has not been received and leaves **Process Import** disabled. `ATTENDANCE_IMPORT_STATUS` explains why without inventing a single column, sheet name, punch-pairing rule, lateness formula, half-day rule or night-shift calculation |

---

## 29–31. Files changed in this pass

| # | Area | Count | Files |
|---|---|---|---|
| 29 | API source | **5** | `services/email/brevo-transactional.provider.ts`, `services/email/employee-email.service.ts`, `services/employee.service.ts`, `controllers/employee.controller.ts`, `controllers/account.controller.ts` (plus `apps/api/.env.example`, configuration) |
| 30 | Web source | **21 modified, 12 created** | Modified: `package.json`, `hooks/useProtectedImageUrl.ts`, `pages/Employees/EmployeeOnboardingPage.tsx`, `pages/Employees/EmployeeDetailPage.tsx`, `pages/Employees/OrgChartPage.tsx`, `pages/Employees/components/EmployeeScheduleProfileTab.tsx`, `pages/HelpCenter/helpCenter.types.ts`, `helpCenter.registry.ts`, `helpCenter.search.ts`, `components/HelpCategoryCard.tsx`, `components/HelpRoleIndicator.tsx`, `components/HelpSearchBar.tsx`, `pages/AI/AIPage.tsx`, `pages/Announcements/AnnouncementsPage.tsx`, `pages/Attendance/DailyMonitoringPage.tsx`, `pages/Attendance/WorkSchedulePage.tsx`, `pages/Compliance/CompliancePage.tsx`, `pages/Leave/LeaveRequestsPage.tsx`, `pages/Leave/NewLeaveRequestPage.tsx`, `pages/Recruitment/ApplicantDetailPage.tsx`, `pages/Reports/ReportsPage.tsx`. Created: `components/common/HelpLink.tsx`, `scripts/validate-help-registry.ts`, and the ten `pages/HelpCenter/guides/*.guides.ts` files |
| 31 | Docs | **7** | `HELP_CENTER_FUNCTION_INVENTORY.md` (rebuilt), `HELP_CENTER_ARCHITECTURE.md` (rewritten), `HELP_CENTER_BROWSER_AUDIT.md` (status banner), `ANTIGRAVITY_DEVELOPMENT_PROGRESS.md`, `CLAUDE_FIX_ALL_PROGRESS.md`, `CLAUDE_FIX_ALL_EXECUTION_REPORT.md`, and this report |

Dependency change: `html2pdf.js` removed from `apps/web/package.json`, `jspdf ^4.2.1`
added (already present in `node_modules` as a transitive dependency, so no install was
required for the build).

---

## 32–41. Validation

| # | Check | Result |
|---|---|---|
| 32 | Prisma schema changed | **NO** |
| 33 | Migration created | **NO** — none was required |
| 34 | Browser automation performed | **NO** — no browser, Playwright, Cypress, click automation or screenshots |
| 35 | Live email sent during repair | **NO** |
| 36 | Git commit | **NO** |
| 37 | Git push | **NO** — no remote operation of any kind; HEAD is still `7648345b` |
| 38 | API build (`npm run build`, `tsc`) | **PASS** |
| 39 | Web build (`npm run build`, `tsc -b && vite build`) | **PASS** |
| 40 | `prisma validate` | **PASS** — "The schema at prisma\schema.prisma is valid" |
| 41 | `prisma migrate status` | **PASS** — MySQL reachable; 13 migrations found; "Database schema is up to date!" |

Also run: `npx tsc --noEmit` on both workspaces (clean); `oxlint` on the edited areas
(no errors — the one pre-existing `rules-of-hooks` error was fixed, see §9b);
`npx tsx apps/web/scripts/validate-help-registry.ts` (79 guides, 17 categories, 0
defects).

`prisma generate` could not complete: renaming the Windows query engine failed with
`EPERM` because the file is locked by a running Node process (the dev API server).
This is a file lock, not a schema problem — the existing client is current and the API
build passes against it. Re-run it after stopping the dev server if you want a fresh
client.

**No destructive database action was taken**: no `prisma db push`, no
`prisma migrate reset`, no `prisma migrate dev` against `hrisense_db`, no drop, no
seed. `migrate status` is read-only.

---

## 42. Known runtime issues remaining from the four reported bugs

**NONE.** All four are fixed at the root cause:

1. Welcome email now addressed to the employee's personal email, with honest reporting.
2. The credential PDF is generated directly, cannot leave an overlay behind, and resets
   its state in `finally`.
3. The Documents crash is fixed by sending real document metadata through the
   endpoint that enforces visibility, with null-safe rendering on top.
4. The Weekly Schedule modal is a guided, numbered, responsive, keyboard-friendly
   workflow with live validation and a sticky footer.

Four further defects found while tracing them were fixed in the same pass: the
unauthenticated document download link, profile photos not loading when "Keep me
signed in" was unticked, `employmentType` / `permissionTier === 'HR'` / Probation Date
/ Telephone Number contract mismatches on the profile, and the conditional `useMemo`
in the org chart.

Manual browser QA is still required — none of this has been exercised in a browser by
this pass, by design.

---

## 43. Remaining intentionally deferred feature

**Mustard Seedtime attendance import processing.** The official Hospicio de San Jose
attendance export format has not been supplied. Nothing about columns, sheet names,
punch pairing, biometric rules, lateness, half-days, night-shift handling or absence
derivation has been invented. The Import Attendance Excel window states this plainly
and keeps **Process Import** disabled.

**External input required**: one real sample export file.

---

## 44. Remaining Help Center work

**Screenshot asset capture only.**

Guide authoring is complete for every currently implemented user-facing function:
79 guides, all READY, across 17 categories, with role-aware branching, working search
keywords, verified related-guide links, contextual help on ten workflow pages, and
print support. No ordinary implemented function is left without a guide.

---

## Status

```
POST-QA REPAIRS IMPLEMENTED
HELP CENTER TEXTUAL AUTHORING COMPLETE
CONTEXTUAL HELP IMPLEMENTED
SCREENSHOT CAPTURE DEFERRED
MANUAL USER QA REQUIRED
```
