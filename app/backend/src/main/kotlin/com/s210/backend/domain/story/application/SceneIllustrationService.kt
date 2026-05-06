package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.storyboard.application.StoryParticipantParser
import com.s210.backend.domain.storyboard.application.pageTexts
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationContext
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationItem
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationPagePayload
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationReviseMessage
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationRevisePayload
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
    private val stylePresetRepository: StylePresetRepository,
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
    private val s3Service: S3Service,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        // Step 8 (FinalPreviewStep) 에서 동화 한 권당 최종 삽화 재생성 총합 한도.
        // 페이지별이 아니라 동화 전체 합산 — 사용자가 어떤 페이지를 몇 번 재생성하든 총 3회까지.
        private const val STORY_REGEN_LIMIT = 3
        private val S3_KEY_PATTERN = Regex("^([a-z][a-z0-9-]*/)?stories/")
    }

    data class RegenerateResult(val jobId: Long, val status: String = "PENDING")

    data class RollbackResult(val illustrationUrl: String, val version: Int)

    data class VersionEntry(
        val version: Int,
        val url: String,
        val prompt: String?,
        val createdAt: String?,
        val jobId: Long?,
    )

    data class VersionsResult(
        val storyId: Long,
        val sceneId: Long,
        val current: Int?,
        val versions: List<VersionEntry>,
    )

    data class RegenStatusResult(
        val storyId: Long,
        val used: Int,
        val limit: Int,
        val remaining: Int,
    )

    fun regenerateIllustration(
        userId: Long,
        storyId: Long,
        sceneId: Long,
        userPrompt: String,
    ): RegenerateResult {
        val story = ownedStory(userId, storyId)
        val scene = sceneRepository.findByIdAndStoryId(sceneId, storyId)
            ?: throw BusinessException(StoryErrorCode.SCENE_NOT_FOUND)

        val countedStatuses = listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS, JobStatus.FAILED)
        // 동화 전체 합산 한도 — 페이지별 한도는 두지 않고 사용자가 자유롭게 분배해서 쓸 수 있게 한다.
        val storyCount = jobRepository.countByStoryIdAndJobTypeAndStatusIn(
            storyId, JobType.ILLUSTRATION, countedStatuses,
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
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val styleInfo = story.stylePresetId?.let { id ->
            stylePresetRepository.findById(id).orElse(null)
        } ?: throw BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        val stylePrompt = styleInfo.stylePrompt.trim().takeIf { it.isNotEmpty() } ?: styleInfo.code

        val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val texts = page.pageTexts(objectMapper)
        val englishText = texts.englishText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val koreanText = texts.koreanText?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val currentIllustration = scene.illustrationUrl?.takeIf { it.isNotBlank() }
        val roughStoryboard = page.imageUrl?.takeIf { it.isNotBlank() }
        val referenceImage = currentIllustration ?: roughStoryboard
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val currentIllustrationS3Key = currentIllustration
            ?.let(s3Service::extractS3Key)
            ?.takeIf(::looksLikeS3Key)
        val roughStoryboardS3Key = roughStoryboard
            ?.let(s3Service::extractS3Key)
            ?.takeIf(::looksLikeS3Key)
        val roughStoryboardReferenceUrl = when {
            currentIllustration != null && currentIllustrationS3Key == null -> currentIllustration
            currentIllustrationS3Key != null -> null
            roughStoryboardS3Key == null -> referenceImage.takeUnless(::looksLikeS3Key)
            else -> null
        }
        val nextVersion = illustrationVersionRedisRepository.computeNextVersion(sceneId)
        val item = FinalIllustrationItem(
            pageNumber = scene.pageNumber,
            storyboard = FinalIllustrationContext(
                title = story.title ?: storyPayload.title,
                synopsis = story.synopsis ?: storyPayload.synopsis,
            ),
            page = FinalIllustrationPagePayload(
                pageNumber = scene.pageNumber,
                sceneSummary = sceneSummary,
                englishText = englishText,
                koreanText = koreanText,
                imagePrompt = imagePrompt,
            ),
            children = children,
            companions = companions,
            roughStoryboardImageUrl = roughStoryboardReferenceUrl,
            roughStoryboardImageS3Key = roughStoryboardS3Key,
            currentIllustrationImageS3Key = currentIllustrationS3Key,
            stylePrompt = stylePrompt,
            outputVersion = nextVersion,
        )

        val seed = ((storyId * 2654435761L) and 0x7FFFFFFFL).toInt()
        // 씬 일러스트 재생성용 outputVersion — AI 워커가 새 versioned S3 키 (`v{N}.png`) 로 저장하도록.
        // 기존 confirm 시점 v1 을 보존하기 위해 항상 (current ?: 1) + 1 로 부여.
        // listener 의 handleSceneImageSuccess 에서 같은 newVersion 으로 Redis push → URL 일관성 유지.
        val payload = FinalIllustrationRevisePayload(
            storyId = storyId,
            seed = seed,
            userPrompt = trimmedPrompt,
            item = item,
        )

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                sceneId = sceneId,
                jobType = JobType.ILLUSTRATION,
                status = JobStatus.PENDING,
            ),
        )

        val publishEnvelope = FinalIllustrationReviseMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        job.requestPayload = objectMapper.writeValueAsString(publishEnvelope)
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.FINAL_ILLUSTRATION_REVISE,
            publishEnvelope,
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

    @Transactional(readOnly = true)
    fun listVersions(userId: Long, storyId: Long, sceneId: Long): VersionsResult {
        ownedStory(userId, storyId)
        sceneRepository.findByIdAndStoryId(sceneId, storyId)
            ?: throw BusinessException(StoryErrorCode.SCENE_NOT_FOUND)

        val versions = illustrationVersionRedisRepository.listVersions(sceneId)
            .mapNotNull(::parseVersionEntry)
            .distinctBy { it.version }
            .sortedByDescending { it.version }

        return VersionsResult(
            storyId = storyId,
            sceneId = sceneId,
            current = illustrationVersionRedisRepository.getCurrent(sceneId),
            versions = versions,
        )
    }

    fun selectVersion(userId: Long, storyId: Long, sceneId: Long, version: Int): RollbackResult {
        ownedStory(userId, storyId)
        val scene = sceneRepository.findByIdAndStoryId(sceneId, storyId)
            ?: throw BusinessException(StoryErrorCode.SCENE_NOT_FOUND)
        if (version < 1) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val selected = illustrationVersionRedisRepository.listVersions(sceneId)
            .mapNotNull(::parseVersionEntry)
            .firstOrNull { it.version == version }
            ?: throw BusinessException(StoryErrorCode.NOTHING_TO_ROLLBACK)

        scene.illustrationUrl = selected.url
        illustrationVersionRedisRepository.setCurrent(sceneId, version)
        return RollbackResult(illustrationUrl = selected.url, version = version)
    }

    @Transactional(readOnly = true)
    fun getRegenStatus(userId: Long, storyId: Long): RegenStatusResult {
        ownedStory(userId, storyId)
        val used = jobRepository.countByStoryIdAndJobTypeAndStatusIn(
            storyId,
            JobType.ILLUSTRATION,
            listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS, JobStatus.FAILED),
        ).toInt()
        return RegenStatusResult(
            storyId = storyId,
            used = used,
            limit = STORY_REGEN_LIMIT,
            remaining = (STORY_REGEN_LIMIT - used).coerceAtLeast(0),
        )
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

    private fun looksLikeS3Key(value: String): Boolean {
        if (value.startsWith("http://") || value.startsWith("https://")) return false
        return S3_KEY_PATTERN.containsMatchIn(value)
    }

    private fun parseVersionEntry(json: String): VersionEntry? {
        return try {
            val node = objectMapper.readTree(json)
            val version = node.get("version")?.asInt() ?: return null
            val url = node.get("url")?.asString()?.takeIf { it.isNotBlank() } ?: return null
            VersionEntry(
                version = version,
                url = url,
                prompt = node.get("prompt")?.asString(),
                createdAt = node.get("createdAt")?.asString(),
                jobId = node.get("jobId")?.asLong(),
            )
        } catch (_: Exception) {
            null
        }
    }

}
