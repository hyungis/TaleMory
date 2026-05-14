package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * AI → BE TTS audio asset 메타.
 *
 * AI 측 `TtsAudioAsset` (`mq_tts.py`) 와 매핑:
 *   - audioUrl, format : required
 *   - s3Key            : nullable (TTS_STORAGE_MODE=local 일 때 AI 가 null 송신)
 *   - durationMs       : nullable (AI 가 wave 파싱 실패 케이스 등에서 null 가능)
 *
 * 과거 s3Key/durationMs 가 non-null 이었던 탓에 local 모드 envelope 가 KotlinInvalidNullException 으로
 * deserialize 실패 → @Transactional rollback → ack 실패로 BE 가 결과를 영구히 처리 못 하던 버그가 있었음.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class TtsAudio(
    val audioUrl: String,
    val s3Key: String? = null,
    val durationMs: Long? = null,
    val format: String,
)
