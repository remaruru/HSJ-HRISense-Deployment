/*
  Warnings:

  - You are about to drop the `employee_schedule_overrides` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `employee_schedule_overrides` DROP FOREIGN KEY `employee_schedule_overrides_employeeId_fkey`;

-- DropTable
DROP TABLE `employee_schedule_overrides`;
