package com.s210.backend.domain.auth.presentation.request

import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand

data class SignupRequest(
    val loginId: String,
    val password: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val agreeSms: Boolean = false,
    val agreeMarketing: Boolean = false
){
    fun toCommand(): SignupCommand =
        SignupCommand(
            loginId = loginId,
            password = password,
            email = email,
            name = name,
            nickname = nickname,
            phone = phone,
            agreeSms = agreeSms,
            agreeMarketing = agreeMarketing,
        )
}

data class LoginRequest(
    val loginId: String,
    val password: String
){
    fun toCommand(): LoginCommand =
        LoginCommand(
            loginId = loginId,
            password = password,
        )
}

data class TokenRefreshRequest(
    val refreshToken: String
)
