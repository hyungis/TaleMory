package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.redis.IllustrationVersionRedisRepository
import com.s210.backend.common.redis.StoryboardPageImageVersionRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.preset.infrastructure.repository.BgmPresetRepository
import com.s210.backend.domain.preset.infrastructure.repository.StylePresetRepository
import com.s210.backend.domain.story.application.dto.ModifyStoryCommand
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.model.Difficulty
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.quality.Strictness
import org.springframework.context.ApplicationEventPublisher
import tools.jackson.databind.ObjectMapper
import java.util.Optional

/**
 * Unit tests for StoryService — Step 1 Lock 거동.
 *
 * 가드: `STORYBOARD_STORY_SUMMARY` 잡이 PENDING/RUNNING/SUCCESS 중 하나로 존재하면
 *       `modifyStory` (PATCH /api/stories/{id}) 가 STEP_LOCKED_BY_SUMMARY 로 거부된다.
 *       FAILED 만 있는 상태 또는 잡 자체가 없는 상태에선 통과.
 *
 * Step 2 Lock (PhotoServiceLockTest) 와 동일 패턴.
 */
@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoryServiceLockTest {

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
    )

    private val userId = 1L
    private val storyId = 10L

    // ---------------------------------------------------------------------------
    // modifyStory — SUMMARY active(PENDING/RUNNING/SUCCESS) → STEP_LOCKED_BY_SUMMARY
    // ---------------------------------------------------------------------------

    @ParameterizedTest
    @EnumSource(value = JobStatus::class, names = ["PENDING", "RUNNING", "SUCCESS"])
    fun `modifyStory throws STEP_LOCKED_BY_SUMMARY when SUMMARY job exists in active state`(status: JobStatus) {
        stubOwnedStory()
        stubSummaryJob(status)

        val ex = assertThrows<BusinessException> {
            service.modifyStory(userId, storyId, buildModifyCommand())
        }
        assertEquals(StoryErrorCode.STEP_LOCKED_BY_SUMMARY, ex.errorCode)
    }

    @Test
    fun `modifyStory allows mutation when only FAILED SUMMARY exists`() {
        stubOwnedStory()
        stubSummaryJob(JobStatus.FAILED)

        // throw 하지 않으면 통과 — story dirty checking 으로 변경 적용.
        service.modifyStory(userId, storyId, buildModifyCommand())
    }

    @Test
    fun `modifyStory allows mutation when no SUMMARY job exists`() {
        stubOwnedStory()
        // stub 없이도 Mockito 가 null 반환 — lenient 모드라 안전.

        service.modifyStory(userId, storyId, buildModifyCommand())
    }

    // ---------------------------------------------------------------------------
    // Fixture builders
    // ---------------------------------------------------------------------------

    private fun stubOwnedStory() {
        val story = Story(
            id = storyId,
            userId = userId,
            travelPlace = "제주도",
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """[{"name":"아이","age":5,"gender":"MALE"}]""",
            companionsJson = "[]",
        )
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))
    }

    private fun stubSummaryJob(status: JobStatus) {
        val job = StoryGenerationJob(
            id = 1L,
            storyId = storyId,
            jobType = JobType.STORYBOARD_STORY_SUMMARY,
            status = status,
        )
        val activeStatuses = listOf(JobStatus.PENDING, JobStatus.RUNNING, JobStatus.SUCCESS)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId,
                JobType.STORYBOARD_STORY_SUMMARY,
                activeStatuses,
            )
        ).thenReturn(if (status in activeStatuses) job else null)
    }

    private fun buildModifyCommand() = ModifyStoryCommand(
        title = "수정된 제목",
        difficulty = null,
        mainCharacterJson = null,
        companionsJson = null,
        travelPlace = null,
        travelStartDate = null,
        travelEndDate = null,
    )
}
