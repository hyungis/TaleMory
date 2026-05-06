package com.s210.backend.domain.auth.application.dto

data class LoginCommand(
    val loginId: String,
    val password: String,
    val restoreConfirmed: Boolean = false,
)
