SET @add_style_prompt_column = IF(
    (
        SELECT COUNT(*)
        FROM `information_schema`.`columns`
        WHERE `table_schema` = DATABASE()
          AND `table_name` = 'style_presets'
          AND `column_name` = 'style_prompt'
    ) = 0,
    'ALTER TABLE `style_presets` ADD COLUMN `style_prompt` TEXT NULL',
    'SELECT 1'
);

PREPARE add_style_prompt_column_stmt FROM @add_style_prompt_column;
EXECUTE add_style_prompt_column_stmt;
DEALLOCATE PREPARE add_style_prompt_column_stmt;

INSERT INTO `style_presets` (`id`, `code`, `name`, `preview_url`, `style_prompt`) VALUES
    (4, '__collage_target__', '콜라주', 'https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/preset/collage.png', 'handcrafted paper collage illustration, layered cut-paper shapes, visible torn paper edges, overlapping paper pieces, handmade paper fibers, soft shadow gaps')
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `preview_url` = VALUES(`preview_url`),
    `style_prompt` = VALUES(`style_prompt`);

UPDATE `stories`
SET `style_preset_id` = 4
WHERE `style_preset_id` = (
    SELECT `id`
    FROM `style_presets`
    WHERE `code` = 'collage'
    LIMIT 1
);

DELETE FROM `style_presets`
WHERE `code` = 'collage'
  AND `id` <> 4;

INSERT INTO `style_presets` (`id`, `code`, `name`, `preview_url`, `style_prompt`) VALUES
    (1, 'watercolor', '수채화', 'https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/preset/watercolor.png', 'soft watercolor children''s picture-book illustration, transparent washes, gentle paper texture, warm light, delicate edges, airy color blending'),
    (2, 'digital', '애니', 'https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/preset/digital.png', 'clean cartoon children''s book illustration, expressive characters, bold readable shapes, crisp outlines, bright harmonious colors, polished playful finish'),
    (3, 'crayon', '색연필', 'https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/preset/crayon.png', 'colored pencil children''s book illustration, visible pencil strokes, soft grainy texture, layered hand-drawn shading, warm handmade feel'),
    (4, 'collage', '콜라주', 'https://s210-iportfolio-dev.s3.ap-northeast-2.amazonaws.com/preset/collage.png', 'handcrafted paper collage illustration, layered cut-paper shapes, visible torn paper edges, overlapping paper pieces, handmade paper fibers, soft shadow gaps')
ON DUPLICATE KEY UPDATE
    `code` = VALUES(`code`),
    `name` = VALUES(`name`),
    `preview_url` = VALUES(`preview_url`),
    `style_prompt` = VALUES(`style_prompt`);

UPDATE `stories`
SET `style_preset_id` = NULL
WHERE `style_preset_id` IS NOT NULL
  AND `style_preset_id` NOT IN (1, 2, 3, 4);

DELETE FROM `style_presets`
WHERE `id` NOT IN (1, 2, 3, 4);

UPDATE `style_presets`
SET `style_prompt` = `code`
WHERE `style_prompt` IS NULL OR TRIM(`style_prompt`) = '';

ALTER TABLE `style_presets`
    MODIFY COLUMN `style_prompt` TEXT NOT NULL;
