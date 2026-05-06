-- V12__add_final_illustration_job_type.sql
-- Step 5 PATCH /style 시점에 백그라운드로 enqueue 되는 최종(컬러) 일러스트 잡.
-- AI 의 final_illustration_service 가 storyboard rough(흑백)를 reference 로 컬러 일러스트를 생성.
-- Pattern: V11 (STORYBOARD_IMAGE_REGENERATE 추가) 와 동일.
-- Scope: dev/local. row 수 < 1K 가정. ALGORITHM=INSTANT 로 처리됨.
-- production cutover 는 별도 plan 으로 분리.

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
            'STORYBOARD_STORY_SUMMARY',
            'STORYBOARD_IMAGE_REGENERATE',
            'FINAL_ILLUSTRATION'
        ) NOT NULL COMMENT '작업 종류';
