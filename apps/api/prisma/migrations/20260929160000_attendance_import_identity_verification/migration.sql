-- Identity verification for attendance imports.
--
-- Records whether the name printed beside a device code in the export still
-- matches the employee that code is mapped to. The NAME IS NEVER STORED: only
-- the verdict, the closeness score, and — when the two disagree — the HRISense
-- employee the name most resembles, so HR can confirm in one click.
--
-- Matching remains by `biometricCode` alone. Nothing here assigns attendance.

-- AlterTable
ALTER TABLE `attendance_import_candidates`
    ADD COLUMN `identityVerdict` ENUM('MATCH', 'MISMATCH', 'UNCERTAIN', 'NO_NAME_IN_SOURCE', 'NO_EMPLOYEE_TO_CHECK') NULL,
    ADD COLUMN `identityScore` INTEGER NULL,
    ADD COLUMN `suggestedEmployeeId` VARCHAR(191) NULL,
    ADD COLUMN `suggestedScore` INTEGER NULL;

-- AlterTable
ALTER TABLE `attendance_import_batches`
    ADD COLUMN `countIdentityFlagged` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `attendance_import_candidates_batchId_identityVerdict_idx`
    ON `attendance_import_candidates`(`batchId`, `identityVerdict`);

-- AddForeignKey
ALTER TABLE `attendance_import_candidates`
    ADD CONSTRAINT `attendance_import_candidates_suggestedEmployeeId_fkey`
    FOREIGN KEY (`suggestedEmployeeId`) REFERENCES `employees`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
