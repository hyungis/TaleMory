package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.common.response.PageResponse
import com.s210.backend.domain.auth.entity.CustomUser
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
) {

    // 동화 목록 조회
    @GetMapping
    fun storyList(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<StoryResponse>>> {
        // TODO: StoryService.findStories(userId, page, size)
        TODO("Not yet implemented")
    }

    @GetMapping("/draft")
    fun storyDraftDetails(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StoryDraftResponse?>> {
        val draft = storyService.findLatestDraft(user.userId)
        val body = draft?.let {
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

    // 동화 상세 조회
    @GetMapping("/{storyId}")
    fun storyDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.findStory(storyId)
        TODO("Not yet implemented")
    }

    // 뷰어 화면 통합 조회 (메타 + scenes + outro)
    @GetMapping("/{storyId}/view")
    fun storyViewDetails(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StoryViewResponse>> {
        val result = storyViewerService.findStoryView(user.username, storyId)
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

    // 즐겨찾기 토글
    @PatchMapping("/{storyId}/bookmark")
    fun storyBookmarkModify(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.toggleBookmark(storyId)
        TODO("Not yet implemented")
    }

    // 최종본 공개
    @PostMapping("/{storyId}/publish")
    fun storyPublish(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.publishStory(storyId)
        TODO("Not yet implemented")
    }

    // 공유 링크 조회
    @GetMapping("/{storyId}/share-link")
    fun storyShareLinkDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<ShareLinkResponse>> {
        // TODO: StoryService.findShareLink(storyId)
        TODO("Not yet implemented")
    }

    // 공개 동화 조회 (비로그인 접근 가능)
    @GetMapping("/public/{shareToken}")
    fun storyPublicDetails(@PathVariable shareToken: String): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.findPublicStory(shareToken)
        TODO("Not yet implemented")
    }
}
