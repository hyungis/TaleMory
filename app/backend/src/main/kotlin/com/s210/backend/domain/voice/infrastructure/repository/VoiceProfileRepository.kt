package com.s210.backend.domain.voice.infrastructure.repository

import com.s210.backend.domain.voice.entity.VoiceProfile
import org.springframework.data.jpa.repository.JpaRepository

interface VoiceProfileRepository : JpaRepository<VoiceProfile, Long> {
    fun findAllByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: Long): List<VoiceProfile>

    fun findByIdAndDeletedAtIsNull(id: Long): VoiceProfile?

    /**
     * 같은 사용자의 활성(soft-delete X) 보이스 프로필 중 동일 title 의 row 를 반환 (없으면 null).
     *
     * `addVoiceProfile` 의 중복 가드에서 사용 —
     *  - overwrite=false 면 존재 시 `DUPLICATE_TITLE` (409) throw
     *  - overwrite=true 면 이 row 의 `audioUrl` 을 새 s3Key 로 in-place 교체 (FK 참조 무결성 유지)
     *
     * 존재 여부만 필요한 곳도 `result != null` 로 판정 가능 — 별도 existsBy 메서드 불필요.
     */
    fun findByUserIdAndTitleAndDeletedAtIsNull(userId: Long, title: String): VoiceProfile?
}
