package com.s210.backend.domain.story.infrastructure.repository

import com.s210.backend.domain.story.entity.StoryBoard
import org.springframework.data.jpa.repository.JpaRepository

interface StoryBoardRepository : JpaRepository<StoryBoard, Long> {
    /**
     * 한 story 에 대해 여러 번 생성 가능 (재생성) 하므로,
     * "이 스토리의 가장 최근 story_board" 를 편집/조회할 때 사용.
     * deleted_at 없는 것 중 가장 최신 id.
     */
    fun findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId: Long): StoryBoard?
}
