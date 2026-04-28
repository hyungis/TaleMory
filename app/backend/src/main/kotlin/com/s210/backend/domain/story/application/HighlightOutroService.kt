package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.s3.S3Service
import com.s210.backend.domain.story.entity.SceneHighlightVoice
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneHighlightVoiceRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryOutroRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.presentation.response.HighlightVoiceResponse
import com.s210.backend.domain.story.presentation.response.OutroResponse
import com.s210.backend.domain.story.presentation.response.SceneResponse
import com.s210.backend.domain.story.presentation.response.SentenceResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
@Transactional
class HighlightOutroService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val sceneHighlightVoiceRepository: SceneHighlightVoiceRepository,
    private val storyOutroRepository: StoryOutroRepository,
    private val s3Service: S3Service,
) {
    companion object {
        private val ALLOWED_AUDIO_TYPES = setOf(
            "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg",
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

        val expectedPrefix = "stories/$storyId/highlight-voices/$sentenceId/"
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

    fun removeHighlightVoice(storyId: Long, sentenceId: Long) {
        verifyStoryExists(storyId)
        val voice = sceneHighlightVoiceRepository.findBySentenceIdAndDeletedAtIsNull(sentenceId)
            ?: throw BusinessException(StoryErrorCode.HIGHLIGHT_VOICE_NOT_FOUND)

        voice.deletedAt = LocalDateTime.now()

        val sentence = sceneSentenceRepository.findById(sentenceId).orElse(null)
        sentence?.hasHighlighted = false
    }

    // ── 아웃트로 ──

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

        val expectedPrefix = "stories/$storyId/outro-voice/"
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
