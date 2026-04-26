-- storyboard_pages 에 그림 생성용 메타 컬럼 추가 + job_type ENUM 확장.
-- 관련 이슈: 스토리보드 이미지 생성 (#14 예정)
--
-- 배경 / 의도:
--  - listener 가 STORY 결과를 받아 storyboard_pages 에 페이지별 row 를 저장할 때,
--    AI 가 만든 sceneSummary / imagePrompt 까지 함께 보존해야
--    뒤이은 이미지 생성 페이로드를 storyboard_pages 단일 소스에서 조립할 수 있다.
--    (옵션 D' — 단일 진실 테이블 원칙)
--  - 이미지 생성 작업도 story_generation_jobs 에 같이 쌓여야 폴링 / 이력 / 비용 추적이
--    기존 STORY 잡과 동일한 방식으로 처리됨 → job_type ENUM 에 STORYBOARD_IMAGE 추가.

-- 1) storyboard_pages 에 AI 페이지 메타 컬럼 2개 추가.
--    NULL 허용 — 과거 DRAFT 데이터(없을 수도)와 호환.
ALTER TABLE `storyboard_pages`
    ADD COLUMN `scene_summary` TEXT NULL COMMENT 'AI 생성 영어 장면 요약 (Gemini 입력용)'
        AFTER `korean_text`,
    ADD COLUMN `image_prompt`  TEXT NULL COMMENT 'AI 생성 영어 그림 프롬프트 (Gemini 입력용)'
        AFTER `scene_summary`;

-- 2) job_type ENUM 에 STORYBOARD_IMAGE 추가.
--    (V5 에서 STORYBOARD_STORY 추가했던 것과 동일한 패턴.)
ALTER TABLE `story_generation_jobs`
    MODIFY COLUMN `job_type`
        ENUM('STORYBOARD','ILLUSTRATION','TTS','BGM','VOICE_CLONE','STORY','STORYBOARD_STORY','STORYBOARD_IMAGE')
        NOT NULL COMMENT '작업 종류';
