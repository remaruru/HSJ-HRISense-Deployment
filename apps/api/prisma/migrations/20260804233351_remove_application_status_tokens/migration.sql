/*
  Warnings:

  - You are about to drop the `application_status_access_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `application_status_access_tokens` DROP FOREIGN KEY `application_status_access_tokens_jobApplicationId_fkey`;

-- DropTable
DROP TABLE `application_status_access_tokens`;
