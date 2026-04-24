package com.s210.backend.domain.job.entity

import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import jakarta.persistence.*
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "story_generation_jobs")
class StoryGenerationJob(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "story_id", nullable = false)
    val storyId: Long,

    @Column(name = "sentence_id")
    val sentenceId: Long? = null,

    @Column(name = "scene_id")
    val sceneId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false)
    val jobType: JobType,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: JobStatus = JobStatus.PENDING,

    @Column(name = "request_payload", columnDefinition = "JSON")
    var requestPayload: String? = null,

    @Column(name = "result_payload", columnDefinition = "JSON")
    var resultPayload: String? = null,

    @Column(name = "error_message", columnDefinition = "TEXT")
    var errorMessage: String? = null,

    @Column(name = "cost_usd", precision = 10, scale = 4)
    var costUsd: BigDecimal? = null,

    @Column(name = "started_at")
    var startedAt: LocalDateTime? = null,

    @Column(name = "finished_at")
    var finishedAt: LocalDateTime? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
