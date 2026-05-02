package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.preset.infrastructure.repository.BgmPresetRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.quality.Strictness
import org.springframework.context.ApplicationEventPublisher
import tools.jackson.databind.ObjectMapper
import java.util.Optional

/**
 * Unit tests for StoryService.modifyVoiceProfile (Step 5 보이스 클론 → Story 연결).
 *
 * 가드:
 *  - story 소유권 + soft-delete 미반영 (ownedStory 헬퍼)
 *  - story.status == DRAFT
 *  - voice profile 존재 + soft-delete 미반영
 *  - voice profile 소유권
 */
@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoryServiceVoiceProfileTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val stylePresetRepository: StylePresetRepository = mock(StylePresetRepository::class.java)
    private val bgmPresetRepository: BgmPresetRepository = mock(BgmPresetRepository::class.java)
    private val illustrationVersionRedisRepository: IllustrationVersionRedisRepository =
        mock(IllustrationVersionRedisRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val storyboardPageRepository: StoryboardPageRepository = mock(StoryboardPageRepository::class.java)
    private val storyboardPageImageVersionRepository: StoryboardPageImageVersionRedisRepository =
        mock(StoryboardPageImageVersionRedisRepository::class.java)
    private val applicationEventPublisher: ApplicationEventPublisher = mock(ApplicationEventPublisher::class.java)
    private val objectMapper: ObjectMapper = mock(ObjectMapper::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)

    private val service = StoryService(
        storyRepository = storyRepository,
        sceneRepository = sceneRepository,
        stylePresetRepository = stylePresetRepository,
        bgmPresetRepository = bgmPresetRepository,
        illustrationVersionRedisRepository = illustrationVersionRedisRepository,
        storyBoardRepository = storyBoardRepository,
        storyboardPageRepository = storyboardPageRepository,
        storyboardPageImageVersionRepository = storyboardPageImageVersionRepository,
        applicationEventPublisher = applicationEventPublisher,
        objectMapper = objectMapper,
        jobRepository = jobRepository,
        voiceProfileRepository = voiceProfileRepository,
    )

    private val userId = 1L
    private val storyId = 10L
    private val voiceProfileId = 100L

    // ---------------------------------------------------------------------------
    // Happy path
    // ---------------------------------------------------------------------------

    @Test
    fun `modifyVoiceProfile sets story voiceProfileId on success`() {
        val story = stubOwnedStory(status = StoryStatus.DRAFT)
        stubOwnedVoiceProfile()

        service.modifyVoiceProfile(userId, storyId, voiceProfileId)

        assertEquals(voiceProfileId, story.voiceProfileId)
    }

    // ---------------------------------------------------------------------------
    // Story 가드
    // ---------------------------------------------------------------------------

    @Test
    fun `modifyVoiceProfile throws STORY_NOT_FOUND when story missing`() {
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.empty())

        val ex = assertThrows<BusinessException> {
            service.modifyVoiceProfile(userId, storyId, voiceProfileId)
        }
        assertEquals(StoryErrorCode.STORY_NOT_FOUND, ex.errorCode)
    }

    @Test
    fun `modifyVoiceProfile throws FORBIDDEN when story owned by other user`() {
        stubOwnedStory(status = StoryStatus.DRAFT, ownerUserId = userId + 99)

        val ex = assertThrows<BusinessException> {
            service.modifyVoiceProfile(userId, storyId, voiceProfileId)
        }
        assertEquals(CommonErrorCode.FORBIDDEN, ex.errorCode)
    }

    @Test
    fun `modifyVoiceProfile throws INVALID_STORY_STATE when story not DRAFT`() {
        stubOwnedStory(status = StoryStatus.PUBLISHED)

        val ex = assertThrows<BusinessException> {
            service.modifyVoiceProfile(userId, storyId, voiceProfileId)
        }
        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // ---------------------------------------------------------------------------
    // VoiceProfile 가드
    // ---------------------------------------------------------------------------

    @Test
    fun `modifyVoiceProfile throws VOICE_NOT_FOUND when voice profile missing`() {
        stubOwnedStory(status = StoryStatus.DRAFT)
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.modifyVoiceProfile(userId, storyId, voiceProfileId)
        }
        assertEquals(VoiceErrorCode.NOT_FOUND, ex.errorCode)
    }

    @Test
    fun `modifyVoiceProfile throws VOICE_FORBIDDEN when voice profile owned by other user`() {
        stubOwnedStory(status = StoryStatus.DRAFT)
        val foreignProfile = VoiceProfile(
            id = voiceProfileId,
            userId = userId + 99,
            title = "타인 보이스",
            audioUrl = "dev/stories/voice/x/abc.webm",
        )
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)).thenReturn(foreignProfile)

        val ex = assertThrows<BusinessException> {
            service.modifyVoiceProfile(userId, storyId, voiceProfileId)
        }
        assertEquals(VoiceErrorCode.FORBIDDEN, ex.errorCode)
    }

    // ---------------------------------------------------------------------------
    // Fixture builders
    // ---------------------------------------------------------------------------

    private fun stubOwnedStory(status: StoryStatus, ownerUserId: Long = userId): Story {
        val story = Story(
            id = storyId,
            userId = ownerUserId,
            status = status,
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """{"name":"아이","age":5,"gender":"MALE"}""",
            companionsJson = "[]",
        )
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))
        return story
    }

    private fun stubOwnedVoiceProfile() {
        val profile = VoiceProfile(
            id = voiceProfileId,
            userId = userId,
            title = "내 보이스",
            audioUrl = "dev/stories/voice/$userId/abc.webm",
        )
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(voiceProfileId)).thenReturn(profile)
    }
}
