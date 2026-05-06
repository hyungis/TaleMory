-- story_generation_jobs 스키마를 API 명세서에 맞춰 정리
-- 관련 이슈: #13
--
-- 배경:
--  - V4 에서 도입한 external_id (UUID) 는 Notion API 명세서와 불일치.
--    명세는 jobId 를 DB PK (Long) 그대로 쓰는 방식. → external_id 제거.
--  - 명세상 jobType 값 "STORYBOARD_STORY" 가 enum 에 없음 → 추가.

-- 1) external_id UNIQUE KEY 제거 → 컬럼 제거
ALTER TABLE `story_generation_jobs`
    DROP INDEX `uk_jobs_external_id`,
    DROP COLUMN `external_id`;

-- 2) job_type enum 에 'STORYBOARD_STORY' 값 추가
--    (명세: "스토리보드 줄거리 생성" 작업을 기존 STORY 와 구분해 새 값으로 관리)
ALTER TABLE `story_generation_jobs`
    MODIFY COLUMN `job_type`
        ENUM('STORYBOARD','ILLUSTRATION','TTS','BGM','VOICE_CLONE','STORY','STORYBOARD_STORY')
        NOT NULL COMMENT '작업 종류';
