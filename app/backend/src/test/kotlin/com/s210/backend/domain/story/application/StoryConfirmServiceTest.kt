package com.s210.backend.domain.story.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryStatus
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.mockito.junit.jupiter.MockitoExtension

/**
 * Unit tests for StoryConfirmService validation logic (Task 11).
 * Conversion / Redis / TTS publish paths are covered in Tasks 12-14.
 */
@ExtendWith(MockitoExtension::class)
class StoryConfirmServiceTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)

    private val service = StoryConfirmService(
        storyRepository = storyRepository,
        sceneRepository = sceneRepository,
        jobRepository = jobRepository,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // 1. Story not found / not owned
    // -----------------------------------------------------------------------

    @Test
    fun `throws STORY_NOT_FOUND when story does not exist or not owned`() {
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.STORY_NOT_FOUND, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 2. Story status is not DRAFT
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when story status is not DRAFT`() {
        val story = createStory(status = StoryStatus.PUBLISHED, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 3. Voice profile not set
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when voice_profile_id is null`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = null)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 4. Latest STORYBOARD_STORY job is not SUCCESS
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when latest STORY job is not SUCCESS`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        // STORYBOARD_STORY job is FAILED
        val failedStoryJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY, status = JobStatus.FAILED)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(failedStoryJob)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // 5. Scenes already exist (idempotency guard)
    // -----------------------------------------------------------------------

    @Test
    fun `throws INVALID_STORY_STATE when scenes already exist`() {
        val story = createStory(status = StoryStatus.DRAFT, voiceProfileId = 5L)
        `when`(storyRepository.findByIdAndUserId(storyId, userId)).thenReturn(story)

        val successStoryJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_STORY, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY))
            .thenReturn(successStoryJob)

        val successImageJob = createJob(storyId = storyId, jobType = JobType.STORYBOARD_IMAGE, status = JobStatus.SUCCESS)
        `when`(jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_IMAGE))
            .thenReturn(successImageJob)

        `when`(sceneRepository.countByStoryId(storyId)).thenReturn(3L)

        val ex = assertThrows<BusinessException> {
            service.confirmStoryboard(storyId, userId)
        }

        assertEquals(StoryErrorCode.INVALID_STORY_STATE, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun createStory(status: StoryStatus, voiceProfileId: Long?): Story =
        Story(
            id = storyId,
            userId = userId,
            status = status,
            voiceProfileId = voiceProfileId,
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """{"name":"아이","age":5,"gender":"MALE"}""",
            companionsJson = "[]",
        )

    private fun createJob(storyId: Long, jobType: JobType, status: JobStatus): StoryGenerationJob =
        StoryGenerationJob(
            storyId = storyId,
            jobType = jobType,
            status = status,
        )
}
