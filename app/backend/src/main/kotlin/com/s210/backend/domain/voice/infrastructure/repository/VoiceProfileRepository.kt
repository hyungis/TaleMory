package com.s210.backend.domain.voice.infrastructure.repository

import com.s210.backend.domain.voice.entity.VoiceProfile
import org.springframework.data.jpa.repository.JpaRepository

interface VoiceProfileRepository : JpaRepository<VoiceProfile, Long> {
    fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: Long): List<VoiceProfile>
}
