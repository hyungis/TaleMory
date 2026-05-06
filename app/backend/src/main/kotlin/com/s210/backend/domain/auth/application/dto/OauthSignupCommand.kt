package com.s210.backend.domain.auth.application.dto

data class OauthSignupCommand(
    val signupToken: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val password: String? = null,
    val termAgreements: List<TermAgreementCommand> = emptyList(),
    val restoreConfirmed: Boolean = false,
    val linkConfirmed: Boolean = false,
)
