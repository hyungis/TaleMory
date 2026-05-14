-- storyboard_pages 에 webtoon 모드 메타 컬럼 추가.
--
-- 이번 추가로 영속화되는 정보:
--   1) characters_in_scene_json — 페이지에 등장하는 캐릭터 목록(이름키/씬역할/예상위치).
--      AI 측 WebtoonStoryboardPage.charactersInScene 와 1:1.
--   2) sentences (JSON, 기존 컬럼) 의 각 원소에 type/speakerKey 키 추가됨.
--      WEBTOON 모드 row 만 채워지고 VIEWER 모드 row 는 두 키 미존재 → null 폴백.
--      sentences 컬럼 자체는 이미 JSON 이라 스키마 변경 불필요 (애플리케이션 레이어 호환).
--
-- VIEWER 모드 row 는 characters_in_scene_json = NULL 그대로 → 영향 0.
-- WEBTOON 모드 row 는 StoryboardResultListener.handleSuccess 가 envelope.payload.pages[].
-- charactersInScene 을 직렬화해 채운다.
--
-- AI 워커 측 스펙: app/ai/app/schemas/storyboard.py 의
--   - WebtoonCharacterInScene (characterKey, sceneRole, expectedPosition)
--   - WebtoonStorySentence (type, speakerKey)
-- 와 1:1 정합.

ALTER TABLE `storyboard_pages`
    ADD COLUMN `characters_in_scene_json` JSON NULL
    COMMENT 'WEBTOON 모드 한정. 페이지 등장 캐릭터 메타 (characterKey/sceneRole/expectedPosition). VIEWER 모드는 NULL.';
