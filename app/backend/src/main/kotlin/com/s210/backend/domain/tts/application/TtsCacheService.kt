package com.s210.backend.domain.tts.application

import com.s210.backend.common.redis.TtsCacheRedisRepository
import org.springframework.stereotype.Service
import java.security.MessageDigest

/**
 * 같은 voice_profile + 같은 정규화 영어 문장 → S3 url 재사용 (Redis 설계 v3 §4).
 *
 * 정규화: 소문자 + 양끝 공백 제거 + 연속 공백 1개로 축소.
 * 해시: SHA-256(normalized).hex.take(16).
 *
 * Confirm 시 사전 lookup → cache hit 은 즉시 SceneSentence.tts_audio_url 채움 (AI 호출 X).
 * TTS 결과 수신 시 store 로 캐시 등록.
 */
@Service
class TtsCacheService(
    private val repo: TtsCacheRedisRepository,
) {
    fun normalize(text: String): String =
        text.lowercase().trim().replace(Regex("\\s+"), " ")

    fun computeHash(text: String): String {
        val normalized = normalize(text)
        val digest = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }.take(16)
    }

    fun lookup(voiceProfileId: Long, text: String): String? =
        repo.get(voiceProfileId, computeHash(text))

    fun store(voiceProfileId: Long, text: String, audioUrl: String) {
        repo.set(voiceProfileId, computeHash(text), audioUrl)
    }
}
