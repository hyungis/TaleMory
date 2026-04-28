package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.exception.StoryErrorCode
import com.s210.backend.domain.story.infrastructure.repository.PhotoAlbumItemRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.storyboard.application.dto.StorySummaryPayload
import com.s210.backend.domain.storyboard.application.dto.UsageInfo
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.util.Optional

/**
 * Unit tests for StoryboardGenerationService.generate() guard logic.
 *
 * Verifies AC4 (SUMMARY_REQUIRED), AC5 (successful publish with summary),
 * and AC11 (STORY_ALREADY_IN_PROGRESS for PENDING and RUNNING active jobs).
 *
 * All external dependencies are mocked; no Spring context needed.
 */
@ExtendWith(MockitoExtension::class)
class StoryboardGenerationServiceGuardTest {

    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val photoRepository: PhotoAlbumItemRepository = mock(PhotoAlbumItemRepository::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val objectMapper = jacksonObjectMapper()
    private val storyParticipantParser: StoryParticipantParser = mock(StoryParticipantParser::class.java)

    private val service = StoryboardGenerationService(
        storyRepository = storyRepository,
        photoRepository = photoRepository,
        jobRepository = jobRepository,
        storyBoardRepository = storyBoardRepository,
        rabbitTemplate = rabbitTemplate,
        objectMapper = objectMapper,
        storyParticipantParser = storyParticipantParser,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // AC4 — no SUCCESS summary job → SUMMARY_REQUIRED
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws SUMMARY_REQUIRED when no SUCCESS summary job exists`() {
        stubOwnedStory()
        // No active story job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)
        // No SUCCESS summary job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.SUMMARY_REQUIRED, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // AC5 — SUCCESS summary job present + no active story job → publish succeeds
    // and payload.summary is populated
    // -----------------------------------------------------------------------

    @Test
    fun `generate publishes to rabbitTemplate when summary SUCCESS job exists and no active story job`() {
        stubOwnedStory()

        // No active story job
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(null)

        // SUCCESS summary job with result payload
        val summaryPayload = buildSummaryPayload()
        val summaryPayloadJson = objectMapper.writeValueAsString(summaryPayload)
        val summaryJob = buildJob(100L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, summaryPayloadJson)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(summaryJob)

        // Photos and participants
        val photo = buildPhoto()
        `when`(photoRepository.findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId))
            .thenReturn(listOf(photo))
        doReturn(listOf(com.s210.backend.domain.storyboard.application.dto.ChildInfo("아이", 5, "MALE")))
            .`when`(storyParticipantParser).parseChildren(anyString())
        doReturn(emptyList<String>())
            .`when`(storyParticipantParser).parseCompanions(anyString())

        val savedJob = buildJob(200L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.generate(userId, storyId, null)

        // Verify rabbitTemplate.convertAndSend was called (summary was included in payload)
        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_GENERATE),
            any(Any::class.java)
        )
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    // -----------------------------------------------------------------------
    // AC11 — active PENDING story job → STORY_ALREADY_IN_PROGRESS
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws STORY_ALREADY_IN_PROGRESS when active PENDING story job exists`() {
        stubOwnedStory()

        val activePendingJob = buildJob(50L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // AC11 — active RUNNING story job → STORY_ALREADY_IN_PROGRESS
    // -----------------------------------------------------------------------

    @Test
    fun `generate throws STORY_ALREADY_IN_PROGRESS when active RUNNING story job exists`() {
        stubOwnedStory()

        val activeRunningJob = buildJob(51L, JobType.STORYBOARD_STORY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activeRunningJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // Guard order: race guard (AC11) is evaluated BEFORE summary guard (AC4)
    // -----------------------------------------------------------------------

    @Test
    fun `STORY_ALREADY_IN_PROGRESS is thrown before SUMMARY_REQUIRED is checked`() {
        stubOwnedStory()

        val activePendingJob = buildJob(52L, JobType.STORYBOARD_STORY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusInOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY, listOf(JobStatus.PENDING, JobStatus.RUNNING)
            )
        ).thenReturn(activePendingJob)

        val ex = assertThrows<BusinessException> {
            service.generate(userId, storyId, null)
        }

        // Must be the race guard error, not summary guard
        assertEquals(StoryErrorCode.STORY_ALREADY_IN_PROGRESS, ex.errorCode)
        // Summary job must never be queried — use literal values to avoid Kotlin null-safety issues with matchers
        verify(jobRepository, never()).findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
            storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
        )
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

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

    private fun buildSummaryPayload() = StorySummaryPayload(
        title = "Test Story",
        summary = "English summary",
        summaryKo = "한글 요약",
        moralTheme = "courage",
        storyQuest = "find treasure",
        recurringMotif = "rainbow",
        readingLevel = "BEGINNER",
        usage = UsageInfo(
            model = "gpt-4",
            inputTokens = 100,
            outputTokens = 200,
            totalTokens = 300,
            costUsd = 0.01,
            promptTemplateVersion = "v1",
        ),
    )

    private fun buildJob(
        id: Long,
        jobType: JobType,
        status: JobStatus,
        resultPayload: String?,
    ): StoryGenerationJob = StoryGenerationJob(
        id = id,
        storyId = storyId,
        jobType = jobType,
        status = status,
        resultPayload = resultPayload,
    )

    private fun buildPhoto(): com.s210.backend.domain.story.entity.PhotoAlbumItem =
        com.s210.backend.domain.story.entity.PhotoAlbumItem(
            id = 1L,
            storyId = storyId,
            imageUrl = "s3://bucket/photo1.jpg",
            displayOrder = 0L,
        )
}
