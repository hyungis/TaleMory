package com.s210.backend.domain.storyboard.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.storyboard.application.StoryboardGenerationService
import com.s210.backend.domain.storyboard.application.StoryboardImageGenerationService
import com.s210.backend.domain.storyboard.application.StoryboardPageService
import com.s210.backend.domain.storyboard.application.StoryboardSummaryService
import com.s210.backend.domain.storyboard.application.SummaryResponseData
import com.s210.backend.domain.storyboard.application.dto.StartGenerationResult
import com.s210.backend.domain.storyboard.application.dto.StoryBoardResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardPageResult
import com.s210.backend.domain.storyboard.application.dto.StoryboardPagesResult
import com.s210.backend.domain.storyboard.presentation.request.GenerateStoryRequest
import com.s210.backend.domain.storyboard.presentation.request.RegenerateStoryboardImageRequest
import com.s210.backend.domain.storyboard.presentation.request.RegenerateSummaryRequest
import com.s210.backend.domain.storyboard.presentation.request.UpdateStoryboardPageRequest
import com.s210.backend.domain.storyboard.presentation.request.UpdateStoryboardSummaryRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
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
    private val storyboardPageService: StoryboardPageService,
    private val storyboardImageGenerationService: StoryboardImageGenerationService,
    private val storyboardSummaryService: StoryboardSummaryService,
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

    /**
     * 스토리보드 줄거리(요약) 직접 수정 — 옵션 ② 디자인.
     *
     * 유저가 Step 3 result 화면에서 한글 줄거리(summaryKo) textarea 를 편집한 뒤 onBlur 호출.
     * 동기 처리 — 즉시 DB(stories.synopsis / story_board.story / latest summary job's result_payload)
     * 세 곳에 sync 후 반영된 메타 반환.
     *
     * NOTE: 옛 endpoint `PATCH /storyboard/story` 는 "본문 직접 수정" 의미였는데,
     * 옵션 ② 디자인에서 본문은 storyboard_pages 단일 source 가 됐으므로 의미가 사라짐 →
     * 이 endpoint 가 실질적으로 그 역할을 대체하며 의미를 "줄거리(summary) 편집" 으로 명확화.
     */
    @PatchMapping("/summary")
    fun storyboardSummaryUpdate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @Valid @RequestBody request: UpdateStoryboardSummaryRequest,
    ): ResponseEntity<ApiResponse<StoryBoardResult>> {
        val result = storyboardGenerationService.editSummary(
            userId = user.userId,
            storyId = storyId,
            newSummaryKo = request.summaryKo,
        )
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    /**
     * 스토리보드 페이지 list 조회.
     * Step 3(PromptStep) 은 응답을 join 해 통합 본문을 read-only 로 보여주고,
     * Step 4(StoryboardStep) 는 페이지별 카드로 렌더한다.
     *
     * 줄거리 미생성 상태에선 `pages = []` 로 200 응답 (FE placeholder 처리).
     */
    @GetMapping("/pages")
    fun listStoryboardPages(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<StoryboardPagesResult>> {
        val result = storyboardPageService.listPages(
            userId = user.userId,
            storyId = storyId,
        )
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    /**
     * 한 페이지의 한글 본문만 수정.
     * Step 4 의 페이지별 textarea onBlur 시점에 호출된다.
     * - english_text / scene_summary / image_prompt / image_url 은 AI 원본 그대로 둔다.
     */
    @PatchMapping("/pages/{pageNumber}")
    fun updateStoryboardPage(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @PathVariable pageNumber: Int,
        @Valid @RequestBody request: UpdateStoryboardPageRequest,
    ): ResponseEntity<ApiResponse<StoryboardPageResult>> {
        val result = storyboardPageService.updatePageKoreanText(
            userId = user.userId,
            storyId = storyId,
            pageNumber = pageNumber,
            koreanText = request.koreanText,
        )
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    /**
     * 스토리보드 페이지 이미지 배치 생성 (모든 페이지 한번에).
     * 202 Accepted — 비동기. FE 는 응답 jobId 로 `/api/generation-jobs/{jobId}` polling.
     */
    @PostMapping("/images")
    fun storyboardImagesGenerate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<StartGenerationResult>> {
        val result = storyboardImageGenerationService.generate(
            userId = user.userId,
            storyId = storyId,
        )
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse(data = result))
    }

    /**
     * 페이지 단일 이미지 재생성.
     * userPrompt 를 입력으로 받아 같은 seed + 추가 지시문으로 한 페이지만 다시 그린다.
     * 202 Accepted — 비동기.
     */
    @PostMapping("/pages/{pageNumber}/image/regenerate")
    fun storyboardImageRegenerate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @PathVariable pageNumber: Int,
        @Valid @RequestBody request: RegenerateStoryboardImageRequest,
    ): ResponseEntity<ApiResponse<StartGenerationResult>> {
        val result = storyboardImageGenerationService.regenerateOne(
            userId = user.userId,
            storyId = storyId,
            pageNumber = pageNumber,
            userPrompt = request.userPrompt,
        )
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse(data = result))
    }

    /**
     * 스토리보드 줄거리(요약) 생성 요청.
     *
     * 본문 생성과 동일하게 사진/주인공/여행정보를 DB 에서 조립해 AI 로 보낸다.
     * request body 는 옵션 — 사용자 자유 프롬프트가 있으면 `additionalInstruction` 으로 전달.
     * HTTP 202 Accepted — FE 는 응답 jobId 로 `/api/generation-jobs/{jobId}` polling.
     */
    @PostMapping("/summary")
    fun storyboardSummaryGenerate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody(required = false) request: GenerateStoryRequest?,
    ): ResponseEntity<ApiResponse<StartGenerationResult>> {
        val result = storyboardSummaryService.generateSummary(
            userId = user.userId,
            storyId = storyId,
            prompt = request?.prompt,
        )
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse(data = result))
    }

    /**
     * 스토리보드 줄거리(요약) 재생성 요청.
     *
     * 직전 SUCCESS payload + 사용자 자유 프롬프트로 새 잡을 발행.
     * 직전 SUCCESS 가 없으면 404 (`SUMMARY_NOT_FOUND`).
     * HTTP 202 Accepted.
     */
    @PostMapping("/summary/regenerate")
    fun storyboardSummaryRegenerate(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @Valid @RequestBody request: RegenerateSummaryRequest,
    ): ResponseEntity<ApiResponse<StartGenerationResult>> {
        val result = storyboardSummaryService.regenerateSummary(
            userId = user.userId,
            storyId = storyId,
            userPrompt = request.userPrompt,
        )
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse(data = result))
    }

    /**
     * 스토리보드 줄거리(요약) 조회.
     *
     * 가장 최근 STORYBOARD_STORY_SUMMARY 잡 1건 (status 무관) 을 보고 응답.
     * - 잡 없음        → `(null, null, null)`
     * - PENDING/RUNNING → `(null, status, jobId)`
     * - SUCCESS        → `(storyBoard.story, "SUCCESS", jobId)`
     * - FAILED         → `(직전 SUCCESS storyBoard.story 또는 null, "FAILED", jobId)`
     */
    @GetMapping("/summary")
    fun storyboardSummaryGet(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<SummaryResponseData>> {
        val result = storyboardSummaryService.findSummary(
            userId = user.userId,
            storyId = storyId,
        )
        return ResponseEntity.ok(ApiResponse(data = result))
    }
}
