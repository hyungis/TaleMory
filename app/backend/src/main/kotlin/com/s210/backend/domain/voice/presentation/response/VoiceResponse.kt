package com.s210.backend.domain.voice.presentation.response

import com.s210.backend.domain.voice.application.dto.VoiceProfileResult
import java.time.LocalDateTime

data class VoiceProfileResponse(
    val voiceProfileId: Long,
    val userId: Long,
    val title: String,
    val audioUrl: String?,
    val ttsVoiceUrl: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
    val uploadUrl: String? = null,
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

        fun from(result: VoiceProfileResult, uploadUrl: String?): VoiceProfileResponse = VoiceProfileResponse(
            voiceProfileId = result.id,
            userId = result.userId,
            title = result.title,
            audioUrl = result.audioUrl,
            ttsVoiceUrl = result.ttsVoiceUrl,
            createdAt = result.createdAt,
            updatedAt = result.updatedAt,
            uploadUrl = uploadUrl,
        )
    }
}

data class VoicePreviewResponse(
    val audioUrl: String,
)

data class VoiceRecordingScriptResponse(
    val script: String,
)
