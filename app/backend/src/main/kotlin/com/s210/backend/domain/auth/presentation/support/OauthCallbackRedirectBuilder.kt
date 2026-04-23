package com.s210.backend.domain.auth.presentation.support

import com.fasterxml.jackson.databind.ObjectMapper
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder
import org.springframework.web.util.UriUtils
import java.net.URI
import java.nio.charset.StandardCharsets

@Component
class OauthCallbackRedirectBuilder(
    @Value("\${oauth.frontend-callback-uri}")
    private val frontendCallbackUri: String,
) {
    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()

    fun buildSuccessRedirect(authResponse: AuthResponse): URI {
        val payload = objectMapper.writeValueAsString(authResponse)
        return buildFragmentRedirect("payload", payload)
    }

    fun buildFailureRedirect(message: String): URI {
        return buildFragmentRedirect("error", message)
    }

    private fun buildFragmentRedirect(key: String, value: String): URI {
        val encodedValue = UriUtils.encode(value, StandardCharsets.UTF_8)

        return UriComponentsBuilder.fromUriString(frontendCallbackUri)
            .fragment("$key=$encodedValue")
            .build(true)
            .toUri()
    }
}
