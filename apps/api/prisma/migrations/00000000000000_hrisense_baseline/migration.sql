-- CreateTable
CREATE TABLE `activity_attendances` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `activityName` VARCHAR(191) NOT NULL,
    `activityDate` DATE NOT NULL,
    `isPresent` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(191) NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_attendances_activityDate_idx`(`activityDate`),
    INDEX `activity_attendances_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `metadata` LONGTEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_createdAt_idx`(`createdAt`),
    INDEX `activity_logs_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `messages` LONGTEXT NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_conversations_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_insights` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('WORKFORCE_TREND', 'ATTRITION_RISK', 'COMPLIANCE_RISK', 'ATTENDANCE_ANOMALY', 'PERFORMANCE_INSIGHT', 'RECOMMENDATION', 'STAFFING_GAP', 'SUMMARY') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `confidenceScore` DOUBLE NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `isActionable` BOOLEAN NOT NULL DEFAULT false,
    `suggestedActions` LONGTEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_insights_generatedAt_idx`(`generatedAt`),
    INDEX `ai_insights_isRead_idx`(`isRead`),
    INDEX `ai_insights_targetEmployeeId_fkey`(`targetEmployeeId`),
    INDEX `ai_insights_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_request_logs` (
    `id` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NULL,
    `prompt` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NULL,
    `model` VARCHAR(191) NOT NULL,
    `tokensUsed` INTEGER NULL,
    `promptTokens` INTEGER NULL,
    `completionTokens` INTEGER NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `durationMs` INTEGER NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_request_logs_createdAt_idx`(`createdAt`),
    INDEX `ai_request_logs_requestedById_idx`(`requestedById`),
    INDEX `ai_request_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `announcementId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcement_attachments_announcementId_idx`(`announcementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `priority` ENUM('NORMAL', 'IMPORTANT', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `audience` ENUM('ALL', 'UNIT', 'ROLE', 'INDIVIDUAL') NOT NULL DEFAULT 'ALL',
    `targetUnitId` VARCHAR(191) NULL,
    `targetJobRoleId` VARCHAR(191) NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `authorId` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `announcements_audience_idx`(`audience`),
    INDEX `announcements_authorId_idx`(`authorId`),
    INDEX `announcements_isPinned_idx`(`isPinned`),
    INDEX `announcements_publishedAt_idx`(`publishedAt`),
    INDEX `announcements_targetUnitId_fkey`(`targetUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_logs` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NULL,
    `logType` VARCHAR(191) NOT NULL,
    `logDate` DATE NOT NULL,
    `minutesLate` INTEGER NULL,
    `excuseSlipUrl` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `acknowledgedBy` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_logs_attendanceId_fkey`(`attendanceId`),
    INDEX `attendance_logs_employeeId_idx`(`employeeId`),
    INDEX `attendance_logs_logDate_idx`(`logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `timeIn` DATETIME(3) NULL,
    `timeOut` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'REST_DAY', 'SUSPENDED') NOT NULL,
    `hoursWorked` DOUBLE NULL,
    `overtimeHours` DOUBLE NULL,
    `remarks` VARCHAR(191) NULL,
    `verifiedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_records_date_idx`(`date`),
    INDEX `attendance_records_employeeId_idx`(`employeeId`),
    INDEX `attendance_records_status_idx`(`status`),
    UNIQUE INDEX `attendance_records_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldValue` LONGTEXT NULL,
    `newValue` LONGTEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorUserId` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `metadata` LONGTEXT NULL,
    `targetEmployeeId` VARCHAR(191) NULL,

    INDEX `audit_logs_actorUserId_idx`(`actorUserId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    INDEX `audit_logs_entityType_idx`(`entityType`),
    INDEX `audit_logs_targetEmployeeId_idx`(`targetEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compliance_documents` (
    `id` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `compliance_documents_requirementId_idx`(`requirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compliance_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `category` ENUM('REGULATORY', 'LICENSING', 'TRAINING', 'HEALTH', 'SAFETY', 'DOCUMENTATION', 'BIR', 'SSS', 'PHILHEALTH', 'PAGIBIG') NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('COMPLIANT', 'NON_COMPLIANT', 'AT_RISK', 'PENDING', 'EXEMPTED') NOT NULL DEFAULT 'PENDING',
    `responsibleUnitId` VARCHAR(191) NULL,
    `aiRiskScore` DOUBLE NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `completionNotes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `compliance_requirements_category_idx`(`category`),
    INDEX `compliance_requirements_dueDate_idx`(`dueDate`),
    INDEX `compliance_requirements_responsibleUnitId_fkey`(`responsibleUnitId`),
    INDEX `compliance_requirements_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `headJobRoleId` VARCHAR(191) NULL,
    `parentDepartmentId` VARCHAR(191) NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_code_key`(`code`),
    INDEX `departments_code_idx`(`code`),
    INDEX `departments_headJobRoleId_idx`(`headJobRoleId`),
    INDEX `departments_parentDepartmentId_idx`(`parentDepartmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_token_key`(`token`),
    INDEX `email_verification_tokens_token_idx`(`token`),
    INDEX `email_verification_tokens_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `category` ENUM('RESUME', 'EMPLOYMENT_CONTRACT', 'GOVERNMENT_ID', 'MEDICAL_CLEARANCE', 'CERTIFICATE', 'OTHER') NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `isVisibleToEmployee` BOOLEAN NOT NULL DEFAULT true,
    `isVisibleToSupervisor` BOOLEAN NOT NULL DEFAULT false,
    `mimeType` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `replacedAt` DATETIME(3) NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `employee_documents_storedFilename_key`(`storedFilename`),
    INDEX `employee_documents_category_idx`(`category`),
    INDEX `employee_documents_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `middleName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `suffix` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY') NOT NULL,
    `dateOfBirth` DATE NOT NULL,
    `placeOfBirth` VARCHAR(191) NULL,
    `civilStatus` ENUM('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'LEGALLY_SEPARATED') NOT NULL,
    `nationality` VARCHAR(191) NOT NULL DEFAULT 'Filipino',
    `religion` VARCHAR(191) NULL,
    `personalEmail` VARCHAR(191) NULL,
    `workEmail` VARCHAR(191) NULL,
    `mobilePhone` VARCHAR(191) NOT NULL,
    `telephoneNumber` VARCHAR(191) NULL,
    `homePhone` VARCHAR(191) NULL,
    `presentAddress` VARCHAR(191) NOT NULL,
    `permanentAddress` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NOT NULL,
    `emergencyContactRel` VARCHAR(191) NOT NULL,
    `emergencyContactPhone` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `jobRoleId` VARCHAR(191) NOT NULL,
    `employmentStatus` ENUM('REGULAR', 'PROBATIONARY', 'CONTRACTUAL', 'CASUAL', 'PART_TIME') NOT NULL DEFAULT 'REGULAR',
    `employmentState` ENUM('ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    `workSchedule` ENUM('REGULAR_DAY_SHIFT', 'FLEXIBLE_SHIFT', 'NIGHT_SHIFT', 'ROTATING_SHIFT', 'PART_TIME_MORNING', 'PART_TIME_AFTERNOON') NOT NULL DEFAULT 'REGULAR_DAY_SHIFT',
    `hireDate` DATE NOT NULL,
    `probationDate` DATE NULL,
    `regularizationDate` DATE NULL,
    `separationDate` DATE NULL,
    `separationReason` VARCHAR(191) NULL,
    `sssNumber` VARCHAR(191) NULL,
    `philhealthNumber` VARCHAR(191) NULL,
    `pagibigNumber` VARCHAR(191) NULL,
    `tinNumber` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `immediateSupervisorId` VARCHAR(191) NULL,
    `supervisorAssignmentSource` ENUM('AUTO_JOB_ROLE', 'AUTO_DEPARTMENT_HEAD', 'AUTO_UNIT_HEAD', 'MANUAL_OVERRIDE') NULL,
    `supervisorAssignmentStatus` ENUM('ASSIGNED', 'PENDING', 'OVERRIDDEN') NULL,
    `supervisorOverrideAt` DATETIME(3) NULL,
    `supervisorOverrideById` VARCHAR(191) NULL,
    `supervisorOverrideReason` VARCHAR(191) NULL,
    `supervisorPendingReason` ENUM('MISSING_PARENT_ROLE', 'NO_ACTIVE_SUPERVISOR', 'UNCLEAR_HIERARCHY', 'MISSING_HEAD_CONFIGURATION') NULL,

    UNIQUE INDEX `employees_employeeNumber_key`(`employeeNumber`),
    UNIQUE INDEX `employees_workEmail_key`(`workEmail`),
    INDEX `employees_departmentId_idx`(`departmentId`),
    INDEX `employees_employeeNumber_idx`(`employeeNumber`),
    INDEX `employees_employmentStatus_idx`(`employmentStatus`),
    INDEX `employees_immediateSupervisorId_idx`(`immediateSupervisorId`),
    INDEX `employees_jobRoleId_idx`(`jobRoleId`),
    INDEX `employees_supervisorAssignmentSource_idx`(`supervisorAssignmentSource`),
    INDEX `employees_supervisorAssignmentStatus_idx`(`supervisorAssignmentStatus`),
    INDEX `employees_supervisorOverrideById_fkey`(`supervisorOverrideById`),
    INDEX `employees_unitId_idx`(`unitId`),
    INDEX `employees_workEmail_idx`(`workEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_roles` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `permissionTier` ENUM('FULL', 'SUPERVISOR', 'STANDARD') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `hierarchyStatus` ENUM('CONFIRMED', 'PENDING_CONFIRMATION') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    `isHead` BOOLEAN NOT NULL DEFAULT false,
    `isSupervisor` BOOLEAN NOT NULL DEFAULT false,
    `parentJobRoleId` VARCHAR(191) NULL,

    UNIQUE INDEX `job_roles_code_key`(`code`),
    INDEX `job_roles_departmentId_idx`(`departmentId`),
    INDEX `job_roles_hierarchyStatus_idx`(`hierarchyStatus`),
    INDEX `job_roles_parentJobRoleId_idx`(`parentJobRoleId`),
    INDEX `job_roles_permissionTier_idx`(`permissionTier`),
    INDEX `job_roles_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `leaveType` ENUM('SICK', 'VACATION', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'SOLO_PARENT', 'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'BEREAVEMENT', 'FORCED') NOT NULL,
    `totalAllotted` DOUBLE NOT NULL,
    `used` DOUBLE NOT NULL DEFAULT 0,
    `pending` DOUBLE NOT NULL DEFAULT 0,
    `forfeited` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leave_balances_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `leave_balances_employeeId_year_leaveType_key`(`employeeId`, `year`, `leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `leaveType` ENUM('SICK', 'VACATION', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'SOLO_PARENT', 'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'BEREAVEMENT', 'FORCED') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `totalDays` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `supportingDocUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'FOR_REVIEW') NOT NULL DEFAULT 'PENDING',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `hrNotes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leave_requests_approvedById_fkey`(`approvedById`),
    INDEX `leave_requests_employeeId_idx`(`employeeId`),
    INDEX `leave_requests_startDate_endDate_idx`(`startDate`, `endDate`),
    INDEX `leave_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `findings` VARCHAR(191) NOT NULL,
    `recommendations` VARCHAR(191) NULL,
    `attachments` LONGTEXT NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `medical_records_date_idx`(`date`),
    INDEX `medical_records_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('LEAVE_FILED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'EVALUATION_ASSIGNED', 'EVALUATION_SUBMITTED', 'ANNOUNCEMENT', 'COMPLIANCE_ALERT', 'AI_INSIGHT', 'ATTENDANCE_ALERT', 'TRAINING_REMINDER', 'SYSTEM', 'PAYSLIP_RELEASED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_createdAt_idx`(`createdAt`),
    INDEX `notifications_isRead_idx`(`isRead`),
    INDEX `notifications_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_drafts` (
    `id` VARCHAR(191) NOT NULL,
    `data` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NOT NULL,
    `lastUpdatedById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdEmployeeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `onboarding_drafts_createdEmployeeId_key`(`createdEmployeeId`),
    INDEX `onboarding_drafts_assignedToId_idx`(`assignedToId`),
    INDEX `onboarding_drafts_createdById_idx`(`createdById`),
    INDEX `onboarding_drafts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_token_idx`(`token`),
    INDEX `password_reset_tokens_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `grossPay` DOUBLE NOT NULL,
    `deductions` LONGTEXT NOT NULL,
    `netPay` DOUBLE NOT NULL,
    `isReleased` BOOLEAN NOT NULL DEFAULT false,
    `releasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payslips_employeeId_idx`(`employeeId`),
    INDEX `payslips_isReleased_idx`(`isReleased`),
    INDEX `payslips_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_evaluations` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `evaluatorId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NULL,
    `dimensionScores` LONGTEXT NOT NULL,
    `overallScore` DOUBLE NOT NULL,
    `overallRating` VARCHAR(191) NOT NULL,
    `comments` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `finalizedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `performance_evaluations_employeeId_idx`(`employeeId`),
    INDEX `performance_evaluations_evaluatorId_fkey`(`evaluatorId`),
    INDEX `performance_evaluations_status_idx`(`status`),
    INDEX `performance_evaluations_year_quarter_idx`(`year`, `quarter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    INDEX `permissions_module_idx`(`module`),
    UNIQUE INDEX `permissions_module_action_scope_key`(`module`, `action`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `psychological_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `sessionType` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `recommendations` VARCHAR(191) NULL,
    `attachments` LONGTEXT NULL,
    `conductedById` VARCHAR(191) NULL,
    `isConfidential` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `psychological_records_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `jobRoleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_jobRoleId_idx`(`jobRoleId`),
    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `role_permissions_jobRoleId_permissionId_key`(`jobRoleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supervision_links` (
    `id` VARCHAR(191) NOT NULL,
    `supervisorId` VARCHAR(191) NOT NULL,
    `subordinateId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supervision_links_subordinateId_idx`(`subordinateId`),
    INDEX `supervision_links_supervisorId_idx`(`supervisorId`),
    UNIQUE INDEX `supervision_links_supervisorId_subordinateId_key`(`supervisorId`, `subordinateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `system_settings_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_attendees` (
    `id` VARCHAR(191) NOT NULL,
    `trainingId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attended` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `score` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `training_attendees_employeeId_idx`(`employeeId`),
    INDEX `training_attendees_trainingId_idx`(`trainingId`),
    UNIQUE INDEX `training_attendees_trainingId_employeeId_key`(`trainingId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trainings` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `facilitator` VARCHAR(191) NOT NULL,
    `venue` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `hoursCredit` DOUBLE NOT NULL,
    `maxParticipants` INTEGER NULL,
    `status` ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED') NOT NULL DEFAULT 'UPCOMING',
    `materialsUrl` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `trainings_startDate_idx`(`startDate`),
    INDEX `trainings_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `headJobRoleId` VARCHAR(191) NULL,
    `parentUnitId` VARCHAR(191) NULL,

    UNIQUE INDEX `units_name_key`(`name`),
    UNIQUE INDEX `units_code_key`(`code`),
    INDEX `units_code_idx`(`code`),
    INDEX `units_departmentId_fkey`(`departmentId`),
    INDEX `units_headJobRoleId_idx`(`headJobRoleId`),
    INDEX `units_parentUnitId_idx`(`parentUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploaded_files` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `purpose` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `uploaded_files_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `deviceInfo` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isRevoked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_sessions_refreshToken_key`(`refreshToken`),
    INDEX `user_sessions_refreshToken_idx`(`refreshToken`),
    INDEX `user_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastLoginIp` VARCHAR(191) NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_employeeId_key`(`employeeId`),
    INDEX `users_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `activity_attendances` ADD CONSTRAINT `activity_attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_insights` ADD CONSTRAINT `ai_insights_targetEmployeeId_fkey` FOREIGN KEY (`targetEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_attachments` ADD CONSTRAINT `announcement_attachments_announcementId_fkey` FOREIGN KEY (`announcementId`) REFERENCES `announcements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_targetUnitId_fkey` FOREIGN KEY (`targetUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `attendance_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compliance_documents` ADD CONSTRAINT `compliance_documents_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compliance_requirements` ADD CONSTRAINT `compliance_requirements_responsibleUnitId_fkey` FOREIGN KEY (`responsibleUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_headJobRoleId_fkey` FOREIGN KEY (`headJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parentDepartmentId_fkey` FOREIGN KEY (`parentDepartmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_immediateSupervisorId_fkey` FOREIGN KEY (`immediateSupervisorId`) REFERENCES `employees`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_jobRoleId_fkey` FOREIGN KEY (`jobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_supervisorOverrideById_fkey` FOREIGN KEY (`supervisorOverrideById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_roles` ADD CONSTRAINT `job_roles_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_roles` ADD CONSTRAINT `job_roles_parentJobRoleId_fkey` FOREIGN KEY (`parentJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_roles` ADD CONSTRAINT `job_roles_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_evaluations` ADD CONSTRAINT `performance_evaluations_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_evaluations` ADD CONSTRAINT `performance_evaluations_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `psychological_records` ADD CONSTRAINT `psychological_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_jobRoleId_fkey` FOREIGN KEY (`jobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supervision_links` ADD CONSTRAINT `supervision_links_subordinateId_fkey` FOREIGN KEY (`subordinateId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supervision_links` ADD CONSTRAINT `supervision_links_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_attendees` ADD CONSTRAINT `training_attendees_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_attendees` ADD CONSTRAINT `training_attendees_trainingId_fkey` FOREIGN KEY (`trainingId`) REFERENCES `trainings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_headJobRoleId_fkey` FOREIGN KEY (`headJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `units` ADD CONSTRAINT `units_parentUnitId_fkey` FOREIGN KEY (`parentUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
