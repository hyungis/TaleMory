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
import com.s210.backend.domain.storyboard.application.dto.ActiveImageRegenerateJob
import com.s210.backend.domain.storyboard.application.dto.ActiveStoryJob
import com.s210.backend.domain.storyboard.application.dto.ActiveTranslationJob
import com.s210.backend.domain.storyboard.application.dto.LatestImageJob
import com.s210.backend.domain.storyboard.application.dto.StorySentenceTranslationRequestPayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardImageRegeneratePayload
import com.s210.backend.domain.storyboard.application.dto.ChildInfo
import com.s210.backend.domain.storyboard.application.dto.PhotoInput
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.application.dto.StoryBoardResult
import com.s210.backend.domain.storyboard.application.dto.StoryGenerateJobMessage
import com.s210.backend.domain.storyboard.application.dto.StoryGeneratePayload
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.StoryboardStateResult
import com.s210.backend.domain.storyboard.application.dto.SummaryMeta
import com.s210.backend.domain.storyboard.application.dto.TravelInfo
import java.time.LocalDate
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
/**
 * 동화 본문(텍스트) 생성 요청을 MQ 로 비동기 발송하는 유스케이스.
 * API 명세 #28 `POST /api/stories/{storyId}/storyboard/story` 의 서비스 레이어.
 *
 * 실행 흐름:
 *  1. 소유권 검증
 *  2. Story 기본 필드(여행지 등) + 사진 개수(10~30) 검증
 *  3. 사진 목록 로드
 *  4. Story 의 JSON 문자열 필드(mainCharacterJson / companionsJson)를 AI 스키마로 파싱
 *  5. `story_generation_jobs` INSERT (status=PENDING, jobType=STORYBOARD_STORY) → DB PK = jobId
 *  6. envelope 를 ai.request exchange 로 publish (routing key = ai.cpu.story.generate)
 *     - AI 스펙상 envelope.jobId 는 string — DB PK 를 `.toString()` 으로 변환
 *     - AI 내부 jobType 는 "STORY" (AI 팀 스펙 고정값)
 *  7. `{ jobId, jobType, status }` 즉시 응답
 */
@Service
@Transactional
class StoryboardGenerationService(
    private val storyRepository: StoryRepository,
    private val photoRepository: PhotoAlbumItemRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val storyParticipantParser: StoryParticipantParser,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun generate(userId: Long, storyId: Long, prompt: String?): StartGenerationResult {
        log.info(
            "[STORY:GEN] entry — userId={}, storyId={}, hasPrompt={}",
            userId, storyId, !prompt.isNullOrBlank(),
        )
        val story = ownedStory(userId, storyId)

        // [본문 발행 가드 1 — race 차단, plan D7-A]
        // 활성 본문 잡(PENDING/RUNNING) 이 존재하면 즉시 거부 (race 가 더 일찍 cheap 한 fail).
        val activeStoryJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeStoryJob != null) {
            log.warn("[STORY:GEN] blocked — active job exists jobId={}", activeStoryJob.id)
            throw BusinessException(StoryErrorCode.STORY_ALREADY_IN_PROGRESS)
        }

        // [본문 발행 가드 2 — SUMMARY 선결]
        // SUCCESS 줄거리 잡 존재 검증 + result_payload(영문 메타) 로드.
        val summaryJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS,
        ) ?: throw BusinessException(StoryErrorCode.SUMMARY_REQUIRED)
        val summaryPayload = objectMapper.readValue(
            summaryJob.resultPayload!!,
            StorySummaryPayload::class.java,
        )
        // 옵션 ② — 사용자가 Step 3 에서 편집한 한글 줄거리(stories.synopsis)를 우선 source 로.
        // synopsis 가 비어있으면 (옛날 데이터 또는 생성 직후) result_payload.summaryKo 로 fallback.
        // AI 워커는 ApprovedStorySummary.summary 와 .summaryKo 둘 다 required 라 schema 통과를 위해
        // 한글 줄거리를 양쪽 필드에 동일하게 복사 — AI 가 자연스럽게 한글을 ground 로 본문 생성.
        val canonicalSummaryKo = story.synopsis?.takeIf { it.isNotBlank() }
            ?: summaryPayload.summaryKo
        val summaryMeta = SummaryMeta(
            title = summaryPayload.title,
            summary = canonicalSummaryKo,
            summaryKo = canonicalSummaryKo,
            moralTheme = summaryPayload.moralTheme,
            storyQuest = summaryPayload.storyQuest,
            recurringMotif = summaryPayload.recurringMotif,
            keyEmotionalBeats = summaryPayload.keyEmotionalBeats,
        )

        // Step 1 이 완료되지 않은 스토리는 AI 에 유의미한 payload 를 만들 수 없음.
        val travelPlace = story.travelPlace?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(CommonErrorCode.INVALID_INPUT)

        val photos = photoRepository
            .findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId)
        if (photos.size !in PHOTO_COUNT_MIN..PHOTO_COUNT_MAX) {
            // API 명세: 사진은 10~30장 업로드해야 함. PHOTO_COUNT_OUT_OF_RANGE 에러.
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val children = storyParticipantParser.parseChildren(story.mainCharacterJson)
        if (children.isEmpty()) {
            // 주인공 아이 정보 없이는 AI 가 이야기를 만들 수 없음.
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
        val companions = storyParticipantParser.parseCompanions(story.companionsJson)

        val payload = StoryGeneratePayload(
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
                    // Photo 테이블의 imageUrl 컬럼은 실제로는 S3 key 를 저장한다
                    // (addPhoto 시 s3Key 가 그대로 저장됨 — PhotoService 참고).
                    s3Key = photo.imageUrl,
                    description = photo.description?.takeIf { it.isNotBlank() }
                        ?: DEFAULT_PHOTO_DESCRIPTION,
                    hashtags = parseHashtags(photo.tagsJson),
                    // AI 스키마는 1-indexed (ge=1). DB 는 0-indexed 이므로 +1.
                    displayOrder = (photo.displayOrder + 1).toInt(),
                )
            },
            difficulty = story.difficulty.name,
            additionalInstruction = prompt?.trim()?.takeIf { it.isNotEmpty() },
            approvedSummary = summaryMeta,
        )

        // request_payload 컬럼에는 AI 에 보낸 페이로드를 그대로 저장 — 재생성/디버깅/재현성 확보.
        val requestPayloadJson = objectMapper.writeValueAsString(payload)

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.STORYBOARD_STORY,
                status = JobStatus.PENDING,
                requestPayload = requestPayloadJson,
            ),
        )

        // AI 스펙: envelope.jobId 는 string. DB PK 를 문자열화해서 전달.
        val envelope = StoryGenerateJobMessage(
            jobId = job.id.toString(),
            storyId = storyId,
            payload = payload,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.STORY_GENERATE,
            envelope,
        )
        log.info(
            "[STORY:GEN] published — jobId={}, storyId={}, routingKey={}, photos={}, children={}, summarySrcJobId={}",
            job.id, storyId, RoutingKeys.STORY_GENERATE,
            photos.size, children.size, summaryJob.id,
        )

        return StartGenerationResult(
            jobId = job.id,
            jobType = JobType.STORYBOARD_STORY.name,
            status = JobStatus.PENDING.name,
        )
    }

    /**
     * tagsJson 예시:
     *  - `["한라산","등산"]`  — FE 의 태그 편집 UI 최신 포맷
     *  - `"#한라산 #등산"`     — 과거 자유텍스트 입력 호환
     *
     * NOTE: photo 도메인 전용이라 StoryParticipantParser 와 분리. 향후 PhotoService 로 이동 검토.
     */
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

    /**
     * 유저가 Step 3 에서 편집한 한글 줄거리(summary) 를 저장한다 — 옵션 ② 디자인.
     *
     * 두 곳을 sync (단, 잡 결과 페이로드는 immutable 로 보존):
     *  1. `stories.synopsis` (TEXT) — 본문 generate 의 한글 grounding source-of-truth.
     *  2. `story_board.story` (TEXT) — backup 사본.
     *
     * `story_generation_jobs.result_payload` 는 의도적으로 건드리지 않는다.
     * 잡 테이블은 "그 시점 AI 가 만든 것" 의 immutable history 로 두고, 사용자 편집은
     * stories.synopsis 만 진실로 한다 (generate 가 synopsis 를 우선 읽도록 보장).
     *
     * 본문 잡(STORY) 이 PENDING/RUNNING 인 동안에는 줄거리 편집 거부 (STORY_ALREADY_IN_PROGRESS).
     * `updateAt` 을 오늘 날짜로 갱신. 빈 입력 → INVALID_INPUT.
     */
    fun editSummary(userId: Long, storyId: Long, newSummaryKo: String): StoryBoardResult {
        ownedStory(userId, storyId)

        // 활성 본문 잡이 있는 동안엔 줄거리 변경 거부 — 진행 중 본문이 stale grounding 으로 가는 것 차단.
        val activeStoryJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        if (activeStoryJob != null) {
            log.warn("[SUMMARY:EDIT] blocked — active story job exists jobId={}", activeStoryJob.id)
            throw BusinessException(StoryErrorCode.STORY_ALREADY_IN_PROGRESS)
        }

        val storyBoard = storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)

        val trimmed = newSummaryKo.trim()
        if (trimmed.isEmpty()) throw BusinessException(CommonErrorCode.INVALID_INPUT)

        storyBoard.story = trimmed
        storyBoard.updateAt = LocalDate.now()

        storyRepository.findById(storyId).ifPresent { story ->
            story.synopsis = trimmed
        }

        return StoryBoardResult.from(storyBoard)
    }

    /**
     * `GET /storyboard/state` — Step 4 mount 시 본문(STORY) 잡 상태를 한 번에 조회.
     *
     * sessionStorage 가 비어있는 엣지케이스 (탭 닫고 재진입) 에서도 FE 가 정확한 화면을
     * 표시할 수 있도록 활성 잡 / 직전 terminal 상태 / 마지막 SUCCESS 이후 FAILED 카운트 셋
     * 을 묶어서 반환.
     *
     * 카운트 정의 — "마지막 SUCCESS 이후 FAILED" :
     *  - SUCCESS 잡이 한 번이라도 있으면 그 이후의 FAILED 만 카운트
     *  - SUCCESS 가 없으면 누적 FAILED 전부 카운트
     *  → 사용자가 한 번 성공한 뒤 새로 만들기 시도에서 실패한 경우엔 카운터 초기화 효과.
     */
    @Transactional(readOnly = true)
    fun findStoryboardState(userId: Long, storyId: Long): StoryboardStateResult {
        ownedStory(userId, storyId)

        val activeJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )

        // 활성 잡이 있으면 latestFinalStatus 는 의미 없음 → null. failedCount 는 그래도 같이 보내준다
        // (UI 가 활성 잡 polling 중에도 백그라운드로 카운트 표시할 수 있게).
        val lastSuccessJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY, JobStatus.SUCCESS,
        )
        val failedCount = jobRepository.countByStoryIdAndJobTypeAndStatusAndIdGreaterThan(
            storyId, JobType.STORYBOARD_STORY, JobStatus.FAILED, lastSuccessJob?.id ?: 0L,
        )

        val latestFinalStatus = if (activeJob != null) {
            null
        } else {
            // 활성 잡 없을 때만 의미 있음 — 가장 최근 STORY 잡의 status 가 곧 latestFinalStatus.
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY,
            )?.status
        }

        // Step 4 IMAGE 배치 잡 복구 — 가장 최근 STORYBOARD_IMAGE 잡 1건 (status 무관).
        val latestImageJob = jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(
            storyId, JobType.STORYBOARD_IMAGE,
        )?.let { LatestImageJob(jobId = it.id, status = it.status) }

        val activeTranslationJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORY_SENTENCE_TRANSLATION,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )

        // Step 4 IMAGE 재생성 잡 복구 — 진행 중(PENDING/RUNNING) 단일 페이지 재생성 잡 1건.
        // BE 동시성 가드로 한 스토리당 활성 1개만 보장되므로 first 가 유일.
        // pageNumber 는 jobs.requestPayload(JSON) 의 `item.pageNumber` 를 파싱해 내려준다.
        // 파싱 실패 시 null 처리(=잡 없음 효과) — defensive: 옛 데이터 / payload 스키마 변경 방어.
        val activeRegenJob = jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.STORYBOARD_IMAGE_REGENERATE,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )
        val activeImageRegenerateJob = activeRegenJob?.let { job ->
            val pageNumber = parseRegeneratePageNumber(job.requestPayload)
            if (pageNumber == null) null
            else ActiveImageRegenerateJob(
                jobId = job.id,
                pageNumber = pageNumber,
                status = job.status,
            )
        }

        return StoryboardStateResult(
            activeJob = activeJob?.let {
                ActiveStoryJob(jobId = it.id, status = it.status, createdAt = it.createdAt)
            },
            latestFinalStatus = latestFinalStatus,
            failedCountSinceLastSuccess = failedCount,
            latestImageJob = latestImageJob,
            activeTranslationJob = activeTranslationJob?.let {
                ActiveTranslationJob(
                    jobId = it.id,
                    pageNumber = parseTranslationPageNumber(it.requestPayload),
                    status = it.status,
                    createdAt = it.createdAt,
                )
            },
            activeImageRegenerateJob = activeImageRegenerateJob,
        )
    }

    private fun parseTranslationPageNumber(requestPayload: String?): Int? {
        if (requestPayload.isNullOrBlank()) return null
        return try {
            objectMapper.readValue(requestPayload, StorySentenceTranslationRequestPayload::class.java).pageNumber
        } catch (_: Exception) {
            null
        }
    }

    /**
     * jobs.requestPayload(JSON, StoryboardImageRegeneratePayload 직렬화 결과) 에서 pageNumber 추출.
     * 파싱 실패 시 null 반환 — 호출자가 분기 (잡 없음으로 처리).
     */
    private fun parseRegeneratePageNumber(requestPayload: String?): Int? {
        if (requestPayload.isNullOrBlank()) return null
        return try {
            objectMapper.readValue(requestPayload, StoryboardImageRegeneratePayload::class.java).item.pageNumber
        } catch (_: Exception) {
            null
        }
    }

    private fun ownedStory(userId: Long, storyId: Long): Story {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.deletedAt != null) throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.userId != userId) throw BusinessException(CommonErrorCode.FORBIDDEN)
        return story
    }

    companion object {
        /** 사진 설명이 비어있을 때 AI 의 min_length=1 제약을 위한 fallback. */
        private const val DEFAULT_PHOTO_DESCRIPTION = "사진"
        /**
         * API 명세: 사진은 10~30장 업로드해야 함.
         * NOTE(로컬 테스트): 소량 사진으로 end-to-end 검증 중이라 MIN 을 잠시 1로 완화해 둔다.
         * dev/prod 배포 전에 반드시 10 으로 되돌릴 것. (관련 이슈 #13)
         */
        private const val PHOTO_COUNT_MIN = 1
        private const val PHOTO_COUNT_MAX = 30
    }
}
