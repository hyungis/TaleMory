package com.s210.backend.domain.story.presentation.response

import java.time.LocalDate
import java.time.LocalDateTime

data class StoryResponse(
    val id: Long,
    val title: String?,
    val difficulty: String,
    val status: String,
    val isBookmarked: Boolean,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class StoryDetailResponse(
    val id: Long,
    val title: String?,
    val synopsis: String?,
    val difficulty: String,
    val status: String,
    val isBookmarked: Boolean,
    val shareToken: String?,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val publishedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class PhotoResponse(
    val id: Long,
    val imageUrl: String,
    val purpose: String,
    val description: String?,
    val displayOrder: Long
)

data class StoryboardPageResponse(
    val id: Long,
    val pageNumber: Int,
    val englishText: String?,
    val koreanText: String?,
    val imageUrl: String?
)

data class SceneResponse(
    val id: Long,
    val pageNumber: Int,
    val illustrationUrl: String?,
    val sentences: List<SentenceResponse>
)

data class SentenceResponse(
    val id: Long,
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String?,
    val ttsAudioUrl: String?,
    val speakerKey: String?,
    val bubbleSlot: String?,
    val hasHighlighted: Boolean
)

data class OutroResponse(
    val id: Long,
    val outroText: String,
    val audioUrl: String?,
    val signature: String?
)

data class ProgressResponse(
    val storyId: Long,
    val lastScenePage: Int
)

data class ShareLinkResponse(
    val shareToken: String,
    val shareUrl: String
)
