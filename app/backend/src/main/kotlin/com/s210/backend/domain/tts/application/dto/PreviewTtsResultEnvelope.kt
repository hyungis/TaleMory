package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.s210.backend.domain.storyboard.application.dto.AiError

@JsonIgnoreProperties(ignoreUnknown = true)
data class PreviewTtsResultEnvelope(
    val jobId: String,
    val type: String,
    val status: String,
    val payload: PreviewTtsResultPayload? = null,
    val error: AiError? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class PreviewTtsResultPayload(
    val voiceId: String,
    val audioUrl: String,
    val s3Key: String? = null,
    val durationMs: Long,
    val format: String,
    val appliedStyle: VoicePreviewOptions? = null,
)
