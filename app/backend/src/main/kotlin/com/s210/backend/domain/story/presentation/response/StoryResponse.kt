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
    val createdAt: LocalDateTime,
    val sceneCount: Int = 0,
    val coverImageUrl: String? = null,
    val shareToken: String? = null,
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

/**
 * 동화 기본 정보 생성(POST /api/stories) 직후 FE 가 유일하게 필요로 하는 값은 `storyId` 뿐.
 * 후속 step 2~8 에서 다른 리소스를 붙일 때 FK 로 사용한다.
 */
data class StoryCreateResponse(
    val storyId: Long,
)

/**
 * GET /api/stories/draft — 로그인 유저의 "진행 중인 동화" 를 BasicInfoStep 상태로 복원하기 위한 페이로드.
 * DRAFT 가 없으면 controller 가 `data = null` 로 내려준다.
 */
data class StoryDraftResponse(
    val storyId: Long,
    val title: String?,
    val difficulty: String,
    val companionsJson: String,
    val mainCharacterJson: String,
    val travelPlace: String?,
    val travelStartDate: LocalDate?,
    val travelEndDate: LocalDate?,
    val createdAt: LocalDateTime,
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

data class HighlightVoiceResponse(
    val highlightVoiceId: Long,
    val sentenceId: Long,
    val audioUrl: String,
)

data class PresignedUrlResponse(
    val uploadUrl: String,
    val s3Key: String,
    val expiresAt: String,
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

/**
 * POST /api/stories/{storyId}/storyboard/confirm 응답.
 * TTS Job 을 큐에 넣고 즉시 반환 (비동기 시작 = 202 Accepted).
 * 전부 캐시 적중(status=SUCCESS)인 경우도 202 로 통일.
 */
data class IllustrationRegenerateResponse(
    val jobId: Long,
    val status: String,
)

data class IllustrationRollbackResponse(
    val illustrationUrl: String,
    val version: Int,
)

data class ConfirmStoryboardResponse(
    val jobId: Long,
    val jobType: String,
    val status: String,
    val sceneCount: Int,
    val sentenceCount: Int,
    val cacheHits: Int,
    val cacheMisses: Int,
    val finalIllustrationJobId: Long? = null,
)
