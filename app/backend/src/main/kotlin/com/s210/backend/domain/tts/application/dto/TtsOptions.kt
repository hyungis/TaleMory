package com.s210.backend.domain.tts.application.dto

/**
 * TTS 잡 publish 시 함께 보내는 옵션. AI 측 StoryTtsOptions 와 1:1 매칭.
 *
 * defaultEmotion: AI 측 EmotionType Literal 이라 null 보내면 422.
 *   기본 "NEUTRAL" — story/TTS 공통 emotion enum의 안전한 기본값.
 */
data class TtsOptions(
    val defaultEmotion: String = "NEUTRAL",
    val generateFullBookAudio: Boolean = false,
)
