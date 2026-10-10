-- DropForeignKey
ALTER TABLE `applicant_communications` DROP FOREIGN KEY `applicant_communications_sentByUserId_fkey`;

-- AlterTable
ALTER TABLE `applicant_communications` ADD COLUMN `initiatedBy` ENUM('SYSTEM', 'USER') NOT NULL DEFAULT 'USER',
    MODIFY `sentByUserId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `application_status_access_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `jobApplicationId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByUserId` VARCHAR(191) NULL,
    `lastAccessedAt` DATETIME(3) NULL,

    UNIQUE INDEX `application_status_access_tokens_tokenHash_key`(`tokenHash`),
    INDEX `application_status_access_tokens_jobApplicationId_idx`(`jobApplicationId`),
    INDEX `application_status_access_tokens_tokenHash_idx`(`tokenHash`),
    INDEX `application_status_access_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `application_status_access_tokens` ADD CONSTRAINT `application_status_access_tokens_jobApplicationId_fkey` FOREIGN KEY (`jobApplicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_communications` ADD CONSTRAINT `applicant_communications_sentByUserId_fkey` FOREIGN KEY (`sentByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
