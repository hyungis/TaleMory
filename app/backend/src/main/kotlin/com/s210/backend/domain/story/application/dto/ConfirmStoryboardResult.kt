package com.s210.backend.domain.story.application.dto

data class ConfirmStoryboardResult(
    val jobId: Long,
    val jobType: String,        // "TTS"
    val status: String,         // "PENDING" | "SUCCESS"
    val sceneCount: Int,
    val sentenceCount: Int,
    val cacheHits: Int,
    val cacheMisses: Int,
)
