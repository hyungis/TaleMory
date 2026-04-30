package com.s210.backend.domain.tts.application.dto

data class SceneSentenceUpdate(
    val sentenceId: Long,
    val ttsAudioUrl: String,
    val ttsAudioS3Key: String,
)
