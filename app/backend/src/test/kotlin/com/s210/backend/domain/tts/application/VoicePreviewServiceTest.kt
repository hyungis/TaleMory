package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.common.redis.TtsPreviewRedisRepository
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class VoicePreviewServiceTest {

    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val previewRedis: TtsPreviewRedisRepository = mock(TtsPreviewRedisRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val ttsService = TtsService(rabbitTemplate)

    private val service = VoicePreviewService(
        voiceProfileRepository = voiceProfileRepository,
        previewRedis = previewRedis,
        ttsService = ttsService,
    )

    private fun voiceProfile(
        id: Long = 42L,
        userId: Long = 7L,
        audioUrl: String? = "stories/voice/7/reference.wav",
    ) = VoiceProfile(
        id = id,
        userId = userId,
        title = "sample",
        audioUrl = audioUrl,
    )

    @Test
    fun `preview rejects blank text`() {
        assertThatThrownBy { service.preview(7L, 42L, "   ") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            }
    }

    @Test
    fun `preview rejects another user's voice profile`() {
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(voiceProfile(userId = 99L))

        assertThatThrownBy { service.preview(7L, 42L, "Hello world") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }

    @Test
    fun `preview rejects voice profile without audio source`() {
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(voiceProfile(audioUrl = null))

        assertThatThrownBy { service.preview(7L, 42L, "Hello world") }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            }
    }

    @Test
    fun `preview creates Redis pending entry and publishes message with previewId as jobId`() {
        val profile = voiceProfile()
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(profile)

        val previewId = service.preview(
            userId = 7L,
            voiceProfileId = 42L,
            text = "Hello world",
            emotion = "NEUTRAL",
            language = "ko-KR",
        )

        assertThat(previewId).isNotBlank()
        assertThat(UUID.fromString(previewId)).isNotNull()

        verify(previewRedis).createPending(
            previewId = previewId,
            userId = 7L,
            voiceProfileId = 42L,
        )

        val exchangeCaptor = ArgumentCaptor.forClass(String::class.java)
        val routingKeyCaptor = ArgumentCaptor.forClass(String::class.java)
        val messageCaptor = ArgumentCaptor.forClass(Any::class.java)
        verify(rabbitTemplate).convertAndSend(exchangeCaptor.capture(), routingKeyCaptor.capture(), messageCaptor.capture())
        assertThat(exchangeCaptor.value).isEqualTo(RabbitMQConfig.REQUEST_EXCHANGE)
        assertThat(routingKeyCaptor.value).isEqualTo(RoutingKeys.TTS_PREVIEW)
        val message = messageCaptor.value as TtsPreviewJobMessage
        assertThat(message.jobId).isEqualTo(previewId)
        assertThat(message.voiceId).isEqualTo("42")
        assertThat(message.payload.text).isEqualTo("Hello world")
        assertThat(message.payload.language).isEqualTo("ko-KR")
        assertThat(message.payload.referenceAudioS3Key).isEqualTo("stories/voice/7/reference.wav")
        assertThat(message.payload.referenceAudioUrl).isNull()
        assertThat(message.payload.options.emotion).isEqualTo("NEUTRAL")
    }

    @Test
    fun `getStatus returns response from snapshot when caller owns the preview`() {
        val previewId = UUID.randomUUID().toString()
        val createdAt = java.time.Instant.parse("2026-04-30T12:00:00Z")
        val finishedAt = java.time.Instant.parse("2026-04-30T12:00:08Z")
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = com.s210.backend.domain.job.model.JobStatus.SUCCESS,
                audioUrl = "https://s3/preview.wav",
                errorCode = null,
                errorMessage = null,
                createdAt = createdAt,
                finishedAt = finishedAt,
            )
        )

        val response = service.getStatus(userId = 7L, previewId = previewId)

        assertThat(response.previewId).isEqualTo(previewId)
        assertThat(response.status).isEqualTo("SUCCESS")
        assertThat(response.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(response.createdAt).isEqualTo(createdAt)
        assertThat(response.finishedAt).isEqualTo(finishedAt)
    }

    @Test
    fun `getStatus throws NOT_FOUND when previewId missing or expired`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(null)

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.NOT_FOUND)
            }
    }

    @Test
    fun `getStatus throws FORBIDDEN when caller is not the owner`() {
        val previewId = UUID.randomUUID().toString()
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 99L,
                voiceProfileId = 42L,
                status = com.s210.backend.domain.job.model.JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )

        assertThatThrownBy { service.getStatus(userId = 7L, previewId = previewId) }
            .isInstanceOfSatisfying(BusinessException::class.java) { ex ->
                assertThat(ex.errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            }
    }
}
