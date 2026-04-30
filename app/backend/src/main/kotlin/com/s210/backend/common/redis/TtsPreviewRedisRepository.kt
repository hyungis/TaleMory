package com.s210.backend.common.redis

import com.s210.backend.domain.job.model.JobStatus
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Repository
import java.time.Duration
import java.time.Instant

/**
 * TTS preview 잡의 correlation/state 저장소.
 *
 * Redis Key: `storybook:tts:preview:{previewId}` (Hash, TTL 1시간)
 *
 * preview 는 영속 가치가 거의 없는 일회성 작업이므로 `story_generation_jobs` (MySQL) 에
 * row 를 만들지 않고 Redis Hash 로 발급/상태/결과를 관리한다.
 *
 * 필드:
 *  - userId, voiceProfileId — 인가/디버깅
 *  - status — PENDING / SUCCESS / FAILED (RUNNING 미사용)
 *  - audioUrl — SUCCESS 시
 *  - errorCode, errorMessage — FAILED 시
 *  - createdAt, finishedAt — ISO8601
 */
@Repository
class TtsPreviewRedisRepository(
    private val redis: StringRedisTemplate,
) {
    companion object {
        const val KEY_PREFIX = "storybook:tts:preview"
        val TTL: Duration = Duration.ofHours(1)
    }

    fun createPending(previewId: String, userId: Long, voiceProfileId: Long) {
        val key = key(previewId)
        val now = Instant.now().toString()
        val fields = mapOf(
            "userId" to userId.toString(),
            "voiceProfileId" to voiceProfileId.toString(),
            "status" to JobStatus.PENDING.name,
            "createdAt" to now,
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun markSuccess(previewId: String, audioUrl: String) {
        val key = key(previewId)
        val fields = mapOf(
            "status" to JobStatus.SUCCESS.name,
            "audioUrl" to audioUrl,
            "finishedAt" to Instant.now().toString(),
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun markFailed(previewId: String, errorCode: String, errorMessage: String) {
        val key = key(previewId)
        val fields = mapOf(
            "status" to JobStatus.FAILED.name,
            "errorCode" to errorCode,
            "errorMessage" to errorMessage,
            "finishedAt" to Instant.now().toString(),
        )
        redis.opsForHash<String, String>().putAll(key, fields)
        redis.expire(key, TTL)
    }

    fun get(previewId: String): TtsPreviewSnapshot? {
        val map = redis.opsForHash<String, String>().entries(key(previewId))
        if (map.isEmpty()) return null
        val statusStr = map["status"] ?: return null
        val userIdStr = map["userId"] ?: return null
        val voiceProfileIdStr = map["voiceProfileId"] ?: return null
        val createdAtStr = map["createdAt"] ?: return null
        return TtsPreviewSnapshot(
            previewId = previewId,
            userId = userIdStr.toLong(),
            voiceProfileId = voiceProfileIdStr.toLong(),
            status = JobStatus.valueOf(statusStr),
            audioUrl = map["audioUrl"],
            errorCode = map["errorCode"],
            errorMessage = map["errorMessage"],
            createdAt = Instant.parse(createdAtStr),
            finishedAt = map["finishedAt"]?.let(Instant::parse),
        )
    }

    private fun key(previewId: String): String = "$KEY_PREFIX:$previewId"
}

data class TtsPreviewSnapshot(
    val previewId: String,
    val userId: Long,
    val voiceProfileId: Long,
    val status: JobStatus,
    val audioUrl: String?,
    val errorCode: String?,
    val errorMessage: String?,
    val createdAt: Instant,
    val finishedAt: Instant?,
)
