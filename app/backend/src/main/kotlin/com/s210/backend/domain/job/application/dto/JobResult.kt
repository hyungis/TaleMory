package com.s210.backend.domain.job.application.dto

import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import java.time.LocalDateTime

data class JobResult(
    val id: Long,
    val storyId: Long,
    val jobType: JobType,
    val status: JobStatus,
    val startedAt: LocalDateTime?,
    val finishedAt: LocalDateTime?,
    val errorMessage: String?,
    val createdAt: LocalDateTime
)
