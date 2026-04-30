package com.s210.backend.domain.tts.application

import com.s210.backend.common.redis.JobStatusRedisRepository
import com.s210.backend.domain.job.entity.StoryGenerationJob
import com.s210.backend.domain.job.infrastructure.repository.StoryGenerationJobRepository
import com.s210.backend.domain.job.model.JobStatus
import com.s210.backend.domain.job.model.JobType
import com.s210.backend.domain.story.entity.Scene
import com.s210.backend.domain.story.entity.SceneSentence
import com.s210.backend.domain.story.infrastructure.repository.SceneRepository
import com.s210.backend.domain.story.infrastructure.repository.SceneSentenceRepository
import com.s210.backend.domain.storyboard.application.dto.StoryError
import com.s210.backend.domain.storyboard.application.dto.UsageInfo
import com.s210.backend.domain.tts.application.dto.AppliedStyle
import com.s210.backend.domain.tts.application.dto.SceneSentenceUpdate
import com.s210.backend.domain.tts.application.dto.StoryTtsResultEnvelope
import com.s210.backend.domain.tts.application.dto.StoryTtsResultPayload
import com.s210.backend.domain.tts.application.dto.TtsAudio
import com.s210.backend.domain.tts.application.dto.TtsResultItem
import com.s210.backend.domain.tts.application.dto.TtsSummary
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class TtsResultHandlerTest {

    private val jobRepository: StoryGenerationJobRepository = mock(StoryGenerationJobRepository::class.java)
    private val sceneRepository: SceneRepository = mock(SceneRepository::class.java)
    private val sceneSentenceRepository: SceneSentenceRepository = mock(SceneSentenceRepository::class.java)
    private val ttsCacheService: TtsCacheService = mock(TtsCacheService::class.java)
    private val jobStatusRepo: JobStatusRedisRepository = mock(JobStatusRedisRepository::class.java)
    private val previewRedis: com.s210.backend.common.redis.TtsPreviewRedisRepository =
        mock(com.s210.backend.common.redis.TtsPreviewRedisRepository::class.java)
    private val objectMapper = jacksonObjectMapper()

    private val handler = TtsResultHandler(
        jobRepository = jobRepository,
        sceneRepository = sceneRepository,
        sceneSentenceRepository = sceneSentenceRepository,
        ttsCacheService = ttsCacheService,
        jobStatusRepo = jobStatusRepo,
        previewRedis = previewRedis,
        objectMapper = objectMapper,
    )

    // -----------------------------------------------------------------------
    // Case 1: invalid jobId (non-Long) → warn and skip
    // -----------------------------------------------------------------------

    @Test
    fun `unknown jobId triggers warn and skip`() {
        val envelope = buildEnvelope(jobId = "abc", status = "COMPLETED")
        handler.handle(envelope)

        verify(jobRepository, never()).findById(anyLong())
    }

    // -----------------------------------------------------------------------
    // Case 2: already finalized job → skip
    // -----------------------------------------------------------------------

    @Test
    fun `already finalized job is skipped`() {
        val job = buildJob(id = 1L, status = JobStatus.SUCCESS)
        `when`(jobRepository.findById(1L)).thenReturn(Optional.of(job))

        val envelope = buildEnvelope(jobId = "1", status = "COMPLETED")
        handler.handle(envelope)

        // No scene queries, no cache, no redis
        verify(sceneRepository, never()).findAllByStoryId(anyLong())
        verify(ttsCacheService, never()).store(anyLong(), anyString(), anyString())
        verify(jobStatusRepo, never()).setStatus(anyLong(), anyString(), anyInt(), anyString(), org.mockito.ArgumentMatchers.any())
    }

    // -----------------------------------------------------------------------
    // Case 3: COMPLETED → sentence update + cache store + redis done
    // -----------------------------------------------------------------------

    @Test
    fun `completed updates sentences and stores cache`() {
        val storyId = 10L
        val job = buildJob(id = 5L, status = JobStatus.PENDING, storyId = storyId)
        `when`(jobRepository.findById(5L)).thenReturn(Optional.of(job))

        val scene = buildScene(id = 20L, storyId = storyId)
        `when`(sceneRepository.findAllByStoryId(storyId)).thenReturn(listOf(scene))

        val sentence = buildSentence(id = 1001L, sceneId = 20L, englishText = "Hello world.")
        `when`(sceneSentenceRepository.findAllBySceneIdIn(setOf(20L))).thenReturn(listOf(sentence))
        `when`(sceneSentenceRepository.findById(1001L)).thenReturn(Optional.of(sentence))

        val payload = buildPayload(
            storyId = storyId,
            voiceId = "42",
            sentenceId = 1001L,
            audioUrl = "https://s3/a.wav",
        )
        val envelope = buildEnvelope(jobId = "5", status = "COMPLETED", payload = payload)
        handler.handle(envelope)

        // sentence ttsAudioUrl updated
        assertEquals("https://s3/a.wav", sentence.ttsAudioUrl)

        // job finalized SUCCESS
        assertEquals(JobStatus.SUCCESS, job.status)

        // ttsCacheService.store called once (for the single item with audio)
        verify(ttsCacheService, times(1)).store(anyLong(), anyString(), anyString())

        // jobStatusRepo.setStatus called once (stage=done)
        verify(jobStatusRepo, times(1)).setStatus(anyLong(), anyString(), anyInt(), anyString(), org.mockito.ArgumentMatchers.any())
    }

    // -----------------------------------------------------------------------
    // Case 4: FAILED → job marked FAILED + redis stage=failed
    // -----------------------------------------------------------------------

    @Test
    fun `failed records error message`() {
        val storyId = 11L
        val job = buildJob(id = 6L, status = JobStatus.PENDING, storyId = storyId)
        `when`(jobRepository.findById(6L)).thenReturn(Optional.of(job))

        val envelope = buildEnvelope(
            jobId = "6",
            status = "FAILED",
            error = StoryError(code = "AI_ERROR", message = "provider timeout"),
        )
        handler.handle(envelope)

        assertEquals(JobStatus.FAILED, job.status)
        assertEquals("AI_ERROR: provider timeout", job.errorMessage)

        // jobStatusRepo.setStatus called once (stage=failed)
        verify(jobStatusRepo, times(1)).setStatus(anyLong(), anyString(), anyInt(), anyString(), org.mockito.ArgumentMatchers.any())

        // no scene queries on failure
        verify(sceneRepository, never()).findAllByStoryId(anyLong())
    }

    // -----------------------------------------------------------------------
    // Case 5: cross-story sentenceId → rejected (WARN + no update)
    // -----------------------------------------------------------------------

    @Test
    fun `cross-story sentence_id is rejected`() {
        val storyId = 12L
        val job = buildJob(id = 7L, status = JobStatus.PENDING, storyId = storyId)
        `when`(jobRepository.findById(7L)).thenReturn(Optional.of(job))

        // This story has scene 30, sentence 2001
        val scene = buildScene(id = 30L, storyId = storyId)
        `when`(sceneRepository.findAllByStoryId(storyId)).thenReturn(listOf(scene))

        val ownSentence = buildSentence(id = 2001L, sceneId = 30L, englishText = "Own sentence.")
        `when`(sceneSentenceRepository.findAllBySceneIdIn(setOf(30L))).thenReturn(listOf(ownSentence))

        // Payload contains sentenceId 9999 — belongs to different story
        val payload = buildPayload(
            storyId = storyId,
            voiceId = "42",
            sentenceId = 9999L,         // NOT in ourSentenceIds
            audioUrl = "https://s3/cross.wav",
        )
        val envelope = buildEnvelope(jobId = "7", status = "COMPLETED", payload = payload)
        handler.handle(envelope)

        // ownSentence.ttsAudioUrl must remain null (cross-story sentence skipped)
        assertNull(ownSentence.ttsAudioUrl)

        // sentence 9999 should never be fetched (skipped in both sceneSentenceUpdates and items loops)
        verify(sceneSentenceRepository, never()).findById(9999L)

        // Job is still SUCCESS (cross-story skip is a WARN, not a failure)
        assertEquals(JobStatus.SUCCESS, job.status)
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private fun buildJob(
        id: Long,
        status: JobStatus,
        storyId: Long = 10L,
    ): StoryGenerationJob = StoryGenerationJob(
        id = id,
        storyId = storyId,
        jobType = JobType.TTS,
        status = status,
    )

    private fun buildScene(id: Long, storyId: Long): Scene = Scene(
        id = id,
        storyId = storyId,
        pageNumber = 1,
    )

    private fun buildSentence(id: Long, sceneId: Long, englishText: String): SceneSentence = SceneSentence(
        id = id,
        sceneId = sceneId,
        sentenceOrder = 1,
        englishText = englishText,
    )

    private fun buildEnvelope(
        jobId: String,
        status: String,
        payload: StoryTtsResultPayload? = null,
        error: StoryError? = null,
    ): StoryTtsResultEnvelope = StoryTtsResultEnvelope(
        jobId = jobId,
        type = if (status == "COMPLETED") "GENERATE_TTS_COMPLETED" else "GENERATE_TTS_FAILED",
        storyId = 10L,
        status = status,
        payload = payload,
        error = error,
    )

    private fun buildPayload(
        storyId: Long,
        voiceId: String,
        sentenceId: Long,
        audioUrl: String,
    ): StoryTtsResultPayload = StoryTtsResultPayload(
        storyId = storyId,
        voiceId = voiceId,
        items = listOf(
            TtsResultItem(
                sentenceId = sentenceId,
                appliedStyle = AppliedStyle(emotion = "neutral", stylePrompt = null),
                audio = TtsAudio(
                    audioUrl = audioUrl,
                    s3Key = "stories/tts/a.wav",
                    durationMs = 3500L,
                    format = "wav",
                ),
            ),
        ),
        sceneSentenceUpdates = listOf(
            SceneSentenceUpdate(
                sentenceId = sentenceId,
                ttsAudioUrl = audioUrl,
                ttsAudioS3Key = "stories/tts/a.wav",
            ),
        ),
        summary = TtsSummary(sentenceCount = 1),
        fullBookAudio = null,
        usage = UsageInfo(
            model = "cosy-voice",
            inputTokens = 0,
            outputTokens = 0,
            totalTokens = 0,
            costUsd = 0.012,
            promptTemplateVersion = "1.0",
        ),
    )

    // -----------------------------------------------------------------------
    // Preview: COMPLETED → markSuccess
    // -----------------------------------------------------------------------

    @Test
    fun `preview COMPLETED calls markSuccess with audioUrl from payload`() {
        val previewId = "p-success"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = com.s210.backend.domain.tts.application.dto.PreviewTtsResultPayload(
                voiceId = "42",
                audioUrl = "https://s3/preview.wav",
                durationMs = 1200,
                format = "wav",
            ),
        )

        handler.handle(envelope)

        verify(previewRedis).markSuccess(previewId, "https://s3/preview.wav")
        verify(jobRepository, never()).findById(anyLong())
    }

    @Test
    fun `preview FAILED calls markFailed with code and message from envelope error`() {
        val previewId = "p-failed"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "FAILED",
            error = com.s210.backend.domain.storyboard.application.dto.AiError(code = "TTS_INFER_FAILED", message = "GPU OOM"),
        )

        handler.handle(envelope)

        verify(previewRedis).markFailed(previewId, "TTS_INFER_FAILED", "GPU OOM")
    }

    @Test
    fun `preview COMPLETED with null payload calls markFailed with PAYLOAD_MISSING`() {
        val previewId = "p-null-payload"
        `when`(previewRedis.get(previewId)).thenReturn(
            com.s210.backend.common.redis.TtsPreviewSnapshot(
                previewId = previewId,
                userId = 7L,
                voiceProfileId = 42L,
                status = JobStatus.PENDING,
                audioUrl = null,
                errorCode = null,
                errorMessage = null,
                createdAt = java.time.Instant.now(),
                finishedAt = null,
            )
        )
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = null,
        )

        handler.handle(envelope)

        verify(previewRedis).markFailed(previewId, "PAYLOAD_MISSING", "AI 응답에 payload가 없습니다.")
    }

    @Test
    fun `preview unknown previewId logs warn and skips redis writes`() {
        val previewId = "p-missing"
        `when`(previewRedis.get(previewId)).thenReturn(null)
        val envelope = com.s210.backend.domain.tts.application.dto.PreviewTtsResultEnvelope(
            jobId = previewId,
            type = "tts.preview.result",
            status = "COMPLETED",
            payload = com.s210.backend.domain.tts.application.dto.PreviewTtsResultPayload(
                voiceId = "42",
                audioUrl = "https://s3/preview.wav",
                durationMs = 1200,
                format = "wav",
            ),
        )

        handler.handle(envelope)

        verify(previewRedis, never()).markSuccess(anyString(), anyString())
        verify(previewRedis, never()).markFailed(anyString(), anyString(), anyString())
    }
}
