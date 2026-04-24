package com.s210.backend.domain.auth.application.dto

import com.s210.backend.domain.user.entity.User

data class AuthResult(
    val grantType: String,
    val accessToken: String,
    val refreshToken: String,
    val user: User,
    val provider: String? = null,
)
