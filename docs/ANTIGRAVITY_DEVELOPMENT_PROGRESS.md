# HRISense Development Progress

## Strict Project Scope Cleanup: Scope Cleanup, Title Enforcement, and Payroll Removal
- **Overview**: Enforced permanent project scope changes and official capstone naming convention across the entire codebase. Formally updated the project title to **`HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision`**, eradicated all user-facing instances of "Intelligence" branding (transitioned the AI module to "AI Assistance" / `/ai-assistance`), completely deleted the out-of-scope Payroll / E-Payslip feature from frontend and backend runtime, and retained strict RBAC tiers (`FULL`, `SUPERVISOR`, `STANDARD`).
- **Key Highlights**:
  - **Official Capstone Title Enforcement**:
    - Title updated to exact string: `HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision`.
    - Applied in `apps/web/index.html` (`<title>` and `<meta name="description">`), `package.json`, `LandingPage.tsx` (Hero, Overview, About, Footer), and `LoginPage.tsx`.
    - Allowed compact brand `HRISense` / `HSJ HRISense` retained for compact logos and navigation elements.
  - **Removal of "Intelligence" Branding**:
    - Renamed AI module route to `/ai-assistance` with title "AI Assistance" and subtitle "AI-assisted workforce summaries and HR decision support."
    - Preserved backwards-compatible redirect routes from `/ai` and `/ai-intelligence` to `/ai-assistance`.
    - Sidebar group updated to "AI & Analytics" with item "AI Assistance".
    - `GlobalSearch.tsx`, `HRDashboard.tsx`, `ReportsPage.tsx`, `LandingPage.tsx`, and `LoginPage.tsx` purged of "Intelligence" user-facing phrasing.
  - **Complete Removal of E-Payslip / Payroll**:
    - Deleted `apps/web/src/pages/Payroll/PayrollPage.tsx` and removed `/payroll` from `routeTree.tsx` (added safe fallback redirects from `/payroll` and `/payslips` to `/dashboard`).
    - Removed `Payroll` menu section and `E-Payslips` link from `Sidebar.tsx`.
    - Removed `latestPayslip` state, quick action button, and "Recent Payslips" card from `EmployeeDashboard.tsx`.
    - Unregistered `payslipRouter` from `apps/api/src/routes/index.ts` and removed backend payslip controllers/services.
    - Removed payslip queries from `dashboard.service.ts`.
  - **Database Safety Compliance**:
    - Zero destructive database commands executed (`prisma db push`, `migrate dev`, and `reset` were not run).
    - Database status inspected and reported.
  - **Build Integrity**:
    - `npm --prefix apps/web run build` (`tsc -b && vite build`) passed with 0 errors.
    - `npm --prefix apps/api run build` (`tsc`) passed with 0 errors.
    - 0 occurrences of `react-router-dom` across `apps/web/src`.
- **Status**:
  - **PROJECT SCOPE CLEANUP & TITLE ENFORCEMENT: COMPLETE**

## Guided HR Workflows — Typography & Readability Improvement (All Workflows)
- **Overview**: Completed a comprehensive typography and readability overhaul across all guided HR workflow modals and shared workflow components to maximize legibility for HR personnel, older users, non-technical users, and users with weaker eyesight. Preserved all step-by-step structures, validation rules, and spacious desktop workspaces while significantly improving font sizes, weights, hierarchy, and color contrast.
- **Key Highlights**:
  - **Established Visual Typography Hierarchy**:
    - Modal Header Title: `text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100`
    - Modal Subtitle: `text-sm font-medium text-slate-600 dark:text-slate-300`
    - Stepper Circles: `w-7 h-7 sm:w-8 sm:h-8 text-xs font-bold` with step labels `text-sm font-semibold`
    - Step / Section Title: `text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100`
    - Section Subtitle: `text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed`
    - Form Field Labels: `text-sm font-semibold text-slate-800 dark:text-slate-200`
    - Form Inputs & Selects: `h-11 px-3.5 text-sm sm:text-base font-medium bg-slate-50/90 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-sm placeholder:text-slate-400`
    - Selection Cards: `p-4 rounded-xl border` with card title `text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100` and helper `text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 leading-normal`
    - Review Summary Cards: `p-5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700` with category labels `text-xs uppercase font-semibold text-slate-500 dark:text-slate-400` and values `text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100`
    - Footer Navigation Buttons: `h-10 sm:h-11 px-5 sm:px-6 text-sm sm:text-base font-semibold`
  - **Shared Component Upgrades**:
    - `WorkflowModal.tsx`: Header, stepper, section headers, and footer action buttons updated with larger text and high-contrast styling.
    - `EmployeePicker.tsx`: Search input updated to `h-12 text-sm sm:text-base font-medium`, workspace candidate list items to `text-sm sm:text-base font-semibold`, confirmed employee card to `text-lg sm:text-xl font-bold` with `h-10 font-semibold` change button.
    - `FileUploadCard.tsx`: Dropzone area updated to `h-12 px-4 py-3 text-sm font-medium`, file attachment card name to `text-sm font-semibold`.
  - **Domain Workflow Modals Upgraded**:
    - `MedicalPage.tsx` (Medical Record Modal): Upgraded Examination inputs/selects, Validity & HR Confidential Notes card (`p-4 text-sm/text-base font-medium`), and Review Summary card (`text-base/text-lg font-bold`).
    - `PsychologicalPage.tsx` (Psychological Assessment Modal): Upgraded Assessment inputs/selects, Employee-Visible Summary & HR Notes cards, Document Visibility choice cards (`p-3.5 text-sm font-bold`), and Review Summary.
    - `CompliancePage.tsx` (Compliance Requirement Modal): Upgraded Requirement inputs, 5 Scope cards (`p-4 text-sm/text-base font-bold`), 2 Validity choice cards (`p-5 text-base font-bold`), and Review Summary.
    - `TrainingActivityModal.tsx` (Training & Seminar Modal): Upgraded Activity inputs/dates, 5 Targeting Scope cards (`p-4 text-sm/text-base font-bold`), Roster count banner (`text-sm sm:text-base font-bold`), and Review Summary.
    - `EvaluationCycleModal.tsx` (Evaluation Cycle Modal): Upgraded Cycle inputs/dates, 5 Scope cards, Evaluator Method cards (`p-4 text-sm/text-base font-bold`), Roster count banner, and Review Summary.
    - `EvaluationTemplateModal.tsx` (Evaluation Template Modal): Upgraded Template title/desc inputs, 4 Rating Method cards (`p-4 text-sm/text-base font-bold`), Criteria Builder item cards (`p-4 text-sm font-semibold`), Total Weight counter (`text-sm sm:text-base font-bold`), and Review Summary.
  - **Zero Regressions & Standards Compliance**:
    - 0 occurrences of `react-router-dom` across `apps/web/src`.
    - No database mutations executed (`prisma db push` / `migrate` untouched).
    - Production build (`tsc -b && vite build`) passed with 0 errors.
- **Files Modified**:
  - `apps/web/src/components/shared/WorkflowModal.tsx`
  - `apps/web/src/components/shared/EmployeePicker.tsx`
  - `apps/web/src/components/shared/FileUploadCard.tsx`
  - `apps/web/src/pages/Medical/MedicalPage.tsx`
  - `apps/web/src/pages/Psychological/PsychologicalPage.tsx`
  - `apps/web/src/pages/Compliance/CompliancePage.tsx`
  - `apps/web/src/pages/Training/components/TrainingActivityModal.tsx`
  - `apps/web/src/pages/Evaluations/components/EvaluationCycleModal.tsx`
  - `apps/web/src/pages/Evaluations/components/EvaluationTemplateModal.tsx`
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md`
- **Status**:
  - **GUIDED WORKFLOW TYPOGRAPHY & READABILITY OVERHAUL: COMPLETE — READY FOR USER MANUAL QA**
- **Manual QA Status**: PENDING USER TESTING.

## Training & Seminars — Complete Frontend Implementation
- **Overview**: Replaced the legacy placeholder page with an enterprise HR management workspace for Training & Seminars, supporting global activity creation, organizational scope targeting (All Active Employees, Unit, Department, Job Role, Specific Staff), capacity management, participant roster management, bulk & individual outcome recording (Assigned, Completed, Did Not Attend, Excused), activity cancellation, optional Compliance Requirement linkage (`category === 'TRAINING'`), and Employee Profile training history integration.
- **Key Highlights**:
  - **Training API Service**: Created `apps/web/src/services/training.service.ts` with comprehensive TypeScript types (`TrainingActivity`, `TrainingParticipant`, `TrainingParticipationStatus`, `CreateTrainingActivityDto`, `UpdateParticipantStatusDto`, `BulkUpdateParticipantStatusDto`, `EmployeeTrainingHistoryItem`), friendly labels/badges metadata, and typed wrappers for all backend routes (`/training`, `/training/:id`, `/training/:id/participants`, `/training/:id/participants/bulk-status`, `/training/employees/:employeeId/history`).
  - **Global Training Workspace**: Created `apps/web/src/pages/Training/TrainingPage.tsx`:
    - Real data metrics cards: Total Activities, Scheduled / Upcoming, Completed Activities, Total Enrolled Participants.
    - Search & Filter bar: Search by activity title/facilitator/venue, filter by Activity Type (Training, Seminar, Workshop, Orientation, Conference, Other), filter by Status (Scheduled, Completed, Cancelled, Draft).
    - Activities table: Displays Title, Hours Credit, Type, Schedule, Provider/Venue, Participants (total/cap and completed), Compliance link, Status, and Action.
    - Role handling: Only `FULL` tier HR receives action buttons for creating/editing/managing activities.
  - **Activity Creation & Targeting**: Created `apps/web/src/pages/Training/components/TrainingActivityModal.tsx`:
    - Structured form: Activity Details, Start/End Schedule with chronological validation, Optional Compliance Requirement dropdown (strictly filtered to active `TRAINING` requirements), and Roster Targeting.
    - 5 Targeting modes: All Active Employees, By Unit, By Department, By Job Role, Specific Staff (searchable multi-select).
    - Live resolution & deduplication: Enforces single participant record per employee and validates against configured capacity limits.
    - Edit support: Allows updating details, schedule, location, and requirement linkage without destructive overwrites.
  - **Participant Roster & Bulk Outcomes**: Created `apps/web/src/pages/Training/components/TrainingDetailModal.tsx`:
    - Complete activity summary header with provider, venue, schedule, credit hours, and compliance link.
    - Participant stats cards: Total Assigned, Completed, Did Not Attend, Excused.
    - Roster table with multi-select checkboxes, employee search, and status filter.
    - Bulk action floating toolbar: `Mark Completed`, `Mark Did Not Attend`, `Mark Excused`, `Reset Assigned` with date & notes dialog.
    - Add Participants dialog: Safely adds more staff after activity creation while preventing duplicate enrollment.
    - Cancellation confirmation: Safely marks activity as cancelled while preserving historical completion integrity.
  - **Compliance Linkage Integration**:
    - Selects exclusively from active `TRAINING` requirements.
    - Completing participants automatically reflects backend auto-fulfillment of compliance requirements without duplicated client records.
  - **Employee Profile History Tab**: Created `apps/web/src/pages/Employees/components/EmployeeTrainingProfileTab.tsx`:
    - Clean table displaying employee's historical training/seminar activities, schedule, provider, status, completed date, and compliance fulfillment badge.
    - Integrated into `apps/web/src/pages/Employees/EmployeeDetailPage.tsx` tab bar for `isFullHR || isSelf`.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/services/training.service.ts` (NEW)
  - `apps/web/src/pages/Training/TrainingPage.tsx` (MODIFIED)
  - `apps/web/src/pages/Training/components/TrainingActivityModal.tsx` (NEW)
  - `apps/web/src/pages/Training/components/TrainingDetailModal.tsx` (NEW)
  - `apps/web/src/pages/Employees/components/EmployeeTrainingProfileTab.tsx` (NEW)
  - `apps/web/src/pages/Employees/EmployeeDetailPage.tsx` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Status**:
  - **TRAINING & SEMINARS FRONTEND IMPLEMENTATION: COMPLETE — PENDING USER MANUAL QA**
- **Manual QA Status**: PENDING USER TESTING.

## Performance Evaluations — Frontend Phase 5 (Employee Profile Evaluation History + Final Evaluation Polish)
- **Overview**: Implemented the complete Employee Profile Evaluation History tab with strict role-based visibility, read-only historical evaluation detail reuse (`readOnlyForce`), explicit HR employee-visibility control during finalization, and end-to-end frontend terminology consistency.
- **Key Highlights**:
  - **Employee Profile Evaluations Tab**: Created `apps/web/src/pages/Employees/components/EmployeeEvaluationProfileTab.tsx`:
    - *Read-only History View*: Displays comprehensive employee evaluation history table with cycle name, template name, evaluation period, evaluator details, status badge, score result (`score / 5` or `Qualitative Assessment`), and finalized date.
    - *HR Visibility Column*: Displays employee visibility badge (`Visible to Employee` vs `Hidden from Employee`) exclusively for authorized `FULL` tier HR.
    - *Detail Modal Reuse*: Reuses `EvaluationFormModal.tsx` with `readOnlyForce={true}`, guaranteeing strictly locked read-only viewing with no mutation controls from profile history.
  - **EmployeeDetailPage Integration**:
    - Integrated `Evaluations` tab into `visibleTabs` and rendered `EmployeeEvaluationProfileTab` cleanly when `isFullHR || isSelf`.
    - Protected unauthorized employee access according to backend direct object authorization (403 denied).
  - **Visibility Audit & Finalize Control Correction**:
    - Removed automatic hardcoding of `isEmployeeVisible: true`.
    - Added an explicit `Employee Access` checkbox in the `Finalize Evaluation` confirmation dialog for `FULL` HR, defaulting to `false` (conservative visibility) with clear descriptive guidance.
    - Accurately updated the finalized status banner to indicate whether employee profile visibility is enabled or private to HR/Evaluators.
  - **Frontend Service Extensions**: Added `getEmployeeEvaluationHistory` alias in `apps/web/src/services/evaluation.service.ts`.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/pages/Employees/components/EmployeeEvaluationProfileTab.tsx` (NEW)
  - `apps/web/src/pages/Employees/EmployeeDetailPage.tsx` (MODIFIED)
  - `apps/web/src/pages/Evaluations/components/EvaluationFormModal.tsx` (MODIFIED)
  - `apps/web/src/services/evaluation.service.ts` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Status**:
  - **PERFORMANCE EVALUATION FRONTEND IMPLEMENTATION: COMPLETE — PENDING USER MANUAL QA**
- **Manual QA Status**: PENDING USER TESTING.

## Performance Evaluations — Frontend Phase 4 (Evaluator Response Form + Draft + Submit + Finalize UI)
- **Overview**: Implemented the complete interactive Evaluation Response, Draft, Submission, HR Review, and Finalization workflows across My Evaluations and Cycle Details.
- **Key Highlights**:
  - **Evaluation Service Extensions**: Added `saveDraft`, `submitEvaluation`, `finalizeEvaluation`, and input DTOs (`EvaluationResponseInput`, `SaveDraftDto`, `SubmitEvaluationDto`, `FinalizeEvaluationDto`) to `apps/web/src/services/evaluation.service.ts`.
  - **Interactive Evaluation Form Component**: Created `apps/web/src/pages/Evaluations/components/EvaluationFormModal.tsx` supporting:
    - *Template Snapshot Hydration*: Accurately displays criteria, weighting, rating methods, and min/max score boundaries from historical assignment `templateSnapshot`.
    - *Rating Method Controls*: Interactive numeric rating button pills for `NUMERIC`, `LIKERT_5`, and `SATISFACTION_4` (1..5, 1..4, or custom min..max); pure written qualitative feedback for `DESCRIPTIVE` without calculating numeric scores.
    - *Criterion Comments*: Dedicated textarea per criterion with required indicators where enforced.
    - *Overall Summary & Recommendations*: Manual textarea inputs for overall evaluator comments and development recommendations (notes only; no training automation).
    - *Save Draft*: Allows saving incomplete ratings and comments at any stage with instant persistence.
    - *Submit Evaluation*: Client-side pre-validation checking all required ratings and comments, confirmation dialog, and transition to locked `SUBMITTED` ("Awaiting Finalization") state.
    - *HR Review & Finalize*: `FULL` tier HR review of submitted evaluation responses and calculated overall score, with a confirmation modal calling `POST /evaluations/assignments/:id/finalize` to transition to `FINALIZED` ("Completed").
    - *Read-only Finalized View*: Clean display of finalized scores, remarks, criteria breakdown, and completion status with locked inputs.
  - **Workspace & Cycle Details Integration**: Updated `EvaluationsPage.tsx`:
    - My Evaluations action buttons: `Start Evaluation` (Not Started), `Continue Evaluation` (In Progress), `View Submitted` (Submitted), and `View Evaluation` (Finalized).
    - Cycle Details table links: Clicking `View` opens the full evaluation form modal in appropriate review or finalized mode.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/services/evaluation.service.ts` (MODIFIED)
  - `apps/web/src/pages/Evaluations/components/EvaluationFormModal.tsx` (NEW)
  - `apps/web/src/pages/Evaluations/EvaluationsPage.tsx` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Remaining Work**: Phase 5 (Employee Profile Evaluation Tab & Final Frontend Polish).
- **Manual QA Status**: PENDING USER TESTING.

## Performance Evaluations — Frontend Phase 3 (Evaluation Cycle + Assignment Setup UI)
- **Overview**: Implemented the complete Evaluation Cycle Creation and Assignment Setup UI for authorized HR (`FULL` tier), including active template selection, organizational scope targeting (All Employees, Unit, Department, Job Role, Specific Staff), evaluator assignment configuration (Immediate Supervisor, One Designated Evaluator, Manual), transactional assignment generation visibility, search/filter capabilities, and safe cycle closure workflows.
- **Key Highlights**:
  - **Evaluation Service Extensions**: Added `createCycle`, `closeCycle`, and input DTOs (`CreateCycleDto`, `CreateCycleScopeDto`) to `apps/web/src/services/evaluation.service.ts`.
  - **Cycle Setup Modal**: Created `apps/web/src/pages/Evaluations/components/EvaluationCycleModal.tsx` supporting:
    - *Cycle Details & Evaluation Period*: Cycle Name, Description, Start Date, and Due Date with strict `dueDate >= startDate` validation.
    - *Active Template Selection*: Strictly filters selectable templates to active templates; displays template rating method, criteria count, and weighting summary.
    - *Target Scope*: 5 targeting modes (`ALL` Active Employees, `UNIT`, `DEPARTMENT`, `JOB_ROLE`, `EMPLOYEE` multi-select) with live estimated target count indicator.
    - *Evaluator Assignment Setup*: Supports 3 backend methods (`SUPERVISOR` via active SupervisionLinks, `ONE_EVALUATOR` with searchable designated user picker, `MANUAL` with fallback evaluator support).
    - *Transactional Generation*: Submits payload to `POST /evaluations/cycles`, triggering backend employee resolution, template snapshotting, and assignment generation in a single atomic transaction.
  - **Enhanced Cycle Details Workspace**: Updated `EvaluationsPage.tsx`:
    - `[ + Create Evaluation Cycle ]` enabled across page Header, Cycles tab, and empty states.
    - Enhanced Cycle Details Dialog: Fetches full cycle data on demand, displays scope breakdown, KPI metric counters (Total, Not Started, In Progress, Awaiting Finalization, Completed), and searchable/filterable assignment rows with evaluator warnings for unassigned cases.
    - `[ Close Cycle ]` action: Confirmation modal to safely close active cycles without mutating completed reviews or scoring history.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/services/evaluation.service.ts` (MODIFIED)
  - `apps/web/src/pages/Evaluations/components/EvaluationCycleModal.tsx` (NEW)
  - `apps/web/src/pages/Evaluations/EvaluationsPage.tsx` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Remaining Work**: Phase 4 (Evaluator Response Form + Draft + Submit + Finalize UI), Phase 5 (Employee Profile Evaluation Tab).
- **Manual QA Status**: PENDING USER TESTING.

## Performance Evaluations — Frontend Phase 2 (Evaluation Template Builder UI)
- **Overview**: Implemented the complete dynamic Evaluation Template Builder UI for authorized HR (`FULL` tier), supporting full lifecycle management (Create, Edit, View Criteria, and Safe Deactivation) with dynamic rating methods, criteria ordering, and weighted scoring validation.
- **Key Highlights**:
  - **Evaluation Service Extensions**: Added write methods (`createTemplate`, `updateTemplate`, `deactivateTemplate`) and input DTOs (`CreateTemplateDto`, `UpdateTemplateDto`, `CriterionInputDto`) to `apps/web/src/services/evaluation.service.ts`.
  - **Dynamic Template Form Modal**: Created `apps/web/src/pages/Evaluations/components/EvaluationTemplateModal.tsx` supporting:
    - *Template Details*: Name, Description/Purpose.
    - *4 Rating Methods*: Numeric Scale (configurable min/max), 5-Point Scale, 4-Point Satisfaction Scale, and Descriptive (qualitative written reviews only).
    - *Criteria Builder*: Add, remove, and reorder criteria with Up/Down buttons; individual Rating Required and Comment Required toggles.
    - *Weighted Scoring*: Toggle weighted scoring on/off; individual criterion weight inputs; live total weight balance indicator; client-side validation requiring exactly 100% total weight before submission.
  - **Templates Workspace Management**: Updated `EvaluationsPage.tsx`:
    - `[ + Create Evaluation Template ]` active in Header, Tab bar, and Empty States.
    - Template Table actions: `View` (read-only criteria dialog), `Edit` (hydrates template and criteria into the builder), and `Deactivate` (soft-deactivation with confirmation modal).
    - True empty state and search/filter empty states with "Clear Filters" CTA.
  - **Historical Snapshot Safety**: Template edits/deactivations do not alter existing evaluation cycles or completed assignment snapshots.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/services/evaluation.service.ts` (MODIFIED)
  - `apps/web/src/pages/Evaluations/components/EvaluationTemplateModal.tsx` (NEW)
  - `apps/web/src/pages/Evaluations/EvaluationsPage.tsx` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Remaining Work**: Phase 3 (Evaluation Cycles & Evaluator Workflow UI), Phase 4 (Employee Profile Evaluation Tab).
- **Manual QA Status**: PENDING USER TESTING.

## Performance Evaluations — Frontend Phase 1 (API Client + Global Workspace Foundation)
- **Overview**: Created the typed Evaluation API client, registered the `/evaluations` route, updated the Sidebar navigation, and built the read-only global Performance Evaluations workspace.
- **Key Highlights**:
  - **Typed API Client**: Created `apps/web/src/services/evaluation.service.ts` with complete types (`EvaluationTemplate`, `EvaluationCriterion`, `EvaluationCycle`, `EvaluationAssignment`, `EvaluationRatingMethod`, `EvaluationCycleStatus`, `EvaluationAssignmentStatus`) and API methods (`listTemplates`, `getTemplate`, `listCycles`, `getCycle`, `listAssignments`, `getAssignment`, `listEmployeeHistory`).
  - **Global Workspace**: Created `apps/web/src/pages/Evaluations/EvaluationsPage.tsx` with:
    - Real summary metric cards (`Active Reviews`, `Not Started`, `In Progress`, `Awaiting Finalization`, `Completed`).
    - Role-aware tabs: `Evaluation Cycles` and `Evaluation Templates` (visible to `FULL` tier), and `My Evaluations` (evaluator workspace).
    - Read-only data tables with search, status filters, friendly enum badge mappings, and zero-state empty views.
    - Read-only detail dialogs for templates, cycles, and assignments.
    - Non-functional/disabled CTAs with clear phase notices (no fake forms or broken modals).
  - **Routing & Navigation**: Registered `/evaluations` in `routeTree.tsx` (redirecting legacy `/performance` to `/evaluations`) and updated Sidebar navigation link.
  - **No `react-router-dom`**: Confirmed 0 occurrences across `apps/web/src`.
  - **Build Status**: Web production build (`tsc -b && vite build`) PASSED.
- **Files Created/Modified**:
  - `apps/web/src/services/evaluation.service.ts` (NEW)
  - `apps/web/src/pages/Evaluations/EvaluationsPage.tsx` (NEW)
  - `apps/web/src/routeTree.tsx` (MODIFIED)
  - `apps/web/src/components/layout/Sidebar.tsx` (MODIFIED)
  - `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)
- **Remaining Work**: Phase 2 (Evaluation Template Builder UI), Phase 3 (Evaluation Cycles & Evaluator Workflow UI), Phase 4 (Employee Profile Evaluation Tab).
- **Manual QA Status**: PENDING USER TESTING.

## Evaluation & Training Modules — Database Schema Foundation (Audit State)
- **Overview**: Designed and added the relational database schema models and migration file for the upcoming Performance Evaluation & Employee Training & Seminars modules.
- **Current Implementation Status**:
  - **Database Schema Models & Migration**: ADDED (`apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260821164800_evaluation_and_training_modules/migration.sql`).
  - **Backend Services & Controllers**: NOT IMPLEMENTED.
  - **Frontend Workspaces & Modals**: NOT IMPLEMENTED.
- **Database Safety Audit Notes**:
  - Migration file `20260821164800_evaluation_and_training_modules/migration.sql` is present on disk with 9 additive tables (`evaluation_templates`, `evaluation_criteria`, `evaluation_cycles`, `evaluation_cycle_scopes`, `evaluation_assignments`, `evaluation_responses`, `training_activities`, `training_participants`, `training_activity_documents`).
  - Database schema tables were created additively with zero old tables/columns dropped.
  - Full backup exists at `hrisense_db_backup_pre_eval_training.sql`.
  - Migration table `_prisma_migrations` is currently pending the recorded entry for `20260821164800_evaluation_and_training_modules`. Standard non-destructive resolution: `npx prisma migrate resolve --applied 20260821164800_evaluation_and_training_modules`.
- **Files Created/Modified**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20260821164800_evaluation_and_training_modules/migration.sql`
- **Build Result**: PASS (`apps/api` TypeScript compilation PASS, `apps/web` Vite production build PASS).

## Compliance Monitoring — Non-Technical HR Workspace Redesign
- **Overview**: Completely redesigned the Compliance Monitoring module (`/compliance`) into a clear, actionable HR workspace tailored for HR Personnel (`FULL` tier). Eliminated technical terminology (matrix, status engines, scope records) and replaced oversized dashboard clutter with an action-first workspace.
- **Key Highlights & Architectural Changes**:
  - **Header & Navigation Audit**: Header updated to "Compliance Monitoring" with subtitle "Manage employee requirements, track validity, and review items that need attention." Primary action `[ + Create Requirement ]`. Removed hardcoded/mock `2` badge from sidebar.
  - **Focused Summary Hierarchy**:
    - `Applicable Requirements`: Total active checks assigned across all employees.
    - `Valid`: Compliant, up-to-date items (renamed from "Compliant" to "Valid").
    - `Needs Attention`: Prominent actionable total card displaying combined counts and breakdown of `Expired`, `Missing`, `Expiring Soon`, and `Needs Review`.
  - **Actionable "Items Needing Attention" Section**: Prioritized table immediately visible below summary cards, sorting urgent items (`EXPIRED` > `MISSING` > `EXPIRING_SOON` > `NEEDS_REVIEW`) with employee information, requirement name, category badge, attention reason, validity date, and smart action triggers (*View Medical*, *View Psych*, *Add Record*).
  - **Workspace Tabs**: Simplified navigation between `Requirements` and `Employee Compliance`.
  - **Requirements Workspace**: Clean tabular view with live search, category dropdown filter, lifecycle status, scope filter, and human-friendly scope formatting ("All Employees", "Nursing Unit", "Dietary Department", etc.). True empty state when zero requirements exist in the database.
  - **Guided Create Requirement Modal**: Plain language 3-step structured form:
    1. *Requirement Details* (Name, Category, Description).
    2. *Who Needs This Requirement?* (All Employees, Specific Unit, Specific Department, Specific Role, Specific Employee).
    3. *Validity & Expiry Tracking* (No vs Yes + reminder days before expiration).
  - **Employee Compliance Workspace**: List of employees with assigned requirement metrics (`Valid`, `Need Action`, `Missing`, `Expiring`) and quick-action `[View Compliance]`.
  - **Employee Compliance Detail Drawer**: Categorized breakdown of requirements for the selected employee with status badges, validity dates, and deep links (*Open Medical*, *Open Psych*, *+ Record*).
  - **Generic Compliance Record Modal**: Modal enabling HR to log fulfillments for Certification, Training, Document, and Other requirement categories.
  - **Backend API Endpoints**:
    - `GET /compliance/needs-attention`: Computes all actionable compliance items prioritized by administrative urgency.
    - `GET /compliance/employees-list`: Aggregates per-employee compliance status counts in a single efficient query.
- **Files Modified**:
  - `apps/api/src/services/compliance.service.ts`
  - `apps/api/src/controllers/compliance.controller.ts`
  - `apps/api/src/routes/compliance.routes.ts`
  - `apps/web/src/components/layout/Sidebar.tsx`
  - `apps/web/src/services/compliance.service.ts`
  - `apps/web/src/pages/Compliance/CompliancePage.tsx`
  - `apps/web/src/pages/Employees/components/EmployeeComplianceProfileTab.tsx`
- **Build Result**: PASS (`apps/api` TypeScript compilation PASS, `apps/web` Vite production build PASS).
- **Manual QA Status**: PENDING USER TESTING.

## Health & Compliance — Medical & Psychological Global HR Workspaces Redesign
- **Overview**: Completely redesigned the Medical Records (`/medical`) and Psychological Records (`/psychological`) modules to provide a global administrative HR management workspace. Eliminated the single-employee dropdown selector blocker from the main pages.
- **Key Highlights & Architectural Changes**:
  - **Global Records Tables**: Both modules now immediately load organization-wide paginated records for authorized HR (`FULL` tier), complete with Employee identity, Record/Assessment Type, Examination/Assessment Date, Valid Until, Compliance Status badge, Review Status badge, and View Action button.
  - **Privacy & Confidentiality Protection**: Narrative clinical findings, psychiatric test summaries, and HR confidential notes are omitted from global table payloads and list views.
  - **Two-Zone Security for Psychological Records**: Explicit visual separation in detail drawers between `Employee-Visible Information` (`employeeVisibleSummary`) and `HR-Only Information` (`hrConfidentialNotes`).
  - **Self-Contained Add Record Modals**: Integrated searchable employee selector directly into the creation forms (`Add Medical Record` and `Add Psychological Record`) with date pickers, requirement linking, confidential HR notes, and document attachment with visibility flags.
  - **Record Detail Drawers**: Include complete employee profile cards, administrative review workflow (`Accept Record` / `Request Correction`), protected document manager with inline streaming/download, and employee historical record drill-down.
  - **4 Summary Cards**: `Total Records`, `Needs Review`, `Expiring Soon`, and `Expired` on both workspaces.
  - **Standard Employee Self-View**: Maintained clean, isolated personal wellness views for standard employees on `/psychological` without exposing organizational directories or HR notes.
- **Files Modified**:
  - `apps/api/src/services/medical.service.ts`
  - `apps/api/src/services/psychological.service.ts`
  - `apps/api/src/controllers/medical.controller.ts`
  - `apps/api/src/controllers/psychological.controller.ts`
  - `apps/api/src/routes/medical.routes.ts`
  - `apps/api/src/routes/psychological.routes.ts`
  - `apps/web/src/services/medical.service.ts`
  - `apps/web/src/services/psychological.service.ts`
  - `apps/web/src/pages/Medical/MedicalPage.tsx`
  - `apps/web/src/pages/Psychological/PsychologicalPage.tsx`
  - `apps/web/src/pages/Employees/components/EmployeeMedicalProfileTab.tsx`
  - `apps/web/src/pages/Employees/components/EmployeePsychologicalProfileTab.tsx`
- **Build Result**: PASS (`apps/api` TypeScript compilation PASS, `apps/web` Vite production build PASS).
- **Manual QA Status**: PENDING USER TESTING (User will test actual browser navigation and workflows).

## TEMPORARY QA SCHEDULE CONFIGURATION â€” 2026-08-10
- **Action**: Fully configured 6 legacy Schedule Templates using the native revision architecture (`ScheduleService.updateTemplate`) with an effective date of `2026-08-10`.
- **IMPORTANT DISCLAIMER**: These values are purely PROVISIONAL and are NOT confirmed Hospicio de San Jose schedules. They must be reviewed and revised after the Hospicio interview/meeting.
- **Unresolved Business Logic**:
  - Official working weekdays and rest-day patterns
  - Real Flexible Shift rules and Rotating Shift rules
  - Official Night Shift definition
  - Department-specific schedules
- **Build Result**: PASS
- **Current Git HEAD**: 50681ea872ebed20bf7aa325eb9566ab7b02b314

## Current Task: Full Time & Attendance UI Placeholder Audit
- **Root Cause**: Manual QA discovered remaining placeholder alerts for View Details modal, native alert() usage for errors, and a fake functional UI state for Attendance Excel Import. 
- **Exact Fix**: 
  - **View Details**: Replaced the placeholder `alert('Schedule Details Drawer/Modal')` with a fully functional View Details modal in `EmployeeSchedulesTab.tsx` that reuses `EmployeeScheduleProfileTab` passing the specific `employeeId`.
  - **Placeholder Audit**: Conducted an exhaustive grep search in `apps/web/src/pages/Attendance`. Converted `alert()` occurrences for API errors to `toast.error()` via `sonner` in both `EmployeeSchedulesTab.tsx` and `ScheduleTemplatesTab.tsx`. HTML attribute placeholders (`placeholder="..."`) were intentionally retained. The native `confirm()` in `HolidayCalendarPage.tsx` was retained since it correctly invokes backend logic.
  - **Excel Import**: Removed the fake `AttendanceImportPlaceholder` from `DailyMonitoringPage.tsx` since no real backend Mustard Seedtime parser exists. Deleted the unused `AttendanceImportPlaceholder.tsx` component safely.
- **Files Modified**: 
  - `apps/web/src/pages/Attendance/DailyMonitoringPage.tsx`
  - `apps/web/src/pages/Attendance/components/EmployeeSchedulesTab.tsx`
  - `apps/web/src/pages/Attendance/components/ScheduleTemplatesTab.tsx`
- **Files Deleted**:
  - `apps/web/src/pages/Attendance/components/AttendanceImportPlaceholder.tsx`
- **Build Result**: PASS (Web built successfully)
- **Manual QA Status**: Pending (Browser testing of the View Details modal and all attendance pages)
- **Current Branch**: main
- **Current Git HEAD**: 50681ea872ebed20bf7aa325eb9566ab7b02b314

## CURRENT SYSTEM INVENTORY AUDIT â€” AUGUST 2026
- **Audit starting commit**: 53aedc6423fcf0b8ceac24f42d9ca86e311d5bc7
- **Current branch**: main
- **No functional code changes**: True.
- **Major modules discovered**: Authentication, Employees, Onboarding, Attendance, Leave, Recruitment, Careers (Implemented). AI, Compliance, Reports, Payroll, Performance (Frontend Placeholders). Medical, Psychological, Audit Logs (Disconnected).
- **Overall implementation percentage**: 65% (Core HRIS is robust, advanced modules are stubs).
- **Most important incomplete module**: AI Workforce Intelligence.
- **Inventory document path**: `docs/HRISENSE_CURRENT_SYSTEM_FEATURE_INVENTORY.md`
- **Exact recommended next development phase**: Phase 10: Advanced Modules Implementation (Connect AI, Reports, and Compliance placeholders to real backend services).

## Public Recruitment Upload Security Audit
- **Upload Defenses Implemented**: Server-side rate limiting (in-memory), file-size constraints, multipart limits, strict extension validation, structural magic-bytes signature validation, randomized private storage, and failure cleanup.
- **DOCX Hardening**: Safely implemented memory-based zip traversal via adm-zip to structurally confirm Office Open XML relationships (rejecting generic ZIPs).
- **Files Modified**: 
  - apps/api/src/routes/public-recruitment.routes.ts
  - apps/api/src/controllers/public-recruitment.controller.ts
  - apps/web/src/pages/Careers/ApplyPage.tsx
- **Documentation**: docs/PUBLIC_RECRUITMENT_UPLOAD_SECURITY_AUDIT.md

## TIME & ATTENDANCE (DAILY MONITORING & EXCEL IMPORT)
- **Daily Monitoring Calendar**: Rebuilt the Daily Monitoring page to feature a polished calendar-first experience. Primary summary cards display Present, Late, Absent, and On Leave. A compact secondary summary conditionally renders Half Day, Holiday, Rest Day, and Suspended when their counts > 0.
- **HR Visibility**: Full organization-wide aggregated attendance calendar with Unit, Department, Employee, and Status cascading filters.
- **Supervisor Visibility**: Restricted to My Attendance and Team Attendance (confirmed active `SupervisionLink` subordinates only).
- **Employee Visibility**: Restricted to personal My Attendance calendar.
- **Drill-down Drawer**: Selecting a date opens a drawer showing actual attendance row details scoped by permission tier. Missing data is safely labeled "No imported records" rather than inferred as absent.
- **Mustard Seedtime Excel Placeholder**: Added a polished HR-only modal for future Excel uploads. Functionality is purely UI placeholder. No `xlsx` or `exceljs` parser was added. No database tables were created. The selected File reference is cleared from React component state when the modal closes and is not persisted by HRISense.
- **Files Modified**:
  - apps/api/src/services/attendance.service.ts
  - apps/api/src/controllers/attendance.controller.ts
  - apps/api/src/routes/attendance.routes.ts
  - apps/web/src/components/ui/CalendarGrid.tsx
  - apps/web/src/pages/Attendance/DailyMonitoringPage.tsx
  - apps/web/src/pages/Attendance/components/AttendanceImportPlaceholder.tsx

## ATTENDANCE HOLIDAY CALENDAR + WORK SCHEDULING (IN PROGRESS)
- **Phase 1: Prisma Schema & Migration**: Added `OrganizationCalendarEntry`, `ScheduleTemplate`, `ScheduleTemplateDay`, `EmployeeScheduleAssignment`, and `ScheduleHistoryLog` models.
- **Legacy Preservation & Correction**: Authored a controlled migration against `hrisense_migration_dev_db` that mapped the legacy `WorkSchedule` enum values to immutable `ScheduleTemplate` rows. Created initial `EmployeeScheduleAssignment` rows using the migration execution date to prevent fabricating historical records. 
  - *M-F Correction*: The original migration incorrectly assumed standard Monday-Friday work hours based on frontend display constants. A corrective migration (`20260809091948_correct_legacy_schedule_assumptions`) was immediately authored and deployed to safely delete these fabricated `schedule_template_days` rows. The legacy templates are now preserved accurately as "unconfigured" until Hospicio explicitly defines their working days.
- **Prisma Status**: Successfully deployed migrations to the live `hrisense_db` and regenerated Prisma client. Schema is up to date.
- **Phase 2: Backend API (Holiday)**: Implemented HolidayAPI integration in `HolidayService` saving entries as `PENDING`. Manual entries save as `APPROVED`. Auditing tracks all modifications using authenticated `actorUserId`. The API builds cleanly (Build Result: PASS). 
- **Phase 3: Backend API (Schedule)**: Implemented `ScheduleService` handling Template CRUD, effective-date revisions, and `EmployeeScheduleAssignment` tracking. Included `resolveScheduleForDate` logic for accurate historical schedule contexts. Protected with HR/Supervisor authorization boundaries. The API builds cleanly (Build Result: PASS).
- **Phase 4: Backend API (Attendance Integration)**: Refactored `AttendanceService` to incorporate the composite resolver. 
  - **Compatibility Checks Passed**:
    - Legacy HOLIDAY/REST_DAY/SUSPENDED records count is exactly 0 in the database (verified via SQL). No legacy records will be hidden.
    - Employee x Date virtualization in `AttendanceService.list` is safely bounded by a maximum of 31 days per request.
    - `SchedulingPolicy` implemented to strictly restrict HR Scheduling mutation permissions to explicit HR Job Roles and Admins (FULL tier), preserving the established HRISense policy pattern without leaking authority to lower tiers.
    - Build Result: PASS.
- **Phase 5: Frontend UI (Holiday Calendar)**: (IMPLEMENTATION COMPLETE â€” MANUAL QA PENDING).
  - Switched from HolidayAPI to Nager.Date API per user request to allow 2026/future queries for free.
  - Implemented the complete **Manual Organization Calendar Entry** workflow (Create, Edit, Deactivate). 
  - Supports native `OrganizationCalendarType` values (`HOLIDAY`, `SPECIAL_NON_WORKING`, `ORGANIZATION_NON_WORKING`, `SUSPENSION`).
  - Manual entries use the same robust Backend RBAC `SchedulingPolicy` as API suggestions.
  - All edits/deactivations trigger detailed `ScheduleHistoryLog` audits via `actorUserId`.
  - View filtering inherently respects user's `PermissionTier`. Only Admins (`FULL`) see mutation controls (`Load API Suggestions`, `Add Calendar Entry`, `Approve`, `Ignore`, etc.), ensuring Business HR separation.
  - Built with local Framer Motion and basic HTML elements to circumvent missing Shadcn UI library components (`Card`, `Select`, `Alert`).
  - Build Result: PASS (vite build successful).

- **Phase 6: Frontend UI (Work Schedule)**: (IMPLEMENTATION COMPLETE â€” MANUAL QA PENDING)
  - Implemented missing backend read endpoints (`/employees`, `/overrides`, `/history`, `/templates` with counts).
  - Created centralized frontend Schedule API service (`schedule.ts`).
  - Rebuilt `/attendance/schedule` as a full Work Schedule management interface.
  - Features 3 distinct Role-Based Tabs (`EmployeeSchedulesTab`, `ScheduleTemplatesTab`, `ScheduleHistoryTab`).
  - **Storage & Behavior of Unconfigured Weekdays Verified:** 
    - `ScheduleTemplatesTab.tsx` builder supports a 3-state configuration: `UNCONFIGURED` | `WORKING` | `DAY_OFF`.
    - Backend creates/stores a `ScheduleTemplateDay` row ONLY for `WORKING` or `DAY_OFF`.
    - `UNCONFIGURED` corresponds safely to the **absence** of a `ScheduleTemplateDay` row.
    - `resolveScheduleForDate` cleanly evaluates missing rows to `effectiveEmployeeSchedule.type = 'UNCONFIGURED'`, strictly avoiding assumed/fabricated Day Offs.
  - **Supervisor Authority Clarification Verified:** 
    - The actual code restricts supervisors to viewing/assigning/overriding **only active direct subordinates** (via `SupervisionLink`). 
    - Supervisors strictly **cannot** create, revise, or archive Schedule Templates, and cannot assign schedules organization-wide. Their overrides are correctly constrained to their subordinates.
  - Build Status: PASS (Backend `tsc` and Frontend `vite build` successful).
  - Current Git HEAD: `(To be committed in next checkpoint)`
  - Exact Continuation Point: **Completed Work:**
- Phase 1: Database Schema Migration (`ScheduleTemplate`, `EmployeeScheduleAssignment`, `OrganizationCalendarEntry`, `ScheduleHistoryLog`, etc.)
- Phase 2: Holiday Backend & Frontend Implementation (Integration with Nager.Date, manual overrides)
- Phase 3: Work Schedule Backend (Templates, Composite Resolver)
- Phase 4: Attendance Monitoring Integration (Holiday integration, `effectiveEmployeeSchedule` rendering, List endpoint refactoring)
- Phase 5: Work Schedule Management UI (CRUD operations for Templates, Assignment UI)
- Phase 6: Legacy Migration & Code Deletion (Removed `holidayapi` refs, migrated `workSchedule` strings safely)
- Phase 7: Employee Profile integration (Schedule assignments, override logs, Onboarding updates)
- Phase 8: System-wide integration audit. Fixed DailyMonitoring schedule display, filter logic for contextual statuses, and controller assignment behavior.

**Next Steps:**
- Execute the **Comprehensive Manual Browser QA** (Phase 9) via `docs/MANUAL_QA_PHASE_5_8.md`.

- **Phase 7: Employee Profile Schedule Integration**: (IMPLEMENTATION COMPLETE â€” MANUAL QA PENDING)
  - Created `<EmployeeScheduleProfileTab />` specifically for displaying a single employee's schedule.
  - Placed the new tab cleanly in `EmployeeDetailPage.tsx`.
  - Reused `scheduleApi` functions (`getEmployeeSchedules`, `getHistory`) extending them to conditionally take `employeeId` to respect the policy limits of STANDARD/SUPERVISOR/FULL tiers while supporting individual queries.
  - Successfully connected the new Active Schedule Template dropdown to `EmployeeOnboardingPage.tsx`, allowing HR to provision initial assignments upon creation.
  - Preserved the legacy `Employee.workSchedule` field defaulting per instructions.
  - Fixed `ScheduleHistoryLog` typing to track `targetEmployeeId`.
  - Build Result: PASS (Both Backend and Frontend successfully compile).
  - Exact Continuation Point: Ready for **Step 8 (System Wide Checks)** or Manual QA.
  
- **Unresolved Business Policies (Pending Hospicio Confirmation)**:
  - Working week days (is Monday-Friday factual?)
  - Supervisor authority limits (e.g., which tiers have HR vs. line-manager scheduling privileges)
  - Night shift bounds and specific rest day patterns
- **Status:** IMPLEMENTATION COMPLETE
- **Current HEAD Reference:** (Audit changes applied) (excluding untracked Prisma artifacts and new UI files).

## ARCHITECTURAL CHANGE (AUGUST 2026)
- **Schedule Overrides Removed**: The Employee Schedule Override (Custom Hours / One-Day overrides) feature has been permanently removed from HRISense scope.
- **Final Schedule Architecture**: Holiday & Work Calendar + Schedule Templates + Weekly Working Hours / Day Off + Employee Schedule Assignment + Schedule History + Actual Attendance Time In / Time Out.


## Step 5 Manual QA Checklist (Pending Browser Verification)
- [ ] Log in as HR (`FULL` permission tier).
- [ ] Load HolidayAPI suggestions for the current year.
- [ ] Approve one pending suggestion.
- [ ] Ignore one pending suggestion.
- [ ] Refresh the same year and verify no duplicate API suggestions appear.
- [ ] Create a manual HSJ non-working date (e.g. "Founder's Day").
- [ ] Edit/Deactivate a manual entry.
- [ ] Verify approved dates appear correctly in the Daily Monitoring context view.
- [ ] Verify ignored dates do NOT affect Daily Monitoring.
- [ ] Log in as Supervisor and verify mutation controls (buttons, fetch API) are NOT rendered.
- [ ] Log in as Employee and verify mutation controls are NOT rendered.
- [ ] Verify responsive layout across Desktop/Tablet/Mobile.
- [ ] Verify dark/light theme integrity.

## Next Steps
- Wait for Step 5 manual QA verification.
- Once stable, proceed to **Step 6: Frontend UI: Work Schedule** to upgrade the `/attendance/schedule` page.

### Files Modified
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/services/holiday.service.ts` (NEW)
  - `apps/api/src/controllers/holiday.controller.ts` (NEW & UPDATED)
  - `apps/api/src/routes/holiday.routes.ts` (NEW & UPDATED)
  - `apps/api/src/services/schedule.service.ts` (NEW & UPDATED)
  - `apps/api/src/controllers/schedule.controller.ts` (NEW & UPDATED)
  - `apps/api/src/routes/schedule.routes.ts` (NEW & UPDATED)
  - `apps/api/src/policies/scheduling.policy.ts` (NEW)
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/services/attendance.service.ts` (UPDATED)
  - `apps/web/src/pages/Attendance/HolidayCalendarPage.tsx` (NEW)
  - `apps/web/src/routeTree.tsx` (UPDATED)
  - `apps/web/src/components/layout/Sidebar.tsx` (UPDATED)

## STEP 4 - Work Schedule UX and Coverage
- IMPLEMENTATION COMPLETE. 
- Refactored getEmployeeSchedules for robust pagination and server-side filtering (applicableDate, configurationStatus, unitId, departmentId, templateId, search).
- Implemented batch-fetching getCoverage to prevent N+1 queries with a hardcap of 31 days.
- Created ScheduleCoverageTab.tsx integrating a monthly calendar UI and single/range date selection drawer.
- Polished ScheduleHistoryTab.tsx (search and action filters).
- Polished ScheduleTemplatesTab.tsx visualization of M T W T F blocks.
- Successfully built API and Web.


## STEP 5 - Leave on Behalf of Employees (Backend)
- IMPLEMENTATION COMPLETE.
- Implemented LeaveService.createBatch for batch leave creation with 'self', 'employees', and 'all' target modes.
- Preserved existing day-calculation and overlap validation per employee.
- Audited creation logic via createAuditLog using targetEmployeeId.
- Protected targetMode='all' and cross-team targeting strictly to FULL and SUPERVISOR permission tiers respectively.
- Returned 207 Multi-Status pattern (success, failed, summary) for partial success reporting.
- API successfully built.


## STEP 6 - Leave on Behalf of Employees (Frontend)
- IMPLEMENTATION COMPLETE.
- Integrated new POST /leave/batch endpoint with the frontend via typed leaveApi service.
- Supported Request For modes: 'Myself', 'One Employee', 'Multiple Employees' (HR), and 'Team Member(s)' (Supervisor).
- Maintained existing self-serve logic for STANDARD tier users.
- Implemented EmployeeSelectionPanel with paginated search (HR) and active subordinates lookup (Supervisor).
- Handled dynamic Leave Balances exclusively for single-target contexts.
- Ensured 201 full success and 207 partial success states render appropriate UI flows without exposing internal errors.
- Frontend Web Build: PASSED.


## STEP 7 - Leave Calendar Range Selection & Prefill (Commit: 228c9583)
- IMPLEMENTATION COMPLETE.
- Modified CalendarGrid to support range selection (Start/End date highlighting).
- Updated LeaveCalendarPage to manage selection state (single date, range, reverse-range normalization, third-click reset).
- Added TanStack router validateSearch schema for startDate and endDate on /leave/new route.
- Modified NewLeaveRequestPage to read router search parameters strictly on initialization (does not overwrite user edits later).
- Implemented client-side Employee Search filtering for HR/Supervisor views.
- Preserved existing DayDrawer details view logic.
- Web Build: PASSED.


## OFFICIAL HOSPICIO WORK SCHEDULE UPDATE
- Confirmed Hospicio schedules:
  - Office 8AM–12NN
  - Office 9AM–12NN
  - Office 1PM–6PM
  - Shift 6AM–2PM
  - Shift 2PM–10PM
  - Shift 10PM–6AM

- Rest-day policy: PENDING HOSPICIO CONFIRMATION
- Mustard Seedtime importer: DEFERRED UNTIL NDA + REAL EXCEL SAMPLE
- Overnight biometric pairing: DEFERRED UNTIL REAL EXCEL STRUCTURE IS AVAILABLE

- 6 provisional templates safely archived.
- 6 official templates created without fake week patterns.
- 61 active employee assignments safely closed to prevent silent mismatch mapping.
- Files changed: EmployeeScheduleProfileTab.tsx.
- Database operation used: scratch/migrate_schedules.js.
- API build: SUCCESS. Web build: SUCCESS.
- Manual QA pending.

## WORK SCHEDULE UX SIMPLIFICATION (DYNAMIC WEEKLY SCHEDULE CHECKPOINT)
- IMPLEMENTATION COMPLETE.
- Completely redesigned the frontend Work Schedule editor for non-technical HR users (`EmployeeScheduleProfileTab.tsx`).
- Simplified the user flow to: Usual Work Shift(s) + Rest Days + Effective Date, with a per-day Customize panel for advanced cases.
- **Multiple Usual Shifts**: Implemented support for assigning multiple usual shifts (e.g. 9AM-12NN + 1PM-6PM) per employee in normal schedules. 
- Updated `schedule.service.ts` to compute dominant shift combinations for seamless rendering in lists.
- Implemented smart hydration to preserve existing complex schedules (detecting customized combinations and mixed schedules) without data loss.
- Overlap detection and duplicate detection are fully functional in the setup modal.
- Aligned terminology across all components: "Needs Setup" (for unconfigured days) and "Not Set" (for missing employee schedules).
- Streamlined `EmployeeSchedulesTab.tsx`, `ScheduleCoverageTab.tsx`, `ShiftCatalogTab.tsx`, and `ScheduleHistoryTab.tsx` to remove technical DB terminology (e.g., hiding version numbers).
- No backend/Prisma schema changes were required; the frontend correctly maps HR-friendly inputs to the existing `EmployeeWeeklyScheduleDay` payload.
- Web build: SUCCESS.
- Manual Browser QA: PENDING USER TESTING.

## DEV RUNTIME STABILITY (ROBUST REQUEST ERROR BOUNDARY & SUPERVISOR)
- **Actual Root Cause**: The API crashed on the first "Save Weekly Schedule" click because any thrown `AppError` inside the controller (e.g. from validation rules or missing data) returned a rejected promise. Express 4 does NOT automatically catch rejected promises. This caused an `unhandledRejection` event, which triggered a process exit. The previous `tsx watch` supervisor did NOT restart the process on crash, only on file changes, leaving port 5000 dead (ERR_CONNECTION_REFUSED) on all subsequent clicks.
- **Express Error Boundary**:
  - Created `asyncHandler` wrapper (`apps/api/src/utils/asyncHandler.ts`) to forward rejected promises to Express's `next(error)` pipeline.
  - Wrapped ALL routes in `weekly-schedule.routes.ts`, `auth.routes.ts`, and `attendance.routes.ts` with `asyncHandler`.
  - Normal validation errors (`AppError`) and database exceptions now safely return 400/500 HTTP responses without terminating the Node process.
- **Dev Supervisor Architecture (Infinite Loop Fix)**:
  - Previous implementation of `concurrently --restart-tries -1` with `nodemon --exitcrash` resulted in infinite restart storms if port 5000 was occupied or an immediate syntax error occurred on boot.
  - Added a lightweight `scripts/preflight.js` executed *before* `concurrently` that synchronously checks if port 5000 is occupied. If it is, the process manager aborts early with clear PID identification instructions, completely preventing port-conflict restart loops.
  - Changed `concurrently` to bounded restarts: `--restart-tries 3` with `--kill-others-on-fail`. If the API fails 3 times on boot, the Web server is safely killed and the process terminates cleanly.
  - Removed `--exitcrash` from `nodemon`. `nodemon` now resumes its standard responsibility: gracefully logging "app crashed" on unhandled runtime errors and sleeping until the developer edits a source file. This allows `concurrently` to only handle permanent script failures rather than syntax typos.
- **Frontend Save Button Robustness**:
  - Improved `handleSave` in `EmployeeScheduleProfileTab.tsx` to strictly disable the button and show a "Saving..." indicator during the entire lifecycle of the request, preventing rapid double-clicks.
- **Diagnostic Procedure for Port 5000**: 
  - Normal development should no longer require port killing. If `npm run dev` aborts, it clearly prints the preflight failure message.
  - Do **NOT** automatically kill whatever application owns port 5000. 
  - **Verify PID**: Run `Get-NetTCPConnection -LocalPort 5000 -State Listen` to find the OwningProcess ID.
  - **Check Process**: Run `Get-Process -Id <PID>` to verify it is actually `node` running HRISense.
  - **Kill Safely**: Only if verified, use `Stop-Process -Id <PID> -Force`.

## WEEKLY SCHEDULE PERSISTENCE SEMANTICS (EFFECTIVE-DATE ARCHITECTURE)
- **Database State Audit**: Validated that the earlier "failed" saves had actually committed successfully. `EmployeeWeeklySchedule` rows formed a contiguous `effectiveFrom`/`effectiveTo` timeline (e.g., Aug 19, Aug 20, Aug 21) thanks to Prisma transactions. However, because the UI didn't refresh its state and threw generic errors, it created a confusing user experience.
- **Root Cause**: The API endpoint previously threw `"A future schedule change already exists"` if ANY schedule existed after the targeted `effectiveFrom` date. This completely blocked natural schedule timeline operations (like inserting a change before a future change or editing a future change).
- **Backend Resolution (`weekly-schedule.service.ts`)**: 
  - Rewrote the timeline transaction to properly locate the `sameDateSchedule`, `nextSchedule`, and `prevSchedule`.
  - Replaced the hardcoded future block with intelligent boundary splitting: inserting a schedule now safely caps the previous schedule's `effectiveTo` and bounds the new schedule's `effectiveTo` to the next future change.
  - Same-effective-date saves now automatically delete and replace the record inside the transaction, enabling seamless "Edit in place" behavior.
- **Frontend Resolution (`EmployeeScheduleProfileTab.tsx`)**:
  - `openEditor` now correctly initializes `effectiveFrom` to the exact start date of the schedule being edited, instead of forcing `new Date()`.
  - After a successful save, the UI automatically updates the `applicableDate` (View For date) to the successfully saved `effectiveFrom` date, preventing the UI from appearing stuck on a past date.
- **Data Repair**: Backed up and safely reverted the `da700851-cef8-430c-8218-4f6e15813950` test employee's timeline to a clean August 19 state by removing the duplicate/confusing Aug 20 and Aug 21 schedules created during earlier QA crashes.

## SCHEDULE COVERAGE DATE RANGE VISUAL REDESIGN
- **Implementation Status**: COMPLETE
- **Component Updated**: `ScheduleCoverageTab.tsx`
- **Visuals Implemented**:
  - Single date selection applies strong HRISense teal tint and a ring constraint.
  - Date range endpoints (Start/End) receive strong highlight pills and helper labels ("Start", "End").
  - Inter-range cells share a continuous light-teal tint to visually connect the selection.
  - Interactive calendar surface expanded: users can click anywhere inside the cell to select a date. 
  - Restored drawer toggle to a dedicated `Eye` icon for explicit interaction without blocking date clicks.
- **Rules Preserved**:
  - No calendar/date library installed.
  - Database schema, coverage business calculations, and API endpoints left completely untouched.
  - Selected states do not occlude standard counts (Working, Not Set, Needs Setup).
- **Web Build**: SUCCESS.
- **Manual Browser QA**: PENDING USER TESTING.

## TRAINING & SEMINARS — SECURE FILE WORKFLOW (CERTIFICATES + ACTIVITY DOCUMENTS)
- **Implementation Status**: COMPLETE
- **Backend Infrastructure**:
  - Disk storage directory initialized at `uploads/training`.
  - Multer upload configuration with 10MB limits, randomized 16-byte hex filenames, strict MIME type whitelist (PDF, JPG, PNG, WEBP, DOC, DOCX), and forbidden executable extension checks.
  - Endpoints in `apps/api/src/routes/training.routes.ts`:
    - `POST /:id/participants/:employeeId/certificate` (`authorize(['FULL'])` — upload/replace participant certificate)
    - `GET /:id/participants/:employeeId/certificate` (Stream participant certificate with FULL HR or own employee self-view authorization)
    - `POST /:id/documents` (`authorize(['FULL'])` — upload activity document)
    - `GET /:id/documents/:documentId` (`authorize(['FULL'])` — stream activity document restricted strictly to FULL HR)
  - Safe Replacement & Upload Cleanup:
    - Certificate metadata update and audit log creation are executed inside an atomic Prisma transaction (`prisma.$transaction(async (tx) => { ... })`).
    - If the transaction fails at any point (DB update or audit creation), the transaction rolls back completely and the newly uploaded physical file is safely unlinked. The existing database record and existing physical certificate remain intact.
    - Only *after* the atomic transaction successfully commits, the old physical certificate is safely unlinked.
    - Robust path containment checking (`path.resolve`, `path.relative`, `path.basename`) rejects any directory traversal attempts or invalid storage targets.
  - Controller handlers and `TrainingService` methods with audit logging (`TRAINING_CERTIFICATE_UPLOADED`, `TRAINING_DOCUMENT_UPLOADED`).
- **Frontend Integration**:
  - `apps/web/src/services/training.service.ts`: Added `uploadCertificate`, `downloadCertificate`, `uploadActivityDocument`, `downloadActivityDocument`, and updated `EmployeeTrainingHistoryItem` with certificate metadata.
  - `apps/web/src/pages/Training/components/TrainingDetailModal.tsx`:
    - Separated Activity Documents section from `materialsUrl` external link.
    - Activity Documents section and upload/download buttons strictly displayed to `FULL` HR.
    - `materialsUrl` remains participant-accessible external link.
    - Added Certificate column to Participant Roster table with certificate badge, authenticated download, and upload/replace dialog for `FULL` HR.
  - `apps/web/src/pages/Employees/components/EmployeeTrainingProfileTab.tsx`:
    - Added Certificate column with authenticated `Download Certificate` button for self-view and authorized HR view.
- **Verification**:
  - `apps/api` build (`tsc`): PASS (0 errors).
  - `apps/web` build (`tsc -b && vite build`): PASS (2.54s, 0 errors).
  - `react-router-dom` audit: PASS (0 occurrences).
- **Manual Browser QA**: PENDING USER TESTING.

## HR WORKFLOW MODAL UI/UX REDESIGN (COMPLIANCE, MEDICAL, PSYCHOLOGICAL, TRAINING, EVALUATIONS)
- **Implementation Status**: COMPLETE
- **Overview**: Completely overhauled the HR workflow modal experience across Compliance, Medical, Psychological, Training, and Performance Evaluation modules into clean, guided, and modern flows following a consistent design system.
- **Shared UI Primitives Created (`apps/web/src/components/shared/`)**:
  - `WorkflowModal.tsx`:
    - `WorkflowModalHeader`: Fixed/sticky header with icon, title, 1-line subtitle, and close button.
    - `WorkflowModalFooter`: Fixed/sticky footer with Cancel/Back buttons, primary action button (e.g. "Create Requirement", "Save Medical Record"), disabled state, and loading spinner ("Saving...", "Creating...").
    - `WorkflowStepper`: Compact horizontal step navigation for multi-step workflows with step numbers and completion checkmarks.
    - `WorkflowSection`: Clean section headers with subtle icons, clear titles, and short helper lines.
  - `EmployeePicker.tsx`:
    - Searchable employee selector starting with a collapsed search input.
    - Popover dropdown revealing 5-7 results on focus/input with employee name, role, department/unit, and employee number badge.
    - Compact selected state showing avatar initials, employee details, and a quick "[Change]" button.
    - Friendly empty state ("No employees match your search").
  - `FileUploadCard.tsx`:
    - Clean custom file upload zone replacing raw browser inputs.
    - Supported formats label (PDF, JPG, PNG, DOC, DOCX up to 10MB) and browse trigger.
    - Selected state displaying file name, formatted size (KB/MB), and a quick "[Remove]" button.
- **Redesigned Modals**:
  1. **Create Compliance Requirement** (`CompliancePage.tsx`):
     - Structured into 3 clear sections: Requirement Details, Who Needs This? (All, Unit, Department, Job Role, Specific Employee), and Validity & Expiry Tracking (segmented choice with progressive revelation of reminder days).
     - Integrated `EmployeePicker` for specific employee targeting.
  2. **Add Medical Record** (`MedicalPage.tsx`):
     - Structured into 5 clean sections: Employee (`EmployeePicker`), Examination Details (Exam type, Exam date, Facility), Validity & Compliance (linked compliance requirement and expiry date), HR Confidential Notes (subtle amber-themed restricted section with Lock icon), and Medical Report (`FileUploadCard`).
  3. **Add Psychological Record** (`PsychologicalPage.tsx`):
     - Structured into 5 clear sections: Employee (`EmployeePicker`), Assessment Details (Type, Date, Clinician, Expiry), Result Visibility (Employee-visible summary with Eye icon), HR Confidential Notes (Protected restricted card with Lock icon), and Protected Document (`FileUploadCard` + document visibility selector for HR Only vs Employee Can View).
  4. **Create Training / Seminar Activity** (`TrainingActivityModal.tsx`):
     - Guided 3-step workflow: 1 Details (Title, Type, Provider, Venue, Schedule, and Collapsible Additional Details for Hours, Capacity, Materials, Compliance link), 2 Participants (Targeting cards, real-time resolved participant count, collapsible view list, inline capacity warning), 3 Review (human-readable summary card before submission).
  5. **Create Evaluation Cycle** (`EvaluationCycleModal.tsx`):
     - Guided 3-step workflow: 1 Details (Cycle name, Template selector with empty-state warning if no active templates exist, Start/Due dates), 2 Employees (Target scope cards, resolved employee count preview), 3 Evaluators (Immediate Supervisor, One Evaluator with `EmployeePicker`, Manual per-assignment, and cycle summary review).
  6. **Create / Edit Evaluation Template** (`EvaluationTemplateModal.tsx`):
     - Guided 4-step workflow: 1 Template (Name & description), 2 Rating (Selectable rating method cards: Numeric with progressive min/max, 5-point Likert, 4-point Satisfaction, Descriptive; Weighted scoring toggle), 3 Criteria Builder (Compact criteria cards with up/down reordering, rating/comment required checkboxes, weight percentage input, real-time total weight tracker), 4 Review (Template summary card before creation/saving).
- **Non-Regression & Business Logic**:
  - Zero backend or database schema modifications.
  - Zero changes to existing API payloads, business rules, or permission models.
  - No Admin role created or assumed.
- **Verification**:
  - `apps/web` build (`tsc -b && vite build`): SUCCESS (0 errors).
  - `react-router-dom` audit: PASS (0 occurrences).
- **Manual Browser QA**: PENDING USER TESTING.

## HR WORKFLOW MODALS — LARGE DESKTOP NO-SCROLL UX PASS
- **Implementation Status**: COMPLETE
- **Overview**: Resolved unnecessary vertical scrolling across desktop HR workflow modals by maximizing horizontal screen real estate (950px to 1250px widths) and implementing smart multi-column grid layouts with localized scrolling.
- **Shared Primitive Enhancements (`apps/web/src/components/shared/`)**:
  - `WorkflowModal.tsx`:
    - Compact desktop header (~60–65px) with single-line subtitle and tight padding.
    - Compact stepper tracker (~48–50px) with horizontal dividers.
    - Compact footer (~58–64px) with fixed action button placement and refined button styles.
  - `EmployeePicker.tsx`:
    - Dropdown results float using `absolute z-50` instead of expanding the dialog height or pushing form controls down.
    - Selected employee displays in a compact, single-row card (~42px) with avatar, role, unit, employee number, and a `[Change]` trigger.
  - `FileUploadCard.tsx`:
    - Compact single-row drop/browse card (~40–44px) replacing 120px+ drop zones with integrated browse trigger and remove button.
- **Specific Modal Layouts**:
  1. **Compliance Requirement Modal** (`max-w-4xl` ~950–1000px):
     - Top row: Left 60% (Requirement Name + Description) and Right 40% (Category + Expiry Tracking with progressive reminder days).
     - Bottom row: Full-width scope targeting cards in 1 row on desktop (All, Unit, Department, Job Role, Specific Employee).
     - Fits without whole-modal vertical scroll on standard desktop viewports (1366x768, 1440x900, 1920x1080).
  2. **Medical Record Modal** (`max-w-5xl` ~1050–1150px):
     - Top row: Compact `EmployeePicker` full width.
     - 2-Column desktop grid:
       - Left: Examination Details (Record Type + Date in 2 cols, Examined By/Facility).
       - Right: Validity & Compliance (Requirement + Valid Until in 2 cols) + compact `FileUploadCard`.
     - Bottom: HR Confidential Notes with 2-row textarea and Lock icon note.
     - Fits without whole-modal vertical scroll on normal desktop screens.
  3. **Psychological Record Modal** (`max-w-6xl` ~1100–1200px):
     - Top row: Compact `EmployeePicker` (purple accent) full width.
     - 2-Column desktop grid:
       - Left: Assessment Details (Type, Date, Clinician/Facility, Requirement, Valid Until).
       - Right: Employee-Visible Summary (2-row textarea with Eye icon) + HR Confidential Notes (2-row textarea with Lock icon).
     - Bottom: Document Upload + Document Visibility (HR Only vs Employee Can View) side-by-side.
     - Fits without whole-modal vertical scroll on normal desktop screens.
  4. **Training Activity Modal** (`max-w-6xl` ~1150–1250px):
     - Step 1 (Details): Row 1 (Title 70% + Type 30%), Row 2 (Provider 50% + Venue 50%), Row 3 (Description), Row 4 (Start Schedule + End Schedule in 2 cards), Collapsible Additional Details (2x2 grid). Fits on desktop without scroll.
     - Step 2 (Participants): 1-row scope cards, 2-column layout (Left: Target config with local scroll for employees; Right: Target summary card with capacity indicator and toggleable participant view list). Fits on desktop without scroll.
     - Step 3 (Review): 2-column dashboard summary cards (Left: Activity details & schedule; Right: Participants, capacity, compliance). Fits on desktop without scroll.
  5. **Evaluation Cycle Modal** (`max-w-6xl` ~1100–1200px):
     - Step 1 (Details): Row 1 (Name 50% + Template 50%), Row 2 (Start Date 50% + Due Date 50%), Row 3 (Description). Inline empty-template warning. Fits without scroll.
     - Step 2 (Employees): 1-row scope cards, 2-column layout (Left: Scope config; Right: Target employee summary with localized view list). Fits without scroll.
     - Step 3 (Evaluators & Review): 1-row assignment method cards, Lead evaluator picker with floating dropdown if single evaluator, 2-column cycle summary. Fits without scroll.
  6. **Evaluation Template Modal** (`max-w-6xl` ~1100–1200px):
     - Step 1 (Template): Name & Description. Fits without scroll.
     - Step 2 (Rating): 4 rating method cards in 1 row on wide desktop, Numeric min/max in 1 row, Weighted scoring toggle in compact row. Fits without scroll.
     - Step 3 (Criteria Builder): 2-column layout (Left: Criteria editor list with **localized vertical scroll** up to 360px; Right Sidebar: Sticky summary card with total count, weighted yes/no, total weight badge, and `+ Add Criterion` button). Whole modal stays fixed while only the criteria list scrolls when many criteria exist.
     - Step 4 (Review): 2-column template summary card. Fits without scroll.
- **Verification**:
  - `apps/web` build (`tsc -b && vite build`): SUCCESS (2.34s, 0 errors).
  - `react-router-dom` audit: PASS (0 occurrences).
- **Manual Browser QA**: PENDING USER TESTING.

### [2026-08-24] UI/UX REDESIGN: COMPLETE GUIDED WORKFLOWS ACROSS ALL HR MODALS (TRUE STEP-BY-STEP WIZARDS)
- **Problem Statement**:
  - Previous modal layouts still presented too much information simultaneously inside one screen, causing confusion for older or non-technical HR personnel.
- **Architecture & UX Rule Applied**:
  - **ONE STEP = ONE SIMPLE TASK**: True wizard experience across all 5 HR operational modules.
  - Active step strictly isolates inputs; future steps are invisible until `Next` is pressed.
  - Interactive top stepper with badge indicators: completed (`✓`), current (`●`), future (`○`), and mobile responsive summary (`Step X of Y: [Name]`).
  - Left-aligned `[Cancel]`, right-aligned `[Back]` (when step > 1) and `[Next]` / `[Save / Create]`.
  - Non-destructive form state persistence when moving back and forth between wizard steps.
  - Every workflow ends with a clean, read-only Review step summarizing all choices with confidential notes protected from full-text exposure.
- **Redesigned Workflows**:
  1. **Medical Record Modal** (`MedicalPage.tsx` — 4 Steps):
     - Step 1 (Employee): Target employee picker with validation.
     - Step 2 (Examination): Exam type, date, and facility/clinician.
     - Step 3 (Record Details): Compliance requirement link, validity date, HR confidential notes (amber locked card), file attachment card.
     - Step 4 (Review): Read-only summary card with masked HR notes (`Added (Protected)` / `None`).
  2. **Psychological Record Modal** (`PsychologicalPage.tsx` — 5 Steps):
     - Step 1 (Employee): Target employee picker (purple accent).
     - Step 2 (Assessment): Assessment type, date, clinician/clinic.
     - Step 3 (Requirement): Compliance requirement link, validity date with helper text.
     - Step 4 (Notes & Privacy): Employee-visible summary card (Eye icon), HR confidential notes card (Lock icon), document upload with HR only vs HR & Employee visibility selector.
     - Step 5 (Review): Read-only review dashboard with masked confidential notes.
  3. **Compliance Requirement Modal** (`CompliancePage.tsx` — 4 Steps):
     - Step 1 (Requirement): Requirement name, category, and description.
     - Step 2 (Who Needs It?): 5 plain selection cards (Everyone, Unit, Department, Job Role, Specific Employee) with dynamic sub-pickers and live audience estimate badge.
     - Step 3 (Validity): Two large choices (No expiration vs Has expiration date with reminder notice interval).
     - Step 4 (Review): Read-only summary card.
  4. **Training / Seminar Activity Modal** (`TrainingActivityModal.tsx` — 4 Steps):
     - Step 1 (Activity): Title, type, facilitator, venue, description.
     - Step 2 (Schedule & Details): Start and end schedule cards side-by-side, hours credit, capacity, materials link, compliance requirement linkage.
     - Step 3 (Participants): Scope cards, localized employee search and roster builder, capacity indicator.
     - Step 4 (Review): Read-only activity review dashboard.
  5. **Evaluation Cycle Modal** (`EvaluationCycleModal.tsx` — 3 Steps):
     - Step 1 (Review Details): Cycle name, template selector (with empty notice validation), start and due dates, description.
     - Step 2 (Employees): Scope selection cards and target staff roster preview.
     - Step 3 (Evaluators & Review): Immediate Supervisor vs One Evaluator vs Manual Assignment + Cycle summary.
  6. **Evaluation Template Modal** (`EvaluationTemplateModal.tsx` — 4 Steps):
     - Step 1 (Template): Template name and description.
     - Step 2 (Rating): 4 rating method cards (Numeric, 5-Point, 4-Point Satisfaction, Written/Descriptive), score range, weighted scoring toggle.
     - Step 3 (Criteria Builder): Localized vertical scroll list (`max-h-[360px] overflow-y-auto`) with count/weight summary bar, inline 100% weight validation, `+ Add Criterion`.
     - Step 4 (Review): Template summary card with criteria list.
- **Verification**:
  - `apps/web` build (`tsc -b && vite build`): SUCCESS (0 errors, 3.28s).
  - `apps/api` build (`tsc`): SUCCESS (0 errors).
  - `react-router-dom` audit: PASS (0 occurrences across entire web package).
- **Git Commit**: `refactor(ui): convert HR forms to guided workflows`

### [2026-08-24] UI/UX SIZING CORRECTION: ENLARGED GUIDED WORKFLOW MODAL WORKSPACES
- **Problem Statement**:
  - Guided workflow modals previously suffered from vertical height collapse (`max-h` without minimum/fixed height), appearing as small cramped dialogs floating in the center with footers colliding with search results.
- **Architectural & Layout Changes**:
  - **Shared Modal Shell Utility (`workflowModalStyles`)**:
    - Desktop dimensions: Fixed-feeling height of `h-[min(800px,calc(100vh-48px))]` (75–85% of desktop viewport height) with `min-h-[660px]` and widths tailored per workflow:
      - Compliance: `1000–1040px` (`w-[min(1040px,calc(100vw-32px))]`).
      - Medical: `1050–1100px` (`w-[min(1100px,calc(100vw-32px))]`).
      - Psychological, Training, Evaluation Cycle, Evaluation Template: `1100–1180px` (`w-[min(1180px,calc(100vw-32px))]`).
  - **Strict Flex Column Hierarchy**:
    - Header: `flex-shrink-0`
    - Stepper: `flex-shrink-0`
    - Form: `flex flex-col flex-1 min-h-0 overflow-hidden`
    - Content Workspace: `flex-1 overflow-y-auto p-6 md:p-8 min-h-0 flex flex-col justify-start`
    - Footer: `flex-shrink-0 mt-auto` (firmly anchored at the bottom of the spacious modal workspace).
  - **Stable Outer Dimensions**:
    - Dimensions remain fixed across Step 1, 2, 3, 4, and Review. Pressing `Next` or `Back` never resizes or jerks the modal shell.
  - **Employee Search Workspace Variant (`variant="workspace"`)**:
    - Step 1 (Employee Selection in Medical & Psychological):
      - Search bar at the top with inline results panel (`max-h-[340px] overflow-y-auto divide-y`).
      - Only the results list scrolls internally; modal container does not scroll vertically.
      - Upon selection: Replaces list with a clear, comfortable Selected Employee Card with avatar, details, and `[Change Employee]` action.
- **Verification**:
  - `apps/web` build (`tsc -b && vite build`): SUCCESS (0 errors, 2.10s).
  - `react-router-dom` audit: PASS (0 occurrences).
- **Manual Browser QA**: PENDING USER TESTING.
- **Git Commit**: `fix(ui): enlarge guided workflow modals`

---

## Announcements Feature — Checkpoint 1: Database Schema + Safe Migration

- **Overview**: In-place schema upgrade of the Announcements database architecture to support
  the full Announcement lifecycle (Draft → Scheduled → Published → Expired → Archived),
  audience scope targeting, recipient snapshots, read tracking, and secure attachment metadata.
  No `DROP TABLE` used. All existing announcement rows preserved.

### Pre-Migration Database Inspection
| Item | Value |
|---|---|
| Main database | `hrisense_db` |
| Prisma provider | MySQL |
| Initial migrate status | 12 migrations — Database schema is up to date |
| `announcements` row count (pre-migration) | **4 rows** (all seed data; fire drill, leave procedure, DSWD license, welcome message) |
| `announcement_attachments` row count (pre-migration) | **0 rows** |
| Existing data classification | **Seed/demo only** — all 4 rows authored by single HR seed user, `audience='ALL'`, all `publishedAt` set, `content VARCHAR(191)` (truncated) |

### New Enums Added
- **`AnnouncementState`**: `DRAFT | ACTIVE | ARCHIVED` — drives derived statuses at query time (Scheduled = ACTIVE + publishAt > now; Published = ACTIVE + publishAt ≤ now; Expired = ACTIVE + expiresAt ≤ now)
- **`AnnouncementScopeType`**: `ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE` — announcement-specific enum, intentionally separate from `RequirementScopeType` (Announcements ≠ Compliance domain)
- **`RequirementScopeType` NOT reused** ✅

### Announcement Model Changes (In-Place ALTER TABLE)
Fields **added** to existing `announcements` table:
- `body TEXT` — full-text announcement body (replaces truncated `content VARCHAR(191)`)
- `state AnnouncementState DEFAULT 'DRAFT'` — lifecycle state machine
- `publishAt DATETIME(3)` — replaces `publishedAt`; set at activation time
- `archivedAt DATETIME(3)` — set when HR archives
- `createdByUserId VARCHAR(191)` — FK to `users.id` (nullable; seed rows have no User FK)

Fields **dropped** from `announcements` table:
- `publishedAt` — migrated to `publishAt` via `UPDATE` backfill before drop
- `deletedAt` — all 4 existing values were `NULL`; safe to remove (new approach uses `state = ARCHIVED`)

Legacy columns **intentionally retained**:
- `content VARCHAR(191)` — original message preserved; `body` backfilled from it
- `audience AnnouncementAudience` — legacy enum column, no longer queried by new service
- `targetUnitId`, `targetJobRoleId`, `targetEmployeeId`, `authorId` — legacy deprecated columns

### Migration Backfill Steps
1. `UPDATE announcements SET body = content WHERE body IS NULL` — content preserved in body
2. `UPDATE announcements SET publishAt = publishedAt WHERE publishedAt IS NOT NULL` — publish date migrated
3. `UPDATE announcements SET state = 'ACTIVE' WHERE publishedAt IS NOT NULL` — seed rows set to ACTIVE (published)

### New Models Added
**`AnnouncementAudienceScope`** (`announcement_audience_scopes`):
- `id`, `announcementId`, `scopeType (AnnouncementScopeType)`, `targetUnitId?`, `targetDepartmentId?`, `targetJobRoleId?`, `targetEmployeeId?`, `createdAt`
- Cascade delete on `announcementId`
- No fake scopes created for legacy seed rows

**`AnnouncementRecipient`** (`announcement_recipients`):
- `id`, `announcementId`, `employeeId`, `readAt?`, `createdAt`
- **`UNIQUE(announcementId, employeeId)`** constraint enforced
- Indexes: `announcementId`, `employeeId`, `readAt`
- No fake recipients created for legacy seed rows

### AnnouncementAttachment Changes (In-Place)
Fields **added** (all nullable):
- `originalFilename VARCHAR(191)` — display name
- `storedFilename VARCHAR(191) UNIQUE` — server-side random name (secure)
- `mimeType VARCHAR(191)` — validated at upload
- `sizeBytes INT` — file size
- `uploadedByUserId VARCHAR(191)` — FK to `users.id`

Legacy fields **retained**: `fileName`, `fileUrl` (0 existing rows; kept for migration safety)

### Relation Updates
| Model | Change |
|---|---|
| `User` | Added `createdAnnouncements` (`AnnouncementCreator` relation) and `uploadedAnnouncementAttachments` (`AttachmentUploader` relation) |
| `Employee` | Replaced `authoredAnnouncements` with `announcementAudienceScopes` and `announcementRecipients` |
| `Unit` | Replaced `announcements` (legacy direct relation) with `announcementScopes` |
| `Department` | Added `announcementScopes` |
| `JobRole` | Added `announcementScopes` |

### Migration Authoring Environment
- **Authoring DB**: `hrisense_migration_dev_db` (NOT `hrisense_db`) ✅
- **Method**: `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` (non-interactive; reviewed SQL against main DB)
- **Migration name**: `20260825065105_add_announcements_feature`
- **SQL review result**: No `DROP TABLE` statements ✅; all ALTERs are additive or safe drops; backfill UPDATEs manually added

### Deployment
- **Fresh backup**: `hrisense_db_backup_pre_announcements_20260825_065153.sql` (1,157,058 bytes) ✅
- **Command**: `prisma migrate deploy` (NEVER `migrate dev`, `db push`, or `migrate reset`) ✅
- **Result**: Migration applied successfully — 13 migrations total
- **Post-deploy status**: `Database schema is up to date!` ✅
- **`prisma generate`**: Completed successfully (DLL not swapped due to running dev server — TypeScript types updated in `index.d.ts`) ✅
- **`prisma validate`**: Schema valid ✅

### Post-Migration Data Verification
| Check | Result |
|---|---|
| `announcements` row count | **4** — all preserved ✅ |
| `announcement_attachments` row count | **0** — unchanged ✅ |
| `body` backfill | All 4 rows have `body` matching `content` ✅ |
| `publishAt` backfill | All 4 rows have `publishAt` matching old `publishedAt` ✅ |
| `state` backfill | All 4 rows set to `ACTIVE` (were historically published) ✅ |
| `announcement_audience_scopes` rows | 0 — no fake scopes created ✅ |
| `announcement_recipients` rows | 0 — no fake recipients created ✅ |
| New tables present | `announcement_audience_scopes`, `announcement_recipients` ✅ |
| `UNIQUE(announcementId, employeeId)` | Constraint exists ✅ |
| `storedFilename UNIQUE` on attachments | Index created ✅ |

### Safety Confirmations
- `prisma db push` NOT used ✅
- `prisma migrate dev` NOT run on main ✅
- `prisma migrate reset` NOT used ✅
- No `DROP TABLE announcements` ✅
- No `DROP TABLE announcement_attachments` ✅
- No fake recipients created ✅
- No fake audience scopes created ✅

### Build Fixes
`announcement.routes.ts` — replaced old inline controller (used removed `deletedAt`/`publishedAt`/`author` fields) with a minimal build-safe placeholder. Full implementation in Checkpoint 2.

`dashboard.service.ts` — updated two announcement query blocks: `deletedAt → state='ACTIVE'`, `publishedAt → publishAt`, `author → removed`, `content → body`.

### API Build Result
- **`npm run build --prefix apps/api` (tsc)**: **0 errors** ✅

### Files Modified
- `apps/api/prisma/schema.prisma` (MODIFIED — enums + model upgrades)
- `apps/api/prisma/migrations/20260825065105_add_announcements_feature/migration.sql` (NEW)
- `apps/api/src/routes/announcement.routes.ts` (MODIFIED — placeholder)
- `apps/api/src/services/dashboard.service.ts` (MODIFIED — schema field updates)
- `hrisense_db_backup_pre_announcements_20260825_065153.sql` (NEW — backup)

### Known Legacy Issues
- The legacy `content VARCHAR(191)` column and `audience`/`targetUnitId`/`targetJobRoleId`/`targetEmployeeId`/`authorId` columns remain in the `announcements` table. These will be formally deprecated and optionally removed in a future clean-up migration after the full Announcements feature is live.
- `announcement_attachments.fileName` and `fileUrl` columns remain but are unused by new service logic.

### Git Commit
- `feat(announcements): add announcement data model`

### Status
- **ANNOUNCEMENTS CHECKPOINT 1 — DATABASE SCHEMA + SAFE MIGRATION: COMPLETE** ✅

### Exact Next Checkpoint
**ANNOUNCEMENTS CHECKPOINT 2 — BACKEND CORE**
(AnnouncementService, AnnouncementController, full routes with audience resolution, atomic publish/schedule, mark-read security, attachment upload, recipient stats)


---

## Announcements Feature — Checkpoint 2: Backend Core Workflow

### Checkpoint 1 Compile-Fix Audit

During CP1, two files were modified to fix TypeScript build errors caused by the schema migration:

**`apps/api/src/services/dashboard.service.ts`** — The two announcement query blocks used removed schema fields:
- `deletedAt` (dropped from `announcements` table in CP1 migration)
- `publishedAt` (renamed to `publishAt` in CP1 migration)
- `author` (replaced by `createdByUserId → User` relation)
- `content` (soft-deprecated; replaced by `body`)

Fix applied: `deletedAt → state='ACTIVE'`, `publishedAt → publishAt`, `author include → removed`, `content select → body`. Dashboard queries now correctly show currently published announcements.

**`apps/api/src/routes/announcement.routes.ts`** — The old inline route handler used all the removed fields above plus the legacy `author` include. No partial Announcement business logic was introduced — only a minimal CP2 placeholder stub (single GET / returning empty data) was left, which CP2 replaces entirely.

**Verdict**: CP1 changes were compile-compatibility fixes only. No partial Announcement backend logic was layered into CP1.

---

### Legacy 4 Announcement Row State (Post-Migration)

| Title | state | publishAt | body | createdByUserId | archivedAt |
|---|---|---|---|---|---|
| Mandatory Fire Safety Drill — July 28, 2026 | ACTIVE | 2026-07-15 | ✅ backfilled | NULL | NULL |
| Reminder: DSWD License Renewal Documentation | ACTIVE | 2026-07-10 | ✅ backfilled | NULL | NULL |
| Welcome to HRISense! | ACTIVE | 2026-07-01 | ✅ backfilled | NULL | NULL |
| Updated Leave Request Procedure Effective August 1, 2026 | ACTIVE | 2026-07-12 | ✅ backfilled | NULL | NULL |

**Derived status**: All 4 rows resolve as **EXPIRED** at runtime (state=ACTIVE, publishAt ≤ now, expiresAt NULL... wait — expiresAt is NULL so they resolve as PUBLISHED). Because these legacy rows have `expiresAt = NULL` and `publishAt` in the past, they resolve as `PUBLISHED`. They have **no AnnouncementRecipient rows**. STANDARD/SUPERVISOR users cannot see them (no recipient membership). FULL HR can see them through `/announcements/hr`. They are tolerated safely by the new backend.

---

### Checkpoint 2 Implementation

#### AnnouncementService

**Path**: `apps/api/src/services/announcement.service.ts`

**Methods implemented**:

| Method | Description |
|---|---|
| `previewAudience(scopes)` | Resolves audience without persisting. Returns `totalRecipients + previewEmployees (max 20)`. Zero allowed. |
| `createDraft(data, creatorUserId)` | Creates DRAFT with title + body required. Scopes stored if provided. No recipient snapshot. |
| `updateAnnouncement(id, data, actorUserId)` | State-dependent update: DRAFT (all fields), SCHEDULED (all + scopes rebuild snapshot), PUBLISHED/EXPIRED (audience locked — scopes/publishAt rejected), ARCHIVED (rejected). |
| `activateNow(id, actorUserId)` | Atomic Prisma transaction: validate → resolve audience → deduplicate → reject zero → replace snapshot → set ACTIVE/publishAt=now → audit. |
| `schedule(id, publishAt, actorUserId)` | Atomic Prisma transaction: validate future date → validate scopes → resolve audience → reject zero → replace snapshot → set ACTIVE/publishAt=future → audit. |
| `archive(id, actorUserId)` | Sets state=ARCHIVED, archivedAt=now. Preserves all history. |
| `deleteDraft(id, actorUserId)` | Hard deletes DRAFT only. Blocked if attachment rows exist (CP3 safety gate). |
| `listForHR(filters)` | Paginated HR management list with search, status filter (derived), priority filter. |
| `getSummaryStats()` | Returns exact DB counts: drafts, scheduled, published, expired, archived. |
| `getById(id, currentUser)` | Dual-mode: FULL gets full management record; SUPERVISOR/STANDARD must be recipient AND announcement must be PUBLISHED or EXPIRED. |
| `listForRecipient(employeeId, filter)` | Recipient feed: `current` (PUBLISHED, not expired, not archived) or `past` (EXPIRED historical). Ordered: isPinned DESC → priority (URGENT>IMPORTANT>NORMAL) → publishAt DESC. |
| `getUnreadCount(employeeId)` | Counts current unread only (CURRENT set). Does NOT include expired. |
| `getDashboardData(employeeId)` | Returns up to 3 current announcements + unreadCurrentCount. No mark-read side effect. |
| `markRead(announcementId, currentUser)` | **UPDATE-only, no upsert**. Flow: require employeeId → find AnnouncementRecipient → 403 if not found → check visibility → deny for DRAFT/SCHEDULED/ARCHIVED → idempotent (return existing readAt if set) → UPDATE readAt=now. |
| `getRecipientStats(announcementId)` | Returns totalRecipients, readCount, unreadCount from snapshot. |
| `listRecipients(announcementId, filters)` | Paginated recipient list (FULL only). Supports search, readFilter (all/read/unread). Safe employee fields only. |

#### Audience Resolution

**`resolveAudienceToEmployeeIds(scopes)`** — private function:
- Queries DB directly (NOT paginated API)
- Filters active employees: `{ deletedAt: null, employmentState: EmploymentState.ACTIVE }`
- Supports: ALL, UNIT, DEPARTMENT, JOB_ROLE, EMPLOYEE
- Additive: union of all scope results
- Deduplication via `Set<string>`
- EMPLOYEE scope re-validates the specific employee is still ACTIVE

**`validateAndNormalizeScopes(scopes)`** — private function:
- Calls `validateScopeShape()` for structural validation
- Verifies referenced Unit/Department/JobRole/Employee exists in DB
- For EMPLOYEE scope: checks not resigned/terminated/retired
- Throws friendly AppError on any violation

**Scope validation rules**:
- `ALL`: no target IDs allowed
- `UNIT`: exactly `targetUnitId` required, others null
- `DEPARTMENT`: exactly `targetDepartmentId` required, others null
- `JOB_ROLE`: exactly `targetJobRoleId` required, others null
- `EMPLOYEE`: exactly `targetEmployeeId` required, others null

**ALL scope behavior**: Resolves all active employees. Other scopes can overlap; deduplication prevents duplicates.

#### Derived Status

**`getDerivedStatus(announcement, now)`** — pure function, no DB call:
```
DRAFT     → state = DRAFT
ARCHIVED  → state = ARCHIVED
SCHEDULED → state = ACTIVE AND publishAt > now
PUBLISHED → state = ACTIVE AND publishAt ≤ now AND (expiresAt null OR > now)
EXPIRED   → state = ACTIVE AND publishAt ≤ now AND expiresAt ≤ now
```
NO cron. NO background scheduler. Computed at every query point.

#### Recipient Snapshot

**`replaceRecipientSnapshot(announcementId, employeeIds, tx)`** — private:
- Runs inside Prisma transaction
- Deletes existing recipient rows → inserts fresh ones
- Uses `skipDuplicates: true` + DB `UNIQUE(announcementId, employeeId)` as double protection
- Snapshot created at: schedule time OR activate time
- Snapshot rebuilt: if audience scopes change while still SCHEDULED

#### Concurrency Protection

- State guard re-checked inside transaction after initial load
- If two activate requests race: inner transaction check catches second attempt → 409
- UNIQUE DB constraint prevents duplicate recipient rows

#### Authorization

| Route | Permission |
|---|---|
| `POST /audience-preview` | FULL |
| `GET /hr` | FULL |
| `GET /stats` | FULL |
| `GET /dashboard` | All authenticated |
| `GET /unread-count` | All authenticated |
| `GET /` | All authenticated (own recipient feed) |
| `POST /` | FULL |
| `GET /:id` | All authenticated (service-level: FULL management OR recipient) |
| `PUT /:id` | FULL |
| `POST /:id/activate` | FULL |
| `POST /:id/schedule` | FULL |
| `POST /:id/archive` | FULL |
| `DELETE /:id` | FULL |
| `POST /:id/read` | All authenticated (service-level recipient check) |
| `GET /:id/recipients` | FULL |
| `GET /:id/recipients/stats` | FULL |

#### SUPERVISOR Behavior
Receives announcements only as an explicit recipient. No subordinate announcement feed. No announcement management. Same as STANDARD in the announcement domain.

#### STANDARD Behavior
Own recipient feed only. Own readable announcement (PUBLISHED/EXPIRED) only. Own read state only.

#### FULL User Recipient Mode
FULL users may also have `employeeId` and be recipients. HR management access and personal recipient access are both supported. Opening through management endpoint does NOT mark read. Read marking only through `POST /:id/read`.

#### markRead Security Confirmation
- **NO UPSERT** — `prisma.announcementRecipient.update()` used, never `upsert()`
- Non-recipients: 403 (no information leak)
- Idempotent: returns existing `readAt` unchanged
- Denied for: DRAFT, SCHEDULED (future), ARCHIVED
- Allowed for: PUBLISHED and EXPIRED (Past tab historical reads allowed)
- No audit log per read — `readAt` timestamp is sufficient

#### Expiry Behavior
- `expiresAt` is optional
- Validation: `expiresAt > publishAt` (enforced at activation/schedule)
- Expiry does NOT: delete recipient, delete announcement, reset readAt, auto-archive
- Effect only: changes derived status from PUBLISHED → EXPIRED (moves from Current to Past tab)

#### Dashboard Backend Helper
- `GET /announcements/dashboard` returns `{ announcements: [up to 3], unreadCurrentCount }`
- Current announcements only (not expired, not archived)
- No HR management metrics exposed
- Employees with no `employeeId` get empty safe response

#### No External Integrations
- NO Notification model rows created ✅
- NO email/SMS/push ✅
- NO AI-generated content ✅
- NO cron/background scheduler ✅
- NO Admin role ✅
- NO attachment routes (Checkpoint 3) ✅

#### Audit Log Events
| Action | Trigger |
|---|---|
| `ANNOUNCEMENT_CREATED` | Draft created |
| `ANNOUNCEMENT_UPDATED` | Announcement updated (any lifecycle except ARCHIVED) |
| `ANNOUNCEMENT_ACTIVATED` | Published now (inside transaction) |
| `ANNOUNCEMENT_SCHEDULED` | Scheduled for future (inside transaction) |
| `ANNOUNCEMENT_ARCHIVED` | Archived |
| `ANNOUNCEMENT_DRAFT_DELETED` | Draft hard-deleted |

Reads are NOT audited — `AnnouncementRecipient.readAt` is sufficient.
Transactional audit logs (ACTIVATED, SCHEDULED) use `tx` client to maintain atomicity.

#### AnnouncementController

**Path**: `apps/api/src/controllers/announcement.controller.ts`

Thin HTTP adapter. All business logic delegated to `AnnouncementService`. No inline Prisma calls. Follows project controller pattern (Request/Response/NextFunction, `try/catch(next)`).

#### Route List

**Path**: `apps/api/src/routes/announcement.routes.ts`

Static routes registered BEFORE `/:id` to prevent Express swallowing them as ID params:

```
POST   /announcements/audience-preview      — FULL
GET    /announcements/hr                    — FULL
GET    /announcements/stats                 — FULL
GET    /announcements/dashboard             — All authenticated
GET    /announcements/unread-count          — All authenticated
GET    /announcements/                      — All authenticated (recipient feed)
POST   /announcements/                      — FULL (create draft)
GET    /announcements/:id                   — All authenticated (dual-mode)
PUT    /announcements/:id                   — FULL
POST   /announcements/:id/activate          — FULL
POST   /announcements/:id/schedule          — FULL
POST   /announcements/:id/archive           — FULL
DELETE /announcements/:id                   — FULL (DRAFT only)
POST   /announcements/:id/read              — All authenticated (recipient check)
GET    /announcements/:id/recipients        — FULL
GET    /announcements/:id/recipients/stats  — FULL
```

Attachment routes NOT implemented (Checkpoint 3).

### Files Created/Modified

- `apps/api/src/services/announcement.service.ts` (NEW)
- `apps/api/src/controllers/announcement.controller.ts` (NEW)
- `apps/api/src/routes/announcement.routes.ts` (MODIFIED — full CP2 implementation)

### Database / Schema Confirmation
- Schema NOT modified in CP2 ✅
- No migrations created ✅
- `prisma db push` NOT run ✅
- `prisma migrate dev` NOT run ✅
- `prisma migrate reset` NOT run ✅
- Frontend NOT modified ✅

### API Build Result
- **`npm run build --prefix apps/api` (tsc)**: **0 errors** ✅

### Known Backend Gaps
- Attachment upload/download/delete routes: **Checkpoint 3**
- Dashboard widget frontend update: **Checkpoint 4 (Frontend)**
- Sidebar unread badge wiring: **Checkpoint 4 (Frontend)**
- HR Announcements management page: **Checkpoint 4 (Frontend)**
- Employee recipient feed page: **Checkpoint 4 (Frontend)**

### Git Commit
- `feat(announcements): implement announcement workflows`

### Status
- **ANNOUNCEMENTS CHECKPOINT 2 — BACKEND CORE: COMPLETE** ✅

---

## Announcements Feature — Checkpoint 3: Protected Attachments + Safe File Cleanup

### Security Audit & Static Exposure Fix

Prior to Checkpoint 3 implementation, an audit of static file serving in `apps/api/src/index.ts` revealed:
`app.use("/uploads", express.static(path.join(__dirname, "../uploads")))`
This was identified as a security vulnerability that would expose `uploads/announcements` (along with `uploads/training`, `uploads/medical`, `uploads/psychological`) directly to unauthenticated public requests via URL guessing.

**Remediation applied**: The static route in `apps/api/src/index.ts` was completely removed. All protected files across modules are now strictly streamed through authenticated API routes with service-level authorization.

---

### Storage Architecture & Filesystem Safety

- **Protected Directory**: `uploads/announcements` (created on server startup if not present).
- **Physical Filename Generation**: `crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()`.
  - User's original filename is never used as the physical on-disk filename.
  - Original filename is preserved separately in the database (`originalFilename`).
  - Stored filename is never returned in public/authenticated JSON responses.
- **Allowed MIME Types**:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Forbidden Extensions Check**:
  - `.exe`, `.sh`, `.bat`, `.cmd`, `.js`, `.ts`, `.php`, `.py`, `.msi`, `.vbs`, `.ps1`
- **File-Size Limit**: 10 MB per file (`limits: { fileSize: 10 * 1024 * 1024 }`).
  - Handled in `errorHandler.ts` with friendly error: *"This file is too large. Maximum file size is 10 MB."*
- **Path Containment Logic**:
  `resolveSafeAnnouncementFilePath(storedFilename)` strictly verifies that the target path resolves within the root `uploads/announcements` directory using `path.basename` and `path.relative` checks to block directory traversal (`..` or absolute paths).
- **Hardened Safe Unlink**:
  `safeUnlinkAnnouncementFile(storedFilename)` safely unlinks physical files without throwing unhandled exceptions.

---

### Endpoint Implementations

#### 1. Upload Attachment
- **Route**: `POST /announcements/:id/attachments`
- **Authorization**: `authorize(['FULL'])` placed **before** `upload.single('file')` in route middleware so unauthorized users are rejected before Multer writes any file to disk.
- **Allowed Lifecycle**: `DRAFT` or `SCHEDULED` (ACTIVE with `publishAt > now`).
- **Forbidden Lifecycle**: `PUBLISHED`, `EXPIRED`, `ARCHIVED` (returns friendly 400 *"Attachments can only be changed before the announcement is published."*).
- **Transaction**: DB record in `announcement_attachments` + `ANNOUNCEMENT_ATTACHMENT_UPLOADED` audit log created in a single Prisma transaction.
- **Failure Cleanup**: If DB transaction or lifecycle validation fails after Multer wrote the file, the controller's catch block immediately calls `safeUnlinkAnnouncementFile` to prevent orphan physical files.
- **Response**: Safe metadata only (`id`, `announcementId`, `originalFilename`, `mimeType`, `sizeBytes`, `uploadedAt`). `storedFilename` is strictly omitted.

#### 2. Stream / Download Attachment
- **Route**: `GET /announcements/:id/attachments/:attachmentId`
- **Requester Authorization**:
  - **FULL**: May stream/download attachments across all lifecycles (`DRAFT`, `SCHEDULED`, `PUBLISHED`, `EXPIRED`, `ARCHIVED`) for HR management. Does NOT mark personal read.
  - **SUPERVISOR / STANDARD**: Must have authenticated `employeeId`, must have an existing `AnnouncementRecipient` entry for the announcement, and the announcement must be in `PUBLISHED` or `EXPIRED` status. Access is forbidden (403) for `DRAFT`, `SCHEDULED`, `ARCHIVED`, or non-recipients.
- **Cross-Announcement Validation**: Verifies `attachment.announcementId === req.params.id` to prevent lateral ID tampering.
- **Streaming**: Sets `Content-Type: mimeType`, `Content-Disposition: inline; filename="${encodeURIComponent(originalFilename)}"`, and streams via `res.sendFile()`.
- **Missing File Handling**: Returns 410 friendly error *"This attachment is no longer available."* without exposing filesystem paths.

#### 3. Delete Attachment
- **Route**: `DELETE /announcements/:id/attachments/:attachmentId`
- **Authorization**: `authorize(['FULL'])`.
- **Allowed Lifecycle**: `DRAFT` or `SCHEDULED` only.
- **Sequence**:
  1. Load announcement and attachment metadata.
  2. Verify lifecycle allows removal (`DRAFT` / `SCHEDULED`).
  3. Capture `storedFilename`.
  4. DB transaction: delete attachment row + create `ANNOUNCEMENT_ATTACHMENT_REMOVED` audit entry.
  5. Commit.
  6. Safely unlink physical file. (If unlink fails post-commit, warning is logged; DB transaction is not rolled back).

#### 4. List Attachments Metadata
- **Route**: `GET /announcements/:id/attachments`
- Returns array of safe attachment metadata (excluding `storedFilename`).
- `getById` endpoint also returns safe `attachments` array for authorized viewers (both FULL management and recipients).

---

### Draft Deletion Physical File Cleanup (Completing CP2 Safety Gate)

In Checkpoint 2, draft deletion was gated if attachments existed. In Checkpoint 3:
1. `deleteDraft` captures all `storedFilename` values of attachments linked to the draft.
2. In a DB transaction: creates `ANNOUNCEMENT_DRAFT_DELETED` audit log and deletes the announcement (Prisma `onDelete: Cascade` cleans up `AnnouncementAttachment` and `AnnouncementAudienceScope` rows).
3. On transaction commit: safely unlinks all captured physical attachment files from disk.
4. If DB transaction fails: physical files remain intact.

---

### Audit Actions Implemented

| Action | Entity Type | Metadata Logged |
|---|---|---|
| `ANNOUNCEMENT_ATTACHMENT_UPLOADED` | `ANNOUNCEMENT` | `attachmentId`, `originalFilename`, `mimeType`, `sizeBytes` |
| `ANNOUNCEMENT_ATTACHMENT_REMOVED` | `ANNOUNCEMENT` | `attachmentId`, `originalFilename`, `mimeType`, `sizeBytes` |
| `ANNOUNCEMENT_DRAFT_DELETED` | `ANNOUNCEMENT` | `title`, `attachmentCount` |

---

### Files Modified

- `apps/api/src/index.ts` (Removed insecure `/uploads` public static serving)
- `apps/api/src/middleware/errorHandler.ts` (Added friendly `LIMIT_FILE_SIZE` error message)
- `apps/api/src/services/announcement.service.ts` (Added file helpers, attachment CRUD, draft-delete cleanup)
- `apps/api/src/controllers/announcement.controller.ts` (Added attachment upload, streaming, delete, list handlers)
- `apps/api/src/routes/announcement.routes.ts` (Added Multer configuration and attachment endpoints)
- `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (Documented Checkpoint 3)

---

### Verification & Build Result

- **`npm run build --prefix apps/api` (tsc)**: **0 errors** ✅
- **No Schema Changes / No Migrations**: Database schema remains in-place from Checkpoint 1.
- **Frontend Untouched**: Ready for Checkpoint 4.

### Git Commit
- `feat(announcements): add protected attachments`

### Status
- **ANNOUNCEMENTS CHECKPOINT 3 — PROTECTED ATTACHMENTS: COMPLETE** ✅

---

## Announcements Feature — Checkpoint 4: FULL HR Frontend Workspace

### Overview

Checkpoint 4 implements the dedicated FULL HR Announcement Management Workspace in the web frontend, built with `@tanstack/react-router`, modern accessible typography, rich status navigation, and a guided 4-step `WorkflowModal` wizard.

---

### Key Components & Implementations

#### 1. Frontend Service (`apps/web/src/services/announcement.service.ts`)
- Complete TypeScript type definitions matching backend:
  `Announcement`, `AnnouncementPriority`, `AnnouncementState`, `AnnouncementDerivedStatus`, `AnnouncementScopeType`, `AnnouncementAudienceScope`, `AnnouncementAttachment`, `AnnouncementRecipientItem`, `AnnouncementRecipientStats`, `AnnouncementStats`, `AudiencePreviewResponse`, `CreateAnnouncementDto`, `UpdateAnnouncementDto`.
- Full API wrappers matching exact Checkpoint 1–3 routes:
  - `previewAudience()` (`POST /announcements/audience-preview`)
  - `listForHR()` (`GET /announcements/hr`)
  - `getStats()` (`GET /announcements/stats`)
  - `getAnnouncement()` (`GET /announcements/:id`)
  - `createDraft()` (`POST /announcements`)
  - `updateAnnouncement()` (`PUT /announcements/:id`)
  - `activateAnnouncement()` (`POST /announcements/:id/activate`)
  - `scheduleAnnouncement()` (`POST /announcements/:id/schedule`)
  - `archiveAnnouncement()` (`POST /announcements/:id/archive`)
  - `deleteDraft()` (`DELETE /announcements/:id`)
  - `listRecipients()` (`GET /announcements/:id/recipients`)
  - `getRecipientStats()` (`GET /announcements/:id/recipients/stats`)
  - `uploadAttachment()` (`POST /announcements/:id/attachments` via `multipart/form-data`)
  - `downloadAttachment()` (`GET /announcements/:id/attachments/:attachmentId` via blob streaming)
  - `deleteAttachment()` (`DELETE /announcements/:id/attachments/:attachmentId`)
  - `listAttachments()` (`GET /announcements/:id/attachments`)

#### 2. HR Management Page (`apps/web/src/pages/Announcements/AnnouncementsPage.tsx`)
- **Header**: "Announcements" with subtitle "Share important updates with employees and track who has read them." and "+ Create Announcement" primary action.
- **Summary Cards**: Exact values loaded from `GET /announcements/stats`: Published, Scheduled, Drafts, Past.
- **Status Tabs**: All Announcements, Published, Scheduled, Drafts, Past, Archived.
- **Search + Filter**: Live text search and Priority filter (Normal, Important, Urgent).
- **Data Table**: Clean layout with columns for Announcement & Pin, Audience summary, Publish Date, Priority badge, Recipients count, Read Ratio (`read / total`), Status badge, and Actions (View Details, Edit).
- **Empty States**: Context-aware friendly empty states for each tab.
- **Role Isolation**: Non-FULL users see a clear informational placeholder indicating recipient feed activation is scheduled for the next checkpoint.

#### 3. Guided 4-Step Create/Edit Wizard (`AnnouncementWizardModal.tsx`)
- Spacious desktop modal (`workflowModalStyles.container('wide')`, ~1120px width, ~700-820px height) using `WorkflowModalHeader`, `WorkflowStepper`, `WorkflowSection`.
- **Step 1 — Announcement**: Title input (max 150 chars), Message content textarea, Priority choice cards with descriptive copy, Pin toggle, and local attachment staging (`stagedFiles: File[]`) with pre-validation (max 10 MB, allowed file types). Existing attachments displayed with download/removal.
- **Step 2 — Audience**:
  - Additive targeting mode cards: Everyone, Department, Unit, Job Role, Individual Staff.
  - Live debounced preview calling `POST /announcements/audience-preview` displaying live active recipient count and sample preview.
  - Zero-recipient warning prevents proceeding to publish with empty audience.
  - Published announcements lock audience modification with clear UI indicator.
- **Step 3 — Schedule**:
  - Choice cards: "Publish Immediately" vs "Schedule for Later" (with future date/time picker).
  - Expiry options: "No Expiration" vs "Set End Date" (with end date/time picker and past-retention explanation).
- **Step 4 — Review**:
  - Scannable summary of Title, Priority, Pin status, Message body, Audience targeting, Schedule timing, and Attachments list.
  - Actions: Cancel, Back, Save as Draft, and Publish Announcement / Schedule Announcement.
  - **Safe Execution Sequence**: Saves/updates draft first -> uploads staged attachments one by one -> if any attachment fails, stops and keeps draft without activating/scheduling -> if all succeed, calls activate/schedule endpoint.
  - Double-submit protection with loading status indicators ("Saving...", "Uploading attachment 1 of 2...", "Publishing...").

#### 4. HR Detail Modal (`AnnouncementDetailModal.tsx`)
- Detailed read-only inspection for HR managers.
- Live read statistics cards: Total Recipients, Read count (with percentage), Unread count.
- "View Recipients" action opening `RecipientListModal`.
- Full message body and audience scope badges.
- Protected attachment list with authenticated blob download and "+ Add Attachment" / removal for drafts and scheduled notices.
- Archive confirmation dialog and Delete Draft confirmation dialog.

#### 5. Recipient List Modal (`RecipientListModal.tsx`)
- Paginated table showing employee name, employee number, department/unit, job role, status (Read / Unread), and read timestamp.
- Live search by employee name or number, and filter by All / Read / Unread.

#### 6. Audience Preview Modal (`AudiencePreviewModal.tsx`)
- Compact sample preview dialog displaying resolved employee cards from the backend audience preview endpoint.

---

### Routing & Navigation

- **Route**: `/announcements` registered in `apps/web/src/routeTree.tsx`.
- **Router**: `@tanstack/react-router` only (`0` occurrences of `react-router-dom`).
- **Sidebar**: Announcements placed under "Communication" in `Sidebar.tsx` (no unread badge yet, ready for CP5).

---

### Files Created/Modified

- `apps/web/src/services/announcement.service.ts` (NEW)
- `apps/web/src/pages/Announcements/AnnouncementsPage.tsx` (MODIFIED — full HR workspace)
- `apps/web/src/pages/Announcements/components/AnnouncementWizardModal.tsx` (NEW)
- `apps/web/src/pages/Announcements/components/AnnouncementDetailModal.tsx` (NEW)
- `apps/web/src/pages/Announcements/components/RecipientListModal.tsx` (NEW)
- `apps/web/src/pages/Announcements/components/AudiencePreviewModal.tsx` (NEW)
- `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)

---

### Build & Verification Result

- **`tsc -b && vite build` (`apps/web`)**: **0 errors** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Schema**: Untouched ✅
- **Backend API**: Untouched ✅

### Git Commit
- `feat(announcements): add HR announcement workspace`

### Status
- **ANNOUNCEMENTS CHECKPOINT 4 — FULL HR FRONTEND WORKSPACE: COMPLETE** ✅

---

## Announcements Feature — Checkpoint 5: Recipient Experience & Dashboard Integration

### Overview

Checkpoint 5 completes the end-to-end user-facing Announcements experience in HRISense, providing a clean recipient feed for STANDARD employees, SUPERVISORS, and FULL HR users (under "My Announcements"), automatic mark-as-read tracking upon opening notices, dashboard widgets across HR, Supervisor, and Employee dashboards, and live unread count badges in the Sidebar.

---

### Key Components & Implementations

#### 1. Frontend Service Extensions (`apps/web/src/services/announcement.service.ts`)
- Added recipient types: `RecipientAnnouncement`, `DashboardAnnouncementsResponse`, `MarkReadResponse`, `UnreadCountResponse`.
- Added recipient API wrapper methods:
  - `listForRecipient(options)` (`GET /announcements?filter=current|past&unreadOnly=true&page=...&limit=...`)
  - `getRecipientAnnouncement(id)` (`GET /announcements/:id`)
  - `markRead(id)` (`POST /announcements/:id/read`)
  - `getUnreadCount()` (`GET /announcements/unread-count`)
  - `getDashboardAnnouncements()` (`GET /announcements/dashboard`)

#### 2. Event-Driven Shared Unread Hook (`apps/web/src/hooks/useAnnouncementUnread.ts`)
- Implemented `useAnnouncementUnread()` providing `unreadCount`, `refreshUnreadCount()`, and `decrementUnreadCount()`.
- Synchronizes unread badges across Sidebar, Dashboard widgets, and Announcements feed without background polling.

#### 3. Recipient Feed & FULL Dual-View (`apps/web/src/pages/Announcements/AnnouncementsPage.tsx`)
- **FULL Users**: Given a top-level segmented control:
  - `[ Manage Announcements ]`: Full Checkpoint 4 HR workspace (stats cards, status tabs, search & filters, data table, wizard, detail modal). Opening announcements here does NOT mark personal recipient records as read.
  - `[ My Announcements ]`: Dedicated personal recipient feed. Opening announcements here DOES mark them as read.
- **SUPERVISOR & STANDARD Users**: Dedicated recipient workspace titled "Announcements" with subtitle "Important updates and notices for you."
- **Recipient Tabs**:
  - `Current Notices`: Active announcements where `publishAt <= now` and not expired.
  - `Unread`: Current announcements with `readAt == null`, displaying live unread count badge.
  - `Past Announcements`: Expired historical notices previously received.
- **Recipient Cards**: Clean layout displaying Priority badge (Normal, Important, Urgent), Pinned indicator (Pin icon + "Pinned"), Unread badge ("Unread"), Title, Message snippet, Published timestamp, Updated indicator, and Attachment count.
- **Empty States**: Contextual empty states for Current, Unread, and Past tabs.

#### 4. Recipient Detail Modal (`AnnouncementRecipientDetailModal.tsx`)
- Comfortable desktop modal (~880px width, max-h-[720px]) showing Title, Priority badge, Pinned indicator, Published/Updated timing, formatted message body with preserved line breaks, and safe attachments list.
- **Auto Mark-As-Read**: Opening the modal calls `POST /announcements/:id/read` once loaded, updates local feed item state, and refreshes the shared unread count.
- **Protected Attachments**: Each attachment shows filename, size, and Download button invoking authenticated blob streaming.
- **Hidden HR Data**: No recipient stats, no audience scopes, no creator email/IDs, no edit/delete buttons.

#### 5. Dashboard Integration (`AnnouncementsWidget.tsx`)
- Integrated into `HRDashboard.tsx`, `SupervisorDashboard.tsx`, and `EmployeeDashboard.tsx`.
- Displays "Announcements" header with unread badge, up to 3 newest CURRENT announcements with Priority badges, Pinned status, and formatted publish dates.
- Displaying on dashboard does NOT mark read; clicking an item opens `AnnouncementRecipientDetailModal` to mark read.
- Includes "View All Announcements" action button navigating to `/announcements`.

#### 6. Sidebar Unread Badge (`Sidebar.tsx`)
- Displays live unread count beside the Announcements nav item (`badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined`).
- Reflects only active CURRENT unread notices for the authenticated user.

---

### Files Modified / Created

- `apps/web/src/services/announcement.service.ts` (MODIFIED)
- `apps/web/src/hooks/useAnnouncementUnread.ts` (NEW)
- `apps/web/src/pages/Announcements/AnnouncementsPage.tsx` (MODIFIED)
- `apps/web/src/pages/Announcements/components/AnnouncementRecipientDetailModal.tsx` (NEW)
- `apps/web/src/components/shared/AnnouncementsWidget.tsx` (NEW)
- `apps/web/src/components/layout/Sidebar.tsx` (MODIFIED)
- `apps/web/src/pages/Dashboard/EmployeeDashboard.tsx` (MODIFIED)
- `apps/web/src/pages/Dashboard/SupervisorDashboard.tsx` (MODIFIED)
- `apps/web/src/pages/Dashboard/HRDashboard.tsx` (MODIFIED)
- `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)

---

### Build & Verification Result

- **`tsc -b && vite build` (`apps/web`)**: **0 errors** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Cross-module static inspection**: No broken `/uploads` references found across Medical, Psychological, Training, or Employee Documents ✅
- **Database & Backend**: Untouched ✅

### Git Commit
- `feat(announcements): add recipient announcement experience`

### Status
- **ANNOUNCEMENTS CHECKPOINT 5 — RECIPIENT EXPERIENCE & DASHBOARD INTEGRATION: COMPLETE** ✅
- **MANUAL BROWSER QA**: PENDING USER TESTING

### Exact Next Activity
**HELP CENTER MODULE DEVELOPMENT**

---

## Help Center Feature — Checkpoint 0: Real System Function Audit & Source of Truth

### Overview

Checkpoint 0 established the authoritative, verified function inventory for the upcoming HRISense Help Center. To eliminate hallucinated or outdated documentation, an exhaustive static repository audit and live multi-role browser audit was conducted across all system routes, permissions, navigation trees, and backend contracts.

---

### Audit Highlights & Findings

#### 1. System Role Mapping & Permissions
- **HR Personnel (`FULL`)**: 34 verified functional user tasks (Employee management, 201 setup, onboarding wizard, recruitment ATS, daily attendance adjustment, monthly tally, schedule rotation catalog, leave approval, evaluation cycle setup, training activity coordination, compliance, medical/psychological records, and announcement management).
- **Supervisor (`SUPERVISOR`)**: 17 verified functional user tasks (Team directory, subordinate attendance log acknowledgment, team shift rotation assignment, leave request endorsement, conducting subordinate performance appraisals, submitting training attendance, subordinate fit-to-work review, and personal self-service).
- **Employee (`STANDARD`)**: 11 verified functional self-service tasks (Personal dashboard, organizational chart, holiday calendar, filing leave requests, tracking leave balances/history, viewing evaluation results, viewing training records, downloading seminar certificates, reading recipient announcements with auto-mark-as-read, and downloading protected notice attachments).

#### 2. Feature Classification & Discrepancies
- **`VERIFIED_FUNCTIONAL`**: 38 distinct unique tasks across 14 modules.
- **`PLACEHOLDER`**:
  - `AI Assistance (/ai-assistance)`: Static radar chart and mock insight cards. Excluded from functional guides.
  - `Reports & Analytics (/reports)`: Static charts with mock turnover arrays. Excluded from functional guides.
  - `Settings (/settings)`: Static setting cards without forms. Excluded from functional guides.
- **`NOT_REACHABLE`**:
  - `Audit Logs (/audit)`: Sidebar navigation link with no registered route in `routeTree.tsx`.
  - `Notifications (/notifications)`: Sidebar navigation link with no registered route in `routeTree.tsx`.
- **`OUT_OF_SCOPE`**:
  - `Payroll / Payslip`: Routes `/payroll` and `/payslips` correctly redirect to `/dashboard`. No active payroll UI components exist.

---

### Files Created / Modified

- `docs/HELP_CENTER_FUNCTION_INVENTORY.md` (NEW — Authoritative source of truth for all Help Center guides)
- `docs/HELP_CENTER_BROWSER_AUDIT.md` (NEW — Multi-role browser and route audit report)
- `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)

---

### Git Commit
- `docs(help): audit current HRISense functions`

### Status
- **HELP CENTER CHECKPOINT 0 — SYSTEM FUNCTION AUDIT & INVENTORY: COMPLETE** ✅

---

## Help Center Feature — Checkpoint 1: Architecture, Role-Aware Content Model & Search Foundation

### Overview

Checkpoint 1 established the technical architecture, typed content model, verified metadata registry, local search foundation, and route structure for the HRISense Help Center.

---

### Key Implementations

#### 1. Content Model & Registry (`helpCenter.types.ts`, `helpCenter.registry.ts`)
- **Metadata Registry**: Strongly typed registry with **38 unique verified tasks** across 10 categories.
- **Role Verification**:
  - `FULL` (HR Personnel): **34 tasks**
  - `SUPERVISOR` (Supervisor): **17 tasks**
  - `STANDARD` (Employee): **11 tasks**
- Verified zero duplicate IDs, zero duplicate slugs, and exact role count synchronization.

#### 2. Search & Role Filtering Foundation (`helpCenter.search.ts`)
- **Pre-Search Role Filtering**: `getGuidesForRole()` filters candidate guides by session role before search scoring.
- **Normalized Ranking**: `searchHelpGuides()` scores matches deterministically (`EXACT_TITLE` > `TITLE_MATCH` > `KEYWORD_MATCH` > `CATEGORY_MATCH` > `DESCRIPTION_MATCH`).
- **Dynamic Category Visibility**: `getCategoriesForRole()` automatically hides empty categories that have 0 guides for the user's role.

#### 3. Routing & Shell Integration (`routeTree.tsx`, `Sidebar.tsx`)
- Registered routes:
  - `/help-center` (`HelpCenterPage.tsx`)
  - `/help-center/$guideSlug` (`HelpGuidePage.tsx`)
  - `/help` (redirect to `/help-center`)
- Updated `Sidebar.tsx` to link to `/help-center` for all three roles (`FULL`, `SUPERVISOR`, `STANDARD`).
- Router integrity verified: **0 occurrences of `react-router-dom`**.

#### 4. UI Components (`apps/web/src/pages/HelpCenter/components/`)
- `HelpSearchBar.tsx`: Prominent search bar with role-tailored search prompts and Escape/Clear handling.
- `HelpRoleIndicator.tsx`: Clear contextual role badge.
- `HelpCategoryCard.tsx`: Category cards with available guide counts.
- `HelpGuideCard.tsx`: Guide item cards with module tags and estimated step counts.
- `HelpBreadcrumbs.tsx`: Clickable breadcrumb trails.
- `HelpGuideStep.tsx`: Large numbered step viewer with expected results and tips.
- `HelpEmptyState.tsx`: Search empty state with clear suggestions.

---

### Files Created / Modified

- `apps/web/src/pages/HelpCenter/helpCenter.types.ts` (NEW)
- `apps/web/src/pages/HelpCenter/helpCenter.registry.ts` (NEW)
- `apps/web/src/pages/HelpCenter/helpCenter.search.ts` (NEW)
- `apps/web/src/pages/HelpCenter/HelpCenterPage.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/HelpGuidePage.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpRoleIndicator.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpSearchBar.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpCategoryCard.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpGuideCard.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpBreadcrumbs.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpGuideStep.tsx` (NEW)
- `apps/web/src/pages/HelpCenter/components/HelpEmptyState.tsx` (NEW)
- `apps/web/src/routeTree.tsx` (MODIFIED)
- `apps/web/src/components/layout/Sidebar.tsx` (MODIFIED)
- `docs/HELP_CENTER_ARCHITECTURE.md` (NEW)
- `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md` (MODIFIED)

---

### Build & Verification Result

- **`tsc -b && vite build` (`apps/web`)**: **0 errors** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: Untouched (0 schema changes) ✅

### Git Commit
- `feat(help): add role-aware help center foundation`

### Status
- **HELP CENTER CHECKPOINT 1 — ARCHITECTURE & FOUNDATION: COMPLETE** ✅

### Exact Next Checkpoint
**HELP CENTER CHECKPOINT 2 — SHARED HELP CENTER UI/UX + GUIDE READER EXPERIENCE**

---

## Help Center Checkpoint 2 — Shared UI/UX & Guide Reader Experience

### Summary
Built the complete shared user experience layer for reading Help Center guides. Introduced 11 new reader components, a development fixture for verifying the full `READY` render pipeline, print-friendly CSS, screenshot viewer with zoom/focus management, and a complete homepage refinement with category filter UX.

**Corrected Reporting Discrepancy**:
- The CP1 final summary report documented SUPERVISOR as having **7 categories**. This was a documentation typo.
- The actual verified count — confirmed directly from the registry — is **8 categories** for SUPERVISOR (only `RECRUITMENT` and `ANNOUNCEMENTS` are hidden).
- **No registry data was modified**. This correction is documentation-only.

### Verified Category Counts (Source of Truth)

| Role | Category Count | Hidden From |
|---|:---:|---|
| FULL (HR Personnel) | **10** | — |
| SUPERVISOR (Supervisor) | **8** | RECRUITMENT, ANNOUNCEMENTS |
| STANDARD (Employee) | **7** | RECRUITMENT, EVALUATIONS, ANNOUNCEMENTS |

### Files Created

| File | Description |
|---|---|
| `HelpCenterPage.tsx` | Refined homepage: hero, search, suggestions, category filter, grouped guide catalog, Common Tasks |
| `HelpGuidePage.tsx` | Full guide reader: METADATA_ONLY notice, READY renderer, sticky nav, print/copy |
| `devGuideFixture.ts` | Development-only READY fixture (not in production registry) |
| `components/HelpGuideStep.tsx` | Step card: 48px badge, formatted instructions, screenshots, expected results, tip/warning/info |
| `components/HelpPrerequisites.tsx` | "Before you start" checklist (auto-hides if empty) |
| `components/HelpExpectedResult.tsx` | Green "What you should see" card |
| `components/HelpTip.tsx` | Amber "Tip" block with lightbulb icon |
| `components/HelpWarning.tsx` | Rose "Important" block with alert icon |
| `components/HelpInfo.tsx` | Blue "Good to know" block with info icon |
| `components/HelpScreenshot.tsx` | Responsive image with enlarge overlay and sensitive badge |
| `components/HelpScreenshotModal.tsx` | Fullscreen modal with ZoomIn/Out/Reset, Escape-to-close, focus return |
| `components/HelpTroubleshooting.tsx` | Accordion for `{problem, solution, note?}` |
| `components/HelpRelatedGuides.tsx` | Role-filtered related guide cards (max 4) |
| `components/HelpGuideNavigation.tsx` | Sticky desktop step-jump nav |
| `components/HelpSearchBar.tsx` | 56px search with accessible label and role-safe suggestions |
| `components/HelpCategoryCard.tsx` | Enlarged 20px cards with accessible ARIA labels |
| `components/HelpGuideCard.tsx` | Enhanced guide cards with Common Task badge |
| `components/HelpBreadcrumbs.tsx` | 14px readable breadcrumbs with mobile truncation |

### Files Modified

| File | Change |
|---|---|
| `helpCenter.types.ts` | Added `HelpTroubleshootingItem`, `info?` field on `HelpGuideStep`, strengthened troubleshooting type |
| `index.css` | Added print `@media` rules hiding nav/buttons, black-on-white body |
| `docs/HELP_CENTER_ARCHITECTURE.md` | Added Section 9: verified category correction, reader architecture, component table, screenshot behavior, fixture documentation, print, and accessibility guarantees |

### UX Architecture

- **Homepage views**: Hero search → (1) Focused search results, (2) Category filter, (3) Default catalog with Common Tasks + grouped categories
- **Reader layout**: 8-col main content + 4-col sticky step navigation (desktop), full-width single-column (tablet/mobile)
- **Content width**: Primary text constrained to `max-w-3xl` (~768px); screenshots full column width
- **Step navigation**: All steps visible vertically for printing/comparison; step-jump buttons scroll smoothly to step
- **Screenshot missing**: Graceful no-render (no broken image icon)
- **Related guides**: Double-filtered — must match `relatedGuideIds` AND `roles.includes(currentRole)`
- **Empty sections**: Prerequisites, troubleshooting, tips, related guides all auto-hide when empty

### Scope Guardrails Maintained

- 0 API endpoints added
- 0 database schema changes
- 0 `react-router-dom` imports
- 0 production fake guides created
- 0 guide content authored (reserved for CP3–5)
- 0 analytics, AI chatbot, CMS, or external search

### Build & Verification Result

- **`tsc -b && vite build` (`apps/web`)**: **0 errors** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: Untouched (0 schema changes) ✅
- **Registry counts**: TOTAL=38, FULL=34, SUPERVISOR=17, STANDARD=11 ✅ (unchanged)
- **Fixture isolation**: `preview-guide-reader` absent from production registry ✅

### Git Commit
- `feat(help): build accessible guide reader experience`

### Status
- **HELP CENTER CHECKPOINT 2 — SHARED UI/UX & GUIDE READER EXPERIENCE: COMPLETE** ✅

### Exact Next Checkpoint
**HELP CENTER CHECKPOINT 3 — HR PERSONNEL / FULL GUIDE AUTHORING PART 1**

---

## Help Center Checkpoint 2.1 — Role Reconciliation & Content Visibility

### Summary
Small targeted correction checkpoint before guide authoring begins. Reconciled Announcement role coverage, fixed registry data bug, added READY-only production filtering, guarded dev fixture, and established final content status visibility policy.

### Root Cause Found: Registry Data Bug

`ANNOUNCEMENTS_READ_RECIPIENT_FEED` had `roles: []` (empty array) in the registry, making the guide invisible to all users including FULL.

**The inventory (`HELP_CENTER_FUNCTION_INVENTORY.md`) correctly documented this guide as accessible to `FULL`, `SUPERVISOR`, and `STANDARD` since CP0.**  
The discrepancy was a transcription error when the registry was first authored. No inventory change was required.

**Evidence it was a bug:**
- `Sidebar.tsx` line 365: `/announcements` is `isAllowed = true` for all roles.
- `AnnouncementsPage.tsx`: Renders recipient feed to non-HR users by default.
- Backend route authorization: recipient endpoints require only valid JWT.

### Changes Made

#### 1. Registry Fix (`helpCenter.registry.ts`)
| Before | After |
|---|---|
| `ANNOUNCEMENTS_READ_RECIPIENT_FEED.roles = []` | `ANNOUNCEMENTS_READ_RECIPIENT_FEED.roles = ['FULL', 'SUPERVISOR', 'STANDARD']` |
| Keywords: 5 terms | Keywords: 8 terms (added "view announcements", "unread announcements", "announcement feed") |

#### 2. Corrected Registry Metadata Counts

| Metric | Old (Bug) | New (Corrected) |
|---|:---:|:---:|
| Total guides | 38 | 38 (unchanged) |
| FULL guides | 34 | **35** |
| SUPERVISOR guides | 17 | **18** |
| STANDARD guides | 11 | **12** |

#### 3. READY-Only Production Filtering (`helpCenter.search.ts`)

New `getReadyGuidesForRole(role)` function added. Production UI now uses READY-only data for:
- `HelpCenterPage` catalog/category grids/common tasks
- `searchHelpGuides()` results
- `getCategoriesForRole()` guide count pills
- `HelpRelatedGuides` component

Internal `getMetadataCountsByRole()` added for developer reference without leaking into UI.

#### 4. Preparation Notice (`HelpCenterPage.tsx`)

When `getReadyGuidesForRole()` returns 0 guides (current state — all METADATA_ONLY), the homepage shows:
> "Step-by-step guides are being prepared"

In DEV mode, shows registry metadata counts for developer reference. In production, shows only the user-facing message.

#### 5. DEV-Only Fixture Guard (`HelpGuidePage.tsx`)

`/help-center/preview-guide-reader` is now gated by `import.meta.env.DEV === true`. In production builds, this slug returns Guide Not Found.

#### 6. READY-Only Related Guides (`HelpRelatedGuides.tsx`)

Added `g.contentStatus === 'READY'` to the filter chain — was previously missing per CP2 report.

#### 7. Updated Search Suggestions (`HelpSearchBar.tsx`)

SUPERVISOR and STANDARD now include "Announcements" as a suggestion chip since they have the recipient announcement guide.

#### 8. Content Status Visibility Policy (Final)

| Status | Production Catalog | Category Count | Related Guides | Direct URL |
|---|:---:|:---:|:---:|:---:|
| READY | ✅ Visible | Counted | ✅ Shown | Full reader |
| DRAFT | ❌ Hidden | Not counted | ❌ Hidden | Not-found state |
| METADATA_ONLY | ❌ Hidden | Not counted | ❌ Hidden | Architecture notice |

### Scope Guardrails Maintained
- 0 guide content authored
- 0 API endpoints added
- 0 database schema changes
- 0 react-router-dom imports
- No credentials printed

### Audit of Announcement Functions (Final Verified)

**FULL (HR Personnel) confirmed functions:**
1. `ANNOUNCEMENTS_CREATE_PUBLISH` — Create/Schedule/Publish via 4-step wizard (FULL only)
2. `ANNOUNCEMENTS_TRACK_READ_RECEIPTS` — View recipient read statistics and audit list (FULL only)
3. `ANNOUNCEMENTS_READ_RECIPIENT_FEED` — Read personal recipient feed via "My Announcements" tab (shared)

**SUPERVISOR confirmed functions:**
- `ANNOUNCEMENTS_READ_RECIPIENT_FEED` — Recipient feed (Current/Unread/Past tabs, auto-read, download)

**STANDARD confirmed functions:**
- `ANNOUNCEMENTS_READ_RECIPIENT_FEED` — Identical recipient experience to SUPERVISOR

**No duplicate guides required**: One shared guide with `roles: ['FULL', 'SUPERVISOR', 'STANDARD']` is correct because all three use the same UI components (`AnnouncementRecipientDetailModal.tsx`, same tabs, same auto-read logic). FULL's distinction (accessing via "My Announcements" tab toggle vs. direct view) is noted in the guide prerequisites, not a separate guide.

**ANNOUNCEMENTS category visibility after fix:**
- FULL: 3 metadata guides (ANNOUNCEMENTS category visible in dev, production once any is READY)
- SUPERVISOR: 1 metadata guide (ANNOUNCEMENTS will appear once guide is READY)
- STANDARD: 1 metadata guide (ANNOUNCEMENTS will appear once guide is READY)

### Build & Verification Result
- **`tsc -b && vite build` (`apps/web`)**: **0 errors** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: Untouched ✅
- **Browser subagent**: API quota exhausted during testing — manual verification available via dev server at `http://localhost:3000`

### Git Commit
- `fix(help): reconcile role guides and content visibility`
- Hash: `d2ac8db9`

### Status
- **HELP CENTER CHECKPOINT 2.1 — ROLE RECONCILIATION & CONTENT VISIBILITY: COMPLETE** ✅

---

## 2026-08-28 — HELP CENTER CHECKPOINT 3A: HR PERSONNEL / FULL GUIDE AUTHORING (GETTING STARTED + EMPLOYEE MANAGEMENT)

### Goal
Convert verified functional metadata into real, accessible, step-by-step Help Center guides for HR Personnel (`FULL`) in the areas of Getting Started, Authentication, HR Dashboard, and Employee Management.

### Work Accomplished

1. **Authored 8 Complete Step-by-Step READY Guides (`helpCenter.registry.ts`)**:
   - `AUTH_LOGIN` — How to Sign In to HRISense (3 steps, expected results, credential tips)
   - `AUTH_CHANGE_PASSWORD` — How to Change Your Password (3 steps, security warnings, troubleshooting)
   - `DASHBOARD_VIEW_HR` — Navigating the HR Dashboard (3 steps, metric cards, unit attendance chart, announcements widget)
   - `EMPLOYEE_SEARCH_FILTER` — How to Search and Filter the Employee Directory (3 steps, live search, unit dropdown, status tabs)
   - `EMPLOYEE_ONBOARD_NEW` — How to Onboard a New Employee (201 Setup) (5 steps, personal info, unit assignment, government IDs, summary review)
   - `EMPLOYEE_DRAFT_MANAGE` — How to Manage and Resume Draft Employee Onboarding (3 steps, drafts list, resume wizard, discard draft)
   - `EMPLOYEE_VIEW_PROFILE` — How to View and Manage an Employee's 201 Profile (3 steps, 8 profile tabs, action buttons)
   - `EMPLOYEE_ARCHIVE_RESTORE` — How to Archive and Restore Employee Records (3 steps, archive confirmation modal, restore from archived list)

2. **Clean UI & Role Gating**:
   - Removed raw user-facing `[DEV] Registry: ...` diagnostic text from `HelpCenterPage.tsx` and protected it with `VITE_HELP_DEBUG`.
   - Verified that `getReadyGuidesForRole()` properly exposes 8 guides for `FULL`, 4 for `SUPERVISOR`, and 2 for `STANDARD`.
   - Empty preparation state automatically transitions to full catalog for roles with READY guides.

3. **Documentation & Validation**:
   - Updated `docs/HELP_CENTER_FUNCTION_INVENTORY.md`, `docs/HELP_CENTER_ARCHITECTURE.md`, and `docs/HELP_CENTER_BROWSER_AUDIT.md`.
   - Verified `npm run build --prefix apps/web` (`tsc -b && vite build`) passed with **0 errors**.
   - Verified 0 occurrences of `react-router-dom`.

### Build & Verification Result
- **`tsc -b && vite build` (`apps/web`)**: **0 errors (1.46s)** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: 0 modifications (Pure frontend content) ✅

### Status
- **HELP CENTER CHECKPOINT 3A — HR PERSONNEL / FULL GUIDE AUTHORING (BATCH 1): COMPLETE** ✅

---

## 2026-08-28 — HELP CENTER CHECKPOINT 3A.1: READY GUIDE ROLE-SAFETY & SOURCE-OF-TRUTH RECONCILIATION

### Goal
Audit and reconcile all 8 READY guides and function metadata to ensure role safety, accurate profile tab descriptions, separation of management directory profile vs. self-service own profile, and backend contract validation.

### Work Accomplished

1. **Clean Profile Separation (Option B)**:
   - Preserved `EMPLOYEE_VIEW_PROFILE` (`view-employee-profile`) for `FULL` and `SUPERVISOR` as the management directory viewing procedure (`READY`).
   - Created `EMPLOYEE_VIEW_OWN_PROFILE` (`view-own-employee-profile`) for `STANDARD`, `SUPERVISOR`, and `FULL` representing self-service personal profile inspection via TopNav user menu (`METADATA_ONLY`).
   - Reconciled profile tabs in guide content to accurately describe all 11–16 tabs across roles.

2. **Dashboard Role-Safety Reconciled**:
   - Reconciled `DASHBOARD_VIEW_EMPLOYEE` to `roles: ['STANDARD']` in documentation.
   - Verified that `DASHBOARD_VIEW_HR` (`FULL`) and `DASHBOARD_VIEW_SUPERVISOR` (`SUPERVISOR`) map strictly to their respective dashboards.

3. **Backend Route Contract Verified**:
   - Verified that `GET /announcements/:id/recipients/stats` exists in `announcement.routes.ts` (line 138) and is fully functional.

4. **Multi-Role Guide Risk Audit**:
   - Audited all shared guides and flagged them as either `SAME WORKFLOW ACROSS ROLES` or `ROLE-SPECIFIC WORKFLOW REQUIRED` for upcoming authoring batches.

5. **CP3B Pre-Flight Verification**:
   - Completed pre-flight verification for Recruitment, Attendance, Work Schedule, Holiday, and Leave modules.


> **SUPERSEDED 2026-09-02** — these are the counts as they stood at this checkpoint. The registry now holds 79 entries, all READY, across 17 categories. See the Post-QA Repair Pass section at the end of this document.

6. **Reconciled Registry Metrics**:
   - Total Registry Entries: **39**
   - FULL Permitted Guides: **36**
   - SUPERVISOR Permitted Guides: **19**
   - STANDARD Permitted Guides: **13**
   - READY Guides: **8** (FULL: 8, SUPERVISOR: 4, STANDARD: 2)
   - METADATA_ONLY Guides: **31**
   - DRAFT Guides: **0**

### Build & Verification Result
- **`tsc -b && vite build` (`apps/web`)**: **0 errors (1.51s)** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: 0 modifications ✅

### Status
- **HELP CENTER CHECKPOINT 3A.1 — READY GUIDE ROLE-SAFETY & SOURCE-OF-TRUTH RECONCILIATION: COMPLETE** ✅

---

## 2026-08-28 — HELP CENTER CHECKPOINT 3B-1: HR PERSONNEL GUIDE AUTHORING (RECRUITMENT + ATTENDANCE)

### Goal
Author 5 verified, accessible, role-safe step-by-step Help Center guides for HR Personnel (`FULL`) and Supervisors (`SUPERVISOR`) in the Recruitment & Hiring and Time & Attendance modules.

### Work Accomplished

1. **Authored 5 Complete Step-by-Step READY Guides (`helpCenter.registry.ts`)**:
   - `RECRUITMENT_MANAGE_OPENINGS` — How to Create and Publish a Job Opening (4 steps, basic details, unit assignment, description & qualifications, save draft / save & publish).
   - `RECRUITMENT_TRACK_APPLICANTS` — How to Process Job Applicants and Schedule Interviews (4 steps, pipeline filtering, documents preview, interview scheduling & scoring, stage transitions & conversion to onboarding draft).
   - `ATTENDANCE_DAILY_MONITORING` — How to Monitor Daily Attendance and Inspect Time Logs (3 steps, monthly calendar grid, KPI summary cards, HR organization filters / Supervisor team tab, Day Details Drawer inspection).
   - `ATTENDANCE_TALLY` — How to View Monthly Attendance Summaries and Tardiness Tallies (3 steps, date presets e.g. This Month, unit filters, aggregate attendance metrics, employee drilldown drawer).
   - `ATTENDANCE_SHIFT_CATALOG` — How to Create and Manage Shift Templates in the Shift Catalog (3 steps, Shift Catalog tab, + Create Shift modal, 12h time ranges, edit & deactivate actions).

2. **Role Safety & Verification**:
   - Verified that Recruitment guides are restricted to `FULL`.
   - Verified that `ATTENDANCE_DAILY_MONITORING` properly handles both HR Organization Filters and Supervisor Team Attendance tabs.
   - Verified that no live biometric sync claims, no automatic punch pairing, and no payroll/deduction terms are included.


> **SUPERSEDED 2026-09-02** — these are the counts as they stood at this checkpoint. The registry now holds 79 entries, all READY, across 17 categories. See the Post-QA Repair Pass section at the end of this document.

3. **Reconciled Registry Metrics Post CP3B-1**:
   - Total Registry Entries: **39**
   - FULL Permitted Guides: **36**
   - SUPERVISOR Permitted Guides: **19**
   - STANDARD Permitted Guides: **13**
   - READY Guides: **13** (FULL: 13, SUPERVISOR: 5, STANDARD: 2)
   - METADATA_ONLY Guides: **26**
   - DRAFT Guides: **0**
   - Active READY Categories: **5** (`AUTH`, `DASHBOARD`, `EMPLOYEES`, `RECRUITMENT`, `ATTENDANCE`)

### Build & Verification Result
- **`tsc -b && vite build` (`apps/web`)**: **0 errors (1.76s)** ✅
- **`react-router-dom` grep**: **0 occurrences** ✅
- **Database & Backend**: 0 modifications ✅

### Status
- **HELP CENTER CHECKPOINT 3B-1 — HR PERSONNEL GUIDE AUTHORING (RECRUITMENT + ATTENDANCE): COMPLETE** ✅

---

## 2026-08-28 — HELP CENTER PRESENTATION WRAP-UP CHECKPOINT

### Goal
Prepare the current partially-implemented Help Center for live prototype demonstration with clean user-facing messaging, no broken image frames, no developer debug terminology, and honest partial-development communication.

### Work Accomplished

1. **Presentation Expansion Notice Banner**:
   - Added user-facing informational banner to `/help-center`:
     *"Help Center is being expanded — The guides currently available have been verified and are ready to use. More step-by-step guides will be added as additional HRISense features are documented."*
   - Styled with subtle info theming (no warning/error colors, no completion percentages).

2. **Clean Screenshot-Free Rendering**:
   - Verified that `HelpScreenshot` returns `null` when image sources are absent.
   - All 13 authored READY guides render complete step numbers, titles, instructions, expected results, tips, and warnings without blank frames or broken image placeholders.
   - Preserved all screenshot viewer/modal support code for future screenshot integration.

3. **Developer Jargon Guard & Direct-URL Fallback**:
   - Removed internal debug tokens (`METADATA_ONLY`, `DRAFT`, `Function ID`, registry metadata) from user-facing screens.
   - Configured safe direct-URL fallback for unauthored guide slugs displaying:
     *"Guide not available yet — This step-by-step guide is still being prepared. More guides will be published as documentation continues."* with `[ Back to Help Center ]`.


> **SUPERSEDED 2026-09-02** — these are the counts as they stood at this checkpoint. The registry now holds 79 entries, all READY, across 17 categories. See the Post-QA Repair Pass section at the end of this document.

4. **Help Center Status Summary**:
   - **HELP CENTER STATUS**: `PARTIALLY IMPLEMENTED — PRESENTATION WRAP-UP IMPLEMENTED`
   - **Current Authored READY Guides**: `13`
   - **Remaining Guide Authoring**: `NOT FINISHED` (26 unauthored guides in `METADATA_ONLY` status)
   - **Final Screenshots**: `DEFERRED`
   - **Contextual Help**: `NOT STARTED`
   - **Verification Status**: `PENDING USER MANUAL TESTING` (Automated testing skipped per user request)

### Exact Continuation Point After Presentation
**HELP CENTER CHECKPOINT 3B-2 — HR PERSONNEL GUIDE AUTHORING: WORK SCHEDULE + HOLIDAY + LEAVE**






---

## 2026-09-02 — COMPLETE LOCAL SYSTEM REPAIR (CLAUDE FIX-ALL)

### Goal
Repair every locally-fixable defect catalogued in
`docs/CLAUDE_HRISENSE_MASTER_SYSTEM_REVIEW.md`.

Full itemised results: **`docs/CLAUDE_FIX_ALL_EXECUTION_REPORT.md`**.
Phase-by-phase log: **`docs/CLAUDE_FIX_ALL_PROGRESS.md`**.

### Headline repairs
- **Employee onboarding now actually works.** `POST /employees` parses multipart;
  `HSJ-XXXX` employee numbers are generated server-side; Employee + User +
  documents are created in one transaction; a crypto temporary password is
  returned once and emailed. A second root cause was found during the work:
  wizard Step 1 rendered a duplicate of the Document Uploads step, so the
  required contact fields were never collected.
- **Authentication corrected.** The unsatisfiable `\d` complexity regex is gone;
  the current password is always verified; `getMe` returns `mustChangePassword`;
  Remember Me implemented; Forgot/Reset Password pages added; the reset token is
  no longer returned by the API.
- **Supervisor hierarchy unified.** `Employee.immediateSupervisorId` is canonical.
  Every runtime reader moved off the seed-only `SupervisionLink` table.
- **Object-level authorization closed.** `GET /employees/:id` was unguarded;
  supervisors could read and write any employee's weekly schedule.
- **Account Management works.** Seven real endpoints; "Resend Welcome" replaced
  with "Reset & send new credentials", which is what actually happens.
- **Leave gained the supervisor endorsement stage** (`PENDING → FOR_REVIEW →
  APPROVED`), `pending` balance accounting was fixed, and the invented 15-day
  entitlement was deleted in favour of explicit HR-configured balances.
- **Attendance data honesty.** The dashboard no longer infers Absent from missing
  records, and the fabricated 6-month trend was replaced with real per-month figures.
- **Audit Logs, Notifications, Reports, AI Assistance and Settings are now real
  features** rather than dead links, mocks or placeholders.
- **Public applicant status link** added — login-free, read-only, stateless HMAC
  token, no applicant account, no schema migration.

### Corrections to earlier entries in this log
- The **"Full Time & Attendance UI Placeholder Audit"** entry states the Excel
  import placeholder was deleted. The standalone component file was removed, but
  an equivalent modal was re-implemented inline in `DailyMonitoringPage.tsx` and
  is still present. That is correct and intentional — it is clearly labelled and
  the Process button is permanently disabled — but the earlier entry was wrong to
  say the placeholder was gone.
- Entries describing **employee onboarding as complete** were inaccurate: the
  submit path could not succeed. It has now been repaired.

### Deliberately unchanged
- **Mustard Seedtime import** — still deferred; no columns, sheet names or
  punch-pairing rules were invented.
- **Chargeable leave days** — still inclusive calendar days. Weekends, holidays
  and rest days are NOT silently excluded pending Hospicio confirmation.
- **Payroll** — remains permanently out of scope; the last runtime remnants
  (`seedPayslips()`, `payslip.*` permissions, `payroll_periods_per_month`) were
  removed from the seed.

### Validation
- `apps/api` build: **PASS (0 errors)**
- `apps/web` build: **PASS (0 errors)**
- `prisma validate` / `prisma generate`: **PASS**
- Prisma schema changed: **NO**. Migration created or applied: **NO**.
- Git: **no commits, no remote operations.** HEAD unchanged at `7648345b`.

### Status
**COMPLETE LOCAL REPAIR — MANUAL USER QA REQUIRED.**

---

# Post-QA Repair Pass — 2026-09-02 (Claude)

The user manually tested the system after the fix-all pass and reported four real
runtime issues. All four were fixed at the root cause, and the Help Center was then
re-audited and completed against the current system.

Full detail: `docs/CLAUDE_POST_QA_REPAIR_REPORT.md`.

## The four reported issues

1. **Welcome email went to the wrong address.** The credential email was addressed to
   the login email (`workEmail || personalEmail`). It is now addressed to the
   employee's **personal email**, which is reachable before a work mailbox exists.
   The provider's "redirect everything to a test address" switch was removed —
   redirecting a credential message means HR is told "sent" while the employee
   receives nothing. The email now carries the employee name, employee number, login
   ID, temporary password, the change-at-first-sign-in instruction, the sign-in link
   and a security reminder.

2. **Download PDF froze the UI.** `html2pdf`/`html2canvas` clones the card into a
   temporary full-screen container; the unobserved promise rejection left that
   container in the DOM as an invisible click blocker, which is why the buttons
   stopped responding. The credential sheet is now written directly with jsPDF — no
   clone, no canvas, no overlay — inside `try`/`finally`.

3. **The Documents tab crashed the profile.** `GET /employees/:id` returns documents
   as `{ id }` only, so `doc.category.replace(...)` threw on `undefined`. This
   affected any employee with documents, not only new ones. The profile now loads
   documents from `GET /employees/:employeeId/documents`, which enforces per-viewer
   visibility, and renders every optional field through a safe formatter.

4. **The Weekly Schedule modal was hard to use.** Rebuilt as a numbered, guided
   workflow with a wider dialog, a 7-column weekly grid, worded day states, a live
   problem list and a sticky footer. **No scheduling business rule was changed.**

## Additional defects found while tracing those four

- Document downloads used a plain `<a href>` against an authenticated route, hardcoded
  to `localhost:5000` — every download would have returned 401.
- `useProtectedImageUrl` read `localStorage` directly, so employee photos never loaded
  when "Keep me signed in" was unticked (the default).
- The profile rendered `employee.employmentType` (not a field), compared
  `permissionTier === 'HR'` (never true), hardcoded Probation Date to "N/A", and showed
  `homePhone` where onboarding stores `telephoneNumber`.
- Account Management read account fields the API did not send, so it always showed
  "Never" for last sign-in and never offered Unlock for a locked account.
- `OrgChartPage` called `useMemo` after an early return — a latent React crash on a
  supervisor cycle.
- The onboarding wizard's `required` attributes were decorative; it now validates per
  step instead of failing at the end.

## Help Center — recalculated counts

The counts recorded earlier in this document (39 entries, 13 READY, 26 METADATA_ONLY,
10 categories) are **superseded**. Verified by
`npx tsx apps/web/scripts/validate-help-registry.ts` on 2026-09-02:

| Measure | Before | After |
|---|---:|---:|
| Registry entries | 39 | **79** |
| READY | 13 | **79** |
| METADATA_ONLY | 26 | **0** |
| DRAFT | 0 | **0** |
| Categories | 10 | **17** |
| Readable by HR Personnel | 36 | **75** |
| Readable by Supervisor | 19 | **34** |
| Readable by Employee | 13 | **27** |
| Tagged PUBLIC | — | **3** |

Guides were split out of the single 1,357-line registry into
`apps/web/src/pages/HelpCenter/guides/*.guides.ts`, and the registry validator now also
rejects unknown categories, missing search keywords, and related-guide links that are
broken, not READY, or unreachable for that guide's own readers.

Contextual **Help** links were added to ten workflow pages.

## Deliberately unchanged

- **Screenshots** — none captured, none fabricated, none referenced. The screenshot
  architecture is intact; capture is the only outstanding Help Center work.
- **Mustard Seedtime import** — still deferred. The Import Attendance Excel window
  still states that the official format has not been received and leaves Process
  Import disabled. No column, sheet name, punch-pairing rule, lateness formula,
  half-day rule or night-shift calculation was invented.
- **Payroll** — remains permanently out of scope.

## Validation

- `apps/api` build: **PASS** · `apps/web` build: **PASS**
- `prisma validate`: **PASS** · `prisma migrate status`: 13 migrations, schema up to date
- `prisma generate`: blocked by a Windows file lock on the query engine (dev server
  running); the existing client is current and the API build passes against it
- Prisma schema changed: **NO**. Migration created or applied: **NO**.
- Browser automation: **NO**. Live email sent: **NO**. Paid AI test call: **NO**.
- Git: **no commits, no remote operations.** HEAD unchanged at `7648345b`.

## Status

**POST-QA REPAIRS IMPLEMENTED · HELP CENTER TEXTUAL AUTHORING COMPLETE ·
CONTEXTUAL HELP IMPLEMENTED · SCREENSHOT CAPTURE DEFERRED · MANUAL USER QA REQUIRED.**

---

# Logic & Data-Integrity Repair + Attendance Import Foundation — 2026-09-07 (Claude)

Following a design review of attendance import overlap handling, this pass fixed
13 confirmed logic/data-integrity defects and built the format-independent
attendance import foundation.

## Defects fixed

**Concurrency / retry** — leave approve/reject/endorse/cancel, and evaluation
submit/finalize, all moved their status guard INSIDE the write (`updateMany` with
the status in the WHERE clause, asserting `count === 1`). A double-click or a
retried request now performs no duplicate side effects.

**Data integrity** — the weekly schedule `effectiveTo` bug (a computed value that
was never used) is fixed and the 3 overlapping live rows were repaired
deterministically. Training completion now creates its compliance record and the
participant link in one transaction, with a unique source-event key preventing
duplicates on retry.

**Reporting consistency** — the AI fact sheet counted attendance for archived
employees while Reports and Tally did not. On this data that meant AI showed 20
records where Reports showed 0. One shared `workforceScope.ts` definition now
serves all three.

**Auditability** — attendance corrections now record `oldValue` as well as
`newValue`, and stamp who corrected the record and when.

**Validation** — `PUT /attendance/:id` had no request validation; it now uses zod
through the existing middleware.

**Date handling** — verified and centralised in `businessDate.ts`. The
verification caught a real off-by-one in the first implementation.

## Attendance import foundation

Three-layer pipeline as the user specified: `Batch → RawRow → Candidate → Record`.
Raw rows and daily candidates are separate models so several punches can normalize
into one employee-day when the real format is known.

Existing attendance rows are marked `sourceType = LEGACY`, not IMPORT — their
origin is unknown and claiming otherwise would be false.

**No Mustard parser was written. No column, sheet, identifier, pairing rule or
formula was invented.** The normalizer registry is empty and fails closed;
Process Import stays disabled in the UI.

## Validation

API build PASS · Web build PASS · prisma validate PASS · migrate deploy PASS ·
migrate status clean · prisma generate PASS · date round-trip 13/13.

No commits, no remote operations. HEAD unchanged at `7648345b`.

**Status: CURRENT LOGIC/DATA-INTEGRITY REPAIRS COMPLETE — ATTENDANCE IMPORT
FOUNDATION COMPLETE — REAL MUSTARD NORMALIZER DEFERRED — MANUAL USER QA REQUIRED.**
