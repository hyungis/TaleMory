-- story_generation_jobs: MQ jobId 용 external_id(UUID) 컬럼 추가
-- 배경: AI 스펙의 jobId 는 string (UUID) 로 정의되어 있고,
--      DB PK(BIGINT)를 외부에 노출하지 않기 위해 별도 external_id 컬럼을 둔다.
-- 관련 이슈: #13

-- 1) NULL 허용으로 먼저 컬럼 추가 (기존 row 가 있어도 실패하지 않도록)
ALTER TABLE `story_generation_jobs`
    ADD COLUMN `external_id` VARCHAR(36) NULL AFTER `id`;

-- 2) 기존 row 가 있다면 UUID 로 채움 (신규 테이블이면 no-op)
UPDATE `story_generation_jobs`
    SET `external_id` = UUID()
    WHERE `external_id` IS NULL;

-- 3) NOT NULL 전환 + UNIQUE KEY 부여
ALTER TABLE `story_generation_jobs`
    MODIFY COLUMN `external_id` VARCHAR(36) NOT NULL COMMENT '외부 노출용 UUID (MQ jobId)',
    ADD UNIQUE KEY `uk_jobs_external_id` (`external_id`);
