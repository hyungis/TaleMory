package com.s210.backend.domain.storyboard.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.storyboard.application.StoryboardGenerationService
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.presentation.request.GenerateStoryRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 스토리보드 관련 엔드포인트.
 *
 * 현재 MR 범위: 줄거리(본문) 생성 트리거.
 * 상태 조회는 공통 `/api/generation-jobs/{jobId}` (JobController) 가 맡는다.
 * 페이지 조회/편집/확정/삽화 재생성 등은 후속 이슈에서 추가.
 */
@RestController
@RequestMapping("/api/stories/{storyId}/storyboard")
class StoryboardController(
    private val storyboardGenerationService: StoryboardGenerationService,
) {

    /**
     * API 명세 #28 — 스토리보드 줄거리(본문) 생성 요청.
     * HTTP 202 Accepted 로 비동기 작업 시작을 알린다.
     * FE 는 응답의 `jobId` 로 `/api/generation-jobs/{jobId}` 를 polling 한다.
     */
    @PostMapping("/story")
    fun storyboardStoryGenerate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody(required = false) request: GenerateStoryRequest?,
    ): ResponseEntity<ApiResponse<StartGenerationResult>> {
        val result = storyboardGenerationService.generate(
            userId = user.userId,
            storyId = storyId,
            prompt = request?.prompt,
        )
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse(data = result))
    }
}
