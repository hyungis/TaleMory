package com.s210.backend.domain.storyboard.application

import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultData
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultEnvelope
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultError
import com.s210.backend.domain.storyboard.application.dto.FinalIllustrationResultPayload
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * Unit tests for FinalIllustrationResultHandler — covers:
 * 1. Page accumulation across N pages → RUNNING until last, then SUCCESS + finishedAt.
 * 2. Idempotent terminal state — second call on SUCCESS/FAILED job is a no-op.
 * 3. Scene illustrationUrl update when Scene already exists.
 * 4. handleFailure sets FAILED + errorMessage ("code: message") + finishedAt.
 * 5. Unknown jobId → silent log warn, no exception, no DB write.
 *
 * Pure JUnit 5 + Mockito; no Spring context.
 */
@ExtendWith(MockitoExtension::class)
class FinalIllustrationResultHandlerTest {

    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val objectMapper = jacksonObjectMapper()

    private lateinit var sut: FinalIllustrationResultHandler

    @BeforeEach
    fun setUp() {
        sut = FinalIllustrationResultHandler(jobRepository, sceneRepository, objectMapper)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Builds a PENDING job whose requestPayload encodes [pageCount] items,
     * matching the structure FinalIllustrationResultHandler.expectedPageCount() reads:
     *   { "stylePresetId": 1, "payload": { "items": [ { "pageNumber": 1 }, ... ] } }
     */
    private fun pendingJob(jobId: Long, storyId: Long, pageCount: Int): StoryGenerationJob {
        val items = (1..pageCount).map { mapOf("pageNumber" to it) }
        val requestPayloadJson = objectMapper.writeValueAsString(
            mapOf("stylePresetId" to 1, "payload" to mapOf("items" to items))
        )
        return StoryGenerationJob(
            id = jobId,
            storyId = storyId,
            jobType = JobType.FINAL_ILLUSTRATION,
            status = JobStatus.PENDING,
            requestPayload = requestPayloadJson,
        )
    }

    private fun successEnvelope(jobId: Long, page: Int, url: String): FinalIllustrationResultEnvelope =
        FinalIllustrationResultEnvelope(
            jobId = jobId.toString(),
            type = "GENERATE_FINAL_ILLUSTRATION_COMPLETED",
            storyId = 1L,
            pageNumber = page,
            status = "COMPLETED",
            payload = FinalIllustrationResultPayload(
                seed = 0,
                result = FinalIllustrationResultData(pageNumber = page, imageUrl = url),
            ),
        )

    private fun failureEnvelope(jobId: Long, code: String, msg: String): FinalIllustrationResultEnvelope =
        FinalIllustrationResultEnvelope(
            jobId = jobId.toString(),
            type = "GENERATE_FINAL_ILLUSTRATION_FAILED",
            storyId = 1L,
            pageNumber = null,
            status = "FAILED",
            error = FinalIllustrationResultError(code = code, message = msg),
        )

    // -----------------------------------------------------------------------
    // 1. 페이지 N장 누적 → 마지막 도착 시 SUCCESS
    // -----------------------------------------------------------------------

    @Test
    fun `페이지 N장 누적되어 마지막 도착 시 SUCCESS`() {
        val job = pendingJob(jobId = 100L, storyId = 1L, pageCount = 3)
        `when`(jobRepository.findByIdForUpdate(100L)).thenReturn(job)

        sut.handleSuccess(successEnvelope(100L, 1, "https://s3/p1.png"))
        assertEquals(JobStatus.RUNNING, job.status)
        assertNull(job.finishedAt)

        sut.handleSuccess(successEnvelope(100L, 2, "https://s3/p2.png"))
        assertEquals(JobStatus.RUNNING, job.status)
        assertNull(job.finishedAt)

        sut.handleSuccess(successEnvelope(100L, 3, "https://s3/p3.png"))
        assertEquals(JobStatus.SUCCESS, job.status)
        assertNotNull(job.finishedAt)
    }

    // -----------------------------------------------------------------------
    // 2. 이미 SUCCESS 인 잡은 추가 호출 무시
    // -----------------------------------------------------------------------

    @Test
    fun `이미 SUCCESS 인 잡은 추가 호출 무시`() {
        val job = pendingJob(jobId = 101L, storyId = 1L, pageCount = 1).apply {
            status = JobStatus.SUCCESS
        }
        `when`(jobRepository.findByIdForUpdate(101L)).thenReturn(job)

        sut.handleSuccess(successEnvelope(101L, 1, "https://s3/x.png"))

        // Early-return before sceneRepository is ever consulted
        verify(sceneRepository, never()).findByStoryIdAndPageNumber(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
        )
    }

    @Test
    fun `이미 FAILED 인 잡은 추가 호출 무시`() {
        val job = pendingJob(jobId = 104L, storyId = 1L, pageCount = 1).apply {
            status = JobStatus.FAILED
        }
        `when`(jobRepository.findByIdForUpdate(104L)).thenReturn(job)

        sut.handleSuccess(successEnvelope(104L, 1, "https://s3/x.png"))

        verify(sceneRepository, never()).findByStoryIdAndPageNumber(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
        )
    }

    // -----------------------------------------------------------------------
    // 3. Scene 이 이미 있으면 illustrationUrl 즉시 update
    // -----------------------------------------------------------------------

    @Test
    fun `Scene 이 이미 있으면 illustrationUrl 즉시 update`() {
        val job = pendingJob(jobId = 102L, storyId = 5L, pageCount = 2)
        `when`(jobRepository.findByIdForUpdate(102L)).thenReturn(job)

        val scene = Scene(id = 1L, storyId = 5L, pageNumber = 1, illustrationUrl = null)
        `when`(sceneRepository.findByStoryIdAndPageNumber(5L, 1)).thenReturn(scene)

        sut.handleSuccess(successEnvelope(102L, 1, "https://s3/late.png"))

        assertEquals("https://s3/late.png", scene.illustrationUrl)
    }

    // -----------------------------------------------------------------------
    // 4. handleFailure: FAILED + errorMessage + finishedAt
    // -----------------------------------------------------------------------

    @Test
    fun `handleFailure 가 status FAILED 와 errorMessage 와 finishedAt 설정`() {
        val job = pendingJob(jobId = 103L, storyId = 1L, pageCount = 2)
        `when`(jobRepository.findByIdForUpdate(103L)).thenReturn(job)

        sut.handleFailure(failureEnvelope(103L, "AI_TIMEOUT", "model timeout"))

        assertEquals(JobStatus.FAILED, job.status)
        assertEquals("AI_TIMEOUT: model timeout", job.errorMessage)
        assertNotNull(job.finishedAt)
    }

    // -----------------------------------------------------------------------
    // 5. 존재하지 않는 jobId → silent warn, no exception, no DB write
    // -----------------------------------------------------------------------

    @Test
    fun `존재하지 않는 jobId 면 silent log warn 후 noop`() {
        `when`(jobRepository.findByIdForUpdate(999L)).thenReturn(null)

        assertDoesNotThrow {
            sut.handleSuccess(successEnvelope(999L, 1, "https://s3/x.png"))
        }

        verify(sceneRepository, never()).findByStoryIdAndPageNumber(
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyInt(),
        )
    }
}
