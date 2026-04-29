package com.s210.backend.domain.voice.presentation.request

data class CreateVoiceProfileRequest(
    val title: String
)

data class VoicePreviewApiRequest(
    val text: String,
    val emotion: String? = null,
    val language: String = "en-US",
)
