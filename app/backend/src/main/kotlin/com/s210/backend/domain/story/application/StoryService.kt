package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.story.application.dto.CreateStoryCommand
import com.s210.backend.domain.story.application.dto.ModifyStoryCommand
import com.s210.backend.domain.story.application.dto.StoryResult
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.story.presentation.response.ShareLinkResponse
import com.s210.backend.domain.story.presentation.response.StoryResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.UUID

/**
 * 동화 제작 워크스페이스의 진입 스토리 (DRAFT) 를 생성/수정하는 유스케이스.
 *
 * - `addStory` : Step 1 최초 진행 시 1회 호출.
 * - `modifyStory` : BasicInfoStep 에서 뒤로가기 → 값 수정 → 다시 "사진 선택하러 가기" 시 호출.
 *                   중복 DRAFT 생성 대신 기존 row 를 업데이트해 사용자의 수정 의도를 서버에 반영한다.
 * 이후 publish / delete 같은 lifecycle 메서드는 후속 MR 에서 추가.
 */
@Service
@Transactional
class StoryService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val stylePresetRepository: StylePresetRepository,
) {
    /**
     * 로그인 유저의 "진행 중인 동화" 1건(최신 DRAFT) 을 반환한다.
     * 없으면 null — controller 에서 `ApiResponse(data = null)` 로 내려준다.
     * BookstoreScene 에서 "새 동화책 만들기" 클릭 시 이어서 작성 여부 결정용.
     */
    @Transactional(readOnly = true)
    fun findLatestDraft(userId: Long): StoryResult? =
        storyRepository
            .findTopByUserIdAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(userId, StoryStatus.DRAFT)
            ?.let(StoryResult::from)

    /**
     * 기본 정보가 모두 채워진 상태로 새 동화 row 를 생성한다.
     * 상태는 무조건 DRAFT — 이후 단계에서 스토리보드/삽화/음성이 순차적으로 붙는다.
     */
    fun addStory(command: CreateStoryCommand): StoryResult =
        storyRepository.save(
            Story(
                userId = command.userId,
                title = command.title,
                difficulty = command.difficulty,
                status = StoryStatus.DRAFT,
                companionsJson = command.companionsJson,
                mainCharacterJson = command.mainCharacterJson,
                travelPlace = command.travelPlace,
                travelStartDate = command.travelStartDate,
                travelEndDate = command.travelEndDate,
            ),
        ).let(StoryResult::from)

    /**
     * 기존 DRAFT 스토리의 step 1 필드를 부분 업데이트한다.
     *  - 소유권 검증: 다른 유저 리소스면 403 FORBIDDEN
     *  - 존재하지 않음: 404 STORY_NOT_FOUND
     *  - `ModifyStoryCommand` 의 null 필드는 "미변경" 으로 취급 (PATCH semantics).
     */
    fun modifyStory(userId: Long, storyId: Long, command: ModifyStoryCommand): StoryResult {
        val story = ownedStory(userId, storyId)
        command.title?.let { story.title = it }
        command.difficulty?.let { story.difficulty = it }
        command.companionsJson?.let { story.companionsJson = it }
        command.mainCharacterJson?.let { story.mainCharacterJson = it }
        command.travelPlace?.let { story.travelPlace = it }
        command.travelStartDate?.let { story.travelStartDate = it }
        command.travelEndDate?.let { story.travelEndDate = it }
        return StoryResult.from(story)
    }

    /**
     * 소프트 삭제. "새로 시작하기" 선택 시 기존 DRAFT 를 정리하기 위해 호출한다.
     * deleted_at 을 찍어 GET /draft 조회에서 제외되도록 한다 (DB 에는 row 유지).
     */
    fun removeStory(userId: Long, storyId: Long) {
        val story = ownedStory(userId, storyId)
        story.deletedAt = LocalDateTime.now()
    }

    /**
     * 내 동화 목록 조회. soft-delete 제외, 최신순.
     * Scene 정보를 벌크 로딩해 sceneCount / coverImageUrl 을 포함한다.
     */
    @Transactional(readOnly = true)
    fun findStories(userId: Long): List<StoryResponse> {
        val stories = storyRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
        if (stories.isEmpty()) return emptyList()

        val storyIds = stories.map { it.id }
        val scenesByStory = sceneRepository
            .findByStoryIdInOrderByStoryIdAscPageNumberAsc(storyIds)
            .groupBy { it.storyId }

        return stories.map { story ->
            val scenes = scenesByStory[story.id].orEmpty()
            StoryResponse(
                id = story.id,
                title = story.title,
                difficulty = story.difficulty.name,
                status = story.status.name,
                isBookmarked = story.isBookmarked,
                travelPlace = story.travelPlace,
                travelStartDate = story.travelStartDate,
                travelEndDate = story.travelEndDate,
                publishedAt = story.publishedAt,
                createdAt = story.createdAt,
                sceneCount = scenes.size,
                coverImageUrl = scenes.firstOrNull()?.illustrationUrl,
                shareToken = story.shareToken,
            )
        }
    }

    /**
     * 동화 공개(출판). DRAFT → PUBLISHED 전환 + shareToken 발급.
     */
    fun publishStory(userId: Long, storyId: Long): ShareLinkResponse {
        val story = ownedStory(userId, storyId)
        if (story.status == StoryStatus.PUBLISHED) {
            return ShareLinkResponse(
                shareToken = story.shareToken!!,
                shareUrl = "/shared/${story.shareToken}",
            )
        }
        story.status = StoryStatus.PUBLISHED
        story.publishedAt = LocalDateTime.now()
        if (story.shareToken == null) {
            story.shareToken = UUID.randomUUID().toString().replace("-", "")
        }
        return ShareLinkResponse(
            shareToken = story.shareToken!!,
            shareUrl = "/shared/${story.shareToken}",
        )
    }

    /**
     * 공유 링크 조회. PUBLISHED 상태가 아니면 409.
     * shareToken 이 아직 없으면 자동 발급.
     */
    fun findShareLink(userId: Long, storyId: Long): ShareLinkResponse {
        val story = ownedStory(userId, storyId)
        if (story.status != StoryStatus.PUBLISHED) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
        if (story.shareToken == null) {
            story.shareToken = UUID.randomUUID().toString().replace("-", "")
        }
        return ShareLinkResponse(
            shareToken = story.shareToken!!,
            shareUrl = "/shared/${story.shareToken}",
        )
    }

    /**
     * 삽화 스타일 프리셋 선택. Story.stylePresetId 를 갱신한다.
     */
    fun modifyStyle(userId: Long, storyId: Long, stylePresetId: Long) {
        val story = ownedStory(userId, storyId)
        if (!stylePresetRepository.existsById(stylePresetId)) {
            throw BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        }
        story.stylePresetId = stylePresetId
    }

    /**
     * 단건 조회 + 소유권 검증 공통 헬퍼.
     *  - 존재하지 않음 → 404 STORY_NOT_FOUND
     *  - 다른 유저의 리소스 → 403 FORBIDDEN
     */
    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) {
            throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        return story
    }
}
