-- scene_sentences.bubble_slot 컬럼 영구 삭제.
--
-- 배경:
--   V22 에서 ENUM → JSON 으로 좌표 컬럼을 정비했으나, 후속 리팩터링으로
--   sentence-level 좌표 영속화 자체를 폐기했다. WEBTOON 모드의 좌표는
--   `scenes.character_anchors` JSON 배열 (캐릭터 단위 anchor) 으로 통합되었고,
--   FE 가 sentence.speakerKey 로 lookup 해서 위치를 결정한다.
--
--   따라서 sentence.bubble_slot 컬럼은 더 이상 read 도, write 도 되지 않는다.
--   stale 데이터를 남겨둘 이유가 없어 컬럼 자체를 DROP.
--
-- 영향:
--   - WEBTOON 모드 동화는 V22 이후로도 NULL 만 들어가있어 손실되는 의미 데이터 없음.
--   - VIEWER 모드 동화는 항상 NULL 이었음.
--   - rollback 어려움 — V22 와 동일하게 ALTER TABLE ADD COLUMN 으로 되돌릴 수 있으나
--     의미 데이터는 복원 불가.
ALTER TABLE `scene_sentences`
    DROP COLUMN `bubble_slot`;
