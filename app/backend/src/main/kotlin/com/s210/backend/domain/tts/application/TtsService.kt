package com.s210.backend.domain.tts.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service

/**
 * TTS 잡 발행자.
 * - publish: 스토리 전체 TTS (ai.gpu.tts.generate)
 * - publishPreview: 단일 문장 미리듣기 (ai.gpu.tts.preview)
 */
@Service
class TtsService(
    private val rabbitTemplate: RabbitTemplate,
) {
    fun publish(message: StoryTtsJobMessage) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.TTS_GENERATE,
            message,
        )
    }

    fun publishPreview(message: TtsPreviewJobMessage) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.TTS_PREVIEW,
            message,
        )
    }
}
