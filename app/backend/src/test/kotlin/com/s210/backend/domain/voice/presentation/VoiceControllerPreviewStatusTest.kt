package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.common.redis.TtsPreviewSnapshot
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.tts.application.TtsService
import com.s210.backend.domain.tts.application.VoicePreviewService
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import java.time.Instant
import java.util.UUID

/**
 * VoicePreviewService.getStatus 의 권한/존재 검증을 단위 테스트로 검증.
 *
 * Controller 자체는 thin pass-through 라 별도 MockMvc 통합 테스트는 생략.
 * (controller -> service 호출만 확인하면 충분)
 */
@ExtendWith(MockitoExtension::class)
class VoiceControllerPreviewStatusTest {

    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val previewRedis: TtsPreviewRedisRepository = mock(TtsPreviewRedisRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val ttsService = TtsService(rabbitTemplate)

    private val service = VoicePreviewService(
        voiceProfileRepository = voiceProfileRepository,
        previewRedis = previewRedis,
        ttsService = ttsService,
    )

    @Test
    fun `getStatus returns SUCCESS payload`() {
        val previewId = UUID.randomUUID().toString()
        val createdAt = Instant.parse("2026-04-30T12:00:00Z")
        val finishedAt = Instant.parse("2026-04-30T12:00:08Z")
        `when`(previewRedis.get(previewId)).thenReturn(
            TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.SUCCESS,
                audioUrl = "https://s3/preview.wav",
                errorCode = null,
                errorMessage = null,
                createdAt = createdAt,
                finishedAt = finishedAt,
            )
        )

        val res = service.getStatus(userId = 7L, previewId = previewId)

        assertThat(res.status).isEqualTo("SUCCESS")
        assertThat(res.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(res.createdAt).isEqualTo(createdAt)
        assertThat(res.finishedAt).isEqualTo(finishedAt)
    }

    @Test
    fun `getStatus 404 when previewId missing`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(null)

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.NOT_FOUND)
            }
    }

    @Test
    fun `getStatus 403 when caller is not owner`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(
            TtsPreviewSnapshot(
                previewId = previewId,
                userId = 99L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = Instant.now(),
                finishedAt = null,
            )
        )

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }
}
