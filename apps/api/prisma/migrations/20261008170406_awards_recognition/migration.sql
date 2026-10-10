-- Awards & Recognition: award groups (Hospicio grouping terms mapped to current
-- units / roles / employees), awards per period, categories, nominations, one
-- ballot per voter per award, votes, frozen results and Hall of Fame records.

-- CreateTable
CREATE TABLE `award_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    `unitIds` JSON NOT NULL,
    `departmentIds` JSON NOT NULL,
    `jobRoleIds` JSON NOT NULL,
    `employeeIds` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `award_groups_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `awards` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('EMPLOYEE_OF_THE_QUARTER', 'VINCENTIAN', 'LOUISIAN', 'SPECIAL', 'LONGEVITY', 'CUSTOM') NOT NULL,
    `isOfficial` BOOLEAN NOT NULL DEFAULT false,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NULL,
    `periodLabel` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'NOMINATION_OPEN', 'NOMINATION_CLOSED', 'VOTING_OPEN', 'VOTING_CLOSED', 'DELIBERATION', 'VERIFIED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `usesNomination` BOOLEAN NOT NULL,
    `usesVoting` BOOLEAN NOT NULL,
    `requiresConfirmation` BOOLEAN NOT NULL DEFAULT true,
    `resultMode` ENUM('PER_CATEGORY', 'COMBINED') NOT NULL DEFAULT 'PER_CATEGORY',
    `shortlistCount` INTEGER NULL,
    `eligibilityDate` DATE NOT NULL,
    `minYears` INTEGER NULL,
    `maxYears` INTEGER NULL,
    `excludeHallOfFame` BOOLEAN NOT NULL DEFAULT false,
    `excludedJobRoleIds` JSON NULL,
    `nominationOpenedAt` DATETIME(3) NULL,
    `nominationClosedAt` DATETIME(3) NULL,
    `votingOpenedAt` DATETIME(3) NULL,
    `votingClosedAt` DATETIME(3) NULL,
    `reviewStartedAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedById` VARCHAR(191) NULL,
    `finalizedAt` DATETIME(3) NULL,
    `finalizedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `awards_type_year_idx`(`type`, `year`),
    INDEX `awards_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `award_categories` (
    `id` VARCHAR(191) NOT NULL,
    `awardId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 1,
    `votesPerVoter` INTEGER NOT NULL DEFAULT 1,
    `nomineeGroupId` VARCHAR(191) NULL,
    `voterGroupId` VARCHAR(191) NULL,
    `milestoneYears` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `award_categories_awardId_idx`(`awardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `award_nominations` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `nomineeId` VARCHAR(191) NOT NULL,
    `nominatedById` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `award_nominations_nomineeId_idx`(`nomineeId`),
    UNIQUE INDEX `award_nominations_categoryId_nomineeId_nominatedById_key`(`categoryId`, `nomineeId`, `nominatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `award_ballots` (
    `id` VARCHAR(191) NOT NULL,
    `awardId` VARCHAR(191) NOT NULL,
    `voterId` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `award_ballots_awardId_voterId_key`(`awardId`, `voterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `award_votes` (
    `id` VARCHAR(191) NOT NULL,
    `ballotId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `nomineeId` VARCHAR(191) NOT NULL,
    `slot` INTEGER NOT NULL,

    INDEX `award_votes_categoryId_nomineeId_idx`(`categoryId`, `nomineeId`),
    UNIQUE INDEX `award_votes_ballotId_categoryId_slot_key`(`ballotId`, `categoryId`, `slot`),
    UNIQUE INDEX `award_votes_ballotId_categoryId_nomineeId_key`(`ballotId`, `categoryId`, `nomineeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `award_results` (
    `id` VARCHAR(191) NOT NULL,
    `awardId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `voteCount` INTEGER NOT NULL DEFAULT 0,
    `rank` INTEGER NULL,
    `shortlisted` BOOLEAN NOT NULL DEFAULT false,
    `tiedAtCutoff` BOOLEAN NOT NULL DEFAULT false,
    `completedYears` INTEGER NULL,
    `decision` ENUM('PENDING', 'CONFIRMED', 'NOT_AWARDED') NOT NULL DEFAULT 'PENDING',
    `placement` INTEGER NULL,
    `note` TEXT NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `award_results_awardId_idx`(`awardId`),
    INDEX `award_results_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hall_of_fame_records` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `awardYear` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'Hall of Fame Award',
    `conferredOn` DATE NULL,
    `notes` TEXT NULL,
    `recordedById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hall_of_fame_records_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `award_categories` ADD CONSTRAINT `award_categories_awardId_fkey` FOREIGN KEY (`awardId`) REFERENCES `awards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_categories` ADD CONSTRAINT `award_categories_nomineeGroupId_fkey` FOREIGN KEY (`nomineeGroupId`) REFERENCES `award_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_categories` ADD CONSTRAINT `award_categories_voterGroupId_fkey` FOREIGN KEY (`voterGroupId`) REFERENCES `award_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_nominations` ADD CONSTRAINT `award_nominations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `award_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_nominations` ADD CONSTRAINT `award_nominations_nomineeId_fkey` FOREIGN KEY (`nomineeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_nominations` ADD CONSTRAINT `award_nominations_nominatedById_fkey` FOREIGN KEY (`nominatedById`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_ballots` ADD CONSTRAINT `award_ballots_awardId_fkey` FOREIGN KEY (`awardId`) REFERENCES `awards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_ballots` ADD CONSTRAINT `award_ballots_voterId_fkey` FOREIGN KEY (`voterId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_votes` ADD CONSTRAINT `award_votes_ballotId_fkey` FOREIGN KEY (`ballotId`) REFERENCES `award_ballots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_votes` ADD CONSTRAINT `award_votes_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `award_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_votes` ADD CONSTRAINT `award_votes_nomineeId_fkey` FOREIGN KEY (`nomineeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_results` ADD CONSTRAINT `award_results_awardId_fkey` FOREIGN KEY (`awardId`) REFERENCES `awards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_results` ADD CONSTRAINT `award_results_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `award_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `award_results` ADD CONSTRAINT `award_results_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hall_of_fame_records` ADD CONSTRAINT `hall_of_fame_records_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
