package com.s210.backend.domain.storyboard.application.dto

/**
 * 스토리 생성 결과 메시지 (AI → Spring).
 *
 * AI 측 스펙 `app/ai/app/schemas/mq_storyboard.py` 의
 * StorySuccessEnvelope / StoryFailureEnvelope 를 하나의 Kotlin DTO 로 합쳤다.
 *
 * exchange:    "ai.result"
 * routing key: "ai.result.story.generate.completed" 또는 ".failed"
 *
 * 필드
 *  - status:  "COMPLETED" / "FAILED" — 이 값으로 payload 와 error 중 어느 쪽을 읽을지 판단.
 *  - type:    "GENERATE_STORY_COMPLETED" / "GENERATE_STORY_FAILED" (규약 문서용).
 *  - jobId:   Spring 이 보낸 jobId 그대로 되돌려 받음 → external_id 로 Job 조회.
 *  - payload: 성공 시에만 값 존재.
 *  - error:   실패 시에만 값 존재.
 */
data class StoryResultEnvelope(
    val jobId: String,
    val type: String,
    val storyId: Long? = null,
    val status: String,
    val payload: StoryboardPayload? = null,
    val error: StoryError? = null,
)

/**
 * 실제 생성된 동화 본문 + 메타데이터.
 * AI 쪽 `StoryboardGenerateResponse` 와 1:1 매칭.
 *
 * 현재 이 범위에서 생성되는 것은 "텍스트" 까지.
 * pages[].imagePrompt 는 나중에 일러스트 생성 단계에서 사용할 힌트 문자열.
 */
data class StoryboardPayload(
    val title: String,
    val synopsis: String,
    val moralTheme: String,
    val storyQuest: String,
    val recurringMotif: String,
    val pageCount: Int,
    val pageCountReason: String,
    val readingLevel: ReadingLevel,
    val totalWordCount: Int,
    val pages: List<StoryboardPageDto>,
    val usage: UsageInfo,
)

/**
 * 아이 연령 / 난이도에 따라 AI 가 추천한 페이지 텍스트 가이드.
 * (실제 페이지 생성은 이미 이 가이드에 맞춰져 있고, 프론트 노출용 정보는 optional)
 */
data class ReadingLevel(
    val basedOnAge: Int,
    val sentencesPerPage: String,
    val wordsPerSentence: String,
    val reason: String,
)

/**
 * 동화 페이지 1장.
 * - sourcePhotoIds: 이 페이지를 만들 때 영감이 된 사진 id 목록 (Step 2 photos[].photoId).
 *                  0건일 수도 있다 (전환 페이지, 감정 페이지 등).
 * - imagePrompt:   나중에 일러스트 생성할 때 쓸 AI 힌트. 현재 단계에서는 저장만.
 */
data class StoryboardPageDto(
    val pageNumber: Int,
    val sourcePhotoIds: List<Int>,
    val sceneSummary: String,
    val englishText: String,
    val koreanText: String,
    val imagePrompt: String,
    val sentences: List<StorySentenceDto>,
    val sentenceCount: Int,
    val wordCount: Int,
)

/**
 * 한 페이지 안의 문장 1개.
 * emotion 은 TTS 단계에서 톤 제어에 사용 (NEUTRAL / HAPPY / SAD / ... / BRAVE).
 */
data class StorySentenceDto(
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String,
    val emotion: String,
)

/**
 * OpenAI 호출 비용/토큰 정보. `story_generation_jobs.cost_usd` 에 저장해 누적 비용 추적.
 * null 이 올 수 있는 필드는 AI 가 측정 실패 시 비워둘 수 있음.
 */
data class UsageInfo(
    val model: String,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val totalTokens: Int? = null,
    val costUsd: Double? = null,
    val promptTemplateVersion: String,
)

/**
 * 실패 응답의 에러 정보.
 * code 예: "GENERATE_STORY_ERROR", "GENERATE_STORY_RUNTIME_ERROR"
 */
data class StoryError(
    val code: String,
    val message: String,
)
