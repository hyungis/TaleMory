package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.infrastructure.repository.StoryBoardRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.infrastructure.repository.StoryboardPageRepository
import com.s210.backend.domain.story.entity.StoryBoard
import com.s210.backend.domain.storyboard.application.StoryboardResultListener.Companion.EnvelopeTypes
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.amqp.core.Message
import org.springframework.amqp.core.MessageProperties
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.LocalDate
import java.util.Optional

/**
 * Unit tests for StoryboardResultListener.onResult envelope routing.
 *
 * Tests verify that:
 * - Each envelope type is dispatched to exactly the right handler
 * - Substring-overlap types (GENERATE_STORY_SUMMARY_COMPLETED vs GENERATE_STORY_COMPLETED)
 *   are never mis-routed
 * - Unknown types produce WARN log and no handler invocation
 */
@ExtendWith(MockitoExtension::class)
class StoryboardResultListenerTest {

    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyBoardRepository: StoryBoardRepository = mock(StoryBoardRepository::class.java)
    private val storyboardPageRepository: StoryboardPageRepository = mock(StoryboardPageRepository::class.java)
    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val objectMapper = jacksonObjectMapper()

    private val listener = StoryboardResultListener(
        jobRepository = jobRepository,
        storyBoardRepository = storyBoardRepository,
        storyboardPageRepository = storyboardPageRepository,
        storyRepository = storyRepository,
        objectMapper = objectMapper,
    )

    // -----------------------------------------------------------------------
    // EnvelopeTypes Set membership — fast contract tests (no I/O)
    // -----------------------------------------------------------------------

    @Test
    fun `GENERATE_STORY_SUMMARY_COMPLETED is in STORY_SUMMARY set`() {
        assertTrue("GENERATE_STORY_SUMMARY_COMPLETED" in EnvelopeTypes.STORY_SUMMARY)
    }

    @Test
    fun `REGENERATE_STORY_SUMMARY_COMPLETED is in STORY_SUMMARY set`() {
        assertTrue("REGENERATE_STORY_SUMMARY_COMPLETED" in EnvelopeTypes.STORY_SUMMARY)
    }

    @Test
    fun `GENERATE_STORY_SUMMARY_COMPLETED is NOT in STORY set — substring overlap blocked`() {
        assertFalse("GENERATE_STORY_SUMMARY_COMPLETED" in EnvelopeTypes.STORY)
    }

    @Test
    fun `GENERATE_STORY_COMPLETED is in STORY set`() {
        assertTrue("GENERATE_STORY_COMPLETED" in EnvelopeTypes.STORY)
    }

    @Test
    fun `GENERATE_STORY_COMPLETED is NOT in STORY_SUMMARY set`() {
        assertFalse("GENERATE_STORY_COMPLETED" in EnvelopeTypes.STORY_SUMMARY)
    }

    @Test
    fun `GENERATE_STORYBOARD_IMAGE_COMPLETED is in STORYBOARD_IMAGE set`() {
        assertTrue("GENERATE_STORYBOARD_IMAGE_COMPLETED" in EnvelopeTypes.STORYBOARD_IMAGE)
    }

    @Test
    fun `REGENERATE_STORYBOARD_IMAGE_COMPLETED is in STORYBOARD_IMAGE set`() {
        assertTrue("REGENERATE_STORYBOARD_IMAGE_COMPLETED" in EnvelopeTypes.STORYBOARD_IMAGE)
    }

    @Test
    fun `STORY_SUMMARY sets and STORY set are disjoint — no cross-contamination`() {
        val intersection = EnvelopeTypes.STORY_SUMMARY intersect EnvelopeTypes.STORY
        assertTrue(intersection.isEmpty(), "Sets must be disjoint but share: $intersection")
    }

    @Test
    fun `all three type sets are mutually disjoint`() {
        val all = listOf(EnvelopeTypes.STORY_SUMMARY, EnvelopeTypes.STORYBOARD_IMAGE, EnvelopeTypes.STORY)
        for (i in all.indices) {
            for (j in all.indices) {
                if (i != j) {
                    val overlap = all[i] intersect all[j]
                    assertTrue(overlap.isEmpty(), "Sets[$i] and Sets[$j] overlap: $overlap")
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // onResult routing — GENERATE_STORY_SUMMARY_COMPLETED → handleStorySummaryResult
    // Verified by: jobRepository.findById called with the correct id
    // -----------------------------------------------------------------------

    @Test
    fun `GENERATE_STORY_SUMMARY_COMPLETED envelope routes to summary handler — jobRepository queried`() {
        val jobId = 42L
        val job = buildJob(jobId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING)
        `when`(jobRepository.findById(jobId)).thenReturn(Optional.of(job))
        // existing == null branch → storyBoardRepository.save() is called; must return non-null
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(anyLong()))
            .thenReturn(null)
        `when`(storyBoardRepository.save(any(StoryBoard::class.java)))
            .thenReturn(buildStoryBoard(1L))

        val body = summaryCompletedJson(jobId = jobId.toString(), type = "GENERATE_STORY_SUMMARY_COMPLETED")
        listener.onResult(buildMessage(body))

        verify(jobRepository).findById(jobId)
    }

    @Test
    fun `REGENERATE_STORY_SUMMARY_COMPLETED envelope routes to summary handler — jobRepository queried`() {
        val jobId = 43L
        val job = buildJob(jobId, JobType.STORYBOARD_STORY_SUMMARY, JobStatus.PENDING)
        `when`(jobRepository.findById(jobId)).thenReturn(Optional.of(job))
        // existing == null branch → storyBoardRepository.save() is called; must return non-null
        `when`(storyBoardRepository.findFirstByStoryIdAndDeletedAtIsNullOrderByIdDesc(anyLong()))
            .thenReturn(null)
        `when`(storyBoardRepository.save(any(StoryBoard::class.java)))
            .thenReturn(buildStoryBoard(2L))

        val body = summaryCompletedJson(jobId = jobId.toString(), type = "REGENERATE_STORY_SUMMARY_COMPLETED")
        listener.onResult(buildMessage(body))

        verify(jobRepository).findById(jobId)
    }

    @Test
    fun `GENERATE_STORY_COMPLETED envelope routes to story handler — NOT to summary handler`() {
        val jobId = 44L
        val job = buildJob(jobId, JobType.STORYBOARD_STORY, JobStatus.PENDING)
        `when`(jobRepository.findById(jobId)).thenReturn(Optional.of(job))

        // Minimal STORY envelope — no pages, triggers payload-missing path
        val body = """{"jobId":"$jobId","type":"GENERATE_STORY_COMPLETED","status":"FAILED",
            "error":{"code":"ERR","message":"test"}}"""
        listener.onResult(buildMessage(body))

        // Must query job (story handler path)
        verify(jobRepository).findById(jobId)
        // summary-specific board upsert must NOT happen
        verify(storyBoardRepository, never()).save(any())
    }

    @Test
    fun `GENERATE_STORYBOARD_IMAGE_COMPLETED envelope routes to image handler — NOT to summary handler`() {
        val jobId = 45L
        val job = buildJob(jobId, JobType.STORYBOARD_IMAGE, JobStatus.PENDING)
        `when`(jobRepository.findById(jobId)).thenReturn(Optional.of(job))
        // Image envelope needs storyId field
        val body = """{"jobId":"$jobId","type":"GENERATE_STORYBOARD_IMAGE_COMPLETED",
            "storyId":1,"status":"FAILED","error":{"code":"ERR","message":"test"}}"""
        listener.onResult(buildMessage(body))

        verify(jobRepository).findById(jobId)
    }

    @Test
    fun `unknown envelope type logs warn and does not query jobRepository`() {
        val body = """{"jobId":"99","type":"UNKNOWN_TYPE","status":"COMPLETED"}"""
        listener.onResult(buildMessage(body))

        verify(jobRepository, never()).findById(anyLong())
    }

    @Test
    fun `STORY_GENERIC substring-overlap type is treated as unknown — no handler called`() {
        // "STORY_GENERIC" contains "STORY" as substring but must NOT match STORY set (exact match)
        val body = """{"jobId":"99","type":"STORY_GENERIC","status":"COMPLETED"}"""
        listener.onResult(buildMessage(body))

        verify(jobRepository, never()).findById(anyLong())
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun buildMessage(body: String): Message {
        val props = MessageProperties()
        return Message(body.toByteArray(Charsets.UTF_8), props)
    }

    private fun buildJob(id: Long, jobType: JobType, status: JobStatus): StoryGenerationJob =
        StoryGenerationJob(
            id = id,
            storyId = 1L,
            jobType = jobType,
            status = status,
        )

    private fun buildStoryBoard(id: Long): StoryBoard =
        StoryBoard(
            id = id,
            storyId = 1L,
            prompt = "",
            story = "요약",
            createAt = LocalDate.now(),
        )

    private fun summaryCompletedJson(jobId: String, type: String): String =
        """{
            "jobId": "$jobId",
            "type": "$type",
            "status": "COMPLETED",
            "payload": {
                "title": "Test Title",
                "summary": "English summary",
                "summaryKo": "한글 요약",
                "moralTheme": "courage",
                "storyQuest": "find treasure",
                "recurringMotif": "rainbow",
                "readingLevel": "BEGINNER",
                "usage": {
                    "model": "gpt-4",
                    "inputTokens": 100,
                    "outputTokens": 200,
                    "totalTokens": 300,
                    "costUsd": 0.01,
                    "promptTemplateVersion": "v1"
                }
            }
        }"""
}
