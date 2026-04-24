-- word_dictionary: CSV 스키마에 맞춰 컬럼명 변경 + forms 추가 + 복합 유니크 적용

-- 1) meaning_json → definition_ko (JSON → TEXT)
ALTER TABLE `word_dictionary` CHANGE COLUMN `meaning_json` `definition_ko` TEXT NOT NULL COMMENT '한글 뜻';

-- 2) pronunciation → ipa
ALTER TABLE `word_dictionary` CHANGE COLUMN `pronunciation` `ipa` VARCHAR(255) NULL COMMENT '발음 기호';

-- 3) forms 컬럼 추가
ALTER TABLE `word_dictionary` ADD COLUMN `forms` JSON NULL COMMENT '활용형 배열';

-- 4) UNIQUE KEY: word → (word, pos)
ALTER TABLE `word_dictionary` DROP INDEX `uk_word`;
ALTER TABLE `word_dictionary` ADD UNIQUE KEY `uk_word_pos` (`word`, `pos`);
