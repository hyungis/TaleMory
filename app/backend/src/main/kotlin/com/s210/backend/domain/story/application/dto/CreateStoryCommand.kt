package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.model.Difficulty
import java.time.LocalDate

data class CreateStoryCommand(
    val userId: Long,
    val title: String?,
    val difficulty: Difficulty,
    val companionsJson: String,
    val mainCharacterJson: String,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null
)
