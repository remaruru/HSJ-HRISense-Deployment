-- CreateTable
CREATE TABLE `applicant_communications` (
    `id` VARCHAR(191) NOT NULL,
    `jobApplicationId` VARCHAR(191) NOT NULL,
    `communicationType` ENUM('APPLICATION_RECEIVED', 'APPLICATION_UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_INVITATION', 'INTERVIEW_RESCHEDULED', 'INTERVIEW_CANCELLED', 'ADDITIONAL_REQUIREMENTS', 'APPLICATION_ACCEPTED', 'APPLICATION_NOT_SELECTED', 'CUSTOM_MESSAGE') NOT NULL,
    `channel` ENUM('EMAIL') NOT NULL,
    `recipientEmail` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `subjectSnapshot` VARCHAR(191) NOT NULL,
    `bodySnapshot` TEXT NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `sendStatus` ENUM('DRAFT', 'SENDING', 'SENT', 'FAILED', 'SIMULATED') NOT NULL,
    `sentByUserId` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureCode` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `retryOfCommunicationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `applicant_communications_jobApplicationId_idx`(`jobApplicationId`),
    INDEX `applicant_communications_communicationType_idx`(`communicationType`),
    INDEX `applicant_communications_sendStatus_idx`(`sendStatus`),
    INDEX `applicant_communications_sentAt_idx`(`sentAt`),
    INDEX `applicant_communications_sentByUserId_idx`(`sentByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `applicant_communications` ADD CONSTRAINT `applicant_communications_jobApplicationId_fkey` FOREIGN KEY (`jobApplicationId`) REFERENCES `job_applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_communications` ADD CONSTRAINT `applicant_communications_sentByUserId_fkey` FOREIGN KEY (`sentByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_communications` ADD CONSTRAINT `applicant_communications_retryOfCommunicationId_fkey` FOREIGN KEY (`retryOfCommunicationId`) REFERENCES `applicant_communications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
