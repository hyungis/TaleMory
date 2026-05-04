package com.s210.backend.domain.auth.application

import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.OauthSignupProfile
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.oauth.KakaoOAuthClient
import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupTokenProvider
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.OauthAccount
import com.s210.backend.domain.user.entity.User
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
    private val oauthRedirectUriResolver: OauthRedirectUriResolver,
    private val oauthSignupTokenProvider: OauthSignupTokenProvider,
) {
    fun signUp(command: SignupCommand): Long {
        val activeLoginUser = memberRepository.findByLoginIdAndDeletedAtIsNull(command.loginId)
        if (activeLoginUser != null) {
            throw BusinessException(CommonErrorCode.DUPLICATE_LOGIN_ID)
        }

        val existingEmailUser = memberRepository.findByEmailAndDeletedAtIsNull(command.email)
        if (existingEmailUser != null) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        val withdrawnLoginUser = memberRepository
            .findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(command.loginId)
        val withdrawnEmailUser = memberRepository
            .findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(command.email)

        if (withdrawnLoginUser != null) {
            if (!command.restoreConfirmed) {
                throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
            }
            if (withdrawnEmailUser != null && withdrawnEmailUser.id != withdrawnLoginUser.id) {
                throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
            }
            return restoreUser(withdrawnLoginUser, command)
        }

        if (withdrawnEmailUser != null) {
            if (!command.restoreConfirmed) {
                throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
            }
            return restoreUser(withdrawnEmailUser, command)
        }

        return memberRepository.save(
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
    }

    fun login(command: LoginCommand): AuthResult {
        val authenticationToken = UsernamePasswordAuthenticationToken(command.loginId, command.password)
        val authentication = authenticationManager.authenticate(authenticationToken)
        val tokenInfo: TokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(command.loginId, tokenInfo.refreshToken)

        val user = memberRepository.findByLoginIdAndDeletedAtIsNull(command.loginId)
            ?: throw BusinessException(CommonErrorCode.USER_NOT_FOUND)

        return AuthResult(tokenInfo.grantType, tokenInfo.accessToken, tokenInfo.refreshToken, user)
    }

    fun loginWithKakaoCallback(code: String, redirectUri: String): OauthCallbackResult {
        val allowedRedirectUri = oauthRedirectUriResolver.requireAllowedRedirectUri(redirectUri)
        val oauthUserProfile = kakaoOAuthClient.fetchUserProfile(code, allowedRedirectUri)

        return createOauthCallbackResult(oauthUserProfile)
    }

    fun getOauthAuthorizeUrl(provider: String, origin: String): String {
        requireSupportedProvider(provider)
        val redirectUri = oauthRedirectUriResolver.buildBackendCallbackUri(origin, provider)
        val state = oauthRedirectUriResolver.createState(origin)
        return kakaoOAuthClient.buildAuthorizeUrl(redirectUri, state)
    }

    fun getOauthLogoutUrl(provider: String, origin: String): String {
        requireSupportedProvider(provider)
        val logoutRedirectUri = oauthRedirectUriResolver.buildBackendLogoutCallbackUri(origin, provider)
        val state = oauthRedirectUriResolver.createState(origin)
        return kakaoOAuthClient.buildLogoutUrl(logoutRedirectUri, state)
    }

    fun loginWithOauthCallback(provider: String, code: String, origin: String): AuthResult {
        requireSupportedProvider(provider)

        val redirectUri = oauthRedirectUriResolver.buildBackendCallbackUri(origin, provider)
        val oauthUserProfile = kakaoOAuthClient.fetchUserProfile(code, redirectUri)
        return when (val result = createOauthCallbackResult(oauthUserProfile)) {
            is OauthCallbackResult.Login -> result.authResult
            is OauthCallbackResult.SignupRequired -> throw BusinessException(AuthErrorCode.OAUTH_FAILED)
            is OauthCallbackResult.RestoreRequired -> throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
        }
    }

    fun signUpWithKakao(command: OauthSignupCommand): AuthResult {
        validateOauthSignupCommand(command)
        val oauthSignupToken = oauthSignupTokenProvider.parseToken(command.signupToken)
        requireSupportedProvider(oauthSignupToken.provider)
        val kakaoEmail = requireMatchingOauthEmail(command, oauthSignupToken.email)

        val existingOauthAccount = oauthAccountRepository.findByProviderAndProviderUserId(
            oauthSignupToken.provider,
            oauthSignupToken.providerUserId,
        )
        if (existingOauthAccount != null) {
            if (existingOauthAccount.deletedAt != null || existingOauthAccount.user.deletedAt != null) {
                if (!command.restoreConfirmed) {
                    throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
                }
                restoreUser(existingOauthAccount.user)
            }
            return createOauthLoginResult(existingOauthAccount.user, oauthSignupToken.provider)
        }

        val withdrawnEmailUser = memberRepository
            .findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(kakaoEmail)
        if (withdrawnEmailUser != null) {
            if (!command.restoreConfirmed) {
                throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
            }
            restoreUser(withdrawnEmailUser)
            oauthAccountRepository.save(
                OauthAccount(
                    user = withdrawnEmailUser,
                    provider = oauthSignupToken.provider,
                    providerUserId = oauthSignupToken.providerUserId,
                )
            )
            return createOauthLoginResult(withdrawnEmailUser, oauthSignupToken.provider)
        }

        val existingEmailUser = memberRepository.findByEmailAndDeletedAtIsNull(kakaoEmail)
        if (existingEmailUser != null) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        val createdUser = memberRepository.save(
            User(
                loginId = null,
                passwordHash = null,
                email = kakaoEmail,
                name = command.name,
                nickname = command.nickname,
                phone = command.phone,
                agreeSms = command.agreeSms,
                agreeMarketing = command.agreeMarketing,
            )
        )

        oauthAccountRepository.save(
            OauthAccount(
                user = createdUser,
                provider = oauthSignupToken.provider,
                providerUserId = oauthSignupToken.providerUserId,
            )
        )

        return createOauthLoginResult(createdUser, oauthSignupToken.provider)
    }

    private fun createOauthCallbackResult(oauthUserProfile: OauthUserProfile): OauthCallbackResult {
        val oauthAccount = oauthAccountRepository.findByProviderAndProviderUserId(
            oauthUserProfile.provider,
            oauthUserProfile.providerUserId,
        )
        if (oauthAccount != null) {
            if (oauthAccount.deletedAt != null || oauthAccount.user.deletedAt != null) {
                return OauthCallbackResult.RestoreRequired(
                    signupToken = oauthSignupTokenProvider.createToken(oauthUserProfile),
                    profile = oauthUserProfile.toSignupProfile(),
                )
            }
            return OauthCallbackResult.Login(createOauthLoginResult(oauthAccount.user, oauthUserProfile.provider))
        }

        val withdrawnEmailUser = memberRepository
            .findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(oauthUserProfile.email)
        if (withdrawnEmailUser != null) {
            return OauthCallbackResult.RestoreRequired(
                signupToken = oauthSignupTokenProvider.createToken(oauthUserProfile),
                profile = oauthUserProfile.toSignupProfile(),
            )
        }

        return OauthCallbackResult.SignupRequired(
            signupToken = oauthSignupTokenProvider.createToken(oauthUserProfile),
            profile = oauthUserProfile.toSignupProfile(),
        )
    }

    private fun OauthUserProfile.toSignupProfile(): OauthSignupProfile =
        OauthSignupProfile(
            email = email,
            name = name,
            nickname = nickname,
            phone = phone,
        )

    private fun createOauthLoginResult(user: User, provider: String): AuthResult {
        val principal = createOauthPrincipal(user, provider)
        val authentication = UsernamePasswordAuthenticationToken(principal, "", principal.authorities)
        val tokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(principal.username, tokenInfo.refreshToken)

        return AuthResult(
            grantType = tokenInfo.grantType,
            accessToken = tokenInfo.accessToken,
            refreshToken = tokenInfo.refreshToken,
            user = user,
            provider = provider,
        )
    }

    private fun validateOauthSignupCommand(command: OauthSignupCommand) {
        val phone = command.phone?.trim()

        if (
            command.signupToken.isBlank() ||
            command.email.isBlank() ||
            command.name.isBlank() ||
            command.nickname.isBlank()
        ) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        if (!EMAIL_PATTERN.matches(command.email.trim())) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        if (!phone.isNullOrEmpty() && !PHONE_PATTERN.matches(phone)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireMatchingOauthEmail(command: OauthSignupCommand, tokenEmail: String): String {
        val requestEmail = command.email.trim()
        val kakaoEmail = tokenEmail.trim()

        if (!EMAIL_PATTERN.matches(kakaoEmail) || requestEmail != kakaoEmail) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        return kakaoEmail
    }

    private fun restoreUser(user: User): Long {
        user.deletedAt = null

        oauthAccountRepository.findAllByUser_Id(user.id)
            .forEach { oauthAccount -> oauthAccount.deletedAt = null }

        return user.id
    }

    private fun restoreUser(user: User, command: SignupCommand): Long {
        user.loginId = command.loginId
        user.passwordHash = passwordEncoder.encode(command.password)
        user.email = command.email
        user.name = command.name
        user.nickname = command.nickname
        user.phone = command.phone
        user.agreeSms = command.agreeSms
        user.agreeMarketing = command.agreeMarketing

        return restoreUser(user)
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
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        private val PHONE_PATTERN = Regex("^[0-9\\-+\\s]{7,}$")
    }
}
