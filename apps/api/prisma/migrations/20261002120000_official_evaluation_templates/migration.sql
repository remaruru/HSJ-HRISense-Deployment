-- Official Hospicio evaluation templates: review areas, official flag and
-- source, scoring method, form layout; evaluator-source weights on cycles;
-- the frozen combined result on the head assignment. Additive only.

-- AlterTable
ALTER TABLE `evaluation_assignments` ADD COLUMN `combinedBreakdown` JSON NULL,
    ADD COLUMN `combinedScore` DOUBLE NULL;

-- AlterTable
ALTER TABLE `evaluation_criteria` ADD COLUMN `groupId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `evaluation_cycles` ADD COLUMN `appraisalType` VARCHAR(191) NULL,
    ADD COLUMN `combinedScoring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `headWeight` DOUBLE NULL,
    ADD COLUMN `peerWeight` DOUBLE NULL,
    ADD COLUMN `selfWeight` DOUBLE NULL;

-- AlterTable
ALTER TABLE `evaluation_templates` ADD COLUMN `formLayout` JSON NULL,
    ADD COLUMN `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `officialCode` VARCHAR(191) NULL,
    ADD COLUMN `scoringMethod` ENUM('CRITERIA', 'AREA_WEIGHTED', 'AREA_AVERAGE') NOT NULL DEFAULT 'CRITERIA',
    ADD COLUMN `sourceDocument` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `evaluation_criterion_groups` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 1,
    `weight` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `evaluation_criterion_groups_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `evaluation_criteria_groupId_idx` ON `evaluation_criteria`(`groupId`);

-- CreateIndex
CREATE UNIQUE INDEX `evaluation_templates_officialCode_key` ON `evaluation_templates`(`officialCode`);

-- AddForeignKey
ALTER TABLE `evaluation_criterion_groups` ADD CONSTRAINT `evaluation_criterion_groups_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `evaluation_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluation_criteria` ADD CONSTRAINT `evaluation_criteria_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `evaluation_criterion_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

