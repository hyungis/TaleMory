package com.s210.backend.domain.storyboard.application.dto

data class StorySentenceTranslationJobMessage(
    val jobId: String,
    val jobType: String = "STORY_SENTENCE_TRANSLATION",
    val storyId: Long,
    val pageNumber: Int,
    val payload: StorySentenceTranslationRequestPayload,
)

data class StorySentenceTranslationRequestPayload(
    val pageNumber: Int? = null,
    val koreanText: String,
)
