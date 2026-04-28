package com.s210.backend.common.redis

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

/**
 * JobStatusRedisRepository 단위 테스트.
 *
 * 인프라(Redis 서버) 없이 Mockito 로 StringRedisTemplate 을 대체.
 * Hash 키 포맷, HSET/HGETALL, started_at 보존, TTL 설정, error_message 조건부 추가를 검증.
 */
@ExtendWith(MockitoExtension::class)
class JobStatusRedisRepositoryTest {

    private lateinit var redis: StringRedisTemplate
    private lateinit var hashOps: HashOperations<String, String, String>
    private lateinit var repo: JobStatusRedisRepository

    @BeforeEach
    fun setUp() {
        redis = mock(StringRedisTemplate::class.java)
        @Suppress("UNCHECKED_CAST")
        hashOps = mock(HashOperations::class.java) as HashOperations<String, String, String>
        `when`(redis.opsForHash<String, String>()).thenReturn(hashOps)
        repo = JobStatusRedisRepository(redis)
    }

    @Test
    fun `set status fields and read all`() {
        val key = "storybook:job:status:1"
        val storedMap = mutableMapOf<String, String>()

        // started_at 없음 → 첫 호출
        `when`(hashOps.get(key, "started_at")).thenReturn(null)
        // getStatus 호출 시 저장된 맵 반환 (stage, progress, current_step 포함, error_message 없음)
        `when`(hashOps.entries(key)).thenReturn(
            mapOf(
                "stage" to "tts",
                "progress" to "30",
                "current_step" to "generating",
                "updated_at" to "2026-01-01T00:00:00Z",
                "started_at" to "2026-01-01T00:00:00Z",
            )
        )

        repo.setStatus(
            storyId = 1L,
            stage = "tts",
            progress = 30,
            currentStep = "generating",
            errorMessage = null,
        )
        val result = repo.getStatus(storyId = 1L)

        assertThat(result["stage"]).isEqualTo("tts")
        assertThat(result["progress"]).isEqualTo("30")
        assertThat(result["current_step"]).isEqualTo("generating")
        assertThat(result).doesNotContainKey("error_message")
    }

    @Test
    fun `getStatus returns empty map when key missing`() {
        val key = "storybook:job:status:999"
        `when`(hashOps.entries(key)).thenReturn(emptyMap())

        val result = repo.getStatus(storyId = 999L)

        assertThat(result).isEmpty()
    }

    @Test
    fun `setStatus with errorMessage stores error_message field`() {
        val key = "storybook:job:status:2"

        // started_at 이미 있음 → 보존 (두 번째 호출 시나리오)
        `when`(hashOps.get(key, "started_at")).thenReturn("2026-01-01T00:00:00Z")

        @Suppress("UNCHECKED_CAST")
        val mapCaptor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, String>>
        val ttlCaptor = ArgumentCaptor.forClass(Duration::class.java)

        repo.setStatus(
            storyId = 2L,
            stage = "failed",
            progress = 0,
            currentStep = "error",
            errorMessage = "TTS 서비스 오류",
        )

        verify(hashOps).putAll(org.mockito.ArgumentMatchers.eq(key), mapCaptor.capture())
        verify(redis).expire(org.mockito.ArgumentMatchers.eq(key), ttlCaptor.capture())

        val capturedFields = mapCaptor.value
        assertThat(capturedFields["stage"]).isEqualTo("failed")
        assertThat(capturedFields["error_message"]).isEqualTo("TTS 서비스 오류")
        // started_at 이 이미 있으므로 fields 에 포함되면 안 됨
        assertThat(capturedFields).doesNotContainKey("started_at")
        assertThat(ttlCaptor.value).isEqualTo(JobStatusRedisRepository.TTL)
    }
}
