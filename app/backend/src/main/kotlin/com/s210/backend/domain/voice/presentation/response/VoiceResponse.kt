package com.s210.backend.domain.voice.presentation.response

import com.s210.backend.domain.voice.application.dto.VoiceProfileResult
import java.time.Instant
import java.time.LocalDateTime

data class VoicePresignResponse(
    val uploadUrl: String,
    val s3Key: String,
    val expiresAt: Instant,
)

data class VoiceProfileResponse(
    val voiceProfileId: Long,
    val userId: Long,
    val title: String,
    val audioUrl: String?,
    val ttsVoiceUrl: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
) {
    companion object {
        fun from(result: VoiceProfileResult): VoiceProfileResponse = VoiceProfileResponse(
            voiceProfileId = result.id,
            userId = result.userId,
            title = result.title,
            audioUrl = result.audioUrl,
            ttsVoiceUrl = result.ttsVoiceUrl,
            createdAt = result.createdAt,
            updatedAt = result.updatedAt,
        )
    }
}

data class VoicePreviewResponse(
    val audioUrl: String,
)

data class VoiceRecordingScriptResponse(
    val script: String,
)
