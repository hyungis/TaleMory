package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * AI → BE TTS 결과의 sentence 단위 update item.
 *
 * AI 측 `TtsSentenceUpdate` (`mq_tts.py`) 와 매핑:
 *   - sentenceId, ttsAudioUrl : required
 *   - ttsAudioS3Key           : nullable (TTS_STORAGE_MODE=local 일 때 AI 가 null 송신)
 *
 * 과거 ttsAudioS3Key 가 non-null 이었던 탓에 local 모드 envelope 가 KotlinInvalidNullException 으로
 * deserialize 실패 → @Transactional rollback → ack 실패로 BE 가 결과를 영구히 처리 못 하던 버그가 있었음.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SceneSentenceUpdate(
    val sentenceId: Long,
    val ttsAudioUrl: String,
    val ttsAudioS3Key: String? = null,
)
