package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.story.presentation.request.ModifyStoryboardPageRequest
import com.s210.backend.domain.story.presentation.response.StoryboardPageResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/stories/{storyId}/storyboard")
class StoryboardController {

    // 스토리보드 생성 (AI)
    @PostMapping("/generate")
    fun storyboardGenerate(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryboardService.generateStoryboard(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 스토리보드 페이지 목록 조회
    @GetMapping("/pages")
    fun storyboardPageList(@PathVariable storyId: Long): ResponseEntity<ApiResponse<List<StoryboardPageResponse>>> {
        // TODO: StoryboardService.findStoryboardPages(storyId)
        TODO("Not yet implemented")
    }

    // 스토리보드 페이지 직접 편집
    @PatchMapping("/pages/{pageId}")
    fun storyboardPageModify(
        @PathVariable storyId: Long,
        @PathVariable pageId: Long,
        @RequestBody request: ModifyStoryboardPageRequest
    ): ResponseEntity<ApiResponse<StoryboardPageResponse>> {
        // TODO: StoryboardService.modifyStoryboardPage(pageId, command)
        TODO("Not yet implemented")
    }

    // 개별 그림 재생성 (AI)
    @PostMapping("/pages/{pageId}/image/regenerate")
    fun storyboardPageImageRegenerate(
        @PathVariable storyId: Long,
        @PathVariable pageId: Long
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryboardService.regeneratePageImage(pageId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 스토리보드 확정
    @PostMapping("/confirm")
    fun storyboardConfirm(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryboardService.confirmStoryboard(storyId)
        TODO("Not yet implemented")
    }
}
