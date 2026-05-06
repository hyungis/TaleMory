package com.s210.backend.domain.tts.application.dto

data class VoicePreviewRequest(
    val text: String,
    val language: String = "en-US",
    val format: String = "wav",
    val options: VoicePreviewOptions = VoicePreviewOptions(),
    val referenceAudioUrl: String? = null,
    val referenceAudioS3Key: String? = null,
)

data class VoicePreviewOptions(
    val emotion: String? = null,
    val stylePrompt: String? = null,
    val speakingRate: Double? = null,
    val pitch: Double? = null,
    val volumeGain: Double? = null,
    val useSsml: Boolean = false,
)
