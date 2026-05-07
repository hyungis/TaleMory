package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.StoryConfirmService
import com.s210.backend.domain.story.application.StoryService
import com.s210.backend.domain.story.application.StoryViewerService
import com.s210.backend.domain.story.presentation.request.CreateStoryRequest
import com.s210.backend.domain.story.presentation.request.ModifyStoryRequest
import com.s210.backend.domain.story.presentation.response.*
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/stories")
class StoryController(
    private val storyService: StoryService,
    private val storyViewerService: StoryViewerService,
    private val storyConfirmService: StoryConfirmService,
) {

    // 동화 목록 조회
    @GetMapping
    fun storyList(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<List<StoryResponse>>> {
        val result = storyService.findStories(user.userId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    @GetMapping("/draft")
    fun storyDraftDetails(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StoryDraftResponse?>> {
        val draft = storyService.findLatestDraft(user.userId)
        val body = draft?.let {
            // 크롬 종료로 sessionStorage 가 비워져도 BE 진실 (stylePresetId / Scene 존재) 기반으로
            // FE 가 Step 5/6/7 의 readOnly 락을 복원할 수 있도록 진행 메타를 함께 내린다.
            StoryDraftResponse(
                storyId = it.id,
                title = it.title,
                difficulty = it.difficulty.name,
                companionsJson = it.companionsJson,
                mainCharacterJson = it.mainCharacterJson,
                travelPlace = it.travelPlace,
                travelStartDate = it.travelStartDate,
                travelEndDate = it.travelEndDate,
                createdAt = it.createdAt,
                stylePresetId = it.stylePresetId,
                voiceProfileId = it.voiceProfileId,
                sceneConfirmed = storyService.existsScenes(it.id),
            )
        }
        return ResponseEntity.ok(ApiResponse(data = body))
    }

    @PostMapping
    fun storyAdd(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody @Valid request: CreateStoryRequest,
    ): ResponseEntity<ApiResponse<StoryCreateResponse>> {
        val result = storyService.addStory(request.toCommand(user.userId))
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = StoryCreateResponse(storyId = result.id)))
    }

    @PatchMapping("/{storyId}")
    fun storyModify(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
        @RequestBody request: ModifyStoryRequest,
    ): ResponseEntity<ApiResponse<StoryCreateResponse>> {
        val result = storyService.modifyStory(user.userId, storyId, request.toCommand())
        return ResponseEntity.ok(ApiResponse(data = StoryCreateResponse(storyId = result.id)))
    }

    // 동화 상세 조회 (추후 구현)
    @GetMapping("/{storyId}")
    fun storyDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        TODO("Not yet implemented")
    }

    // 뷰어 화면 통합 조회 (메타 + scenes + outro)
    @GetMapping("/{storyId}/view")
    fun storyViewDetails(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StoryViewResponse>> {
        val result = storyViewerService.findStoryView(user.userId, storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 동화 삭제
    @DeleteMapping("/{storyId}")
    fun storyRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyService.removeStory(user.userId, storyId)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }

    @PatchMapping("/{storyId}/bookmark")
    fun storyBookmarkModify(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody request: com.s210.backend.domain.story.presentation.request.BookmarkRequest,
    ): ResponseEntity<Unit> {
        storyService.modifyBookmark(user.userId, storyId, request.isBookmarked)
        return ResponseEntity.noContent().build()
    }

    // 최종본 공개
    @PostMapping("/{storyId}/publish")
    fun storyPublish(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<ShareLinkResponse>> {
        val result = storyService.publishStory(user.userId, storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 공유 링크 조회
    @GetMapping("/{storyId}/share-link")
    fun storyShareLinkDetails(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<ShareLinkResponse>> {
        val result = storyService.findShareLink(user.userId, storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 스토리보드 확정 — TTS Job 시작 (비동기 202 Accepted)
    @PostMapping("/{storyId}/storyboard/confirm")
    fun storyboardConfirm(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ConfirmStoryboardResponse>> {
        val result = storyConfirmService.confirmStoryboard(
            storyId = storyId,
            userId = user.userId,
        )
        return ResponseEntity.accepted().body(ApiResponse(data = ConfirmStoryboardResponse(
            jobId = result.jobId,
            jobType = result.jobType,
            status = result.status,
            sceneCount = result.sceneCount,
            sentenceCount = result.sentenceCount,
            cacheHits = result.cacheHits,
            cacheMisses = result.cacheMisses,
            finalIllustrationJobId = result.finalIllustrationJobId,
        )))
    }

}
