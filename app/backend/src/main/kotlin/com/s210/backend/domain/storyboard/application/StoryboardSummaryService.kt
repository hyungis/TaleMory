package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.storyboard.application.dto.PhotoInput
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.application.dto.StoryGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StorySummaryGenerateJobMessage
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.StorySummaryRegenerateJobMessage
import com.s210.backend.domain.storyboard.application.dto.StorySummaryRegeneratePayload
import com.s210.backend.domain.storyboard.application.dto.SummaryMeta
import com.s210.backend.domain.storyboard.application.dto.TravelInfo
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 스토리보드 줄거리(요약) 잡 발행 + 조회 유스케이스.
 *
 * - `POST /summary`           → 줄거리 생성 잡 발행
 * - `POST /summary/regenerate` → 직전 SUCCESS payload 기반 재생성 잡 발행
 * - `GET  /summary`            → 가장 최근 잡 status + 줄거리 데이터 조회
 *
 * MQ publish / Job INSERT 패턴은 `StoryboardGenerationService` 와 동일.
 * AI envelope 의 jobId 는 DB PK 를 string 화해 전달한다.
 */
@Service
@Transactional
class StoryboardSummaryService(
    private val rabbitTemplate: RabbitTemplate,
    private val jobRepository: StoryGenerationJobRepository,
    private val storyRepository: StoryRepository,
    private val photoRepository: PhotoAlbumItemRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 줄거리(요약) 생성 잡 발행.
     *
     * 1) Story 존재 + 소유권 검증
     * 2) Story 의 여행지/사진/주인공 정보로 `StoryGeneratePayload` 구성
     * 3) `story_generation_jobs` INSERT (jobType=STORYBOARD_STORY_SUMMARY, status=PENDING) +
     *    requestPayload 직렬화 저장
     * 4) `StorySummaryGenerateJobMessage` envelope publish → `ai.cpu.story.summary.generate`
     */
    fun generateSummary(userId: Long, storyId: Long, prompt: String?): StartGenerationResult {
        log.info(
            "[SUMMARY:GEN] entry — userId={}, storyId={}, hasPrompt={}",
            userId, storyId, !prompt.isNullOrBlank(),
        )
        val story = ownedStory(userId, storyId)

        // 활성 본문 잡(STORY) 이 PENDING/RUNNING 이면 줄거리 새로 생성 거부.
        // 진행 중인 본문이 stale grounding 을 받지 않도록 차단 + sessionStorage 비어 락이 풀린
        // 엣지케이스(탭 닫고 재진입)에서도 BE 가 단단히 막아준다.
        val activeStoryJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeStoryJob != null) {
            log.warn("[SUMMARY:GEN] blocked — active story job exists jobId={}", activeStoryJob.id)
            throw BusinessException(StoryErrorCode.STORY_ALREADY_IN_PROGRESS)
        }

        val payload = buildPayload(story, prompt)
        val requestPayloadJson = objectMapper.writeValueAsString(payload)

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_STORY_SUMMARY,
                status = JobStatus.PENDING,
                requestPayload = requestPayloadJson,
            ),
        )

        val envelope = StorySummaryGenerateJobMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.STORY_SUMMARY_GENERATE,
            envelope,
        )
        log.info(
            "[SUMMARY:GEN] published — jobId={}, storyId={}, routingKey={}, photos={}, children={}",
            job.id, storyId, RoutingKeys.STORY_SUMMARY_GENERATE,
            payload.photos.size, payload.children.size,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_STORY_SUMMARY.name,
            status = JobStatus.PENDING.name,
        )
    }

    /**
     * 줄거리(요약) 재생성 잡 발행.
     *
     * 1) Story 존재 + 소유권 검증
     * 2) 직전 SUCCESS 줄거리 잡 조회 — 없으면 SUMMARY_NOT_FOUND (D5-A 정책).
     * 3) 직전 result_payload 를 `StorySummaryPayload` 로 deserialize.
     * 4) 새 PENDING 잡 저장 (requestPayload 에 직전 payload + userPrompt 동봉).
     * 5) `StorySummaryRegenerateJobMessage` envelope publish → `ai.cpu.story.summary.regenerate`.
     */
    fun regenerateSummary(userId: Long, storyId: Long, userPrompt: String): StartGenerationResult {
        log.info(
            "[SUMMARY:REGEN] entry — userId={}, storyId={}, promptLen={}",
            userId, storyId, userPrompt.length,
        )
        val story = ownedStory(userId, storyId)

        // 활성 본문 잡(STORY) 이 PENDING/RUNNING 이면 줄거리 재생성 거부 (generateSummary 와 동일 정책).
        val activeStoryJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeStoryJob != null) {
            log.warn("[SUMMARY:REGEN] blocked — active story job exists jobId={}", activeStoryJob.id)
            throw BusinessException(StoryErrorCode.STORY_ALREADY_IN_PROGRESS)
        }

        val previousJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY_SUMMARY,
            status = JobStatus.SUCCESS,
        ) ?: throw BusinessException(StoryErrorCode.SUMMARY_NOT_FOUND)

        val previousResultJson = previousJob.resultPayload
            ?: throw BusinessException(StoryErrorCode.SUMMARY_NOT_FOUND)
        val previousSummary = objectMapper.readValue(
            previousResultJson,
            StorySummaryPayload::class.java,
        )

        // 재생성에도 OpenAI 컨텍스트(children/photos/travel)는 generate 와 동일하게 필요.
        // AI 의 StoryboardSummaryRegenerateRequest 가 StoryboardSummaryGenerateRequest 를 상속하므로
        // 같은 grounding fields 를 요구한다.
        val basePayload = buildPayload(story, prompt = null)

        val payload = StorySummaryRegeneratePayload(
            children = basePayload.children,
            companions = basePayload.companions,
            travel = basePayload.travel,
            photos = basePayload.photos,
            difficulty = basePayload.difficulty,
            additionalInstruction = basePayload.additionalInstruction,
            previousSummary = SummaryMeta(
                title = previousSummary.title,
                summary = previousSummary.summary,
                summaryKo = previousSummary.summaryKo,
                moralTheme = previousSummary.moralTheme,
                storyQuest = previousSummary.storyQuest,
                recurringMotif = previousSummary.recurringMotif,
                keyEmotionalBeats = previousSummary.keyEmotionalBeats,
            ),
            userPrompt = userPrompt,
        )

        // requestPayload: 재생성 재현성을 위해 envelope payload 통째로 보관.
        val requestPayloadJson = objectMapper.writeValueAsString(payload)

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_STORY_SUMMARY,
                status = JobStatus.PENDING,
                requestPayload = requestPayloadJson,
            ),
        )

        val envelope = StorySummaryRegenerateJobMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.STORY_SUMMARY_REGENERATE,
            envelope,
        )
        log.info(
            "[SUMMARY:REGEN] published — jobId={}, storyId={}, prevSummaryJobId={}, routingKey={}",
            job.id, storyId, previousJob.id, RoutingKeys.STORY_SUMMARY_REGENERATE,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_STORY_SUMMARY.name,
            status = JobStatus.PENDING.name,
        )
    }

    /**
     * `GET /summary` 응답 데이터 조회 (AC7).
     *
     * 가장 최근 STORYBOARD_STORY_SUMMARY 잡(status 무관) 1건을 보고 5케이스로 분기:
     *  1) 잡이 아예 없음 → `(null, null, null)`
     *  2) PENDING/RUNNING/CANCELLED → `(null, status, jobId)`
     *  3) SUCCESS → SUMMARY 잡의 `result_payload` JSON 에서 `summaryKo` 추출
     *  4) FAILED → 직전 SUCCESS 잡의 result_payload 에서 `summaryKo` 추출 (fallback)
     *
     * ⚠️ `story_boards.story` 컬럼은 STORY 본문 SUCCESS 시 페이지별 한글 본문이 합쳐져
     *    덮어쓰이므로, 거기서 읽으면 줄거리가 아니라 "본문 합친 것" 이 반환된다.
     *    → SUMMARY 의 진실원은 SUMMARY 잡 자신의 result_payload (StorySummaryPayload JSON).
     */
    @Transactional(readOnly = true)
    fun findSummary(userId: Long, storyId: Long): SummaryResponseData {
        ownedStory(userId, storyId)

        val latestJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY_SUMMARY,
        ) ?: return SummaryResponseData(summaryKo = null, jobStatus = null, jobId = null)

        val jobIdStr = latestJob.id.toString()
        return when (latestJob.status) {
            JobStatus.PENDING, JobStatus.RUNNING, JobStatus.CANCELLED ->
                SummaryResponseData(
                    summaryKo = null,
                    jobStatus = latestJob.status.name,
                    jobId = jobIdStr,
                )
            JobStatus.SUCCESS ->
                SummaryResponseData(
                    summaryKo = extractSummaryKo(latestJob.resultPayload),
                    jobStatus = JobStatus.SUCCESS.name,
                    jobId = jobIdStr,
                )
            JobStatus.FAILED -> {
                // 직전 SUCCESS 잡이 있다면 그 잡의 result_payload 에서 한글 요약을 추출해 함께 반환.
                val previousSuccess = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                    storyId = storyId,
                    jobType = JobType.STORYBOARD_STORY_SUMMARY,
                    status = JobStatus.SUCCESS,
                )
                SummaryResponseData(
                    summaryKo = extractSummaryKo(previousSuccess?.resultPayload),
                    jobStatus = JobStatus.FAILED.name,
                    jobId = jobIdStr,
                )
            }
        }
    }

    /**
     * SUMMARY 잡의 `result_payload` (StorySummaryPayload JSON) 에서 `summaryKo` 만 안전하게 추출.
     * 파싱 실패 시 null 반환 + warn 로그 (조회 실패로 흐름 멈추지 않도록 graceful degrade).
     */
    private fun extractSummaryKo(resultPayload: String?): String? {
        if (resultPayload.isNullOrBlank()) return null
        return runCatching {
            objectMapper.readValue(resultPayload, StorySummaryPayload::class.java).summaryKo
        }.getOrElse { e ->
            log.warn("Failed to parse StorySummaryPayload from resultPayload: {}", e.message)
            null
        }
    }

    /** Story payload 빌더 — `StoryboardGenerationService.generate` 와 동일 로직. */
    private fun buildPayload(story: Story, prompt: String?): StoryGeneratePayload {
        val travelPlace = story.travelPlace?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val photos = photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(story.id)
        if (photos.size !in PHOTO_COUNT_MIN..PHOTO_COUNT_MAX) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        return StoryGeneratePayload(
            children = children,
            companions = companions,
            travel = TravelInfo(
                place = travelPlace,
                startDate = story.travelStartDate?.toString(),
                endDate = story.travelEndDate?.toString(),
            ),
            photos = photos.map { photo ->
                PhotoInput(
                    photoId = photo.id,
                    s3Key = photo.imageUrl,
                    description = photo.description?.takeIf { it.isNotBlank() }
                        ?: DEFAULT_PHOTO_DESCRIPTION,
                    hashtags = parseHashtags(photo.tagsJson),
                    displayOrder = (photo.displayOrder + 1).toInt(),
                )
            },
            difficulty = story.difficulty.name,
            additionalInstruction = prompt?.trim()?.takeIf { it.isNotEmpty() },
        )
    }

    private fun parseHashtags(tagsJson: String?): List<String> {
        if (tagsJson.isNullOrBlank()) return emptyList()
        val root = parseTreeOrNull(tagsJson) ?: return emptyList()
        return when {
            root.isString -> splitFreeText(root.asString()).map { it.removePrefix("#") }
            root.isArray -> root.mapNotNull {
                it.takeIf(JsonNode::isString)?.asString()?.trim()?.takeIf { s -> s.isNotEmpty() }
            }
            else -> emptyList()
        }
    }

    private fun parseTreeOrNull(json: String): JsonNode? =
        if (json.isBlank()) null
        else try { objectMapper.readTree(json) } catch (_: Exception) { null }

    private fun splitFreeText(raw: String): List<String> =
        raw.split(",", ";", " ")
            .mapNotNull { it.trim().takeIf { t -> t.isNotEmpty() } }

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    companion object {
        private const val DEFAULT_PHOTO_DESCRIPTION = "사진"
        // NOTE: dev/prod 배포 전에 반드시 10 으로 되돌릴 것 (기존 generation service 와 동일).
        private const val PHOTO_COUNT_MIN = 1
        private const val PHOTO_COUNT_MAX = 30
    }
}

/**
 * `GET /api/stories/{storyId}/storyboard/summary` 응답 데이터.
 *
 * - `summaryKo`: 한글 요약. 미생성/실패 시 null.
 * - `jobStatus`: 가장 최근 줄거리 잡 status (PENDING/RUNNING/SUCCESS/FAILED). 잡 없으면 null.
 * - `jobId`:     가장 최근 줄거리 잡 PK 의 string 표현. 잡 없으면 null.
 */
data class SummaryResponseData(
    val summaryKo: String?,
    val jobStatus: String?,
    val jobId: String?,
)
