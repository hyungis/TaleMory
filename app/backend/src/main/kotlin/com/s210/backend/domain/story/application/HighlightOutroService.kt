package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.story.application.dto.ScenesPrepareResult
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.SceneHighlightVoice
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneHighlightVoiceRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryOutroRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.story.presentation.response.HighlightVoiceResponse
import com.s210.backend.domain.story.presentation.response.OutroResponse
import com.s210.backend.domain.story.presentation.response.SceneResponse
import com.s210.backend.domain.story.presentation.response.SentenceResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

@Service
@Transactional
class HighlightOutroService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val sceneHighlightVoiceRepository: SceneHighlightVoiceRepository,
    private val storyOutroRepository: StoryOutroRepository,
    private val storyBoardRepository: StoryBoardRepository,
    private val storyboardPageRepository: StoryboardPageRepository,
    private val s3Service: S3Service,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        private val ALLOWED_AUDIO_TYPES = setOf(
            "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg",
        )
    }

    // ── Step 7 진입: scene/scene_sentence 사전 INSERT ──

    /**
     * Step 7 (HighlightOutroStep) 진입 시점에 호출되는 prepare.
     *
     * `storyboard_pages.sentences` JSON (V13 마이그레이션으로 추가) 으로부터 정규화된
     * `scenes` + `scene_sentences` row 를 생성한다. confirmStoryboard 시점까지 기다리지 않고
     * Step 7 진입 시 미리 만들어둬야 강조 녹음/조회 UI 가 즉시 동작 가능 (Option B).
     *
     * 정책:
     *  - **소유권 + DRAFT 상태 검증**: 다른 사용자의 storyId 로 prepare 시도 시 STORY_NOT_FOUND.
     *  - **멱등**: 이미 scenes 가 있으면 INSERT 없이 `alreadyPrepared = true` 로 반환. FE 는 그대로 진행.
     *  - **본문 재생성** 으로 옛 scenes 가 cascade hard delete 되면 다음 진입 때 다시 INSERT —
     *    `StoryboardResultListener.cascadeDeleteOldScenes` 와 짝을 이뤄 stale 데이터 없이 동작.
     *  - 각 page.sentences JSON 의 sentenceOrder 를 그대로 사용 (V13 backfill 형식 호환).
     *
     * 일러스트 URL / character_anchors 는 이 단계에서 채우지 않는다 — 별도 step (FINAL_ILLUSTRATION) 책임.
     */
    fun prepareScenes(storyId: Long, userId: Long): ScenesPrepareResult {
        // 1) Story 검증 — 소유권 + DRAFT (Step 7 은 발행 전 단계).
        val story = storyRepository.findByIdAndUserId(storyId, userId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        if (story.status != StoryStatus.DRAFT) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 2) 멱등 가드 — 이미 scenes 가 있으면 INSERT 스킵. sentence 는 scene 에 매핑돼 있어 같이 카운트.
        val existingScenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        if (existingScenes.isNotEmpty()) {
            val sceneIds = existingScenes.map { it.id }
            val existingSentenceCount = sceneSentenceRepository
                .findAllBySceneIdIn(sceneIds).size
            return ScenesPrepareResult(
                sceneCount = existingScenes.size,
                sentenceCount = existingSentenceCount,
                alreadyPrepared = true,
            )
        }

        // 3) 최신 storyboard_pages 조회 — sentences JSON 의 SOT.
        val storyBoard = storyBoardRepository
            .findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId)
            ?: throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        val pages = storyboardPageRepository.findAllByStoryBoardIdOrderByPageNumberAsc(storyBoard.id)
        if (pages.isEmpty()) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }

        // 4) 각 page → scene + scene_sentences 평탄화.
        var totalSentences = 0
        pages.forEach { page ->
            val scene = sceneRepository.save(
                Scene(
                    storyId = storyId,
                    pageNumber = page.pageNumber,
                    illustrationUrl = page.imageUrl,  // 미생성 시 null — 별도 step 에서 채움.
                    characterAnchors = null,
                ),
            )

            val sentencesJson = page.sentences ?: return@forEach
            val sentencesArr = runCatching { objectMapper.readTree(sentencesJson) }.getOrNull()
            if (sentencesArr == null || !sentencesArr.isArray) return@forEach

            sentencesArr.forEachIndexed { idx, node ->
                val sentenceOrder = node.get("sentenceOrder")?.asInt() ?: (idx + 1)
                val englishText = node.get("englishText")?.asText().orEmpty()
                val koreanText = node.get("koreanText")?.asText()
                sceneSentenceRepository.save(
                    SceneSentence(
                        sceneId = scene.id,
                        sentenceOrder = sentenceOrder,
                        englishText = englishText,
                        koreanText = koreanText,
                        ttsAudioUrl = null,
                        speakerKey = null,
                        bubbleSlot = null,
                        hasHighlighted = false,
                    ),
                )
                totalSentences++
            }
        }

        return ScenesPrepareResult(
            sceneCount = pages.size,
            sentenceCount = totalSentences,
            alreadyPrepared = false,
        )
    }

    // ── 씬 목록 조회 ──

    @Transactional(readOnly = true)
    fun findScenes(storyId: Long): List<SceneResponse> {
        verifyStoryExists(storyId)
        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        if (scenes.isEmpty()) return emptyList()

        val sceneIds = scenes.map { it.id }
        val sentencesByScene = sceneSentenceRepository
            .findBySceneIdInOrderBySceneIdAscSentenceOrderAsc(sceneIds)
            .groupBy { it.sceneId }

        return scenes.map { scene ->
            SceneResponse(
                id = scene.id,
                pageNumber = scene.pageNumber,
                illustrationUrl = scene.illustrationUrl,
                sentences = sentencesByScene[scene.id].orEmpty().map { s ->
                    SentenceResponse(
                        id = s.id,
                        sentenceOrder = s.sentenceOrder,
                        englishText = s.englishText,
                        koreanText = s.koreanText,
                        ttsAudioUrl = s.ttsAudioUrl,
                        speakerKey = s.speakerKey,
                        bubbleSlot = s.bubbleSlot?.name,
                        hasHighlighted = s.hasHighlighted,
                    )
                },
            )
        }
    }

    // ── 강조 녹음 ──

    @Transactional(readOnly = true)
    fun presignHighlightVoice(storyId: Long, sentenceId: Long, contentType: String): S3Service.PresignedUpload {
        verifyStoryExists(storyId)
        verifySentenceExists(sentenceId)
        validateAudioType(contentType)
        return s3Service.presignHighlightVoicePutUrl(storyId, sentenceId, contentType)
    }

    fun addHighlightVoice(storyId: Long, sentenceId: Long, s3Key: String): HighlightVoiceResponse {
        verifyStoryExists(storyId)
        val sentence = sceneSentenceRepository.findById(sentenceId).orElseThrow {
            BusinessException(StoryErrorCode.SENTENCE_NOT_FOUND)
        }

        // env-prefix(local/dev/prod) 적용된 풀 prefix 로 검증.
        val expectedPrefix = s3Service.applyEnvPrefix("stories/$storyId/highlight-voices/$sentenceId/")
        if (!s3Key.startsWith(expectedPrefix)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val audioUrl = s3Service.buildPublicImageUrl(s3Key)

        val existing = sceneHighlightVoiceRepository.findBySentenceIdAndDeletedAtIsNull(sentenceId)
        val voice = if (existing != null) {
            existing.audioUrl = audioUrl
            existing
        } else {
            sceneHighlightVoiceRepository.save(
                SceneHighlightVoice(sentenceId = sentenceId, audioUrl = audioUrl)
            )
        }

        sentence.hasHighlighted = true

        return HighlightVoiceResponse(
            highlightVoiceId = voice.id,
            sentenceId = sentenceId,
            audioUrl = audioUrl,
        )
    }

    /**
     * Step 4 본문 재생성 경고 모달용 — 활성 강조 녹음이 하나라도 존재하는지 boolean 으로 반환.
     *
     * scenes 가 없으면 (Step 7 미진입) 자동으로 false. scenes 는 있지만 sentences 가 없으면 false.
     * EXISTS 쿼리로 빠르게 판정.
     */
    @Transactional(readOnly = true)
    fun existsActiveHighlightVoice(storyId: Long): Boolean {
        verifyStoryExists(storyId)
        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        if (scenes.isEmpty()) return false
        val sentenceIds = sceneSentenceRepository.findAllBySceneIdIn(scenes.map { it.id }).map { it.id }
        if (sentenceIds.isEmpty()) return false
        return sceneHighlightVoiceRepository.existsBySentenceIdInAndDeletedAtIsNull(sentenceIds)
    }

    fun removeHighlightVoice(storyId: Long, sentenceId: Long) {
        verifyStoryExists(storyId)
        val voice = sceneHighlightVoiceRepository.findBySentenceIdAndDeletedAtIsNull(sentenceId)
            ?: throw BusinessException(StoryErrorCode.HIGHLIGHT_VOICE_NOT_FOUND)

        voice.deletedAt = LocalDateTime.now()

        val sentence = sceneSentenceRepository.findById(sentenceId).orElse(null)
        sentence?.hasHighlighted = false
    }

    // ── 아웃트로 ──

    @Transactional(readOnly = true)
    fun findOutro(storyId: Long): OutroResponse? {
        verifyStoryExists(storyId)
        val outro = storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId) ?: return null
        return OutroResponse(
            id = outro.id,
            outroText = outro.outroText,
            audioUrl = outro.audioUrl,
            signature = outro.signature,
        )
    }

    fun modifyOutro(storyId: Long, outroText: String, signature: String?): OutroResponse {
        verifyStoryExists(storyId)

        val existing = storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)
        val outro = if (existing != null) {
            existing.outroText = outroText
            existing.signature = signature
            existing
        } else {
            storyOutroRepository.save(
                StoryOutro(storyId = storyId, outroText = outroText, signature = signature)
            )
        }

        return OutroResponse(
            id = outro.id,
            outroText = outro.outroText,
            audioUrl = outro.audioUrl,
            signature = outro.signature,
        )
    }

    @Transactional(readOnly = true)
    fun presignOutroVoice(storyId: Long, contentType: String): S3Service.PresignedUpload {
        verifyStoryExists(storyId)
        validateAudioType(contentType)
        return s3Service.presignOutroVoicePutUrl(storyId, contentType)
    }

    fun commitOutroVoice(storyId: Long, s3Key: String): OutroResponse {
        verifyStoryExists(storyId)

        // env-prefix(local/dev/prod) 적용된 풀 prefix 로 검증.
        val expectedPrefix = s3Service.applyEnvPrefix("stories/$storyId/outro-voice/")
        if (!s3Key.startsWith(expectedPrefix)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        val outro = storyOutroRepository.findByStoryIdAndDeletedAtIsNull(storyId)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)

        outro.audioUrl = s3Service.buildPublicImageUrl(s3Key)

        return OutroResponse(
            id = outro.id,
            outroText = outro.outroText,
            audioUrl = outro.audioUrl,
            signature = outro.signature,
        )
    }

    // ── 공통 ──

    private fun verifyStoryExists(storyId: Long) {
        if (!storyRepository.existsById(storyId)) {
            throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)
        }
    }

    private fun verifySentenceExists(sentenceId: Long) {
        if (!sceneSentenceRepository.existsById(sentenceId)) {
            throw BusinessException(StoryErrorCode.SENTENCE_NOT_FOUND)
        }
    }

    private fun validateAudioType(contentType: String) {
        if (contentType !in ALLOWED_AUDIO_TYPES) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }
}
