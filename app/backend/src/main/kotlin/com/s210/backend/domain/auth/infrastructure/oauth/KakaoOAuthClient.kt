package com.s210.backend.domain.auth.infrastructure.oauth

import com.fasterxml.jackson.annotation.JsonProperty
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.exception.AuthErrorCode
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder

@Component
class KakaoOAuthClient(
    @Value("\${oauth.kakao.client-id:}")
    private val clientId: String,
    @Value("\${oauth.kakao.client-secret:}")
    private val clientSecret: String,
) {
    private val restClient = RestClient.create()

    fun buildAuthorizeUrl(redirectUri: String, state: String): String {
        if (clientId.isBlank() || redirectUri.isBlank() || state.isBlank()) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return try {
            UriComponentsBuilder.fromUriString(KAKAO_AUTHORIZE_URL)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("scope", KAKAO_SCOPE)
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString()
        } catch (_: Exception) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }
    }

    fun fetchUserProfile(code: String, redirectUri: String): OauthUserProfile {
        val oauthAccessToken = exchangeAuthorizationCode(code, redirectUri)
        val userInfo = requestUserInfo(oauthAccessToken)

        val providerUserId = userInfo.id?.toString()
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        val email = userInfo.kakaoAccount.email
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        val nickname = userInfo.kakaoAccount.profile.nickname
            ?.takeIf { it.isNotBlank() }
            ?: "카카오사용자$providerUserId"

        return OauthUserProfile(
            provider = KAKAO_PROVIDER,
            providerUserId = providerUserId,
            email = email,
            name = userInfo.kakaoAccount.name?.takeIf { it.isNotBlank() } ?: nickname,
            nickname = nickname,
            phone = normalizePhoneNumber(userInfo.kakaoAccount.phoneNumber),
        )
    }

    fun buildLogoutUrl(logoutRedirectUri: String, state: String): String {
        if (clientId.isBlank() || logoutRedirectUri.isBlank() || state.isBlank()) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return try {
            UriComponentsBuilder.fromUriString(KAKAO_LOGOUT_URL)
                .queryParam("client_id", clientId)
                .queryParam("logout_redirect_uri", logoutRedirectUri)
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString()
        } catch (_: Exception) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }
    }

    private fun exchangeAuthorizationCode(code: String, redirectUri: String): String {
        val formData = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("client_id", clientId)
            add("redirect_uri", redirectUri)
            add("code", code)

            if (clientSecret.isNotBlank()) {
                add("client_secret", clientSecret)
            }
        }

        val response = try {
            restClient.post()
                .uri(KAKAO_TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(formData)
                .retrieve()
                .body(KakaoTokenResponse::class.java)
        } catch (_: Exception) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }

        return response?.accessToken?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)
    }

    private fun requestUserInfo(accessToken: String): KakaoUserInfoResponse {
        return try {
            restClient.get()
                .uri(KAKAO_USER_INFO_URL)
                .headers { headers -> headers.setBearerAuth(accessToken) }
                .retrieve()
                .body(KakaoUserInfoResponse::class.java)
                ?: throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        } catch (_: Exception) {
            throw BusinessException(AuthErrorCode.OAUTH_FAILED)
        }
    }

    private fun normalizePhoneNumber(phoneNumber: String?): String? {
        if (phoneNumber.isNullOrBlank()) return null

        return phoneNumber
            .replace(" ", "")
            .replace("+82", "0")
    }

    private data class KakaoTokenResponse(
        @JsonProperty("access_token")
        val accessToken: String? = null,
    )

    private data class KakaoUserInfoResponse(
        val id: Long? = null,
        @JsonProperty("kakao_account")
        val kakaoAccount: KakaoAccount = KakaoAccount(),
    )

    private data class KakaoAccount(
        val email: String? = null,
        val name: String? = null,
        @JsonProperty("phone_number")
        val phoneNumber: String? = null,
        val profile: KakaoProfile = KakaoProfile(),
    )

    private data class KakaoProfile(
        val nickname: String? = null,
    )

    companion object {
        private const val KAKAO_PROVIDER = "kakao"
        private const val KAKAO_SCOPE = "account_email profile_nickname"
        private const val KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
        private const val KAKAO_LOGOUT_URL = "https://kauth.kakao.com/oauth/logout"
        private const val KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
        private const val KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me"
    }
}
