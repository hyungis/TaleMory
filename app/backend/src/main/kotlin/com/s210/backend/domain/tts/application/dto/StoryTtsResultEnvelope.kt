package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.s210.backend.domain.storyboard.application.dto.AiError

/**
 * AI → BE TTS 결과 envelope.
 * type: GENERATE_TTS_COMPLETED | GENERATE_TTS_FAILED.
 *
 * StoryboardResultListener.EnvelopeTypes.TTS set 으로 분기 후 이 DTO 로 역직렬화.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class StoryTtsResultEnvelope(
    val jobId: String,
    val type: String,
    val storyId: Long,
    val status: String,                // "COMPLETED" | "FAILED"
    val payload: StoryTtsResultPayload?,
    val error: AiError? = null,
)
