package com.s210.backend.domain.auth.presentation.support

import com.fasterxml.jackson.databind.ObjectMapper
import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import com.s210.backend.domain.auth.presentation.response.AuthResponse
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder
import org.springframework.web.util.UriUtils
import java.net.URI
import java.nio.charset.StandardCharsets

@Component
class OauthCallbackRedirectBuilder(
    private val oauthRedirectUriResolver: OauthRedirectUriResolver,
) {
    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()

    fun buildSuccessRedirect(origin: String, authResponse: AuthResponse): URI {
        val payload = objectMapper.writeValueAsString(authResponse)
        return buildFragmentRedirect(origin, "payload", payload)
    }

    fun buildFailureRedirect(origin: String, message: String): URI {
        return buildFragmentRedirect(origin, "error", message)
    }

    private fun buildFragmentRedirect(origin: String, key: String, value: String): URI {
        val encodedValue = UriUtils.encode(value, StandardCharsets.UTF_8)
        val frontendCallbackUri = oauthRedirectUriResolver.buildFrontendCallbackUri(origin)

        return UriComponentsBuilder.fromUriString(frontendCallbackUri)
            .fragment("$key=$encodedValue")
            .build(true)
            .toUri()
    }
}
