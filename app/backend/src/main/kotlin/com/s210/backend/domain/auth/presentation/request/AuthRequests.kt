package com.s210.backend.domain.auth.presentation.request

data class SignupRequest(
    val loginId: String,
    val password: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val agreeSms: Boolean = false,
    val agreeMarketing: Boolean = false
)

data class LoginRequest(
    val loginId: String,
    val password: String
)

data class TokenRefreshRequest(
    val refreshToken: String
)
