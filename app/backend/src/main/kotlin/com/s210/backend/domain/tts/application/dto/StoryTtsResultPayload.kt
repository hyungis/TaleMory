package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.s210.backend.domain.storyboard.application.dto.UsageInfo

@JsonIgnoreProperties(ignoreUnknown = true)
data class StoryTtsResultPayload(
    val storyId: Long,
    val voiceId: String,
    val items: List<TtsResultItem>,
    val sceneSentenceUpdates: List<SceneSentenceUpdate>,
    val summary: TtsSummary,
    /**
     * AI 워커가 비용 측정 못 하는 케이스(외부 TTS 호출 실패 직전 fallback 등) 에서
     * usage 를 생략해 보내는 경우가 있어 nullable 로 둔다. null 이어도 잡 SUCCESS 처리는 진행.
     */
    val usage: UsageInfo? = null,
)
