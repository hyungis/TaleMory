package com.s210.backend.domain.auth.application.dto

data class AuthResult(
    val accessToken: String,
    val refreshToken: String
)
