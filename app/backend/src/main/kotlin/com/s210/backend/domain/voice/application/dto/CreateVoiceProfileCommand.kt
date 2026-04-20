package com.s210.backend.domain.voice.application.dto

data class CreateVoiceProfileCommand(
    val userId: Long,
    val title: String,
    val audioUrl: String?
)
