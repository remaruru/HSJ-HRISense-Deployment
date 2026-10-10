-- Attendance import foundation + logic/data-integrity constraints
--
-- Authored 2026-09-07 against hrisense_migration_dev_db, then reviewed by hand.
--
-- SCOPE NOTE
-- `prisma migrate diff` also emitted statements correcting PRE-EXISTING drift
-- between the migration history and schema.prisma: 6 DROP INDEX statements, a
-- dropped foreign key on compliance_requirements, and a dozen no-op
-- `MODIFY ... JSON` statements including one on `payslips`. None of those belong
-- to this change, payroll is out of scope, and dropping indexes nobody asked to
-- drop would be a silent performance regression. They were removed deliberately;
-- reconciling that drift is a separate, explicit task.
--
-- This migration is ADDITIVE ONLY:
--   * no DROP TABLE, no DROP COLUMN, no TRUNCATE, no DELETE
--   * new columns are nullable or carry a safe default
--   * attendance_records.sourceType defaults to LEGACY, so existing rows make no
--     false claim about where they came from
--   * the three new unique indexes were verified against live data first
--     (preflight 2026-09-07: 0 violating rows)

-- AlterTable
ALTER TABLE `attendance_records` ADD COLUMN `lastImportBatchId` VARCHAR(191) NULL,
    ADD COLUMN `manuallyModifiedAt` DATETIME(3) NULL,
    ADD COLUMN `manuallyModifiedById` VARCHAR(191) NULL,
    ADD COLUMN `recordVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sourceType` ENUM('LEGACY', 'IMPORT', 'MANUAL', 'SYSTEM') NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE `employee_compliance_records` ADD COLUMN `generatedFromTrainingParticipantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `eventId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `attendance_import_batches` (
    `id` VARCHAR(191) NOT NULL,
    `fileHash` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `storedFilename` VARCHAR(191) NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `uploadedByUserId` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('UPLOADED', 'PARSING', 'VALIDATED', 'APPLYING', 'COMPLETED', 'PARTIALLY_APPLIED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
    `detectedPeriodStart` DATE NULL,
    `detectedPeriodEnd` DATE NULL,
    `totalSourceRows` INTEGER NOT NULL DEFAULT 0,
    `countNew` INTEGER NOT NULL DEFAULT 0,
    `countExactDuplicate` INTEGER NOT NULL DEFAULT 0,
    `countEnrichment` INTEGER NOT NULL DEFAULT 0,
    `countConflict` INTEGER NOT NULL DEFAULT 0,
    `countConflictManual` INTEGER NOT NULL DEFAULT 0,
    `countDuplicateInFile` INTEGER NOT NULL DEFAULT 0,
    `countUnknownEmployee` INTEGER NOT NULL DEFAULT 0,
    `countInvalid` INTEGER NOT NULL DEFAULT 0,
    `countApplied` INTEGER NOT NULL DEFAULT 0,
    `countSkipped` INTEGER NOT NULL DEFAULT 0,
    `countFailed` INTEGER NOT NULL DEFAULT 0,
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `normalizerVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_import_batches_storedFilename_key`(`storedFilename`),
    INDEX `attendance_import_batches_status_idx`(`status`),
    INDEX `attendance_import_batches_uploadedAt_idx`(`uploadedAt`),
    INDEX `attendance_import_batches_fileHash_idx`(`fileHash`),
    INDEX `attendance_import_batches_detectedPeriodStart_detectedPeriod_idx`(`detectedPeriodStart`, `detectedPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_import_raw_rows` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `sourceRowNumber` INTEGER NOT NULL,
    `sourceSheetName` VARCHAR(191) NULL,
    `rawPayload` JSON NOT NULL,
    `rawRowHash` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_import_raw_rows_batchId_idx`(`batchId`),
    INDEX `attendance_import_raw_rows_batchId_rawRowHash_idx`(`batchId`, `rawRowHash`),
    INDEX `attendance_import_raw_rows_candidateId_idx`(`candidateId`),
    UNIQUE INDEX `attendance_import_raw_rows_batchId_sourceRowNumber_key`(`batchId`, `sourceRowNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_import_candidates` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `date` DATE NULL,
    `timeIn` DATETIME(3) NULL,
    `timeOut` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'REST_DAY', 'SUSPENDED') NULL,
    `hoursWorked` DOUBLE NULL,
    `overtimeHours` DOUBLE NULL,
    `classification` ENUM('NEW', 'EXACT_DUPLICATE', 'ENRICHMENT', 'CONFLICT', 'CONFLICT_MANUAL', 'DUPLICATE_IN_FILE', 'UNKNOWN_EMPLOYEE', 'INVALID') NOT NULL DEFAULT 'INVALID',
    `classificationReason` TEXT NULL,
    `existingRecordId` VARCHAR(191) NULL,
    `existingSnapshot` JSON NULL,
    `existingRecordVersion` INTEGER NULL,
    `hrDecision` ENUM('PENDING', 'KEEP_EXISTING', 'USE_UPLOADED', 'SKIP') NOT NULL DEFAULT 'PENDING',
    `hrDecisionByUserId` VARCHAR(191) NULL,
    `hrDecisionAt` DATETIME(3) NULL,
    `hrDecisionReason` TEXT NULL,
    `appliedAt` DATETIME(3) NULL,
    `applyError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_import_candidates_batchId_classification_idx`(`batchId`, `classification`),
    INDEX `attendance_import_candidates_employeeId_date_idx`(`employeeId`, `date`),
    INDEX `attendance_import_candidates_batchId_hrDecision_idx`(`batchId`, `hrDecision`),
    UNIQUE INDEX `attendance_import_candidates_batchId_employeeId_date_key`(`batchId`, `employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `attendance_records_sourceType_idx` ON `attendance_records`(`sourceType`);

-- CreateIndex
CREATE INDEX `attendance_records_lastImportBatchId_idx` ON `attendance_records`(`lastImportBatchId`);

-- CreateIndex
CREATE UNIQUE INDEX `employee_compliance_records_generatedFromTrainingParticipant_key` ON `employee_compliance_records`(`generatedFromTrainingParticipantId`);

-- CreateIndex
CREATE INDEX `employee_weekly_schedules_employeeId_effectiveFrom_effective_idx` ON `employee_weekly_schedules`(`employeeId`, `effectiveFrom`, `effectiveTo`);

-- CreateIndex
CREATE UNIQUE INDEX `employee_weekly_schedules_employeeId_effectiveFrom_key` ON `employee_weekly_schedules`(`employeeId`, `effectiveFrom`);

-- CreateIndex
CREATE UNIQUE INDEX `notifications_eventId_key` ON `notifications`(`eventId`);

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_lastImportBatchId_fkey` FOREIGN KEY (`lastImportBatchId`) REFERENCES `attendance_import_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_manuallyModifiedById_fkey` FOREIGN KEY (`manuallyModifiedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_compliance_records` ADD CONSTRAINT `employee_compliance_records_generatedFromTrainingParticipan_fkey` FOREIGN KEY (`generatedFromTrainingParticipantId`) REFERENCES `training_participants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_batches` ADD CONSTRAINT `attendance_import_batches_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_batches` ADD CONSTRAINT `attendance_import_batches_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_raw_rows` ADD CONSTRAINT `attendance_import_raw_rows_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `attendance_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_raw_rows` ADD CONSTRAINT `attendance_import_raw_rows_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `attendance_import_candidates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_candidates` ADD CONSTRAINT `attendance_import_candidates_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `attendance_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_candidates` ADD CONSTRAINT `attendance_import_candidates_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_candidates` ADD CONSTRAINT `attendance_import_candidates_existingRecordId_fkey` FOREIGN KEY (`existingRecordId`) REFERENCES `attendance_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_candidates` ADD CONSTRAINT `attendance_import_candidates_hrDecisionByUserId_fkey` FOREIGN KEY (`hrDecisionByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
