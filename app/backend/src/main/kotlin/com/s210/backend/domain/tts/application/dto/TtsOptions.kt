package com.s210.backend.domain.tts.application.dto

/**
 * TTS 잡 publish 시 함께 보내는 옵션. AI 측 StoryTtsOptions 와 1:1 매칭.
 *
 * defaultEmotion: AI 측 EmotionType Literal 이라 null 보내면 422.
 *   기본 "NARRATION" — 동화 본문 읽기에 적합한 중립 톤.
 */
data class TtsOptions(
    val defaultEmotion: String = "NARRATION",
    val generateFullBookAudio: Boolean = false,
)
