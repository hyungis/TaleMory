package com.s210.backend.domain.auth.application

import com.s210.backend.common.entity.TokenInfo
import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.domain.auth.application.dto.AuthResult
import com.s210.backend.domain.auth.application.dto.AvailabilityResult
import com.s210.backend.domain.auth.application.dto.LoginCommand
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.OauthSignupProfile
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.application.dto.TermAgreementCommand
import com.s210.backend.domain.auth.entity.CustomUser
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.oauth.KakaoOAuthClient
import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupTokenProvider
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.terms.exception.TermsErrorCode
import com.s210.backend.domain.terms.infrastructure.repository.TermsRepository
import com.s210.backend.domain.user.entity.OauthAccount
import com.s210.backend.domain.user.entity.User
import com.s210.backend.domain.user.exception.UserErrorCode
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
    private val termsRepository: TermsRepository,
    private val emailVerificationService: EmailVerificationService,
) {
    fun signUp(command: SignupCommand): Long {
        validateSignupCommand(command)

        val activeLoginUser = memberRepository.findByLoginIdAndDeletedAtIsNull(command.loginId)
        if (activeLoginUser != null) {
            throw BusinessException(CommonErrorCode.DUPLICATE_LOGIN_ID)
        }

        val existingEmailUser = memberRepository.findByEmailAndDeletedAtIsNull(command.email)
        if (existingEmailUser != null) {
            throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
        }

        emailVerificationService.requireVerified(command.email)

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
            requireAvailableNickname(command.nickname, withdrawnLoginUser.id)
            return restoreUser(withdrawnLoginUser, command).also {
                emailVerificationService.consumeVerified(command.email)
            }
        }

        if (withdrawnEmailUser != null) {
            if (!command.restoreConfirmed) {
                throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
            }
            requireAvailableNickname(command.nickname, withdrawnEmailUser.id)
            return restoreUser(withdrawnEmailUser, command).also {
                emailVerificationService.consumeVerified(command.email)
            }
        }

        requireAvailableNickname(command.nickname)

        return memberRepository.save(
            User(
                loginId = command.loginId,
                passwordHash = passwordEncoder.encode(command.password),
                email = command.email,
                name = command.name,
                nickname = command.nickname,
                phone = command.phone,
            )
        ).id.also {
            emailVerificationService.consumeVerified(command.email)
        }
    }

    fun findLoginIdAvailability(loginId: String): AvailabilityResult {
        val normalizedLoginId = loginId.trim()
        if (normalizedLoginId.length < MIN_LOGIN_ID_LENGTH) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        return AvailabilityResult(
            available = !memberRepository.existsByLoginIdAndDeletedAtIsNull(normalizedLoginId),
        )
    }

    fun findNicknameAvailability(nickname: String): AvailabilityResult {
        val normalizedNickname = nickname.trim()
        if (normalizedNickname.isBlank()) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }

        return AvailabilityResult(
            available = !memberRepository.existsByNicknameAndDeletedAtIsNull(normalizedNickname),
        )
    }

    fun login(command: LoginCommand): AuthResult {
        restoreWithdrawnPasswordUserIfRequested(command)?.let {
            return it
        }

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
            is OauthCallbackResult.LinkRequired -> throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
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
                requireRestorePasswordIfNeeded(existingOauthAccount.user, command.password)
                requireAvailableNickname(command.nickname, existingOauthAccount.user.id)
                restoreUser(existingOauthAccount.user, command)
            }
            return createOauthLoginResult(existingOauthAccount.user, oauthSignupToken.provider)
        }

        val withdrawnEmailUser = memberRepository
            .findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(kakaoEmail)
        if (withdrawnEmailUser != null) {
            if (!command.restoreConfirmed) {
                throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
            }
            requireRestorePasswordIfNeeded(withdrawnEmailUser, command.password)
            requireAvailableNickname(command.nickname, withdrawnEmailUser.id)
            restoreUser(withdrawnEmailUser, command)
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
            if (!command.linkConfirmed) {
                throw BusinessException(CommonErrorCode.DUPLICATE_EMAIL)
            }
            linkOauthAccount(existingEmailUser, oauthSignupToken.provider, oauthSignupToken.providerUserId)
            return createOauthLoginResult(existingEmailUser, oauthSignupToken.provider)
        }

        requireRequiredTermsAgreed(command.termAgreements)
        requireAvailableNickname(command.nickname)

        val createdUser = memberRepository.save(
            User(
                loginId = null,
                passwordHash = null,
                email = kakaoEmail,
                name = command.name,
                nickname = command.nickname,
                phone = command.phone,
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

    private fun linkOauthAccount(user: User, provider: String, providerUserId: String) {
        oauthAccountRepository.save(
            OauthAccount(
                user = user,
                provider = provider,
                providerUserId = providerUserId,
            )
        )
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
                    passwordRequired = oauthAccount.user.hasPassword(),
                )
            }
            return OauthCallbackResult.Login(createOauthLoginResult(oauthAccount.user, oauthUserProfile.provider))
        }

        val existingEmailUser = memberRepository.findByEmailAndDeletedAtIsNull(oauthUserProfile.email)
        if (existingEmailUser != null) {
            return OauthCallbackResult.LinkRequired(
                signupToken = oauthSignupTokenProvider.createToken(oauthUserProfile),
                profile = oauthUserProfile.toSignupProfile(),
            )
        }

        val withdrawnEmailUser = memberRepository
            .findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc(oauthUserProfile.email)
        if (withdrawnEmailUser != null) {
            return OauthCallbackResult.RestoreRequired(
                signupToken = oauthSignupTokenProvider.createToken(oauthUserProfile),
                profile = oauthUserProfile.toSignupProfile(),
                passwordRequired = withdrawnEmailUser.hasPassword(),
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

    private fun createPasswordLoginResult(user: User): AuthResult {
        val principal = createPasswordPrincipal(user)
        val authentication = UsernamePasswordAuthenticationToken(principal, "", principal.authorities)
        val tokenInfo = jwtTokenProvider.createToken(authentication)

        refreshTokenInfoRepositoryRedis.save(principal.username, tokenInfo.refreshToken)

        return AuthResult(
            grantType = tokenInfo.grantType,
            accessToken = tokenInfo.accessToken,
            refreshToken = tokenInfo.refreshToken,
            user = user,
        )
    }

    private fun restoreWithdrawnPasswordUserIfRequested(command: LoginCommand): AuthResult? {
        val activeLoginUser = memberRepository.findByLoginIdAndDeletedAtIsNull(command.loginId)
        if (activeLoginUser != null) {
            return null
        }

        val withdrawnLoginUser = memberRepository
            .findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(command.loginId)
            ?: return null

        requireMatchingPassword(withdrawnLoginUser, command.password)
        if (!command.restoreConfirmed) {
            throw BusinessException(AuthErrorCode.WITHDRAWN_ACCOUNT)
        }

        restoreUser(withdrawnLoginUser)
        return createPasswordLoginResult(withdrawnLoginUser)
    }

    private fun validateOauthSignupCommand(command: OauthSignupCommand) {
        requireValidOauthSignupRequiredFields(command)
        requireValidEmail(command.email)
        requireValidPhone(command.phone)
    }

    private fun validateSignupCommand(command: SignupCommand) {
        requireValidSignupRequiredFields(command)
        requireMatchingPassword(command)
        requireValidEmail(command.email)
        requireValidPhone(command.phone)
        if (!command.restoreConfirmed) {
            requireRequiredTermsAgreed(command.termAgreements)
        }
    }

    private fun requireValidOauthSignupRequiredFields(command: OauthSignupCommand) {
        if (
            command.signupToken.isBlank() ||
            command.email.isBlank() ||
            command.name.isBlank() ||
            command.nickname.isBlank()
        ) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireValidSignupRequiredFields(command: SignupCommand) {
        if (
            command.loginId.isBlank() ||
            command.loginId.length < MIN_LOGIN_ID_LENGTH ||
            command.password.isBlank() ||
            command.password.length < MIN_PASSWORD_LENGTH ||
            command.email.isBlank() ||
            command.name.isBlank() ||
            command.nickname.isBlank()
        ) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireMatchingPassword(command: SignupCommand) {
        if (command.passwordCheck != null && command.password != command.passwordCheck) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireMatchingPassword(user: User, password: String) {
        val passwordHash = user.passwordHash
        if (passwordHash.isNullOrBlank() || !passwordEncoder.matches(password, passwordHash)) {
            throw BusinessException(AuthErrorCode.INVALID_CREDENTIALS)
        }
    }

    private fun requireRestorePasswordIfNeeded(user: User, password: String?) {
        if (!user.hasPassword()) {
            return
        }

        val rawPassword = password?.takeIf { it.isNotBlank() }
            ?: throw BusinessException(AuthErrorCode.INVALID_CREDENTIALS)
        requireMatchingPassword(user, rawPassword)
    }

    private fun requireValidEmail(email: String) {
        if (!EMAIL_PATTERN.matches(email.trim())) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireValidPhone(phone: String?) {
        val normalizedPhone = phone?.trim()
        if (!normalizedPhone.isNullOrEmpty() && !PHONE_PATTERN.matches(normalizedPhone)) {
            throw BusinessException(CommonErrorCode.INVALID_INPUT)
        }
    }

    private fun requireRequiredTermsAgreed(termAgreements: List<TermAgreementCommand>) {
        val requiredTermIds = findConfiguredRequiredTermIds()

        val agreedTermIds = termAgreements
            .asSequence()
            .filter { it.agreed }
            .map { it.termId }
            .toSet()

        if (!agreedTermIds.containsAll(requiredTermIds)) {
            throw BusinessException(TermsErrorCode.REQUIRED_TERMS_NOT_AGREED)
        }
    }

    private fun findConfiguredRequiredTermIds(): Set<Long> {
        val requiredTermIds = termsRepository.findAllByIsRequiredTrueOrderByIdAsc()
            .map { it.id }
            .toSet()

        if (requiredTermIds.isEmpty()) {
            throw BusinessException(TermsErrorCode.REQUIRED_TERMS_NOT_CONFIGURED)
        }

        return requiredTermIds
    }

    private fun requireAvailableNickname(nickname: String, excludedUserId: Long? = null) {
        val duplicated = if (excludedUserId == null) {
            memberRepository.existsByNicknameAndDeletedAtIsNull(nickname)
        } else {
            memberRepository.existsByNicknameAndDeletedAtIsNullAndIdNot(nickname, excludedUserId)
        }

        if (duplicated) {
            throw BusinessException(UserErrorCode.NICKNAME_DUPLICATED)
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
        return restoreUser(user)
    }

    private fun restoreUser(user: User, command: OauthSignupCommand): Long {
        user.email = command.email
        user.name = command.name
        user.nickname = command.nickname
        user.phone = command.phone
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

    private fun createPasswordPrincipal(user: User): CustomUser =
        CustomUser(
            userId = user.id,
            loginId = user.loginId ?: "",
            password = user.passwordHash ?: "",
            authorities = listOf(SimpleGrantedAuthority("ROLE_MEMBER")),
        )

    private fun User.hasPassword(): Boolean =
        !passwordHash.isNullOrBlank()

    private fun requireSupportedProvider(provider: String) {
        if (provider != SUPPORTED_PROVIDER) {
            throw BusinessException(AuthErrorCode.UNSUPPORTED_OAUTH_PROVIDER)
        }
    }

    companion object {
        private const val SUPPORTED_PROVIDER = "kakao"
        private const val MIN_LOGIN_ID_LENGTH = 4
        private const val MIN_PASSWORD_LENGTH = 6
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        private val PHONE_PATTERN = Regex("^[0-9\\-+\\s]{7,}$")
    }
}
