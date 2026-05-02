package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.HighlightOutroService
import com.s210.backend.domain.story.application.SceneIllustrationService
import com.s210.backend.domain.story.application.StoryProgressService
import com.s210.backend.domain.story.application.StoryService
import com.s210.backend.domain.story.presentation.request.BgmRequest
import com.s210.backend.domain.story.presentation.request.HighlightVoiceCommitRequest
import com.s210.backend.domain.story.presentation.request.IllustrationRegenerateRequest
import com.s210.backend.domain.story.presentation.request.OutroRequest
import com.s210.backend.domain.story.presentation.request.OutroVoiceCommitRequest
import com.s210.backend.domain.story.presentation.request.PresignedUrlRequest
import com.s210.backend.domain.story.presentation.request.ProgressRequest
import com.s210.backend.domain.story.presentation.request.StyleModifyRequest
import com.s210.backend.domain.story.presentation.request.VoiceProfileModifyRequest
import com.s210.backend.domain.story.presentation.response.HighlightVoiceResponse
import com.s210.backend.domain.story.presentation.response.IllustrationRegenerateResponse
import com.s210.backend.domain.story.presentation.response.IllustrationRollbackResponse
import com.s210.backend.domain.story.presentation.response.OutroResponse
import com.s210.backend.domain.story.presentation.response.PresignedUrlResponse
import com.s210.backend.domain.story.presentation.response.ProgressResponse
import com.s210.backend.domain.story.presentation.response.SceneResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/stories/{storyId}")
class SceneController(
    private val storyProgressService: StoryProgressService,
    private val storyService: StoryService,
    private val highlightOutroService: HighlightOutroService,
    private val sceneIllustrationService: SceneIllustrationService,
) {

    // 동화 씬(페이지) 목록 조회
    @GetMapping("/scenes")
    fun sceneList(@PathVariable storyId: Long): ResponseEntity<ApiResponse<List<SceneResponse>>> {
        val result = highlightOutroService.findScenes(storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    @PostMapping("/scenes/{sceneId}/illustration/regenerate")
    fun sceneIllustrationRegenerate(
        @PathVariable storyId: Long,
        @PathVariable sceneId: Long,
        @RequestBody request: IllustrationRegenerateRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRegenerateResponse>> {
        val result = sceneIllustrationService.regenerateIllustration(
            userId = user.userId,
            storyId = storyId,
            sceneId = sceneId,
            userPrompt = request.userPrompt,
        )
        return ResponseEntity.accepted().body(
            ApiResponse(data = IllustrationRegenerateResponse(
                jobId = result.jobId,
                status = result.status,
            ))
        )
    }

    @PostMapping("/scenes/{sceneId}/illustration/rollback")
    fun sceneIllustrationRollback(
        @PathVariable storyId: Long,
        @PathVariable sceneId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRollbackResponse>> {
        val result = sceneIllustrationService.rollbackIllustration(
            userId = user.userId,
            storyId = storyId,
            sceneId = sceneId,
        )
        return ResponseEntity.ok(
            ApiResponse(data = IllustrationRollbackResponse(
                illustrationUrl = result.illustrationUrl,
                version = result.version,
            ))
        )
    }

    // ── 강조 문장 녹음 (3-phase presigned URL) ──

    // Phase 1: presigned PUT URL 발급
    @PostMapping("/sentences/{sentenceId}/highlight-voice/presigned-url")
    fun highlightVoicePresignedUrl(
        @PathVariable storyId: Long,
        @PathVariable sentenceId: Long,
        @RequestBody request: PresignedUrlRequest,
    ): ResponseEntity<ApiResponse<PresignedUrlResponse>> {
        val presigned = highlightOutroService.presignHighlightVoice(storyId, sentenceId, request.contentType)
        return ResponseEntity.ok(
            ApiResponse(
                data = PresignedUrlResponse(
                    uploadUrl = presigned.uploadUrl,
                    s3Key = presigned.s3Key,
                    expiresAt = presigned.expiresAt.toString(),
                )
            )
        )
    }

    // Phase 3: S3 업로드 완료 후 DB commit
    @PostMapping("/sentences/{sentenceId}/highlight-voice")
    fun highlightVoiceAdd(
        @PathVariable storyId: Long,
        @PathVariable sentenceId: Long,
        @RequestBody request: HighlightVoiceCommitRequest,
    ): ResponseEntity<ApiResponse<HighlightVoiceResponse>> {
        val result = highlightOutroService.addHighlightVoice(storyId, sentenceId, request.s3Key)
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = result))
    }

    // 강조 문장 녹음 삭제
    @DeleteMapping("/sentences/{sentenceId}/highlight-voice")
    fun highlightVoiceRemove(
        @PathVariable storyId: Long,
        @PathVariable sentenceId: Long,
    ): ResponseEntity<Unit> {
        highlightOutroService.removeHighlightVoice(storyId, sentenceId)
        return ResponseEntity.noContent().build()
    }

    // 스타일 미리보기 생성
    @PostMapping("/style-preview")
    fun storyStylePreviewGenerate(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateStylePreview(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 스타일 선택
    @PatchMapping("/style")
    fun storyStyleModify(
        @PathVariable storyId: Long,
        @RequestBody request: StyleModifyRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyService.modifyStyle(user.userId, storyId, request.stylePresetId)
        return ResponseEntity.ok(ApiResponse(data = null))
    }

    // 보이스 프로필 선택 — Step 5 보이스 클론 commit/load 직후 FE 가 호출.
    // Story.voiceProfileId 를 채워야 Step 7 → 8 confirm 가드를 통과한다.
    @PatchMapping("/voice-profile")
    fun storyVoiceProfileModify(
        @PathVariable storyId: Long,
        @RequestBody request: VoiceProfileModifyRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyService.modifyVoiceProfile(user.userId, storyId, request.voiceProfileId)
        return ResponseEntity.ok(ApiResponse(data = null))
    }

    // 동화 전체 생성 (AI)
    @PostMapping("/generate")
    fun storyGenerate(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateStory(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    @PatchMapping("/bgm")
    fun storyBgmModify(
        @PathVariable storyId: Long,
        @RequestBody request: BgmRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<Unit> {
        storyService.modifyBgm(user.userId, storyId, request.bgmPresetId)
        return ResponseEntity.noContent().build()
    }

    // ── 아웃트로 ──

    // 아웃트로 조회
    @GetMapping("/outro")
    fun outroDetails(
        @PathVariable storyId: Long,
    ): ResponseEntity<ApiResponse<OutroResponse?>> {
        val result = highlightOutroService.findOutro(storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 마무리 멘트 텍스트 저장
    @PutMapping("/outro")
    fun outroModify(
        @PathVariable storyId: Long,
        @RequestBody request: OutroRequest,
    ): ResponseEntity<ApiResponse<OutroResponse>> {
        val result = highlightOutroService.modifyOutro(storyId, request.outroText, request.signature)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 아웃트로 음성 presigned URL 발급
    @PostMapping("/outro/voice/presigned-url")
    fun outroVoicePresignedUrl(
        @PathVariable storyId: Long,
        @RequestBody request: PresignedUrlRequest,
    ): ResponseEntity<ApiResponse<PresignedUrlResponse>> {
        val presigned = highlightOutroService.presignOutroVoice(storyId, request.contentType)
        return ResponseEntity.ok(
            ApiResponse(
                data = PresignedUrlResponse(
                    uploadUrl = presigned.uploadUrl,
                    s3Key = presigned.s3Key,
                    expiresAt = presigned.expiresAt.toString(),
                )
            )
        )
    }

    // 아웃트로 음성 DB commit
    @PostMapping("/outro/voice")
    fun outroVoiceCommit(
        @PathVariable storyId: Long,
        @RequestBody request: OutroVoiceCommitRequest,
    ): ResponseEntity<ApiResponse<OutroResponse>> {
        val result = highlightOutroService.commitOutroVoice(storyId, request.s3Key)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 조회 — 저장된 값이 없으면 data=null 반환
    @GetMapping("/progress")
    fun storyProgressDetails(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ProgressResponse?>> {
        val result = storyProgressService.findProgress(user.username, storyId)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 저장/이동 (upsert)
    @PutMapping("/progress")
    fun storyProgressModify(
        @PathVariable storyId: Long,
        @RequestBody request: ProgressRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ProgressResponse>> {
        val result = storyProgressService.saveProgress(user.username, storyId, request.lastScenePage)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 해제
    @DeleteMapping("/progress")
    fun storyProgressRemove(
        @PathVariable storyId: Long,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<Unit> {
        storyProgressService.removeProgress(user.username, storyId)
        return ResponseEntity.noContent().build()
    }
}
