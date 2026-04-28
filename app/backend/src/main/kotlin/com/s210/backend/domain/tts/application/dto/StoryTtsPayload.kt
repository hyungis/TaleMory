package com.s210.backend.domain.tts.application.dto

data class StoryTtsPayload(
    val storyId: Long,
    val voiceId: String,                // voice_profile_id String 화 (예: "42")
    val referenceAudioUrl: String,      // S3 URL — AI가 voiceId 처음 사용 시 다운로드 + 로컬 캐시
    val language: String = "en-US",
    val format: String = "wav",
    val options: TtsOptions,
    val sentences: List<TtsSentenceItem>,
)
