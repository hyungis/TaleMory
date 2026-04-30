package com.s210.backend.common.redis

import com.s210.backend.domain.job.model.JobStatus
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.data.redis.core.HashOperations
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration
import java.time.Instant

@ExtendWith(MockitoExtension::class)
class TtsPreviewRedisRepositoryTest {

    private lateinit var redis: StringRedisTemplate
    private lateinit var hashOps: HashOperations<String, String, String>
    private lateinit var repo: TtsPreviewRedisRepository

    @BeforeEach
    fun setUp() {
        redis = mock(StringRedisTemplate::class.java)
        @Suppress("UNCHECKED_CAST")
        hashOps = mock(HashOperations::class.java) as HashOperations<String, String, String>
        `when`(redis.opsForHash<String, String>()).thenReturn(hashOps)
        repo = TtsPreviewRedisRepository(redis)
    }

    @Test
    fun `createPending writes PENDING fields and applies TTL`() {
        val previewId = "p-1"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>
        val ttlCaptor = ArgumentCaptor.forClass(Duration::class.java)

        repo.createPending(previewId = previewId, userId = 7L, voiceProfileId = 42L)

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), ttlCaptor.capture())

        val captured = mapCaptor.value
        assertThat(captured["userId"]).isEqualTo("7")
        assertThat(captured["voiceProfileId"]).isEqualTo("42")
        assertThat(captured["status"]).isEqualTo("PENDING")
        assertThat(captured).containsKey("createdAt")
        assertThat(captured).doesNotContainKey("audioUrl")
        assertThat(captured).doesNotContainKey("errorCode")
        assertThat(ttlCaptor.value).isEqualTo(TtsPreviewRedisRepository.TTL)
    }

    @Test
    fun `markSuccess sets status SUCCESS and audioUrl and finishedAt`() {
        val previewId = "p-2"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>

        repo.markSuccess(previewId = previewId, audioUrl = "https://s3/preview.wav")

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), org.mockito.ArgumentMatchers.eq(TtsPreviewRedisRepository.TTL))

        val captured = mapCaptor.value
        assertThat(captured["status"]).isEqualTo("SUCCESS")
        assertThat(captured["audioUrl"]).isEqualTo("https://s3/preview.wav")
        assertThat(captured).containsKey("finishedAt")
    }

    @Test
    fun `markFailed sets status FAILED with errorCode and errorMessage and finishedAt`() {
        val previewId = "p-3"
        val key = "storybook:tts:preview:$previewId"

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>

        repo.markFailed(previewId = previewId, errorCode = "TTS_INFER_FAILED", errorMessage = "GPU OOM")

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), org.mockito.ArgumentMatchers.eq(TtsPreviewRedisRepository.TTL))

        val captured = mapCaptor.value
        assertThat(captured["status"]).isEqualTo("FAILED")
        assertThat(captured["errorCode"]).isEqualTo("TTS_INFER_FAILED")
        assertThat(captured["errorMessage"]).isEqualTo("GPU OOM")
        assertThat(captured).containsKey("finishedAt")
        assertThat(captured).doesNotContainKey("audioUrl")
    }

    @Test
    fun `get returns snapshot when key exists with all required fields`() {
        val previewId = "p-4"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(
            mapOf(
                "userId" to "7",
                "voiceProfileId" to "42",
                "status" to "SUCCESS",
                "audioUrl" to "https://s3/preview.wav",
                "createdAt" to "2026-04-30T12:00:00Z",
                "finishedAt" to "2026-04-30T12:00:08Z",
            )
        )

        val snapshot = repo.get(previewId)

        assertThat(snapshot).isNotNull
        assertThat(snapshot!!.previewId).isEqualTo(previewId)
        assertThat(snapshot.userId).isEqualTo(7L)
        assertThat(snapshot.voiceProfileId).isEqualTo(42L)
        assertThat(snapshot.status).isEqualTo(JobStatus.SUCCESS)
        assertThat(snapshot.audioUrl).isEqualTo("https://s3/preview.wav")
        assertThat(snapshot.createdAt).isEqualTo(Instant.parse("2026-04-30T12:00:00Z"))
        assertThat(snapshot.finishedAt).isEqualTo(Instant.parse("2026-04-30T12:00:08Z"))
    }

    @Test
    fun `get returns null when key missing`() {
        val previewId = "p-missing"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(emptyMap())

        assertThat(repo.get(previewId)).isNull()
    }

    @Test
    fun `get parses FAILED snapshot with errorCode and errorMessage`() {
        val previewId = "p-failed"
        val key = "storybook:tts:preview:$previewId"
        `when`(hashOps.entries(key)).thenReturn(
            mapOf(
                "userId" to "7",
                "voiceProfileId" to "42",
                "status" to "FAILED",
                "errorCode" to "TTS_INFER_FAILED",
                "errorMessage" to "GPU OOM",
                "createdAt" to "2026-04-30T12:00:00Z",
                "finishedAt" to "2026-04-30T12:00:02Z",
            )
        )

        val snapshot = repo.get(previewId)
        assertThat(snapshot!!.status).isEqualTo(JobStatus.FAILED)
        assertThat(snapshot.errorCode).isEqualTo("TTS_INFER_FAILED")
        assertThat(snapshot.errorMessage).isEqualTo("GPU OOM")
        assertThat(snapshot.audioUrl).isNull()
    }
}
