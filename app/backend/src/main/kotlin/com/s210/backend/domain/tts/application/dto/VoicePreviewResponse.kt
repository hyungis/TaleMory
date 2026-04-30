package com.s210.backend.domain.tts.application.dto

data class VoicePreviewResponse(
    val audioUrl: String,
    val s3Key: String,
    val durationMs: Long,
)
