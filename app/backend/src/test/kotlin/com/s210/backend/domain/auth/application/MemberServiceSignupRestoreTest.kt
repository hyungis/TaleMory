package com.s210.backend.domain.auth.application

import com.s210.backend.common.exception.BusinessException
import com.s210.backend.common.exception.CommonErrorCode
import com.s210.backend.common.jwt.JwtTokenProvider
import com.s210.backend.common.jwt.RefreshTokenInfoRepositoryRedis
import com.s210.backend.domain.auth.application.dto.OauthCallbackResult
import com.s210.backend.domain.auth.application.dto.OauthSignupCommand
import com.s210.backend.domain.auth.application.dto.OauthUserProfile
import com.s210.backend.domain.auth.application.dto.SignupCommand
import com.s210.backend.domain.auth.exception.AuthErrorCode
import com.s210.backend.domain.auth.infrastructure.oauth.KakaoOAuthClient
import com.s210.backend.domain.auth.infrastructure.oauth.OauthRedirectUriResolver
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupToken
import com.s210.backend.domain.auth.infrastructure.oauth.OauthSignupTokenProvider
import com.s210.backend.domain.auth.infrastructure.repository.MemberRepository
import com.s210.backend.domain.user.entity.OauthAccount
import com.s210.backend.domain.user.entity.User
import com.s210.backend.domain.user.infrastructure.repository.OauthAccountRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.crypto.password.PasswordEncoder
import java.time.LocalDateTime

@ExtendWith(MockitoExtension::class)
class MemberServiceSignupRestoreTest {
    private val memberRepository: MemberRepository = mock(MemberRepository::class.java)
    private val oauthAccountRepository: OauthAccountRepository = mock(OauthAccountRepository::class.java)
    private val jwtTokenProvider: JwtTokenProvider = mock(JwtTokenProvider::class.java)
    private val passwordEncoder: PasswordEncoder = mock(PasswordEncoder::class.java)
    private val refreshTokenInfoRepositoryRedis: RefreshTokenInfoRepositoryRedis =
        mock(RefreshTokenInfoRepositoryRedis::class.java)
    private val authenticationManager: AuthenticationManager = mock(AuthenticationManager::class.java)
    private val kakaoOAuthClient: KakaoOAuthClient = mock(KakaoOAuthClient::class.java)
    private val oauthRedirectUriResolver: OauthRedirectUriResolver = mock(OauthRedirectUriResolver::class.java)
    private val oauthSignupTokenProvider: OauthSignupTokenProvider = mock(OauthSignupTokenProvider::class.java)

    private val service = MemberService(
        memberRepository = memberRepository,
        oauthAccountRepository = oauthAccountRepository,
        jwtTokenProvider = jwtTokenProvider,
        passwordEncoder = passwordEncoder,
        refreshTokenInfoRepositoryRedis = refreshTokenInfoRepositoryRedis,
        authenticationManager = authenticationManager,
        kakaoOAuthClient = kakaoOAuthClient,
        oauthRedirectUriResolver = oauthRedirectUriResolver,
        oauthSignupTokenProvider = oauthSignupTokenProvider,
    )

    @Test
    fun `signUp throws WITHDRAWN_ACCOUNT when loginId belongs to withdrawn user without confirmation`() {
        val user = withdrawnUser()
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc("old-login"),
        ).thenReturn(user)

        val ex = assertThrows<BusinessException> {
            service.signUp(signupCommand(restoreConfirmed = false))
        }

        assertEquals(AuthErrorCode.WITHDRAWN_ACCOUNT, ex.errorCode)
    }

    @Test
    fun `signUp restores withdrawn user and connected oauth accounts after confirmation`() {
        val user = withdrawnUser()
        val oauthAccount = OauthAccount(
            id = 11L,
            user = user,
            provider = "kakao",
            providerUserId = "kakao-user",
            deletedAt = LocalDateTime.now(),
        )
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByLoginIdAndDeletedAtIsNotNullOrderByDeletedAtDesc("old-login"),
        ).thenReturn(user)
        `when`(oauthAccountRepository.findAllByUser_Id(user.id)).thenReturn(listOf(oauthAccount))
        `when`(passwordEncoder.encode("new-password")).thenReturn("encoded-new-password")

        val userId = service.signUp(signupCommand(restoreConfirmed = true))

        assertEquals(user.id, userId)
        assertEquals("old-login", user.loginId)
        assertEquals("encoded-new-password", user.passwordHash)
        assertEquals("new@example.com", user.email)
        assertEquals("새 이름", user.name)
        assertEquals("새 닉네임", user.nickname)
        assertEquals("010-1234-5678", user.phone)
        assertTrue(user.agreeSms)
        assertTrue(user.agreeMarketing)
        assertNull(user.deletedAt)
        assertNull(oauthAccount.deletedAt)
    }

    @Test
    fun `signUp restores withdrawn user found by email after confirmation`() {
        val user = withdrawnUser()
        `when`(memberRepository.findByLoginIdAndDeletedAtIsNull("old-login")).thenReturn(null)
        `when`(
            memberRepository.findFirstByEmailAndDeletedAtIsNotNullOrderByDeletedAtDesc("new@example.com"),
        ).thenReturn(user)
        `when`(oauthAccountRepository.findAllByUser_Id(user.id)).thenReturn(emptyList())
        `when`(passwordEncoder.encode("new-password")).thenReturn("encoded-new-password")

        val userId = service.signUp(signupCommand(restoreConfirmed = true))

        assertEquals(user.id, userId)
        assertEquals("old-login", user.loginId)
        assertEquals("encoded-new-password", user.passwordHash)
        assertEquals("new@example.com", user.email)
        assertEquals("새 이름", user.name)
        assertEquals("새 닉네임", user.nickname)
        assertNull(user.deletedAt)
    }

    @Test
    fun `kakao callback returns restore required for withdrawn oauth account without restoring immediately`() {
        val user = withdrawnUser()
        val oauthAccount = OauthAccount(
            id = 11L,
            user = user,
            provider = "kakao",
            providerUserId = "kakao-user",
            deletedAt = LocalDateTime.now(),
        )
        val profile = oauthProfile()
        `when`(
            oauthRedirectUriResolver.requireAllowedRedirectUri("http://localhost/callback"),
        ).thenReturn("http://localhost/callback")
        `when`(kakaoOAuthClient.fetchUserProfile("code", "http://localhost/callback")).thenReturn(profile)
        `when`(
            oauthAccountRepository.findByProviderAndProviderUserId("kakao", "kakao-user"),
        ).thenReturn(oauthAccount)
        `when`(oauthSignupTokenProvider.createToken(profile)).thenReturn("restore-token")

        val result = service.loginWithKakaoCallback("code", "http://localhost/callback")

        assertTrue(result is OauthCallbackResult.RestoreRequired)
        val restoreRequired = result as OauthCallbackResult.RestoreRequired
        assertEquals("restore-token", restoreRequired.signupToken)
        assertEquals("old@example.com", restoreRequired.profile.email)
        assertTrue(user.deletedAt != null)
        assertTrue(oauthAccount.deletedAt != null)
    }

    @Test
    fun `signUpWithKakao rejects request email that differs from kakao signup token email`() {
        `when`(oauthSignupTokenProvider.parseToken("signup-token")).thenReturn(
            OauthSignupToken(
                provider = "kakao",
                providerUserId = "kakao-user",
                email = "kakao@example.com",
                name = "카카오 이름",
                nickname = "카카오 닉네임",
                phone = null,
            )
        )

        val ex = assertThrows<BusinessException> {
            service.signUpWithKakao(
                OauthSignupCommand(
                    signupToken = "signup-token",
                    email = "other@example.com",
                    name = "카카오 이름",
                    nickname = "카카오 닉네임",
                    phone = null,
                    agreeSms = false,
                    agreeMarketing = false,
                )
            )
        }

        assertEquals(CommonErrorCode.INVALID_INPUT, ex.errorCode)
    }

    private fun withdrawnUser(): User =
        User(
            id = 1L,
            loginId = "old-login",
            passwordHash = "old-password",
            email = "old@example.com",
            name = "기존 이름",
            nickname = "기존 닉네임",
        ).also {
            it.deletedAt = LocalDateTime.now().minusDays(7)
        }

    private fun signupCommand(restoreConfirmed: Boolean): SignupCommand =
        SignupCommand(
            loginId = "old-login",
            password = "new-password",
            email = "new@example.com",
            name = "새 이름",
            nickname = "새 닉네임",
            phone = "010-1234-5678",
            agreeSms = true,
            agreeMarketing = true,
            restoreConfirmed = restoreConfirmed,
        )

    private fun oauthProfile(): OauthUserProfile =
        OauthUserProfile(
            provider = "kakao",
            providerUserId = "kakao-user",
            email = "old@example.com",
            name = "기존 이름",
            nickname = "기존 닉네임",
            phone = null,
        )
}
