package com.s210.backend.domain.story.presentation

import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.codec.VoiceProfileId
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.StoryVoiceAssignmentInput
import com.s210.backend.domain.story.application.StoryVoiceAssignmentService
import com.s210.backend.domain.story.entity.StoryVoiceAssignment
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/stories/{storyId}/voice-assignments")
class StoryVoiceAssignmentController(
    private val storyVoiceAssignmentService: StoryVoiceAssignmentService,
) {
    @GetMapping
    fun assignmentList(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: StoryId,
    ): ResponseEntity<ApiResponse<List<StoryVoiceAssignmentResponse>>> {
        val result = storyVoiceAssignmentService.findAssignments(user.userId, storyId.value)
            .map(StoryVoiceAssignmentResponse::from)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    @PutMapping
    fun assignmentReplace(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: StoryId,
        @RequestBody request: StoryVoiceAssignmentReplaceRequest,
    ): ResponseEntity<ApiResponse<List<StoryVoiceAssignmentResponse>>> {
        val result = storyVoiceAssignmentService.replaceAssignments(
            userId = user.userId,
            storyId = storyId.value,
            assignments = request.assignments.map {
                StoryVoiceAssignmentInput(
                    speakerKey = it.speakerKey,
                    speakerName = it.speakerName,
                    voiceProfileId = it.voiceProfileId.value,
                )
            },
        ).map(StoryVoiceAssignmentResponse::from)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    @DeleteMapping
    fun assignmentRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable storyId: StoryId,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyVoiceAssignmentService.removeAssignments(user.userId, storyId.value)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }
}

data class StoryVoiceAssignmentReplaceRequest(
    val assignments: List<StoryVoiceAssignmentItemRequest> = emptyList(),
)

data class StoryVoiceAssignmentItemRequest(
    val speakerKey: String,
    val speakerName: String? = null,
    val voiceProfileId: VoiceProfileId,
)

data class StoryVoiceAssignmentResponse(
    val speakerKey: String,
    val speakerName: String?,
    val voiceProfileId: VoiceProfileId,
) {
    companion object {
        fun from(entity: StoryVoiceAssignment): StoryVoiceAssignmentResponse =
            StoryVoiceAssignmentResponse(
                speakerKey = entity.speakerKey,
                speakerName = entity.speakerName,
                voiceProfileId = VoiceProfileId(entity.voiceProfileId),
            )
    }
}
