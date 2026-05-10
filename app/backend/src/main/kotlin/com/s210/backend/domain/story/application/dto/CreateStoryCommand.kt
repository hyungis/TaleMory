package com.s210.backend.domain.story.application.dto

import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryMode
import java.time.LocalDate

data class CreateStoryCommand(
    val userId: Long,
    val title: String?,
    val difficulty: Difficulty,
    /** 동화 생성 모드 — VIEWER (narration, 기본) / WEBTOON (대화). */
    val mode: StoryMode = StoryMode.VIEWER,
    val companionsJson: String,
    val mainCharacterJson: String,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null
)
