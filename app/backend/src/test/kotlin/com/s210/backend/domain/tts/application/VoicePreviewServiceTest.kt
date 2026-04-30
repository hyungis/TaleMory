package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.databind.ObjectMapper

@ExtendWith(MockitoExtension::class)
class VoicePreviewServiceTest {

    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val ttsService = TtsService(rabbitTemplate)
    private val objectMapper = ObjectMapper()

    private val service = VoicePreviewService(
        voiceProfileRepository = voiceProfileRepository,
        jobRepository = jobRepository,
        ttsService = ttsService,
        objectMapper = objectMapper,
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
    fun `preview saves job and publishes voiceId plus payload message`() {
        val profile = voiceProfile()
        val savedJob = StoryGenerationJob(
            id = 55L,
            storyId = 0L,
            jobType = JobType.TTS_PREVIEW,
        )
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(profile)
        doReturn(savedJob).`when`(jobRepository).save(org.mockito.ArgumentMatchers.any(StoryGenerationJob::class.java))

        val result = service.preview(
            userId = 7L,
            voiceProfileId = 42L,
            text = "Hello world",
            emotion = "NEUTRAL",
            language = "ko-KR",
        )

        assertThat(result).isEqualTo(55L)

        val exchangeCaptor = ArgumentCaptor.forClass(String::class.java)
        val routingKeyCaptor = ArgumentCaptor.forClass(String::class.java)
        val messageCaptor = ArgumentCaptor.forClass(Any::class.java)
        verify(rabbitTemplate).convertAndSend(exchangeCaptor.capture(), routingKeyCaptor.capture(), messageCaptor.capture())
        assertThat(exchangeCaptor.value).isEqualTo(RabbitMQConfig.REQUEST_EXCHANGE)
        assertThat(routingKeyCaptor.value).isEqualTo(RoutingKeys.TTS_PREVIEW)
        val message = messageCaptor.value as TtsPreviewJobMessage
        assertThat(message.jobId).isEqualTo("55")
        assertThat(message.voiceId).isEqualTo("42")
        assertThat(message.payload.text).isEqualTo("Hello world")
        assertThat(message.payload.language).isEqualTo("ko-KR")
        assertThat(message.payload.referenceAudioS3Key).isEqualTo("stories/voice/7/reference.wav")
        assertThat(message.payload.referenceAudioUrl).isNull()
        assertThat(message.payload.options.emotion).isEqualTo("NEUTRAL")
    }
}
