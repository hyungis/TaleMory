-- Drop legacy page-level text columns after V13 backfilled storyboard_pages.sentences.
-- Application code now derives page text from the sentences JSON column.

ALTER TABLE `storyboard_pages`
    DROP COLUMN `english_text`,
    DROP COLUMN `korean_text`;
