package com.s210.backend.domain.job.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.presentation.response.JobResponse
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
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
    private val objectMapper: ObjectMapper,
) {

    /**
     * 단건 조회 + 소유권 검증 (해당 Job 이 속한 Story 의 userId 로 확인).
     * 존재하지 않으면 404, 다른 사용자 것이면 403.
     */
    fun findJob(userId: Long, jobId: Long): JobResponse {
        val job = jobRepository.findById(jobId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        assertOwned(userId, job)
        return job.toResponse()
    }

    private fun assertOwned(userId: Long, job: StoryGenerationJob) {
        val story = storyRepository.findById(job.storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        if (story.userId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
    }

    private fun StoryGenerationJob.toResponse(): JobResponse = JobResponse(
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
    )

    private fun String.toJsonNodeOrNull(): JsonNode? =
        if (isBlank()) null
        else try { objectMapper.readTree(this) } catch (_: Exception) { null }
}
