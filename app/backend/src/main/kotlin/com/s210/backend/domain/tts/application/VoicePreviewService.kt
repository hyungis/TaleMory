package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.tts.application.dto.VoicePreviewOptions
import com.s210.backend.domain.tts.application.dto.VoicePreviewRequest
import com.s210.backend.domain.tts.application.dto.VoicePreviewResponse
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Duration

/**
 * 보이스 클론 미리듣기 — BE → AI 동기 HTTP 호출.
 *
 * 흐름:
 *  1. 소유권 검증 (다른 user 의 voice profile 거부)
 *  2. voice_profiles.audio_url 으로부터 referenceAudioUrl 결정
 *  3. AI:8000/api/v1/voices/{voiceId}/preview 동기 호출 (30s timeout)
 *  4. 응답 그대로 forward (audioUrl, s3Key, durationMs)
 *
 * 에러:
 *  - 다른 user → FORBIDDEN
 *  - voice_profile 없거나 deleted → NOT_FOUND
 *  - 텍스트 빈/>500자 → INVALID_REQUEST
 *  - AI 5xx / timeout → AI_PROVIDER_ERROR
 */
@Service
class VoicePreviewService(
    private val voiceProfileRepository: VoiceProfileRepository,
    @Qualifier("aiServiceWebClient") private val webClient: WebClient,
) {
    fun preview(
        userId: Long,
        voiceProfileId: Long,
        text: String,
        emotion: String? = null,
        language: String = "en-US",
    ): VoicePreviewResponse {
        if (text.isBlank() || text.length > 500) {
            throw BusinessException(VoiceErrorCode.INVALID_REQUEST)
        }
        val vp = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (vp.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        val refUrl = vp.audioUrl ?: throw BusinessException(VoiceErrorCode.INVALID_REQUEST)

        val request = VoicePreviewRequest(
            text = text,
            language = language,
            referenceAudioUrl = refUrl,
            options = VoicePreviewOptions(emotion = emotion),
        )

        return try {
            webClient.post()
                .uri("/api/v1/voices/{voiceId}/preview", voiceProfileId.toString())
                .bodyValue(request)
                .retrieve()
                .bodyToMono<VoicePreviewResponse>()
                .block(Duration.ofSeconds(30))!!
        } catch (e: Exception) {
            throw BusinessException(VoiceErrorCode.AI_PROVIDER_ERROR, cause = e)
        }
    }
}
