-- Add page-level sentence JSON while preserving existing text columns.
--
-- Do not drop english_text/korean_text here. Existing rows are backfilled into a
-- one-sentence JSON array so no generated storyboard text is lost during the
-- application transition to storyboard_pages.sentences.

ALTER TABLE `storyboard_pages`
    ADD COLUMN `sentences` JSON NULL COMMENT 'Page sentence array: [{sentenceOrder, englishText, koreanText, emotion}]'
        AFTER `image_prompt`;

UPDATE `storyboard_pages`
SET `sentences` = JSON_ARRAY(
    JSON_OBJECT(
        'sentenceOrder', 1,
        'englishText', COALESCE(`english_text`, ''),
        'koreanText', COALESCE(`korean_text`, ''),
        'emotion', 'NEUTRAL'
    )
)
WHERE `sentences` IS NULL
  AND (`english_text` IS NOT NULL OR `korean_text` IS NOT NULL);
