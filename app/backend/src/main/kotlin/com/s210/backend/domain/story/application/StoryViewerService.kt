package com.s210.backend.domain.story.application

import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue
import com.s210.backend.common.codec.SceneId
import com.s210.backend.common.codec.SentenceId
import com.s210.backend.common.codec.StoryId
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryOutro
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneHighlightVoiceRepository
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
    private val sceneHighlightVoiceRepository: SceneHighlightVoiceRepository,
    private val storyOutroRepository: StoryOutroRepository,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        private const val SAMPLE_STORY_ID = 1L
    }

    fun findSampleStoryView(): StoryViewResponse {
        val story = storyRepository.findById(SAMPLE_STORY_ID)
            .orElseThrow { BusinessException(StoryErrorCode.STORY_NOT_FOUND) }

        verifyPublished(story)

        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(story.id)
        val sentencesByScene = loadSentencesByScene(scenes)
        val outro = storyOutroRepository.findByStoryId(story.id)

        return toViewResponse(story, scenes, sentencesByScene, outro)
    }

    fun findPublicStoryView(shareToken: String): StoryViewResponse {
        val story = storyRepository.findByShareTokenAndDeletedAtIsNull(shareToken)
            ?: throw BusinessException(StoryErrorCode.STORY_NOT_FOUND)

        verifyPublished(story)

        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(story.id)
        val sentencesByScene = loadSentencesByScene(scenes)
        val outro = storyOutroRepository.findByStoryId(story.id)

        return toViewResponse(story, scenes, sentencesByScene, outro)
    }

    /**
     * 인증된 사용자(@AuthenticationPrincipal CustomUser) 의 user.id 를 직접 받는다.
     *
     * 과거에는 JWT subject(`loginId`) 로 user 를 다시 조회했는데, OAuth 가입자는
     * subject 가 `oauth:kakao:{providerUserId}` 형태이고 DB 의 user.loginId 는 빈 문자열이라
     * `findByLoginIdAndDeletedAtIsNull(...)` 가 항상 null → USER_NOT_FOUND(404) 떨어졌다.
     * JWT 의 `uid` 클레임이 OAuth/로컬 모두 채워져 있어서 user.id 만으로 충분하다.
     */
    fun findStoryView(userId: Long, storyId: Long): StoryViewResponse {
        val story = storyRepository.findById(storyId)
            .orElseThrow { BusinessException(StoryErrorCode.STORY_NOT_FOUND) }

        verifyOwnership(story, userId)
        verifyPublished(story)

        val scenes = sceneRepository.findByStoryIdOrderByPageNumberAsc(storyId)
        val sentencesByScene = loadSentencesByScene(scenes)
        val outro = storyOutroRepository.findByStoryId(storyId)

        return toViewResponse(story, scenes, sentencesByScene, outro)
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
        val allSentences = sentencesByScene.values.flatten()
        val highlightAudioMap = loadHighlightAudioMap(allSentences)
        val coverScene = scenes.firstOrNull { it.pageNumber == 0 }
        val bodyScenes = if (coverScene != null) {
            scenes.filter { it.pageNumber != 0 }
        } else {
            scenes
        }

        return StoryViewResponse(
            storyId = StoryId(story.id),
            title = story.title,
            difficulty = story.difficulty.name,
            mainCharacter = parseMainCharacter(story.mainCharacterJson),
            coverIllustrationUrl = coverScene?.illustrationUrl ?: scenes.firstOrNull()?.illustrationUrl,
            publishedAt = story.publishedAt,
            scenes = bodyScenes.map { scene ->
                SceneViewResponse(
                    sceneId = SceneId(scene.id),
                    pageNumber = scene.pageNumber,
                    illustrationUrl = scene.illustrationUrl,
                    characterAnchors = parseCharacterAnchors(scene.characterAnchors),
                    sentences = sentencesByScene[scene.id].orEmpty().map { sentence ->
                        toSentenceView(sentence, highlightAudioMap)
                    },
                )
            },
            outro = outro?.let { toOutroView(it) },
        )
    }

    private fun loadHighlightAudioMap(sentences: List<SceneSentence>): Map<Long, String> {
        if (sentences.isEmpty()) return emptyMap()
        val sentenceIds = sentences.map { it.id }
        return sceneHighlightVoiceRepository
            .findBySentenceIdInAndDeletedAtIsNull(sentenceIds)
            .associate { it.sentenceId to it.audioUrl }
    }

    private fun toSentenceView(sentence: SceneSentence, highlightAudioMap: Map<Long, String>): SentenceViewResponse {
        return SentenceViewResponse(
            sentenceId = SentenceId(sentence.id),
            sentenceOrder = sentence.sentenceOrder,
            englishText = sentence.englishText,
            koreanText = sentence.koreanText,
            ttsAudioUrl = highlightAudioMap[sentence.id] ?: sentence.ttsAudioUrl,
            speakerKey = sentence.speakerKey,
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
