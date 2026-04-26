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
}
