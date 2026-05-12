package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryMode
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * WEBTOON 모드 좌표 추출 사용자 수동 재시도 서비스.
 *
 * 트리거 시점:
 *  뷰어에서 특정 페이지의 scene.character_anchors 가 비거나 매칭 실패해 fallback 위치로 표시되는
 *  경우, 사용자가 [좌표 다시 추출] 버튼을 눌러 단일 페이지 재시도.
 *
 * 정책:
 *  - 소유권 검증 (story.userId == userId).
 *  - 동화 모드가 WEBTOON 이어야 함 (VIEWER 모드는 좌표 미사용).
 *  - 같은 storyId+pageNumber 의 진행 중(PENDING/RUNNING) WEBTOON_LAYOUT_RETRY 잡이 있으면 재사용.
 *  - 새 잡 INSERT → 단건 publish → jobId 반환. FE 는 jobId 로 polling.
 */
@Service
@Transactional
class WebtoonLayoutRetryService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val webtoonLayoutPublisher: WebtoonLayoutPublisher,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun retryPage(userId: Long, storyId: Long, pageNumber: Int): RetryResult {
        // 1) 동화 검증 — 소유권 + WEBTOON 모드 + 페이지 존재.
        val story = storyRepository.findByIdAndUserId(storyId, userId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.mode != StoryMode.WEBTOON) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
        val scene = sceneRepository.findByStoryIdAndPageNumber(storyId, pageNumber)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val imageUrl = scene.illustrationUrl?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(StoryErrorCode.STORYBOARD_IMAGES_NOT_READY)

        // 2) 멱등 — 같은 페이지의 진행 중 RETRY 잡이 있으면 재사용.
        val active = findActiveRetryJob(storyId, pageNumber)
        if (active != null) {
            log.info(
                "[LAYOUT:RETRY] reuse active job — storyId={}, page={}, jobId={}",
                storyId, pageNumber, active.id,
            )
            return RetryResult(jobId = active.id, status = active.status.name)
        }

        // 3) 새 RETRY 잡 INSERT — pageNumber 를 requestPayload 에 박아둬 멱등 가드 lookup 에 사용.
        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = storyId,
                jobType = JobType.WEBTOON_LAYOUT_RETRY,
                status = JobStatus.RUNNING,
                requestPayload = """{"pageNumber":$pageNumber}""",
            ),
        )

        // 4) 단건 publish — 결과 envelope 가 같은 jobId 로 돌아오면 WebtoonLayoutResultHandler 가
        //    SUCCESS/FAILED 로 마감.
        webtoonLayoutPublisher.publishItem(
            storyId = storyId,
            trackingJobId = job.id,
            pageNumber = pageNumber,
            pageImageUrlOverride = imageUrl,
        )

        log.info(
            "[LAYOUT:RETRY] enqueued — storyId={}, page={}, jobId={}",
            storyId, pageNumber, job.id,
        )
        return RetryResult(jobId = job.id, status = job.status.name)
    }

    /**
     * 같은 (storyId, pageNumber) 로 PENDING/RUNNING 인 RETRY 잡 조회 — 멱등 가드용.
     * requestPayload JSON 의 pageNumber 필드를 substring 매치 (소량 데이터 + 단순 보장).
     */
    private fun findActiveRetryJob(storyId: Long, pageNumber: Int): StoryGenerationJob? {
        return jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
            storyId,
            JobType.WEBTOON_LAYOUT_RETRY,
            listOf(JobStatus.PENDING, JobStatus.RUNNING),
        )?.takeIf { it.requestPayload?.contains("\"pageNumber\":$pageNumber") == true }
    }

    data class RetryResult(val jobId: Long, val status: String)
}
