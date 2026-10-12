-- Profile banner: each person can set their own banner image (a protected
-- document preview path, like photoUrl). NULL keeps the default banner.
ALTER TABLE `employees` ADD COLUMN `bannerUrl` VARCHAR(191) NULL;
