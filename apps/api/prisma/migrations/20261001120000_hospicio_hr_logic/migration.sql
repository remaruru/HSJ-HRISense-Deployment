-- DropIndex
DROP INDEX `evaluation_assignments_cycleId_employeeId_key` ON `evaluation_assignments`;

-- AlterTable
ALTER TABLE `compliance_requirements_new` MODIFY `category` ENUM('MEDICAL', 'PSYCHOLOGICAL', 'CERTIFICATION', 'PROFESSIONAL_LICENSE', 'TRAINING', 'DOCUMENT', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `paternityLeaveEligible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `soloParentLeaveEligible` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `evaluation_assignments` ADD COLUMN `discussionCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `discussionDate` DATE NULL,
    ADD COLUMN `discussionNotes` TEXT NULL,
    ADD COLUMN `discussionRecordedById` VARCHAR(191) NULL,
    ADD COLUMN `raterType` ENUM('SELF', 'PEER', 'HEAD') NOT NULL DEFAULT 'HEAD';

-- AlterTable
ALTER TABLE `job_roles` MODIFY `unitId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `leave_balances` ADD COLUMN `allotmentSource` ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `entitlementAppliedAt` DATETIME(3) NULL,
    ADD COLUMN `entitlementCompletedYears` INTEGER NULL;

-- CreateTable
CREATE TABLE `employee_emergency_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NOT NULL,
    `mobilePhone` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_emergency_contacts_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `employee_emergency_contacts_employeeId_position_key`(`employeeId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_government_ids` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 1,
    `idType` VARCHAR(120) NOT NULL,
    `idNumber` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_government_ids_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluation_template_job_roles` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `jobRoleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `evaluation_template_job_roles_jobRoleId_key`(`jobRoleId`),
    INDEX `evaluation_template_job_roles_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_calendar_working_units` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_calendar_working_units_unitId_idx`(`unitId`),
    UNIQUE INDEX `organization_calendar_working_units_entryId_unitId_key`(`entryId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `evaluation_assignments_cycleId_employeeId_raterType_evaluato_key` ON `evaluation_assignments`(`cycleId`, `employeeId`, `raterType`, `evaluatorId`);

-- AddForeignKey
ALTER TABLE `employee_emergency_contacts` ADD CONSTRAINT `employee_emergency_contacts_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_government_ids` ADD CONSTRAINT `employee_government_ids_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_template_job_roles` ADD CONSTRAINT `evaluation_template_job_roles_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `evaluation_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_template_job_roles` ADD CONSTRAINT `evaluation_template_job_roles_jobRoleId_fkey` FOREIGN KEY (`jobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_calendar_working_units` ADD CONSTRAINT `organization_calendar_working_units_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `organization_calendar_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_calendar_working_units` ADD CONSTRAINT `organization_calendar_working_units_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Data migration (Hospicio-confirmed HR logic) ────────────────────────────

-- 1. Personal email is now the login email. Where an employee has no personal
--    email, carry the legacy work email over (for these rows it is also the
--    login address). Rows that already have a personal email are left alone.
UPDATE `employees`
   SET `personalEmail` = `workEmail`
 WHERE (`personalEmail` IS NULL OR TRIM(`personalEmail`) = '')
   AND `workEmail` IS NOT NULL AND TRIM(`workEmail`) <> '';

-- 2. The existing single emergency contact becomes Emergency Contact #1.
INSERT INTO `employee_emergency_contacts` (`id`, `employeeId`, `position`, `contactName`, `relationship`, `mobilePhone`, `createdAt`, `updatedAt`)
SELECT UUID(), e.`id`, 1, e.`emergencyContactName`, e.`emergencyContactRel`, e.`emergencyContactPhone`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
  FROM `employees` e
 WHERE (TRIM(COALESCE(e.`emergencyContactName`, '')) <> '' OR TRIM(COALESCE(e.`emergencyContactPhone`, '')) <> '')
   AND NOT EXISTS (SELECT 1 FROM `employee_emergency_contacts` c WHERE c.`employeeId` = e.`id` AND c.`position` = 1);

-- 3. Sister: an organisation-wide job role on the FULL permission tier. It has
--    no unit (its holders keep their own unit) and its place in the reporting
--    hierarchy is not confirmed, so supervisor resolution reports it as pending.
INSERT INTO `job_roles` (`id`, `title`, `code`, `unitId`, `departmentId`, `parentJobRoleId`, `isHead`, `isSupervisor`, `hierarchyStatus`, `permissionTier`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Sister', 'SISTER', NULL, NULL, NULL, false, false, 'PENDING_CONFIRMATION', 'FULL', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM `job_roles` WHERE `code` = 'SISTER');

--    Same permission catalogue as the HR Officer role (FULL already passes every
--    check; this keeps the role's permission list consistent with HR's).
INSERT INTO `role_permissions` (`id`, `jobRoleId`, `permissionId`, `createdAt`)
SELECT UUID(), s.`id`, rp.`permissionId`, CURRENT_TIMESTAMP(3)
  FROM `role_permissions` rp
  JOIN `job_roles` hr ON hr.`id` = rp.`jobRoleId` AND hr.`code` = 'HR_OFFICER'
  JOIN `job_roles` s ON s.`code` = 'SISTER'
 WHERE NOT EXISTS (SELECT 1 FROM `role_permissions` x WHERE x.`jobRoleId` = s.`id` AND x.`permissionId` = rp.`permissionId`);
