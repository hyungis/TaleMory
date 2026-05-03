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
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)

        // 1) 멱등 가드.
        findReusableJob(storyId, stylePresetId)?.let { return it.id }

        val stylePreset = stylePresetRepository.findById(stylePresetId).orElseThrow {
            BusinessException(StoryErrorCode.STYLE_PRESET_NOT_FOUND)
        }

        // 2) storyboard_pages 가 채워져 있어야 함.
        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        if (pages.any { it.imageUrl.isNullOrBlank() }) {
            throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)
        }

        // 3) STORY 잡에서 영문 title/synopsis 재사용.
        val storyPayload = loadLastSuccessStoryPayload(storyId)

        // 4) children / companions 파싱.
        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        // 5) 페이지별 item 조립.
        val items = pages.map { page ->
            val sceneSummary = page.sceneSummary?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val englishText = page.englishText?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val koreanText = page.koreanText?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
            val imagePrompt = page.imagePrompt?.takeIf { it.isNotBlank() }
                ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

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
                roughStoryboardImageUrl = page.imageUrl,
                stylePrompt = stylePreset.code,
                additionalInstruction = null,
            )
        }

        // 6) max_items 가드.
        if (items.size > MAX_ITEMS) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
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
                    mapOf(
                        "stylePresetId" to stylePresetId,
                        "payload" to payload,
                    ),
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
    private fun findReusableJob(storyId: Long, stylePresetId: Long): StoryGenerationJob? {
        val recent = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.FINAL_ILLUSTRATION,
        ) ?: return null
        if (recent.status !in REUSABLE_STATUSES) return null
        val savedStylePresetId = try {
            val node = objectMapper.readTree(recent.requestPayload)
            node.get("stylePresetId")?.asLong() ?: return null
        } catch (e: Exception) {
            return null
        }
        return if (savedStylePresetId == stylePresetId) recent else null
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
        private val REUSABLE_STATUSES = setOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS)
    }
}
