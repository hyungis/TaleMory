package com.s210.backend.domain.auth.application.dto

data class SignupCommand(
    val loginId: String,
    val password: String,
    val passwordCheck: String? = null,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val termAgreements: List<TermAgreementCommand> = emptyList(),
    val restoreConfirmed: Boolean = false,
)
