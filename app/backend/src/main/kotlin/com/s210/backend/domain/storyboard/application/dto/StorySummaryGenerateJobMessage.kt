package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리 줄거리(요약) 생성 요청 메시지 (Spring → AI).
 *
 * AI 측 스펙 envelope 와 1:1 매칭된다.
 * routing key: "ai.cpu.story.summary.generate"
 * exchange:    "ai.request"
 *
 * envelope 필드
 *  - jobId:   Spring 이 발급한 UUID v4. `story_generation_jobs.external_id` 와 동일.
 *  - jobType: "STORY_SUMMARY" 고정.
 *  - action:  "GENERATE" — 같은 jobType 내 세부 동작 구분.
 *  - storyId: top-level 에만 포함 (payload 내부에는 넣지 않는다 — AI 스펙).
 *  - payload: 사진 + 정보 + difficulty + additionalInstruction. `StoryGeneratePayload` 그대로 재사용.
 */
data class StorySummaryGenerateJobMessage(
    val jobId: String,
    val jobType: String = "STORY_SUMMARY",
    val action: String = "GENERATE",
    val storyId: Long,
    /** 동화 생성 모드 — VIEWER / WEBTOON. AI 측 storyMode 와 1:1 매칭. */
    val storyMode: String = "VIEWER",
    val payload: StoryGeneratePayload,
)
