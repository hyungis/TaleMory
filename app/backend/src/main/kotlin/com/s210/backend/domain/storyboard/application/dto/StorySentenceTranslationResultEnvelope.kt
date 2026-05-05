package com.s210.backend.domain.storyboard.application.dto

data class StorySentenceTranslationResultEnvelope(
    val jobId: String,
    val type: String,
    val storyId: Long? = null,
    val pageNumber: Int? = null,
    val status: String,
    val payload: StorySentenceTranslationResultPayload? = null,
    val error: StoryError? = null,
)

data class StorySentenceTranslationResultPayload(
    val sentences: List<StorySentenceDto>,
    val englishText: String,
    val koreanText: String,
    val sentenceCount: Int,
    val wordCount: Int,
    val usage: UsageInfo,
)

