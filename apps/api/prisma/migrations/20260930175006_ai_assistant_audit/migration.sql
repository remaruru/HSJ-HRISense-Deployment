-- AI assistant: request auditing and conversation lookups.
--
-- Scope: ONLY the two AI tables. (Prisma's generator also proposed dropping
-- unrelated legacy indexes and a foreign key on other tables — pre-existing
-- drift that is not part of this change and was deliberately removed.)
--
-- prompt / response / error were VARCHAR(191). The existing analysis endpoint
-- writes responses of up to 8,000 characters and errors of up to 1,000, which
-- would fail on the first real provider call. They become TEXT.

-- AlterTable
ALTER TABLE `ai_request_logs` ADD COLUMN `actorTier` ENUM('FULL', 'SUPERVISOR', 'STANDARD') NULL,
    ADD COLUMN `channel` VARCHAR(20) NULL,
    ADD COLUMN `conversationId` VARCHAR(191) NULL,
    ADD COLUMN `outcome` VARCHAR(30) NULL,
    ADD COLUMN `provider` VARCHAR(40) NULL,
    ADD COLUMN `toolCalls` JSON NULL,
    ADD COLUMN `toolRounds` INTEGER NULL,
    MODIFY `prompt` TEXT NOT NULL,
    MODIFY `response` TEXT NULL,
    MODIFY `error` TEXT NULL;

-- CreateIndex
CREATE INDEX `ai_conversations_userId_isArchived_updatedAt_idx` ON `ai_conversations`(`userId`, `isArchived`, `updatedAt`);

-- CreateIndex
CREATE INDEX `ai_request_logs_conversationId_idx` ON `ai_request_logs`(`conversationId`);
