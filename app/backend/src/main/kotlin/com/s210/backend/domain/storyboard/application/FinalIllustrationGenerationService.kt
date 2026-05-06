package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationContext
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGenerateMessage
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationItem
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationJobMeta
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationPagePayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardPayload
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

/**
 * Step 5 (PATCH /stories/{id}/style) 시점에 호출되는 최종 컬러 일러스트 enqueue.
 * 사용자가 보이스 클론/강조 녹음(Step 6,7) 진행 중 백그라운드로 미리 생성한다.
 *
 * 멱등 가드: 같은 stylePresetId 의 직전 FINAL 잡이 PENDING/RUNNING/SUCCESS 면
 * enqueue 스킵하고 기존 jobId 반환.
 */
@Service
@Transactional
class FinalIllustrationGenerationService(
    private val storyRepository: StoryRepository,
    private val stylePresetRepository: StylePresetRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {

    /**
     * @return enqueue 된 (또는 멱등 재사용된) 잡 id.
     */
    fun enqueue(storyId: Long, stylePresetId: Long): Long {
        val story = storyRepository.findByIdForUpdate(storyId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)

        // 1) 멱등 가드.
        val stylePreset = stylePresetRepository.findById(stylePresetId).orElseThrow {
            BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        }

        val stylePrompt = stylePreset.stylePrompt.trim().takeIf { it.isNotEmpty() } ?: stylePreset.code

        findReusableJob(storyId, stylePresetId, stylePrompt)?.let { return it.id }

        // 2) storyboard_pages 가 채워져 있어야 함.
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        if (pages.size > MAX_ITEMS) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        if (pages.any { it.imageUrl.isNullOrBlank() }) {
            throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)
        }

        // 3) STORY 잡에서 영문 title/synopsis 재사용.
        val storyPayload = loadLastSuccessStoryPayload(storyId)

        // 4) children / companions 파싱.
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        // 5) 페이지별 item 조립 (page 0 = 표지는 별도 처리).
        val items = pages.map { page ->
            if (page.pageNumber == 0) {
                // 표지: 텍스트 없이 storyboard 이미지 + 컨텍스트만 전달.
                val nonBlankImageUrl = page.imageUrl?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)
                FinalIllustrationItem(
                    pageNumber = 0,
                    storyboard = FinalIllustrationContext(
                        title = storyPayload.title,
                        synopsis = storyPayload.synopsis,
                    ),
                    page = FinalIllustrationPagePayload(pageNumber = 0),
                    children = children,
                    companions = companions,
                    roughStoryboardImageUrl = nonBlankImageUrl,
                    stylePrompt = stylePrompt,
                    additionalInstruction = "This is the front cover, not an interior page.",
                    outputVersion = 1,
                )
            } else {
                val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
                val texts = page.pageTexts(objectMapper)
                val englishText = texts.englishText?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
                val koreanText = texts.koreanText?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
                val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
                val nonBlankImageUrl = page.imageUrl?.takeIf { it.isNotBlank() }
                    ?: throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)

                FinalIllustrationItem(
                    pageNumber = page.pageNumber,
                    storyboard = FinalIllustrationContext(
                        title = storyPayload.title,
                        synopsis = storyPayload.synopsis,
                    ),
                    page = FinalIllustrationPagePayload(
                        pageNumber = page.pageNumber,
                        sceneSummary = sceneSummary,
                        englishText = englishText,
                        koreanText = koreanText,
                        imagePrompt = imagePrompt,
                    ),
                    children = children,
                    companions = companions,
                    roughStoryboardImageUrl = nonBlankImageUrl,
                    stylePrompt = stylePrompt,
                    additionalInstruction = null,
                    outputVersion = 1,
                )
            }
        }

        val seed = deterministicSeed(storyId)
        val payload = FinalIllustrationGeneratePayload(
            storyId = storyId,
            seed = seed,
            items = items,
        )

        // 7) Job INSERT.
        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.FINAL_ILLUSTRATION,
                status = JobStatus.PENDING,
                requestPayload = objectMapper.writeValueAsString(
                    FinalIllustrationJobMeta(stylePresetId, payload),
                ),
            ),
        )

        // 8) MQ publish.
        val envelope = FinalIllustrationGenerateMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.FINAL_ILLUSTRATION_GENERATE,
            envelope,
        )

        return job.id
    }

    /**
     * 같은 storyId + JobType.FINAL_ILLUSTRATION 의 최근 잡이
     * PENDING/RUNNING/SUCCESS 이고 requestPayload.stylePresetId 가 같으면 재사용.
     */
    private fun findReusableJob(storyId: Long, stylePresetId: Long, stylePrompt: String): StoryGenerationJob? {
        val recent = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.FINAL_ILLUSTRATION,
        ) ?: return null
        if (recent.status !in REUSABLE_STATUSES) return null
        return if (requestMatchesStyle(recent.requestPayload, stylePresetId, stylePrompt)) recent else null
    }

    private fun requestMatchesStyle(requestPayload: String?, stylePresetId: Long, stylePrompt: String): Boolean {
        if (requestPayload.isNullOrBlank()) return false
        return try {
            val root = objectMapper.readTree(requestPayload)

            val savedStylePresetId = root.get("stylePresetId")?.asLong()
            if (savedStylePresetId == stylePresetId) return true

            val items = root.path("payload").path("items")
            if (!items.isArray) return false

            var hasItems = false
            for (item in items) {
                hasItems = true
                if (item.get("stylePrompt")?.asText() != stylePrompt) return false
            }
            hasItems
        } catch (_: Exception) {
            false
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

    private fun deterministicSeed(storyId: Long): Int =
        ((storyId * 2654435761L) and 0x7FFFFFFFL).toInt()

    companion object {
        private const val MAX_ITEMS = 20
        /**
         * SUCCESS 도 포함하는 이유: 같은 stylePresetId 재선택 시 이미 끝난 결과를 그대로 사용한다
         * (재생성 비용 0). 다른 stylePresetId 면 가드를 통과해 새 잡이 만들어진다.
         */
        private val REUSABLE_STATUSES = setOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS)
    }
}
