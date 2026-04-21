package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.voice.presentation.request.CreateVoiceProfileRequest
import com.s210.backend.domain.voice.presentation.response.VoicePreviewResponse
import com.s210.backend.domain.voice.presentation.response.VoiceProfileResponse
import com.s210.backend.domain.voice.presentation.response.VoiceRecordingScriptResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api")
class VoiceController {

    // 녹음 스크립트 제공
    @GetMapping("/voice-recording-script")
    fun voiceRecordingScriptDetails(): ResponseEntity<ApiResponse<VoiceRecordingScriptResponse>> {
        // TODO: VoiceService.findRecordingScript()
        TODO("Not yet implemented")
    }

    // 음성 프로필 목록 조회
    @GetMapping("/voice-profiles")
    fun voiceProfileList(): ResponseEntity<ApiResponse<List<VoiceProfileResponse>>> {
        // TODO: VoiceService.findVoiceProfiles(userId)
        TODO("Not yet implemented")
    }

    // 음성 녹음 저장 (multipart)
    @PostMapping("/voice-profiles")
    fun voiceProfileAdd(
        @RequestPart("title") title: String,
        @RequestPart("audio") audio: MultipartFile
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> {
        // TODO: VoiceService.addVoiceProfile(userId, title, audio)
        TODO("Not yet implemented")
    }

    // 음성 프로필 삭제
    @DeleteMapping("/voice-profiles/{voiceProfileId}")
    fun voiceProfileRemove(@PathVariable voiceProfileId: Long): ResponseEntity<ApiResponse<Unit>> {
        // TODO: VoiceService.removeVoiceProfile(voiceProfileId)
        TODO("Not yet implemented")
    }

    // TTS 미리 듣기
    @PostMapping("/voice-profiles/{voiceProfileId}/preview")
    fun voiceProfilePreview(@PathVariable voiceProfileId: Long): ResponseEntity<ApiResponse<VoicePreviewResponse>> {
        // TODO: VoiceService.previewVoice(voiceProfileId)
        TODO("Not yet implemented")
    }
}
