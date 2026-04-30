package com.s210.backend.domain.tts.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Service

/**
 * TTS 잡 발행자. ai.gpu.tts.generate 라우팅키로 StoryTtsJobMessage 발행.
 * 결과는 StoryboardResultListener 가 수신 → TtsResultHandler 로 위임 (Task 10).
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
}
