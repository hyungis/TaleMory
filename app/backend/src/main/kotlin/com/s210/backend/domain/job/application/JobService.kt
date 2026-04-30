package com.s210.backend.domain.job.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.job.presentation.response.JobResponse
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * `story_generation_jobs` 의 조회 유스케이스.
 *
 * 현재 MR 에서는 FE polling 용 단건 조회만 구현 (API 명세 #56).
 * 목록/취소 (#57, #58) 은 후속 이슈.
 */
@Service
@Transactional(readOnly = true)
class JobService(
    private val jobRepository: StoryGenerationJobRepository,
    private val storyRepository: StoryRepository,
    private val voiceProfileRepository: VoiceProfileRepository,
    private val objectMapper: ObjectMapper,
    private val jobStatusRedisRepository: JobStatusRedisRepository,
) {

    /**
     * 단건 조회 + 소유권 검증 (해당 Job 이 속한 Story 의 userId 로 확인).
     * 존재하지 않으면 404, 다른 사용자 것이면 403.
     *
     * PENDING/RUNNING 상태일 때는 Redis hash 에서 progress/current_step/stage 를 보강.
     * terminal status (SUCCESS/FAILED/CANCELLED) 에서는 Redis 조회 skip.
     * Redis 장애 시 try/catch 로 swallow → progress=null (폴링 status 는 정상 동작).
     */
    fun findJob(userId: Long, jobId: Long): JobResponse {
        val job = jobRepository.findById(jobId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        assertOwned(userId, job)

        val live: Map<String, String> = if (job.status == JobStatus.PENDING || job.status == JobStatus.RUNNING) {
            try { jobStatusRedisRepository.getStatus(job.storyId) } catch (_: Exception) { emptyMap() }
        } else {
            emptyMap()
        }

        return job.toResponse(live)
    }

    private fun assertOwned(userId: Long, job: StoryGenerationJob) {
        if (job.jobType == JobType.TTS_PREVIEW) {
            assertPreviewOwned(userId, job)
            return
        }
        val story = storyRepository.findById(job.storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
    }

    private fun assertPreviewOwned(userId: Long, job: StoryGenerationJob) {
        val payload = job.requestPayload?.toJsonNodeOrNull()
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val voiceProfileId = payload["voiceProfileId"]?.asLong()
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        val voiceProfile = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        if (voiceProfile.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
    }

    private fun StoryGenerationJob.toResponse(live: Map<String, String> = emptyMap()): JobResponse = JobResponse(
        jobId = id,
        storyId = storyId,
        sentenceId = sentenceId,
        sceneId = sceneId,
        jobType = jobType.name,
        status = status.name,
        requestPayload = requestPayload?.toJsonNodeOrNull(),
        resultPayload = resultPayload?.toJsonNodeOrNull(),
        errorMessage = errorMessage,
        costUsd = costUsd,
        startedAt = startedAt,
        finishedAt = finishedAt,
        createdAt = createdAt,
        progress = live["progress"]?.toIntOrNull(),
        currentStep = live["current_step"],
        stage = live["stage"],
    )

    private fun String.toJsonNodeOrNull(): JsonNode? =
        if (isBlank()) null
        else try { objectMapper.readTree(this) } catch (_: Exception) { null }
}
