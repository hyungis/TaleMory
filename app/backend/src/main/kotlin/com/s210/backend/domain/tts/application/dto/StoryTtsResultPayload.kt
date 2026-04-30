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
    val fullBookAudio: TtsAudio? = null,
    val usage: UsageInfo,
)
