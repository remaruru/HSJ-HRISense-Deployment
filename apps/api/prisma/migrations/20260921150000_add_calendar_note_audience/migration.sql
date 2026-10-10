-- Shared dashboard calendar notes: an audience on each note (PERSONAL by default,
-- so every existing note stays private) and a recipients table for notes HR
-- addresses to selected employees. Additive only.
-- AlterTable
ALTER TABLE `calendar_notes` ADD COLUMN `audience` ENUM('PERSONAL', 'ALL', 'SELECTED') NOT NULL DEFAULT 'PERSONAL';

-- CreateTable
CREATE TABLE `calendar_note_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `noteId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `calendar_note_recipients_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `calendar_note_recipients_noteId_employeeId_key`(`noteId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `calendar_notes_audience_date_idx` ON `calendar_notes`(`audience`, `date`);

-- AddForeignKey
ALTER TABLE `calendar_note_recipients` ADD CONSTRAINT `calendar_note_recipients_noteId_fkey` FOREIGN KEY (`noteId`) REFERENCES `calendar_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_note_recipients` ADD CONSTRAINT `calendar_note_recipients_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

