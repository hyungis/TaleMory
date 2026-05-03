package com.s210.backend.domain.tts.application

import com.s210.backend.common.mq.RabbitMQConfig
import com.s210.backend.common.mq.RoutingKeys
import com.s210.backend.domain.tts.application.dto.StoryTtsJobMessage
import com.s210.backend.domain.tts.application.dto.TtsPreviewJobMessage
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.slf4j.LoggerFactory
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
    private val log = LoggerFactory.getLogger(javaClass)

    fun publish(message: StoryTtsJobMessage) {
        val started = System.nanoTime()
        val sentenceCount = message.payload.sentences.size
        log.info(
            "[TTS:REQ:PUBLISH:START] jobId={}, storyId={}, voiceId={}, sentenceCount={}",
            message.jobId, message.storyId, message.payload.voiceId, sentenceCount,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.TTS_GENERATE,
            message,
        )
        log.info(
            "[TTS:REQ:PUBLISH:DONE] jobId={}, storyId={}, sentenceCount={}, elapsedMs={}",
            message.jobId, message.storyId, sentenceCount, elapsedMs(started),
        )
    }

    fun publishPreview(message: TtsPreviewJobMessage) {
        val started = System.nanoTime()
        log.info(
            "[TTS_PREVIEW:REQ:PUBLISH:START] previewId={}, voiceId={}, textLen={}",
            message.jobId, message.voiceId, message.payload.text.length,
        )
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.REQUEST_EXCHANGE,
            RoutingKeys.TTS_PREVIEW,
            message,
        )
        log.info(
            "[TTS_PREVIEW:REQ:PUBLISH:DONE] previewId={}, voiceId={}, elapsedMs={}",
            message.jobId, message.voiceId, elapsedMs(started),
        )
    }

    private fun elapsedMs(started: Long): Long =
        (System.nanoTime() - started) / 1_000_000
}
