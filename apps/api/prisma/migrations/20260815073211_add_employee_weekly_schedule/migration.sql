-- CreateTable
CREATE TABLE `shift_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` ENUM('OFFICE', 'SHIFT') NOT NULL DEFAULT 'SHIFT',
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shift_definitions_name_version_key`(`name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_weekly_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_weekly_schedule_days` (
    `id` VARCHAR(191) NOT NULL,
    `weeklyScheduleId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `status` ENUM('UNCONFIGURED', 'DAY_OFF', 'WORKING') NOT NULL DEFAULT 'UNCONFIGURED',

    UNIQUE INDEX `employee_weekly_schedule_days_weeklyScheduleId_dayOfWeek_key`(`weeklyScheduleId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_weekly_schedule_shifts` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleDayId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_weekly_schedules` ADD CONSTRAINT `employee_weekly_schedules_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_weekly_schedule_days` ADD CONSTRAINT `employee_weekly_schedule_days_weeklyScheduleId_fkey` FOREIGN KEY (`weeklyScheduleId`) REFERENCES `employee_weekly_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_weekly_schedule_shifts` ADD CONSTRAINT `employee_weekly_schedule_shifts_scheduleDayId_fkey` FOREIGN KEY (`scheduleDayId`) REFERENCES `employee_weekly_schedule_days`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_weekly_schedule_shifts` ADD CONSTRAINT `employee_weekly_schedule_shifts_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shift_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
