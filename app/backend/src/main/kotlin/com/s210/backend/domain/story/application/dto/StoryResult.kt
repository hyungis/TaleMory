package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryStatus
import java.time.LocalDate
import java.time.LocalDateTime

data class StoryResult(
    val id: Long,
    val title: String?,
    val synopsis: String?,
    val difficulty: Difficulty,
    val status: StoryStatus,
    val isBookmarked: Boolean,
    val shareToken: String?,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun from(story: Story): StoryResult = StoryResult(
            id = story.id,
            title = story.title,
            synopsis = story.synopsis,
            difficulty = story.difficulty,
            status = story.status,
            isBookmarked = story.isBookmarked,
            shareToken = story.shareToken,
            travelPlace = story.travelPlace,
            travelStartDate = story.travelStartDate,
            travelEndDate = story.travelEndDate,
            publishedAt = story.publishedAt,
            createdAt = story.createdAt,
        )
    }
}
