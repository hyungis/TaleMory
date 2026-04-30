package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.tts.application.dto.VoicePreviewOptions
import com.s210.backend.domain.tts.application.dto.VoicePreviewRequest
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper

/**
 * 보이스 클론 미리듣기 — BE → AI 비동기 RabbitMQ 호출.
 *
 * 흐름:
 *  1. 소유권 검증 (다른 user 의 voice profile 거부)
 *  2. voice_profiles.audio_url 으로부터 referenceAudioS3Key / referenceAudioUrl 결정
 *  3. StoryGenerationJob (TTS_PREVIEW) 생성
 *  4. RabbitMQ 로 미리듣기 요청 publish
 *  5. jobId 반환 → FE 는 GET /api/generation-jobs/{jobId} 로 polling
 */
@Service
class VoicePreviewService(
    private val voiceProfileRepository: VoiceProfileRepository,
    private val jobRepository: StoryGenerationJobRepository,
    private val ttsService: TtsService,
    private val objectMapper: ObjectMapper,
) {
    fun preview(
        userId: Long,
        voiceProfileId: Long,
        text: String,
        emotion: String? = null,
        language: String = "en-US",
    ): Long {
        if (text.isBlank() || text.length > 500) {
            throw BusinessException(VoiceErrorCode.INVALID_REQUEST)
        }
        val vp = voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)
            ?: throw BusinessException(VoiceErrorCode.NOT_FOUND)
        if (vp.userId != userId) {
            throw BusinessException(VoiceErrorCode.FORBIDDEN)
        }
        val referenceSource = vp.audioUrl ?: throw BusinessException(VoiceErrorCode.INVALID_REQUEST)

        val job = jobRepository.save(
            StoryGenerationJob(
                storyId = 0,
                jobType = JobType.TTS_PREVIEW,
                requestPayload = objectMapper.writeValueAsString(
                    mapOf("voiceProfileId" to voiceProfileId),
                ),
            ),
        )

        ttsService.publishPreview(
            TtsPreviewJobMessage(
                jobId = job.id.toString(),
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

        return job.id
    }

    private fun looksLikeS3Key(value: String): Boolean = value.startsWith("stories/") || value.startsWith("voices/")
}
