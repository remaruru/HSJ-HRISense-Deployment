-- Years of work experience before Hospicio (employees) and the experience an
-- applicant reported (job applications). Both optional; length of service at
-- Hospicio still comes from hireDate.

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `priorExperienceYears` DOUBLE NULL;

-- AlterTable
ALTER TABLE `job_applications` ADD COLUMN `priorExperienceYears` DOUBLE NULL;
