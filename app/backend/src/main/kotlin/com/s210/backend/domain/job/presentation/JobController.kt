package com.s210.backend.domain.job.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.job.application.JobService
import com.s210.backend.domain.job.presentation.response.JobResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 생성 작업 (AI 비동기 파이프라인) 조회 엔드포인트.
 * API 명세 #56 — FE 의 polling 대상.
 */
@RestController
@RequestMapping("/api/generation-jobs")
class JobController(
    private val jobService: JobService,
) {

    @GetMapping("/{jobId}")
    fun jobDetails(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable jobId: Long,
    ): ResponseEntity<ApiResponse<JobResponse>> {
        val response = jobService.findJob(user.userId, jobId)
        return ResponseEntity.ok(ApiResponse(data = response))
    }
}
