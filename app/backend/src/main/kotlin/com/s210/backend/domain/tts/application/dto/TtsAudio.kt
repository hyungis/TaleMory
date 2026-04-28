package com.s210.backend.domain.tts.application.dto

data class TtsAudio(
    val audioUrl: String,
    val s3Key: String,
    val durationMs: Long,
    val format: String,
)
