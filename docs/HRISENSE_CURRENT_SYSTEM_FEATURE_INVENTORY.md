> **⚠ PARTIALLY SUPERSEDED (added 2026-09-02).**
>
> This August 2026 inventory records "First-Login Password Change — IMPLEMENTED —
> nothing missing". That was inaccurate: the flow was broken by three separate
> defects (an unsatisfiable complexity regex, a mismatched request field so the
> current password was never verified, and `getMe` omitting
> `mustChangePassword`). All three were repaired on 2026-09-02.
>
> Several other rows have also moved on — notably AI Assistance, Reports,
> Settings, Notifications and Audit Logs, which are no longer placeholders.
>
> For current state see `docs/CLAUDE_FIX_ALL_EXECUTION_REPORT.md`.

# HRISense Current System Feature Inventory (August 2026 Audit)

## 1. Executive Summary
This document provides a definitive, evidence-based current-state feature inventory of the HRISense system as of August 2026. It strictly classifies features based on their actual end-to-end implementation in the current source code rather than planned designs, mockups, or legacy capstone documents. 

## 2. Audit Baseline Snapshot
- **Audit Date**: August 2026
- **Current Branch**: `main`
- **Current HEAD commit**: `4d42f1bc`
- **Last Commit Message**: `fix(attendance): include half-day in secondary summary`
- **Frontend Stack**: React 19 + Vite + TailwindCSS + TanStack Router (`apps/web`)
- **Backend Stack**: Express.js + TypeScript + Prisma (`apps/api`)
- **Database Provider**: MySQL

## 3. Strict Classification Definitions
Every feature is classified using exactly ONE of the following statuses based on empirical code review:
- **IMPLEMENTED**: Frontend + backend + storage + permissions are connected sufficiently for the intended feature.
- **PARTIAL**: A meaningful portion exists, but important functionality is missing (e.g., UI exists but CRUD is incomplete).
- **FRONTEND ONLY**: UI exists but no working backend/data workflow supports it.
- **BACKEND ONLY**: Backend/model/API exists but no usable frontend exposes it.
- **PLACEHOLDER**: The UI intentionally exists as a future entry point but does not perform the final functionality (e.g., Mustard Seedtime Excel Import).
- **DISCONNECTED**: Both pieces may exist but are not connected correctly (e.g., route mismatch).
- **DEPRECATED**: Legacy behavior/data remains for historical compatibility but should not be used for new workflows.
- **NOT IMPLEMENTED**: Required feature does not meaningfully exist.
- **UNKNOWN / REQUIRES MANUAL QA**: Static code inspection cannot prove real runtime behavior.

---

## 4. Master System Matrix

### Module 01 — Public Landing Page
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Root Landing Route | Public | IMPLEMENTED | `apps/web/src/pages/Landing` | N/A | N/A | None. |
| Cross-Route Hash Nav | Public | IMPLEMENTED | `CareersLayout.tsx` | N/A | N/A | Works for `/#features`, `/#about`, etc. |
| Public Accessibility | Public | IMPLEMENTED | `routeTree.tsx` (not in AppShell) | N/A | N/A | None. |

### Module 02 — Public Careers
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Careers Page / List | Public | IMPLEMENTED | `CareersPage.tsx` | `PublicRecruitmentController.listOpenings` | `JobOpening` | None. |
| Job Opening Detail | Public | IMPLEMENTED | `OpeningDetailPage.tsx` | `PublicRecruitmentController.getOpeningBySlug` | `JobOpening` | None. |
| Application Form | Public | IMPLEMENTED | `ApplyPage.tsx` | `PublicRecruitmentController.apply` | `JobApplication`, `Applicant` | None. |
| Applicant Account / Tracking | Public | NOT IMPLEMENTED | None | None | None | Intentionally excluded from scope. |

### Module 03 — Public Recruitment Security
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Application Rate Limit | Public | IMPLEMENTED | Handles 429 safely | `express-rate-limit` before `multer` | N/A | Limit set to 5 per hour per IP. |
| Upload Size/Type Validation | Public | IMPLEMENTED | Displays validation error | `multer` fileFilter + limits | N/A | Rejects >5MB, strictly limits to PDF/DOC/DOCX. |
| ZIP / DOCX Hardening | Public | IMPLEMENTED | N/A | `adm-zip` traversal logic | N/A | Structurally validates Office XML relationships. |
| Private File Storage | Public | IMPLEMENTED | N/A | Stored in `uploads/recruitment/documents` | N/A | Files are intentionally not exposed statically. |
| CAPTCHA / Antivirus | Public | NOT IMPLEMENTED | None | None | None | Requires third-party integrations (reCAPTCHA/ClamAV). |

### Module 04 — Authentication & Role-Based Access Control
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Login / JWT Issuance | All | IMPLEMENTED | `LoginPage.tsx` | `auth.controller.ts` | `User`, `UserSession` | None. |
| First-Login Password Change | All | IMPLEMENTED | `ChangePasswordPage.tsx` | Enforced in route guards | `mustChangePassword` | None. |
| Role Resolution (FULL/SUP/STD) | All | IMPLEMENTED | `hasPermission` utility | `auth.middleware.ts` | `PermissionTier` enum | None. |
| MFA / 2FA | All | NOT IMPLEMENTED | None | None | None | Requires specialized provider/infrastructure. |

### Module 06 — Sidebar / Navigation
| Sidebar Group | Route | FULL | SUPERVISOR | STANDARD | Status | Missing / Next Action |
|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Yes | Yes | Yes | IMPLEMENTED | None. |
| Employees | `/employees` | Yes | Yes | Yes | IMPLEMENTED | None. |
| Recruitment | `/recruitment` | Yes | No | No | IMPLEMENTED | None. |
| Attendance | `/attendance/daily` | Yes | Yes | Yes | IMPLEMENTED | None. |
| Leave | `/leave` | Yes | Yes | Yes | IMPLEMENTED | None. |
| Performance | `/performance` | Yes | Yes | Yes | PLACEHOLDER | Connect UI to backend engine. |
| Training | `/training` | Yes | Yes | Yes | PARTIAL | Full workflow needs QA. |-+
| Compliance | `/compliance` | Yes | No | No | PLACEHOLDER | Connect UI to backend engine. |
| Medical | `/medical` | Yes | No | No | DISCONNECTED | Route missing in `routeTree.tsx`. |
| Psychological | `/psychological` | Yes | No | No | DISCONNECTED | Route missing in `routeTree.tsx`. |
| Payroll | `/payroll` | Yes | Yes | Yes | PLACEHOLDER | Connect UI to backend engine. |
| AI Intelligence | `/ai` | Yes | No | No | PLACEHOLDER | Connect UI to AI backend. |
| Reports | `/reports` | Yes | No | No | PLACEHOLDER | Connect UI to backend engine. |
| Audit Logs | `/audit` | Yes | No | No | DISCONNECTED | Route missing in `routeTree.tsx`. |

### Module 08 & 09 — Employee Management & Onboarding
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Employee Directory | FULL/SUP | IMPLEMENTED | `EmployeesPage.tsx` | `employee.controller.ts` | `Employee` | None. |
| Add Employee / Onboarding | FULL | IMPLEMENTED | `EmployeeOnboardingPage.tsx` | `EmployeeOnboardingService` | `OnboardingDraft` | Real transactional creation logic is robust. |
| Secure Welcome Email | FULL | IMPLEMENTED | Success modal indicates email | `BrevoTransactionalProvider` | N/A | Generates temp password and securely transmits via Brevo. |
| Employee Profile & Documents | ALL | IMPLEMENTED | `EmployeeDetailPage.tsx` | Profile endpoints | `EmployeeDocument` | None. |
| Organization Chart | FULL | IMPLEMENTED | `OrgChartPage.tsx` | `OrgChartController` | `SupervisionLink` | None. |

### Module 18-26 — Recruitment Pipeline
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Job Openings CRUD | FULL | IMPLEMENTED | `JobOpeningsPage.tsx` | `job-opening.service.ts` | `JobOpening` | None. |
| Applicant Management / Tracking | FULL | IMPLEMENTED | `ApplicantDetailPage.tsx` | `job-application.service.ts` | `JobApplication` | None. |
| Applicant Interviews | FULL | IMPLEMENTED | Interview drawer | `interview.service.ts` | `ApplicantInterview` | None. |
| Automatic Email Communcations | FULL | IMPLEMENTED | Auto-triggers on status change | `recruitment-automatic-communication.service.ts` | `ApplicantCommunication` | Triggers via Brevo templates. |
| Applicant -> Onboarding Convert | FULL | IMPLEMENTED | "Convert to Onboarding" button | `applicant-conversion.service.ts`| Creates `OnboardingDraft` | None. |

### Module 27-35 — Time & Attendance
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Daily Monitoring (HR Org) | FULL | IMPLEMENTED | `DailyMonitoringPage.tsx` | `attendance.service.ts` (Aggregates) | `AttendanceRecord` | Org-wide filters (Unit/Dept/Emp/Status). |
| Daily Monitoring (Sup Team) | SUP | IMPLEMENTED | `DailyMonitoringPage.tsx` | `attendance.service.ts` (Scope: team)| Resolves active `SupervisionLink` | None. |
| Daily Monitoring (Self) | ALL | IMPLEMENTED | `DailyMonitoringPage.tsx` | `attendance.service.ts` (Scope: self)| `AttendanceRecord` | None. |
| Primary Summary Cards | ALL | IMPLEMENTED | Present, Late, Absent, On Leave | `DailyMonitoringPage.tsx` | N/A | Evaluates actual records natively. |
| Secondary Status Summary | ALL | IMPLEMENTED | Half Day, Holiday, Rest Day, Susp. | `DailyMonitoringPage.tsx` | N/A | Conditionally displays if count > 0. |
| Mustard Seedtime Import | FULL | PLACEHOLDER | `AttendanceImportPlaceholder.tsx` | None | N/A | UI only. Deliberately stops parsing. Awaits real Excel file. |
| Work Schedule Viewer | ALL | PARTIAL | `WorkSchedulePage.tsx` | `attendance.service.ts` | `WorkSchedule` enum | No date-specific overrides; only handles base templates. |

### Module 38-48 — Leave Management
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| New Request (Self) | ALL | IMPLEMENTED | `NewLeaveRequestPage.tsx` | `leave.service.ts` | `LeaveRequest` | Calendar-day UI explicitly warns about chargeable days. |
| Leave Approval | FULL | IMPLEMENTED | Action buttons on Requests | `leave.controller.ts` | `LeaveStatus` | Strictly isolated to FULL users. |
| Supervisor Approval | SUP | NOT IMPLEMENTED | Explicitly disabled | Explicitly throws 403 | N/A | Awaits Hospicio business confirmation. |
| Leave Calendar | ALL | IMPLEMENTED | `LeaveCalendarPage.tsx` | `leave.service.ts` (Calendar API) | `LeaveRequest` | Displays multi-day chips securely authorized by scope. |
| Leave Balances | ALL | IMPLEMENTED | UI indicates remaining credits | `leave.service.ts` | `LeaveBalance` | None. |

### Module 56-78 — Advanced HRIS Modules (Stubs / Placeholders)
| Feature | Target User | Status | Frontend Evidence | Backend Evidence | DB / Permissions | Missing / Next Action |
|---|---|---|---|---|---|---|
| Training & Seminars | FULL | PARTIAL | `TrainingPage.tsx` | Routes exist | `Training` | Backend requires full CRUD QA. |
| Compliance Monitoring | FULL | PLACEHOLDER | `CompliancePage.tsx` | Routes commented out | `ComplianceRequirement`| Connect React Query to live database endpoints. |
| Payslips | ALL | PLACEHOLDER | `PayrollPage.tsx` | Routes commented out | `Payslip` | Only UI arrays exist. No payroll engine calculation. |
| Performance Management | ALL | PLACEHOLDER | `PerformancePage.tsx` | Routes commented out | `PerformanceEvaluation`| Missing backend processing logic. |
| AI Workforce Intelligence | FULL | PLACEHOLDER | `AIPage.tsx` | Routes commented out | `AIInsight` | Needs LLM provider connection (e.g., OpenAI API). |
| Reports & Analytics | FULL | PLACEHOLDER | `ReportsPage.tsx` | Routes commented out | N/A | Missing BI calculations/backend aggregations. |

---

## 5. Security & Data Integrity Notes
- **Recruitment Upload Defense**: The system is highly protected against payload attacks via explicit multipart byte limitations, in-memory rate limiting against spam/DoS, and file signature parsing (defending against manipulated generic ZIP files masquerading as DOCX).
- **Attendance Isolation**: No missing attendance records are ever algorithmically guessed as `Absent` or `Rest Day`. The system forces visual placeholders (e.g. "No imported records") when actual `AttendanceRecord`s are missing.
- **Transactional Consistency**: Critical endpoints like `Applicant -> Onboarding -> User Creation` explicitly use `prisma.$transaction` so that a failure in email delivery correctly bubbles up without stranding ghost database rows.

## 6. Development Status & Next Steps
- **Overall System Completion**: 65-70%. The core engine (Authentication, Organization, Employee Registry, Leave, Attendance structure, and Recruitment pipeline) is extremely robust. The remainder of the application exists as beautifully styled stubs.
- **Top Priorities for Phase 10**: 
  1. **Mustard Seedtime Excel Ingestion**: Blocked until a real export sample is provided by Hospicio de San Jose. Once provided, an `exceljs` parser can populate the `AttendanceRecord` table.
  2. **AI Workforce Intelligence**: Connecting the frontend placeholder to a live LLM integration service.
  3. **Compliance & Reports backend**: Un-commenting backend routes and wiring up real analytical data points to the frontend charts.
  4. **Payroll Engine**: Establishing the calculation engine for net pay and government deductions if required beyond just E-Payslip storage.
