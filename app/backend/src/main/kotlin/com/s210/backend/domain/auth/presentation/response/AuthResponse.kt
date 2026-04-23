package com.s210.backend.domain.auth.presentation.response

import com.s210.backend.domain.user.entity.User

data class AuthResponse(
    val accessToken: String,
    val user: User
)

data class RefreshTokenResponse(
    val accessToken: String
)
