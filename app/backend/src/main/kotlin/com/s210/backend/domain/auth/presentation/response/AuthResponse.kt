package com.s210.backend.domain.auth.presentation.response

import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.AvailabilityResult
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.application.dto.OauthSignupProfile
import java.time.LocalDateTime

data class AuthResponse(
    val accessToken: String,
    val user: AuthUserResponse
)

data class SignupResponse(
    val userId: Long,
)

data class RefreshTokenResponse(
    val accessToken: String
)

data class AvailabilityResponse(
    val available: Boolean,
)

data class EmailVerificationSendResponse(
    val expiresInSeconds: Long,
)

data class EmailVerificationVerifyResponse(
    val verified: Boolean,
)

data class KakaoCallbackResponse(
    val status: String,
    val accessToken: String? = null,
    val user: AuthUserResponse? = null,
    val signupToken: String? = null,
    val profile: OauthSignupProfileResponse? = null,
    val passwordRequired: Boolean = false,
)

data class OauthSignupProfileResponse(
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
)

data class AuthUserResponse(
    val userId: Long,
    val loginId: String?,
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
    val agreeSms: Boolean,
    val agreeMarketing: Boolean,
    val onboardingCompleted: Boolean,
    val provider: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
)

fun AuthResult.toAuthResponse(): AuthResponse =
    AuthResponse(
        accessToken = accessToken,
        user = AuthUserResponse(
            userId = user.id,
            loginId = user.loginId,
            email = user.email,
            name = user.name,
            nickname = user.nickname,
            phone = user.phone,
            agreeSms = user.agreeSms,
            agreeMarketing = user.agreeMarketing,
            onboardingCompleted = user.onboardingCompleted,
            provider = provider,
            createdAt = user.createdAt,
            updatedAt = user.updatedAt,
        ),
    )

fun AvailabilityResult.toAvailabilityResponse(): AvailabilityResponse =
    AvailabilityResponse(available = available)

fun OauthCallbackResult.toKakaoCallbackResponse(): KakaoCallbackResponse =
    when (this) {
        is OauthCallbackResult.Login -> authResult.toKakaoCallbackResponse()
        is OauthCallbackResult.SignupRequired -> KakaoCallbackResponse(
            status = CALLBACK_STATUS_SIGNUP_REQUIRED,
            signupToken = signupToken,
            profile = profile.toResponse(),
        )
        is OauthCallbackResult.RestoreRequired -> KakaoCallbackResponse(
            status = CALLBACK_STATUS_RESTORE_REQUIRED,
            signupToken = signupToken,
            profile = profile.toResponse(),
            passwordRequired = passwordRequired,
        )
        is OauthCallbackResult.LinkRequired -> KakaoCallbackResponse(
            status = CALLBACK_STATUS_LINK_REQUIRED,
            signupToken = signupToken,
            profile = profile.toResponse(),
        )
    }

private fun AuthResult.toKakaoCallbackResponse(): KakaoCallbackResponse {
    val authResponse = toAuthResponse()

    return KakaoCallbackResponse(
        status = CALLBACK_STATUS_LOGIN,
        accessToken = authResponse.accessToken,
        user = authResponse.user,
    )
}

private fun OauthSignupProfile.toResponse(): OauthSignupProfileResponse =
    OauthSignupProfileResponse(
        email = email,
        name = name,
        nickname = nickname,
        phone = phone,
    )

private const val CALLBACK_STATUS_LOGIN = "LOGIN"
private const val CALLBACK_STATUS_SIGNUP_REQUIRED = "SIGNUP_REQUIRED"
private const val CALLBACK_STATUS_RESTORE_REQUIRED = "RESTORE_REQUIRED"
private const val CALLBACK_STATUS_LINK_REQUIRED = "LINK_REQUIRED"
