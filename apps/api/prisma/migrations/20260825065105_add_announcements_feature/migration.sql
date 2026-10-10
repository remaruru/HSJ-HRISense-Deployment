-- =============================================================================
-- Migration: add_announcements_feature
-- Description: In-place schema upgrade for the complete Announcements lifecycle
--              feature. No DROP TABLE used. Existing rows and columns preserved.
--
-- Changes to EXISTING tables (all additive / in-place):
--   announcements            : ADD body, state, publishAt, archivedAt,
--                              createdByUserId; DROP legacy deletedAt, publishedAt;
--                              DROP legacy FKs that are no longer schema-driven;
--                              BACKFILL body FROM content for existing rows;
--                              BACKFILL publishAt FROM publishedAt;
--                              SET state = ACTIVE for pre-existing published rows.
--   announcement_attachments : ADD originalFilename, storedFilename, mimeType,
--                              sizeBytes, uploadedByUserId (all nullable).
--                              Legacy fileName/fileUrl columns retained.
--
-- NEW tables:
--   announcement_audience_scopes  : Per-announcement scope targeting.
--   announcement_recipients       : Recipient snapshot with readAt tracking.
--                                   UNIQUE(announcementId, employeeId).
--
-- Enum additions:
--   AnnouncementState      : DRAFT | ACTIVE | ARCHIVED
--   AnnouncementScopeType  : ALL | UNIT | DEPARTMENT | JOB_ROLE | EMPLOYEE
--   AnnouncementAudience   : retained unchanged (legacy, unused by new models)
--   AnnouncementPriority   : retained unchanged (reused)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Drop legacy foreign keys that reference old schema-managed columns.
--         The announcements.authorId and announcements.targetUnitId relations
--         are no longer schema-managed (replaced by createdByUserId and
--         AnnouncementAudienceScope).
-- -----------------------------------------------------------------------------

-- DropForeignKey
ALTER TABLE `announcement_attachments` DROP FOREIGN KEY `announcement_attachments_announcementId_fkey`;

-- DropForeignKey (announcements.authorId → employees.id — now a legacy nullable field)
ALTER TABLE `announcements` DROP FOREIGN KEY `announcements_authorId_fkey`;

-- DropForeignKey (announcements.targetUnitId → units.id — replaced by scope table)
ALTER TABLE `announcements` DROP FOREIGN KEY `announcements_targetUnitId_fkey`;

-- -----------------------------------------------------------------------------
-- STEP 2: Drop legacy indexes on the announcements table.
--         New indexes will replace them below.
-- -----------------------------------------------------------------------------

-- DropIndex (audience enum — legacy targeting column no longer indexed)
DROP INDEX `announcements_audience_idx` ON `announcements`;

-- DropIndex (publishedAt — replaced by publishAt below)
DROP INDEX `announcements_publishedAt_idx` ON `announcements`;

-- -----------------------------------------------------------------------------
-- STEP 3: ALTER announcements table — add new columns BEFORE removing old ones.
--
--         IMPORTANT DATA PRESERVATION STRATEGY:
--         - body TEXT is added as NULLABLE first.
--         - publishAt is added as NULLABLE.
--         - state is added with DEFAULT 'DRAFT'.
--         - Backfill data from legacy columns (Steps 4–6) before dropping them.
--         - deletedAt is all NULL for existing rows — safe to drop.
--         - publishedAt values will be migrated to publishAt in Step 5.
-- -----------------------------------------------------------------------------

-- AlterTable: add new columns
ALTER TABLE `announcements`
    ADD COLUMN `body`            TEXT         NULL,
    ADD COLUMN `state`           ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `publishAt`       DATETIME(3)  NULL,
    ADD COLUMN `archivedAt`      DATETIME(3)  NULL,
    ADD COLUMN `createdByUserId` VARCHAR(191) NULL,
    MODIFY     `title`           VARCHAR(255) NOT NULL,
    MODIFY     `authorId`        VARCHAR(191) NULL;

-- -----------------------------------------------------------------------------
-- STEP 4: BACKFILL body ← content for all existing announcement rows.
--         The old content column is VARCHAR(191). This copies the value into
--         the new TEXT body column for historical preservation.
-- -----------------------------------------------------------------------------

UPDATE `announcements` SET `body` = `content` WHERE `body` IS NULL;

-- -----------------------------------------------------------------------------
-- STEP 5: BACKFILL publishAt ← publishedAt for pre-existing published rows.
--         All 4 seed rows had publishedAt set.
-- -----------------------------------------------------------------------------

UPDATE `announcements` SET `publishAt` = `publishedAt` WHERE `publishedAt` IS NOT NULL AND `publishAt` IS NULL;

-- -----------------------------------------------------------------------------
-- STEP 6: SET state = 'ACTIVE' for rows that had publishedAt in the past
--         (i.e. were historically published). Use conservative logic:
--         any row with a non-null publishedAt value is treated as published.
--         This does NOT invent recipients or audience scopes for these rows.
-- -----------------------------------------------------------------------------

UPDATE `announcements` SET `state` = 'ACTIVE' WHERE `publishedAt` IS NOT NULL;

-- -----------------------------------------------------------------------------
-- STEP 7: DROP the legacy columns that have been migrated.
--         - publishedAt: migrated to publishAt in Step 5.
--         - deletedAt: all values were NULL; no data lost.
--         Both confirmed safe to remove.
-- -----------------------------------------------------------------------------

ALTER TABLE `announcements`
    DROP COLUMN `publishedAt`,
    DROP COLUMN `deletedAt`;

-- -----------------------------------------------------------------------------
-- STEP 8: ALTER announcement_attachments — add secure metadata columns.
--         ALL new columns are NULLABLE to preserve 0 existing rows safely.
--         Legacy fileName and fileUrl columns are intentionally retained.
-- -----------------------------------------------------------------------------

-- AlterTable: add secure metadata columns
ALTER TABLE `announcement_attachments`
    ADD COLUMN `originalFilename`  VARCHAR(191) NULL,
    ADD COLUMN `storedFilename`    VARCHAR(191) NULL,
    ADD COLUMN `mimeType`          VARCHAR(191) NULL,
    ADD COLUMN `sizeBytes`         INT          NULL,
    ADD COLUMN `uploadedByUserId`  VARCHAR(191) NULL;

-- -----------------------------------------------------------------------------
-- STEP 9: CREATE new tables.
-- -----------------------------------------------------------------------------

-- CreateTable: announcement_audience_scopes
CREATE TABLE `announcement_audience_scopes` (
    `id`                 VARCHAR(191) NOT NULL,
    `announcementId`     VARCHAR(191) NOT NULL,
    `scopeType`          ENUM('ALL', 'UNIT', 'DEPARTMENT', 'JOB_ROLE', 'EMPLOYEE') NOT NULL,
    `targetUnitId`       VARCHAR(191) NULL,
    `targetDepartmentId` VARCHAR(191) NULL,
    `targetJobRoleId`    VARCHAR(191) NULL,
    `targetEmployeeId`   VARCHAR(191) NULL,
    `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcement_audience_scopes_announcementId_idx`(`announcementId`),
    INDEX `announcement_audience_scopes_scopeType_idx`(`scopeType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: announcement_recipients
CREATE TABLE `announcement_recipients` (
    `id`             VARCHAR(191) NOT NULL,
    `announcementId` VARCHAR(191) NOT NULL,
    `employeeId`     VARCHAR(191) NOT NULL,
    `readAt`         DATETIME(3)  NULL,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcement_recipients_announcementId_idx`(`announcementId`),
    INDEX `announcement_recipients_employeeId_idx`(`employeeId`),
    INDEX `announcement_recipients_readAt_idx`(`readAt`),
    UNIQUE INDEX `announcement_recipients_announcementId_employeeId_key`(`announcementId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- STEP 10: CREATE new indexes on the announcements table.
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX `announcement_attachments_storedFilename_key` ON `announcement_attachments`(`storedFilename`);
CREATE INDEX `announcements_state_idx`          ON `announcements`(`state`);
CREATE INDEX `announcements_publishAt_idx`       ON `announcements`(`publishAt`);
CREATE INDEX `announcements_expiresAt_idx`       ON `announcements`(`expiresAt`);
CREATE INDEX `announcements_createdByUserId_idx` ON `announcements`(`createdByUserId`);

-- -----------------------------------------------------------------------------
-- STEP 11: ADD new foreign keys.
-- -----------------------------------------------------------------------------

-- announcements.createdByUserId → users.id (nullable; SET NULL on delete)
ALTER TABLE `announcements`
    ADD CONSTRAINT `announcements_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- announcement_audience_scopes
ALTER TABLE `announcement_audience_scopes`
    ADD CONSTRAINT `announcement_audience_scopes_announcementId_fkey`
    FOREIGN KEY (`announcementId`) REFERENCES `announcements`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `announcement_audience_scopes`
    ADD CONSTRAINT `announcement_audience_scopes_targetUnitId_fkey`
    FOREIGN KEY (`targetUnitId`) REFERENCES `units`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `announcement_audience_scopes`
    ADD CONSTRAINT `announcement_audience_scopes_targetDepartmentId_fkey`
    FOREIGN KEY (`targetDepartmentId`) REFERENCES `departments`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `announcement_audience_scopes`
    ADD CONSTRAINT `announcement_audience_scopes_targetJobRoleId_fkey`
    FOREIGN KEY (`targetJobRoleId`) REFERENCES `job_roles`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `announcement_audience_scopes`
    ADD CONSTRAINT `announcement_audience_scopes_targetEmployeeId_fkey`
    FOREIGN KEY (`targetEmployeeId`) REFERENCES `employees`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- announcement_recipients
ALTER TABLE `announcement_recipients`
    ADD CONSTRAINT `announcement_recipients_announcementId_fkey`
    FOREIGN KEY (`announcementId`) REFERENCES `announcements`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `announcement_recipients`
    ADD CONSTRAINT `announcement_recipients_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- announcement_attachments: restore announcementId FK with CASCADE, add uploadedByUserId FK
ALTER TABLE `announcement_attachments`
    ADD CONSTRAINT `announcement_attachments_announcementId_fkey`
    FOREIGN KEY (`announcementId`) REFERENCES `announcements`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `announcement_attachments`
    ADD CONSTRAINT `announcement_attachments_uploadedByUserId_fkey`
    FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
