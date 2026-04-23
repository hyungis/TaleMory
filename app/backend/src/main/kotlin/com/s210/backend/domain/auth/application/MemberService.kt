package com.s210.backend.domain.auth.application

import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.common.response.ApiResponse
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.oauth.KakaoOAuthClient
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.User
import com.s210.backend.domain.user.entity.OauthAccount
import com.s210.backend.domain.user.infrastructure.repository.OauthAccountRepository
import jakarta.transaction.Transactional
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Transactional
@Service
class MemberService(
    private val memberRepository: MemberRepository,
    private val oauthAccountRepository: OauthAccountRepository,
    private val jwtTokenProvider: JwtTokenProvider,
    private val passwordEncoder: PasswordEncoder,
    private val refreshTokenInfoRepositoryRedis: RefreshTokenInfoRepositoryRedis,
    private val authenticationManager: AuthenticationManager,
    private val kakaoOAuthClient: KakaoOAuthClient,
) {
    fun signUp(command: SignupCommand): ApiResponse<Unit> {
        if (memberRepository.existsByLoginId(command.loginId)) {
            throw BusinessException(CommonErrorCode.DUPLICATE_LOGIN_ID)
        }
        if (memberRepository.existsByEmail(command.email)) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        val id = memberRepository.save(
            User(
                loginId = command.loginId,
                passwordHash = passwordEncoder.encode(command.password),
                email = command.email,
                name = command.name,
                nickname = command.nickname,
                phone = command.phone,
                agreeSms = command.agreeSms,
                agreeMarketing = command.agreeMarketing,
            )
        ).id

        return ApiResponse(
            success = true,
            data = null,
            message = id.toString(),
        )
    }

    fun login(command: LoginCommand): AuthResult {
        val authenticationToken = UsernamePasswordAuthenticationToken(command.loginId, command.password)
        val authentication = authenticationManager.authenticate(authenticationToken)
        val tokenInfo: TokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(command.loginId, tokenInfo.refreshToken)

        val user = memberRepository.findByLoginId(command.loginId)
            ?: throw BusinessException(CommonErrorCode.USER_NOT_FOUND)

        return AuthResult(tokenInfo.grantType, tokenInfo.accessToken, tokenInfo.refreshToken, user)
    }

    fun getOauthAuthorizeUrl(provider: String): String {
        requireSupportedProvider(provider)
        return kakaoOAuthClient.buildAuthorizeUrl()
    }

    fun getOauthLogoutUrl(provider: String): String {
        requireSupportedProvider(provider)
        return kakaoOAuthClient.buildLogoutUrl()
    }

    fun loginWithOauthCallback(provider: String, code: String): AuthResult {
        requireSupportedProvider(provider)

        val oauthUserProfile = kakaoOAuthClient.fetchUserProfile(code)
        val user = findOrCreateOauthUser(oauthUserProfile)
        val principal = createOauthPrincipal(user, oauthUserProfile.provider)
        val authentication = UsernamePasswordAuthenticationToken(principal, "", principal.authorities)
        val tokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(principal.username, tokenInfo.refreshToken)

        return AuthResult(
            grantType = tokenInfo.grantType,
            accessToken = tokenInfo.accessToken,
            refreshToken = tokenInfo.refreshToken,
            user = user,
            provider = oauthUserProfile.provider,
        )
    }

    fun logoutWithOauthCallback(provider: String, refreshToken: String?) {
        requireSupportedProvider(provider)

        logout(null, refreshToken)
    }

    fun deleteAllRefreshToken(loginId: String) {
        refreshTokenInfoRepositoryRedis.deleteByUserId(loginId)
    }

    fun logout(loginId: String?, refreshToken: String?) {
        if (!loginId.isNullOrBlank()) {
            refreshTokenInfoRepositoryRedis.deleteByUserId(loginId)
            return
        }

        if (refreshToken.isNullOrBlank()) {
            return
        }

        val principalId = refreshTokenInfoRepositoryRedis.findByRefreshToken(refreshToken)

        if (!principalId.isNullOrBlank()) {
            refreshTokenInfoRepositoryRedis.deleteByUserId(principalId)
            return
        }

        refreshTokenInfoRepositoryRedis.deleteByRefreshToken(refreshToken)
    }

    fun validateRefreshTokenAndCreateToken(refreshToken: String): TokenInfo {
        refreshTokenInfoRepositoryRedis.findByRefreshToken(refreshToken)
            ?: throw BusinessException(CommonErrorCode.INVALID_REFRESH_TOKEN)

        val newTokenInfo = jwtTokenProvider.validateRefreshTokenAndCreateToken(refreshToken)

        // refresh token 은 1회용으로 운용하고, 재발급 직후 이전 토큰을 폐기한다.
        refreshTokenInfoRepositoryRedis.deleteByRefreshToken(refreshToken)
        refreshTokenInfoRepositoryRedis.save(newTokenInfo.userId, newTokenInfo.refreshToken)

        return newTokenInfo
    }

    private fun findOrCreateOauthUser(profile: OauthUserProfile): User {
        val oauthAccount = oauthAccountRepository.findByProviderAndProviderUserIdAndDeletedAtIsNull(
            profile.provider,
            profile.providerUserId,
        )
        if (oauthAccount != null) {
            return oauthAccount.user
        }

        val user = memberRepository.findByEmail(profile.email)
            ?: memberRepository.save(
                User(
                    loginId = null,
                    passwordHash = null,
                    email = profile.email,
                    name = profile.name,
                    nickname = profile.nickname,
                    phone = profile.phone,
                    agreeSms = false,
                    agreeMarketing = false,
                )
            )

        oauthAccountRepository.save(
            OauthAccount(
                user = user,
                provider = profile.provider,
                providerUserId = profile.providerUserId,
            )
        )

        return user
    }

    private fun createOauthPrincipal(user: User, provider: String): CustomUser {
        val principalId = user.loginId ?: "oauth:$provider:${user.id}"

        return CustomUser(
            userId = user.id,
            loginId = principalId,
            password = "",
            authorities = listOf(SimpleGrantedAuthority("ROLE_MEMBER")),
        )
    }

    private fun requireSupportedProvider(provider: String) {
        if (provider != SUPPORTED_PROVIDER) {
            throw BusinessException(AuthErrorCode.UNSUPPORTED_OAUTH_PROVIDER)
        }
    }

    companion object {
        private const val SUPPORTED_PROVIDER = "kakao"
    }
}
