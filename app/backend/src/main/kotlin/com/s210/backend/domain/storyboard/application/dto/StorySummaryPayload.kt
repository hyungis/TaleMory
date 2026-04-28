package com.s210.backend.domain.storyboard.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * AI 가 보내는 줄거리(요약) 데이터.
 *
 * 본문 생성(`StoryboardPayload`)의 베이스가 되는 메타 + 한 단락 요약.
 * `summaryKo` 는 `story_boards.story` 컬럼에 그대로 저장된다.
 *
 * 정확한 필드명은 Q2 게이트(AI 측 schema 확정) 후 재검토 필요.
 *
 * `@JsonIgnoreProperties(ignoreUnknown = true)` — AI schema drift 방어.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class StorySummaryPayload(
    /** 영문 title. */
    val title: String,
    /** 영문 한 단락 요약. */
    val summary: String,
    /** 한글 한 단락 요약 (story_boards.story 에 저장됨). */
    val summaryKo: String,
    val moralTheme: String,
    val storyQuest: String,
    val recurringMotif: String,
    /**
     * 줄거리의 핵심 감정 비트 (3~5개). AI 가 SUMMARY 응답에 포함시키는 필드 — STORY 발행 시
     * `approvedSummary.keyEmotionalBeats` 로 전달되어 페이지 감정 흐름의 가이드가 된다.
     *
     * 과거 `readingLevel: String` 필드를 들고 있었는데, AI 측 SUMMARY 스키마는 readingLevel 을
     * 만들지 않으므로(=STORY 본문 응답에서만 나오는 값) 제거. AI 의 실제 schema 와 1:1 동기화.
     */
    val keyEmotionalBeats: List<String>,
    /** OpenAI 호출 비용/토큰 정보. `StoryResultEnvelope.kt` 의 `UsageInfo` 재사용. */
    val usage: UsageInfo,
)
