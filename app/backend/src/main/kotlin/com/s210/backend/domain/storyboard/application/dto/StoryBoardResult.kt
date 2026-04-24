package com.s210.backend.domain.storyboard.application.dto

import com.s210.backend.domain.story.entity.StoryBoard
import java.time.LocalDate

/**
 * `PATCH /api/stories/{storyId}/storyboard/story` 응답 — 명세 #29.
 * 업데이트된 story_board row 의 스냅샷을 FE 에 그대로 돌려준다.
 *
 * FE 는 이 응답의 `story` 를 "확실히 DB 에 저장됐다" 는 의미로 반영한다
 * (optimistic UI 이후 confirmation).
 */
data class StoryBoardResult(
    val storyBoardId: Long,
    val storyId: Long,
    val prompt: String,
    val story: String,
    val createAt: LocalDate,
    val updateAt: LocalDate?,
) {
    companion object {
        fun from(entity: StoryBoard): StoryBoardResult = StoryBoardResult(
            storyBoardId = entity.id,
            storyId = entity.storyId,
            prompt = entity.prompt,
            story = entity.story,
            createAt = entity.createAt,
            updateAt = entity.updateAt,
        )
    }
}
