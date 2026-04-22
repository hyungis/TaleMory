package com.s210.backend.domain.job.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.job.presentation.response.JobResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/generation-jobs")
class JobController {

    // 생성 작업 상태 조회
    @GetMapping("/{jobId}")
    fun jobDetails(@PathVariable jobId: Long): ResponseEntity<ApiResponse<JobResponse>> {
        // TODO: JobService.findJob(jobId)
        TODO("Not yet implemented")
    }
}
