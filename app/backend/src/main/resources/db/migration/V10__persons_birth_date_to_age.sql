-- =====================================================================
-- V10__persons_birth_date_to_age.sql
-- ---------------------------------------------------------------------
-- persons 테이블의 `birth_date` (DATE NOT NULL) 를 `age` (INT NOT NULL) 로 교체.
--
-- 배경:
--   - FE 가 마이페이지/스토리 생성에서 "나이 (만 나이)" 만 받고, 서버는 birth_date 로
--     변환 저장하고 있었음. 마이페이지에서 다시 보면 birth_date 로 노출되어 어색.
--   - 도메인 특성상 정확한 출생일이 필요하지 않고, FE 입력값을 그대로 보존하는 게 자연스러움.
--
-- 절차:
--   1) `age` 컬럼을 NULL 허용으로 추가
--   2) 기존 row 의 `birth_date` 로부터 만 나이를 계산해 backfill
--   3) `age` 를 NOT NULL 로 강제
--   4) `birth_date` 컬럼 제거
-- =====================================================================

ALTER TABLE `persons`
    ADD COLUMN `age` INT NULL COMMENT '만 나이 (FE 입력값 그대로 보존)' AFTER `name`;

UPDATE `persons`
SET `age` = TIMESTAMPDIFF(YEAR, `birth_date`, CURDATE())
WHERE `birth_date` IS NOT NULL;

ALTER TABLE `persons`
    MODIFY COLUMN `age` INT NOT NULL COMMENT '만 나이 (FE 입력값 그대로 보존)';

ALTER TABLE `persons`
    DROP COLUMN `birth_date`;
