-- V9__add_storyboard_story_summary_job_type.sql
-- 동화 줄거리(SUMMARY) 단계 도입 — STORYBOARD_STORY_SUMMARY enum 값 추가
-- Pattern: V5 (STORYBOARD_STORY 추가) / V7 (STORYBOARD_IMAGE 추가) 와 동일
-- Scope: dev/local. row 수 < 1K 가정. ALGORITHM=INSTANT 로 처리됨.
-- production cutover 는 별도 plan 으로 분리 (Pre-mortem Scenario E 참조).

ALTER TABLE `story_generation_jobs`
    MODIFY COLUMN `job_type`
        ENUM(
            'STORYBOARD',
            'ILLUSTRATION',
            'TTS',
            'BGM',
            'VOICE_CLONE',
            'STORY',
            'STORYBOARD_STORY',
            'STORYBOARD_IMAGE',
            'STORYBOARD_STORY_SUMMARY'
        ) NOT NULL COMMENT '작업 종류';
