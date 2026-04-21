package com.s210.backend.domain.auth.application.dto

data class TokenInfo(
    val userId: String,
    val grantType: String,
    val accessToken: String,
    val refreshToken: String,
)