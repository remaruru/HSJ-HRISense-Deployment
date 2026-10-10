-- CreateTable
CREATE TABLE `organization_calendar_entries` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('HOLIDAY', 'SPECIAL_NON_WORKING', 'ORGANIZATION_NON_WORKING', 'SUSPENSION') NOT NULL,
    `source` ENUM('HOLIDAY_API', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('PENDING', 'APPROVED', 'IGNORED') NOT NULL DEFAULT 'APPROVED',
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `organization_calendar_entries_date_idx`(`date`),
    INDEX `organization_calendar_entries_status_idx`(`status`),
    UNIQUE INDEX `organization_calendar_entries_date_name_key`(`date`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `schedule_templates_name_version_key`(`name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_template_days` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `isWorking` BOOLEAN NOT NULL DEFAULT true,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,

    UNIQUE INDEX `schedule_template_days_templateId_dayOfWeek_key`(`templateId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_schedule_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `scheduleTemplateId` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `assignedByUserId` VARCHAR(191) NULL,
    `bulkBatchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_schedule_assignments_employeeId_idx`(`employeeId`),
    INDEX `employee_schedule_assignments_effectiveFrom_effectiveTo_idx`(`effectiveFrom`, `effectiveTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_schedule_overrides` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `isWorking` BOOLEAN NOT NULL DEFAULT true,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `employee_schedule_overrides_employeeId_idx`(`employeeId`),
    INDEX `employee_schedule_overrides_date_idx`(`date`),
    UNIQUE INDEX `employee_schedule_overrides_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_history_logs` (
    `id` VARCHAR(191) NOT NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `previousValue` JSON NULL,
    `newValue` JSON NULL,
    `remarks` TEXT NULL,
    `bulkBatchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `schedule_history_logs_targetEmployeeId_idx`(`targetEmployeeId`),
    INDEX `schedule_history_logs_actorUserId_idx`(`actorUserId`),
    INDEX `schedule_history_logs_bulkBatchId_idx`(`bulkBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schedule_template_days` ADD CONSTRAINT `schedule_template_days_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `schedule_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_schedule_assignments` ADD CONSTRAINT `employee_schedule_assignments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_schedule_assignments` ADD CONSTRAINT `employee_schedule_assignments_scheduleTemplateId_fkey` FOREIGN KEY (`scheduleTemplateId`) REFERENCES `schedule_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_schedule_overrides` ADD CONSTRAINT `employee_schedule_overrides_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_history_logs` ADD CONSTRAINT `schedule_history_logs_targetEmployeeId_fkey` FOREIGN KEY (`targetEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_history_logs` ADD CONSTRAINT `schedule_history_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed legacy schedule templates
INSERT INTO `schedule_templates` (`id`, `name`, `description`, `isActive`, `version`, `isArchived`, `createdAt`, `updatedAt`)
VALUES 
('SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'Regular Day Shift', 'Legacy REGULAR_DAY_SHIFT', 1, 1, 0, NOW(), NOW()),
('SEED-TMPL-FLEXIBLE-SHIFT-0000000000', 'Flexible Shift', 'Legacy FLEXIBLE_SHIFT', 1, 1, 0, NOW(), NOW()),
('SEED-TMPL-NIGHT-SHIFT-0000000000000', 'Night Shift', 'Legacy NIGHT_SHIFT', 1, 1, 0, NOW(), NOW()),
('SEED-TMPL-ROTATING-SHIFT-0000000000', 'Rotating Shift', 'Legacy ROTATING_SHIFT', 1, 1, 0, NOW(), NOW()),
('SEED-TMPL-PART-TIME-MORNING-0000000', 'Part-Time Morning', 'Legacy PART_TIME_MORNING', 1, 1, 0, NOW(), NOW()),
('SEED-TMPL-PART-TIME-AFTERNOON-00000', 'Part-Time Afternoon', 'Legacy PART_TIME_AFTERNOON', 1, 1, 0, NOW(), NOW());

-- Seed template days (Monday-Friday for Regular Day Shift)
INSERT INTO `schedule_template_days` (`id`, `templateId`, `dayOfWeek`, `isWorking`, `startTime`, `endTime`) VALUES
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'MONDAY', 1, '08:00', '17:00'),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'TUESDAY', 1, '08:00', '17:00'),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'WEDNESDAY', 1, '08:00', '17:00'),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'THURSDAY', 1, '08:00', '17:00'),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'FRIDAY', 1, '08:00', '17:00'),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'SATURDAY', 0, NULL, NULL),
(UUID(), 'SEED-TMPL-REGULAR-DAY-SHIFT-00000000', 'SUNDAY', 0, NULL, NULL);

-- Seed template days (Monday-Friday for Night Shift)
INSERT INTO `schedule_template_days` (`id`, `templateId`, `dayOfWeek`, `isWorking`, `startTime`, `endTime`) VALUES
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'MONDAY', 1, '22:00', '06:00'),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'TUESDAY', 1, '22:00', '06:00'),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'WEDNESDAY', 1, '22:00', '06:00'),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'THURSDAY', 1, '22:00', '06:00'),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'FRIDAY', 1, '22:00', '06:00'),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'SATURDAY', 0, NULL, NULL),
(UUID(), 'SEED-TMPL-NIGHT-SHIFT-0000000000000', 'SUNDAY', 0, NULL, NULL);

-- Map employee legacy enum to the newly created templates
INSERT INTO `employee_schedule_assignments` (`id`, `employeeId`, `scheduleTemplateId`, `effectiveFrom`, `effectiveTo`, `assignedByUserId`, `createdAt`, `updatedAt`)
SELECT 
    UUID(), 
    e.`id`, 
    st.`id`, 
    CURRENT_DATE(), -- Migration Date used to prevent fabricating historical records
    NULL, 
    NULL, 
    NOW(), 
    NOW()
FROM `employees` e
JOIN `schedule_templates` st 
  ON (
    (e.`workSchedule` = 'REGULAR_DAY_SHIFT' AND st.`name` = 'Regular Day Shift') OR
    (e.`workSchedule` = 'FLEXIBLE_SHIFT' AND st.`name` = 'Flexible Shift') OR
    (e.`workSchedule` = 'NIGHT_SHIFT' AND st.`name` = 'Night Shift') OR
    (e.`workSchedule` = 'ROTATING_SHIFT' AND st.`name` = 'Rotating Shift') OR
    (e.`workSchedule` = 'PART_TIME_MORNING' AND st.`name` = 'Part-Time Morning') OR
    (e.`workSchedule` = 'PART_TIME_AFTERNOON' AND st.`name` = 'Part-Time Afternoon')
  );
