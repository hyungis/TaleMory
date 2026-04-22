package com.s210.backend.common.entity

data class TokenInfo(
    val userId: String,
    val grantType: String,
    val accessToken: String,
    val refreshToken: String,
)