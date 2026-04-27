package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.voice.application.VoiceService
import com.s210.backend.domain.voice.presentation.response.VoicePreviewResponse
import com.s210.backend.domain.voice.presentation.response.VoiceProfileResponse
import com.s210.backend.domain.voice.presentation.response.VoiceRecordingScriptResponse
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api")
class VoiceController(
    private val voiceService: VoiceService,
) {

    // 녹음 스크립트 제공
    @GetMapping("/voice-recording-script")
    fun voiceRecordingScriptDetails(
        @RequestParam(required = false) storyId: Long?,
    ): ResponseEntity<ApiResponse<VoiceRecordingScriptResponse>> {
        val script = voiceService.findRecordingScript(storyId)
        return ResponseEntity.ok(ApiResponse(data = VoiceRecordingScriptResponse(script)))
    }

    // 음성 프로필 목록 조회
    @GetMapping("/voice-profiles")
    fun voiceProfileList(
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<List<VoiceProfileResponse>>> {
        val results = voiceService.findVoiceProfiles(user.userId)
        val response = results.map {
            VoiceProfileResponse(
                id = it.id,
                title = it.title,
                audioUrl = it.audioUrl,
                ttsVoiceUrl = it.ttsVoiceUrl,
                createdAt = it.createdAt,
            )
        }
        return ResponseEntity.ok(ApiResponse(data = response))
    }

    // 음성 녹음 저장 (presigned URL 발급)
    @PostMapping("/voice-profiles")
    fun voiceProfileAdd(
        @AuthenticationPrincipal user: CustomUser,
        @RequestBody body: VoiceProfileCreateRequest,
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> {
        val result = voiceService.addVoiceProfile(user.userId, body.title, body.contentType)
        val response = VoiceProfileResponse(
            id = result.profile.id,
            title = result.profile.title,
            audioUrl = result.profile.audioUrl,
            ttsVoiceUrl = result.profile.ttsVoiceUrl,
            createdAt = result.profile.createdAt,
            uploadUrl = result.uploadUrl,
        )
        return ResponseEntity.ok(ApiResponse(data = response))
    }

    data class VoiceProfileCreateRequest(
        val title: String,
        val contentType: String = "audio/webm",
    )

    // 음성 프로필 삭제
    @DeleteMapping("/voice-profiles/{voiceProfileId}")
    fun voiceProfileRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable voiceProfileId: Long,
    ): ResponseEntity<ApiResponse<Unit>> {
        voiceService.removeVoiceProfile(user.userId, voiceProfileId)
        return ResponseEntity.noContent().build()
    }

    // TTS 미리 듣기 — 후속 작업에서 구현 예정
    @PostMapping("/voice-profiles/{voiceProfileId}/preview")
    fun voiceProfilePreview(@PathVariable voiceProfileId: Long): ResponseEntity<ApiResponse<VoicePreviewResponse>> {
        // TODO: VoiceService.previewVoice(voiceProfileId) — TTS 서버 연동 후 구현
        TODO("Not yet implemented")
    }
}
