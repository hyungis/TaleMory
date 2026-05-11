package com.s210.backend.domain.auth.presentation.request

import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.application.dto.TermAgreementCommand

data class SignupRequest(
    val loginId: String,
    val password: String,
    val passwordCheck: String? = null,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val termAgreements: List<TermAgreementRequest> = emptyList(),
    val restoreConfirmed: Boolean = false,
) {
    fun toCommand(): SignupCommand =
        SignupCommand(
            loginId = loginId.trim(),
            password = password,
            passwordCheck = passwordCheck,
            email = email.trim(),
            name = name.trim(),
            nickname = nickname.trim(),
            phone = phone?.trim()?.takeIf { it.isNotEmpty() },
            termAgreements = termAgreements.map { it.toCommand() },
            restoreConfirmed = restoreConfirmed,
        )
}

data class LoginRequest(
    val loginId: String,
    val password: String,
    val restoreConfirmed: Boolean = false,
) {
    fun toCommand(): LoginCommand =
        LoginCommand(
            loginId = loginId.trim(),
            password = password,
            restoreConfirmed = restoreConfirmed,
    )
}

data class EmailVerificationSendRequest(
    val email: String,
)

data class EmailVerificationVerifyRequest(
    val email: String,
    val code: String,
)

data class KakaoCallbackRequest(
    val code: String,
    val redirectUri: String,
)

data class TermAgreementRequest(
    val termId: Long,
    val agreed: Boolean,
) {
    fun toCommand(): TermAgreementCommand =
        TermAgreementCommand(
            termId = termId,
            agreed = agreed,
        )
}

data class KakaoSignupRequest(
    val signupToken: String,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String? = null,
    val password: String? = null,
    val termAgreements: List<TermAgreementRequest> = emptyList(),
    val restoreConfirmed: Boolean = false,
    val linkConfirmed: Boolean = false,
) {
    fun toCommand(): OauthSignupCommand =
        OauthSignupCommand(
            signupToken = signupToken,
            email = email.trim(),
            name = name.trim(),
            nickname = nickname.trim(),
            phone = phone?.trim()?.takeIf { it.isNotEmpty() },
            password = password,
            termAgreements = termAgreements.map { it.toCommand() },
            restoreConfirmed = restoreConfirmed,
            linkConfirmed = linkConfirmed,
        )
}
