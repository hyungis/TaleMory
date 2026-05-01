package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.model.StoryStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDateTime

interface StoryRepository : JpaRepository<Story, Long> {
    /**
     * "진행 중인 동화" 조회용 — soft-delete 제외 + 상태 필터 + 최신순.
     * 현재 BasicInfoStep "이어서 작성" 플로우에서 status=DRAFT 로 호출.
     */
    fun findTopByUserIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        userId: Long,
        status: StoryStatus,
    ): Story?

    fun findByShareTokenAndDeletedAtIsNull(shareToken: String): Story?

    fun findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId: Long): List<Story>

    fun findByIdAndUserId(id: Long, userId: Long): Story?

    /**
     * DRAFT 만료 배치 잡 (`StoryExpirationJob`) 전용 조회.
     *
     * 조건:
     *  - `status != PUBLISHED` (출판된 동화는 영구 보존)
     *  - `deletedAt IS NULL`   (이미 soft-delete 된 row 는 제외)
     *  - `createdAt < cutoff`  (생성 후 N일 경과)
     *
     * 정책 cutoff = `now - 3 days`. 결과는 잡에서 페이지별 Redis/S3 cleanup 후 일괄 soft-delete.
     */
    fun findByStatusNotAndDeletedAtIsNullAndCreatedAtBefore(
        status: StoryStatus,
        createdAt: LocalDateTime,
    ): List<Story>
}
