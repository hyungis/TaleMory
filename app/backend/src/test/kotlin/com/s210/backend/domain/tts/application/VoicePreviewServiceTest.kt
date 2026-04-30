package com.s210.backend.domain.tts.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.tts.application.dto.VoicePreviewResponse
import com.s210.backend.domain.voice.entity.VoiceProfile
import com.s210.backend.domain.voice.exception.VoiceErrorCode
import com.s210.backend.domain.voice.infrastructure.repository.VoiceProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

@ExtendWith(MockitoExtension::class)
class VoicePreviewServiceTest {

    // ── 유효한 VoiceProfile 픽스처 ──────────────────────────────────────────
    private fun voiceProfile(
        id: Long = 1L,
        userId: Long = 42L,
        audioUrl: String? = "https://s3/ref.wav",
    ) = VoiceProfile(
        id = id,
        userId = userId,
        title = "test-voice",
        audioUrl = audioUrl,
    )

    /** 매 테스트마다 독립적인 mock 세트를 생성해 strict stubbing 충돌 방지 */
    private fun makeService(
        repo: VoiceProfileRepository = mock(VoiceProfileRepository::class.java),
        webClient: WebClient = mock(WebClient::class.java, RETURNS_DEEP_STUBS),
    ) = Triple(repo, webClient, VoicePreviewService(repo, webClient))

    // ── 1. 빈 텍스트 거부 ────────────────────────────────────────────────────
    @Test
    fun `preview rejects blank text`() {
        val (_, _, service) = makeService()
        assertThatThrownBy { service.preview(42L, 1L, "   ") }
            .isInstanceOf(BusinessException::class.java)
            .satisfies({ ex ->
                assertThat((ex as BusinessException).errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            })
    }

    // ── 2. 500자 초과 텍스트 거부 ────────────────────────────────────────────
    @Test
    fun `preview rejects text longer than 500 chars`() {
        val (_, _, service) = makeService()
        val longText = "a".repeat(501)
        assertThatThrownBy { service.preview(42L, 1L, longText) }
            .isInstanceOf(BusinessException::class.java)
            .satisfies({ ex ->
                assertThat((ex as BusinessException).errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            })
    }

    // ── 3. 다른 유저의 voice profile 거부 ────────────────────────────────────
    @Test
    fun `preview rejects another user's voice profile`() {
        val (repo, _, service) = makeService()
        `when`(repo.findByIdAndDeletedAtIsNull(1L)).thenReturn(voiceProfile(userId = 99L))

        assertThatThrownBy { service.preview(42L, 1L, "Hello world") }
            .isInstanceOf(BusinessException::class.java)
            .satisfies({ ex ->
                assertThat((ex as BusinessException).errorCode).isEqualTo(VoiceErrorCode.FORBIDDEN)
            })
    }

    // ── 4. audio_url 없는 voice profile 거부 ─────────────────────────────────
    @Test
    fun `preview rejects voice profile without audio_url`() {
        val (repo, _, service) = makeService()
        `when`(repo.findByIdAndDeletedAtIsNull(1L)).thenReturn(voiceProfile(audioUrl = null))

        assertThatThrownBy { service.preview(42L, 1L, "Hello world") }
            .isInstanceOf(BusinessException::class.java)
            .satisfies({ ex ->
                assertThat((ex as BusinessException).errorCode).isEqualTo(VoiceErrorCode.INVALID_REQUEST)
            })
    }

    // ── 5. AI 호출 예외 → AI_PROVIDER_ERROR ──────────────────────────────────
    @Test
    fun `preview wraps AI exception as AI_PROVIDER_ERROR`() {
        val (repo, webClient, service) = makeService()
        `when`(repo.findByIdAndDeletedAtIsNull(1L)).thenReturn(voiceProfile())
        `when`(webClient.post()).thenThrow(RuntimeException("AI down"))

        assertThatThrownBy { service.preview(42L, 1L, "Hello world") }
            .isInstanceOf(BusinessException::class.java)
            .satisfies({ ex ->
                assertThat((ex as BusinessException).errorCode).isEqualTo(VoiceErrorCode.AI_PROVIDER_ERROR)
            })
    }

    // ── 6. Happy path ─────────────────────────────────────────────────────────
    @Test
    fun `preview returns AI response on success`() {
        val repo = mock(VoiceProfileRepository::class.java)
        val uriSpec = mock(WebClient.RequestBodyUriSpec::class.java, RETURNS_DEEP_STUBS)
        val responseSpec = mock(WebClient.ResponseSpec::class.java, RETURNS_DEEP_STUBS)
        val webClient = mock(WebClient::class.java)
        val service = VoicePreviewService(repo, webClient)

        val expected = VoicePreviewResponse(
            audioUrl = "https://s3/out.wav",
            s3Key = "tts/out.wav",
            durationMs = 1234L,
        )
        `when`(repo.findByIdAndDeletedAtIsNull(1L)).thenReturn(voiceProfile())
        `when`(webClient.post()).thenReturn(uriSpec)
        `when`(uriSpec.uri(anyString(), anyString())).thenReturn(uriSpec)
        `when`(uriSpec.bodyValue(any())).thenReturn(uriSpec)
        `when`(uriSpec.retrieve()).thenReturn(responseSpec)
        // bodyToMono<T>() in Kotlin uses ParameterizedTypeReference overload.
        // doReturn avoids unnecessary argument evaluation / type cast issues.
        @Suppress("UNCHECKED_CAST")
        doReturn(Mono.just(expected)).`when`(responseSpec)
            .bodyToMono(any<org.springframework.core.ParameterizedTypeReference<VoicePreviewResponse>>())

        val result = service.preview(42L, 1L, "Hello world")
        assertThat(result).isEqualTo(expected)
    }
}
