package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.voice.application.VoiceService
import com.s210.backend.domain.voice.presentation.response.VoicePreviewResponse
import com.s210.backend.domain.voice.presentation.response.VoiceProfileResponse
import com.s210.backend.domain.voice.presentation.response.VoiceRecordingScriptResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api")
class VoiceController(
    private val voiceService: VoiceService,
) {

    @GetMapping("/voice-recording-script")
    fun voiceRecordingScriptDetails(): ResponseEntity<ApiResponse<VoiceRecordingScriptResponse>> {
        TODO("Not yet implemented")
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

    @PostMapping("/voice-profiles")
    fun voiceProfileAdd(
        @RequestPart("title") title: String,
        @RequestPart("audio") audio: MultipartFile,
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> {
        TODO("Not yet implemented")
    }

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
