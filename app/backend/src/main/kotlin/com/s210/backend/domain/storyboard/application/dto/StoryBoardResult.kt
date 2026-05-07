package com.s210.backend.domain.storyboard.application.dto

import com.s210.backend.common.codec.StoryId
import com.s210.backend.domain.story.entity.StoryBoard
import java.time.LocalDate

/**
 * `PATCH /api/stories/{storyId}/storyboard/story` 응답 — 명세 #29.
 * 업데이트된 story_board row 의 스냅샷을 FE 에 그대로 돌려준다.
 *
 * FE 는 이 응답의 `story` 를 "확실히 DB 에 저장됐다" 는 의미로 반영한다
 * (optimistic UI 이후 confirmation).
 *
 * NOTE: `storyBoardId` 는 story_board.id (DB PK) 의 raw Long. StoryBoard 엔티티는
 * 별도 ID 별칭을 만들지 않은 도메인이라 그대로 노출. FE 가 이 값을 별도로 참조하지
 * 않는 한 안전하지만, Phase 2 정리 대상.
 */
data class StoryBoardResult(
    val storyBoardId: Long,
    val storyId: StoryId,
    val prompt: String,
    val story: String,
    val createAt: LocalDate,
    val updateAt: LocalDate?,
) {
    companion object {
        fun from(entity: StoryBoard): StoryBoardResult = StoryBoardResult(
            storyBoardId = entity.id,
            storyId = StoryId(entity.storyId),
            prompt = entity.prompt,
            story = entity.story,
            createAt = entity.createAt,
            updateAt = entity.updateAt,
        )
    }
}
