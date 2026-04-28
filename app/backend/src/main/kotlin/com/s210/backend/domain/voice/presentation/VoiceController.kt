package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.voice.application.VoiceService
import com.s210.backend.domain.voice.presentation.response.VoicePreviewResponse
import com.s210.backend.domain.voice.presentation.response.VoicePresignResponse
import com.s210.backend.domain.voice.presentation.response.VoiceProfileResponse
import com.s210.backend.domain.voice.presentation.response.VoiceRecordingScriptResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping(value = ["/api", "/api/v1"])
class VoiceController(
    private val voiceService: VoiceService,
) {

    @GetMapping("/voice-recording-script")
    fun voiceRecordingScriptDetails(
        @RequestParam(required = false) storyId: Long?,
    ): ResponseEntity<ApiResponse<VoiceRecordingScriptResponse>> {
        val script = voiceService.findRecordingScript(storyId)
        return ResponseEntity.ok(ApiResponse(data = VoiceRecordingScriptResponse(script)))
    }

    @GetMapping("/voice-profiles")
    fun voiceProfileList(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<List<VoiceProfileResponse>>> =
        ResponseEntity.ok(
            ApiResponse(
                data = voiceService.findVoiceProfiles(user.userId).map(VoiceProfileResponse::from),
            ),
        )

    @GetMapping("/voice-profiles/{voiceProfileId}")
    fun voiceProfileDetails(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable voiceProfileId: Long,
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> =
        ResponseEntity.ok(
            ApiResponse(
                data = VoiceProfileResponse.from(
                    voiceService.findVoiceProfile(user.userId, voiceProfileId),
                ),
            ),
        )

    // Phase 1: presigned PUT URL 발급 (DB 저장 없음)
    @PostMapping("/voice-profiles/presigned-url")
    fun voiceProfilePresignedUrl(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody body: VoicePresignRequest,
    ): ResponseEntity<ApiResponse<VoicePresignResponse>> {
        val presigned = voiceService.presignVoiceUpload(user.userId, body.contentType)
        return ResponseEntity.ok(
            ApiResponse(
                data = VoicePresignResponse(
                    uploadUrl = presigned.uploadUrl,
                    s3Key = presigned.s3Key,
                    expiresAt = presigned.expiresAt,
                ),
            ),
        )
    }

    data class VoicePresignRequest(
        val contentType: String = "audio/webm",
    )

    // Phase 3: S3 업로드 완료 후 DB commit
    @PostMapping("/voice-profiles")
    fun voiceProfileAdd(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody body: VoiceProfileCreateRequest,
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> {
        val result = voiceService.addVoiceProfile(user.userId, body.title, body.s3Key)
        return ResponseEntity.ok(
            ApiResponse(data = VoiceProfileResponse.from(result)),
        )
    }

    data class VoiceProfileCreateRequest(
        val title: String,
        val s3Key: String,
    )

    @DeleteMapping("/voice-profiles/{voiceProfileId}")
    fun voiceProfileRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable voiceProfileId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        voiceService.removeVoiceProfile(user.userId, voiceProfileId)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }

    @PostMapping("/voice-profiles/{voiceProfileId}/preview")
    fun voiceProfilePreview(
        @PathVariable voiceProfileId: Long,
    ): ResponseEntity<ApiResponse<VoicePreviewResponse>> {
        TODO("Not yet implemented")
    }
}
