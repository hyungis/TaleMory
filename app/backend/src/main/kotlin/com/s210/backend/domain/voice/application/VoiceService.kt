package com.s210.backend.domain.voice.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.voice.application.dto.VoiceProfileResult
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class VoiceService(
    private val voiceProfileRepository: VoiceProfileRepository,
) {
    @Transactional(readOnly = true)
    fun findVoiceProfiles(userId: Long): List<VoiceProfileResult> =
        voiceProfileRepository.findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
            .map(VoiceProfileResult::from)

    fun removeVoiceProfile(userId: Long, voiceProfileId: Long) {
        val voiceProfile = ownedVoiceProfile(userId, voiceProfileId)
        voiceProfile.deletedAt = LocalDateTime.now()
    }

    private fun ownedVoiceProfile(userId: Long, voiceProfileId: Long): VoiceProfile {
        val voiceProfile = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.VOICE_PROFILE_NOT_FOUND)
        if (voiceProfile.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        return voiceProfile
    }
}
