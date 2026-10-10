# HRISense — Help Center Function Inventory

**Document version**: 3.0.0 — rebuilt from the current system on 2026-09-02
**System title**: *HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision*
**Source of truth**: current source code, current routes, current permission seed, and `apps/web/src/pages/HelpCenter/guides/*.guides.ts`

> **This document replaces every earlier count.** The 2026-08-28 inventory reported
> 39 registry entries with 13 READY and 26 METADATA_ONLY. Those numbers are no longer
> true and are not preserved here. The figures below were produced by running
> `npx tsx scripts/validate-help-registry.ts` against the live registry, not typed by hand.

---

## 1. Registry totals (verified 2026-09-02)

| Measure | Count |
|---|---|
| Total registry entries | **79** |
| READY | **79** |
| DRAFT | **0** |
| METADATA_ONLY | **0** |
| Categories | **17** |

### Guides reachable per role

| Role | Help Center label | Guides |
|---|---|---|
| `FULL` | HR Personnel | **75** |
| `SUPERVISOR` | Supervisor | **34** |
| `STANDARD` | Employee | **27** |
| `PUBLIC` | Applicant / public visitor | **3** |

A guide is counted for every role listed in its `roles` array, so the role columns
overlap by design — a guide readable by all three internal tiers is counted three times.

### Recommended ("Common Tasks") per role

| Role | Recommended guides |
|---|---|
| HR Personnel | 14 |
| Supervisor | 8 |
| Employee | 5 |

These are chosen deliberately from the tasks each role actually performs. No
popularity or usage data exists in HRISense, and none is implied.

---

## 2. Role model

| Tier | Help Center label | Scope |
|---|---|---|
| `FULL` | **HR Personnel** | The whole hospital: employee records, onboarding, recruitment, attendance, leave decisions, compliance, health records, announcements, reports, AI Assistance, activity history, settings. |
| `SUPERVISOR` | **Supervisor** | Own records plus their direct reports: team attendance, team weekly schedules, leave endorsement, evaluations assigned to them. |
| `STANDARD` | **Employee** | Own records only: profile, schedule, attendance, leave, training, compliance standing, evaluations, announcements, notifications, settings. |
| `PUBLIC` | **Applicant / visitor** | The Careers pages and the read-only application status link. No HRISense account exists or is created. |

There is **no Admin role**. A job title containing the word "Administrator" does not
create an administrative tier — permission always comes from the job role's tier.

**Out of scope, and absent from every guide**: payroll, payslips, e-payslips, salary
processing, deductions, overtime pay and night-differential pay. HRISense records
attendance *hours*; it never computes pay.

---

## 3. Coverage — user-facing function to guide

Each row is something a real user can do in the current build. "Covered by" names the
guide that documents it.

### Authentication

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Sign in | `/login` | all | `AUTH_LOGIN` |
| Keep me signed in | `/login` | all | `AUTH_REMEMBER_ME` |
| Forced password change at first sign-in | `/change-password` | all | `AUTH_FIRST_TIME_PASSWORD` |
| Change password | `/settings` → Security | all | `AUTH_CHANGE_PASSWORD` |
| Request a password reset link | `/forgot-password` | all | `AUTH_FORGOT_PASSWORD` |
| Set a new password from the link | `/reset-password` | all | `AUTH_RESET_PASSWORD` |
| Sign out | top bar → profile menu | all | `AUTH_LOGOUT` |

### Dashboard

| Function | Route | Roles | Covered by |
|---|---|---|---|
| HR dashboard | `/dashboard` | FULL | `DASHBOARD_VIEW_HR` |
| Supervisor dashboard | `/dashboard` | SUPERVISOR | `DASHBOARD_VIEW_SUPERVISOR` |
| Employee dashboard | `/dashboard` | STANDARD | `DASHBOARD_VIEW_EMPLOYEE` |

### Employees

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Search and filter the directory | `/employees` | FULL, SUPERVISOR | `EMPLOYEE_SEARCH_FILTER` |
| Onboard a new employee | `/employees/onboard` | FULL | `EMPLOYEE_ONBOARD_NEW` |
| Save / resume / delete an onboarding draft | `/employees/drafts` | FULL | `EMPLOYEE_DRAFT_MANAGE` |
| Read a 201 profile | `/employees/$id` | FULL, SUPERVISOR | `EMPLOYEE_VIEW_PROFILE` |
| Open your own profile | top bar → My Profile | all | `EMPLOYEE_VIEW_OWN_PROFILE` |
| Edit employee details | profile → Edit Profile | FULL | `EMPLOYEE_EDIT_PROFILE` |
| Override the immediate supervisor | profile → Employment | FULL | `EMPLOYEE_ASSIGN_SUPERVISOR` |
| Activate / deactivate / lock / unlock / force password change | profile → Account Management | FULL | `EMPLOYEE_MANAGE_ACCOUNT` |
| Reset and send new credentials | profile → Account Management | FULL | `EMPLOYEE_RESET_CREDENTIALS` |
| Upload a document | profile → Documents | FULL | `EMPLOYEE_UPLOAD_DOCUMENT` |
| Preview / download a document | profile → Documents | all | `EMPLOYEE_DOWNLOAD_DOCUMENT` |
| Edit / replace / delete a document | profile → Documents | FULL | `EMPLOYEE_MANAGE_DOCUMENT` |
| Archive and restore | profile → Archive; `/employees/archived` | FULL | `EMPLOYEE_ARCHIVE_RESTORE` |
| Organizational chart | `/employees/org-chart` | all | `EMPLOYEE_ORG_CHART` |

### Recruitment and the public Careers pages

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Create a job opening | `/recruitment/openings/new` | FULL | `RECRUITMENT_MANAGE_OPENINGS` |
| Publish / close / mark filled / archive | `/recruitment/openings/$id` | FULL | `RECRUITMENT_PUBLISH_OPENING` |
| Review applicants and change stage | `/recruitment/applicants` | FULL | `RECRUITMENT_TRACK_APPLICANTS` |
| Review applicant documents | applicant → Documents | FULL | `RECRUITMENT_APPLICANT_DOCUMENTS` |
| Schedule / reschedule / cancel an interview, record the outcome | applicant → Interviews | FULL | `RECRUITMENT_SCHEDULE_INTERVIEW` |
| Preview and send an applicant message | applicant → Communications | FULL | `RECRUITMENT_COMMUNICATIONS` |
| Convert a hired applicant to an onboarding draft | applicant → Hiring & Onboarding | FULL | `RECRUITMENT_CONVERT_HIRE` |
| Browse public vacancies | `/careers` | PUBLIC, FULL | `PUBLIC_CAREERS_BROWSE` |
| Submit an application | `/careers/$slug/apply` | PUBLIC, FULL | `PUBLIC_APPLY_POSITION` |
| Check application status without signing in | `/careers/application-status/$token` | PUBLIC, FULL | `PUBLIC_APPLICATION_STATUS` |

### Time & attendance

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Daily monitoring, day detail, statuses | `/attendance/daily` | FULL, SUPERVISOR | `ATTENDANCE_DAILY_MONITORING` |
| Attendance tally and drilldown | `/attendance/tally` | FULL | `ATTENDANCE_TALLY` |
| Export the tally (Excel / PDF / CSV) | `/attendance/tally` | FULL | `ATTENDANCE_EXPORT` |
| Check your own attendance | profile → Attendance; My Attendance tab | SUPERVISOR, STANDARD | `ATTENDANCE_MY_ATTENDANCE` |
| Shift catalog | `/attendance/schedule` → Shift Catalog | FULL | `ATTENDANCE_SHIFT_CATALOG` |
| Configure a weekly schedule | profile → Schedule | FULL, SUPERVISOR | `ATTENDANCE_WORK_SCHEDULE` |
| Holiday calendar | `/attendance/holiday-calendar` | all | `ATTENDANCE_HOLIDAY_CALENDAR` |
| Where attendance data comes from; import state | `/attendance/daily` → Import Attendance Excel | FULL, SUPERVISOR | `ATTENDANCE_IMPORT_STATUS` |

> **Attendance import remains deferred.** The Import Attendance Excel window exists and
> is honest about its state: it explains that the official Mustard Seedtime export format
> has not been received and leaves **Process Import** disabled. No guide invents columns,
> sheet names, punch pairing, lateness rules, half-day rules or night-shift handling.

### Leave

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| File a request | `/leave/new` | all | `LEAVE_FILE_REQUEST` |
| Track your requests | `/leave/requests` | all | `LEAVE_VIEW_OWN` |
| Cancel a request | `/leave/requests` | all | `LEAVE_CANCEL_REQUEST` |
| Read your leave balances | profile → Leave Balances | all | `LEAVE_VIEW_BALANCE` |
| Record / correct leave balances | profile → Leave Balances | FULL | `LEAVE_MANAGE_BALANCES` |
| Endorse or reject a team request | `/leave/requests` | SUPERVISOR | `LEAVE_SUPERVISOR_ENDORSE` |
| Approve or reject (final) | `/leave/requests` | FULL | `LEAVE_APPROVE_REJECT` |
| Leave calendar | `/leave/calendar` | all | `LEAVE_VIEW_CALENDAR` |

> The two-stage workflow is documented exactly as implemented:
> **Pending → Endorsed — awaiting HR → Approved / Rejected**, with Cancelled available to
> the filer. No entitlement figure is stated anywhere; balances are whatever HR recorded.
> Leave and rest days are kept distinct throughout.

### Performance and training

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Create an evaluation template | `/evaluations` → Templates | FULL | `EVALUATION_TEMPLATE_SETUP` |
| Create and close an evaluation cycle | `/evaluations` → Cycles | FULL | `EVALUATION_CYCLE_LAUNCH` |
| Complete an assigned evaluation (draft / submit) | `/evaluations` → Assignments | FULL, SUPERVISOR | `EVALUATION_CONDUCT_REVIEW` |
| Finalise a submitted evaluation | `/evaluations` | FULL | `EVALUATION_FINALIZE` |
| Read your own evaluation | profile → Evaluations | all | `EVALUATION_VIEW_OWN` |
| Create a training activity | `/training` | FULL | `TRAINING_CREATE_ACTIVITY` |
| Build the participant roster | `/training` → activity | FULL | `TRAINING_MANAGE_ROSTER` |
| Record participation and upload certificates | `/training` → activity | FULL | `TRAINING_ATTENDANCE_AND_CERTIFICATES` |
| Read your own training history | profile → Training | all | `TRAINING_VIEW_OWN` |

### Health and compliance

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Create a compliance requirement and set its scope | `/compliance` → Requirements | FULL | `COMPLIANCE_REQUIREMENTS_TRACKING` |
| Work the Needs Attention list | `/compliance` | FULL | `COMPLIANCE_NEEDS_ATTENTION` |
| Record and review an employee's compliance | profile → Compliance | FULL | `COMPLIANCE_EMPLOYEE_RECORD` |
| Check your own compliance standing | profile → Compliance | all | `COMPLIANCE_VIEW_OWN` |
| Record a medical examination | `/medical`; profile → Medical | FULL | `MEDICAL_RECORDS_MANAGEMENT` |
| Record a psychological assessment | `/psychological`; profile → Psychological | FULL | `PSYCHOLOGICAL_RECORDS_MANAGEMENT` |
| Who can see health records | — | all | `HEALTH_PRIVACY` |

### Communication

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Write and publish an announcement | `/announcements` | FULL | `ANNOUNCEMENTS_CREATE_PUBLISH` |
| Choose and preview the audience | `/announcements` | FULL | `ANNOUNCEMENTS_AUDIENCE` |
| See who has read a notice | `/announcements` | FULL | `ANNOUNCEMENTS_TRACK_READ_RECEIPTS` |
| Read notices addressed to you | `/announcements` | all | `ANNOUNCEMENTS_READ_RECIPIENT_FEED` |
| Notification centre | `/notifications`, bell menu | all | `NOTIFICATIONS_CENTER` |
| Mark read / mark all read | `/notifications` | all | `NOTIFICATIONS_MANAGE_READ` |

### Administration

| Function | Route / surface | Roles | Covered by |
|---|---|---|---|
| Review the activity history | `/audit` | FULL | `AUDIT_VIEW_LOGS` |
| Read workforce figures, generate an advisory summary | `/ai-assistance` | FULL | `AI_ASSISTANCE_OVERVIEW` |
| Ask a question about workforce data | `/ai-assistance` | FULL | `AI_ASSISTANCE_ASK` |
| Generate a report | `/reports` | FULL | `REPORTS_GENERATE` |
| Export a report | `/reports` | FULL | `REPORTS_EXPORT` |
| Settings: profile, security, appearance, notifications | `/settings` | all | `SETTINGS_OVERVIEW` |
| Find, read and print a guide | `/help-center` | all | `HELP_USING_HELP_CENTER` |

---

## 4. Deliberately NOT documented

These are excluded on purpose, not by omission:

| Excluded | Reason |
|---|---|
| Attendance file processing steps | Official Mustard Seedtime export format not confirmed. Nothing is invented. |
| Payroll, payslips, deductions, overtime pay | Out of scope for HRISense. |
| Internal API endpoints, Prisma operations, database maintenance | Not user-facing; a guide must correspond to something a real user can do. |
| Developer scripts and seeding | Not user-facing. |
| AI attrition prediction, automatic discipline, automatic hiring, automatic leave decisions | Not implemented, and prohibited by design. AI Assistance is advisory only. |
| `/payroll`, `/payslips`, `/ai`, `/ai-intelligence`, `/performance`, `/leave`, `/attendance`, `/help` | Redirect-only routes with no user-facing behaviour of their own. |

---

## 5. Contextual help placement

A small **Help** action links each major workflow page to its guide. It renders nothing
when the signed-in role may not read that guide, so it can never lead to a
"not available for your account" page.

| Page | Guide opened |
|---|---|
| Employee Onboarding | `onboard-new-employee` |
| Leave Requests | `approve-reject-leave` (HR) / `endorse-leave-request` (Supervisor) / `file-leave-request` (Employee) |
| New Leave Request | `file-leave-request` |
| Work Schedule | `assign-work-schedules` |
| Daily Monitoring | `monitor-daily-attendance` |
| Compliance | `compliance-needs-attention` |
| Announcements | `create-publish-announcement` (HR) / `read-announcements` (others) |
| Applicant detail | `process-job-applicants` |
| AI Assistance | `use-ai-assistance` |
| Reports & Analytics | `generate-report` |

---

## 6. Screenshots

**No screenshots were captured or fabricated in this pass, and none are referenced.**
The screenshot architecture is untouched and still available: `HelpScreenshot`,
`HelpScreenshotModal`, the zoom viewer and the `HelpScreenshot` metadata type. Guides
render cleanly with no screenshot — there is no broken image, blank frame or
"screenshot coming soon" placeholder anywhere.

Screenshot capture remains the only outstanding Help Center work.

---

## 7. Full registry listing (generated from the live registry)

### 1. Getting Started & Security (`AUTH`) — 7 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `AUTH_LOGIN` | How to Sign In to HRISense | `sign-in` | HR / SUP / EMP | READY |
| `AUTH_REMEMBER_ME` | Using "Keep Me Signed In" | `keep-me-signed-in` | HR / SUP / EMP | READY |
| `AUTH_FIRST_TIME_PASSWORD` | Setting Your Password on First Sign-In | `first-time-password-change` | HR / SUP / EMP | READY |
| `AUTH_CHANGE_PASSWORD` | How to Change Your Password | `change-password` | HR / SUP / EMP | READY |
| `AUTH_FORGOT_PASSWORD` | What to Do If You Forgot Your Password | `forgot-password` | HR / SUP / EMP | READY |
| `AUTH_RESET_PASSWORD` | Setting a New Password from the Emailed Link | `reset-password` | HR / SUP / EMP | READY |
| `AUTH_LOGOUT` | How to Sign Out Safely | `sign-out` | HR / SUP / EMP | READY |

### 2. Dashboard (`DASHBOARD`) — 3 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `DASHBOARD_VIEW_HR` | Navigating the HR Dashboard | `navigating-hr-dashboard` | HR | READY |
| `DASHBOARD_VIEW_SUPERVISOR` | Navigating the Supervisor Dashboard | `navigating-supervisor-dashboard` | SUP | READY |
| `DASHBOARD_VIEW_EMPLOYEE` | Navigating Your Dashboard | `navigating-employee-dashboard` | EMP | READY |

### 3. Employee Management (`EMPLOYEES`) — 14 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `EMPLOYEE_SEARCH_FILTER` | How to Search and Filter the Employee Directory | `search-filter-employees` | HR / SUP | READY |
| `EMPLOYEE_ONBOARD_NEW` | How to Onboard a New Employee (201 Setup) | `onboard-new-employee` | HR | READY |
| `EMPLOYEE_DRAFT_MANAGE` | How to Save, Resume and Discard Onboarding Drafts | `manage-draft-onboarding` | HR | READY |
| `EMPLOYEE_VIEW_PROFILE` | How to Read an Employee 201 Profile | `view-employee-profile` | HR / SUP | READY |
| `EMPLOYEE_VIEW_OWN_PROFILE` | How to Open Your Own Profile | `view-own-employee-profile` | HR / SUP / EMP | READY |
| `EMPLOYEE_EDIT_PROFILE` | How to Edit Employee Details | `edit-employee-details` | HR | READY |
| `EMPLOYEE_ASSIGN_SUPERVISOR` | How to Set or Override an Employee's Supervisor | `assign-direct-supervisor` | HR | READY |
| `EMPLOYEE_MANAGE_ACCOUNT` | How to Manage an Employee's Login Account | `manage-user-account` | HR | READY |
| `EMPLOYEE_RESET_CREDENTIALS` | How to Issue New Credentials to an Employee | `reset-employee-credentials` | HR | READY |
| `EMPLOYEE_UPLOAD_DOCUMENT` | How to Upload a Document to a 201 File | `upload-201-documents` | HR | READY |
| `EMPLOYEE_DOWNLOAD_DOCUMENT` | How to Preview and Download 201 Documents | `download-201-documents` | HR / SUP / EMP | READY |
| `EMPLOYEE_MANAGE_DOCUMENT` | How to Edit, Replace or Remove a 201 Document | `manage-201-documents` | HR | READY |
| `EMPLOYEE_ARCHIVE_RESTORE` | How to Archive and Restore an Employee Record | `archive-restore-employees` | HR | READY |
| `EMPLOYEE_ORG_CHART` | How to Read the Organizational Chart | `view-org-chart` | HR / SUP / EMP | READY |

### 4. Recruitment & Hiring (`RECRUITMENT`) — 7 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `RECRUITMENT_MANAGE_OPENINGS` | How to Create a Job Opening | `create-publish-job-opening` | HR | READY |
| `RECRUITMENT_PUBLISH_OPENING` | How to Publish, Close, Fill or Archive a Job Opening | `publish-close-job-opening` | HR | READY |
| `RECRUITMENT_TRACK_APPLICANTS` | How to Review Applicants and Move Them Through the Stages | `process-job-applicants` | HR | READY |
| `RECRUITMENT_APPLICANT_DOCUMENTS` | How to Review an Applicant's Documents | `review-applicant-documents` | HR | READY |
| `RECRUITMENT_SCHEDULE_INTERVIEW` | How to Schedule and Update an Interview | `schedule-applicant-interview` | HR | READY |
| `RECRUITMENT_COMMUNICATIONS` | How to Preview and Send a Message to an Applicant | `send-applicant-communication` | HR | READY |
| `RECRUITMENT_CONVERT_HIRE` | How to Turn a Hired Applicant into an Employee | `convert-hired-applicant` | HR | READY |

### 5. Careers & Applications (`PUBLIC_RECRUITMENT`) — 3 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `PUBLIC_CAREERS_BROWSE` | How the Public Careers Page Works | `browse-public-careers` | PUB / HR | READY |
| `PUBLIC_APPLY_POSITION` | How an Applicant Submits an Application | `apply-for-a-position` | PUB / HR | READY |
| `PUBLIC_APPLICATION_STATUS` | How to Check an Application Status Without Signing In | `check-application-status` | PUB / HR | READY |

### 6. Time & Attendance (`ATTENDANCE`) — 8 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `ATTENDANCE_DAILY_MONITORING` | How to Monitor Daily Attendance | `monitor-daily-attendance` | HR / SUP | READY |
| `ATTENDANCE_TALLY` | How to Read the Attendance Tally | `view-attendance-tally` | HR | READY |
| `ATTENDANCE_EXPORT` | How to Export an Attendance Tally | `export-attendance` | HR | READY |
| `ATTENDANCE_MY_ATTENDANCE` | How to Check Your Own Attendance | `view-my-attendance` | SUP / EMP | READY |
| `ATTENDANCE_SHIFT_CATALOG` | How to Manage the Shift Catalog | `manage-shift-templates` | HR | READY |
| `ATTENDANCE_WORK_SCHEDULE` | How to Set an Employee's Weekly Schedule | `assign-work-schedules` | HR / SUP | READY |
| `ATTENDANCE_HOLIDAY_CALENDAR` | How to Use the Holiday Calendar | `view-holiday-calendar` | HR / SUP / EMP | READY |
| `ATTENDANCE_IMPORT_STATUS` | Where Attendance Data Comes From | `attendance-data-import` | HR / SUP | READY |

### 7. Leave Management (`LEAVE`) — 8 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `LEAVE_FILE_REQUEST` | How to File a Leave Request | `file-leave-request` | HR / SUP / EMP | READY |
| `LEAVE_VIEW_OWN` | How to Check Your Leave Requests | `view-my-leave-requests` | HR / SUP / EMP | READY |
| `LEAVE_CANCEL_REQUEST` | How to Cancel a Leave Request | `cancel-leave-request` | HR / SUP / EMP | READY |
| `LEAVE_VIEW_BALANCE` | How to Read Your Leave Balances | `view-leave-balance` | HR / SUP / EMP | READY |
| `LEAVE_MANAGE_BALANCES` | How to Set an Employee's Leave Balances | `manage-leave-balances` | HR | READY |
| `LEAVE_SUPERVISOR_ENDORSE` | How to Endorse or Reject a Team Member's Leave | `endorse-leave-request` | SUP | READY |
| `LEAVE_APPROVE_REJECT` | How to Approve or Reject a Leave Request | `approve-reject-leave` | HR | READY |
| `LEAVE_VIEW_CALENDAR` | How to Use the Leave Calendar | `view-leave-calendar` | HR / SUP / EMP | READY |

### 8. Performance & Evaluations (`EVALUATIONS`) — 5 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `EVALUATION_TEMPLATE_SETUP` | How to Create an Evaluation Form Template | `set-up-evaluation-template` | HR | READY |
| `EVALUATION_CYCLE_LAUNCH` | How to Create and Run an Evaluation Cycle | `launch-evaluation-cycle` | HR | READY |
| `EVALUATION_CONDUCT_REVIEW` | How to Complete an Evaluation You Have Been Assigned | `conduct-evaluation` | HR / SUP | READY |
| `EVALUATION_FINALIZE` | How to Finalise a Submitted Evaluation | `finalize-evaluation` | HR | READY |
| `EVALUATION_VIEW_OWN` | How to Read Your Own Evaluation | `view-my-evaluation` | HR / SUP / EMP | READY |

### 9. Training & Seminars (`TRAINING`) — 4 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `TRAINING_CREATE_ACTIVITY` | How to Create a Training or Seminar | `create-training-activity` | HR | READY |
| `TRAINING_MANAGE_ROSTER` | How to Add Participants to a Training | `manage-training-roster` | HR | READY |
| `TRAINING_ATTENDANCE_AND_CERTIFICATES` | How to Record Participation and Upload Certificates | `record-training-attendance` | HR | READY |
| `TRAINING_VIEW_OWN` | How to See Your Own Training History | `view-my-training` | HR / SUP / EMP | READY |

### 10. Health & Compliance (`COMPLIANCE`) — 7 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `COMPLIANCE_REQUIREMENTS_TRACKING` | How to Create a Compliance Requirement | `create-compliance-requirement` | HR | READY |
| `COMPLIANCE_NEEDS_ATTENTION` | How to Work the Needs Attention List | `compliance-needs-attention` | HR | READY |
| `COMPLIANCE_EMPLOYEE_RECORD` | How to Record and Review an Employee's Compliance | `record-employee-compliance` | HR | READY |
| `COMPLIANCE_VIEW_OWN` | How to Check Your Own Compliance Standing | `view-my-compliance` | HR / SUP / EMP | READY |
| `MEDICAL_RECORDS_MANAGEMENT` | How to Record a Medical Examination | `manage-medical-records` | HR | READY |
| `PSYCHOLOGICAL_RECORDS_MANAGEMENT` | How to Record a Psychological Assessment | `manage-psychological-records` | HR | READY |
| `HEALTH_PRIVACY` | Who Can See Health Records | `health-record-privacy` | HR / SUP / EMP | READY |

### 11. Announcements (`ANNOUNCEMENTS`) — 4 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `ANNOUNCEMENTS_CREATE_PUBLISH` | How to Write and Publish an Announcement | `create-publish-announcement` | HR | READY |
| `ANNOUNCEMENTS_AUDIENCE` | How to Choose Who Receives an Announcement | `set-announcement-audience` | HR | READY |
| `ANNOUNCEMENTS_TRACK_READ_RECEIPTS` | How to See Who Has Read an Announcement | `track-announcement-read-status` | HR | READY |
| `ANNOUNCEMENTS_READ_RECIPIENT_FEED` | How to Read Announcements Addressed to You | `read-announcements` | HR / SUP / EMP | READY |

### 12. Notifications (`NOTIFICATIONS`) — 2 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `NOTIFICATIONS_CENTER` | How to Use the Notification Centre | `use-notification-centre` | HR / SUP / EMP | READY |
| `NOTIFICATIONS_MANAGE_READ` | How to Mark Notifications as Read | `mark-notifications-read` | HR / SUP / EMP | READY |

### 13. Activity History (`AUDIT`) — 1 guide

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `AUDIT_VIEW_LOGS` | How to Review the Activity History | `view-activity-history` | HR | READY |

### 14. AI Assistance (`AI_ASSISTANCE`) — 2 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `AI_ASSISTANCE_OVERVIEW` | How to Use AI Assistance | `use-ai-assistance` | HR | READY |
| `AI_ASSISTANCE_ASK` | How to Ask a Question About Your Workforce Data | `ask-ai-about-workforce-data` | HR | READY |

### 15. Reports (`REPORTS`) — 2 guides

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `REPORTS_GENERATE` | How to Generate a Report | `generate-report` | HR | READY |
| `REPORTS_EXPORT` | How to Export a Report | `export-report` | HR | READY |

### 16. Settings (`SETTINGS`) — 1 guide

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `SETTINGS_OVERVIEW` | How to Use Settings | `use-settings` | HR / SUP / EMP | READY |

### 17. Using the Help Center (`HELP`) — 1 guide

| Guide ID | Title | Slug | Roles | Status |
|---|---|---|---|---|
| `HELP_USING_HELP_CENTER` | How to Find and Print a Guide | `using-the-help-center` | HR / SUP / EMP | READY |

---

*Regenerate the listing above with:* `npx tsx apps/web/scripts/validate-help-registry.ts`
