package com.s210.backend.domain.auth.application.dto

data class OauthUserProfile(
    val provider: String,
    val providerUserId: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
)
