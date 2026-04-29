package com.s210.backend.domain.tts.application.dto

data class TtsOptions(
    val defaultEmotion: String? = null,
    val generateFullBookAudio: Boolean = false,
)
