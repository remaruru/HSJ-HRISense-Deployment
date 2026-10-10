-- Remove falsely fabricated M-F weekday rows for legacy seeded templates
DELETE FROM `schedule_template_days` 
WHERE `templateId` IN (
  'SEED-TMPL-REGULAR-DAY-SHIFT-00000000',
  'SEED-TMPL-NIGHT-SHIFT-0000000000000'
);