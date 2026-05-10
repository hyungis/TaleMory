package com.s210.backend.domain.story.model

/**
 * 동화 생성 모드.
 *
 * 사용자가 메인 페이지의 "새 동화책 만들기" 클릭 시 모달에서 선택한다.
 * 선택 결과는 [com.s210.backend.domain.story.entity.Story.mode] 컬럼에 영속화되며,
 * 스토리보드/이미지 생성 시 MQ 메시지의 `storyMode` 필드로 AI 워커에 전달돼 분기된다.
 *
 *  - [VIEWER]: 기존 동화책 모드 (페이지별 narration 본문). 기본값.
 *  - [WEBTOON]: 대화 중심 웹툰 모드 (sentence 마다 화자/타입 + 캐릭터 위치 정보).
 *
 * AI 워커 (`app/ai`) 의 `StoryMode = Literal["VIEWER", "WEBTOON"]` 와 1:1 매칭.
 * Default 가 VIEWER 라 기존 데이터 / 누락 케이스 모두 narration 으로 안전 fallback.
 */
enum class StoryMode {
    VIEWER,
    WEBTOON,
}
