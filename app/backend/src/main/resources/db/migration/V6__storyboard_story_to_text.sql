-- story_board.story 컬럼을 VARCHAR(255) → TEXT 로 확장
-- 관련 이슈: #13
--
-- 배경:
--  - 유저에게 보여줄 "한글 동화 본문" 은 AI 의 pages[].koreanText 를 합친 전체 텍스트.
--    페이지 10~20장 × 40~80자 = 400~1600자 → VARCHAR(255) 로 부족.
--  - synopsis(영문 요약) 만 저장하던 기존 정책 → 한글 전체 본문 저장으로 변경.

ALTER TABLE `story_board`
    MODIFY COLUMN `story` TEXT NOT NULL COMMENT '한글 동화 본문 (pages.koreanText 를 이어붙인 원본)';
