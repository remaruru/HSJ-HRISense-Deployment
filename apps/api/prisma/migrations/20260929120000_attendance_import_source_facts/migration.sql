-- AlterTable
ALTER TABLE `employees` ADD COLUMN `biometricCode` VARCHAR(40) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `employees_biometricCode_key` ON `employees`(`biometricCode`);

-- AlterTable
ALTER TABLE `attendance_records`
    ADD COLUMN `sessions` JSON NULL,
    ADD COLUMN `sourceHours` JSON NULL,
    ADD COLUMN `reviewFlags` JSON NULL;

-- AlterTable
ALTER TABLE `attendance_import_candidates`
    ADD COLUMN `sourceEmployeeCode` VARCHAR(40) NULL,
    ADD COLUMN `sessions` JSON NULL,
    ADD COLUMN `sourceHours` JSON NULL,
    ADD COLUMN `reviewFlags` JSON NULL;
