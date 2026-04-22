package com.s210.backend.domain.story.presentation.request

import java.time.LocalDate

data class CreateStoryRequest(
    val title: String?,
    val difficulty: String,
    val companionsJson: String,
    val mainCharacterJson: String,
    val travelPlace: String? = null,
    val travelStartDate: LocalDate? = null,
    val travelEndDate: LocalDate? = null
)

data class ModifyStoryRequest(
    val title: String?,
    val difficulty: String?
)

data class PhotoOrderRequest(
    val photoIds: List<Long>
)

data class ModifyPhotoRequest(
    val description: String?,
    val tagsJson: String?
)

data class ModifyStoryboardPageRequest(
    val englishText: String?,
    val koreanText: String?
)

data class OutroRequest(
    val outroText: String,
    val signature: String?
)

data class ProgressRequest(
    val lastScenePage: Int
)
