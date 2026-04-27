package com.s210.backend.domain.voice.presentation.response

import java.time.LocalDateTime

data class VoiceProfileResponse(
    val id: Long,
    val title: String,
    val audioUrl: String?,
    val ttsVoiceUrl: String?,
    val createdAt: LocalDateTime,
    val uploadUrl: String? = null,
)

data class VoicePreviewResponse(
    val audioUrl: String
)

data class VoiceRecordingScriptResponse(
    val script: String
)
