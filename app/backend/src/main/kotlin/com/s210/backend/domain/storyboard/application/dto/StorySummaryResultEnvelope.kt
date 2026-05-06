package com.s210.backend.domain.storyboard.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * 스토리 줄거리(요약) 결과 메시지 (AI → Spring).
 *
 * exchange:    "ai.result"
 * routing key: "ai.result.story.summary.{generate|regenerate}.{completed|failed}"
 *
 * 필드
 *  - status:  "COMPLETED" / "FAILED" — 이 값으로 payload 와 error 중 어느 쪽을 읽을지 판단.
 *  - type:    아래 4종 중 하나 (규약 문서용).
 *      "GENERATE_STORY_SUMMARY_COMPLETED"
 *      "GENERATE_STORY_SUMMARY_FAILED"
 *      "REGENERATE_STORY_SUMMARY_COMPLETED"
 *      "REGENERATE_STORY_SUMMARY_FAILED"
 *  - jobId:   Spring 이 보낸 jobId 그대로 되돌려 받음 → external_id 로 Job 조회.
 *  - payload: 성공 시에만 값 존재.
 *  - error:   실패 시에만 값 존재. `StoryResultEnvelope.kt` 의 `StoryError` 재사용.
 *
 * `@JsonIgnoreProperties(ignoreUnknown = true)` — AI schema drift 방어 (Pre-mortem A).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class StorySummaryResultEnvelope(
    val jobId: String,
    val type: String,
    val status: String,
    val payload: StorySummaryPayload? = null,
    val error: StoryError? = null,
)
