-- Widen announcements.content from VARCHAR(191) to TEXT.
--
-- content is the deprecated legacy message column. AnnouncementService
-- (createDraft/update) still writes the full body value into it to keep the two
-- columns in sync, and the announcement composer UI applies no length limit to the
-- body. At VARCHAR(191) any announcement longer than 191 characters was silently
-- truncated in this column on non-strict MySQL, and would have failed outright
-- under STRICT_TRANS_TABLES.
--
-- Scope is deliberately limited to this one column. prisma migrate dev also
-- proposed dropping several indexes and a foreign key on announcements,
-- compliance_requirements and medical_records; those come from pre-existing drift
-- between the migration history and schema.prisma and are NOT part of this fix.

-- AlterTable
ALTER TABLE announcements MODIFY content TEXT NOT NULL;
