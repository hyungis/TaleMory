package com.s210.backend.domain.auth.application.dto

data class OauthSignupCommand(
    val signupToken: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreeSms: Boolean,
    val agreeMarketing: Boolean,
)
