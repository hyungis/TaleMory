package com.s210.backend.domain.auth.presentation.support

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder

@Component
class OauthLogoutRedirectBuilder(
    @Value("\${oauth.frontend-logout-callback-uri}")
    private val frontendLogoutCallbackUri: String,
) {
    fun buildSuccessRedirect(provider: String) =
        UriComponentsBuilder.fromUriString(frontendLogoutCallbackUri)
            .queryParam("provider", provider)
            .build(true)
            .toUri()

    fun buildFailureRedirect(message: String) =
        UriComponentsBuilder.fromUriString(frontendLogoutCallbackUri)
            .queryParam("error", message)
            .build()
            .encode()
            .toUri()
}
