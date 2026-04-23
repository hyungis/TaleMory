package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.common.response.PageResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.StoryService
import com.s210.backend.domain.story.presentation.request.CreateStoryRequest
import com.s210.backend.domain.story.presentation.response.ShareLinkResponse
import com.s210.backend.domain.story.presentation.response.StoryCreateResponse
import com.s210.backend.domain.story.presentation.response.StoryDetailResponse
import com.s210.backend.domain.story.presentation.response.StoryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/stories")
class StoryController(
    private val storyService: StoryService,
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

    /**
     * 동화 기본 정보 생성 — Step 1 (BasicInfoStep) 종료 시 1회 호출.
     * 성공 시 201 CREATED + `{ storyId }` 만 응답. FE 는 이 id 로 step 2~8 리소스를 참조.
     */
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

    // 동화 상세 조회
    @GetMapping("/{storyId}")
    fun storyDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.findStory(storyId)
        TODO("Not yet implemented")
    }

    // 동화 삭제
    @DeleteMapping("/{storyId}")
    fun storyRemove(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.removeStory(storyId)
        TODO("Not yet implemented")
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
