package com.s210.backend.domain.tts.application.dto

data class StoryTtsPayload(
    val storyId: Long,
    val storyMode: String = "VIEWER",
    val voiceId: String,
    val referenceAudioUrl: String? = null,
    val referenceAudioS3Key: String? = null,
    val voiceRefs: List<TtsVoiceReference> = emptyList(),
    val language: String = "en-US",
    val format: String = "wav",
    val options: TtsOptions,
    val sentences: List<TtsSentenceItem>,
)

data class TtsVoiceReference(
    val speakerKey: String,
    val voiceId: String,
    val referenceAudioUrl: String? = null,
    val referenceAudioS3Key: String? = null,
)
