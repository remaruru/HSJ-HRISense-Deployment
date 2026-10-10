-- Evaluation modes: STANDARD (head evaluates) and WEIGHTED_MULTI_RATER
-- (self 20 + peer 20 + head 60). The on/off `combinedScoring` switch becomes the
-- mode: cycles that combined ratings are weighted multi-rater cycles, the rest
-- are standard. Their stored percentages are kept as they were.

-- AlterTable
ALTER TABLE `evaluation_cycles` ADD COLUMN `evaluationMode` ENUM('STANDARD', 'WEIGHTED_MULTI_RATER') NOT NULL DEFAULT 'STANDARD';

UPDATE `evaluation_cycles` SET `evaluationMode` = 'WEIGHTED_MULTI_RATER' WHERE `combinedScoring` = 1;

ALTER TABLE `evaluation_cycles` DROP COLUMN `combinedScoring`;

-- Labelled rating scales get the numeric value of each label, so evaluations on
-- them have a score. Only the two ordered label presets HRISense shipped, and
-- only when the stored labels are exactly the preset's (best first), are given
-- values: 5-point Outstanding 5 … Unsatisfactory 1; 4-point Highly Satisfactory
-- 4 … Poor 1. Labels stay as stored; written / descriptive templates have none.
UPDATE `evaluation_templates`
SET `scoreLabels` = JSON_SET(`scoreLabels`,
      '$.options[0].score', 5, '$.options[1].score', 4, '$.options[2].score', 3,
      '$.options[3].score', 2, '$.options[4].score', 1),
    `minScore` = 1, `maxScore` = 5
WHERE `ratingMethod` = 'LABELED'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.presetId')) = 'LIKERT_5'
  AND JSON_LENGTH(`scoreLabels`, '$.options') = 5
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[0].value')) = 'OUTSTANDING'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[1].value')) = 'VERY_SATISFACTORY'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[2].value')) = 'SATISFACTORY'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[3].value')) = 'NEEDS_IMPROVEMENT'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[4].value')) = 'UNSATISFACTORY';

UPDATE `evaluation_templates`
SET `scoreLabels` = JSON_SET(`scoreLabels`,
      '$.options[0].score', 4, '$.options[1].score', 3, '$.options[2].score', 2, '$.options[3].score', 1),
    `minScore` = 1, `maxScore` = 4
WHERE `ratingMethod` = 'LABELED'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.presetId')) = 'SATISFACTION_4'
  AND JSON_LENGTH(`scoreLabels`, '$.options') = 4
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[0].value')) = 'HIGHLY_SATISFACTORY'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[1].value')) = 'SATISFACTORY'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[2].value')) = 'FAIR'
  AND JSON_UNQUOTE(JSON_EXTRACT(`scoreLabels`, '$.options[3].value')) = 'POOR';
