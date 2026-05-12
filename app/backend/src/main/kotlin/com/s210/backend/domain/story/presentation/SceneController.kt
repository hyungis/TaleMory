package com.s210.backend.domain.story.presentation

import com.s210.backend.common.codec.JobId
import com.s210.backend.common.codec.SceneId
import com.s210.backend.common.codec.SentenceId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.story.application.HighlightOutroService
import com.s210.backend.domain.story.application.SceneIllustrationService
import com.s210.backend.domain.story.application.StoryProgressService
import com.s210.backend.domain.story.application.StoryService
import com.s210.backend.domain.storyboard.application.WebtoonLayoutRetryService
import com.s210.backend.domain.story.presentation.request.BgmRequest
import com.s210.backend.domain.story.presentation.request.HighlightVoiceCommitRequest
import com.s210.backend.domain.story.presentation.request.IllustrationRegenerateRequest
import com.s210.backend.domain.story.presentation.request.OutroRequest
import com.s210.backend.domain.story.presentation.request.OutroVoiceCommitRequest
import com.s210.backend.domain.story.presentation.request.PresignedUrlRequest
import com.s210.backend.domain.story.presentation.request.ProgressRequest
import com.s210.backend.domain.story.presentation.request.SelectIllustrationVersionRequest
import com.s210.backend.domain.story.presentation.request.StyleModifyRequest
import com.s210.backend.domain.story.presentation.request.VoiceProfileModifyRequest
import com.s210.backend.domain.story.presentation.response.ActiveIllustrationJobView
import com.s210.backend.domain.story.presentation.response.ActiveStoryJobView
import com.s210.backend.domain.story.presentation.response.HighlightVoiceResponse
import com.s210.backend.domain.story.presentation.response.HighlightVoicesExistsResponse
import com.s210.backend.domain.story.presentation.response.IllustrationRegenStatusResponse
import com.s210.backend.domain.story.presentation.response.IllustrationRegenerateResponse
import com.s210.backend.domain.story.presentation.response.IllustrationRollbackResponse
import com.s210.backend.domain.story.presentation.response.IllustrationVersionEntryResponse
import com.s210.backend.domain.story.presentation.response.IllustrationVersionsResponse
import com.s210.backend.domain.story.presentation.response.OutroResponse
import com.s210.backend.domain.story.presentation.response.PresignedUrlResponse
import com.s210.backend.domain.story.presentation.response.ProgressResponse
import com.s210.backend.domain.story.presentation.response.SceneResponse
import com.s210.backend.domain.story.presentation.response.ScenesPrepareResponse
import com.s210.backend.domain.story.presentation.response.StyleModifyResponse
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
    private val webtoonLayoutRetryService: WebtoonLayoutRetryService,
) {

    // 동화 씬(페이지) 목록 조회
    @GetMapping("/scenes")
    fun sceneList(@PathVariable storyId: StoryId): ResponseEntity<ApiResponse<List<SceneResponse>>> {
        val result = highlightOutroService.findScenes(storyId.value)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // Step 7 진입 — storyboard_pages.sentences JSON → scenes/scene_sentences 평탄화 (멱등).
    // FE 는 이 호출을 await 한 뒤 GET /scenes 로 정규화된 데이터를 받아온다.
    @PostMapping("/scenes/prepare")
    fun scenesPrepare(
        @PathVariable storyId: StoryId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ScenesPrepareResponse>> {
        val result = highlightOutroService.prepareScenes(storyId = storyId.value, userId = user.userId)
        return ResponseEntity.ok(
            ApiResponse(
                data = ScenesPrepareResponse(
                    sceneCount = result.sceneCount,
                    sentenceCount = result.sentenceCount,
                    alreadyPrepared = result.alreadyPrepared,
                ),
            )
        )
    }

    @PostMapping("/scenes/{sceneId}/illustration/regenerate")
    fun sceneIllustrationRegenerate(
        @PathVariable storyId: StoryId,
        @PathVariable sceneId: SceneId,
        @RequestBody request: IllustrationRegenerateRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRegenerateResponse>> {
        val result = sceneIllustrationService.regenerateIllustration(
            userId = user.userId,
            storyId = storyId.value,
            sceneId = sceneId.value,
            userPrompt = request.userPrompt,
        )
        return ResponseEntity.accepted().body(
            ApiResponse(data = IllustrationRegenerateResponse(
                jobId = JobId(result.jobId),
                status = result.status,
            ))
        )
    }

    @GetMapping("/scenes/illustration/regen-status")
    fun sceneIllustrationRegenStatus(
        @PathVariable storyId: StoryId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRegenStatusResponse>> {
        val result = sceneIllustrationService.getRegenStatus(
            userId = user.userId,
            storyId = storyId.value,
        )
        return ResponseEntity.ok(
            ApiResponse(data = IllustrationRegenStatusResponse(
                storyId = StoryId(result.storyId),
                used = result.used,
                limit = result.limit,
                remaining = result.remaining,
                // 활성 잡 정보 (Step 4 의 useStoryboardStateQuery 와 동일 패턴) — 새로고침 후 FE polling 복원용.
                activeJob = result.activeJob?.let {
                    ActiveIllustrationJobView(
                        jobId = JobId(it.jobId),
                        sceneId = SceneId(it.sceneId),
                        status = it.status,
                    )
                },
                activeTtsJob = result.activeTtsJob?.let {
                    ActiveStoryJobView(jobId = JobId(it.jobId), status = it.status)
                },
                activeFinalIllustrationJob = result.activeFinalIllustrationJob?.let {
                    ActiveStoryJobView(jobId = JobId(it.jobId), status = it.status)
                },
            ))
        )
    }

    @PostMapping("/scenes/{sceneId}/illustration/rollback")
    fun sceneIllustrationRollback(
        @PathVariable storyId: StoryId,
        @PathVariable sceneId: SceneId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRollbackResponse>> {
        val result = sceneIllustrationService.rollbackIllustration(
            userId = user.userId,
            storyId = storyId.value,
            sceneId = sceneId.value,
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
    @GetMapping("/scenes/{sceneId}/illustration/versions")
    fun sceneIllustrationVersions(
        @PathVariable storyId: StoryId,
        @PathVariable sceneId: SceneId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationVersionsResponse>> {
        val result = sceneIllustrationService.listVersions(
            userId = user.userId,
            storyId = storyId.value,
            sceneId = sceneId.value,
        )
        return ResponseEntity.ok(
            ApiResponse(data = IllustrationVersionsResponse(
                storyId = StoryId(result.storyId),
                sceneId = SceneId(result.sceneId),
                current = result.current,
                versions = result.versions.map {
                    IllustrationVersionEntryResponse(
                        version = it.version,
                        url = it.url,
                        prompt = it.prompt,
                        createdAt = it.createdAt,
                        jobId = it.jobId?.let { jid -> JobId(jid) },
                    )
                },
            ))
        )
    }

    @PostMapping("/scenes/{sceneId}/illustration/select")
    fun sceneIllustrationSelect(
        @PathVariable storyId: StoryId,
        @PathVariable sceneId: SceneId,
        @RequestBody request: SelectIllustrationVersionRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRollbackResponse>> {
        val result = sceneIllustrationService.selectVersion(
            userId = user.userId,
            storyId = storyId.value,
            sceneId = sceneId.value,
            version = request.version,
        )
        return ResponseEntity.ok(
            ApiResponse(data = IllustrationRollbackResponse(
                illustrationUrl = result.illustrationUrl,
                version = result.version,
            ))
        )
    }

    @PostMapping("/sentences/{sentenceId}/highlight-voice/presigned-url")
    fun highlightVoicePresignedUrl(
        @PathVariable storyId: StoryId,
        @PathVariable sentenceId: SentenceId,
        @RequestBody request: PresignedUrlRequest,
    ): ResponseEntity<ApiResponse<PresignedUrlResponse>> {
        val presigned = highlightOutroService.presignHighlightVoice(storyId.value, sentenceId.value, request.contentType)
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
        @PathVariable storyId: StoryId,
        @PathVariable sentenceId: SentenceId,
        @RequestBody request: HighlightVoiceCommitRequest,
    ): ResponseEntity<ApiResponse<HighlightVoiceResponse>> {
        val result = highlightOutroService.addHighlightVoice(storyId.value, sentenceId.value, request.s3Key)
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse(data = result))
    }

    // 강조 문장 녹음 삭제
    @DeleteMapping("/sentences/{sentenceId}/highlight-voice")
    fun highlightVoiceRemove(
        @PathVariable storyId: StoryId,
        @PathVariable sentenceId: SentenceId,
    ): ResponseEntity<Unit> {
        highlightOutroService.removeHighlightVoice(storyId.value, sentenceId.value)
        return ResponseEntity.noContent().build()
    }

    // Step 4 본문 재생성 경고 모달 — 활성 강조 녹음 존재 여부.
    // FE 는 본문 재생성 버튼 클릭 시 호출 → exists=true 면 "강조녹음 삭제됨" 경고 모달 노출.
    @GetMapping("/highlight-voices/exists")
    fun highlightVoicesExists(
        @PathVariable storyId: StoryId,
    ): ResponseEntity<ApiResponse<HighlightVoicesExistsResponse>> {
        val exists = highlightOutroService.existsActiveHighlightVoice(storyId.value)
        return ResponseEntity.ok(ApiResponse(data = HighlightVoicesExistsResponse(exists = exists)))
    }

    // 스타일 미리보기 생성
    @PostMapping("/style-preview")
    fun storyStylePreviewGenerate(@PathVariable storyId: StoryId): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateStylePreview(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 스타일 선택
    @PatchMapping("/style")
    fun storyStyleModify(
        @PathVariable storyId: StoryId,
        @RequestBody request: StyleModifyRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<StyleModifyResponse>> {
        val jobId = storyService.modifyStyle(user.userId, storyId.value, request.stylePresetId)
        return ResponseEntity.ok(ApiResponse(data = StyleModifyResponse(finalIllustrationJobId = JobId(jobId))))
    }

    // 보이스 프로필 선택 — Step 5 보이스 클론 commit/load 직후 FE 가 호출.
    // Story.voiceProfileId 를 채워야 Step 7 → 8 confirm 가드를 통과한다.
    @PatchMapping("/voice-profile")
    fun storyVoiceProfileModify(
        @PathVariable storyId: StoryId,
        @RequestBody request: VoiceProfileModifyRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<Unit>> {
        storyService.modifyVoiceProfile(user.userId, storyId.value, request.voiceProfileId.value)
        return ResponseEntity.ok(ApiResponse(data = null))
    }

    // 동화 전체 생성 (AI)
    @PostMapping("/generate")
    fun storyGenerate(@PathVariable storyId: StoryId): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateStory(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    @PatchMapping("/bgm")
    fun storyBgmModify(
        @PathVariable storyId: StoryId,
        @RequestBody request: BgmRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<Unit> {
        storyService.modifyBgm(user.userId, storyId.value, request.bgmPresetId)
        return ResponseEntity.noContent().build()
    }

    // ── 아웃트로 ──

    // 아웃트로 조회
    @GetMapping("/outro")
    fun outroDetails(
        @PathVariable storyId: StoryId,
    ): ResponseEntity<ApiResponse<OutroResponse?>> {
        val result = highlightOutroService.findOutro(storyId.value)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 마무리 멘트 텍스트 저장
    @PutMapping("/outro")
    fun outroModify(
        @PathVariable storyId: StoryId,
        @RequestBody request: OutroRequest,
    ): ResponseEntity<ApiResponse<OutroResponse>> {
        val result = highlightOutroService.modifyOutro(storyId.value, request.outroText, request.signature)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 아웃트로 음성 presigned URL 발급
    @PostMapping("/outro/voice/presigned-url")
    fun outroVoicePresignedUrl(
        @PathVariable storyId: StoryId,
        @RequestBody request: PresignedUrlRequest,
    ): ResponseEntity<ApiResponse<PresignedUrlResponse>> {
        val presigned = highlightOutroService.presignOutroVoice(storyId.value, request.contentType)
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
        @PathVariable storyId: StoryId,
        @RequestBody request: OutroVoiceCommitRequest,
    ): ResponseEntity<ApiResponse<OutroResponse>> {
        val result = highlightOutroService.commitOutroVoice(storyId.value, request.s3Key)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 조회 — 저장된 값이 없으면 data=null 반환
    @GetMapping("/progress")
    fun storyProgressDetails(
        @PathVariable storyId: StoryId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ProgressResponse?>> {
        val result = storyProgressService.findProgress(user.username, storyId.value)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 저장/이동 (upsert)
    @PutMapping("/progress")
    fun storyProgressModify(
        @PathVariable storyId: StoryId,
        @RequestBody request: ProgressRequest,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<ProgressResponse>> {
        val result = storyProgressService.saveProgress(user.username, storyId.value, request.lastScenePage)
        return ResponseEntity.ok(ApiResponse(data = result))
    }

    // 책갈피 해제
    @DeleteMapping("/progress")
    fun storyProgressRemove(
        @PathVariable storyId: StoryId,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<Unit> {
        storyProgressService.removeProgress(user.username, storyId.value)
        return ResponseEntity.noContent().build()
    }

    /**
     * WEBTOON 모드 한정 — 좌표 추출 실패 페이지 사용자 수동 재시도.
     *
     * 호출 시점: 뷰어에서 scene.character_anchors 가 비거나 매칭 실패한 페이지의 [좌표 다시 추출] 버튼.
     * 응답: 새로 발행된 (또는 재사용된) WEBTOON_LAYOUT_RETRY 잡의 jobId — FE 가 polling 으로 재시도 결과 추적.
     */
    @PostMapping("/webtoon-layout/retry")
    fun webtoonLayoutRetry(
        @PathVariable storyId: StoryId,
        @RequestParam pageNumber: Int,
        @AuthenticationPrincipal user: CustomUser,
    ): ResponseEntity<ApiResponse<IllustrationRegenerateResponse>> {
        val result = webtoonLayoutRetryService.retryPage(
            userId = user.userId,
            storyId = storyId.value,
            pageNumber = pageNumber,
        )
        return ResponseEntity.accepted().body(
            ApiResponse(data = IllustrationRegenerateResponse(
                jobId = JobId(result.jobId),
                status = result.status,
            ))
        )
    }
}
