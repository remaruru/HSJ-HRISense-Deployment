-- Yearly Achievements: one institutional achievements page per year, with entries.

-- CreateTable
CREATE TABLE `yearly_achievement_pages` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `isSample` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `yearly_achievement_pages_year_idx`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `yearly_achievement_entries` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 1,
    `attachmentPath` VARCHAR(191) NULL,
    `attachmentName` VARCHAR(191) NULL,
    `attachmentMime` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `yearly_achievement_entries_pageId_idx`(`pageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `yearly_achievement_entries` ADD CONSTRAINT `yearly_achievement_entries_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `yearly_achievement_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
