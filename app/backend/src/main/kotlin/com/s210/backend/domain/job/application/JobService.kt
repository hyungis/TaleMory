package com.s210.backend.domain.job.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.presentation.response.JobResponse
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * `story_generation_jobs` 의 조회 유스케이스.
 *
 * 현재 MR 에서는 FE polling 용 단건 조회만 구현 (API 명세 #56).
 * 목록/취소 (#57, #58) 은 후속 이슈.
 *
 * Polling 부담 완화 — Redis cache-aside 패턴:
 *  1) 캐시 hit → 응답 본체(`story_generation_jobs` 의 무거운 TEXT 컬럼들 포함)는 Redis 에서 바로 읽음.
 *     소유권 검증을 위해 가벼운 `stories.user_id` 만 DB 1회 (heavy 컬럼 read 회피가 핵심 절약).
 *  2) 캐시 miss → DB 조회. **status 가 PENDING/RUNNING 일 때만** 캐시 적재.
 *     → 종결 잡은 캐시하지 않음. 어차피 FE 가 종결 응답 받으면 polling 멈추므로 메모리 낭비 없음.
 *  3) listener 가 종결 시 캐시 invalidate (afterCommit 으로) — stale RUNNING 응답이 남지 않도록.
 *
 * 캐시 미동기화 (예: Redis 일시 장애로 invalidate 누락) 안전망:
 *  - TTL 5분 — 그 안에 stale 캐시 자동 만료. FE polling 수명(5분)과 정렬.
 *  - 소유권 검증은 항상 DB 의 stories.user_id 를 보므로 캐시된 응답을 인가 우회로 쓸 수 없음.
 *  - deserialize 실패 시 invalidate + null 반환 — 깨진 캐시가 박제되지 않도록 self-heal.
 */
@Service
@Transactional(readOnly = true)
class JobService(
    private val jobRepository: StoryGenerationJobRepository,
    private val storyRepository: StoryRepository,
    private val objectMapper: ObjectMapper,
    private val jobStatusRedisRepo: JobStatusRedisRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * 단건 조회 + 소유권 검증 (해당 Job 이 속한 Story 의 userId 로 확인).
     * 존재하지 않으면 404, 다른 사용자 것이면 403.
     *
     * Cache-aside:
     *  - hit  → 캐시 응답 그대로 (소유권 재검증은 DB 없이 캐시 안의 storyId → DB stories 1회로 가능 BUT
     *           storyId/userId 검증을 캐시 응답에서 신뢰하면 staleness 위험 → 안전하게 DB 1회 검증 수행).
     *  - miss → DB 조회 + 진행 중일 때만 적재.
     */
    fun findJob(userId: Long, jobId: Long): JobResponse {
        // 1) 캐시 우선 — 진행 중 잡은 같은 jobId 로 polling 이 반복되므로 hit 율 극대화.
        val cached = tryReadCachedResponse(jobId)
        if (cached != null) {
            // 캐시 응답이라도 소유권은 항상 DB 기준으로 검증 — 인가 우회 위험 차단.
            assertOwnedByStoryId(userId, cached.storyId)
            return cached
        }

        // 2) Cache miss → DB.
        val job = jobRepository.findById(jobId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        assertOwned(userId, job)
        val response = job.toResponse()

        // 3) 진행 중일 때만 적재. 종결 잡은 캐시 안 함.
        if (job.status == JobStatus.PENDING || job.status == JobStatus.RUNNING) {
            tryWriteCachedResponse(jobId, response)
        }

        return response
    }

    /**
     * Cache hit 시 deserialize. 실패는 swallow + WARN + **invalidate** — 깨진 캐시가 박제되지 않도록.
     * invalidate 안 하면 다음 polling 도 같은 깨진 JSON 을 읽고 또 실패 → 5분 동안 매 polling 마다
     * WARN 로그 + 매번 DB fallback 으로 전락. 한 번 깨끗이 비우고 다음 hit 부터 정상 흐름.
     */
    private fun tryReadCachedResponse(jobId: Long): JobResponse? {
        return try {
            val json = jobStatusRedisRepo.getCachedJobResponse(jobId) ?: return null
            objectMapper.readValue(json, JobResponse::class.java)
        } catch (e: Exception) {
            log.warn("JobResponse cache read/parse failed jobId={}, invalidating: {}", jobId, e.message)
            runCatching { jobStatusRedisRepo.invalidateJobResponse(jobId) }
            null
        }
    }

    private fun tryWriteCachedResponse(jobId: Long, response: JobResponse) {
        try {
            val json = objectMapper.writeValueAsString(response)
            jobStatusRedisRepo.cacheJobResponse(jobId, json)
        } catch (e: Exception) {
            log.warn("JobResponse cache write failed jobId={}: {}", jobId, e.message)
        }
    }

    private fun assertOwned(userId: Long, job: StoryGenerationJob) {
        assertOwnedByStoryId(userId, job.storyId)
    }

    /** storyId 기준 소유권 검증 — DB stories.user_id 1회 조회 (캐시 hit 경로용). */
    private fun assertOwnedByStoryId(userId: Long, storyId: Long) {
        val story = storyRepository.findById(storyId).orElseThrow {
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
