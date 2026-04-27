package com.s210.backend.domain.voice.application.dto

import com.s210.backend.domain.voice.entity.VoiceProfile
import java.time.LocalDateTime

data class VoiceProfileResult(
    val id: Long,
    val userId: Long,
    val title: String,
    val audioUrl: String?,
    val ttsVoiceUrl: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
) {
    companion object {
        fun from(voiceProfile: VoiceProfile): VoiceProfileResult = VoiceProfileResult(
            id = voiceProfile.id,
            userId = voiceProfile.userId,
            title = voiceProfile.title,
            audioUrl = voiceProfile.audioUrl,
            ttsVoiceUrl = voiceProfile.ttsVoiceUrl,
            createdAt = voiceProfile.createdAt,
            updatedAt = voiceProfile.updatedAt,
        )
    }
}
