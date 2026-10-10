-- Personal dashboard calendar notes (plans / tasks a user keeps for themselves).
-- Additive only: one new table and its foreign key to users. No existing table,
-- column or row is touched.
-- CreateTable
CREATE TABLE `calendar_notes` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `details` TEXT NULL,
    `isDone` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `calendar_notes_userId_date_idx`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `calendar_notes` ADD CONSTRAINT `calendar_notes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

