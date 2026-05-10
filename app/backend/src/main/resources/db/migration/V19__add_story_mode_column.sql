-- stories.mode 컬럼 추가 — 동화 생성 모드 영속화.
--
-- 'VIEWER' = 동화책 모드 (기존 narration, 기본값) / 'WEBTOON' = 대화 중심 웹툰 모드.
-- AI 워커(`app/ai`)의 StoryMode = Literal["VIEWER", "WEBTOON"] 와 1:1 매칭.
-- 기존 row 는 default 'VIEWER' 로 backfill — narration 동작 100% 보존.
--
-- 사용처: Story 엔티티의 mode 필드 → StoryboardGenerationService 등이
-- mq publish 시 storyMode 필드로 AI 워커에 전달 → webtoon prompt 분기.

ALTER TABLE `stories`
    ADD COLUMN `mode` VARCHAR(20) NOT NULL DEFAULT 'VIEWER'
    COMMENT '동화 생성 모드 — VIEWER(narration, 기본) / WEBTOON(대화)';
