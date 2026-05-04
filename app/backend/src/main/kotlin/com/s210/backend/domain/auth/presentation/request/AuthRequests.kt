package com.s210.backend.domain.auth.presentation.request

import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand

data class SignupRequest(
    val loginId: String,
    val password: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val agreeSms: Boolean = false,
    val agreeMarketing: Boolean = false,
    val restoreConfirmed: Boolean = false,
) {
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
            restoreConfirmed = restoreConfirmed,
        )
}

data class LoginRequest(
    val loginId: String,
    val password: String,
) {
    fun toCommand(): LoginCommand =
        LoginCommand(
            loginId = loginId,
            password = password,
        )
}

data class KakaoCallbackRequest(
    val code: String,
    val redirectUri: String,
)

data class KakaoSignupRequest(
    val signupToken: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val agreeSms: Boolean = false,
    val agreeMarketing: Boolean = false,
    val restoreConfirmed: Boolean = false,
) {
    fun toCommand(): OauthSignupCommand =
        OauthSignupCommand(
            signupToken = signupToken,
            email = email.trim(),
            name = name.trim(),
            nickname = nickname.trim(),
            phone = phone?.trim()?.takeIf { it.isNotEmpty() },
            agreeSms = agreeSms,
            agreeMarketing = agreeMarketing,
            restoreConfirmed = restoreConfirmed,
        )
}
