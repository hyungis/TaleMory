package com.s210.backend.domain.story.presentation

import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.story.presentation.response.SceneResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/stories/{storyId}")
class SceneController {

    // 동화 씬(페이지) 목록 조회
    @GetMapping("/scenes")
    fun sceneList(@PathVariable storyId: Long): ResponseEntity<ApiResponse<List<SceneResponse>>> {
        // TODO: SceneService.findScenes(storyId)
        TODO("Not yet implemented")
    }

    // 삽화 재생성 (AI)
    @PostMapping("/scenes/{sceneId}/illustration/regenerate")
    fun sceneIllustrationRegenerate(
        @PathVariable storyId: Long,
        @PathVariable sceneId: Long
    ): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: SceneService.regenerateIllustration(sceneId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 삽화 롤백
    @PostMapping("/scenes/{sceneId}/illustration/rollback")
    fun sceneIllustrationRollback(
        @PathVariable storyId: Long,
        @PathVariable sceneId: Long
    ): ResponseEntity<ApiResponse<SceneResponse>> {
        // TODO: SceneService.rollbackIllustration(sceneId)
        TODO("Not yet implemented")
    }

    // 삽화 버전 목록 조회
    @GetMapping("/scenes/{sceneId}/illustration/versions")
    fun sceneIllustrationVersionList(
        @PathVariable storyId: Long,
        @PathVariable sceneId: Long
    ): ResponseEntity<ApiResponse<List<Map<String, Any>>>> {
        // TODO: SceneService.findIllustrationVersions(sceneId)
        TODO("Not yet implemented")
    }

    // 강조 문장 녹음 저장
    @PostMapping("/sentences/{sentenceId}/highlight-voice")
    fun sentenceHighlightVoiceAdd(
        @PathVariable storyId: Long,
        @PathVariable sentenceId: Long
    ): ResponseEntity<ApiResponse<Unit>> {
        // TODO: SceneService.addHighlightVoice(sentenceId, audioFile)
        TODO("Not yet implemented")
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
        @RequestBody request: Map<String, Long>
    ): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.modifyStyle(storyId, stylePresetId)
        TODO("Not yet implemented")
    }

    // 보이스 프로필 선택
    @PatchMapping("/voice-profile")
    fun storyVoiceProfileModify(
        @PathVariable storyId: Long,
        @RequestBody request: Map<String, Long>
    ): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.modifyVoiceProfile(storyId, voiceProfileId)
        TODO("Not yet implemented")
    }

    // 동화 전체 생성 (AI)
    @PostMapping("/generate")
    fun storyGenerate(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateStory(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // BGM 설정
    @PatchMapping("/bgm")
    fun storyBgmModify(
        @PathVariable storyId: Long,
        @RequestBody request: Map<String, Long>
    ): ResponseEntity<ApiResponse<Unit>> {
        // TODO: StoryService.modifyBgm(storyId, bgmPresetId)
        TODO("Not yet implemented")
    }

    // 마무리 멘트 저장
    @PutMapping("/outro")
    fun storyOutroModify(
        @PathVariable storyId: Long,
        @RequestBody request: com.s210.backend.domain.story.presentation.request.OutroRequest
    ): ResponseEntity<ApiResponse<com.s210.backend.domain.story.presentation.response.OutroResponse>> {
        // TODO: StoryService.modifyOutro(storyId, command)
        TODO("Not yet implemented")
    }

    // 마무리 멘트 음성 생성
    @PostMapping("/outro/voice")
    fun storyOutroVoiceGenerate(@PathVariable storyId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // TODO: StoryService.generateOutroVoice(storyId) → 비동기 jobId 반환
        TODO("Not yet implemented")
    }

    // 책갈피 조회
    @GetMapping("/progress")
    fun storyProgressDetails(@PathVariable storyId: Long): ResponseEntity<ApiResponse<com.s210.backend.domain.story.presentation.response.ProgressResponse>> {
        // TODO: StoryService.findProgress(userId, storyId)
        TODO("Not yet implemented")
    }

    // 책갈피 저장
    @PutMapping("/progress")
    fun storyProgressModify(
        @PathVariable storyId: Long,
        @RequestBody request: com.s210.backend.domain.story.presentation.request.ProgressRequest
    ): ResponseEntity<ApiResponse<com.s210.backend.domain.story.presentation.response.ProgressResponse>> {
        // TODO: StoryService.modifyProgress(userId, storyId, lastScenePage)
        TODO("Not yet implemented")
    }
}
