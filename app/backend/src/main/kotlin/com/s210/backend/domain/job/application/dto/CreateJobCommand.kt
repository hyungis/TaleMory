package com.s210.backend.domain.job.application.dto

import com.s210.backend.domain.job.model.JobType

data class CreateJobCommand(
    val storyId: Long,
    val jobType: JobType,
    val sceneId: Long? = null,
    val sentenceId: Long? = null,
    val requestPayload: String? = null
)
