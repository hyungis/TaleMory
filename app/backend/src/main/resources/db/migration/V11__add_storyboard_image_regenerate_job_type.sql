-- V11__add_storyboard_image_regenerate_job_type.sql
-- Step 4 페이지별 이미지 재생성 한도/UI 도입 — STORYBOARD_IMAGE_REGENERATE 분리.
-- 배치 생성(STORYBOARD_IMAGE)과 분리해 한도 카운트(스토리당 3회, SUCCESS+FAILED)를 정확히 집계하기 위함.
-- Pattern: V9 (STORYBOARD_STORY_SUMMARY 추가) 와 동일.
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
            'STORYBOARD_IMAGE_REGENERATE'
        ) NOT NULL COMMENT '작업 종류';
