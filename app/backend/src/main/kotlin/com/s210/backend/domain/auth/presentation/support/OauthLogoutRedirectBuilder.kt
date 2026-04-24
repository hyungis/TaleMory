package com.s210.backend.domain.auth.presentation.support

import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder

@Component
class OauthLogoutRedirectBuilder(
    private val oauthRedirectUriResolver: OauthRedirectUriResolver,
) {
    fun buildSuccessRedirect(origin: String, provider: String) =
        UriComponentsBuilder.fromUriString(oauthRedirectUriResolver.buildFrontendLogoutCallbackUri(origin))
            .queryParam("provider", provider)
            .build(true)
            .toUri()

    fun buildFailureRedirect(origin: String, message: String) =
        UriComponentsBuilder.fromUriString(oauthRedirectUriResolver.buildFrontendLogoutCallbackUri(origin))
            .queryParam("error", message)
            .build()
            .encode()
            .toUri()
}
