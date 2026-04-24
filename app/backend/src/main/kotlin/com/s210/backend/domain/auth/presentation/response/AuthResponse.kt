package com.s210.backend.domain.auth.presentation.response

import com.s210.backend.domain.auth.application.dto.AuthResult
import java.time.LocalDateTime

data class AuthResponse(
    val accessToken: String,
    val user: AuthUserResponse
)

data class RefreshTokenResponse(
    val accessToken: String
)

data class AuthUserResponse(
    val userId: Long,
    val loginId: String?,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreeSms: Boolean,
    val agreeMarketing: Boolean,
    val provider: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
)

fun AuthResult.toAuthResponse(): AuthResponse =
    AuthResponse(
        accessToken = accessToken,
        user = AuthUserResponse(
            userId = user.id,
            loginId = user.loginId,
            email = user.email,
            name = user.name,
            nickname = user.nickname,
            phone = user.phone,
            agreeSms = user.agreeSms,
            agreeMarketing = user.agreeMarketing,
            provider = provider,
            createdAt = user.createdAt,
            updatedAt = user.updatedAt,
        ),
    )
