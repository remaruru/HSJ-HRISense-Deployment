-- CreateTable
CREATE TABLE `job_openings` (
    `id` VARCHAR(191) NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `jobRoleId` VARCHAR(191) NOT NULL,
    `employmentType` ENUM('REGULAR', 'PROBATIONARY', 'CONTRACTUAL', 'CASUAL', 'PART_TIME') NOT NULL,
    `vacancies` INTEGER NULL,
    `description` TEXT NOT NULL,
    `responsibilities` TEXT NOT NULL,
    `qualifications` TEXT NOT NULL,
    `requiredDocuments` TEXT NULL,
    `openingDate` DATE NOT NULL,
    `closingDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'FILLED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_openings_referenceNumber_key`(`referenceNumber`),
    UNIQUE INDEX `job_openings_slug_key`(`slug`),
    INDEX `job_openings_status_idx`(`status`),
    INDEX `job_openings_closingDate_idx`(`closingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicants` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `middleName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `suffix` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `applicants_email_idx`(`email`),
    INDEX `applicants_mobile_idx`(`mobile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` VARCHAR(191) NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `jobOpeningId` VARCHAR(191) NOT NULL,
    `applicationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEWED', 'FOR_REQUIREMENTS', 'HIRED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
    `source` VARCHAR(191) NULL,
    `applicantMessage` TEXT NULL,
    `privacyConsent` BOOLEAN NOT NULL,
    `consentTimestamp` DATETIME(3) NOT NULL,
    `onboardingDraftId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_applications_referenceNumber_key`(`referenceNumber`),
    UNIQUE INDEX `job_applications_onboardingDraftId_key`(`onboardingDraftId`),
    UNIQUE INDEX `job_applications_employeeId_key`(`employeeId`),
    INDEX `job_applications_status_idx`(`status`),
    INDEX `job_applications_jobOpeningId_idx`(`jobOpeningId`),
    INDEX `job_applications_applicantId_idx`(`applicantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_documents` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `applicant_documents_storedFilename_key`(`storedFilename`),
    INDEX `applicant_documents_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_interviews` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `interviewType` ENUM('INITIAL', 'TECHNICAL', 'PANEL', 'FINAL', 'OTHER') NOT NULL,
    `locationDetails` TEXT NULL,
    `interviewer` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `recommendation` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `applicant_interviews_applicationId_idx`(`applicationId`),
    INDEX `applicant_interviews_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `previousStatus` ENUM('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEWED', 'FOR_REQUIREMENTS', 'HIRED', 'REJECTED', 'WITHDRAWN') NULL,
    `newStatus` ENUM('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEWED', 'FOR_REQUIREMENTS', 'HIRED', 'REJECTED', 'WITHDRAWN') NOT NULL,
    `reason` TEXT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_status_history_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_notes` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `note` TEXT NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `applicant_notes_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_openings` ADD CONSTRAINT `job_openings_jobRoleId_fkey` FOREIGN KEY (`jobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `applicants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_jobOpeningId_fkey` FOREIGN KEY (`jobOpeningId`) REFERENCES `job_openings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_documents` ADD CONSTRAINT `applicant_documents_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_interviews` ADD CONSTRAINT `applicant_interviews_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_status_history` ADD CONSTRAINT `application_status_history_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_notes` ADD CONSTRAINT `applicant_notes_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
