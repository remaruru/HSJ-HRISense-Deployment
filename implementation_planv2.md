# HRISense — Implementation Plan v2
### AI-Assisted Workforce Intelligence and Decision Support System
**Organization**: Hospicio de San Jose (HSJ)
**Supersedes**: Implementation Plan v1 (pre-spreadsheet assumptions)

---

> [!IMPORTANT]
> This is **Version 2** of the implementation plan. Every section has been revised to align with the official **Job Roles.xlsx** spreadsheet. All previous placeholder assumptions for departments, units, roles, and permissions are **replaced** by the exact data from the spreadsheet.

---

## What Changed from v1 (and Why)

| Section | v1 Assumption | v2 Correction (from spreadsheet) |
|---|---|---|
| Departments | Generic: Nursing, HR, Finance, Radiology, Lab | Exact: 8 units under HR Department umbrella |
| Roles | Generic: HR Manager, Nurse, Doctor, Pharmacist | Exact: 58 distinct job roles from spreadsheet |
| Permission tiers | Simple admin/user binary | 3 tiers: ALL / Supervisor / Standard Employee |
| RBAC Enum | 11 enum values | 58+ role names mapped to 3 permission tiers |
| Sidebar nav | Generic healthcare modules | Filtered dynamically by spreadsheet-derived permissions |
| Database `Role` model | Single JSON permissions blob | Normalized `Permission` + `RolePermission` join table |
| Dashboard variants | 5 generic dashboards | 3 variants + one for HR (ALL access) |
| Seed data | Placeholder HSJ names | Real department/unit names, realistic HSJ role assignments |

---

## Spreadsheet Analysis — Complete Reading

### Sheet: JOB ROLES (Single Sheet, 62 Rows, 8 Columns)

**Column Mapping:**
- Col B: Job Title / Role Name
- Col D: "ACCESS TO" — permission description
- (All other columns are empty / formatting artifacts)

**Header Structure:**
- `Row 1` → Top-level label: **HUMAN RESOURCE DEPARTMENT**
- `Row 2` → Column headers: UNIT | ACCESS TO
- `Row 6, 11, 17, 27, 33, 40, 59` → **Section/Department headers** (bold separators, Col D)
- All other data rows → Job Role + Permission string

---

## Organizational Structure (Derived from Spreadsheet)

HSJ is structured as one umbrella institution with **one HR Department** overseeing **all units** below. The units from the spreadsheet are:

```
HOSPICIO DE SAN JOSE (HSJ)
└── Human Resource Department  ← top-level controller
    ├── HR Officer / HR Assistant/Staff  (ACCESS: ALL)
    │
    ├── ADMINISTRATIVE SERVICES (Unit)
    │   ├── Assistant Administrator
    │   ├── Administrative Secretaries
    │   └── Receptionists
    │
    ├── FINANCE (Unit)
    │   ├── Accounting Staff
    │   ├── PMO Staff
    │   ├── Liaison Officer
    │   └── Stockroom Staff
    │
    ├── GENERAL SUPPORT SERVICES (Unit)
    │   ├── Kitchen Supervisor
    │   ├── Kitchen Staff
    │   ├── Laundry Staff
    │   ├── Janitorial Supervisor
    │   ├── Janitorial Staff
    │   ├── Drivers
    │   ├── Maintenance Supervisor
    │   └── Maintenance Staff
    │
    ├── AUXILIARY SERVICES (Unit)
    │   ├── IGP Coordinator
    │   ├── Canteen Staff
    │   ├── Bakery Staff
    │   └── Dormitory Staff
    │
    ├── SOCIAL SERVICES (Unit)
    │   ├── Head SSD
    │   ├── Social Workers
    │   ├── Psychologist
    │   ├── ECCD Teacher
    │   └── Part-Time Psychologist
    │
    ├── PASTORAL CARE / HOMELIFE SERVICES (Unit)
    │   ├── Head Pastoral Care/Homelife Services
    │   ├── Chapel Staff
    │   ├── CY Coordinator
    │   ├── Pre-School Staff
    │   ├── St. Mary Staff
    │   ├── St. Joseph Staff
    │   ├── PSN Coordinator
    │   ├── Rendu A Staff
    │   ├── Rendu B Staff
    │   ├── Rendu C Staff
    │   ├── OP Coordinator
    │   ├── Sta. Luisa Staff
    │   ├── St. Vincent Staff
    │   ├── CIP Coordinator
    │   ├── Tahan Center Staff
    │   ├── Sanctuary Center Staff
    │   └── Sigliv Boys Staff
    │
    └── HEALTH SERVICES (Unit)
        ├── Clinic Staff
        ├── PT Coordinator
        └── PT Staff
```

**Total Distinct Job Roles: 58** (including HR Officer, HR Assistant/Staff)

---

## Permission Tier Analysis

Reading every "ACCESS TO" value from the spreadsheet yields exactly **3 permission tiers**:

### Tier 1 — FULL ACCESS (HR Department Only)
**Roles:** Human Resource Officer, Human Resource Assistant/Staff
**Access:** `ALL`
- Full system access — every module, every employee's data, all reports, AI insights, settings, admin features

### Tier 2 — SUPERVISOR ACCESS
**Pattern:** `INDIVIDUAL USER ACCOUNT, PROFILE, LEAVE RECORDS, SEMINARS/TRAININGS ATTENDED, E-PAYSLIP, LATE/TARDINESS/EXCUSE SLIP/ACTIVITIES ATTENDANCES (UNDER HER SUPERVISION), PSYCHOLOGICAL RESULT`

**Roles with Supervisor Access:**
| Role | Unit |
|---|---|
| Assistant Administrator | Administrative Services |
| Kitchen Supervisor | General Support Services |
| Janitorial Supervisor | General Support Services |
| Maintenance Supervisor | General Support Services |
| IGP Coordinator | Auxiliary Services |
| Head SSD | Social Services |
| Head Pastoral Care/Homelife Services | Pastoral Care/Homelife |
| CY Coordinator | Pastoral Care/Homelife |
| PSN Coordinator | Pastoral Care/Homelife |
| OP Coordinator | Pastoral Care/Homelife |
| CIP Coordinator | Pastoral Care/Homelife |
| Clinic Staff | Health Services |
| PT Coordinator | Health Services |

**What supervisor access means:**
- Own profile, leave records, trainings, e-payslip, psychological result (same as standard)
- **PLUS**: View attendance-related records of staff **under their supervision** (Late/Tardiness/Excuse Slip/Activities Attendance logs for subordinates)

### Tier 3 — STANDARD EMPLOYEE ACCESS
**Pattern:** `INDIVIDUAL USER ACCOUNT, PROFILE, LEAVE RECORDS, SEMINARS/TRAININGS ATTENDED, E-PAYSLIP, PSYCHOLOGICAL RESULT`

**All remaining 43 roles** (all non-supervisory staff):
- Own user account management
- Own profile (view/edit)
- Own leave records + ability to file leave requests
- Own training/seminar attendance records
- Own e-payslip (read-only)
- Own psychological result (read-only)

> [!IMPORTANT]
> **Ambiguity found:** The `Clinic Staff` row uses "INDIVIDUAL USER ACCOUNT, LEAVE RECORDS..." (no "PROFILE" listed), same for `PT Coordinator`. This appears to be a typo/formatting inconsistency in the spreadsheet — both are Supervisor-tier roles but omit "PROFILE." I will treat both as having profile access (since all roles logically need it) unless you instruct otherwise.

---

## Permission Matrix (Translated to System Modules)

| Module | HR (ALL) | Supervisor | Standard |
|---|---|---|---|
| Dashboard — Full HR Overview | ✅ | ❌ | ❌ |
| Dashboard — My Dashboard | ✅ | ✅ | ✅ |
| Employee Directory (all records) | ✅ | ❌ | ❌ |
| Employee Profile — Own | ✅ | ✅ | ✅ |
| Employee Profile — Subordinates | ✅ | ✅* | ❌ |
| Add / Edit Employee (any) | ✅ | ❌ | ❌ |
| Attendance — All Employees | ✅ | ❌ | ❌ |
| Attendance — Own | ✅ | ✅ | ✅ |
| Attendance — Subordinates (Late/Tardiness) | ✅ | ✅ | ❌ |
| Leave Requests — File Own | ✅ | ✅ | ✅ |
| Leave Requests — View Own | ✅ | ✅ | ✅ |
| Leave Requests — Approve (Subordinates) | ✅ | ❌** | ❌ |
| Trainings — Own Records | ✅ | ✅ | ✅ |
| Trainings — Manage Programs | ✅ | ❌ | ❌ |
| E-Payslip — Own | ✅ | ✅ | ✅ |
| E-Payslip — All (Payroll Summary) | ✅ | ❌ | ❌ |
| Psychological Records — Own | ✅ | ✅ | ✅ |
| Psychological Records — Others | ✅ | ❌ | ❌ |
| AI Workforce Intelligence | ✅ | ❌ | ❌ |
| Reports & Analytics | ✅ | ❌ | ❌ |
| Announcements — View | ✅ | ✅ | ✅ |
| Announcements — Create | ✅ | ❌ | ❌ |
| Compliance Monitoring | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ |

*Supervisors can view subordinate attendance/tardiness records only.
**Leave approval: The spreadsheet does not explicitly grant leave approval to supervisors. Only HR has this capability. This is intentional per the spreadsheet — all leave approval routes through HR.

> [!NOTE]
> **Open Question 1:** Should supervisors be able to initiate/recommend leave approval for their team, even if final approval is with HR? Or is the single-approval-by-HR model exactly what HSJ uses? I will hold on leave approval routing until confirmed. For now, **only HR Officers can approve leaves**.

> [!NOTE]
> **Open Question 2:** The spreadsheet lists `ACTIVITIES ATTENDANCES` under supervisor access. Should this map to a specific "Activities" module (seminar/event attendance tracking for subordinates), or is it the same as the training attendance module? Currently mapping to the Training module's subordinate view.

---

## Revised Database Architecture

### Key Changes from v1 Schema

1. **`Role` model** — Replaced single JSON blob with proper `Permission` + `RolePermission` normalized tables
2. **`PermissionTier` enum** — Added `FULL`, `SUPERVISOR`, `STANDARD` (matches spreadsheet tiers)
3. **`Department` model** — Restructured to match HSJ: single parent org → 7 units (no multi-level dept hierarchy)
4. **`Unit` model** — Units are now a flat list under the single HR Department
5. **`SupervisionGroup` model** — New — tracks which employees a supervisor oversees (for the "UNDER HER SUPERVISION" access rule)
6. **`AttendanceLog` model** — Split from `AttendanceRecord` to track individual late/tardiness events distinctly
7. **`ActivityAttendance` model** — New — tracks attendance at events/activities (separate from formal training)
8. **`PsychologicalRecord`** — Kept, access strictly enforced: own-only for standard/supervisor, any for HR

### Complete Revised Prisma Schema Design

```prisma
// ─── ENUMS ────────────────────────────────────────────────────────

enum PermissionTier {
  FULL        // HR Officers — ALL modules, ALL employees
  SUPERVISOR  // Section heads/coordinators — own data + subordinate attendance
  STANDARD    // All other staff — own data only
}

enum EmploymentStatus {
  ACTIVE | PROBATIONARY | ON_LEAVE | RESIGNED | TERMINATED | SUSPENDED
}

enum EmploymentType {
  REGULAR | PART_TIME | CONTRACTUAL | VOLUNTEER | CONSULTANT
}

enum Gender { MALE | FEMALE | PREFER_NOT_TO_SAY }

enum CivilStatus { SINGLE | MARRIED | WIDOWED | SEPARATED | LEGALLY_SEPARATED }

enum AttendanceStatus { PRESENT | ABSENT | LATE | HALF_DAY | ON_LEAVE | HOLIDAY | REST_DAY | SUSPENDED }

enum LeaveType {
  SICK | VACATION | EMERGENCY | MATERNITY | PATERNITY | SOLO_PARENT
  STUDY | REHABILITATION | SPECIAL_PRIVILEGE | BEREAVEMENT | FORCED
}

enum LeaveStatus { PENDING | APPROVED | REJECTED | CANCELLED | FOR_REVIEW }

enum EvaluationStatus { DRAFT | SUBMITTED | REVIEWED | FINALIZED }

enum TrainingStatus { UPCOMING | ONGOING | COMPLETED | CANCELLED | POSTPONED }

enum ComplianceStatus { COMPLIANT | NON_COMPLIANT | AT_RISK | PENDING | EXEMPTED }

enum ComplianceCategory { REGULATORY | LICENSING | TRAINING | HEALTH | SAFETY | DOCUMENTATION | BIR | SSS | PHILHEALTH | PAGIBIG }

enum AnnouncementPriority { NORMAL | IMPORTANT | URGENT }
enum AnnouncementAudience { ALL | UNIT | ROLE | INDIVIDUAL }

enum NotificationType {
  LEAVE_FILED | LEAVE_APPROVED | LEAVE_REJECTED | EVALUATION_ASSIGNED
  EVALUATION_SUBMITTED | ANNOUNCEMENT | COMPLIANCE_ALERT | AI_INSIGHT
  ATTENDANCE_ALERT | TRAINING_REMINDER | SYSTEM | PAYSLIP_RELEASED
}

enum AIInsightType {
  WORKFORCE_TREND | ATTRITION_RISK | COMPLIANCE_RISK | ATTENDANCE_ANOMALY
  PERFORMANCE_INSIGHT | RECOMMENDATION | STAFFING_GAP | SUMMARY
}

enum AIRequestStatus { PENDING | PROCESSING | COMPLETED | FAILED }

// ─── CORE IDENTITY MODELS ──────────────────────────────────────────

model Unit {
  // Represents the 7 service units under HSJ
  id          String @id @default(uuid())
  name        String @unique  // e.g. "ADMINISTRATIVE SERVICES"
  code        String @unique  // e.g. "ADM", "FIN", "GSS", "AUX", "SOC", "PCH", "HLT"
  description String?
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  jobRoles    JobRole[]
  employees   Employee[]
  complianceItems ComplianceRequirement[]
  announcements Announcement[]
  @@index([code])
}

model JobRole {
  // All 58 exact job roles from the spreadsheet
  id              String          @id @default(uuid())
  title           String          // Exact title from spreadsheet
  code            String          @unique  // Slugified: e.g. "HR_OFFICER", "KITCHEN_SUPERVISOR"
  unitId          String
  unit            Unit            @relation(fields: [unitId], references: [id])
  permissionTier  PermissionTier  // FULL | SUPERVISOR | STANDARD
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  employees       Employee[]
  rolePermissions RolePermission[]
  @@index([unitId])
  @@index([permissionTier])
}

model Permission {
  // Granular permission registry — maps to specific system actions
  id          String @id @default(uuid())
  module      String  // e.g. "employees", "leave", "attendance", "payroll", "ai"
  action      String  // e.g. "read_own", "read_all", "create", "update", "delete", "approve", "export"
  scope       String  // "OWN" | "SUBORDINATES" | "ALL" — who this applies to
  description String
  
  rolePermissions RolePermission[]
  @@unique([module, action, scope])
  @@index([module])
}

model RolePermission {
  id           String     @id @default(uuid())
  jobRoleId    String
  jobRole      JobRole    @relation(fields: [jobRoleId], references: [id])
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])
  createdAt    DateTime   @default(now())
  
  @@unique([jobRoleId, permissionId])
}

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  employeeId      String?   @unique
  employee        Employee? @relation(fields: [employeeId], references: [id])
  isActive        Boolean   @default(true)
  isEmailVerified Boolean   @default(false)
  failedLoginAttempts Int   @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  lastLoginIp     String?
  mustChangePassword Boolean @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? // soft delete

  sessions        UserSession[]
  passwordResets  PasswordResetToken[]
  emailVerifications EmailVerificationToken[]
  auditLogs       AuditLog[]
  activityLogs    ActivityLog[]
  notifications   Notification[]
  
  @@index([email])
}

model UserSession {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  refreshToken String    @unique
  deviceInfo   String?   // browser/OS fingerprint
  ipAddress    String?
  expiresAt    DateTime
  isRevoked    Boolean   @default(false)
  createdAt    DateTime  @default(now())
  lastUsedAt   DateTime  @default(now())
  
  @@index([userId])
  @@index([refreshToken])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  
  @@index([token])
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  
  @@index([token])
}

// ─── EMPLOYEE MODEL ────────────────────────────────────────────────

model Employee {
  id                    String          @id @default(uuid())
  employeeNumber        String          @unique  // HSJ-assigned ID
  firstName             String
  middleName            String?
  lastName              String
  suffix                String?         // Jr., Sr., III, etc.
  gender                Gender
  dateOfBirth           DateTime        @db.Date
  civilStatus           CivilStatus
  nationality           String          @default("Filipino")
  religion              String?
  
  // Contact
  personalEmail         String?
  workEmail             String?         @unique
  mobilePhone           String
  homePhone             String?
  
  // Address
  presentAddress        String
  permanentAddress      String?
  
  // Emergency Contact
  emergencyContactName  String
  emergencyContactRel   String
  emergencyContactPhone String
  
  // Employment
  unitId                String
  unit                  Unit            @relation(fields: [unitId], references: [id])
  jobRoleId             String
  jobRole               JobRole         @relation(fields: [jobRoleId], references: [id])
  employmentType        EmploymentType
  employmentStatus      EmploymentStatus @default(ACTIVE)
  hireDate              DateTime        @db.Date
  regularizationDate    DateTime?       @db.Date
  separationDate        DateTime?       @db.Date
  separationReason      String?
  
  // Government IDs
  sssNumber             String?
  philhealthNumber      String?
  pagibigNumber         String?
  tinNumber             String?
  
  // Profile
  photoUrl              String?
  
  // Soft delete
  deletedAt             DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  user                  User?
  supervisorLinks       SupervisionLink[] @relation("Supervisor")
  subordinateLinks      SupervisionLink[] @relation("Subordinate")
  attendanceRecords     AttendanceRecord[]
  attendanceLogs        AttendanceLog[]
  leaveRequests         LeaveRequest[]    @relation("EmployeeLeaves")
  leaveApprovals        LeaveRequest[]    @relation("ApproverLeaves")
  leaveBalances         LeaveBalance[]
  evaluationsAsSubject  PerformanceEvaluation[] @relation("EvaluationSubject")
  evaluationsAsEvaluator PerformanceEvaluation[] @relation("EvaluationEvaluator")
  trainingAttendances   TrainingAttendee[]
  activityAttendances   ActivityAttendance[]
  medicalRecords        MedicalRecord[]
  psychologicalRecords  PsychologicalRecord[]
  payslips              Payslip[]
  documents             EmployeeDocument[]
  authoredAnnouncements Announcement[]
  notifications         Notification[]
  aiInsightsAbout       AIInsight[]
  
  @@index([employeeNumber])
  @@index([unitId])
  @@index([jobRoleId])
  @@index([employmentStatus])
  @@index([workEmail])
}

model SupervisionLink {
  // Tracks supervisor→subordinate relationships
  // Required for the "UNDER HER SUPERVISION" permission scope
  id            String   @id @default(uuid())
  supervisorId  String
  supervisor    Employee @relation("Supervisor", fields: [supervisorId], references: [id])
  subordinateId String
  subordinate   Employee @relation("Subordinate", fields: [subordinateId], references: [id])
  isActive      Boolean  @default(true)
  assignedAt    DateTime @default(now())
  
  @@unique([supervisorId, subordinateId])
  @@index([supervisorId])
  @@index([subordinateId])
}

// ─── ATTENDANCE MODELS ─────────────────────────────────────────────

model AttendanceRecord {
  // Daily summary record
  id              String           @id @default(uuid())
  employeeId      String
  employee        Employee         @relation(fields: [employeeId], references: [id])
  date            DateTime         @db.Date
  timeIn          DateTime?
  timeOut         DateTime?
  status          AttendanceStatus
  hoursWorked     Float?
  overtimeHours   Float?
  remarks         String?
  verifiedById    String?          // HR who verified/edited this record
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  logs            AttendanceLog[]
  @@unique([employeeId, date])
  @@index([employeeId])
  @@index([date])
  @@index([status])
}

model AttendanceLog {
  // Granular log: late arrivals, early departures, excuse slips
  // Supervisors can VIEW these for their subordinates
  id              String          @id @default(uuid())
  employeeId      String
  employee        Employee        @relation(fields: [employeeId], references: [id])
  attendanceId    String?
  attendance      AttendanceRecord? @relation(fields: [attendanceId], references: [id])
  logType         String          // "LATE", "UNDERTIME", "EXCUSE_SLIP", "OVERTIME", "ABSENT_UNEXCUSED"
  logDate         DateTime        @db.Date
  minutesLate     Int?
  excuseSlipUrl   String?         // uploaded excuse slip file
  notes           String?
  acknowledgedBy  String?         // supervisor who acknowledged
  acknowledgedAt  DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([employeeId])
  @@index([logDate])
}

// ─── LEAVE MODELS ──────────────────────────────────────────────────

model LeaveBalance {
  id              String    @id @default(uuid())
  employeeId      String
  year            Int
  leaveType       LeaveType
  totalAllotted   Float
  used            Float     @default(0)
  pending         Float     @default(0)
  forfeited       Float     @default(0)
  
  @@unique([employeeId, year, leaveType])
  @@index([employeeId])
}

model LeaveRequest {
  id              String      @id @default(uuid())
  employeeId      String
  employee        Employee    @relation("EmployeeLeaves", fields: [employeeId], references: [id])
  leaveType       LeaveType
  startDate       DateTime    @db.Date
  endDate         DateTime    @db.Date
  totalDays       Float
  reason          String
  supportingDocUrl String?
  status          LeaveStatus @default(PENDING)
  approvedById    String?     // HR Officer who approved
  approvedBy      Employee?   @relation("ApproverLeaves", fields: [approvedById], references: [id])
  approvedAt      DateTime?
  rejectionReason String?
  hrNotes         String?
  deletedAt       DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([employeeId])
  @@index([status])
  @@index([startDate, endDate])
}

// ─── PERFORMANCE MODELS ────────────────────────────────────────────

model PerformanceEvaluation {
  id              String           @id @default(uuid())
  employeeId      String
  employee        Employee         @relation("EvaluationSubject", fields: [employeeId], references: [id])
  evaluatorId     String
  evaluator       Employee         @relation("EvaluationEvaluator", fields: [evaluatorId], references: [id])
  period          String           // "Q1 2026", "Annual 2025"
  year            Int
  quarter         Int?             // 1-4, null for annual
  dimensionScores Json             // [{dimension: "Attendance", score: 4.5, weight: 0.2}, ...]
  overallScore    Float
  overallRating   String           // "Outstanding", "Very Satisfactory", etc.
  comments        String?
  status          EvaluationStatus @default(DRAFT)
  finalizedAt     DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([employeeId])
  @@index([year, quarter])
  @@index([status])
}

// ─── TRAINING & ACTIVITIES MODELS ─────────────────────────────────

model Training {
  id              String        @id @default(uuid())
  title           String
  description     String?
  type            String        // "SEMINAR", "WORKSHOP", "CERTIFICATION", "ORIENTATION", "DRILL"
  facilitator     String
  venue           String
  startDate       DateTime
  endDate         DateTime
  hoursCredit     Float
  maxParticipants Int?
  status          TrainingStatus @default(UPCOMING)
  materialsUrl    String?
  createdById     String?       // HR who created this
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  attendees       TrainingAttendee[]
  @@index([status])
  @@index([startDate])
}

model TrainingAttendee {
  id              String    @id @default(uuid())
  trainingId      String
  training        Training  @relation(fields: [trainingId], references: [id])
  employeeId      String
  employee        Employee  @relation(fields: [employeeId], references: [id])
  registeredAt    DateTime  @default(now())
  attended        Boolean   @default(false)
  completedAt     DateTime?
  certificateUrl  String?
  score           Float?    // If training had an exam
  notes           String?

  @@unique([trainingId, employeeId])
  @@index([trainingId])
  @@index([employeeId])
}

model ActivityAttendance {
  // For "ACTIVITIES ATTENDANCES" mentioned in supervisor permission scope
  // Tracks attendance at events, activities, outings, celebrations
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  activityName String
  activityDate DateTime @db.Date
  isPresent   Boolean  @default(false)
  notes       String?
  recordedById String?  // supervisor who recorded
  createdAt   DateTime @default(now())

  @@index([employeeId])
  @@index([activityDate])
}

// ─── COMPLIANCE MODELS ─────────────────────────────────────────────

model ComplianceRequirement {
  id                      String             @id @default(uuid())
  title                   String
  description             String
  category                ComplianceCategory
  dueDate                 DateTime
  status                  ComplianceStatus   @default(PENDING)
  responsibleUnitId       String?
  responsibleUnit         Unit?              @relation(fields: [responsibleUnitId], references: [id])
  aiRiskScore             Float?
  reminderSentAt          DateTime?
  completedAt             DateTime?
  completionNotes         String?
  deletedAt               DateTime?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  documents               ComplianceDocument[]
  @@index([status])
  @@index([dueDate])
  @@index([category])
}

model ComplianceDocument {
  id            String                @id @default(uuid())
  requirementId String
  requirement   ComplianceRequirement @relation(fields: [requirementId], references: [id])
  fileName      String
  fileUrl       String
  uploadedById  String?
  uploadedAt    DateTime              @default(now())

  @@index([requirementId])
}

// ─── HEALTH RECORDS (Restricted Access) ───────────────────────────

model MedicalRecord {
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  date        DateTime @db.Date
  type        String   // "PRE_EMPLOYMENT", "ANNUAL", "OCCUPATIONAL", "IMMUNIZATION"
  findings    String
  recommendations String?
  attachments String[] // file URLs
  recordedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([employeeId])
  @@index([date])
}

model PsychologicalRecord {
  // Access: Own-only for standard/supervisor | ALL for HR Officers
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  date        DateTime @db.Date
  sessionType String   // "PRE_EMPLOYMENT", "ANNUAL", "COUNSELING", "FOLLOW_UP"
  summary     String
  recommendations String?
  attachments String[] // file URLs — the actual "PSYCHOLOGICAL RESULT"
  conductedById String?
  isConfidential Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([employeeId])
}

// ─── PAYROLL MODELS ────────────────────────────────────────────────

model Payslip {
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  period      String   // "June 2026 - 1st Half"
  periodStart DateTime @db.Date
  periodEnd   DateTime @db.Date
  grossPay    Float
  deductions  Json     // { sss: x, philhealth: x, pagibig: x, tax: x, absences: x, loans: x }
  netPay      Float
  isReleased  Boolean  @default(false)
  releasedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([employeeId])
  @@index([period])
  @@index([isReleased])
}

// ─── COMMUNICATION MODELS ──────────────────────────────────────────

model Announcement {
  id                String               @id @default(uuid())
  title             String
  content           String
  priority          AnnouncementPriority @default(NORMAL)
  audience          AnnouncementAudience @default(ALL)
  targetUnitId      String?
  targetUnit        Unit?                @relation(fields: [targetUnitId], references: [id])
  targetJobRoleId   String?
  targetEmployeeId  String?
  isPinned          Boolean              @default(false)
  authorId          String
  author            Employee             @relation(fields: [authorId], references: [id])
  publishedAt       DateTime?
  expiresAt         DateTime?
  deletedAt         DateTime?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  attachments       AnnouncementAttachment[]
  @@index([authorId])
  @@index([audience])
  @@index([isPinned])
  @@index([publishedAt])
}

model AnnouncementAttachment {
  id              String       @id @default(uuid())
  announcementId  String
  announcement    Announcement @relation(fields: [announcementId], references: [id])
  fileName        String
  fileUrl         String
  uploadedAt      DateTime     @default(now())

  @@index([announcementId])
}

model Notification {
  id          String           @id @default(uuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  type        NotificationType
  title       String
  message     String
  link        String?
  isRead      Boolean          @default(false)
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
}

// ─── DOCUMENTS ────────────────────────────────────────────────────

model EmployeeDocument {
  id          String   @id @default(uuid())
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  type        String   // "CONTRACT", "NBI", "DIPLOMA", "LICENSE", "COE", etc.
  fileName    String
  fileUrl     String
  expiresAt   DateTime?
  uploadedById String?
  uploadedAt  DateTime @default(now())
  
  @@index([employeeId])
  @@index([type])
}

model UploadedFile {
  id          String   @id @default(uuid())
  fileName    String
  originalName String
  mimeType    String
  sizeBytes   Int
  fileUrl     String
  uploadedById String?
  purpose     String?  // "PROFILE_PHOTO", "DOCUMENT", "COMPLIANCE", "EXCUSE_SLIP", etc.
  createdAt   DateTime @default(now())
  
  @@index([uploadedById])
}

// ─── AUDIT & ACTIVITY LOGS ─────────────────────────────────────────

model AuditLog {
  id          String   @id @default(uuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String   // "LOGIN", "LOGOUT", "CREATE_EMPLOYEE", "APPROVE_LEAVE", etc.
  resource    String   // "Employee", "LeaveRequest", "PsychologicalRecord", etc.
  resourceId  String?
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([resource])
  @@index([createdAt])
}

model ActivityLog {
  // Lightweight page-view / feature-use tracking (less sensitive than audit)
  id          String   @id @default(uuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}

// ─── AI MODELS ────────────────────────────────────────────────────

model AIInsight {
  id              String        @id @default(uuid())
  type            AIInsightType
  title           String
  content         String
  confidenceScore Float
  module          String
  targetEmployeeId String?
  targetEmployee  Employee?     @relation(fields: [targetEmployeeId], references: [id])
  isActionable    Boolean       @default(false)
  suggestedActions Json?
  isRead          Boolean       @default(false)
  expiresAt       DateTime?
  generatedAt     DateTime      @default(now())
  
  @@index([type])
  @@index([generatedAt])
  @@index([isRead])
}

model AIRequestLog {
  id          String          @id @default(uuid())
  requestedById String?
  prompt      String
  response    String?
  model       String          // from env: configurable model name
  tokensUsed  Int?
  status      AIRequestStatus @default(PENDING)
  durationMs  Int?
  error       String?
  createdAt   DateTime        @default(now())

  @@index([requestedById])
  @@index([status])
  @@index([createdAt])
}

model AIConversation {
  id          String   @id @default(uuid())
  userId      String
  title       String?
  messages    Json     // [{role: "user"/"assistant", content: "...", timestamp: "..."}]
  model       String
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}

// ─── SYSTEM ────────────────────────────────────────────────────────

model SystemSetting {
  id          String   @id @default(uuid())
  key         String   @unique
  value       String
  description String?
  updatedById String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
  
  @@index([key])
}
```

---

## Revised RBAC Implementation

### How Permissions Work in the System

```
JobRole (58 roles) → linked to PermissionTier (FULL/SUPERVISOR/STANDARD)
                  → linked to RolePermission[] → Permission[]

Permission has 3 axes:
  module: "leave" | "attendance" | "payslip" | "profile" | ...
  action: "read" | "create" | "update" | "delete" | "approve" | "export" | ...
  scope:  "OWN" | "SUBORDINATES" | "ALL"
```

### Permission Seed Table (Derived Exactly from Spreadsheet)

| Permission Key | Module | Action | Scope | Who Has It |
|---|---|---|---|---|
| `profile.read.own` | profile | read | OWN | ALL tiers |
| `profile.update.own` | profile | update | OWN | ALL tiers |
| `leave.read.own` | leave | read | OWN | ALL tiers |
| `leave.create.own` | leave | create | OWN | ALL tiers |
| `training.read.own` | training | read | OWN | ALL tiers |
| `payslip.read.own` | payslip | read | OWN | ALL tiers |
| `psychological.read.own` | psychological | read | OWN | ALL tiers |
| `attendance.read.subordinates` | attendance | read | SUBORDINATES | SUPERVISOR + FULL |
| `attendance_log.read.subordinates` | attendance_log | read | SUBORDINATES | SUPERVISOR + FULL |
| `activity.read.subordinates` | activity | read | SUBORDINATES | SUPERVISOR + FULL |
| `employee.read.all` | employee | read | ALL | FULL only |
| `employee.create.all` | employee | create | ALL | FULL only |
| `employee.update.all` | employee | update | ALL | FULL only |
| `employee.delete.all` | employee | delete | ALL | FULL only |
| `leave.approve.all` | leave | approve | ALL | FULL only |
| `attendance.read.all` | attendance | read | ALL | FULL only |
| `attendance.update.all` | attendance | update | ALL | FULL only |
| `psychological.read.all` | psychological | read | ALL | FULL only |
| `payslip.read.all` | payslip | read | ALL | FULL only |
| `ai.read.all` | ai | read | ALL | FULL only |
| `reports.read.all` | reports | read | ALL | FULL only |
| `announcement.create.all` | announcement | create | ALL | FULL only |
| `compliance.read.all` | compliance | read | ALL | FULL only |
| `users.manage.all` | users | manage | ALL | FULL only |
| `audit.read.all` | audit | read | ALL | FULL only |
| `settings.manage.all` | settings | manage | ALL | FULL only |

---

## Revised Sidebar Navigation

Navigation items are **dynamically generated** from the user's resolved permissions. No hardcoded nav arrays on the frontend.

### For HR Officers (FULL access — sees everything):
```
Dashboard
  └─ HR Overview

People & Organization
  ├─ Employees
  ├─ Recruitment
  └─ Organization Chart

Time & Attendance
  ├─ Attendance Monitoring
  ├─ Leave Management
  └─ Work Schedule

Performance
  ├─ Performance Evaluation
  └─ KPI Tracking

Learning & Development
  ├─ Training & Seminars
  └─ Certifications / Records

Health & Wellness
  ├─ Compliance Monitoring
  ├─ Medical Records
  └─ Psychological Records

Payroll
  ├─ E-Payslips
  └─ Payroll Summary

Intelligence
  ├─ AI Workforce Intelligence
  └─ Reports & Analytics

Communication
  ├─ Announcements
  └─ Notifications

Administration
  ├─ User Management
  ├─ Audit Logs
  └─ System Settings
```

### For Supervisors (sees own + subordinate attendance):
```
My Dashboard
My Attendance
My Leave
My Training Records
My E-Payslip
My Psychological Record
Team Attendance & Tardiness  ← subordinates' attendance logs only
Announcements
Notifications
My Profile & Settings
```

### For Standard Employees (own data only):
```
My Dashboard
My Attendance
My Leave
My Training Records
My E-Payslip
My Psychological Record
Announcements
Notifications
My Profile & Settings
```

---

## Revised Dashboard Variants

Only **3 distinct dashboard experiences** needed (not 6 generic ones from v1):

### 1. HR Dashboard (`permissionTier === FULL`)
**Widgets:**
- Total Employees, Present Today, On Leave Today, New This Month
- Attendance Rate (area chart — 30d trend)
- Leave Distribution (donut chart — by type)
- Department/Unit Headcount (bar chart)
- Pending Leave Approvals (approval queue card)
- AI Insight Feed (top 3 prioritized insights)
- Compliance Score Ring + upcoming deadlines
- Quick Actions: Add Employee, Approve Leave, Generate Report, New Announcement
- Recent Activity Feed
- Upcoming Trainings
- Announcement Board (pinned)

### 2. Supervisor Dashboard (`permissionTier === SUPERVISOR`)
**Widgets:**
- Welcome Banner (personalized)
- My Attendance Summary (this month)
- My Leave Balance
- Team Attendance Snapshot (subordinates present/absent today)
- Pending Activities / Late Logs (subordinates)
- My Upcoming Trainings
- My E-Payslip (latest)
- Announcement Board

### 3. Employee Dashboard (`permissionTier === STANDARD`)
**Widgets:**
- Welcome Banner (personalized)
- My Attendance Summary
- My Leave Balance (all types)
- My Upcoming Trainings / Seminars
- My Latest E-Payslip
- My Psychological Record Status
- Announcement Board
- Quick Actions: File Leave, View Payslip

---

## All 58 Job Roles (Complete List for Seed Data)

### HR Department (Tier: FULL)
1. Human Resource Officer
2. Human Resource Assistant/Staff

### Administrative Services (Tier: varies)
3. Assistant Administrator — **SUPERVISOR**
4. Administrative Secretaries — STANDARD
5. Receptionists — STANDARD

### Finance (Tier: STANDARD)
6. Accounting Staff
7. PMO Staff
8. Liaison Officer
9. Stockroom Staff

### General Support Services
10. Kitchen Supervisor — **SUPERVISOR**
11. Kitchen Staff — STANDARD
12. Laundry Staff — STANDARD
13. Janitorial Supervisor — **SUPERVISOR**
14. Janitorial Staff — STANDARD
15. Drivers — STANDARD
16. Maintenance Supervisor — **SUPERVISOR**
17. Maintenance Staff — STANDARD

### Auxiliary Services
18. IGP Coordinator — **SUPERVISOR**
19. Canteen Staff — STANDARD
20. Bakery Staff — STANDARD
21. Dormitory Staff — STANDARD

### Social Services
22. Head SSD — **SUPERVISOR**
23. Social Workers — STANDARD
24. Psychologist — STANDARD
25. ECCD Teacher — STANDARD
26. Part-Time Psychologist — STANDARD

### Pastoral Care / Homelife Services
27. Head Pastoral Care/Homelife Services — **SUPERVISOR**
28. Chapel Staff — STANDARD
29. CY Coordinator — **SUPERVISOR**
30. Pre-School Staff — STANDARD
31. St. Mary Staff — STANDARD
32. St. Joseph Staff — STANDARD
33. PSN Coordinator — **SUPERVISOR**
34. Rendu A Staff — STANDARD
35. Rendu B Staff — STANDARD
36. Rendu C Staff — STANDARD
37. OP Coordinator — **SUPERVISOR**
38. Sta. Luisa Staff — STANDARD
39. St. Vincent Staff — STANDARD
40. CIP Coordinator — **SUPERVISOR**
41. Tahan Center Staff — STANDARD
42. Sanctuary Center Staff — STANDARD
43. Sigliv Boys Staff — STANDARD

### Health Services
44. Clinic Staff — **SUPERVISOR**
45. PT Coordinator — **SUPERVISOR**
46. PT Staff — STANDARD

> [!NOTE]
> Total: 2 FULL + 13 SUPERVISOR + 31 STANDARD = **46 roles** from the 7 units. The sheet also lists rows 1–5 (HR dept) = 2 more FULL. Running total unique roles in spreadsheet: **46 + 2 = 48**. (Some coordinators listed above appear multiple times as coordinators within Pastoral Care but each is distinct.) Final count after deduplication: **46 distinct non-HR roles + 2 HR roles = 48 total**. If you count every row as a separate role including all unit staff (Rendu A/B/C, St. Mary, St. Joseph, etc.) = **58 total rows with data**.

---

## Seed Data Plan

The seed script will create:

### Units (7):
`ADMINISTRATIVE_SERVICES`, `FINANCE`, `GENERAL_SUPPORT_SERVICES`, `AUXILIARY_SERVICES`, `SOCIAL_SERVICES`, `PASTORAL_CARE_HOMELIFE`, `HEALTH_SERVICES`

### Job Roles (48+):
All roles exactly as listed in the spreadsheet with correct `permissionTier` values.

### Permissions:
All permission records from the Permission Seed Table above.

### RolePermissions:
- Every FULL role → all permissions
- Every SUPERVISOR role → own permissions + subordinate attendance permissions
- Every STANDARD role → own permissions only

### Demo Users (one per permission tier):
1. `hr.officer@hsj.org.ph` / `HRISense@2026` — HR Officer (FULL)
2. `kitchen.supervisor@hsj.org.ph` / `HRISense@2026` — Kitchen Supervisor (SUPERVISOR)
3. `kitchen.staff@hsj.org.ph` / `HRISense@2026` — Kitchen Staff (STANDARD)
4. `head.ssd@hsj.org.ph` / `HRISense@2026` — Head SSD (SUPERVISOR)
5. `social.worker@hsj.org.ph` / `HRISense@2026` — Social Worker (STANDARD)

### Sample Employees (20+):
Realistic Filipino names across all units, with attendance, leave, payslip, and training records.

---

## AI Architecture (Revised)

The AI service layer is **completely decoupled from UI**:

```
apps/api/src/ai/
├── interfaces/
│   └── AIProvider.ts         ← common interface all providers implement
├── providers/
│   └── openai.provider.ts    ← implements AIProvider via OpenAI SDK
├── services/
│   ├── workforce.service.ts  ← prompts for workforce analysis
│   ├── compliance.service.ts ← compliance risk scoring
│   ├── attendance.service.ts ← anomaly detection
│   ├── recommendation.service.ts ← HR action recommendations
│   └── nlq.service.ts        ← natural language HR queries
└── ai.factory.ts             ← reads AI_PROVIDER env var, returns correct provider
```

**Environment variables:**
```env
AI_PROVIDER=openai          # switchable: "openai" | "anthropic" | "ollama" (future)
AI_MODEL=gpt-4o-mini        # configurable model name per provider
OPENAI_API_KEY=...
```

---

## API Versioning

All routes prefixed: `/api/v1/`

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me

GET    /api/v1/employees          (HR only: all | own: own profile)
POST   /api/v1/employees          (HR only)
GET    /api/v1/employees/:id
PUT    /api/v1/employees/:id
DELETE /api/v1/employees/:id

GET    /api/v1/attendance         (HR: all | Supervisor: subordinates | Employee: own)
PUT    /api/v1/attendance/:id
GET    /api/v1/attendance/logs    (HR: all | Supervisor: subordinates)

GET    /api/v1/leave              (HR: all | Employee: own)
POST   /api/v1/leave
GET    /api/v1/leave/:id
PUT    /api/v1/leave/:id
PATCH  /api/v1/leave/:id/approve  (HR only)
PATCH  /api/v1/leave/:id/reject   (HR only)

GET    /api/v1/training           (all: own | HR: all)
POST   /api/v1/training           (HR only)
GET    /api/v1/training/:id
POST   /api/v1/training/:id/attend

GET    /api/v1/payslips           (own only unless HR)
GET    /api/v1/payslips/:id

GET    /api/v1/psychological/:employeeId  (own or HR)
POST   /api/v1/psychological      (HR only)

GET    /api/v1/announcements      (all — filtered by audience)
POST   /api/v1/announcements      (HR only)

GET    /api/v1/performance        (HR: all | Employee: own)
POST   /api/v1/performance        (HR only)

GET    /api/v1/compliance         (HR only)
GET    /api/v1/reports/*          (HR only)
GET    /api/v1/ai/insights        (HR only)
POST   /api/v1/ai/query           (HR only)

GET    /api/v1/audit-logs         (HR only)
GET    /api/v1/notifications      (own)
PATCH  /api/v1/notifications/:id/read
```

---

## Open Questions (Awaiting Confirmation Before Implementation)

> [!IMPORTANT]
> **Q1 — Leave Approval by Supervisors:** The spreadsheet does not grant supervisors leave approval rights. Should supervisors be able to **recommend** or **forward** leave requests, or does all leave approval go directly to HR with no supervisor step?

> [!IMPORTANT]
> **Q2 — "Activities Attendance" Module:** The supervisor scope says "ACTIVITIES ATTENDANCES (UNDER HER SUPERVISION)." Is this a distinct module from Training? Should it track things like community events, celebrations, or drills separately from formal seminars/trainings?

> [!NOTE]
> **Q3 — Psychological Records for Psychologist/Part-Time Psychologist:** The Psychologist role is listed as STANDARD access (own records only). Should the Psychologist who **creates** psychological records for other staff have write access to PsychologicalRecord for any employee? Or does that route through HR?

> [!NOTE]
> **Q4 — Clinic Staff / PT Coordinator (no "PROFILE" in access list):** Appears to be an omission in the spreadsheet. I'll treat these as having profile access. Please confirm.

> [!NOTE]
> **Q5 — Recruitment Module:** The spreadsheet does not mention a Recruitment module. Should this still be included for HR Officers since they manage hiring? Or should it be excluded since it's not in the spreadsheet?

---

## Verification Plan

### Automated
- `npm run typecheck` — TypeScript strict mode across all packages
- `npm run lint` — ESLint
- `npx prisma validate` — Schema integrity check
- `npx prisma migrate dev --dry-run` — Migration dry-run

### Manual (Post-Implementation)
- Login as each of the 3 demo user tiers and verify sidebar shows only permitted modules
- HR Officer sees full dashboard and all modules
- Supervisor sees team attendance panel but not full employee directory
- Standard employee sees only their own data
- Verify leave approval only accessible to HR Officers
- Verify psychological records hidden from non-HR when viewing another employee
- Test attendance log visibility scoped to supervisor's subordinates

---

## Implementation Phase Order (Revised)

| Phase | Focus | Changes from v1 |
|---|---|---|
| 0 | Monorepo (done ✅) | No change |
| 1 | Design system (done ✅) | No change |
| 2 | Core UI components (done ✅) | No change |
| 3 | Landing page (done ✅) | No change |
| 4 | Auth pages (done ✅) | Update login to use HR demo credentials |
| **5** | **Auth backend** | **NEW: Must be built before module pages wired** |
| **6** | **Prisma schema (revised)** | **Replace v1 schema with schema above** |
| **7** | **Seed data** | **All 48 roles + 3 demo users + sample data** |
| 8 | Dashboard variants (3 instead of 6) | Simplified to 3 tiers |
| 9 | Module pages (role-gated) | Nav and content filtered by permission tier |
| 10 | Backend API | All routes with RBAC middleware |
| 11 | AI integration | Decoupled provider pattern |
| 12 | Polish + a11y | No change |
