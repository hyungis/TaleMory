package com.s210.backend.domain.tts.application.dto

data class TtsSentenceItem(
    val sentenceId: Long,    // scene_sentences.id
    val text: String,        // english_text
    val emotion: String? = null,
    val stylePrompt: String? = null,
)
