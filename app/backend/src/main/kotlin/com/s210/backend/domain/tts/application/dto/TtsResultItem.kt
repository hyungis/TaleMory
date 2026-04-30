package com.s210.backend.domain.tts.application.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class TtsResultItem(
    val sentenceId: Long,
    val appliedStyle: AppliedStyle,
    val audio: TtsAudio?,             // null 가능 (부분 실패)
)
