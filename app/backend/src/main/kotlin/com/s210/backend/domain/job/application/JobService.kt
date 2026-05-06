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
 * Polling 부담 완화 — Redis cache-aside 패턴 (envelope 변형):
 *  1) 캐시 hit  → DB **0회**. envelope 안의 ownerUserId 와 요청자 userId 비교로 인가 검증.
 *                 응답 본체(JobResponse)는 envelope 에서 바로 추출.
 *  2) 캐시 miss → DB 2회 (story_generation_jobs + stories). status PENDING/RUNNING 이면 envelope 적재.
 *  3) listener 가 종결 시 캐시 invalidate (afterCommit) — stale RUNNING 응답 제거.
 *
 * 인가 안전성 — envelope 에 ownerUserId 를 함께 캐싱해도 안전한 이유:
 *  - storyId → userId 매핑은 immutable (동화 소유자 이전 불가). envelope 의 ownerUserId 가 stale 될 시나리오 없음.
 *  - hit 시 검증은 "envelope.ownerUserId == 요청자 userId" — 공격자가 Redis 를 조작해도 자신의 userId 로
 *    인증된 요청만 통과 가능. 즉 권한 우회로 쓰일 수 없음 (이미 적법한 인가).
 *  - 깨진 envelope (deserialize 실패) → invalidate + DB fallback (self-heal).
 *
 * 캐시 미동기화 안전망:
 *  - TTL 5분 — 그 안에 stale 캐시 자동 만료. FE polling 수명(5분)과 정렬.
 *  - listener invalidate (afterCommit) — DB UPDATE 반영 후 캐시 제거.
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
     * 단건 조회 + 소유권 검증.
     *  - hit  → envelope.ownerUserId 비교 (DB 0회). 불일치 시 FORBIDDEN.
     *  - miss → DB 조회 + 소유권 검증 + (PENDING/RUNNING 이면) envelope 적재.
     * 존재하지 않으면 404, 다른 사용자 것이면 403.
     */
    fun findJob(userId: Long, jobId: Long): JobResponse {
        // 1) 캐시 우선 — DB 안 봄.
        val cached = tryReadCachedEnvelope(jobId)
        if (cached != null) {
            if (cached.ownerUserId != userId) {
                throw BusinessException(CommonErrorCode.FORBIDDEN)
            }
            return cached.response
        }

        // 2) Cache miss → DB.
        val job = jobRepository.findById(jobId).orElseThrow {
            BusinessException(CommonErrorCode.RESOURCE_NOT_FOUND)
        }
        val ownerUserId = ownerUserIdOf(job.storyId)
        if (ownerUserId != userId) {
            throw BusinessException(CommonErrorCode.FORBIDDEN)
        }
        val response = job.toResponse()

        // 3) 진행 중일 때만 적재. 종결 잡은 캐시 안 함.
        if (job.status == JobStatus.PENDING || job.status == JobStatus.RUNNING) {
            tryWriteCachedEnvelope(jobId, ownerUserId, response)
        }

        return response
    }

    /**
     * Cache hit 시 envelope 으로 deserialize. 실패는 swallow + WARN + **invalidate** —
     * 깨진 envelope 가 박제되지 않도록 한 번 비우고 다음 polling 부터 정상 흐름으로 복구.
     */
    private fun tryReadCachedEnvelope(jobId: Long): CachedJobEnvelope? {
        return try {
            val json = jobStatusRedisRepo.getCachedJobResponse(jobId) ?: return null
            objectMapper.readValue(json, CachedJobEnvelope::class.java)
        } catch (e: Exception) {
            log.warn("JobResponse cache read/parse failed jobId={}, invalidating: {}", jobId, e.message)
            runCatching { jobStatusRedisRepo.invalidateJobResponse(jobId) }
            null
        }
    }

    private fun tryWriteCachedEnvelope(jobId: Long, ownerUserId: Long, response: JobResponse) {
        try {
            val json = objectMapper.writeValueAsString(CachedJobEnvelope(ownerUserId, response))
            jobStatusRedisRepo.cacheJobResponse(jobId, json)
        } catch (e: Exception) {
            log.warn("JobResponse cache write failed jobId={}: {}", jobId, e.message)
        }
    }

    /**
     * Cache miss 경로 owner 조회 — `stories` 1회. 결과는 호출자가 envelope 적재 시 동봉.
     */
    private fun ownerUserIdOf(storyId: Long): Long {
        val story = storyRepository.findById(storyId).orElseThrow {
            BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
        return story.userId
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

/**
 * Polling 캐시에 적재되는 봉투 — 응답 본체 + 소유자 userId.
 *
 * **왜 envelope 인가**: 응답 JSON 만 캐시하면 hit 시에도 owner 검증을 위해 `stories` 를 1회 더 봐야 한다.
 * envelope 으로 ownerUserId 를 함께 캐시하면 hit 시 DB 0회. 인가 안전성은 클래스 KDoc 참고.
 *
 * top-level 로 둔 이유: Jackson 이 private nested class 를 reflection 으로 인스턴스화할 때
 * Kotlin private 가시성 문제로 깨질 수 있어 안전하게 분리.
 */
data class CachedJobEnvelope(
    val ownerUserId: Long,
    val response: JobResponse,
)
