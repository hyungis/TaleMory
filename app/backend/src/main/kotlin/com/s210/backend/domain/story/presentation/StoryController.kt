package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.common.response.PageResponse
import com.s210.backend.domain.story.presentation.request.CreateStoryRequest
import com.s210.backend.domain.story.presentation.response.*
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/stories")
class StoryController {

    // 동화 목록 조회
    @GetMapping
    fun storyList(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int
    ): ResponseEntity<ApiResponse<PageResponse<StoryResponse>>> {
        // TODO: StoryService.findStories(userId, page, size)
        TODO("Not yet implemented")
    }

    // 동화 기본 정보 생성
    @PostMapping
    fun storyAdd(@RequestBody request: CreateStoryRequest): ResponseEntity<ApiResponse<StoryDetailResponse>> {
        // TODO: StoryService.addStory(userId, command)
        TODO("Not yet implemented")
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
