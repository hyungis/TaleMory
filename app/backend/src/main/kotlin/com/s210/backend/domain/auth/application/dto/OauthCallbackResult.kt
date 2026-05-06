package com.s210.backend.domain.auth.application.dto

sealed interface OauthCallbackResult {
    data class Login(
        val authResult: AuthResult,
    ) : OauthCallbackResult

    data class SignupRequired(
        val signupToken: String,
        val profile: OauthSignupProfile,
    ) : OauthCallbackResult

    data class RestoreRequired(
        val signupToken: String,
        val profile: OauthSignupProfile,
        val passwordRequired: Boolean,
    ) : OauthCallbackResult

    data class LinkRequired(
        val signupToken: String,
        val profile: OauthSignupProfile,
    ) : OauthCallbackResult
}

data class OauthSignupProfile(
    val email: String,
    val name: String,
    val nickname: String,
    val phone: String?,
)
