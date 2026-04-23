package com.s210.backend.domain.auth.presentation.support

import com.s210.backend.common.jwt.REFRESH_EXPIRATION_MILLISECONDS
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component

@Component
class RefreshTokenCookieManager {
    private val cookieName = "refresh_token"
    private val cookiePath = "/api/auth"

    fun addRefreshToken(response: HttpServletResponse, refreshToken: String) {
        response.addHeader(
            HttpHeaders.SET_COOKIE,
            createCookie(refreshToken, REFRESH_EXPIRATION_MILLISECONDS / 1000).toString()
        )
    }

    fun expireRefreshToken(response: HttpServletResponse) {
        response.addHeader(
            HttpHeaders.SET_COOKIE,
            createCookie("", 0).toString()
        )
    }

    fun resolveRefreshToken(request: HttpServletRequest): String? =
        request.cookies
            ?.firstOrNull { it.name == cookieName }
            ?.value
            ?.takeIf { it.isNotBlank() }

    private fun createCookie(value: String, maxAgeSeconds: Long): ResponseCookie =
        ResponseCookie.from(cookieName, value)
            .httpOnly(true)
            .secure(false)
            .sameSite("Lax")
            .path(cookiePath)
            .maxAge(maxAgeSeconds)
            .build()
}
