package com.s210.backend.domain.storyboard.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.PhotoAlbumItem
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.entity.StoryBoard
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
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.rabbit.core.RabbitTemplate
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDate
import java.util.Optional

/**
 * Unit tests for StoryboardSummaryService.
 *
 * Covers:
 *  - generateSummary: job INSERT + rabbitTemplate publish on STORY_SUMMARY_GENERATE routing key
 *  - regenerateSummary: SUMMARY_NOT_FOUND when no prior SUCCESS job (AC9)
 *  - regenerateSummary: job INSERT + publish on STORY_SUMMARY_REGENERATE with previousSummary
 *  - findSummary 5 cases: no job / PENDING / RUNNING / SUCCESS / FAILED
 */
@ExtendWith(MockitoExtension::class)
class StoryboardSummaryServiceTest {

    private val rabbitTemplate: RabbitTemplate = mock(RabbitTemplate::class.java)
    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val photoRepository: PhotoAlbumItemRepository = mock(PhotoAlbumItemRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val objectMapper = jacksonObjectMapper()
    private val storyParticipantParser: StoryParticipantParser = mock(StoryParticipantParser::class.java)

    private val service = StoryboardSummaryService(
        rabbitTemplate = rabbitTemplate,
        jobRepository = jobRepository,
        storyRepository = storyRepository,
        photoRepository = photoRepository,
        storyBoardRepository = storyBoardRepository,
        objectMapper = objectMapper,
        storyParticipantParser = storyParticipantParser,
    )

    private val userId = 1L
    private val storyId = 10L

    // -----------------------------------------------------------------------
    // generateSummary — job INSERT with STORYBOARD_STORY_SUMMARY + PENDING
    // -----------------------------------------------------------------------

    @Test
    fun `generateSummary inserts job with jobType STORYBOARD_STORY_SUMMARY and status PENDING`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(1L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        val captor = ArgumentCaptor.forClass(StoryGenerationJob::class.java)
        `when`(jobRepository.save(captor.capture())).thenReturn(savedJob)

        service.generateSummary(userId, storyId, null)

        val captured = captor.value
        assertEquals(JobType.STORYBOARD_STORY_SUMMARY, captured.jobType)
        assertEquals(JobStatus.PENDING, captured.status)
        assertEquals(storyId, captured.storyId)
    }

    @Test
    fun `generateSummary publishes to STORY_SUMMARY_GENERATE routing key`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(1L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        service.generateSummary(userId, storyId, null)

        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_SUMMARY_GENERATE),
            any(Any::class.java)
        )
    }

    @Test
    fun `generateSummary returns StartGenerationResult with PENDING status`() {
        stubOwnedStory()
        stubPhotos()
        stubParticipants()

        val savedJob = buildJob(99L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.generateSummary(userId, storyId, null)

        assertEquals(99L, result.jobId)
        assertEquals(JobType.STORYBOARD_STORY_SUMMARY.name, result.jobType)
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    // -----------------------------------------------------------------------
    // regenerateSummary — SUMMARY_NOT_FOUND when no prior SUCCESS job (AC9)
    // -----------------------------------------------------------------------

    @Test
    fun `regenerateSummary throws SUMMARY_NOT_FOUND when no prior SUCCESS summary job exists`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "더 밝게 써줘")
        }

        assertEquals(StoryErrorCode.SUMMARY_NOT_FOUND, ex.errorCode)
    }

    @Test
    fun `regenerateSummary inserts new job and publishes on STORY_SUMMARY_REGENERATE when prior SUCCESS exists`() {
        stubOwnedStory()

        val previousPayload = buildSummaryPayload()
        val previousPayloadJson = objectMapper.writeValueAsString(previousPayload)
        val previousJob = buildJob(50L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, previousPayloadJson)

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(previousJob)

        val savedJob = buildJob(51L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(jobRepository.save(any())).thenReturn(savedJob)

        val result = service.regenerateSummary(userId, storyId, "더 밝게 써줘")

        verify(rabbitTemplate).convertAndSend(
            eq(com.s210.backend.common.mq.RabbitMQConfig.REQUEST_EXCHANGE),
            eq(com.s210.backend.common.mq.RoutingKeys.STORY_SUMMARY_REGENERATE),
            any(Any::class.java)
        )
        assertEquals(JobStatus.PENDING.name, result.status)
    }

    @Test
    fun `regenerateSummary throws SUMMARY_NOT_FOUND when prior SUCCESS job has null resultPayload`() {
        stubOwnedStory()

        val brokenJob = buildJob(52L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(brokenJob)

        val ex = assertThrows<BusinessException> {
            service.regenerateSummary(userId, storyId, "프롬프트")
        }

        assertEquals(StoryErrorCode.SUMMARY_NOT_FOUND, ex.errorCode)
    }

    // -----------------------------------------------------------------------
    // findSummary — 5 cases
    // -----------------------------------------------------------------------

    @Test
    fun `findSummary returns all nulls when no summary job exists`() {
        stubOwnedStory()

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(null)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertNull(result.jobStatus)
        assertNull(result.jobId)
    }

    @Test
    fun `findSummary returns null summaryKo and PENDING status when latest job is PENDING`() {
        stubOwnedStory()

        val pendingJob = buildJob(10L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(pendingJob)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("PENDING", result.jobStatus)
        assertEquals("10", result.jobId)
    }

    @Test
    fun `findSummary returns null summaryKo and RUNNING status when latest job is RUNNING`() {
        stubOwnedStory()

        val runningJob = buildJob(11L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.RUNNING, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(runningJob)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("RUNNING", result.jobStatus)
        assertEquals("11", result.jobId)
    }

    @Test
    fun `findSummary returns summaryKo from storyBoard and SUCCESS status when latest job is SUCCESS`() {
        stubOwnedStory()

        val successJob = buildJob(12L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(successJob)

        val board = buildStoryBoard("한글 요약 내용")
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(board)

        val result = service.findSummary(userId, storyId)

        assertEquals("한글 요약 내용", result.summaryKo)
        assertEquals("SUCCESS", result.jobStatus)
        assertEquals("12", result.jobId)
    }

    @Test
    fun `findSummary returns FAILED status and null summaryKo when latest job is FAILED and no prior SUCCESS`() {
        stubOwnedStory()

        val failedJob = buildJob(13L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(failedJob)

        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(null)

        val result = service.findSummary(userId, storyId)

        assertNull(result.summaryKo)
        assertEquals("FAILED", result.jobStatus)
        assertEquals("13", result.jobId)
    }

    @Test
    fun `findSummary returns prior SUCCESS summaryKo and FAILED status when latest job is FAILED and prior SUCCESS exists`() {
        stubOwnedStory()

        val failedJob = buildJob(14L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.FAILED, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeOrderByIdDesc(storyId, JobType.STORYBOARD_STORY_SUMMARY)
        ).thenReturn(failedJob)

        val priorSuccessJob = buildJob(9L, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS, null)
        `when`(
            jobRepository.findFirstByStoryIdAndJobTypeAndStatusOrderByIdDesc(
                storyId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.SUCCESS
            )
        ).thenReturn(priorSuccessJob)

        val board = buildStoryBoard("이전 성공 요약")
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(storyId))
            .thenReturn(board)

        val result = service.findSummary(userId, storyId)

        assertEquals("이전 성공 요약", result.summaryKo)
        assertEquals("FAILED", result.jobStatus)
        assertEquals("14", result.jobId)
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

    private fun stubPhotos() {
        val photo = PhotoAlbumItem(
            id = 1L,
            storyId = storyId,
            imageUrl = "s3://bucket/photo.jpg",
            displayOrder = 0L,
        )
        `when`(photoRepository.findAllByStoryIdAndDeletedAtIsNullOrderByDisplayOrderAsc(storyId))
            .thenReturn(listOf(photo))
    }

    private fun stubParticipants() {
        // Use doReturn(...).when(...) style to avoid Kotlin null-check on non-null String params
        doReturn(listOf(com.s210.backend.domain.storyboard.application.dto.ChildInfo("아이", 5, "MALE")))
            .`when`(storyParticipantParser).parseChildren(anyString())
        doReturn(emptyList<String>())
            .`when`(storyParticipantParser).parseCompanions(anyString())
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

    private fun buildStoryBoard(summaryKo: String): StoryBoard =
        StoryBoard(
            storyId = storyId,
            prompt = "",
            story = summaryKo,
            createAt = LocalDate.now(),
        )
}
