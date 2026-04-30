package com.s210.backend.domain.tts.application.dto

/**
 * BE → AI RabbitMQ 미리듣기 요청 메시지.
 * AI 워커는 `ai.gpu.tts.preview.request.queue` 에서 수신.
 */
data class TtsPreviewJobMessage(
    val jobId: String,
    val jobType: String = "TTS_PREVIEW",
    val text: String,
    val language: String = "en-US",
    val referenceAudioUrl: String? = null,
    val referenceAudioS3Key: String? = null,
    val options: VoicePreviewOptions = VoicePreviewOptions(),
)
