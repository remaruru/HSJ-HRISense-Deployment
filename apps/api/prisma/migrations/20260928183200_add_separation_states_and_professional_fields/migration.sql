-- AlterTable
ALTER TABLE `employees` ADD COLUMN `prcLicenseNumber` VARCHAR(30) NULL,
    ADD COLUMN `professionalRole` VARCHAR(120) NULL,
    MODIFY `employmentState` ENUM('ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'RETIRED', 'AWOL', 'OTHERS') NOT NULL DEFAULT 'ACTIVE';

