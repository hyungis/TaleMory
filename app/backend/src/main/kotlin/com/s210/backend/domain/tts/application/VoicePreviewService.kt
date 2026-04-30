package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.tts.application.dto.VoicePreviewOptions
import com.s210.backend.domain.tts.application.dto.VoicePreviewRequest
import com.s210.backend.domain.tts.presentation.response.TtsPreviewStatusResponse
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 보이스 클론 미리듣기 — BE → AI 비동기 RabbitMQ 호출.
 *
 * 흐름:
 *  1. 소유권 검증 (다른 user 의 voice profile 거부)
 *  2. voice_profiles.audio_url 으로부터 referenceAudioS3Key / referenceAudioUrl 결정
 *  3. previewId (UUID) 발급 + Redis HSET (PENDING)
 *  4. RabbitMQ 로 미리듣기 요청 publish (jobId = previewId)
 *  5. previewId 반환 → FE 는 GET /api/voice-profiles/previews/{previewId} 로 polling
 */
@Service
class VoicePreviewService(
    private val voiceProfileRepository: VoiceProfileRepository,
    private val previewRedis: TtsPreviewRedisRepository,
    private val ttsService: TtsService,
) {
    fun preview(
        userId: Long,
        voiceProfileId: Long,
        text: String,
        emotion: String? = null,
        language: String = "en-US",
    ): String {
        if (text.isBlank() || text.length > 500) {
            throw BusinessException(VoiceErrorCode.INVALID_REQUEST)
        }
        val vp = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (vp.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        val referenceSource = vp.audioUrl ?: throw BusinessException(VoiceErrorCode.INVALID_REQUEST)

        val previewId = UUID.randomUUID().toString()
        previewRedis.createPending(previewId = previewId, userId = userId, voiceProfileId = voiceProfileId)

        ttsService.publishPreview(
            TtsPreviewJobMessage(
                jobId = previewId,
                voiceId = voiceProfileId.toString(),
                payload = VoicePreviewRequest(
                    text = text,
                    language = language,
                    options = VoicePreviewOptions(emotion = emotion ?: "NEUTRAL"),
                    referenceAudioUrl = referenceSource.takeUnless(::looksLikeS3Key),
                    referenceAudioS3Key = referenceSource.takeIf(::looksLikeS3Key),
                ),
            ),
        )

        return previewId
    }

    fun getStatus(userId: Long, previewId: String): TtsPreviewStatusResponse {
        val snapshot = previewRedis.get(previewId)
            ?: throw BusinessException(VoiceErrorCode.PREVIEW_NOT_FOUND)
        if (snapshot.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        return TtsPreviewStatusResponse.from(snapshot)
    }

    private fun looksLikeS3Key(value: String): Boolean = value.startsWith("stories/") || value.startsWith("voices/")
}
