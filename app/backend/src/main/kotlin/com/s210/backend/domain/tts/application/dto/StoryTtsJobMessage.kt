package com.s210.backend.domain.tts.application.dto

/**
 * BE → AI MQ 발행 메시지 (routing key: ai.gpu.tts.generate).
 *
 * envelope 구조는 기존 STORY/IMAGE 메시지와 동일한 4필드 패턴 답습:
 * {jobId, jobType, action, storyId, payload}.
 */
data class StoryTtsJobMessage(
    val jobId: String,
    val jobType: String = "TTS",
    val action: String = "GENERATE",
    val storyId: Long,
    val payload: StoryTtsPayload,
)
