package com.s210.backend.domain.story.application

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryOutroRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.story.presentation.response.CharacterAnchorView
import com.s210.backend.domain.story.presentation.response.MainCharacterView
import com.s210.backend.domain.story.presentation.response.OutroViewResponse
import com.s210.backend.domain.story.presentation.response.SceneViewResponse
import com.s210.backend.domain.story.presentation.response.SentenceViewResponse
import com.s210.backend.domain.story.presentation.response.StoryViewResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 동화책 뷰어 전용 조회 서비스.
 * 작성자 본인 + PUBLISHED 상태만 접근 가능. 읽기 전용.
 */
@Service
@Transactional(readOnly = true)
class StoryViewerService(
    private val storyRepository: StoryRepository,
    private val sceneRepository: SceneRepository,
    private val sceneSentenceRepository: SceneSentenceRepository,
    private val storyOutroRepository: StoryOutroRepository,
    private val memberRepository: MemberRepository,
    private val objectMapper: ObjectMapper,
) {
    fun findStoryView(loginId: String, storyId: Long): StoryViewResponse {
        val userId = resolveUserId(loginId)
        val story = storyRepository.findById(storyId)
            .orElseThrow { BusinessException(StoryErrorCode.STORY_NOT_FOUND) }

        verifyOwnership(story, userId)
        verifyPublished(story)

        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        val sentencesByScene = loadSentencesByScene(scenes)
        val outro = storyOutroRepository.findByStoryId(storyId)

        return toViewResponse(story, scenes, sentencesByScene, outro)
    }

    private fun resolveUserId(loginId: String): Long {
        val user = memberRepository.findByLoginId(loginId)
            ?: throw BusinessException(CommonErrorCode.USER_NOT_FOUND)
        return user.id
    }

    private fun verifyOwnership(story: Story, userId: Long) {
        if (story.userId != userId) {
            throw BusinessException(StoryErrorCode.STORY_ACCESS_FORBIDDEN)
        }
    }

    private fun verifyPublished(story: Story) {
        if (story.status != StoryStatus.PUBLISHED) {
            throw BusinessException(StoryErrorCode.INVALID_STORY_STATE)
        }
    }

    private fun loadSentencesByScene(scenes: List<Scene>): Map<Long, List<SceneSentence>> {
        if (scenes.isEmpty()) return emptyMap()
        val sceneIds = scenes.map { it.id }
        return sceneSentenceRepository
            .findBySceneIdInOrderBySceneIdAscSentenceOrderAsc(sceneIds)
            .groupBy { it.sceneId }
    }

    private fun toViewResponse(
        story: Story,
        scenes: List<Scene>,
        sentencesByScene: Map<Long, List<SceneSentence>>,
        outro: StoryOutro?,
    ): StoryViewResponse {
        return StoryViewResponse(
            storyId = story.id,
            title = story.title,
            mainCharacter = parseMainCharacter(story.mainCharacterJson),
            coverIllustrationUrl = scenes.firstOrNull()?.illustrationUrl,
            publishedAt = story.publishedAt,
            scenes = scenes.map { scene ->
                SceneViewResponse(
                    sceneId = scene.id,
                    pageNumber = scene.pageNumber,
                    illustrationUrl = scene.illustrationUrl,
                    characterAnchors = parseCharacterAnchors(scene.characterAnchors),
                    sentences = sentencesByScene[scene.id].orEmpty().map(::toSentenceView),
                )
            },
            outro = outro?.let { toOutroView(it) },
        )
    }

    private fun toSentenceView(sentence: SceneSentence): SentenceViewResponse {
        return SentenceViewResponse(
            sentenceId = sentence.id,
            sentenceOrder = sentence.sentenceOrder,
            englishText = sentence.englishText,
            koreanText = sentence.koreanText,
            ttsAudioUrl = sentence.ttsAudioUrl,
            speakerKey = sentence.speakerKey,
            bubbleSlot = sentence.bubbleSlot?.name,
        )
    }

    private fun toOutroView(outro: StoryOutro): OutroViewResponse {
        return OutroViewResponse(
            outroText = outro.outroText,
            audioUrl = outro.audioUrl,
            signature = outro.signature,
        )
    }

    private fun parseMainCharacter(json: String?): MainCharacterView? {
        if (json.isNullOrBlank()) return null
        return runCatching { objectMapper.readValue<MainCharacterView>(json) }.getOrNull()
    }

    private fun parseCharacterAnchors(json: String?): List<CharacterAnchorView> {
        if (json.isNullOrBlank()) return emptyList()
        return runCatching { objectMapper.readValue<List<CharacterAnchorView>>(json) }
            .getOrDefault(emptyList())
    }
}
