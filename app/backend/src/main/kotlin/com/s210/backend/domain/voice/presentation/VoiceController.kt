package com.s210.backend.domain.voice.presentation

import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.codec.VoiceProfileId
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.tts.application.VoicePreviewService
import com.s210.backend.domain.tts.presentation.response.TtsPreviewStatusResponse
import com.s210.backend.domain.voice.application.VoiceService
import com.s210.backend.domain.voice.presentation.request.VoicePreviewApiRequest
import com.s210.backend.domain.voice.presentation.response.VoicePreviewJobResponse
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
@RequestMapping("/api")
class VoiceController(
    private val voiceService: VoiceService,
    private val voicePreviewService: VoicePreviewService,
) {

    @GetMapping("/voice-recording-script")
    fun voiceRecordingScriptDetails(
        @RequestParam(required = false) storyId: StoryId?,
    ): ResponseEntity<ApiResponse<VoiceRecordingScriptResponse>> {
        val script = voiceService.findRecordingScript(storyId?.value)
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
        @PathVariable voiceProfileId: VoiceProfileId,
    ): ResponseEntity<ApiResponse<VoiceProfileResponse>> =
        ResponseEntity.ok(
            ApiResponse(
                data = VoiceProfileResponse.from(
                    voiceService.findVoiceProfile(user.userId, voiceProfileId.value),
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
        val result = voiceService.addVoiceProfile(
            userId = user.userId,
            title = body.title,
            s3Key = body.s3Key,
            overwrite = body.overwrite ?: false,
        )
        return ResponseEntity.ok(
            ApiResponse(data = VoiceProfileResponse.from(result)),
        )
    }

    /**
     * @property overwrite 같은 제목의 활성 보이스가 있을 때:
     *   - null/false: 409 DUPLICATE_TITLE 응답 (FE 가 확인 모달 노출 후 사용자 선택)
     *   - true: 기존 row 의 audioUrl in-place 교체 (voiceProfileId 유지)
     *   FE 첫 시도엔 미전송, 사용자가 [덮어쓰기] 클릭 시 같은 요청을 overwrite=true 로 재전송.
     */
    data class VoiceProfileCreateRequest(
        val title: String,
        val s3Key: String,
        val overwrite: Boolean? = null,
    )

    @DeleteMapping("/voice-profiles/{voiceProfileId}")
    fun voiceProfileRemove(
        @AuthenticationPrincipal user: CustomUser,
        @PathVariable voiceProfileId: VoiceProfileId,
    ): ResponseEntity<ApiResponse<Unit>> {
        voiceService.removeVoiceProfile(user.userId, voiceProfileId.value)
        return ResponseEntity.ok(ApiResponse(data = Unit))
    }

    @PostMapping("/voice-profiles/{voiceProfileId}/preview")
    fun voiceProfilePreview(
        @PathVariable voiceProfileId: VoiceProfileId,
        @RequestBody request: VoicePreviewApiRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<VoicePreviewJobResponse>> {
        val previewId = voicePreviewService.preview(
            userId = user.userId,
            voiceProfileId = voiceProfileId.value,
            text = request.text,
            emotion = request.emotion,
            language = request.language,
        )
        return ResponseEntity
            .accepted()
            .body(ApiResponse(data = VoicePreviewJobResponse(previewId = previewId)))
    }

    @GetMapping("/voice-profiles/previews/{previewId}")
    fun voicePreviewStatus(
        @PathVariable previewId: String,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<TtsPreviewStatusResponse>> {
        val response = voicePreviewService.getStatus(user.userId, previewId)
        return ResponseEntity.ok(ApiResponse(data = response))
    }
}
