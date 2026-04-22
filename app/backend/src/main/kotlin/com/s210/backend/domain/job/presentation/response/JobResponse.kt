package com.s210.backend.domain.job.presentation.response

import java.time.LocalDateTime

data class JobResponse(
    val id: Long,
    val storyId: Long,
    val jobType: String,
    val status: String,
    val startedAt: LocalDateTime?,
    val finishedAt: LocalDateTime?,
    val errorMessage: String?,
    val createdAt: LocalDateTime
)

data class JobStartResponse(
    val jobId: Long,
    val jobType: String,
    val status: String
)
