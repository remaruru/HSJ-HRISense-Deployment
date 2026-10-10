-- Hospicio leave form: Leave Without Pay / Offset / Other leave types; address
-- and contact during leave; the head's endorsement and proposed change; and the
-- original request kept when HR approves different dates. Additive only.
--
-- `prisma migrate dev` also proposed dropping legacy indexes and a foreign key on
-- older tables (pre-existing drift unrelated to this change); those were removed.

-- AlterTable
ALTER TABLE `leave_balances` MODIFY `leaveType` ENUM('SICK', 'VACATION', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'SOLO_PARENT', 'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'BEREAVEMENT', 'FORCED', 'LEAVE_WITHOUT_PAY', 'OFFSET', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `addressDuringLeave` VARCHAR(255) NULL,
    ADD COLUMN `adjustmentReason` TEXT NULL,
    ADD COLUMN `contactNumber` VARCHAR(40) NULL,
    ADD COLUMN `endorsedAt` DATETIME(3) NULL,
    ADD COLUMN `endorsedById` VARCHAR(191) NULL,
    ADD COLUMN `endorsementNote` TEXT NULL,
    ADD COLUMN `originalEndDate` DATE NULL,
    ADD COLUMN `originalStartDate` DATE NULL,
    ADD COLUMN `originalTotalDays` DOUBLE NULL,
    ADD COLUMN `proposalReason` TEXT NULL,
    ADD COLUMN `proposedAt` DATETIME(3) NULL,
    ADD COLUMN `proposedById` VARCHAR(191) NULL,
    ADD COLUMN `proposedEndDate` DATE NULL,
    ADD COLUMN `proposedStartDate` DATE NULL,
    ADD COLUMN `proposedTotalDays` DOUBLE NULL,
    MODIFY `leaveType` ENUM('SICK', 'VACATION', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'SOLO_PARENT', 'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'BEREAVEMENT', 'FORCED', 'LEAVE_WITHOUT_PAY', 'OFFSET', 'OTHER') NOT NULL;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_endorsedById_fkey` FOREIGN KEY (`endorsedById`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_proposedById_fkey` FOREIGN KEY (`proposedById`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
