package com.s210.backend.domain.auth.infrastructure.oauth

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.auth.exception.AuthErrorCode
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.net.URI
import java.nio.charset.StandardCharsets
import java.util.Base64

@Component
class OauthRedirectUriResolver(
    @Value("\${oauth.allowed-redirect-uris:}")
    allowedRedirectUrisProperty: String,
) {
    private val allowedRedirectUris: Set<String> = allowedRedirectUrisProperty
        .split(",")
        .map(String::trim)
        .filter(String::isNotBlank)
        .map(::normalizeRedirectUri)
        .toSet()

    fun requireAllowedRedirectUri(redirectUri: String): String {
        if (allowedRedirectUris.isEmpty()) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        val normalizedRedirectUri = normalizeRedirectUri(redirectUri)
        if (normalizedRedirectUri !in allowedRedirectUris) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return normalizedRedirectUri
    }

    fun requireAllowedOrigin(origin: String): String {
        val normalizedOrigin = normalizeOrigin(origin)
        buildKakaoRedirectUri(normalizedOrigin)

        return normalizedOrigin
    }

    fun createState(origin: String): String =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(requireAllowedOrigin(origin).toByteArray(StandardCharsets.UTF_8))

    fun resolveOriginFromState(state: String?): String {
        if (state.isNullOrBlank()) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        val decodedState = try {
            String(Base64.getUrlDecoder().decode(padBase64(state)), StandardCharsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return requireAllowedOrigin(decodedState)
    }

    fun buildKakaoRedirectUri(origin: String): String =
        requireAllowedRedirectUri("${normalizeOrigin(origin)}$KAKAO_CALLBACK_PATH")

    fun buildFrontendCallbackUri(origin: String): String =
        buildKakaoRedirectUri(origin)

    fun buildFrontendLogoutCallbackUri(origin: String): String =
        buildUri(requireAllowedOrigin(origin), FRONTEND_LOGOUT_CALLBACK_PATH)

    fun buildBackendCallbackUri(origin: String, provider: String): String =
        if (provider == KAKAO_PROVIDER) buildKakaoRedirectUri(origin) else throw BusinessException(AuthErrorCode.OAUTH_FAILED)

    fun buildBackendLogoutCallbackUri(origin: String, provider: String): String =
        if (provider == KAKAO_PROVIDER) buildFrontendLogoutCallbackUri(origin) else throw BusinessException(AuthErrorCode.OAUTH_FAILED)

    private fun buildUri(origin: String, path: String): String = "${normalizeOrigin(origin)}$path"

    private fun normalizeRedirectUri(redirectUri: String): String {
        val uri = parseUri(redirectUri)
        val scheme = requireSupportedScheme(uri)
        val host = uri.host?.lowercase()
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        val path = uri.rawPath?.takeIf(String::isNotBlank)
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)

        if (uri.userInfo != null || uri.rawQuery != null || uri.rawFragment != null) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://$host$port$path"
    }

    private fun normalizeOrigin(origin: String): String {
        val uri = parseUri(origin)

        val scheme = requireSupportedScheme(uri)
        val host = uri.host?.lowercase()
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)

        val path = uri.rawPath.orEmpty()
        if (
            uri.userInfo != null ||
            uri.rawQuery != null ||
            uri.rawFragment != null ||
            (path.isNotBlank() && path != "/")
        ) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "$scheme://$host$port"
    }

    private fun parseUri(value: String): URI =
        try {
            URI(value.trim())
        } catch (_: Exception) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

    private fun requireSupportedScheme(uri: URI): String {
        val scheme = uri.scheme?.lowercase()
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)

        if (scheme !in SUPPORTED_SCHEMES) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return scheme
    }

    private fun padBase64(value: String): String =
        when (value.length % 4) {
            2 -> "$value=="
            3 -> "$value="
            else -> value
        }

    companion object {
        private val SUPPORTED_SCHEMES = setOf("http", "https")
        private const val KAKAO_PROVIDER = "kakao"
        private const val KAKAO_CALLBACK_PATH = "/auth/kakao/callback"
        private const val FRONTEND_LOGOUT_CALLBACK_PATH = "/auth/logout/callback"
    }
}
