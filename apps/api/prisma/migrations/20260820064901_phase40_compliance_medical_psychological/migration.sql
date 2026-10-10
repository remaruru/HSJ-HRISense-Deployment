-- Phase 40: Compliance + Medical + Psychological Module Schema
-- Additive migration only. No DROP TABLE. No DROP COLUMN.

-- CreateTable
CREATE TABLE `compliance_requirements_new` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('MEDICAL', 'PSYCHOLOGICAL', 'CERTIFICATION', 'TRAINING', 'DOCUMENT', 'OTHER') NOT NULL,
    `tracksExpiry` BOOLEAN NOT NULL DEFAULT false,
    `reminderDays` INTEGER NULL,
    `lifecycle` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `deletedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `compliance_requirements_new_lifecycle_idx`(`lifecycle`),
    INDEX `compliance_requirements_new_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compliance_requirement_scopes` (
    `id` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NOT NULL,
    `scopeType` ENUM('ALL', 'UNIT', 'DEPARTMENT', 'JOB_ROLE', 'EMPLOYEE') NOT NULL,
    `targetUnitId` VARCHAR(191) NULL,
    `targetDepartmentId` VARCHAR(191) NULL,
    `targetJobRoleId` VARCHAR(191) NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `compliance_requirement_scopes_requirementId_idx`(`requirementId`),
    INDEX `compliance_requirement_scopes_scopeType_idx`(`scopeType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records_new` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NULL,
    `examType` VARCHAR(191) NOT NULL,
    `examDate` DATE NOT NULL,
    `examinedBy` VARCHAR(191) NULL,
    `hrNotes` TEXT NULL,
    `expiresAt` DATE NULL,
    `reviewStatus` ENUM('PENDING_REVIEW', 'ACCEPTED', 'NEEDS_CORRECTION') NOT NULL DEFAULT 'PENDING_REVIEW',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewReason` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `medical_records_new_employeeId_idx`(`employeeId`),
    INDEX `medical_records_new_requirementId_idx`(`requirementId`),
    INDEX `medical_records_new_reviewStatus_idx`(`reviewStatus`),
    INDEX `medical_records_new_examDate_idx`(`examDate`),
    INDEX `medical_records_new_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_record_documents` (
    `id` VARCHAR(191) NOT NULL,
    `medicalRecordId` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `notes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `medical_record_documents_storedFilename_key`(`storedFilename`),
    INDEX `medical_record_documents_medicalRecordId_idx`(`medicalRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `psychological_records_new` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NULL,
    `assessmentType` VARCHAR(191) NOT NULL,
    `assessmentDate` DATE NOT NULL,
    `conductedBy` VARCHAR(191) NULL,
    `employeeVisibleSummary` TEXT NULL,
    `hrConfidentialNotes` TEXT NULL,
    `expiresAt` DATE NULL,
    `reviewStatus` ENUM('PENDING_REVIEW', 'ACCEPTED', 'NEEDS_CORRECTION') NOT NULL DEFAULT 'PENDING_REVIEW',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewReason` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `psychological_records_new_employeeId_idx`(`employeeId`),
    INDEX `psychological_records_new_requirementId_idx`(`requirementId`),
    INDEX `psychological_records_new_reviewStatus_idx`(`reviewStatus`),
    INDEX `psychological_records_new_assessmentDate_idx`(`assessmentDate`),
    INDEX `psychological_records_new_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `psychological_record_documents` (
    `id` VARCHAR(191) NOT NULL,
    `psychologicalRecordId` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `visibility` ENUM('EMPLOYEE_VISIBLE', 'HR_ONLY') NOT NULL DEFAULT 'HR_ONLY',
    `notes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `psychological_record_documents_storedFilename_key`(`storedFilename`),
    INDEX `psychological_record_documents_psychologicalRecordId_idx`(`psychologicalRecordId`),
    INDEX `psychological_record_documents_visibility_idx`(`visibility`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_compliance_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NOT NULL,
    `recordTitle` VARCHAR(191) NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `completedAt` DATE NOT NULL,
    `expiresAt` DATE NULL,
    `notes` TEXT NULL,
    `reviewStatus` ENUM('PENDING_REVIEW', 'ACCEPTED', 'NEEDS_CORRECTION') NOT NULL DEFAULT 'PENDING_REVIEW',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewReason` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `employee_compliance_records_employeeId_idx`(`employeeId`),
    INDEX `employee_compliance_records_requirementId_idx`(`requirementId`),
    INDEX `employee_compliance_records_reviewStatus_idx`(`reviewStatus`),
    INDEX `employee_compliance_records_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_compliance_documents` (
    `id` VARCHAR(191) NOT NULL,
    `complianceRecordId` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `visibility` ENUM('VISIBLE', 'HR_ONLY') NOT NULL DEFAULT 'VISIBLE',
    `notes` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `employee_compliance_documents_storedFilename_key`(`storedFilename`),
    INDEX `employee_compliance_documents_complianceRecordId_idx`(`complianceRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `compliance_requirement_scopes` ADD CONSTRAINT `compliance_requirement_scopes_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements_new`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `compliance_requirement_scopes` ADD CONSTRAINT `compliance_requirement_scopes_targetUnitId_fkey` FOREIGN KEY (`targetUnitId`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `compliance_requirement_scopes` ADD CONSTRAINT `compliance_requirement_scopes_targetDepartmentId_fkey` FOREIGN KEY (`targetDepartmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `compliance_requirement_scopes` ADD CONSTRAINT `compliance_requirement_scopes_targetJobRoleId_fkey` FOREIGN KEY (`targetJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `compliance_requirement_scopes` ADD CONSTRAINT `compliance_requirement_scopes_targetEmployeeId_fkey` FOREIGN KEY (`targetEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `medical_records_new` ADD CONSTRAINT `medical_records_new_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `medical_records_new` ADD CONSTRAINT `medical_records_new_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements_new`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `medical_record_documents` ADD CONSTRAINT `medical_record_documents_medicalRecordId_fkey` FOREIGN KEY (`medicalRecordId`) REFERENCES `medical_records_new`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `psychological_records_new` ADD CONSTRAINT `psychological_records_new_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `psychological_records_new` ADD CONSTRAINT `psychological_records_new_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements_new`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `psychological_record_documents` ADD CONSTRAINT `psychological_record_documents_psychologicalRecordId_fkey` FOREIGN KEY (`psychologicalRecordId`) REFERENCES `psychological_records_new`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_compliance_records` ADD CONSTRAINT `employee_compliance_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `employee_compliance_records` ADD CONSTRAINT `employee_compliance_records_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements_new`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `employee_compliance_documents` ADD CONSTRAINT `employee_compliance_documents_complianceRecordId_fkey` FOREIGN KEY (`complianceRecordId`) REFERENCES `employee_compliance_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
