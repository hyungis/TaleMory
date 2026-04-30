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
import org.springframework.data.redis.core.ListOperations
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.ValueOperations
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.Duration

/**
 * IllustrationVersionRedisRepository 단위 테스트.
 *
 * 인프라(Redis 서버) 없이 Mockito 로 StringRedisTemplate 을 대체.
 * List LPUSH/LTRIM/EXPIRE, ValueOps SET, getCurrent null 반환을 검증.
 */
@ExtendWith(MockitoExtension::class)
class IllustrationVersionRedisRepositoryTest {

    private lateinit var redis: StringRedisTemplate
    private lateinit var listOps: ListOperations<String, String>
    private lateinit var valueOps: ValueOperations<String, String>
    private lateinit var repo: IllustrationVersionRedisRepository

    @BeforeEach
    fun setUp() {
        redis = mock(StringRedisTemplate::class.java)
        @Suppress("UNCHECKED_CAST")
        listOps = mock(ListOperations::class.java) as ListOperations<String, String>
        @Suppress("UNCHECKED_CAST")
        valueOps = mock(ValueOperations::class.java) as ValueOperations<String, String>
        repo = IllustrationVersionRedisRepository(redis, jacksonObjectMapper())
    }

    @Test
    fun `pushVersion appends to list head and sets current`() {
        val sceneId = 42L
        val versionsKey = "${IllustrationVersionRedisRepository.VERSIONS_PREFIX}:$sceneId"
        val currentKey = "${IllustrationVersionRedisRepository.CURRENT_PREFIX}:$sceneId"

        `when`(redis.opsForList()).thenReturn(listOps)
        `when`(redis.opsForValue()).thenReturn(valueOps)

        val jsonCaptor = ArgumentCaptor.forClass(String::class.java)
        val trimStartCaptor = ArgumentCaptor.forClass(Long::class.java)
        val trimEndCaptor = ArgumentCaptor.forClass(Long::class.java)
        val expireKeyCaptor = ArgumentCaptor.forClass(String::class.java)
        val expireDurationCaptor = ArgumentCaptor.forClass(Duration::class.java)
        val currentValueCaptor = ArgumentCaptor.forClass(String::class.java)
        val currentTtlCaptor = ArgumentCaptor.forClass(Duration::class.java)

        repo.pushVersion(
            sceneId = sceneId,
            version = 1,
            url = "https://s3/scene42.png",
            prompt = "a sunny meadow",
            jobId = 99L,
        )

        // leftPush: key + json value
        verify(listOps).leftPush(
            org.mockito.ArgumentMatchers.eq(versionsKey),
            jsonCaptor.capture(),
        )
        val capturedJson = jsonCaptor.value
        val objectMapper = jacksonObjectMapper()
        @Suppress("UNCHECKED_CAST")
        val parsed = objectMapper.readValue(capturedJson, Map::class.java) as Map<String, Any?>
        assertThat(parsed["version"]).isEqualTo(1)
        assertThat(parsed["url"]).isEqualTo("https://s3/scene42.png")
        assertThat(parsed["jobId"]).isEqualTo(99)

        // trim: 0 .. MAX_VERSIONS-1
        verify(listOps).trim(
            org.mockito.ArgumentMatchers.eq(versionsKey),
            trimStartCaptor.capture(),
            trimEndCaptor.capture(),
        )
        assertThat(trimStartCaptor.value).isEqualTo(0L)
        assertThat(trimEndCaptor.value).isEqualTo(IllustrationVersionRedisRepository.MAX_VERSIONS - 1)

        // expire on versions key
        verify(redis).expire(expireKeyCaptor.capture(), expireDurationCaptor.capture())
        assertThat(expireKeyCaptor.value).isEqualTo(versionsKey)
        assertThat(expireDurationCaptor.value).isEqualTo(IllustrationVersionRedisRepository.TTL)

        // current key SET with TTL
        verify(valueOps).set(
            org.mockito.ArgumentMatchers.eq(currentKey),
            currentValueCaptor.capture(),
            currentTtlCaptor.capture(),
        )
        assertThat(currentValueCaptor.value).isEqualTo("1")
        assertThat(currentTtlCaptor.value).isEqualTo(IllustrationVersionRedisRepository.TTL)
    }

    @Test
    fun `getCurrent returns null when key absent`() {
        val sceneId = 999L
        val currentKey = "${IllustrationVersionRedisRepository.CURRENT_PREFIX}:$sceneId"
        `when`(redis.opsForValue()).thenReturn(valueOps)
        `when`(valueOps.get(currentKey)).thenReturn(null)

        val result = repo.getCurrent(sceneId)

        assertThat(result).isNull()
    }
}
