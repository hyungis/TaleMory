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

/**
 * 뷰어 화면 통합 조회 응답.
 * 메타 + scenes[] + outro 를 한 번의 호출로 내려 flip 애니메이션 중 네트워크 대기 제거.
 */
data class StoryViewResponse(
    val storyId: Long,
    val title: String?,
    val mainCharacter: MainCharacterView?,
    val coverIllustrationUrl: String?,
    val publishedAt: LocalDateTime?,
    val scenes: List<SceneViewResponse>,
    val outro: OutroViewResponse?
)

data class SceneViewResponse(
    val sceneId: Long,
    val pageNumber: Int,
    val illustrationUrl: String?,
    val characterAnchors: List<CharacterAnchorView>,
    val sentences: List<SentenceViewResponse>
)

data class SentenceViewResponse(
    val sentenceId: Long,
    val sentenceOrder: Int,
    val englishText: String,
    val koreanText: String?,
    val ttsAudioUrl: String?,
    val speakerKey: String?,
    val bubbleSlot: String?
)

data class OutroViewResponse(
    val outroText: String,
    val audioUrl: String?,
    val signature: String?
)

data class MainCharacterView(
    val name: String?
)

data class CharacterAnchorView(
    val characterId: Long?,
    val x: Double?,
    val y: Double?,
    val scale: Double?
)
