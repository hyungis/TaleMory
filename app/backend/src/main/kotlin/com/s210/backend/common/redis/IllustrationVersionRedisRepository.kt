package com.s210.backend.common.redis

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant

/**
 * 일러스트 버전 관리 (Redis 설계 v3 §1).
 *
 * 키 페어:
 *  - `storybook:illust:versions:{scene_id}` (List, 최대 10개, TTL 24h)
 *  - `storybook:illust:current:{scene_id}` (String, 현재 버전 번호, TTL 24h)
 *
 * 이번 plan(Phase A+B) 에선 confirm 시 version=1 초기화만 사용.
 * regenerate/rollback (LPUSH/LTRIM/LRANGE) 은 Phase C plan 에서 추가.
 */
@Repository
class IllustrationVersionRedisRepository(
    private val redis: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        const val VERSIONS_PREFIX = "storybook:illust:versions"
        const val CURRENT_PREFIX = "storybook:illust:current"
        const val MAX_VERSIONS = 10L
        val TTL: Duration = Duration.ofHours(24)
    }

    fun pushVersion(
        sceneId: Long,
        version: Int,
        url: String,
        prompt: String?,
        jobId: Long?,
    ) {
        val versionsKey = versionsKey(sceneId)
        val currentKey = currentKey(sceneId)

        val entry = mapOf(
            "version" to version,
            "url" to url,
            "prompt" to prompt,
            "createdAt" to Instant.now().toString(),
            "jobId" to jobId,
        )
        val json = objectMapper.writeValueAsString(entry)

        redis.opsForList().leftPush(versionsKey, json)
        redis.opsForList().trim(versionsKey, 0, MAX_VERSIONS - 1)
        redis.expire(versionsKey, TTL)

        redis.opsForValue().set(currentKey, version.toString(), TTL)
    }

    fun getCurrent(sceneId: Long): Int? =
        redis.opsForValue().get(currentKey(sceneId))?.toIntOrNull()

    private fun versionsKey(sceneId: Long) = "$VERSIONS_PREFIX:$sceneId"
    private fun currentKey(sceneId: Long) = "$CURRENT_PREFIX:$sceneId"
}
