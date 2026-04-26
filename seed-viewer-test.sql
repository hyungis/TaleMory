-- =============================================================
-- 뷰어 테스트용 시드 데이터
-- 사용법: DBeaver / IntelliJ DB 콘솔에서 서버 DB(k14s210.p.ssafy.io:3307/iportfolio)에 실행
--
-- 주의: user_id = 1 로 가정. 서버 DB에 user가 없으면 아래 주석 해제해서 먼저 넣을 것.
-- =============================================================

-- (선택) 테스트 유저가 없으면 주석 해제
-- INSERT INTO users (login_id, nickname, created_at, updated_at)
-- VALUES ('test-viewer-user', '뷰어테스터', NOW(), NOW());
-- 이후 해당 유저의 id를 아래 @user_id 에 넣기

SET @user_id = 4;

-- 1. Story (PUBLISHED + shareToken)
INSERT INTO stories (
    user_id, title, synopsis, difficulty, status, share_token,
    is_bookmarked, companions_json, main_character_json,
    travel_place, travel_start_date, travel_end_date,
    published_at, created_at, updated_at
) VALUES (
    @user_id,
    'The Adventure in Seoul',
    'A magical journey through the streets of Seoul',
    'BEGINNER',
    'PUBLISHED',
    'viewer-test-token-001',
    false,
    '[]',
    '{"name":"Mia","age":7,"gender":"FEMALE","appearancePrompt":"a cheerful girl with short brown hair"}',
    'Seoul, Korea',
    '2026-04-20',
    '2026-04-25',
    NOW(),
    NOW(), NOW()
);

SET @story_id = LAST_INSERT_ID();

-- 2. Scenes (3 pages)
INSERT INTO scenes (story_id, page_number, illustration_url, character_anchors, created_at, updated_at)
VALUES
    (@story_id, 1, 'https://placehold.co/800x600/EEE/31343C?text=Scene+1', '[{"characterKey":"mia","x":0.3,"y":0.5}]', NOW(), NOW()),
    (@story_id, 2, 'https://placehold.co/800x600/FDD/31343C?text=Scene+2', '[{"characterKey":"mia","x":0.6,"y":0.4}]', NOW(), NOW()),
    (@story_id, 3, 'https://placehold.co/800x600/DFD/31343C?text=Scene+3', NULL, NOW(), NOW());

SET @scene1_id = LAST_INSERT_ID();
SET @scene2_id = @scene1_id + 1;
SET @scene3_id = @scene1_id + 2;

-- 3. Scene Sentences (영어 + 한국어 텍스트 포함 — 단어 번역 테스트용)
INSERT INTO scene_sentences (scene_id, sentence_order, english_text, korean_text, speaker_key, bubble_slot, has_highlighted, created_at, updated_at)
VALUES
    -- Scene 1
    (@scene1_id, 1, 'Once upon a time, Mia visited a beautiful palace in Seoul.', '옛날 옛적에 미아가 서울의 아름다운 궁전을 방문했어요.', 'narrator', NULL, false, NOW(), NOW()),
    (@scene1_id, 2, 'The cherry blossoms were blooming everywhere.', '벚꽃이 사방에 피어 있었어요.', 'narrator', NULL, false, NOW(), NOW()),
    (@scene1_id, 3, 'Wow, this place is amazing!', '와, 이곳은 정말 놀라워!', 'mia', 'TOP_LEFT', false, NOW(), NOW()),

    -- Scene 2
    (@scene2_id, 1, 'Mia walked through the traditional market.', '미아는 전통 시장을 걸었어요.', 'narrator', NULL, false, NOW(), NOW()),
    (@scene2_id, 2, 'She found delicious tteokbokki and colorful souvenirs.', '맛있는 떡볶이와 알록달록한 기념품을 발견했어요.', 'narrator', NULL, false, NOW(), NOW()),
    (@scene2_id, 3, 'I want to try everything!', '다 먹어보고 싶어!', 'mia', 'MIDDLE_LEFT', false, NOW(), NOW()),

    -- Scene 3
    (@scene3_id, 1, 'As the sun set, Mia watched the city lights from Namsan Tower.', '해가 질 무렵, 미아는 남산타워에서 도시의 불빛을 바라봤어요.', 'narrator', NULL, false, NOW(), NOW()),
    (@scene3_id, 2, 'Seoul is the most wonderful place I have ever visited.', '서울은 내가 가본 곳 중 가장 멋진 곳이야.', 'mia', 'BOTTOM_CENTER', false, NOW(), NOW());

-- 4. Story Outro
INSERT INTO story_outros (story_id, outro_text, audio_url, signature, created_at, updated_at, deleted_at)
VALUES (
    @story_id,
    'And so, Mia''s adventure in Seoul came to a happy end. She promised to come back again someday.',
    NULL,
    'With love, from Mia',
    NOW(), NOW(), NULL
);

-- =============================================================
-- 확인용 쿼리
-- =============================================================
-- SELECT * FROM stories WHERE share_token = 'viewer-test-token-001';
-- SELECT * FROM scenes WHERE story_id = @story_id;
-- SELECT * FROM scene_sentences WHERE scene_id IN (@scene1_id, @scene2_id, @scene3_id);
-- SELECT * FROM story_outros WHERE story_id = @story_id;
--
-- 뷰어 API 호출:
--   GET http://localhost:8080/api/public/stories/viewer-test-token-001
--
-- 단어 번역 API 호출:
--   GET http://localhost:8080/api/dictionary/words/palace
--   GET http://localhost:8080/api/dictionary/words/beautiful
-- =============================================================
