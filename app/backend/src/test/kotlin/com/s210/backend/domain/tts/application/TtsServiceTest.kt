package com.s210.backend.domain.tts.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.StoryTtsPayload
import com.s210.backend.domain.tts.application.dto.TtsOptions
import com.s210.backend.domain.tts.application.dto.TtsSentenceItem
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate

@ExtendWith(MockitoExtension::class)
class TtsServiceTest {
    private val template: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val service = TtsService(template)

    @Test
    fun `publishes message to ai gpu tts generate routing key`() {
        val payload = StoryTtsPayload(
            storyId = 100,
            voiceId = "42",
            referenceAudioUrl = "https://s3/v.wav",
            options = TtsOptions(),
            sentences = listOf(TtsSentenceItem(1001, "Hello.")),
        )
        val message = StoryTtsJobMessage(jobId = "777", storyId = 100, payload = payload)

        service.publish(message)

        val exchangeCap = ArgumentCaptor.forClass(String::class.java)
        val keyCap = ArgumentCaptor.forClass(String::class.java)
        val bodyCap = ArgumentCaptor.forClass(Any::class.java)
        verify(template).convertAndSend(exchangeCap.capture(), keyCap.capture(), bodyCap.capture())
        assertThat(exchangeCap.value).isEqualTo(RabbitMQConfig.REQUEST_EXCHANGE)
        assertThat(keyCap.value).isEqualTo(RoutingKeys.TTS_GENERATE)
        assertThat(bodyCap.value).isEqualTo(message)
    }
}
