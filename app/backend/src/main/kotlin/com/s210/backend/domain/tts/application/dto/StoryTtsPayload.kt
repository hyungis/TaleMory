package com.s210.backend.domain.tts.application.dto

data class StoryTtsPayload(
    val storyId: Long,
    val voiceId: String,
    val referenceAudioUrl: String? = null,
    val referenceAudioS3Key: String? = null,
    val language: String = "en-US",
    val format: String = "wav",
    val options: TtsOptions,
    val sentences: List<TtsSentenceItem>,
)
