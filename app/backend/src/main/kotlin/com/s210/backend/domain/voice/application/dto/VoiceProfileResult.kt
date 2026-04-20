package com.s210.backend.domain.voice.application.dto

import java.time.LocalDateTime

data class VoiceProfileResult(
    val id: Long,
    val title: String,
    val audioUrl: String?,
    val ttsVoiceUrl: String?,
    val createdAt: LocalDateTime
)
