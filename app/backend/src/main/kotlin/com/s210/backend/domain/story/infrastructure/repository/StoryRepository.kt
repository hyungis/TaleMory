package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.model.StoryStatus
import org.springframework.data.jpa.repository.JpaRepository

interface StoryRepository : JpaRepository<Story, Long> {
    /**
     * "진행 중인 동화" 조회용 — soft-delete 제외 + 상태 필터 + 최신순.
     * 현재 BasicInfoStep "이어서 작성" 플로우에서 status=DRAFT 로 호출.
     */
    fun findTopByUserIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
        userId: Long,
        status: StoryStatus,
    ): Story?
}
