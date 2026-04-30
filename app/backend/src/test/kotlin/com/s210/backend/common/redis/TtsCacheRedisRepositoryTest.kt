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
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.ValueOperations
import java.time.Duration

/**
 * TtsCacheRedisRepository 단위 테스트.
 *
 * 인프라(Redis 서버) 없이 Mockito 로 StringRedisTemplate 을 대체.
 * 동일한 계약(키 포맷, GET/SET, null 반환)을 검증한다.
 */
@ExtendWith(MockitoExtension::class)
class TtsCacheRedisRepositoryTest {

    private lateinit var redis: StringRedisTemplate
    private lateinit var valueOps: ValueOperations<String, String>
    private lateinit var repo: TtsCacheRedisRepository

    @BeforeEach
    fun setUp() {
        redis = mock(StringRedisTemplate::class.java)
        @Suppress("UNCHECKED_CAST")
        valueOps = mock(ValueOperations::class.java) as ValueOperations<String, String>
        `when`(redis.opsForValue()).thenReturn(valueOps)
        repo = TtsCacheRedisRepository(redis)
    }

    @Test
    fun `set then get returns same value`() {
        val key = "storybook:tts:cache:42:abcdef0123456789"
        `when`(valueOps.get(key)).thenReturn("https://s3/a.wav")

        repo.set(voiceProfileId = 42, textHash = "abcdef0123456789", audioUrl = "https://s3/a.wav")
        val result = repo.get(voiceProfileId = 42, textHash = "abcdef0123456789")

        assertThat(result).isEqualTo("https://s3/a.wav")
    }

    @Test
    fun `get returns null when key absent`() {
        val key = "storybook:tts:cache:99:deadbeef00000000"
        `when`(valueOps.get(key)).thenReturn(null)

        val result = repo.get(voiceProfileId = 99, textHash = "deadbeef00000000")

        assertThat(result).isNull()
    }

    @Test
    fun `key format follows storybook tts cache vp hash`() {
        val keyCaptor = ArgumentCaptor.forClass(String::class.java)
        val valueCaptor = ArgumentCaptor.forClass(String::class.java)
        val ttlCaptor = ArgumentCaptor.forClass(Duration::class.java)

        repo.set(voiceProfileId = 7, textHash = "abc123", audioUrl = "x")

        verify(valueOps).set(keyCaptor.capture(), valueCaptor.capture(), ttlCaptor.capture())
        assertThat(keyCaptor.value).isEqualTo("storybook:tts:cache:7:abc123")
        assertThat(valueCaptor.value).isEqualTo("x")
        assertThat(ttlCaptor.value).isEqualTo(TtsCacheRedisRepository.TTL)
    }
}
