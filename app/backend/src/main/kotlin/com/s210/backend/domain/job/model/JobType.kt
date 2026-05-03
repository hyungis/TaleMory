package com.s210.backend.domain.job.model

enum class JobType {
    STORYBOARD,
    ILLUSTRATION,
    TTS,
    BGM,
    VOICE_CLONE,
    STORY,

    /** 스토리보드의 본문(줄거리 + 페이지 텍스트) 생성 작업 — API 명세 #28. */
    STORYBOARD_STORY,

    /**
     * 스토리보드 페이지별 일러스트(이미지) 생성 작업.
     * AI 워커가 페이지당 1장씩 비동기로 생성 → ai.result.image.* 라우팅키로 결과 수신.
     */
    STORYBOARD_IMAGE,

    /** 스토리보드 줄거리(요약) 생성 작업 — V9 ENUM 추가. */
    STORYBOARD_STORY_SUMMARY,

    /**
     * 스토리보드 페이지 이미지 재생성 작업 — V11 ENUM 추가.
     * 배치 생성(STORYBOARD_IMAGE)과 분리해 "스토리당 3회" 한도 카운트를 정확히 집계.
     * Step 4 의 페이지별 [재생성하기] 버튼 흐름에서만 사용.
     */
    STORYBOARD_IMAGE_REGENERATE,

    /** Step 5 스타일 선택 직후 백그라운드로 시작되는 최종(컬러) 일러스트 잡. */
    FINAL_ILLUSTRATION,
}
