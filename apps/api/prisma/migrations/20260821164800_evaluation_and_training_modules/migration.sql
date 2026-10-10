-- Evaluation and Training Modules Schema
-- Additive migration only. No DROP TABLE. No DROP COLUMN.

-- CreateTable
CREATE TABLE `evaluation_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `ratingMethod` ENUM('NUMERIC', 'LABELED') NOT NULL DEFAULT 'NUMERIC',
    `minScore` DOUBLE NULL DEFAULT 1,
    `maxScore` DOUBLE NULL DEFAULT 5,
    `scoreLabels` JSON NULL,
    `useWeighting` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_criteria` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 1,
    `isRatingRequired` BOOLEAN NOT NULL DEFAULT true,
    `isCommentRequired` BOOLEAN NOT NULL DEFAULT false,
    `weight` DOUBLE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `evaluation_criteria_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_cycles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `evaluatorAssignmentMethod` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `defaultEvaluatorId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `evaluation_cycles_templateId_idx`(`templateId`),
    INDEX `evaluation_cycles_status_idx`(`status`),
    INDEX `evaluation_cycles_defaultEvaluatorId_idx`(`defaultEvaluatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_cycle_scopes` (
    `id` VARCHAR(191) NOT NULL,
    `cycleId` VARCHAR(191) NOT NULL,
    `scopeType` ENUM('ALL', 'UNIT', 'DEPARTMENT', 'JOB_ROLE', 'EMPLOYEE') NOT NULL,
    `targetUnitId` VARCHAR(191) NULL,
    `targetDepartmentId` VARCHAR(191) NULL,
    `targetJobRoleId` VARCHAR(191) NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `evaluation_cycle_scopes_cycleId_idx`(`cycleId`),
    INDEX `evaluation_cycle_scopes_scopeType_idx`(`scopeType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `cycleId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `evaluatorId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `templateSnapshot` JSON NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'FINALIZED') NOT NULL DEFAULT 'NOT_STARTED',
    `startedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedById` VARCHAR(191) NULL,
    `overallScore` DOUBLE NULL,
    `overallRating` VARCHAR(191) NULL,
    `evaluatorSummary` TEXT NULL,
    `developmentRecommendations` TEXT NULL,
    `isEmployeeVisible` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `evaluation_assignments_cycleId_employeeId_key`(`cycleId`, `employeeId`),
    INDEX `evaluation_assignments_cycleId_idx`(`cycleId`),
    INDEX `evaluation_assignments_employeeId_idx`(`employeeId`),
    INDEX `evaluation_assignments_evaluatorId_idx`(`evaluatorId`),
    INDEX `evaluation_assignments_status_idx`(`status`),
    INDEX `evaluation_assignments_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_responses` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NOT NULL,
    `criterionName` VARCHAR(191) NOT NULL,
    `criterionDescription` TEXT NULL,
    `criterionWeight` DOUBLE NULL,
    `ratingNumeric` DOUBLE NULL,
    `ratingLabel` VARCHAR(191) NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `evaluation_responses_assignmentId_criterionId_key`(`assignmentId`, `criterionId`),
    INDEX `evaluation_responses_assignmentId_idx`(`assignmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_activities` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('TRAINING', 'SEMINAR', 'WORKSHOP', 'ORIENTATION', 'CONFERENCE', 'OTHER') NOT NULL DEFAULT 'TRAINING',
    `description` TEXT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `venue` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endDate` DATE NOT NULL,
    `endTime` VARCHAR(191) NULL,
    `hoursCredit` DOUBLE NULL,
    `maxParticipants` INTEGER NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `complianceRequirementId` VARCHAR(191) NULL,
    `materialsUrl` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `training_activities_status_idx`(`status`),
    INDEX `training_activities_startDate_idx`(`startDate`),
    INDEX `training_activities_complianceRequirementId_idx`(`complianceRequirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_participants` (
    `id` VARCHAR(191) NOT NULL,
    `trainingActivityId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `participationStatus` ENUM('ASSIGNED', 'COMPLETED', 'DID_NOT_ATTEND', 'EXCUSED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `validUntil` DATE NULL,
    `notes` TEXT NULL,
    `certificateOriginalFilename` VARCHAR(191) NULL,
    `certificateStoredFilename` VARCHAR(191) NULL,
    `certificateMimeType` VARCHAR(191) NULL,
    `certificateSizeBytes` INTEGER NULL,
    `complianceRecordId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `training_participants_trainingActivityId_employeeId_key`(`trainingActivityId`, `employeeId`),
    UNIQUE INDEX `training_participants_certificateStoredFilename_key`(`certificateStoredFilename`),
    INDEX `training_participants_trainingActivityId_idx`(`trainingActivityId`),
    INDEX `training_participants_employeeId_idx`(`employeeId`),
    INDEX `training_participants_participationStatus_idx`(`participationStatus`),
    INDEX `training_participants_complianceRecordId_idx`(`complianceRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_activity_documents` (
    `id` VARCHAR(191) NOT NULL,
    `trainingActivityId` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `notes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `training_activity_documents_storedFilename_key`(`storedFilename`),
    INDEX `training_activity_documents_trainingActivityId_idx`(`trainingActivityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `evaluation_criteria` ADD CONSTRAINT `evaluation_criteria_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `evaluation_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycles` ADD CONSTRAINT `evaluation_cycles_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `evaluation_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycles` ADD CONSTRAINT `evaluation_cycles_defaultEvaluatorId_fkey` FOREIGN KEY (`defaultEvaluatorId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycle_scopes` ADD CONSTRAINT `evaluation_cycle_scopes_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `evaluation_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycle_scopes` ADD CONSTRAINT `evaluation_cycle_scopes_targetUnitId_fkey` FOREIGN KEY (`targetUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycle_scopes` ADD CONSTRAINT `evaluation_cycle_scopes_targetDepartmentId_fkey` FOREIGN KEY (`targetDepartmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycle_scopes` ADD CONSTRAINT `evaluation_cycle_scopes_targetJobRoleId_fkey` FOREIGN KEY (`targetJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_cycle_scopes` ADD CONSTRAINT `evaluation_cycle_scopes_targetEmployeeId_fkey` FOREIGN KEY (`targetEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `evaluation_cycles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_assignments` ADD CONSTRAINT `evaluation_assignments_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `evaluation_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_responses` ADD CONSTRAINT `evaluation_responses_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `evaluation_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_activities` ADD CONSTRAINT `training_activities_complianceRequirementId_fkey` FOREIGN KEY (`complianceRequirementId`) REFERENCES `compliance_requirements_new`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_participants` ADD CONSTRAINT `training_participants_trainingActivityId_fkey` FOREIGN KEY (`trainingActivityId`) REFERENCES `training_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_participants` ADD CONSTRAINT `training_participants_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_participants` ADD CONSTRAINT `training_participants_complianceRecordId_fkey` FOREIGN KEY (`complianceRecordId`) REFERENCES `employee_compliance_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_activity_documents` ADD CONSTRAINT `training_activity_documents_trainingActivityId_fkey` FOREIGN KEY (`trainingActivityId`) REFERENCES `training_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
