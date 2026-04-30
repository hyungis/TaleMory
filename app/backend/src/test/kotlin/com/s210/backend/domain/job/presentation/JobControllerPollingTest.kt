package com.s210.backend.domain.job.presentation

import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.domain.job.application.JobService
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Story
import com.s210.backend.domain.story.infrastructure.repository.StoryRepository
import com.s210.backend.domain.story.model.Difficulty
import com.s210.backend.domain.story.model.StoryStatus
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import tools.jackson.databind.ObjectMapper
import java.util.Optional

/**
 * JobService.findJob() 의 Redis progress 오버레이 동작 검증.
 *
 * - PENDING/RUNNING 상태에서 Redis 값이 progress/currentStep/stage 로 노출되는지
 * - terminal status 에서 Redis 조회가 skip 되는지
 * - Redis miss 시 progress=null 이지만 status 폴링은 정상인지
 */
@ExtendWith(MockitoExtension::class)
class JobControllerPollingTest {

    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val storyRepository: StoryRepository = mock(StoryRepository::class.java)
    private val voiceProfileRepository: VoiceProfileRepository = mock(VoiceProfileRepository::class.java)
    private val jobStatusRedisRepo: JobStatusRedisRepository = mock(JobStatusRedisRepository::class.java)
    private val objectMapper: ObjectMapper = ObjectMapper()

    private val service = JobService(
        jobRepository = jobRepository,
        storyRepository = storyRepository,
        voiceProfileRepository = voiceProfileRepository,
        objectMapper = objectMapper,
        jobStatusRedisRepository = jobStatusRedisRepo,
    )

    private val userId = 1L
    private val storyId = 100L

    // ------------------------------------------------------------------
    // Test 1: PENDING → Redis 값이 응답에 포함됨
    // ------------------------------------------------------------------

    @Test
    fun `polling response includes Redis progress when status is PENDING`() {
        val job = createJob(storyId = storyId, status = JobStatus.PENDING)
        `when`(jobRepository.findById(job.id)).thenReturn(Optional.of(job))

        val story = createStory(userId = userId, storyId = storyId)
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))

        `when`(jobStatusRedisRepo.getStatus(storyId)).thenReturn(
            mapOf(
                "stage" to "tts",
                "progress" to "40",
                "current_step" to "TTS 4/10",
            )
        )

        val response = service.findJob(userId, job.id)

        assertThat(response.progress).isEqualTo(40)
        assertThat(response.currentStep).isEqualTo("TTS 4/10")
        assertThat(response.stage).isEqualTo("tts")
        assertThat(response.status).isEqualTo("PENDING")
    }

    // ------------------------------------------------------------------
    // Test 2: SUCCESS → Redis 조회 없음 (terminal), progress=null
    // ------------------------------------------------------------------

    @Test
    fun `polling falls back to DB only when status is terminal SUCCESS`() {
        val job = createJob(storyId = storyId, status = JobStatus.SUCCESS)
        `when`(jobRepository.findById(job.id)).thenReturn(Optional.of(job))

        val story = createStory(userId = userId, storyId = storyId)
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))

        val response = service.findJob(userId, job.id)

        assertThat(response.status).isEqualTo("SUCCESS")
        assertThat(response.progress).isNull()
        assertThat(response.currentStep).isNull()
        assertThat(response.stage).isNull()
    }

    // ------------------------------------------------------------------
    // Test 3: terminal status → jobStatusRedisRepo 가 호출되면 안 됨
    // ------------------------------------------------------------------

    @Test
    fun `terminal status skips Redis lookup`() {
        val job = createJob(storyId = storyId, status = JobStatus.SUCCESS)
        `when`(jobRepository.findById(job.id)).thenReturn(Optional.of(job))

        val story = createStory(userId = userId, storyId = storyId)
        `when`(storyRepository.findById(storyId)).thenReturn(Optional.of(story))

        service.findJob(userId, job.id)

        verify(jobStatusRedisRepo, never()).getStatus(storyId)
    }

    @Test
    fun `preview job checks ownership using voice profile`() {
        val voiceProfile = VoiceProfile(
            id = 55L,
            userId = userId,
            title = "sample",
            audioUrl = "stories/voice/1/ref.wav",
        )
        val job = StoryGenerationJob(
            id = 2L,
            storyId = 0L,
            jobType = JobType.TTS_PREVIEW,
            status = JobStatus.SUCCESS,
            requestPayload = """{"voiceProfileId":55}""",
        )
        `when`(jobRepository.findById(job.id)).thenReturn(Optional.of(job))
        `when`(voiceProfileRepository.findByIdAndDeletedAtIsNull(55L)).thenReturn(voiceProfile)

        val response = service.findJob(userId, job.id)

        assertThat(response.jobType).isEqualTo("TTS_PREVIEW")
        assertThat(response.jobId).isEqualTo(job.id)
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private fun createJob(
        storyId: Long,
        status: JobStatus,
        jobType: JobType = JobType.TTS,
    ): StoryGenerationJob =
        StoryGenerationJob(
            id = 1L,
            storyId = storyId,
            jobType = jobType,
            status = status,
        )

    private fun createStory(
        userId: Long,
        storyId: Long,
    ): Story =
        Story(
            id = storyId,
            userId = userId,
            status = StoryStatus.PUBLISHED,
            difficulty = Difficulty.BEGINNER,
            mainCharacterJson = """{"name":"아이","age":5,"gender":"MALE"}""",
            companionsJson = "[]",
        )
}
