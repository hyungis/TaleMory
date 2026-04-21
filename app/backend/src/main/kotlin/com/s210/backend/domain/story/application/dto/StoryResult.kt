package com.s210.backend.domain.story.application.dto

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
    val createdAt: LocalDateTime
)
