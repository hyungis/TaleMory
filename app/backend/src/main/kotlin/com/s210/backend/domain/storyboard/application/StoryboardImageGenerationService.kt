package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryboardPage
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageContext
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageGenerateMessage
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageItem
import com.s210.backend.domain.storyboard.application.dto.StoryboardImagePagePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegenerateMessage
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * 스토리보드 페이지별 이미지(일러스트) 생성을 MQ 비동기로 시작하는 유스케이스.
 *
 * 데이터 소스 (옵션 D'):
 *  - 페이지별 텍스트 (englishText, koreanText, sceneSummary, imagePrompt) → `storyboard_pages`
 *    → 유저가 PATCH 로 한글 본문을 수정했다면 그 수정본이 자동으로 그림 입력에 반영된다.
 *  - 스토리 전역 컨텍스트 (title / synopsis 영문) → 마지막 SUCCESS STORY 잡의 `result_payload`
 *  - 페이지별 참고 사진 s3Key (≤3) → `result_payload.pages[i].sourcePhotoIds` 와 photo_album_items 매칭
 *
 * 두 종류의 publish:
 *  - 배치 생성 (`generate`)         → routing key `ai.image.generate`
 *  - 단일 페이지 재생성 (`regenerateOne`) → routing key `ai.image.regenerate`
 */
@Service
@Transactional
class StoryboardImageGenerationService(
    private val storyRepository: StoryRepository,
    private val stylePresetRepository: StylePresetRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val photoRepository: PhotoAlbumItemRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {

    fun generate(userId: Long, storyId: Long): StartGenerationResult {
        val story = ownedStory(userId, storyId)
        val stylePreset = resolveStylePreset(story)

        // 1) storyboard_pages 가 채워져 있어야 한다 (P2 listener 가 STORY 결과 받을 때 INSERT).
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        // 2) 마지막 SUCCESS STORY 잡에서 영문 title / synopsis / sourcePhotoIds 추출.
        val storyPayload = loadLastSuccessStoryPayload(storyId)
        val sourcePhotoIdsByPage: Map<Int, List<Int>> =
            storyPayload.pages.associate { it.pageNumber to it.sourcePhotoIds }

        // 3) 등장인물 / 동행자 정보 — Story 엔티티 JSON 필드 파싱.
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        // 4) 사진 — id → s3Key 매핑.
        val photoMap: Map<Long, PhotoAlbumItem> = photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
            .associateBy { it.id }

        // 5) 페이지별 item 조립.
        val items = pages.map { page ->
            val s3Keys = (sourcePhotoIdsByPage[page.pageNumber] ?: emptyList())
                .mapNotNull { photoMap[it.toLong()]?.imageUrl }
                .take(MAX_REFERENCE_IMAGES)
            buildItem(
                page = page,
                title = storyPayload.title,
                synopsis = storyPayload.synopsis,
                children = children,
                companions = companions,
                referenceImageS3Keys = s3Keys,
                stylePreset = stylePreset?.code,
                stylePreviewUrl = stylePreset?.previewUrl,
                userPromptOverride = null,
            )
        }

        val seed = deterministicSeed(storyId)
        val payload = StoryboardImageGeneratePayload(storyId = storyId, seed = seed, items = items)

        // 6) job INSERT (PENDING). request_payload 에 그대로 저장 → 후에 P5 가 items.size 카운트에 사용.
        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_IMAGE,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(payload),
            ),
        )

        // 7) MQ publish — AI 가 큐에서 받아 페이지당 1장씩 처리.
        val envelope = StoryboardImageGenerateMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.IMAGE_GENERATE,
            envelope,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_IMAGE.name,
            status = JobStatus.PENDING.name,
        )
    }

    fun regenerateOne(
        userId: Long,
        storyId: Long,
        pageNumber: Int,
        userPrompt: String,
    ): StartGenerationResult {
        val story = ownedStory(userId, storyId)
        val stylePreset = resolveStylePreset(story)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val storyPayload = loadLastSuccessStoryPayload(storyId)
        val origPage = storyPayload.pages.firstOrNull { it.pageNumber == pageNumber }
        val sourcePhotoIds = origPage?.sourcePhotoIds ?: emptyList()

        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val photoMap = photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
            .associateBy { it.id }
        val s3Keys = sourcePhotoIds
            .mapNotNull { photoMap[it.toLong()]?.imageUrl }
            .take(MAX_REFERENCE_IMAGES)

        val item = buildItem(
            page = page,
            title = storyPayload.title,
            synopsis = storyPayload.synopsis,
            children = children,
            companions = companions,
            referenceImageS3Keys = s3Keys,
            stylePreset = stylePreset?.code,
            stylePreviewUrl = stylePreset?.previewUrl,
            userPromptOverride = null, // userPrompt 는 payload 의 별도 필드로 보낸다 (additionalInstruction X)
        )

        val seed = deterministicSeed(storyId)
        val trimmedUserPrompt = userPrompt.trim()
        if (trimmedUserPrompt.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val payload = StoryboardImageRegeneratePayload(
            storyId = storyId,
            seed = seed,
            userPrompt = trimmedUserPrompt,
            item = item,
        )

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_IMAGE,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(payload),
            ),
        )

        val envelope = StoryboardImageRegenerateMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.IMAGE_REGENERATE,
            envelope,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_IMAGE.name,
            status = JobStatus.PENDING.name,
        )
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    private fun buildItem(
        page: StoryboardPage,
        title: String,
        synopsis: String,
        children: List<ChildInfo>,
        companions: List<String>,
        referenceImageS3Keys: List<String>,
        stylePreset: String?,
        stylePreviewUrl: String?,
        userPromptOverride: String?,
    ): StoryboardImageItem {
        // AI 측 min_length=1 — 빈 문자열로 보내면 422. listener 가 정상 채웠다면 null/blank 가 아니어야 함.
        val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val englishText = page.englishText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val koreanText = page.koreanText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        return StoryboardImageItem(
            pageNumber = page.pageNumber,
            storyboard = StoryboardImageContext(title = title, synopsis = synopsis),
            page = StoryboardImagePagePayload(
                pageNumber = page.pageNumber,
                sceneSummary = sceneSummary,
                englishText = englishText,
                koreanText = koreanText,
                imagePrompt = imagePrompt,
            ),
            children = children,
            companions = companions,
            referenceImageS3Keys = referenceImageS3Keys,
            referenceImageUrls = listOfNotNull(stylePreviewUrl),
            stylePreset = stylePreset,
            additionalInstruction = userPromptOverride,
        )
    }

    private data class StylePresetInfo(val code: String, val previewUrl: String?)

    private fun resolveStylePreset(story: Story): StylePresetInfo? =
        story.stylePresetId?.let { id ->
            stylePresetRepository.findById(id).orElse(null)?.let {
                StylePresetInfo(it.code, it.previewUrl)
            }
        }

    private fun loadLastSuccessStoryPayload(storyId: Long): StoryboardPayload {
        val storyJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS,
        ) ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val resultPayloadJson = storyJob.resultPayload
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        return try {
            objectMapper.readValue(resultPayloadJson, StoryboardPayload::class.java)
        } catch (e: Exception) {
            throw BusinessException(CommonErrorCode.INTERNAL_SERVER_ERROR)
        }
    }

    /**
     * storyId 기반 결정적 seed.
     * 같은 스토리는 항상 같은 seed → 페이지 간 화풍 일관성 + 재생성 시도 사이 일관성.
     */
    private fun deterministicSeed(storyId: Long): Int =
        ((storyId * 2654435761L) and 0x7FFFFFFFL).toInt()

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    companion object {
        /** AI 측 referenceImageS3Keys max_length = 3. */
        private const val MAX_REFERENCE_IMAGES = 3
    }
}
