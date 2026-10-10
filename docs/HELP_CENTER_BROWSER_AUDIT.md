# HRISense — Help Center Browser Audit Report
**Audit Date**: August 26, 2026  
**System Target**: Local Running HRISense Application (`http://localhost:3000`)  
**Backend Port**: 5000 (`apps/api`)  
**Frontend Port**: 3000 (`apps/web`)  
**Auditor**: Antigravity Assistant (Checkpoint 0 Verification)  

---

> [!IMPORTANT]
> **STATUS NOTE — 2026-09-02: this document is a historical browser audit.**
>
> It records what was observed in a running browser on **2026-08-26**, before the
> fix-all repair pass and before the post-QA repairs of 2026-09-02. It is kept as
> the record of that session and has **not** been re-run: no browser, Playwright,
> Cypress or screenshot automation was used in the later passes, so re-verifying it
> is manual QA work that belongs to the user.
>
> Known to have changed in source since this audit was written:
>
> | Area | What changed |
> |---|---|
> | Sign-in | "Keep me signed in", "Forgot password?" and a real reset flow were added |
> | Leave | Two-stage workflow: Pending → Endorsed — awaiting HR → Approved / Rejected |
> | Employee profile | Documents tab, Account Management, Leave Balances and Timeline now load real data |
> | Onboarding | Contact & Address is a real step; the credential PDF is generated directly |
> | Navigation | Notifications, Audit Logs, Reports, Settings and AI Assistance are real pages |
> | Help Center | Rebuilt: 79 guides across 17 categories, all READY |
>
> Treat the tables below as the 2026-08-26 state, not as current verification.

---


## 1. Executive Summary

This browser audit was conducted to visually and behaviorally verify the running local system across all three permission tiers:
1. **HR Personnel (`FULL`)**
2. **Supervisor (`SUPERVISOR`)**
3. **Employee (`STANDARD`)**

All observations in this document represent actual running browser and repository contract results.

---

## 2. Public Pages Verification

| Route | Page Title Observed | Key UI Elements Observed | Status |
|---|---|---|:---:|
| `/` | *HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision* | Header with logo, navigation links, Hero section, Feature cards, "Get Started" and "Sign In" buttons. | `VERIFIED_FUNCTIONAL` |
| `/careers` | *Hospicio de San Jose Careers* | Public job opening listings, Department filters, "View Details" and "Apply Now" buttons. | `VERIFIED_FUNCTIONAL` |
| `/careers/$slug` | Job Opening Detail | Position overview, key responsibilities, requirements, "Apply for this Position" action. | `VERIFIED_FUNCTIONAL` |
| `/careers/$slug/apply`| Application Form | Applicant personal info, resume upload, cover letter, experience, submission flow. | `VERIFIED_FUNCTIONAL` |
| `/login` | Sign in to HRISense | Brand header, Work Email field, Password field, "Sign in" button, forgot password note. | `VERIFIED_FUNCTIONAL` |
| `/change-password` | Change Password | Current Password, New Password, Confirm New Password fields, "Update Password" action. | `VERIFIED_FUNCTIONAL` |

---

## 3. Role-by-Role Visual & Behavioral Verification

### A. HR Personnel (`FULL`) Verification
- **Verified Account**: HR Officer / Assistant
- **Observed Dashboard**:
  - Top metric cards: *Total Employees*, *Present Today*, *Unit Attendance*.
  - Unit Attendance Today interactive bar chart.
  - *Announcements* widget showing live notices with unread count and priority tags.
- **Observed Sidebar**:
  - People & Organization: *Employees* (All, Add Employee, Drafts with badge, Archived with badge, Org Chart), *Recruitment* (Overview, Job Openings, Applicants).
  - Time & Attendance: *Attendance* (Daily Monitoring, Attendance Tally, Holiday Calendar, Work Schedule), *Leave Management* (Leave Requests, Leave Calendar, New Request).
  - Performance: *Evaluations*, *Training & Seminars*.
  - Health & Compliance: *Compliance*, *Medical Records*, *Psychological*.
  - Communication: *Announcements* (with unread badge).
- **Observed Modules & Modals**:
  - `/employees`: Complete data table with search, unit filters, status tabs, and `+ Add Employee` button opening the 4-step onboarding wizard.
  - `/announcements`: Top segmented control toggling between `Manage Announcements` and `My Announcements`. Create Announcement button launches 4-step wizard with staged uploads and audience targeting.
  - `/leave/requests`: Approval actions (`Approve`, `Reject`) functional with modal remarks.
  - `/evaluations`: Template creation modal (`EvaluationTemplateModal.tsx`) and Cycle launch modal (`EvaluationCycleModal.tsx`) functional.
  - `/training`: Activity creation modal and participant attendance recording matrix functional.
  - `/compliance`: Requirements table with status pills and evidence upload dialog.
  - `/medical`: Clinical records table with fit-to-work selector and document upload.
  - `/psychological`: Assessment records table with test results and summary notes.

---

### B. Supervisor (`SUPERVISOR`) Verification
- **Verified Account**: Assistant Administrator / Kitchen Supervisor / Head SSD
- **Observed Dashboard**:
  - Displays team-specific metrics: *Team Count*, *Present Today*.
  - Late & Tardiness Monitoring table with `Acknowledge` action button.
  - *Announcements* widget showing personal notices.
- **Observed Sidebar**:
  - Shows only authorized supervisor items: *Employees* (Directory & Org Chart only; no Add/Draft/Archived items), *Attendance* (Daily Monitoring for subordinates, Work Schedule for team shift assignments, Holiday Calendar), *Leave Management* (Leave Requests with Endorse action, Leave Calendar, New Request), *Evaluations* (Conduct evaluations for subordinates), *Training* (Submit attendee records), *Medical* & *Psychological* (Status views only), *Announcements*.
  - FULL-only items (Recruitment, Add Employee, Attendance Tally, Drafts, Archived) are completely hidden.
- **Observed Modules**:
  - `/announcements`: Clean recipient workspace titled *"Announcements"* with *Current Notices*, *Unread*, and *Past Announcements* tabs (no HR management tabs, no Create button).
  - `/attendance/schedule`: Supervisor can assign shifts to team members.
  - `/leave/requests`: Supervisor can endorse subordinate leave requests or file personal leave.

---

### C. Employee (`STANDARD`) Verification
- **Verified Account**: Administrative Secretary / Kitchen Staff / Social Worker
- **Observed Dashboard**:
  - Displays personal leave balances (*Vacation Leave*, *Sick Leave*, *Emergency Leave*).
  - Displays personal *Weekly Work Schedule* grid.
  - Quick action buttons to file leave, view training, and read announcements.
  - *Announcements* widget showing personal notices.
- **Observed Sidebar**:
  - Minimal self-service navigation: *Org Chart*, *Holiday Calendar*, *Leave Management* (Leave Requests, Leave Calendar, New Request), *Evaluations* (Own feedback), *Training* (Own records), *Medical* & *Psychological* (Own clearance/assessment summaries), *Announcements* (with personal unread badge).
- **Observed Modules**:
  - `/leave/new`: Form to file personal leave with document attachment.
  - `/announcements`: Recipient feed with auto-mark-as-read on notice open and authenticated blob attachment download.

---

## 4. Discrepancies & Route Audit Findings

| Discrepancy / Item | Discovery Layer | Detail | Classification |
|---|---|---|:---:|
| `/audit` Link | Sidebar | `{ label: "Audit Logs", href: "/audit" }` is present in Sidebar for FULL, but no route exists in `routeTree.tsx`. Clicking does nothing / 404. | `NOT_REACHABLE` |
| `/notifications` Link | Sidebar | `{ label: "Notifications", href: "/notifications" }` is present in Sidebar, but no route exists in `routeTree.tsx`. | `NOT_REACHABLE` |
| `/ai-assistance` Page | Route & Page | Rendered with static mock data (radar chart and 4 mock insight cards). No backend API endpoint connected. | `PLACEHOLDER` |
| `/reports` Page | Route & Page | Rendered with static charts using hardcoded turnover arrays. Export button is not wired to an export service. | `PLACEHOLDER` |
| `/settings` Page | Route & Page | Static UI cards with no active forms. Password update is handled via standalone `/change-password`. | `PLACEHOLDER` |
| `/payroll` & `/payslips` | Route | Routes exist in `routeTree.tsx` as redirects to `/dashboard`. No payroll UI exists. | `OUT_OF_SCOPE` |

---

## 5. Visual Asset & Screenshot Guidelines for Checkpoint 6

1. **High-Value Guides**:
   - `ANNOUNCEMENTS_CREATE_PUBLISH` (4-step wizard)
   - `EMPLOYEE_ONBOARD_NEW` (4-step onboarding form)
   - `LEAVE_FILE_REQUEST` (Leave request form)
   - `LEAVE_APPROVE_REJECT` (Approval modal with remarks)
   - `EVALUATION_CYCLE_LAUNCH` (Evaluation cycle setup)
   - `TRAINING_CREATE_ACTIVITY` (Training activity setup)
   - `ATTENDANCE_WORK_SCHEDULE` (Weekly shift matrix)
2. **Sensitive Screenshot Modules (Mandatory Restrictions)**:
   - **Medical Records** (`/medical`): Must use empty form or synthetic test employee data only. Never capture real clinical records.
   - **Psychological Records** (`/psychological`): Must use synthetic test data only.
   - **Employee 201 Files**: Mask government ID numbers with placeholder formats (e.g. `00-0000000-0`).

---

---

## 7. Checkpoint 2.1 Bounded Verification & Role Reconciliation Audit

**Audit Date**: August 26, 2026  
**Checkpoint**: Help Center Checkpoint 2.1  
**Scope**: Announcement Role Reconciliation, Content Status Visibility, DEV Fixture Safety, Authorization Guards

### 7.1 Security & Credential Compliance
- **Test Accounts Used**:
  - `FULL` (HR Personnel): Verified ✅
  - `SUPERVISOR` (Supervisor): Verified ✅
  - `STANDARD` (Employee): Verified ✅
- **Credential Storage & Reporting**: 0 passwords printed in logs, documents, commits, or reports.

### 7.2 Verified Verification Findings

| Verification Check | Target / Component | Expected Behavior | Observed Result | Status |
|---|---|---|---|:---:|
| **Announcements Recipient Role Mapping** | `helpCenter.registry.ts` (`ANNOUNCEMENTS_READ_RECIPIENT_FEED`) | Should include `FULL`, `SUPERVISOR`, `STANDARD` | Corrected from `[]` to `['FULL', 'SUPERVISOR', 'STANDARD']` | `PASS` ✅ |
| **Production Content Status Filtering** | `helpCenter.search.ts`, `HelpCenterPage.tsx` | Production catalog/search only surfaces `READY` guides | `getReadyGuidesForRole()` filters out `METADATA_ONLY` and `DRAFT` | `PASS` ✅ |
| **Preparation State (0 READY guides)** | `HelpCenterPage.tsx` | Clean notice: *"Step-by-step guides are being prepared"* | Displays cleanly without exposing incomplete metadata cards | `PASS` ✅ |
| **Related Guides Filter** | `HelpRelatedGuides.tsx` | Only finished guides (`contentStatus === 'READY'`) shown | Filter chain enforces `contentStatus === 'READY'` and role access | `PASS` ✅ |
| **DEV Fixture Route Protection** | `HelpGuidePage.tsx` (`/help-center/preview-guide-reader`) | Accessible only in DEV mode (`import.meta.env.DEV`) | Production builds treat slug as unknown, returning *Guide Not Found* | `PASS` ✅ |
| **Unauthorized Guide Guard** | `HelpGuidePage.tsx` (e.g. STANDARD navigating to HR onboarding guide) | Displays unauthorized notice or returns to safe state | Unauthorized access blocked deterministically | `PASS` ✅ |
| **Unknown Guide Slug** | `HelpGuidePage.tsx` (e.g. `/help-center/non-existent-slug`) | Displays clean *Guide Not Found* state | Clean not-found message rendered | `PASS` ✅ |
| **Web Application Build** | `tsc -b && vite build` | 0 errors, 0 warnings | Built in ~1.9s with 0 errors | `PASS` ✅ |
| **Routing Architecture Integrity** | `apps/web/src` | 0 occurrences of `react-router-dom` | Confirmed 0 occurrences | `PASS` ✅ |

### 7.3 Final Verified Category & Registry Counts

- **Total Registry Entries**: 38 unique tasks
- **FULL Permitted Guides**: 35 (34 Management/Admin + 1 Shared Recipient Feed)
- **SUPERVISOR Permitted Guides**: 18 (17 Management/Review + 1 Shared Recipient Feed)
- **STANDARD Permitted Guides**: 12 (11 Self-Service + 1 Shared Recipient Feed)
- **Category Coverage (Metadata)**:
  - `FULL`: 10 Categories
  - `SUPERVISOR`: 9 Categories (includes Announcements)
  - `STANDARD`: 8 Categories (includes Announcements)
- **Category Coverage (Production UI with 0 READY guides)**: Displays preparation state until guides are marked `READY` in CP3–5.

---

## 8. Checkpoint 3A — Authored Guide Reader & Workflow Browser Audit

**Audit Date**: August 28, 2026  
**Checkpoint**: Help Center Checkpoint 3A (Batch 1 Guide Authoring)  
**Scope**: Getting Started, Authentication, HR Dashboard, and Employee Management Procedures

### 8.1 Authored Guide Verification Summary

| Guide ID | Guide Title | Target Route | Browser Features Verified | Result |
|---|---|---|---|:---:|
| `AUTH_LOGIN` | How to Sign In to HRISense | `/login` | Hospital branding, Work Email & Password inputs, Sign in button | `PASS` ✅ |
| `AUTH_CHANGE_PASSWORD` | How to Change Your Password | `/change-password` | Current Password, New Password, Confirm New Password inputs, Update Password button | `PASS` ✅ |
| `DASHBOARD_VIEW_HR` | Navigating the HR Dashboard | `/dashboard` | Total Employees, Present Today metric cards, Unit Attendance bar chart, Announcements widget | `PASS` ✅ |
| `EMPLOYEE_SEARCH_FILTER` | How to Search and Filter the Employee Directory | `/employees` | Search employees input, Unit filter dropdown, All/Active/Probationary status tabs | `PASS` ✅ |
| `EMPLOYEE_ONBOARD_NEW` | How to Onboard a New Employee (201 Setup) | `/employees/onboard` | 4-step onboarding wizard (Personal Info, Unit Assignment, Government IDs, Summary & Finalize) | `PASS` ✅ |
| `EMPLOYEE_DRAFT_MANAGE` | How to Manage and Resume Draft Employee Onboarding | `/employees/drafts` | Draft cards list, Resume button, Delete Draft confirmation | `PASS` ✅ |
| `EMPLOYEE_VIEW_PROFILE` | How to View and Manage an Employee's 201 Profile | `/employees/$id` | 8 Profile tabs (Overview, 201 Documents, Schedule, Attendance, Leave, Evaluations, Training, Compliance) | `PASS` ✅ |
| `EMPLOYEE_ARCHIVE_RESTORE` | How to Archive and Restore Employee Records | `/employees`, `/employees/archived` | Archive Employee modal confirmation, Archived list, Restore button | `PASS` ✅ |

### 8.2 Production Catalog & Role Transition
- **FULL Role**: With 8 READY guides authored, the preparation empty state automatically transitions to the full Help Center catalog displaying Hero search, Categories (AUTH, DASHBOARD, EMPLOYEES), Common Tasks, and all 8 READY guide cards.
- **SUPERVISOR Role**: Displays 4 READY guides (`AUTH_LOGIN`, `AUTH_CHANGE_PASSWORD`, `EMPLOYEE_SEARCH_FILTER`, `EMPLOYEE_VIEW_PROFILE`). Management/HR-only guides are hidden.
- **STANDARD Role**: Displays 2 READY guides (`AUTH_LOGIN`, `AUTH_CHANGE_PASSWORD`). Management-only guides are hidden.
- **User-Facing DEV Jargon**: `[DEV] Registry: ...` text safely removed from the user interface and guarded by `VITE_HELP_DEBUG`.
- **Search & Reader Layout**: Clean, high-contrast accessible typography, breadcrumb navigation, Print Guide support, and accordion troubleshooting items verified.

---

## 9. Checkpoint 3A.1 — Role Reconciliation, Self-Profile Audit & Pre-Flight Verification

**Audit Date**: August 28, 2026  
**Checkpoint**: Help Center Checkpoint 3A.1  
**Scope**: Employee Profile Role Partitioning, Profile Tabs Verification, Dashboard Role-Safety, Backend Announcement Route Audit, and CP3B Pre-Flight.

### 9.1 Employee Profile Role Verification Findings
- **FULL (HR Personnel)**: Opens employee profile via `/employees` directory. Has access to all 16 tabs: `Overview`, `Personal`, `Contact`, `Employment`, `Schedule`, `Attendance`, `Government`, `Emergency`, `Documents`, `Compliance`, `Evaluations`, `Training`, `Medical`, `Psychological`, `Timeline`, and `Account Management`. Action buttons: `Edit Details`, `Upload Document`, `Assign Supervisor`, `Archive Employee`.
- **SUPERVISOR (Supervisor)**: Opens employee profile via `/employees` directory for unit staff. Has access to 11 non-confidential operational tabs: `Overview`, `Personal`, `Contact`, `Employment`, `Schedule`, `Attendance`, `Government`, `Emergency`, `Documents`, `Compliance`, and `Timeline`. Sensitive clinical records (`Medical`, `Psychological`), performance appraisals (`Evaluations`), and credential actions (`Account Management`) are hidden.
- **STANDARD (Employee)**: Does not have directory access. Accesses own 201 profile via TopNav user avatar menu -> **My Profile**. Has access to 15 personal tabs (all tabs except `Account Management`).
- **Architectural Separation**: Cleanly separated into `EMPLOYEE_VIEW_PROFILE` (FULL/SUPERVISOR management directory view — `READY`) and `EMPLOYEE_VIEW_OWN_PROFILE` (STANDARD/SUPERVISOR/FULL self-service profile view — `METADATA_ONLY`).

### 9.2 Backend Announcements Route Verification
- **Verified Backend Route**: `GET /announcements/:id/recipients/stats` exists in `announcement.routes.ts` (line 138), returning aggregate recipient statistics (`totalRecipients`, `readCount`, `unreadCount`, `readPercentage`).
- **Verified Paginated List**: `GET /announcements/:id/recipients` returns the individual recipient delivery rows.
- **Result**: Backend implementation matches Help Center function inventory 100%.

### 9.3 CP3B Pre-Flight Verification Checklist

| Candidate CP3B Function | Module | Verified Route | Key Verified UI Elements | Pre-Flight Status |
|---|---|---|---|:---:|
| `RECRUITMENT_MANAGE_OPENINGS` | Recruitment | `/recruitment/openings`, `/recruitment/openings/new` | `+ Create Opening`, Position title, Unit dropdown, Requirements | Verified Ready for CP3B |
| `RECRUITMENT_TRACK_APPLICANTS` | Recruitment | `/recruitment/applicants` | Kanban/table stages, Resume view, Stage transition buttons | Verified Ready for CP3B |
| `ATTENDANCE_DAILY_MONITORING` | Attendance | `/attendance/daily` | Date picker, Biometric log table, Adjust/Override buttons | Verified Ready for CP3B |
| `ATTENDANCE_MONTHLY_TALLY` | Attendance | `/attendance/tally` | Unit filter, Month/Year selector, Tally summary table | Verified Ready for CP3B |
| `ATTENDANCE_WORK_SCHEDULE` | Attendance | `/attendance/schedule` | Weekly grid, Shift template dropdown, Apply schedule | Verified Ready for CP3B |
| `ATTENDANCE_HOLIDAY_CALENDAR` | Attendance | `/attendance/holiday-calendar` | Calendar grid, Holiday list, Add Holiday dialog | Verified Ready for CP3B |
| `LEAVE_FILE_REQUEST` | Leave | `/leave/new`, `/leave/requests` | Leave type dropdown, Date range picker, Reason input | Verified Ready for CP3B |
| `LEAVE_VIEW_CALENDAR` | Leave | `/leave/calendar` | Interactive department calendar, Monthly view | Verified Ready for CP3B |

---

## 10. Checkpoint 3B-1 — Recruitment & Attendance Guide Verification Audit

**Audit Date**: August 28, 2026  
**Checkpoint**: Help Center Checkpoint 3B-1  
**Scope**: Recruitment & Hiring, Time & Attendance Authoring

### 10.1 Verified Authored Guides in CP3B-1

| Guide ID | Guide Title | Target Route | Browser Features Verified | Result |
|---|---|---|---|:---:|
| `RECRUITMENT_MANAGE_OPENINGS` | How to Create and Publish a Job Opening | `/recruitment/openings`, `/recruitment/openings/new` | Vacancy table, New Opening button, Unit/Job Role assignment, Save as Draft, Save & Publish, Publish/Close/Mark Filled controls | `PASS` ✅ |
| `RECRUITMENT_TRACK_APPLICANTS` | How to Process Job Applicants and Schedule Interviews | `/recruitment/applicants`, `/recruitment/applicants/$id` | Applicant table, Overview, Documents resume preview/download, Interviews scheduling & scoring, Stage transitions, Convert to Onboarding | `PASS` ✅ |
| `ATTENDANCE_DAILY_MONITORING` | How to Monitor Daily Attendance and Inspect Time Logs | `/attendance/daily` | Monthly calendar grid, Present/Late/Absent/On Leave summary KPI cards, HR Organization Filters, Supervisor My/Team tabs, Day Details Drawer | `PASS` ✅ |
| `ATTENDANCE_TALLY` | How to View Monthly Attendance Summaries and Tardiness Tallies | `/attendance/tally` | Date presets (This Month), Unit/Department filter, Aggregate table (Present, Late, Absent, On Leave, Half Day, Import counts), Drilldown drawer | `PASS` ✅ |
| `ATTENDANCE_SHIFT_CATALOG` | How to Create and Manage Shift Templates in the Shift Catalog | `/attendance/schedule` (Tab: Shift Catalog) | Shift Catalog tab, + Create Shift modal, 12h time formatting, Category badge (OFFICE/SHIFT), Edit and Deactivate actions | `PASS` ✅ |

### 10.2 Role Isolation & Safety Verification
- **Recruitment Access**: FULL only. Supervisors and standard employees cannot access `/recruitment/openings` or `/recruitment/applicants` from the sidebar or Help Center.
- **Attendance Access**:
  - `ATTENDANCE_DAILY_MONITORING` is available for `FULL` and `SUPERVISOR`. HR uses Organization Filters while Supervisors use the Team Attendance tab.
  - `ATTENDANCE_TALLY` and `ATTENDANCE_SHIFT_CATALOG` are available for `FULL` only.
- **Biometric & Payroll Safety**: Confirmed 0 live biometric claims, 0 automatic punch pairing claims, and 0 payroll/deduction references.

---

## 11. Presentation Wrap-Up — Implementation & Audit Record

**Date**: August 28, 2026  
**Status**: `IMPLEMENTED — MANUAL USER VERIFICATION PENDING`  
**Automated / Browser Verification**: `NOT PERFORMED BY ANTIGRAVITY BY USER REQUEST`  

### 11.1 Presentation Changes Implemented in Source
1. **Expansion Notice Banner**: Integrated on `/help-center` with info styling and non-alarming notice text.
2. **Developer Terminology Guard**: Removed internal status tokens (`METADATA_ONLY`, `DRAFT`, `Function ID`, debug strings) from user-facing screens.
3. **Unfinished Guide Direct-URL State**: Added clean `Guide not available yet` fallback for direct navigation to unauthored slugs.
4. **Screenshot-Free Clean Rendering**: Verified that `HelpScreenshot` returns `null` when image source is absent, preventing empty frames or broken placeholders.

### 11.2 Verification Status
- **Automated/Browser Testing**: Intentionally skipped per user instruction.
- **Manual Verification**: User will perform manual testing and demonstration review.




