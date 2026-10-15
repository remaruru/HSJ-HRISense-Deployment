-- HR's correction of an imported day before it is applied, with the device's
-- original values beside it (attendance import review window).
ALTER TABLE `attendance_import_candidates` ADD COLUMN `hrCorrection` JSON NULL;
