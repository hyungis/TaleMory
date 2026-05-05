package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.story.application.StoryViewerService
import com.s210.backend.domain.story.presentation.response.StoryViewResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/public/stories")
class PublicStoryController(
    private val storyViewerService: StoryViewerService,
) {

    @GetMapping("/sample")
    fun sampleStoryDetails(): ResponseEntity<ApiResponse<StoryViewResponse>> {
        val result = storyViewerService.findSampleStoryView()
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    @GetMapping("/{shareToken}")
    fun storyPublicDetails(@PathVariable shareToken: String): ResponseEntity<ApiResponse<StoryViewResponse>> {
        val result = storyViewerService.findPublicStoryView(shareToken)
        return ResponseEntity.ok(ApiResponse(data = result))
    }
}
