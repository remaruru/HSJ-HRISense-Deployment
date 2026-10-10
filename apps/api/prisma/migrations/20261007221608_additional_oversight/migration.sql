-- Additional (secondary, cross-branch) oversight for the Org Chart. Grants no access;
-- the primary hierarchy stays Employee.immediateSupervisorId.

-- CreateTable
CREATE TABLE `additional_oversights` (
    `id` VARCHAR(191) NOT NULL,
    `overseerId` VARCHAR(191) NOT NULL,
    `overseenEmployeeId` VARCHAR(191) NULL,
    `overseenJobRoleId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `additional_oversights_overseenEmployeeId_idx`(`overseenEmployeeId`),
    INDEX `additional_oversights_overseenJobRoleId_idx`(`overseenJobRoleId`),
    UNIQUE INDEX `additional_oversights_overseerId_overseenEmployeeId_key`(`overseerId`, `overseenEmployeeId`),
    UNIQUE INDEX `additional_oversights_overseerId_overseenJobRoleId_key`(`overseerId`, `overseenJobRoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `additional_oversights` ADD CONSTRAINT `additional_oversights_overseerId_fkey` FOREIGN KEY (`overseerId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_oversights` ADD CONSTRAINT `additional_oversights_overseenEmployeeId_fkey` FOREIGN KEY (`overseenEmployeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_oversights` ADD CONSTRAINT `additional_oversights_overseenJobRoleId_fkey` FOREIGN KEY (`overseenJobRoleId`) REFERENCES `job_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
