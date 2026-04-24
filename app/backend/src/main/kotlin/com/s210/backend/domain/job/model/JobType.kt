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
}
