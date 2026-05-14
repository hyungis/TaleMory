package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.codec.JobId
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
import com.s210.backend.domain.story.model.PhotoPurpose
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
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
    private val pageVersionRepository: StoryboardPageImageVersionRedisRepository,
    private val storyboardEditGuard: StoryboardEditGuard,
) {

    fun generate(userId: Long, storyId: Long): StartGenerationResult {
        val story = ownedStory(userId, storyId)
        storyboardEditGuard.assertEditable(story)
        assertNoActiveTranslationJob(storyId)
        val stylePreset = resolveStylePreset(story)

        // 1) storyboard_pages 가 채워져 있어야 한다 (P2 listener 가 STORY 결과 받을 때 INSERT).
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        // 표지(page 0) row 가 없으면 생성 — AI STORY 잡은 page 1..N 만 만들므로 여기서 보장.
        if (pages.none { it.pageNumber == 0 }) {
            storyboardPageRepository.save(
                StoryboardPage(
                    storyBoardId = storyBoard.id,
                    pageNumber = 0,
                ),
            )
        }

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

        // 5) 페이지별 item 조립 (page 0 = 표지는 별도 처리).
        val contentPages = pages.filter { it.pageNumber != 0 }
        val items = mutableListOf<StoryboardImageItem>()

        // 표지(page 0) item — 텍스트 없이 컨텍스트만 전달.
        items.add(
            StoryboardImageItem(
                pageNumber = 0,
                storyboard = StoryboardImageContext(title = storyPayload.title, synopsis = storyPayload.synopsis),
                page = StoryboardImagePagePayload(pageNumber = 0),
                children = children,
                companions = companions,
                referenceImageS3Keys = emptyList(),
                additionalInstruction = "This is the front cover, not an interior page.",
            ),
        )

        // 본문 페이지 items.
        contentPages.forEach { page ->
            val s3Keys = (sourcePhotoIdsByPage[page.pageNumber] ?: emptyList())
                .mapNotNull { photoMap[it.toLong()]?.imageUrl }
                .take(MAX_REFERENCE_IMAGES)
            items.add(
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
                ),
            )
        }

        // Step 2 에서 사용자가 "대표 사진" 으로 마킹한 사진 (max 3) 을 AI reference 베이스로 전달.
        // AI 워커가 이 사진들로 reference.png 를 한 번 만들어 모든 페이지 generate 의 캐릭터 baseline
        // 으로 사용. 보통 Step 3 진입 검증 (StoryboardSummaryService.requireCharacterRefAtLeastOne)
        // 으로 ≥ 1 보장되지만, 사용자가 Step 3 통과 후 Step 2 로 돌아가 reference 를 모두 지웠을
        // 가능성 방어용 안전망 검증을 여기 한 번 더 둔다 (lock 은 첫 generate 후에 걸리므로 그 전엔 변경 가능).
        val characterSourceS3Keys = photoRepository
            .findAllByStoryIdAndPurposeInAndDeletedAtIsNullOrderByDisplayOrderAsc(
                storyId,
                listOf(PhotoPurpose.CHARACTER_REF, PhotoPurpose.BOTH),
            )
            .take(MAX_CHARACTER_SOURCE_IMAGES)
            .map { it.imageUrl }
        if (characterSourceS3Keys.isEmpty()) {
            throw BusinessException(StoryErrorCode.CHARACTER_PHOTOS_REQUIRED)
        }

        val seed = deterministicSeed(storyId)
        val payload = StoryboardImageGeneratePayload(
            storyId = storyId,
            seed = seed,
            characterSourceImageS3Keys = characterSourceS3Keys,
            items = items,
        )

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
            storyMode = story.mode.name,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.IMAGE_GENERATE,
            envelope,
        )

        return StartGenerationResult(
            jobId = JobId(job.id),
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
        storyboardEditGuard.assertEditable(story)
        assertNoActiveTranslationJob(storyId)
        val stylePreset = resolveStylePreset(story)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        // 1) 한도 검사 — 스토리당 STORYBOARD_IMAGE_REGENERATE 잡 PENDING/RUNNING/SUCCESS/FAILED 합이
        //    한도 이상이면 거부. PENDING/RUNNING 까지 포함하는 이유는 `getRegenStatus` 헤더 카운터가
        //    동일 정책으로 사용자에게 "요청 즉시 차감" 을 보장하기 때문 — 양쪽이 같은 식을 써야
        //    카운터 표시와 한도 검증이 어긋나지 않는다. (배치 첫 생성 STORYBOARD_IMAGE 와 분리된
        //    enum 이라 카운트가 정확.)
        val regenCount = jobRepository.countByStoryIdAndJobTypeAndStatusIn(
            storyId,
            JobType.STORYBOARD_IMAGE_REGENERATE,
            listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS, JobStatus.FAILED),
        )
        if (regenCount >= StoryboardImageRegenPolicy.LIMIT_PER_STORY) {
            throw BusinessException(StoryErrorCode.STORYBOARD_REGEN_LIMIT_EXCEEDED)
        }

        // 2) 동시성 검사 — 같은 스토리에 이미 PENDING/RUNNING 인 재생성 잡이 있으면 거부.
        //    더블클릭 / 다른 탭에서 동시 호출 시 outputVersion / S3 / Redis race 방지.
        val activeJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORYBOARD_IMAGE_REGENERATE,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeJob != null) {
            throw BusinessException(StoryErrorCode.STORY_ALREADY_IN_PROGRESS)
        }

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

        // 3) 다음 outputVersion 계산 — Redis INCR (atomic).
        //    첫 호출 시 max-version 키가 없으면 1 로 init (배치 v1 reserve) 후 INCR → 2 반환.
        //    이후 호출은 3, 4, ... 반환. AI 워커가 v{N}.png 키 suffix 로 사용.
        //    AI 측 스키마는 `payload.outputVersion` (top-level) 로 받으므로 item 내부가 아니라
        //    payload 에 직접 부여.
        val nextVersion = pageVersionRepository.computeNextVersion(page.id)

        val payload = StoryboardImageRegeneratePayload(
            storyId = storyId,
            seed = seed,
            userPrompt = trimmedUserPrompt,
            outputVersion = nextVersion,
            item = item,
        )

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_IMAGE_REGENERATE,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(payload),
            ),
        )

        val envelope = StoryboardImageRegenerateMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            storyMode = story.mode.name,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.IMAGE_REGENERATE,
            envelope,
        )

        return StartGenerationResult(
            jobId = JobId(job.id),
            jobType = JobType.STORYBOARD_IMAGE_REGENERATE.name,
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
        val texts = page.pageTexts(objectMapper)
        val englishText = texts.englishText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val koreanText = texts.koreanText?.takeIf { it.isNotBlank() }
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

    private fun assertNoActiveTranslationJob(storyId: Long) {
        val activeTranslationJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORY_SENTENCE_TRANSLATION,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeTranslationJob != null) {
            throw BusinessException(StoryErrorCode.STORYBOARD_TRANSLATION_IN_PROGRESS)
        }
    }

    companion object {
        /** AI 측 referenceImageS3Keys max_length = 3. */
        private const val MAX_REFERENCE_IMAGES = 3

        /**
         * AI 측 characterSourceImageS3Keys max_length = 3.
         * 사용자가 Step 2 에서 마킹한 "대표 사진" 의 상한과도 일치 (PhotoService.MAX_CHARACTER_PHOTOS).
         */
        private const val MAX_CHARACTER_SOURCE_IMAGES = 3
    }
}
