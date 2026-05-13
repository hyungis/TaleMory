-- scene_sentences.bubble_slot 컬럼을 ENUM 에서 JSON 좌표(AnchorPoint) 로 전환.
--
-- 배경:
--   기존 bubble_slot 은 BubbleSlot enum (TOP_LEFT/TOP_CENTER/...) 으로 슬롯 위치를 고정 표현했으나,
--   WEBTOON 모드는 Gemini Vision 으로 추출한 캐릭터 머리 위 anchor 좌표를 그대로 말풍선/캡션 위치로 사용한다.
--   anchor 를 별도 컬럼으로 추가하지 않고 동일 컬럼명(bubble_slot)에 좌표값을 담아 의미를 일관되게 유지한다.
--
-- 마이그레이션 정책:
--   1) 기존 ENUM 컬럼 DROP. WEBTOON 모드는 아직 사용자 노출 전이므로 보존할 데이터 없음.
--      VIEWER 모드 row 는 항상 bubble_slot = NULL 이었으므로 손실 0.
--   2) JSON 컬럼으로 재추가. 값 형식: {"x": 0~1, "y": 0~1} (정규화 좌표).
--   3) NARRATION 문장은 백엔드가 {"x": 0.5, "y": 0.05} 로 고정 주입,
--      DIALOGUE 문장은 AI Vision 결과의 캐릭터 anchor 를 매핑.
--
-- VIEWER 모드 row 는 NULL 그대로 유지 → 영향 0.
-- WEBTOON 모드 row 는 WebtoonLayoutResultListener 가 sentence_order 별로 채운다.
--
-- 주의: 같은 PR 의 코드 변경 (BubbleSlot enum 제거, AnchorPoint VO 도입) 과 함께 적용되어야 한다.

ALTER TABLE `scene_sentences`
    DROP COLUMN `bubble_slot`;

ALTER TABLE `scene_sentences`
    ADD COLUMN `bubble_slot` JSON NULL
    COMMENT 'WEBTOON 모드 한정. 말풍선/캡션 anchor 좌표 {"x": 0~1, "y": 0~1}. VIEWER 모드는 NULL.';
