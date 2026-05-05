package com.s210.backend.common.redis

import com.s210.backend.domain.job.model.JobType
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration
import java.time.Instant

/**
 * Job 상태/응답 Redis 저장소.
 *
 * 두 가지 책임을 한 클래스에서 분리된 키 네임스페이스로 처리:
 *
 * 1) Operational status (Hash) — stage/progress/currentStep 같은 진행 metadata.
 *    - 키:   `storybook:job:status:{story_id}:{job_type}`     (story 전역, jobType 별)
 *    - 용도: TTS 단계별 진행률 등 BE 모니터링 sidecar.
 *    - jobType 을 키에 포함 — 같은 storyId 의 SUMMARY/STORY/IMAGE/TTS 가 동시에 진행돼도 충돌 X.
 *
 * 2) Polling response cache (String JSON) — FE polling 부담 완화.
 *    - 키:   `storybook:job:cache:job:{job_id}`               (`/api/generation-jobs/{jobId}` 용)
 *           `storybook:job:cache:summary:{story_id}`          (`/storyboard/summary` 용)
 *    - 용도: cache-aside 패턴. 잡이 PENDING/RUNNING 일 때만 적재. 종결(SUCCESS/FAILED) 응답은 적재 안 함.
 *    - listener invalidate: 잡 종결 시 키 삭제 → 다음 polling 은 cache miss → DB hit → 종결 응답이라 적재 안 함.
 *
 * TTL: 5분. listener invalidate 가 누락(예: Redis 일시 장애)돼도 5분 안에 stale RUNNING 캐시가 자동 만료된다.
 * FE polling timeout(5분) 과 정렬 — TTL 이 polling 수명보다 길면 stale 응답이 의미 없는 시간만 늘어남.
 */
@Repository
class JobStatusRedisRepository(
    private val redis: StringRedisTemplate,
) {
    companion object {
        // Operational status (hash) — legacy + 진행률 sidecar.
        const val KEY_PREFIX = "storybook:job:status"
        // Polling cache (String JSON).
        const val POLLING_JOB_KEY_PREFIX = "storybook:job:cache:job"
        const val POLLING_SUMMARY_KEY_PREFIX = "storybook:job:cache:summary"

        val TTL: Duration = Duration.ofMinutes(5)

        // Hash field — typo 방지.
        private const val F_STAGE = "stage"
        private const val F_PROGRESS = "progress"
        private const val F_CURRENT_STEP = "current_step"
        private const val F_STARTED_AT = "started_at"
        private const val F_UPDATED_AT = "updated_at"
        private const val F_ERROR_MESSAGE = "error_message"
    }

    // ─────────────────────────────────────────────────────────
    // Operational status (Hash)
    // ─────────────────────────────────────────────────────────

    /**
     * 잡 진행 metadata 기록 (stage/progress/currentStep). polling cache 와 별개 hash.
     * 기존 호출지 (StoryConfirmService, TtsResultHandler) 의 진행률 표시용 sidecar.
     *
     * @param jobType 같은 storyId 의 다른 잡 타입과 충돌하지 않도록 키에 포함.
     */
    fun setStatus(
        storyId: Long,
        jobType: JobType,
        stage: String,
        progress: Int,
        currentStep: String,
        errorMessage: String? = null,
    ) {
        val key = statusKey(storyId, jobType)
        val now = Instant.now().toString()
        val fields = mutableMapOf(
            F_STAGE to stage,
            F_PROGRESS to progress.toString(),
            F_CURRENT_STEP to currentStep,
            F_UPDATED_AT to now,
        )
        if (redis.opsForHash<String, String>().get(key, F_STARTED_AT) == null) {
            fields[F_STARTED_AT] = now
        }
        if (errorMessage != null) fields[F_ERROR_MESSAGE] = errorMessage
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun getStatus(storyId: Long, jobType: JobType): Map<String, String> =
        redis.opsForHash<String, String>().entries(statusKey(storyId, jobType))

    fun deleteStatus(storyId: Long, jobType: JobType) {
        redis.delete(statusKey(storyId, jobType))
    }

    // ─────────────────────────────────────────────────────────
    // Polling response cache (String JSON)
    // ─────────────────────────────────────────────────────────

    /**
     * `/api/generation-jobs/{jobId}` 응답 (JobResponse JSON) 캐시 적재.
     *
     * **호출 측 규약**: `status` 가 PENDING/RUNNING 일 때만 호출한다.
     * 종결 응답을 캐시하면 사용자가 곧 polling 을 멈춰 메모리 낭비 + listener invalidate 와 의미 충돌.
     */
    fun cacheJobResponse(jobId: Long, json: String) {
        redis.opsForValue().set(jobResponseKey(jobId), json, TTL)
    }

    fun getCachedJobResponse(jobId: Long): String? =
        redis.opsForValue().get(jobResponseKey(jobId))?.takeIf { it.isNotBlank() }

    /**
     * 잡 종결 시 listener 가 호출 — stale RUNNING 캐시 제거.
     * 다음 polling 은 cache miss → DB 종결 응답을 받고 (caching 규약상) 다시 적재 안 함.
     */
    fun invalidateJobResponse(jobId: Long) {
        redis.delete(jobResponseKey(jobId))
    }

    /**
     * `/storyboard/summary` 응답 (SummaryResponseData JSON) 캐시 적재.
     * 호출 측 규약은 cacheJobResponse 와 동일 — `jobStatus` 가 PENDING/RUNNING 일 때만.
     */
    fun cacheSummaryResponse(storyId: Long, json: String) {
        redis.opsForValue().set(summaryResponseKey(storyId), json, TTL)
    }

    fun getCachedSummaryResponse(storyId: Long): String? =
        redis.opsForValue().get(summaryResponseKey(storyId))?.takeIf { it.isNotBlank() }

    fun invalidateSummaryResponse(storyId: Long) {
        redis.delete(summaryResponseKey(storyId))
    }

    // ─────────────────────────────────────────────────────────
    private fun statusKey(storyId: Long, jobType: JobType): String =
        "$KEY_PREFIX:$storyId:${jobType.name}"

    private fun jobResponseKey(jobId: Long): String = "$POLLING_JOB_KEY_PREFIX:$jobId"

    private fun summaryResponseKey(storyId: Long): String = "$POLLING_SUMMARY_KEY_PREFIX:$storyId"
}
