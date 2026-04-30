package com.s210.backend.domain.tts.application

import com.s210.backend.common.redis.TtsCacheRedisRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class TtsCacheServiceTest {
    private val repo: TtsCacheRedisRepository = mock(TtsCacheRedisRepository::class.java)
    private val service = TtsCacheService(repo)

    @Test
    fun `normalize lowercases trims and collapses spaces`() {
        assertThat(service.normalize("  Hello   WORLD  ")).isEqualTo("hello world")
    }

    @Test
    fun `hash is deterministic for same normalized input`() {
        val a = service.computeHash("Hello world")
        val b = service.computeHash("hello   world")
        assertThat(a).isEqualTo(b)
        assertThat(a).hasSize(16)
    }

    @Test
    fun `lookup returns hit when redis returns value`() {
        val hash = service.computeHash("hi")
        `when`(repo.get(42L, hash)).thenReturn("https://s3/x.wav")
        val result = service.lookup(42L, "hi")
        assertThat(result).isEqualTo("https://s3/x.wav")
    }

    @Test
    fun `lookup returns null on miss`() {
        val hash = service.computeHash("missing")
        `when`(repo.get(42L, hash)).thenReturn(null)
        assertThat(service.lookup(42L, "missing")).isNull()
    }

    @Test
    fun `store calls repo with correct hash`() {
        val hash = service.computeHash("Hello")
        service.store(42L, "Hello", "https://s3/h.wav")
        verify(repo).set(42L, hash, "https://s3/h.wav")
    }
}
