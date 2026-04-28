package com.s210.backend.common.redis

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration
import java.time.Instant

/**
 * Redis 키: `storybook:job:status:{story_id}`
 * 타입: Hash
 * TTL: 1시간
 * 필드: stage, progress, current_step, started_at, updated_at, error_message?
 *
 * DB 의 story_generation_jobs 와 이중화 — 영구 이력은 DB, 실시간 진행은 Redis.
 */
@Repository
class JobStatusRedisRepository(
    private val redis: StringRedisTemplate,
) {
    companion object {
        const val KEY_PREFIX = "storybook:job:status"
        val TTL: Duration = Duration.ofHours(1)
    }

    fun setStatus(
        storyId: Long,
        stage: String,
        progress: Int,
        currentStep: String,
        errorMessage: String? = null,
    ) {
        val key = key(storyId)
        val now = Instant.now().toString()
        val fields = mutableMapOf(
            "stage" to stage,
            "progress" to progress.toString(),
            "current_step" to currentStep,
            "updated_at" to now,
        )
        // started_at: 첫 호출에서만 셋팅. 이미 있으면 보존.
        if (redis.opsForHash<String, String>().get(key, "started_at") == null) {
            fields["started_at"] = now
        }
        if (errorMessage != null) fields["error_message"] = errorMessage
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun getStatus(storyId: Long): Map<String, String> =
        redis.opsForHash<String, String>().entries(key(storyId))

    fun delete(storyId: Long) {
        redis.delete(key(storyId))
    }

    private fun key(storyId: Long): String = "$KEY_PREFIX:$storyId"
}
