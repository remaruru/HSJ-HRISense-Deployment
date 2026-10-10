-- Optional fields from the HSJ employee record (blood type, spouse, children,
-- HSJ residence, PRC dates, TESDA national certificate, education). All NULL-able:
-- blank means "not provided". Only additive — nothing existing is changed.
--
-- `prisma migrate dev` also proposed dropping legacy indexes and a foreign key on
-- older tables (pre-existing drift unrelated to this change); those were removed.

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `bloodType` VARCHAR(3) NULL,
    ADD COLUMN `diploma` VARCHAR(150) NULL,
    ADD COLUMN `hsjResidence` VARCHAR(150) NULL,
    ADD COLUMN `ncCertificateNumber` VARCHAR(50) NULL,
    ADD COLUMN `ncQualification` VARCHAR(150) NULL,
    ADD COLUMN `ncValidUntil` DATE NULL,
    ADD COLUMN `numberOfChildren` INTEGER NULL,
    ADD COLUMN `prcIssuedDate` DATE NULL,
    ADD COLUMN `prcValidUntil` DATE NULL,
    ADD COLUMN `primarySchool` VARCHAR(150) NULL,
    ADD COLUMN `residenceDorm` VARCHAR(100) NULL,
    ADD COLUMN `secondarySchool` VARCHAR(150) NULL,
    ADD COLUMN `spouseName` VARCHAR(150) NULL,
    ADD COLUMN `tertiaryCourse` VARCHAR(150) NULL,
    ADD COLUMN `tertiaryGraduated` BOOLEAN NULL,
    ADD COLUMN `tertiarySchool` VARCHAR(150) NULL,
    ADD COLUMN `vocationalQualification` VARCHAR(150) NULL;
