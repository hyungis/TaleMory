package com.s210.backend.common.redis

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration

/**
 * Redis 키: `storybook:tts:cache:{voice_profile_id}:{text_hash_16}`
 * 값: S3 audio URL (String)
 * TTL: 30일
 *
 * 정규화/해시는 호출자(TtsCacheService) 책임. 이 repo는 키 포맷과 GET/SET만 담당.
 */
@Repository
class TtsCacheRedisRepository(
    private val redis: StringRedisTemplate,
) {
    companion object {
        const val KEY_PREFIX = "storybook:tts:cache"
        val TTL: Duration = Duration.ofDays(30)
    }

    fun get(voiceProfileId: Long, textHash: String): String? =
        redis.opsForValue().get(key(voiceProfileId, textHash))

    fun set(voiceProfileId: Long, textHash: String, audioUrl: String) {
        redis.opsForValue().set(key(voiceProfileId, textHash), audioUrl, TTL)
    }

    private fun key(vpId: Long, hash: String): String = "$KEY_PREFIX:$vpId:$hash"
}
