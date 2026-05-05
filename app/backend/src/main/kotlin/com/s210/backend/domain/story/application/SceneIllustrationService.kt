package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.StoryParticipantParser
import com.s210.backend.domain.storyboard.application.pageTexts
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageContext
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageItem
import com.s210.backend.domain.storyboard.application.dto.StoryboardImagePagePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegenerateMessage
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

@Service
@Transactional
class SceneIllustrationService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val photoAlbumItemRepository: PhotoAlbumItemRepository,
    private val stylePresetRepository: StylePresetRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        private const val SCENE_REGEN_LIMIT = 2
        private const val STORY_REGEN_LIMIT = 10
        private const val MAX_REFERENCE_IMAGES = 3
    }

    data class RegenerateResult(val jobId: Long, val status: String = "PENDING")

    data class RollbackResult(val illustrationUrl: String, val version: Int)

    fun regenerateIllustration(
        userId: Long,
        storyId: Long,
        sceneId: Long,
        userPrompt: String,
    ): RegenerateResult {
        val story = ownedStory(userId, storyId)
        val scene = sceneRepository.findByIdAndStoryId(sceneId, storyId)
            ?: throw BusinessException(StoryErrorCode.SCENE_NOT_FOUND)

        val terminalStatuses = listOf(JobStatus.SUCCESS, JobStatus.FAILED)
        val sceneCount = jobRepository.countBySceneIdAndJobTypeAndStatusIn(
            sceneId, JobType.ILLUSTRATION, terminalStatuses,
        )
        if (sceneCount >= SCENE_REGEN_LIMIT) {
            throw BusinessException(StoryErrorCode.REGENERATION_LIMIT_EXCEEDED)
        }
        val storyCount = jobRepository.countByStoryIdAndJobTypeAndStatusIn(
            storyId, JobType.ILLUSTRATION, terminalStatuses,
        )
        if (storyCount >= STORY_REGEN_LIMIT) {
            throw BusinessException(StoryErrorCode.REGENERATION_LIMIT_EXCEEDED)
        }

        val trimmedPrompt = userPrompt.trim()
        if (trimmedPrompt.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val page = storyboardPageRepository.findByStoryBoardIdAndPageNumber(storyBoard.id, scene.pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val storyPayload = loadLastSuccessStoryPayload(storyId)
        val origPage = storyPayload.pages.firstOrNull { it.pageNumber == scene.pageNumber }
        val sourcePhotoIds = origPage?.sourcePhotoIds ?: emptyList()

        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val photoMap = photoAlbumItemRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
            .associateBy { it.id }
        val s3Keys = sourcePhotoIds
            .mapNotNull { photoMap[it.toLong()]?.imageUrl }
            .take(MAX_REFERENCE_IMAGES)

        val styleInfo = story.stylePresetId?.let { id ->
            stylePresetRepository.findById(id).orElse(null)
        }

        val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val texts = page.pageTexts(objectMapper)
        val englishText = texts.englishText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val koreanText = texts.koreanText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val item = StoryboardImageItem(
            pageNumber = scene.pageNumber,
            storyboard = StoryboardImageContext(
                title = story.title ?: storyPayload.title,
                synopsis = story.synopsis ?: storyPayload.synopsis,
            ),
            page = StoryboardImagePagePayload(
                pageNumber = scene.pageNumber,
                sceneSummary = sceneSummary,
                englishText = englishText,
                koreanText = koreanText,
                imagePrompt = imagePrompt,
            ),
            children = children,
            companions = companions,
            referenceImageS3Keys = s3Keys,
            referenceImageUrls = listOfNotNull(styleInfo?.previewUrl),
            stylePreset = styleInfo?.code,
        )

        val seed = ((storyId * 2654435761L) and 0x7FFFFFFFL).toInt()
        // 씬 일러스트 재생성용 outputVersion — AI 워커가 새 versioned S3 키 (`v{N}.png`) 로 저장하도록.
        // 기존 confirm 시점 v1 을 보존하기 위해 항상 (current ?: 1) + 1 로 부여.
        // listener 의 handleSceneImageSuccess 에서 같은 newVersion 으로 Redis push → URL 일관성 유지.
        val nextSceneVersion = (illustrationVersionRedisRepository.getCurrent(sceneId) ?: 1) + 1
        val payload = StoryboardImageRegeneratePayload(
            storyId = storyId,
            seed = seed,
            userPrompt = trimmedPrompt,
            outputVersion = nextSceneVersion,
            item = item,
        )

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                sceneId = sceneId,
                jobType = JobType.ILLUSTRATION,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(payload),
            ),
        )

        val envelope = StoryboardImageRegenerateMessage(
            jobId = job.id.toString(),
            jobType = "ILLUSTRATION",
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.IMAGE_REGENERATE,
            envelope,
        )

        log.info(
            "Scene illustration regenerate job {} — storyId={}, sceneId={}, pageNumber={}",
            job.id, storyId, sceneId, scene.pageNumber,
        )
        return RegenerateResult(jobId = job.id)
    }

    @Transactional
    fun rollbackIllustration(userId: Long, storyId: Long, sceneId: Long): RollbackResult {
        ownedStory(userId, storyId)
        val scene = sceneRepository.findByIdAndStoryId(sceneId, storyId)
            ?: throw BusinessException(StoryErrorCode.SCENE_NOT_FOUND)

        val versions: List<String>
        val currentVersion: Int
        try {
            versions = illustrationVersionRedisRepository.listVersions(sceneId)
            currentVersion = illustrationVersionRedisRepository.getCurrent(sceneId) ?: 1
        } catch (e: Exception) {
            log.warn("Redis unavailable for rollback sceneId={}: {}", sceneId, e.message)
            throw BusinessException(StoryErrorCode.ROLLBACK_UNAVAILABLE)
        }

        if (versions.isEmpty()) throw BusinessException(StoryErrorCode.NOTHING_TO_ROLLBACK)

        val prevVersion = currentVersion - 1
        if (prevVersion < 1) throw BusinessException(StoryErrorCode.NOTHING_TO_ROLLBACK)

        val prevUrl = versions.mapNotNull { json ->
            try {
                val node = objectMapper.readTree(json)
                val ver = node.get("version")?.asInt()
                val url = node.get("url")?.asString()
                if (ver == prevVersion && url != null) url else null
            } catch (_: Exception) { null }
        }.firstOrNull() ?: throw BusinessException(StoryErrorCode.NOTHING_TO_ROLLBACK)

        scene.illustrationUrl = prevUrl
        illustrationVersionRedisRepository.setCurrent(sceneId, prevVersion)

        log.info("Scene illustration rollback — sceneId={}, v{} → v{}", sceneId, currentVersion, prevVersion)
        return RollbackResult(illustrationUrl = prevUrl, version = prevVersion)
    }

    private fun loadLastSuccessStoryPayload(storyId: Long): StoryboardPayload {
        val storyJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY,
            status = JobStatus.SUCCESS,
        ) ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val resultPayloadJson = storyJob.resultPayload
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        return objectMapper.readValue(resultPayloadJson, StoryboardPayload::class.java)
    }

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }
}
