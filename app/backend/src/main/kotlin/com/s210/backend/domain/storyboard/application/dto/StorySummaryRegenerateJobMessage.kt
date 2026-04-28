package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리 줄거리(요약) 재생성 요청 메시지 (Spring → AI).
 *
 * AI 측 스펙 `app/ai/app/schemas/mq_storyboard_summary.py` 의 envelope 와 1:1 매칭.
 * routing key: "ai.cpu.story.summary.regenerate"
 * exchange:    "ai.request"
 *
 * envelope 필드
 *  - jobId:   Spring 의 `story_generation_jobs.id` 를 string 화.
 *  - jobType: AI 의 `StorySummaryJobType` Literal 값. 재생성은 "STORY_SUMMARY_REGENERATE".
 *  - storyId: AI 가 결과 envelope 에 다시 동봉할 수 있도록 top-level 로 전달.
 *  - payload: 재생성 입력 — generate 와 동일한 grounding(children/photos/travel) +
 *             previousSummary + userPrompt. AI 의 `StoryboardSummaryRegenerateRequest` 매핑.
 */
data class StorySummaryRegenerateJobMessage(
    val jobId: String,
    val jobType: String = "STORY_SUMMARY_REGENERATE",
    val storyId: Long,
    val payload: StorySummaryRegeneratePayload,
)

/**
 * 줄거리 재생성 payload — AI 의 `StoryboardSummaryRegenerateRequest` 와 동일 shape.
 *
 *  StoryboardSummaryRegenerateRequest =
 *      StoryboardSummaryGenerateRequest         (= StoryGeneratePayload 와 동일 grounding)
 *      + previousSummary: StoryboardSummaryDraft
 *      + userPrompt: str
 *
 * AI 가 OpenAI 호출 시:
 *  - photos / children / travel 등은 fallback grounding 으로 재사용
 *  - previousSummary 는 "이걸 베이스로" 컨텍스트
 *  - userPrompt 는 변경 지시 (highest priority)
 */
data class StorySummaryRegeneratePayload(
    val children: List<ChildInfo>,
    val companions: List<String>,
    val travel: TravelInfo,
    val photos: List<PhotoInput>,
    val difficulty: String,
    val additionalInstruction: String? = null,
    /** 직전 SUCCESS 줄거리 — `SummaryMeta` 가 AI 의 `StoryboardSummaryDraft` 와 1:1. */
    val previousSummary: SummaryMeta,
    /** 사용자가 재생성 시 입력한 자유 프롬프트. */
    val userPrompt: String,
)
